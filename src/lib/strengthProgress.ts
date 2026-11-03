import type { Exercise, SetRecord, Workout } from '../db/types';
import { bestE1rm } from './lifting';
import { addDays } from './summary';
export interface StrengthSession { workout: Workout; sets: SetRecord[] }
export type StrengthMetric = 'load' | 'reps' | 'estimate';
/** Estimates require an explicitly recognised external-load setup. Unknown equipment stays unclassified. */
export function loadMode(ex: Pick<Exercise,'name'|'equipment'>): 'external'|'assisted'|'bodyweight'|'unknown' {
 const label=`${ex.name} ${ex.equipment}`.toLowerCase();
 if (/assist|counterweight/.test(label)) return 'assisted';
 if (/body\s?weight|chin.?up|pull.?up|push.?up|dip\b/.test(label)) return 'bodyweight';
 return /^(barbell|dumbbells?|kettlebells?)$/i.test(ex.equipment.trim()) ? 'external' : 'unknown';
}
export function strengthPoints(sessions: StrengthSession[], metric: StrengthMetric, today: string, all: boolean) {
 return sessions.filter(s=>s.workout.date<=today && (all || s.workout.date>=addDays(today,-55))).map(s=>{
  const sets=s.sets.filter(x=>!x.warmup);
  const valid=sets.filter(x=>x.reps!==null && x.reps>0);
  const values=metric==='reps' ? sets.flatMap(x=>x.reps===null?[]:[x.reps]) : valid.flatMap(x=>x.load_kg===null?[]:[x.load_kg]);
  return {id:s.workout.id,date:s.workout.date,value:metric==='estimate' ? bestE1rm(sets)?.epley??null : values.length?Math.max(...values):null};
 });
}
export function nextSuggestion(prior: SetRecord[], logged: SetRecord[]) {
 // Match warm-ups and working sets independently; never infer completion or copy pain/RIR.
 const working=prior.filter(s=>!s.warmup), warmups=prior.filter(s=>s.warmup);
 const nextWork=working[logged.filter(s=>!s.warmup).length];
 return {working:nextWork??working[working.length-1]??null,warmup:warmups[logged.filter(s=>s.warmup).length]??null};
}
