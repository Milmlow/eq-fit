import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it, beforeAll } from 'vitest';
import { buildPreview, commitPreview } from '../src/lib/importer';
import { addDays, summarise, window28 } from '../src/lib/summary';
import { freshRepo, HEADERS } from './helpers';
import type { Repo } from '../src/db/repo';
import oracle from './fixtures/oracle.json';

const CSV = new URL('../data-local/Activities.csv', import.meta.url);
const have = existsSync(CSV);
if (!have) console.warn('GOLDEN TESTS SKIPPED: data-local/Activities.csv not present');

describe.skipIf(!have)('golden: real Activities.csv vs independent Python oracle', () => {
  let repo: Repo;
  let bytes: Uint8Array;
  beforeAll(async () => {
    bytes = new Uint8Array(readFileSync(CSV));
    repo = await freshRepo();
  });

  it('file hash, row and column counts match oracle', async () => {
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(oracle.file_sha256);
    const p = await buildPreview(bytes, repo, 'Activities.csv');
    expect(p.fileSha256).toBe(oracle.file_sha256);
    expect(p.rowCount).toBe(oracle.data_rows);
    expect(p.columnCount).toBe(oracle.columns);
    expect(p.headers).toEqual(HEADERS);
    expect(p.rowErrors).toEqual([]);
    expect(p.structuralErrors).toEqual([]);
    expect(p.blocked).toBe(false);
    expect(p.newRows).toBe(2698);
  });

  it('commits all 2698 rows; a second import of the same file adds 0', async () => {
    const r1 = await commitPreview(await buildPreview(bytes, repo, 'Activities.csv'), repo);
    expect(r1.added).toBe(2698);
    expect(await repo.countActivities()).toBe(2698);
    const p2 = await buildPreview(bytes, repo, 'Activities.csv');
    expect(p2.alreadyImported).toBe(true);
    expect(p2.duplicateRows).toBe(2698);
    expect((await commitPreview(p2, repo)).added).toBe(0);
    expect(await repo.countActivities()).toBe(2698);
  });

  it('a truncated copy is rejected and the stored row count is unchanged', async () => {
    const cut = bytes.slice(0, bytes.length - 57); // mid-row
    const p = await buildPreview(cut, repo, 'truncated.csv');
    expect(p.blocked).toBe(true);
    await expect(commitPreview(p, repo)).rejects.toThrow();
    expect(await repo.countActivities()).toBe(2698);
  });

  it('latest timestamp matches', async () => {
    expect(await repo.latestActivityDate()).toBe(oracle.latest_timestamp.slice(0, 10));
    const [latest] = await repo.activitiesBetween('2026-11-01', '2026-11-01');
    expect(latest.timestamp_local).toBe(oracle.latest_timestamp);
  });

  it('all 41 original fields kept on every row', async () => {
    const all = await repo.db.activities.toArray();
    expect(all.every((a) => a.raw_row.length === 41 && Object.keys(a.raw_fields).length === 41)).toBe(true);
  });

  it('28-day window figures match the oracle', async () => {
    const { start, end } = window28('2026-11-01');
    expect([start, end]).toEqual([oracle.window.start, oracle.window.end]);
    const s = summarise(await repo.activitiesBetween(start, end), start, end);
    expect(s.weights).toEqual({ entries: oracle.window.weights.entries, distinctDays: oracle.window.weights.distinct_days, km: oracle.window.weights.km, minutes: oracle.window.weights.minutes });
    expect(s.outdoor_run).toEqual({ entries: oracle.window.outdoor.entries, distinctDays: oracle.window.outdoor.distinct_days, km: oracle.window.outdoor.km, minutes: oracle.window.outdoor.minutes });
    expect(s.treadmill_run).toEqual({ entries: oracle.window.treadmill.entries, distinctDays: oracle.window.treadmill.distinct_days, km: oracle.window.treadmill.km, minutes: oracle.window.treadmill.minutes });
    expect(s.activeDates).toBe(oracle.window.active_dates);
  });

  it('last full week (Mon 2026-10-26 to Sun 2026-11-01) matches the oracle', async () => {
    const w = oracle.last_full_week;
    expect(addDays(w.start, 6)).toBe(w.end);
    const s = summarise(await repo.activitiesBetween(w.start, w.end), w.start, w.end);
    expect(s.weights.entries).toBe(w.weights.entries);
    expect(s.outdoor_run.entries).toBe(w.outdoor.entries);
    expect(s.outdoor_run.km).toBe(w.outdoor.km);
    expect(Math.round(s.outdoor_run.km * 10) / 10).toBe(26.5); // "about 26.5 km", rounding explicit (1 dp)
    expect(s.treadmill_run.entries).toBe(w.treadmill.entries);
    expect(s.activeDates).toBe(w.active_dates);
  });

  it('changing the Cardio mapping changes grouping but not stored originals; reverting restores oracle figures', async () => {
    const { start, end } = window28('2026-11-01');
    await repo.setTypeMapping('Cardio', 'other');
    const mid = summarise(await repo.activitiesBetween(start, end), start, end);
    expect(mid.weights.entries).toBeLessThan(oracle.window.weights.entries);
    expect(mid.activeDates).toBe(oracle.window.active_dates); // active dates counts any type
    await repo.clearTypeMapping('Cardio');
    const back = summarise(await repo.activitiesBetween(start, end), start, end);
    expect(back.weights.entries).toBe(oracle.window.weights.entries);
    expect(await repo.typeCounts()).toBeInstanceOf(Map);
  });
});
