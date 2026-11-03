import { useState } from 'react';
import { Repo } from '../db/repo';
import { RecompDB } from '../db/db';
import { applyCloudRows, prepareCloudRows } from '../lib/cloudImport';
import { App } from './App';
import { IconRun } from './Icons';

export async function trialDatabaseName(key: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(key.trim()));
  return 'eqfit-trial-'+Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('');
}
export function Trial() {
  const [invite] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get('invite') || '');
  const [key,setKey] = useState('');
  const [repo,setRepo] = useState<Repo|null>(null);
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState('');
  async function connect(e: React.FormEvent) {
    e.preventDefault(); if (busy) return; setBusy(true); setMessage('');
    const credential = key.trim(); setKey('');
    try {
      const response = await fetch('https://hihqnnxnlkjfbixhcgaa.supabase.co/functions/v1/garmin-trial',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+invite},body:JSON.stringify({key:credential}),cache:'no-store',signal:AbortSignal.timeout(60000)});
      const data = await response.json();
      if (!response.ok) { setMessage(typeof data.error === 'string' ? data.error : 'Could not import. Please retry.'); return; }
      const r = await Repo.open(new RecompDB(await trialDatabaseName(credential)));
      const rows = await prepareCloudRows(data.rows,r);
      const result = await applyCloudRows(r,rows,'local-trial');
      if (result.pending.length) { r.db.close(); throw new Error(); }
      setRepo(r);
      setMessage(`${rows.length} runs · last 90 days`);
    } catch { setMessage('Could not finish the import. Paste your key to retry.'); }
    finally { setBusy(false); }
  }
  if (repo) return <><div className="trial-ribbon"><strong>Mate trial</strong> · {message} · browser only <button onClick={()=>window.location.reload()}>Refresh with key</button></div><App trialRepo={repo}/></>;
  return <main className="trial-entry"><p className="wordmark sm">EQ FIT</p><div className="trial-icon"><IconRun /></div><p className="eyebrow">PRIVATE MATE TRIAL</p><h1>Your runs.<br/>Your dashboard.</h1><p>Paste your Garmin Personal API key to load your last 90 days of running.</p><form onSubmit={e=>void connect(e)}><label className="field">Garmin Personal API key<input type="password" autoComplete="off" required maxLength={3000} value={key} onChange={e=>setKey(e.target.value)} placeholder="Paste your key" disabled={busy}/></label><button className="primary" disabled={busy || !invite}>{busy ? 'Loading your runs…' : 'See my runs →'}</button></form><p className="muted small">Your key passes through EQ Fit’s import server to Garmin for this request. It is not saved. Runs stay in this browser. Paste again to refresh; this trial has no automatic sync. The private invite lasts seven days with up to 20 imports.</p>{!invite && <p role="alert">Open the full private invite link from Royce to begin.</p>}{message && <p role="alert">{message}</p>}</main>;
}
