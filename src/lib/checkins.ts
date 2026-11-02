// Light weight / waist check-in maths. Mirrored by tests/oracle/oracle_push.py (exact fractions).
// Unknown is null and shows as blank or "-", never 0. No interpolation anywhere.
import { addDays } from './summary';

export const WEIGHT_RANGE = { min: 20, max: 400 };
export const WAIST_RANGE = { min: 30, max: 300 };
export const NOTE_MAX = 500;

export interface CheckinLite { date: string; weight_kg: number | null; waist_cm: number | null }
export type Measure = 'weight_kg' | 'waist_cm';

export interface WindowMean {
  /** Mean of the observations in the window, 2 decimal places. null when n = 0. */
  mean: number | null;
  /** Observations used (days with this measurement in the window). */
  n: number;
  /** The 7 calendar days ending on the selected date, inclusive. */
  start: string;
  end: string;
}

/**
 * 7-CALENDAR-DAY mean ending on `selected`: every entry dated start..selected that has this measure. Not "the last 7 entries"; entries
 * after `selected` (future) are never used; days without an entry are simply absent (no fill-in). Sum in thousandths, so no float drift.
 */
export function windowMean(entries: CheckinLite[], selected: string, measure: Measure): WindowMean {
  const start = addDays(selected, -6);
  let sum = 0, n = 0;
  for (const e of entries) {
    const v = e[measure];
    if (v === null || e.date < start || e.date > selected) continue;
    sum += Math.round(v * 1000); n++;
  }
  return { mean: n === 0 ? null : Math.round(sum / n / 10) / 100, n, start, end: selected };
}

export function validateCheckin(c: { date: string; weight_kg: number | null; waist_cm: number | null; note: string | null }, today: string): string[] {
  const errs: string[] = [];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.date) || Number.isNaN(Date.parse(`${c.date}T00:00:00Z`)) || new Date(`${c.date}T00:00:00Z`).toISOString().slice(0, 10) !== c.date) errs.push('date must be YYYY-MM-DD');
  else if (c.date > today) errs.push('a check-in cannot be dated in the future');
  if (c.weight_kg === null && c.waist_cm === null) errs.push('enter a weight or a waist measurement');
  if (c.weight_kg !== null && (!Number.isFinite(c.weight_kg) || c.weight_kg < WEIGHT_RANGE.min || c.weight_kg > WEIGHT_RANGE.max)) errs.push(`weight must be ${WEIGHT_RANGE.min} to ${WEIGHT_RANGE.max} kg`);
  if (c.waist_cm !== null && (!Number.isFinite(c.waist_cm) || c.waist_cm < WAIST_RANGE.min || c.waist_cm > WAIST_RANGE.max)) errs.push(`waist must be ${WAIST_RANGE.min} to ${WAIST_RANGE.max} cm`);
  if (c.note !== null && c.note.length > NOTE_MAX) errs.push(`note over ${NOTE_MAX} characters`);
  return errs;
}

export interface ChartPoint { date: string; value: number; dayIndex: number }

/** Only real readings, positioned by calendar day within the `days`-day window ending on `selected`. No line is implied between them. */
export function sparsePoints(entries: CheckinLite[], selected: string, measure: Measure, days = 30): ChartPoint[] {
  const start = addDays(selected, -(days - 1));
  const out: ChartPoint[] = [];
  for (const e of [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) {
    const v = e[measure];
    if (v === null || e.date < start || e.date > selected) continue;
    out.push({ date: e.date, value: v, dayIndex: Math.round((Date.parse(`${e.date}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86_400_000) });
  }
  return out;
}
