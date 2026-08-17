import type { ReactElement } from 'react';

import styles from './Stolpediagram.module.scss';

export interface Stolpe {
  merkelapp: string;
  verdi: number;
}

interface StolpediagramProps {
  stolper: Stolpe[];
  /** Tilgjengelig navn på listen. */
  ariaLabel: string;
}

/**
 * Stolpediagram som semantisk HTML, ikke <canvas>.
 *
 * Den gamle siden brukte Chart.js. Canvas-diagrammer er utilgjengelige for
 * skjermlesere med mindre man bygger et parallelt tekstalternativ – dårlig på
 * en side som måler universell utforming. Her er hver stolpe et listeelement
 * med lesbar verdi, og bredden er ren CSS. Selve sporet er aria-hidden, siden
 * det ikke tilfører noe ut over tallet ved siden av.
 */
export function Stolpediagram({
  stolper,
  ariaLabel,
}: StolpediagramProps): ReactElement {
  const maks = Math.max(1, ...stolper.map((s) => s.verdi));

  return (
    <ul className={styles.liste} aria-label={ariaLabel}>
      {stolper.map((s) => (
        <li key={s.merkelapp} className={styles.rad}>
          <span className={styles.merkelapp}>{s.merkelapp}</span>
          <span className={styles.spor} aria-hidden={'true'}>
            <span
              className={styles.fyll}
              style={{ width: `${Math.round((s.verdi / maks) * 100)}%` }}
            />
          </span>
          <span className={styles.verdi}>{s.verdi}</span>
        </li>
      ))}
    </ul>
  );
}
