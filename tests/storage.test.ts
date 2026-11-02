import { describe, expect, it } from 'vitest';
import {
  LAST_BACKUP_KEY, backupStatus, describeAge, describePersistence, isStorageError, loadLastBackup, requestPersistence, saveLastBackup, storageProblem, watchStorageErrors,
} from '../src/lib/storage';

const DAY = 86_400_000;
const now = Date.parse('2026-11-10T00:00:00Z');

describe('backup age', () => {
  it('no data: never nags', () => { expect(backupStatus(null, now, false)).toEqual({ state: 'empty', days: null }); });
  it('data but no backup: asks', () => { expect(backupStatus(null, now, true)).toEqual({ state: 'never', days: null }); });
  it('0 to 6 days: fine', () => {
    for (const d of [0, 1, 6]) expect(backupStatus(new Date(now - d * DAY - 1000).toISOString(), now, true).state).toBe('ok');
  });
  it('7 days or more: stale', () => {
    expect(backupStatus(new Date(now - 7 * DAY).toISOString(), now, true)).toEqual({ state: 'stale', days: 7 });
    expect(backupStatus(new Date(now - 30 * DAY).toISOString(), now, true).days).toBe(30);
  });
  it('a stale backup of an emptied database does not nag', () => {
    expect(backupStatus(new Date(now - 30 * DAY).toISOString(), now, false).state).toBe('ok');
  });
  it('a clock in the future never shows negative days', () => { expect(backupStatus(new Date(now + DAY).toISOString(), now, true).days).toBe(0); });
  it('wording', () => { expect(describeAge(0)).toBe('today'); expect(describeAge(1)).toBe('1 day ago'); expect(describeAge(9)).toBe('9 days ago'); });
});

describe('last-backup storage', () => {
  it('round trip, garbage ignored, failures swallowed', () => {
    const mem = new Map<string, string>();
    const store = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
    expect(loadLastBackup(store)).toBeNull();
    expect(saveLastBackup(store, '2026-11-02T00:00:00.000Z')).toBe(true);
    expect(loadLastBackup(store)).toBe('2026-11-02T00:00:00.000Z');
    mem.set(LAST_BACKUP_KEY, 'garbage');
    expect(loadLastBackup(store)).toBeNull();
    expect(saveLastBackup({ setItem: () => { throw new Error('full'); } }, 'x')).toBe(false);
    expect(loadLastBackup({ getItem: () => { throw new Error('blocked'); } })).toBeNull();
    expect(saveLastBackup(null, 'x')).toBe(false);
  });
});

describe('persistent storage request', () => {
  it('granted, denied, unsupported, throwing', async () => {
    expect(await requestPersistence({ persist: async () => true })).toBe('granted');
    expect(await requestPersistence({ persist: async () => false })).toBe('denied');
    expect(await requestPersistence({ persisted: async () => true, persist: async () => false })).toBe('granted');
    expect(await requestPersistence({})).toBe('unsupported');
    expect(await requestPersistence(undefined)).toBe('unsupported');
    expect(await requestPersistence({ persist: async () => { throw new Error('x'); } })).toBe('denied');
  });
  it('wording does not overclaim', () => {
    expect(describePersistence('denied')).toMatch(/may clear/);
    expect(describePersistence('granted')).toMatch(/granted/);
  });
});

describe('storage problem reporting', () => {
  it('only storage-type errors raise the warning; validation errors pass through', async () => {
    const repo = watchStorageErrors({
      ok: async () => 1,
      validation: async () => { throw new Error('date must be YYYY-MM-DD'); },
      quota: async () => { const e = new Error('disk full'); e.name = 'QuotaExceededError'; throw e; },
      plain: 5,
    });
    storageProblem.set(null);
    expect(await repo.ok()).toBe(1);
    await expect(repo.validation()).rejects.toThrow(/YYYY-MM-DD/);
    await new Promise((r) => setTimeout(r, 0));
    expect(storageProblem.get()).toBeNull();
    await expect(repo.quota()).rejects.toThrow(/disk full/); // the caller still sees the original error
    await new Promise((r) => setTimeout(r, 0));
    expect(storageProblem.get()).toMatch(/QuotaExceededError: disk full/);
    expect(repo.plain).toBe(5);
    expect(isStorageError({ name: 'DatabaseClosedError' })).toBe(true);
    expect(isStorageError(new Error('x'))).toBe(false);
    storageProblem.set(null);
  });
});
