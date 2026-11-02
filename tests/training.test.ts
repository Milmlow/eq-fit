import { describe, expect, it } from 'vitest';
import { buildPreview, commitPreview } from '../src/lib/importer';
import { formatSet, validateSet } from '../src/lib/training';
import { baselinePerWeek, fallbackDates, weekDates } from '../src/lib/week';
import { csvOf, freshRepo, row } from './helpers';

const none = { rir: null, warmup: false, pain_note: null };

describe('validateSet', () => {
  it('accepts load+reps, load only, reps only; rejects empty', () => {
    expect(validateSet({ load_kg: 60, reps: 8, ...none })).toEqual([]);
    expect(validateSet({ load_kg: 60, reps: null, ...none })).toEqual([]);
    expect(validateSet({ load_kg: null, reps: 8, ...none })).toEqual([]);
    expect(validateSet({ load_kg: null, reps: null, ...none }).length).toBe(1);
  });
  it('rejects negative, fractional reps, absurd or out-of-range values', () => {
    expect(validateSet({ load_kg: -5, reps: 8, ...none }).length).toBe(1);
    expect(validateSet({ load_kg: 5, reps: 8.5, ...none }).length).toBe(1);
    expect(validateSet({ load_kg: 5, reps: -1, ...none }).length).toBe(1);
    expect(validateSet({ load_kg: 5, reps: 8, rir: 11, warmup: false, pain_note: null }).length).toBe(1);
    expect(validateSet({ load_kg: 5, reps: 8, rir: 1.3, warmup: false, pain_note: null }).length).toBe(1);
    expect(validateSet({ load_kg: Number.NaN, reps: 8, ...none }).length).toBe(1);
  });
  it('allows RIR 0 and 2.5, and zero load (bodyweight)', () => {
    expect(validateSet({ load_kg: 0, reps: 10, rir: 0, warmup: false, pain_note: null })).toEqual([]);
    expect(validateSet({ load_kg: 20, reps: 10, rir: 2.5, warmup: false, pain_note: null })).toEqual([]);
  });
  it('formatSet never prints unknown as zero', () => {
    expect(formatSet({ load_kg: 60, reps: 8, rir: null, warmup: false })).toBe('60 kg x 8');
    expect(formatSet({ load_kg: 60, reps: null, rir: null, warmup: false })).toBe('60 kg (reps unknown)');
    expect(formatSet({ load_kg: null, reps: 8, rir: 2, warmup: true })).toBe('warm-up 8 reps (load unknown) @RIR 2');
  });
});

describe('exercises', () => {
  it('same name+equipment is the same exercise; different equipment is different', async () => {
    const repo = await freshRepo();
    const a = await repo.createExercise('Chest Press', 'Machine A', ['chest']);
    const a2 = await repo.createExercise('  chest   press ', 'machine a', []);
    const b = await repo.createExercise('Chest Press', 'Machine B', ['chest']);
    expect(a2.id).toBe(a.id);
    expect(b.id).not.toBe(a.id);
    expect((await repo.listExercises()).length).toBe(2);
  });
  it('rejects empty and overlong names', async () => {
    const repo = await freshRepo();
    await expect(repo.createExercise('  ', '', [])).rejects.toThrow(/required/);
    await expect(repo.createExercise('x'.repeat(121), '', [])).rejects.toThrow(/120/);
  });
});

describe('workouts and sets', () => {
  it('multiple workouts on one date are allowed and kept in creation order', async () => {
    const repo = await freshRepo();
    await repo.createWorkout({ date: '2026-11-02', name: 'AM', kind: 'weights' });
    await repo.createWorkout({ date: '2026-11-02', name: 'PM', kind: 'weights' });
    expect((await repo.workoutsBetween('2026-11-02', '2026-11-02')).map((w) => w.name)).toEqual(['AM', 'PM']);
  });
  it('warm-up and working sets are distinct; ordinals increase; pain note is kept; empty note is null', async () => {
    const repo = await freshRepo();
    const w = await repo.createWorkout({ date: '2026-11-02', name: 'A', kind: 'weights' });
    const ex = await repo.createExercise('Squat', 'Barbell', ['quads']);
    await repo.addSet(w.id, ex.id, { load_kg: 40, reps: 10, rir: null, warmup: true, pain_note: null });
    await repo.addSet(w.id, ex.id, { load_kg: 80, reps: 6, rir: 2, warmup: false, pain_note: '  left knee twinge ' });
    await repo.addSet(w.id, ex.id, { load_kg: 80, reps: 5, rir: null, warmup: false, pain_note: '   ' });
    const sets = await repo.setsForWorkout(w.id);
    expect(sets.map((s) => s.ordinal)).toEqual([1, 2, 3]);
    expect(sets.map((s) => s.warmup)).toEqual([true, false, false]);
    expect(sets[1].pain_note).toBe('left knee twinge');
    expect(sets[2].pain_note).toBeNull();
    expect(sets[1].rir).toBe(2);
    expect(sets[0].rir).toBeNull();
  });
  it('invalid sets are rejected and nothing is stored', async () => {
    const repo = await freshRepo();
    const w = await repo.createWorkout({ date: '2026-11-02', name: 'A', kind: 'weights' });
    const ex = await repo.createExercise('Squat', '', []);
    await expect(repo.addSet(w.id, ex.id, { load_kg: -1, reps: 5, ...none })).rejects.toThrow();
    await expect(repo.addSet('nope', ex.id, { load_kg: 1, reps: 5, ...none })).rejects.toThrow(/workout not found/);
    expect((await repo.setsForWorkout(w.id)).length).toBe(0);
  });
  it('removing a workout removes its sets only', async () => {
    const repo = await freshRepo();
    const w1 = await repo.createWorkout({ date: '2026-11-01', name: 'A', kind: 'weights' });
    const w2 = await repo.createWorkout({ date: '2026-11-02', name: 'B', kind: 'weights' });
    const ex = await repo.createExercise('Squat', '', []);
    await repo.addSet(w1.id, ex.id, { load_kg: 1, reps: 1, ...none });
    await repo.addSet(w2.id, ex.id, { load_kg: 2, reps: 2, ...none });
    await repo.removeWorkout(w1.id);
    expect((await repo.setsForWorkout(w1.id)).length).toBe(0);
    expect((await repo.setsForWorkout(w2.id)).length).toBe(1);
  });
  it('moving a workout to another date keeps its sets', async () => {
    const repo = await freshRepo();
    const w = await repo.createWorkout({ date: '2026-11-02', name: 'A', kind: 'weights' });
    const ex = await repo.createExercise('Squat', '', []);
    await repo.addSet(w.id, ex.id, { load_kg: 1, reps: 1, ...none });
    await repo.updateWorkout(w.id, { date: '2026-11-04' });
    expect((await repo.workoutsBetween('2026-11-02', '2026-11-02')).length).toBe(0);
    expect((await repo.workoutsBetween('2026-11-04', '2026-11-04'))[0].id).toBe(w.id);
    expect((await repo.setsForWorkout(w.id)).length).toBe(1);
    await expect(repo.updateWorkout(w.id, { date: 'tomorrow' })).rejects.toThrow();
  });
});

describe('prior comparable session', () => {
  it('returns the latest earlier workout with the same exercise, never a different equipment', async () => {
    const repo = await freshRepo();
    const press = await repo.createExercise('Chest Press', 'Machine A', []);
    const pressB = await repo.createExercise('Chest Press', 'Machine B', []);
    const w1 = await repo.createWorkout({ date: '2026-10-26', name: 'W1', kind: 'weights', status: 'done' });
    const w2 = await repo.createWorkout({ date: '2026-10-29', name: 'W2', kind: 'weights', status: 'done' });
    const w3 = await repo.createWorkout({ date: '2026-11-02', name: 'W3', kind: 'weights' });
    await repo.addSet(w1.id, press.id, { load_kg: 50, reps: 8, ...none });
    await repo.addSet(w2.id, pressB.id, { load_kg: 90, reps: 8, ...none }); // different machine
    const p = await repo.priorComparable(w3, press.id);
    expect(p!.workout.id).toBe(w1.id);
    expect(p!.sets[0].load_kg).toBe(50);
    const pB = await repo.priorComparable(w3, pressB.id);
    expect(pB!.workout.id).toBe(w2.id);
    expect(await repo.priorComparable(w1, press.id)).toBeNull(); // nothing earlier
  });
  it('ignores later workouts and the workout itself; handles same-date workouts by creation order', async () => {
    const repo = await freshRepo();
    const ex = await repo.createExercise('Row', 'Cable', []);
    const am = await repo.createWorkout({ date: '2026-11-02', name: 'AM', kind: 'weights', status: 'done' });
    const pm = await repo.createWorkout({ date: '2026-11-02', name: 'PM', kind: 'weights' });
    const later = await repo.createWorkout({ date: '2026-11-05', name: 'later', kind: 'weights' });
    await repo.addSet(am.id, ex.id, { load_kg: 30, reps: 10, ...none });
    await repo.addSet(pm.id, ex.id, { load_kg: 31, reps: 10, ...none });
    await repo.addSet(later.id, ex.id, { load_kg: 99, reps: 10, ...none });
    expect((await repo.priorComparable(pm, ex.id))!.workout.id).toBe(am.id);
    expect(await repo.priorComparable(am, ex.id)).toBeNull();
  });
});

describe('watch activity link and completion (no double counting)', () => {
  const A = row({ 'Activity Type': 'Cardio', Date: '2026-11-02 06:10:00', Time: '00:45:00' });
  const B = row({ 'Activity Type': 'Running', Date: '2026-11-02 17:00:00', Time: '00:30:00', Distance: '5.00', 'Avg Pace': '6:00' });
  const G = row({ 'Activity Type': 'Golf', Date: '2026-11-02 09:00:00' });

  it('a linked activity counts once, via its workout', async () => {
    const repo = await freshRepo();
    await commitPreview(await buildPreview(csvOf([A, B, G]), repo), repo);
    const before = await repo.completionForDate('2026-11-02');
    expect(before).toEqual({ workouts: 0, unlinkedActivities: 2, total: 2 }); // golf is 'other': not counted
    const w = await repo.createWorkout({ date: '2026-11-02', name: 'Lift', kind: 'weights' });
    const [cardio] = (await repo.activitiesBetween('2026-11-02', '2026-11-02')).filter((a) => a.original_type === 'Cardio');
    await repo.linkActivity(w.id, cardio.id);
    expect((await repo.getWorkout(w.id))!.status).toBe('done');
    expect(await repo.completionForDate('2026-11-02')).toEqual({ workouts: 1, unlinkedActivities: 1, total: 2 });
  });
  it('an activity cannot be linked to two workouts; unlink frees it', async () => {
    const repo = await freshRepo();
    await commitPreview(await buildPreview(csvOf([A]), repo), repo);
    const [a] = await repo.activitiesBetween('2026-11-02', '2026-11-02');
    const w1 = await repo.createWorkout({ date: '2026-11-02', name: 'one', kind: 'weights' });
    const w2 = await repo.createWorkout({ date: '2026-11-02', name: 'two', kind: 'weights' });
    await repo.linkActivity(w1.id, a.id);
    await expect(repo.linkActivity(w2.id, a.id)).rejects.toThrow(/already linked/);
    await repo.unlinkActivity(w1.id);
    await repo.linkActivity(w2.id, a.id);
    expect((await repo.getWorkout(w2.id))!.linked_activity_id).toBe(a.id);
  });
  it('re-import never alters a linked workout or its sets', async () => {
    const repo = await freshRepo();
    const bytes = csvOf([A]);
    await commitPreview(await buildPreview(bytes, repo), repo);
    const [a] = await repo.activitiesBetween('2026-11-02', '2026-11-02');
    const w = await repo.createWorkout({ date: '2026-11-02', name: 'Lift', kind: 'weights' });
    const ex = await repo.createExercise('Squat', '', []);
    await repo.addSet(w.id, ex.id, { load_kg: 80, reps: 5, ...none });
    await repo.linkActivity(w.id, a.id);
    expect((await commitPreview(await buildPreview(bytes, repo), repo)).added).toBe(0);
    expect((await repo.getWorkout(w.id))!.linked_activity_id).toBe(a.id);
    expect((await repo.setsForWorkout(w.id)).length).toBe(1);
  });
  it('type-mapping change keeps manual sets and workouts', async () => {
    const repo = await freshRepo();
    await commitPreview(await buildPreview(csvOf([A]), repo), repo);
    const w = await repo.createWorkout({ date: '2026-11-02', name: 'Lift', kind: 'weights' });
    const ex = await repo.createExercise('Squat', '', []);
    await repo.addSet(w.id, ex.id, { load_kg: 80, reps: 5, ...none });
    await repo.setTypeMapping('Cardio', 'other');
    expect((await repo.setsForWorkout(w.id)).length).toBe(1);
  });
});

describe('week helpers', () => {
  it('weekDates gives Monday to Sunday', () => {
    expect(weekDates('2026-11-04')[0]).toBe('2026-11-02');
    expect(weekDates('2026-11-04')[6]).toBe('2026-11-08');
    expect(weekDates('2026-11-08')[0]).toBe('2026-11-02'); // Sunday belongs to the week before
  });
  it('3-day fallback is Mon/Wed/Fri', () => {
    expect(fallbackDates('2026-11-05')).toEqual(['2026-11-02', '2026-11-04', '2026-11-06']);
  });
  it('baseline is null with no history; otherwise a per-week average over complete weeks', () => {
    expect(baselinePerWeek([], '2026-11-02')).toBeNull();
    const rows = [
      { date: '2026-10-28', group: 'weights' as const, distance_km: null, duration_seconds: 1 },
      { date: '2026-10-29', group: 'weights' as const, distance_km: null, duration_seconds: 1 },
      { date: '2026-10-30', group: 'outdoor_run' as const, distance_km: 5, duration_seconds: 1 },
      { date: '2026-11-03', group: 'weights' as const, distance_km: null, duration_seconds: 1 }, // selected week: excluded
    ];
    expect(baselinePerWeek(rows, '2026-11-04')).toEqual({ weights: 0.5, runs: 0.3, weeks: 4 });
  });
});
