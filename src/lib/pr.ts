// Achieved personal records. COMPUTED ON READ (no stored PR table): the simplest design, it can never disagree with the logged sets,
// and editing or removing a set or moving a workout just changes the answer. Mirrored by tests/oracle/oracle_push.py (exact fractions).
//
// A set is an ACHIEVED PR when all of these hold:
//  - it is an eligible working set (not a warm-up, load > 0, whole reps 1..36; see eligibleLift in beatLastTime.ts),
//  - there is at least one earlier eligible working set for the SAME exercise id (same name AND same equipment). The very first
//    recorded set is a baseline, not a PR,
//  - its Epley estimated 1RM is strictly greater than every earlier eligible set of that exercise (an equal value is not a PR).
// "Earlier" = by workout date, then workout creation time, then set ordinal. Sets of a different exercise id are never compared.
import { e1rmScaled, eligibleLift } from './beatLastTime';

export interface PrSetInput {
  id: string;
  workout_id: string;
  exercise_id: string;
  ordinal: number;
  load_kg: number | null;
  reps: number | null;
  warmup: boolean;
  date: string; // workout date
  workout_created_at: string;
}

export interface AchievedPr {
  setId: string;
  workoutId: string;
  exerciseId: string;
  date: string;
  load_kg: number;
  reps: number;
  /** Epley estimated 1RM of this set, 1 decimal place. */
  e1rm: number;
  /** Best earlier estimated 1RM (same exercise), 1 decimal place. */
  previousBest: number;
}

/** scaled = e1RM x 30 x 1000 (see e1rmScaled), so e1RM = scaled / 30000. */
const fromScaled = (x: number): number => Math.round((x / 30000) * 10 + 1e-9) / 10;

export function findAchievedPrs(rows: PrSetInput[]): AchievedPr[] {
  const byEx = new Map<string, PrSetInput[]>();
  for (const r of rows) {
    const list = byEx.get(r.exercise_id);
    if (list) list.push(r); else byEx.set(r.exercise_id, [r]);
  }
  const out: AchievedPr[] = [];
  for (const [exerciseId, list] of byEx) {
    list.sort((a, b) =>
      a.date !== b.date ? (a.date < b.date ? -1 : 1)
        : a.workout_created_at !== b.workout_created_at ? (a.workout_created_at < b.workout_created_at ? -1 : 1)
          : a.workout_id !== b.workout_id ? (a.workout_id < b.workout_id ? -1 : 1)
            : a.ordinal - b.ordinal);
    let best: number | null = null;
    for (const s of list) {
      const lift = eligibleLift({ load_kg: s.load_kg, reps: s.reps, warmup: s.warmup, rir: null, pain_note: null });
      if (!lift) continue;
      const v = e1rmScaled(lift.load_kg, lift.reps);
      if (best !== null && v > best) {
        out.push({ setId: s.id, workoutId: s.workout_id, exerciseId, date: s.date, load_kg: lift.load_kg, reps: lift.reps, e1rm: fromScaled(v), previousBest: fromScaled(best) });
      }
      if (best === null || v > best) best = v;
    }
  }
  return out;
}
