import { useState } from 'react';
import type { Repo } from '../db/repo';
import { THEME_PREFS, type ThemePref } from '../lib/theme';
import { ImportScreen } from './ImportScreen';
import { RecentView } from './RecentView';

type Sub = 'menu' | 'import' | 'recent';

export function More({ repo, version, onChanged, pref, onPref, persisted, demo, onDemo }: {
  repo: Repo | null; version: number; onChanged: () => void; pref: ThemePref; onPref: (p: ThemePref) => void; persisted: boolean; demo: boolean; onDemo: (d: boolean) => void;
}) {
  const [sub, setSub] = useState<Sub>('menu');
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
        <li><span>Backup <span className="muted">(not built yet)</span></span><button type="button" disabled aria-disabled="true">Backup</button></li>
      </ul>

      <div className="card">
        <label className="check">
          <input type="checkbox" checked={demo} onChange={(e) => onDemo(e.target.checked)} />
          Demo mode (reference values for screenshots; writes nothing)
        </label>
      </div>
    </section>
  );
}
