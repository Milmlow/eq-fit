import { afterEach, describe, expect, it } from 'vitest';
import { freshRepo } from './helpers';
import type { Repo } from '../src/db/repo';
import { serializeBackup, validateBackup } from '../src/lib/backup';
import { RecompDB } from '../src/db/db';
import { Repo as Repository } from '../src/db/repo';
import Dexie from 'dexie';

const repos: Repo[] = [];
async function setup() {
  const repo = await freshRepo(); repos.push(repo);
  const bench = await repo.createExercise('Bench press', 'Barbell', ['chest']);
  const row = await repo.createExercise('Tom’s row', 'Cable', ['back']);
  return { repo, bench, row };
}
afterEach(async () => { for (const r of repos.splice(0)) await r.db.delete(); });

describe('saved workouts are plans, not training records', () => {
  it('retains exercise order and identity but never copies sets, notes or completion', async () => {
    const { repo, bench, row } = await setup();
    const routine = await repo.saveRoutine('Tom’s Push Day', [row.id, bench.id]);
    expect(await repo.completionForDate('2026-11-03')).toMatchObject({ total: 0 });
    expect(await repo.db.workouts.count()).toBe(0);
    const first = await repo.startRoutine(routine.id, '2026-11-03');
    expect(first).toMatchObject({ name: routine.name, status: 'planned', linked_activity_id: null, notes: '', planned_exercise_ids: [row.id, bench.id] });
    await repo.addSet(first.id, bench.id, { load_kg: 80, reps: 8, rir: 2, warmup: false, pain_note: 'private' });
    await repo.updateWorkout(first.id, { status: 'done', notes: 'private session note' });
    const next = await repo.startRoutine(routine.id, '2026-11-04');
    expect(await repo.setsForWorkout(next.id)).toEqual([]);
    expect(next.status).toBe('planned'); expect(next.notes).toBe('');
    expect((await repo.priorComparable(next, bench.id))?.sets[0].reps).toBe(8);
    expect((await repo.completionForDate('2026-11-04')).total).toBe(0);
  });
  it('editing a routine never changes a started session or its logged history', async () => {
    const { repo, bench, row } = await setup();
    const routine = await repo.saveRoutine('Old', [bench.id]);
    const w = await repo.startRoutine(routine.id, '2026-11-03');
    await repo.saveRoutine('New', [row.id, bench.id], routine.id);
    expect((await repo.getWorkout(w.id))?.planned_exercise_ids).toEqual([bench.id]);
    expect((await repo.getWorkout(w.id))?.name).toBe('Old');
    expect(await repo.listRoutines()).toHaveLength(1);
  });
  it('rejects empty names, empty lists, duplicate exercises and dangling references without writes', async () => {
    const { repo, bench } = await setup();
    for (const [name, ids] of [['', [bench.id]], ['X', []], ['X', [bench.id, bench.id]], ['X', ['missing']]] as [string, string[]][]) {
      await expect(repo.saveRoutine(name, ids)).rejects.toThrow();
    }
    await expect(repo.startRoutine('missing', '2026-11-03')).rejects.toThrow();
    expect(await repo.listRoutines()).toEqual([]); expect(await repo.db.workouts.count()).toBe(0);
  });
  it('round-trips routines in backup and rejects broken routine references before restoring', async () => {
    const { repo, bench } = await setup();
    await repo.saveRoutine('My workout', [bench.id]);
    const backup = await repo.exportBackup();
    const valid = validateBackup(serializeBackup(backup));
    expect(valid.ok).toBe(true);
    const other = await freshRepo(); repos.push(other);
    if (valid.ok) await other.restoreBackup(valid.backup);
    expect(await other.listRoutines()).toEqual(await repo.listRoutines());
    backup.tables.routines[0].exercise_ids = ['missing'];
    expect(validateBackup(serializeBackup(backup)).ok).toBe(false);
    expect(await other.listRoutines()).toHaveLength(1);
  });
  it('keeps friend profiles isolated', async () => {
    const { repo, bench } = await setup();
    await repo.saveRoutine('Owner only', [bench.id]);
    const friend = await freshRepo(); repos.push(friend);
    expect(await friend.listRoutines()).toEqual([]);
  });
  it('upgrades an existing v3 database without altering its records', async () => {
    const name = `upgrade-routines-${crypto.randomUUID()}`;
    const old = new Dexie(name);
    old.version(3).stores({ migrations: 'version', batches: 'id, file_sha256, imported_at', activities: 'id, batch_id, &dedupe_key, date, original_type', type_mappings: 'original_type, id', exercises: 'id, &exercise_key, name', workouts: 'id, date, status, &linked_activity_id', sets: 'id, workout_id, exercise_id' });
    await old.open();
    const exercise = { id: 'old-ex', owner_id: null, name: 'Squat', equipment: 'Barbell', exercise_key: 'squat|barbell', primary_muscles: [], created_at: new Date().toISOString() };
    await old.table('exercises').add(exercise); old.close();
    const repo = await Repository.open(new RecompDB(name)); repos.push(repo);
    expect(await repo.listExercises()).toEqual([exercise]); expect(await repo.listRoutines()).toEqual([]);
    await repo.saveRoutine('Leg day', [exercise.id]); expect(await repo.listRoutines()).toHaveLength(1);
  });
});
