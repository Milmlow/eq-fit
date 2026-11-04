import {describe,it,expect,vi,afterEach} from 'vitest';
import {liftRecord,readFour,saveFour,defaultFour} from '../src/lib/myFour';
import {exerciseKey} from '../src/lib/training';
import type {Exercise,SetRecord,Workout} from '../src/db/types';
import type {Session} from '../src/lib/activityPulse';
const pick={name:'Bench press',equipment:'Dumbbell',muscles:[]};
const ex=(id:string,name=pick.name,equipment=pick.equipment)=>({id,name,equipment,exercise_key:exerciseKey(name,equipment),primary_muscles:[],owner_id:null,created_at:'2026-11-05T00:00:00Z'} as Exercise);
const set=(id:string,load:number|null,reps:number,warmup=false)=>({exercise_id:id,load_kg:load,reps,warmup} as SetRecord);
const session=(id:string,sets:SetRecord[],done=true)=>({id,date:id,order:id,sets,workout:{status:done?'done':'planned'} as Workout} as Session);
afterEach(()=>vi.unstubAllGlobals());
describe('My Four records',()=>{
 it('keeps equipment separate, ignores warmups/plans and reports latest versus best',()=>{
  const r=liftRecord(pick,[session('2026-11-01',[set('d',30,8),set('b',100,10)]),session('2026-11-02',[set('d',25,10),set('d',40,1,true)]),session('2026-11-03',[set('d',50,1)],false)],[ex('d'),ex('b',pick.name,'Barbell')]);
  expect(r.best?.set.load_kg).toBe(30);expect(r.last?.set.load_kg).toBe(25);
 });
 it('uses least assistance and excludes added weight from bodyweight reps',()=>{
  const p={name:'Chin-ups',equipment:'Assisted machine',muscles:[]};
  expect(liftRecord(p,[session('today',[set('a',30,10),set('a',20,8)])],[ex('a',p.name,p.equipment)]).best?.set.load_kg).toBe(20);
  const b={...p,equipment:'Bodyweight'};
  expect(liftRecord(b,[session('today',[set('b',0,10),set('b',20,20)])],[ex('b',b.name,b.equipment)]).best?.set.reps).toBe(10);
 });
 it('preserves familiar default aliases and isolates profile choices',()=>{
  const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>values.set(k,v)});
  expect(defaultFour([ex('b','Bench','Barbell')])[1].name).toBe('Bench');
  saveFour('emma',[pick]);expect(readFour('emma',[])).toEqual([pick]);expect(readFour('royce',[])).toHaveLength(4);
  values.set('eqfit.my-four:emma','garbage');expect(readFour('emma',[])).toHaveLength(4);
 });
});
