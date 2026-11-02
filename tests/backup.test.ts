// Stage 4: backup / restore. Fixtures and expected figures come from tests/oracle/oracle_backup.py (synthetic data only).
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import './helpers';
import { RecompDB } from '../src/db/db';
import { Repo } from '../src/db/repo';
import {
  BACKUP_SCHEMA_VERSION, TABLE_NAMES, normalizeNegativeZero, backupFileName, buildBackup, findDifference, restoreBackup, serializeBackup, validateBackup,
  type BackupDoc, type BackupTables,
} from '../src/lib/backup';
import { freshRepo } from './helpers';

const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const V3 = fx('synthetic-backup-v3.json') as BackupDoc;
const V2 = fx('synthetic-backup-v2.json') as BackupDoc;
const V1 = fx('synthetic-backup-v1.json') as BackupDoc;
const ORACLE = fx('oracle-backup-expected.json');
const clone = <T,>(x: T): T => JSON.parse(JSON.stringify(x));

async function seed(repo: Repo, tables: Partial<BackupTables> = V3.tables): Promise<void> {
  const db = repo.db;
  await db.batches.bulkAdd(tables.batches ?? []);
  await db.activities.bulkAdd(tables.activities ?? []);
  await db.type_mappings.bulkAdd(tables.type_mappings ?? []);
  await db.exercises.bulkAdd(tables.exercises ?? []);
  await db.workouts.bulkAdd(tables.workouts ?? []);
  await db.sets.bulkAdd(tables.sets ?? []);
}
const snapshot = async (repo: Repo) => JSON.parse(JSON.stringify((await repo.exportBackup(new Date(0))).tables)) as BackupTables;

/** Same steps the UI takes: validate first, restore only if valid. Returns the validation result. */
async function tryRestore(repo: Repo, text: string, opts?: Parameters<typeof validateBackup>[1]) {
  const r = validateBackup(text, opts);
  if (r.ok) await repo.restoreBackup(r.backup);
  return r;
}

describe('oracle: the app export equals the independently built fixture', () => {
  it('oracle counts are what the fixture holds', () => {
    expect(ORACLE.counts_v3).toEqual({ batches: 2, activities: 12, type_mappings: 2, exercises: 4, workouts: 4, sets: 9 });
    expect(V3.counts).toEqual(ORACLE.counts_v3);
  });

  it('a seeded synthetic database exports exactly the fixture (every table, counts, versions)', async () => {
    const repo = await freshRepo();
    await seed(repo);
    const doc = await repo.exportBackup(new Date('2026-11-02T04:00:00.000Z'));
    const viaText = JSON.parse(serializeBackup(doc)) as BackupDoc;
    expect(viaText.format).toBe('eq-fit-backup');
    expect(viaText.schemaVersion).toBe(BACKUP_SCHEMA_VERSION);
    expect(viaText.exportedAt).toBe('2026-11-02T04:00:00.000Z');
    expect(typeof viaText.appVersion).toBe('string');
    expect(viaText.counts).toEqual(ORACLE.counts_v3);
    for (const t of TABLE_NAMES) expect(viaText.tables[t], t).toEqual(V3.tables[t]);
  });

  it('export, wipe, restore gives deep-equal data in every table', async () => {
    const repo = await freshRepo();
    await seed(repo);
    const before = await snapshot(repo);
    const text = serializeBackup(await repo.exportBackup());
    for (const t of TABLE_NAMES) await repo.db[t].clear();
    expect(await repo.tableCounts()).toEqual({ batches: 0, activities: 0, type_mappings: 0, exercises: 0, workouts: 0, sets: 0 });
    const r = await tryRestore(repo, text);
    expect(r.ok).toBe(true);
    const after = await snapshot(repo);
    for (const t of TABLE_NAMES) expect(after[t], t).toEqual(before[t]);
    expect(await repo.tableCounts()).toEqual(ORACLE.counts_v3);
  });

  it('restore replaces existing data (it does not merge)', async () => {
    const repo = await freshRepo();
    await seed(repo);
    await repo.createExercise('Extra', 'Cable', ['back']);
    const r = await tryRestore(repo, JSON.stringify(V3));
    expect(r.ok).toBe(true);
    expect((await repo.tableCounts()).exercises).toBe(4);
    expect((await snapshot(repo)).exercises).toEqual(V3.tables.exercises);
  });

  it('keeps awkward text intact: markup, formulas, newlines, tabs, right-to-left marks', async () => {
    const repo = await freshRepo();
    await seed(repo);
    await tryRestore(repo, JSON.stringify(V3));
    const back = await snapshot(repo);
    expect(back.activities.map((a) => a.title)).toContain('<img src=x onerror=alert(1)>');
    expect(back.activities.map((a) => a.title)).toContain('=HYPERLINK("http://example.invalid","click")');
    expect(back.sets.map((s) => s.pain_note)).toContain('+sore\tknee');
    expect(back.sets.map((s) => s.pain_note)).toContain('line1\nline2');
  });
});

describe('older schema versions migrate on restore', () => {
  it('v2-shaped backup (no rep-range fields) restores into the current schema', async () => {
    const repo = await freshRepo();
    const r = await tryRestore(repo, JSON.stringify(V2));
    expect(r.ok && r.sourceVersion).toBe(2);
    expect(r.ok && r.backup.schemaVersion).toBe(3);
    const back = await snapshot(repo);
    for (const t of TABLE_NAMES) expect(back[t], t).toEqual(V2.tables[t]);
    expect(back.exercises.every((e) => !('rep_min' in e))).toBe(true); // unknown stays unknown, not defaulted
    // and the restored database is a normal current-schema database: editing a rep range works
    const ex = back.exercises[0];
    await repo.updateExercise(ex.id, { rep_min: 5, rep_max: 8 });
    expect((await repo.getExercise(ex.id))?.rep_max).toBe(8);
  });

  it('v1-shaped backup (3 tables only) restores; the lifting tables end up empty', async () => {
    const repo = await freshRepo();
    await seed(repo, { exercises: V3.tables.exercises });
    const r = await tryRestore(repo, JSON.stringify(V1));
    expect(r.ok && r.sourceVersion).toBe(1);
    const c = await repo.tableCounts();
    expect(c).toEqual({ ...ORACLE.counts_v1, exercises: 0, workouts: 0, sets: 0 });
    const back = await snapshot(repo);
    for (const t of ['batches', 'activities', 'type_mappings'] as const) expect(back[t], t).toEqual(V1.tables[t]);
  });

  it('v3-shaped backup restores', async () => {
    const repo = await freshRepo();
    const r = await tryRestore(repo, JSON.stringify(V3));
    expect(r.ok && r.sourceVersion).toBe(3);
    expect(await repo.tableCounts()).toEqual(ORACLE.counts_v3);
  });
});

describe('bad backups are rejected and existing data is unchanged', () => {
  const good = JSON.stringify(V3);
  const mut = (f: (d: BackupDoc) => void) => { const d = clone(V3); f(d); return JSON.stringify(d); };
  // each: [name, backup text, text expected in some error message]
  const cases: [string, string, RegExp][] = [
    ['truncated file', good.slice(0, Math.floor(good.length / 2)), /not valid JSON/],
    ['empty file', '', /not valid JSON/],
    ['not JSON', 'hello', /not valid JSON/],
    ['array at top level', '[]', /not an EQ Fit backup/],
    ['null', 'null', /not an EQ Fit backup/],
    ['wrong format marker', mut((d) => { (d as unknown as Record<string, unknown>).format = 'something-else'; }), /wrong format/],
    ['newer schema version', mut((d) => { d.schemaVersion = 4; }), /version 4/],
    ['schema version 0', mut((d) => { d.schemaVersion = 0; }), /schema version/],
    ['schema version as text', mut((d) => { (d as unknown as Record<string, unknown>).schemaVersion = '3'; }), /schema version/],
    ['missing schema version', mut((d) => { delete (d as unknown as Record<string, unknown>).schemaVersion; }), /schema version/],
    ['wrong type: distance as text', mut((d) => { (d.tables.activities[0] as unknown as Record<string, unknown>).distance_km = '5'; }), /activities\[0\]\.distance_km/],
    ['wrong type: warmup as text', mut((d) => { (d.tables.sets[0] as unknown as Record<string, unknown>).warmup = 'yes'; }), /sets\[0\]\.warmup/],
    ['wrong type: title as number', mut((d) => { (d.tables.activities[1] as unknown as Record<string, unknown>).title = 7; }), /title/],
    ['wrong type: parsed cell is an object', mut((d) => { (d.tables.activities[0].parsed as Record<string, unknown>).x = { a: 1 }; }), /parsed/],
    ['unknown workout kind', mut((d) => { (d.tables.workouts[0] as unknown as Record<string, unknown>).kind = 'yoga'; }), /kind/],
    ['impossible calendar date', mut((d) => { d.tables.workouts[0].date = '2026-13-40'; }), /YYYY-MM-DD/],
    ['unexpected extra field', mut((d) => { (d.tables.sets[0] as unknown as Record<string, unknown>).evil = 1; }), /unexpected field/],
    ['unexpected table', mut((d) => { (d.tables as unknown as Record<string, unknown>).extra = []; }), /unexpected table/],
    ['missing table', mut((d) => { delete (d.tables as unknown as Record<string, unknown>).sets; }), /"sets" is missing/],
    ['missing field', mut((d) => { delete (d.tables.batches[0] as unknown as Record<string, unknown>).file_sha256; }), /missing "file_sha256"/],
    ['counts disagree with rows (cut-off rows)', mut((d) => { d.tables.activities.pop(); }), /counts says 12/],
    ['dangling: activity points to missing batch', mut((d) => { d.tables.activities[0].batch_id = 'nope'; }), /missing batch/],
    ['dangling: set points to missing workout', mut((d) => { d.tables.sets[0].workout_id = 'nope'; }), /missing workout/],
    ['dangling: set points to missing exercise', mut((d) => { d.tables.sets[0].exercise_id = 'nope'; }), /missing exercise/],
    ['dangling: workout linked to missing activity', mut((d) => { d.tables.workouts[0].linked_activity_id = 'nope'; }), /missing activity/],
    ['dangling: workout plans missing exercise', mut((d) => { d.tables.workouts[0].planned_exercise_ids = ['nope']; }), /plans a missing exercise/],
    ['duplicate id', mut((d) => { d.tables.sets[1].id = d.tables.sets[0].id; }), /duplicate id/],
    ['duplicate dedupe key', mut((d) => { d.tables.activities[1].dedupe_key = d.tables.activities[0].dedupe_key; }), /dedupe_key/],
    ['two workouts linked to one activity', mut((d) => { d.tables.workouts[1].linked_activity_id = d.tables.workouts[0].linked_activity_id; }), /linked_activity_id/],
    ['duplicate exercise key', mut((d) => { d.tables.exercises[1].name = d.tables.exercises[0].name; d.tables.exercises[1].equipment = d.tables.exercises[0].equipment; d.tables.exercises[1].exercise_key = d.tables.exercises[0].exercise_key; }), /exercise_key/],
    ['exercise key that does not match its name', mut((d) => { d.tables.exercises[0].exercise_key = 'other|thing'; }), /key does not match/],
    ['impossible set (RIR 0.3)', mut((d) => { d.tables.sets[1].rir = 0.3; }), /RIR/],
  ];

  it.each(cases)('%s', async (_name, text, expected) => {
    const repo = await freshRepo();
    await seed(repo, { ...V3.tables, sets: V3.tables.sets.slice(0, 2), workouts: V3.tables.workouts });
    const before = await snapshot(repo);
    const r = await tryRestore(repo, text);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.errors.join(' | ')).toMatch(expected);
    expect(await snapshot(repo)).toEqual(before);
  });

  it('oversize file is refused before parsing; data unchanged', async () => {
    const repo = await freshRepo();
    await seed(repo);
    const before = await snapshot(repo);
    const r = await tryRestore(repo, good, { sizeBytes: 65 * 1024 * 1024 });
    expect(!r.ok && r.errors[0]).toMatch(/larger than the 64 MB limit/);
    const r2 = await tryRestore(repo, good, { maxBytes: 1000 });
    expect(r2.ok).toBe(false);
    expect(await snapshot(repo)).toEqual(before);
  });

  it('error list is capped so a hostile file cannot flood the screen', () => {
    const d = clone(V3);
    d.tables.activities = d.tables.activities.map((a) => ({ ...a, distance_km: 'x' as unknown as number }));
    const r = validateBackup(JSON.stringify(d));
    expect(!r.ok && r.errors.length).toBeLessThanOrEqual(25);
  });
});

describe('restore is one atomic transaction', () => {
  it('a failure part-way through (after other tables were cleared and filled) leaves existing data exactly as it was', async () => {
    const repo = await freshRepo();
    await seed(repo);
    const before = await snapshot(repo);
    // Bypass validation on purpose: a duplicate set id fails on the LAST table written, after five tables were already replaced.
    const broken = clone(V3);
    broken.tables.batches = [];
    broken.tables.activities = [];
    broken.tables.sets = [broken.tables.sets[0], broken.tables.sets[0]];
    await expect(restoreBackup(repo.db, broken)).rejects.toBeTruthy();
    expect(await snapshot(repo)).toEqual(before);
  });

  it('a unique-index clash (duplicate dedupe_key) also rolls everything back', async () => {
    const repo = await freshRepo();
    await seed(repo);
    const before = await snapshot(repo);
    const broken = clone(V3);
    broken.tables.activities[1].dedupe_key = broken.tables.activities[0].dedupe_key;
    await expect(restoreBackup(repo.db, broken)).rejects.toBeTruthy();
    expect(await snapshot(repo)).toEqual(before);
  });

  it('restore leaves the migration ledger and a usable database', async () => {
    const repo = await freshRepo();
    await tryRestore(repo, JSON.stringify(V3));
    expect((await repo.listMigrations()).map((m) => m.version)).toEqual([1, 2, 3]);
    const w = await repo.createWorkout({ date: '2026-11-02', name: 'After restore', kind: 'weights' });
    expect(await repo.getWorkout(w.id)).toBeTruthy();
  });
});

describe('lossless export', () => {
  it('findDifference spots undefined, NaN, Date and key differences', () => {
    expect(findDifference({ a: [1, 'x', null] }, { a: [1, 'x', null] })).toBeNull();
    expect(findDifference({ a: undefined }, {})).toMatch(/keys/);
    expect(findDifference({ a: NaN }, { a: null })).toBe('$.a');
    expect(findDifference({ a: new Date(0) }, { a: '1970-01-01T00:00:00.000Z' })).toBe('$.a');
    expect(findDifference({ a: -0 }, { a: 0 })).toBe('$.a');
  });

  it('negative zero: exports as 0, restores as 0, raw text untouched, stored data not rewritten', async () => {
    const repo = await freshRepo();
    const t = clone(V3.tables);
    t.activities[0].parsed['Min Elevation'] = -0;
    t.activities[0].raw_fields['Min Elevation'] = "'-0";
    t.activities[0].raw_row = [...t.activities[0].raw_row, "'-0"];
    t.activities[0].distance_km = -0;
    await seed(repo, t);
    const stored = (await repo.db.activities.get(t.activities[0].id))!;
    expect(Object.is(stored.parsed['Min Elevation'], -0)).toBe(true);
    const text = serializeBackup(await repo.exportBackup());
    const exported = JSON.parse(text) as BackupDoc;
    expect(Object.is(exported.tables.activities[0].parsed['Min Elevation'], 0)).toBe(true);
    expect(Object.is(exported.tables.activities[0].distance_km, 0)).toBe(true);
    expect(exported.tables.activities[0].raw_fields['Min Elevation']).toBe("'-0");
    expect(exported.tables.activities[0].raw_row.at(-1)).toBe("'-0");
    // stored data was not rewritten by exporting
    expect(Object.is((await repo.db.activities.get(t.activities[0].id))!.parsed['Min Elevation'], -0)).toBe(true);
    for (const n of TABLE_NAMES) await repo.db[n].clear();
    const r = await tryRestore(repo, text);
    expect(r.ok).toBe(true);
    const back = (await repo.db.activities.get(t.activities[0].id))!;
    expect(Object.is(back.parsed['Min Elevation'], 0)).toBe(true);
    expect(back.raw_fields['Min Elevation']).toBe("'-0");
    expect(normalizeNegativeZero(await snapshot(repo))).toEqual(normalizeNegativeZero(t));
    // any OTHER lossy value still refuses
    const doc = await repo.exportBackup();
    doc.tables.activities[0] = { ...doc.tables.activities[0], calories: Number.NaN };
    expect(() => serializeBackup(doc)).toThrow(/not be lossless/);
  });

  it('serializeBackup refuses a document the JSON round trip would change', async () => {
    const repo = await freshRepo();
    await seed(repo);
    const doc = await repo.exportBackup();
    doc.tables.activities[0] = { ...doc.tables.activities[0], calories: Number.NaN };
    expect(() => serializeBackup(doc)).toThrow(/not be lossless/);
  });

  it('file name is eq-fit-backup-YYYY-MM-DD.json in local time', () => {
    expect(backupFileName(new Date(2026, 10, 2, 23, 59))).toBe('eq-fit-backup-2026-11-02.json');
    expect(backupFileName(new Date(2026, 0, 5))).toBe('eq-fit-backup-2026-01-05.json');
  });

  it('a backup holds no theme or demo data', async () => {
    const repo = await freshRepo();
    await seed(repo);
    const text = serializeBackup(await repo.exportBackup());
    expect(text).not.toMatch(/eqfit\.theme|crazy|demo/i);
    expect(Object.keys((await buildBackup(new RecompDB(`x-${Date.now()}`))).tables).sort()).toEqual([...TABLE_NAMES].sort());
  });
});
