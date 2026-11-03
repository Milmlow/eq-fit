import { useEffect, useRef, useState } from 'react';
import type { Repo } from '../db/repo';
import { MAX_BACKUP_BYTES, TABLE_NAMES, backupFileName, serializeBackup, validateBackup, type BackupCounts, type ValidationResult } from '../lib/backup';
import { canShareFile, dated, saveTextFile, shareTextFile } from '../lib/download';
import { backupStatus, describeAge, describePersistence, type PersistState } from '../lib/storage';

const LABELS: Record<keyof BackupCounts, string> = {
  batches: 'import batches', activities: 'activities', type_mappings: 'type mappings', exercises: 'exercises', workouts: 'workouts', sets: 'sets', routines: 'saved workouts',
};
const JSON_MIME = 'application/json';
const CSV_MIME = 'text/csv;charset=utf-8';

interface Picked { name: string; size: number; result: ValidationResult; current: BackupCounts }

export function BackupSection({ repo, today, lastBackup, onBackedUp, onRestored, persist, onAskPersist }: {
  repo: Repo; today: string; lastBackup: string | null; onBackedUp: (iso: string) => void; onRestored: () => void;
  persist: PersistState | null; onAskPersist: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [agree, setAgree] = useState(false);
  const [hasData, setHasData] = useState(false);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const status = backupStatus(lastBackup, Date.now(), hasData);

  useEffect(() => { void repo.hasUserData().then(setHasData); }, [repo, msg]);
  useEffect(() => { if (picked) confirmRef.current?.focus(); }, [picked]);

  async function makeBackupText(): Promise<{ name: string; text: string }> {
    const now = new Date();
    return { name: backupFileName(now), text: serializeBackup(await repo.exportBackup(now)) };
  }

  async function download(share: boolean) {
    setBusy(true); setMsg(null);
    try {
      const { name, text } = await makeBackupText();
      if (share) {
        if (!(await shareTextFile(name, text, JSON_MIME))) { setMsg({ kind: 'error', text: 'Sharing was cancelled or is not available. No backup was recorded.' }); return; }
      } else saveTextFile(name, text, JSON_MIME);
      onBackedUp(new Date().toISOString());
      setMsg({ kind: 'ok', text: `Backup file created: ${name}. Check that it is in your Downloads or Files app, and keep it private.` });
    } catch (e) {
      setMsg({ kind: 'error', text: `Backup failed, nothing was saved: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setBusy(false); }
  }

  async function exportCsv(which: 'sets' | 'running') {
    setBusy(true); setMsg(null);
    try {
      const now = new Date();
      const text = which === 'sets' ? await repo.exportSetsCsv() : await repo.exportRunningCsv(today);
      const name = dated(which === 'sets' ? 'eq-fit-workouts' : 'eq-fit-running', 'csv', now);
      saveTextFile(name, text, CSV_MIME);
      setMsg({ kind: 'ok', text: `CSV created: ${name}. Text that starts with = + - @ is saved with a leading apostrophe so spreadsheets do not run it as a formula.` });
    } catch (e) {
      setMsg({ kind: 'error', text: `Export failed: ${e instanceof Error ? e.message : String(e)}` });
    } finally { setBusy(false); }
  }

  async function onFile(file: File | undefined) {
    setMsg(null); setPicked(null); setAgree(false);
    if (!file) return;
    setBusy(true);
    try {
      let result: ValidationResult;
      if (file.size > MAX_BACKUP_BYTES) result = validateBackup('', { sizeBytes: file.size });
      else result = validateBackup(await file.text(), { sizeBytes: file.size });
      setPicked({ name: file.name, size: file.size, result, current: await repo.tableCounts() });
    } catch (e) {
      setMsg({ kind: 'error', text: `Could not read the file. Nothing was changed. ${e instanceof Error ? e.message : String(e)}` });
    } finally { setBusy(false); }
  }

  async function doRestore() {
    if (!picked || !picked.result.ok || !agree) return;
    setBusy(true); setMsg(null);
    try {
      const counts = await repo.restoreBackup(picked.result.backup);
      setPicked(null); setAgree(false);
      onRestored();
      setMsg({ kind: 'ok', text: `Restored: ${TABLE_NAMES.map((t) => `${counts[t]} ${LABELS[t]}`).join(', ')}.` });
    } catch (e) {
      setMsg({ kind: 'error', text: `Restore failed. Your existing data was not changed. ${e instanceof Error ? e.message : String(e)}` });
    } finally { setBusy(false); }
  }

  const shareable = canShareFile('x.json', JSON_MIME);
  const ok = picked?.result.ok ? picked.result : null;

  return (
    <section className="card backup" aria-labelledby="backup-h">
      <h3 id="backup-h">Backup and restore</h3>
      <p className="privacy" data-testid="privacy-warning"><strong>Keep the backup file private.</strong> It holds your full activity and training history. Do not share it, email it, or put it anywhere public.</p>
      <p data-testid="last-backup">
        {status.days === null
          ? <>Last backup: <strong>never</strong>.</>
          : <>Last backup: <strong>{describeAge(status.days)}</strong>.</>}
      </p>
      <div className="row gap wrap actions">
        <button type="button" className="primary" disabled={busy} onClick={() => void download(false)}>Download backup</button>
        {shareable && <button type="button" disabled={busy} onClick={() => void download(true)}>Share or save backup</button>}
      </div>


      {msg && <p role={msg.kind === 'error' ? 'alert' : 'status'} className={msg.kind === 'error' ? 'error' : ''} data-testid="backup-message">{msg.text}</p>}

      <h4>Restore from a backup file</h4>
      <p className="muted">Restoring replaces everything stored in this browser. The file is checked completely first; if anything is wrong, nothing changes.</p>
      <label className="file">
        Choose backup file
        <input type="file" accept=".json,application/json" data-testid="restore-input" disabled={busy}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void onFile(f); }} />
      </label>

      {picked && !picked.result.ok && (
        <div role="alert" className="error problem" data-testid="restore-rejected">
          <p><strong>This file cannot be restored. Nothing was changed.</strong> ({picked.name})</p>
          <ul>{picked.result.errors.map((m, i) => <li key={i}>{m}</li>)}</ul>
        </div>
      )}

      {picked && ok && (
        <div className="confirm" role="region" aria-labelledby="confirm-h" data-testid="restore-confirm">
          <h4 id="confirm-h" tabIndex={-1} ref={confirmRef}>Replace your data with this backup?</h4>
          <p>
            File <span className="mono">{picked.name}</span>, made {new Date(ok.backup.exportedAt).toLocaleString()} by app version {ok.backup.appVersion}
            {ok.sourceVersion < ok.backup.schemaVersion && ` (older format v${ok.sourceVersion}, upgraded on restore)`}.
          </p>
          <div className="scroll">
            <table>
              <caption>What will be replaced</caption>
              <thead><tr><th scope="col">Stored now</th><th scope="col" className="num">Now</th><th scope="col" className="num">After restore</th></tr></thead>
              <tbody>{TABLE_NAMES.map((t) => (
                <tr key={t}><th scope="row">{LABELS[t]}</th><td className="num">{picked.current[t]}</td><td className="num">{ok.counts[t]}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="warnline"><strong>This cannot be undone.</strong> Everything listed under "Now" is deleted and replaced by the file. The theme choice is not affected.</p>
          <div className="row gap wrap"><button type="button" disabled={busy} onClick={() => void download(false)}>Download my current data first</button></div>
          <label className="check"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} data-testid="restore-agree" />
            I understand my current data will be permanently replaced.</label>
          <div className="row gap wrap">
            <button type="button" className="danger" disabled={!agree || busy} onClick={() => void doRestore()} data-testid="restore-go">Replace my data with this backup</button>
            <button type="button" disabled={busy} onClick={() => { setPicked(null); setAgree(false); }}>Cancel</button>
          </div>
        </div>
      )}

      <h4>Export to a spreadsheet (CSV)</h4>
      <p className="muted">A CSV cannot be restored. It is for reading in a spreadsheet.</p>
      <div className="row gap wrap actions">
        <button type="button" disabled={busy} onClick={() => void exportCsv('sets')}>Workouts and sets (CSV)</button>
        <button type="button" disabled={busy} onClick={() => void exportCsv('running')}>Running periods (CSV)</button>
      </div>

      <h4>Storage</h4>
      <p data-testid="persist-state">{describePersistence(persist)}</p>
      {persist !== 'granted' && persist !== 'unsupported' && <button type="button" onClick={onAskPersist}>Ask the browser again</button>}

    </section>
  );
}
