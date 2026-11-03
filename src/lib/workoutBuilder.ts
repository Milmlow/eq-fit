import type { Repo } from '../db/repo';
import type { Exercise } from '../db/types';
import { EXERCISE_CATALOG } from './exerciseCatalog';
import { exerciseKey } from './training';

export interface ExerciseChoice { key: string; id?: string; name: string; equipment: string; muscles: string[] }
export function workoutExerciseChoices(existing: Exercise[]): ExerciseChoice[] {
  const choices = new Map<string, ExerciseChoice>();
  for (const ex of existing) choices.set(ex.exercise_key, { key: ex.exercise_key, id: ex.id, name: ex.name, equipment: ex.equipment, muscles: ex.primary_muscles });
  for (const movement of EXERCISE_CATALOG) for (const equipment of movement.equipment) {
    const key = exerciseKey(movement.name, equipment);
    if (!choices.has(key)) choices.set(key, { key, name: movement.name, equipment, muscles: movement.muscles });
  }
  return [...choices.values()].sort((a, b) => a.name.localeCompare(b.name) || a.equipment.localeCompare(b.equipment));
}

/** Selection is a draft. Resolve exercises, save the list and optionally start it atomically. */
export async function saveWorkoutSelection(repo: Repo, name: string, selected: ExerciseChoice[], routineId?: string, startDate?: string) {
  if (!selected.length) throw new Error('Choose at least one exercise.');
  if (new Set(selected.map(x => x.key)).size !== selected.length) throw new Error('Choose each exercise only once.');
  return repo.db.transaction('rw', repo.db.exercises, repo.db.routines, repo.db.workouts, async () => {
    const ids: string[] = [];
    for (const choice of selected) {
      const ex = choice.id ? await repo.getExercise(choice.id) : await repo.createExercise(choice.name, choice.equipment, choice.muscles);
      if (!ex) throw new Error('An exercise is missing. Reopen this workout and choose again.');
      ids.push(ex.id);
    }
    const routine = await repo.saveRoutine(name, ids, routineId);
    const workout = startDate ? await repo.startRoutine(routine.id, startDate) : undefined;
    return { routine, workout };
  });
}
