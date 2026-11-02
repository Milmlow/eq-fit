import { describe, expect, it } from 'vitest';
import { buildPreview, commitPreview } from '../src/lib/importer';
import { resolveGroup } from '../src/lib/mapping';
import { csvOf, freshRepo, HEADERS, row } from './helpers';

const R1 = row({ 'Activity Type': 'Running', Date: '2026-11-01 06:28:42', Title: 'Sydney Running', Distance: '12.44', Calories: '1,115', Time: '01:18:50', 'Avg Pace': '6:20', 'Body Battery Drain': "'-19" });
const R2 = row({ 'Activity Type': 'Cardio', Date: '2026-10-31 16:04:22', Title: 'Cardio', Distance: '0.00', Time: '00:27:20' });
const R3 = row({ 'Activity Type': 'Strength Training', Date: '2026-10-31 16:04:22', Title: 'Strength', Time: '00:40:00' }); // same timestamp as R2
const R4 = row({ 'Activity Type': 'Golf', Date: '2026-10-30 09:00:00', Title: 'Golf', 'Avg Pace': '2.8' });

describe('preview', () => {
  it('reports rows, columns, types, mapped groups, hash and no errors', async () => {
    const repo = await freshRepo();
    const p = await buildPreview(csvOf([R1, R2, R3, R4]), repo, 'a.csv');
    expect(p.rowCount).toBe(4);
    expect(p.columnCount).toBe(41);
    expect(p.blocked).toBe(false);
    expect(p.rowErrors).toEqual([]);
    expect(p.newRows).toBe(4);
    expect(p.duplicateRows).toBe(0);
    expect(p.alreadyImported).toBe(false);
    expect(p.fileSha256).toMatch(/^[0-9a-f]{64}$/);
    const m = Object.fromEntries(p.types.map((t) => [t.type, t.mapped]));
    expect(m).toEqual({ Running: 'outdoor_run', Cardio: 'weights', 'Strength Training': 'weights', Golf: 'other' });
    expect(await repo.countActivities()).toBe(0); // preview writes nothing
  });
  it('lists row-level parse errors and blocks', async () => {
    const repo = await freshRepo();
    const bad = row({ 'Activity Type': 'Running', Date: '2026-11-01 06:28:42', Distance: 'twelve' });
    const p = await buildPreview(csvOf([R1, bad]), repo);
    expect(p.blocked).toBe(true);
    expect(p.rowErrors[0]).toMatchObject({ row: 2, column: 'Distance' });
  });
});

describe('commit and field preservation', () => {
  it('keeps all 41 original fields, raw row, file hash, canonical row hash; parses typed values', async () => {
    const repo = await freshRepo();
    const p = await buildPreview(csvOf([R1]), repo);
    await commitPreview(p, repo);
    const [a] = await repo.activitiesBetween('2026-11-01', '2026-11-01');
    expect(Object.keys(a.raw_fields)).toEqual(HEADERS);
    expect(a.raw_fields['Calories']).toBe('1,115');
    expect(a.raw_fields['Body Battery Drain']).toBe("'-19");
    expect(a.raw_row).toEqual(R1);
    expect(a.source_file_sha256).toBe(p.fileSha256);
    expect(a.row_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(a.owner_id).toBeNull();
    expect(a.calories).toBe(1115);
    expect(a.parsed['Body Battery Drain']).toBe(-19);
    expect(a.avg_pace_sec_per_km).toBe(380);
    expect(a.duration_seconds).toBe(4730);
    expect(a.distance_km).toBe(12.44);
    expect(a.timestamp_local).toBe('2026-11-01 06:28:42');
    expect(a.parsed['Aerobic TE']).toBeNull();
  });
  it('preserves zero distance and does not treat pace-less decimals as pace', async () => {
    const repo = await freshRepo();
    await commitPreview(await buildPreview(csvOf([R2, R4]), repo), repo);
    const rows = await repo.activitiesBetween('2026-10-30', '2026-10-31');
    expect(rows.find((r) => r.original_type === 'Cardio')!.distance_km).toBe(0);
    expect(rows.find((r) => r.original_type === 'Golf')!.avg_pace_sec_per_km).toBeNull();
  });
  it('records the migration ledger', async () => {
    const repo = await freshRepo();
    expect((await repo.listMigrations()).map((m) => m.version)).toEqual([1, 2]);
  });
});

describe('dedupe', () => {
  it('simultaneous activities (same timestamp) are both kept', async () => {
    const repo = await freshRepo();
    const r = await commitPreview(await buildPreview(csvOf([R2, R3]), repo), repo);
    expect(r.added).toBe(2);
    expect(await repo.countActivities()).toBe(2);
  });
  it('byte-identical rows inside one file are not collapsed', async () => {
    const repo = await freshRepo();
    const r = await commitPreview(await buildPreview(csvOf([R2, R2]), repo), repo);
    expect(r.added).toBe(2);
  });
  it('re-importing the same file adds zero rows (and the preview says so)', async () => {
    const repo = await freshRepo();
    const bytes = csvOf([R1, R2, R3, R4]);
    expect((await commitPreview(await buildPreview(bytes, repo), repo)).added).toBe(4);
    const again = await buildPreview(bytes, repo);
    expect(again.alreadyImported).toBe(true);
    expect(again.duplicateRows).toBe(4);
    expect(again.newRows).toBe(0);
    const r = await commitPreview(again, repo);
    expect(r.added).toBe(0);
    expect(await repo.countActivities()).toBe(4);
    expect((await repo.listBatches()).length).toBe(1);
  });
  it('a later export that overlaps adds only the new rows', async () => {
    const repo = await freshRepo();
    await commitPreview(await buildPreview(csvOf([R2, R3]), repo), repo);
    const r = await commitPreview(await buildPreview(csvOf([R1, R2, R3]), repo), repo);
    expect(r.added).toBe(1);
    expect(r.skippedDuplicates).toBe(2);
    expect(await repo.countActivities()).toBe(3);
  });
});

describe('invalid / truncated files are rejected and existing data is unchanged', () => {
  it('truncated mid-row', async () => {
    const repo = await freshRepo();
    const full = csvOf([R1, R2, R3]);
    await commitPreview(await buildPreview(csvOf([R4]), repo), repo);
    const cut = full.slice(0, full.length - 40);
    const p = await buildPreview(cut, repo);
    expect(p.blocked).toBe(true);
    expect(p.structuralErrors.join(' ')).toMatch(/truncated or malformed|MissingQuotes|fields/);
    await expect(commitPreview(p, repo)).rejects.toThrow(/blocked/);
    expect(await repo.countActivities()).toBe(1);
  });
  it('empty, header-only, wrong headers, non-UTF8', async () => {
    const repo = await freshRepo();
    expect((await buildPreview(new Uint8Array(), repo)).blocked).toBe(true);
    expect((await buildPreview(csvOf([]), repo)).blocked).toBe(true);
    expect((await buildPreview(new TextEncoder().encode('a,b\n1,2\n'), repo)).structuralErrors.join()).toMatch(/required header missing/);
    expect((await buildPreview(new Uint8Array([0xff, 0xfe, 0x00, 0x80, 0xc3, 0x28]), repo)).blocked).toBe(true);
    expect(await repo.countActivities()).toBe(0);
  });
  it('a bad cell anywhere blocks the whole file (all or none)', async () => {
    const repo = await freshRepo();
    const bad = row({ 'Activity Type': 'Running', Date: 'yesterday' });
    const p = await buildPreview(csvOf([R1, bad]), repo);
    expect(p.blocked).toBe(true);
    await expect(commitPreview(p, repo)).rejects.toThrow();
    expect(await repo.countActivities()).toBe(0);
  });
  it('commit is atomic: a failure mid-write rolls back the batch and every row', async () => {
    const repo = await freshRepo();
    const p = await buildPreview(csvOf([R1, R2, R3]), repo);
    const orig = repo.db.activities.bulkAdd.bind(repo.db.activities);
    repo.db.activities.bulkAdd = (async () => { throw new Error('disk full (simulated)'); }) as unknown as typeof orig;
    await expect(commitPreview(p, repo)).rejects.toThrow(/disk full/);
    repo.db.activities.bulkAdd = orig;
    expect(await repo.countActivities()).toBe(0);
    expect((await repo.listBatches()).length).toBe(0);
  });
});

describe('reversible type mapping', () => {
  it('a mapping change alters grouping but keeps original values; clearing it reverts', async () => {
    const repo = await freshRepo();
    await commitPreview(await buildPreview(csvOf([R1, R2, R3]), repo), repo);
    const before = await repo.activitiesBetween('2026-10-31', '2026-10-31');
    expect(before.every((a) => a.group === 'weights')).toBe(true);

    await repo.setTypeMapping('Cardio', 'other');
    const mid = await repo.activitiesBetween('2026-10-31', '2026-10-31');
    expect(mid.find((a) => a.original_type === 'Cardio')!.group).toBe('other');
    expect(mid.find((a) => a.original_type === 'Strength Training')!.group).toBe('weights');
    const cardioBefore = before.find((a) => a.original_type === 'Cardio')!;
    const cardioMid = mid.find((a) => a.original_type === 'Cardio')!;
    expect(cardioMid.original_type).toBe('Cardio');
    expect(cardioMid.raw_row).toEqual(cardioBefore.raw_row);
    expect(cardioMid.duration_seconds).toBe(cardioBefore.duration_seconds);

    await repo.clearTypeMapping('Cardio');
    expect((await repo.activitiesBetween('2026-10-31', '2026-10-31')).find((a) => a.original_type === 'Cardio')!.group).toBe('weights');
  });
  it('per-activity override is reversible and beats type mapping', async () => {
    const repo = await freshRepo();
    await commitPreview(await buildPreview(csvOf([R2]), repo), repo);
    const [a] = await repo.activitiesBetween('2026-10-31', '2026-10-31');
    await repo.setActivityOverride(a.id, 'treadmill_run');
    expect((await repo.activitiesBetween('2026-10-31', '2026-10-31'))[0].group).toBe('treadmill_run');
    await repo.setActivityOverride(a.id, null);
    expect((await repo.activitiesBetween('2026-10-31', '2026-10-31'))[0].group).toBe('weights');
  });
  it('resolveGroup precedence', () => {
    expect(resolveGroup('Cardio', null, new Map())).toBe('weights');
    expect(resolveGroup('Cardio', null, new Map([['Cardio', 'other' as const]]))).toBe('other');
    expect(resolveGroup('Cardio', 'outdoor_run', new Map([['Cardio', 'other' as const]]))).toBe('outdoor_run');
    expect(resolveGroup('Golf', null, new Map())).toBe('other');
  });
  it('imported text is stored verbatim (rendering escapes it; React renders text only)', async () => {
    const repo = await freshRepo();
    const evil = row({ 'Activity Type': 'Running', Date: '2026-11-01 06:00:00', Title: '<img src=x onerror=alert(1)>' });
    await commitPreview(await buildPreview(csvOf([evil]), repo), repo);
    expect((await repo.activitiesBetween('2026-11-01', '2026-11-01'))[0].title).toBe('<img src=x onerror=alert(1)>');
  });
});
