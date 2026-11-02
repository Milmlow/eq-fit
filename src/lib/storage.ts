// Storage safety helpers: persistent-storage request, last-backup bookkeeping (localStorage, NOT part of a backup),
// and a tiny store that the UI uses to show "a write failed" warnings.

export type PersistState = 'granted' | 'denied' | 'unsupported';

interface StorageManagerLike { persist?: () => Promise<boolean>; persisted?: () => Promise<boolean> }

export async function requestPersistence(sm: StorageManagerLike | undefined = typeof navigator === 'undefined' ? undefined : navigator.storage): Promise<PersistState> {
  try {
    if (!sm || typeof sm.persist !== 'function') return 'unsupported';
    if (typeof sm.persisted === 'function' && (await sm.persisted())) return 'granted';
    return (await sm.persist()) ? 'granted' : 'denied';
  } catch { return 'denied'; }
}

export function describePersistence(s: PersistState | null): string {
  if (s === null) return 'Checking...';
  if (s === 'granted') return 'Persistent storage: granted. The browser will not clear this data automatically under storage pressure.';
  if (s === 'denied') return 'Persistent storage: not granted. The browser may clear this data if the device runs low on space or after long inactivity. Keep backups.';
  return 'Persistent storage: not supported by this browser. Keep backups.';
}

export const LAST_BACKUP_KEY = 'eqfit.lastBackup';
type ReadStore = { getItem(k: string): string | null } | undefined | null;
type WriteStore = { setItem(k: string, v: string): void } | undefined | null;

export function loadLastBackup(store: ReadStore): string | null {
  try { const v = store?.getItem(LAST_BACKUP_KEY); return v && !Number.isNaN(Date.parse(v)) ? v : null; } catch { return null; }
}
export function saveLastBackup(store: WriteStore, iso: string): boolean {
  try { if (!store) return false; store.setItem(LAST_BACKUP_KEY, iso); return true; } catch { return false; }
}

export const STALE_AFTER_DAYS = 7;
export interface BackupStatus { state: 'empty' | 'never' | 'ok' | 'stale'; days: number | null }

/** `hasData` false = nothing worth backing up yet, so no nagging. Days are whole days since the last backup file was created. */
export function backupStatus(lastIso: string | null, nowMs: number, hasData: boolean): BackupStatus {
  if (lastIso === null) return { state: hasData ? 'never' : 'empty', days: null };
  const days = Math.max(0, Math.floor((nowMs - Date.parse(lastIso)) / 86_400_000));
  return { state: days >= STALE_AFTER_DAYS && hasData ? 'stale' : 'ok', days };
}

export function describeAge(days: number): string {
  return days === 0 ? 'today' : days === 1 ? '1 day ago' : `${days} days ago`;
}

// ---- storage problems (IndexedDB unavailable, a write failed) -----------------------------------------
const STORAGE_ERROR_NAMES = new Set(['QuotaExceededError', 'DatabaseClosedError', 'InvalidStateError', 'UnknownError', 'AbortError', 'SecurityError', 'MissingAPIError', 'OpenFailedError', 'VersionError', 'ReadOnlyError', 'TransactionInactiveError']);
export function isStorageError(e: unknown): boolean {
  const name = (e as { name?: unknown } | null)?.name;
  return typeof name === 'string' && STORAGE_ERROR_NAMES.has(name);
}

let lastProblem: string | null = null;
const listeners = new Set<() => void>();
export const storageProblem = {
  get: (): string | null => lastProblem,
  set(msg: string | null): void { lastProblem = msg; listeners.forEach((l) => l()); },
  subscribe(l: () => void): () => void { listeners.add(l); return () => { listeners.delete(l); }; },
};

/** Wrap a Repo so a failed storage write shows the visible warning. Validation errors (plain Error) are not storage problems and pass through. */
export function watchStorageErrors<T extends object>(target: T): T {
  return new Proxy(target, {
    get(t, prop, receiver) {
      const v = Reflect.get(t, prop, receiver);
      if (typeof v !== 'function') return v;
      return (...args: unknown[]) => {
        const r = (v as (...a: unknown[]) => unknown).apply(t, args);
        if (r && typeof (r as Promise<unknown>).then === 'function') {
          (r as Promise<unknown>).catch((e: unknown) => {
            if (isStorageError(e)) storageProblem.set(`${(e as Error).name}: ${(e as Error).message}`);
          });
        }
        return r;
      };
    },
  });
}
