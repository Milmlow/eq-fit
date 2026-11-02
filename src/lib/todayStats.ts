// Last-week totals and 4-week running pace for the Today screen. Reuses summarise() and summariseRuns();
// nothing is recomputed here. Missing data is null (shown as "-"), never 0.
import { recentCompleteWeeks, summariseRuns, type RunInput } from './running';
import { summarise, type SummaryInput } from './summary';

export type StatRow = SummaryInput & RunInput;

export interface LastWeek { start: string; end: string; lifts: number | null; runs: number | null; km: number | null }

/**
 * Last complete Monday-Sunday week before `today` (outdoor runs only, like the Running tab default).
 * `latestActivityDate` is the newest imported activity: if the import does not reach into that week the
 * numbers are unknown (null), not zero.
 */
export function lastWeekStats(rows: StatRow[], today: string, latestActivityDate: string | null): LastWeek {
  const w = recentCompleteWeeks(today, 1)[0];
  if (latestActivityDate === null || latestActivityDate < w.start) return { ...w, lifts: null, runs: null, km: null };
  const s = summarise(rows, w.start, w.end);
  const r = summariseRuns(rows, w.start, w.end, false);
  return { ...w, lifts: s.weights.entries, runs: r.runs, km: r.km };
}

/** Distance-weighted pace (seconds per km) over the last 4 complete weeks, outdoor only. null = unknown. */
export function fourWeekPace(rows: StatRow[], today: string, latestActivityDate: string | null): number | null {
  const weeks = recentCompleteWeeks(today, 4);
  if (latestActivityDate === null || latestActivityDate < weeks[0].start) return null;
  return summariseRuns(rows, weeks[0].start, weeks[3].end, false).paceSecPerKm;
}

/** "5:49" (no unit: the screen prints "per km" itself). null -> "-". */
export function paceMinSec(sec: number | null): string {
  if (sec === null) return '-';
  const r = Math.round(sec);
  return `${Math.floor(r / 60)}:${String(r % 60).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-11-02" -> "Mon 2 Nov" */
export function formatTodayLabel(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

export const dash = (n: number | null, digits?: number): string => (n === null ? '-' : digits === undefined ? String(n) : n.toFixed(digits));
