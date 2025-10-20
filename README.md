🟩 UU-status

UU-status er en intern løsning i Skatteetaten for å samle, berike og presentere tilgjengelighetserklæringer (universell utforming, UU) for digitale løsninger.
Formålet er å få en strukturert oversikt over hvilke tjenester som har publisert tilgjengelighetserklæringer, og hvilken status de har i henhold til WCAG-kravene.

📦 Innhold

Løsningen består av:

Python-skript som henter og behandler data fra tilgjengelighetserklæringer.

Automatisert GitHub Actions-jobb som kjører daglig for å oppdatere data.

Genererte filer (CSV, JSON) som publiseres i docs/ og vises via GitHub Pages.

⚙️ Hvordan det fungerer

GitHub Actions (.github/workflows/build.yml) kjører automatisk hver natt.

Skriptene:

scrape_uustatus.py: henter og oppdaterer alle erklæringer.

enrich_uu_details.py: legger til WCAG-koder og annen metainformasjon.

build_uu_archive.py: oppdaterer arkiv og historikk.

Resultatene lagres i docs/:

docs/uu-status.csv – full oversikt i tabellform.

docs/uu-status-details.json – detaljert informasjon per erklæring.

docs/data/uustatus/... – historiske snapshots og logger.

🧰 Teknologi

Python 3.11

GitHub Actions for automatisering

BeautifulSoup4, requests m.fl. (se requirements.txt)
