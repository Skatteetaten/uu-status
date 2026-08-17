#!/usr/bin/env python3
"""Bygg docs/uu-status-details.json fra uutilsynets datasett.

Tidligere skrapte dette skriptet hver enkelt erklaeringsside pa uustatus.no for
a finne WCAG-koder. Det er ikke lenger noedvendig: datasettet inneholder et
`resultat`-array med status per krav for hver erklaering. Skrapingen er derfor
fjernet i sin helhet.

Kilden er docs/data/uustatus/skatteetaten-source.json, som skrives av
build_benchmark_source.py. Kjor det skriptet forst.

Feltnavnene i utdata er en kontrakt: UU-portalen henter fila direkte fra
GitHub Pages og leser nonConformities, codes, totalNonConformities, updatedAt
og opprettet. Ikke endre dem uten a oppdatere konsumentene.
"""
import json
import re
import sys
from pathlib import Path
from urllib.parse import urlparse

SOURCE_FP = Path("docs/data/uustatus/skatteetaten-source.json")
DETAILS_FP = Path("docs/uu-status-details.json")

# Et krav regnes som brudd naar virksomheten har svart "no" pa om alt innhold
# oppfyller kravet. Verifisert mot talBrot for samtlige erklaeringer -- de to
# tallene stemmer overens 118 av 118.
BRUDD_SVAR = "no"

UUID_RE = re.compile(
    r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", re.I
)


def to_domain(url: str) -> str:
    try:
        return urlparse(url).hostname or ""
    except Exception:
        return ""


def normalize_nb_url(url: str) -> str:
    """Datasettet oppgir /nn/ eller /en/; arkivet noekler pa /nb/."""
    return re.sub(r"/(?:nn|en)/erklaringer/", "/nb/erklaringer/", url)


def brudd_koder(record: dict) -> list:
    """WCAG-koder der virksomheten har svart at innholdet ikke oppfyller kravet."""
    koder = {
        (k.get("krav") or "").strip()
        for k in (record.get("resultat") or [])
        if (k.get("oppfyllerAltInnhaldKravet") or "").strip().lower() == BRUDD_SVAR
    }
    return sorted(koder - {""})


def build_entry(record: dict) -> dict:
    url = normalize_nb_url((record.get("erklaeringsAdresse") or "").strip())
    name = (record.get("iktLoeysingNamn") or "").strip()
    koder = brudd_koder(record)
    updated = (record.get("sisteOppdatering") or "").strip()[:10]

    return {
        "url": url,
        "name": name,
        "codes": koder,
        "nonConformities": koder,
        "totalNonConformities": len(koder),
        "updatedAt": updated,
        "opprettet": (record.get("foersteProduserteErklaering") or "").strip()[:10],
        # Samme form som den skrapte <title> hadde, sa arkivet ikke tolker
        # omleggingen som en endring pa hver eneste erklaering.
        "title": f"Tilgjengelighetserklæring for {name} | uustatus" if name else "",
        "domain": to_domain(url),
        "samsvarsstatus": (record.get("samsvarsstatus") or "").strip(),
    }


def sanity_check(records, entries):
    """Utledede koder skal stemme med talBrot fra datasettet."""
    avvik = []
    for rec, entry in zip(records, entries):
        tal_brot = rec.get("talBrot")
        if isinstance(tal_brot, int) and tal_brot != entry["totalNonConformities"]:
            avvik.append(
                f"  {entry['name'][:60]}: talBrot={tal_brot} "
                f"men utledet {entry['totalNonConformities']} koder"
            )
    return avvik


def main():
    if not SOURCE_FP.exists():
        print(
            f"Fant ikke {SOURCE_FP}. Kjor build_benchmark_source.py forst.",
            file=sys.stderr,
        )
        sys.exit(1)

    payload = json.loads(SOURCE_FP.read_text(encoding="utf-8"))
    records = payload.get("records") if isinstance(payload, dict) else payload
    if not isinstance(records, list) or not records:
        print(f"{SOURCE_FP} inneholder ingen poster.", file=sys.stderr)
        sys.exit(1)

    # Erklaeringer uten gyldig adresse kan ikke noekles i arkivet.
    entries, hoppet_over = [], 0
    for rec in records:
        if not UUID_RE.search(rec.get("erklaeringsAdresse") or ""):
            hoppet_over += 1
            continue
        entries.append(build_entry(rec))

    gyldige = [r for r in records if UUID_RE.search(r.get("erklaeringsAdresse") or "")]
    avvik = sanity_check(gyldige, entries)
    if avvik:
        print(f"ADVARSEL: {len(avvik)} erklaeringer der utledede koder "
              f"ikke stemmer med talBrot:", file=sys.stderr)
        for linje in avvik[:10]:
            print(linje, file=sys.stderr)

    entries.sort(key=lambda e: e["name"].lower())
    DETAILS_FP.parent.mkdir(parents=True, exist_ok=True)
    DETAILS_FP.write_text(
        json.dumps(entries, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    med_brudd = sum(1 for e in entries if e["totalNonConformities"])
    print(
        f"Skrev {len(entries)} erklaeringer til {DETAILS_FP} "
        f"({med_brudd} med brudd, {len(entries) - med_brudd} uten)."
    )
    if hoppet_over:
        print(f"Hoppet over {hoppet_over} poster uten gyldig erklaeringsadresse.")


if __name__ == "__main__":
    main()
