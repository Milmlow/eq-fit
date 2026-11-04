import type { Exercise } from '../db/types';
import { trainingDashboard } from '../lib/dashboardFocus';
import { formatTodayLabel } from '../lib/todayStats';
export function FocusDashboard({data,exercises,onOpen}:{data:ReturnType<typeof trainingDashboard>;exercises:Exercise[];onOpen:(id:string)=>void}) {
 const lift=data.entries.find(e=>e.category==='strength'&&e.sets.length);
 return <section className="focus-dashboard" aria-label="Your training dashboard">
 <p className="eyebrow">YOUR WEEK · MONDAY TO TODAY</p>
 <div className="focus-stats"><div><strong>{data.strength}</strong><span>strength sessions</span></div><div><strong>{data.cardio}</strong><span>cardio sessions</span></div><div><strong>{data.minutes??'—'}</strong><span>recorded minutes</span></div><div><strong>{data.days}</strong><span>active days</span></div></div>
 {data.missingDuration>0&&<p className="muted small">{data.missingDuration} session{data.missingDuration===1?' has':'s have'} no recorded duration. Minutes include timed sessions only.</p>}
 {data.week.length===0&&<p>No sessions recorded this week yet. Your next session starts here.</p>}
 <details className="focus-details"><summary>Logged lifting · {data.workingSets} working sets this week</summary>
 {lift?<><p>Latest logged lift · {formatTodayLabel(lift.date)}</p>{lift.sets.slice(0,6).map(s=><p key={s.id}>{exercises.find(e=>e.id===s.exercise_id)?.name??'Exercise'} · {s.load_kg===null?'Weight not logged':`${s.load_kg} kg`} × {s.reps??'—'} reps</p>)}<button onClick={()=>onOpen(lift.workout!.id)}>Open lift</button></>:<p>Log sets in Lift to see weights and reps here. Garmin activity summaries include session time, not individual sets.</p>}</details>
 <h2>Recent training</h2>
 {data.entries.length===0?<p>Import Garmin activities or log a strength session to get started.</p>:data.entries.slice(0,3).map(e=><article className="focus-session" key={e.id}><div><strong>{e.title}</strong><small>{e.category==='strength'?'Strength':e.category==='run'?'Run':e.category==='cardio'?'Cardio':'Training'} · {formatTodayLabel(e.date)}</small></div><div><b>{e.activity?.duration_seconds!=null?`${Math.round(e.activity.duration_seconds/60)} min`:e.sets.length?`${e.sets.length} sets`:'Time not recorded'}</b>{e.activity?.avg_hr!=null&&<small>{e.activity.avg_hr} bpm avg</small>}</div>{e.workout&&<button onClick={()=>onOpen(e.workout!.id)}>Open</button>}</article>)}
 </section>;
}
