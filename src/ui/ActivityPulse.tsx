import { useEffect, useState } from 'react';
import type { Exercise } from '../db/types';
import type { Repo } from '../db/repo';
import { activityPulse, type Session } from '../lib/activityPulse';
import { formatTodayLabel, paceMinSec } from '../lib/todayStats';
import { IconRun, IconLift } from './Icons';
import { CoachEQ } from './CoachEQ';
function Numbers({session:s}:{session:Session}) {
 return <div className="pulse-numbers">{s.kind==='run'?<><div><b>{s.activity?.distance_km?.toFixed(2)??'—'}</b><span>km</span></div><div><b>{s.activity?.duration_seconds!=null?Math.round(s.activity.duration_seconds/60):'—'}</b><span>min</span></div><div><b>{paceMinSec(s.activity?.avg_pace_sec_per_km??null)}</b><span>/ km</span></div></>:<><div><b>{s.workout?s.sets.length:'—'}</b><span>working sets</span></div><div><b>{s.workout?new Set(s.sets.map(x=>x.exercise_id)).size:'—'}</b><span>exercises</span></div></>}</div>;
}
export function ActivityPulse({repo,today,version,onOpen}:{repo:Repo;today:string;version:number;onOpen:(id:string)=>void}) {
 const [data,setData]=useState<(ReturnType<typeof activityPulse>&{exercises:Exercise[]})|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;Promise.all([repo.activitiesBetween('0000-01-01',today),repo.db.workouts.toArray(),repo.db.sets.toArray(),repo.listExercises()]).then(([a,w,s,e])=>{if(live){setData({...activityPulse(a,w,s,e,today),exercises:e});setError('');}}).catch(()=>{if(live)setError('Could not refresh recent activity. Reopen the app to retry.');});return()=>{live=false;};},[repo,today,version]);
 return <section className="activity-pulse" aria-label="Latest activity and averages">
 <header className="pulse-brand"><h1 className="wordmark sm">EQ FIT</h1><span>{formatTodayLabel(today)}</span></header>
 {error&&<p role="alert">{error}</p>}
 {!data?<p>Loading activity…</p>:<>
 <div className="pulse-coach-layout"><div>
 {data.latest?<div className="pulse-latest"><div className="visual-heading"><div><p className="eyebrow">LATEST · {data.latest.date===today?'TODAY':formatTodayLabel(data.latest.date)}</p><h2>{data.latest.kind==='run'?'Run':'Lifting'} completed ✓</h2></div>{data.latest.kind==='run'?<IconRun/>:<IconLift/>}</div><Numbers session={data.latest}/>
 {data.signal&&<details className="pulse-signal"><summary>{data.signal.title}</summary><p>{data.signal.detail}</p></details>}
 <details><summary>Session details</summary><p>{data.latest.title} · {data.latest.date}</p>{data.latest.activity&&<p>{data.latest.activity.timestamp_local} · {data.latest.activity.original_type}</p>}{data.latest.workout&&<button onClick={()=>onOpen(data.latest!.workout!.id)}>View / edit sets</button>}</details></div>:<div className="pulse-latest"><h2>Your next session starts here</h2><p>Log a lift or import a run to build your picture.</p></div>}
 <div className="pulse-averages"><p className="eyebrow">ROLLING 4-WEEK AVERAGES</p><div className="pulse-numbers"><div><b>{paceMinSec(data.running.paceSecPerKm)}</b><span>run pace / km</span></div><div><b>{data.weeklyKm?.toFixed(1)??'—'}</b><span>run km / week</span></div><div><b>{data.weeklyLifts.toFixed(1)}</b><span>lifts / week</span></div></div><details><summary>Through today · Details</summary><p>{data.start} to {today}, including saved activities today. Outdoor running only; pace is distance-weighted. Weekly totals divide these 28 days by four, including rest days. Missing history is not estimated. Linked watch activities count once. Lifting sets remain on this device.</p></details></div>
 </div><CoachEQ session={data.latest} today={today} scope={repo.db.name} history={data.sessions} exercises={data.exercises}/></div>
 {data.sessions.length>1&&<details className="pulse-recent"><summary>Recent activities · {Math.min(3,data.sessions.length-1)} more</summary>{data.sessions.slice(1,4).map(s=><div key={s.id}><p><strong>{s.kind==='run'?'Run':'Lift'}</strong> · {formatTodayLabel(s.date)} · {s.title}</p><Numbers session={s}/>{s.workout&&<button onClick={()=>onOpen(s.workout!.id)}>Open session</button>}</div>)}</details>}
 </>}
 </section>;
}
