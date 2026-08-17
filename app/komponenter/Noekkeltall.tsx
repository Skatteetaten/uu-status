import type { ReactElement, ReactNode } from 'react';

import { Infoboks } from './Infoboks';
import styles from './Noekkeltall.module.scss';

/**
 * Fargene er rene stemningsmarkører. De må aldri være eneste bærer av
 * informasjon (WCAG 1.4.1) – etiketten sier hva tallet er.
 */
export type Noekkeltallfarge = 'denim' | 'burgundy' | 'forest' | 'ochre';

interface NoekkeltallProps {
  /** Tallet som vises stort. Kan være formatert, f.eks. «5,4 %» eller «2 av 22». */
  verdi: ReactNode;
  /** Kort forklaring over tallet. */
  tekst: string;
  /** Valgfri forklaring bak en ⓘ-knapp. */
  info?: ReactNode;
  /** Tilgjengelig navn på ⓘ-knappen. Påkrevd når info er satt. */
  infoTittel?: string;
  /** Farge på strek og bakgrunn. Standard er denim. */
  farge?: Noekkeltallfarge;
}

/**
 * Nøkkeltallkort. Brukes i alle tre fanene, så tallene ser like ut uansett
 * hvor man er – de var tidligere stylet hver for seg med ulik farge og
 * ulik rekkefølge på etikett og tall.
 */
export function Noekkeltall({
  verdi,
  tekst,
  info,
  infoTittel,
  farge = 'denim',
}: NoekkeltallProps): ReactElement {
  return (
    <div className={`${styles.kort} ${styles[farge]}`}>
      <span className={styles.etikett}>
        {tekst}
        {info && infoTittel && <Infoboks tittel={infoTittel}>{info}</Infoboks>}
      </span>
      <span className={styles.verdi}>{verdi}</span>
    </div>
  );
}
