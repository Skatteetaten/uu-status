import type { ReactElement } from 'react';
import { ExternalSVGpath } from '@skatteetaten/ds-icons';
import { Tag } from '@skatteetaten/ds-status';

import { wcagLenke } from '../lib/wcag';
import styles from './Kravmerke.module.scss';

type Farge = 'burgundy' | 'forest';

interface KravmerkeProps {
  kode: string;
  /** burgundy for brudd, forest for krav som er rettet. */
  farge?: Farge;
}

/**
 * Et WCAG-krav som lenke til uutilsynets beskrivelse av kravet.
 *
 * Tag tar bare tekst som innhold, så lenken ligger utenpå.
 *
 * Det tilgjengelige navnet MÅ begynne med den synlige teksten (WCAG 2.5.3
 * Ledetekst i navn). Talestyring matcher på det brukeren ser, så «klikk 2.4.3»
 * må treffe. Et navn som «Les om WCAG-kravet 2.4.3 …» inneholder koden, men
 * begynner ikke med den.
 */
export function Kravmerke({ kode, farge = 'burgundy' }: KravmerkeProps): ReactElement {
  return (
    <a
      className={styles.lenke}
      href={wcagLenke(kode)}
      target={'_blank'}
      rel={'noopener noreferrer'}
      aria-label={`${kode}: kravinformasjon`}
    >
      <Tag color={farge} size={'small'} svgPath={ExternalSVGpath}>
        {kode}
      </Tag>
    </a>
  );
}
