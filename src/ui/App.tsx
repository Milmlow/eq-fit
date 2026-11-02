import { useEffect, useState } from 'react';
import { RecompDB } from '../db/db';
import { Repo } from '../db/repo';
import { ImportScreen } from './ImportScreen';
import { RecentView } from './RecentView';
import { Running } from './Running';
import { Today } from './Today';
import { Week } from './Week';
import { localToday } from '../lib/today';

type Tab = 'today' | 'week' | 'running' | 'import' | 'recent';
const TABS: [Tab, string][] = [['today', 'Today'], ['week', 'Week'], ['running', 'Running'], ['import', 'Import'], ['recent', 'Recent (28 days)']];

export function App() {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [version, setVersion] = useState(0);
  const today = localToday();
  const bump = () => setVersion((v) => v + 1);

  useEffect(() => {
    Repo.open(new RecompDB()).then(setRepo, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Recomp</h1>
        <p className="muted">Stage 2: training. Data stays in this browser.</p>
        <nav aria-label="Sections">
          {TABS.map(([t, label]) => (
            <button key={t} aria-current={tab === t} onClick={() => setTab(t)}>{label}</button>
          ))}
        </nav>
      </header>
      <main>
        {error && (
          <p role="alert" className="error">
            Storage unavailable: {error}. Nothing can be saved in this browser session.
          </p>
        )}
        {!repo && !error && <p>Opening local database...</p>}
        {repo && tab === 'today' && <Today repo={repo} today={today} version={version} onChanged={bump} />}
        {repo && tab === 'week' && <Week repo={repo} today={today} version={version} onChanged={bump} />}
        {repo && tab === 'running' && <Running repo={repo} today={today} version={version} />}
        {repo && tab === 'import' && <ImportScreen repo={repo} onCommitted={bump} />}
        {repo && tab === 'recent' && <RecentView repo={repo} version={version} />}
      </main>
    </div>
  );
}
