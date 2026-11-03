import { useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise, Activity, Workout } from '../db/types';
import type { Group } from '../lib/mapping';
import { addDays, mondayOf } from '../lib/summary';
import { trainingDays } from '../lib/progress';
import { MovementArt } from './MovementArt';
import { RunProgress } from './RunProgress';

const MOVEMENTS = [
  { name: 'Bench press', equipment: 'Barbell', muscles: ['chest'] },
  { name: 'Deadlift', equipment: 'Barbell', muscles: ['posterior chain'] },
  { name: 'Squat', equipment: 'Barbell', muscles: ['legs'] },
  { name: 'Chin-ups', equipment: 'Bodyweight', muscles: ['back'] },
];
export function TrainingMomentum({ repo, today, version, onOpen }: { repo: Repo; today: string; version: number; onOpen: (id: string) => void }) {
  const [data, setData] = useState<{ acts: (Activity & { group: Group })[]; workouts: Workout[]; exercises: Exercise[] } | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [pick, setPick] = useState<typeof MOVEMENTS[number] | null>(null);
  useEffect(() => {
    let live = true;
    Promise.all([repo.activitiesBetween(addDays(today, -65), today), repo.workoutsBetween(mondayOf(today), today), repo.listExercises()])
      .then(([acts, workouts, exercises]) => { if (live) { setData({ acts, workouts, exercises }); setError(''); } })
      .catch(() => { if (live) setError('Could not load your progress. Your saved history has not been changed.'); });
    return () => { live = false; };
  }, [repo, today, version]);
  async function open(exercise: Exercise | typeof MOVEMENTS[number]) {
    if (busy) return;
    setBusy(true); setError('');
    try {
      const ex = 'id' in exercise ? exercise : await repo.createExercise(exercise.name, exercise.equipment, exercise.muscles);
      const { workout } = await repo.openOrCreateWeightsWorkout(today);
      await repo.updateWorkout(workout.id, { planned_exercise_ids: [...new Set([ex.id, ...workout.planned_exercise_ids])] });
      setPick(null); onOpen(workout.id);
    } catch (e) { setError(`Could not open this session: ${e instanceof Error ? e.message : 'please try again'}`); }
    finally { setBusy(false); }
  }
  const days = data ? trainingDays(data.acts, data.workouts, today) : [];
  return <>
    {error && <p className="error" role="alert">{error}</p>}
    <section className="progress-panel" aria-labelledby="momentum-heading">
      <div className="visual-heading"><div><p className="eyebrow">THIS WEEK</p><h2 id="momentum-heading">Your rhythm</h2></div><div className="day-count"><strong>{data ? days.filter(d => d.recorded).length : '—'}</strong><span>training days</span></div></div>
      <div className="day-strip">{days.map((d, i) => <div key={d.date} className={`${d.recorded ? 'recorded' : ''} ${d.date === today ? 'is-today' : ''}`} aria-label={`${d.date}: ${d.future ? 'upcoming' : d.recorded ? 'training recorded' : 'no training recorded'}`}><span>{['M', 'T', 'W', 'T', 'F', 'S', 'S'][i]}</span><b>{d.recorded ? '✓' : d.future ? '·' : '—'}</b></div>)}</div>
      <h3>Pick your lift</h3><div className="quick-lifts">{MOVEMENTS.map(m => <button key={m.name} disabled={busy || !data} onClick={() => setPick(m)}><MovementArt name={m.name} /><span>{m.name}</span><span className="lift-go" aria-hidden="true">↗</span></button>)}</div>
      {pick && <div className="card"><h3>{pick.name}</h3><p className="muted">Choose an existing exercise to keep its history, or start a new one. Different equipment stays separate.</p><div className="row gap wrap">
        {data?.exercises.map(ex => <button key={ex.id} disabled={busy} onClick={() => void open(ex)}>{ex.name}{ex.equipment ? ` · ${ex.equipment}` : ''}</button>)}
        <button disabled={busy} onClick={() => void open(pick)}>Use {pick.name} · {pick.equipment}</button><button disabled={busy} onClick={() => setPick(null)}>Cancel</button>
      </div></div>}
    </section>
    {data && <RunProgress rows={data.acts} today={today} />}
  </>;
}
