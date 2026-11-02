import { describe, expect, it } from 'vitest';
import { ALT_INCREMENT_KG, beatLastTime, bestWorkingSet, e1rmScaled } from '../src/lib/beatLastTime';
import cases from './fixtures/oracle-beat.json';

describe('beat last time: pure module vs independent Python oracle (exact fractions, synthetic data)', () => {
  for (const c of cases) {
    it(`${c.id}: ${c.desc}`, () => {
      const got = beatLastTime({ lastSets: c.last_sets, allSets: c.all_sets, repMin: c.rep_min, repMax: c.rep_max });
      expect(got).toEqual(c.expected);
    });
  }

  it('the oracle covers every required case', () => {
    const ids = cases.map((c) => c.id);
    for (const need of ['basic_pr', 'pr_false', 'tie_more_reps', 'pain_note', 'no_history', 'range_cap_increase', 'warmup_not_best_ever']) expect(ids).toContain(need);
  });
});

describe('beat last time: worked example and helpers', () => {
  it('80 x 8 -> target 80 x 9, alternative 82.5 x 7 (e1RM 101.33 vs 101.75), PR cue true', () => {
    const r = beatLastTime({ lastSets: [{ load_kg: 80, reps: 8, rir: null, warmup: false, pain_note: null }], allSets: [], repMin: null, repMax: null });
    expect(r).toMatchObject({ kind: 'target', target: { load_kg: 80, reps: 9 }, alternative: { load_kg: 82.5, reps: 7 }, pr: true });
  });
  it('increment is a named editable constant (2.5 kg)', () => { expect(ALT_INCREMENT_KG).toBe(2.5); });
  it('an explicit increment changes only the alternative', () => {
    const s = [{ load_kg: 80, reps: 8, rir: null, warmup: false, pain_note: null }];
    const r = beatLastTime({ lastSets: s, allSets: s, repMin: null, repMax: null, increment: 5 });
    expect(r).toMatchObject({ kind: 'target', target: { load_kg: 80, reps: 9 }, alternative: { load_kg: 85, reps: 6 } });
  });
  it('integer e1RM arithmetic has no float drift (62.5 x 18 equals 60 x 20 exactly)', () => {
    expect(e1rmScaled(62.5, 18)).toBe(e1rmScaled(60, 20));
  });
  it('bestWorkingSet ignores warm-ups, missing values and 37+ reps', () => {
    expect(bestWorkingSet([
      { load_kg: 200, reps: 5, rir: null, warmup: true, pain_note: null },
      { load_kg: 50, reps: 40, rir: null, warmup: false, pain_note: null },
      { load_kg: null, reps: 5, rir: null, warmup: false, pain_note: null },
    ])).toBeNull();
  });
});
