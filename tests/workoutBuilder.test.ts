import { afterEach, describe, expect, it } from 'vitest';
import type { Repo } from '../src/db/repo';
import { freshRepo } from './helpers';
import { workoutExerciseChoices, saveWorkoutSelection } from '../src/lib/workoutBuilder';
const repos: Repo[] = [];
async function setup() { const repo = await freshRepo(); repos.push(repo); return repo; }
afterEach(async () => { for (const repo of repos.splice(0)) await repo.db.delete(); });

describe('checkbox workout builder', () => {
  it('shows the full catalogue on a new profile, deduplicates exact existing movements and preserves their identity', async () => {
    const repo = await setup();
    const ex = await repo.createExercise('Bench press', 'Barbell', ['custom muscle']);
    const choices = workoutExerciseChoices(await repo.listExercises());
    expect(choices.filter(x => x.key === ex.exercise_key)).toHaveLength(1);
    expect(choices.find(x => x.key === ex.exercise_key)).toMatchObject({ id: ex.id, muscles: ['custom muscle'] });
    expect(workoutExerciseChoices([]).some(x => x.name === 'Bench press' && x.equipment === 'Dumbbell')).toBe(true);
  });
  it('saves ordered selections without creating a session or logging any sets', async () => {
    const repo = await setup();
    const choices = workoutExerciseChoices([]).filter(x => x.name === 'Bench press');
    const { routine, workout } = await saveWorkoutSelection(repo, 'Workout 1', choices.slice().reverse());
    expect(workout).toBeUndefined();
    const saved = await Promise.all(routine.exercise_ids.map(id => repo.getExercise(id)));
    expect(saved.map(x => x?.equipment)).toEqual(choices.slice().reverse().map(x => x.equipment));
    expect(await repo.db.workouts.count()).toBe(0);
    expect(await repo.db.sets.count()).toBe(0);
  });
  it('save and start uses exact equipment and creates an empty planned session', async () => {
    const repo = await setup();
    const choices = workoutExerciseChoices([]).filter(x => x.name === 'Bench press');
    const { routine, workout } = await saveWorkoutSelection(repo, 'Push', choices, undefined, '2026-11-04');
    expect(workout).toMatchObject({ status: 'planned', planned_exercise_ids: routine.exercise_ids });
    expect(await repo.setsForWorkout(workout!.id)).toEqual([]);
    expect(new Set(routine.exercise_ids).size).toBe(2);
  });
  it('rolls back newly resolved exercises if saving or starting fails', async () => {
    const repo = await setup(); const choices = workoutExerciseChoices([]).slice(0, 2);
    await expect(saveWorkoutSelection(repo, '', choices)).rejects.toThrow();
    await expect(saveWorkoutSelection(repo, 'Push', choices, undefined, 'bad-date')).rejects.toThrow();
    expect(await repo.db.exercises.count()).toBe(0);
    expect(await repo.db.routines.count()).toBe(0);
    expect(await repo.db.workouts.count()).toBe(0);
  });
  it('editing the selection preserves already-started sessions and rejects duplicate choices', async () => {
    const repo = await setup(); const choices = workoutExerciseChoices([]).slice(0, 2);
    const original = await saveWorkoutSelection(repo, 'Push', choices, undefined, '2026-11-04');
    await saveWorkoutSelection(repo, 'Changed', [choices[1]], original.routine.id);
    expect((await repo.getWorkout(original.workout!.id))?.planned_exercise_ids).toEqual(original.routine.exercise_ids);
    await expect(saveWorkoutSelection(repo, 'Duplicate', [choices[0], choices[0]])).rejects.toThrow();
    expect(await repo.db.routines.count()).toBe(1);
  });
});
