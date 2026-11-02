import { describe, expect, it } from 'vitest';
import { formatPace, lastCompleteMonth, recentCompleteWeeks, summariseRuns, type RunInput } from '../src/lib/running';

const run = (date: string, km: number | null, pace: number | null, group: RunInput['group'] = 'outdoor_run'): RunInput => ({ date, group, distance_km: km, avg_pace_sec_per_km: pace });

describe('summariseRuns', () => {
  it('pace is distance-weighted, not a mean of paces', () => {
    // 10 km @ 300 s/km and 2 km @ 420 s/km: weighted 320, naive mean 360
    const p = summariseRuns([run('2026-10-05', 10, 300), run('2026-10-06', 2, 420)], '2026-10-05', '2026-10-11', false);
    expect(p.paceSecPerKm).toBe(320);
    expect(p.km).toBe(12);
    expect(p.runs).toBe(2);
  });
  it('treadmill excluded unless toggled', () => {
    const rows = [run('2026-10-05', 5, 300), run('2026-10-06', 5, 400, 'treadmill_run')];
    expect(summariseRuns(rows, '2026-10-05', '2026-10-11', false)).toMatchObject({ runs: 1, km: 5, paceSecPerKm: 300 });
    expect(summariseRuns(rows, '2026-10-05', '2026-10-11', true)).toMatchObject({ runs: 2, km: 10, paceSecPerKm: 350 });
  });
  it('missing pace stays missing: run counted and km summed, pace uses only paced runs', () => {
    const p = summariseRuns([run('2026-10-05', 4, null), run('2026-10-06', 6, 330)], '2026-10-05', '2026-10-11', false);
    expect(p).toMatchObject({ runs: 2, runsWithPace: 1, km: 10, paceSecPerKm: 330 });
  });
  it('no runs or no data gives null, not zero', () => {
    expect(summariseRuns([], '2026-10-05', '2026-10-11', false)).toMatchObject({ runs: 0, runsWithPace: 0, km: null, paceSecPerKm: null });
    expect(summariseRuns([run('2026-10-05', null, null)], '2026-10-05', '2026-10-11', false)).toMatchObject({ runs: 1, km: null, paceSecPerKm: null });
  });
  it('zero-distance runs never divide by zero or yield a pace', () => {
    expect(summariseRuns([run('2026-10-05', 0, 300)], '2026-10-05', '2026-10-11', false)).toMatchObject({ km: 0, paceSecPerKm: null, runsWithPace: 0 });
  });
  it('window is inclusive of both end dates and ignores other groups', () => {
    const rows = [run('2026-10-04', 1, 300), run('2026-10-05', 2, 300), run('2026-10-11', 3, 300), run('2026-10-12', 4, 300), run('2026-10-06', 9, 300, 'weights')];
    expect(summariseRuns(rows, '2026-10-05', '2026-10-11', false)).toMatchObject({ runs: 2, km: 5 });
  });
});

describe('periods', () => {
  it('four most recent complete weeks before today (Mon 2026-11-02)', () => {
    expect(recentCompleteWeeks('2026-11-02', 4).map((w) => w.start)).toEqual(['2026-10-05', '2026-10-12', '2026-10-19', '2026-10-26']);
    expect(recentCompleteWeeks('2026-11-02', 4)[3].end).toBe('2026-11-01');
  });
  it('mid-week today excludes the current partial week', () => {
    expect(recentCompleteWeeks('2026-11-04', 1)[0]).toEqual({ start: '2026-10-26', end: '2026-11-01' });
    expect(recentCompleteWeeks('2026-11-08', 1)[0]).toEqual({ start: '2026-10-26', end: '2026-11-01' }); // Sunday still in progress
  });
  it('last complete month', () => {
    expect(lastCompleteMonth('2026-11-02')).toEqual({ start: '2026-10-01', end: '2026-10-31', label: '2026-10' });
    expect(lastCompleteMonth('2026-01-15')).toEqual({ start: '2025-12-01', end: '2025-12-31', label: '2025-12' });
    expect(lastCompleteMonth('2028-03-01').end).toBe('2028-02-29');
  });
  it('formatPace', () => {
    expect(formatPace(380)).toBe('6:20 /km');
    expect(formatPace(333.07)).toBe('5:33 /km');
    expect(formatPace(null)).toBe('-');
  });
});
