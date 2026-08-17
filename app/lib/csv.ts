import { ANTALL_KRAV } from './data';
import type { Erklaering } from './typer';

/** Samme kolonner og skilletegn som den gamle siden lastet ned. */
const KOLONNER = [
  'Navn',
  'Url',
  'Brudd',
  'KravTotalt',
  'SistOppdatert',
  'Opprettet',
] as const;

function celle(verdi: string | number): string {
  // Semikolon er skilletegn; bytt det ut framfor å sitere hele feltet, slik
  // den gamle eksporten gjorde.
  return String(verdi ?? '').replace(/;/g, ',');
}

export function tilCsv(erklaeringer: Erklaering[]): string {
  const rader = erklaeringer.map((e) =>
    [
      celle(e.name),
      celle(e.url),
      celle(e.totalNonConformities),
      celle(ANTALL_KRAV),
      celle(e.updatedAt),
      celle(e.opprettet),
    ].join(';')
  );
  return [KOLONNER.join(';'), ...rader].join('\r\n');
}

export function lastNedCsv(innhold: string, filnavn: string): void {
  const blob = new Blob([innhold], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const lenke = document.createElement('a');
  lenke.href = url;
  lenke.download = filnavn;
  document.body.appendChild(lenke);
  lenke.click();
  lenke.remove();
  URL.revokeObjectURL(url);
}
