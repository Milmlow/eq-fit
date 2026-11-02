import { describe, expect, it } from 'vitest';
import { bestE1rm, e1rm, normaliseMuscles, progressionHint, validateRepRange, weeklyWorkingSets } from '../src/lib/lifting';
import { freshRepo } from './helpers';
import oracle from './fixtures/oracle-lifting.json';
import synth from './fixtures/synthetic-lifting.json';

type Fx = { name: string; equipment: string; primary_muscles: string[]; rep_range: number[] | null };

async function loadSynthetic() {
  const repo = await freshRepo();
  const exIds: Record<string, string> = {};
  for (const [k, e] of Object.entries(synth.exercises as Record<string, Fx>)) {
    const ex = await repo.createExercise(e.name, e.equipment, e.primary_muscles);
    if (e.rep_range) await repo.updateExercise(ex.id, { rep_min: e.rep_range[0], rep_max: e.rep_range[1] });
    exIds[k] = ex.id;
  }
  const wos: Record<string, string> = {};
  for (const s of synth.sets) {
    wos[s.date] ??= (await repo.createWorkout({ date: s.date, name: '', kind: 'weights', status: 'done' })).id;
    await repo.addSet(wos[s.date], exIds[s.exercise], { load_kg: s.load_kg, reps: s.reps, rir: s.rir, warmup: s.warmup, pain_note: s.pain_note });
  }
  return { repo, exIds, wos };
}

describe('golden: synthetic lifting vs independent Python oracle', () => {
  it('weekly working sets per muscle match (warm-ups out, shared/blank muscles, Sun/Mon boundary)', async () => {
    const { repo } = await loadSynthetic();
    const all = await repo.allSetsWithContext();
    const weeks = weeklyWorkingSets(all.map((a) => ({ ...a.set, date: a.workout.date, muscles: a.exercise.primary_muscles })));
    const got = Object.fromEntries(weeks.map((w) => [w.weekStart, w.muscles]));
    expect(got).toEqual(oracle.weekly_sets);
    expect(weeks.map((w) => w.weekStart)).toEqual(['2026-10-26', '2026-10-19']); // newest first
  });

  it('per-session e1RM (Epley, Brzycki, source set, actual, low confidence) matches, per exact exercise', async () => {
    const { repo, exIds } = await loadSynthetic();
    const idToKey = Object.fromEntries(Object.entries(exIds).map(([k, v]) => [v, k]));
    const seen = new Set<string>();
    for (const id of Object.values(exIds)) {
      for (const sess of await repo.exerciseHistory(id)) {
        const key = `${sess.workout.date}|${idToKey[id]}`;
        const best = bestE1rm(sess.sets);
        const exp = (oracle.session_e1rm as Record<string, { load: number; reps: number; epley: number; brzycki: number; actual: boolean; low_confidence: boolean }>)[key];
        if (!exp) { expect(best, key).toBeNull(); continue; }
        seen.add(key);
        expect(best, key).not.toBeNull();
        expect([best!.load, best!.reps, best!.epley, best!.brzycki, best!.actual, best!.lowConfidence], key).toEqual([exp.load, exp.reps, exp.epley, exp.brzycki, exp.actual, exp.low_confidence]);
      }
    }
    expect([...seen].sort()).toEqual(Object.keys(oracle.session_e1rm).sort());
  });

  it('same name on two machines stays separate in history and e1RM', async () => {
    const { repo, exIds } = await loadSynthetic();
    expect((await repo.exerciseHistory(exIds.cpA)).length).toBe(2);
    expect((await repo.exerciseHistory(exIds.cpB)).length).toBe(1);
  });

  it('progression hints match the oracle at each date (last session on/before the date)', async () => {
    const { repo, exIds } = await loadSynthetic();
    for (const [k, expected] of Object.entries(oracle.hints)) {
      const [ex, upto] = k.split('@');
      const e = (await repo.getExercise(exIds[ex]))!;
      const sessions = (await repo.exerciseHistory(exIds[ex])).filter((s) => s.workout.date <= upto);
      const last = sessions[sessions.length - 1];
      expect(progressionHint(e.rep_max ?? null, last?.sets ?? []), k).toBe(expected);
    }
  });

  it('hand-worked hint cases (RIR 0, RIR 4, missing reps, pain)', () => {
    for (const c of oracle.hint_cases) {
      const sets = c.sets.map(([reps, rir]) => ({ load_kg: 50, reps, rir, warmup: false, pain_note: c.pain ? 'sore' : null }));
      expect(progressionHint(c.range[1], sets)).toBe(c.expected);
    }
  });
});

describe('lifting maths edge cases', () => {
  const S = (load: number | null, reps: number | null, warmup = false) => ({ load_kg: load, reps, warmup });
  it('warm-up, missing load/reps, zero load, zero reps -> null (never 0)', () => {
    expect(e1rm(S(80, 8, true))).toBeNull();
    expect(e1rm(S(null, 8))).toBeNull();
    expect(e1rm(S(80, null))).toBeNull();
    expect(e1rm(S(0, 8))).toBeNull();
    expect(e1rm(S(80, 0))).toBeNull();
    expect(e1rm(S(80, 37))).toBeNull();
  });
  it('1 rep is the actual lift; 11+ reps low confidence; 10 is not', () => {
    expect(e1rm(S(100, 1))).toMatchObject({ actual: true, epley: 100, brzycki: 100, lowConfidence: false });
    expect(e1rm(S(60, 10))!.lowConfidence).toBe(false);
    expect(e1rm(S(60, 11))!.lowConfidence).toBe(true);
  });
  it('formulas: 100 x 5 -> Epley 116.7, Brzycki 112.5', () => {
    expect(e1rm(S(100, 5))).toMatchObject({ epley: 116.7, brzycki: 112.5 });
  });
  it('bestE1rm is null when nothing is eligible', () => {
    expect(bestE1rm([{ load_kg: null, reps: 5, rir: null, warmup: false, pain_note: null }])).toBeNull();
  });
  it('muscles normalise case-insensitively and de-duplicate; blank -> unassigned', () => {
    expect(normaliseMuscles([' Chest', 'CHEST ', 'upper  back', ''])).toEqual(['chest', 'upper back']);
    const w = weeklyWorkingSets([{ date: '2026-10-26', load_kg: 1, reps: 1, rir: null, warmup: false, pain_note: null, muscles: ['', '  '] }]);
    expect(w[0].muscles).toEqual({ unassigned: 1 });
  });
  it('a set with two primary muscles counts once toward each', () => {
    const w = weeklyWorkingSets([{ date: '2026-10-26', load_kg: 1, reps: 1, rir: null, warmup: false, pain_note: null, muscles: ['chest', 'triceps'] }]);
    expect(w[0].muscles).toEqual({ chest: 1, triceps: 1 });
    expect(w[0].workingSets).toBe(1);
  });
  it('no hint without a rep range or without sets', () => {
    expect(progressionHint(null, [{ load_kg: 1, reps: 10, rir: null, warmup: false, pain_note: null }])).toBeNull();
    expect(progressionHint(10, [])).toBeNull();
  });
  it('rep range validation', () => {
    expect(validateRepRange(null, null)).toEqual([]);
    expect(validateRepRange(8, 12)).toEqual([]);
    expect(validateRepRange(8, null).length).toBe(1);
    expect(validateRepRange(12, 8).length).toBe(1);
    expect(validateRepRange(0, 8).length).toBe(1);
    expect(validateRepRange(8.5, 12).length).toBe(1);
  });
});

describe('edit set and rename exercise', () => {
  const none = { rir: null, warmup: false, pain_note: null };
  it('edits load, reps, RIR, warm-up flag, pain note; validates; keeps ordinal and links', async () => {
    const repo = await freshRepo();
    const w = await repo.createWorkout({ date: '2026-11-02', name: '', kind: 'weights' });
    const ex = await repo.createExercise('Squat', 'Barbell', []);
    const s = await repo.addSet(w.id, ex.id, { load_kg: 80, reps: 5, ...none });
    const u = await repo.updateSet(s.id, { load_kg: 82.5, reps: 4, rir: 2, warmup: true, pain_note: '  knee ' });
    expect(u).toMatchObject({ load_kg: 82.5, reps: 4, rir: 2, warmup: true, pain_note: 'knee', ordinal: 1, workout_id: w.id, exercise_id: ex.id });
    expect(await repo.updateSet(s.id, { load_kg: 82.5, reps: 4, rir: null, warmup: false, pain_note: '   ' })).toMatchObject({ pain_note: null, warmup: false });
    await expect(repo.updateSet(s.id, { load_kg: -1, reps: 4, ...none })).rejects.toThrow();
    await expect(repo.updateSet('nope', { load_kg: 1, reps: 1, ...none })).rejects.toThrow(/not found/);
    expect((await repo.setsForWorkout(w.id))[0].load_kg).toBe(82.5); // failed edit changed nothing
  });
  it('rename keeps the id and history; equipment cannot change; collisions refused', async () => {
    const repo = await freshRepo();
    const w = await repo.createWorkout({ date: '2026-11-02', name: '', kind: 'weights' });
    const a = await repo.createExercise('Chest Press', 'Machine A', ['chest']);
    const b = await repo.createExercise('Chest Press', 'Machine B', ['chest']);
    await repo.addSet(w.id, a.id, { load_kg: 50, reps: 10, ...none });
    const r = await repo.updateExercise(a.id, { name: 'Machine Chest Press' });
    expect(r.id).toBe(a.id);
    expect(r.equipment).toBe('Machine A');
    expect((await repo.exerciseHistory(a.id)).length).toBe(1);
    await expect(repo.updateExercise(b.id, { name: 'machine chest press' })).resolves.toBeDefined(); // different equipment: allowed
    await expect(repo.updateExercise(b.id, { name: '  ' })).rejects.toThrow(/required/);
    const c = await repo.createExercise('Machine Chest Press', 'Machine A2', []);
    await expect(repo.updateExercise(c.id, { name: 'x' })).resolves.toBeDefined();
    // collision: same name AND same equipment
    const d = await repo.createExercise('Row', 'Cable', []);
    const e = await repo.createExercise('Pulldown', 'Cable', []);
    await expect(repo.updateExercise(e.id, { name: 'row' })).rejects.toThrow(/already has that name/);
    expect((await repo.getExercise(d.id))!.name).toBe('Row');
  });
  it('rep range set/clear and validation; muscles editable', async () => {
    const repo = await freshRepo();
    const ex = await repo.createExercise('Curl', 'DB', []);
    expect(await repo.updateExercise(ex.id, { rep_min: 8, rep_max: 12, primary_muscles: [' Biceps ', ''] })).toMatchObject({ rep_min: 8, rep_max: 12, primary_muscles: ['Biceps'] });
    await expect(repo.updateExercise(ex.id, { rep_min: 12, rep_max: 8 })).rejects.toThrow(/rep range/);
    expect(await repo.updateExercise(ex.id, { rep_min: null, rep_max: null })).toMatchObject({ rep_min: null, rep_max: null });
  });
  it('a Stage-2 exercise without rep fields still works (no hint)', async () => {
    const repo = await freshRepo();
    const ex = await repo.createExercise('Old', '', []);
    expect(ex.rep_max).toBeUndefined();
    expect(progressionHint(ex.rep_max ?? null, [{ load_kg: 1, reps: 99, rir: null, warmup: false, pain_note: null }])).toBeNull();
  });
});
