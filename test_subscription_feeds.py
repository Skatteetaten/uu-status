#!/usr/bin/env python3
"""Regresjonstester for abonnementskatalogen og RSS-feedene.

Samme mønster som test_arkiv.py: syntetiske data, kjøres i nattjobben FØR
build_subscription_feeds.py. Feiler noe her, stoppes kjøringen før en ødelagt
katalog eller feed rekker å bli publisert.

Kjør lokalt:  python test_subscription_feeds.py
"""
import email.utils
import json
import sys
import xml.etree.ElementTree as ET
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_subscription_feeds as feeds  # noqa: E402
import build_uu_archive as arkiv  # noqa: E402

feil: list[str] = []


def sjekk(navn: str, faktisk, forventet) -> None:
    if faktisk == forventet:
        print(f"  OK    {navn}")
    else:
        print(f"  FEIL  {navn}")
        print(f"          fikk:      {faktisk!r}")
        print(f"          forventet: {forventet!r}")
        feil.append(navn)


A = "aaaaaaaa-1111-2222-3333-444444444444"
B = "bbbbbbbb-1111-2222-3333-444444444444"


def detalj(uuid: str, navn: str, brudd: list[str], oppdatert: str = "2026-05-01",
           opprettet: str = "2024-01-15", spraak: str = "nb") -> dict:
    """Én rad slik enrich_uu_details.py skriver den."""
    return {
        "url": f"https://uustatus.no/{spraak}/erklaringer/publisert/{uuid}",
        "name": navn,
        "codes": sorted(brudd),
        "nonConformities": sorted(brudd),
        "totalNonConformities": len(brudd),
        "updatedAt": oppdatert,
        "opprettet": opprettet,
        "title": f"Tilgjengelighetserklæring for {navn} | uustatus",
        "domain": "uustatus.no",
        "samsvarsstatus": "Delvis i samsvar",
    }


def loggrad(uuid: str, ts: str, navn: str = "Skattemelding", added=None,
            removed=None, changed=None, updated_date: str = "2026-05-01") -> dict:
    """Én rad slik build_uu_archive.py skriver den til changes.jsonl."""
    return {
        "ts": ts,
        "detectedDate": ts[:10],
        "url": f"https://uustatus.no/nb/erklaringer/publisert/{uuid}",
        "name": navn,
        "domain": "uustatus.no",
        "before_hash": "x",
        "after_hash": "y",
        "added": added or [],
        "removed": removed or [],
        "changed": changed or {},
        "updatedDate": updated_date,
    }


def registerrad(uuid: str, navn: str, status: str, brudd: list[str],
                oppdatert: str = "2026-01-01", fjernet=None) -> dict:
    return {
        "url": f"https://uustatus.no/nb/erklaringer/publisert/{uuid}",
        "name": navn,
        "domain": "uustatus.no",
        "firstSeen": "2024-01-01",
        "lastSeen": oppdatert,
        "status": status,
        "removedDates": fjernet or [],
        "lastKnown": {
            "updatedAt": oppdatert,
            "totalNonConformities": len(brudd),
            "nonConformities": sorted(brudd),
        },
    }


# ------------------------------------------------------------------- fristen
print("\nFristen")

sjekk("frist er updatedAt + ett år", feeds.frist("2026-05-01"), "2027-05-01")
sjekk("frist faller tilbake på opprettet", feeds.frist("", "2024-01-15"), "2025-01-15")
sjekk("manglende frist blir None, ikke oppdiktet", feeds.frist("", ""), None)
sjekk("ugyldig dato blir None", feeds.frist("ikke-en-dato"), None)
# JavaScripts setFullYear(29. feb + 1) gir 1. mars – Python må svare det samme.
sjekk("29. februar + ett år gir 1. mars", feeds.frist("2024-02-29"), "2025-03-01")


# ----------------------------------------------------------------- katalogen
print("\nKatalogen")

detaljer = [detalj(A, "Skattemelding", ["1.3.1", "2.4.3"])]
register = [
    registerrad(A, "Skattemelding", "aktiv", ["1.3.1", "2.4.3"]),
    registerrad(B, "Gammel løsning", "fjernet", ["1.1.1"],
                oppdatert="2025-03-01", fjernet=["2025-06-01"]),
]
logg = [loggrad(A, "2026-05-01T02:00:00Z", added=["1.3.1"],
                changed={"totalNonConformities": {"before": 1, "after": 2}})]

katalog = feeds.bygg_katalog(detaljer, register, logg)
poster = {d["declarationId"]: d for d in katalog["declarations"]}

sjekk("schemaVersion satt", katalog["schemaVersion"], feeds.SCHEMA_VERSION)
sjekk("aktiv + fjernet gir to poster", katalog["count"], 2)
sjekk("declarationId er UUID-en, ikke tittelen", sorted(poster), sorted([A, B]))
sjekk("aktiv post er aktiv", poster[A]["active"], True)
sjekk("status fra samsvarsstatus", poster[A]["status"], "Delvis i samsvar")
sjekk("frist beregnet for aktiv", poster[A]["deadline"], "2027-05-01")
sjekk("sourceUpdatedAt er ISO-dato", poster[A]["sourceUpdatedAt"], "2026-05-01")
sjekk("siste reelle endring følger med",
      poster[A]["lastMeaningfulChangeAt"], "2026-05-01T02:00:00Z")

# Fjernede erklæringer beholdes som inaktive – de slettes ikke.
sjekk("fjernet erklæring beholdes", poster[B]["active"], False)
sjekk("fjernet erklæring beholder navnet", poster[B]["title"], "Gammel løsning")
sjekk("fjernet erklæring beholder bruddene", poster[B]["nonConformities"], ["1.1.1"])
sjekk("fjernet erklæring har ingen frist", poster[B]["deadline"], None)
sjekk("fjerningsdato følger med", poster[B]["removedAt"], "2025-06-01")
sjekk("status er null når registeret ikke vet", poster[B]["status"], None)

# Manglende frist: verken updatedAt eller opprettet.
uten_dato = detalj(A, "Skattemelding", [], oppdatert="", opprettet="")
k2 = feeds.bygg_katalog([uten_dato], [], [])
sjekk("manglende frist er null", k2["declarations"][0]["deadline"], None)
sjekk("manglende sourceUpdatedAt er null",
      k2["declarations"][0]["sourceUpdatedAt"], None)

# Tomt datasett skal gi en gyldig, tom katalog – ikke krasj.
tom = feeds.bygg_katalog([], [], [])
sjekk("tomt datasett gir tom katalog", tom["declarations"], [])
sjekk("tom katalog teller null", tom["count"], 0)

# Nynorskadresse skal gi samme ID som bokmålsadresse.
nn = feeds.bygg_katalog([detalj(A, "Skattemelding", [], spraak="nn")], [], [])
sjekk("/nn/ og /nb/ gir samme declarationId",
      nn["declarations"][0]["declarationId"], A)

# Deterministisk: samme input i annen rekkefølge gir identisk serialisering.
k_a = feeds.bygg_katalog([detalj(A, "A", []), detalj(B, "B", [])], [], [])
k_b = feeds.bygg_katalog([detalj(B, "B", []), detalj(A, "A", [])], [], [])
sjekk("rekkefølgen på input påvirker ikke output",
      json.dumps(k_a, sort_keys=False), json.dumps(k_b, sort_keys=False))


# ---------------------------------------------------------------- hendelsene
print("\nHendelsene")

ny = loggrad(A, "2026-05-01T02:00:00Z", added=["1.3.1"], changed={
    "newEntry": True, "totalNonConformities": {"before": 0, "after": 1}})
endret = loggrad(A, "2026-05-02T02:00:00Z", added=["4.1.2"], changed={
    "totalNonConformities": {"before": 1, "after": 2},
    "updatedAt": {"before": "2026-05-01", "after": "2026-05-02"}},
    updated_date="2026-05-02")
fjernet = loggrad(A, "2026-05-03T02:00:00Z", removed=["1.3.1", "4.1.2"], changed={
    "removedEntry": True, "totalNonConformities": {"before": 2, "after": 0}})

hendelser = feeds.bygg_hendelser([ny, endret, fjernet])
sjekk("tre rader gir tre hendelser", len(hendelser), 3)
sjekk("ny erklæring blir declaration_created",
      hendelser[0]["eventType"], "declaration_created")
sjekk("reell endring blir declaration_changed",
      hendelser[1]["eventType"], "declaration_changed")
sjekk("fjernet erklæring blir declaration_removed",
      hendelser[2]["eventType"], "declaration_removed")
sjekk("declarationId er UUID-en", hendelser[0]["declarationId"], A)
sjekk("endret frist står i changedFields",
      "deadline" in hendelser[1]["changedFields"], True)
sjekk("ny frist beregnet av ny updatedAt",
      hendelser[1]["currentValues"]["deadline"], "2027-05-02")
sjekk("gammel frist bevart i previousValues",
      hendelser[1]["previousValues"]["deadline"], "2027-05-01")
sjekk("fjerning har ingen frist", hendelser[2]["deadline"], None)
sjekk("fjerning bærer bruddene som forsvant",
      hendelser[2]["removedNonConformities"], ["1.3.1", "4.1.2"])
sjekk("detectedAt er radens ts", hendelser[0]["detectedAt"], "2026-05-01T02:00:00Z")

# Stabile og unike event-ID-er: samme input gir samme ID-er, alle unike,
# og en ny bygging endrer ikke ID-ene til gamle hendelser.
h2 = feeds.bygg_hendelser([ny, endret, fjernet])
sjekk("samme input gir samme event-ID-er",
      [h["eventId"] for h in hendelser], [h["eventId"] for h in h2])
sjekk("alle event-ID-er er unike",
      len({h["eventId"] for h in hendelser}), 3)
sjekk("ny rad endrer ikke gamle hendelser",
      feeds.bygg_hendelser([ny, endret])[0]["eventId"], hendelser[0]["eventId"])

# Flere hendelser med samme deteksjonstid: stabil rekkefølge, unike og
# strengt stigende pubDate – ellers hopper Power Automates RSS-trigger over.
samtidig_a = loggrad(A, "2026-06-01T02:00:00Z", added=["1.1.1"], changed={
    "totalNonConformities": {"before": 0, "after": 1}})
samtidig_b = loggrad(B, "2026-06-01T02:00:00Z", navn="Min side", added=["1.4.3"],
                     changed={"totalNonConformities": {"before": 0, "after": 1}})
like = feeds.bygg_hendelser([samtidig_b, samtidig_a])
pub = [email.utils.parsedate_to_datetime(h["pubDate"]) for h in like]
sjekk("samtidige hendelser får stabil rekkefølge",
      [h["declarationId"] for h in like], [A, B])
sjekk("samtidige hendelser får unike pubDate", pub[0] != pub[1], True)
sjekk("pubDate er strengt stigende", pub[0] < pub[1], True)
sjekk("rekkefølgen på input påvirker ikke hendelsene",
      feeds.bygg_hendelser([samtidig_a, samtidig_b]), like)

# Bare teknisk tidsstempelendring: diffmotoren logger ingen rad, og uten rad
# finnes det ingen hendelse. Dette er hele kjeden, ikke en antakelse.
foer = [{"url": f"https://uustatus.no/nb/erklaringer/publisert/{A}",
         "name": "Skattemelding", "domain": "uustatus.no", "title": "x",
         "updatedAt": "2026-05-01", "nonConformities": ["1.3.1"],
         "totalNonConformities": 1}]
naa = json.loads(json.dumps(foer))
naa[0]["updatedAt"] = "2026-08-01"
sjekk("teknisk tidsstempelendring gir ingen hendelse",
      feeds.bygg_hendelser(arkiv.diff_once(foer, naa)), [])

# Endret status (samsvarsstatus) spores ikke av diffmotoren, så den gir
# heller ingen hendelse. Dokumentert begrensning – testen fryser atferden.
naa2 = json.loads(json.dumps(foer))
naa2[0]["samsvarsstatus"] = "Ikkje i samsvar"
sjekk("statusendring alene gir ingen hendelse (kjent begrensning)",
      feeds.bygg_hendelser(arkiv.diff_once(foer, naa2)), [])

# Tom logg gir tom hendelsesliste.
sjekk("tom logg gir ingen hendelser", feeds.bygg_hendelser([]), [])


# ------------------------------------------------------------------- RSS/XML
print("\nRSS og XML")

STYGT_NAVN = 'Løsning & <partner> "æøå" > resten'
stygg_katalog = feeds.bygg_katalog(
    [detalj(A, STYGT_NAVN, ["1.1.1"])], [], [])
katalog_xml = feeds.katalog_som_rss(stygg_katalog)
tre = ET.fromstring(katalog_xml)  # kaster ved ugyldig XML
sjekk("katalogfeeden er gyldig XML", tre.tag, "rss")
sjekk("RSS-versjonen er 2.0", tre.get("version"), "2.0")

item = tre.find("channel/item")
sjekk("norske tegn og &, <, > overlever escaping",
      item.find("title").text, STYGT_NAVN)
sjekk("escapingen står i råteksten", "&amp;" in katalog_xml and "&lt;" in katalog_xml, True)
sjekk("guid er declarationId", item.find("guid").text, A)
sjekk("guid er ikke permalink", item.find("guid").get("isPermaLink"), "false")
sjekk("lenken peker på erklæringen",
      item.find("link").text, stygg_katalog["declarations"][0]["declarationUrl"])

beskrivelse = json.loads(item.find("description").text)
sjekk("description er gyldig kompakt JSON med posten",
      beskrivelse["declarationId"], A)
sjekk("tittelen overlever JSON-runden", beskrivelse["title"], STYGT_NAVN)

gyldig_pub = email.utils.parsedate_to_datetime(item.find("pubDate").text)
sjekk("pubDate er en gyldig RFC 822-dato", gyldig_pub is not None, True)

hendelses_xml = feeds.hendelser_som_rss(feeds.bygg_hendelser([ny, endret, fjernet]))
htre = ET.fromstring(hendelses_xml)
hitems = htre.findall("channel/item")
sjekk("hendelsesfeeden er gyldig XML", htre.tag, "rss")
sjekk("hendelsesfeeden har nyeste først",
      json.loads(hitems[0].find("description").text)["eventType"],
      "declaration_removed")
sjekk("hendelses-guid er eventId og ikke permalink",
      hitems[0].find("guid").get("isPermaLink"), "false")
hbeskr = json.loads(hitems[-1].find("description").text)
sjekk("hendelses-description er gyldig JSON",
      hbeskr["eventType"], "declaration_created")
sjekk("ingen abonnentdata i feeden",
      any(s in hendelses_xml.lower() for s in ["@skatteetaten", "sharepoint", "token", "secret"]),
      False)

# Retensjonen: flere hendelser enn grensen kutter de eldste, og kuttet
# endrer ikke pubDate på dem som blir igjen.
mange = [loggrad(A, f"2026-01-{d:02d}T02:00:00Z", added=["1.1.1"],
                 changed={"totalNonConformities": {"before": 0, "after": 1}},
                 updated_date=f"2026-01-{d:02d}")
         for d in range(1, 29)]
alle = feeds.bygg_hendelser(mange)
gammel_grense = feeds.MAX_EVENTS
feeds.MAX_EVENTS = 10
try:
    kuttet = ET.fromstring(feeds.hendelser_som_rss(feeds.bygg_hendelser(mange)))
    kutt_items = kuttet.findall("channel/item")
    sjekk("retensjonen begrenser antall elementer", len(kutt_items), 10)
    sjekk("nyeste hendelse beholdes",
          json.loads(kutt_items[0].find("description").text)["detectedAt"],
          "2026-01-28T02:00:00Z")
    sjekk("kuttet endrer ikke pubDate på gjenværende",
          kutt_items[0].find("pubDate").text, alle[-1]["pubDate"])
finally:
    feeds.MAX_EVENTS = gammel_grense

# Deterministisk ende til ende: to kjøringer gir identiske bytes.
sjekk("to kjøringer gir identisk katalog-XML",
      feeds.katalog_som_rss(feeds.bygg_katalog(detaljer, register, logg)),
      feeds.katalog_som_rss(feeds.bygg_katalog(detaljer, register, logg)))
sjekk("to kjøringer gir identisk hendelses-XML",
      feeds.hendelser_som_rss(feeds.bygg_hendelser([ny, endret, fjernet])),
      hendelses_xml)

# Tomt datasett skal fortsatt gi gyldige feeds.
tom_katalog_xml = feeds.katalog_som_rss(feeds.bygg_katalog([], [], []))
tom_hendelser_xml = feeds.hendelser_som_rss([])
sjekk("tom katalogfeed er gyldig XML",
      ET.fromstring(tom_katalog_xml).tag, "rss")
sjekk("tom hendelsesfeed er gyldig XML",
      ET.fromstring(tom_hendelser_xml).tag, "rss")
sjekk("tom feed har ingen elementer",
      ET.fromstring(tom_hendelser_xml).findall("channel/item"), [])


# ------------------------------------------------------ katalogkontrakten
print("\nKatalogkontrakten")

PAAKREVDE_FELT = ["declarationId", "title", "declarationUrl", "status",
                  "nonConformities", "totalNonConformities", "deadline",
                  "sourceUpdatedAt", "lastMeaningfulChangeAt", "active",
                  "removedAt"]
post = katalog["declarations"][0]
sjekk("alle kontraktsfelt finnes", [f for f in PAAKREVDE_FELT if f not in post], [])
sjekk("katalogen kan serialiseres og leses tilbake",
      json.loads(json.dumps(katalog, ensure_ascii=False))["schemaVersion"],
      feeds.SCHEMA_VERSION)

HENDELSESFELT = ["schemaVersion", "eventId", "eventType", "declarationId",
                 "title", "declarationUrl", "changedFields", "previousValues",
                 "currentValues", "detectedAt", "deadline"]
sjekk("alle hendelsesfelt finnes",
      [f for f in HENDELSESFELT if f not in hendelser[0]], [])


# ----------------------------------------------------------------------- svar
print()
if feil:
    print(f"{len(feil)} test(er) feilet: {', '.join(feil)}")
    sys.exit(1)
print("Alle tester passerte.")
