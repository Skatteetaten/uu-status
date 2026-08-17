import type { ReactElement, ReactNode } from 'react';
import { Popover } from '@skatteetaten/ds-overlays';

import styles from './Infoboks.module.scss';

interface InfoboksProps {
  /**
   * Tilgjengelig navn på ikonknappen. Må si hva forklaringen gjelder – flere
   * knapper som alle heter «Info» er ubrukelige for en skjermleserbruker som
   * navigerer mellom dem.
   */
  tittel: string;
  children: ReactNode;
}

/**
 * Liten ⓘ-knapp som åpner en forklaring. Erstatter den gamle sidens
 * `data-tooltip`-attributter, som kun virket ved mus-hover og dermed var
 * utilgjengelige for tastatur og berøringsskjerm.
 */
export function Infoboks({ tittel, children }: InfoboksProps): ReactElement {
  return (
    <span className={styles.boks}>
      <Popover>
        <Popover.Trigger title={tittel} size={'extraSmall'} />
        <Popover.Content>{children}</Popover.Content>
      </Popover>
    </span>
  );
}
