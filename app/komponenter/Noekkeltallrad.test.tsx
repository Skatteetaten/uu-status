import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { Noekkeltallrad } from './Noekkeltallrad';

const TALL = {
  erklaeringer: 119,
  bruddTotalt: 310,
  utenBrudd: 58,
  utloepteFrister: 1,
};

describe('Noekkeltallrad', () => {
  const markup = renderToStaticMarkup(<Noekkeltallrad tall={TALL} />);

  it('viser de fire kortene i samme rekkefølge som statusfanen', () => {
    const rekkefolge = ['Erklæringer', 'Brudd totalt', 'Uten brudd', 'Med utløpt frist']
      .map((etikett) => markup.indexOf(etikett));
    expect(rekkefolge.every((i) => i >= 0)).toBe(true);
    expect([...rekkefolge].sort((a, b) => a - b)).toEqual(rekkefolge);
  });

  it('setter hvert tall rett etter sin etikett', () => {
    expect(markup).toMatch(/Erklæringer.*?>119</);
    expect(markup).toMatch(/Brudd totalt.*?>310</);
    expect(markup).toMatch(/Uten brudd.*?>58</);
    expect(markup).toMatch(/Med utløpt frist.*?>1</);
  });

  it('har ingen egen sideramme – bare kortene', () => {
    // Siden bygges inn i en iframe på en side som allerede har banner og
    // overskrift. Et sidehode inne i rammen ville blitt lest opp som enda
    // et sidehode, og fylt høyde den som redigerer SharePoint-siden må
    // sette av.
    expect(markup).not.toContain('<header');
    expect(markup).not.toContain('<h1');
    expect(markup).not.toContain('<main');
    expect(markup).not.toContain('<a ');
  });
});
