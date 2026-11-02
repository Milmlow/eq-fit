import { useCallback, useEffect, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise, SetRecord, Workout } from '../db/types';
import { formatSet } from '../lib/training';
import { Badge } from './Badge';

interface Block {
  exercise: Exercise;
  sets: SetRecord[];
  prior: { workout: Workout; sets: SetRecord[] } | null;
}

export function WorkoutEditor({ repo, workoutId, onChanged, onClose }: { repo: Repo; workoutId: string; onChanged: () => void; onClose: () => void }) {
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [all, setAll] = useState<Exercise[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const w = await repo.getWorkout(workoutId);
    if (!w) return setWorkout(null);
    const sets = await repo.setsForWorkout(w.id);
    const exercises = await repo.listExercises();
    const ids = [...new Set([...w.planned_exercise_ids, ...sets.map((s) => s.exercise_id)])];
    const bs: Block[] = [];
    for (const id of ids) {
      const exercise = exercises.find((e) => e.id === id);
      if (!exercise) continue;
      bs.push({ exercise, sets: sets.filter((s) => s.exercise_id === id), prior: await repo.priorComparable(w, id) });
    }
    setWorkout(w); setBlocks(bs); setAll(exercises);
  }, [repo, workoutId]);

  useEffect(() => { void load(); }, [load]);

  async function run(fn: () => Promise<unknown>) {
    setError(null);
    try { await fn(); await load(); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); }
  }

  if (!workout) return <p>Workout not found.</p>;
  const inWorkout = new Set(blocks.map((b) => b.exercise.id));
  const addable = all.filter((e) => !inWorkout.has(e.id));

  return (
    <section className="card" aria-label={`Workout ${workout.name || workout.kind}`}>
      <div className="row">
        <h3 className="flush">{workout.name || (workout.kind === 'run' ? 'Run' : 'Weights')} <span className="muted">({workout.date})</span></h3>
        <button onClick={onClose}>Close</button>
      </div>
      <label className="field">Name
        <input defaultValue={workout.name} maxLength={120} onBlur={(e) => e.target.value !== workout.name && void run(() => repo.updateWorkout(workout.id, { name: e.target.value }))} />
      </label>
      <label className="field">Notes
        <textarea defaultValue={workout.notes} maxLength={2000} rows={2} onBlur={(e) => e.target.value !== workout.notes && void run(() => repo.updateWorkout(workout.id, { notes: e.target.value }))} />
      </label>
      <p>Status: <strong>{workout.status}</strong> <Badge kind="reported" /> {workout.linked_activity_id && <span>(linked to a watch activity)</span>}</p>
      {error && <p role="alert" className="error">{error}</p>}

      {blocks.length === 0 && <p className="muted" data-testid="no-exercises">No exercises yet. Add one below (nothing is pre-filled).</p>}
      {blocks.map((b) => (
        <ExerciseBlock key={b.exercise.id} block={b} workout={workout} onAdd={(input) => run(() => repo.addSet(workout.id, b.exercise.id, input))} onRemove={(id) => run(() => repo.removeSet(id))} />
      ))}

      <AddExercise
        existing={addable}
        onPick={(id) => run(() => repo.updateWorkout(workout.id, { planned_exercise_ids: [...workout.planned_exercise_ids, id] }))}
        onCreate={(name, equipment, muscles) => run(async () => {
          const ex = await repo.createExercise(name, equipment, muscles);
          await repo.updateWorkout(workout.id, { planned_exercise_ids: [...new Set([...workout.planned_exercise_ids, ex.id])] });
        })}
      />

      <div className="row wrap gap">
        {workout.status === 'planned'
          ? <button className="primary" onClick={() => void run(() => repo.updateWorkout(workout.id, { status: 'done' }))}>Mark done</button>
          : <button onClick={() => void run(() => repo.updateWorkout(workout.id, { status: 'planned' }))}>Mark as planned</button>}
        <button className="danger" onClick={() => { if (window.confirm('Remove this workout and its sets?')) void run(async () => { await repo.removeWorkout(workout.id); onClose(); }); }}>Remove workout</button>
      </div>
    </section>
  );
}

function ExerciseBlock({ block, workout, onAdd, onRemove }: {
  block: Block; workout: Workout;
  onAdd: (i: { load_kg: number | null; reps: number | null; rir: number | null; warmup: boolean; pain_note: string | null }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
}) {
  const last = block.sets[block.sets.length - 1];
  const [load, setLoad] = useState(last?.load_kg?.toString() ?? '');
  const [reps, setReps] = useState(last?.reps?.toString() ?? '');
  const [rir, setRir] = useState('');
  const [warm, setWarm] = useState(false);
  const [pain, setPain] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const ex = block.exercise;
  const id = `ex-${ex.id}`;

  function numOrNull(s: string): number | null | 'bad' {
    if (s.trim() === '') return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : 'bad';
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const l = numOrNull(load), r = numOrNull(reps), ri = numOrNull(rir);
    if (l === 'bad' || r === 'bad' || ri === 'bad') return setErr('Enter numbers only.');
    setErr(null);
    await onAdd({ load_kg: l, reps: r, rir: ri, warmup: warm, pain_note: pain.trim() === '' ? null : pain });
    setPain(''); setRir(''); setWarm(false);
  }

  return (
    <div className="exercise" role="group" aria-labelledby={id}>
      <h4 id={id}>{ex.name}{ex.equipment && <span className="muted"> ({ex.equipment})</span>}</h4>
      {ex.primary_muscles.length > 0 && <p className="muted flush">Muscles: {ex.primary_muscles.join(', ')}</p>}
      <p className="prior" data-testid={`prior-${ex.name}`}>
        <strong>Last time</strong> <Badge kind="reported" />{' '}
        {block.prior
          ? <>{block.prior.workout.date}: {block.prior.sets.map((s) => formatSet(s)).join('; ')}</>
          : <span className="muted">no earlier session with this exact exercise and equipment.</span>}
      </p>
      {block.sets.length > 0 && (
        <ol className="sets" aria-label={`Sets logged today for ${ex.name}`}>
          {block.sets.map((s) => (
            <li key={s.id}>
              <span>{formatSet(s)}{s.pain_note && <> <span className="pain">pain: {s.pain_note}</span></>}</span>
              <button aria-label={`Remove set ${s.ordinal}`} onClick={() => void onRemove(s.id)}>Remove</button>
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={(e) => void submit(e)} aria-label={`Log a set of ${ex.name}`}>
        <div className="grid3">
          <label className="field">Load (kg)<input inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value)} /></label>
          <label className="field">Reps<input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></label>
          <label className="field">RIR (optional)<input inputMode="decimal" value={rir} onChange={(e) => setRir(e.target.value)} /></label>
        </div>
        <label className="check"><input type="checkbox" checked={warm} onChange={(e) => setWarm(e.target.checked)} /> Warm-up set</label>
        <label className="field">Pain note (optional)<input value={pain} maxLength={500} onChange={(e) => setPain(e.target.value)} /></label>
        {err && <p role="alert" className="error">{err}</p>}
        <button type="submit" className="primary" data-workout={workout.id}>Add set</button>
      </form>
    </div>
  );
}

function AddExercise({ existing, onPick, onCreate }: {
  existing: Exercise[]; onPick: (id: string) => Promise<void>; onCreate: (n: string, e: string, m: string[]) => Promise<void>;
}) {
  const [pick, setPick] = useState('');
  const [name, setName] = useState('');
  const [equip, setEquip] = useState('');
  const [muscles, setMuscles] = useState('');
  return (
    <details className="add-ex">
      <summary>Add exercise</summary>
      {existing.length > 0 && (
        <div className="row gap wrap">
          <label className="field grow">Existing exercise
            <select value={pick} onChange={(e) => setPick(e.target.value)}>
              <option value="">Choose...</option>
              {existing.map((e) => <option key={e.id} value={e.id}>{e.name}{e.equipment ? ` (${e.equipment})` : ''}</option>)}
            </select>
          </label>
          <button disabled={!pick} onClick={() => { void onPick(pick); setPick(''); }}>Add</button>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void onCreate(name, equip, muscles.split(',')); setName(''); setEquip(''); setMuscles(''); }}>
        <label className="field">New exercise name<input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field">Equipment (a different machine is a different exercise)<input value={equip} maxLength={120} onChange={(e) => setEquip(e.target.value)} /></label>
        <label className="field">Primary muscles (comma separated)<input value={muscles} onChange={(e) => setMuscles(e.target.value)} /></label>
        <button type="submit">Create and add</button>
      </form>
    </details>
  );
}
