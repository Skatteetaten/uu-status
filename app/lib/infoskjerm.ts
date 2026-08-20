import { dagerTilFrist, erklaeringId } from './data';
import { kravNavn } from './wcag';
import type { Endring, Erklaering } from './typer';

/**
 * Innholdsutvalget til infoskjermen.
 *
 * Skjermen henger på kontoret og leses i forbifarten, dag etter dag. Da må
 * innholdet styres av ferskhet: en gladsak («3 brudd rettet!») som blir
 * hengende i månedsvis slutter å bety noe, og gjør at hele skjermen leses som
 * statisk. Hvert panel har derfor en regel for når det er relevant, og
 * spillelisten settes sammen på nytt av det som er relevant akkurat nå.
 *
 * All logikk ligger her, uten React, så reglene kan leses og endres på ett
 * sted – og datoene sendes inn, så funksjonene er deterministiske.
 */

/**
 * Vinduet for gladsaker, nye erklæringer og hendelseslista.
 *
 * Var 56 dager. Med 8 uker hadde «Ble kvitt alle brudd» én eneste rad i et
 * panel bygget for seks – ikke fordi det gikk dårlig, men fordi vinduet var
 * for smalt: over et halvår har 23 erklæringer gått til null.
 *
 * Panelet blir ikke statisk av det. Lista sorteres nyest først og kuttes til
 * det som får plass, så en ny retting skyver den eldste ut. Halvåret er en
 * ytre grense, ikke det som vises.
 */
export const FERSK_DAGER = 182;

/** Frister varsles fra 60 dager før. */
export const FRIST_VARSEL_DAGER = 60;

/** Hvor lenge hvert panel står før rotasjonen går videre. */
export const VISNINGSTID_MS = 15_000;

/** Hvor ofte datagrunnlaget hentes på nytt. Nattjobben leverer én gang i
 * døgnet, så et kvarter er mer enn tett nok – poenget er at skjermen aldri
 * skal trenge et menneske med F5. */
export const OPPDATERINGSINTERVALL_MS = 15 * 60_000;

export interface Kpi {
  erklaeringer: number;
  bruddTotalt: number;
  utenBrudd: number;
  utloepte: number;
}

export interface Stolpe {
  navn: string;
  brudd: number;
}

export interface Fristpost {
  navn: string;
  /** Dager til fristen. Negativt tall betyr utløpt. */
  dager: number;
}

export interface Rettelse {
  navn: string;
  foer: number;
  dato: string;
}

export interface Nypost {
  navn: string;
  brudd: number;
  dato: string;
}

export interface Kravpost {
  kode: string;
  navn: string;
  antall: number;
}

export type Panel =
  | { id: 'flest-brudd'; stolper: Stolpe[] }
  | { id: 'rettet-til-null'; rettelser: Rettelse[] }
  | { id: 'frister'; poster: Fristpost[] }
  | { id: 'krav-topp'; krav: Kravpost[] }
  | { id: 'nye-erklaeringer'; poster: Nypost[] };

export type Hendelsestype =
  | 'ny-erklaering'
  | 'brudd-rettet'
  | 'nye-brudd'
  | 'endret'
  | 'oppdatert'
  | 'fjernet';

export interface Hendelse {
  dato: string;
  navn: string;
  type: Hendelsestype;
  /** Kort delta-tekst, f.eks. «−2 brudd». Tom når det ikke er noe å tallfeste. */
  delta: string;
}

export interface Innhold {
  kpi: Kpi;
  paneler: Panel[];
  hendelser: Hendelse[];
  /** Datoen for siste nattkjøring som fant endringer. */
  sisteNattkjoering: string;
}

/** Samme regler som endringstype() i arkiv.tsx – de to må klassifisere likt,
 * ellers viser skjermen og arkivet ulik merkelapp på samme rad. */
function hendelsestype(e: Endring): Hendelsestype {
  if (e.changed && 'newEntry' in e.changed) return 'ny-erklaering';
  if (e.changed && 'removedEntry' in e.changed) return 'fjernet';
  if (e.removed.length && !e.added.length) return 'brudd-rettet';
  if (e.added.length && !e.removed.length) return 'nye-brudd';
  if (e.added.length && e.removed.length) return 'endret';
  return 'oppdatert';
}

/** Samme dato-regel som endretDato() i arkiv.tsx. */
function hendelsesdato(e: Endring): string {
  if (e.changed && 'removedEntry' in e.changed) {
    return e.detectedDate || e.ts.slice(0, 10);
  }
  return e.updatedDate || e.detectedDate || e.ts.slice(0, 10);
}

/** Bruddtallet før og etter, fra loggens changed-felt. */
function foerEtter(e: Endring): { foer: number; etter: number } | null {
  const t = e.changed?.['totalNonConformities'];
  if (!t || typeof t !== 'object') return null;
  const { before, after } = t as { before?: unknown; after?: unknown };
  return typeof before === 'number' && typeof after === 'number'
    ? { foer: before, etter: after }
    : null;
}

function dagerSiden(dato: string, naa: Date): number {
  const d = new Date(dato);
  if (Number.isNaN(d.getTime())) return Number.POSITIVE_INFINITY;
  return Math.floor((naa.getTime() - d.getTime()) / 86_400_000);
}

function navnFor(e: Endring): string {
  return e.name?.trim() || 'Ukjent erklæring';
}

export function byggInnhold(
  erklaeringer: Erklaering[],
  endringer: Endring[],
  naa: Date
): Innhold {
  const kpi: Kpi = {
    erklaeringer: erklaeringer.length,
    bruddTotalt: erklaeringer.reduce(
      (sum, e) => sum + (e.totalNonConformities || 0),
      0
    ),
    utenBrudd: erklaeringer.filter((e) => e.totalNonConformities === 0).length,
    utloepte: erklaeringer.filter((e) => {
      const d = dagerTilFrist(e, naa);
      return d !== null && d < 0;
    }).length,
  };

  const paneler: Panel[] = [];

  // Ryggraden: alltid med. Det er dette kollegene ba om å få fram.
  const stolper: Stolpe[] = [...erklaeringer]
    .filter((e) => e.totalNonConformities > 0)
    .sort(
      (a, b) =>
        b.totalNonConformities - a.totalNonConformities ||
        a.name.localeCompare(b.name, 'nb')
    )
    // Taket er et rimelighetstak, ikke en layoutgrense: infoskjerm.tsx måler
    // hvor mange rader det er plass til og trimmer videre. En høy skjerm får
    // dermed se flere enn en lav.
    .slice(0, 8)
    .map((e) => ({ navn: e.name, brudd: e.totalNonConformities }));
  if (stolper.length) {
    paneler.push({ id: 'flest-brudd', stolper });
  }

  // Gladsaken: erklæringer som gikk fra brudd til null innenfor vinduet, og
  // bare hvis de fortsatt står på null – en erklæring som fikk nye brudd
  // etterpå skal ikke feires. Loggens before/after gjør oppslaget eksakt.
  const staarPaaNull = new Set(
    erklaeringer
      .filter((e) => e.totalNonConformities === 0)
      .map((e) => erklaeringId(e.url))
  );
  const settRettet = new Set<string>();
  const rettelser: Rettelse[] = [];
  for (const e of [...endringer].reverse()) {
    const t = foerEtter(e);
    if (!t || t.etter !== 0 || t.foer <= 0) continue;
    if (e.changed && 'removedEntry' in e.changed) continue;
    if (dagerSiden(hendelsesdato(e), naa) > FERSK_DAGER) continue;
    const id = erklaeringId(e.url);
    if (!staarPaaNull.has(id) || settRettet.has(id)) continue;
    settRettet.add(id);
    rettelser.push({ navn: navnFor(e), foer: t.foer, dato: hendelsesdato(e) });
  }
  if (rettelser.length) {
    // Eksplisitt sortering på datoen kortet faktisk viser. Løkka over går
    // gjennom loggen baklengs, men det gir OPPDAGELSESrekkefølge, og kortet
    // viser erklæringens egen dato (updatedDate). De to spriker: uten dette
    // sto 17. aug. før 16. juni før 22. juni. Samme fallgruve som i arkivet.
    // Lik dato brytes på navn, så rekkefølgen ikke flytter seg mellom
    // nattkjøringene.
    rettelser.sort(
      (a, b) => b.dato.localeCompare(a.dato) || a.navn.localeCompare(b.navn, 'nb')
    );
    paneler.push({ id: 'rettet-til-null', rettelser: rettelser.slice(0, 8) });
  }

  // Frister: utløpte og de som nærmer seg. Panelet finnes bare når noe faktisk
  // haster – en evig tom «alt i orden»-liste er støy.
  const frister: Fristpost[] = erklaeringer
    .map((e) => ({ navn: e.name, dager: dagerTilFrist(e, naa) }))
    .filter((p): p is Fristpost => p.dager !== null && p.dager <= FRIST_VARSEL_DAGER)
    .sort((a, b) => a.dager - b.dager)
    .slice(0, 8);
  if (frister.length) {
    paneler.push({ id: 'frister', poster: frister });
  }

  // Kravene som brytes oftest, med navn – kodene alene sier ingenting på
  // avstand. Alltid med så lenge det finnes brudd.
  const perKrav = new Map<string, number>();
  for (const e of erklaeringer) {
    for (const kode of e.nonConformities ?? e.codes ?? []) {
      perKrav.set(kode, (perKrav.get(kode) ?? 0) + 1);
    }
  }
  const krav: Kravpost[] = [...perKrav]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 5)
    .map(([kode, antall]) => ({ kode, navn: kravNavn(kode), antall }));
  if (krav.length) {
    paneler.push({ id: 'krav-topp', krav });
  }

  // Nye erklæringer, samme 8-ukersregel som gladsakene.
  const nye: Nypost[] = endringer
    .filter(
      (e) =>
        e.changed &&
        'newEntry' in e.changed &&
        dagerSiden(hendelsesdato(e), naa) <= FERSK_DAGER
    )
    .map((e) => ({
      navn: navnFor(e),
      brudd: foerEtter(e)?.etter ?? e.added.length,
      dato: hendelsesdato(e),
    }))
    .sort((a, b) => b.dato.localeCompare(a.dato))
    .slice(0, 8);
  if (nye.length) {
    paneler.push({ id: 'nye-erklaeringer', poster: nye });
  }

  // Høyrespalten: de siste hendelsene, ferskest først. Datoene vises, så
  // gamle hendelser lyver ikke – men ligger alt langt tilbake, viser vi
  // heller få rader enn å fylle opp med fjorårets nytt.
  const hendelser: Hendelse[] = [...endringer]
    .sort((a, b) => hendelsesdato(b).localeCompare(hendelsesdato(a)))
    .filter((e) => dagerSiden(hendelsesdato(e), naa) <= FERSK_DAGER)
    .slice(0, 12)
    .map((e) => {
      const type = hendelsestype(e);
      // «–» framfor tom celle: kolonnen har fast bredde, og et hull i den ser
      // ut som manglende data heller enn som «ikke aktuelt». Gjelder fjernede
      // erklæringer og rene oppdateringer, som ikke har noe bruddtall å vise.
      let delta = '–';
      if (type === 'brudd-rettet') delta = `−${e.removed.length} brudd`;
      else if (type === 'nye-brudd') delta = `+${e.added.length} brudd`;
      else if (type === 'endret') {
        // Uten «brudd»: «+4 / −2 brudd» er den bredeste teksten i kolonnen og
        // ville krevd 7 rem, som er nesten to rem stjålet fra navnet i hver
        // eneste rad. Merkelappen «Endret» sier allerede hva tallene gjelder.
        delta = `+${e.added.length} / −${e.removed.length}`;
      } else if (type === 'ny-erklaering') {
        const t = foerEtter(e);
        delta = t ? `${t.etter} brudd` : '–';
      }
      return { dato: hendelsesdato(e), navn: navnFor(e), type, delta };
    });

  const sisteNattkjoering = endringer.reduce(
    (siste, e) => (e.detectedDate > siste ? e.detectedDate : siste),
    ''
  );

  return { kpi, paneler, hendelser, sisteNattkjoering };
}
