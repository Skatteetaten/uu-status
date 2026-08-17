import type { ReactElement, ReactNode } from 'react';
import { TopBannerExternal } from '@skatteetaten/ds-layout';
import { Heading, Paragraph } from '@skatteetaten/ds-typography';

import styles from './Sideramme.module.scss';

interface SiderammeProps {
  children: ReactNode;
}

/**
 * Sideskall: banner, så hovedinnhold.
 *
 * TopBannerExternal rendrer <header>. Ingenting kommer mellom den og <main>,
 * og <h1> står først inne i <main> – navigasjonen ligger som faner inne i
 * hovedinnholdet, ikke som løst innhold utenfor landemerkene.
 */
export function Sideramme({ children }: SiderammeProps): ReactElement {
  return (
    <>
      {/* Default-logoen brukes: å overstyre den krever logo, mobileLogo og alt. */}
      <TopBannerExternal skipLink={{ text: 'Hopp til hovedinnhold' }} />
      <main id={'hovedinnhold'} className={styles.innhold}>
        <Heading as={'h1'} level={1}>
          {'UU-status'}
        </Heading>
        {/* Gjelder alle tre fanene: samme datagrunnlag, samme oppdatering. */}
        <Paragraph hasSpacing>
          {'Oversikt over tilgjengelighetserklæringene til Skatteetatens ' +
            'digitale løsninger. Datene hentes fra Uutilsynets åpne datasett.'}
        </Paragraph>
        {children}
      </main>
    </>
  );
}
