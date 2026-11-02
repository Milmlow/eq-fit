import Dexie, { type Table } from 'dexie';
import type { Activity, Checkin, Exercise, GoalRevision, ImportBatch, MigrationRecord, SetRecord, TypeMapping, Workout } from './types';

export class RecompDB extends Dexie {
  migrations!: Table<MigrationRecord, number>;
  batches!: Table<ImportBatch, string>;
  activities!: Table<Activity, string>;
  type_mappings!: Table<TypeMapping, string>;
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  sets!: Table<SetRecord, string>;
  goals!: Table<GoalRevision, string>;
  checkins!: Table<Checkin, string>;

  constructor(name = 'recomp') {
    super(name);
    // Schema v1. Future schema changes: add db.version(2) AND an entry in MIGRATIONS below.
    this.version(1).stores({
      migrations: 'version',
      batches: 'id, file_sha256, imported_at',
      activities: 'id, batch_id, &dedupe_key, date, original_type',
      type_mappings: 'original_type, id',
    });
    // Schema v2 (Stage 2): additive only. Existing tables and data are untouched.
    this.version(2).stores({
      exercises: 'id, &exercise_key, name',
      workouts: 'id, date, status, &linked_activity_id',
      sets: 'id, workout_id, exercise_id',
    });
    // Schema v3 (Stage 3): optional non-indexed fields (exercise rep range). No index change, data untouched.
    this.version(3).stores({});
    // Schema v4 (Stage 5): additive only. New tables goals (revisions) and checkins (one per date). Existing tables and data are untouched.
    this.version(4).stores({
      goals: 'id, goal_id, effective_from',
      checkins: 'id, &date',
    });
  }
}

export interface Migration {
  version: number;
  name: string;
}

/** Ledger of schema versions. Dexie performs the IndexedDB upgrade; this records that it happened. */
export const MIGRATIONS: Migration[] = [
  { version: 1, name: 'initial schema: batches, activities, type_mappings' },
  { version: 2, name: 'stage 2: exercises, workouts, sets (additive)' },
  { version: 3, name: 'stage 3: optional exercise rep range (no index change)' },
  { version: 4, name: 'stage 5: goals (revisions with effective_from) and checkins (additive)' },
];

export async function recordMigrations(db: RecompDB): Promise<void> {
  await db.transaction('rw', db.migrations, async () => {
    for (const m of MIGRATIONS) {
      if (!(await db.migrations.get(m.version))) {
        await db.migrations.add({ version: m.version, name: m.name, applied_at: new Date().toISOString() });
      }
    }
  });
}
