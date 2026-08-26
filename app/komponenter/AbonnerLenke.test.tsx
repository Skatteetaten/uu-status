import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { AbonnerLenke } from './AbonnerLenke';

describe('AbonnerLenke', () => {
  it('rendres ikke i DOM som standard', () => {
    // Tom streng betyr null fra komponenten: ikke noe skjult, tomt eller
    // deaktivert element, ingen plassholder – ingenting.
    expect(renderToStaticMarkup(<AbonnerLenke />)).toBe('');
  });

  it('rendres ikke når bryteren er på men adressen mangler', () => {
    expect(
      renderToStaticMarkup(
        <AbonnerLenke
          konfig={{ subscriptionsEnabled: true, subscriptionUrl: '' }}
        />
      )
    ).toBe('');
  });

  it('rendres ikke når adressen er ugyldig', () => {
    expect(
      renderToStaticMarkup(
        <AbonnerLenke
          konfig={{ subscriptionsEnabled: true, subscriptionUrl: 'tull' }}
        />
      )
    ).toBe('');
  });

  it('rendres som lenke med tilgjengelig navn når den aktiveres', () => {
    const markup = renderToStaticMarkup(
      <AbonnerLenke
        konfig={{
          subscriptionsEnabled: true,
          subscriptionUrl: 'https://example.sharepoint.com/skjema',
        }}
      />
    );
    // Semantisk en lenke (navigasjon til et annet nettsted), ikke en knapp.
    expect(markup).toContain('<a ');
    expect(markup).not.toContain('<button');
    expect(markup).toContain('href="https://example.sharepoint.com/skjema"');
    expect(markup).toContain('Abonner på varsler');
    // Samme fane: ikke noe dokumentert behov for target="_blank".
    expect(markup).not.toContain('target=');
  });
});
