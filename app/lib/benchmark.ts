import { ANTALL_KRAV } from './data';
import { SAMMENLIGNINGER } from './sammenligninger';
import type { Sammenligning } from './sammenligninger';
import type { DatasettPost } from './typer';

/**
 * Én lenke i detaljvisningen. Navnet er løsningens navn slik uutilsynet har
 * det (iktLoeysingNamn) – uten det sto det bare rå URL-er med UUID-er i lista.
 */
export interface Lenke {
  url: string;
  navn: string;
}

export interface Rad {
  key: string;
  navn: string;
  /** Antall unike erklæringer for virksomheten. */
  erklaeringer: number;
  brudd: number;
  /** Snitt brudd per erklæring. */
  snitt: number;
  /** brudd / (erklæringer × 48). Null når virksomheten ikke har erklæringer. */
  bruddandel: number | null;
  sistOppdatert: string | null;
  erKommunal: boolean;
  /** Erklæringene som inngår, for detaljvisningen. */
  erklaeringsUrler: Lenke[];
}

/**
 * Små bokstaver, uten diakritikk, kun bokstaver og tall igjen.
 *
 * æ/ø/å må translittereres FØR strimlingen. NFD dekomponerer ikke ø og å til
 * grunnbokstav pluss aksent slik den gjør for f.eks. é, så uten dette leddet
 * ville «høgesterett» blitt til «h gesterett» og aliaset aldri truffet.
 */
function normaliser(tekst: string): string {
  return tekst
    .toLowerCase()
    .replace(/æ/g, 'ae')
    .replace(/ø/g, 'o')
    .replace(/å/g, 'a')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Ettordsalias må treffe et helt ord, ellers ville «domstol» slått inn på
 * hvilken som helst tekst som inneholder bokstavfølgen.
 */
function harAlias(normalisertNavn: string, alias: string): boolean {
  const a = normaliser(alias);
  if (!a) return false;
  if (a.includes(' ')) return normalisertNavn.includes(a);
  return normalisertNavn.split(' ').includes(a);
}

function orgnrTillatt(mål: Sammenligning, orgnr: string): boolean {
  if (!mål.orgNumbers || mål.orgNumbers.length === 0) return true;
  return mål.orgNumbers.includes(String(orgnr).trim());
}

export function finnSammenligning(post: DatasettPost): Sammenligning | null {
  const navn = normaliser(post.verksemdNamn || '');
  const urler = [
    post.iktLoeysingAdresse,
    post.publiseringsadresse,
    post.erklaeringsAdresse,
  ]
    .filter(Boolean)
    .map((u) => normaliser(u))
    .join(' ');

  for (const mål of SAMMENLIGNINGER) {
    // orgNumbers er en tillatelsesliste, ikke et treffkriterium: posten må i
    // tillegg matche på URL eller alias. Det er bevisst — Regjeringen.no deler
    // organisasjonsnummer med departementer som har egne nettsteder, og skal
    // bare telle erklæringer som faktisk hører til regjeringen.no.
    if (!orgnrTillatt(mål, post.organisasjonsnummer)) continue;
    if (mål.urlIncludes?.some((n) => urler.includes(normaliser(n)))) return mål;
    if (mål.aliases?.some((a) => harAlias(navn, a))) return mål;
  }
  return null;
}

/**
 * Sorterer på navn, med URL som reserve for de som mangler navn i datasettet.
 * localeCompare med nb gir riktig plass til æ, ø og å.
 */
function tilLenker(kart: Map<string, string>): Lenke[] {
  return [...kart]
    .map(([url, navn]) => ({ url, navn }))
    .sort((a, b) =>
      (a.navn || a.url).localeCompare(b.navn || b.url, 'nb')
    );
}

export function byggRader(poster: DatasettPost[]): Rad[] {
  // Map, ikke Set: nøkkelen er fortsatt URL-en, så tellingen er nøyaktig den
  // samme som før – verdien bærer bare med seg navnet til detaljvisningen.
  const samlet = new Map<
    string,
    {
      mål: Sammenligning;
      erklaeringer: Map<string, string>;
      brudd: number;
      sist: string | null;
    }
  >();
  for (const mål of SAMMENLIGNINGER) {
    samlet.set(mål.key, {
      mål,
      erklaeringer: new Map(),
      brudd: 0,
      sist: null,
    });
  }

  for (const post of poster) {
    const mål = finnSammenligning(post);
    if (!mål) continue;
    const rad = samlet.get(mål.key);
    if (!rad) continue;

    // Telleenheten er unike ERKLÆRINGSadresser, ikke løsningsadresser – samme
    // som den gamle sidens declarationUrls. To erklæringer for samme løsning
    // teller altså som to, og nevneren i bruddandelen følger den samme tellingen.
    //
    // Detaljvisningen listet en stund også løsningsadressene, med eget antall.
    // Det tallet var systematisk for lavt: apper har ingen nettadresse, så
    // iktLoeysingAdresse er tom i 709 poster og faller tilbake på
    // publiseringsadresse. Drammens fem Vigilo-app-erklæringer havnet dermed
    // alle på drammen.kommune.no/tilgjengelighet/ og ble til én «løsning».
    // På landsbasis forsvant 693 erklæringer i den tellingen, og i 264 av 353
    // sammenslåinger hadde de sammenslåtte erklæringene ulike løsningsnavn.
    // Løsningslista er derfor fjernet – ikke flytt tellingen hit.
    const navn = (post.iktLoeysingNamn || '').trim();

    const noekkel =
      post.erklaeringsAdresse?.trim() || post.publiseringsadresse?.trim();
    // Første navn vinner. Samme URL kan opptre flere ganger i datasettet, og
    // et tomt navn i en senere post skal ikke overskrive et vi allerede har.
    if (noekkel && !rad.erklaeringer.get(noekkel)) {
      rad.erklaeringer.set(noekkel, navn);
    }

    rad.brudd += Number(post.talBrot) || 0;

    const oppdatert = (post.sisteOppdatering || '').slice(0, 10);
    if (oppdatert && (!rad.sist || oppdatert > rad.sist)) rad.sist = oppdatert;
  }

  return [...samlet.values()]
    .map(({ mål, erklaeringer, brudd, sist }) => {
      const antall = erklaeringer.size;
      return {
        key: mål.key,
        navn: mål.name,
        erklaeringer: antall,
        brudd,
        snitt: antall ? brudd / antall : 0,
        bruddandel: antall ? brudd / (antall * ANTALL_KRAV) : null,
        sistOppdatert: sist,
        erKommunal: /kommune|fylkeskommune/i.test(mål.name),
        erklaeringsUrler: tilLenker(erklaeringer),
      };
    })
    .filter((r) => r.erklaeringer > 0)
    .sort((a, b) => (a.bruddandel ?? 1) - (b.bruddandel ?? 1));
}

export interface Noekkeltall {
  vaarAndel: number | null;
  snittAndre: number | null;
  plassering: number | null;
  antallSammenlignet: number;
}

/**
 * Snittet hos andre er et uvektet gjennomsnitt av virksomhetenes bruddandeler,
 * ikke totale brudd delt på totale krav. Samme definisjon som den gamle siden,
 * så tallene ikke endrer seg ved omleggingen.
 */
export function beregnNoekkeltall(rader: Rad[]): Noekkeltall {
  const oss = rader.find((r) => r.key === 'skatteetaten');
  const andre = rader.filter((r) => r.key !== 'skatteetaten' && r.bruddandel !== null);

  const snittAndre = andre.length
    ? andre.reduce((s, r) => s + (r.bruddandel ?? 0), 0) / andre.length
    : null;

  return {
    vaarAndel: oss?.bruddandel ?? null,
    snittAndre,
    plassering: oss ? rader.findIndex((r) => r.key === oss.key) + 1 : null,
    antallSammenlignet: rader.length,
  };
}
