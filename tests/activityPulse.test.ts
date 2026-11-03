import {describe,it,expect} from 'vitest';
import {activityPulse,type PulseActivity} from '../src/lib/activityPulse';
import type {Workout,SetRecord,Exercise} from '../src/db/types';
const today='2026-11-03';
const run=(id:string,date:string,km=5,pace:number|null=360)=>({id,date,timestamp_local:date+' 07:00:00',group:'outdoor_run',title:'Run',distance_km:km,avg_pace_sec_per_km:pace,duration_seconds:1800} as PulseActivity);
const w=(id:string,date:string,status='done')=>({id,date,kind:'weights',status,created_at:date+'T08:00:00Z',name:'',linked_activity_id:null} as Workout);
const set=(id:string,kg:number,reps:number,warmup=false)=>({workout_id:id,exercise_id:'bench',load_kg:kg,reps,warmup} as SetRecord);
const ex={id:'bench',name:'Bench press',equipment:'Barbell'} as Exercise;
describe('activity pulse',()=>{
 it('includes today in a 28-day weighted average, excludes future and old dates',()=>{
 const d=activityPulse([run('old','2026-10-06',99),run('start','2026-10-07',5,300),run('now',today,10,360),run('future','2026-11-04',100)],[],[],[],today);
 expect(d.latest?.id).toBe('now');expect(d.running.paceSecPerKm).toBe(340);expect(d.weeklyKm).toBe(3.75);
 });
 it('counts linked watch lifts once and excludes unfinished unlinked sets',()=>{
 const a={...run('watch',today),group:'weights'} as PulseActivity;
 const d=activityPulse([a],[{...w('done',today),linked_activity_id:'watch'},w('plan',today,'planned')],[set('plan',100,10)],[],today);
 expect(d.sessions).toHaveLength(1);expect(d.weeklyLifts).toBe(.25);
 });
 it('retains linked run metrics when the local plan is unfinished',()=>{
 const d=activityPulse([run('watch',today)],[{...w('plan',today,'planned'),kind:'run',linked_activity_id:'watch'}],[],[],today);
 expect(d.sessions).toHaveLength(1);expect(d.latest?.activity?.distance_km).toBe(5);
 });
 it('handles unknown pace without inventing values',()=>{
 const d=activityPulse([run('a',today,5,null)],[],[],[],today);expect(d.running.paceSecPerKm).toBeNull();expect(d.signal?.title).toBe('Session recorded ✓');
 });
 it('requires three previous runs for a distance signal and never praises speed alone',()=>{
 const prior=['2026-10-29','2026-10-30','2026-10-31'].map((date,i)=>run(String(i),date));
 expect(activityPulse([...prior,run('latest',today,7)],[],[],[],today).signal?.title).toBe('Further than usual ↗');
 expect(activityPulse([...prior,run('latest',today,5,250)],[],[],[],today).signal?.title).not.toBe('Further than usual ↗');
 });
 it('compares working sets on exact equipment and recalculates after correction',()=>{
 const workouts=[w('old','2026-10-30'),w('new',today)];
 expect(activityPulse([],workouts,[set('old',60,8),set('new',60,9)],[ex],today).signal?.title).toBe('Stronger than last time ↑');
 for(const sets of [[set('old',60,10),set('new',60,9)],[set('old',60,8),set('new',60,9,true)]])expect(activityPulse([],workouts,sets,[ex],today).signal?.title).not.toBe('Stronger than last time ↑');
 expect(activityPulse([],workouts,[set('old',60,8),set('new',60,9)],[{...ex,equipment:'Assisted'}],today).signal?.title).not.toBe('Stronger than last time ↑');
 });
 it('uses a neutral empty state without a made-up signal',()=>{expect(activityPulse([],[],[],[],today).signal).toBeNull();});
});
