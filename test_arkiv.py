#!/usr/bin/env python3
"""Regresjonstester for endringsarkivet.

Hver test her svarer til en feil som faktisk har stått i produksjon og skrevet
gale rader i changes.jsonl. Ingen av dem kastet unntak eller gjorde workflowen
rød – de skrev bare feil data i en logg ingen leser daglig. Derfor kjøres denne
fila i nattjobben FØR build_uu_archive.py: bryter noen en av reglene, stopper
kjøringen før den rekker å skrive.

Testdataene er syntetiske med vilje. En test som leser dagens datasett kan
feile fordi uutilsynet har endret noe, og da sier den ingenting om koden vår.

Kjør lokalt:  python test_arkiv.py
"""
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

import build_uu_archive as a  # noqa: E402

feil: list[str] = []


def sjekk(navn: str, faktisk, forventet) -> None:
    if faktisk == forventet:
        print(f"  OK    {navn}")
    else:
        print(f"  FEIL  {navn}")
        print(f"          fikk:      {faktisk!r}")
        print(f"          forventet: {forventet!r}")
        feil.append(navn)


def erklaering(uuid: str, navn: str, brudd: list[str],
               oppdatert: str = "2026-05-01", spraak: str = "nb") -> dict:
    """Én normalisert rad, samme form som normalize_entry gir."""
    return {
        "url": f"https://uustatus.no/{spraak}/erklaringer/publisert/{uuid}",
        "name": navn,
        "domain": "uustatus.no",
        "title": navn,
        "updatedAt": oppdatert,
        "nonConformities": sorted(brudd),
        "totalNonConformities": len(brudd),
    }


A = "aaaaaaaa-1111-2222-3333-444444444444"
B = "bbbbbbbb-1111-2222-3333-444444444444"


def kopi(rader: list[dict]) -> list[dict]:
    return json.loads(json.dumps(rader))


# ---------------------------------------------------------------- diffmotoren
print("\nDiffmotoren")

grunnlag = [
    erklaering(A, "Skattemelding", ["1.3.1", "2.4.3"]),
    erklaering(B, "Min side", []),
]

# Grunntesten. Går den ikke, er alt annet meningsløst.
sjekk("rolig dag gir ingen endringer", len(a.diff_once(grunnlag, grunnlag)), 0)

# Returnerte tom liste ved enhver feil. En tom baseline får hele datasettet til
# å se nytt ut, så ett mislykket git-oppslag ga én «Ny erklæring» per løsning.
# Skjedde 2026-01-10 (74 rader) og 2026-04-19.
sjekk(
    "uleselig git-ref gir None, ikke tom liste",
    a.read_prev_from_ref("ref-som-ikke-finnes-xyz"),
    None,
)

rettet = kopi(grunnlag)
rettet[0]["nonConformities"] = ["2.4.3"]
rettet[0]["totalNonConformities"] = 1
endringer = a.diff_once(grunnlag, rettet)
sjekk("ett rettet brudd gir én rad", len(endringer), 1)
sjekk("riktig kode registrert som rettet", endringer[0]["removed"], ["1.3.1"])
# Navnet må følge med. Uten det sto arkivet igjen med en URL til en side som
# ikke finnes når erklæringen senere ble slettet hos uutilsynet.
sjekk("endringsraden bærer navnet", endringer[0]["name"], "Skattemelding")

# title er avledet visningstekst, ikke tilgjengelighetsdata.
tittel = kopi(grunnlag)
tittel[0]["title"] = "Helt ny tittel"
sjekk("kun tittelendring logges ikke", len(a.diff_once(grunnlag, tittel)), 0)

# En erklæring som «oppdateres» uten at noe endrer seg skal ikke gi en rad.
dato = kopi(grunnlag)
dato[0]["updatedAt"] = "2026-08-17"
sjekk("kun updatedAt logges ikke", len(a.diff_once(grunnlag, dato)), 0)

# Nynorsk og bokmål er to visninger av samme erklæring. Med hele URL-en som
# nøkkel ble språkbyttet lest som fjerning + nyregistrering – det skjedde
# 2026-03-05 og ga fire falske «Ny erklæring»-rader.
nynorsk = [erklaering(A, "Skattemelding", ["1.3.1", "2.4.3"], spraak="nn")]
sjekk(
    "/nn/ og /nb/ er samme erklæring",
    a.make_key(nynorsk[0]),
    a.make_key(grunnlag[0]),
)
sjekk("språkbytte gir ingen endring", len(a.diff_once([grunnlag[0]], nynorsk)), 0)

# Fjerning skal bevare navnet og bruddene erklæringen hadde.
fjernet = a.diff_once(grunnlag, [grunnlag[1]])
sjekk("fjernet erklæring gir én rad", len(fjernet), 1)
sjekk("fjernet erklæring bærer navnet", fjernet[0]["name"], "Skattemelding")
sjekk("fjernet erklæring bevarer bruddene", fjernet[0]["removed"], ["1.3.1", "2.4.3"])


# ------------------------------------------------------------ dedupliseringen
print("\nDedupliseringen")

rad = {
    "detectedDate": "2026-01-01",
    "url": "https://uustatus.no/nb/erklaringer/publisert/" + A,
    "added": ["1.1.1"],
    "removed": [],
    "changed": {"totalNonConformities": {"after": 1}},
}

# Uten dato i nøkkelen forsvant ekte gjentakelser: rettes 1.3.1, gjeninnføres
# den, og rettes igjen, fikk andre retting identisk nøkkel som den første.
sjekk(
    "samme endring på ulik dato er to hendelser",
    a.dedup_key(rad) != a.dedup_key(dict(rad, detectedDate="2026-06-01")),
    True,
)
sjekk(
    "samme endring samme dag dedupliseres",
    a.dedup_key(rad) == a.dedup_key(dict(rad)),
    True,
)
sjekk(
    "språkvariant gir ikke dobbeltlogging",
    a.dedup_key(rad)
    == a.dedup_key(
        dict(rad, url=f"https://uustatus.no/nn/erklaringer/publisert/{A}")
    ),
    True,
)


# ------------------------------------------------------------------ registeret
print("\nErklæringsregisteret")

reg = a.update_register(
    {},
    [erklaering(A, "Skattemelding", ["1.3.1", "2.4.3"]), erklaering(B, "Min side", [])],
    "2026-01-01",
)
sjekk("to erklæringer registrert", len(reg), 2)
sjekk("status aktiv", reg[A]["status"], "aktiv")
sjekk("firstSeen satt", reg[A]["firstSeen"], "2026-01-01")

reg = a.update_register(reg, [erklaering(A, "Skattemelding", ["1.3.1", "2.4.3"])], "2026-02-01")
sjekk("borte fra datasettet gir status fjernet", reg[B]["status"], "fjernet")
sjekk("fjerningsdato registrert", reg[B]["removedDates"], ["2026-02-01"])
# Hele poenget med registeret: navnet og bruddene skal kunne leses etterpå.
sjekk("navnet bevart etter fjerning", reg[B]["name"], "Min side")
sjekk("lastSeen fryses ved fjerning", reg[B]["lastSeen"], "2026-01-01")
sjekk("aktiv erklæring rykker fram", reg[A]["lastSeen"], "2026-02-01")

reg = a.update_register(reg, [erklaering(A, "Skattemelding", ["1.3.1", "2.4.3"])], "2026-02-02")
sjekk("fortsatt borte gir ikke ny dato", reg[B]["removedDates"], ["2026-02-01"])

reg = a.update_register(reg, [], "2026-03-01")
sjekk("bruddene fryses ved fjerning", reg[A]["lastKnown"]["nonConformities"], ["1.3.1", "2.4.3"])

# Statens innkrevingssentral forsvant 2026-02-19, kom tilbake, og forsvant
# igjen 2026-08-17. Begge datoene må stå.
reg = a.update_register(reg, [erklaering(A, "Skattemelding", ["1.3.1"])], "2026-04-01")
sjekk("gjenkomst gir status aktiv", reg[A]["status"], "aktiv")
sjekk("fjerningshistorikk bevart", reg[A]["removedDates"], ["2026-03-01"])
reg = a.update_register(reg, [], "2026-05-01")
sjekk("to fjerninger registrert", reg[A]["removedDates"], ["2026-03-01", "2026-05-01"])

# Et tomt navn i kilden skal aldri slette navnet vi allerede har – det ville
# rammet nøyaktig den erklæringen som er i ferd med å forsvinne.
reg2 = a.update_register({}, [erklaering(A, "Skattemelding", [])], "2026-01-01")
reg2 = a.update_register(reg2, [erklaering(A, "", [])], "2026-01-02")
sjekk("tomt navn overskriver ikke", reg2[A]["name"], "Skattemelding")

# Språkvariant skal ikke gi en ny rad i registeret heller.
reg3 = a.update_register({}, [erklaering(A, "Skattemelding", ["1.3.1"])], "2026-01-01")
reg3 = a.update_register(reg3, [erklaering(A, "Skattemelding", ["1.3.1"], spraak="nn")], "2026-01-02")
sjekk("språkbytte gir ikke ny registerrad", len(reg3), 1)
sjekk("språkbytte gir ingen fjerning", reg3[A]["removedDates"], [])


# ----------------------------------------------------------------------- svar
print()
if feil:
    print(f"{len(feil)} test(er) feilet: {', '.join(feil)}")
    sys.exit(1)
print("Alle tester passerte.")
