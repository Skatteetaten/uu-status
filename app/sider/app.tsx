import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { Tabs } from '@skatteetaten/ds-collections';

import '@skatteetaten/ds-core-designtokens/index.css';

import { AbonnerLenke } from '../komponenter/AbonnerLenke';
import { Sideramme } from '../komponenter/Sideramme';
import { overstyrDsTekster } from '../lib/ds-tekster';
import { monter } from '../lib/monter';
import { Statusoversikt } from './status';
import { Endringsarkiv } from './arkiv';
import { Sammenligning } from './benchmark';

import styles from './app.module.scss';

const FANER = [
  { verdi: 'statusoversikt', tekst: 'Statusoversikt' },
  { verdi: 'endringsarkiv', tekst: 'Endringsarkiv' },
  { verdi: 'sammenligning', tekst: 'Sammenligning' },
] as const;

const STANDARD = FANER[0].verdi;

function fraHash(): string {
  const h = window.location.hash.replace(/^#/, '');
  return FANER.some((f) => f.verdi === h) ? h : STANDARD;
}

export function App(): ReactElement {
  const [aktiv, setAktiv] = useState<string>(fraHash);

  // Fanene er dyplenkbare. Sammenligningsfanen laster 4 MB, så det er greit
  // å kunne peke rett til den – og de gamle URL-ene viderekobles hit.
  useEffect(() => {
    const lytt = (): void => setAktiv(fraHash());
    window.addEventListener('hashchange', lytt);
    return () => window.removeEventListener('hashchange', lytt);
  }, []);

  const velg = (verdi: string): void => {
    setAktiv(verdi);
    // replaceState framfor å sette location.hash: da fyller ikke fanebytter
    // opp nettleserhistorikken med mellomsteg.
    window.history.replaceState(null, '', `#${verdi}`);
  };

  // Panelene monteres først når fanen har vært åpnet. Ellers ville alle tre
  // hentet data ved sidelast, inkludert det store datasettet til
  // sammenligningen. Etter første besøk blir panelet stående montert, så
  // filtre og sortering overlever fanebytte.
  const [besokt, setBesokt] = useState<Set<string>>(new Set([fraHash()]));
  useEffect(() => {
    setBesokt((f) => (f.has(aktiv) ? f : new Set(f).add(aktiv)));
  }, [aktiv]);

  return (
    <Sideramme>
      {/* Abonnement på varsler. Rendrer ingenting så lenge funksjonsbryteren
          i app/lib/abonnement.ts er av – ingen tom plass, ikke noe element. */}
      <AbonnerLenke />
      {/* isMultiline: uten den ligger fanene på én linje med nowrap, og på
          smal skjerm stikker den siste utenfor og gir vannrett rulling. */}
      <Tabs value={aktiv} onChange={velg} isMultiline>
        <Tabs.List ariaLabel={'Seksjoner i UU-status'}>
          {FANER.map((f) => (
            <Tabs.Tab key={f.verdi} value={f.verdi}>
              {f.tekst}
            </Tabs.Tab>
          ))}
        </Tabs.List>

        <Tabs.Panel value={'statusoversikt'} className={styles.panel}>
          {besokt.has('statusoversikt') && <Statusoversikt />}
        </Tabs.Panel>
        <Tabs.Panel value={'endringsarkiv'} className={styles.panel}>
          {besokt.has('endringsarkiv') && <Endringsarkiv />}
        </Tabs.Panel>
        <Tabs.Panel value={'sammenligning'} className={styles.panel}>
          {besokt.has('sammenligning') && <Sammenligning />}
        </Tabs.Panel>
      </Tabs>
    </Sideramme>
  );
}

overstyrDsTekster();
monter(<App />);
