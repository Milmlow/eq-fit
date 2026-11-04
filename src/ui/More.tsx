import { Feedback } from './Feedback';
import { useState } from 'react';
import type { Repo } from '../db/repo';
import { THEME_PREFS, type ThemePref } from '../lib/theme';
import { ImportScreen } from './ImportScreen';
import { RecentView } from './RecentView';
import { BackupSection } from './BackupSection';
import { BackupBanner } from './Banners';
import { refreshApp, usePwa } from '../pwa';
import { APP_VERSION } from '../lib/backup';
import type { PersistState } from '../lib/storage';

type Sub = 'menu' | 'import' | 'recent';

export function More({ repo, version, onChanged, pref, onPref, persisted, demo, onDemo, today, lastBackup, onBackedUp, persist, onAskPersist }: {
  repo: Repo | null; version: number; onChanged: () => void; pref: ThemePref; onPref: (p: ThemePref) => void; persisted: boolean; demo: boolean; onDemo: (d: boolean) => void;
  today: string; lastBackup: string | null; onBackedUp: (iso: string) => void; persist: PersistState | null; onAskPersist: () => void;
}) {
  const [sub, setSub] = useState<Sub>('menu');
  const pwa = usePwa();
  const [refreshing,setRefreshing]=useState(false);
  const [refreshError,setRefreshError]=useState('');
  async function refresh() {
    if(refreshing)return;
    setRefreshing(true);setRefreshError('');
    try { await refreshApp(); } catch(e) { setRefreshError(e instanceof Error?e.message:'Could not refresh. Please try again.'); }
    finally { setRefreshing(false); }
  }
  if (sub !== 'menu') {
    return (
      <section aria-label={sub === 'import' ? 'Import' : 'Recent'}>
        <button type="button" onClick={() => setSub('menu')}>Back to More</button>
        {repo && sub === 'import' && <ImportScreen repo={repo} onCommitted={onChanged} />}
        {repo && sub === 'recent' && <RecentView repo={repo} version={version} />}
        {!repo && <p>Opening local database...</p>}
      </section>
    );
  }
  return (
    <section aria-labelledby="more-h">
      <h2 id="more-h">More</h2>
      <section className="card" aria-labelledby="setup-heading">
        <h3 id="setup-heading">Setup</h3>
        <button type="button" className="primary" disabled={refreshing} onClick={()=>void refresh()}>{refreshing?'Checking for updates…':'↻ Refresh app'}</button>
        <p className="muted small">Get the latest version and reload. Saved workouts, Garmin connection and settings stay on this device. Finish any unsaved edits first.</p>
        {refreshing&&<p role="status">Checking and downloading the latest app…</p>}
        {refreshError&&<p role="alert">{refreshError}</p>}
      </section>
      <Feedback />
      {repo && <BackupBanner repo={repo} version={version} lastBackup={lastBackup} />}
      <fieldset className="card themes">
        <legend>Theme</legend>
        <div className="seg" role="radiogroup" aria-label="Theme">
          {THEME_PREFS.map((t) => (
            <label key={t.pref} className={`seg-item${pref === t.pref ? ' on' : ''}`}>
              <input type="radio" name="theme" value={t.pref} checked={pref === t.pref} onChange={() => onPref(t.pref)} />
              <span>{t.label}</span>
            </label>
          ))}
        </div>
        <p className="muted">System follows your device's light or dark setting. Dark is used until you choose.</p>
        {!persisted && <p role="alert" className="error">This browser would not save the choice; it applies until you close the page.</p>}
      </fieldset>

      <ul className="items more-list">
        <li><span>Import activities (CSV)</span><button type="button" onClick={() => setSub('import')}>Import</button></li>
        <li><span>Recent (28 days)</span><button type="button" onClick={() => setSub('recent')}>Recent</button></li>
      </ul>

      {repo && <BackupSection repo={repo} today={today} lastBackup={lastBackup} onBackedUp={onBackedUp} onRestored={onChanged} persist={persist} onAskPersist={onAskPersist} />}
      {!repo && <p>Opening local database... Backup is available once it opens.</p>}

      <div className="card">
        <label className="check">
          <input type="checkbox" checked={demo} onChange={(e) => onDemo(e.target.checked)} />
          Demo mode (reference values for screenshots; writes nothing)
        </label>
      </div>

      <p className="muted" data-testid="app-info">
        EQ Fit version {APP_VERSION}.{' '}
        {!pwa.supported ? 'Offline install is not supported by this browser.' : pwa.offlineReady ? 'Ready to work offline.' : 'Offline copy not stored yet (it is stored after the first load over http(s), not in development).'}
      </p>
    </section>
  );
}
