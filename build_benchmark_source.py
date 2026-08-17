#!/usr/bin/env python3
import json
import sys
import time
from pathlib import Path
import requests

DATASET_URL = "https://data.uutilsynet.no/dataset/alle-erklaeringer"
OUTPUT_PATH = Path("docs/data/uustatus/benchmark-source.json")
SKATTEETATEN_PATH = Path("docs/data/uustatus/skatteetaten-source.json")
SKATTEETATEN_ORG = "974761076"
# API-et returnerer `resultat` uansett sidestoerrelse, sa nyttelasten er den
# samme totalt. Stoerre sider gir faerre rundturer: 19 kall i stedet for 188.
PAGE_SIZE = 500

# Keep only fields needed for matching + KPI aggregation on the frontend.
KEEP_FIELDS = [
    "organisasjonsnummer",
    "verksemdNamn",
    "iktLoeysingNamn",
    "iktLoeysingAdresse",
    "publiseringsadresse",
    "erklaeringsAdresse",
    "sisteOppdatering",
    "erklaeringErOppdatert",
    "talBrot",
    "talSamsvar",
    "talIkkjeRelevant",
]

# For Skatteetaten beholder vi hele posten, inkludert `resultat`-arrayet med
# status per WCAG-krav. Det er kilden enrich_uu_details.py bygger på, og det
# koster ingenting ekstra: API-et sender `resultat` uansett, vi kastet det bare.
SKATTEETATEN_FIELDS = KEEP_FIELDS + [
    "erklaeringId",
    "iktLoeysingType",
    "foersteProduserteErklaering",
    "samsvarsstatus",
    "nettstadType",
    "resultat",
]


def extract_rows(payload):
    embedded = payload.get("_embedded") if isinstance(payload, dict) else None
    if isinstance(embedded, dict):
        rows = embedded.get("dataElements")
        if isinstance(rows, list):
            return rows
    return []


def trim_row(row, fields=KEEP_FIELDS):
    return {k: row.get(k) for k in fields if k in row}


def is_skatteetaten(row):
    return str(row.get("organisasjonsnummer") or "").strip() == SKATTEETATEN_ORG


def fetch_page(session, page_num, page_size):
    params = {"page": page_num, "size": page_size}
    attempts = 4
    for i in range(attempts):
        try:
            resp = session.get(DATASET_URL, params=params, timeout=90)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException:
            if i == attempts - 1:
                raise
            time.sleep(1.5 * (i + 1))


def collect_rows(page_rows, rows, skatt_rows):
    for r in page_rows:
        if not isinstance(r, dict):
            continue
        rows.append(trim_row(r))
        if is_skatteetaten(r):
            skatt_rows.append(trim_row(r, SKATTEETATEN_FIELDS))


def fetch_all_rows():
    rows = []
    skatt_rows = []
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (compatible; UU-status-benchmark/1.0)",
        }
    )

    first = fetch_page(session, 1, PAGE_SIZE)
    collect_rows(extract_rows(first), rows, skatt_rows)

    page_meta = first.get("page") if isinstance(first, dict) else {}
    total_pages = int(page_meta.get("totalPages") or 1)

    for page_num in range(2, total_pages + 1):
        try:
            payload = fetch_page(session, page_num, PAGE_SIZE)
        except requests.RequestException as err:
            print(f"Skipping page {page_num} due to error: {err}")
            continue
        page_rows = extract_rows(payload)
        if not page_rows:
            break
        collect_rows(page_rows, rows, skatt_rows)

    return rows, skatt_rows


def write_json(path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": DATASET_URL,
        "count": len(rows),
        "records": rows,
    }
    path.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {len(rows)} records to {path}")


def main():
    rows, skatt_rows = fetch_all_rows()
    write_json(OUTPUT_PATH, rows)
    write_json(SKATTEETATEN_PATH, skatt_rows)

    if not skatt_rows:
        print(
            f"ERROR: fant ingen erklaeringer for org {SKATTEETATEN_ORG}. "
            "enrich_uu_details.py har ingen kilde a bygge pa.",
            file=sys.stderr,
        )
        sys.exit(1)


if __name__ == "__main__":
    main()
