// Pure lifting maths. Conventions are shown in the UI and mirrored by tests/oracle/oracle_lifting.py.
import { addDays, mondayOf } from './summary';

export const UNASSIGNED = 'unassigned';

/** lower-case, trim, collapse spaces, de-duplicate, drop blanks. No taxonomy is invented. */
export function normaliseMuscles(raw: string[]): string[] {
  const out: string[] = [];
  for (const m of raw) {
    const n = m.trim().toLowerCase().split(/\s+/).filter(Boolean).join(' ');
    if (n && !out.includes(n)) out.push(n);
  }
  return out;
}

export interface SetLite { load_kg: number | null; reps: number | null; rir: number | null; warmup: boolean; pain_note: string | null }
export interface WeeklySetInput extends SetLite { date: string; muscles: string[] }

export interface WeekSets { weekStart: string; weekEnd: string; muscles: Record<string, number>; workingSets: number }

/** Working sets only; each counts 1 toward every primary muscle listed (or 'unassigned'). Weeks Mon-Sun. */
export function weeklyWorkingSets(rows: WeeklySetInput[]): WeekSets[] {
  const by = new Map<string, WeekSets>();
  for (const r of rows) {
    if (r.warmup) continue;
    const ws = mondayOf(r.date);
    let w = by.get(ws);
    if (!w) by.set(ws, (w = { weekStart: ws, weekEnd: addDays(ws, 6), muscles: {}, workingSets: 0 }));
    w.workingSets++;
    const ms = normaliseMuscles(r.muscles);
    for (const m of ms.length ? ms : [UNASSIGNED]) w.muscles[m] = (w.muscles[m] ?? 0) + 1;
  }
  return [...by.values()].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
}

export interface E1rm { epley: number; brzycki: number; actual: boolean; lowConfidence: boolean; load: number; reps: number }
const r1 = (x: number) => Math.round(x * 10 + 1e-6) / 10;

/** Working sets only, with load > 0 and reps >= 1. Anything else is missing (null). */
export function e1rm(s: Pick<SetLite, 'load_kg' | 'reps' | 'warmup'>): E1rm | null {
  if (s.warmup || s.load_kg === null || s.reps === null || s.load_kg <= 0 || s.reps < 1) return null;
  if (s.reps === 1) return { epley: s.load_kg, brzycki: s.load_kg, actual: true, lowConfidence: false, load: s.load_kg, reps: 1 };
  if (s.reps >= 37) return null; // Brzycki undefined
  return {
    epley: r1(s.load_kg * (1 + s.reps / 30)), brzycki: r1((s.load_kg * 36) / (37 - s.reps)),
    actual: false, lowConfidence: s.reps > 10, load: s.load_kg, reps: s.reps,
  };
}

/** Highest-Epley eligible working set of a session (first wins ties). */
export function bestE1rm(sets: SetLite[]): E1rm | null {
  let best: E1rm | null = null;
  for (const s of sets) {
    const e = e1rm(s);
    if (e && (!best || e.epley > best.epley)) best = e;
  }
  return best;
}

export type Hint = 'increase' | 'stay' | 'review_pain_note';

/**
 * Double progression from the LAST session's sets. Needs a user-entered rep range (else null: no hint).
 * Pain note on any set of that session -> review first. Increase only when every working set has reps
 * at/above the top of the range and RIR is unspecified or 1-3. Anything else (incl. missing reps) -> stay.
 */
export function progressionHint(repMax: number | null | undefined, lastSession: SetLite[]): Hint | null {
  if (repMax === null || repMax === undefined || lastSession.length === 0) return null;
  if (lastSession.some((s) => s.pain_note && s.pain_note.trim() !== '')) return 'review_pain_note';
  const work = lastSession.filter((s) => !s.warmup);
  if (work.length === 0) return null;
  if (work.some((s) => s.reps === null)) return 'stay';
  const ok = work.every((s) => (s.reps as number) >= repMax && (s.rir === null || (s.rir >= 1 && s.rir <= 3)));
  return ok ? 'increase' : 'stay';
}

export function hintText(h: Hint): string {
  if (h === 'increase') return 'Every working set reached the top of your rep range with reps in reserve unspecified or 1-3. You could try a small load increase (for example 2.5 kg) next time.';
  if (h === 'review_pain_note') return 'Review the pain note from your last session first. No progression is suggested.';
  return 'Stay at this load for now: not every working set reached the top of your rep range at RIR 1-3 or unspecified.';
}

export function validateRepRange(min: number | null, max: number | null): string[] {
  if (min === null && max === null) return [];
  if (min === null || max === null) return ['enter both ends of the rep range, or leave both blank'];
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 1 || max > 100 || min > max) return ['rep range must be whole numbers, 1 to 100, min not above max'];
  return [];
}
