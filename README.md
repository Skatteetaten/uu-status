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

enrich_uu_details.py: henter alle Skatteetatens erklæringer fra uutilsynet.no API og legger til WCAG-koder og metainformasjon.

build_benchmark_source.py: speil av alle erklæringer fra API til lokal JSON for benchmark-siden.

build_uu_archive.py: oppdaterer arkiv og historikk.

📋 Endringsarkiv

Arkivet (docs/uu-arkiv.html) viser alle endringer som er gjort i tilgjengelighetserklæringene. Systemet:

- Detekterer automatisk nye endringer ved å sammenligne med forrige baseline
- Registrerer kun faktiske endringer (ignorerer kun updatedAt-endringer uten andre endringer)
- Unngår duplikater ved å sjekke om samme endring allerede er logget
- Beholder alle eksisterende endringer når det ikke er nye endringer
- Oppretter snapshots per updatedDate for hver endring

Endringene logges i docs/data/uustatus/logs/changes.jsonl og vises i arkivtabellen.

Resultatene lagres i docs/:

docs/uu-status-details.json – detaljert informasjon per erklæring (WCAG-koder, opprettet-dato m.m.).

docs/data/uustatus/... – historiske snapshots og logger.

🧪 Testing

For å teste build_uu_archive.py lokalt uten å være avhengig av git eller dato:

```bash
# Sett TEST_MODE miljøvariabel
export TEST_MODE=1  # Linux/Mac
set TEST_MODE=1     # Windows PowerShell
$env:TEST_MODE=1    # Windows CMD

# Kjør skriptet
python build_uu_archive.py
```

I testmodus bruker systemet lokal `docs/data/uustatus/latest.json` som baseline i stedet for git HEAD. Dette gjør det mulig å teste endringer raskt uten å vente på neste dag eller committe til git.

Miljøvariabler:

- `TEST_MODE=1` – Bruk lokal fil som baseline (for testing)
- `BASELINE_REF=<git-ref>` – Bruk spesifikk git-referanse som baseline
- `AUTO_BACKTRACK=1` – Prøv flere git-commits hvis baseline mangler
- `MAX_BACKTRACK=<tall>` – Maks antall commits å prøve (standard: 10)

🧰 Teknologi

Python 3.11

GitHub Actions for automatisering

BeautifulSoup4, requests m.fl. (se requirements.txt)
