import { describe, expect, it } from 'vitest';
import { dismissSyncNote, syncNoteDismissed, SYNC_NOTE_KEY } from '../src/lib/syncNote';

describe('sync note dismissal', () => {
  it('shows by default, hides once dismissed', () => {
    const m = new Map<string, string>();
    const store = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
    expect(syncNoteDismissed(store)).toBe(false);
    expect(dismissSyncNote(store)).toBe(true);
    expect(m.get(SYNC_NOTE_KEY)).toBe('1');
    expect(syncNoteDismissed(store)).toBe(true);
  });
  it('stays visible and reports failure when storage is missing or throws', () => {
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(syncNoteDismissed(broken)).toBe(false);
    expect(dismissSyncNote(broken)).toBe(false);
    expect(syncNoteDismissed(null)).toBe(false);
    expect(dismissSyncNote(undefined)).toBe(false);
  });
});
