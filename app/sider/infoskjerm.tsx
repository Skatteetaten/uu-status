import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement, RefObject } from 'react';
import { TopBannerExternal } from '@skatteetaten/ds-layout';
import {
  ArrowForwardIcon,
  CompletedIcon,
  ListAddIcon,
  TimersandIcon,
} from '@skatteetaten/ds-icons';

import '@skatteetaten/ds-core-designtokens/index.css';

import {
  byggInnhold,
  OPPDATERINGSINTERVALL_MS,
  VISNINGSTID_MS,
} from '../lib/infoskjerm';
import type { Hendelsestype, Innhold, Kpi, Panel } from '../lib/infoskjerm';
import { hentEndringer, hentErklaeringer, ANTALL_KRAV } from '../lib/data';
import { monter } from '../lib/monter';
import type { Endring, Erklaering } from '../lib/typer';

import felles from '../stiler/felles.module.scss';
import styles from './infoskjerm.module.scss';

/**
 * Infoskjerm-dashbordet. Egen, ulenket side (infoskjerm.html) laget for en
 * skjerm på veggen: stor skrift, ingen interaksjon, alt innhold synlig uten
 * rulling. Innholdet velges i lib/infoskjerm.ts etter ferskhet, så skjermen
 * bytter selv ut saker som har gått ut på dato.
 */

const DATO_FORMAT = new Intl.DateTimeFormat('nb-NO', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});

const KLOKKE_FORMAT = new Intl.DateTimeFormat('nb-NO', {
  hour: '2-digit',
  minute: '2-digit',
});

const KORT_DATO = new Intl.DateTimeFormat('nb-NO', {
  day: 'numeric',
  month: 'short',
});

function kortDato(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : KORT_DATO.format(d);
}

/** Merkelappene følger arkivfanens tekster og farger. */
const HENDELSE_TEKST: Record<Hendelsestype, string> = {
  'ny-erklaering': 'Ny erklæring',
  'brudd-rettet': 'Brudd rettet',
  'nye-brudd': 'Nye brudd',
  endret: 'Endret',
  oppdatert: 'Oppdatert',
  fjernet: 'Fjernet',
};

const PANEL_TITTEL: Record<Panel['id'], string> = {
  'flest-brudd': 'Flest brudd nå',
  'rettet-til-null': 'Rettet alle feil',
  frister: 'Frist for oppdatering',
  'krav-topp': 'Kravene vi bryter oftest',
  'nye-erklaeringer': 'Nye erklæringer',
};

/**
 * Ikon etter paneltittelen, for de panelene som har ett.
 *
 * «Completed» (fylt sirkel med hake) er designsystemets nærmeste markør for
 * noe som er i havn – det finnes hverken konfetti eller pokal, og i
 * forest-grønt leser den som en seier uten å bryte med etatens tone.
 *
 * «ListAdd» er en liste med pluss, altså ordrett det underteksten sier: lagt
 * til i registeret. Denim, samme farge som «Ny erklæring»-merket i
 * endringslista, så nye erklæringer har én farge på hele skjermen.
 *
 * «Timersand» er et timeglass – tid som renner ut, som er nettopp det
 * fristpanelet teller ned til. Valgt framfor CalendarClock, som er tre ganger
 * så kompleks i konturen og ville blitt grøtete på 29 piksler. Ochre, samme
 * familie som «Om N dager»-merkene i panelet.
 *
 * Alle tre bruker 100-tonen, så ikonene har lik tyngde ved siden av
 * overskriftene sine.
 *
 * aria-hidden: overskriften sier allerede hva panelet er, så ikonet er pynt.
 */
const PANEL_IKON: Partial<
  Record<Panel['id'], { Ikon: typeof CompletedIcon; farge: string }>
> = {
  'rettet-til-null': { Ikon: CompletedIcon, farge: styles.ikonForest },
  'nye-erklaeringer': { Ikon: ListAddIcon, farge: styles.ikonDenim },
  frister: { Ikon: TimersandIcon, farge: styles.ikonOchre },
};

function Panelikon({ id }: { id: Panel['id'] }): ReactElement | null {
  const oppslag = PANEL_IKON[id];
  if (!oppslag) return null;
  const { Ikon, farge } = oppslag;
  return (
    <span
      className={`${styles.paneltittelikon} ${farge}`}
      aria-hidden={true}
    >
      <Ikon size={'large'} />
    </span>
  );
}

/** Én linje under tittelen som forklarer utvalget. Skjermen henger på en
 * vegg – det finnes ingen ⓘ-knapp å trykke på og ingen å spørre. */
function panelUndertekst(panel: Panel, kpi: Kpi): string {
  switch (panel.id) {
    case 'flest-brudd':
      return `${kpi.erklaeringer - kpi.utenBrudd} av ${kpi.erklaeringer} erklæringer har registrerte brudd`;
    case 'rettet-til-null':
      return (
        'Erklæringer som har rettet alle sine brudd de siste 6 månedene'
      );
    case 'frister':
      return 'Erklæringer skal oppdateres minst én gang i året';
    case 'krav-topp':
      return 'Antall erklæringer med brudd på kravet';
    case 'nye-erklaeringer':
      return 'Lagt til i registeret de siste 6 månedene';
  }
}

/**
 * Hvor mange rader det er plass til i beholderen.
 *
 * Antallet sto tidligere som et tall i innholdsreglene, men riktig antall
 * avhenger av skjermhøyden, ikke av dataene: 7 rader var for mange på 1080,
 * og 6 var fortsatt for mange på en lavere flate. Her måles høyden på én rad
 * og deles på plassen som er igjen, så skjermen selv avgjør – og en høy skjerm
 * får se mer enn en lav.
 *
 * Målingen er stabil under trimming: radhøyden er fast, og beholderens høyde
 * er flex: 1 av panelet. Å fjerne rader endrer derfor ingen av de to
 * størrelsene, og resultatet kan ikke svinge fram og tilbake.
 */
function useRaderSomFaarPlass(
  ref: RefObject<HTMLDivElement | null>,
  panelId: string
): number | null {
  const [antall, setAntall] = useState<number | null>(null);

  useLayoutEffect(() => {
    const boks = ref.current;
    if (!boks) return;

    const maal = (): void => {
      const liste = boks.firstElementChild as HTMLElement | null;
      const rad = liste?.firstElementChild as HTMLElement | null;
      if (!liste || !rad) return;

      // rowGap er «normal» uten gap satt, og parseFloat gir da NaN.
      const gap = parseFloat(getComputedStyle(liste).rowGap) || 0;
      const radHoyde = rad.getBoundingClientRect().height + gap;
      if (radHoyde <= 0) return;

      // n rader opptar n·h + (n−1)·g, altså n·(h+g) − g.
      setAntall(Math.max(1, Math.floor((boks.clientHeight + gap) / radHoyde)));
    };

    maal();
    // Skjermen kan bytte oppløsning uten omlasting – en infoskjerm settes ofte
    // opp én gang og står i månedsvis.
    const obs = new ResizeObserver(maal);
    obs.observe(boks);
    return () => obs.disconnect();
  }, [ref, panelId]);

  return antall;
}

function Panelinnhold({
  panel,
  maks,
}: {
  panel: Panel;
  maks: number;
}): ReactElement {
  switch (panel.id) {
    case 'flest-brudd': {
      // Skalaen tas fra hele lista, ikke det viste utsnittet – vi kutter
      // nedenfra, så toppverdien er uansett med.
      const topp = panel.stolper[0]?.brudd || 1;
      return (
        <ol className={styles.stolper}>
          {panel.stolper.slice(0, maks).map((s) => (
            <li key={s.navn}>
              <span className={styles.stolpenavn}>{s.navn}</span>
              <span className={styles.stolpespor}>
                <span
                  className={styles.stolpefyll}
                  style={{ width: `${(s.brudd / topp) * 100}%` }}
                />
              </span>
              <span className={styles.stolpetall}>{s.brudd}</span>
            </li>
          ))}
        </ol>
      );
    }
    case 'rettet-til-null':
      // Kort framfor tabellrader: panelet har ofte få treff, og én tynn linje
      // med skillestrek i en stor flate leser som en glipp. Et kort med egen
      // flate holder seg selv oppe, og lista sentreres loddrett når den er
      // kort, så tomrommet fordeles i stedet for å samle seg under.
      return (
        <ul className={styles.gladsak}>
          {panel.rettelser.slice(0, maks).map((r) => (
            <li key={r.navn} className={styles.gladsakKort}>
              {/* Navnet brytes over inntil to linjer i stedet for å kuttes
                  med ellipse. To linjer ved siden av tallene rommer 100 tegn,
                  mot 66 på én – nok til det lengste navnet i lista. */}
              <span className={styles.gladsakNavn}>{r.navn}</span>
              {/* Pilen er designsystemets ikon, ikke tegnet «→». Glyfen
                  sitter på skriftens grunnlinje og fløt dårlig mellom to
                  ulike skriftstørrelser; ikonet sentreres mot tallene.

                  srOnly bærer meningen for opplesning, siden ikonet er
                  aria-hidden og «3 0» ellers ville blitt lest som to tall. */}
              <span className={styles.gladsakSprang}>
                <span className={styles.gladsakFoer}>{r.foer}</span>
                <span className={felles.srOnly}>{' brudd, redusert til '}</span>
                <span className={styles.gladsakPil} aria-hidden={true}>
                  <ArrowForwardIcon size={'small'} />
                </span>
                <strong className={styles.gladsakNull}>{'0'}</strong>
              </span>
              <span className={styles.gladsakDato}>{kortDato(r.dato)}</span>
            </li>
          ))}
        </ul>
      );
    case 'frister':
      return (
        <ul className={styles.rader}>
          {panel.poster.slice(0, maks).map((p) => (
            <li key={p.navn}>
              <span className={styles.radnavn}>{p.navn}</span>
              <span
                className={
                  p.dager < 0 ? styles.fristUtloept : styles.fristSnart
                }
              >
                {p.dager < 0
                  ? 'Utløpt'
                  : p.dager === 0
                    ? 'I dag'
                    : `Om ${p.dager} ${p.dager === 1 ? 'dag' : 'dager'}`}
              </span>
            </li>
          ))}
        </ul>
      );
    case 'krav-topp':
      return (
        <ol className={styles.rader}>
          {panel.krav.slice(0, maks).map((k) => (
            <li key={k.kode}>
              <span className={styles.kravkode}>{k.kode}</span>
              <span className={styles.radnavn}>{k.navn}</span>
              <span className={styles.kravtall}>
                {`${k.antall} ${k.antall === 1 ? 'erklæring' : 'erklæringer'}`}
              </span>
            </li>
          ))}
        </ol>
      );
    case 'nye-erklaeringer':
      return (
        <ul className={styles.rader}>
          {panel.poster.slice(0, maks).map((p) => (
            <li key={p.navn}>
              <span className={styles.radnavn}>{p.navn}</span>
              <span className={styles.raddato}>{kortDato(p.dato)}</span>
              <span
                className={p.brudd === 0 ? styles.nyUtenBrudd : styles.nyMedBrudd}
              >
                {`${p.brudd} brudd`}
              </span>
            </li>
          ))}
        </ul>
      );
  }
}

export function Infoskjerm(): ReactElement {
  const [erklaeringer, setErklaeringer] = useState<Erklaering[] | null>(null);
  const [endringer, setEndringer] = useState<Endring[]>([]);
  const [hentet, setHentet] = useState<Date | null>(null);
  const [feil, setFeil] = useState(false);
  const [klokke, setKlokke] = useState(() => new Date());
  const [panelIndeks, setPanelIndeks] = useState(0);
  const panelBoksRef = useRef<HTMLDivElement>(null);
  const hendelsesBoksRef = useRef<HTMLDivElement>(null);

  // Datagrunnlaget hentes ved oppstart og deretter med faste mellomrom.
  // Skjermen står uten tastatur: feiler en henting beholdes forrige innhold,
  // og neste forsøk kommer av seg selv.
  useEffect(() => {
    let aktiv = true;
    const last = (): void => {
      Promise.all([hentErklaeringer(), hentEndringer()])
        .then(([e, en]) => {
          if (!aktiv) return;
          setErklaeringer(e);
          setEndringer(en);
          setHentet(new Date());
          setFeil(false);
        })
        .catch(() => {
          if (aktiv) setFeil(true);
        });
    };
    last();
    const intervall = window.setInterval(last, OPPDATERINGSINTERVALL_MS);
    return () => {
      aktiv = false;
      window.clearInterval(intervall);
    };
  }, []);

  useEffect(() => {
    const t = window.setInterval(() => setKlokke(new Date()), 1000);
    return () => window.clearInterval(t);
  }, []);

  // Innholdet avhenger av dagens dato, ikke av klokkeslettet – memoen bindes
  // til datostrengen, så den ikke regnes om 86 400 ganger i døgnet.
  const dagStreng = klokke.toISOString().slice(0, 10);
  const innhold: Innhold | null = useMemo(
    () =>
      erklaeringer
        ? byggInnhold(erklaeringer, endringer, new Date(dagStreng))
        : null,
    [erklaeringer, endringer, dagStreng]
  );

  // ?panel=frister låser visningen til ett panel og stopper rotasjonen.
  // For den som rigger en skjerm og vil kontrollere ett bestemt panel – og
  // for feilsøk uten å vente på omløpet.
  const laastPanel = useMemo(
    () => new URLSearchParams(window.location.search).get('panel'),
    []
  );

  const antallPaneler = innhold?.paneler.length ?? 0;

  // Panelvalget må gjøres før den tidlige returen under: hookene som måler
  // radplass trenger panelets id, og hooks kan ikke kalles betinget.
  const laastIndeks =
    laastPanel && innhold
      ? innhold.paneler.findIndex((p) => p.id === laastPanel)
      : -1;
  const visIndeks =
    laastIndeks >= 0 ? laastIndeks : antallPaneler ? panelIndeks % antallPaneler : 0;
  const panel = innhold?.paneler[visIndeks];

  const maksPanelrader = useRaderSomFaarPlass(panelBoksRef, panel?.id ?? '');
  const maksHendelser = useRaderSomFaarPlass(hendelsesBoksRef, 'hendelser');

  useEffect(() => {
    if (antallPaneler < 2 || laastPanel) return;
    const t = window.setInterval(
      () => setPanelIndeks((i) => (i + 1) % antallPaneler),
      VISNINGSTID_MS
    );
    return () => window.clearInterval(t);
  }, [antallPaneler, laastPanel]);

  if (!innhold || !panel) {
    return (
      <div className={styles.laster}>
        {feil ? 'Får ikke hentet data – prøver igjen …' : 'Henter data …'}
      </div>
    );
  }

  const { kpi, paneler, hendelser, sisteNattkjoering } = innhold;

  return (
    <div className={styles.skjerm}>
      <TopBannerExternal skipLink={{ text: 'Hopp til hovedinnhold' }} />

      <header className={styles.topp}>
        <div>
          <h1 className={styles.tittel}>{'UU-status'}</h1>
          <p className={styles.undertittel}>
            {`Tilgjengelighet i Skatteetatens digitale løsninger · hver løsning vurderes mot ${ANTALL_KRAV} WCAG-krav`}
          </p>
        </div>
        <div className={styles.klokkeblokk}>
          <span className={styles.klokke}>{KLOKKE_FORMAT.format(klokke)}</span>
          <span className={styles.dato}>{DATO_FORMAT.format(klokke)}</span>
        </div>
      </header>

      <main id={'hovedinnhold'} className={styles.hoved}>
        <div className={styles.noekkeltall}>
          <div className={`${styles.kort} ${styles.denim}`}>
            <span className={styles.kortetikett}>{'Erklæringer'}</span>
            <span className={styles.kortverdi}>{kpi.erklaeringer}</span>
          </div>
          <div className={`${styles.kort} ${styles.burgundy}`}>
            <span className={styles.kortetikett}>{'Brudd totalt'}</span>
            <span className={styles.kortverdi}>{kpi.bruddTotalt}</span>
          </div>
          <div className={`${styles.kort} ${styles.forest}`}>
            <span className={styles.kortetikett}>{'Uten brudd'}</span>
            <span className={styles.kortverdi}>{kpi.utenBrudd}</span>
          </div>
          <div className={`${styles.kort} ${styles.ochre}`}>
            <span className={styles.kortetikett}>{'Med utløpt frist'}</span>
            <span className={styles.kortverdi}>{kpi.utloepte}</span>
          </div>
        </div>

        <div className={styles.innhold}>
          {/* key på panel-id: hele panelet byttes ut, så tone-inn-animasjonen
              og fremdriftslinjen starter på nytt for hvert panel. */}
          <section key={panel.id} className={styles.panel}>
            {/* Ved låst panel står rotasjonen stille: en fremdriftslinje som
                fyller seg og fryser ser ut som noe som har hengt seg. */}
            {antallPaneler > 1 && !laastPanel && (
              <span className={styles.fremdrift} />
            )}
            {/* Prikkene deler rad med tittelen, oppe til høyre: der er det
                alltid luft, siden tittel og undertekst holder seg til venstre.
                Nederst sto de i veien for siste rad i fulle lister. */}
            <div className={styles.panelhode}>
              <div>
                <h2 className={styles.paneltittel}>
                  {PANEL_TITTEL[panel.id]}
                  <Panelikon id={panel.id} />
                </h2>
                <p className={styles.panelunder}>{panelUndertekst(panel, kpi)}</p>
              </div>
              {antallPaneler > 1 && !laastPanel && (
                <span className={styles.prikker} aria-hidden={true}>
                  {paneler.map((p, i) => (
                    <span
                      key={p.id}
                      className={i === visIndeks ? styles.prikkAktiv : styles.prikk}
                    />
                  ))}
                </span>
              )}
            </div>
            {/* Egen boks rundt innholdet: den tar plassen som er igjen og
                klipper innenfor seg selv, aldri utenfor panelet. */}
            <div className={styles.panelinnhold} ref={panelBoksRef}>
              <Panelinnhold panel={panel} maks={maksPanelrader ?? 99} />
            </div>
          </section>

          <section className={styles.hendelser}>
            <h2 className={styles.paneltittel}>{'Siste endringer'}</h2>
            {hendelser.length === 0 ? (
              <p className={styles.stille}>
                {'Ingen endringer de siste 6 månedene.'}
              </p>
            ) : (
              <div className={styles.panelinnhold} ref={hendelsesBoksRef}>
                {/* Navnet først: det er det man leter etter når man skanner
                    lista. Datoen sist, dempet ytterst til høyre – samme plass
                    som tidsstempler har i e-post- og meldingslister. */}
                <ul className={styles.strom}>
                  {hendelser.slice(0, maksHendelser ?? 99).map((h, i) => (
                    <li key={`${h.dato}-${h.navn}-${i}`}>
                      <span className={styles.hendelsesnavn}>{h.navn}</span>
                      <span
                        className={`${styles.merke} ${styles[`merke_${h.type}`]}`}
                      >
                        {HENDELSE_TEKST[h.type]}
                      </span>
                      <span className={styles.hendelsesdelta}>{h.delta}</span>
                      <span className={styles.hendelsesdato}>
                        {kortDato(h.dato)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        </div>
      </main>

      <footer className={styles.bunn}>
        <span>
          {'Data: Uutilsynets åpne datasett · siste endring registrert '}
          {sisteNattkjoering ? kortDato(sisteNattkjoering) : '–'}
        </span>
        <span>
          {feil
            ? 'Får ikke hentet nye data – viser forrige'
            : hentet
              ? `Hentet ${KLOKKE_FORMAT.format(hentet)}`
              : ''}
        </span>
      </footer>
    </div>
  );
}

monter(<Infoskjerm />);
