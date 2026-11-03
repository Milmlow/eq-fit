import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { EXERCISE_CATALOG, nextWorkoutName } from '../src/lib/exerciseCatalog';
import { exerciseKey } from '../src/lib/training';
import { MovementArt } from '../src/ui/MovementArt';
import { freshRepo } from './helpers';

describe('picture exercise picker', () => {
  it('has unique exercise/equipment identities and a distinct illustration for every movement', () => {
    const keys = EXERCISE_CATALOG.flatMap(m => m.equipment.map(e => exerciseKey(m.name,e)));
    expect(new Set(keys).size).toBe(keys.length);
    const drawings = EXERCISE_CATALOG.map(m => renderToStaticMarkup(createElement(MovementArt,{name:m.name})));
    expect(new Set(drawings).size).toBe(EXERCISE_CATALOG.length);
    expect(EXERCISE_CATALOG.every(m=>m.muscles.length && m.equipment.length)).toBe(true);
  });
  it('uses a generic image for unrecognised custom exercises, never a misleading deadlift', () => {
    const draw=(name:string)=>renderToStaticMarkup(createElement(MovementArt,{name}));
    expect(draw('My custom lift')).not.toBe(draw('Deadlift'));
    expect(draw('Cable row')).toBe(draw('Row'));
  });
  it('supplies an unused workout name without requiring keyboard entry', () => {
    expect(nextWorkoutName([])).toBe('Workout 1');
    expect(nextWorkoutName([' WORKOUT 1 ', 'Workout 3'])).toBe('Workout 2');
  });
  it('reuses exact existing identities without overwriting user metadata; equipment stays separate', async () => {
    const repo=await freshRepo();
    try {
      const user=await repo.createExercise('Bench press','Barbell',['my chest group']);
      const m=EXERCISE_CATALOG[0];
      const same=await repo.createExercise(m.name,m.equipment[0],m.muscles);
      const other=await repo.createExercise(m.name,m.equipment[1],m.muscles);
      expect(same.id).toBe(user.id); expect(same.primary_muscles).toEqual(['my chest group']);
      expect(other.id).not.toBe(user.id);
      const routine=await repo.saveRoutine(nextWorkoutName([]),[same.id,other.id]);
      const workout=await repo.startRoutine(routine.id,'2026-11-03');
      expect(await repo.setsForWorkout(workout.id)).toEqual([]);
    } finally {await repo.db.delete();}
  });
});
