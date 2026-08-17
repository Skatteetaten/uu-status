import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { InlineButton, Link } from '@skatteetaten/ds-buttons';
import { OpenClose } from '@skatteetaten/ds-collections';
import { Select, SearchField } from '@skatteetaten/ds-forms';
import { UndoSVGpath } from '@skatteetaten/ds-icons';
import { Pagination } from '@skatteetaten/ds-navigation';
import { Alert, Tag } from '@skatteetaten/ds-status';
import { Table } from '@skatteetaten/ds-table';
import { Heading, Paragraph } from '@skatteetaten/ds-typography';

import { Kravmerke } from '../komponenter/Kravmerke';
import { Noekkeltall } from '../komponenter/Noekkeltall';
import {
  hentEndringer,
  hentErklaeringer,
  hentRegister,
  registerKart,
  TOMT_REGISTER,
} from '../lib/data';
import type { Endring, Erklaering, Register } from '../lib/typer';

import felles from '../stiler/felles.module.scss';
import styles from './arkiv.module.scss';

const ALLE = 'alle';
const PER_SIDE = 25;

type Merkefarge = 'forest' | 'burgundy' | 'denim' | 'graphite' | 'ochre';
type Endringstype =
  | 'ny-erklaering'
  | 'brudd-rettet'
  | 'nye-brudd'
  | 'endret'
  | 'oppdatert'
  | 'fjernet';

/**
 * Én kilde til sannhet for både merkelappen i tabellen og filtervalget.
 *
 * De var tidligere to sett med regler: filteret «Brudd rettet» slapp gjennom
 * alt med removed > 0, mens merkelappen krevde removed > 0 OG added == 0. Da
 * fikk man rader merket «Endret» i et filter som het «Brudd rettet». Verre var
 * «Nye brudd», som traff 224 av 332 fordi nye erklæringer har alle kodene
 * sine i added.
 */
const TYPER: Record<Endringstype, { tekst: string; farge: Merkefarge }> = {
  'ny-erklaering': { tekst: 'Ny erklæring', farge: 'denim' },
  'brudd-rettet': { tekst: 'Brudd rettet', farge: 'forest' },
  'nye-brudd': { tekst: 'Nye brudd', farge: 'burgundy' },
  endret: { tekst: 'Endret', farge: 'ochre' },
  oppdatert: { tekst: 'Oppdatert', farge: 'graphite' },
  fjernet: { tekst: 'Fjernet fra registeret', farge: 'graphite' },
};

const TYPE_REKKEFOELGE: Endringstype[] = [
  'brudd-rettet',
  'nye-brudd',
  'endret',
  'ny-erklaering',
  'oppdatert',
  'fjernet',
];

const PERIODE_FILTRE = [
  { verdi: ALLE, tekst: 'Hele historikken' },
  { verdi: '30', tekst: 'Siste 30 dager' },
  { verdi: '90', tekst: 'Siste 90 dager' },
  { verdi: '365', tekst: 'Siste 12 måneder' },
] as const;

const tidFormat = new Intl.DateTimeFormat('nb-NO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function uuid(url: string): string {
  const m = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.exec(
    url
  );
  return m ? m[0].toLowerCase() : url;
}

function visTid(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : tidFormat.format(d);
}

function erNyErklaering(e: Endring): boolean {
  return Boolean(e.changed && 'newEntry' in e.changed);
}

function erFjernetErklaering(e: Endring): boolean {
  return Boolean(e.changed && 'removedEntry' in e.changed);
}

/**
 * Klassifiserer én endring. Rekkefølgen er viktig: en ny erklæring har alle
 * kodene sine i `added`, men skal ikke telle som «nye brudd».
 */
function endringstype(e: Endring): Endringstype {
  if (erNyErklaering(e)) return 'ny-erklaering';
  if (erFjernetErklaering(e)) return 'fjernet';
  if (e.removed.length && !e.added.length) return 'brudd-rettet';
  if (e.added.length && !e.removed.length) return 'nye-brudd';
  if (e.added.length && e.removed.length) return 'endret';
  return 'oppdatert';
}

function beskrivAndreEndringer(changed: Record<string, unknown> | null): string {
  if (!changed) return '';

  // En fjernet erklæring har ingen «etter»-tilstand å beskrive. Uten dette
  // sto det «Antall brudd endret fra 0 til 0», som ikke sier noe.
  if ('removedEntry' in changed) {
    return 'Erklæringen finnes ikke lenger i uutilsynets register og kan derfor ikke åpnes.';
  }

  const deler: string[] = [];
  const total = changed['totalNonConformities'] as
    | { before?: number; after?: number }
    | undefined;
  if (
    total &&
    total.before !== undefined &&
    total.after !== undefined &&
    total.before !== total.after
  ) {
    deler.push(`Antall brudd endret fra ${total.before} til ${total.after}.`);
  }
  // updatedAt beskrives ikke her. Datoen står allerede i «Erklæringen ble
  // sist oppdatert …» rett under, og de to er alltid samme verdi – begge
  // kommer fra updatedAt i dagens datasett. Kontrollert mot alle 88 radene
  // som har feltet: ingen avvik.
  const tittel = changed['title'] as { before?: string; after?: string } | undefined;
  if (tittel) {
    deler.push('Tittelen er endret.');
  }
  return deler.join(' ');
}

/**
/*
 * Snapshot-lenken er fjernet inntil videre.
 *
 * Katalogen snapshots_by_updated/ lå i .gitignore fram til august 2026, så
 * ingen av de 332 historiske endringene har en fil. Bare endringer som
 * oppstår fra nå av vil få det.
 *
 * Lenken var dessuten aktivt skadelig under utvikling: en HEAD-sjekk mot en
 * manglende fil får 200 med HTML tilbake fra Vites reserveløsning, så sjekken
 * gikk god for filer som ikke fantes. Klikket man lenken, startet appen på
 * .../snapshots_by_updated/<dato>.json, og derfra løste alle relative
 * datastier feil – som ga «Unexpected token '<'».
 *
 * Når snapshots faktisk finnes: sjekk at svaret har content-type
 * application/json, ikke bare at res.ok er sann.
 */

function Seksjonstittel(): ReactElement {
  return (
    <Heading as={'h2'} level={2} hasSpacing>
      {'Endringer i erklæringene'}
    </Heading>
  );
}

export function Endringsarkiv(): ReactElement {
  const [endringer, setEndringer] = useState<Endring[] | null>(null);
  const [erklaeringer, setErklaeringer] = useState<Erklaering[]>([]);
  const [register, setRegister] = useState<Register>(TOMT_REGISTER);
  const [feil, setFeil] = useState<string | null>(null);
  const [sok, setSok] = useState('');
  const [type, setType] = useState<string>(ALLE);
  const [periode, setPeriode] = useState<string>(ALLE);
  const [side, setSide] = useState(1);
  const treffRef = useRef<HTMLDivElement>(null);
  const boksRef = useRef<HTMLDivElement>(null);
  const sokRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([hentEndringer(), hentErklaeringer(), hentRegister()])
      .then(([e, d, r]) => {
        setEndringer(e);
        setErklaeringer(d);
        setRegister(r);
      })
      .catch((e: unknown) =>
        setFeil(e instanceof Error ? e.message : 'Ukjent feil ved henting.')
      );
  }, []);

  useEffect(() => {
    setSide(1);
  }, [sok, type, periode]);

  // Grønt blink på treffteksten når filteret endres, men ikke ved sidelast –
  // da har brukeren ikke gjort noe å kvittere for.
  //
  // Sammenligner forrige filterverdi i stedet for å telle rendringer: React
  // StrictMode kjører effekter to ganger i utvikling, så et «er dette første
  // rendring»-flagg ble brukt opp av den første kjøringen og blinket utløst
  // av den andre.
  //
  // Animasjonen restartes ved å ta klassen av og på med en tvungen reflow
  // mellom, IKKE ved å remontere noden med en key. Noden ligger inne i et
  // aria-live-område, og å bytte den ut ga tre mutasjoner av én filterendring:
  // teksten endret seg, én node forsvant, én kom til. NVDA leste da resultatet
  // to ganger – én for tekstendringen, én for nodetilføyelsen. En klasse er et
  // attributt, som aria-relevant ikke dekker, så den endringen er stille.
  const forrigeFilter = useRef<string | null>(null);
  useEffect(() => {
    const naa = `${sok} ${type} ${periode}`;
    const endret =
      forrigeFilter.current !== null && forrigeFilter.current !== naa;
    forrigeFilter.current = naa;
    if (!endret) return;

    const boks = boksRef.current;
    if (!boks) return;
    boks.classList.remove(styles.markert);
    void boks.offsetWidth; // tvinger reflow, så animasjonen starter på nytt
    boks.classList.add(styles.markert);

    // Klassen må ryddes bort igjen. Ble den liggende, spilte animasjonen på
    // nytt hver gang man byttet fane: et element med display:none animerer
    // ikke, så CSS starter forfra i det fanen blir synlig igjen.
    //
    // Varigheten leses fra CSS, så den ikke står to steder. Ved
    // prefers-reduced-motion er animasjonen «none» og varigheten 0.
    const ms = parseFloat(getComputedStyle(boks).animationDuration) * 1000;
    const timer = window.setTimeout(
      () => boks.classList.remove(styles.markert),
      ms + 50
    );
    return () => window.clearTimeout(timer);
  }, [sok, type, periode]);

  const harFilter = sok.trim() !== '' || type !== ALLE || periode !== ALLE;

  const nullstillFiltrering = (): void => {
    setSok('');
    setType(ALLE);
    setPeriode(ALLE);
    // Knappen forsvinner i det den brukes, så fokus må ta et sted. Første
    // filterfelt: brukeren blir stående i filteret og kan filtrere på nytt.
    // Resultatet leses uansett opp av live-området, uten at fokus er der.
    sokRef.current?.focus();
  };

  const registerPerId = useMemo(() => registerKart(register), [register]);

  const navnPerUuid = useMemo(() => {
    const kart = new Map<string, string>();
    for (const e of erklaeringer) kart.set(uuid(e.url), e.name);
    return kart;
  }, [erklaeringer]);

  /**
   * Navnerekkefølgen er bevisst:
   *   1. navnet på endringsraden – det erklæringen het da endringen skjedde
   *   2. erklæringsregisteret – husker også de som er slettet hos uutilsynet
   *   3. dagens datasett – reserve for rader fra før registeret fantes
   *
   * URL-en er aldri et gyldig navn å falle tilbake på: for en fjernet
   * erklæring peker den på en side som ikke finnes, og den forteller ingen
   * hvilken løsning det gjelder.
   */
  const navnFor = (e: Endring): string =>
    e.name ||
    registerPerId.get(uuid(e.url))?.name ||
    navnPerUuid.get(uuid(e.url)) ||
    'Ukjent erklæring';

  const synlige = useMemo(() => {
    if (!endringer) return [];
    const sokLower = sok.trim().toLowerCase();
    const naa = Date.now();

    return endringer
      .filter((e) => {
        // URL-en er med i søket selv om den ikke vises som navn, så man
        // fortsatt kan lime inn en uustatus-lenke og finne raden.
        if (
          sokLower &&
          !`${navnFor(e)} ${e.url}`.toLowerCase().includes(sokLower)
        ) {
          return false;
        }
        // Samme funksjon som gir merkelappen i tabellen, så filteret ikke kan
        // vise rader med en annen merkelapp enn den man filtrerte på.
        if (type !== ALLE && endringstype(e) !== type) return false;
        if (periode !== ALLE) {
          const t = new Date(e.ts).getTime();
          if (Number.isNaN(t)) return false;
          if ((naa - t) / 86_400_000 > Number(periode)) return false;
        }
        return true;
      })
      .sort((a, b) => b.ts.localeCompare(a.ts));
    // navnFor er avledet av navnPerUuid, som allerede er en avhengighet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endringer, sok, type, periode, navnPerUuid]);

  const paginert = useMemo(
    () => synlige.slice((side - 1) * PER_SIDE, side * PER_SIDE),
    [synlige, side]
  );

  if (feil) {
    return (
      <>
        <Seksjonstittel />
        <Alert
          variant={'danger'}
          showAlert
        >{`Kunne ikke laste endringsloggen: ${feil}`}</Alert>
      </>
    );
  }

  if (!endringer) {
    return (
      <>
        <Seksjonstittel />
        <Paragraph>{'Laster endringshistorikk …'}</Paragraph>
      </>
    );
  }

  // Tellingen bruker samme klassifisering som merkelappene og filteret.
  const antallPerType = new Map<Endringstype, number>();
  for (const e of endringer) {
    const t = endringstype(e);
    antallPerType.set(t, (antallPerType.get(t) ?? 0) + 1);
  }
  const rettet = antallPerType.get('brudd-rettet') ?? 0;
  const nye = antallPerType.get('nye-brudd') ?? 0;

  return (
    <>
      <Seksjonstittel />
      <Paragraph hasSpacing>
        {'Historikk over brudd som er rettet eller tilkommet, og over ' +
          'erklæringer som er lagt til eller fjernet fra registeret. ' +
          'Datasettet sammenlignes automatisk hver natt.'}
      </Paragraph>
      <div className={styles.noekkeltall}>
        <Noekkeltall verdi={endringer.length} tekst={'Registrerte endringer'} />
        <Noekkeltall verdi={rettet} tekst={'Der brudd ble rettet'} />
        <Noekkeltall verdi={nye} tekst={'Med nye brudd'} />
      </div>

      {/* Lukket som standard, som på statusfanen. */}
      <OpenClose title={'Filtrer'} className={styles.filterbryter}>
        <div className={styles.filtre}>
          {/* Se kommentaren i status.tsx: etiketten må vises for å flukte med
              Select-ene i samme rad, og søkeknappen har ingen filtrering å
              utløse – den flytter fokus til treffteksten i stedet. */}
          <SearchField
            ref={sokRef}
            label={'Søk etter tjeneste'}
            hideLabel={false}
            value={sok}
            onChange={(e) => setSok(e.currentTarget.value)}
            onClear={() => setSok('')}
            onSearch={() => treffRef.current?.focus()}
            onSearchClick={() => treffRef.current?.focus()}
          />
          <Select
            label={'Type endring'}
            // Se status.tsx: filteret har alltid en verdi, plassholderen ville
            // bare vært et valg som tømmer det uten å si det.
            hidePlaceholder
            value={type}
            onChange={(e) => setType(e.currentTarget.value)}
          >
            <Select.Option value={ALLE}>
              {`Alle endringer (${endringer.length})`}
            </Select.Option>
            {TYPE_REKKEFOELGE.filter((t) => (antallPerType.get(t) ?? 0) > 0).map(
              (t) => (
                <Select.Option key={t} value={t}>
                  {`${TYPER[t].tekst} (${antallPerType.get(t)})`}
                </Select.Option>
              )
            )}
          </Select>
          <Select
            label={'Periode'}
            hidePlaceholder
            value={periode}
            onChange={(e) => setPeriode(e.currentTarget.value)}
          >
            {PERIODE_FILTRE.map((f) => (
              <Select.Option key={f.verdi} value={f.verdi}>
                {f.tekst}
              </Select.Option>
            ))}
          </Select>
        </div>
        {/* Vises bare når det er noe å nullstille. Se nullstillFiltrering for
            hvorfor fokus må flyttes når knappen forsvinner. */}
        {harFilter && (
          <div className={styles.nullstill}>
            <InlineButton svgPath={UndoSVGpath} onClick={nullstillFiltrering}>
              {'Nullstill filtrering'}
            </InlineButton>
          </div>
        )}
      </OpenClose>

      {/* aria-live: filtreringen skjer mens man skriver, så treffantallet må
          annonseres uten at fokus flyttes. Uten dette var DS-pagineringens
          egen live-region («Viser 1–25 av 72») det eneste som ble lest ved
          filterendring – den forteller om sideinndelingen, ikke om treffet.
          tabIndex −1 gjør at søkeknappen kan flytte fokus hit, som på
          statusfanen. */}
      <div
        ref={treffRef}
        tabIndex={-1}
        aria-live={'polite'}
        className={styles.treff}
      >
        {/* Ingen key her. Noden må være den samme hele veien – se effekten
            over: bytter den ut, leser NVDA resultatet to ganger. */}
        <div ref={boksRef} className={styles.treffboks}>
          {/* Ordlyden unngår «Viser» med vilje. DS-pagineringen har sin egen
              live-region som sier «Viser 1–25 av 54», og ved filterendring
              annonseres begge. To meldinger er riktig – de svarer på hver sin
              handling – men to som begge begynner med «Viser» høres ut som at
              det samme leses to ganger. */}
          <Paragraph>
            {synlige.length === endringer.length
              ? `Alle ${endringer.length} endringer vises.`
              : `Resultat filtrering: ${synlige.length} av ${endringer.length} endringer.`}
          </Paragraph>
        </div>
      </div>

      {synlige.length === 0 ? (
        <Alert variant={'info'} showAlert>
          {'Ingen endringer med gjeldende filter.'}
        </Alert>
      ) : (
        <Table caption={'Endringer i tilgjengelighetserklæringene'} hasFullWidth>
          <Table.Header>
            <Table.Row>
              {/* Se status.tsx: utvidingskolonnen må ha egen overskriftscelle,
                  ellers forskyves alle overskriftene. */}
              <Table.HeaderCell>
                <span className={felles.srOnly}>{'Vis detaljer'}</span>
              </Table.HeaderCell>
              <Table.HeaderCell>{'Oppdaget'}</Table.HeaderCell>
              <Table.HeaderCell>{'Erklæring'}</Table.HeaderCell>
              <Table.HeaderCell>{'Endring'}</Table.HeaderCell>
              <Table.HeaderCell alignment={'right'} className={styles.enLinje}>
                {'Rettet / nye'}
              </Table.HeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {paginert.map((e, i) => {
              const merke = TYPER[endringstype(e)];
              const dato = e.updatedDate || e.ts.slice(0, 10);
              // En fjernet erklæring har koder i `removed`, men de ble ikke
              // rettet – erklæringen forsvant fra registeret. Derfor egen
              // presentasjon både i tabellen og i det utvidede innholdet.
              const fjernet = erFjernetErklaering(e);

              return (
                <Table.Row
                  key={`${e.url}-${e.ts}-${i}`}
                  isExpandable
                  // Se status.tsx: designsystemets egen tekst brukes, radens
                  // navn kobles på med aria-describedby.
                  expandButtonAriaDescribedby={`endring-${i}`}
                  expandableContent={
                    <div className={`${styles.detaljer} ${felles.utvidetInnhold}`}>
                      {fjernet ? (
                        <div>
                          <Heading as={'h3'} level={4} hasSpacing>
                            {'Brudd da erklæringen ble fjernet'}
                          </Heading>
                          {e.removed.length ? (
                            <ul className={styles.kodeliste}>
                              {e.removed.map((k) => (
                                <li key={k}>
                                  <Kravmerke kode={k} />
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <Paragraph>
                              {'Ingen registrerte brudd.'}
                            </Paragraph>
                          )}
                        </div>
                      ) : (
                        <div className={styles.kolonner}>
                          <div>
                            <Heading as={'h3'} level={4} hasSpacing>
                              {'Brudd som ble rettet'}
                            </Heading>
                            {e.removed.length ? (
                              <ul className={styles.kodeliste}>
                                {e.removed.map((k) => (
                                  <li key={k}>
                                    <Kravmerke kode={k} farge={'forest'} />
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <Paragraph>{'Ingen.'}</Paragraph>
                            )}
                          </div>
                          <div>
                            <Heading as={'h3'} level={4} hasSpacing>
                              {'Nye brudd'}
                            </Heading>
                            {e.added.length ? (
                              <ul className={styles.kodeliste}>
                                {e.added.map((k) => (
                                  <li key={k}>
                                    <Kravmerke kode={k} />
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <Paragraph>{'Ingen.'}</Paragraph>
                            )}
                          </div>
                        </div>
                      )}

                      {beskrivAndreEndringer(e.changed) && (
                        <Paragraph>{beskrivAndreEndringer(e.changed)}</Paragraph>
                      )}

                      <Paragraph>
                        {`Erklæringen ble sist oppdatert ${dato}.`}
                      </Paragraph>
                    </div>
                  }
                >
                  <Table.DataCell className={styles.datokolonne}>
                    {visTid(e.ts)}
                  </Table.DataCell>
                  <Table.DataCell as={'th'} scope={'row'} id={`endring-${i}`}>
                    {/* Lenken ligger på navnet, som på statusfanen: da slipper
                        man å utvide raden for å komme til erklæringen. En
                        fjernet erklæring får ingen lenke – den ville gitt 404
                        hos uutilsynet. */}
                    {fjernet || !e.url ? (
                      navnFor(e)
                    ) : (
                      <Link href={e.url} target={'_blank'} isExternal>
                        {navnFor(e)}
                      </Link>
                    )}
                  </Table.DataCell>
                  <Table.DataCell>
                    <Tag color={merke.farge} size={'small'}>
                      {merke.tekst}
                    </Tag>
                  </Table.DataCell>
                  <Table.DataCell alignment={'right'}>
                    {fjernet ? (
                      <>
                        <span aria-hidden={'true'}>{'–'}</span>
                        <span className={felles.srOnly}>
                          {'Ikke relevant'}
                        </span>
                      </>
                    ) : (
                      `−${e.removed.length} / +${e.added.length}`
                    )}
                  </Table.DataCell>
                </Table.Row>
              );
            })}
          </Table.Body>
        </Table>
      )}

      {synlige.length > PER_SIDE && (
        <div className={styles.paginering}>
          <Pagination
            totalItems={synlige.length}
            pageSize={PER_SIDE}
            currentPage={side}
            onChange={setSide}
            ariaLabel={'Sider i endringsarkivet'}
          />
        </div>
      )}
    </>
  );
}
