/**
 * Direktelenker til uutilsynets sider om hvert WCAG-krav.
 *
 * Portet uendret fra den gamle docs/uu-status.html. Kodene som ikke staar her
 * faller tilbake paa et soek hos uutilsynet, se wcagLenke().
 */
const WCAG_LENKER: Record<string, string> = {
  "1.1.1": "https://www.uutilsynet.no/wcag-standarden/111-ikke-tekstlig-innhold-niva/87",
  "1.2.1": "https://www.uutilsynet.no/wcag-standarden/121-bare-lyd-og-bare-video-forhandsinnspilt-niva/88",
  "1.2.2": "https://www.uutilsynet.no/wcag-standarden/122-teksting-forhandsinnspilt-niva/89",
  "1.2.5": "https://www.uutilsynet.no/wcag-standarden/125-synstolking-forhandsinnspilt-niva-aa/842",
  "1.3.1": "https://www.uutilsynet.no/wcag-standarden/131-informasjon-og-relasjoner-niva/90",
  "1.3.2": "https://www.uutilsynet.no/wcag-standarden/132-meningsfylt-rekkefolge-niva/91",
  "1.3.3": "https://www.uutilsynet.no/wcag-standarden/133-sensoriske-egenskaper-niva/92",
  "1.3.4": "https://www.uutilsynet.no/wcag-standarden/134-visningsretning-niva-aa/141",
  "1.3.5": "https://www.uutilsynet.no/wcag-standarden/135-identifiser-formal-med-inndata-niva-aa/142",
  "1.4.1": "https://www.uutilsynet.no/wcag-standarden/141-bruk-av-farge-niva/93",
  "1.4.2": "https://www.uutilsynet.no/wcag-standarden/142-styring-av-lyd-niva/94",
  "1.4.3": "https://www.uutilsynet.no/wcag-standarden/143-kontrast-minimum-niva-aa/95",
  "1.4.4": "https://www.uutilsynet.no/wcag-standarden/144-endring-av-tekststorrelse-niva-aa/96",
  "1.4.5": "https://www.uutilsynet.no/wcag-standarden/145-bilder-av-tekst-niva-aa/97",
  "1.4.10": "https://www.uutilsynet.no/wcag-standarden/1410-dynamisk-tilpasning-reflow-niva-aa/144",
  "1.4.11": "https://www.uutilsynet.no/wcag-standarden/1411-kontrast-ikke-tekstlig-innhold-niva-aa/145",
  "1.4.12": "https://www.uutilsynet.no/wcag-standarden/1412-tekstavstand-niva-aa/146",
  "1.4.13": "https://www.uutilsynet.no/wcag-standarden/1413-pekerfolsomt-innhold-eller-innhold-ved-tastaturfokus-niva-aa/147",
  "2.1.1": "https://www.uutilsynet.no/wcag-standarden/211-tastatur-niva/98",
  "2.1.2": "https://www.uutilsynet.no/wcag-standarden/212-ingen-tastaturfelle-niva/99",
  "2.1.4": "https://www.uutilsynet.no/wcag-standarden/214-hurtigtaster-som-bestar-av-ett-tegn-niva/782",
  "2.2.1": "https://www.uutilsynet.no/wcag-standarden/221-justerbar-hastighet-niva/100",
  "2.2.2": "https://www.uutilsynet.no/wcag-standarden/222-pause-stopp-skjul-niva/101",
  "2.3.1": "https://www.uutilsynet.no/wcag-standarden/231-terskelverdi-pa-maksimalt-tre-glimt-niva/102",
  "2.4.1": "https://www.uutilsynet.no/wcag-standarden/241-hoppe-over-blokker-niva/103",
  "2.4.2": "https://www.uutilsynet.no/wcag-standarden/242-sidetitler-niva/104",
  "2.4.3": "https://www.uutilsynet.no/wcag-standarden/243-fokusrekkefolge-niva/105",
  "2.4.4": "https://www.uutilsynet.no/wcag-standarden/244-formal-med-lenke-i-kontekst-niva/106",
  "2.4.5": "https://www.uutilsynet.no/wcag-standarden/245-flere-mater-niva-aa/107",
  "2.4.6": "https://www.uutilsynet.no/wcag-standarden/246-overskrifter-og-ledetekster-niva-aa/108",
  "2.4.7": "https://www.uutilsynet.no/wcag-standarden/247-synlig-fokus-niva-aa/109",
  "2.5.1": "https://www.uutilsynet.no/wcag-standarden/251-pekerbevegelser-niva/148",
  "2.5.2": "https://www.uutilsynet.no/wcag-standarden/252-pekeravbrytelse-niva/149",
  "2.5.3": "https://www.uutilsynet.no/wcag-standarden/253-ledetekst-i-navn-niva/150",
  "2.5.4": "https://www.uutilsynet.no/wcag-standarden/254-bevegelsesaktivering-niva/151",
  "3.1.1": "https://www.uutilsynet.no/wcag-standarden/311-sprak-pa-siden-niva/110",
  "3.1.2": "https://www.uutilsynet.no/wcag-standarden/312-sprak-pa-deler-av-innhold-niva-aa/111",
  "3.2.1": "https://www.uutilsynet.no/wcag-standarden/321-fokus-niva/112",
  "3.2.2": "https://www.uutilsynet.no/wcag-standarden/322-inndata-niva/114",
  "3.2.3": "https://www.uutilsynet.no/wcag-standarden/323-konsekvent-navigering-niva-aa/113",
  "3.2.4": "https://www.uutilsynet.no/wcag-standarden/324-konsekvent-identifikasjon-niva-aa/115",
  "3.3.1": "https://www.uutilsynet.no/wcag-standarden/331-identifikasjon-av-feil-niva/116",
  "3.3.2": "https://www.uutilsynet.no/wcag-standarden/332-ledetekster-eller-instruksjoner-niva/117",
  "3.3.3": "https://www.uutilsynet.no/wcag-standarden/333-forslag-ved-feil-niva-aa/118",
  "3.3.4": "https://www.uutilsynet.no/wcag-standarden/334-forhindring-av-feil-juridiske-feil-okonomiske-feil-datafeil-niva-aa/119",
  "4.1.1": "https://www.uutilsynet.no/wcag-standarden/411-parsing-oppdeling-niva/120",
  "4.1.2": "https://www.uutilsynet.no/wcag-standarden/412-navn-rolle-verdi-niva/121",
  "4.1.3": "https://www.uutilsynet.no/wcag-standarden/413-statusbeskjeder-niva-aa/152"
};

/** Lenke til beskrivelsen av et WCAG-krav. */
export function wcagLenke(kode: string): string {
  return (
    WCAG_LENKER[kode] ??
    'https://www.uutilsynet.no/search?search=' +
      encodeURIComponent(kode) +
      '&f%5B0%5D=global_taxonomy%3A10&sort_by=search_api_relevance&sort_order=DESC'
  );
}

/** Om kravet har en direktelenke, eller bare et soekefall-tilbake. */
export function harDirektelenke(kode: string): boolean {
  return kode in WCAG_LENKER;
}

/**
 * Norske titler på kravene, slik uutilsynet skriver dem.
 *
 * Kodene alene («1.3.1») sier ingenting på en infoskjerm som leses på tre
 * meters avstand. Titlene kunne vært utledet av slugene i WCAG_LENKER, men
 * slugene mangler æ/ø/å («fokusrekkefolge»), så de står her med riktig
 * rettskriving i stedet. Samme kravutvalg som WCAG_LENKER.
 */
const KRAV_NAVN: Record<string, string> = {
  "1.1.1": "Ikke-tekstlig innhold",
  "1.2.1": "Bare lyd og bare video (forhåndsinnspilt)",
  "1.2.2": "Teksting (forhåndsinnspilt)",
  "1.2.5": "Synstolking (forhåndsinnspilt)",
  "1.3.1": "Informasjon og relasjoner",
  "1.3.2": "Meningsfylt rekkefølge",
  "1.3.3": "Sensoriske egenskaper",
  "1.3.4": "Visningsretning",
  "1.3.5": "Identifiser formål med inndata",
  "1.4.1": "Bruk av farge",
  "1.4.2": "Styring av lyd",
  "1.4.3": "Kontrast (minimum)",
  "1.4.4": "Endring av tekststørrelse",
  "1.4.5": "Bilder av tekst",
  "1.4.10": "Dynamisk tilpasning (reflow)",
  "1.4.11": "Kontrast for ikke-tekstlig innhold",
  "1.4.12": "Tekstavstand",
  "1.4.13": "Pekerfølsomt innhold eller innhold ved tastaturfokus",
  "2.1.1": "Tastatur",
  "2.1.2": "Ingen tastaturfelle",
  "2.1.4": "Hurtigtaster som består av ett tegn",
  "2.2.1": "Justerbar hastighet",
  "2.2.2": "Pause, stopp, skjul",
  "2.3.1": "Terskelverdi på maksimalt tre glimt",
  "2.4.1": "Hoppe over blokker",
  "2.4.2": "Sidetitler",
  "2.4.3": "Fokusrekkefølge",
  "2.4.4": "Formål med lenke (i kontekst)",
  "2.4.5": "Flere måter",
  "2.4.6": "Overskrifter og ledetekster",
  "2.4.7": "Synlig fokus",
  "2.5.1": "Pekerbevegelser",
  "2.5.2": "Pekeravbrytelse",
  "2.5.3": "Ledetekst i navn",
  "2.5.4": "Bevegelsesaktivering",
  "3.1.1": "Språk på siden",
  "3.1.2": "Språk på deler av innhold",
  "3.2.1": "Fokus",
  "3.2.2": "Inndata",
  "3.2.3": "Konsekvent navigering",
  "3.2.4": "Konsekvent identifikasjon",
  "3.3.1": "Identifikasjon av feil",
  "3.3.2": "Ledetekster eller instruksjoner",
  "3.3.3": "Forslag ved feil",
  "3.3.4": "Forhindring av feil (juridiske feil, økonomiske feil, datafeil)",
  "4.1.1": "Parsing (oppdeling)",
  "4.1.2": "Navn, rolle, verdi",
  "4.1.3": "Statusbeskjeder"
};

/** Tittelen på et krav, eller tom streng for ukjente koder. */
export function kravNavn(kode: string): string {
  return KRAV_NAVN[kode] ?? '';
}
