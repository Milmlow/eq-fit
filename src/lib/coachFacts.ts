import type { Session } from './activityPulse';
import type { Exercise, SetRecord } from '../db/types';
import { loadMode } from './strengthProgress';
import { addDays, mondayOf } from './summary';
const valid = (s:SetRecord) => !s.warmup && !s.pain_note?.trim() && s.load_kg!==null && Number.isFinite(s.load_kg) && s.load_kg>0 && s.reps!==null && Number.isInteger(s.reps) && s.reps>0;
/** Read-only evidence adapter. No guessed workout times, target sets, pace judgments or PRs. */
export function coachFacts(session:Session,history:Session[],exercises:Exercise[]):Record<string,string> {
 const facts:Record<string,string>={};
 const a=session.activity;
 const time=a?.timestamp_local?.match(/^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2}):\d{2}$/);
 // Require the source Date cell itself to contain this clock time. A manufactured midnight is not evidence.
 if(time && Number(time[1])<6 && Number(time[2])<60 && a?.date===session.date && new RegExp(`(?:T|\\s)${time[1]}:${time[2]}(?::|\\s|$)`).test(a.raw_fields?.Date??'')) {
  facts.early=`Recorded start ${time[1]}:${time[2]} · source local time`;
 }
 if(session.kind==='weights'&&session.workout?.status==='done'&&!session.sets.some(s=>s.pain_note?.trim())) {
  for(const ex of exercises.filter(e=>loadMode(e)==='external')) {
   const current=session.sets.filter(s=>s.exercise_id===ex.id&&valid(s));
   const prior=history.filter(s=>s.id!==session.id&&s.date<session.date&&s.kind==='weights'&&s.workout?.status==='done'&&s.sets.some(x=>x.exercise_id===ex.id)).sort((a,b)=>b.date.localeCompare(a.date)||b.order.localeCompare(a.order))[0];
   if(!prior || prior.sets.some(s=>s.exercise_id===ex.id&&s.pain_note?.trim()))continue;
   for(const set of current) {
    const comparable=prior.sets.filter(s=>s.exercise_id===ex.id&&s.load_kg===set.load_kg&&valid(s));
    if(!comparable.length)continue;
    const old=Math.max(...comparable.map(s=>s.reps!));
    if(set.reps!>old){facts['more-reps']=`${ex.name} · ${ex.equipment}: ${set.load_kg} kg × ${set.reps}; previous session ${prior.date}: best ${old} reps at this weight. Not an all-time record claim.`;break;}
   }
   if(facts['more-reps'])break;
  }
 }
 const monday=mondayOf(session.date);
 const days=new Set([...history,session].filter(s=>s.date<=session.date).map(s=>s.date));
 if([0,7,14].every(offset=>[...days].filter(d=>d>=addDays(monday,-offset)&&d<=addDays(monday,6-offset)).length>=2))facts.steady='At least two recorded training days in each of three consecutive calendar weeks, through this session.';
 return facts;
}
