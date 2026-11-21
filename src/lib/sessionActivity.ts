import type {Activity, Workout} from '../db/types';
import type {TrainingCategory} from './dashboardFocus';
import type {Repo} from '../db/repo';
export const BODY_PARTS = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core', 'Full body'];
export const SESSION_ACTIVITIES=['Strength','Walking','Running','Cycling','Rowing','Swimming','HIIT','Other cardio'] as const;
export type SessionActivity=typeof SESSION_ACTIVITIES[number];
export function sessionActivity(a?:Activity,w?:Workout):SessionActivity|undefined {
 const saved=a?.session_activity||w?.session_activity;
 if(SESSION_ACTIVITIES.includes(saved as SessionActivity))return saved as SessionActivity;
 const type=a?.original_type;
 if(type==='Strength Training'||(!a&&w?.kind==='weights'))return 'Strength';
 if(type==='Running'||type==='Treadmill Running'||(!a&&w?.kind==='run'))return 'Running';
 if(type==='Walking')return 'Walking';
 if(type==='Cycling'||type==='Indoor Cycling')return 'Cycling';
 if(type==='Rowing'||type==='Indoor Rowing')return 'Rowing';
 if(type==='Swimming')return 'Swimming';
 if(type==='HIIT')return 'HIIT';
 return undefined;
}
export function allocatedCategory(label:SessionActivity|undefined,fallback:TrainingCategory):TrainingCategory {
 return label==='Strength'?'strength':label==='Running'?'run':label?'cardio':fallback;
}
export async function allocateSession(repo:Repo,entry:{activity?:Activity;workout?:Workout},label:SessionActivity|'',bodyParts?:string[]) {
 if(label!==''&&!SESSION_ACTIVITIES.includes(label))throw Error('Invalid activity');
 if(!entry.activity&&!entry.workout)throw Error('Session missing');
 if(bodyParts!==undefined && (label!=='Strength'||bodyParts.some(part=>!BODY_PARTS.includes(part))))throw Error('Invalid body areas');
 const patch = bodyParts === undefined ? {session_activity:label} : {session_activity:label,body_parts:[...new Set(bodyParts)],body_parts_estimated:false};
 await repo.db.transaction('rw',repo.db.activities,repo.db.workouts,async()=>{
  if(entry.activity&&!(await repo.db.activities.update(entry.activity.id,patch)))throw Error('Session missing');
  if(entry.workout&&!(await repo.db.workouts.update(entry.workout.id,patch)))throw Error('Session missing');
 });
}
