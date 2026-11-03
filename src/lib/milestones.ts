import type {Activity,Exercise,SetRecord,Workout} from '../db/types';
import {loadMode} from './strengthProgress';
import {addDays} from './summary';
import {formatSet,workoutOrderKey} from './training';
export interface Milestone {id:string;date:string;title:string;value:string;kind:'lift'|'run'}
export function milestones(context:{set:SetRecord;workout:Workout;exercise:Exercise}[],activities:(Activity&{group:string})[],today:string):Milestone[] {
 const out:Milestone[]=[],sessions=new Map<string,{workout:Workout;exercise:Exercise;set:SetRecord}>();
 for(const row of context){const {set,workout,exercise}=row;if(workout.date>today||workout.status!=='done'||set.warmup||loadMode(exercise)!=='external'||set.reps===null||set.reps<1||set.load_kg===null||set.load_kg<=0)continue;
  const key=workout.id+':'+exercise.id,prior=sessions.get(key);if(!prior||set.load_kg>prior.set.load_kg!)sessions.set(key,row);
 }
 const best=new Map<string,number>();
 for(const [key,row]of [...sessions].sort((a,b)=>workoutOrderKey(a[1].workout).localeCompare(workoutOrderKey(b[1].workout)))){const {set,workout,exercise}=row,old=best.get(exercise.id);if(old!==undefined&&set.load_kg!>old)out.push({id:'lift:'+key,date:workout.date,title:`${exercise.name} · heaviest working set`,value:formatSet(set),kind:'lift'});best.set(exercise.id,Math.max(old??0,set.load_kg!));}
 const runs=activities.filter(a=>a.date<=today&&a.group==='outdoor_run'&&a.distance_km!==null&&a.distance_km>0).sort((a,b)=>a.timestamp_local.localeCompare(b.timestamp_local)||a.id.localeCompare(b.id));
 let longest:number|null=null;
 const months=new Map<string,{total:number;date:string}>();
 for(const run of runs){const km=run.distance_km!;if(longest!==null&&km>longest)out.push({id:'run:'+run.id,date:run.date,title:'Longest recorded outdoor run',value:`${km.toFixed(2)} km`,kind:'run'});longest=Math.max(longest??0,km);const m=run.date.slice(0,7),prior=months.get(m);months.set(m,{total:(prior?.total??0)+km,date:run.date});}
 let monthBest:number|null=null;
 for(const [month,m]of [...months].sort((a,b)=>a[0].localeCompare(b[0]))){if(monthBest!==null&&m.total>monthBest)out.push({id:'month:'+month,date:m.date,title:'Best recorded month · outdoor distance',value:`${m.total.toFixed(1)} km · ${month}`,kind:'run'});monthBest=Math.max(monthBest??0,m.total);}
 return out.filter(m=>m.date>=addDays(today,-6)).sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
}
