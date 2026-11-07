import type {TrainingEntry} from './dashboardFocus';
import {sessionActivity} from './sessionActivity';
/** Weekly effort for the Train freely card. Unknown time or distance stays null, never 0. */
export function weeklyEffort(week:TrainingEntry[]) {
 const timed=week.filter(e=>e.activity?.duration_seconds!=null);
 const runs=week.filter(e=>e.category==='run');
 const measured=runs.filter(e=>e.activity?.distance_km!=null);
 return {
  sessions:week.length,
  strength:week.filter(e=>e.category==='strength').length,
  cardio:week.filter(e=>e.category==='cardio'||e.category==='run').length,
  runs:runs.length,
  minutes:timed.length?Math.round(timed.reduce((sum,e)=>sum+e.activity!.duration_seconds!,0)/60):null,
  missingDuration:week.length-timed.length,
  km:measured.length?Math.round(measured.reduce((sum,e)=>sum+e.activity!.distance_km!,0)*10)/10:null,
  missingDistance:runs.length-measured.length,
 };
}
/** A session needs input until its activity is known; a strength session also until its body parts are tagged. */
export function needsInput(e:TrainingEntry,parts:string[]):boolean {
 return sessionActivity(e.activity,e.workout)===undefined||(e.category==='strength'&&parts.length===0);
}
export function formatEffortMinutes(minutes:number|null):string {
 if(minutes===null)return '-';
 if(minutes<60)return `${minutes} min`;
 return `${Math.floor(minutes/60)}h ${String(minutes%60).padStart(2,'0')}m`;
}
