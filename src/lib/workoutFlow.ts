import type { SetRecord, Workout } from '../db/types';
import { workoutOrderKey } from './training';

export function repeatExerciseIds(planned: string[], sets: SetRecord[]): string[] {
  const recorded = [...sets].sort((a, b) => a.ordinal - b.ordinal);
  return [...new Set([...planned, ...recorded.map(s => s.exercise_id)])];
}

/** Only actual records drive resume/repeat choices. Future plans stay in the calendar. */
export function workoutChoices(workouts: Workout[], sets: SetRecord[], today: string) {
  const counts = new Map<string, number>();
  const setsByWorkout = new Map<string, SetRecord[]>();
  for (const set of sets) {
    const group = setsByWorkout.get(set.workout_id);
    if (group) group.push(set);
    else setsByWorkout.set(set.workout_id, [set]);
  }
  for (const [id, group] of setsByWorkout) counts.set(id, group.length);
  const eligible = workouts.filter(w => w.kind === 'weights' && w.date <= today)
    .sort((a, b) => workoutOrderKey(b).localeCompare(workoutOrderKey(a)));
  const completed = eligible.filter(w => w.status === 'done' && counts.has(w.id));
  const repeatPlans = new Map(completed.map(w => [
    w.id, repeatExerciseIds(w.planned_exercise_ids, setsByWorkout.get(w.id) ?? []),
  ]));
  const latestPlan = completed[0] ? repeatPlans.get(completed[0].id)! : [];
  const alternate = completed.slice(1).find(w => {
    const plan = repeatPlans.get(w.id)!;
    return plan.length !== latestPlan.length || plan.some((id, index) => latestPlan[index] !== id);
  });
  return {
    pending: eligible.filter(w => w.status === 'planned' && (w.planned_exercise_ids.length > 0 || counts.has(w.id))),
    recent: completed.slice(0, 5),
    alternate,
    repeatPlans,
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
