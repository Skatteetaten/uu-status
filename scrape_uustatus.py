#!/usr/bin/env python3
import csv, re, time, json
from datetime import datetime, timezone
from pathlib import Path
import requests
from bs4 import BeautifulSoup

# Input og output
INPUT_CSV = Path("uustatus-urls.csv")  # kildelista
OUTPUT_CSV = Path("uu-status.csv")     # resultat-tabell
DETAILS_JSON = Path("uu-status-details.json")  # nye detaljer per erklæring

HEADERS = {"User-Agent": "toolsified-uustatus-scraper (+https://github.com/Almasy74/toolsified)"}

# Regex-mønstre
BRUDD_RE = re.compile(r"Det er brudd på\s+(\d+)\s+av\s+(\d+)\s+krav", re.IGNORECASE)
SIST_OPPDATERT_RE = re.compile(r"sist oppdatert\s+(\d{1,2}\.\s*\w+\s*\d{4})", re.IGNORECASE)
OPPRETTET_RE = re.compile(r"opprettet (?:første\s*gang|første gang)\s+(\d{1,2}\.\s*\w+\s*\d{4})", re.IGNORECASE)

# Tre-nivå WCAG-koder (fanger f.eks. 1.4.3, 4.1.2)
WCAG_CODE_RE = re.compile(r"\b[1-4]\.\d{1,2}\.\d{1,2}\b")

MONTHS = {
    "januar":"January","februar":"February","mars":"March","april":"April",
    "mai":"May","juni":"June","juli":"July","august":"August",
    "september":"September","oktober":"October","november":"November","desember":"December"
}

def parse_no_date_to_iso(s):
    if not s:
        return ""
    raw = s.strip()
    for no, en in MONTHS.items():
        raw = re.sub(no, en, raw, flags=re.IGNORECASE)
    try:
        from datetime import datetime
        dt = datetime.strptime(raw.replace("  ", " "), "%d. %B %Y")
        return dt.date().isoformat()
    except Exception:
        return ""

def scrape_one(name, url):
    try:
        r = requests.get(url, headers=HEADERS, timeout=30)
        status = r.status_code
        html = r.text
    except Exception as e:
        now = datetime.now(timezone.utc).isoformat()
        return (
            {
                "Navn": name, "Url": url, "Brudd": "", "KravTotalt": "", "SistOppdatert": "",
                "Opprettet": "", "Statuskode": "", "Feil": str(e), "SistSjekket": now, "WCAGCodes": ""
            },
            {"url": url, "name": name, "codes": [], "last_checked": now, "error": str(e)}
        )

    soup = BeautifulSoup(html, "lxml")
    text = soup.get_text(" ", strip=True)

    # brudd / krav
    m_brudd = BRUDD_RE.search(text)
    brudd = m_brudd.group(1) if m_brudd else ""
    krav = m_brudd.group(2) if m_brudd else ""

    # datoer
    m_upd = SIST_OPPDATERT_RE.search(text)
    m_created = OPPRETTET_RE.search(text)
    updated_iso = parse_no_date_to_iso(m_upd.group(1)) if m_upd else ""
    created_iso = parse_no_date_to_iso(m_created.group(1)) if m_created else ""

    # forsøk 1: finn WCAG-koder via lenker/href
    codes = set()
    for a in soup.find_all("a", href=True):
        href = a["href"]
        # typisk /wcag/4.1.2 eller lignende
        m = re.search(r"/wcag/([1-4]\.\d{1,2}\.\d{1,2})(?:\D|$)", href)
        if m:
            codes.add(m.group(1))

    # fallback: regex i ren tekst
    if not codes:
        for m in WCAG_CODE_RE.finditer(text):
            codes.add(m.group(0))

    codes = sorted(codes)  # stabil rekkefølge
    now = datetime.now(timezone.utc).isoformat()

    row = {
        "Navn": name,
        "Url": url,
        "Brudd": brudd,
        "KravTotalt": krav,
        "SistOppdatert": updated_iso,
        "Opprettet": created_iso,
        "Statuskode": status,
        "Feil": "",
        "SistSjekket": now,
        "WCAGCodes": "|".join(codes)  # lett å bruke i CSV
    }

    detail = {
        "url": url,
        "name": name,
        "codes": codes,              # array for enklere frontend-bruk
        "last_checked": now
    }

    return row, detail

def read_sources(path: Path):
    with path.open("r", encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=';')
        for row in reader:
            name = (row.get("Navn") or "").strip()
            url = (row.get("Url") or "").strip()
            if name and url:
                yield name, url

def main():
    if not INPUT_CSV.exists():
        raise SystemExit(f"Mangler {INPUT_CSV}. Opprett en semikolon-CSV med header 'Navn;Url'.")

    rows, details = [], []
    for name, url in read_sources(INPUT_CSV):
        row, detail = scrape_one(name, url)
        rows.append(row)
        details.append(detail)
        time.sleep(0.8)

    fieldnames = ["Navn","Url","Brudd","KravTotalt","SistOppdatert","Opprettet","Statuskode","Feil","SistSjekket","WCAGCodes"]
    with OUTPUT_CSV.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, delimiter=';')
        writer.writeheader()
        writer.writerows(rows)

    with DETAILS_JSON.open("w", encoding="utf-8") as jf:
        json.dump(details, jf, ensure_ascii=False, indent=2)

if __name__ == "__main__":
    main()

