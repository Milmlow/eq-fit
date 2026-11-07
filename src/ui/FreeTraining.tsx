import { useState } from 'react';
import type { Repo } from '../db/repo';
import { trainingCategory, type TrainingEntry } from '../lib/dashboardFocus';
import { mondayOf } from '../lib/summary';
import { SESSION_ACTIVITIES, sessionActivity, allocatedCategory, allocateSession, type SessionActivity } from '../lib/sessionActivity';
import { formatTodayLabel } from '../lib/todayStats';
import { weeklyEffort, needsInput, formatEffortMinutes } from '../lib/weeklyEffort';

export const BODY_PARTS = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core'];
export function sessionParts(e: TrainingEntry): string[] {
  if (e.category !== 'strength') return [];
  return [...new Set([...(e.activity?.body_parts ?? []), ...(e.workout?.body_parts ?? [])])].filter(p => BODY_PARTS.includes(p));
}
export function FreeTraining({repo,today,entries,days,onChanged}:{repo:Repo;today:string;entries:TrainingEntry[];days:number;onChanged:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [saved,setSaved]=useState<Record<string,string[]>>({});
  const [allocations,setAllocations]=useState<Record<string,SessionActivity|''>>({});
  const effective=entries.map(e=>{const label=allocations[e.id];if(label===undefined)return e;const a=e.activity?{...e.activity,session_activity:label}:undefined,w=e.workout?{...e.workout,session_activity:label}:undefined;return {...e,activity:a,workout:w,category:allocatedCategory(sessionActivity(a,w),a?trainingCategory(a.original_type):w?.kind==='weights'?'strength':w?.kind==='run'?'run':'other')};});
  const partsFor=(e:TrainingEntry)=>e.category==='strength'?(saved[e.id]??sessionParts(e)):[];
  const start=new Date(`${today}T12:00:00Z`); start.setUTCDate(start.getUTCDate()-13);
  const recent=effective.filter(e=>e.date>=start.toISOString().slice(0,10)&&e.date<=today);
  const week=recent.filter(e=>e.date>=mondayOf(today));
  const older=recent.filter(e=>e.date<mondayOf(today));
  async function allocate(e:TrainingEntry,label:SessionActivity|'') {
    if(busy)return;setBusy(true);setError('');
    try {await allocateSession(repo,e,label);setAllocations(p=>({...p,[e.id]:label}));onChanged();}
    catch {setError('Activity was not saved. Please try again.');}finally{setBusy(false);}
  }
  const effort=weeklyEffort(week);
  const pending=week.filter(e=>needsInput(e,partsFor(e))),settled=week.filter(e=>!needsInput(e,partsFor(e)));
  const untagged=recent.filter(e=>e.category==='strength'&&!partsFor(e).length).length;
  async function toggle(e:TrainingEntry,part:string) {
    if(busy||e.category!=='strength')return;
    setBusy(true);setError('');
    const parts=partsFor(e);const next=parts.includes(part)?parts.filter(p=>p!==part):[...parts,part];
    try {
      await repo.db.transaction('rw',repo.db.activities,repo.db.workouts,async()=>{
        if(e.activity&&!(await repo.db.activities.update(e.activity.id,{body_parts:next})))throw Error('Session missing');
        if(e.workout&&!(await repo.db.workouts.update(e.workout.id,{body_parts:next})))throw Error('Session missing');
      });
      setSaved(previous=>({...previous,[e.id]:next}));
      onChanged();
    } catch {setError('Tags were not saved. Please try again.');} finally {setBusy(false);}
  }
  function renderSession(e:TrainingEntry) {
    const parts=partsFor(e), expanded=editing===e.id||parts.length===0;
    return <article className="free-session" key={e.id}>
      <strong>{e.category==='run'?'Running':e.category==='strength'?'Strength session':e.category==='cardio'?`Cardio · ${sessionActivity(e.activity,e.workout)??'Choose activity'}`:e.title}</strong>
      <small>{formatTodayLabel(e.date)}{e.activity?.duration_seconds!=null?` · ${Math.round(e.activity.duration_seconds/60)} min`:''}</small>
      <details className="session-allocation"><summary>{sessionActivity(e.activity,e.workout)?'Edit activity':'Allocate activity'}</summary><div className="activity-tags">{SESSION_ACTIVITIES.map(label=><button key={label} disabled={busy} aria-pressed={sessionActivity(e.activity,e.workout)===label} onClick={()=>void allocate(e,label)}>{label}</button>)}<button disabled={busy} onClick={()=>void allocate(e,'')}>As recorded</button></div></details>
      {e.category==='strength'&&(expanded?<>
        <div className="body-tags" aria-label={`Body parts for ${e.title}, ${e.date}`}>
          {BODY_PARTS.map(p=><button key={p} disabled={busy} aria-pressed={parts.includes(p)} onClick={()=>void toggle(e,p)}>{p}</button>)}
        </div>
        {editing===e.id&&<button disabled={busy} onClick={()=>setEditing(null)}>Done</button>}
      </>:<div className="session-tag-summary"><span>{parts.join(' · ')}</span><button onClick={()=>setEditing(e.id)} aria-label={`Edit body parts for ${e.title}, ${e.date}`}>Edit</button></div>)}
    </article>;
  }
  return <section className="free-training" aria-label="Train freely">
    <div className="free-heading"><div><p className="eyebrow">TRAIN FREELY</p><h2>Move. Feel good. Come back.</h2></div><strong>{days}<small>active days this week</small></strong></div>
    <p className="muted small">Let Garmin record your session. Afterwards, tap what you trained.</p>
    {error&&<p role="alert">{error}</p>}
    <h3>This week</h3>
    <div className="session-week-totals" aria-label="Weekly effort"><div><strong>{effort.strength}</strong><span>Strength sessions</span></div><div><strong>{effort.cardio}</strong><span>Cardio sessions · includes runs</span></div><div><strong>{formatEffortMinutes(effort.minutes)}</strong><span>Active time</span>{effort.minutes!==null&&effort.missingDuration>0&&<small>from {effort.sessions-effort.missingDuration} of {effort.sessions} sessions</small>}</div><div><strong>{effort.km===null?'-':`${effort.km.toFixed(1)} km`}</strong><span>Running distance</span>{effort.km!==null&&effort.missingDistance>0&&<small>from {effort.runs-effort.missingDistance} of {effort.runs} runs</small>}</div></div>
    {!week.length&&<p>Your sessions will appear here after Garmin syncs. Nothing to enter during your workout.</p>}
    {pending.length>0&&<p className="muted small">{pending.length} session{pending.length===1?' needs':'s need'} your input.</p>}
    {pending.map(renderSession)}
    {settled.length>0&&<details className="settled-sessions"><summary>{pending.length?`Sorted sessions · ${settled.length}`:`All sorted · ${settled.length} session${settled.length===1?'':'s'}`}</summary>{settled.map(renderSession)}</details>}
    {older.length>0&&<details><summary>Earlier sessions · {older.length} sessions</summary>{older.map(renderSession)}</details>}
    <details className="coverage-fold" key={pending.length?'open':'closed'} open={pending.length>0}><summary>Whole-body coverage <small>· last 14 days</small></summary>
    <div className="body-tiles">{BODY_PARTS.map(p=>{const count=recent.filter(e=>partsFor(e).includes(p)).length;return <div key={p} className={count?'body-covered':''}><strong>{p}</strong><small>{count?`${count} session${count===1?'':'s'}`:'Not tagged yet'}</small></div>;})}</div>
    {untagged>0&&<p className="muted small">{untagged} strength session{untagged===1?' needs':'s need'} tags. Coverage shows what you’ve tagged, not everything you’ve trained.</p>}
    </details>
  </section>;
}
