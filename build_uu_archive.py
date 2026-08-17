#!/usr/bin/env python3
import json
import re
import sys
import hashlib
import datetime
import subprocess
import os
from pathlib import Path
from urllib.parse import urlparse, urlunparse
from collections import defaultdict

# --- konfig ---
DOCS = Path("docs")
SOURCE_JSON = DOCS / "uu-status-details.json"
DATA_DIR    = DOCS / "data" / "uustatus"
LOGS_DIR    = DATA_DIR / "logs"
LATEST_JSON = DATA_DIR / "latest.json"          # forrige baseline for diff
CHANGES_LOG = LOGS_DIR / "changes.jsonl"
SNAP_BY_UPDATED = DATA_DIR / "snapshots_by_updated"
REGISTER_JSON = DATA_DIR / "erklaeringsregister.json"

# ---------- util ----------
def today_str():
    return datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")

def now_iso():
    """UTC-tidsstempel på formen 2026-08-17T06:20:28Z."""
    return (
        datetime.datetime.now(datetime.timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z")
    )

def load_json(fp: Path, fallback=None):
    try:
        if not fp.exists():
            return fallback
        with fp.open("r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return fallback

def to_domain(url: str):
    try:
        return urlparse(url).hostname or ""
    except Exception:
        return ""

def canon_url(u: str) -> str:
    """Normaliser URL for stabil matching."""
    try:
        p = urlparse((u or "").strip())
        netloc = (p.hostname or "").lower()
        if p.port and not ((p.scheme == "http" and p.port == 80) or (p.scheme == "https" and p.port == 443)):
            netloc = f"{netloc}:{p.port}"
        path = p.path or ""
        if path != "/" and path.endswith("/"):
            path = path[:-1]
        return urlunparse((p.scheme, netloc, path, "", "", ""))
    except Exception:
        return (u or "").strip()

def _extract_total(raw: dict):
    for k in [
        "totalNonConformities","total_non_conformities",
        "violationsCount","violations_count",
        "nonConformitiesCount","non_conformities_count",
        "wcagCount","wcag_count",
        "wcagViolationsCount","wcag_violations_count",
        "ncTotal","count","total"
    ]:
        v = raw.get(k)
        if isinstance(v, (int, float)):
            return int(v)
        if isinstance(v, str) and v.strip().isdigit():
            return int(v.strip())
    return None

def _extract_codes(raw: dict):
    # prøv kjente feltnavn først
    data = None
    for field in ["nonConformities","violations","wcag","wcagCodes","wcag_violations","wcag_nonconformities","issues","problems"]:
        if field in raw:
            data = raw[field]
            break
    # ellers: finn felt som "ser wcag-ish ut"
    if data is None:
        for k in raw.keys():
            lk = k.lower()
            if any(s in lk for s in ["wcag","violation","nonconform","issue","problem"]):
                data = raw[k]
                break

    codes = set()
    if data is None:
        return []

    if isinstance(data, str):
        for s in data.split(";"):
            s = s.strip()
            if s:
                codes.add(s)
        return sorted(codes)

    if isinstance(data, list):
        for it in data:
            if isinstance(it, str) and it.strip():
                codes.add(it.strip())
            elif isinstance(it, dict):
                for kk in ["code","wcag","criterion","id","wcagId","wcag_id"]:
                    v = it.get(kk)
                    if isinstance(v, str) and v.strip():
                        codes.add(v.strip())
                        break
        return sorted(codes)

    if isinstance(data, dict):
        for k in data.keys():
            ks = str(k).strip()
            if ks:
                codes.add(ks)
        return sorted(codes)

    return []

def normalize_entry(raw: dict):
    url = (raw.get("url") or raw.get("href") or "").strip()
    domain = (raw.get("domain") or to_domain(url)).strip()
    title = (raw.get("title") or raw.get("name") or "").strip()
    updatedAt_raw = (raw.get("updatedAt") or raw.get("lastChecked") or raw.get("last_checked") or "").strip()
    
    # Normaliser updatedAt til bare dato (YYYY-MM-DD)
    # Hvis det er en ISO timestamp (f.eks. "2025-11-04T02:07:28.273039+00:00"), ta de første 10 tegnene
    # Hvis det allerede er en dato (YYYY-MM-DD), behold den
    # Hvis det er tomt, behold tom streng
    if updatedAt_raw:
        if len(updatedAt_raw) >= 10 and updatedAt_raw[4] == "-" and updatedAt_raw[7] == "-":
            # Ser ut som en ISO-dato eller timestamp, ta bare dato-delen
            updatedAt = updatedAt_raw[:10]
        else:
            # Prøv å parse andre datoformater hvis nødvendig
            updatedAt = updatedAt_raw
    else:
        updatedAt = ""

    codes = _extract_codes(raw)
    total = _extract_total(raw)
    if total is None:
        total = len(codes)

    return {
        "url": url,
        # Tjenestenavnet må følge med. Når en erklæring fjernes fra registeret,
        # er arkivet eneste sted navnet fortsatt finnes – oppslag mot dagens
        # datasett gir ingenting, og da sto det bare «Erklæring (fjernet)».
        "name": (raw.get("name") or "").strip(),
        "domain": domain,
        "title": title,
        "updatedAt": updatedAt,
        "nonConformities": sorted(codes),
        "totalNonConformities": int(total),
    }

def sha1(obj):
    return hashlib.sha1(json.dumps(obj, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()

UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I
)

def erklaering_id(url: str) -> str:
    """Stabil identitet for én erklæring.

    UUID-en i URL-en, ikke hele adressen. Samme erklæring finnes nemlig på
    både https://uustatus.no/nb/… og /nn/… – bokmål og nynorsk er to visninger
    av samme sak hos uutilsynet.

    Med hele URL-en som nøkkel ble språkbyttet lest som at én erklæring
    forsvant og en helt ny dukket opp. Det skjedde 2026-03-05: fire
    erklæringer ble logget som «Ny erklæring» da adressen gikk fra /nb/ til
    /nn/, og de samme fire så ut som slettet da de senere gikk tilbake.

    Uten UUID i adressen faller vi tilbake på den kanoniske URL-en.
    """
    m = UUID_RE.search(url or "")
    return m.group(0).lower() if m else canon_url(url)

def key_for_url(url: str) -> str:
    return "id::" + erklaering_id(url)

def make_key(it: dict) -> str | None:
    """Primær nøkkel = erklæringens UUID. Fallback = title+domain."""
    if not isinstance(it, dict):
        return None
    url = (it.get("url") or it.get("href") or "").strip()
    if url:
        return key_for_url(url)
    title = (it.get("title") or it.get("name") or "").strip().lower()
    domain = (it.get("domain") or "").strip().lower()
    if title:
        return f"title::{domain}::{title}"
    return None

def index_by_key(items):
    out = {}
    for it in items:
        k = make_key(it)
        if k:
            out[k] = it
    return out

def read_current():
    data = load_json(SOURCE_JSON)
    if isinstance(data, dict) and isinstance(data.get("urls"), list):
        return [normalize_entry(x) for x in data["urls"]]
    if isinstance(data, list):
        return [normalize_entry(x) for x in data]
    return []

def read_prev_from_ref(ref: str):
    """Les baseline latest.json fra gitt git-ref.

    Returnerer:
      list  -- gyldig baseline (kan være tom liste hvis fila faktisk er tom)
      None  -- kunne ikke leses

    Skillet er vesentlig. Tidligere ga enhver feil tom liste tilbake, og en tom
    baseline får hele datasettet til å se nytt ut. Ett mislykket git-oppslag
    førte da til at alle 118 erklæringene ble logget som nyopprettede – det
    skjedde 2026-01-10 og 2026-07-19, og forklarer at 64 erklæringer står
    registrert som «ny» flere ganger.
    """
    try:
        # Få stderr også for bedre diagnostikk
        result = subprocess.run(
            ["git", "show", f"{ref}:{LATEST_JSON.as_posix()}"],
            text=True,
            capture_output=True,
            check=True
        )
        blob = result.stdout
        if not blob.strip():
            print(f"  WARN: Baseline fra {ref} er tom")
            return None
        js = json.loads(blob)
        urls = js.get("urls") if isinstance(js, dict) else js
        if not isinstance(urls, list):
            print(f"  WARN: Baseline fra {ref}: 'urls' er ikke en liste (type: {type(urls).__name__})")
            return None
        print(f"  Leser baseline fra {ref}: {len(urls)} entries")
        return urls
    except subprocess.CalledProcessError as e:
        stderr_msg = e.stderr if e.stderr else ""
        print(f"  WARN: Kunne ikke lese baseline fra {ref}: git show feilet (exit code {e.returncode})")
        if stderr_msg:
            print(f"    Git-feil: {stderr_msg.strip()}")
        return None
    except json.JSONDecodeError as e:
        print(f"  WARN: Kunne ikke parse baseline fra {ref}: JSON-feil: {e}")
        print(f"    Feil på linje {e.lineno}, kolonne {e.colno}")
        if 'blob' in locals() and blob:
            preview = blob[:200].replace('\n', '\\n')
            print(f"    Første 200 tegn: {preview}")
        return None
    except Exception as e:
        print(f"  WARN: Kunne ikke lese baseline fra {ref}: {type(e).__name__}: {e}")
        return None

def read_prev_from_local():
    """Les baseline latest.json fra lokal fil (for testing).

    Samme kontrakt som read_prev_from_ref: liste ved suksess, None ved feil.
    """
    try:
        if not LATEST_JSON.exists():
            print(f"  Leser baseline fra lokal fil: filen eksisterer ikke")
            return None
        js = load_json(LATEST_JSON, fallback=None)
        if js is None:
            print(f"  Leser baseline fra lokal fil: kunne ikke parse JSON")
            return None
        urls = js.get("urls") if isinstance(js, dict) else js
        if not isinstance(urls, list):
            print(f"  Leser baseline fra lokal fil: 'urls' er ikke en liste")
            return None
        print(f"  Leser baseline fra lokal fil: {len(urls)} entries")
        return urls
    except Exception as e:
        print(f"  WARN: Kunne ikke lese baseline fra lokal fil: {type(e).__name__}: {e}")
        return None

# --------- diff ----------
# `title` er bevisst utelatt: den er en avledet visningstekst, ikke
# tilgjengelighetsdata. En ren tittelendring skal ikke bli en arkivoppføring.
CHECK_FIELDS = ["updatedAt", "totalNonConformities"]

def compute_change(prev_entry: dict, curr_entry: dict):
    p_nc = set(prev_entry.get("nonConformities") or [])
    c_nc = set(curr_entry.get("nonConformities") or [])
    added = sorted(list(c_nc - p_nc))
    removed = sorted(list(p_nc - c_nc))

    changed = {}
    for f in CHECK_FIELDS:
        if prev_entry.get(f) != curr_entry.get(f):
            changed[f] = {"before": prev_entry.get(f), "after": curr_entry.get(f)}

    if added or removed:
        if "totalNonConformities" not in changed and len(p_nc) != len(c_nc):
            changed["totalNonConformities"] = {"before": len(p_nc), "after": len(c_nc)}

    # Ignorer updatedAt-endringer hvis det er den eneste endringen (uten faktiske endringer i nonConformities)
    if changed and len(changed) == 1 and "updatedAt" in changed:
        if not added and not removed:
            # Kun updatedAt endret, ingen faktiske endringer - ignorer
            return (None, [], [])

    if changed or added or removed:
        return (changed or None, added, removed)
    return (None, [], [])

def dedup_key(row: dict):
    """Nøkkel for å unngå å logge samme oppdagelse to ganger samme dag.

    Deteksjonsdatoen er med med vilje. Uten den ble en ekte gjentakelse slettet
    som duplikat: rettes 1.3.1, gjeninnføres den, og rettes igjen, fikk andre
    rettelse identisk nøkkel som den første og forsvant fra arkivet. Med datoen
    er kjøringen fortsatt idempotent innenfor samme døgn, samtidig som noe som
    faktisk skjer to ganger blir stående som to hendelser.
    """
    changed = row.get("changed") or {}
    total = changed.get("totalNonConformities") or {}
    return (
        row.get("detectedDate", ""),
        # Identitet, ikke adresse: ellers ville samme hendelse logget på nytt
        # dersom erklæringen byttet mellom /nb/ og /nn/.
        erklaering_id(row.get("url", "")),
        tuple(sorted(row.get("added") or [])),
        tuple(sorted(row.get("removed") or [])),
        total.get("after"),
    )


def make_initial_changes(curr_rows):
    """Hvis baseline mangler/er ulesbar eller ingen nøkler kan lages: marker ALT som nytt."""
    now = datetime.datetime.now(datetime.timezone.utc)
    # Tidssone-bevisst datetime gir allerede "+00:00"; bytt den mot "Z" i
    # stedet for å legge til, ellers blir det "+00:00Z" – som ikke er gyldig
    # ISO 8601, og som new Date() i nettleseren ikke klarer å tolke.
    now_iso = now.isoformat(timespec="seconds").replace("+00:00", "Z")
    detected_date = now.strftime("%Y-%m-%d")
    out = []
    for c in curr_rows:
        updated_date = (c.get("updatedAt") or "")[:10] or today_str()
        out.append({
            "ts": now_iso,
            "detectedDate": detected_date,
            "url": c.get("url") or "",
            "name": c.get("name") or c.get("title") or "",
            "domain": c.get("domain") or to_domain(c.get("url") or ""),
            "before_hash": None,
            "after_hash": sha1(c),
            "added": c.get("nonConformities") or [],
            "removed": [],
            "changed": {
                "newEntry": True,
                "totalNonConformities": {"before": 0, "after": c.get("totalNonConformities", 0)}
            },
            "updatedDate": updated_date
        })
    return out

def diff_once(prev_rows, curr_rows):
    prev_by = index_by_key(prev_rows or [])
    curr_by = index_by_key(curr_rows or [])

    # DEBUG: tell keys
    print(f"  prev_rows={len(prev_rows or [])} | prev_keys={len(prev_by)}  ||  curr_rows={len(curr_rows or [])} | curr_keys={len(curr_by)}")

    # Hvis vi ikke klarer å lage nøkler for dagens data, fall tilbake: behandle alle som nye.
    if (curr_rows and not curr_by):
        print("  WARN: 0 nøkler i dagens datasett. Faller tilbake til 'initial snapshot' for alle.")
        return make_initial_changes(curr_rows)

    changes = []
    now = datetime.datetime.now(datetime.timezone.utc)
    # Tidssone-bevisst datetime gir allerede "+00:00"; bytt den mot "Z" i
    # stedet for å legge til, ellers blir det "+00:00Z" – som ikke er gyldig
    # ISO 8601, og som new Date() i nettleseren ikke klarer å tolke.
    now_iso = now.isoformat(timespec="seconds").replace("+00:00", "Z")
    detected_date = now.strftime("%Y-%m-%d")

    # Nye/endrede
    for k, c in curr_by.items():
        p = prev_by.get(k)
        if p is None:
            updated_date = (c.get("updatedAt") or "")[:10] or today_str()
            changes.append({
                "ts": now_iso,
                "detectedDate": detected_date,
                "url": c.get("url") or "",
                "name": c.get("name") or c.get("title") or "",
                "domain": c.get("domain") or to_domain(c.get("url") or ""),
                "before_hash": None,
                "after_hash": sha1(c),
                "added": c.get("nonConformities") or [],
                "removed": [],
                "changed": {
                    "newEntry": True,
                    "totalNonConformities": {"before": 0, "after": c.get("totalNonConformities", 0)}
                },
                "updatedDate": updated_date
            })
        else:
            changed, added, removed = compute_change(p, c)
            if changed or added or removed:
                updated_date = (c.get("updatedAt") or "")[:10] or today_str()
                before_h = sha1(dict(p))
                after_h = sha1(dict(c))
                url_str = c.get("url") or ""
                print(f"  Oppdaget endring: {url_str[:60]}... (before_hash: {before_h[:16]}..., after_hash: {after_h[:16]}...)")
                changes.append({
                    "ts": now_iso,
                    "detectedDate": detected_date,
                    "url": url_str,
                    # Navnet må med her også, ikke bare på nye og fjernede.
                    # Dette er den vanligste radtypen: uten navnet ville en
                    # erklæring som endres i dag og slettes i morgen stått
                    # igjen i arkivet med bare en URL som gir 404.
                    "name": c.get("name") or c.get("title") or "",
                    "domain": c.get("domain") or to_domain(url_str),
                    "before_hash": before_h,
                    "after_hash": after_h,
                    "added": added,
                    "removed": removed,
                    "changed": changed,
                    "updatedDate": updated_date
                })

    # Fjernet
    for k, p in prev_by.items():
        if k in curr_by:
            continue
        p_nc = set(p.get("nonConformities") or [])
        removed = sorted(list(p_nc))
        updated_date = (p.get("updatedAt") or "")[:10] or today_str()
        changes.append({
            "ts": now_iso,
            "detectedDate": detected_date,
            "url": p.get("url") or "",
            # Fra forrige tilstand: erklæringen finnes ikke i dagens datasett.
            "name": p.get("name") or p.get("title") or "",
            "domain": p.get("domain") or to_domain(p.get("url") or ""),
            "before_hash": sha1(dict(p)),
            "after_hash": None,
            "added": [],
            "removed": removed,
            "changed": {
                "removedEntry": True,
                "totalNonConformities": {"before": len(p_nc), "after": 0}
            },
            "updatedDate": updated_date
        })

    return changes

# ---------- erklæringsregister ----------
#
# Datasettet fra uutilsynet inneholder bare erklæringer som finnes NÅ. Når en
# erklæring slettes hos uustatus.no, forsvinner navnet, bruddene og alt annet
# ut av kilden vår samme natt – og da står endringsarkivet igjen med en URL som
# peker på en side som ikke finnes.
#
# Registeret er langtidshukommelsen: én rad per erklæring vi noen gang har
# sett, med navnet, når vi så den først og sist, når den forsvant, og hvilke
# brudd den hadde siste gang vi så den. Rader fjernes aldri herfra.

def load_register() -> dict:
    """Les registeret som {kanonisk url: rad}. Tom dict hvis fila mangler."""
    data = load_json(REGISTER_JSON)
    rader = data.get("erklaeringer") if isinstance(data, dict) else data
    if not isinstance(rader, list):
        return {}
    out = {}
    for r in rader:
        if isinstance(r, dict) and (r.get("url") or "").strip():
            out[erklaering_id(r["url"])] = r
    return out


def rebuild_register_fra_logg(reg: dict) -> dict:
    """Gjenskap de fjernede erklæringene fra endringsloggen.

    Kjøres når registerfila mangler. Uten dette ville et tapt register bety at
    alt vi vet om slettede erklæringer forsvant for godt neste natt: dagens
    datasett inneholder dem ikke, så registeret ville blitt bygd opp igjen med
    bare de aktive. Endringsloggen har derimot én rad per fjerning, med navn,
    dato og bruddene erklæringen hadde.
    """
    if not CHANGES_LOG.exists():
        return reg

    funnet = 0
    try:
        with CHANGES_LOG.open("r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    row = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if not (row.get("changed") or {}).get("removedEntry"):
                    continue
                url = (row.get("url") or "").strip()
                if not url:
                    continue
                k = erklaering_id(url)
                dato = (row.get("detectedDate") or "")[:10]
                post = reg.get(k)
                if post is None:
                    post = {
                        "url": url,
                        "name": (row.get("name") or "").strip(),
                        "domain": (row.get("domain") or to_domain(url)).strip(),
                        "firstSeen": dato,
                        "lastSeen": dato,
                        "status": "fjernet",
                        "removedDates": [],
                    }
                    reg[k] = post
                    funnet += 1
                if dato and dato not in post["removedDates"]:
                    post["removedDates"].append(dato)
                    post["removedDates"].sort()
                total = (row.get("changed") or {}).get("totalNonConformities") or {}
                post["lastKnown"] = {
                    "updatedAt": (row.get("updatedDate") or "")[:10],
                    "totalNonConformities": int(total.get("before") or 0),
                    "nonConformities": sorted(row.get("removed") or []),
                }
    except Exception as e:
        print(f"  WARN: Kunne ikke gjenskape register fra loggen: {e}")
        return reg

    if funnet:
        print(f"  Gjenskapte {funnet} fjernede erklæringer fra endringsloggen.")
    return reg


def update_register(reg: dict, curr_rows: list, dagens_dato: str) -> dict:
    """Oppdater registeret mot dagens datasett.

    Erklæringer som finnes i dag får friske verdier. De som mangler markeres
    som fjernet – men lastKnown fryses slik den var sist vi så dem, for det er
    hele poenget: bruddene skal fortsatt kunne leses etterpå.
    """
    sett_i_dag = set()

    for rad in curr_rows:
        url = (rad.get("url") or "").strip()
        if not url:
            continue
        k = erklaering_id(url)
        sett_i_dag.add(k)
        post = reg.get(k) or {
            "url": url,
            "name": "",
            "domain": "",
            "firstSeen": dagens_dato,
            "removedDates": [],
        }
        post["url"] = url
        # Navnet overskrives bare av et faktisk navn. Et tomt felt i kilden
        # skal aldri kunne slette navnet vi allerede har.
        navn = (rad.get("name") or rad.get("title") or "").strip()
        if navn:
            post["name"] = navn
        post["domain"] = (rad.get("domain") or to_domain(url)).strip()
        post["lastSeen"] = dagens_dato
        post["status"] = "aktiv"
        post["lastKnown"] = {
            "updatedAt": rad.get("updatedAt") or "",
            "totalNonConformities": int(rad.get("totalNonConformities") or 0),
            "nonConformities": sorted(rad.get("nonConformities") or []),
        }
        reg[k] = post

    for k, post in reg.items():
        if k in sett_i_dag:
            continue
        if post.get("status") == "fjernet":
            continue
        # Første kjøring der erklæringen mangler. lastSeen og lastKnown røres
        # ikke – de skal peke på siste gang den faktisk fantes.
        post["status"] = "fjernet"
        datoer = post.get("removedDates")
        if not isinstance(datoer, list):
            datoer = []
        if dagens_dato not in datoer:
            datoer.append(dagens_dato)
        post["removedDates"] = datoer
        print(f"  Registeret: {post.get('name') or post.get('url')} er borte fra datasettet")

    return reg


def write_register(reg: dict) -> None:
    rader = sorted(
        reg.values(),
        key=lambda r: ((r.get("name") or "").lower(), r.get("url") or ""),
    )
    aktive = sum(1 for r in rader if r.get("status") == "aktiv")
    REGISTER_JSON.write_text(
        json.dumps(
            {
                "oppdatert": now_iso(),
                "antall": len(rader),
                "antallAktive": aktive,
                "antallFjernet": len(rader) - aktive,
                "erklaeringer": rader,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    print(
        f"Oppdaterte {REGISTER_JSON}: {len(rader)} erklæringer "
        f"({aktive} aktive, {len(rader) - aktive} fjernet)"
    )


# ---------- main ----------
def main():
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    SNAP_BY_UPDATED.mkdir(parents=True, exist_ok=True)
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    curr = read_current()
    if not isinstance(curr, list):
        print("Fant ikke gyldig dagsdata i docs/uu-status-details.json", file=sys.stderr)
        sys.exit(1)

    # Bestem referanser å teste som baseline
    # TEST_MODE: Bruk lokal fil i stedet for git HEAD (for raskere testing)
    test_mode = os.getenv("TEST_MODE", "").strip().lower() in ("1", "true", "yes", "on")
    forced_ref = os.getenv("BASELINE_REF", "").strip()
    auto_bt = os.getenv("AUTO_BACKTRACK", "").strip().lower() in ("1", "true", "yes", "on")
    max_bt = int(os.getenv("MAX_BACKTRACK", "10"))

    print(f"Dagens datasett: {len(curr)} elementer.")

    # Finn FØRSTE LESBARE baseline – ikke første som gir endringer.
    #
    # Den gamle løkken brøt på første ref som ga endringer. En uleselig baseline
    # gir alltid endringer (alt ser nytt ut), så tilbakesporingen forsterket
    # nettopp den feilen den skulle beskytte mot. På rolige dager gikk den også
    # videre til HEAD~1, HEAD~2 … og rapporterte eldre differ som dagsferske.
    if test_mode:
        print("TEST_MODE: Bruker lokal fil som baseline (ikke git HEAD)")
        prev_rows = read_prev_from_local()
        used_ref = "LOCAL_FILE" if prev_rows is not None else None
    else:
        if forced_ref:
            refs = [forced_ref]
        elif auto_bt:
            refs = ["HEAD"] + [f"HEAD~{i}" for i in range(1, max_bt + 1)]
        else:
            refs = ["HEAD"]

        prev_rows, used_ref = None, None
        for ref in refs:
            kandidat = read_prev_from_ref(ref)
            if kandidat is not None:
                prev_rows, used_ref = kandidat, ref
                break

    if prev_rows is None:
        # Ingen lesbar baseline noe sted. Er arkivet allerede i gang, er dette
        # en feil vi ikke skal gjette oss ut av: å behandle alt som nytt ville
        # skrevet ett falskt «ny erklæring»-innslag per løsning. Avbryt heller,
        # så neste kjøring får prøve igjen mot en intakt baseline.
        if CHANGES_LOG.exists() and CHANGES_LOG.stat().st_size > 0:
            print(
                "FEIL: Fant ingen lesbar baseline, men endringsloggen har "
                "historikk. Avbryter uten å skrive – arkivet skal ikke fylles "
                "med falske nyregistreringer.",
                file=sys.stderr,
            )
            sys.exit(1)
        print("Ingen baseline og tom endringslogg: dette er første kjøring.")
        final_changes = make_initial_changes(curr)
    else:
        final_changes = diff_once(prev_rows, curr)
        if not final_changes:
            print("Ingen endringer mellom baseline og dagens datasett.")

    print(f"Diff-baseline: {used_ref}  |  Endringer funnet: {len(final_changes)}")
    if final_changes:
        print(f"  Detaljer om endringer:")
        for ch in final_changes[:5]:  # Vis første 5 for debugging
            url = ch.get("url", "")[:50]
            before_h = ch.get("before_hash")
            after_h = ch.get("after_hash", "")
            print(f"    - {url}... (before: {str(before_h)[:16] if before_h else 'None'}..., after: {after_h[:16] if after_h else 'None'}...)")
        if len(final_changes) > 5:
            print(f"    ... og {len(final_changes) - 5} flere")

    # 1) Logg endringer, uten å skrive samme oppdagelse to ganger
    existing_changes = set()
    if CHANGES_LOG.exists():
        try:
            with CHANGES_LOG.open("r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        existing_changes.add(dedup_key(json.loads(line)))
                    except json.JSONDecodeError:
                        continue
        except Exception as e:
            print(f"  WARN: Kunne ikke lese eksisterende endringer: {e}")

    new_changes = []
    for row in final_changes:
        if not row.get("url"):
            # Skal ikke skje; logg heller for mye enn å miste en endring.
            new_changes.append(row)
            continue
        if dedup_key(row) in existing_changes:
            print(f"  Skipper duplikat: {row['url'][:50]}…")
        else:
            new_changes.append(row)


    # Skriv nye endringer til filen (legg til, ikke erstatt)
    if new_changes:
        # Legg til nye endringer (append mode)
        with CHANGES_LOG.open("a", encoding="utf-8") as f:
            for row in new_changes:
                f.write(json.dumps(row, ensure_ascii=False) + "\n")
        if len(new_changes) > 1:
            print(f"  Logget {len(new_changes)} nye endringer (skippet {len(final_changes) - len(new_changes)} duplikater)")
        else:
            print(f"  Logget {len(new_changes)} ny endring (skippet {len(final_changes) - len(new_changes)} duplikater)")
    else:
        # Hvis ingen nye endringer, gjør ingenting (behold alle eksisterende rader)
        print(f"  Alle {len(final_changes)} endringer var allerede logget (duplikater)")

    # 2) Skriv snapshots per updatedDate (kun hvis det er nye endringer)
    if new_changes:
        changed_by_date = defaultdict(list)
        curr_index = index_by_key(curr)
        for ch in new_changes:
            candidate = None
            url = (ch.get("url") or "").strip()
            if url:
                candidate = curr_index.get(key_for_url(url))
            if not candidate:
                # fallback: prøv direkte URL-match
                for it in curr:
                    if (it.get("url") or "") == url:
                        candidate = it
                        break
            if not candidate:
                continue
            key = (ch.get("updatedDate") or today_str())
            changed_by_date[key].append(candidate)

        for date_key, entries in changed_by_date.items():
            out_fp = SNAP_BY_UPDATED / f"{date_key}.json"
            existing = load_json(out_fp, fallback={"urls": []})
            exist_by = index_by_key(existing.get("urls", []))
            for e in entries:
                kk = make_key(e)
                if kk:
                    exist_by[kk] = e
            out_fp.write_text(json.dumps({"urls": list(exist_by.values())}, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"Skrev snapshot for {date_key}: {out_fp}")

    # 3) Oppdater baseline (ALLTID etter diff)
    # curr er allerede normalisert fra read_current(), så vi kan lagre direkte
    LATEST_JSON.write_text(json.dumps({"urls": curr}, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Oppdaterte {LATEST_JSON} med {len(curr)} normaliserte entries")

    # 4) Oppdater erklæringsregisteret.
    #
    # Kjøres alltid, også når diffen er tom: lastSeen skal flyttes fram hver
    # natt, ellers ser en erklæring som ikke har endret seg på et halvt år ut
    # som om vi mistet den for et halvt år siden.
    #
    # Registeret er den eneste kilden som overlever at en erklæring slettes hos
    # uutilsynet, så det skrives etter at alt annet er på plass.
    reg = load_register()
    if not reg:
        print("  Registeret er tomt – bygger det opp igjen.")
        reg = rebuild_register_fra_logg(reg)
    write_register(update_register(reg, curr, today_str()))

if __name__ == "__main__":
    main()
