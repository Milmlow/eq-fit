import { newId } from '../lib/hash';
import { isGroup, resolveGroup, type Group } from '../lib/mapping';
import { recordMigrations, type RecompDB } from './db';
import { validateRepRange } from '../lib/lifting';
import { buildBackup, restoreBackup, tableCounts, type BackupCounts, type BackupDoc } from '../lib/backup';
import { runningCsv, setsCsv } from '../lib/csvExport';
import { addDays } from '../lib/summary';
import { exerciseKey, validateName, validateSet, workoutOrderKey, type SetInput } from '../lib/training';
import type { Activity, Exercise, ImportBatch, MigrationRecord, SetRecord, Workout, WorkoutKind } from './types';

let lastMs = 0;
/** Strictly increasing ISO timestamps within a session, so creation order is never a tie. */
function tickIso(): string {
  lastMs = Math.max(Date.now(), lastMs + 1);
  return new Date(lastMs).toISOString();
}

/** The only layer the UI talks to. The UI never imports Dexie tables directly. */
export class Repo {
  constructor(readonly db: RecompDB) {}

  static async open(db: RecompDB): Promise<Repo> {
    await db.open();
    await recordMigrations(db);
    return new Repo(db);
  }

  listMigrations(): Promise<MigrationRecord[]> {
    return this.db.migrations.orderBy('version').toArray();
  }

  countActivities(): Promise<number> {
    return this.db.activities.count();
  }

  listBatches(): Promise<ImportBatch[]> {
    return this.db.batches.orderBy('imported_at').toArray();
  }

  findBatchByFileHash(sha: string): Promise<ImportBatch | undefined> {
    return this.db.batches.where('file_sha256').equals(sha).first();
  }

  async existingDedupeKeys(keys: string[]): Promise<Set<string>> {
    const rows = await this.db.activities.where('dedupe_key').anyOf(keys).toArray();
    return new Set(rows.map((r) => r.dedupe_key));
  }

  /**
   * Atomic commit: the batch record and all new activities are written in ONE transaction.
   * If anything throws, nothing is written.
   */
  async commitImport(batch: Omit<ImportBatch, 'id' | 'owner_id'>, activities: Omit<Activity, 'batch_id'>[]): Promise<ImportBatch> {
    const full: ImportBatch = { ...batch, id: newId(), owner_id: null };
    await this.db.transaction('rw', this.db.batches, this.db.activities, async () => {
      // Re-check inside the transaction so concurrent imports cannot create duplicates.
      const have = await this.existingDedupeKeys(activities.map((a) => a.dedupe_key));
      const knownIds = new Set((await this.db.activities.toArray()).map(a => a.raw_fields['Garmin Activity ID']?.trim()).filter(Boolean));
      const fresh = activities.filter(a => {
        const sourceId = a.raw_fields['Garmin Activity ID']?.trim();
        if (have.has(a.dedupe_key) || (sourceId && knownIds.has(sourceId))) return false;
        have.add(a.dedupe_key);
        if (sourceId) knownIds.add(sourceId);
        return true;
      });
      full.new_row_count = fresh.length;
      full.skipped_duplicate_count = batch.source_row_count - fresh.length;
      if (fresh.length === 0) return; // nothing to add: no batch record either
      await this.db.batches.add(full);
      await this.db.activities.bulkAdd(fresh.map((a) => ({ ...a, batch_id: full.id })));
    });
    return full;
  }

  // ---- type mapping (reversible) -------------------------------------------------------

  async getTypeMappings(): Promise<Map<string, Group>> {
    const rows = await this.db.type_mappings.toArray();
    return new Map(rows.map((r) => [r.original_type, r.target]));
  }

  /** Set a type mapping. Original types on activities are untouched. */
  async setTypeMapping(originalType: string, target: Group): Promise<void> {
    if (!isGroup(target)) throw new Error(`invalid group: ${target}`);
    await this.db.type_mappings.put({
      id: newId(), owner_id: null, original_type: originalType, target, updated_at: new Date().toISOString(),
    });
  }

  /** Undo a type mapping: falls back to the built-in default. */
  async clearTypeMapping(originalType: string): Promise<void> {
    await this.db.type_mappings.delete(originalType);
  }

  async setActivityOverride(activityId: string, group: Group | null): Promise<void> {
    await this.db.activities.update(activityId, { mapping_override: group });
  }

  // ---- reads ---------------------------------------------------------------------------

  async activitiesBetween(startDate: string, endDate: string): Promise<(Activity & { group: Group })[]> {
    const maps = await this.getTypeMappings();
    const rows = await this.db.activities.where('date').between(startDate, endDate, true, true).toArray();
    return rows
      .map((a) => ({ ...a, group: resolveGroup(a.original_type, a.mapping_override, maps) }))
      .sort((a, b) => (a.timestamp_local < b.timestamp_local ? 1 : a.timestamp_local > b.timestamp_local ? -1 : a.row_index - b.row_index));
  }

  async latestActivityDate(): Promise<string | null> {
    const last = await this.db.activities.orderBy('date').last();
    return last?.date ?? null;
  }

  async typeCounts(): Promise<Map<string, number>> {
    const m = new Map<string, number>();
    await this.db.activities.each((a) => m.set(a.original_type, (m.get(a.original_type) ?? 0) + 1));
    return m;
  }

  // ---- Stage 2: exercises ----------------------------------------------------------------

  async createExercise(name: string, equipment: string, primaryMuscles: string[]): Promise<Exercise> {
    const errs = [...validateName('exercise name', name), ...validateName('equipment', equipment, false)];
    if (errs.length) throw new Error(errs.join('; '));
    const key = exerciseKey(name, equipment);
    const existing = await this.db.exercises.where('exercise_key').equals(key).first();
    if (existing) return existing; // same name AND equipment = same exercise
    const ex: Exercise = {
      id: newId(), owner_id: null, name: name.trim(), equipment: equipment.trim(),
      primary_muscles: primaryMuscles.map((m) => m.trim()).filter(Boolean).slice(0, 10),
      exercise_key: key, created_at: tickIso(),
    };
    await this.db.exercises.add(ex);
    return ex;
  }

  listExercises(): Promise<Exercise[]> {
    return this.db.exercises.orderBy('name').toArray();
  }

  // ---- Stage 2: workouts ------------------------------------------------------------------

  async createWorkout(w: { date: string; name: string; kind: WorkoutKind; status?: 'planned' | 'done' }): Promise<Workout> {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date)) throw new Error('date must be YYYY-MM-DD');
    const errs = validateName('workout name', w.name, false);
    if (errs.length) throw new Error(errs.join('; '));
    const wo: Workout = {
      id: newId(), owner_id: null, date: w.date, name: w.name.trim(), kind: w.kind, status: w.status ?? 'planned',
      notes: '', planned_exercise_ids: [], linked_activity_id: null, created_at: tickIso(),
    };
    await this.db.workouts.add(wo);
    return wo;
  }

  /**
   * The Start button's logic: today's first PLANNED weights workout if there is one, otherwise create the same
   * session Today's "Add weights session" creates (date, blank name, kind weights, status planned).
   */
  async openOrCreateWeightsWorkout(date: string): Promise<{ workout: Workout; created: boolean }> {
    const existing = (await this.workoutsBetween(date, date)).find((w) => w.kind === 'weights' && w.status === 'planned');
    if (existing) return { workout: existing, created: false };
    return { workout: await this.createWorkout({ date, name: '', kind: 'weights' }), created: true };
  }

  /** Repeat the exercise plan only. No completed sets, notes, links or status are carried forward. */
  async repeatWorkout(sourceId: string, date: string): Promise<Workout> {
    return this.db.transaction('rw', this.db.workouts, this.db.sets, this.db.exercises, async () => {
      const source = await this.getWorkout(sourceId);
      if (!source || source.kind !== 'weights') throw new Error('Choose a weights session to repeat.');
      const sets = await this.setsForWorkout(sourceId);
      const ids = [...new Set([...source.planned_exercise_ids, ...sets.map(s => s.exercise_id)])];
      const available = await this.db.exercises.bulkGet(ids);
      const plan = ids.filter((_, i) => !!available[i]);
      if (!plan.length) throw new Error('This session has no exercises to repeat.');
      const workout = await this.createWorkout({ date, name: source.name, kind: 'weights' });
      await this.updateWorkout(workout.id, { planned_exercise_ids: plan });
      return { ...workout, planned_exercise_ids: plan };
    });
  }

  async updateWorkout(id: string, patch: Partial<Pick<Workout, 'date' | 'name' | 'kind' | 'status' | 'notes' | 'planned_exercise_ids'>>): Promise<void> {
    if (patch.date !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(patch.date)) throw new Error('date must be YYYY-MM-DD');
    if (patch.notes !== undefined && patch.notes.length > 2000) throw new Error('notes too long');
    if (patch.name !== undefined) {
      const errs = validateName('workout name', patch.name, false);
      if (errs.length) throw new Error(errs.join('; '));
    }
    if ((await this.db.workouts.update(id, patch)) === 0) throw new Error('workout not found');
  }

  /** Removes the workout and its sets together (one transaction). Imported activities are never touched. */
  async removeWorkout(id: string): Promise<void> {
    await this.db.transaction('rw', this.db.workouts, this.db.sets, async () => {
      await this.db.sets.where('workout_id').equals(id).delete();
      await this.db.workouts.delete(id);
    });
  }

  async workoutsBetween(start: string, end: string): Promise<Workout[]> {
    const rows = await this.db.workouts.where('date').between(start, end, true, true).toArray();
    return rows.sort((a, b) => (workoutOrderKey(a) < workoutOrderKey(b) ? -1 : 1));
  }

  async getWorkout(id: string): Promise<Workout | undefined> {
    return this.db.workouts.get(id);
  }

  /** Link an imported activity to a workout. An activity can belong to at most one workout. */
  async linkActivity(workoutId: string, activityId: string): Promise<void> {
    await this.db.transaction('rw', this.db.workouts, this.db.activities, async () => {
      if (!(await this.db.activities.get(activityId))) throw new Error('activity not found');
      const holder = await this.db.workouts.where('linked_activity_id').equals(activityId).first();
      if (holder && holder.id !== workoutId) throw new Error('activity is already linked to another workout');
      if ((await this.db.workouts.update(workoutId, { linked_activity_id: activityId, status: 'done' })) === 0) throw new Error('workout not found');
    });
  }

  async unlinkActivity(workoutId: string): Promise<void> {
    await this.db.workouts.update(workoutId, { linked_activity_id: null });
  }

  /** IDs of activities linked to any workout (these must not be counted twice). */
  async linkedActivityIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    await this.db.workouts.each((w) => { if (w.linked_activity_id) ids.add(w.linked_activity_id); });
    return ids;
  }

  // ---- Stage 2: sets ----------------------------------------------------------------------

  async addSet(workoutId: string, exerciseId: string, input: SetInput): Promise<SetRecord> {
    const errs = validateSet(input);
    if (errs.length) throw new Error(errs.join('; '));
    let rec!: SetRecord;
    await this.db.transaction('rw', this.db.sets, this.db.workouts, this.db.exercises, async () => {
      if (!(await this.db.workouts.get(workoutId))) throw new Error('workout not found');
      if (!(await this.db.exercises.get(exerciseId))) throw new Error('exercise not found');
      const n = await this.db.sets.where('workout_id').equals(workoutId).count();
      rec = {
        id: newId(), owner_id: null, workout_id: workoutId, exercise_id: exerciseId, ordinal: n + 1,
        load_kg: input.load_kg, reps: input.reps, rir: input.rir, warmup: input.warmup,
        pain_note: input.pain_note && input.pain_note.trim() !== '' ? input.pain_note.trim() : null,
        created_at: tickIso(),
      };
      await this.db.sets.add(rec);
    });
    return rec;
  }

  async removeSet(id: string): Promise<void> {
    await this.db.sets.delete(id);
  }

  async setsForWorkout(workoutId: string): Promise<SetRecord[]> {
    const rows = await this.db.sets.where('workout_id').equals(workoutId).toArray();
    return rows.sort((a, b) => a.ordinal - b.ordinal);
  }

  /**
   * Prior comparable session: the most recent OTHER workout that is earlier than `workout`
   * (by date, then creation time) and contains sets for the SAME exercise id. Exercises with a
   * different name or different equipment are different ids and are never matched.
   */
  async priorComparable(workout: Workout, exerciseId: string): Promise<{ workout: Workout; sets: SetRecord[] } | null> {
    const mine = await this.db.sets.where('exercise_id').equals(exerciseId).toArray();
    const ids = [...new Set(mine.map((s) => s.workout_id))].filter((id) => id !== workout.id);
    const ws = (await this.db.workouts.bulkGet(ids)).filter((w): w is Workout => !!w && workoutOrderKey(w) < workoutOrderKey(workout));
    ws.sort((a, b) => (workoutOrderKey(a) < workoutOrderKey(b) ? 1 : -1));
    if (!ws.length) return null;
    const best = ws[0];
    return { workout: best, sets: mine.filter((s) => s.workout_id === best.id).sort((a, b) => a.ordinal - b.ordinal) };
  }

  /**
   * Completion for a date without double counting: every done workout counts once; imported
   * activities (weights/run groups) count only if no workout is linked to them.
   */
  async completionForDate(date: string): Promise<{ workouts: number; unlinkedActivities: number; total: number }> {
    const done = (await this.workoutsBetween(date, date)).filter((w) => w.status === 'done');
    const linked = await this.linkedActivityIds();
    const acts = (await this.activitiesBetween(date, date)).filter((a) => a.group !== 'other' && !linked.has(a.id));
    return { workouts: done.length, unlinkedActivities: acts.length, total: done.length + acts.length };
  }

  // ---- Stage 3: edit exercise / set, history -------------------------------------------------

  /**
   * Edit an exercise. The id never changes, so history is kept. Equipment is NOT editable
   * (a different machine is a different exercise). Rename that collides with another exercise
   * of the same equipment is refused.
   */
  async updateExercise(id: string, patch: { name?: string; primary_muscles?: string[]; rep_min?: number | null; rep_max?: number | null }): Promise<Exercise> {
    const cur = await this.db.exercises.get(id);
    if (!cur) throw new Error('exercise not found');
    const next: Exercise = { ...cur };
    if (patch.name !== undefined) {
      const errs = validateName('exercise name', patch.name);
      if (errs.length) throw new Error(errs.join('; '));
      next.name = patch.name.trim();
      next.exercise_key = exerciseKey(next.name, cur.equipment);
      const clash = await this.db.exercises.where('exercise_key').equals(next.exercise_key).first();
      if (clash && clash.id !== id) throw new Error('another exercise already has that name with the same equipment');
    }
    if (patch.primary_muscles !== undefined) next.primary_muscles = patch.primary_muscles.map((m) => m.trim()).filter(Boolean).slice(0, 10);
    if (patch.rep_min !== undefined || patch.rep_max !== undefined) {
      const mn = patch.rep_min === undefined ? cur.rep_min ?? null : patch.rep_min;
      const mx = patch.rep_max === undefined ? cur.rep_max ?? null : patch.rep_max;
      const errs = validateRepRange(mn, mx);
      if (errs.length) throw new Error(errs.join('; '));
      next.rep_min = mn; next.rep_max = mx;
    }
    await this.db.exercises.put(next);
    return next;
  }

  async getExercise(id: string): Promise<Exercise | undefined> {
    return this.db.exercises.get(id);
  }

  /** Edit load, reps, RIR, warm-up flag, pain note of a logged set. Workout/exercise/ordinal are fixed. */
  async updateSet(id: string, input: SetInput): Promise<SetRecord> {
    const errs = validateSet(input);
    if (errs.length) throw new Error(errs.join('; '));
    const cur = await this.db.sets.get(id);
    if (!cur) throw new Error('set not found');
    const next: SetRecord = {
      ...cur, load_kg: input.load_kg, reps: input.reps, rir: input.rir, warmup: input.warmup,
      pain_note: input.pain_note && input.pain_note.trim() !== '' ? input.pain_note.trim() : null,
    };
    await this.db.sets.put(next);
    return next;
  }

  /** Every logged set joined with its workout date and exercise, for weekly counts. */
  async allSetsWithContext(): Promise<{ set: SetRecord; workout: Workout; exercise: Exercise }[]> {
    const [sets, ws, exs] = await Promise.all([this.db.sets.toArray(), this.db.workouts.toArray(), this.db.exercises.toArray()]);
    const wm = new Map(ws.map((w) => [w.id, w])), em = new Map(exs.map((e) => [e.id, e]));
    const out: { set: SetRecord; workout: Workout; exercise: Exercise }[] = [];
    for (const set of sets) {
      const workout = wm.get(set.workout_id), exercise = em.get(set.exercise_id);
      if (workout && exercise) out.push({ set, workout, exercise });
    }
    return out;
  }

  /** Sessions for one exercise, oldest first: workout + that exercise's sets in ordinal order. */
  async exerciseHistory(exerciseId: string): Promise<{ workout: Workout; sets: SetRecord[] }[]> {
    const sets = await this.db.sets.where('exercise_id').equals(exerciseId).toArray();
    const ids = [...new Set(sets.map((s) => s.workout_id))];
    const ws = (await this.db.workouts.bulkGet(ids)).filter((w): w is Workout => !!w);
    ws.sort((a, b) => (workoutOrderKey(a) < workoutOrderKey(b) ? -1 : 1));
    return ws.map((workout) => ({ workout, sets: sets.filter((s) => s.workout_id === workout.id).sort((a, b) => a.ordinal - b.ordinal) }));
  }

  // ---- Stage 4: backup, restore, CSV export ---------------------------------------------------------

  exportBackup(now: Date = new Date()): Promise<BackupDoc> {
    return buildBackup(this.db, now);
  }

  /** Replace everything with a backup that already passed validateBackup(). One transaction; failure leaves existing data untouched. */
  restoreBackup(backup: BackupDoc): Promise<BackupCounts> {
    return restoreBackup(this.db, backup);
  }

  tableCounts(): Promise<BackupCounts> {
    return tableCounts(this.db);
  }

  async hasUserData(): Promise<boolean> {
    const c = await tableCounts(this.db);
    return c.activities + c.workouts + c.sets + c.exercises > 0;
  }

  async exportSetsCsv(): Promise<string> {
    const [w, e, s] = await Promise.all([this.db.workouts.toArray(), this.db.exercises.toArray(), this.db.sets.toArray()]);
    return setsCsv(w, e, s);
  }

  async exportRunningCsv(today: string): Promise<string> {
    const all = await this.activitiesBetween(addDays(today, -800), today);
    return runningCsv(all.map((a) => ({ date: a.date, group: a.group, distance_km: a.distance_km, avg_pace_sec_per_km: a.avg_pace_sec_per_km })), today);
  }
}
