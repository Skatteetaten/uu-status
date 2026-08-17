/**
 * Formen på docs/uu-status-details.json.
 *
 * KONTRAKT: UU-portalen (eget prosjekt) henter denne fila direkte fra
 * https://skatteetaten.github.io/uu-status/uu-status-details.json og leser
 * nonConformities, codes, totalNonConformities, updatedAt og opprettet.
 * Endres feltnavnene her, må enrich_uu_details.py og portalen følge etter.
 */
export interface Erklaering {
  url: string;
  name: string;
  /** WCAG-koder med brudd. `codes` og `nonConformities` er samme liste. */
  codes: string[];
  nonConformities: string[];
  totalNonConformities: number;
  /** ISO-dato (YYYY-MM-DD) for siste oppdatering av erklæringen. */
  updatedAt: string;
  /** ISO-dato for første gang erklæringen ble produsert. */
  opprettet: string;
  title: string;
  domain: string;
  /** «I samsvar» | «Delvis i samsvar» | «Ikkje i samsvar» */
  samsvarsstatus: string;
}

/** Formen på docs/data/uustatus/benchmark-source.json (speil av datasettet). */
export interface DatasettPost {
  organisasjonsnummer: string;
  verksemdNamn: string;
  iktLoeysingNamn: string;
  iktLoeysingAdresse: string;
  publiseringsadresse: string;
  erklaeringsAdresse: string;
  sisteOppdatering: string;
  erklaeringErOppdatert: boolean;
  talBrot: number;
  talSamsvar: number;
  talIkkjeRelevant: number;
}

export interface Speil<T> {
  source: string;
  count: number;
  records: T[];
}

/**
 * Én rad i erklæringsregisteret,
 * docs/data/uustatus/erklaeringsregister.json.
 *
 * Registeret er langtidshukommelsen: datasettet fra uutilsynet inneholder bare
 * erklæringer som finnes nå, mens registeret husker alle vi noen gang har
 * sett. Uten det forsvinner navnet og bruddene i samme øyeblikk som en
 * erklæring slettes hos uustatus.no.
 */
export interface Registerpost {
  url: string;
  name: string;
  domain: string;
  /** Første gang vi så erklæringen (YYYY-MM-DD). */
  firstSeen: string;
  /** Siste gang den fantes i datasettet. Fryses når den forsvinner. */
  lastSeen: string;
  status: 'aktiv' | 'fjernet';
  /** Alle gangene den har forsvunnet. Tom liste = vi vet ikke når. */
  removedDates: string[];
  /** Tilstanden sist vi så den. Null når vi mangler historikk. */
  lastKnown: {
    updatedAt: string;
    totalNonConformities: number;
    nonConformities: string[];
  } | null;
}

export interface Register {
  oppdatert: string;
  antall: number;
  antallAktive: number;
  antallFjernet: number;
  erklaeringer: Registerpost[];
}

/** Én rad i endringsloggen, docs/data/uustatus/logs/changes.jsonl. */
export interface Endring {
  ts: string;
  detectedDate: string;
  url: string;
  /**
   * Tjenestenavnet slik det var da endringen ble registrert. Nødvendig fordi
   * erklæringer som er fjernet fra registeret ikke finnes i dagens datasett –
   * arkivet er da eneste sted navnet er bevart.
   */
  name?: string;
  domain: string;
  before_hash: string | null;
  after_hash: string | null;
  added: string[];
  removed: string[];
  changed: Record<string, unknown> | null;
  updatedDate: string;
}
