import { erFristUtloept } from './data';
import type { Erklaering } from './typer';

/**
 * De fire nøkkeltallene øverst på statusoversikten.
 *
 * Regnes her, ikke i sidekomponenten, fordi tallene vises to steder: i
 * statusfanen på hovedsiden og på den innbyggbare siden noekkeltall.html
 * (SharePoint). Reglene er de samme som statusfanen bruker, og fristregelen
 * er den felles erFristUtloept() i lib/data.ts – så «Med utløpt frist» er
 * samme tall som tabellens «Frist utløpt»-merker og UU-portalens forside.
 */
export interface Noekkeltallsett {
  /** Antall publiserte erklæringer. */
  erklaeringer: number;
  /** Sum av WCAG-brudd over alle erklæringene. */
  bruddTotalt: number;
  /** Erklæringer uten et eneste registrert brudd. */
  utenBrudd: number;
  /** Erklæringer der årsfristen for oppdatering er passert. */
  utloepteFrister: number;
}

export function beregnNoekkeltall(
  erklaeringer: Erklaering[],
  naa: Date = new Date()
): Noekkeltallsett {
  return {
    erklaeringer: erklaeringer.length,
    bruddTotalt: erklaeringer.reduce(
      (sum, e) => sum + e.totalNonConformities,
      0
    ),
    utenBrudd: erklaeringer.filter((e) => e.totalNonConformities === 0)
      .length,
    utloepteFrister: erklaeringer.filter((e) => erFristUtloept(e, naa))
      .length,
  };
}
