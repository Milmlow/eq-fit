import type { Group } from './mapping';

export interface SummaryInput {
  date: string; // YYYY-MM-DD
  group: Group;
  distance_km: number | null;
  duration_seconds: number | null;
}

export interface GroupTotals {
  entries: number;
  distinctDays: number;
  km: number; // rounded to 2 dp
  minutes: number; // rounded to 2 dp
}

export interface Summary {
  start: string;
  end: string;
  weights: GroupTotals;
  outdoor_run: GroupTotals;
  treadmill_run: GroupTotals;
  /** Dates with at least one activity of ANY type (including 'other'). */
  activeDates: number;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** Monday of the week containing `date`. */
export function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); // 0 = Sun
  return addDays(date, -((dow + 6) % 7));
}

const r2 = (x: number) => Math.round(x * 100) / 100;

export function summarise(rows: SummaryInput[], start: string, end: string): Summary {
  const acc = {
    weights: { entries: 0, days: new Set<string>(), km: 0, sec: 0 },
    outdoor_run: { entries: 0, days: new Set<string>(), km: 0, sec: 0 },
    treadmill_run: { entries: 0, days: new Set<string>(), km: 0, sec: 0 },
  };
  const active = new Set<string>();
  for (const r of rows) {
    if (r.date < start || r.date > end) continue;
    active.add(r.date);
    if (r.group === 'other') continue;
    const a = acc[r.group];
    a.entries++;
    a.days.add(r.date);
    a.km += r.distance_km ?? 0;
    a.sec += r.duration_seconds ?? 0;
  }
  const fin = (a: (typeof acc)['weights']): GroupTotals => ({
    entries: a.entries, distinctDays: a.days.size, km: r2(a.km), minutes: r2(a.sec / 60),
  });
  return {
    start, end, weights: fin(acc.weights), outdoor_run: fin(acc.outdoor_run),
    treadmill_run: fin(acc.treadmill_run), activeDates: active.size,
  };
}

/** 28-day window ending on `anchor` (inclusive). */
export function window28(anchor: string): { start: string; end: string } {
  return { start: addDays(anchor, -27), end: anchor };
}
