import {expect,it} from 'vitest';
import {freshRepo} from './helpers';
import {applyCloudRows,prepareCloudRows} from '../src/lib/cloudImport';
import {allocateSession,sessionActivity} from '../src/lib/sessionActivity';
import {trainingDashboard} from '../src/lib/dashboardFocus';
import {sessionParts} from '../src/ui/FreeTraining';
import {buildBackup,validateBackup} from '../src/lib/backup';
it('allocates generic cardio as walking or strength, counts linked records once and resets without losing the source',async()=>{
 const repo=await freshRepo();
 await applyCloudRows(repo,await prepareCloudRows([['Cardio','2026-11-07 08:00:00','Morning cardio','','00:40:00','','123','120']],repo),'owner');
 const a=(await repo.db.activities.toArray())[0];
 const w=await repo.createWorkout({date:a.date,name:'Training',kind:'other'});await repo.linkActivity(w.id,a.id);
 await allocateSession(repo,{activity:a,workout:w},'Walking');
 let activities=await repo.db.activities.toArray(),workouts=await repo.db.workouts.toArray();
 let d=trainingDashboard(activities,workouts,[],a.date,'free');
 expect(d.entries).toHaveLength(1);expect(d.cardio).toBe(1);expect(d.strength).toBe(0);expect(sessionActivity(activities[0],workouts[0])).toBe('Walking');expect(activities[0].original_type).toBe('Cardio');
 await allocateSession(repo,{activity:a,workout:w},'Strength');
 await repo.db.activities.update(a.id,{body_parts:['Chest']});
 activities=await repo.db.activities.toArray();workouts=await repo.db.workouts.toArray();
 d=trainingDashboard(activities,workouts,[],a.date,'free');expect(d.strength).toBe(1);expect(d.cardio).toBe(0);expect(sessionParts(d.entries[0])).toEqual(['Chest']);
 expect(validateBackup(JSON.stringify(await buildBackup(repo.db))).ok).toBe(true);
 await allocateSession(repo,{activity:a,workout:w},'');
 d=trainingDashboard(await repo.db.activities.toArray(),await repo.db.workouts.toArray(),[],a.date,'free');expect(d.cardio).toBe(1);expect(sessionParts(d.entries[0])).toEqual([]);
 repo.db.close();
});
it('rolls back an allocation if the linked record has gone missing',async()=>{
 const repo=await freshRepo();const w=await repo.createWorkout({date:'2026-11-07',name:'Session',kind:'weights'});
 await expect(allocateSession(repo,{workout:{...w,id:'missing'}},'Walking')).rejects.toThrow();expect((await repo.getWorkout(w.id))?.session_activity).toBeUndefined();repo.db.close();
});
