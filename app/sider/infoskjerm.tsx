import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { TopBannerExternal } from '@skatteetaten/ds-layout';

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
  'rettet-til-null': 'Ble kvitt alle brudd',
  frister: 'Frist for oppdatering',
  'krav-topp': 'Kravene vi bryter oftest',
  'nye-erklaeringer': 'Nye erklæringer',
};

/** Én linje under tittelen som forklarer utvalget. Skjermen henger på en
 * vegg – det finnes ingen ⓘ-knapp å trykke på og ingen å spørre. */
function panelUndertekst(panel: Panel, kpi: Kpi): string {
  switch (panel.id) {
    case 'flest-brudd':
      return `${kpi.erklaeringer - kpi.utenBrudd} av ${kpi.erklaeringer} erklæringer har registrerte brudd`;
    case 'rettet-til-null':
      return 'Gikk fra brudd til null de siste 8 ukene';
    case 'frister':
      return 'Erklæringer skal oppdateres minst én gang i året';
    case 'krav-topp':
      return 'Antall erklæringer med brudd på kravet';
    case 'nye-erklaeringer':
      return 'Lagt til i registeret de siste 8 ukene';
  }
}

function Panelinnhold({ panel }: { panel: Panel }): ReactElement {
  switch (panel.id) {
    case 'flest-brudd': {
      const maks = panel.stolper[0]?.brudd || 1;
      return (
        <ol className={styles.stolper}>
          {panel.stolper.map((s) => (
            <li key={s.navn}>
              <span className={styles.stolpenavn}>{s.navn}</span>
              <span className={styles.stolpespor}>
                <span
                  className={styles.stolpefyll}
                  style={{ width: `${(s.brudd / maks) * 100}%` }}
                />
              </span>
              <span className={styles.stolpetall}>{s.brudd}</span>
            </li>
          ))}
        </ol>
      );
    }
    case 'rettet-til-null':
      return (
        <ul className={`${styles.rader} ${styles.gladsak}`}>
          {panel.rettelser.map((r) => (
            <li key={r.navn}>
              <span className={styles.radnavn}>{r.navn}</span>
              <span className={styles.raddato}>{kortDato(r.dato)}</span>
              <span className={styles.nullsprang}>
                {`${r.foer} → `}
                <strong>{'0'}</strong>
              </span>
            </li>
          ))}
        </ul>
      );
    case 'frister':
      return (
        <ul className={styles.rader}>
          {panel.poster.map((p) => (
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
          {panel.krav.map((k) => (
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
          {panel.poster.map((p) => (
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

  useEffect(() => {
    if (antallPaneler < 2 || laastPanel) return;
    const t = window.setInterval(
      () => setPanelIndeks((i) => (i + 1) % antallPaneler),
      VISNINGSTID_MS
    );
    return () => window.clearInterval(t);
  }, [antallPaneler, laastPanel]);

  if (!innhold) {
    return (
      <div className={styles.laster}>
        {feil ? 'Får ikke hentet data – prøver igjen …' : 'Henter data …'}
      </div>
    );
  }

  const { kpi, paneler, hendelser, sisteNattkjoering } = innhold;
  const laastIndeks = laastPanel
    ? paneler.findIndex((p) => p.id === laastPanel)
    : -1;
  const visIndeks = laastIndeks >= 0 ? laastIndeks : panelIndeks % paneler.length;
  const panel = paneler[visIndeks];

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
            <h2 className={styles.paneltittel}>{PANEL_TITTEL[panel.id]}</h2>
            <p className={styles.panelunder}>{panelUndertekst(panel, kpi)}</p>
            <Panelinnhold panel={panel} />
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
          </section>

          <section className={styles.hendelser}>
            <h2 className={styles.paneltittel}>{'Siste endringer'}</h2>
            {hendelser.length === 0 ? (
              <p className={styles.stille}>
                {'Ingen endringer de siste 8 ukene.'}
              </p>
            ) : (
              <ul className={styles.strom}>
                {hendelser.map((h, i) => (
                  <li key={`${h.dato}-${h.navn}-${i}`}>
                    <span className={styles.hendelsesdato}>
                      {kortDato(h.dato)}
                    </span>
                    <span
                      className={`${styles.merke} ${styles[`merke_${h.type}`]}`}
                    >
                      {HENDELSE_TEKST[h.type]}
                    </span>
                    <span className={styles.hendelsesnavn}>{h.navn}</span>
                    {h.delta && (
                      <span className={styles.hendelsesdelta}>{h.delta}</span>
                    )}
                  </li>
                ))}
              </ul>
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
