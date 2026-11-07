import {expect,it} from 'vitest';
import {weeklyEffort,needsInput,formatEffortMinutes} from '../src/lib/weeklyEffort';
import type {TrainingEntry} from '../src/lib/dashboardFocus';
import type {Activity} from '../src/db/types';
const act=(type:string,extra:Partial<Activity>={}):Activity=>({id:type,date:'2026-11-04',timestamp_local:'2026-11-04 06:00:00',original_type:type,...extra} as Activity);
const entry=(a:Activity,category:TrainingEntry['category'],date='2026-11-04'):TrainingEntry=>({id:a.id+date,date,order:'',title:a.original_type,category,sets:[],activity:a});
it('totals a week and leaves unknown time and distance unknown, never 0',()=>{
 const e=weeklyEffort([entry(act('Strength Training'),'strength'),entry(act('Cycling'),'cardio')]);
 expect(e).toMatchObject({sessions:2,strength:1,cardio:1,runs:0,days:1,minutes:null,missingDuration:2,km:null,missingDistance:0});
});
it('sums known minutes and kilometres and counts what is missing',()=>{
 const e=weeklyEffort([
  entry(act('Running',{duration_seconds:1800,distance_km:5.04}),'run','2026-11-03'),
  entry(act('Running',{duration_seconds:2400,distance_km:null}),'run','2026-11-05'),
  entry(act('Strength Training',{duration_seconds:3000}),'strength','2026-11-05'),
  entry(act('Walking'),'cardio','2026-11-06'),
 ]);
 expect(e).toMatchObject({sessions:4,strength:1,cardio:3,runs:2,days:3,minutes:120,missingDuration:1,km:5,missingDistance:1});
});
it('an empty week is all unknown',()=>{
 expect(weeklyEffort([])).toMatchObject({sessions:0,minutes:null,km:null,days:0});
});
it('needs input until the activity is known, and strength also until it is tagged',()=>{
 expect(needsInput(entry(act('Yoga'),'other'),[])).toBe(true);
 expect(needsInput(entry(act('Cycling'),'cardio'),[])).toBe(false);
 expect(needsInput(entry(act('Running'),'run'),[])).toBe(false);
 expect(needsInput(entry(act('Strength Training'),'strength'),[])).toBe(true);
 expect(needsInput(entry(act('Strength Training'),'strength'),['Chest'])).toBe(false);
 expect(needsInput(entry(act('Yoga',{session_activity:'HIIT'}),'cardio'),[])).toBe(false);
});
it('formats minutes, showing - when unknown',()=>{
 expect(formatEffortMinutes(null)).toBe('-');
 expect(formatEffortMinutes(0)).toBe('0 min');
 expect(formatEffortMinutes(45)).toBe('45 min');
 expect(formatEffortMinutes(60)).toBe('1h 00m');
 expect(formatEffortMinutes(249)).toBe('4h 09m');
});
