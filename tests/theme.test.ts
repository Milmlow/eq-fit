import { describe, expect, it } from 'vitest';
import { applyTheme, DEFAULT_PREF, loadPref, parsePref, resolveTheme, savePref, THEME_KEY } from '../src/lib/theme';
import { freshRepo } from './helpers';

const memStore = () => {
  const m = new Map<string, string>();
  return { m, getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe('theme preference', () => {
  it('defaults to Dark until an explicit choice exists, and does not write on load', () => {
    const s = memStore();
    expect(loadPref(s)).toBe('dark');
    expect(DEFAULT_PREF).toBe('dark');
    expect(s.m.size).toBe(0);
  });
  it('persists the explicit choice under one key and reads it back', () => {
    const s = memStore();
    for (const p of ['system', 'light', 'dark', 'crazy', 'girl-power'] as const) {
      expect(savePref(s, p)).toBe(true);
      expect(s.m.get(THEME_KEY)).toBe(p);
      expect(loadPref(s)).toBe(p);
    }
    expect([...s.m.keys()]).toEqual([THEME_KEY]);
  });
  it('ignores junk values and survives broken or missing storage', () => {
    const s = memStore(); s.m.set(THEME_KEY, '<script>');
    expect(loadPref(s)).toBe('dark');
    expect(parsePref('neon')).toBeNull();
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('blocked'); } };
    expect(loadPref(broken)).toBe('dark');
    expect(savePref(broken, 'light')).toBe(false);
    expect(loadPref(null)).toBe('dark');
    expect(savePref(undefined, 'light')).toBe(false);
  });
  it('System follows prefers-color-scheme (light or dark, never crazy); explicit choices ignore it', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
    for (const dark of [true, false]) {
      expect(resolveTheme('light', dark)).toBe('light');
      expect(resolveTheme('dark', dark)).toBe('dark');
      expect(resolveTheme('crazy', dark)).toBe('crazy');
    }
  });
  it('applyTheme only sets data-theme', () => {
    const calls: string[][] = [];
    applyTheme({ setAttribute: (n, v) => calls.push([n, v]) }, 'crazy');
    expect(calls).toEqual([['data-theme', 'crazy']]);
  });
});

describe('switching theme never touches workout data', () => {
  it('workouts, sets and exercises are identical after cycling every theme', async () => {
    const repo = await freshRepo();
    const ex = await repo.createExercise('Bench Press', 'Barbell', ['chest']);
    const w = await repo.createWorkout({ date: '2026-11-02', name: 'A', kind: 'weights' });
    await repo.addSet(w.id, ex.id, { load_kg: 80, reps: 8, rir: 2, warmup: false, pain_note: null });
    const snap = async () => JSON.stringify([await repo.workoutsBetween('2000-01-01', '2100-01-01'), await repo.allSetsWithContext(), await repo.listExercises()]);
    const before = await snap();
    const s = memStore();
    const el = { setAttribute: () => undefined };
    for (const p of ['light', 'crazy', 'system', 'dark'] as const) { savePref(s, p); applyTheme(el, resolveTheme(p, false)); }
    expect(await snap()).toBe(before);
  });
});
