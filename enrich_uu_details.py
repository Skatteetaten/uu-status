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

WCAG_CODE_RE = re.compile(r"\b(?:[0-3]\.\d{1,2}\.\d{1,2}[a-z]?)\b", re.I)
DATE_NO_RE = re.compile(r"(?:Sist\s+(?:endret|oppdatert)[^0-9]{0,20})(\d{1,2}\.\d{1,2}\.\d{4})", re.I)
DATE_ISO_RE = re.compile(r"\b\d{4}-\d{2}-\d{2}\b")

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
        return None, None, None
    if resp.status_code != 200:
        return None, None, None

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
                    return uniq_sorted(codes), upd, soup.title.string.strip() if soup.title else None
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

    title = soup.title.string.strip() if soup.title else None
    return codes or None, upd, title

def main():
    if not DETAILS_FP.exists():
        print("Fant ikke docs/uu-status-details.json", file=sys.stderr)
        sys.exit(1)

    obj = json.loads(DETAILS_FP.read_text(encoding="utf-8"))
    rows = obj.get("urls") if isinstance(obj, dict) else obj

    updated = 0
    for i, r in enumerate(rows):
        url = (r.get("url") or r.get("href") or "").strip()
        if not url:
            continue
        codes, upd, title = scrape_one(url)
        if codes is not None:
            r["nonConformities"] = codes
            r["totalNonConformities"] = len(codes)
            updated += 1
        if upd and not r.get("updatedAt"):
            r["updatedAt"] = upd
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
