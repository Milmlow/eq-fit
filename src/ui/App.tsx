import { useCallback, useEffect, useState } from 'react';
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
import { CloudSync } from './CloudSync';
import { localToday } from '../lib/today';
import { loadLastBackup, requestPersistence, saveLastBackup, watchStorageErrors, type PersistState } from '../lib/storage';
import { BackupBanner, StorageWarning, UpdateBanner } from './Banners';

const ls = () => { try { return window.localStorage; } catch { return null; } };

export function App({ trialRepo }: { trialRepo?: Repo } = {}) {
  const [repo, setRepo] = useState<Repo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('today');
  const [version, setVersion] = useState(0);
  const [demo, setDemo] = useState(() => demoFromSearch(window.location.search));
  const { pref, theme, setPref, persisted } = useTheme();
  const [lastBackup, setLastBackup] = useState<string | null>(() => loadLastBackup(ls()));
  const [persist, setPersist] = useState<PersistState | null>(null);
  const today = localToday();
  const bump = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    if (trialRepo) { setRepo(watchStorageErrors(trialRepo)); return; }
    Repo.open(new RecompDB()).then((r) => setRepo(watchStorageErrors(r)), (e: unknown) => setError(e instanceof Error ? e.message : String(e)));
    void requestPersistence().then(setPersist);
  }, [trialRepo]);
  const onBackedUp = (iso: string) => { saveLastBackup(ls(), iso); setLastBackup(iso); };

  return (
    <div className="app">
      {tab !== 'today' && (
        <header className="app-head"><p className="wordmark sm" aria-hidden="true">EQ FIT</p></header>
      )}
      <main id="main">
        <UpdateBanner />
        <StorageWarning />
        {repo && !demo && !trialRepo && <CloudSync repo={repo} onChanged={bump} />}
        {repo && !demo && tab === 'today' && <BackupBanner repo={repo} version={version} lastBackup={lastBackup} onGo={() => setTab('more')} />}
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
        {tab === 'more' && (
          <More repo={repo} version={version} onChanged={bump} pref={pref} onPref={setPref} persisted={persisted} demo={demo} onDemo={setDemo}
            today={today} lastBackup={lastBackup} onBackedUp={onBackedUp} persist={persist} onAskPersist={() => void requestPersistence().then(setPersist)} />
        )}
      </main>
      <TabBar tab={tab} onTab={setTab} />
    </div>
  );
}
