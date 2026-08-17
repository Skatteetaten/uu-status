# UU-status

Oversikt over tilgjengelighetserklæringene til Skatteetatens digitale løsninger.
Publisert på [skatteetaten.github.io/uu-status](https://skatteetaten.github.io/uu-status/).

Siden viser hvilke løsninger som har publisert tilgjengelighetserklæring, hvilke
WCAG-krav som er brutt, hva som har endret seg over tid, og hvordan Skatteetaten
ligger an sammenlignet med andre offentlige virksomheter.

## Slik henger det sammen

```
uutilsynets åpne datasett
          │
          ▼
build_benchmark_source.py    speiler datasettet til docs/data/uustatus/
enrich_uu_details.py         utleder WCAG-koder → docs/uu-status-details.json
build_uu_archive.py          diff mot i går → changes.jsonl + erklaeringsregister.json
          │
          ▼
app/  (React + Vite + Skatteetatens designsystem)  →  dist/  →  GitHub Pages
```

Alt oppdateres av `.github/workflows/uu-status.yml`, som kjører 01:27 UTC hver
natt og kaller `pages.yml` for å publisere når noe har endret seg.

## Datagrunnlaget

Alt kommer fra [uutilsynets åpne datasett](https://data.uutilsynet.no/dataset/alle-erklaeringer).
WCAG-kodene utledes av `resultat`-arrayet, via `oppfyllerAltInnhaldKravet == "no"`.

Tidligere ble kodene skrapet fra uustatus.no. Det ga en stille feil: en erklæring
som fikk alle brudd rettet beholdt de gamle kodene for alltid, fordi skrapingen
returnerte `None` og kallstedet hoppet over tildelingen. Elleve erklæringer viste
brudd som var rettet opptil ni måneder tidligere. Skrapingen er fjernet.

Ikke send `Accept: application/json` til API-et – det svarer 406.

## Filer som er en kontrakt

`docs/uu-status-details.json` hentes direkte fra Pages av UU-portalen, som er et
eget prosjekt. Feltnavnene `nonConformities`, `codes`, `totalNonConformities`,
`updatedAt` og `opprettet` kan ikke endres uten at portalen følger etter.
`pages.yml` kontrollerer at de finnes før publisering.

`docs/data/uustatus/logs/changes.jsonl` er uerstattelig historikk. Den skrives
kun med append. Ta sikkerhetskopi før noe annet.

`docs/data/uustatus/erklaeringsregister.json` husker hver erklæring vi har sett,
med navn, når den forsvant og hvilke brudd den hadde sist. Datasettet inneholder
bare det som finnes nå, så uten registeret forsvinner navnet og bruddene samme
natt som en erklæring slettes hos uutilsynet.

## Identitet: UUID, ikke URL

En erklæring identifiseres av UUID-en i adressen, ikke av hele URL-en. Samme
erklæring finnes på både bokmåls- og nynorskadresse. Med URL som nøkkel ble et
språkbytte lest som at én erklæring forsvant og en ny kom til – det skjedde
2026-03-05 og ga fire falske «Ny erklæring»-rader som fortsatt står i arkivet.

Regelen finnes to steder og må holdes i takt: `erklaering_id()` i
`build_uu_archive.py` og `erklaeringId()` i `app/lib/data.ts`.

## Utvikling

```bash
npm install
npm run dev        # http://localhost:3001
npm run build      # tsc --noEmit && vite build → dist/
```

Python-skriptene kjøres fra rota. For å teste arkivet uten å vente til neste dag:

```bash
TEST_MODE=1 python build_uu_archive.py
```

| Miljøvariabel | Betydning |
|---|---|
| `TEST_MODE=1` | Bruk lokal `latest.json` som baseline i stedet for git HEAD |
| `BASELINE_REF=<ref>` | Bruk en bestemt git-referanse som baseline |
| `AUTO_BACKTRACK=1` | Prøv eldre commits hvis baseline mangler |
| `MAX_BACKTRACK=<n>` | Maks antall commits å prøve (standard 10) |

## Tester

```bash
python test_arkiv.py
```

31 regresjonstester for diffmotoren, dedupliseringen og registeret. Hver enkelt
svarer til en feil som faktisk har skrevet gale rader i `changes.jsonl` uten å
feile synlig. De kjøres i nattjobben før arkivsteget, slik at en feil stopper
kjøringen mens historikken fortsatt er intakt.

## Sikkerhet i byggekjeden

- `requirements.txt` er låst med SHA256 og installeres med `--require-hashes`
- npm-avhengighetene er pinnet eksakt og låst i `package-lock.json`
- Alle GitHub Actions er pinnet til commit-SHA, ikke tagg
- Bygging og skriving er delt i to jobber: jobben som installerer
  tredjepartspakker og behandler eksterne data har kun lesetilgang
- Dependabot holder pinningen levende, se `.github/dependabot.yml`

## Teknologi

Python 3.11 · React 19 · Vite 7 · TypeScript 5.7 ·
[Skatteetatens designsystem](https://design.skatteetaten.no) 2.10
