# Abonnementstjenesten: katalog og feeds for Power Automate

GitHub-delen av abonnementstjenesten. Ansatte skal senere kunne abonnere på
tilgjengelighetserklæringer via et skjema i SharePoint; Power Automate skal
holde en SharePoint-liste oppdatert, oppdage endringer, sende varsler og
fristvarsler. Alt Power Automate trenger publiseres herfra – GitHub-repoet er
eneste kilde til erklæringsdata, og ingenting skal registreres eller
synkroniseres manuelt.

**Abonnentdata lagres aldri i GitHub.** Hvem som abonnerer på hva, e-postadresser
og skjemasvar bor i SharePoint og bare der. Feedene inneholder kun data som
allerede er offentlige på uustatus.no.

## Filene som publiseres

Alt bygges av `build_subscription_feeds.py` i den nattlige workflowen
(`.github/workflows/uu-status.yml`), etter at erklæringsdata og
endringshistorikk er bygget. En feil i genereringen stopper bygget før noe
publiseres.

| Fil | Offentlig URL | Innhold |
|---|---|---|
| `docs/data/subscriptions/declarations.json` | `https://skatteetaten.github.io/uu-status/data/subscriptions/declarations.json` | **Datakontrakten**: katalog over alle erklæringer |
| `docs/feeds/uu-catalog.xml` | `https://skatteetaten.github.io/uu-status/feeds/uu-catalog.xml` | Katalogen som RSS 2.0 (transportformat) |
| `docs/feeds/uu-events.xml` | `https://skatteetaten.github.io/uu-status/feeds/uu-events.xml` | Endringshendelser som RSS 2.0 |

JSON-filen er kontrakten; RSS-ene er transportformatet Power Automates
standard RSS-tilkobling kan lese uten premium HTTP-tilkobling. Hvert
RSS-element bærer den fulle posten som kompakt JSON i `description`, klar for
`json()` i Power Automate.

## Katalogen (`declarations.json` / `uu-catalog.xml`)

```json
{
  "schemaVersion": "1.0.0",
  "source": "https://skatteetaten.github.io/uu-status/",
  "count": 123,
  "declarations": [ { … } ]
}
```

Én post per erklæring vi noen gang har sett, deterministisk sortert på
`declarationId`:

| Felt | Type | Betydning |
|---|---|---|
| `declarationId` | streng | Stabil ID: UUID-en i erklærings-URL-en (se under) |
| `title` | streng \| null | Løsningens navn |
| `declarationUrl` | streng \| null | Erklæringen på uustatus.no (alltid `/nb/`-adressen) |
| `status` | streng \| null | `samsvarsstatus` fra datasettet, f.eks. «Delvis i samsvar». `null` for fjernede erklæringer – registeret lagrer den ikke |
| `nonConformities` | liste | WCAG-krav med brudd, sortert |
| `totalNonConformities` | tall \| null | Antall brudd |
| `deadline` | dato \| null | Neste oppdateringsfrist (ISO 8601-dato). `null` for fjernede – de har ingen oppdateringsplikt |
| `sourceUpdatedAt` | dato \| null | Siste oppdatering hos uutilsynet |
| `lastMeaningfulChangeAt` | tidspunkt \| null | Siste *reelle* endring vi har logget (UTC, `…Z`) |
| `active` | boolsk | Finnes erklæringen i kildedatasettet nå |
| `removedAt` | dato \| null | Når den sist forsvant fra kilden |

Manglende verdier er alltid `null` – aldri oppdiktede data.

### Stabile ID-er

`declarationId` er UUID-en i erklæringens adresse, samme regel som
`erklaering_id()` i `build_uu_archive.py` og `erklaeringId()` i
`app/lib/data.ts`. Tittel brukes aldri som ID. Bokmåls- og nynorskadressen
(`/nb/` vs `/nn/`) er samme erklæring og gir samme ID. Bruk `declarationId`
som nøkkel i SharePoint-listen.

### Fristen

Kildedataene har **ikke** noe eksplisitt fristfelt. Regelen er den UU-status
og UU-portalen allerede deler: en erklæring skal oppdateres minst én gang i
året, så fristen er `sourceUpdatedAt` (eller opprettelsesdatoen, hvis den
aldri er oppdatert) pluss ett år.

Regelen er implementert **ett sted**: `beregn_frist()` i
`enrich_uu_details.py`, som skriver `deadline` inn i `uu-status-details.json`.
Katalogen og feedene bruker samme funksjon, og `fristDato()` i
`app/lib/data.ts` foretrekker det publiserte feltet – nettsiden og
SharePoint-varslene kan derfor ikke regne seg fram til ulike datoer. Endrer
uutilsynet fristreglene, oppdateres den ene funksjonen. (UU-portalen har
fortsatt sin egen kopi av regelen; den styres ikke herfra.)

### Fjernede erklæringer

Erklæringer som forsvinner fra uutilsynets datasett slettes ikke fra
katalogen. De blir stående med `active: false`, `removedAt` og siste kjente
brudd, slik at abonnementer og SharePoint-rader kan beholdes og historikken
består. Kilden er `docs/data/uustatus/erklaeringsregister.json`, som husker
alle erklæringer vi har sett. Dukker erklæringen opp igjen, blir den aktiv
igjen med samme `declarationId`.

Merk: for fjerninger fra før registeret var komplett kan fjerningsdatoen og
siste kjente brudd mangle i kilden. Da er `removedAt` `null` og
`nonConformities` tom – manglende data representeres som `null`, aldri som en
gjettet dato. Flyter som datostempler deaktivering bør derfor falle tilbake på
egen synkroniseringsdato når `removedAt` er `null`.

## Hendelsesfeeden (`uu-events.xml`)

Hendelsene utledes 1:1 fra `docs/data/uustatus/logs/changes.jsonl` – den
eksisterende, append-only endringshistorikken. Det finnes ingen parallell
endringsdeteksjon: står det ikke en rad i loggen, finnes det ingen hendelse.

Hver `description` inneholder:

| Felt | Betydning |
|---|---|
| `schemaVersion` | Kontraktversjon, nå `1.0.0` |
| `eventId` | SHA1 av radens stabile felter – identisk i hver bygging |
| `eventType` | Se under |
| `declarationId`, `title`, `declarationUrl` | Som i katalogen |
| `changedFields` | Hvilke katalogfelt som endret seg |
| `previousValues` / `currentValues` | Verdier før/etter, når de er kjent; ellers `null`. Alltid `null` for `declaration_created` – en ny erklæring har ingen før-tilstand |
| `addedNonConformities` / `removedNonConformities` | WCAG-krav som kom til / ble rettet |
| `detectedAt` | Når endringen ble oppdaget (UTC) |
| `deadline` | Gjeldende frist etter endringen, når den kan beregnes |

### Hendelsestyper

| Type | Utløses av |
|---|---|
| `declaration_created` | Ny erklæring i datasettet |
| `declaration_changed` | Reell endring: brudd lagt til/rettet, antall endret |
| `declaration_removed` | Erklæringen forsvant fra datasettet |
| `status_changed` | **Sendes ikke i dag** – se begrensninger |
| `deadline_changed` | **Sendes ikke som egen type** – se begrensninger |

### Begrensninger i kildedataene

- Diffmotoren sporer `updatedAt` og bruddene, ikke `samsvarsstatus`. En ren
  statusendring gir derfor ingen hendelse (`status_changed` er reservert i
  kontrakten, men sendes ikke). Katalogen viser alltid gjeldende status.
- Fristen er utledet av `updatedAt`, og en ren `updatedAt`-endring – at
  virksomheten bekrefter erklæringen uten å endre noe – filtreres bevisst bort
  som teknisk støy før den når loggen. Fristendringer synes derfor bare som
  `deadline` i `changedFields` når de skjer sammen med en reell endring.
  **Fristvarsler skal derfor bygges på katalogen, ikke på hendelsesfeeden**:
  katalogen har alltid fersk `deadline` for hver erklæring.
- Et rent teknisk `updatedAt`-hopp gir aldri en hendelse. Det er samme regel
  som endringsarkivet på nettsiden bruker.

### Ingen doble varsler

- `eventId` er deterministisk (SHA1 av radens `ts`, `declarationId`, `added`,
  `removed` og `changed`) og radene i `changes.jsonl` skrives aldri om. Samme
  kildeendring får derfor samme `eventId` og samme `pubDate` i hver eneste
  bygging – en ny kjøring produserer aldri en «ny» gammel hendelse.
- RSS-`guid` er `eventId` med `isPermaLink="false"`. Bruk guid-en som
  idempotensnøkkel i Power Automate hvis flyten kan kjøre samme element to
  ganger.

### pubDate-begrensningen i RSS

Power Automates RSS-trigger («When a feed item is published») sammenligner
publiseringstidspunkt og kan hoppe over elementer som deler `pubDate`.
Derfor:

- `pubDate` er alltid en gyldig RFC 822-dato i GMT.
- Hendelser som oppdages samtidig (samme kjøring skriver samme `ts`) får en
  stabil rekkefølge – sortert på `(detectedAt, declarationId, eventId)` – og
  skyves ett sekund fra hverandre, så tidspunktene er unike og strengt
  stigende.
- Skyvingen beregnes over hele loggen, aldri over et utsnitt, så en gammel
  hendelse skifter aldri `pubDate` fordi eldre hendelser falt ut av vinduet.
  `detectedAt` i JSON-en er alltid det faktiske deteksjonstidspunktet.

### Historikk i feeden

Feeden beholder de siste **250** hendelsene. Med dagens rate (~30 i måneden)
er det rundt åtte måneders historikk – et Power Automate-avbrudd på uker
mister ingenting, og fila holder seg under ~0,5 MB. Full historikk finnes
uansett i `changes.jsonl`, som aldri kuttes.

## Slik skal Power Automate konsumere dette

1. **Synkronisere SharePoint-listen** (daglig eller sjeldnere): hent
   `uu-catalog.xml` med RSS-tilkoblingens «List all RSS feed items», parse
   `description` som JSON, og upsert på `declarationId`. Sett rader med
   `active: false` som inaktive i stedet for å slette dem. Bruk *ikke*
   RSS-triggeren på katalogfeeden – dens `pubDate` er siste endring, ikke et
   publiseringstidspunkt for raden.
2. **Endringsvarsler**: RSS-triggeren på `uu-events.xml`. Parse `description`,
   slå opp abonnenter på `declarationId`, filtrer på `eventType` og
   `changedFields`.
3. **Fristvarsler**: en tidsstyrt flyt over SharePoint-listen (som får
   `deadline` fra katalogsynkroniseringen), f.eks. varsle når `deadline` er
   nærmere enn 30 dager. Ikke bygg fristvarsler på hendelsesfeeden – se
   begrensningene.
4. **Nye/fjernede erklæringer**: `declaration_created`/`declaration_removed`
   fra hendelsesfeeden, eller diffen mot katalogen ved synkronisering.

## Abonnementsinngangen på nettsiden

Inngangen («Abonner på varsler») er forberedt, men **deaktivert og ikke til
stede i DOM**. `app/lib/abonnement.ts` har funksjonsbryteren
`subscriptionsEnabled` (standard `false`) og adressen `subscriptionUrl`
(standard tom). `AbonnerLenke` i `app/komponenter/AbonnerLenke.tsx` rendrer
`null` – ingen skjult, tom eller fokuserbar rest – med mindre bryteren er på
**og** adressen er en gyldig https-URL.

Slik aktiveres den senere:

1. Sett `subscriptionUrl` i `app/lib/abonnement.ts` til SharePoint-skjemaets
   https-adresse.
2. Sett `subscriptionsEnabled: true`.
3. Oppdater testene i `app/lib/abonnement.test.ts` og
   `app/komponenter/AbonnerLenke.test.tsx` som fryser av-tilstanden.

Inngangen er semantisk en lenke: designsystemets `Link`-komponent, som rendrer
en ren `<a>` med designsystemets fokusmarkering, og som åpner i samme fane.
(`Button` med `href` er bevisst ikke brukt – den setter `role="button"` på
ankeret, og da annonserer skjermlesere «knapp» mens mellomromstasten ikke
aktiverer den.)

## Tester

```bash
python test_subscription_feeds.py   # katalog, hendelser, RSS, escaping, determinisme
npm test                            # bl.a. at inngangen ikke rendres som standard
```

Begge kjøres i CI: Python-testene i nattjobben før genereringen,
frontendtestene i `pages.yml` før hvert bygg.
