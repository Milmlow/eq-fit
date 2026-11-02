// Pure "beat last time" rules. Mirrored by tests/oracle/oracle_beat.py (independent, exact fractions).
// No rounding anywhere: e1RM values are compared as exact integers (loads scaled by 1000).
import { progressionHint, type SetLite } from './lifting';

/** Editable constant: the load step for the Alternative and for a rep-range progression. */
export const ALT_INCREMENT_KG = 2.5;
const MAX_REPS = 36; // the app's e1rm() is undefined from 37 reps

export interface Lift { load_kg: number; reps: number }

export type BeatResult =
  | { kind: 'none' } // no prior session, or nothing comparable in it
  | { kind: 'pain'; last: Lift | null } // pain note in the last session: Last time only
  | { kind: 'hold'; last: Lift } // rep range topped out but the progression hint says stay: Last time only
  | { kind: 'target'; last: Lift; target: Lift & { progressed: boolean }; alternative: Lift | null; pr: boolean };

const scaled = (x: number) => Math.round(x * 1000);

/** Eligible = working set with load > 0 and 1 <= reps <= 36. */
export function eligibleLift(s: SetLite): Lift | null {
  if (s.warmup || s.load_kg === null || s.reps === null) return null;
  if (!(s.load_kg > 0) || !Number.isInteger(s.reps) || s.reps < 1 || s.reps > MAX_REPS) return null;
  return { load_kg: s.load_kg, reps: s.reps };
}

/** Epley e1RM x 30 x 1000 as an exact integer. A single rep is the lift itself (matches lifting.ts e1rm()). */
export function e1rmScaled(load: number, reps: number): number {
  return reps === 1 ? scaled(load) * 30 : scaled(load) * (30 + reps);
}

/** Best eligible working set: highest e1RM, ties go to more reps, still tied -> earliest. */
export function bestWorkingSet(sets: SetLite[]): Lift | null {
  let best: Lift | null = null;
  for (const s of sets) {
    const l = eligibleLift(s);
    if (!l) continue;
    if (!best) { best = l; continue; }
    const a = e1rmScaled(l.load_kg, l.reps), b = e1rmScaled(best.load_kg, best.reps);
    if (a > b || (a === b && l.reps > best.reps)) best = l;
  }
  return best;
}

export interface BeatInput {
  /** All sets of the most recent prior session for this exercise; null = there is none. */
  lastSets: SetLite[] | null;
  /** Every set ever recorded for this exercise (any workout). */
  allSets: SetLite[];
  repMin: number | null;
  repMax: number | null;
  increment?: number;
}

const round3 = (x: number) => Math.round(x * 1000) / 1000;

export function beatLastTime(input: BeatInput): BeatResult {
  const { lastSets, allSets, repMin, repMax } = input;
  const inc = input.increment ?? ALT_INCREMENT_KG;
  if (!lastSets) return { kind: 'none' };
  const last = bestWorkingSet(lastSets);
  if (lastSets.some((s) => s.pain_note && s.pain_note.trim() !== '')) return { kind: 'pain', last };
  if (!last) return { kind: 'none' };

  let target: Lift & { progressed: boolean } = { load_kg: last.load_kg, reps: last.reps + 1, progressed: false };
  if (repMin !== null && repMax !== null && last.reps + 1 > repMax) {
    if (progressionHint(repMax, lastSets) !== 'increase') return { kind: 'hold', last };
    target = { load_kg: round3(last.load_kg + inc), reps: repMin, progressed: true };
  }

  let bestEver = 0;
  for (const s of allSets) {
    const l = eligibleLift(s);
    if (l) bestEver = Math.max(bestEver, e1rmScaled(l.load_kg, l.reps));
  }
  const pr = target.reps <= MAX_REPS && e1rmScaled(target.load_kg, target.reps) > bestEver;

  let alternative: Lift | null = null;
  if (!target.progressed) {
    const altLoad = round3(last.load_kg + inc);
    const need = e1rmScaled(last.load_kg, last.reps);
    let r = 1;
    while (e1rmScaled(altLoad, r) < need) r++; // terminates: at r = last.reps the heavier load already meets it
    alternative = { load_kg: altLoad, reps: r };
  }
  return { kind: 'target', last, target, alternative, pr };
}

export function fmtKg(x: number): string {
  return Number.isInteger(x) ? String(x) : String(round3(x));
}
