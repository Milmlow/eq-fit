import {describe,it,expect,vi} from 'vitest';
import {freshRepo} from './helpers';
const movement={name:'Bench press',equipment:'Barbell',muscles:['chest']};
const input={load_kg:60,reps:8,rir:null,warmup:false,pain_note:null};
describe('quick lift logging',()=>{
 it('saves precisely the confirmed sets into one open session and preserves exercise order',async()=>{
  const repo=await freshRepo();
  const first=await repo.quickLogLift('2026-11-03',movement,null,input,3);
  expect((await repo.setsForWorkout(first.workout.id)).map(s=>[s.load_kg,s.reps,s.warmup])).toEqual([[60,8,false],[60,8,false],[60,8,false]]);
  expect((await repo.getWorkout(first.workout.id))?.status).toBe('planned');
  const second=await repo.quickLogLift('2026-11-03',{name:'Squat',equipment:'Barbell',muscles:['legs']},null,{...input,load_kg:80},2);
  expect(second.workout.id).toBe(first.workout.id);
  expect((await repo.getWorkout(first.workout.id))?.planned_exercise_ids).toEqual([first.exercise.id,second.exercise.id]);
  expect(await repo.setsForWorkout(first.workout.id)).toHaveLength(5);
 });
 it('rejects invalid counts or reps without creating any records',async()=>{
  const repo=await freshRepo();
  for(const count of [0,1.5,21])await expect(repo.quickLogLift('2026-11-03',movement,null,input,count)).rejects.toThrow();
  await expect(repo.quickLogLift('2026-11-03',movement,null,{...input,reps:0},3)).rejects.toThrow();
  expect(await repo.listExercises()).toHaveLength(0);expect(await repo.workoutsBetween('2026-11-03','2026-11-03')).toHaveLength(0);
 });
 it('rolls back the entire batch if any set fails, including a newly-created workout/exercise',async()=>{
  const repo=await freshRepo(),original=repo.addSet.bind(repo);
  vi.spyOn(repo,'addSet').mockImplementationOnce(original).mockRejectedValueOnce(new Error('Write failed'));
  await expect(repo.quickLogLift('2026-11-03',movement,null,input,3)).rejects.toThrow('Write failed');
  expect(await repo.listExercises()).toHaveLength(0);expect(await repo.db.sets.count()).toBe(0);expect(await repo.db.workouts.count()).toBe(0);
 });
 it('supports bodyweight-only reps and separately marked warmup sets without merging equipment',async()=>{
  const repo=await freshRepo(),custom=await repo.createExercise('Bench press','Dumbbell',[]);
  const a=await repo.quickLogLift('2026-11-03',movement,custom.id,{...input,warmup:true},2);
  expect(a.exercise.equipment).toBe('Dumbbell');expect((await repo.setsForWorkout(a.workout.id)).every(s=>s.warmup)).toBe(true);
  const b=await repo.quickLogLift('2026-11-03',{name:'Chin-ups',equipment:'Bodyweight',muscles:['back']},null,{...input,load_kg:null},3);
  expect((await repo.setsForWorkout(b.workout.id)).filter(s=>s.exercise_id===b.exercise.id).every(s=>s.load_kg===null)).toBe(true);
 });
});
