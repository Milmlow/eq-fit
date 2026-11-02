// CSV export. Expected text comes from tests/oracle/oracle_backup.py (python csv module), not from app code.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import './helpers';
import { guardCell, toCsv } from '../src/lib/csvExport';
import { freshRepo } from './helpers';
import type { BackupDoc } from '../src/lib/backup';

const fx = (n: string) => JSON.parse(readFileSync(new URL(`./fixtures/${n}`, import.meta.url), 'utf8'));
const V3 = fx('synthetic-backup-v3.json') as BackupDoc;
const ORACLE = fx('oracle-backup-expected.json');

async function seeded() {
  const repo = await freshRepo();
  const t = V3.tables;
  await repo.db.batches.bulkAdd(t.batches); await repo.db.activities.bulkAdd(t.activities); await repo.db.type_mappings.bulkAdd(t.type_mappings);
  await repo.db.exercises.bulkAdd(t.exercises); await repo.db.workouts.bulkAdd(t.workouts); await repo.db.sets.bulkAdd(t.sets);
  return repo;
}

describe('CSV export matches the oracle', () => {
  it('workouts and sets', async () => {
    expect(await (await seeded()).exportSetsCsv()).toBe(ORACLE.sets_csv);
  });
  it('running periods', async () => {
    expect(await (await seeded()).exportRunningCsv(ORACLE.today)).toBe(ORACLE.running_csv);
  });
  it('empty database gives a header-only file', async () => {
    const csv = await (await freshRepo()).exportSetsCsv();
    expect(csv.split('\r\n').filter(Boolean)).toHaveLength(1);
  });
  it('unknown values are blank, never 0; formula-looking text is guarded', async () => {
    const csv = await (await seeded()).exportSetsCsv();
    expect(csv).toContain("2026-11-01,'-leg day,weights,done");
    expect(csv).toContain(",'=SUM(A1)  Squat,,2,,8,,false,"); // equipment blank, load unknown, RIR unknown
  });
});

describe('spreadsheet formula guard', () => {
  it.each([
    ['=1+1', "'=1+1"], ['+1', "'+1"], ['-1', "'-1"], ['@SUM(A1)', "'@SUM(A1)"], ['\tx', "'\tx"], ['\rx', "'\rx"],
    ['=HYPERLINK("http://x","y")', `'=HYPERLINK("http://x","y")`],
  ])('guards %j', (input, out) => { expect(guardCell(input)).toBe(out); });

  it.each(['', 'abc', "'=x", ' =x', 'a=b', '1-2', 'Bench Press'])('leaves %j alone', (s) => { expect(guardCell(s)).toBe(s); });

  it('guards inside CSV output and still quotes correctly', () => {
    const csv = toCsv(['a', 'b'], [['=cmd|calc', 'x,"y"'], ['-5', 'line1\nline2']]);
    expect(csv.replace(/^\ufeff/, '')).toBe(`a,b\r\n'=cmd|calc,"x,""y"""\r\n'-5,"line1\nline2"\r\n`);
  });

  it('numbers are written as numbers and are not prefixed; null and undefined are blank', () => {
    const csv = toCsv(['n'], [[-5], [0], [null], [undefined], [true]]);
    expect(csv.replace(/^\ufeff/, '')).toBe('n\r\n-5\r\n0\r\n\r\n\r\ntrue\r\n');
  });

  it('starts with a UTF-8 BOM so Excel reads accents correctly', () => {
    expect(toCsv(['a'], []).charCodeAt(0)).toBe(0xfeff);
  });
});
