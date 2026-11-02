import Dexie, { type Table } from 'dexie';
import type { Activity, Exercise, ImportBatch, MigrationRecord, SetRecord, TypeMapping, Workout } from './types';

export class RecompDB extends Dexie {
  migrations!: Table<MigrationRecord, number>;
  batches!: Table<ImportBatch, string>;
  activities!: Table<Activity, string>;
  type_mappings!: Table<TypeMapping, string>;
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  sets!: Table<SetRecord, string>;

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
