import { useEffect, useId, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Link } from '@skatteetaten/ds-buttons';
import { Paragraph } from '@skatteetaten/ds-typography';

import type { Lenke } from '../lib/benchmark';

import styles from './Lenkeliste.module.scss';

interface LenkelisteProps {
  lenker: Lenke[];
  /** Hvor mange som vises før «+ N flere». */
  synligeFoerst?: number;
  tomTekst?: string;
}

/**
 * Løsningsnavnet er lenketeksten, ikke adressen.
 *
 * URL-en var lenketekst tidligere, og den er ubrukelig som sådan: for en
 * skjermleser blir «…/erklaringer/publisert/00318500-e9c5-48c0-9400-e06daf2407dd»
 * en lang bokstav- og tallrekke som ikke sier hvilken løsning det gjelder.
 * Datasettet har navnet i iktLoeysingNamn, så det finnes ingen grunn til å
 * vise adressen.
 */
function Lenkerad({ lenke }: { lenke: Lenke }): ReactElement {
  return (
    <li>
      <Link href={lenke.url} target={'_blank'} isExternal>
        {lenke.navn || lenke.url}
      </Link>
    </li>
  );
}

/**
 * Liste med eksterne lenker som viser de første få, og resten bak en knapp.
 * Samme oppførsel som den gamle benchmark-siden, der lister på 90+ erklæringer
 * ellers ville sprengt raden.
 */
export function Lenkeliste({
  lenker,
  synligeFoerst = 3,
  tomTekst = 'Ingen lenker tilgjengelig.',
}: LenkelisteProps): ReactElement {
  const [utvidet, setUtvidet] = useState(false);
  const id = useId();
  const restenRef = useRef<HTMLUListElement>(null);
  const nettoppUtvidet = useRef(false);

  /**
   * Fokus flyttes til første nye lenke når lista åpnes.
   *
   * Knappen ligger under lista den styrer, så det nye innholdet kommer FØR
   * knappen i dokumentet. Ble fokus stående på knappen, ville den som tabber
   * framover hoppet rett forbi alle de nye lenkene, og en skjermleserbruker
   * ville ikke fått vite hvor det nye begynner.
   *
   * Bare ved åpning. Ved lukking forsvinner innholdet, og da skal fokus bli
   * værende på knappen.
   */
  useEffect(() => {
    if (!utvidet || !nettoppUtvidet.current) return;
    nettoppUtvidet.current = false;
    restenRef.current?.querySelector('a')?.focus();
  }, [utvidet]);

  // Samme URL kan komme fra flere poster i datasettet.
  const unike = [...new Map(lenker.map((l) => [l.url, l])).values()];
  if (unike.length === 0) {
    return <Paragraph>{tomTekst}</Paragraph>;
  }

  const foerst = unike.slice(0, synligeFoerst);
  const resten = unike.slice(synligeFoerst);

  return (
    <>
      <ul className={styles.liste}>
        {foerst.map((l) => (
          <Lenkerad key={l.url} lenke={l} />
        ))}
      </ul>

      {resten.length > 0 && (
        <>
          {/* Lista ligger foran knappen, så den følger etter de tre første
              lenkene i leserekkefølgen i stedet for å dukke opp midt i. */}
          <ul
            ref={restenRef}
            id={id}
            className={styles.liste}
            hidden={!utvidet}
            aria-label={`Flere lenker, ${resten.length}`}
          >
            {resten.map((l) => (
              <Lenkerad key={l.url} lenke={l} />
            ))}
          </ul>
          <button
            type={'button'}
            className={styles.merKnapp}
            aria-expanded={utvidet}
            aria-controls={id}
            onClick={() => {
              nettoppUtvidet.current = !utvidet;
              setUtvidet((v) => !v);
            }}
          >
            {utvidet ? 'Vis færre' : `+ ${resten.length} flere`}
          </button>
        </>
      )}
    </>
  );
}
