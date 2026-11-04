import { useState } from 'react';
import type { Repo } from '../db/repo';
import type { TrainingEntry } from '../lib/dashboardFocus';
import { formatTodayLabel } from '../lib/todayStats';

export const BODY_PARTS = ['Chest', 'Back', 'Shoulders', 'Legs', 'Arms', 'Core'];
export function sessionParts(e: TrainingEntry): string[] {
  if (e.category !== 'strength') return [];
  return [...new Set([...(e.activity?.body_parts ?? []), ...(e.workout?.body_parts ?? [])])].filter(p => BODY_PARTS.includes(p));
}
export function FreeTraining({repo,today,entries,days,onChanged}:{repo:Repo;today:string;entries:TrainingEntry[];days:number;onChanged:()=>void}) {
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const [editing,setEditing]=useState<string|null>(null);
  const [saved,setSaved]=useState<Record<string,string[]>>({});
  const partsFor=(e:TrainingEntry)=>e.category==='strength'?(saved[e.id]??sessionParts(e)):[];
  const start=new Date(`${today}T12:00:00Z`); start.setUTCDate(start.getUTCDate()-13);
  const recent=entries.filter(e=>e.date>=start.toISOString().slice(0,10)&&e.date<=today);
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
      <strong>{e.category==='run'?'Running':e.title}</strong>
      <small>{formatTodayLabel(e.date)}{e.activity?.duration_seconds!=null?` · ${Math.round(e.activity.duration_seconds/60)} min`:''}</small>
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
    <h3>Whole-body coverage <small>· last 14 days</small></h3>
    <div className="body-tiles">{BODY_PARTS.map(p=>{const count=recent.filter(e=>partsFor(e).includes(p)).length;return <div key={p} className={count?'body-covered':''}><strong>{p}</strong><small>{count?`${count} session${count===1?'':'s'}`:'Not tagged yet'}</small></div>;})}</div>
    {untagged>0&&<p className="muted small">{untagged} strength session{untagged===1?' needs':'s need'} tags. Coverage shows what you’ve tagged, not everything you’ve trained.</p>}
    {error&&<p role="alert">{error}</p>}
    <h3>Recent movement</h3>
    {!recent.length&&<p>Your Garmin sessions will appear here after syncing. Nothing to enter during your workout.</p>}
    {recent.slice(0,3).map(renderSession)}
    {recent.length>3&&<details><summary>More sessions</summary>{recent.slice(3).map(renderSession)}</details>}
  </section>;
}
