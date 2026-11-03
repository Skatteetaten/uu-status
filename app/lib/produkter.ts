import { erklaeringId } from './data';
import type { Erklaering } from './typer';

/**
 * Gruppen for erklæringer uten kjent produkt/område. Står alltid sist, og
 * fanger også nye erklæringer som dukker opp i datasettet før noen har
 * plassert dem i PRODUKT_PER_ERKLAERING.
 */
export const ANDRE_TJENESTER = 'Andre tjenester';

/**
 * Hvilket produkt/område hver erklæring hører til, slått opp på UUID-en i
 * adressen – ikke navnet, som kan endres i erklæringen, og ikke hele URL-en,
 * som skifter mellom /nb/ og /nn/ (se erklaeringId).
 *
 * Kilde: «Tilgjengelighetserklæringer per produkt/område» (november 2026).
 * Tenor Testdatasøk sto der både under Testlab og Ukjent produkt; den hører
 * til Testlab. «Ukjent produkt» heter her ANDRE_TJENESTER.
 */
const PRODUKT_PER_ERKLAERING: Readonly<Record<string, string>> = {
  // Arbeid og velferd
  '0886dcd5-5ce1-4f94-9c3f-2199dc17f445': 'Arbeid og velferd', // A-meldingen - Avstemmingsinformasjon
  '35614cc2-407f-4319-ba2c-1c6829e03a82': 'Arbeid og velferd', // A-meldingen for arbeid i hjemmet
  '971ea794-9fc7-4533-8d47-e0d03ba3218a': 'Arbeid og velferd', // A-meldingen for veldedig eller allmennyttig organisasjon
  '9f28dbdb-019b-4808-8104-ba3357850873': 'Arbeid og velferd', // A-meldingen for virksomheter uten lønnssystem (A10)
  'c4a29794-9072-43fd-abdc-9a7c3309a70a': 'Arbeid og velferd', // Innrapportering av a-melding som vedlegg
  'd2083279-2df2-46a7-9ea9-63fd71a58af0': 'Arbeid og velferd', // Mine inntekter og arbeidsforhold
  '85e1c596-39a7-4808-86bf-81f5ec7971cd': 'Arbeid og velferd', // Nettolønn til bruttolønn
  '23cc25da-3600-433b-a83c-9f0797057e50': 'Arbeid og velferd', // Oppdrags- og arbeidsforholdsregisteret
  '8d749060-4f44-49ce-994e-e92953234b8f': 'Arbeid og velferd', // Oppdragsgiverportalen
  '4faf721d-547c-424f-9c61-1e27b8453b3f': 'Arbeid og velferd', // Skattefrie utbetalinger fra offentlige virksomheter – rapportering av tredjepartsopplysninger
  '62611290-2cdd-44d9-a3ca-d317adbb6711': 'Arbeid og velferd', // Tredjepartsopplysninger - betaling for pass og stell av barn

  // Betaling og regnskap
  '18fecbde-8bf8-4bfd-ad26-440f4f96af94': 'Betaling og regnskap', // Avtale om fristforlengelse - Innkrevingsmyndigheten
  'a83f2d0e-23d8-4a16-9679-f24f3304794a': 'Betaling og regnskap', // Betalingsavtale – Innkrevingsmyndigheten
  '66527ffb-ee0e-4070-9ba2-10563b1ab6c8': 'Betaling og regnskap', // Forlik og namsmann
  'd2a884f4-b624-4b42-aaa8-ffd0a42e24b3': 'Betaling og regnskap', // Fullmakt – Innkrevingsmyndigheten
  '398bc579-1d88-44fc-b342-a19759d95f0d': 'Betaling og regnskap', // Innlevering av kontoopplysninger
  'f11ede3e-d5e7-46d4-a1c1-c7194d272fc5': 'Betaling og regnskap', // Kildeskatt på aksjeutbytte
  '7f062dc7-c923-4032-b24e-600e0520a14c': 'Betaling og regnskap', // Klage på eller henvendelse om motregning – Innkrevingsmyndigheten
  '1fdc0d8d-db30-420b-a0e7-ef32afbaf4aa': 'Betaling og regnskap', // Klage på utleggstrekk eller beløp - Innkrevingsmyndigheten
  '00583d50-3635-4a89-889f-fb1ee6c22234': 'Betaling og regnskap', // Klage på vedtak om utvidet kontroll
  '93d6de46-3b5d-4ecc-9149-b0d27af706fa': 'Betaling og regnskap', // Konto for utbetalinger fra Skatteetaten
  '46f94252-a1d0-4161-9192-5fe073f98228': 'Betaling og regnskap', // Melding om kildeskatt på renter, royalty og leiebetalinger
  'e6f45079-c6b4-49de-915e-585397c483b9': 'Betaling og regnskap', // Mine krav
  'd84635ae-57ad-4edf-b460-b41e1f96255b': 'Betaling og regnskap', // Mine saker - Namsmann og forliksrådtjenester
  'ce849dda-30d4-4c85-84ce-c6e288a20a78': 'Betaling og regnskap', // Nytt eller endret kontonummer for utbetaling av skatt
  '4d3f5dbd-e902-48a6-aa6e-0b0533a5de9b': 'Betaling og regnskap', // Søknad om dagsoppgjør eller månedsoppgjør
  '9328d70e-f881-42e6-9028-b8e6a043d145': 'Betaling og regnskap', // Søknad om eller klage på motregning i fremtidige bidrag
  '93799278-4e66-4b78-984a-44715606a354': 'Betaling og regnskap', // Søknad om endring av avregning i ytelse – Innkrevingsmyndigheten
  '70e51ceb-3ded-416b-b647-251d634ea738': 'Betaling og regnskap', // Søknad om kreditt for engangsavgift
  '19bc325d-4200-4f68-9788-e4d478a9c49e': 'Betaling og regnskap', // Søknad om tollkreditt
  'd8127968-6877-47fc-8201-abe46d54439f': 'Betaling og regnskap', // Søknad om å endre, gjenåpne eller avslutte dagsoppgjør eller månedsoppgjør
  'a6397693-d147-4941-83d0-09d638989c1e': 'Betaling og regnskap', // Søknad om å endre, gjenåpne eller avslutte kreditt for engangsavgift
  'bd86d295-ad04-4c36-bfe2-fe88231f2de5': 'Betaling og regnskap', // Søknad om å endre, gjenåpne eller avslutte tollkreditt
  'f25c6608-37de-4886-913a-3f4144e522a3': 'Betaling og regnskap', // Trekkontroll
  'f85283dd-ef02-4af3-b67f-69aba2168e3e': 'Betaling og regnskap', // Utlegg og forlik
  'dd668d30-1d3f-4cc4-bf56-e34feac2a220': 'Betaling og regnskap', // Utsatt frist søknad

  // Eiendom og transportmidler
  'd2995a2d-ed89-4ac2-9012-92ea6492028a': 'Eiendom og transportmidler', // Min side - Eiendommer
  'b8fa4de7-ebf7-47d4-9bf5-07efaa310964': 'Eiendom og transportmidler', // Rapportering av utleie av fast eiendom fra formidlingsselskap
  'e1c1e944-48f2-47ac-be68-21824d833339': 'Eiendom og transportmidler', // Selvbetjening motorvogn
  'c4742d76-f848-48ea-b12d-4b45a5bfde48': 'Eiendom og transportmidler', // Tredjepartsopplysninger - boligsameie
  'db6ea2aa-9391-4db4-b6c7-14f4663be109': 'Eiendom og transportmidler', // Tredjepartsopplysninger - boligselskap

  // Finans
  '23a46c06-1d7f-46ce-aff3-ff2367d9f86f': 'Finans', // Internasjonal rapportering CRS/FATCA
  '46477ae1-0ba8-46bc-a2f4-2591f9b60593': 'Finans', // Tredjepartsopplysninger - boligsparing for ungdom
  'ea01a748-09dc-45d3-8eaa-a220ac38eb3c': 'Finans', // Tredjepartsopplysninger - innskudd, utlån og renter mv
  'e37132b1-c16e-40a8-84b9-e21385a50e53': 'Finans', // Tredjepartsopplysninger - skadeforsikring
  '39753a2a-0385-47e4-946e-2d934c0fcd38': 'Finans', // VAT On E-Commerce (VOEC)

  // Folkeregisteret
  '3eea216f-0c8c-4d81-ba12-c63aa7e16e4c': 'Folkeregisteret', // Folkeregister
  'b3d88e65-5bce-452d-91a8-c2aa76835fb2': 'Folkeregisteret', // Folkeregisteret - om tjenestene
  '4bc20483-8788-4c4f-b2bd-756feb5ec2f6': 'Folkeregisteret', // Oppslag i Folkeregisteret
  '2b1a0612-6d0b-4d33-855b-fe3173ed655b': 'Folkeregisteret', // Tips om avvik i Folkeregisteret

  // Førstelinje
  '4d87bd2a-a5d3-4b8e-ae7a-1212fb6e2811': 'Førstelinje', // Attest for skatt og avgift
  '18bd7a08-517c-4ef7-8bec-06cd6568563b': 'Førstelinje', // Skriv til oss

  // Innboks / Min dialog / Mine utkast
  'a677a1b4-b156-4e05-8754-e62c218f056e': 'Innboks / Min dialog / Mine utkast', // Innboks
  '4ef4a04a-0461-4234-aef3-540d8970fd55': 'Innboks / Min dialog / Mine utkast', // Innsyn etter personopplysningsloven
  '85917b0d-c897-4f1c-a9cb-94e7ff359c4b': 'Innboks / Min dialog / Mine utkast', // Min side
  '57116662-c9ab-444f-811a-68f474e634c8': 'Innboks / Min dialog / Mine utkast', // Svar oss i sak
  '461f43ab-f826-46b5-a664-8caea74d7e0c': 'Innboks / Min dialog / Mine utkast', // Tips oss

  // Melding om forskuddsskatt for upersonlige skattepliktige
  '92d37593-8a99-4ebc-b21a-98cf04e4d0a2':
    'Melding om forskuddsskatt for upersonlige skattepliktige', // RF-1097 Søknad om endring av eller krav om forskuddsskatt – upersonlig skattyter

  // Omsetning og tilskudd
  '6ff36d85-dfeb-4701-8f46-1fdb8293c33f': 'Omsetning og tilskudd', // Betalinger til selvstendig næringsdrivende
  '78176632-e3c1-4a2d-8640-6f3810536b99': 'Omsetning og tilskudd', // Godtgjøring til opphaver til åndsverk
  'ff1db11a-0c6e-4289-9a59-1cf56b03898f': 'Omsetning og tilskudd', // Kjøp fra produsent – egg
  'd7e02a17-9f66-4ea6-8b47-894de9a774b4': 'Omsetning og tilskudd', // Kjøp fra produsent – Jord- og hagebruk
  'aeeb6601-3230-49a1-8376-da89724fb1e2': 'Omsetning og tilskudd', // Kjøp fra produsent – korn
  'a9727a41-37f8-4c21-ba2b-c82cd5f4a52c': 'Omsetning og tilskudd', // Kjøp fra produsent – melk
  '97188853-f36e-441f-abf3-0cc7cd444fb1': 'Omsetning og tilskudd', // Kjøp fra produsent – slakt
  '4c5d6dea-37dc-4ebc-adfe-b22e1eab0596': 'Omsetning og tilskudd', // Melding om offentlig støtte under Skatteetatens støtteordninger
  'a98e3705-25ce-408a-8369-b9be61c51cce': 'Omsetning og tilskudd', // Rapportering av tredjepartsopplysninger med vedlegg
  '27230555-3e1d-43a8-bbbe-4b3566d62b57': 'Omsetning og tilskudd', // Tredjepartsopplysninger - gaver til visse frivillige organisasjoner og tros- og livssynssamfunn
  '9026f9d6-8ab5-4fb8-bba6-88aaeb18dbcf': 'Omsetning og tilskudd', // Tredjepartsopplysninger - nye opplysninger til oppgavegiverregisteret
  '65d9e9e9-1611-4fd6-bcca-1fd5ca56646d': 'Omsetning og tilskudd', // Tredjepartsopplysninger - tilskudd til vitenskapelig forskning eller yrkesopplæring

  // Skattekort og forskuddsskatt for personlige skattytere
  '2e9af915-796a-4b03-8f51-fe1d0f76850a':
    'Skattekort og forskuddsskatt for personlige skattytere', // Endre skattekort
  '2c1faadd-00a7-40fd-870e-9cf5805a2d35':
    'Skattekort og forskuddsskatt for personlige skattytere', // Min skatteplikt
  '31334400-de06-4eeb-909f-ac880e5af8c9':
    'Skattekort og forskuddsskatt for personlige skattytere', // Skattekort arbeidsgiver
  '50313dcd-45e5-40bd-9268-be896f8298f4':
    'Skattekort og forskuddsskatt for personlige skattytere', // Skattemessig bostedsbekreftelse
  'eb130211-e58f-4677-9a3e-319446e3f898':
    'Skattekort og forskuddsskatt for personlige skattytere', // Søknad om skattekort for utenlandsk arbeidstaker
  '39f00367-5950-4917-8521-6c2faf74f784':
    'Skattekort og forskuddsskatt for personlige skattytere', // Tabellkort - beregn skattetrekk

  // Skattemelding MVA
  '00318500-e9c5-48c0-9400-e06daf2407dd': 'Skattemelding MVA', // Merverdiavgiftshåndboken
  '1962c333-41e1-4cfa-9882-bb3fad358981': 'Skattemelding MVA', // Min merverdiavgift
  '5f92b879-42e9-4f0b-827e-eee292446cc6': 'Skattemelding MVA', // Søknad om tilbakebetaling av merverdiavgift for privatpersoner og uregistrerte firmaer

  // Skattemelding skatt
  '47f7a6da-c7f3-4f1f-a5ae-ce4eee7c4c8a': 'Skattemelding skatt', // Beregn skatt
  '28600a84-ef55-4d19-b69c-919cc48f6df0': 'Skattemelding skatt', // Brev om skattemeldingen
  'f64e1efc-c2f7-4285-ac38-b3c43872cc05': 'Skattemelding skatt', // Globalskatt mottak
  '3d688919-6cec-434d-b8d3-de12bb6441aa': 'Skattemelding skatt', // Globalskatt validering
  '4fd1edd9-7157-4e62-bd8c-63a991c4102a': 'Skattemelding skatt', // Min skatt og mine skattedokumenter
  '3cda10ad-635e-457c-8fe1-c90c5b4bab4f': 'Skattemelding skatt', // Oversikt over innhold i skattemeldingen
  '7ab75090-1f32-4cef-9edb-3932179a4250': 'Skattemelding skatt', // Rapportering av opplysninger om avtalevilkår og salgsvilkår ved særskattepliktig realisasjon av naturgass fra norsk sokkel
  'a220a476-5308-4a4f-91f8-2589cfb4cd52': 'Skattemelding skatt', // Skatt delegering
  '8174d150-d11c-4685-a6a1-12024c7bf2ba': 'Skattemelding skatt', // Skattekalkulator - Beregn skatten din
  'a49940f0-d273-4728-8ff4-4adce824cadf': 'Skattemelding skatt', // Skattelister
  'f8134272-66a6-4139-85e7-eeb9c64e1cb0': 'Skattemelding skatt', // Skattelister for mediehus
  '53e8e046-5b41-49f5-9dff-d5cfd12ff40d': 'Skattemelding skatt', // Skattemeldingen
  '74032b18-c3b1-4d34-9045-2d624f715597': 'Skattemelding skatt', // Suppleringsskatt
  '032a655f-22dc-40ad-95ac-749baecf04dd': 'Skattemelding skatt', // Utskrift av skattemelding og skatteoppgjør

  // Skattemelding særavgifter
  '5b0cfae5-d1df-42d9-a6ad-c76a7a124f00': 'Skattemelding særavgifter', // Klage på vedtak om tvangsmulkt eller overtredelsesgebyr
  '98148ac6-eb3d-4f84-b3af-e167f9dad103': 'Skattemelding særavgifter', // Søknad om kjøretillatelse ved midlertidig opphold i Norge
  'da746138-2ec0-464d-8442-61a65639f0bb': 'Skattemelding særavgifter', // Søknad om midlertidig kjøretillatelse for firmabil registrert i utlandet

  // Testlab
  '70c131d2-31de-4af7-b2cf-bf2a2ae4b144': 'Testlab', // Tenor Testdatasøk

  // Tvungen betaling
  '45433ba5-1837-4739-921e-8b537a2e76e2': 'Tvungen betaling', // Klage på utleggspant – Innkrevingsmyndigheten
  '89da6418-4214-48dc-9e91-a0f1d0e7d7c8': 'Tvungen betaling', // Søknad om endring eller stans av utleggstrekk
  '474734e3-a0fa-4021-98c1-3f80f5029f0f': 'Tvungen betaling', // Søknad om fritak for solidaransvar

  // Andre tjenester
  'fda75c75-d3d3-42ac-acb5-627bae3c1b93': ANDRE_TJENESTER, // Beta-API'er - Github
  '3daf0fcb-305b-4df9-bb92-46baf73f373e': ANDRE_TJENESTER, // Designsystemet
  '0724e689-fa47-4b24-8f35-8163f194564a': ANDRE_TJENESTER, // Intranett
  'a676aca0-a19c-419a-874e-9d1210a3cc68': ANDRE_TJENESTER, // RDT portal
  '96c10424-bbb7-4a19-8ce1-d75e1a146666': ANDRE_TJENESTER, // Rettighetspakke innsyn web
  '0f8eb2c9-2436-418e-8c57-2ea8865c8121': ANDRE_TJENESTER, // Servicesenter for utenlandske arbeidstakere
  'e92f8e05-b13f-4fb8-a1bf-e9f5e6553c1d': ANDRE_TJENESTER, // Skatteetaten github
  'cb17285c-a864-4b63-a0b1-77694f88c382': ANDRE_TJENESTER, // Skatteetaten status
  '0193e69a-7038-4809-9859-e71ddc747071': ANDRE_TJENESTER, // skatteetaten.no
  '1db8195e-6e45-45b4-8209-c5abccf480f1': ANDRE_TJENESTER, // Skatteetatens API'er
  '90be03a3-13e4-4979-8c88-f38727fb77e0': ANDRE_TJENESTER, // Skatteetatens designsystem - Github
  'facaf2cb-a765-4920-aa7d-689954951b3b': ANDRE_TJENESTER, // Skattekartet
  '26c4a573-0f38-4ba4-95f8-d6a7c504b387': ANDRE_TJENESTER, // Skiftefullmakt
  'e32e9bfb-189a-4390-af64-f39fc93a190a': ANDRE_TJENESTER, // Særavgifter
  'e6745fbf-76e5-469b-abb6-3e9fd52c7e9c': ANDRE_TJENESTER, // The Aurora Platform

  // Utvidet kontroll
  '7dc979c0-aaee-4915-b5d2-a6f1812aede3': 'Utvidet kontroll', // Innrapportering SAF-T
  'fd0928c5-4a39-4009-ac80-b1d1b78febef': 'Utvidet kontroll', // Land-for-land-rapportering for skatteformål
  'b9536014-19fd-4d49-b085-7f1ea7e88311': 'Utvidet kontroll', // Systemleverandørers produkterklæring av kassasystemer

  // Verdipapirer
  '8c79a29b-693a-432c-b404-b2dc280ff7bc': 'Verdipapirer', // Aksjeoppgaven
  '73861348-d10d-4fa0-9465-2befc64b33ac': 'Verdipapirer', // Opsjoner i oppstartsselskaper og vekstselskaper – rapportering av tredjepartsopplysninger
};

export function produktFor(e: Erklaering): string {
  return PRODUKT_PER_ERKLAERING[erklaeringId(e.url)] ?? ANDRE_TJENESTER;
}

/** Alfabetisk etter norsk rekkefølge, med ANDRE_TJENESTER til slutt. */
export function sammenlignProdukter(a: string, b: string): number {
  if (a === b) return 0;
  if (a === ANDRE_TJENESTER) return 1;
  if (b === ANDRE_TJENESTER) return -1;
  return a.localeCompare(b, 'nb');
}
