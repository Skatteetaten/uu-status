import type {
  DatasettPost,
  Endring,
  Erklaering,
  Register,
  Registerpost,
  Speil,
} from './typer';

/** Alle stier er relative, så appen fungerer både på / og på /uu-status/. */
const DETALJER = 'uu-status-details.json';
const SPEIL = 'data/uustatus/benchmark-source.json';
const ENDRINGER = 'data/uustatus/logs/changes.jsonl';
const REGISTER = 'data/uustatus/erklaeringsregister.json';

export const SKATTEETATEN_ORG = '974761076';

/** Totalt antall WCAG-krav en erklæring vurderes mot. */
export const ANTALL_KRAV = 48;

async function hentJson<T>(sti: string): Promise<T> {
  // NB: ikke send Accept: application/json til data.uutilsynet.no – API-et
  // svarer 406 på den. Her gjelder det lokale filer, men vi holder samme
  // enkle form overalt for å unngå at headeren snik-innføres igjen.
  const res = await fetch(sti, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Kunne ikke hente ${sti} (HTTP ${res.status})`);
  }
  return res.json() as Promise<T>;
}

export async function hentErklaeringer(): Promise<Erklaering[]> {
  return hentJson<Erklaering[]>(DETALJER);
}

/** Hele datasettet – alle virksomheter. Brukes av benchmark-siden. */
export async function hentDatasett(): Promise<DatasettPost[]> {
  const speil = await hentJson<Speil<DatasettPost>>(SPEIL);
  return speil.records;
}

export async function hentEndringer(): Promise<Endring[]> {
  const res = await fetch(ENDRINGER, { cache: 'no-store' });
  if (!res.ok) {
    throw new Error(`Kunne ikke hente ${ENDRINGER} (HTTP ${res.status})`);
  }
  const tekst = await res.text();
  return tekst
    .split('\n')
    .filter((linje) => linje.trim())
    .map((linje) => JSON.parse(linje) as Endring);
}

/**
 * Stabil identitet for én erklæring: UUID-en i adressen, ikke hele URL-en.
 *
 * Samme erklæring ligger på både https://uustatus.no/nb/… og /nn/ hos
 * uutilsynet. Brukes URL-en som nøkkel, ser et språkbytte ut som at én
 * erklæring forsvant og en ny kom til. Samme regel som erklaering_id() i
 * build_uu_archive.py – de to må være enige for at oppslagene skal treffe.
 */
const UUID_MOENSTER =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

export function erklaeringId(url: string): string {
  const treff = UUID_MOENSTER.exec(url ?? '');
  return treff ? treff[0].toLowerCase() : (url ?? '');
}

export const TOMT_REGISTER: Register = {
  oppdatert: '',
  antall: 0,
  antallAktive: 0,
  antallFjernet: 0,
  erklaeringer: [],
};

/**
 * Registeret er tilleggsinformasjon, ikke selve datagrunnlaget. Mangler fila –
 * for eksempel før nattjobben har kjørt første gang – skal arkivet fortsatt
 * vises, med navnene som ligger på endringsradene.
 */
export async function hentRegister(): Promise<Register> {
  try {
    return await hentJson<Register>(REGISTER);
  } catch (feil) {
    console.warn(`Fant ikke ${REGISTER}, viser arkivet uten register.`, feil);
    return TOMT_REGISTER;
  }
}

/** Registeret slått opp på erklæringens UUID. */
export function registerKart(reg: Register): Map<string, Registerpost> {
  return new Map(
    (reg.erklaeringer ?? []).map((p) => [erklaeringId(p.url), p])
  );
}

/**
 * Fristen: en erklæring skal oppdateres minst én gang i året. Samme regel som
 * UU-portalen bruker, så tallene på de to flatene ikke spriker.
 *
 * Selve beregningen bor i enrich_uu_details.py, som skriver `deadline` til
 * details.json – da viser nettsiden, abonnementskatalogen og feedene garantert
 * samme dato. Den lokale utregningen under er bare fallback for datasett
 * generert før feltet fantes.
 */
export function fristDato(e: Erklaering): Date | null {
  if (e.deadline) {
    const frist = new Date(e.deadline);
    if (!Number.isNaN(frist.getTime())) return frist;
  }
  const dato = e.updatedAt || e.opprettet;
  if (!dato) return null;
  const frist = new Date(dato);
  if (Number.isNaN(frist.getTime())) return null;
  frist.setFullYear(frist.getFullYear() + 1);
  return frist;
}

export function erFristUtloept(e: Erklaering, naa: Date = new Date()): boolean {
  const frist = fristDato(e);
  return frist !== null && frist.getTime() < naa.getTime();
}

/** Antall dager til fristen. Negativt tall betyr at den er passert. */
export function dagerTilFrist(e: Erklaering, naa: Date = new Date()): number | null {
  const frist = fristDato(e);
  if (!frist) return null;
  return Math.round((frist.getTime() - naa.getTime()) / 86_400_000);
}

/** Teller hvor mange erklæringer som har brudd på hvert WCAG-krav. */
export function tellPerKrav(erklaeringer: Erklaering[]): Map<string, number> {
  const teller = new Map<string, number>();
  for (const e of erklaeringer) {
    for (const kode of e.nonConformities ?? e.codes ?? []) {
      teller.set(kode, (teller.get(kode) ?? 0) + 1);
    }
  }
  return new Map([...teller].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])));
}
