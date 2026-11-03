import {describe,it,expect,vi,afterEach} from 'vitest';
import type {Session} from '../src/lib/activityPulse';
import type {Exercise,SetRecord} from '../src/db/types';
import {coachFacts} from '../src/lib/coachFacts';
import {choose,freshCoach,contextFor,JOKES,observeCoach,readCoach,saveCoach} from '../src/lib/coach';
const ex={id:'bench',name:'Bench press',equipment:'barbell'} as Exercise;
const set=(reps:number,extra:Partial<SetRecord>={}):SetRecord=>({id:'s',exercise_id:'bench',workout_id:'w',ordinal:1,load_kg:60,reps,warmup:false,pain_note:null,...extra} as SetRecord);
const session=(date:string,reps=9):Session=>({id:date,date,order:date,title:'Lift',kind:'weights',sets:[set(reps)],workout:{id:date,status:'done',kind:'weights',date}} as Session);
const current=session('2026-11-03'),prior=session('2026-10-30',8);
describe('verified coach context',()=>{
 it('compares the best reps at identical load in the preceding completed session',()=>{
  expect(coachFacts(current,[prior],[ex])['more-reps']).toContain('best 8 reps');
  expect(coachFacts(current,[{...prior,sets:[set(8),set(10)]}],[ex])['more-reps']).toBeUndefined();
 });
 it('does not treat targets, warmups, pain notes, assisted or unknown equipment as improvement evidence',()=>{
  const variants=[{...current,workout:{...current.workout!,status:'planned' as const}},{...current,sets:[set(9,{warmup:true})]},{...current,sets:[set(9,{pain_note:'sore'})]},{...current,sets:[set(9,{load_kg:65})]}];
  for(const s of variants)expect(coachFacts(s,[prior],[ex])['more-reps']).toBeUndefined();
  for(const equipment of ['assisted machine','unknown'])expect(coachFacts(current,[prior],[{...ex,equipment}])['more-reps']).toBeUndefined();
 });
 it('uses only the most recent previous session and same exercise identity',()=>{
  expect(coachFacts(current,[prior,session('2026-11-02',10)],[ex])['more-reps']).toBeUndefined();
  expect(coachFacts(current,[{...prior,sets:[set(8,{exercise_id:'other'})]}],[ex])['more-reps']).toBeUndefined();
 });
 it('requires an actual source clock, never workout creation or a fabricated midnight',()=>{
  expect(coachFacts(current,[],[ex]).early).toBeUndefined();
  const activity={id:'a',date:current.date,timestamp_local:'2026-11-03 04:52:00',raw_fields:{Date:'2026-11-03 04:52:00'}} as unknown as NonNullable<Session['activity']>;
  expect(coachFacts({...current,activity},[],[]).early).toContain('04:52');
  expect(coachFacts({...current,activity:{...activity,raw_fields:{Date:'2026-11-03'}}},[],[]).early).toBeUndefined();
  expect(coachFacts({...current,activity:{...activity,timestamp_local:'2026-11-03 14:52:00'}},[],[]).early).toBeUndefined();
 });
 it('requires two distinct recorded days in each of three weeks, without counting future entries',()=>{
  const history=['2026-11-02','2026-10-26','2026-10-27','2026-10-19','2026-10-20'].map(d=>session(d));
  expect(coachFacts(current,history,[]).steady).toBeDefined();
  expect(coachFacts(current,history.filter(s=>s.date!=='2026-10-20'),[]).steady).toBeUndefined();
  expect(coachFacts(current,history.filter(s=>s.date!=='2026-11-02').concat(session('2026-11-04')),[]).steady).toBeUndefined();
 });
 it('prefers evidence-backed humour and removes it after a historical correction without another celebration',()=>{
  const ctx=contextFor(current,current.date,[prior],[ex]);
  const first=choose({...freshCoach(),tone:'cheeky'},ctx,1000);
  expect(first.joke?.id).toBe('rep-trophy-zoom');
  const corrected=contextFor(current,current.date,[session('2026-10-30',10)],[ex]);
  expect(choose(first.state,corrected,2000).joke).toBeUndefined();
 });
 it('preserves legacy IDs explicitly and keeps new facts ineligible without evidence',()=>{
  expect(JOKES.find(j=>j.id==='eq-037')?.text).toContain('invoice');
  const ctx=contextFor(current,current.date);
  for(let i=0,s={...freshCoach(),tone:'filthy' as const};i<30;i++){
   const result=choose(s,ctx,1000,true);s=result.state as typeof s;
   expect(result.joke?.id??'').not.toMatch(/rep-trophy|early-|steady-/);
  }
 });
});
describe('consented local measurement',()=>{
 const ctx={event:'visit' as const,key:'visit:today',aliases:[]};
 it('collects nothing without consent',()=>{const s=freshCoach();expect(observeCoach(s,ctx,'eq-001','2026-11-03')).toBe(s);});
 it('counts a visible card once per event and day, and remembers distinct view days',()=>{
  const s=observeCoach({...freshCoach(),consent:true},ctx,'eq-001','2026-11-03');
  expect(observeCoach(s,ctx,'eq-001','2026-11-03')).toBe(s);
  const next=observeCoach(s,ctx,'eq-002','2026-11-03');
  expect(next.trial?.shown).toHaveLength(2);expect(next.trial?.days).toHaveLength(1);
 });
});


describe('local preference migration',()=>{
 afterEach(()=>vi.unstubAllGlobals());
 it('does not expand old vote-only consent',()=>{
  vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify({...freshCoach(),tone:'cheeky',consent:true,feedback:[{id:'eq-037',vote:'landed',day:'2026-11-03'}]})});
  const state=readCoach('owner');expect(state.consent).toBe(false);expect(state.feedback).toHaveLength(1);expect(state.tone).toBe('cheeky');
 });
 it('retains explicit new consent and keeps trial scopes separate',()=>{
  const rows=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>rows.get(key)??null,setItem:(key:string,value:string)=>rows.set(key,value)});
  saveCoach('owner',{...freshCoach(),consent:true,trial:{days:[],shown:[],muted:0}});
  expect(readCoach('owner').consent).toBe(true);expect(readCoach('friend').consent).toBe(false);
 });
});
