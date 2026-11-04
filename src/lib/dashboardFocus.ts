import type { Activity, Workout, SetRecord } from '../db/types';
import { mondayOf } from './summary';
export type DashboardFocus = 'free' | 'running' | 'strength-cardio' | 'all';
export const FOCUS_OPTIONS: {value:DashboardFocus;label:string}[] = [
 {value:'free',label:'Train freely'}, {value:'running',label:'Running'}, {value:'strength-cardio',label:'Strength + cardio'}, {value:'all',label:'All training'},
];
export function parseFocus(value:string|null):DashboardFocus|null {return FOCUS_OPTIONS.some(x=>x.value===value)?value as DashboardFocus:null;}
export function readFocus(scope:string,search=''):DashboardFocus {
 try {const saved=parseFocus(localStorage.getItem(`eqfit.focus:${scope}`));if(saved)return saved;}catch {/* Usable without preferences storage. */}
 return parseFocus(new URLSearchParams(search).get('focus'))??'free';
}
export function saveFocus(scope:string,value:DashboardFocus):boolean {try{localStorage.setItem(`eqfit.focus:${scope}`,value);return true;}catch{return false;}}
export type TrainingCategory='strength'|'cardio'|'run'|'other';
export function trainingCategory(type:string):TrainingCategory {
 if(type==='Strength Training')return 'strength';
 if(['Running','Treadmill Running'].includes(type))return 'run';
 if(['Cardio','HIIT','Cycling','Indoor Cycling','Walking','Elliptical','Stair Stepper','Indoor Rowing','Rowing','Swimming'].includes(type))return 'cardio';
 return 'other';
}
export interface TrainingEntry {id:string;date:string;order:string;title:string;category:TrainingCategory;activity?:Activity;workout?:Workout;sets:SetRecord[]}
export function trainingDashboard(activities:Activity[],workouts:Workout[],sets:SetRecord[],today:string,focus:DashboardFocus) {
 const acts=activities.filter(a=>a.date<=today);
 const completed=workouts.filter(w=>w.date<=today&&(w.status==='done'||acts.some(a=>a.id===w.linked_activity_id)));
 const linked=new Set(completed.map(w=>w.linked_activity_id));
 const entries:TrainingEntry[]=acts.filter(a=>!linked.has(a.id)).map(a=>({id:a.id,date:a.date,order:a.timestamp_local,title:a.title||a.original_type,category:trainingCategory(a.original_type),activity:a,sets:[]}));
 for(const w of completed){const a=acts.find(x=>x.id===w.linked_activity_id);entries.push({id:w.id,date:a?.date??w.date,order:a?.timestamp_local??w.created_at,title:w.name||a?.title||'Training session',category:a?trainingCategory(a.original_type):w.kind==='weights'?'strength':w.kind==='run'?'run':'other',activity:a,workout:w,sets:sets.filter(s=>s.workout_id===w.id&&!s.warmup)});}
 // Running is cardio in the mixed dashboard, but remains separately labelled.
 const selected=entries.filter(e=>(focus==='all'||focus==='free')||(focus==='running'?e.category==='run':e.category!=='other')).sort((a,b)=>b.date.localeCompare(a.date)||b.order.localeCompare(a.order)||a.id.localeCompare(b.id));
 const week=selected.filter(e=>e.date>=mondayOf(today));
 const timed=week.filter(e=>e.activity?.duration_seconds!=null);
 return {entries:selected,week,strength:week.filter(e=>e.category==='strength').length,cardio:week.filter(e=>e.category==='cardio'||e.category==='run').length,days:new Set(week.map(e=>e.date)).size,minutes:timed.length?Math.round(timed.reduce((sum,e)=>sum+e.activity!.duration_seconds!,0)/60):null,missingDuration:week.length-timed.length,workingSets:week.reduce((sum,e)=>sum+e.sets.length,0)};
}
