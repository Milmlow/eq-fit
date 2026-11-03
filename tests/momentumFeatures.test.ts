import {describe,it,expect} from 'vitest';
import {freshRepo,csvOf,row} from './helpers';
import {daySummary} from '../src/lib/trainingWeek';
import {milestones} from '../src/lib/milestones';
import {buildPreview,commitPreview} from '../src/lib/importer';
import {loadHero} from '../src/lib/hero';
const input={load_kg:60,reps:8,rir:null,warmup:false,pain_note:null};
describe('week overview and achieved milestones',()=>{
 it('counts linked runs once and distinguishes planned weights from completed work',async()=>{
  const repo=await freshRepo();
  await commitPreview(await buildPreview(csvOf([row({'Activity Type':'Running',Date:'2026-11-03 05:00:00',Title:'Run',Distance:'5',Time:'00:30:00','Avg Pace':'6:00'})]),repo),repo);
  const acts=await repo.activitiesBetween('2026-11-03','2026-11-03');
  const w=await repo.createWorkout({date:'2026-11-03',name:'',kind:'run'});await repo.linkActivity(w.id,acts[0].id);
  await repo.createWorkout({date:'2026-11-03',name:'',kind:'weights'});
  const summary=daySummary('2026-11-03',await repo.workoutsBetween('2026-11-03','2026-11-03'),acts,await repo.linkedActivityIds());
  expect(summary).toEqual({lifts:0,runs:1,planned:1,km:5});
  expect(daySummary('2026-11-04',[],[],new Set())).toEqual({lifts:0,runs:0,planned:0,km:null});
 });
 it('celebrates only an achieved heavier working set in a completed session, recomputes after corrections',async()=>{
  const repo=await freshRepo(),ex=await repo.createExercise('Bench','Barbell',[]);
  const first=await repo.createWorkout({date:'2026-10-20',name:'',kind:'weights',status:'done'});
  await repo.addSet(first.id,ex.id,input);
  const next=await repo.createWorkout({date:'2026-11-03',name:'',kind:'weights'});
  const set=await repo.addSet(next.id,ex.id,{...input,load_kg:65});
  expect(milestones(await repo.allSetsWithContext(),[],'2026-11-03')).toEqual([]);
  await repo.updateWorkout(next.id,{status:'done'});
  const events=milestones(await repo.allSetsWithContext(),[],'2026-11-03');
  expect(events).toHaveLength(1);expect(events[0].value).toContain('65 kg');
  await repo.updateSet(set.id,{...input,load_kg:55});
  expect(milestones(await repo.allSetsWithContext(),[],'2026-11-03')).toEqual([]);
 });
 it('does not celebrate a warmup, first baseline, assisted load, or an old record',async()=>{
  const repo=await freshRepo(),ex=await repo.createExercise('Assisted chin','Machine',[]);
  for(const [date,load]of [['2026-10-01',20],['2026-11-03',30]] as const){const w=await repo.createWorkout({date,name:'',kind:'weights',status:'done'});await repo.addSet(w.id,ex.id,{...input,load_kg:load});}
  expect(milestones(await repo.allSetsWithContext(),[],'2026-11-03')).toEqual([]);
  const w=await repo.createWorkout({date:'2026-11-03',name:'',kind:'weights'});await repo.updateWorkout(w.id,{planned_exercise_ids:[ex.id]});
  expect((await loadHero(repo,'2026-11-03')).beat.kind).toBe('none');
 });
 it('uses recorded outdoor distance and recalculates running records after edits',async()=>{
  const repo=await freshRepo();
  await commitPreview(await buildPreview(csvOf([
   row({'Activity Type':'Running',Date:'2026-10-01 05:00:00',Title:'Run',Distance:'5',Time:'00:30:00','Avg Pace':'6:00'}),
   row({'Activity Type':'Running',Date:'2026-11-03 05:00:00',Title:'Run',Distance:'7',Time:'00:42:00','Avg Pace':'6:00'}),
   row({'Activity Type':'Treadmill Running',Date:'2026-11-03 06:00:00',Title:'Treadmill',Distance:'20',Time:'02:00:00','Avg Pace':'6:00'}),
  ]),repo),repo);
  const acts=await repo.activitiesBetween('2000-01-01','2026-11-03');
  const events=milestones([],acts,'2026-11-03');
  expect(events.find(e=>e.id.startsWith('run:'))?.value).toBe('7.00 km');
  expect(events.find(e=>e.id.startsWith('month:'))?.value).toContain('7.0 km');
  const corrected=acts.map(a=>a.group==='outdoor_run'&&a.date==='2026-11-03'?{...a,distance_km:3}:a);
  expect(milestones([],corrected,'2026-11-03')).toEqual([]);
 });
 it('includes local completed lifts in the hero, without counting a linked watch entry twice',async()=>{
  const repo=await freshRepo();
  await commitPreview(await buildPreview(csvOf([row({'Activity Type':'Strength Training',Date:'2026-10-30 05:00:00',Title:'Weights',Time:'00:30:00'})]),repo),repo);
  const act=(await repo.activitiesBetween('2026-10-30','2026-10-30'))[0];
  const w=await repo.createWorkout({date:'2026-10-30',name:'',kind:'weights'});await repo.linkActivity(w.id,act.id);
  expect((await loadHero(repo,'2026-11-03')).lastWeek.lifts).toBe(1);
 });

});
