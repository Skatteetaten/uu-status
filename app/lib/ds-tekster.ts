import { dsI18n } from '@skatteetaten/ds-core-utils';

/**
 * Overstyrer tekster i designsystemets egen i18next-instans.
 *
 * Importeres øverst i hver side, før React rendrer.
 *
 * Bakgrunn: når en tabellrad er ekspanderbar UTEN synlig knappetekst, har
 * designsystemet ingen `srOnly`-beholder å legge forklaringen i. Den havner
 * derfor i `<svg><title>`, som nettleseren viser som hover-tooltip på første
 * rad – synlig for alle, selv om teksten er ment for skjermleser.
 *
 * Vi tømmer nøkkelen framfor å skru på synlig knappetekst, siden kolonnen skal
 * være smal. Knappen mister ikke tilgjengelig navn av det: den beholder
 * «Mer informasjon» fra `tablerow.Expandable`, `aria-expanded` formidler åpen/
 * lukket, og `aria-describedby` peker på radens navn.
 *
 * Midlertidig. Fjernes hvis designsystemet skiller de to tekstene også i
 * ikon-modus.
 */
const OVERSTYRTE_TEKSTER: Record<string, Record<string, string>> = {
  ds_tables: {
    'tablerow.ExpandButtonScreenReaderText': '',
  },
};

export function overstyrDsTekster(): void {
  for (const [navnerom, nokler] of Object.entries(OVERSTYRTE_TEKSTER)) {
    dsI18n.addResourceBundle('nb_NO', navnerom, nokler, true, true);
  }
}
