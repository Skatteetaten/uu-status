#!/usr/bin/env python3
import json
import time
from pathlib import Path
import requests

DATASET_URL = "https://data.uutilsynet.no/dataset/alle-erklaeringer"
OUTPUT_PATH = Path("docs/data/uustatus/benchmark-source.json")
PAGE_SIZE = 50

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


def extract_rows(payload):
    embedded = payload.get("_embedded") if isinstance(payload, dict) else None
    if isinstance(embedded, dict):
        rows = embedded.get("dataElements")
        if isinstance(rows, list):
            return rows
    return []


def trim_row(row):
    return {k: row.get(k) for k in KEEP_FIELDS if k in row}


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


def fetch_all_rows():
    rows = []
    session = requests.Session()
    session.headers.update(
        {
            "User-Agent": "Mozilla/5.0 (compatible; UU-status-benchmark/1.0)",
        }
    )

    first = fetch_page(session, 1, PAGE_SIZE)
    first_rows = extract_rows(first)
    rows.extend(trim_row(r) for r in first_rows if isinstance(r, dict))

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
        rows.extend(trim_row(r) for r in page_rows if isinstance(r, dict))

    return rows


def main():
    rows = fetch_all_rows()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "source": DATASET_URL,
        "count": len(rows),
        "records": rows,
    }
    OUTPUT_PATH.write_text(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        encoding="utf-8",
    )
    print(f"Wrote {len(rows)} records to {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
