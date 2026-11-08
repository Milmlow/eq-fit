import type { Exercise, SetRecord } from '../db/types';
import type { Session } from './activityPulse';
import { exerciseKey } from './training';
import { loadMode } from './strengthProgress';
import { EXERCISE_CATALOG } from './exerciseCatalog';
export interface PinnedLift {name:string;equipment:string;muscles:string[]}
export function liftKey(p:PinnedLift){return exerciseKey(p.name,p.equipment);}
export function liftOptions(exercises:Exercise[]):PinnedLift[]{
 const choices=new Map<string,PinnedLift>();
 for(const e of EXERCISE_CATALOG)for(const equipment of e.equipment){const p={name:e.name,equipment,muscles:e.muscles};choices.set(liftKey(p),p);}
 for(const e of exercises){const p={name:e.name,equipment:e.equipment,muscles:e.primary_muscles};choices.set(liftKey(p),p);}
 return [...choices.values()].sort((a,b)=>a.name.localeCompare(b.name)||a.equipment.localeCompare(b.equipment));
}
export function defaultFour(exercises:Exercise[]):PinnedLift[]{
 return [
  {name:'Chin-ups',equipment:'Bodyweight',pattern:/^(chin ups?|chinups?)$/},
  {name:'Bench press',equipment:'Barbell',pattern:/^(bench|bench press|barbell bench press)$/},
  {name:'Squat',equipment:'Barbell',pattern:/^(squat|back squat|barbell squat|barbell back squat)$/},
  {name:'Deadlift',equipment:'Barbell',pattern:/^(deadlift|deadlifts|barbell deadlift|conventional deadlift)$/},
 ].map(p=>{const e=exercises.find(e=>p.pattern.test(e.name.toLowerCase().replace(/[-_]/g,' ').replace(/\s+/g,' ').trim())&&(e.equipment.toLowerCase()===p.equipment.toLowerCase()||(p.equipment==='Bodyweight'&&!e.equipment)));return e?{name:e.name,equipment:e.equipment,muscles:e.primary_muscles}:{name:p.name,equipment:p.equipment,muscles:[]};});
}
export function readFour(scope:string,exercises:Exercise[]):PinnedLift[]{
 try{const raw=localStorage.getItem(`eqfit.my-four:${scope}`);if(raw){const x=JSON.parse(raw);if(Array.isArray(x)&&x.length>0&&x.length<=4&&x.every(p=>p&&typeof p.name==='string'&&p.name.trim()&&typeof p.equipment==='string'&&Array.isArray(p.muscles)&&p.muscles.every((m:unknown)=>typeof m==='string'))&&new Set(x.map(liftKey)).size===x.length)return x;}}catch{/* Fall back without changing history. */}
 return defaultFour(exercises);
}
export function saveFour(scope:string,picks:PinnedLift[]):boolean {try{localStorage.setItem(`eqfit.my-four:${scope}`,JSON.stringify(picks));return true;}catch{return false;}}
export function liftRecord(pick:PinnedLift,sessions:Session[],exercises:Exercise[]){
 const ids=new Set(exercises.filter(e=>e.exercise_key===liftKey(pick)).map(e=>e.id));
 const mode=loadMode(pick);
 type Result={set:SetRecord;session:Session};
 const valid:Result[]=sessions.filter(s=>s.workout?.status==='done').flatMap(session=>session.sets.filter(s=>ids.has(s.exercise_id)&&!s.warmup&&s.reps!==null&&Number.isInteger(s.reps)&&s.reps>0&&(mode==='bodyweight'?(s.load_kg===null||s.load_kg===0):s.load_kg!==null&&Number.isFinite(s.load_kg)&&s.load_kg>=0)).map(set=>({set,session})));
 const score=(r:Result)=>mode==='bodyweight'?r.set.reps!:mode==='assisted'?-r.set.load_kg!:r.set.load_kg!;
 const compare=(a:Result,b:Result)=>score(b)-score(a)||b.set.reps!-a.set.reps!||b.session.order.localeCompare(a.session.order);
 const best=[...valid].sort(compare)[0]??null;
 const latest=[...valid].sort((a,b)=>b.session.date.localeCompare(a.session.date)||b.session.order.localeCompare(a.session.order))[0]?.session.id;
 const last=valid.filter(v=>v.session.id===latest).sort(compare)[0]??null;
 return {mode,best,last};
}
export type CrackLift=NonNullable<ReturnType<typeof liftRecord>['last']>;
/** Max day tile text: show the last effort to beat and always invite a go. Unknown stays unknown. */
export function crackTile(mode:ReturnType<typeof liftRecord>['mode'],last:CrackLift|null,best:CrackLift|null,daysSinceLast:number|null,interval:number){
 const fmt=(x:CrackLift)=>mode==='bodyweight'?`${x.set.reps} reps`:`${x.set.load_kg} kg × ${x.set.reps}`;
 const hint=last===null||daysSinceLast===null||!Number.isFinite(daysSinceLast)?'':daysSinceLast>=interval?'Check-in due':`Next check-in in ${interval-daysSinceLast} days`;
 return {headline:last?fmt(last):'Set a baseline',label:last?'Last effort':'',best:best&&(!last||fmt(best)!==fmt(last))?`Best: ${fmt(best)}`:'',cta:'Have a crack',hint};
}
