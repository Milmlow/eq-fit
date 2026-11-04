import {describe,it,expect,vi,afterEach} from 'vitest';
import {trainingDashboard,readFocus,saveFocus} from '../src/lib/dashboardFocus';
import type {Activity,Workout,SetRecord} from '../src/db/types';
const activity=(id:string,type:string,date='2026-11-04',duration:number|null=1800)=>({id,original_type:type,date,timestamp_local:date+' 08:00:00',title:type,duration_seconds:duration} as Activity);
const workout=(id:string,linked:string|null,status='done',date='2026-11-04')=>({id,linked_activity_id:linked,status,date,kind:'weights',name:'Lift',created_at:date+'T08:00:00Z'} as Workout);
afterEach(()=>vi.unstubAllGlobals());
describe('personal dashboard focus',()=>{
 it('separates cardio from strength and counts linked sessions once',()=>{
  const d=trainingDashboard([activity('s','Strength Training'),activity('c','Cardio'),activity('r','Running')],[workout('w','s')],[], '2026-11-04','strength-cardio');
  expect(d.entries).toHaveLength(3);expect(d.strength).toBe(1);expect(d.cardio).toBe(2);expect(d.minutes).toBe(90);expect(d.days).toBe(1);
 });
 it('excludes uncompleted plans, future dates and older days from weekly totals',()=>{
  const d=trainingDashboard([activity('old','Cycling','2026-11-01'),activity('future','Cardio','2026-11-05')],[workout('plan',null,'planned'),workout('done',null)],[], '2026-11-04','all');
  expect(d.entries).toHaveLength(2);expect(d.week).toHaveLength(1);expect(d.minutes).toBeNull();expect(d.missingDuration).toBe(1);
 });
 it('keeps missing time unknown and warmups out of logged working sets',()=>{
  const sets=[{workout_id:'w',warmup:true},{workout_id:'w',warmup:false}] as SetRecord[];
  const d=trainingDashboard([activity('s','Strength Training','2026-11-04',null)],[workout('w','s')],sets,'2026-11-04','strength-cardio');
  expect(d.minutes).toBeNull();expect(d.workingSets).toBe(1);
 });
 it('includes other activity only in all training',()=>{
  expect(trainingDashboard([activity('y','Yoga')],[],[],'2026-11-04','strength-cardio').entries).toHaveLength(0);
  expect(trainingDashboard([activity('y','Yoga')],[],[],'2026-11-04','all').entries).toHaveLength(1);
 });
 it('persists focus separately per profile and survives unavailable storage',()=>{
  const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k),setItem:(k:string,v:string)=>values.set(k,v)});
  expect(saveFocus('emma','strength-cardio')).toBe(true);expect(readFocus('emma')).toBe('strength-cardio');expect(readFocus('royce')).toBe('free');
  expect(readFocus('new','?focus=all')).toBe('all');expect(readFocus('emma','?focus=running')).toBe('strength-cardio');
  vi.stubGlobal('localStorage',{getItem:()=>{throw Error();},setItem:()=>{throw Error();}});
  expect(readFocus('emma')).toBe('free');expect(saveFocus('emma','all')).toBe(false);
 });
});
