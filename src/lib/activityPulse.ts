import type { Activity, Workout, SetRecord, Exercise } from '../db/types';
import type { Group } from './mapping';
import { addDays, mondayOf } from './summary';
import { summariseRuns } from './running';
import { loadMode } from './strengthProgress';
export type PulseActivity = Activity & { group: Group };
export interface Session { id: string; date: string; order: string; title: string; kind: 'run'|'weights'; activity?: PulseActivity; workout?: Workout; sets: SetRecord[] }
export function activityPulse(activities: PulseActivity[], workouts: Workout[], sets: SetRecord[], exercises: Exercise[], today: string) {
  const acts = activities.filter(a => a.date <= today && a.group !== 'other');
  const linked = new Set(workouts.flatMap(w => w.linked_activity_id ? [w.linked_activity_id] : []));
  const sessions: Session[] = acts.filter(a => !linked.has(a.id)).map(a => ({ id:a.id,date:a.date,order:a.timestamp_local,title:a.title,kind:a.group==='weights'?'weights':'run',activity:a,sets:[] }));
  for (const w of workouts.filter(w => w.date <= today && w.kind !== 'other')) {
    const activity = acts.find(a => a.id === w.linked_activity_id);
    // A linked watch activity proves completion even when the local plan has not been finished.
    if (w.status !== 'done' && !activity) continue;
    sessions.push({ id:w.id,date:activity?.date ?? w.date,order:activity?.timestamp_local ?? `${w.date} ${w.created_at.slice(11,19)}`,title:w.name || (w.kind==='weights'?'Weights session':'Run'),kind:w.kind as 'run'|'weights',activity,workout:w,sets:sets.filter(s => s.workout_id===w.id && !s.warmup) });
  }
  sessions.sort((a,b)=>b.date.localeCompare(a.date)||b.order.localeCompare(a.order)||a.id.localeCompare(b.id));
  const start=addDays(today,-27), window=sessions.filter(s=>s.date>=start);
  const running=summariseRuns(acts,start,today,false);
  const latest=sessions[0];
  let signal: {title:string;detail:string}|null=null;
  if (latest) {
    const earlier=sessions.filter(s=>s.date<latest.date);
    const previous=earlier[0];
    if (latest.kind==='weights') {
      for (const ex of exercises.filter(e=>loadMode(e)==='external')) {
        const current=latest.sets.filter(s=>s.exercise_id===ex.id&&s.load_kg!==null&&s.reps!==null);
        const prior=sessions.find(s=>s.id!==latest.id&&s.kind==='weights'&&s.date<latest.date&&s.sets.some(x=>x.exercise_id===ex.id));
        const old=prior?.sets.filter(s=>s.exercise_id===ex.id&&s.load_kg!==null&&s.reps!==null)??[];
        const improved=current.find(s=>old.some(p=>(p.load_kg===s.load_kg&&s.reps!>p.reps!)||(p.reps===s.reps&&s.load_kg!>p.load_kg!))&&!old.some(p=>p.load_kg!>=s.load_kg!&&p.reps!>=s.reps!));
        if(improved){signal={title:'Stronger than last time ↑',detail:`${ex.name} (${ex.equipment}): ${improved.load_kg} kg × ${improved.reps}. More weight at the same reps, or more reps at the same weight, than your previous completed session on ${prior!.date}. Warm-ups excluded.`};break;}
      }
    }
    if(!signal&&latest.activity?.group==='outdoor_run'&&latest.activity.distance_km!==null){
      const prior=acts.filter(a=>a.group==='outdoor_run'&&a.date<latest.date&&a.date>=addDays(latest.date,-28)&&a.distance_km!==null);
      const avg=prior.reduce((n,a)=>n+a.distance_km!,0)/prior.length;
      if(prior.length>=3&&latest.activity.distance_km>avg) signal={title:'Further than usual ↗',detail:`${latest.activity.distance_km.toFixed(2)} km versus ${avg.toFixed(2)} km per run across ${prior.length} outdoor runs in the preceding 28 days. A distance comparison, not a session quality score.`};
    }
    if(!signal&&previous&&previous.date<addDays(latest.date,-7)) signal={title:'Back at it ✓',detail:`Your previous recorded training day was ${previous.date}.`};
    const days=new Set(sessions.filter(s=>s.date>=mondayOf(latest.date)&&s.date<=latest.date).map(s=>s.date)).size;
    if(!signal&&days>=2)signal={title:'Building consistency ✓',detail:`${days} recorded training days in the week of ${mondayOf(latest.date)}, through this session. Rest days belong in the plan.`};
    if(!signal)signal={title:'Session recorded ✓',detail:'Saved in your history. This is a completed activity, not a proposed target.'};
  }
  return {sessions,latest,signal,start,running,weeklyKm:running.km===null?null:running.km/4,weeklyLifts:window.filter(s=>s.kind==='weights').length/4};
}
