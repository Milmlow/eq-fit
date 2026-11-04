import { useEffect, useState } from 'react';
import type { Exercise } from '../db/types';
import type { Repo } from '../db/repo';
import { activityPulse, type Session } from '../lib/activityPulse';
import { formatTodayLabel, paceMinSec } from '../lib/todayStats';
import { IconRun } from './Icons';
import { CoachEQ } from './CoachEQ';
import { bigFour } from '../lib/bigFour';
import { FocusDashboard } from './FocusDashboard';
import { FOCUS_OPTIONS, readFocus, saveFocus, trainingDashboard, type DashboardFocus } from '../lib/dashboardFocus';
import { MovementArt } from './MovementArt';
function Numbers({session:s}:{session:Session}) {
 return <div className="pulse-numbers">{s.kind==='run'?<><div><b>{s.activity?.distance_km?.toFixed(2)??'—'}</b><span>km</span></div><div><b>{s.activity?.duration_seconds!=null?Math.round(s.activity.duration_seconds/60):'—'}</b><span>min</span></div><div><b>{paceMinSec(s.activity?.avg_pace_sec_per_km??null)}</b><span>/ km</span></div></>:<><div><b>{s.workout?s.sets.length:'—'}</b><span>working sets</span></div><div><b>{s.workout?new Set(s.sets.map(x=>x.exercise_id)).size:'—'}</b><span>exercises</span></div></>}</div>;
}
export function ActivityPulse({repo,today,version,onOpen}:{repo:Repo;today:string;version:number;onOpen:(id:string)=>void}) {
 const [focus,setFocus]=useState<DashboardFocus>(()=>readFocus(repo.db.name,window.location.search));
 const [focusNotice,setFocusNotice]=useState('');
 const [data,setData]=useState<(ReturnType<typeof activityPulse>&{exercises:Exercise[];training:Parameters<typeof trainingDashboard>})|null>(null),[error,setError]=useState('');
 useEffect(()=>{let live=true;Promise.all([repo.activitiesBetween('0000-01-01',today),repo.db.workouts.toArray(),repo.db.sets.toArray(),repo.listExercises()]).then(([a,w,s,e])=>{if(live){setData({...activityPulse(a,w,s,e,today),exercises:e,training:[a,w,s,today,'all']});setError('');}}).catch(()=>{if(live)setError('Could not refresh recent activity. Reopen the app to retry.');});return()=>{live=false;};},[repo,today,version]);
 const dashboard=data?trainingDashboard(data.training[0],data.training[1],data.training[2],today,focus):null;
 const latestTraining=dashboard?.entries[0];
 const coachSession=focus==='running'?data?.latest:latestTraining&&(latestTraining.category==='strength'||latestTraining.category==='run')?data?.sessions.find(s=>s.id===latestTraining.id):undefined;
 return <section className="activity-pulse" aria-label="Latest activity and averages">
 <header className="pulse-brand"><h1 className="wordmark sm">EQ FIT</h1><span>{formatTodayLabel(today)}</span></header>
 <label className="focus-picker">My dashboard <select value={focus} onChange={e=>{const next=e.target.value as DashboardFocus;setFocus(next);setFocusNotice(saveFocus(repo.db.name,next)?'':'This view could not be saved on this device.');}}>{FOCUS_OPTIONS.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
 {focusNotice&&<p role="status">{focusNotice}</p>}
 {error&&<p role="alert">{error}</p>}
 {!data?<p>Loading activity…</p>:<>
 <div className="pulse-coach-layout"><div>
 {focus!=='running'&&dashboard&&<FocusDashboard data={dashboard} exercises={data.exercises} onOpen={onOpen}/>}
 {focus==='running'&&<><div className="pulse-averages"><p className="eyebrow">RUNNING · 4-WEEK AVERAGES</p><div className="pulse-numbers running-averages"><div><b>{paceMinSec(data.running.paceSecPerKm)}</b><span>pace / km</span></div><div><b>{data.weeklyKm?.toFixed(1)??'—'}</b><span>km / week</span></div></div><details><summary>Through today · Details</summary><p>{data.start} to {today}, including saved runs today. Outdoor running only; pace is distance-weighted. Weekly distance divides these 28 days by four, including rest days. Missing history is not estimated.</p></details></div>
 <section className="big-four" aria-label="Big Four personal bests"><div className="big-four-heading"><h2>Big Four</h2><span>All-time bests</span></div><div className="big-four-grid">{bigFour(data.sessions,data.exercises).map(record => <button key={record.name} className="big-four-tile" disabled={!record.best?.session.workout} onClick={() => record.best?.session.workout && onOpen(record.best.session.workout.id)} aria-label={record.best ? `${record.name}: ${record.bodyweight ? `${record.best.set.reps} reps, bodyweight` : `${record.best.set.load_kg} kilograms for ${record.best.set.reps} reps`}. Open record session` : `${record.name}: no recorded best`}><MovementArt name={record.name === 'Bench' ? 'Bench press' : record.name}/><span>{record.name}</span><strong>{record.best ? record.bodyweight ? `${record.best.set.reps} reps` : `${record.best.set.load_kg} kg` : '—'}</strong><small>{record.best ? record.bodyweight ? 'Bodyweight' : `× ${record.best.set.reps} reps · Barbell` : record.bodyweight ? 'Log bodyweight reps' : 'Log a barbell set'}</small>{record.best && <small>{formatTodayLabel(record.best.session.date)}</small>}</button>)}</div><details><summary>What counts?</summary><p>Best completed working sets in your saved history. Bench, back squat and conventional deadlift use barbell weight, with reps shown. Chin-ups use the most bodyweight reps in one set. Warm-ups, assisted or weighted chin-ups, and other equipment or lift variations stay in your history but are kept out of these records. Tap a record to see or correct its session.</p></details></section>
 {data.latest?.kind === 'run' && <div className="pulse-latest"><div className="visual-heading"><div><p className="eyebrow">LATEST RUN · {data.latest.date===today?'TODAY':formatTodayLabel(data.latest.date)}</p><h2>{data.latest.title || 'Run'}</h2></div><IconRun/></div><Numbers session={data.latest}/>{data.signal&&<details className="pulse-signal"><summary>{data.signal.title}</summary><p>{data.signal.detail}</p></details>}</div>}
 </>} </div><CoachEQ session={coachSession} today={today} scope={repo.db.name} history={data.sessions} exercises={data.exercises}/></div>
 {focus==='running'&&data.sessions.length>0&&<details className="pulse-recent"><summary>Recent activities · {Math.min(3,data.sessions.length)}</summary>{data.sessions.slice(0,3).map(s=><div key={s.id}><p><strong>{s.kind==='run'?'Run':'Lift'}</strong> · {formatTodayLabel(s.date)} · {s.title}</p><Numbers session={s}/>{s.workout&&<button onClick={()=>onOpen(s.workout!.id)}>Open session</button>}</div>)}</details>}
 </>}
 </section>;
}
