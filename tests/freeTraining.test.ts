import {expect,it} from 'vitest';
import {sessionParts} from '../src/ui/FreeTraining';
import {trainingDashboard} from '../src/lib/dashboardFocus';
import type {Activity,Workout} from '../src/db/types';
it('preserves tags when a Garmin session becomes linked, without double counting',()=>{
 const a={id:'a',date:'2026-11-05',timestamp_local:'2026-11-05 06:00:00',original_type:'Strength Training',body_parts:['Chest'],duration_seconds:1800} as Activity;
 const w={id:'w',date:a.date,status:'done',kind:'weights',linked_activity_id:'a',body_parts:['Chest','Arms'],created_at:a.timestamp_local} as Workout;
 const d=trainingDashboard([a],[w],[],a.date,'free');
 expect(d.days).toBe(1);expect(d.entries).toHaveLength(1);expect(sessionParts(d.entries[0])).toEqual(['Chest','Arms']);
});
it('leaves missing tags unknown and includes cardio in free training',()=>{
 const a={id:'a',date:'2026-11-05',timestamp_local:'2026-11-05 06:00:00',original_type:'Cycling'} as Activity;
 const d=trainingDashboard([a],[],[],a.date,'free');expect(d.cardio).toBe(1);expect(sessionParts(d.entries[0])).toEqual([]);
});

import {freshRepo} from './helpers';
import {buildBackup,validateBackup} from '../src/lib/backup';
it('saves check-ins as completed efforts and reuses the session for another lift',async()=>{
 const repo=await freshRepo();
 const input={load_kg:60,reps:8,rir:null,warmup:false,pain_note:null};
 const first=await repo.quickLogLift('2026-11-05',{name:'Bench press',equipment:'Barbell',muscles:[]},null,input,1,true);
 expect((await repo.getWorkout(first.workout.id))?.status).toBe('done');
 await repo.quickLogLift('2026-11-05',{name:'Squat',equipment:'Barbell',muscles:[]},null,input,1,true);
 expect(await repo.workoutsBetween('2026-11-05','2026-11-05')).toHaveLength(1);
 await repo.db.workouts.update(first.workout.id,{body_parts:['Chest','Legs']});
 const backup=await buildBackup(repo.db);
 expect(backup.tables.workouts[0].body_parts).toEqual(['Chest','Legs']);
 expect(validateBackup(JSON.stringify(backup)).ok).toBe(true);
});
