import type { SetRecord, Workout } from '../db/types';
import { workoutOrderKey } from './training';

/** Only actual records drive resume/repeat choices. Future plans stay in the calendar. */
export function workoutChoices(workouts: Workout[], sets: SetRecord[], today: string) {
  const counts = new Map<string, number>();
  for (const set of sets) counts.set(set.workout_id, (counts.get(set.workout_id) ?? 0) + 1);
  const eligible = workouts.filter(w => w.kind === 'weights' && w.date <= today)
    .sort((a, b) => workoutOrderKey(b).localeCompare(workoutOrderKey(a)));
  return {
    pending: eligible.filter(w => w.status === 'planned' && (w.planned_exercise_ids.length > 0 || counts.has(w.id))),
    recent: eligible.filter(w => w.status === 'done' && counts.has(w.id)).slice(0, 5),
    counts,
  };
}

/** Follow the next recorded set, then the current session. Warm-ups never seed working sets. */
export function entryDefaults(prior: SetRecord[], logged: SetRecord[], warmup = false) {
  const before = prior.filter(s => s.warmup === warmup);
  const now = logged.filter(s => s.warmup === warmup);
  const source = before[now.length] ?? now.at(-1) ?? before.at(-1);
  return { load: source?.load_kg?.toString() ?? '', reps: source ? source.reps?.toString() ?? '' : '8' };
}

export function resumeExercise(ids: string[], sets: SetRecord[]): number {
  const last = [...sets].sort((a, b) => b.ordinal - a.ordinal)[0];
  return Math.max(0, ids.indexOf(last?.exercise_id ?? ''));
}
