#!/usr/bin/env python3
import json, re, sys, time
from pathlib import Path
from urllib.parse import urlparse
from datetime import datetime
try:
    import requests
    from bs4 import BeautifulSoup
except Exception as e:
    print("Missing deps. Make sure beautifulsoup4 and requests are installed.", file=sys.stderr)
    sys.exit(1)

DETAILS_FP = Path("docs/uu-status-details.json")
DATASET_URL = "https://data.uutilsynet.no/dataset/alle-erklaeringer"
SKATTEETATEN_ORG = "974761076"

WCAG_CODE_RE = re.compile(r"\b(?:[0-3]\.\d{1,2}\.\d{1,2}[a-z]?)\b", re.I)
DATE_NO_RE = re.compile(r"(?:Sist\s+(?:endret|oppdatert)[^0-9]{0,20})(\d{1,2}\.\d{1,2}\.\d{4})", re.I)
DATE_ISO_RE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")
OPPRETTET_RE = re.compile(
    r"(?:opprettet|oppretta)\s+(?:første\s*gang|første\s*gong)\s+(\d{1,2}\.\s*\w+\s+\d{4})",
    re.IGNORECASE
)
MONTHS_NO = {
    "januar": "January", "februar": "February", "mars": "March", "april": "April",
    "mai": "May", "juni": "June", "juli": "July", "august": "August",
    "september": "September", "oktober": "October", "november": "November", "desember": "December"
}

HEADERS = {
    "User-Agent": "Mozilla/5.0 (compatible; UU-Status-Bot/1.0; +https://github.com/)",
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
}

def to_domain(url: str) -> str:
    try:
        return urlparse(url).hostname or ""
    except Exception:
        return ""

def uniq_sorted(seq):
    seen = set()
    out = []
    for x in seq:
        if x not in seen:
            seen.add(x); out.append(x)
    return sorted(out)

def parse_date_no(s: str):
    """Konverter dd.mm.yyyy -> yyyy-mm-dd"""
    try:
        return datetime.strptime(s, "%d.%m.%Y").date().isoformat()
    except Exception:
        return None

def parse_no_month_date(s: str):
    """Konverter '5. januar 2023' -> '2023-01-05'"""
    if not s:
        return None
    raw = s.strip()
    for no, en in MONTHS_NO.items():
        raw = re.sub(no, en, raw, flags=re.IGNORECASE)
    try:
        return datetime.strptime(raw.replace("  ", " "), "%d. %B %Y").date().isoformat()
    except Exception:
        return None

def extract_codes_from_json_obj(obj):
    """Gå rekursivt gjennom et JSON-objekt og trekk ut WCAG-koder uansett felt/struktur."""
    found = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            # vanlige feltnavn
            if k.lower() in {"nonconformities","violations","wcag","wcagcodes","wcag_violations","wcag_nonconformities","issues","problems"}:
                if isinstance(v, list):
                    for it in v:
                        if isinstance(it, str) and WCAG_CODE_RE.search(it):
                            found.extend(WCAG_CODE_RE.findall(it))
                        elif isinstance(it, dict):
                            # typisk { code: "1.1.1", ... }
                            for kk in ["code","wcag","criterion","id","wcagId","wcag_id"]:
                                if isinstance(it.get(kk), str) and WCAG_CODE_RE.search(it[kk]):
                                    found.append(WCAG_CODE_RE.search(it[kk]).group(0))
                                    break
                elif isinstance(v, str) and WCAG_CODE_RE.search(v):
                    found.extend(WCAG_CODE_RE.findall(v))
            # uansett nøkkel: skann strenger og dypere noder
            if isinstance(v, str):
                found.extend(WCAG_CODE_RE.findall(v))
            elif isinstance(v, (list, dict)):
                found.extend(extract_codes_from_json_obj(v))
    elif isinstance(obj, list):
        for it in obj:
            found.extend(extract_codes_from_json_obj(it))
    elif isinstance(obj, str):
        found.extend(WCAG_CODE_RE.findall(obj))
    return found

def extract_updated_from_json_obj(obj):
    """Prøv å finne en ISO-dato i felt som heter updatedAt / lastUpdated / modified osv."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            lk = k.lower()
            if isinstance(v, str) and any(tag in lk for tag in ["updated", "modified", "lastchecked", "lastupdated"]):
                m = DATE_ISO_RE.search(v)
                if m:
                    return m.group(0)
            elif isinstance(v, (dict, list)):
                d = extract_updated_from_json_obj(v)
                if d: return d
    elif isinstance(obj, list):
        for it in obj:
            d = extract_updated_from_json_obj(it)
            if d: return d
    return None

def scrape_one(url: str, timeout=20):
    try:
        resp = requests.get(url, headers=HEADERS, timeout=timeout)
    except Exception as e:
        return None, None, None, None
    if resp.status_code != 200:
        return None, None, None, None

    html = resp.text
    soup = BeautifulSoup(html, "html.parser")

    # 1) Prøv Next.js __NEXT_DATA__ (vanlig på moderne sider)
    for script in soup.find_all("script"):
        if script.get("id") == "__NEXT_DATA__" or (script.string and script.string.strip().startswith("{")):
            try:
                data = json.loads(script.string)
                codes = extract_codes_from_json_obj(data)
                upd = extract_updated_from_json_obj(data)
                if codes:
                    text = soup.get_text(separator=" ", strip=True)
                    m_opp = OPPRETTET_RE.search(text)
                    opp = parse_no_month_date(m_opp.group(1)) if m_opp else None
                    return uniq_sorted(codes), upd, soup.title.string.strip() if soup.title else None, opp
            except Exception:
                pass

    # 2) Fallback: skann all tekst i HTML for WCAG-koder
    text = soup.get_text(separator=" ", strip=True)
    codes = uniq_sorted(WCAG_CODE_RE.findall(text))

    # 3) Finn oppdatert-dato i norsk format eller ISO i teksten
    upd = None
    m_no = DATE_NO_RE.search(text)
    if m_no:
        upd = parse_date_no(m_no.group(1))
    if not upd:
        m_iso = DATE_ISO_RE.search(text)
        if m_iso:
            upd = m_iso.group(0)

    # 4) Opprettet-dato
    m_opp = OPPRETTET_RE.search(text)
    opp = parse_no_month_date(m_opp.group(1)) if m_opp else None

    title = soup.title.string.strip() if soup.title else None
    return codes or None, upd, title, opp

def extract_api_records(payload):
    if not isinstance(payload, dict):
        return []
    embedded = payload.get("_embedded") or {}
    for key in ("dataElements", "items", "results", "content"):
        v = embedded.get(key)
        if isinstance(v, list) and v:
            return v
    return []

def extract_uuid(url: str) -> str:
    m = re.search(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", url, re.I)
    return m.group(0).lower() if m else ""

def normalize_nb_url(url: str) -> str:
    return re.sub(r"/(?:nn|en)/erklaringer/", "/nb/erklaringer/", url)

def fetch_skatteetaten_urls_from_api():
    """Returnerer liste med (url_nb, iktLoeysingNamn, sisteOppdatering) for Skatteetaten."""
    results = []
    page = 1
    while True:
        try:
            resp = requests.get(
                DATASET_URL,
                params={"page": page, "size": 50},
                headers={"User-Agent": "Mozilla/5.0 (compatible; UU-Status-Bot/1.0)"},
                timeout=30,
            )
            resp.raise_for_status()
            data = resp.json()
        except Exception as e:
            print(f"API-feil på side {page}: {e}", file=sys.stderr)
            break
        records = extract_api_records(data)
        if not records:
            break
        for rec in records:
            if str(rec.get("organisasjonsnummer") or "").strip() == SKATTEETATEN_ORG:
                url = normalize_nb_url((rec.get("erklaeringsAdresse") or "").strip())
                name = (rec.get("iktLoeysingNamn") or "").strip()
                updated = (rec.get("sisteOppdatering") or "").strip()
                if url:
                    results.append((url, name, updated))
        total_pages = int((data.get("page") or {}).get("totalPages") or 1)
        if page >= total_pages:
            break
        page += 1
        time.sleep(0.3)
    return results

def main():
    if not DETAILS_FP.exists():
        print("Fant ikke docs/uu-status-details.json", file=sys.stderr)
        sys.exit(1)

    obj = json.loads(DETAILS_FP.read_text(encoding="utf-8"))
    rows = obj.get("urls") if isinstance(obj, dict) else obj

    # UUID-basert oppslag for å matche API-URLer (som kan ha /nn/ prefix) mot details.json (som har /nb/)
    existing_by_uuid = {}
    for r in rows:
        u = (r.get("url") or r.get("href") or "").strip()
        uid = extract_uuid(u)
        if uid:
            existing_by_uuid[uid] = r

    api_entries = fetch_skatteetaten_urls_from_api()
    added = 0
    for url, name, updated in api_entries:
        uid = extract_uuid(url)
        if uid and uid in existing_by_uuid:
            # Oppdater sisteOppdatering fra API hvis den mangler
            r = existing_by_uuid[uid]
            if updated and not r.get("updatedAt"):
                r["updatedAt"] = updated[:10] if len(updated) >= 10 else updated
        elif url:
            new_entry = {"url": url, "name": name, "codes": []}
            if updated:
                new_entry["updatedAt"] = updated[:10] if len(updated) >= 10 else updated
            rows.append(new_entry)
            if uid:
                existing_by_uuid[uid] = new_entry
            added += 1
    if added:
        print(f"La til {added} nye URL-er frå API.")

    updated = 0
    for i, r in enumerate(rows):
        url = (r.get("url") or r.get("href") or "").strip()
        if not url:
            continue
        codes, upd, title, opp = scrape_one(url)
        if codes is not None:
            r["nonConformities"] = codes
            r["codes"] = codes
            r["totalNonConformities"] = len(codes)
            updated += 1
        if upd and not r.get("updatedAt"):
            r["updatedAt"] = upd
        if opp:
            r["opprettet"] = opp
        if title and not r.get("title"):
            r["title"] = title
        if not r.get("domain"):
            r["domain"] = to_domain(url)
        # høflig throttle for å være snill med tjeneren
        time.sleep(0.2)

    out = {"urls": rows} if isinstance(obj, dict) else rows
    DETAILS_FP.write_text(json.dumps(out, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Beriket {updated} av {len(rows)} entries med WCAG-koder.")

if __name__ == "__main__":
    main()
