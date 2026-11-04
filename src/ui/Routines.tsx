import { useEffect, useRef, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise, Routine, Workout } from '../db/types';
import { WorkoutBuilder } from './WorkoutBuilder';
import './workouts.css';
import { nextWorkoutName } from '../lib/exerciseCatalog';
import { MovementArt } from './MovementArt';
import { workoutChoices } from '../lib/workoutFlow';

export function Routines({ repo, today, version, onOpen, onChanged }: {
  repo: Repo; today: string; version: number; onOpen: (id: string) => void; onChanged: () => void;
}) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pending, setPending] = useState<Workout[]>([]);
  const [recent, setRecent] = useState<Workout[]>([]);
  const [counts, setCounts] = useState<Map<string, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [showSaved, setShowSaved] = useState(false);
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<Routine | 'new' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    Promise.all([repo.listRoutines(), repo.listExercises(), repo.workoutsBetween('0000-01-01', today), repo.db.sets.toArray()])
      .then(([r, e, w, sets]) => { if (live) { const choices = workoutChoices(w, sets, today); setRoutines(r); setExercises(e); setPending(choices.pending); setRecent(choices.recent); setCounts(choices.counts); setLoaded(true); } })
      .catch(() => { if (live) setError('Could not load saved workouts. Please reopen this screen.'); });
    return () => { live = false; };
  }, [repo, today, version]);
  async function start(routine?: Routine, source?: Workout) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const w = source ? await repo.repeatWorkout(source.id, today) : routine ? await repo.startRoutine(routine.id, today) : await repo.createWorkout({ date: today, name: '', kind: 'weights' });
      onChanged(); onOpen(w.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start workout.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function pictures(ids: string[]) {
    return <div className="workout-pictures" aria-hidden="true">{ids.slice(0, 4).map(id => <MovementArt key={id} name={exercises.find(e => e.id === id)?.name ?? ''} />)}{ids.length > 4 && <span>+{ids.length - 4}</span>}</div>;
  }
  function repeatCard(w: Workout, primary = false) {
    if (primary) return <button className="primary start-training" disabled={busy} onClick={() => void start(undefined, w)}>Repeat last workout →</button>;
    return <article key={w.id} className="routine-card">
      {pictures(w.planned_exercise_ids)}<h3>{w.name || 'Weights session'}</h3>
      <p className="muted small">{w.date} · {counts.get(w.id)} {counts.get(w.id) === 1 ? 'set' : 'sets'} recorded</p>
      <button className={primary ? 'primary' : ''} disabled={busy} onClick={() => void start(undefined, w)}>{primary ? 'Repeat last workout →' : 'Repeat workout'}</button>
    </article>;
  }
  return <section className="card routines" aria-labelledby={editing ? 'builder-title' : 'routines-title'}>
    {!editing && <><h2 id="routines-title" className="sr-only">Your next workout</h2></>}
    {error && <p role="alert" className="error">{error}</p>}
    {!loaded && !error && <p className="muted">Loading your workouts…</p>}
    {editing ? <WorkoutBuilder today={today} defaultName={nextWorkoutName(routines.map(r => r.name))} key={typeof editing === 'string' ? editing : editing.id} repo={repo} routine={editing === 'new' ? undefined : editing}
      onCancel={() => setEditing(null)} onSaved={id => { setEditing(null); setShowSaved(true); setNotice('Workout saved ✓'); onChanged(); if (id) onOpen(id); }} /> : loaded && <>
      {notice && <p role="status">{notice}</p>}
      {pending.length > 0 ? <div className="resume-workout">
        <p className="muted small">{pending[0].name || 'Workout in progress'} · {pending[0].date === today ? 'Today' : pending[0].date}</p>
        <button className="primary start-training" onClick={() => onOpen(pending[0].id)}>Continue workout →</button>
        <p className="muted small">{counts.get(pending[0].id) ?? 0} sets saved. Pick up where you left off.</p>
      </div> : recent[0] ? repeatCard(recent[0], true) : <>
        <button className="primary start-training" disabled={busy} onClick={() => setEditing('new')}>Start lifting →</button>
      </>}
      <details className="workout-alternatives"><summary>Choose or create a workout <span aria-hidden="true">＋</span></summary>
      <button className={`start-fresh ${!pending.length && !recent.length ? 'primary' : ''}`} disabled={busy} onClick={() => setEditing('new')}>+ Create workout</button>
      <button className="quick-session-link" disabled={busy} onClick={() => void start()}>Quick session · no saved plan</button>
      {routines.length > 0 && <details className="workout-choices" open={showSaved || (!pending.length && !recent.length)}><summary>Saved workouts · {routines.length}</summary>
        <div className="routine-list">{routines.map(r => <article key={r.id} className="routine-card">
          {pictures(r.exercise_ids)}<h3>{r.name}</h3>
          <p className="muted small">{r.exercise_ids.length} exercises</p>
          <div className="row gap wrap"><button disabled={busy} onClick={() => void start(r)}>Start workout</button>
          <button disabled={busy} aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}>Edit</button></div>
        </article>)}</div>
      </details>}
      {(pending.length > 1 || recent.length > (pending.length ? 0 : 1)) && <details className="workout-choices"><summary>Other recent workouts</summary>
        {pending.slice(1).map(w => <button key={w.id} className="routine-resume" onClick={() => onOpen(w.id)}>Continue {w.name || 'workout'} · {w.date}</button>)}
        <div className="routine-list">{recent.slice(pending.length ? 0 : 1).map(w => repeatCard(w))}</div>
      </details>}

      </details>
    </>}
  </section>;
}
