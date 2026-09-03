import { describe, expect, it } from 'vitest';

import { beregnNoekkeltall } from './noekkeltall';
import type { Erklaering } from './typer';

function erklaering(overstyr: Partial<Erklaering>): Erklaering {
  return {
    url: 'https://uustatus.no/nb/erklaringer/publiserte/00000000-0000-0000-0000-000000000000',
    name: 'Tjeneste',
    codes: [],
    nonConformities: [],
    totalNonConformities: 0,
    updatedAt: '2026-06-01',
    opprettet: '2025-06-01',
    deadline: '2027-06-01',
    title: 'Tjeneste',
    domain: 'skatteetaten.no',
    samsvarsstatus: 'I samsvar',
    ...overstyr,
  };
}

const NAA = new Date('2026-09-03T12:00:00Z');

describe('beregnNoekkeltall', () => {
  it('gir null over hele linja for et tomt datasett', () => {
    expect(beregnNoekkeltall([], NAA)).toEqual({
      erklaeringer: 0,
      bruddTotalt: 0,
      utenBrudd: 0,
      utloepteFrister: 0,
    });
  });

  it('teller erklæringer, summerer brudd og teller de uten brudd', () => {
    const tall = beregnNoekkeltall(
      [
        erklaering({ totalNonConformities: 0 }),
        erklaering({ totalNonConformities: 3, nonConformities: ['1.1.1', '1.3.1', '2.4.7'] }),
        erklaering({ totalNonConformities: 7 }),
      ],
      NAA
    );
    expect(tall.erklaeringer).toBe(3);
    expect(tall.bruddTotalt).toBe(10);
    expect(tall.utenBrudd).toBe(1);
  });

  it('regner utløpt frist etter deadline-feltet, som statusfanen', () => {
    const tall = beregnNoekkeltall(
      [
        // Passert i går.
        erklaering({ deadline: '2026-09-02' }),
        // Går ut i morgen – ikke utløpt.
        erklaering({ deadline: '2026-09-04' }),
        // Uten deadline: fallback er updatedAt + ett år, her passert.
        erklaering({ deadline: null, updatedAt: '2025-01-15' }),
        // Uten deadline, oppdatert nylig – ikke utløpt.
        erklaering({ deadline: null, updatedAt: '2026-08-01' }),
      ],
      NAA
    );
    expect(tall.utloepteFrister).toBe(2);
  });

  it('bruker samme «nå» for alle erklæringene', () => {
    const liste = [erklaering({ deadline: '2026-09-02' })];
    // Én dag før fristen er den ikke utløpt; dagen etter er den det.
    expect(
      beregnNoekkeltall(liste, new Date('2026-09-01T12:00:00Z')).utloepteFrister
    ).toBe(0);
    expect(
      beregnNoekkeltall(liste, new Date('2026-09-03T12:00:00Z')).utloepteFrister
    ).toBe(1);
  });
});
