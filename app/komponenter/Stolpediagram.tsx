import type { ReactElement } from 'react';

import felles from '../stiler/felles.module.scss';
import styles from './Stolpediagram.module.scss';

export interface Stolpe {
  merkelapp: string;
  verdi: number;
  /**
   * Merkelappen slik den skal LESES, når den skrevne formen ikke fungerer
   * i tale. «1–5» blir «1 til 5», «11+» blir «11 eller flere».
   */
  talt?: string;
}

interface StolpediagramProps {
  stolper: Stolpe[];
  /** Tilgjengelig navn på listen. */
  ariaLabel: string;
  /** Hva verdien teller, f.eks. «løsninger». Brukes i opplesningen. */
  enhet: string;
}

/**
 * Stolpediagram som semantisk HTML, ikke <canvas>.
 *
 * Den gamle siden brukte Chart.js. Canvas-diagrammer er utilgjengelige for
 * skjermlesere med mindre man bygger et parallelt tekstalternativ – dårlig på
 * en side som måler universell utforming.
 *
 * Hver rad finnes i to utgaver av de samme dataene: en visuell, som er
 * aria-hidden, og en setning for skjermleser. Uten dette ble raden lest som
 * «1.3.1 40» – to tall uten skilletegn eller kontekst, og enkelte skjermlesere
 * klemte dem sammen til «1.3.140». Begge utgavene bygges av samme verdier, så
 * de kan ikke komme ut av synk.
 */
export function Stolpediagram({
  stolper,
  ariaLabel,
  enhet,
}: StolpediagramProps): ReactElement {
  const maks = Math.max(1, ...stolper.map((s) => s.verdi));

  return (
    <ul className={styles.liste} aria-label={ariaLabel}>
      {stolper.map((s) => (
        <li key={s.merkelapp} className={styles.rad}>
          <span className={felles.srOnly}>
            {`${s.talt ?? s.merkelapp}: ${s.verdi} ${enhet}.`}
          </span>
          <span className={styles.visuell} aria-hidden={'true'}>
            <span className={styles.merkelapp}>{s.merkelapp}</span>
            <span className={styles.spor}>
              <span
                className={styles.fyll}
                style={{ width: `${Math.round((s.verdi / maks) * 100)}%` }}
              />
            </span>
            <span className={styles.verdi}>{s.verdi}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}
