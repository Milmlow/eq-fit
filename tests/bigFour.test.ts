import { describe, expect, it } from 'vitest';
import { bigFour } from '../src/lib/bigFour';
import { activityPulse, type Session } from '../src/lib/activityPulse';
import type { Exercise, SetRecord, Workout } from '../src/db/types';
const ex = (id:string,name:string,equipment:string) => ({id,name,equipment} as Exercise);
const set = (exercise_id:string,load_kg:number|null,reps:number|null,warmup=false) => ({exercise_id,load_kg,reps,warmup} as SetRecord);
const session = (sets:SetRecord[],date='2026-11-04') => ({sets,date,kind:'weights',id:date} as Session);
describe('Big Four actual records', () => {
 it('selects heaviest barbell set, then reps on ties, excluding warm-ups and other equipment', () => {
  const exercises=[ex('b','Bench press','Barbell'),ex('d','Bench press','Dumbbell'),ex('i','Incline bench press','Barbell')];
  const rows=[set('b',100,3),set('b',100,5),set('b',90,12),set('b',120,1,true),set('d',150,8),set('i',150,8),set('b',200,0)];
  const best=bigFour([session(rows)],exercises)[1].best;
  expect(best?.set).toEqual(rows[1]);
 });
 it('uses unassisted bodyweight chin-up reps without mixing weighted or assisted records', () => {
  const exercises=[ex('c','Chin-ups','Bodyweight'),ex('a','Chin-ups','Assisted machine'),ex('p','Pull-ups','Bodyweight')];
  const rows=[set('c',null,8),set('c',0,10),set('c',20,15),set('a',30,20),set('p',0,30)];
  expect(bigFour([session(rows)],exercises)[0].best?.set).toEqual(rows[1]);
 });
 it('returns empty records honestly and recalculates after a record is removed', () => {
  expect(bigFour([],[]).map(x=>x.best)).toEqual([null,null,null,null]);
  const exercises=[ex('s','Back squat','Barbell'),ex('d','Deadlift','Barbell')];
  expect(bigFour([session([set('s',80,8),set('d',null,10)])],exercises).map(x=>x.best?.set.load_kg??null)).toEqual([null,null,80,null]);
 });
 it('uses completed history through today, excluding unfinished and future workouts', () => {
  const exercises=[ex('b','Bench press','Barbell')];
  const workouts=['done','planned','future'].map((id)=>({id,date:id==='future'?'2026-11-05':'2026-11-04',kind:'weights',status:id==='planned'?'planned':'done',created_at:'2026-11-04T08:00:00Z'} as Workout));
  const sets=workouts.map((w,i)=>({...set('b',60+i*20,8),workout_id:w.id}));
  const pulse=activityPulse([],workouts,sets,exercises,'2026-11-04');
  expect(bigFour(pulse.sessions,exercises)[1].best?.set.load_kg).toBe(60);
 });
});
