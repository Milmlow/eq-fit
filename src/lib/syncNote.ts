// "Sync not connected" note: a tiny local preference so it can be dismissed. NOT part of workout data or any backup.
export const SYNC_NOTE_KEY = 'eqfit.sync-note-dismissed';
type ReadStore = { getItem(k: string): string | null } | undefined | null;
type WriteStore = { setItem(k: string, v: string): void } | undefined | null;

/** Shown until dismissed. Storage failures keep the note visible. */
export function syncNoteDismissed(store: ReadStore): boolean {
  try { return store?.getItem(SYNC_NOTE_KEY) === '1'; } catch { return false; }
}
/** Returns false when storage is unavailable; the caller still hides it for this visit. */
export function dismissSyncNote(store: WriteStore): boolean {
  try { if (!store) return false; store.setItem(SYNC_NOTE_KEY, '1'); return true; } catch { return false; }
}
