import { useEffect, useRef, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise, Routine, Workout } from '../db/types';
import { AddExercise } from './WorkoutEditor';
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
    return <article key={w.id} className="routine-card">
      {pictures(w.planned_exercise_ids)}<h3>{w.name || 'Weights session'}</h3>
      <p className="muted small">{w.date} · {counts.get(w.id)} {counts.get(w.id) === 1 ? 'set' : 'sets'} recorded</p>
      <button className={primary ? 'primary' : ''} disabled={busy} onClick={() => void start(undefined, w)}>{primary ? 'Repeat last workout →' : 'Repeat workout'}</button>
    </article>;
  }
  return <section className="card routines" aria-labelledby="routines-title">
    <p className="eyebrow">PICK · LOG · LAUGH</p>
    <h2 id="routines-title">Ready to lift?</h2>
    {error && <p role="alert" className="error">{error}</p>}
    {!loaded && !error && <p className="muted">Loading your workouts…</p>}
    {editing ? <RoutineForm defaultName={nextWorkoutName(routines.map(r => r.name))} key={typeof editing === 'string' ? editing : editing.id} repo={repo} routine={editing === 'new' ? undefined : editing}
      onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} /> : loaded && <>
      {pending.length > 0 ? <div className="resume-workout">
        <p className="muted small">{pending[0].name || 'Workout in progress'} · {pending[0].date === today ? 'Today' : pending[0].date}</p>
        <button className="primary start-training" onClick={() => onOpen(pending[0].id)}>Continue workout →</button>
        <p className="muted small">{counts.get(pending[0].id) ?? 0} sets saved. Pick up where you left off.</p>
      </div> : recent[0] ? repeatCard(recent[0], true) : <>
        <p className="muted">Pick an exercise. Log your first set. We’ll remember it for next time.</p>
        <button className="primary start-training" disabled={busy} onClick={() => void start()}>Start a workout →</button>
      </>}
      {(pending.length > 0 || recent.length > 0) && <button className="start-fresh" disabled={busy} onClick={() => void start()}>+ Start something different</button>}
      {routines.length > 0 && <details className="workout-choices" open={!pending.length && !recent.length}><summary>Saved workouts · {routines.length}</summary>
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
      <details className="workout-choices"><summary>Plan a workout</summary>
        <p className="muted small">Save an exercise list for later.</p>
        <button disabled={busy} onClick={() => setEditing('new')}>+ Create workout</button>
      </details>
    </>}
  </section>;
}

function RoutineForm({ repo, routine, defaultName, onSaved, onCancel }: { repo: Repo; routine?: Routine; defaultName: string; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(routine?.name ?? defaultName);
  const [ids, setIds] = useState(routine?.exercise_ids ?? []);
  const [all, setAll] = useState<Exercise[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => { void repo.listExercises().then(setAll).catch(() => setError('Could not load exercises.')); }, [repo]);
  async function save() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await repo.saveRoutine(name.trim() || defaultName, ids, routine?.id); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your draft is still here.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function move(index: number, direction: number) {
    const next = [...ids]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; setIds(next);
  }
  return <div className="routine-builder">
    <fieldset disabled={busy}>
      <legend>{routine ? 'Edit workout' : 'Create workout'}</legend>
      <details className="routine-name"><summary>{name || defaultName} · Rename</summary><label className="field">Workout name<input value={name} maxLength={120} onChange={e => setName(e.target.value)} /></label></details>
      <ol className="routine-exercises">{ids.map((id, i) => {
        const ex = all.find(e => e.id === id); const label = ex?.name ?? 'Exercise';
        return <li key={id}><MovementArt name={label} /><span><strong>{label}</strong><small>{ex?.equipment}</small></span><div className="row gap">
          <button disabled={i === 0} aria-label={`Move ${label} up`} onClick={() => move(i, -1)}>↑</button>
          <button disabled={i === ids.length - 1} aria-label={`Move ${label} down`} onClick={() => move(i, 1)}>↓</button>
          <button aria-label={`Remove ${label} from routine`} onClick={() => setIds(ids.filter(x => x !== id))}>×</button>
        </div></li>;
      })}</ol>
      <AddExercise alwaysOpen selected={all.filter(e => ids.includes(e.id))} onBusyChange={setBusy} existing={all.filter(e => !ids.includes(e.id))} initiallyOpen={!ids.length}
        onPick={async id => setIds(previous => [...new Set([...previous, id])])}
        onCreate={async (n, equipment, muscles) => { const ex = await repo.createExercise(n, equipment, muscles); setAll(await repo.listExercises()); setIds(previous => [...new Set([...previous, ex.id])]); }} />

      {error && <p role="alert" className="error">{error}</p>}
      <div className="row gap routine-save"><button className="primary" disabled={!ids.length} onClick={() => void save()}>{busy ? 'Saving…' : `Save workout${ids.length ? ` · ${ids.length}` : ''}`}</button><button onClick={onCancel}>Cancel</button></div>
    </fieldset>
  </div>;
}
