import { useEffect, useState } from 'react';
import { RecompDB } from '../db/db';
import { Repo } from '../db/repo';
import { ImportScreen } from './ImportScreen';
import { RecentView } from './RecentView';

type Tab = 'import' | 'recent';

export function App() {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('import');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    Repo.open(new RecompDB()).then(setRepo, (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  return (
    <div className="app">
      <header>
        <h1>Recomp</h1>
        <p className="muted">Stage 1: import and verify. Data stays in this browser.</p>
        <nav aria-label="Sections">
          <button aria-current={tab === 'import'} onClick={() => setTab('import')}>Import</button>
          <button aria-current={tab === 'recent'} onClick={() => setTab('recent')}>Recent (28 days)</button>
        </nav>
      </header>
      <main>
        {error && (
          <p role="alert" className="error">
            Storage unavailable: {error}. Nothing can be saved in this browser session.
          </p>
        )}
        {!repo && !error && <p>Opening local database...</p>}
        {repo && tab === 'import' && <ImportScreen repo={repo} onCommitted={() => setVersion((v) => v + 1)} />}
        {repo && tab === 'recent' && <RecentView repo={repo} version={version} />}
      </main>
    </div>
  );
}
