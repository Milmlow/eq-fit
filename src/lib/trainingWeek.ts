import type {Activity,Workout} from '../db/types';
export function daySummary(date:string,workouts:Workout[],activities:(Activity&{group:string})[],linked:Set<string>) {
 const ws=workouts.filter(w=>w.date===date),as=activities.filter(a=>a.date===date&&!linked.has(a.id));
 const runs=as.filter(a=>a.group==='outdoor_run'||a.group==='treadmill_run');
 const distances=activities.filter(a=>a.date===date&&(a.group==='outdoor_run'||a.group==='treadmill_run')).flatMap(a=>a.distance_km===null?[]:[a.distance_km]);
 return {lifts:ws.filter(w=>w.kind==='weights'&&w.status==='done').length+as.filter(a=>a.group==='weights').length,runs:runs.length+ws.filter(w=>w.kind==='run'&&w.status==='done').length,planned:ws.filter(w=>w.status==='planned').length,km:distances.length?distances.reduce((a,b)=>a+b,0):null};
}
