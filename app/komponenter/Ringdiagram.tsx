import type { ReactElement } from 'react';

import styles from './Ringdiagram.module.scss';

export interface Ringsegment {
  merkelapp: string;
  verdi: number;
  /** CSS-farge, normalt en --palette-*-variabel fra designsystemet. */
  farge: string;
}

interface RingdiagramProps {
  segmenter: Ringsegment[];
  /** Tall i midten av ringen. */
  totalTekst: string;
  totalEtikett: string;
  ariaLabel: string;
}

const STOERRELSE = 200;
const TYKKELSE = 26;
const RADIUS = (STOERRELSE - TYKKELSE) / 2;
const OMKRETS = 2 * Math.PI * RADIUS;
// Liten luft mellom segmentene, så de leses som atskilte felt.
const MELLOMROM = 2;

/**
 * Ringdiagram tegnet som SVG.
 *
 * Designsystemet har ingen diagramkomponenter, så denne er egenskrevet. Den er
 * merket role="img" med en oppsummerende aria-label, og tegnforklaringen under
 * gjentar alle tall som tekst – fargen alene bærer ingen informasjon (WCAG 1.4.1).
 */
export function Ringdiagram({
  segmenter,
  totalTekst,
  totalEtikett,
  ariaLabel,
}: RingdiagramProps): ReactElement {
  const total = segmenter.reduce((s, x) => s + x.verdi, 0);
  let forskyvning = 0;

  return (
    <div className={styles.ramme}>
      <svg
        className={styles.ring}
        viewBox={`0 0 ${STOERRELSE} ${STOERRELSE}`}
        role={'img'}
        aria-label={ariaLabel}
      >
        <circle
          className={styles.spor}
          cx={STOERRELSE / 2}
          cy={STOERRELSE / 2}
          r={RADIUS}
          strokeWidth={TYKKELSE}
        />
        {total > 0 &&
          segmenter.map((s) => {
            const andel = s.verdi / total;
            const lengde = Math.max(0, andel * OMKRETS - MELLOMROM);
            const dash = `${lengde} ${OMKRETS - lengde}`;
            const offset = -forskyvning;
            forskyvning += andel * OMKRETS;
            if (s.verdi === 0) return null;
            return (
              <circle
                key={s.merkelapp}
                cx={STOERRELSE / 2}
                cy={STOERRELSE / 2}
                r={RADIUS}
                stroke={s.farge}
                strokeWidth={TYKKELSE}
                strokeDasharray={dash}
                strokeDashoffset={offset}
                fill={'none'}
              />
            );
          })}
        <text
          className={styles.senterTall}
          x={'50%'}
          y={'48%'}
          textAnchor={'middle'}
          dominantBaseline={'middle'}
        >
          {totalTekst}
        </text>
        <text
          className={styles.senterEtikett}
          x={'50%'}
          y={'63%'}
          textAnchor={'middle'}
          dominantBaseline={'middle'}
        >
          {totalEtikett}
        </text>
      </svg>

      <ul className={styles.tegnforklaring}>
        {segmenter.map((s) => {
          const andel = total > 0 ? Math.round((s.verdi / total) * 100) : 0;
          return (
            <li key={s.merkelapp} className={styles.rad}>
              <span
                className={styles.prikk}
                style={{ background: s.farge }}
                aria-hidden={'true'}
              />
              <span className={styles.merkelapp}>{s.merkelapp}</span>
              <span className={styles.verdi}>{s.verdi}</span>
              <span className={styles.andel}>{`${andel} %`}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
