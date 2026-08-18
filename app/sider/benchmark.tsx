import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { Checkbox } from '@skatteetaten/ds-forms';
import { Alert, Tag } from '@skatteetaten/ds-status';
import { Table } from '@skatteetaten/ds-table';
import { Heading, List, Paragraph } from '@skatteetaten/ds-typography';

import { Infoboks } from '../komponenter/Infoboks';
import { Lenkeliste } from '../komponenter/Lenkeliste';
import { Noekkeltall } from '../komponenter/Noekkeltall';
import { beregnNoekkeltall, byggRader } from '../lib/benchmark';
import { ANTALL_KRAV, hentDatasett } from '../lib/data';
import type { DatasettPost } from '../lib/typer';

import felles from '../stiler/felles.module.scss';
import styles from './benchmark.module.scss';

const prosentFormat = new Intl.NumberFormat('nb-NO', {
  style: 'percent',
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const desimalFormat = new Intl.NumberFormat('nb-NO', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

const datoFormat = new Intl.DateTimeFormat('nb-NO', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function visProsent(v: number | null): string {
  return v === null ? '–' : prosentFormat.format(v);
}

function visDato(iso: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : datoFormat.format(d);
}

function Seksjonstittel(): ReactElement {
  return (
    <Heading as={'h2'} level={2} hasSpacing>
      {'Sammenlignet med andre virksomheter'}
    </Heading>
  );
}

export function Sammenligning(): ReactElement {
  const [poster, setPoster] = useState<DatasettPost[] | null>(null);
  const [feil, setFeil] = useState<string | null>(null);
  const [skjulKommunale, setSkjulKommunale] = useState(false);

  useEffect(() => {
    hentDatasett()
      .then(setPoster)
      .catch((e: unknown) =>
        setFeil(e instanceof Error ? e.message : 'Ukjent feil ved henting.')
      );
  }, []);

  const alleRader = useMemo(() => (poster ? byggRader(poster) : []), [poster]);
  const rader = useMemo(
    () => (skjulKommunale ? alleRader.filter((r) => !r.erKommunal) : alleRader),
    [alleRader, skjulKommunale]
  );
  // alleRader, ikke rader: avkryssingsboksen filtrerer tabellen, ikke
  // sammenligningen. Med rader endret et klikk på boksen stille tre tall langt
  // oppe på siden – «2 av 22» ble «2 av 11» – uten at noe varslet om det. For
  // en skjermleserbruker skjer det helt usynlig, og det er en endring av
  // innhold utløst av en kontroll uten forvarsel (WCAG 3.2.2). Nøkkeltallene
  // svarer på «hvordan ligger vi an», og det spørsmålet har ett svar.
  const noekkeltall = useMemo(() => beregnNoekkeltall(alleRader), [alleRader]);

  if (feil) {
    return (
      <>
        <Seksjonstittel />
        <Alert
          variant={'danger'}
          showAlert
        >{`Kunne ikke laste datasettet: ${feil}`}</Alert>
      </>
    );
  }

  if (!poster) {
    return (
      <>
        <Seksjonstittel />
        <Paragraph>{'Laster datasettet …'}</Paragraph>
      </>
    );
  }

  const { vaarAndel, snittAndre, plassering, antallSammenlignet } = noekkeltall;
  const bedreEnnSnitt =
    vaarAndel !== null && snittAndre !== null && vaarAndel < snittAndre;

  return (
    <>
      <Seksjonstittel />
      <Paragraph hasSpacing>
        {'Tilgjengelighetsstatus i offentlige digitale løsninger, basert på ' +
          'tilgjengelighetserklæringer. Bruddandel viser hvor stor andel av de ' +
          'vurderte kravene som er rapportert med brudd.'}
      </Paragraph>

      <Heading as={'h3'} level={3} hasSpacing>
        {'Hvordan ligger vi an?'}
      </Heading>

      <div className={styles.noekkeltall}>
        <Noekkeltall
          tekst={'Vår andel krav med brudd'}
          verdi={visProsent(vaarAndel)}
          infoTittel={'Om vår andel krav med brudd'}
          info={
            `Andelen beregnes med fast grunnlag på ${ANTALL_KRAV} krav per erklæring: ` +
            `brudd delt på (antall erklæringer × ${ANTALL_KRAV}).`
          }
        />
        <Noekkeltall
          tekst={'Snitt andre virksomheter'}
          verdi={visProsent(snittAndre)}
          infoTittel={'Om snittet hos andre virksomheter'}
          info={
            'Gjennomsnittlig bruddandel hos de øvrige virksomhetene i denne ' +
            'sammenligningen. Hver virksomhet teller like mye, uavhengig av ' +
            'hvor mange erklæringer den har.'
          }
        />
        <Noekkeltall
          tekst={'Vår plassering'}
          verdi={plassering ? `${plassering} av ${antallSammenlignet}` : '–'}
          infoTittel={'Om plasseringen'}
          info={
            'Rangering etter bruddandel blant virksomhetene i sammenligningen. ' +
            'Lavest bruddandel gir første plass.'
          }
        />
      </div>

      {vaarAndel !== null && snittAndre !== null && (
        <Paragraph hasSpacing>
          {bedreEnnSnitt
            ? `Skatteetaten har lavere bruddandel enn gjennomsnittet av de ${antallSammenlignet - 1} andre virksomhetene i sammenligningen.`
            : `Skatteetaten har høyere bruddandel enn gjennomsnittet av de ${antallSammenlignet - 1} andre virksomhetene i sammenligningen.`}
        </Paragraph>
      )}

      <div className={styles.filter}>
        <Checkbox
          checked={skjulKommunale}
          onChange={(e) => setSkjulKommunale(e.currentTarget.checked)}
        >
          {'Skjul kommuner og fylkeskommuner'}
        </Checkbox>
      </div>

      {/* Rekkefølgen er selve poenget med tabellen, men ingenting sa det.
          Tabellen har ingen sorteringsknapper, så den som ikke gjetter at
          radene er rangert, leser den som en vilkårlig liste.

          Teksten sto allerede i caption, men designsystemet skjuler caption som
          standard, og med showCaption legger det den UNDER tabellen i grå
          kursiv – den er laget som en fotnote. En sorteringsforklaring kommer
          for sent der. Derfor et vanlig avsnitt over, som resten av siden.

          Uten tall: setningen sier hvordan tabellen er ordnet, og det er sant
          uansett hva boksen over står på. Et antall her ville endret seg ved
          avkryssing, og da leser en skjermleserbruker en setning som er ny uten
          at noe sa fra. Antallet står uansett i tabellen.

          Captionen beholder en kort form, ellers ville den samme setningen
          kommet to ganger: i leserekkefølgen, og ved inngangen til tabellen. */}
      <Paragraph hasSpacing>
        {'Virksomhetene er sortert fra lavest bruddandel til høyest.'}
      </Paragraph>

      <Table caption={'Bruddandel per virksomhet'} hasFullWidth>
        <Table.Header>
          <Table.Row>
            {/* Se status.tsx: utvidingskolonnen må ha egen overskriftscelle,
                ellers forskyves alle overskriftene. */}
            <Table.HeaderCell>
              <span className={felles.srOnly}>{'Vis detaljer'}</span>
            </Table.HeaderCell>
            <Table.HeaderCell>{'Virksomhet'}</Table.HeaderCell>
            <Table.HeaderCell alignment={'right'}>
              <span className={felles.medInfo}>
                {'Erklæringer'}
                <Infoboks tittel={'Om antall erklæringer'}>
                  {'Antall unike tilgjengelighetserklæringer som hører til ' +
                    'virksomheten. Én erklæring gjelder normalt én digital løsning.'}
                </Infoboks>
              </span>
            </Table.HeaderCell>
            <Table.HeaderCell alignment={'right'}>
              <span className={felles.medInfo}>
                {'Brudd / snitt'}
                <Infoboks tittel={'Om brudd og snitt'}>
                  {'Totalt antall rapporterte brudd, og gjennomsnittet per ' +
                    'erklæring for virksomheten.'}
                </Infoboks>
              </span>
            </Table.HeaderCell>
            <Table.HeaderCell alignment={'right'}>
              <span className={felles.medInfo}>
                {'Bruddandel'}
                <Infoboks tittel={'Om bruddandel'}>
                  {`Brudd delt på (antall erklæringer × ${ANTALL_KRAV}). Fast ` +
                    'grunnlag gjør tallene sammenlignbare på tvers av virksomheter ' +
                    'med ulikt antall løsninger.'}
                </Infoboks>
              </span>
            </Table.HeaderCell>
            <Table.HeaderCell>
              <span className={felles.medInfo}>
                {'Sist oppdatert'}
                <Infoboks tittel={'Om sist oppdatert'}>
                  {'Datoen for den nyeste oppdateringen blant erklæringene som ' +
                    'inngår for virksomheten.'}
                </Infoboks>
              </span>
            </Table.HeaderCell>
          </Table.Row>
        </Table.Header>
        <Table.Body>
          {rader.map((r) => (
            <Table.Row
              key={r.key}
              isExpandable
              // Se status.tsx: designsystemets egen tekst brukes, radens navn
              // kobles på med aria-describedby.
              expandButtonAriaDescribedby={`virksomhet-${r.key}`}
              expandableContent={
                <div className={`${styles.detaljer} ${felles.utvidetInnhold}`}>
                  <Paragraph>
                    {`Bruddandelen er ${r.brudd} brudd delt på ${r.erklaeringer} erklæringer × ${ANTALL_KRAV} krav.`}
                  </Paragraph>
                  <Heading as={'h3'} level={4} hasSpacing>
                    {`Erklæringer (${r.erklaeringsUrler.length})`}
                  </Heading>
                  <Lenkeliste lenker={r.erklaeringsUrler} />
                </div>
              }
            >
              <Table.DataCell
                as={'th'}
                scope={'row'}
                id={`virksomhet-${r.key}`}
              >
                <span className={styles.virksomhet}>
                  {r.navn}
                  {r.key === 'skatteetaten' && (
                    <Tag color={'denim'} size={'small'}>
                      {'Oss'}
                    </Tag>
                  )}
                </span>
              </Table.DataCell>
              <Table.DataCell alignment={'right'}>{r.erklaeringer}</Table.DataCell>
              <Table.DataCell alignment={'right'}>
                {`${r.brudd} / ${desimalFormat.format(r.snitt)}`}
              </Table.DataCell>
              <Table.DataCell alignment={'right'}>
                {visProsent(r.bruddandel)}
              </Table.DataCell>
              <Table.DataCell>{visDato(r.sistOppdatert)}</Table.DataCell>
            </Table.Row>
          ))}
        </Table.Body>
      </Table>

      <Heading as={'h3'} level={3} hasSpacing className={styles.metodetittel}>
        {'Metode og forbehold'}
      </Heading>
      <List>
        <List.Element>
          {'Data er hentet fra tilgjengelighetserklæringer og er selvrapportert av virksomhetene.'}
        </List.Element>
        <List.Element>
          {'Én erklæring gjelder normalt én digital løsning. Antall erklæringer sier derfor mest om omfanget av løsninger.'}
        </List.Element>
        <List.Element>
          {`Bruddandel beregnes med fast grunnlag: brudd delt på (antall erklæringer × ${ANTALL_KRAV}).`}
        </List.Element>
        <List.Element>
          {'Virksomheter fyller ut erklæringene ulikt. Noen dekker mange løsninger eller et større omfang enn andre, og det påvirker sammenligningen.'}
        </List.Element>
        <List.Element>
          {'Tallene gir et sammenligningsgrunnlag, men sier ikke nødvendigvis noe om faktisk brukeropplevelse.'}
        </List.Element>
      </List>

      <Paragraph className={styles.kilde}>
        {`Datakilde: Digitaliseringsdirektoratets åpne datasett over tilgjengelighetserklæringer, ${poster.length} erklæringer totalt.`}
      </Paragraph>
    </>
  );
}
