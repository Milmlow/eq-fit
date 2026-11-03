import { useEffect,useRef,useState } from 'react';
import type { Repo } from '../db/repo';
import type { Workout } from '../db/types';
import { IconLift } from './Icons';
export function RepeatSession({repo,today,version,onOpen}:{repo:Repo;today:string;version:number;onOpen:(id:string)=>void}) {
 const [sessions,setSessions]=useState<Workout[]>([]),[pick,setPick]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const lock=useRef(false);
 useEffect(()=>{let live=true; void repo.workoutsBetween('2000-01-01',today).then(async rows=>{
  const results=await Promise.all(rows.filter(w=>w.kind==='weights'&&w.status==='done').reverse().map(async w=>({w,sets:await repo.setsForWorkout(w.id)})));
  if(live) setSessions(results.filter(x=>x.w.planned_exercise_ids.length||x.sets.length).map(x=>x.w));
 }).catch(()=>{if(live)setError('Could not load previous sessions.');});return()=>{live=false;};},[repo,today,version]);
 async function repeat(){if(lock.current)return;lock.current=true;setBusy(true);setError('');try{const w=await repo.repeatWorkout(pick||sessions[0].id,today);onOpen(w.id);}catch(e){setError(e instanceof Error?e.message:'Could not repeat session.');}finally{lock.current=false;setBusy(false);}}
 if(!sessions.length)return error?<p role="alert">{error}</p>:null;
 return <section className="card repeat-session"><IconLift/><div><p className="eyebrow">READY WHEN YOU ARE</p><h2>Pick up where you left off</h2><label className="field">Previous session<select value={pick||sessions[0].id} onChange={e=>setPick(e.target.value)}>{sessions.map(w=><option key={w.id} value={w.id}>{w.date} · {w.name||'Weights session'}</option>)}</select></label><p className="muted small">Exercises ready. Log each set as you do it.</p><button className="primary" disabled={busy} onClick={()=>void repeat()}>{busy?'Opening…':'Repeat session →'}</button>{error&&<p role="alert">{error}</p>}</div></section>;
}
