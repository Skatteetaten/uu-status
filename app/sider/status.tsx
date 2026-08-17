import { useEffect, useMemo, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import { Button, InlineButton, Link } from '@skatteetaten/ds-buttons';
import { OpenClose } from '@skatteetaten/ds-collections';
import { Select, SearchField } from '@skatteetaten/ds-forms';
import {
  CheckSVGpath,
  UndoSVGpath,
  WarningSVGpath,
} from '@skatteetaten/ds-icons';
import { Pagination } from '@skatteetaten/ds-navigation';
import { Modal } from '@skatteetaten/ds-overlays';
import { Alert, Tag } from '@skatteetaten/ds-status';
import { Table } from '@skatteetaten/ds-table';
import type { SortState } from '@skatteetaten/ds-table';
import { Heading, Paragraph } from '@skatteetaten/ds-typography';

import { Kravmerke } from '../komponenter/Kravmerke';
import { Noekkeltall } from '../komponenter/Noekkeltall';
import { Ringdiagram } from '../komponenter/Ringdiagram';
import type { Ringsegment } from '../komponenter/Ringdiagram';
import { Stolpediagram } from '../komponenter/Stolpediagram';
import type { Stolpe } from '../komponenter/Stolpediagram';
import {
  ANTALL_KRAV,
  dagerTilFrist,
  erFristUtloept,
  hentErklaeringer,
  tellPerKrav,
} from '../lib/data';
import type { Erklaering } from '../lib/typer';

import felles from '../stiler/felles.module.scss';
import styles from './status.module.scss';

const ALLE = 'alle';

const BRUDD_FILTRE = [
  { verdi: ALLE, tekst: 'Alle' },
  { verdi: '0', tekst: '0 brudd' },
  { verdi: '1-5', tekst: '1–5 brudd' },
  { verdi: '6-10', tekst: '6–10 brudd' },
  { verdi: '11+', tekst: '11+ brudd' },
] as const;

const PERIODE_FILTRE = [
  { verdi: ALLE, tekst: 'Når som helst' },
  { verdi: '30', tekst: 'Siste 30 dager' },
  { verdi: '90', tekst: 'Siste 90 dager' },
  { verdi: '365', tekst: 'Siste 12 måneder' },
] as const;

const SIDESTOERRELSER = ['25', '50', '100', ALLE] as const;

const datoFormat = new Intl.DateTimeFormat('nb-NO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function visDato(iso: string): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : datoFormat.format(d);
}

function iBruddgruppe(antall: number, gruppe: string): boolean {
  switch (gruppe) {
    case '0':
      return antall === 0;
    case '1-5':
      return antall >= 1 && antall <= 5;
    case '6-10':
      return antall >= 6 && antall <= 10;
    case '11+':
      return antall >= 11;
    default:
      return true;
  }
}

function oppdatertInnen(e: Erklaering, dager: string, naa: Date): boolean {
  if (dager === ALLE) return true;
  if (!e.updatedAt) return false;
  const d = new Date(e.updatedAt);
  if (Number.isNaN(d.getTime())) return false;
  return (naa.getTime() - d.getTime()) / 86_400_000 <= Number(dager);
}

function Fristmerke({ e }: { e: Erklaering }): ReactElement | null {
  const dager = dagerTilFrist(e);
  if (dager === null) return null;
  if (dager < 0) {
    return (
      <Tag color={'burgundy'} size={'small'}>
        {'Frist utløpt'}
      </Tag>
    );
  }
  if (dager <= 60) {
    return (
      <Tag color={'ochre'} size={'small'}>{`Frist om ${dager} d`}</Tag>
    );
  }
  return null;
}

/**
 * Merking av antall brudd. Bare ytterpunktene flagges: null brudd og seks
 * eller flere. Mellomsjiktet 1–5 står nøytralt, uten farge og ikon – 40 av
 * 118 rader ligger der, og et merke på hver av dem ville druknet de 21 som
 * faktisk trenger oppmerksomhet.
 *
 * Der farge brukes, følger den to andre signaler: en egen ikonform og en tekst
 * for skjermleser. Fargen koder en vurdering tallet ikke gjentar, og kan ikke
 * stå alene (WCAG 1.4.1).
 */
function bruddmerke(antall: number): {
  farge: 'forest' | 'burgundy';
  ikon: ReactElement<SVGPathElement>;
  beskrivelse: string;
} | null {
  if (antall === 0) {
    return { farge: 'forest', ikon: CheckSVGpath, beskrivelse: 'ingen brudd' };
  }
  if (antall <= 5) {
    return null;
  }
  return { farge: 'burgundy', ikon: WarningSVGpath, beskrivelse: 'mange brudd' };
}

function Bruddmerke({ antall }: { antall: number }): ReactElement {
  const merke = bruddmerke(antall);

  if (!merke) {
    // Samme vannrette innrykk som Tag-en, så sifrene står i kolonne
    // uavhengig av om raden er merket eller ikke.
    return <span className={styles.bruddNoeytral}>{antall}</span>;
  }

  return (
    <span className={styles.bruddcelle}>
      <Tag color={merke.farge} svgPath={merke.ikon} size={'small'}>
        {String(antall)}
      </Tag>
      <span className={felles.srOnly}>{merke.beskrivelse}</span>
    </span>
  );
}

function Seksjonstittel(): ReactElement {
  return (
    <Heading as={'h2'} level={2} hasSpacing>
      {'Våre tilgjengelighetserklæringer'}
    </Heading>
  );
}

export function Statusoversikt(): ReactElement {
  const [erklaeringer, setErklaeringer] = useState<Erklaering[] | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [sok, setSok] = useState('');
  const [bruddgruppe, setBruddgruppe] = useState<string>(ALLE);
  const [wcagFilter, setWcagFilter] = useState<string>(ALLE);
  const [periode, setPeriode] = useState<string>(ALLE);
  const [sidestoerrelse, setSidestoerrelse] = useState<string>('25');
  const [side, setSide] = useState(1);
  const [sortState, setSortState] = useState<SortState>({
    direction: 'ascending',
    sortKey: 'navn',
  });
  const treffRef = useRef<HTMLDivElement>(null);
  const boksRef = useRef<HTMLDivElement>(null);
  const sokRef = useRef<HTMLInputElement>(null);
  const dashboardRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    hentErklaeringer()
      .then(setErklaeringer)
      .catch((e: unknown) =>
        setFeil(e instanceof Error ? e.message : 'Ukjent feil ved henting.')
      );
  }, []);

  // Filterendringer skal alltid bringe brukeren tilbake til første side.
  useEffect(() => {
    setSide(1);
  }, [sok, bruddgruppe, wcagFilter, periode, sidestoerrelse]);

  // Se arkiv.tsx: grønt blink på treffteksten, men ikke ved sidelast. Verdiene
  // sammenlignes fordi StrictMode kjører effekten to ganger i utvikling.
  // Sidestørrelse er utelatt – den endrer ikke treffet, bare oppdelingen.
  // Klassen tas av og på i stedet for at noden remonteres: en remontering inne
  // i live-området fikk NVDA til å lese resultatet to ganger.
  const forrigeFilter = useRef<string | null>(null);
  useEffect(() => {
    const naa = `${sok} ${bruddgruppe} ${wcagFilter} ${periode}`;
    const endret =
      forrigeFilter.current !== null && forrigeFilter.current !== naa;
    forrigeFilter.current = naa;
    if (!endret) return;

    const boks = boksRef.current;
    if (!boks) return;
    boks.classList.remove(styles.markert);
    void boks.offsetWidth; // tvinger reflow, så animasjonen starter på nytt
    boks.classList.add(styles.markert);

    // Se arkiv.tsx: klassen må bort igjen, ellers spiller animasjonen på nytt
    // hver gang fanen blir synlig.
    const ms = parseFloat(getComputedStyle(boks).animationDuration) * 1000;
    const timer = window.setTimeout(
      () => boks.classList.remove(styles.markert),
      ms + 50
    );
    return () => window.clearTimeout(timer);
  }, [sok, bruddgruppe, wcagFilter, periode]);

  // Sidestørrelse og sortering er ikke filtre og nullstilles ikke.
  const harFilter =
    sok.trim() !== '' ||
    bruddgruppe !== ALLE ||
    wcagFilter !== ALLE ||
    periode !== ALLE;

  const nullstillFiltrering = (): void => {
    setSok('');
    setBruddgruppe(ALLE);
    setWcagFilter(ALLE);
    setPeriode(ALLE);
    // Se arkiv.tsx: knappen forsvinner, så fokus går til første filterfelt.
    sokRef.current?.focus();
  };

  const perKrav = useMemo(
    () => (erklaeringer ? tellPerKrav(erklaeringer) : new Map<string, number>()),
    [erklaeringer]
  );

  const synlige = useMemo(() => {
    if (!erklaeringer) return [];
    const sokLower = sok.trim().toLowerCase();
    const naa = new Date();

    const filtrert = erklaeringer.filter((e) => {
      if (sokLower && !e.name.toLowerCase().includes(sokLower)) return false;
      if (!iBruddgruppe(e.totalNonConformities, bruddgruppe)) return false;
      if (wcagFilter !== ALLE && !e.nonConformities.includes(wcagFilter)) {
        return false;
      }
      if (!oppdatertInnen(e, periode, naa)) return false;
      return true;
    });

    const retning = sortState.direction === 'descending' ? -1 : 1;
    return [...filtrert].sort((a, b) => {
      switch (sortState.sortKey) {
        case 'brudd':
          return (a.totalNonConformities - b.totalNonConformities) * retning;
        case 'oppdatert':
          return a.updatedAt.localeCompare(b.updatedAt) * retning;
        case 'opprettet':
          return a.opprettet.localeCompare(b.opprettet) * retning;
        default:
          return a.name.localeCompare(b.name, 'nb') * retning;
      }
    });
  }, [erklaeringer, sok, bruddgruppe, wcagFilter, periode, sortState]);

  const perSide =
    sidestoerrelse === ALLE ? synlige.length || 1 : Number(sidestoerrelse);
  const paginert = useMemo(
    () => synlige.slice((side - 1) * perSide, side * perSide),
    [synlige, side, perSide]
  );

  if (feil) {
    return (
      <>
        <Seksjonstittel />
        <Alert
          variant={'danger'}
          showAlert
        >{`Kunne ikke laste data: ${feil}`}</Alert>
      </>
    );
  }

  if (!erklaeringer) {
    return (
      <>
        <Seksjonstittel />
        <Paragraph>{'Laster tilgjengelighetserklæringer …'}</Paragraph>
      </>
    );
  }

  const totaltBrudd = erklaeringer.reduce(
    (sum, e) => sum + e.totalNonConformities,
    0
  );
  const utenBrudd = erklaeringer.filter(
    (e) => e.totalNonConformities === 0
  ).length;
  const utloepte = erklaeringer.filter((e) => erFristUtloept(e)).length;

  const toppKrav: Stolpe[] = [...perKrav]
    .slice(0, 8)
    .map(([kode, antall]) => ({ merkelapp: kode, verdi: antall }));

  // Samme fargebetydning som merkene i tabellen: 0 grønn, 1–5 gul, 6+ rød.
  // Diagrammet deler den røde sonen i to for å vise spennet, med lys og mørk
  // valør av samme farge – ikke en ny farge, som ville brutt betydningen.
  // Fargen alene bærer ingen informasjon: tegnforklaringen gjentar alle tall.
  const BRUDD_FARGER: Record<string, string> = {
    '0': 'var(--palette-forest-70)',
    '1-5': 'var(--palette-ochre-70)',
    '6-10': 'var(--palette-burgundy-50)',
    '11+': 'var(--palette-burgundy-100)',
  };

  const fordeling: Ringsegment[] = BRUDD_FILTRE.filter(
    (f) => f.verdi !== ALLE
  ).map((f) => ({
    merkelapp: f.tekst,
    verdi: erklaeringer.filter((e) =>
      iBruddgruppe(e.totalNonConformities, f.verdi)
    ).length,
    farge: BRUDD_FARGER[f.verdi] ?? 'var(--palette-graphite-50)',
  }));

  return (
    <>
      <Seksjonstittel />

      <div className={styles.ingressrad}>
        <Paragraph>
          {`Hver løsning er vurdert mot ${ANTALL_KRAV} WCAG-krav. Erklæringene ` +
            'skal oppdateres minst én gang i året.'}
        </Paragraph>
        {/* Sekundær: dashbordet er et supplement til tabellen, ikke sidens
            hovedhandling. Med primærstil var det det tyngste elementet over
            folden, og trakk blikket bort fra tallene det skal utdype. */}
        <Button
          variant={'secondary'}
          onClick={() => dashboardRef.current?.showModal()}
        >
          {'Dashboard'}
        </Button>
      </div>

      <div className={styles.noekkeltall}>
        <Noekkeltall verdi={erklaeringer.length} tekst={'Erklæringer'} />
        <Noekkeltall
          verdi={totaltBrudd}
          tekst={'Brudd totalt'}
          farge={'burgundy'}
        />
        <Noekkeltall verdi={utenBrudd} tekst={'Uten brudd'} farge={'forest'} />
        <Noekkeltall
          verdi={utloepte}
          tekst={'Med utløpt frist'}
          farge={'ochre'}
        />
      </div>

      <Modal
        ref={dashboardRef}
        title={'Dashboard'}
        padding={'l'}
        className={styles.dashboardModal}
      >
        {/* as={'h2'} level={4}: DS gjør modalens `title` til en h1, så
            diagramtitlene er neste nivå ned. `level` styrer bare størrelsen,
            så utseendet er uendret – uten skillet hoppet vi fra h1 til h4. */}
        <div className={styles.diagrammer}>
            <section aria-labelledby={'topp-krav'} className={styles.diagramkort}>
              <Heading as={'h2'} level={4} id={'topp-krav'} hasSpacing>
                {'Krav som brytes oftest'}
              </Heading>
              <Stolpediagram
                stolper={toppKrav}
                ariaLabel={'WCAG-krav sortert etter antall løsninger med brudd'}
              />
            </section>

            <section aria-labelledby={'fordeling'} className={styles.diagramkort}>
              <Heading as={'h2'} level={4} id={'fordeling'} hasSpacing>
                {'Fordeling av brudd per løsning'}
              </Heading>
              <Ringdiagram
                segmenter={fordeling}
                totalTekst={String(erklaeringer.length)}
                totalEtikett={'løsninger'}
                ariaLabel={
                  'Løsninger fordelt på antall WCAG-brudd. Tallene står i ' +
                  'tegnforklaringen under.'
                }
              />
            </section>
        </div>
      </Modal>

      {/* Filtrene er lukket som standard, etter husstandarden. */}
      <OpenClose title={'Filtrer'} className={styles.filterbryter}>
        <div className={styles.filtre}>
          {/* SearchField skjuler etiketten som standard (srOnly). Her står den
              i en rad med tre Select-er som viser sin, så uten dette ville
              søkefeltet ligget 28 px høyere enn de andre. */}
        {/* Filtreringen skjer mens man skriver, så knappen og Enter har ingen
            filtrering å utløse. I stedet flytter de fokus til treffteksten
            under. Uten det er søkeknappen en kontroll uten funksjon – og for
            den som navigerer med tastatur eller skjermleser er hoppet dit
            resultatet står faktisk det nyttige. */}
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
          label={'Antall brudd'}
          // Ingen plassholder: filteret har alltid en verdi, og «Velg» ville
          // vært et valg som ser gyldig ut, men tømmer filteret uten å si det.
          hidePlaceholder
          value={bruddgruppe}
          onChange={(e) => setBruddgruppe(e.currentTarget.value)}
        >
          {BRUDD_FILTRE.map((f) => (
            <Select.Option key={f.verdi} value={f.verdi}>
              {f.tekst}
            </Select.Option>
          ))}
        </Select>
        <Select
          label={'WCAG-krav'}
          hidePlaceholder
          value={wcagFilter}
          onChange={(e) => setWcagFilter(e.currentTarget.value)}
        >
          <Select.Option value={ALLE}>{'Alle krav'}</Select.Option>
          {[...perKrav].map(([kode, antall]) => (
            <Select.Option key={kode} value={kode}>
              {`${kode} (${antall})`}
            </Select.Option>
          ))}
        </Select>
        <Select
          label={'Oppdatert siden'}
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
        {/* Se arkiv.tsx: vises bare når det er noe å nullstille, og fokus
            flyttes til treffteksten fordi knappen forsvinner ved klikk. */}
        {harFilter && (
          <div className={styles.nullstill}>
            <InlineButton svgPath={UndoSVGpath} onClick={nullstillFiltrering}>
              {'Nullstill filtrering'}
            </InlineButton>
          </div>
        )}
      </OpenClose>

      <div className={styles.tabellinfo}>
        {/* aria-live: filtrering skjer mens man skriver, så skjermleseren må
            få vite at treffantallet endret seg uten at fokus flyttes.
            tabIndex −1 gjør at søkeknappen kan flytte fokus hit. */}
        <div
          ref={treffRef}
          tabIndex={-1}
          aria-live={'polite'}
          className={styles.treff}
        >
          {/* Se arkiv.tsx: ingen key. Noden må være stabil, ellers leser NVDA
              resultatet to ganger. */}
          <div ref={boksRef} className={styles.treffboks}>
            {/* Se arkiv.tsx: ordlyden unngår «Viser» fordi DS-pagineringens
                egen live-region sier «Viser 1–25 av 54» i samme øyeblikk. */}
            <Paragraph>
              {synlige.length === erklaeringer.length
                ? `Alle ${erklaeringer.length} erklæringer vises.`
                : `Resultat filtrering: ${synlige.length} av ${erklaeringer.length} erklæringer.`}
            </Paragraph>
          </div>
        </div>
        <Select
          label={'Rader per side'}
          hideLabel
          hidePlaceholder
          value={sidestoerrelse}
          onChange={(e) => setSidestoerrelse(e.currentTarget.value)}
        >
          {SIDESTOERRELSER.map((s) => (
            <Select.Option key={s} value={s}>
              {s === ALLE ? 'Alle rader' : `${s} per side`}
            </Select.Option>
          ))}
        </Select>
      </div>

      <Table
        caption={'Tilgjengelighetserklæringer med antall WCAG-brudd'}
        sortState={sortState}
        setSortState={setSortState}
        hasFullWidth
      >
        <Table.Header>
          <Table.Row>
            {/* Radene får en ekstra celle for utvidingsknappen. Uten denne
                forskyves alle overskriftene én kolonne til venstre. */}
            <Table.HeaderCell>
              <span className={felles.srOnly}>{'Vis detaljer'}</span>
            </Table.HeaderCell>
            {/* styles.sorterbar holder etikett og sorteringsikon på samme
                linje. Se kommentaren i status.module.scss. */}
            <Table.HeaderCell
              isSortable
              sortKey={'navn'}
              className={styles.sorterbar}
            >
              {'Navn'}
            </Table.HeaderCell>
            <Table.HeaderCell
              isSortable
              sortKey={'brudd'}
              alignment={'right'}
              className={styles.sorterbar}
            >
              {`Brudd (av ${ANTALL_KRAV})`}
            </Table.HeaderCell>
            <Table.HeaderCell
              isSortable
              sortKey={'oppdatert'}
              className={styles.sorterbar}
            >
              {'Sist oppdatert'}
            </Table.HeaderCell>
            <Table.HeaderCell
              isSortable
              sortKey={'opprettet'}
              className={styles.sorterbar}
            >
              {'Opprettet'}
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {paginert.map((e, i) => (
            <Table.Row
              key={e.url}
              isExpandable
              // Ingen expandButtonTitle: designsystemet har sin egen tekst
              // ("Mer informasjon" fra tablerow.Expandable), og skiller selv
              // mellom knappetekst og skjermleserforklaring. Radens navn
              // kobles på med aria-describedby.
              expandButtonAriaDescribedby={`tjeneste-${i}`}
              expandableContent={
                <div className={`${styles.detaljer} ${felles.utvidetInnhold}`}>
                  {e.nonConformities.length === 0 ? (
                    <Paragraph>
                      {'Ingen WCAG-brudd registrert i erklæringen.'}
                    </Paragraph>
                  ) : (
                    <>
                      <Heading as={'h3'} level={4} hasSpacing>
                        {'WCAG-krav som ikke er oppfylt'}
                      </Heading>
                      <ul className={styles.kodeliste}>
                        {e.nonConformities.map((kode) => (
                          <li key={kode}>
                            <Kravmerke kode={kode} />
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              }
            >
              <Table.DataCell as={'th'} scope={'row'} id={`tjeneste-${i}`}>
                {/* Lenken ligger på navnet, ikke inne i detaljvisningen: da
                    slipper man å utvide raden for å komme til erklæringen.
                    isExternal gir ikonet som varsler at man forlater siden. */}
                <Link href={e.url} target={'_blank'} isExternal>
                  {e.name}
                </Link>
              </Table.DataCell>
              <Table.DataCell alignment={'right'}>
                <Bruddmerke antall={e.totalNonConformities} />
              </Table.DataCell>
              <Table.DataCell className={styles.datokolonne}>
                <span className={styles.datocelle}>
                  {visDato(e.updatedAt)}
                  <Fristmerke e={e} />
                </span>
              </Table.DataCell>
              <Table.DataCell className={styles.datokolonne}>
                {visDato(e.opprettet)}
              </Table.DataCell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      {sidestoerrelse !== ALLE && synlige.length > perSide && (
        <div className={styles.paginering}>
          <Pagination
            totalItems={synlige.length}
            pageSize={perSide}
            currentPage={side}
            onChange={setSide}
            ariaLabel={'Sider i erklæringstabellen'}
          />
        </div>
      )}
    </>
  );
}
