import type { Exercise, SetRecord } from '../db/types';
import type { Session } from './activityPulse';

const lifts = [
  { name: 'Chin-ups', pattern: /^(chin ups?|chinups?)$/, bodyweight: true },
  { name: 'Bench', pattern: /^(bench|bench press|barbell bench press)$/, bodyweight: false },
  { name: 'Squat', pattern: /^(squat|back squat|barbell squat|barbell back squat)$/, bodyweight: false },
  { name: 'Deadlift', pattern: /^(deadlift|deadlifts|barbell deadlift|conventional deadlift)$/, bodyweight: false },
];

/** Actual completed working sets only. Keep barbell and unassisted bodyweight records distinct. */
export function bigFour(sessions: Session[], exercises: Exercise[]) {
  return lifts.map(lift => {
    const ids = new Set(exercises.filter(ex => {
      const name = ex.name.toLowerCase().replace(/[-_]/g, ' ').replace(/\s+/g, ' ').trim();
      const equipment = ex.equipment.trim().toLowerCase();
      return lift.pattern.test(name) && (lift.bodyweight ? /^(bodyweight|body weight|)$/.test(equipment) : equipment === 'barbell');
    }).map(ex => ex.id));
    let best: { set: SetRecord; session: Session } | null = null;
    for (const session of sessions) for (const set of session.sets) {
      if (!ids.has(set.exercise_id) || set.warmup || !Number.isFinite(set.reps) || set.reps! < 1) continue;
      if (lift.bodyweight ? (set.load_kg !== null && set.load_kg !== 0) : (!Number.isFinite(set.load_kg) || set.load_kg! <= 0)) continue;
      const score = lift.bodyweight ? set.reps! : set.load_kg!;
      const previous = best ? (lift.bodyweight ? best.set.reps! : best.set.load_kg!) : -1;
      if (!best || score > previous || (score === previous && (set.reps! > best.set.reps! || (set.reps === best.set.reps && session.date > best.session.date)))) best = { set, session };
    }
    return { name: lift.name, bodyweight: lift.bodyweight, best };
  });
}
