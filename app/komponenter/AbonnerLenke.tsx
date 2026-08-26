import type { ReactElement } from 'react';
import { Button } from '@skatteetaten/ds-buttons';

import {
  ABONNEMENT_KONFIG,
  abonnementAdresse,
  type AbonnementKonfig,
} from '../lib/abonnement';

interface AbonnerLenkeProps {
  /** Overstyres bare i tester. Produksjon bruker ABONNEMENT_KONFIG. */
  konfig?: AbonnementKonfig;
}

/**
 * Inngangen til abonnement på varsler om erklæringsendringer.
 *
 * Navigasjon til et annet nettsted (SharePoint-skjemaet), derfor semantisk en
 * lenke – designsystemets Button med href rendrer <a> stylet som knapp, med
 * synlig fokus og vanlig tastaturbetjening. isExternal viser ikonet for
 * ekstern tjeneste. Åpnes i samme fane; det finnes ikke noe dokumentert behov
 * for target="_blank".
 *
 * Rendrer null – ingenting i DOM – med mindre funksjonsbryteren er på OG
 * adressen er en gyldig https-URL. Se app/lib/abonnement.ts.
 */
export function AbonnerLenke({
  konfig = ABONNEMENT_KONFIG,
}: AbonnerLenkeProps): ReactElement | null {
  const adresse = abonnementAdresse(konfig);
  if (adresse === null) {
    return null;
  }
  return (
    <Button href={adresse} variant={'secondary'} isExternal>
      {'Abonner på varsler'}
    </Button>
  );
}
