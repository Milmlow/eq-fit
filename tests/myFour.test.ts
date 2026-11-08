import {describe,it,expect,vi,afterEach} from 'vitest';
import {liftRecord,readFour,saveFour,defaultFour,crackTile,beatsBest} from '../src/lib/myFour';
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
describe('Max day tile',()=>{
 const r=(load:number|null,reps:number)=>({set:set('x',load,reps),session:session('2026-11-01',[])});
 it('shows last effort, always says have a crack, and flags due check-ins',()=>{
  const last=r(100,5),best=r(110,3);
  const t=crackTile('external',last,best,30,21);
  expect(t.headline).toBe('100 kg × 5');expect(t.best).toBe('Best: 110 kg × 3');expect(t.cta).toBe('Have a crack');expect(t.hint).toBe('Check-in due');
  expect(crackTile('external',last,last,10,21).best).toBe('');expect(crackTile('external',last,last,10,21).hint).toBe('Next check-in in 11 days');
 });
 it('hides a duplicate Best by value and ignores a malformed date',()=>{
  expect(crackTile('external',r(100,5),r(100,5),10,21).best).toBe('');
  expect(crackTile('external',r(100,5),r(100,5),NaN,21).hint).toBe('');
 });
 it('never invents numbers when there is no history; bodyweight shows reps',()=>{
  const t=crackTile('external',null,null,null,21);
  expect(t.headline).toBe('Set a baseline');expect(t.hint).toBe('');expect(t.label).toBe('');expect(t.cta).toBe('Have a crack');
  expect(crackTile('bodyweight',r(null,9),null,3,21).headline).toBe('9 reps');
 });
});
describe('PR flag',()=>{
 const s=(load:number|null,reps:number)=>({load_kg:load,reps});
 it('flags a heavier weight, or the same weight for more reps, as a PR',()=>{
  expect(beatsBest('external',s(100,5),s(102.5,1))).toBe('pr');
  expect(beatsBest('external',s(100,5),s(100,6))).toBe('pr');
  expect(beatsBest('external',s(100,5),s(100,5))).toBeNull();
  expect(beatsBest('external',s(100,5),s(97.5,12))).toBeNull();
 });
 it('treats the first ever effort as a baseline, not a PR',()=>{
  expect(beatsBest('external',null,s(60,5))).toBe('first');
  expect(beatsBest('bodyweight',null,s(null,8))).toBe('first');
 });
 it('scores bodyweight by unweighted reps and assisted by least assistance',()=>{
  expect(beatsBest('bodyweight',s(null,8),s(null,9))).toBe('pr');
  expect(beatsBest('bodyweight',s(null,8),s(10,20))).toBeNull();
  expect(beatsBest('assisted',s(30,8),s(25,5))).toBe('pr');
  expect(beatsBest('assisted',s(30,8),s(35,12))).toBeNull();
 });
 it('ignores invalid sets',()=>{
  expect(beatsBest('external',s(100,5),s(null,5))).toBeNull();
  expect(beatsBest('external',s(100,5),s(110,0))).toBeNull();
  expect(beatsBest('external',s(100,5),s(110,2.5))).toBeNull();
 });
});
