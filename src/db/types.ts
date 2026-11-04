import type { Group } from '../lib/mapping';
import type { Cell } from '../lib/columns';

/** Every record has a UUID `id` and a nullable `owner_id` (reserved for possible later private sync; no sync is built). */
interface Base {
  id: string;
  owner_id: string | null;
}

export interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}

export interface ImportBatch extends Base {
  file_sha256: string;
  file_name: string | null;
  imported_at: string;
  headers: string[];
  source_row_count: number;
  new_row_count: number;
  skipped_duplicate_count: number;
}

export interface Activity extends Base {
  body_parts?: string[];
  batch_id: string;
  source_file_sha256: string;
  row_index: number; // 0-based position in source file
  row_hash: string; // SHA-256 of canonical row (all cells, header order)
  dedupe_key: string; // row_hash + '#' + occurrence index among identical rows in the file
  raw_row: string[]; // original cells exactly as exported
  raw_fields: Record<string, string>; // header -> original cell (all original fields, localized headers kept)
  parsed: Record<string, Cell>; // header -> typed value
  timestamp_local: string; // 'YYYY-MM-DD HH:mm:ss' as exported; timezone unknown, never converted
  date: string; // 'YYYY-MM-DD'
  original_type: string; // never modified
  mapping_override: Group | null; // per-activity, reversible (null = follow type mapping)
  title: string;
  distance_km: number | null;
  duration_seconds: number | null;
  calories: number | null;
  avg_hr: number | null;
  avg_pace_sec_per_km: number | null;
}

export interface TypeMapping extends Base {
  original_type: string; // used as the lookup key
  target: Group;
  updated_at: string;
}

// ---- Stage 2 ------------------------------------------------------------------------

export interface Exercise extends Base {
  name: string;
  equipment: string; // '' when not stated. Different equipment = different exercise (never equivalent).
  primary_muscles: string[];
  /** Optional user-entered rep range for double progression. Absent/null = no progression hint. */
  rep_min?: number | null;
  rep_max?: number | null;
  exercise_key: string; // lower(name) + '|' + lower(equipment): uniqueness and comparability key
  created_at: string;
}

export type WorkoutKind = 'weights' | 'run' | 'other';
export type WorkoutStatus = 'planned' | 'done';

export interface Workout extends Base {
  body_parts?: string[];
  date: string; // YYYY-MM-DD (date-only; multiple workouts per date allowed)
  name: string;
  kind: WorkoutKind;
  status: WorkoutStatus;
  notes: string;
  planned_exercise_ids: string[]; // blank until the user enters them
  /** Linked watch/imported activity. A given activity can be linked to at most one workout (unique index). */
  linked_activity_id: string | null;
  created_at: string; // ISO; orders workouts within a date
}

/** A reusable exercise list, never a completed workout or a source of logged sets. */
export interface Routine extends Base {
  name: string;
  exercise_ids: string[];
  created_at: string;
}

export interface SetRecord extends Base {
  workout_id: string;
  exercise_id: string;
  ordinal: number; // 1-based position within the workout
  load_kg: number | null;
  reps: number | null;
  rir: number | null;
  warmup: boolean;
  pain_note: string | null;
  created_at: string;
}
