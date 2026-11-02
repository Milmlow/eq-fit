// Running bests from existing activity rows. Outdoor runs only (the app default). Mirrored by tests/oracle/oracle_push.py.
// Only runs with BOTH a distance above 0 and a pace above 0 are used, for every best. Nothing is inferred: a 5 km split of a
// longer run is never invented, and a missing value shows "-".
import type { Group } from './mapping';
import { addDays, mondayOf } from './summary';

export interface BestRun { date: string; group: Group; distance_km: number | null; avg_pace_sec_per_km: number | null }

export interface Best {
  /** Seconds per km for pace bests, km for distance bests. null = no qualifying run. */
  value: number | null;
  /** Date of the run (pace, longest) or the Monday of the week (best week). */
  date: string | null;
  /** How many qualifying candidates it was chosen from (runs; for the best week, weeks that contain a qualifying run). 0 = none. */
  n: number;
  /** Best week only: qualifying runs inside that week. */
  runsInWeek?: number;
}

export interface RunningBests { fastest5k: Best; fastest10k: Best; longest: Best; bestWeek: Best }

const r2 = (x: number) => Math.round(x * 100) / 100;
const none = (): Best => ({ value: null, date: null, n: 0 });
const valid = (r: BestRun): r is BestRun & { distance_km: number; avg_pace_sec_per_km: number } =>
  r.group === 'outdoor_run' && r.distance_km !== null && r.distance_km > 0 && r.avg_pace_sec_per_km !== null && r.avg_pace_sec_per_km > 0;

/** Lowest pace among valid runs of at least `minKm`; a tie goes to the earliest date. */
function fastest(runs: ReturnType<typeof validRuns>, minKm: number): Best {
  const pool = runs.filter((r) => r.distance_km >= minKm);
  let best: (typeof pool)[number] | null = null;
  for (const r of pool) if (!best || r.avg_pace_sec_per_km < best.avg_pace_sec_per_km || (r.avg_pace_sec_per_km === best.avg_pace_sec_per_km && r.date < best.date)) best = r;
  return best ? { value: best.avg_pace_sec_per_km, date: best.date, n: pool.length } : none();
}
const validRuns = (rows: BestRun[]) => rows.filter(valid);

export function runningBests(rows: BestRun[]): RunningBests {
  const runs = validRuns(rows);
  let longest: (typeof runs)[number] | null = null;
  for (const r of runs) if (!longest || r.distance_km > longest.distance_km || (r.distance_km === longest.distance_km && r.date < longest.date)) longest = r;
  const weeks = new Map<string, { km: number; runs: number }>();
  for (const r of runs) {
    const w = mondayOf(r.date);
    const cur = weeks.get(w) ?? { km: 0, runs: 0 };
    cur.km += r.distance_km; cur.runs++;
    weeks.set(w, cur);
  }
  let bw: { week: string; km: number; runs: number } | null = null;
  for (const [week, v] of weeks) if (!bw || r2(v.km) > r2(bw.km) || (r2(v.km) === r2(bw.km) && week < bw.week)) bw = { week, ...v };
  return {
    fastest5k: fastest(runs, 5),
    fastest10k: fastest(runs, 10),
    longest: longest ? { value: r2(longest.distance_km), date: longest.date, n: runs.length } : none(),
    bestWeek: bw ? { value: r2(bw.km), date: bw.week, n: weeks.size, runsInWeek: bw.runs } : none(),
  };
}

export const weekEndOf = (monday: string): string => addDays(monday, 6);
