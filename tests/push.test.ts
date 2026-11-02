// Stage 5 push layer. Every expected figure comes from tests/oracle/oracle_push.py (hand-worked, exact fractions, SYNTHETIC data).
import 'fake-indexeddb/auto';
import { existsSync, readFileSync } from 'node:fs';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { RecompDB } from '../src/db/db';
import { BACKUP_SCHEMA_VERSION, TABLE_NAMES, normalizeNegativeZero, serializeBackup, validateBackup, type BackupDoc, type BackupTables } from '../src/lib/backup';
import { runningBests } from '../src/lib/bests';
import { sparsePoints, validateCheckin, windowMean } from '../src/lib/checkins';
import { checkinsCsv, goalsCsv } from '../src/lib/csvExport';
import { activeGoalsForWeek, progressText, validateGoal, weekProgress } from '../src/lib/goals';
import { findAchievedPrs } from '../src/lib/pr';
import { freshRepo } from './helpers';
import type { GoalRevision } from '../src/db/types';

const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const O = fx('oracle-push.json');
const V4 = fx('synthetic-backup-v4.json') as BackupDoc;
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

describe('achieved PR vs the oracle', () => {
  const found = findAchievedPrs(O.pr.input);
  it('flags exactly the sets the oracle (and the hand calculation) flags: beat yes; equal, warm-up, missing reps/load, 40 reps, other equipment no', () => {
    expect(found.map((p) => p.setId).sort()).toEqual(O.pr.expected_set_ids);
  });
  it('estimated 1RM and the previous best match the oracle to 1 decimal', () => {
    const got = found.map((p) => ({ setId: p.setId, e1rm: p.e1rm, previousBest: p.previousBest })).sort((a, b) => (a.setId < b.setId ? -1 : 1));
    expect(got).toEqual(O.pr.expected);
  });
  it('the first recorded set of an exercise is a baseline, never a PR', () => {
    const one = findAchievedPrs([{ id: 'x', workout_id: 'w', exercise_id: 'e', ordinal: 1, load_kg: 100, reps: 5, warmup: false, date: '2026-11-01', workout_created_at: 't' }]);
    expect(one).toEqual([]);
  });
  it('a warm-up can neither be a PR nor set the bar to beat', () => {
    const rows = [
      { id: 'a', workout_id: 'w1', exercise_id: 'e', ordinal: 1, load_kg: 50, reps: 5, warmup: false, date: '2026-11-01', workout_created_at: 't1' },
      { id: 'b', workout_id: 'w1', exercise_id: 'e', ordinal: 2, load_kg: 200, reps: 5, warmup: true, date: '2026-11-01', workout_created_at: 't1' },
      { id: 'c', workout_id: 'w2', exercise_id: 'e', ordinal: 1, load_kg: 55, reps: 5, warmup: false, date: '2026-11-08', workout_created_at: 't2' },
    ];
    expect(findAchievedPrs(rows).map((p) => p.setId)).toEqual(['c']);
  });
});

describe('achieved PR through the repository (computed on read, so it follows edits)', () => {
  it('logging a heavier set creates a PR; editing it down removes it; different equipment is separate', async () => {
    const repo = await freshRepo();
    const bb = await repo.createExercise('Bench Press', 'Barbell', ['chest']);
    const bd = await repo.createExercise('Bench Press', 'Dumbbell', ['chest']);
    const w1 = await repo.createWorkout({ date: '2026-10-26', name: '', kind: 'weights', status: 'done' });
    const w2 = await repo.createWorkout({ date: '2026-11-02', name: '', kind: 'weights' });
    await repo.addSet(w1.id, bb.id, { load_kg: 80, reps: 8, rir: null, warmup: false, pain_note: null });
    await repo.addSet(w1.id, bd.id, { load_kg: 30, reps: 8, rir: null, warmup: false, pain_note: null });
    expect(await repo.achievedPrs()).toEqual([]);
    const s = await repo.addSet(w2.id, bb.id, { load_kg: 80, reps: 9, rir: null, warmup: false, pain_note: null });
    const prs = await repo.achievedPrs();
    expect(prs.map((p) => [p.setId, p.exerciseId])).toEqual([[s.id, bb.id]]); // the dumbbell exercise is untouched by the barbell sets
    await repo.updateSet(s.id, { load_kg: 80, reps: 8, rir: null, warmup: false, pain_note: null }); // equal now
    expect(await repo.achievedPrs()).toEqual([]);
    await repo.updateSet(s.id, { load_kg: 80, reps: 9, rir: null, warmup: true, pain_note: null }); // flagged warm-up
    expect(await repo.achievedPrs()).toEqual([]);
  });
});

describe('goals vs the oracle (weeks run Monday to Sunday)', () => {
  const rows = (latest: string, table: 'expected_full' | 'expected_lagging') => {
    const out: Record<string, unknown[]> = {};
    for (const ws of O.goals.weeks as string[]) {
      out[ws] = weekProgress(O.goals.revisions, ws, { ...O.goals.facts, latestActivityDate: latest })
        .map((p) => ({ rev_id: p.goal.id, value: p.value, target: p.target, met: p.met, partial: p.partial }));
    }
    expect(out).toEqual(O.goals[table]);
    return out;
  };
  it('every week matches, including the Sunday/Monday boundary, a linked workout counted once, a revised target and an archived goal', () => {
    rows(O.goals.latest_full, 'expected_full');
  });
  it('when the watch import stops before a week, run/lift/km goals are flagged partial and sets goals are not', () => {
    rows(O.goals.latest_lagging, 'expected_lagging');
  });
  it('a past week keeps the target it had; a week before a goal existed does not show it', () => {
    const wk19 = activeGoalsForWeek(O.goals.revisions, '2026-10-19').find((g) => g.goal_id === 'g1a');
    const wk26 = activeGoalsForWeek(O.goals.revisions, '2026-10-26').find((g) => g.goal_id === 'g1a');
    expect([wk19?.target, wk26?.target]).toEqual([3, 4]);
    expect(activeGoalsForWeek(O.goals.revisions, '2026-10-05')).toEqual([]);
  });
  it('no goals exist by default', () => {
    expect(weekProgress([], '2026-10-26', { activities: [], workouts: [], sets: [], latestActivityDate: null })).toEqual([]);
  });
  it('wording is neutral: no negative words for a missed week', () => {
    const p = weekProgress(O.goals.revisions, '2026-10-26', { ...O.goals.facts, latestActivityDate: '2026-11-02' });
    const texts = p.map((x) => progressText(x, true));
    expect(texts).toContain('2 of 4 lifts');
    expect(texts.join(' ')).not.toMatch(/miss|fail|behind|streak|lost|red/i);
  });
  it('validation', () => {
    const ok = { kind: 'lifts_per_week' as const, name: 'x', target: 3, muscle: null, include_treadmill: false };
    expect(validateGoal(ok)).toEqual([]);
    expect(validateGoal({ ...ok, name: '  ' })).toHaveLength(1);
    expect(validateGoal({ ...ok, target: 0 })).toHaveLength(1);
    expect(validateGoal({ ...ok, target: 2.5 })).toHaveLength(1);
    expect(validateGoal({ ...ok, kind: 'km_per_week', target: 12.5 })).toEqual([]);
    expect(validateGoal({ ...ok, kind: 'sets_per_muscle_per_week', muscle: null })).not.toEqual([]);
    expect(validateGoal({ ...ok, kind: 'sets_per_muscle_per_week', muscle: 'Chest' })).toEqual([]);
    expect(validateGoal({ ...ok, muscle: 'chest' })).not.toEqual([]);
  });
});

describe('goals through the repository: edits keep history', () => {
  it('create, revise from a later week, archive; earlier weeks are unchanged; all revisions are kept', async () => {
    const repo = await freshRepo();
    expect(await repo.listGoalRevisions()).toEqual([]);
    const g = await repo.createGoal({ kind: 'runs_per_week', name: 'Run <i>3x</i>', target: 3, muscle: null, include_treadmill: false }, '2026-10-28'); // Wed
    expect(g.effective_from).toBe('2026-10-26'); // Monday of that week
    await repo.reviseGoal(g.id, { target: 4, name: 'Run 4x' }, '2026-11-02');
    await repo.archiveGoal(g.id, '2026-11-16');
    const revs = await repo.listGoalRevisions();
    expect(revs).toHaveLength(3);
    expect(revs.find((r) => r.id === g.id)?.target).toBe(3); // first revision untouched
    const at = (w: string) => activeGoalsForWeek(revs, w).map((r) => `${r.name}:${r.target}`);
    expect(at('2026-10-19')).toEqual([]);
    expect(at('2026-10-26')).toEqual(['Run <i>3x</i>:3']);
    expect(at('2026-11-02')).toEqual(['Run 4x:4']);
    expect(at('2026-11-09')).toEqual(['Run 4x:4']);
    expect(at('2026-11-16')).toEqual([]); // archived from this week; earlier weeks still show it
    await expect(repo.reviseGoal(g.id, { target: 2 }, '2026-11-23')).rejects.toThrow(/not found/);
  });
  it('the goal type cannot change and bad input is refused', async () => {
    const repo = await freshRepo();
    const g = await repo.createGoal({ kind: 'sets_per_muscle_per_week', name: 'Back', target: 10, muscle: '  Back  ', include_treadmill: false }, '2026-11-02');
    expect(g.muscle).toBe('back');
    await expect(repo.reviseGoal(g.id, { target: -1 }, '2026-11-02')).rejects.toThrow(/target/);
    await expect(repo.createGoal({ kind: 'lifts_per_week', name: '', target: 3, muscle: null, include_treadmill: false }, '2026-11-02')).rejects.toThrow(/name/);
  });
  it('goalWeekFacts feeds goalValue from real rows: a logged set counts toward the muscle in its week', async () => {
    const repo = await freshRepo();
    const ex = await repo.createExercise('Row', 'Cable', ['Back']);
    const w = await repo.createWorkout({ date: '2026-11-01', name: '', kind: 'weights', status: 'done' }); // Sunday
    const w2 = await repo.createWorkout({ date: '2026-11-02', name: '', kind: 'weights', status: 'done' }); // Monday
    await repo.addSet(w.id, ex.id, { load_kg: 40, reps: 10, rir: null, warmup: false, pain_note: null });
    await repo.addSet(w2.id, ex.id, { load_kg: 40, reps: 10, rir: null, warmup: false, pain_note: null });
    const g = await repo.createGoal({ kind: 'sets_per_muscle_per_week', name: 'Back', target: 10, muscle: 'back', include_treadmill: false }, '2026-10-26');
    const revs = await repo.listGoalRevisions();
    const sun = weekProgress(revs, '2026-10-26', await repo.goalWeekFacts('2026-10-26'));
    const mon = weekProgress(revs, '2026-11-02', await repo.goalWeekFacts('2026-11-02'));
    expect([sun[0].goal.id, sun[0].value, mon[0].value]).toEqual([g.id, 1, 1]);
    const lifts = await repo.createGoal({ kind: 'lifts_per_week', name: 'Lift', target: 2, muscle: null, include_treadmill: false }, '2026-10-26');
    const l = weekProgress(await repo.listGoalRevisions(), '2026-10-26', await repo.goalWeekFacts('2026-10-26')).find((p) => p.goal.id === lifts.id)!;
    expect([l.value, l.partial]).toEqual([1, true]); // 1 done weights workout; no watch import at all -> partial
  });
});

describe('running bests vs the oracle', () => {
  it('matches: 4.9 km, missing pace, missing distance and treadmill runs are excluded; ties go to the earliest date', () => {
    expect(runningBests(O.bests.runs)).toEqual(O.bests.expected);
  });
  it('no qualifying run gives blanks (null, n = 0), never 0', () => {
    expect(runningBests([])).toEqual(O.bests.expected_empty);
    expect(runningBests([{ date: '2026-10-01', group: 'treadmill_run', distance_km: 10, avg_pace_sec_per_km: 300 }, { date: '2026-10-02', group: 'outdoor_run', distance_km: 10, avg_pace_sec_per_km: null }])).toEqual(O.bests.expected_empty);
  });
  it('a long run is not split: a 4.9 km run never fills the 5 km best, and 5 km best needs a 5 km run', () => {
    const b = runningBests([{ date: '2026-10-01', group: 'outdoor_run', distance_km: 4.9, avg_pace_sec_per_km: 200 }]);
    expect(b.fastest5k.value).toBeNull();
    expect(b.longest.value).toBe(4.9);
  });
});

describe('check-ins vs the oracle', () => {
  it('7-calendar-day mean, n and window match, for sparse entries, future entries and an empty window', () => {
    for (const c of O.checkins.cases) {
      expect(windowMean(O.checkins.entries, c.selected, 'weight_kg'), `${c.selected} weight`).toEqual(c.weight);
      expect(windowMean(O.checkins.entries, c.selected, 'waist_cm'), `${c.selected} waist`).toEqual(c.waist);
    }
  });
  it('is not "the last 7 entries"', () => {
    const entries = O.checkins.entries;
    const lastSeven = entries.slice(-7).map((e: { weight_kg: number }) => e.weight_kg);
    const naive = Math.round((lastSeven.reduce((a: number, b: number) => a + b, 0) / lastSeven.length) * 100) / 100;
    expect(naive).not.toBe(windowMean(entries, '2026-11-01', 'weight_kg').mean);
  });
  it('sparse points are real readings only, placed by calendar day, none invented', () => {
    const pts = sparsePoints(O.checkins.entries, '2026-11-02', 'weight_kg', 30);
    expect(pts.map((p) => p.date)).toEqual(['2026-10-25', '2026-10-26', '2026-10-27', '2026-10-29', '2026-10-31', '2026-11-02']);
    expect(pts.map((p) => p.dayIndex)).toEqual([21, 22, 23, 25, 27, 29]); // window starts 2026-10-04 (29 days before 11-02): 25 Oct is day 21 ... 2 Nov is day 29
    expect(sparsePoints(O.checkins.entries, '2026-11-02', 'waist_cm', 30).map((p) => p.value)).toEqual([90, 89.5, 89]);
  });
  it('validation: blank-both refused, future refused, unknown stays null', () => {
    const today = '2026-11-02';
    expect(validateCheckin({ date: today, weight_kg: null, waist_cm: null, note: null }, today)).not.toEqual([]);
    expect(validateCheckin({ date: '2026-11-03', weight_kg: 80, waist_cm: null, note: null }, today)).toEqual(['a check-in cannot be dated in the future']);
    expect(validateCheckin({ date: today, weight_kg: 80, waist_cm: null, note: null }, today)).toEqual([]);
    expect(validateCheckin({ date: today, weight_kg: 0, waist_cm: null, note: null }, today)).not.toEqual([]);
    expect(validateCheckin({ date: '2026-02-30', weight_kg: 80, waist_cm: null, note: null }, today)).not.toEqual([]);
  });
  it('repository: one entry per date (saving again replaces), blank stays null, future refused, remove works', async () => {
    const repo = await freshRepo();
    const a = await repo.saveCheckin({ date: '2026-11-01', weight_kg: 82, waist_cm: null, note: '  ' }, '2026-11-02');
    expect(a.waist_cm).toBeNull();
    expect(a.note).toBeNull();
    const b = await repo.saveCheckin({ date: '2026-11-01', weight_kg: 81.5, waist_cm: 90, note: 'after run' }, '2026-11-02');
    expect(b.id).toBe(a.id);
    expect((await repo.listCheckins()).map((c) => [c.date, c.weight_kg, c.waist_cm, c.note])).toEqual([['2026-11-01', 81.5, 90, 'after run']]);
    await expect(repo.saveCheckin({ date: '2026-11-05', weight_kg: 80, waist_cm: null, note: null }, '2026-11-02')).rejects.toThrow(/future/);
    await expect(repo.saveCheckin({ date: '2026-11-02', weight_kg: null, waist_cm: null, note: null }, '2026-11-02')).rejects.toThrow(/weight or a waist/);
    await repo.removeCheckin('2026-11-01');
    expect(await repo.listCheckins()).toEqual([]);
  });
});

describe('schema v4 and backup of the new tables', () => {
  const seed = async (repo: Awaited<ReturnType<typeof freshRepo>>, t: BackupTables) => {
    for (const n of TABLE_NAMES) await (repo.db[n] as unknown as { bulkAdd(x: unknown[]): Promise<unknown> }).bulkAdd(t[n]);
  };
  it('migration ledger records version 4 and the schema version is 4', async () => {
    const repo = await freshRepo();
    expect((await repo.listMigrations()).map((m) => m.version)).toEqual([1, 2, 3, 4]);
    expect(BACKUP_SCHEMA_VERSION).toBe(4);
    expect(TABLE_NAMES).toContain('goals');
    expect(TABLE_NAMES).toContain('checkins');
  });
  it('upgrading a real v3 database to v4 keeps its data and adds empty goals/check-ins', async () => {
    const name = `upgrade-${Date.now()}`;
    const old = new Dexie(name);
    old.version(1).stores({ migrations: 'version', batches: 'id, file_sha256, imported_at', activities: 'id, batch_id, &dedupe_key, date, original_type', type_mappings: 'original_type, id' });
    old.version(2).stores({ exercises: 'id, &exercise_key, name', workouts: 'id, date, status, &linked_activity_id', sets: 'id, workout_id, exercise_id' });
    old.version(3).stores({});
    await old.open();
    await old.table('exercises').add({ id: 'e1', owner_id: null, name: 'Row', equipment: 'Cable', primary_muscles: ['back'], exercise_key: 'row|cable', created_at: '2026-10-01T00:00:00.000Z' });
    old.close();
    const { Repo } = await import('../src/db/repo');
    const repo = await Repo.open(new RecompDB(name));
    expect((await repo.listExercises()).map((e) => e.id)).toEqual(['e1']);
    expect(await repo.tableCounts()).toMatchObject({ exercises: 1, goals: 0, checkins: 0 });
    await repo.createGoal({ kind: 'lifts_per_week', name: 'Lift', target: 3, muscle: null, include_treadmill: false }, '2026-11-02');
    expect((await repo.listGoalRevisions()).length).toBe(1);
  });
  it('v4 fixture: restore, export deep-equal to the fixture, wipe and restore again: lossless for goals and check-ins', async () => {
    const r = validateBackup(JSON.stringify(V4));
    expect(r.ok).toBe(true);
    const repo = await freshRepo();
    if (r.ok) await repo.restoreBackup(r.backup);
    expect(await repo.tableCounts()).toEqual(fx('oracle-push-backup-expected.json').counts_v4);
    const text = serializeBackup(await repo.exportBackup(new Date('2026-11-02T04:00:00.000Z')));
    const out = JSON.parse(text) as BackupDoc;
    for (const t of TABLE_NAMES) expect(out.tables[t], t).toEqual(V4.tables[t]);
    for (const t of TABLE_NAMES) await repo.db[t].clear();
    const again = validateBackup(text);
    expect(again.ok).toBe(true);
    if (again.ok) await repo.restoreBackup(again.backup);
    const back = JSON.parse(JSON.stringify((await repo.exportBackup(new Date(0))).tables));
    for (const t of TABLE_NAMES) expect(normalizeNegativeZero(back[t]), t).toEqual(normalizeNegativeZero(V4.tables[t]));
  });
  it('repository-created goals and check-ins survive backup, wipe, restore', async () => {
    const repo = await freshRepo();
    const g = await repo.createGoal({ kind: 'km_per_week', name: '<script>alert(1)</script>', target: 25.5, muscle: null, include_treadmill: true }, '2026-11-02');
    await repo.reviseGoal(g.id, { target: 30 }, '2026-11-09');
    await repo.saveCheckin({ date: '2026-11-02', weight_kg: 81.5, waist_cm: null, note: '=cmd|"x"\nline2' }, '2026-11-02');
    const before = JSON.parse(JSON.stringify((await repo.exportBackup(new Date(0))).tables));
    const text = serializeBackup(await repo.exportBackup());
    for (const t of TABLE_NAMES) await repo.db[t].clear();
    const v = validateBackup(text);
    expect(v.ok).toBe(true);
    if (v.ok) await repo.restoreBackup(v.backup);
    expect(JSON.parse(JSON.stringify((await repo.exportBackup(new Date(0))).tables))).toEqual(before);
  });
  const mut = (f: (d: BackupDoc) => void) => { const d = clone(V4); f(d); return JSON.stringify(d); };
  const bad: [string, string, RegExp][] = [
    ['goal with unknown type', mut((d) => { (d.tables.goals[0] as unknown as Record<string, unknown>).kind = 'streak'; }), /goals\[0\]\.kind/],
    ['goal target 0', mut((d) => { d.tables.goals[0].target = 0; }), /target/],
    ['goal revision whose first revision is missing', mut((d) => { d.tables.goals[1].goal_id = 'nope'; }), /first revision is missing/],
    ['revision that changes the goal type', mut((d) => { d.tables.goals[1].kind = 'km_per_week'; }), /changes the goal type/],
    ['sets goal without a muscle', mut((d) => { d.tables.goals[2].muscle = null; }), /muscle/],
    ['check-in with neither value', mut((d) => { d.tables.checkins[0].weight_kg = null; }), /weight or a waist/],
    ['check-in weight 0', mut((d) => { d.tables.checkins[0].weight_kg = 0; }), /weight must be/],
    ['two check-ins on one date', mut((d) => { d.tables.checkins[1].date = d.tables.checkins[0].date; }), /checkins\.date/],
    ['check-in with a bad date', mut((d) => { d.tables.checkins[0].date = '2026-02-31'; }), /YYYY-MM-DD/],
    ['v4 backup missing the check-ins table', mut((d) => { delete (d.tables as unknown as Record<string, unknown>).checkins; }), /"checkins" is missing/],
    ['counts disagree for goals', mut((d) => { d.counts.goals = 99; }), /goals: counts says 99/],
  ];
  it.each(bad)('rejects: %s', async (_n, text, expected) => {
    const repo = await freshRepo();
    await repo.saveCheckin({ date: '2026-11-01', weight_kg: 80, waist_cm: null, note: null }, '2026-11-02');
    const before = JSON.stringify((await repo.exportBackup(new Date(0))).tables);
    const r = validateBackup(text);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.join(' | ')).toMatch(expected);
    expect(JSON.stringify((await repo.exportBackup(new Date(0))).tables)).toBe(before);
  });
  it('a v3 backup that sneaks in a goals table is rejected (that table does not exist in v3)', () => {
    const d = fx('synthetic-backup-v3.json');
    d.tables.goals = [];
    d.counts.goals = 0;
    const r = validateBackup(JSON.stringify(d));
    expect(!r.ok && r.errors.join(' ')).toMatch(/unexpected table "goals"/);
  });
  it('seed helper sanity: all tables seedable', async () => {
    const repo = await freshRepo();
    await seed(repo, V4.tables);
    expect(await repo.tableCounts()).toEqual(V4.counts);
  });
});

describe('CSV export of the new tables', () => {
  it('check-ins: dated oldest first, unmeasured is blank (not 0), text is formula-guarded', () => {
    const csv = checkinsCsv(V4.tables.checkins);
    const lines = csv.replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('date,weight_kg,waist_cm,note');
    expect(lines[1]).toBe('2026-10-31,81.9,,<img src=x onerror=alert(1)>');
    expect(lines[2]).toBe('2026-11-01,,89.5,');
    expect(csv).toContain("\"'=1+1\n\"\"quoted\"\", tab\there\"");
    expect(csv.endsWith('\r\n')).toBe(true);
  });
  it('goals: every revision, with a guard on a name that starts with =', () => {
    const lines = goalsCsv(V4.tables.goals as GoalRevision[]).replace('﻿', '').split('\r\n');
    expect(lines[0]).toBe('goal_id,effective_from,name,type,target,muscle,include_treadmill,archived');
    expect(lines).toHaveLength(3 + 2);
    expect(lines[1]).toContain("'=Run <b>3x</b>");
  });
});

const CSV = new URL('../data-local/Activities.csv', import.meta.url);
const ORACLE_REAL = new URL('../data-local/oracle-push-real.json', import.meta.url);
if (!existsSync(CSV) || !existsSync(ORACLE_REAL)) console.warn('REAL-DATA BESTS TEST SKIPPED: data-local/Activities.csv or data-local/oracle-push-real.json missing');
describe.skipIf(!existsSync(CSV) || !existsSync(ORACLE_REAL))('real data: running bests vs an independent Python computation', () => {
  it('matches data-local/oracle-push-real.json (produced by tests/oracle/oracle_push_real.py from the CSV, not by the app)', async () => {
    const { buildPreview, commitPreview } = await import('../src/lib/importer');
    const repo = await freshRepo();
    await commitPreview(await buildPreview(new Uint8Array(readFileSync(CSV)), repo, 'Activities.csv'), repo);
    const expected = JSON.parse(readFileSync(new URL('../data-local/oracle-push-real.json', import.meta.url), 'utf8'));
    expect(await repo.runningBests()).toEqual(expected.bests);
  });
});
