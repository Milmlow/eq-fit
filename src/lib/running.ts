import type { Group } from './mapping';
import { addDays, mondayOf } from './summary';

export interface RunInput {
  date: string;
  group: Group;
  distance_km: number | null;
  avg_pace_sec_per_km: number | null;
}

export interface RunPeriod {
  label: string;
  start: string;
  end: string;
  runs: number; // runs in the period (after the treadmill toggle)
  runsWithPace: number; // runs that contributed to the pace figure
  km: number | null; // null when no run has a distance (never 0 for unknown)
  paceSecPerKm: number | null; // null when no run has pace AND distance
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * Distance-weighted average pace: sum(pace_i * km_i) / sum(km_i), over runs that have BOTH a pace
 * and a distance > 0. It is not a mean of paces. Runs lacking pace are counted in `runs` and in
 * `km` (if they have distance) but excluded from the pace figure; nothing is interpolated.
 */
export function summariseRuns(rows: RunInput[], start: string, end: string, includeTreadmill: boolean, label = ''): RunPeriod {
  const sel = rows.filter(
    (r) => r.date >= start && r.date <= end && (r.group === 'outdoor_run' || (includeTreadmill && r.group === 'treadmill_run')),
  );
  const withKm = sel.filter((r) => r.distance_km !== null);
  const paced = sel.filter((r) => r.avg_pace_sec_per_km !== null && r.distance_km !== null && r.distance_km > 0);
  const dist = paced.reduce((a, r) => a + (r.distance_km as number), 0);
  return {
    label, start, end, runs: sel.length, runsWithPace: paced.length,
    km: withKm.length ? r2(withKm.reduce((a, r) => a + (r.distance_km as number), 0)) : null,
    paceSecPerKm: dist > 0 ? r2(paced.reduce((a, r) => a + (r.avg_pace_sec_per_km as number) * (r.distance_km as number), 0) / dist) : null,
  };
}

/** The last `n` complete Monday-Sunday weeks strictly before `today`, oldest first. */
export function recentCompleteWeeks(today: string, n: number): { start: string; end: string }[] {
  const lastMon = addDays(mondayOf(today), -7);
  const out: { start: string; end: string }[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const s = addDays(lastMon, -7 * i);
    out.push({ start: s, end: addDays(s, 6) });
  }
  return out;
}

/** Most recent complete calendar month before `today`. */
export function lastCompleteMonth(today: string): { start: string; end: string; label: string } {
  const firstThis = `${today.slice(0, 7)}-01`;
  const end = addDays(firstThis, -1);
  return { start: `${end.slice(0, 7)}-01`, end, label: end.slice(0, 7) };
}

export function formatPace(sec: number | null): string {
  if (sec === null) return '-';
  const rounded = Math.round(sec);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, '0')} /km`;
}
