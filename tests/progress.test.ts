import { describe, expect, it } from 'vitest';
import { runningProgress, trainingDays } from '../src/lib/progress';
import type { RunInput } from '../src/lib/running';
import type { Workout } from '../src/db/types';

const run = (date: string, distance_km: number | null, pace = 300): RunInput => ({ date, distance_km, avg_pace_sec_per_km: pace, group: 'outdoor_run' });
describe('honest progress comparisons', () => {
  it('compares Monday–Tuesday with Monday–Tuesday, excluding last Sunday and future entries', () => {
    const p = runningProgress([run('2026-11-02', 5), run('2026-11-03', 7), run('2026-10-26', 4), run('2026-10-27', 3), run('2026-11-01', 50), run('2026-11-04', 80)], '2026-11-03');
    expect(p.week.km).toBe(12); expect(p.previousElapsed.km).toBe(7); expect(p.month.km).toBe(62);
  });
  it('weights pace by distance and respects treadmill selection', () => {
    const rows: RunInput[] = [run('2026-11-02', 2, 240), run('2026-11-03', 8, 360), { ...run('2026-11-03', 20, 180), group: 'treadmill_run' }];
    expect(runningProgress(rows, '2026-11-03').week.paceSecPerKm).toBe(336);
    expect(runningProgress(rows, '2026-11-03', true).week.km).toBe(30);
  });
  it('does not turn missing data into zero', () => {
    expect(runningProgress([], '2026-11-03').week.km).toBeNull();
    expect(runningProgress([run('2026-11-02', null)], '2026-11-03').week.paceSecPerKm).toBeNull();
  });
  it('handles year boundaries without interpreting local dates as UTC instants', () => {
    const p = runningProgress([run('2026-12-31', 6)], '2027-01-01');
    expect(p.week.start).toBe('2026-12-28'); expect(p.week.km).toBe(6); expect(p.month.km).toBeNull();
  });
  it('counts a linked workout and activity as one day, excludes planned and future workouts', () => {
    const activities = [{ id: 'a', date: '2026-11-02', group: 'outdoor_run' as const }];
    const workouts = [
      { date: '2026-11-02', status: 'done' }, { date: '2026-11-03', status: 'planned' }, { date: '2026-11-04', status: 'done' },
    ] as Workout[];
    const days = trainingDays(activities, workouts, '2026-11-03');
    expect(days.filter(d => d.recorded)).toHaveLength(1); expect(days.filter(d => d.future)).toHaveLength(5);
  });
});
