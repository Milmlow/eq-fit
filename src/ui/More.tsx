import { useState, type ReactNode } from 'react';
import type { Repo } from '../db/repo';
import type { ThemeName, ThemePref } from '../lib/theme';
import { ImportScreen } from './ImportScreen';
import { RecentView } from './RecentView';
import { BackupSection } from './BackupSection';
import { CheckIn } from './CheckIn';
import { BackupBanner } from './Banners';
import { ScreenHead } from './Screen';
import { usePwa } from '../pwa';
import { APP_VERSION } from '../lib/backup';
import type { PersistState } from '../lib/storage';

type Sub = 'menu' | 'import' | 'recent' | 'checkin';

const PREVIEWS: { pref: ThemeName; label: string }[] = [{ pref: 'light', label: 'Light' }, { pref: 'dark', label: 'Dark' }, { pref: 'crazy', label: 'Crazy' }];

function Row({ title, note, children }: { title: string; note: string; children: ReactNode }) {
  return (
    <li className="rrow">
      <div className="rrow-t"><p className="rrow-n">{title}</p><p className="muted small flush">{note}</p></div>
      {children}
    </li>
  );
}

export function More({ repo, version, onChanged, pref, onPref, persisted, demo, onDemo, today, lastBackup, onBackedUp, persist, onAskPersist }: {
  repo: Repo | null; version: number; onChanged: () => void; pref: ThemePref; onPref: (p: ThemePref) => void; persisted: boolean; demo: boolean; onDemo: (d: boolean) => void;
  today: string; lastBackup: string | null; onBackedUp: (iso: string) => void; persist: PersistState | null; onAskPersist: () => void;
}) {
  const [sub, setSub] = useState<Sub>('menu');
  const pwa = usePwa();
  if (sub !== 'menu') {
    return (
      <section aria-labelledby="more-h" className="screen">
        <ScreenHead id="more-h" title={sub === 'import' ? 'Import' : sub === 'recent' ? 'Recent' : 'Check-in'} today={today} />
        <button type="button" onClick={() => setSub('menu')}>Back to More</button>
        {repo && sub === 'import' && <ImportScreen repo={repo} onCommitted={onChanged} />}
        {repo && sub === 'recent' && <RecentView repo={repo} version={version} />}
        {repo && sub === 'checkin' && <CheckIn repo={repo} today={today} version={version} onChanged={onChanged} compact={false} />}
        {!repo && <p>Opening local database...</p>}
      </section>
    );
  }

  const rowsBefore = (
    <>
      <Row title="Import activities" note="Garmin CSV, duplicates skipped"><button type="button" className="b44" onClick={() => setSub('import')}>Import</button></Row>
      <Row title="Recent, last 28 days" note="Lifts, runs and totals"><button type="button" className="b44" onClick={() => setSub('recent')}>Recent</button></Row>
      <Row title="Check-in" note="Weight and waist"><button type="button" className="b44" onClick={() => setSub('checkin')}>Check-in</button></Row>
    </>
  );
  const rowsAfter = (
    <Row title="Demo mode" note="Reference numbers, writes nothing">
      <label className="chip demo-chip"><input type="checkbox" role="switch" checked={demo} onChange={(e) => onDemo(e.target.checked)} /><span>{demo ? 'On' : 'Off'}<span className="sr"> (demo mode)</span></span></label>
    </Row>
  );

  return (
    <section aria-labelledby="more-h" className="screen">
      <ScreenHead id="more-h" title="More" today={today} />
      {repo && <BackupBanner repo={repo} version={version} lastBackup={lastBackup} />}

      <fieldset className="look">
        <legend>Look</legend>
        <div className="tpv-grid" role="radiogroup" aria-label="Theme">
          {PREVIEWS.map((t) => (
            <label key={t.pref} className={`tpv${pref === t.pref ? ' on' : ''}`}>
              <input type="radio" name="theme" value={t.pref} checked={pref === t.pref} onChange={() => onPref(t.pref)} />
              <span className={`tp tp-${t.pref}`}>
                <span className="tp-bar" aria-hidden="true" />
                <span className="tp-name">{t.label}{pref === t.pref ? ' · on' : ''}</span>
              </span>
            </label>
          ))}
        </div>
        <label className={`tpv-sys${pref === 'system' ? ' on' : ''}`}>
          <input type="radio" name="theme" value="system" checked={pref === 'system'} onChange={() => onPref('system')} />
          <span>Follow my device's light or dark setting{pref === 'system' ? ' · on' : ''}</span>
        </label>
        <p className="muted small">System follows your device's light or dark setting (never Crazy). Dark is used until you choose.</p>
        {!persisted && <p role="alert" className="error">This browser would not save the choice; it applies until you close the page.</p>}
      </fieldset>

      {repo
        ? <BackupSection repo={repo} today={today} lastBackup={lastBackup} onBackedUp={onBackedUp} onRestored={onChanged} persist={persist} onAskPersist={onAskPersist} rowsBefore={rowsBefore} rowsAfter={rowsAfter} />
        : <><p>Opening local database... Backup is available once it opens.</p><ul className="rows">{rowsBefore}{rowsAfter}</ul></>}

      <p className="muted small" data-testid="app-info">
        EQ Fit version {APP_VERSION}.{' '}
        {!pwa.supported ? 'Offline install is not supported by this browser.' : pwa.offlineReady ? 'Ready to work offline.' : 'Offline copy not stored yet (it is stored after the first load over http(s), not in development).'}
      </p>
    </section>
  );
}
