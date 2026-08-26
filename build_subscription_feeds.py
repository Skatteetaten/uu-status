#!/usr/bin/env python3
"""Bygg abonnementskatalog og RSS-feeds for Power Automate.

Skriver tre filer, alle som en ren funksjon av inputfilene – ingen
veggklokke-tidsstempler, så samme input gir identiske bytes:

  docs/data/subscriptions/declarations.json   datakontrakten (katalogen)
  docs/feeds/uu-catalog.xml                   katalogen som RSS 2.0 (transport)
  docs/feeds/uu-events.xml                    endringshendelser som RSS 2.0

Kildene er de samme som resten av løsningen bruker – det finnes ingen egen
sannhet her:

  docs/uu-status-details.json                 aktive erklæringer (enrich_uu_details.py)
  docs/data/uustatus/erklaeringsregister.json alle erklæringer vi har sett (build_uu_archive.py)
  docs/data/uustatus/logs/changes.jsonl       endringshistorikken (build_uu_archive.py)

Identiteten er erklæringens UUID, via erklaering_id() i build_uu_archive.py.
Hendelser utledes 1:1 fra radene i changes.jsonl. Loggen er append-only og
rader skrives aldri om, så hendelses-ID-ene (SHA1 av radens stabile felter) og
publiseringstidspunktene er stabile på tvers av kjøringer – samme kildeendring
gir aldri en ny hendelse ved neste bygging.

Se ABONNEMENT.md for hele kontrakten og begrensningene i kildedataene.
"""
import datetime
import email.utils
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_uu_archive as arkiv  # noqa: E402  (erklaering_id, load_json, sha1)
import enrich_uu_details  # noqa: E402  (beregn_frist, normalize_nb_url)

SCHEMA_VERSION = "1.0.0"
SITE_URL = "https://skatteetaten.github.io/uu-status/"

DOCS = Path("docs")
DETAILS_FP = DOCS / "uu-status-details.json"
REGISTER_FP = DOCS / "data" / "uustatus" / "erklaeringsregister.json"
CHANGES_FP = DOCS / "data" / "uustatus" / "logs" / "changes.jsonl"

CATALOG_FP = DOCS / "data" / "subscriptions" / "declarations.json"
CATALOG_FEED_FP = DOCS / "feeds" / "uu-catalog.xml"
EVENTS_FEED_FP = DOCS / "feeds" / "uu-events.xml"

# Hendelsesfeeden beholder de siste 250 hendelsene. Dagens rate er ~30 rader i
# måneden, så det tilsvarer rundt åtte måneders historikk. Power Automates
# RSS-trigger poller med minutters til timers mellomrom; selv et avbrudd på
# flere uker mister da ingenting, og fila holder seg under ~0,5 MB.
# Publiseringstidspunktene beregnes alltid over HELE loggen før kuttet, slik at
# en hendelse aldri skifter pubDate fordi eldre hendelser falt ut av vinduet.
MAX_EVENTS = 250


# ---------- datoer ----------
def parse_dato(s):
    """YYYY-MM-DD -> date, ellers None. Aldri gjettede verdier."""
    try:
        return datetime.date.fromisoformat((s or "").strip()[:10])
    except (ValueError, TypeError):
        return None


def parse_ts(s):
    """2026-08-17T06:20:28Z -> datetime i UTC, ellers None."""
    try:
        return datetime.datetime.strptime(
            (s or "").strip(), "%Y-%m-%dT%H:%M:%SZ"
        ).replace(tzinfo=datetime.timezone.utc)
    except (ValueError, TypeError):
        return None


# Fristregelen bor i enrich_uu_details.beregn_frist() – én implementasjon i
# Python, skrevet som `deadline` i details.json og gjenbrukt her, slik at
# katalogen, feedene og nettsiden aldri kan regne seg fram til ulike datoer.
frist = enrich_uu_details.beregn_frist


def tekstfelt(verdi):
    """Trimmet streng, eller "" for alt som ikke er en streng.

    Endringsloggen er append-only og rettes aldri automatisk. Én rad med feil
    TYPE i et felt (f.eks. "ts": 20260501 etter en håndredigering) skal hoppes
    over som ugyldig – ikke kaste AttributeError og blokkere hele nattjobben
    for alltid.
    """
    return verdi.strip() if isinstance(verdi, str) else ""


def rfc822(dt):
    """RFC 822-datoen RSS 2.0 krever, alltid GMT og alltid engelske navn."""
    return email.utils.format_datetime(dt, usegmt=True)


# ---------- lese kildene ----------
def les_endringer(fp=CHANGES_FP):
    rader = []
    if not fp.exists():
        return rader
    with fp.open("r", encoding="utf-8") as f:
        for linje in f:
            linje = linje.strip()
            if not linje:
                continue
            try:
                rad = json.loads(linje)
            except json.JSONDecodeError:
                continue
            if isinstance(rad, dict):
                rader.append(rad)
    return rader


def siste_endring_per_id(endringer):
    """Siste ts i endringsloggen per erklærings-UUID.

    Loggen inneholder bare reelle endringer (diffmotoren filtrerer bort rene
    updatedAt-endringer), så dette ER lastMeaningfulChangeAt.
    """
    ut = {}
    for rad in endringer:
        url = tekstfelt(rad.get("url"))
        ts = tekstfelt(rad.get("ts"))
        if not url or parse_ts(ts) is None:
            continue
        did = arkiv.erklaering_id(url)
        if did not in ut or ts > ut[did]:
            ut[did] = ts
    return ut


# ---------- katalogen ----------
def katalogpost(
    declaration_id,
    title,
    url,
    status,
    non_conformities,
    total,
    source_updated_at,
    opprettet,
    last_change,
    active,
    removed_at,
):
    """Én rad i katalogen. Manglende verdier er null, aldri oppdiktet."""
    return {
        "declarationId": declaration_id,
        "title": title or None,
        "declarationUrl": url or None,
        "status": status or None,
        "nonConformities": sorted(non_conformities or []),
        "totalNonConformities": total if isinstance(total, int) else None,
        # Fjernede erklæringer har ingen oppdateringsplikt, så fristen er null
        # for dem – ikke en gammel dato som ville utløst falske fristvarsler.
        "deadline": frist(source_updated_at, opprettet) if active else None,
        "sourceUpdatedAt": parse_dato(source_updated_at).isoformat()
        if parse_dato(source_updated_at)
        else None,
        "lastMeaningfulChangeAt": last_change,
        "active": bool(active),
        "removedAt": removed_at,
    }


def bygg_katalog(detaljer, register_rader, endringer):
    """Katalogen: aktive erklæringer fra details, fjernede fra registeret.

    Erklæringer som forsvinner fra kilden slettes ikke – de blir stående med
    active: false, slik at abonnementer og SharePoint-rader kan beholdes.
    """
    siste = siste_endring_per_id(endringer)
    per_id = {}

    for e in detaljer or []:
        url = enrich_uu_details.normalize_nb_url(tekstfelt(e.get("url")))
        if not url:
            continue
        did = arkiv.erklaering_id(url)
        per_id[did] = katalogpost(
            declaration_id=did,
            title=(e.get("name") or "").strip(),
            url=url,
            status=(e.get("samsvarsstatus") or "").strip(),
            non_conformities=e.get("nonConformities") or [],
            total=e.get("totalNonConformities")
            if isinstance(e.get("totalNonConformities"), int)
            else len(e.get("nonConformities") or []),
            source_updated_at=e.get("updatedAt"),
            opprettet=e.get("opprettet"),
            last_change=siste.get(did),
            active=True,
            removed_at=None,
        )

    for r in register_rader or []:
        # Registeret kan bære historiske /nn/-adresser (gjenoppbygd fra gamle
        # loggrader); kontrakten lover alltid /nb/.
        url = enrich_uu_details.normalize_nb_url(tekstfelt(r.get("url")))
        if not url:
            continue
        did = arkiv.erklaering_id(url)
        if did in per_id:
            continue  # aktiv – details.json er ferskest og vinner
        sist_kjent = r.get("lastKnown") or {}
        fjernet_datoer = r.get("removedDates") or []
        aktiv = r.get("status") == "aktiv"
        per_id[did] = katalogpost(
            declaration_id=did,
            title=(r.get("name") or "").strip(),
            url=url,
            # Registeret lagrer ikke samsvarsstatus, så den er null for
            # fjernede erklæringer. Dokumentert i ABONNEMENT.md.
            status=None,
            non_conformities=sist_kjent.get("nonConformities") or [],
            total=sist_kjent.get("totalNonConformities")
            if isinstance(sist_kjent.get("totalNonConformities"), int)
            else None,
            source_updated_at=sist_kjent.get("updatedAt"),
            opprettet=None,
            last_change=siste.get(did),
            active=aktiv,
            removed_at=(fjernet_datoer[-1] if fjernet_datoer and not aktiv else None),
        )

    return {
        "schemaVersion": SCHEMA_VERSION,
        "source": SITE_URL,
        "count": len(per_id),
        "declarations": sorted(per_id.values(), key=lambda d: d["declarationId"]),
    }


# ---------- hendelsene ----------
def hendelse_fra_rad(rad):
    """Én hendelse per rad i changes.jsonl. None hvis raden ikke kan brukes.

    Hendelsestypene er de dataene faktisk gjør mulig:
      declaration_created   raden har changed.newEntry
      declaration_removed   raden har changed.removedEntry
      declaration_changed   alt annet (reelle endringer i brudd/oppdatering)

    status_changed finnes ikke: diffmotoren sporer ikke samsvarsstatus.
    deadline_changed finnes ikke som egen type: fristen er utledet av
    updatedAt, og rene updatedAt-endringer filtreres som teknisk støy før de
    når loggen. Når updatedAt endres sammen med en reell endring, står
    «deadline» i changedFields. Se ABONNEMENT.md.
    """
    url = tekstfelt(rad.get("url"))
    ts = tekstfelt(rad.get("ts"))
    if not url or parse_ts(ts) is None:
        return None
    did = arkiv.erklaering_id(url)

    changed = rad.get("changed") or {}
    lagt_til = sorted(rad.get("added") or [])
    fjernet = sorted(rad.get("removed") or [])

    if changed.get("newEntry"):
        etype = "declaration_created"
    elif changed.get("removedEntry"):
        etype = "declaration_removed"
    else:
        etype = "declaration_changed"

    felter = []
    foer = {}
    naa = {}

    total = changed.get("totalNonConformities")
    if isinstance(total, dict):
        felter.append("totalNonConformities")
        foer["totalNonConformities"] = total.get("before")
        naa["totalNonConformities"] = total.get("after")
    if lagt_til or fjernet:
        felter.append("nonConformities")
    oppdatert = changed.get("updatedAt")
    if isinstance(oppdatert, dict):
        felter.extend(["sourceUpdatedAt", "deadline"])
        foer["sourceUpdatedAt"] = oppdatert.get("before") or None
        naa["sourceUpdatedAt"] = oppdatert.get("after") or None
        foer["deadline"] = frist(oppdatert.get("before"))
        naa["deadline"] = frist(oppdatert.get("after"))
    if etype == "declaration_created":
        felter.append("active")
        naa["active"] = True
        # Ingen før-tilstand finnes for en ny erklæring. Arkivraden bærer et
        # teknisk {before: 0}, men kontrakten sier at previousValues er null
        # når det ikke fantes noe før – ellers feilklassifiserer konsumenter
        # nyregistreringer som «sett før».
        foer = {}
    elif etype == "declaration_removed":
        felter.append("active")
        foer["active"] = True
        naa["active"] = False

    # Stabil og deterministisk: SHA1 av radens identifiserende felter, med
    # nøyaktig samme oppskrift som resten av løsningen (arkiv.sha1). Radene i
    # changes.jsonl skrives aldri om, så samme hendelse får samme ID i hver
    # eneste bygging – det er dette som hindrer doble varsler. Oppskriften er
    # fryst: endres den, får hele historikken nye ID-er.
    event_id = arkiv.sha1([ts, did, lagt_til, fjernet, changed])

    gjeldende_oppdatert = tekstfelt(rad.get("updatedDate")) or None
    return {
        "schemaVersion": SCHEMA_VERSION,
        "eventId": event_id,
        "eventType": etype,
        "declarationId": did,
        "title": tekstfelt(rad.get("name")) or None,
        # Kontrakten lover /nb/-adressen; gamle loggrader kan bære /nn/.
        "declarationUrl": enrich_uu_details.normalize_nb_url(url),
        "changedFields": felter,
        "previousValues": foer or None,
        "currentValues": naa,
        "addedNonConformities": lagt_til,
        "removedNonConformities": fjernet,
        "detectedAt": ts,
        "deadline": frist(gjeldende_oppdatert)
        if etype != "declaration_removed"
        else None,
    }


def bygg_hendelser(endringer):
    """Alle hendelser, sortert eldst først, med unike, stigende pubDate.

    Flere rader kan dele samme ts (én kjøring skriver alle radene sine med
    samme tidsstempel). Rekkefølgen ved likhet er deterministisk – (ts,
    declarationId, eventId) – og hver hendelse etter den første i en slik
    gruppe skyves ett sekund fram. Power Automates RSS-trigger hopper ellers
    over elementer som deler publiseringstidspunkt.

    Skyvingen beregnes over hele loggen, aldri over et utsnitt: loggen er
    append-only med stigende ts, så nye rader sorterer etter de gamle og kan
    ikke endre pubDate på noe som allerede er publisert.
    """
    hendelser = [h for h in (hendelse_fra_rad(r) for r in endringer) if h]
    hendelser.sort(key=lambda h: (h["detectedAt"], h["declarationId"], h["eventId"]))
    forrige = None
    for h in hendelser:
        dt = parse_ts(h["detectedAt"])
        if forrige is not None and dt <= forrige:
            dt = forrige + datetime.timedelta(seconds=1)
        h["pubDate"] = rfc822(dt)
        forrige = dt
    return hendelser


# ---------- RSS ----------
def kompakt_json(obj):
    return json.dumps(obj, ensure_ascii=False, separators=(",", ":"))


def bygg_rss(tittel, beskrivelse, elementer):
    """RSS 2.0 via ElementTree, som escaper &, < og > korrekt selv.

    elementer: liste av (tittel, lenke, guid, pubDate, beskrivelse-json).
    """
    rss = ET.Element("rss", version="2.0")
    kanal = ET.SubElement(rss, "channel")
    ET.SubElement(kanal, "title").text = tittel
    ET.SubElement(kanal, "link").text = SITE_URL
    ET.SubElement(kanal, "description").text = beskrivelse
    ET.SubElement(kanal, "language").text = "nb"
    if elementer:
        # Deterministisk: nyeste pubDate blant elementene, ikke veggklokka.
        nyeste = max(
            email.utils.parsedate_to_datetime(e[3]) for e in elementer
        )
        ET.SubElement(kanal, "lastBuildDate").text = rfc822(nyeste)
    for tit, lenke, guid, pub, beskr in elementer:
        item = ET.SubElement(kanal, "item")
        ET.SubElement(item, "title").text = tit
        if lenke:
            ET.SubElement(item, "link").text = lenke
        g = ET.SubElement(item, "guid", isPermaLink="false")
        g.text = guid
        ET.SubElement(item, "pubDate").text = pub
        ET.SubElement(item, "description").text = beskr
    ET.indent(rss)
    return '<?xml version="1.0" encoding="UTF-8"?>\n' + ET.tostring(
        rss, encoding="unicode"
    ) + "\n"


def katalog_som_rss(katalog):
    """Katalogfeeden: ett element per erklæring, aktiv som fjernet.

    Fjernede er med slik at Power Automate kan sette raden inaktiv i
    SharePoint i stedet for å stå igjen med en foreldreløs rad. pubDate er
    siste reelle endring – finnes ingen, brukes siste oppdatering fra kilden.
    Feeden er ment for «List all RSS feed items»-handlingen (full
    synkronisering), ikke for RSS-triggeren – se ABONNEMENT.md.
    """
    elementer = []
    for d in katalog["declarations"]:
        pub_dt = parse_ts(d["lastMeaningfulChangeAt"])
        if pub_dt is None:
            dato = parse_dato(d["sourceUpdatedAt"]) or parse_dato(d["removedAt"])
            pub_dt = datetime.datetime(
                dato.year if dato else 2000,
                dato.month if dato else 1,
                dato.day if dato else 1,
                tzinfo=datetime.timezone.utc,
            )
        elementer.append(
            (
                d["title"] or d["declarationId"],
                d["declarationUrl"],
                d["declarationId"],
                rfc822(pub_dt),
                kompakt_json(d),
            )
        )
    return bygg_rss(
        "UU-status – katalog over tilgjengelighetserklæringer",
        "Maskinlesbar katalog over Skatteetatens tilgjengelighetserklæringer. "
        "Hvert element har katalogposten som kompakt JSON i description. "
        f"Datakontrakt: {SITE_URL}data/subscriptions/declarations.json",
        elementer,
    )


HENDELSESTITLER = {
    "declaration_created": "Ny erklæring",
    "declaration_changed": "Endret erklæring",
    "declaration_removed": "Fjernet erklæring",
}


def hendelser_som_rss(hendelser):
    """Hendelsesfeeden: nyeste først, siste MAX_EVENTS hendelser."""
    elementer = []
    for h in hendelser[-MAX_EVENTS:][::-1]:
        pub = h.pop("pubDate")  # transportfelt, hører ikke hjemme i JSON-en
        elementer.append(
            (
                f"{HENDELSESTITLER[h['eventType']]}: {h['title'] or h['declarationId']}",
                h["declarationUrl"],
                h["eventId"],
                pub,
                kompakt_json(h),
            )
        )
        h["pubDate"] = pub
    return bygg_rss(
        "UU-status – endringshendelser for tilgjengelighetserklæringer",
        "Reelle endringer i Skatteetatens tilgjengelighetserklæringer. "
        "Hvert element har hendelsen som kompakt JSON i description. "
        "Rene tidsstempelendringer i kilden gir aldri en hendelse.",
        elementer,
    )


# ---------- main ----------
def main():
    detaljer = arkiv.load_json(DETAILS_FP)
    if not isinstance(detaljer, list):
        print(
            f"FEIL: {DETAILS_FP} mangler eller er ikke en liste. "
            "Kjør enrich_uu_details.py først.",
            file=sys.stderr,
        )
        sys.exit(1)

    register = arkiv.load_json(REGISTER_FP, fallback={}) or {}
    register_rader = register.get("erklaeringer") or []
    endringer = les_endringer()

    katalog = bygg_katalog(detaljer, register_rader, endringer)
    hendelser = bygg_hendelser(endringer)

    katalog_json = json.dumps(katalog, ensure_ascii=False, indent=2) + "\n"
    katalog_rss = katalog_som_rss(katalog)
    hendelses_rss = hendelser_som_rss(hendelser)

    # Valider FØR noe skrives: en ødelagt feed skal stoppe bygget, ikke
    # publiseres. json.dumps garanterer gyldig JSON; XML-en parses på nytt.
    ET.fromstring(katalog_rss)
    ET.fromstring(hendelses_rss)
    json.loads(katalog_json)

    CATALOG_FP.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_FEED_FP.parent.mkdir(parents=True, exist_ok=True)
    CATALOG_FP.write_text(katalog_json, encoding="utf-8", newline="\n")
    CATALOG_FEED_FP.write_text(katalog_rss, encoding="utf-8", newline="\n")
    EVENTS_FEED_FP.write_text(hendelses_rss, encoding="utf-8", newline="\n")

    aktive = sum(1 for d in katalog["declarations"] if d["active"])
    print(
        f"Skrev {CATALOG_FP}: {katalog['count']} erklæringer "
        f"({aktive} aktive, {katalog['count'] - aktive} fjernet)"
    )
    print(f"Skrev {CATALOG_FEED_FP}: {katalog['count']} elementer")
    print(
        f"Skrev {EVENTS_FEED_FP}: {min(len(hendelser), MAX_EVENTS)} av "
        f"{len(hendelser)} hendelser (grense: {MAX_EVENTS})"
    )


if __name__ == "__main__":
    main()
