import { describe, expect, it } from 'vitest';

import { ABONNEMENT_KONFIG, abonnementAdresse } from './abonnement';

describe('abonnementAdresse', () => {
  it('standardkonfigurasjonen har bryteren av', () => {
    // Produksjonsbygget bruker denne konstanten direkte. Er den false her,
    // er den false i bygget – det finnes ingen annen kilde til bryteren.
    expect(ABONNEMENT_KONFIG.subscriptionsEnabled).toBe(false);
    expect(ABONNEMENT_KONFIG.subscriptionUrl).toBe('');
  });

  it('gir null med standardkonfigurasjonen', () => {
    expect(abonnementAdresse()).toBeNull();
  });

  it('gir null når bryteren er av, selv med gyldig adresse', () => {
    expect(
      abonnementAdresse({
        subscriptionsEnabled: false,
        subscriptionUrl: 'https://example.sharepoint.com/skjema',
      })
    ).toBeNull();
  });

  it('gir null når bryteren er på men adressen mangler', () => {
    expect(
      abonnementAdresse({ subscriptionsEnabled: true, subscriptionUrl: '' })
    ).toBeNull();
  });

  it('gir null når adressen ikke er en URL', () => {
    expect(
      abonnementAdresse({
        subscriptionsEnabled: true,
        subscriptionUrl: 'ikke en adresse',
      })
    ).toBeNull();
  });

  it('gir null når adressen ikke er https', () => {
    expect(
      abonnementAdresse({
        subscriptionsEnabled: true,
        subscriptionUrl: 'http://example.sharepoint.com/skjema',
      })
    ).toBeNull();
  });

  it('gir adressen når bryteren er på og adressen er gyldig https', () => {
    expect(
      abonnementAdresse({
        subscriptionsEnabled: true,
        subscriptionUrl: 'https://example.sharepoint.com/skjema',
      })
    ).toBe('https://example.sharepoint.com/skjema');
  });
});
