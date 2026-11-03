import { useEffect, useRef, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise, Routine, Workout } from '../db/types';
import { AddExercise } from './WorkoutEditor';
import './workouts.css';

export function Routines({ repo, today, version, onOpen, onChanged }: {
  repo: Repo; today: string; version: number; onOpen: (id: string) => void; onChanged: () => void;
}) {
  const [routines, setRoutines] = useState<Routine[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pending, setPending] = useState<Workout[]>([]);
  const [editing, setEditing] = useState<Routine | 'new' | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  useEffect(() => {
    let live = true;
    Promise.all([repo.listRoutines(), repo.listExercises(), repo.workoutsBetween(today, today)])
      .then(([r, e, w]) => { if (live) { setRoutines(r); setExercises(e); setPending(w.filter(x => x.kind === 'weights' && x.status === 'planned')); } })
      .catch(() => { if (live) setError('Could not load saved workouts. Please reopen this screen.'); });
    return () => { live = false; };
  }, [repo, today, version]);
  async function start(routine?: Routine) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const w = routine ? await repo.startRoutine(routine.id, today) : await repo.createWorkout({ date: today, name: '', kind: 'weights' });
      onChanged(); onOpen(w.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start workout.'); }
    finally { lock.current = false; setBusy(false); }
  }
  return <section className="card routines" aria-labelledby="routines-title">
    <p className="eyebrow">PICK · LOG · LAUGH</p>
    <h2 id="routines-title">Your workouts</h2>
    {error && <p role="alert" className="error">{error}</p>}
    {editing ? <RoutineForm key={typeof editing === 'string' ? editing : editing.id} repo={repo} routine={editing === 'new' ? undefined : editing}
      onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} /> : <>
      {pending.map(w => <button key={w.id} className="routine-resume" onClick={() => onOpen(w.id)}>Continue {w.name || 'weights session'} →</button>)}
      {!routines.length && <p className="muted">Save your exercise list once. Next time, it’s ready.</p>}
      <div className="routine-list">{routines.map(r => <article key={r.id} className="routine-card">
        <h3>{r.name}</h3><p className="muted">{r.exercise_ids.map(id => exercises.find(e => e.id === id)?.name ?? 'Missing exercise').join(' · ')}</p>
        <div className="row gap wrap"><button className="primary" disabled={busy} onClick={() => void start(r)}>Start workout</button>
        <button disabled={busy} aria-label={`Edit ${r.name}`} onClick={() => setEditing(r)}>Edit</button></div>
      </article>)}</div>
      <div className="row gap wrap"><button disabled={busy} onClick={() => setEditing('new')}>+ Create workout</button>
      <button disabled={busy} onClick={() => void start()}>Start empty workout</button></div>
    </>}
  </section>;
}

function RoutineForm({ repo, routine, onSaved, onCancel }: { repo: Repo; routine?: Routine; onSaved: () => void; onCancel: () => void }) {
  const [name, setName] = useState(routine?.name ?? '');
  const [ids, setIds] = useState(routine?.exercise_ids ?? []);
  const [all, setAll] = useState<Exercise[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  useEffect(() => { void repo.listExercises().then(setAll).catch(() => setError('Could not load exercises.')); }, [repo]);
  async function save() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try { await repo.saveRoutine(name, ids, routine?.id); onSaved(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your draft is still here.'); }
    finally { lock.current = false; setBusy(false); }
  }
  function move(index: number, direction: number) {
    const next = [...ids]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; setIds(next);
  }
  return <div className="routine-builder">
    <fieldset disabled={busy}>
      <legend>{routine ? 'Edit workout' : 'Create workout'}</legend>
      <label className="field">Workout name<input autoFocus value={name} maxLength={120} placeholder="Tom’s Push Day" onChange={e => setName(e.target.value)} /></label>
      <ol className="routine-exercises">{ids.map((id, i) => {
        const ex = all.find(e => e.id === id); const label = ex?.name ?? 'Exercise';
        return <li key={id}><span><strong>{label}</strong><small>{ex?.equipment}</small></span><div className="row gap">
          <button disabled={i === 0} aria-label={`Move ${label} up`} onClick={() => move(i, -1)}>↑</button>
          <button disabled={i === ids.length - 1} aria-label={`Move ${label} down`} onClick={() => move(i, 1)}>↓</button>
          <button aria-label={`Remove ${label} from routine`} onClick={() => setIds(ids.filter(x => x !== id))}>×</button>
        </div></li>;
      })}</ol>
      <AddExercise onBusyChange={setBusy} existing={all.filter(e => !ids.includes(e.id))} initiallyOpen={!ids.length}
        onPick={async id => setIds(previous => [...new Set([...previous, id])])}
        onCreate={async (n, equipment, muscles) => { const ex = await repo.createExercise(n, equipment, muscles); setAll(await repo.listExercises()); setIds(previous => [...new Set([...previous, ex.id])]); }} />
      <p className="muted small">Exercise list only. Log actual sets when you train.</p>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="row gap"><button className="primary" disabled={!name.trim() || !ids.length} onClick={() => void save()}>{busy ? 'Saving…' : 'Save workout'}</button><button onClick={onCancel}>Cancel</button></div>
    </fieldset>
  </div>;
}
