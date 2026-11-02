import { existsSync, readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Repo } from '../src/db/repo';
import { buildPreview, commitPreview } from '../src/lib/importer';
import { lastCompleteMonth, recentCompleteWeeks, summariseRuns } from '../src/lib/running';
import { addDays } from '../src/lib/summary';
import oracle from './fixtures/oracle-running.json';
import { freshRepo } from './helpers';

const CSV = new URL('../data-local/Activities.csv', import.meta.url);
const have = existsSync(CSV);
if (!have) console.warn('GOLDEN RUNNING TESTS SKIPPED: data-local/Activities.csv not present');

type OraclePeriod = { start: string; end: string; runs: number; runs_with_pace: number; km: number | null; pace_sec_per_km: number | null };

describe.skipIf(!have)('golden: running comparison vs independent Python oracle (today = 2026-11-02)', () => {
  let rows: Awaited<ReturnType<Repo['activitiesBetween']>>;
  beforeAll(async () => {
    const repo = await freshRepo();
    await commitPreview(await buildPreview(new Uint8Array(readFileSync(CSV)), repo), repo);
    rows = await repo.activitiesBetween('2018-01-01', '2026-12-31');
  });

  function check(label: string, app: ReturnType<typeof summariseRuns>, o: OraclePeriod) {
    expect([label, app.start, app.end]).toEqual([label, o.start, o.end]);
    expect([label, 'runs', app.runs]).toEqual([label, 'runs', o.runs]);
    expect([label, 'runsWithPace', app.runsWithPace]).toEqual([label, 'runsWithPace', o.runs_with_pace]);
    expect(app.km).toBe(o.km);
    if (o.pace_sec_per_km === null) expect(app.paceSecPerKm).toBeNull();
    else expect(app.paceSecPerKm).toBeCloseTo(o.pace_sec_per_km, 2);
  }

  for (const [name, includeTreadmill] of [['outdoor_only', false], ['outdoor_plus_treadmill', true]] as const) {
    it(`${name}: four weeks, combined four-week and October 2026`, () => {
      const o = oracle[name];
      const weeks = recentCompleteWeeks(oracle.today, 4);
      weeks.forEach((w, i) => check(`${name} week ${i}`, summariseRuns(rows, w.start, w.end, includeTreadmill), o.weeks[i]));
      check(`${name} four weeks`, summariseRuns(rows, weeks[0].start, weeks[3].end, includeTreadmill), o.four_weeks);
      const m = lastCompleteMonth(oracle.today);
      expect(m.label).toBe(oracle.month_label);
      check(`${name} month`, summariseRuns(rows, m.start, m.end, includeTreadmill), o.month);
    });
  }
  it('sanity: week end is start + 6', () => {
    for (const w of recentCompleteWeeks(oracle.today, 4)) expect(addDays(w.start, 6)).toBe(w.end);
  });
});
