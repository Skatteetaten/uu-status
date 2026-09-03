import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import '@skatteetaten/ds-core-designtokens/index.css';

import { Noekkeltallrad } from '../komponenter/Noekkeltallrad';
import { hentErklaeringer } from '../lib/data';
import { monter } from '../lib/monter';
import { beregnNoekkeltall } from '../lib/noekkeltall';
import type { Noekkeltallsett } from '../lib/noekkeltall';

import styles from './noekkeltall.module.scss';

/**
 * Innbyggbar nøkkeltallsvisning. Egen, ulenket side (noekkeltall.html) som
 * viser de fire kortene fra statusfanen og ingenting annet, laget for
 * «Bygg inn»-webdelen på interne SharePoint-sider. Se README, «Innbygging».
 *
 * Tallene regnes av samme funksjon som statusfanen, så det som står på
 * SharePoint-siden er alltid det som står på hovedsiden. Dokumenttittelen i
 * noekkeltall.html gir rammen et navn dersom innbyggingskoden mangler
 * `title`.
 */
export function Noekkeltallside(): ReactElement {
  const [tall, setTall] = useState<Noekkeltallsett | null>(null);
  const [feil, setFeil] = useState<string | null>(null);

  useEffect(() => {
    hentErklaeringer()
      .then((erklaeringer) => setTall(beregnNoekkeltall(erklaeringer)))
      .catch((e: unknown) =>
        setFeil(e instanceof Error ? e.message : 'Ukjent feil ved henting.')
      );
  }, []);

  // Feil og lasting som ren tekst, ikke DS Alert: rammen er lav, og et
  // varselpanel med ikon og kant ville sprengt den. role="status" gjør at
  // en skjermleser får med seg at innholdet kom på plass.
  if (feil) {
    return (
      <p role={'status'} className={styles.melding}>
        {`Kunne ikke laste nøkkeltall: ${feil}`}
      </p>
    );
  }
  if (!tall) {
    return (
      <p role={'status'} className={styles.melding}>
        {'Laster nøkkeltall …'}
      </p>
    );
  }
  return <Noekkeltallrad tall={tall} />;
}

monter(<Noekkeltallside />);
