import { useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise, Activity, Workout } from '../db/types';
import type { Group } from '../lib/mapping';
import { addDays, mondayOf } from '../lib/summary';
import { trainingDays } from '../lib/progress';
import { MovementArt } from './MovementArt';
import { QuickLift } from './QuickLift';
import { RunProgress } from './RunProgress';

const MOVEMENTS = [
  { name: 'Bench press', equipment: 'Barbell', muscles: ['chest'] },
  { name: 'Deadlift', equipment: 'Barbell', muscles: ['posterior chain'] },
  { name: 'Squat', equipment: 'Barbell', muscles: ['legs'] },
  { name: 'Chin-ups', equipment: 'Bodyweight', muscles: ['back'] },
];
export function TrainingMomentum({ repo, today, version, onOpen, onChanged }: { repo: Repo; today: string; version: number; onOpen: (id: string) => void; onChanged: () => void }) {
  const [data, setData] = useState<{ acts: (Activity & { group: Group })[]; workouts: Workout[]; exercises: Exercise[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [saved,setSaved]=useState<{id:string;count:number;finished:boolean}|null>(null);
  const [pick, setPick] = useState<typeof MOVEMENTS[number] | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([repo.activitiesBetween(addDays(today, -65), today), repo.workoutsBetween(mondayOf(today), today), repo.listExercises()])
      .then(([acts, workouts, exercises]) => { if (live) { setData({ acts, workouts, exercises }); setError(''); } })
      .catch(() => { if (live) setError('Could not load your progress. Your saved history has not been changed.'); });
    return () => { live = false; };
  }, [repo, today, version]);
  async function finish() {
    if (!saved || busy) return;
    setBusy(true); setError('');
    try { await repo.updateWorkout(saved.id,{status:'done'}); setSaved({...saved,finished:true}); onChanged(); }
    catch { setError('Could not finish the session. Your logged sets are saved.'); }
    finally { setBusy(false); }
  }
  const days = data ? trainingDays(data.acts, data.workouts, today) : [];
  return <>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="progress-panel" aria-labelledby="momentum-heading">
      <div className="visual-heading"><div><p className="eyebrow">THIS WEEK</p><h2 id="momentum-heading">Your rhythm</h2></div><div className="day-count"><strong>{data ? days.filter(d => d.recorded).length : '—'}</strong><span>training days</span></div></div>
      <div className="day-strip">{days.map((d, i) => <div key={d.date} className={`${d.recorded ? 'recorded' : ''} ${d.date === today ? 'is-today' : ''}`} aria-label={`${d.date}: ${d.future ? 'upcoming' : d.recorded ? 'training recorded' : 'no training recorded'}`}><span>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span><b>{d.recorded ? '✓' : d.future ? '·' : '—'}</b></div>)}</div>
      <h3>Pick your lift</h3><div className="quick-lifts">{MOVEMENTS.map(m => <button key={m.name} disabled={busy || !data} onClick={() => { setSaved(null); setPick(m); }}><MovementArt name={m.name} /><span>{m.name}</span><span className="lift-go" aria-hidden="true">↗</span></button>)}</div>
      {pick && data && <QuickLift key={pick.name} repo={repo} today={today} movement={pick} exercises={data.exercises} onClose={()=>setPick(null)} onSaved={(id,count)=>{setPick(null);setSaved({id,count,finished:false});onChanged();}} />}
      {saved&&<div className="quick-saved"><p role="status"><strong>{saved.finished?'Session finished ✓':`${saved.count} sets saved ✓`}</strong>{!saved.finished&&' Tap another lift to keep logging.'}</p><div className="row gap wrap">{!saved.finished&&<button className="primary" disabled={busy} onClick={()=>void finish()}>Finish session ✓</button>}<button onClick={()=>onOpen(saved.id)}>Edit sets</button></div></div>}

    </section>
    {data && <RunProgress rows={data.acts} today={today} />}
  </>;
}
