import { useCallback, useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import { buildPreview, commitPreview, type ImportPreview } from '../lib/importer';
import { decryptGarminExport, MAX_GARMIN_ENCRYPTED_BYTES } from '../lib/garminEncrypted';

const MAX_SHOWN = 20;

export function ImportScreen({ repo, onCommitted }: { repo: Repo; onCommitted: () => void }) {
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [total, setTotal] = useState<number | null>(null);
  const [encryptedFile, setEncryptedFile] = useState<File | null>(null);
  const [passphrase, setPassphrase] = useState('');

  const refreshTotal = useCallback(() => repo.countActivities().then(setTotal), [repo]);
  useEffect(() => { void refreshTotal(); }, [refreshTotal]);

  async function onFile(file: File | undefined) {
    setMessage(null);
    setPreview(null);
    if (!file) return;
    if (file.name.toLowerCase().endsWith('.eqfit')) {
      setEncryptedFile(file);
      setPassphrase('');
      return;
    }
    setEncryptedFile(null);
    setPassphrase('');
    setBusy(true);
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      setPreview(await buildPreview(bytes, repo, file.name));
    } catch (e) {
      setMessage(`Could not read file: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  async function unlockGarmin() {
    if (!encryptedFile || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      if (encryptedFile.size > MAX_GARMIN_ENCRYPTED_BYTES) throw new Error('Encrypted file is too large.');
      const encrypted = new Uint8Array(await encryptedFile.arrayBuffer());
      const plain = await decryptGarminExport(encrypted, passphrase);
      const result = await buildPreview(plain, repo, 'garmin-runs.csv');
      const prior = await repo.activitiesBetween('2000-01-01', '2100-01-01');
      const incoming = result.prepared.filter((a) => a.original_type === 'Running' || a.original_type === 'Treadmill Running');
      const existingDates = new Set(prior.filter((a) => a.group === 'outdoor_run' || a.group === 'treadmill_run').map((a) => a.date));
      const overlapping = incoming.filter((a) => existingDates.has(a.date));
      if (overlapping.length) {
        result.warnings.push('Existing runs found on the same dates. This version cannot reconcile historical Garmin CSV imports with Personal API records. Import blocked to avoid duplicate kilometres.');
        result.blocked = true;
      }
      setPreview(result);
      setEncryptedFile(null);
      setPassphrase('');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not open encrypted Garmin file.');
      setPassphrase('');
    } finally {
      setBusy(false);
    }
  }

  async function onCommit() {
    if (!preview) return;
    setBusy(true);
    try {
      const r = await commitPreview(preview, repo);
      setMessage(`Committed: ${r.added} rows added, ${r.skippedDuplicates} duplicates skipped.`);
      setPreview(null);
      await refreshTotal();
      onCommitted();
    } catch (e) {
      setMessage(`Import failed, nothing was written: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="imp-h">
      <h2 id="imp-h">Import Garmin activities</h2>
      <p>CSV or private encrypted Garmin export (.eqfit). Decryption happens on this device only.</p>
      <p>Rows stored: <strong data-testid="stored-count">{total ?? '...'}</strong></p>
      <label className="file">
        Choose CSV file
        <input type="file" accept=".csv,.eqfit,text/csv" onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = ''; // allow choosing the same file again (browsers skip change events otherwise)
          void onFile(f);
        }} data-testid="file-input" />
      </label>
      {encryptedFile && (
        <div className="card">
          <h3>Unlock encrypted Garmin export</h3>
          <p>Enter your separate EQ Fit export passphrase. Never enter your Garmin API key here.</p>
          <label htmlFor="garmin-export-passphrase">Export passphrase</label>
          <input id="garmin-export-passphrase" type="password" autoComplete="off" value={passphrase} onChange={(e) => setPassphrase(e.target.value)} />
          <button className="primary" disabled={busy || passphrase.length < 16} onClick={() => void unlockGarmin()}>Unlock and preview</button>
        </div>
      )}
      {busy && <p>Working...</p>}
      {message && <p role="status" data-testid="message">{message}</p>}

      {preview && (
        <div className="card" data-testid="preview">
          <h3>Preview (nothing saved yet)</h3>
          <dl>
            <dt>File</dt><dd>{preview.fileName ?? 'unnamed'}</dd>
            <dt>SHA-256</dt><dd className="mono" data-testid="p-hash">{preview.fileSha256}</dd>
            <dt>Rows</dt><dd data-testid="p-rows">{preview.rowCount}</dd>
            <dt>Columns</dt><dd data-testid="p-cols">{preview.columnCount}</dd>
            <dt>New rows</dt><dd data-testid="p-new">{preview.newRows}</dd>
            <dt>Duplicates</dt><dd data-testid="p-dups">{preview.duplicateRows}</dd>
            <dt>Same file imported before?</dt><dd data-testid="p-already">{preview.alreadyImported ? 'Yes' : 'No'}</dd>
            <dt>Errors</dt><dd data-testid="p-errors">{preview.structuralErrors.length + preview.rowErrors.length}</dd>
          </dl>

          {preview.structuralErrors.length > 0 && (
            <div role="alert" className="error">
              <strong>File rejected.</strong>
              <ul>{preview.structuralErrors.slice(0, MAX_SHOWN).map((e, i) => <li key={i}>{e}</li>)}</ul>
            </div>
          )}
          {preview.rowErrors.length > 0 && (
            <div role="alert" className="error">
              <strong>Parse errors (import blocked).</strong>
              <ul>{preview.rowErrors.slice(0, MAX_SHOWN).map((e, i) => <li key={i}>Row {e.row}, {e.column}: {e.message}</li>)}</ul>
            </div>
          )}
          {preview.warnings.map((w, i) => <p key={i} className="warn">Note: {w}</p>)}

          {preview.types.length > 0 && (
            <table>
              <caption>Activity types and mapped group</caption>
              <thead><tr><th scope="col">Original type</th><th scope="col">Rows</th><th scope="col">Mapped to</th></tr></thead>
              <tbody>
                {preview.types.map((t) => (
                  <tr key={t.type}><td>{t.type}</td><td className="num">{t.count}</td><td>{t.mapped}</td></tr>
                ))}
              </tbody>
            </table>
          )}

          <button className="primary" disabled={busy || preview.blocked} onClick={() => void onCommit()} data-testid="commit">
            {preview.blocked ? 'Cannot import' : `Import ${preview.newRows} new rows`}
          </button>
        </div>
      )}
    </section>
  );
}
