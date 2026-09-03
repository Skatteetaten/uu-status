import type { ReactElement } from 'react';

import { Noekkeltall } from './Noekkeltall';
import type { Noekkeltallsett } from '../lib/noekkeltall';

import styles from './Noekkeltallrad.module.scss';

/**
 * De fire nøkkeltallkortene fra statusfanen, i samme rekkefølge og med
 * samme farger. Brukes av den innbyggbare siden noekkeltall.html
 * (SharePoint), som skal vise nøyaktig det hovedsiden viser – og ingenting
 * annet: ingen banner, overskrift eller lenker, siden rammen ligger på en
 * side som allerede har sin egen ramme.
 *
 * Egen komponent, ikke en del av sider/noekkeltall.tsx: sidemodulen
 * monterer seg selv ved import, og kan derfor ikke importeres i en test
 * uten DOM.
 */
export function Noekkeltallrad({
  tall,
}: {
  tall: Noekkeltallsett;
}): ReactElement {
  return (
    <div className={styles.noekkeltall}>
      <Noekkeltall verdi={tall.erklaeringer} tekst={'Erklæringer'} />
      <Noekkeltall
        verdi={tall.bruddTotalt}
        tekst={'Brudd totalt'}
        farge={'burgundy'}
      />
      <Noekkeltall
        verdi={tall.utenBrudd}
        tekst={'Uten brudd'}
        farge={'forest'}
      />
      <Noekkeltall
        verdi={tall.utloepteFrister}
        tekst={'Med utløpt frist'}
        farge={'ochre'}
      />
    </div>
  );
}
