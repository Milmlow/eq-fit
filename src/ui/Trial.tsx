import { useState } from 'react';
import { Repo } from '../db/repo';
import { RecompDB } from '../db/db';
import { applyCloudRows, prepareTrialRows } from '../lib/cloudImport';
import { App } from './App';
import { FOCUS_OPTIONS, parseFocus, readFocus, saveFocus, type DashboardFocus } from '../lib/dashboardFocus';
import { IconRun } from './Icons';

export async function trialDatabaseName(key: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key.trim()));
  return 'eqfit-trial-'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export function Trial() {
  const [invite] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('invite') || '');
  const [focus,setFocus]=useState<DashboardFocus>(()=>parseFocus(new URLSearchParams(window.location.search).get('focus'))??'strength-cardio');
  const [focusTouched,setFocusTouched]=useState(false);
  const [key,setKey] = useState('');
  const [repo,setRepo] = useState<Repo|null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  async function connect(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    const credential = key.trim(); setKey('');
    let stage:'network'|'storage'|'import'='network';
    try {
      const response = await fetch('https://hihqnnxnlkjfbixhcgaa.supabase.co/functions/v1/garmin-trial',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+invite},body:JSON.stringify({key:credential,training:true}),cache:'no-store',signal:AbortSignal.timeout(60000)});
      const data = await response.json();
      if (!response.ok) { setMessage(typeof data.error === 'string' ? data.error : 'Could not import. Please retry.'); return; }
      stage='storage';
      const r = await Repo.open(new RecompDB(await trialDatabaseName(credential)));
      stage='import';
      const rows = await prepareTrialRows(data.rows,r);
      const result = await applyCloudRows(r,rows,'local-trial');
      if (result.pending.length) { r.db.close(); throw new Error(); }
      saveFocus(r.db.name,focusTouched?focus:readFocus(r.db.name,`?focus=${focus}`));
      setRepo(r);
      setMessage(rows.length?`${rows.length} activities · last 90 days`:'Connected · no supported activities in the last 90 days. You can still log strength sessions.');
    } catch { setMessage(stage==='storage'?'Garmin connected, but Safari could not open local storage. Try a normal Safari tab and check available device storage.':stage==='import'?'Garmin connected, but the returned activities could not be saved. Your existing history is unchanged.':'Could not reach the import service. Check your connection and paste your key to retry.'); }
    finally { setBusy(false); }
  }
  if (repo) return <App trialRepo={repo} trialControls={<details className="card"><summary>Garmin import</summary><p>{message}</p><p className="muted small">Activities stay in this browser. Paste your key again to refresh.</p><button onClick={()=>window.location.reload()}>Refresh with key</button></details>}/>;
  return <main className="trial-entry"><p className="wordmark sm">EQ FIT</p><div className="trial-icon"><IconRun /></div><p className="eyebrow">PRIVATE MATE TRIAL</p><h1>Your training.<br/>Your dashboard.</h1><p>Paste your Garmin Personal API key to load your last 90 days of strength, cardio and running.</p><label className="focus-picker">My dashboard<select value={focus} onChange={e=>{setFocus(e.target.value as DashboardFocus);setFocusTouched(true);}} disabled={busy}>{FOCUS_OPTIONS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label><form onSubmit={e=>void connect(e)}><label className="field">Garmin Personal API key<input type="password" autoComplete="off" required maxLength={3000} value={key} onChange={e=>setKey(e.target.value)} placeholder="Paste your key" disabled={busy}/></label><button className="primary" disabled={busy || !invite}>{busy ? 'Loading your training…' : 'See my dashboard →'}</button></form><p className="muted small">Your key passes through EQ Fit’s import server to Garmin for this request. It is not saved. Activities stay in this browser. Paste again to refresh; this trial has no automatic sync. The private invite lasts seven days with up to 20 imports.</p>{!invite && <p role="alert">Open the full private invite link from Royce to begin.</p>}{message && <p role="alert">{message}</p>}</main>;
}
