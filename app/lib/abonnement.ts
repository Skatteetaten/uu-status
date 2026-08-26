/**
 * Funksjonsbryter for abonnementsinngangen.
 *
 * Inngangen skal lede til et SharePoint-skjema som ikke finnes ennå. Til det
 * gjør det, er bryteren av, og AbonnerLenke rendrer ingenting – ikke noe
 * skjult, tomt eller deaktivert element, ingenting i DOM i det hele tatt.
 *
 * Adressen ligger som egen konfigurasjonsverdi, med vilje adskilt fra
 * bryteren: en manglende eller ugyldig adresse skal også holde inngangen
 * borte, selv om noen skrur på bryteren for tidlig.
 */
export interface AbonnementKonfig {
  /** Skrur på inngangen. Standard er av – skal ikke aktiveres før skjemaet finnes. */
  subscriptionsEnabled: boolean;
  /** Full https-adresse til SharePoint-skjemaet. Tom til skjemaet finnes. */
  subscriptionUrl: string;
}

export const ABONNEMENT_KONFIG: AbonnementKonfig = {
  subscriptionsEnabled: false,
  subscriptionUrl: '',
};

/**
 * Adressen inngangen skal lenke til, eller null hvis inngangen ikke skal
 * vises. Null når bryteren er av, adressen mangler, ikke kan tolkes som URL,
 * eller ikke er https.
 */
export function abonnementAdresse(
  konfig: AbonnementKonfig = ABONNEMENT_KONFIG
): string | null {
  if (!konfig.subscriptionsEnabled) {
    return null;
  }
  try {
    const url = new URL(konfig.subscriptionUrl);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}
