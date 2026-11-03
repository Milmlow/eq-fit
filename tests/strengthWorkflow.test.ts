import {describe,it,expect,vi} from 'vitest';
import {freshRepo} from './helpers';
import {Repo} from '../src/db/repo';
import {RecompDB} from '../src/db/db';
import {loadMode,nextSuggestion,strengthPoints} from '../src/lib/strengthProgress';
const input={load_kg:60,reps:8,rir:null,warmup:false,pain_note:null};
describe('repeat and strength progress',()=>{
 it('copies exercise order without sets, completion, pain, notes or activity links; original survives',async()=>{
  const repo=await freshRepo();
  const a=await repo.createExercise('Bench','Barbell',[]),b=await repo.createExercise('Row','Cable',[]);
  const prior=await repo.createWorkout({date:'2026-10-20',name:'Upper',kind:'weights',status:'done'});
  await repo.updateWorkout(prior.id,{planned_exercise_ids:[b.id,a.id],notes:'Private note'});
  const set=await repo.addSet(prior.id,a.id,{...input,pain_note:'Shoulder'});
  const copy=await repo.repeatWorkout(prior.id,'2026-11-03');
  expect(copy.planned_exercise_ids).toEqual([b.id,a.id]);
  expect(copy).toMatchObject({status:'planned',linked_activity_id:null,notes:'',name:'Upper'});
  expect(await repo.setsForWorkout(copy.id)).toEqual([]);
  expect(await repo.setsForWorkout(prior.id)).toEqual([set]);
  expect((await repo.priorComparable(copy,a.id))?.sets[0].pain_note).toBe('Shoulder');
 });
 it('rejects empty and non-weights repeats without leaving a workout',async()=>{
  const repo=await freshRepo();const w=await repo.createWorkout({date:'2026-10-20',name:'',kind:'weights'});
  await expect(repo.repeatWorkout(w.id,'2026-11-03')).rejects.toThrow();
  expect(await repo.workoutsBetween('2026-11-03','2026-11-03')).toHaveLength(0);
  const r=await repo.createWorkout({date:'2026-10-20',name:'',kind:'run'});
  await expect(repo.repeatWorkout(r.id,'2026-11-03')).rejects.toThrow();
 });
 it('suggestions match warm-up and working sets independently and write nothing',async()=>{
  const repo=await freshRepo(),ex=await repo.createExercise('Bench','Barbell',[]);
  const w=await repo.createWorkout({date:'2026-10-20',name:'',kind:'weights'});
  const warm=await repo.addSet(w.id,ex.id,{...input,load_kg:20,warmup:true});
  const first=await repo.addSet(w.id,ex.id,input),second=await repo.addSet(w.id,ex.id,{...input,reps:7});
  expect(nextSuggestion([warm,first,second],[])).toEqual({working:first,warmup:warm});
  expect(nextSuggestion([warm,first,second],[warm,first]).working).toEqual(second);
  expect(await repo.setsForWorkout(w.id)).toHaveLength(3);
 });
 it('recomputes charts after historic edits; excludes warmups, respects range and exercise identity',async()=>{
  const repo=await freshRepo(),ex=await repo.createExercise('Bench','Barbell',[]),other=await repo.createExercise('Bench','Machine',[]);
  const w=await repo.createWorkout({date:'2026-10-20',name:'',kind:'weights',status:'done'});
  await repo.addSet(w.id,ex.id,{...input,load_kg:200,warmup:true});
  const set=await repo.addSet(w.id,ex.id,input);
  await repo.addSet(w.id,other.id,{...input,load_kg:100});
  expect(strengthPoints(await repo.exerciseHistory(ex.id),'load','2026-11-03',false)[0].value).toBe(60);
  await repo.updateSet(set.id,{...input,load_kg:65});
  expect(strengthPoints(await repo.exerciseHistory(ex.id),'load','2026-11-03',false)[0].value).toBe(65);
  expect(strengthPoints(await repo.exerciseHistory(ex.id),'load','2027-03-01',false)).toEqual([]);
  expect(strengthPoints(await repo.exerciseHistory(ex.id),'load','2027-03-01',true)[0].value).toBe(65);
 });
 it('keeps missing load unknown and classifies bodyweight and assistance before estimates',async()=>{
  expect(loadMode({name:'Chin-ups',equipment:'Bodyweight'})).toBe('bodyweight');
  expect(loadMode({name:'Assisted pull-up',equipment:'Machine'})).toBe('assisted');
  expect(loadMode({name:'Squat',equipment:'Barbell'})).toBe('external');
  expect(loadMode({name:'Press',equipment:''})).toBe('unknown');
  const repo=await freshRepo(),ex=await repo.createExercise('Chin-ups','Bodyweight',[]),w=await repo.createWorkout({date:'2026-10-20',name:'',kind:'weights'});
  await repo.addSet(w.id,ex.id,{...input,load_kg:null,reps:10});
  const sessions=await repo.exerciseHistory(ex.id);
  expect(strengthPoints(sessions,'load','2026-11-03',false)[0].value).toBeNull();
  expect(strengthPoints(sessions,'reps','2026-11-03',false)[0].value).toBe(10);
 });
 it('logs and reloads without network access, and exports the same saved sets',async()=>{
  const offline=vi.fn(()=>Promise.reject(new Error('offline')));vi.stubGlobal('fetch',offline);
  try {
   const repo=await freshRepo(),name=repo.db.name;
   const ex=await repo.createExercise('Bench','Barbell',[]),w=await repo.createWorkout({date:'2026-11-03',name:'Offline',kind:'weights'});
   await repo.addSet(w.id,ex.id,input);
   await repo.updateWorkout(w.id,{status:'done'});repo.db.close();
   const reopened=await Repo.open(new RecompDB(name));
   expect(await reopened.setsForWorkout(w.id)).toHaveLength(1);
   const before=await reopened.exportBackup();
   expect(before.tables.sets).toHaveLength(1);
   const copy=await reopened.repeatWorkout(w.id,'2026-11-04');
   expect(await reopened.setsForWorkout(copy.id)).toEqual([]);
   expect((await reopened.exportBackup()).tables.sets).toEqual(before.tables.sets);
   expect(offline).not.toHaveBeenCalled();reopened.db.close();
  } finally {vi.unstubAllGlobals();}
 });

 it('keeps set ordinals unique after a middle set is removed',async()=>{
  const repo=await freshRepo(),ex=await repo.createExercise('Bench','Barbell',[]),w=await repo.createWorkout({date:'2026-11-03',name:'',kind:'weights'});
  await repo.addSet(w.id,ex.id,input);const middle=await repo.addSet(w.id,ex.id,input);await repo.addSet(w.id,ex.id,input);
  await repo.removeSet(middle.id);await repo.addSet(w.id,ex.id,input);
  expect((await repo.setsForWorkout(w.id)).map(s=>s.ordinal)).toEqual([1,3,4]);
 });

});
