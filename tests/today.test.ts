import { describe, expect, it } from 'vitest';
import { loadHero } from '../src/lib/hero';
import { DEMO_HERO, demoFromSearch } from '../src/lib/demo';
import { startToday } from '../src/lib/start';
import { dash, formatTodayLabel, fourWeekPace, lastWeekStats, paceMinSec } from '../src/lib/todayStats';
import { buildPreview, commitPreview } from '../src/lib/importer';
import { csvOf, freshRepo, row } from './helpers';

const TODAY = '2026-11-02';
const act = (type: string, date: string, dist: string, pace: string) =>
  row({ 'Activity Type': type, Date: `${date} 07:00:00`, Title: type, Distance: dist, Time: '00:40:00', 'Avg Pace': pace });
const lift = (type: string, date: string) => row({ 'Activity Type': type, Date: `${date} 17:00:00`, Title: type, Time: '00:40:00' });

// last complete week 2026-10-26..11-01: 5 weights entries, 3 outdoor runs (10 + 8 + 5 = 23 km), 1 treadmill run (excluded)
const ROWS = [
  lift('Strength Training', '2026-10-26'), lift('Cardio', '2026-10-27'), lift('Strength Training', '2026-10-28'), lift('Strength Training', '2026-10-30'), lift('Strength Training', '2026-11-01'),
  act('Running', '2026-10-27', '10.00', '6:00'), act('Running', '2026-10-29', '8.00', '5:30'), act('Running', '2026-11-01', '5.00', '6:00'),
  act('Treadmill Running', '2026-10-28', '3.00', '7:00'),
  act('Running', '2026-10-05', '5.00', '5:00'), act('Running', '2026-10-14', '10.00', '6:30'), act('Running', '2026-10-20', '4.00', '5:45'),
];
// hand arithmetic: sum(pace*km) = 10*360 + 8*330 + 5*360 + 5*300 + 10*390 + 4*345 = 14820 ; km = 42 ; 14820/42 = 352.857 s -> 5:53

async function seeded() {
  const repo = await freshRepo();
  await commitPreview(await buildPreview(csvOf(ROWS), repo), repo);
  return repo;
}

describe('Today stats from existing functions', () => {
  it('last-week totals and 4-week pace match the hand-worked values (treadmill excluded)', async () => {
    const repo = await seeded();
    const rows = (await repo.activitiesBetween('2026-09-01', TODAY)).map((a) => ({ date: a.date, group: a.group, distance_km: a.distance_km, duration_seconds: a.duration_seconds, avg_pace_sec_per_km: a.avg_pace_sec_per_km }));
    const latest = await repo.latestActivityDate();
    expect(lastWeekStats(rows, TODAY, latest)).toMatchObject({ start: '2026-10-26', end: '2026-11-01', lifts: 5, runs: 3, km: 23 });
    const pace = fourWeekPace(rows, TODAY, latest);
    expect(pace).toBeCloseTo(352.86, 2);
    expect(paceMinSec(pace)).toBe('5:53');
  });
  it('missing data is "-", never zero', async () => {
    const repo = await freshRepo();
    const w = lastWeekStats([], TODAY, null);
    expect([w.lifts, w.runs, w.km]).toEqual([null, null, null]);
    expect(fourWeekPace([], TODAY, null)).toBeNull();
    expect(dash(null)).toBe('-'); expect(dash(null, 2)).toBe('-'); expect(paceMinSec(null)).toBe('-');
    // import ends before the last week: unknown, not zero
    const rows = [{ date: '2026-10-01', group: 'weights' as const, distance_km: null, duration_seconds: null, avg_pace_sec_per_km: null }];
    expect(lastWeekStats(rows, TODAY, '2026-10-01')).toMatchObject({ lifts: null, runs: null, km: null });
    expect(fourWeekPace(rows, TODAY, '2026-10-01')).toBeNull();
    const hero = await loadHero(repo, TODAY);
    expect(hero.lastWeek.lifts).toBeNull(); expect(hero.paceSec).toBeNull();
  });
  it('formats the date like "Mon 2 Nov"', () => {
    expect(formatTodayLabel('2026-11-02')).toBe('Mon 2 Nov');
    expect(formatTodayLabel('2026-12-31')).toBe('Thu 31 Dec');
  });
  it('pace formatting rounds to the second', () => { expect(paceMinSec(348.94)).toBe('5:49'); expect(paceMinSec(359.6)).toBe('6:00'); });
});

describe('Today hero wiring (real repository, synthetic data)', () => {
  async function withHistory() {
    const repo = await seeded();
    const bench = await repo.createExercise('Bench Press', 'Barbell', ['chest']);
    const row2 = await repo.createExercise('Row', 'Cable', ['back']);
    const prev = await repo.createWorkout({ date: '2026-10-26', name: '', kind: 'weights', status: 'done' });
    await repo.addSet(prev.id, bench.id, { load_kg: 40, reps: 10, rir: null, warmup: true, pain_note: null });
    await repo.addSet(prev.id, bench.id, { load_kg: 80, reps: 8, rir: 2, warmup: false, pain_note: null });
    return { repo, bench, row2, prev };
  }
  it('uses the first planned exercise that has a prior comparable session', async () => {
    const { repo, bench, row2 } = await withHistory();
    const w = await repo.createWorkout({ date: TODAY, name: '', kind: 'weights' });
    await repo.updateWorkout(w.id, { planned_exercise_ids: [row2.id, bench.id] }); // Row has no history, Bench does
    const h = await loadHero(repo, TODAY);
    expect(h.exerciseName).toBe('Bench Press');
    expect(h.title).toBe('Weights session');
    expect(h.beat).toMatchObject({ kind: 'target', last: { load_kg: 80, reps: 8 }, target: { load_kg: 80, reps: 9 }, alternative: { load_kg: 82.5, reps: 7 }, pr: true });
    expect(h.lastWeek).toMatchObject({ lifts: 5, runs: 3, km: 23 });
  });
  it('no prior session: exercise name only', async () => {
    const { repo, row2 } = await withHistory();
    const w = await repo.createWorkout({ date: TODAY, name: 'Pull day', kind: 'weights' });
    await repo.updateWorkout(w.id, { planned_exercise_ids: [row2.id] });
    const h = await loadHero(repo, TODAY);
    expect(h).toMatchObject({ title: 'Pull day', exerciseName: 'Row', beat: { kind: 'none' } });
  });
  it('no planned session: default title, no exercise, nothing invented', async () => {
    const { repo } = await withHistory();
    const h = await loadHero(repo, TODAY);
    expect(h).toMatchObject({ title: 'Weights session', exerciseName: null, beat: { kind: 'none' } });
  });
  it('pain note in the last session: Last time only', async () => {
    const { repo, bench, prev } = await withHistory();
    await repo.addSet(prev.id, bench.id, { load_kg: 80, reps: 6, rir: 0, warmup: false, pain_note: 'shoulder' });
    const w = await repo.createWorkout({ date: TODAY, name: '', kind: 'weights' });
    await repo.updateWorkout(w.id, { planned_exercise_ids: [bench.id] });
    expect((await loadHero(repo, TODAY)).beat).toMatchObject({ kind: 'pain', last: { load_kg: 80, reps: 8 } });
  });
  it('a set already logged today that beats the target removes the PR cue', async () => {
    const { repo, bench } = await withHistory();
    const w = await repo.createWorkout({ date: TODAY, name: '', kind: 'weights' });
    await repo.updateWorkout(w.id, { planned_exercise_ids: [bench.id] });
    await repo.addSet(w.id, bench.id, { load_kg: 80, reps: 10, rir: 1, warmup: false, pain_note: null });
    expect((await loadHero(repo, TODAY)).beat).toMatchObject({ kind: 'target', pr: false });
  });
  it('loadHero is read-only', async () => {
    const { repo } = await withHistory();
    const count = async () => (await repo.workoutsBetween('2000-01-01', '2100-01-01')).length + (await repo.allSetsWithContext()).length + (await repo.countActivities());
    const before = await count();
    await loadHero(repo, TODAY);
    expect(await count()).toBe(before);
  });
});

describe('Start', () => {
  it('opens the existing planned weights workout without creating another', async () => {
    const repo = await freshRepo();
    const w = await repo.createWorkout({ date: TODAY, name: 'Push', kind: 'weights' });
    const r = await startToday(repo, TODAY, false);
    expect(r).toEqual({ kind: 'opened', id: w.id, created: false });
    expect((await repo.workoutsBetween(TODAY, TODAY)).length).toBe(1);
  });
  it('creates the same session "Add weights session" creates when none is planned', async () => {
    const repo = await freshRepo();
    const r = await startToday(repo, TODAY, false);
    expect(r.kind).toBe('opened');
    const ws = await repo.workoutsBetween(TODAY, TODAY);
    expect(ws).toHaveLength(1);
    const manual = await repo.createWorkout({ date: TODAY, name: '', kind: 'weights' }); // what Today's add('weights') calls
    expect(ws[0]).toMatchObject({ date: manual.date, name: manual.name, kind: manual.kind, status: manual.status, notes: manual.notes, planned_exercise_ids: manual.planned_exercise_ids });
  });
  it('ignores planned runs and done weights sessions (creates a weights session)', async () => {
    const repo = await freshRepo();
    await repo.createWorkout({ date: TODAY, name: '', kind: 'run' });
    await repo.createWorkout({ date: TODAY, name: '', kind: 'weights', status: 'done' });
    const r = await startToday(repo, TODAY, false);
    expect(r).toMatchObject({ kind: 'opened', created: true });
  });
  it('a failed start throws and reports no session', async () => {
    const repo = await freshRepo();
    await repo.db.close();
    await expect(startToday(repo, TODAY, false)).rejects.toBeTruthy();
  });
});

describe('Demo mode', () => {
  it('?demo=1 switches it on; nothing else does', () => {
    expect(demoFromSearch('?demo=1')).toBe(true);
    expect(demoFromSearch('?demo=0')).toBe(false);
    expect(demoFromSearch('')).toBe(false);
  });
  it('shows the reference values exactly', () => {
    expect(DEMO_HERO).toMatchObject({
      dateLabel: 'Mon 2 Nov', title: 'Weights session', exerciseName: 'Bench Press',
      beat: { kind: 'target', last: { load_kg: 80, reps: 8 }, target: { load_kg: 80, reps: 9 }, alternative: { load_kg: 82.5, reps: 6 }, pr: true },
      lastWeek: { lifts: 5, runs: 3, km: 26.49 },
    });
    expect(paceMinSec(DEMO_HERO.paceSec)).toBe('5:49');
  });
  it('Start in demo mode writes nothing', async () => {
    const repo = await seeded();
    const count = async () => [(await repo.workoutsBetween('2000-01-01', '2100-01-01')).length, (await repo.allSetsWithContext()).length, await repo.countActivities(), (await repo.listExercises()).length];
    const before = await count();
    expect(await startToday(repo, TODAY, true)).toEqual({ kind: 'demo' });
    expect(await count()).toEqual(before);
  });
});
