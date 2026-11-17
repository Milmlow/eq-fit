import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Exercise } from '../db/types';
import type { Repo } from '../db/repo';
import { activityPulse, type Session } from '../lib/activityPulse';
import { formatTodayLabel, paceMinSec } from '../lib/todayStats';
import { HomeMasthead } from './HomeMasthead';
import { IconRun } from './Icons';
import { CoachEQ } from './CoachEQ';
import { MyFour } from './MyFour';
import { FreeTraining } from './FreeTraining';
import { reviewWeek } from '../lib/tribunal';
import { Tribunal } from './Tribunal';
import { FocusDashboard } from './FocusDashboard';
import { FOCUS_OPTIONS, readFocus, saveFocus, trainingDashboard, type DashboardFocus } from '../lib/dashboardFocus';

function Numbers({session:s}:{session:Session}) {
 return <div className="pulse-numbers">{s.kind==='run'?<><div><b>{s.activity?.distance_km?.toFixed(2)??'—'}</b><span>km</span></div><div><b>{s.activity?.duration_seconds!=null?Math.round(s.activity.duration_seconds/60):'—'}</b><span>min</span></div><div><b>{paceMinSec(s.activity?.avg_pace_sec_per_km??null)}</b><span>/ km</span></div></>:<><div><b>{s.workout?s.sets.length:'—'}</b><span>working sets</span></div><div><b>{s.workout?new Set(s.sets.map(x=>x.exercise_id)).size:'—'}</b><span>exercises</span></div></>}</div>;
}
export function ActivityPulse({repo,today,version,onOpen,onChanged,trainingAction}:{repo:Repo;today:string;version:number;onOpen:(id:string)=>void;onChanged:()=>void;trainingAction?:ReactNode}) {
 const [focus,setFocus]=useState<DashboardFocus>(()=>readFocus(repo.db.name,window.location.search));
 const [focusNotice,setFocusNotice]=useState('');
 const [data,setData]=useState<(ReturnType<typeof activityPulse>&{exercises:Exercise[];training:Parameters<typeof trainingDashboard>})|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;Promise.all([repo.activitiesBetween('0000-01-01',today),repo.db.workouts.toArray(),repo.db.sets.toArray(),repo.listExercises()]).then(([a,w,s,e])=>{if(live){setData({...activityPulse(a,w,s,e,today),exercises:e,training:[a,w,s,today,'all']});setError('');}}).catch(()=>{if(live)setError('Could not refresh recent activity. Reopen the app to retry.');});return()=>{live=false;};},[repo,today,version]);
 const dashboard=data?trainingDashboard(data.training[0],data.training[1],data.training[2],today,focus):null;
 const tribunalWeeks = useMemo(() => {
  if (!data) return null;
  const entries = trainingDashboard(...data.training).entries;
  return {
   current: reviewWeek(entries, data.sessions, data.exercises, today),
   previous: reviewWeek(entries, data.sessions, data.exercises, today, true),
  };
 }, [data, today]);
 const latestTraining=dashboard?.entries[0];
 const coachSession=focus==='running'?data?.latest:latestTraining&&(latestTraining.category==='strength'||latestTraining.category==='run')?data?.sessions.find(s=>s.id===latestTraining.id):undefined;
 const weeklyStats = tribunalWeeks?.current.rows.reduce((stats, row) => {
  if (row.category === 'strength') stats.strength++;
  if (row.category === 'cardio' || row.category === 'run') stats.cardio++;
  return stats;
 }, { strength: 0, cardio: 0 });
 return <section className="activity-pulse" aria-label="Home training overview">
 <HomeMasthead today={today} stats={weeklyStats}>{trainingAction}</HomeMasthead>
 {focusNotice&&<p role="status">{focusNotice}</p>}
 {error&&<p role="alert">{error}</p>}
 {!data?<p>Loading activity…</p>:<>
 {tribunalWeeks && <Tribunal {...tribunalWeeks} />}
 <details className="card home-secondary">
 <summary>Training details</summary>
 <label className="focus-picker">My dashboard <select value={focus} onChange={e=>{const next=e.target.value as DashboardFocus;setFocus(next);setFocusNotice(saveFocus(repo.db.name,next)?'':'This view could not be saved on this device.');}}>{FOCUS_OPTIONS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
 <CoachEQ session={coachSession} today={today} scope={repo.db.name} history={data.sessions} exercises={data.exercises}/>
 {focus==='free'&&<MyFour key={repo.db.name} repo={repo} today={today} sessions={data.sessions} exercises={data.exercises} onOpen={onOpen} onChanged={onChanged} checkIn={focus==='free'}/>}
 <div className="pulse-training-layout"><div>
 {focus!=='running'&&focus!=='free'&&dashboard&&<FocusDashboard data={dashboard} exercises={data.exercises} onOpen={onOpen}/>}
 {focus==='free'&&dashboard&&<FreeTraining repo={repo} today={today} entries={dashboard.entries} days={dashboard.days} onChanged={onChanged}/>}
 {(focus==='running'||focus==='free')&&<><div className="pulse-averages"><p className="eyebrow">RUNNING · 4-WEEK AVERAGES</p><div className="pulse-numbers running-averages"><div><b>{paceMinSec(data.running.paceSecPerKm)}</b><span>pace / km</span></div><div><b>{data.weeklyKm?.toFixed(1)??'—'}</b><span>km / week</span></div></div><details><summary>Through today · Details</summary><p>{data.start} to {today}, including saved runs today. Outdoor running only; pace is distance-weighted. Weekly distance divides these 28 days by four, including rest days. Missing history is not estimated.</p></details></div>
 {data.latest?.kind === 'run' && <div className="pulse-latest"><div className="visual-heading"><div><p className="eyebrow">LATEST RUN · {data.latest.date===today?'TODAY':formatTodayLabel(data.latest.date)}</p><h2>{data.latest.title || 'Run'}</h2></div><IconRun/></div><Numbers session={data.latest}/>{data.signal&&<details className="pulse-signal"><summary>{data.signal.title}</summary><p>{data.signal.detail}</p></details>}</div>}
 </>}{focus!=='free'&&<MyFour key={repo.db.name} repo={repo} today={today} sessions={data.sessions} exercises={data.exercises} onOpen={onOpen} onChanged={onChanged}/>} </div></div>
 {focus==='running'&&data.sessions.length>0&&<details className="pulse-recent"><summary>Recent activities · {Math.min(3,data.sessions.length)}</summary>{data.sessions.slice(0,3).map(s=><div key={s.id}><p><strong>{s.kind==='run'?'Run':'Lift'}</strong> · {formatTodayLabel(s.date)} · {s.title}</p><Numbers session={s}/>{s.workout&&<button onClick={()=>onOpen(s.workout!.id)}>Open session</button>}</div>)}</details>}
 </details>
 </>}
 </section>;
}
