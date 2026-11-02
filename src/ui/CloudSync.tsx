import { useCallback, useEffect, useRef, useState } from 'react';
import type { Repo } from '../db/repo';
import { cloud, cloudOwner, parseSyncState, type SyncState } from '../lib/cloud';
import { applyCloudRows, prepareCloudRows, garminId, type PendingRun } from '../lib/cloudImport';
import { backupFileName, serializeBackup } from '../lib/backup';
import { saveTextFile } from '../lib/download';

export function CloudSync({ repo, onChanged }: { repo: Repo; onChanged: () => void }) {
  const [signedIn, setSignedIn] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [state, setState] = useState<SyncState | null>(() => {
    try { return parseSyncState(JSON.parse(localStorage.getItem(`eqfit.sync-status:${cloudOwner}`) || 'null')); } catch { return null; }
  });
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<PendingRun[]>([]);
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [backedUp, setBackedUp] = useState(false);
  const [backupCreated, setBackupCreated] = useState(false);
  const locked = useRef(false);
  const owner = useRef<string | null>(null);
  const refresh = useCallback(async () => {
    if (!cloud || owner.current !== cloudOwner || locked.current || !navigator.onLine) return;
    locked.current = true; setBusy(true);
    try {
      const { data, error } = await cloud.rpc('eqfit_snapshot');
      if (error || !data || typeof data !== 'object') throw new Error();
      const nextState = parseSyncState(data.state);
      const prepared = await prepareCloudRows(data.rows, repo);
      if (owner.current !== cloudOwner) return;
      const result = await applyCloudRows(repo, prepared, owner.current!);
      setPending(result.pending); setState(nextState); setMessage('');
      try { localStorage.setItem(`eqfit.sync-status:${cloudOwner}`, JSON.stringify(nextState)); } catch { /* Records remain in IndexedDB. */ }
      if (result.changed) onChanged();
    } catch { setMessage('Could not refresh private runs. Your saved history is available; retry when online or sign in again.'); }
    finally { locked.current = false; setBusy(false); }
  }, [repo, onChanged]);
  useEffect(() => {
    if (!cloud) return;
    let live = true;
    const accept = (id: string | null) => {
      if (!live) return;
      owner.current = id === cloudOwner ? id : null;
      setSignedIn(owner.current !== null);
      if (id && id !== cloudOwner) setMessage('This account is not the configured EQ Fit owner.');
    };
    const url = new URL(window.location.href);
    const token = url.searchParams.get('token_hash');
    if (token) {
      // Remove the one-time credential from the address before making any request.
      url.searchParams.delete('token_hash');
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
      void cloud.auth.verifyOtp({ token_hash: token, type: 'magiclink' }).then(({ data, error }) => {
        if (live && error) setMessage('This sign-in link has expired or was already used. Use your password or request a fresh link.');
        accept(data.session?.user.id ?? null);
      });
    } else void cloud.auth.getSession().then(({ data }) => accept(data.session?.user.id ?? null));
    const { data } = cloud.auth.onAuthStateChange((_event, session) => accept(session?.user.id ?? null));
    return () => { live = false; owner.current = null; data.subscription.unsubscribe(); };
  }, []);
  useEffect(() => {
    if (!signedIn) return;
    void refresh();
    const resume = () => { if (document.visibilityState === 'visible') void refresh(); };
    window.addEventListener('online', resume); document.addEventListener('visibilitychange', resume);
    const timer = window.setInterval(resume, 60_000);
    return () => { clearInterval(timer); window.removeEventListener('online', resume); document.removeEventListener('visibilitychange', resume); };
  }, [signedIn, refresh]);
  if (!cloud) return <p className="muted small">Garmin automatic sync is not connected. Running figures use records saved on this device.</p>;
  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage('');
    try {
      const { error } = await cloud!.auth.signInWithPassword({ email, password });
      if (error) setMessage('Could not sign in. Check your credentials and connection.');
    } catch { setMessage('Could not sign in. Please retry when online.'); }
    finally { setBusy(false); setPassword(''); }
  }
  async function backup() {
    try { saveTextFile(backupFileName(new Date()), serializeBackup(await repo.exportBackup()), 'application/json'); setBackupCreated(true); setBackedUp(false); }
    catch { setMessage('Backup could not be created. No reconciliation was applied.'); }
  }
  async function reconcile() {
    if (locked.current || !backedUp || owner.current !== cloudOwner) return;
    locked.current = true; setBusy(true);
    try {
      const result = await applyCloudRows(repo, pending.map(p => p.incoming), owner.current!, choices);
      setPending(result.pending); setChoices({}); setBackedUp(false); setBackupCreated(false); onChanged();
    } catch { setMessage('Could not apply your choices. Your existing records were retained.'); }
    finally { locked.current = false; setBusy(false); }
  }
  const stale = state?.last_success ? Date.now() - Date.parse(state.last_success) > 3 * 3600_000 : true;
  return <details className="card"><summary>Garmin · {signedIn ? busy ? 'Checking…' : pending.length ? `Review ${pending.length} overlaps` : stale || state?.status === 'failed' ? 'Needs attention' : 'Connected' : 'Sign in once'}</summary>
    {!signedIn ? <form onSubmit={e => void login(e)}><p>Sign in to your private EQ Fit account. Your session is remembered on this trusted device.</p><label className="field">Email<input type="email" autoComplete="username" required value={email} onChange={e => setEmail(e.target.value)} /></label><label className="field">Password<input type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></label><button disabled={busy}>Sign in</button></form> : <>
      <p>Last successful Garmin sync: <strong>{state?.last_success ? new Date(state.last_success).toLocaleString() : 'Not verified yet'}</strong></p>
      <p className="muted">Garmin is checked hourly; scheduled jobs can be delayed. This app retrieves private runs automatically when opened or resumed. Lifting history stays on this device.</p>
      {(stale || state?.status === 'failed') && <p className="warn">Garmin updates are overdue or the last attempt failed. Saved runs are still available.</p>}
      <button disabled={busy} onClick={() => void refresh()}>Refresh private records</button>{' '}
      <button disabled={busy} onClick={() => { owner.current = null; setSignedIn(false); setState(null); setPending([]); void cloud!.auth.signOut({ scope: 'local' }); }}>Sign out</button><p className="muted small">Sign-out keeps downloaded history for offline use. Use this app only on devices you trust.</p>
      <details><summary>Set a password for your other devices</summary><form onSubmit={e => { e.preventDefault(); setBusy(true); void cloud!.auth.updateUser({ password: newPassword }).then(({ error }) => { setMessage(error ? 'Could not save the password. Please retry.' : 'Password saved. You can now sign in on your other devices.'); setNewPassword(''); }).catch(() => setMessage('Could not save the password. Please retry when online.')).finally(() => setBusy(false)); }}><label className="field">New password<input type="password" autoComplete="new-password" minLength={12} required value={newPassword} onChange={e => setNewPassword(e.target.value)} /></label><button disabled={busy}>Save password</button></form></details>
    </>}
    {message && <p role="alert" className="error">{message}</p>}
    {signedIn && pending.length > 0 && <section><h3>Review {pending.length} possible overlaps</h3><p>These incoming runs are held out of totals. Your existing records remain. Choose only when you recognise the same run.</p>
      {pending.map(p => { const id = garminId(p.incoming)!; const duplicateIds = p.candidates.filter(c => garminId(c) === id).length > 1; return <div className="card" key={id}><strong>{p.incoming.timestamp_local} · {p.incoming.title} · {p.incoming.distance_km ?? 'unknown'} km</strong>
        {duplicateIds ? <p className="warn">Multiple existing records already contain this Garmin ID. This requires a separate repair; no records were changed.</p> : <label className="field">Which record is this?<select value={choices[id] ?? ''} onChange={e => setChoices({ ...choices, [id]: e.target.value })}><option value="">Leave for later</option><option value="separate">A separate run — keep both</option>{p.candidates.map(c => <option value={c.id} key={c.id}>{c.timestamp_local} · {c.title} · {c.distance_km ?? 'unknown'} km</option>)}</select></label>}
      </div>; })}
      <button onClick={() => void backup()} disabled={busy}>Download backup before review</button>
      <label className="check"><input type="checkbox" disabled={!backupCreated} checked={backedUp} onChange={e => setBackedUp(e.target.checked)} />I have saved the downloaded backup and checked these choices.</label>
      <button disabled={busy || !backedUp || !Object.values(choices).some(Boolean)} onClick={() => void reconcile()}>Apply selected matches</button>
    </section>}
  </details>;
}
