import { addDays, mondayOf, summarise, type SummaryInput } from './summary';

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function weekDates(anyDateInWeek: string): string[] {
  const m = mondayOf(anyDateInWeek);
  return Array.from({ length: 7 }, (_, i) => addDays(m, i));
}

/**
 * Baseline from imported history: average weights entries and runs (outdoor + treadmill) per week
 * over the `n` complete weeks before the week containing `date`. Context only, never a prescription.
 * Returns null when there is no history at all in those weeks.
 */
export function baselinePerWeek(rows: SummaryInput[], date: string, n = 4): { weights: number; runs: number; weeks: number } | null {
  const thisMon = mondayOf(date);
  let w = 0, r = 0, any = 0;
  for (let i = 1; i <= n; i++) {
    const s = addDays(thisMon, -7 * i);
    const sum = summarise(rows, s, addDays(s, 6));
    w += sum.weights.entries;
    r += sum.outdoor_run.entries + sum.treadmill_run.entries;
    any += sum.activeDates;
  }
  if (any === 0) return null;
  return { weights: Math.round((w / n) * 10) / 10, runs: Math.round((r / n) * 10) / 10, weeks: n };
}

/** Optional 3-day fallback: Monday, Wednesday, Friday. Names only; no exercises are invented. */
export function fallbackDates(anyDateInWeek: string): string[] {
  const m = mondayOf(anyDateInWeek);
  return [addDays(m, 0), addDays(m, 2), addDays(m, 4)];
}
