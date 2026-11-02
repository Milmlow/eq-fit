import { useEffect, useState } from 'react';
import { RecompDB } from '../db/db';
import { Repo } from '../db/repo';
import { demoFromSearch } from '../lib/demo';
import { Lifting } from './Lifting';
import { More } from './More';
import { Running } from './Running';
import { TabBar, type Tab } from './TabBar';
import { DemoToday, Today } from './Today';
import { useTheme } from './useTheme';
import { Week } from './Week';
import { localToday } from '../lib/today';

export function App() {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [version, setVersion] = useState(0);
  const [demo, setDemo] = useState(() => demoFromSearch(window.location.search));
  const { pref, theme, setPref, persisted } = useTheme();
  const today = localToday();
  const bump = () => setVersion((v) => v + 1);

  useEffect(() => {
    Repo.open(new RecompDB()).then(setRepo, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="app">
      {tab !== 'today' && (
        <header className="app-head"><p className="wordmark sm" aria-hidden="true">EQ FIT</p></header>
      )}
      <main id="main">
        {error && (
          <p role="alert" className="error">
            Storage unavailable: {error}. Nothing can be saved in this browser session.
          </p>
        )}
        {!repo && !error && tab !== 'more' && !demo && <p>Opening local database...</p>}
        {tab === 'today' && demo && <DemoToday theme={theme} onDemoOff={() => setDemo(false)} />}
        {tab === 'today' && !demo && repo && <Today repo={repo} today={today} version={version} onChanged={bump} theme={theme} />}
        {repo && tab === 'week' && <Week repo={repo} today={today} version={version} onChanged={bump} />}
        {repo && tab === 'lift' && <Lifting repo={repo} version={version} onChanged={bump} />}
        {repo && tab === 'run' && <Running repo={repo} today={today} version={version} />}
        {tab === 'more' && <More repo={repo} version={version} onChanged={bump} pref={pref} onPref={setPref} persisted={persisted} demo={demo} onDemo={setDemo} />}
      </main>
      <TabBar tab={tab} onTab={setTab} />
    </div>
  );
}
