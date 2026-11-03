import { useEffect, useState, useSyncExternalStore } from 'react';
import type { Repo } from '../db/repo';
import { backupStatus, describeAge, storageProblem } from '../lib/storage';
import { applyUpdate, usePwa } from '../pwa';

/** Gentle reminder when there is data and the last backup is missing or over 7 days old. */
export function BackupBanner({ repo, version, lastBackup, onGo }: { repo: Repo; version: number; lastBackup: string | null; onGo?: () => void }) {
  const [hasData, setHasData] = useState(false);
  useEffect(() => { void repo.hasUserData().then(setHasData); }, [repo, version]);
  const s = backupStatus(lastBackup, Date.now(), hasData);
  if (s.state !== 'never' && s.state !== 'stale') return null;
  return (
    <div className="banner" role="status" data-testid="backup-banner">
      <p>
        {s.state === 'never'
          ? <><strong>No backup yet.</strong> Back up local workouts and settings.</>
          : <><strong>Last backup was {describeAge(s.days ?? 0)}.</strong> Save a fresh copy of local workouts and settings.</>}
      </p>
      {onGo && <button type="button" onClick={onGo}>Go to Backup</button>}
    </div>
  );
}

/** Visible warning when IndexedDB is unavailable or a write failed. */
export function StorageWarning() {
  const problem = useSyncExternalStore(storageProblem.subscribe, storageProblem.get);
  if (!problem) return null;
  return (
    <p role="alert" className="error storage-warning" data-testid="storage-warning">
      <strong>Saving problem.</strong> {problem} Your last change may not be saved. Download a backup now if you can, and free some space or try another browser.
    </p>
  );
}

export function UpdateBanner() {
  const { updateReady } = usePwa();
  if (!updateReady) return null;
  return (
    <div className="banner" role="status" data-testid="update-banner">
      <p><strong>A new version of EQ Fit is ready.</strong> Updating reloads the app. Your data is not touched.</p>
      <button type="button" onClick={applyUpdate}>Update now</button>
    </div>
  );
}
