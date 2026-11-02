// Backup and restore. A backup is ONE JSON document holding every user-data table.
// Restore validates the WHOLE document before anything is touched, then replaces all tables in ONE IndexedDB transaction.
// The theme preference (localStorage) and demo mode are NOT part of a backup. The migration ledger is not user data.
import { isGroup } from './mapping';
import { isGoalKind, validateGoal } from './goals';
import { validateCheckin } from './checkins';
import { normaliseMuscles } from './lifting';
import { exerciseKey, MAX_TEXT, validateSet } from './training';
import type { RecompDB } from '../db/db';
import type { Activity, Checkin, Exercise, GoalRevision, ImportBatch, SetRecord, TypeMapping, Workout } from '../db/types';

export const BACKUP_FORMAT = 'eq-fit-backup';
/** Current IndexedDB schema version (see src/db/db.ts). Backups carry it so older files can be migrated. */
export const BACKUP_SCHEMA_VERSION = 4;
/** Larger files are refused before parsing. A full real history is roughly 10 to 15 MB. */
export const MAX_BACKUP_BYTES = 64 * 1024 * 1024;
const MAX_STRING = 100_000;
const MAX_ERRORS = 25;

declare const __APP_VERSION__: string;
export const APP_VERSION: string = typeof __APP_VERSION__ === 'undefined' ? 'dev' : __APP_VERSION__;

export const TABLE_NAMES = ['batches', 'activities', 'type_mappings', 'exercises', 'workouts', 'sets', 'goals', 'checkins'] as const;
export type TableName = (typeof TABLE_NAMES)[number];
export type BackupCounts = Record<TableName, number>;

export interface BackupTables {
  batches: ImportBatch[];
  activities: Activity[];
  type_mappings: TypeMapping[];
  exercises: Exercise[];
  workouts: Workout[];
  sets: SetRecord[];
  goals: GoalRevision[];
  checkins: Checkin[];
}

export interface BackupDoc {
  format: typeof BACKUP_FORMAT;
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  counts: Partial<BackupCounts>;
  tables: BackupTables;
}

/** Tables a backup of each schema version contains. Version 1 predates exercises, workouts and sets. */
const TABLES_V1: readonly TableName[] = ['batches', 'activities', 'type_mappings'];
const TABLES_V2: readonly TableName[] = ['batches', 'activities', 'type_mappings', 'exercises', 'workouts', 'sets'];
const TABLES_BY_VERSION: Record<number, readonly TableName[]> = {
  1: TABLES_V1,
  2: TABLES_V2,
  3: TABLES_V2,
  4: TABLE_NAMES,
};

export function backupFileName(now: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `eq-fit-backup-${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}.json`;
}

export async function tableCounts(db: RecompDB): Promise<BackupCounts> {
  const [batches, activities, type_mappings, exercises, workouts, sets, goals, checkins] = await Promise.all([
    db.batches.count(), db.activities.count(), db.type_mappings.count(), db.exercises.count(), db.workouts.count(), db.sets.count(), db.goals.count(), db.checkins.count(),
  ]);
  return { batches, activities, type_mappings, exercises, workouts, sets, goals, checkins };
}

/** Read every user-data table in one read transaction (a consistent snapshot). */
export async function buildBackup(db: RecompDB, now: Date = new Date()): Promise<BackupDoc> {
  const tables = await db.transaction('r', [db.batches, db.activities, db.type_mappings, db.exercises, db.workouts, db.sets, db.goals, db.checkins], async () => ({
    batches: await db.batches.toArray(),
    activities: await db.activities.toArray(),
    type_mappings: await db.type_mappings.toArray(),
    exercises: await db.exercises.toArray(),
    workouts: await db.workouts.toArray(),
    sets: await db.sets.toArray(),
    goals: await db.goals.toArray(),
    checkins: await db.checkins.toArray(),
  }));
  const counts = Object.fromEntries(TABLE_NAMES.map((t) => [t, tables[t].length])) as BackupCounts;
  return { format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA_VERSION, appVersion: APP_VERSION, exportedAt: now.toISOString(), counts, tables };
}

/** Where `a` and `b` differ after JSON, as a path; null when they are deeply equal. undefined, NaN, Date and Map all count as lossy. */
export function findDifference(a: unknown, b: unknown, path = '$'): string | null {
  if (typeof a === 'number' && typeof b === 'number') return Object.is(a, b) ? null : path;
  if (a === b) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return path;
  if (Array.isArray(a) !== Array.isArray(b)) return path;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}.length`;
    for (let i = 0; i < a.length; i++) { const d = findDifference(a[i], b[i], `${path}[${i}]`); if (d) return d; }
    return null;
  }
  if (Object.getPrototypeOf(a) !== Object.prototype || Object.getPrototypeOf(b) !== Object.prototype) return path;
  const ka = Object.keys(a as object).sort(), kb = Object.keys(b as object).sort();
  if (ka.length !== kb.length) return `${path} (keys)`;
  for (let i = 0; i < ka.length; i++) if (ka[i] !== kb[i]) return `${path}.${ka[i]} (keys)`;
  for (const k of ka) { const d = findDifference((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k], `${path}.${k}`); if (d) return d; }
  return null;
}

/**
 * Backup rule: negative zero and zero are the same number. JSON cannot hold -0 (it writes 0), and the real export has cells like "'-0"
 * (Min/Max Elevation) that the importer stores as -0. This returns a copy with every -0 in a numeric value replaced by 0.
 * raw_row and raw_fields keep the original text, which stays the source of truth; stored data and the parser are not changed.
 */
export function normalizeNegativeZero<T>(x: T): T {
  if (typeof x === 'number') return (Object.is(x, -0) ? 0 : x) as T;
  if (Array.isArray(x)) return x.map(normalizeNegativeZero) as T;
  if (typeof x === 'object' && x !== null && Object.getPrototypeOf(x) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(x)) out[k] = normalizeNegativeZero(v);
    return out as T;
  }
  return x;
}

/** Serialise a backup (-0 written as 0) and prove the round trip is otherwise lossless. Throws (nothing is offered for download) if it is not. */
export function serializeBackup(doc: BackupDoc): string {
  const norm = normalizeNegativeZero(doc);
  const text = JSON.stringify(norm, null, 1);
  const diff = findDifference(norm, JSON.parse(text));
  if (diff) throw new Error(`backup would not be lossless at ${diff}; nothing was exported`);
  return text;
}

// ---- validation ----------------------------------------------------------------------------------

export type ValidationResult =
  | { ok: true; backup: BackupDoc; sourceVersion: number; counts: BackupCounts }
  | { ok: false; errors: string[] };

type Rec = Record<string, unknown>;
const isObj = (x: unknown): x is Rec => typeof x === 'object' && x !== null && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function validDate(s: unknown): s is string {
  if (typeof s !== 'string' || !ISO_DATE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}
const validIso = (s: unknown): s is string => typeof s === 'string' && s.length <= 40 && !Number.isNaN(Date.parse(s));
const validCell = (v: unknown) => v === null || typeof v === 'boolean' || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));

type Check = (v: unknown, ctx: { rec: Rec }) => string | null;
const str = (max = MAX_STRING): Check => (v) => (typeof v !== 'string' ? 'must be text' : v.length > max ? `text longer than ${max}` : null);
const id: Check = (v) => (typeof v !== 'string' || v === '' || v.length > 100 ? 'must be a non-empty id (max 100 characters)' : null);
const strOrNull = (max = MAX_STRING): Check => (v) => (v === null ? null : str(max)(v, { rec: {} }));
const numOrNull: Check = (v) => (v === null || (typeof v === 'number' && Number.isFinite(v)) ? null : 'must be a number or null');
const count: Check = (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 ? null : 'must be a whole number, 0 or more');
const bool: Check = (v) => (typeof v === 'boolean' ? null : 'must be true or false');
const iso: Check = (v) => (validIso(v) ? null : 'must be an ISO date-time');
const oneOf = (...vals: string[]): Check => (v) => (typeof v === 'string' && vals.includes(v) ? null : `must be one of ${vals.join(', ')}`);
const strArray = (maxLen: number): Check => (v) => (Array.isArray(v) && v.length <= maxLen && v.every((x) => typeof x === 'string' && x.length <= MAX_STRING) ? null : 'must be a list of text');
const strRecord: Check = (v) => (isObj(v) && Object.values(v).every((x) => typeof x === 'string' && x.length <= MAX_STRING) ? null : 'must be a map of text');
const cellRecord: Check = (v) => (isObj(v) && Object.values(v).every(validCell) ? null : 'must be a map of numbers, text, true/false or null');
const group: Check = (v) => (typeof v === 'string' && isGroup(v) ? null : 'must be a known activity group');
const groupOrNull: Check = (v) => (v === null ? null : group(v, { rec: {} }));
const posNum: Check = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= 100000 ? null : 'must be a number above 0');
const optRep: Check = (v) => (v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 1000) ? null : 'must be a whole number or null');

const BASE = { id, owner_id: strOrNull(200) };
const SCHEMAS: Record<TableName, { fields: Record<string, Check>; optional?: string[] }> = {
  batches: { fields: { ...BASE, file_sha256: str(200), file_name: strOrNull(1000), imported_at: iso, headers: strArray(2000), source_row_count: count, new_row_count: count, skipped_duplicate_count: count } },
  activities: {
    fields: {
      ...BASE, batch_id: id, source_file_sha256: str(200), row_index: count, row_hash: str(200), dedupe_key: str(300), raw_row: strArray(2000), raw_fields: strRecord, parsed: cellRecord,
      timestamp_local: str(40), date: (v) => (validDate(v) ? null : 'must be YYYY-MM-DD'), original_type: str(500), mapping_override: groupOrNull, title: str(),
      distance_km: numOrNull, duration_seconds: numOrNull, calories: numOrNull, avg_hr: numOrNull, avg_pace_sec_per_km: numOrNull,
    },
  },
  type_mappings: { fields: { ...BASE, original_type: str(500), target: group, updated_at: iso } },
  exercises: { fields: { ...BASE, name: str(500), equipment: str(500), primary_muscles: strArray(50), rep_min: optRep, rep_max: optRep, exercise_key: str(1100), created_at: iso }, optional: ['rep_min', 'rep_max'] },
  workouts: {
    fields: {
      ...BASE, date: (v) => (validDate(v) ? null : 'must be YYYY-MM-DD'), name: str(500), kind: oneOf('weights', 'run', 'other'), status: oneOf('planned', 'done'),
      notes: str(MAX_TEXT * 8), planned_exercise_ids: strArray(500), linked_activity_id: strOrNull(100), created_at: iso,
    },
  },
  sets: {
    fields: {
      ...BASE, workout_id: id, exercise_id: id, ordinal: (v) => (typeof v === 'number' && Number.isInteger(v) && v >= 1 && v <= 100000 ? null : 'must be a whole number 1 or more'),
      load_kg: numOrNull, reps: numOrNull, rir: numOrNull, warmup: bool, pain_note: strOrNull(MAX_TEXT * 8), created_at: iso,
    },
  },
  goals: {
    fields: {
      ...BASE, goal_id: id, kind: (v) => (typeof v === 'string' && isGoalKind(v) ? null : 'must be a known goal type'), name: str(200), target: posNum,
      muscle: strOrNull(200), include_treadmill: bool, effective_from: (v) => (validDate(v) ? null : 'must be YYYY-MM-DD'), archived: bool, created_at: iso,
    },
  },
  checkins: {
    fields: { ...BASE, date: (v) => (validDate(v) ? null : 'must be YYYY-MM-DD'), weight_kg: numOrNull, waist_cm: numOrNull, note: strOrNull(MAX_TEXT * 2), created_at: iso },
  },
};

function checkTable(t: TableName, rows: unknown, errs: string[]): void {
  const { fields, optional = [] } = SCHEMAS[t];
  if (!Array.isArray(rows)) { errs.push(`${t}: must be a list`); return; }
  const allowed = new Set(Object.keys(fields));
  for (let i = 0; i < rows.length; i++) {
    if (errs.length >= MAX_ERRORS) return;
    const r = rows[i];
    if (!isObj(r)) { errs.push(`${t}[${i}]: must be an object`); continue; }
    for (const k of Object.keys(r)) if (!allowed.has(k)) errs.push(`${t}[${i}]: unexpected field "${k.slice(0, 40)}"`);
    for (const [k, check] of Object.entries(fields)) {
      if (!(k in r)) { if (!optional.includes(k)) errs.push(`${t}[${i}]: missing "${k}"`); continue; }
      const m = check(r[k], { rec: r });
      if (m) errs.push(`${t}[${i}].${k}: ${m}`);
    }
  }
}

/** Cross-record rules: duplicate ids and keys, dangling references, and values that must agree with each other. */
function checkRelations(tb: BackupTables, errs: string[]): void {
  const add = (m: string) => { if (errs.length < MAX_ERRORS) errs.push(m); };
  const ids = (name: TableName, rows: { id: string }[]) => {
    const s = new Set<string>();
    for (const r of rows) { if (s.has(r.id)) add(`${name}: duplicate id ${r.id.slice(0, 40)}`); s.add(r.id); }
    return s;
  };
  const batchIds = ids('batches', tb.batches), actIds = ids('activities', tb.activities), exIds = ids('exercises', tb.exercises);
  const woIds = ids('workouts', tb.workouts); ids('sets', tb.sets); ids('type_mappings', tb.type_mappings);
  const goalIds = ids('goals', tb.goals); ids('checkins', tb.checkins);
  const uniq = (name: string, vals: string[]) => { const s = new Set<string>(); for (const v of vals) { if (s.has(v)) add(`${name}: duplicate ${v.slice(0, 60)}`); s.add(v); } };
  uniq('activities.dedupe_key', tb.activities.map((a) => a.dedupe_key));
  uniq('type_mappings.original_type', tb.type_mappings.map((m) => m.original_type));
  uniq('exercises.exercise_key', tb.exercises.map((e) => e.exercise_key));
  uniq('checkins.date', tb.checkins.map((c) => c.date));
  uniq('workouts.linked_activity_id', tb.workouts.filter((w) => w.linked_activity_id !== null).map((w) => w.linked_activity_id as string));
  for (const a of tb.activities) {
    if (!batchIds.has(a.batch_id)) add(`activities: ${a.id.slice(0, 40)} points to a missing batch`);
    if (!a.timestamp_local.startsWith(a.date)) add(`activities: ${a.id.slice(0, 40)} date does not match its timestamp`);
  }
  for (const e of tb.exercises) if (e.exercise_key !== exerciseKey(e.name, e.equipment)) add(`exercises: ${e.id.slice(0, 40)} key does not match name and equipment`);
  for (const w of tb.workouts) {
    if (w.linked_activity_id !== null && !actIds.has(w.linked_activity_id)) add(`workouts: ${w.id.slice(0, 40)} is linked to a missing activity`);
    for (const x of w.planned_exercise_ids) if (!exIds.has(x)) add(`workouts: ${w.id.slice(0, 40)} plans a missing exercise`);
  }
  for (const s of tb.sets) {
    if (!woIds.has(s.workout_id)) add(`sets: ${s.id.slice(0, 40)} belongs to a missing workout`);
    if (!exIds.has(s.exercise_id)) add(`sets: ${s.id.slice(0, 40)} uses a missing exercise`);
    for (const m of validateSet({ load_kg: s.load_kg, reps: s.reps, rir: s.rir, warmup: s.warmup, pain_note: s.pain_note })) add(`sets: ${s.id.slice(0, 40)} ${m}`);
  }
  // Goals: every revision belongs to a goal whose first revision is in the file, and the revision kind never changes within a goal.
  const root = new Map(tb.goals.filter((g) => g.id === g.goal_id).map((g) => [g.goal_id, g]));
  for (const g of tb.goals) {
    const r = root.get(g.goal_id);
    if (!r || !goalIds.has(g.goal_id)) { add(`goals: ${g.id.slice(0, 40)} belongs to a goal whose first revision is missing`); continue; }
    if (r.kind !== g.kind) add(`goals: ${g.id.slice(0, 40)} changes the goal type`);
    if (!g.archived) for (const m of validateGoal({ kind: g.kind, name: g.name, target: g.target, muscle: g.muscle, include_treadmill: g.include_treadmill })) add(`goals: ${g.id.slice(0, 40)} ${m}`);
    if (g.muscle !== null && normaliseMuscles([g.muscle])[0] !== g.muscle) add(`goals: ${g.id.slice(0, 40)} muscle is not in its stored form`);
  }
  for (const c of tb.checkins) for (const m of validateCheckin({ date: c.date, weight_kg: c.weight_kg, waist_cm: c.waist_cm, note: c.note }, '9999-12-31')) add(`checkins: ${c.id.slice(0, 40)} ${m}`);
}

/** Older documents become the current shape here. v1 -> v2 adds the empty lifting tables; v2 -> v3 adds only optional fields, so nothing changes; v3 -> v4 adds the empty goals and check-ins tables. */
function migrate(tables: Partial<BackupTables>, from: number): BackupTables {
  let v = from;
  const t = { ...tables };
  if (v === 1) { t.exercises = []; t.workouts = []; t.sets = []; v = 2; }
  if (v === 2) { v = 3; }
  if (v === 3) { t.goals = []; t.checkins = []; v = 4; }
  return t as BackupTables;
}

export function validateBackup(text: string, opts: { maxBytes?: number; sizeBytes?: number } = {}): ValidationResult {
  const max = opts.maxBytes ?? MAX_BACKUP_BYTES;
  const size = opts.sizeBytes ?? text.length;
  if (size > max) return { ok: false, errors: [`file is larger than the ${Math.round(max / 1048576)} MB limit`] };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return { ok: false, errors: ['not valid JSON (the file may be cut off or damaged)'] }; }
  if (!isObj(raw)) return { ok: false, errors: ['not an EQ Fit backup (top level must be an object)'] };
  if (raw.format !== BACKUP_FORMAT) return { ok: false, errors: ['not an EQ Fit backup (wrong format marker)'] };
  const v = raw.schemaVersion;
  if (typeof v !== 'number' || !Number.isInteger(v) || v < 1) return { ok: false, errors: ['backup has no valid schema version'] };
  if (v > BACKUP_SCHEMA_VERSION) return { ok: false, errors: [`backup is schema version ${v}; this app only understands up to ${BACKUP_SCHEMA_VERSION}. Update the app first.`] };
  const errs: string[] = [];
  if (typeof raw.appVersion !== 'string' || raw.appVersion.length > 50) errs.push('appVersion must be text');
  if (!validIso(raw.exportedAt)) errs.push('exportedAt must be an ISO date-time');
  const tableList = TABLES_BY_VERSION[v];
  if (!isObj(raw.tables)) return { ok: false, errors: [...errs, 'tables must be an object'] };
  if (!isObj(raw.counts)) return { ok: false, errors: [...errs, 'counts must be an object'] };
  for (const k of Object.keys(raw.tables)) if (!(tableList as readonly string[]).includes(k)) errs.push(`unexpected table "${k.slice(0, 40)}" for schema version ${v}`);
  for (const t of tableList) {
    if (!(t in raw.tables)) { errs.push(`table "${t}" is missing`); continue; }
    checkTable(t, raw.tables[t], errs);
    const rows = raw.tables[t];
    if (Array.isArray(rows) && raw.counts[t] !== rows.length) errs.push(`${t}: counts says ${String(raw.counts[t])} but the file holds ${rows.length} (incomplete file?)`);
  }
  for (const k of Object.keys(raw.counts)) if (!(tableList as readonly string[]).includes(k)) errs.push(`unexpected count "${k.slice(0, 40)}"`);
  if (errs.length) return { ok: false, errors: errs.slice(0, MAX_ERRORS) };

  const tables = migrate(raw.tables as Partial<BackupTables>, v);
  checkRelations(tables, errs);
  if (errs.length) return { ok: false, errors: errs.slice(0, MAX_ERRORS) };
  const counts = Object.fromEntries(TABLE_NAMES.map((t) => [t, tables[t].length])) as BackupCounts;
  return {
    ok: true, sourceVersion: v, counts,
    backup: { format: BACKUP_FORMAT, schemaVersion: BACKUP_SCHEMA_VERSION, appVersion: raw.appVersion as string, exportedAt: raw.exportedAt as string, counts, tables },
  };
}

/**
 * Replace EVERY user-data table with the backup, in ONE transaction. If anything throws, IndexedDB rolls the whole
 * transaction back and the existing data is exactly as it was. Callers must pass a document from validateBackup().
 */
export async function restoreBackup(db: RecompDB, backup: BackupDoc): Promise<BackupCounts> {
  const t = backup.tables;
  await db.transaction('rw', [db.batches, db.activities, db.type_mappings, db.exercises, db.workouts, db.sets, db.goals, db.checkins], async () => {
    await Promise.all([db.batches.clear(), db.activities.clear(), db.type_mappings.clear(), db.exercises.clear(), db.workouts.clear(), db.sets.clear(), db.goals.clear(), db.checkins.clear()]);
    await db.batches.bulkAdd(t.batches);
    await db.activities.bulkAdd(t.activities);
    await db.type_mappings.bulkAdd(t.type_mappings);
    await db.exercises.bulkAdd(t.exercises);
    await db.workouts.bulkAdd(t.workouts);
    await db.sets.bulkAdd(t.sets);
    await db.goals.bulkAdd(t.goals);
    await db.checkins.bulkAdd(t.checkins);
  });
  return tableCounts(db);
}
