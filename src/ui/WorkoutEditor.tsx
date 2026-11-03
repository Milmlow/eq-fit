import { useCallback, useEffect, useRef, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise, SetRecord, Workout } from '../db/types';
import { hintText, progressionHint } from '../lib/lifting';
import { formatSet, type SetInput } from '../lib/training';
import { nextSuggestion, loadMode } from '../lib/strengthProgress';
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
  const [saving, setSaving] = useState(false);
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
    setError(null); setSaving(true);
    try { await fn(); await load(); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : String(e)); } finally { setSaving(false); }
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
      <details className="session-notes"><summary>Session name & notes</summary>
      <label className="field">Name
        <input defaultValue={workout.name} maxLength={120} onBlur={(e) => e.target.value !== workout.name && void run(() => repo.updateWorkout(workout.id, { name: e.target.value }))} />
      </label>
      <label className="field">Notes
        <textarea defaultValue={workout.notes} maxLength={2000} rows={2} onBlur={(e) => e.target.value !== workout.notes && void run(() => repo.updateWorkout(workout.id, { notes: e.target.value }))} />
      </label>
      </details>
      <p>Status: <strong>{workout.status}</strong> <Badge kind="reported" /> {workout.linked_activity_id && <span>(linked to a watch activity)</span>}</p>
      {error && <p role="alert" className="error">{error}</p>}

      {blocks.length === 0 && <p className="muted" data-testid="no-exercises">No exercises yet. Add one below (nothing is pre-filled).</p>}
      {blocks.map((b) => (
        <ExerciseBlock key={b.exercise.id} block={b} workout={workout} onAdd={async input => { await repo.addSet(workout.id, b.exercise.id, input); await load(); onChanged(); }} onRemove={(id) => run(() => repo.removeSet(id))} onEditSet={async (id, input) => { await repo.updateSet(id, input); await load(); onChanged(); }} onEditExercise={async patch => { await repo.updateExercise(b.exercise.id, patch); await load(); onChanged(); }} />
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
          ? <button className="primary" onClick={() => void run(() => repo.updateWorkout(workout.id, { status: 'done' }))} disabled={saving} >Finish session ✓</button>
          : <button onClick={() => void run(() => repo.updateWorkout(workout.id, { status: 'planned' }))}>Mark as planned</button>}
        <button className="danger" onClick={() => { if (window.confirm('Remove this workout and its sets?')) void run(async () => { await repo.removeWorkout(workout.id); onClose(); }); }}>Remove workout</button>
      </div>
    </section>
  );
}

function ExerciseBlock({ block, workout, onAdd, onRemove, onEditSet, onEditExercise }: {
  block: Block; workout: Workout;
  onAdd: (i: { load_kg: number | null; reps: number | null; rir: number | null; warmup: boolean; pain_note: string | null }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onEditSet: (id: string, input: SetInput) => Promise<void>;
  onEditExercise: (patch: { name?: string; primary_muscles?: string[]; rep_min?: number | null; rep_max?: number | null }) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const suggestion = nextSuggestion(block.prior?.sets ?? [], block.sets);
  const last = block.sets[block.sets.length - 1] ?? suggestion.working;
  const [load, setLoad] = useState(last?.load_kg?.toString() ?? '');
  const [reps, setReps] = useState(last?.reps?.toString() ?? '');
  const [rir, setRir] = useState('');
  const [warm, setWarm] = useState(false);
  const [pain, setPain] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submitLock = useRef(false);
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
    if (submitLock.current) return;
    submitLock.current = true;
    setErr(null); setSubmitting(true);
    try {
      await onAdd({ load_kg: l, reps: r, rir: ri, warmup: warm, pain_note: pain.trim() === '' ? null : pain });
      const next = nextSuggestion(block.prior?.sets ?? [], [...block.sets, { warmup: warm } as SetRecord]).working;
      setLoad(next?.load_kg?.toString() ?? load); setReps(next?.reps?.toString() ?? reps);
      setPain(''); setRir(''); setWarm(false);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Set was not saved. Retry.'); }
    finally { submitLock.current = false; setSubmitting(false); }
  }

  return (
    <div className="exercise" role="group" aria-labelledby={id}>
      <h4 id={id}>{ex.name}{ex.equipment && <span className="muted"> ({ex.equipment})</span>}</h4>
      {ex.primary_muscles.length > 0 && <p className="muted flush">Muscles: {ex.primary_muscles.join(', ')}</p>}
      <details className="prior-details"><summary>Previous session{block.prior ? ' · '+block.prior.workout.date : ''}</summary>
      <p className="prior" data-testid={`prior-${ex.name}`}>
        <strong>Last time</strong> <Badge kind="reported" />{' '}
        {block.prior
          ? <>{block.prior.workout.date}: {block.prior.sets.map((s) => formatSet(s)).join('; ')}</>
          : <span className="muted">no earlier session with this exact exercise and equipment.</span>}
      </p>
      <HintLine block={block} />
      <EditExercise ex={ex} onSave={onEditExercise} />
      </details>
      {block.sets.length > 0 && (
        <ol className="sets" aria-label={`Sets logged today for ${ex.name}`}>
          {block.sets.map((s) => (
            <li key={s.id}>
              {editing === s.id
                ? <SetEditForm set={s} onSave={async (input) => { await onEditSet(s.id, input); setEditing(null); }} onCancel={() => setEditing(null)} />
                : <>
                    <span>{formatSet(s)}{s.pain_note && <> <span className="pain">pain: {s.pain_note}</span></>}</span>
                    <span className="row gap">
                      <button aria-label={`Edit set ${s.ordinal}`} onClick={() => setEditing(s.id)}>Edit</button>
                      <button aria-label={`Remove set ${s.ordinal}`} onClick={() => void onRemove(s.id)}>Remove</button>
                    </span>
                  </>}
            </li>
          ))}
        </ol>
      )}
      <form onSubmit={(e) => void submit(e)} aria-label={`Log a set of ${ex.name}`}>
        <div className="set-compare"><span>{warm ? 'Warm-up' : 'Working set'} {block.sets.filter(s=>s.warmup===warm).length+1}</span><span>Previous: <strong>{(warm?suggestion.warmup:suggestion.working) ? formatSet((warm?suggestion.warmup:suggestion.working)!) : '—'}</strong></span></div>
        <div className="set-inputs">
          <label className="field">{loadMode(ex) === 'assisted' ? 'Assistance (kg)' : loadMode(ex) === 'bodyweight' ? 'Added load (kg, optional)' : 'Load (kg)'}<input inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value)} /></label>
          <label className="field">Reps<input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></label>
          
        </div>
        <label className="check"><input type="checkbox" checked={warm} onChange={(e) => { const isWarm=e.target.checked; setWarm(isWarm); const s=isWarm?suggestion.warmup:suggestion.working; if(s){setLoad(s.load_kg?.toString()??'');setReps(s.reps?.toString()??'');} }} /> Warm-up set</label>
        <details><summary>RIR / pain note</summary><label className="field">RIR (optional)<input inputMode="decimal" value={rir} onChange={e=>setRir(e.target.value)}/></label>
        <label className="field">Pain note (optional)<input value={pain} maxLength={500} onChange={(e) => setPain(e.target.value)} /></label>
        </details>
        {err && <p role="alert" className="error">{err}</p>}
        <button type="submit" className="primary log-set" disabled={submitting} data-workout={workout.id}>{submitting ? 'Saving…' : 'Log set ✓'}</button>
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

function HintLine({ block }: { block: Block }) {
  const h = loadMode(block.exercise) === 'external' ? progressionHint(block.exercise.rep_max ?? null, block.prior?.sets ?? []) : null;
  if (!h) {
    return block.exercise.rep_max ? null : <p className="muted flush" data-testid="no-hint">No progression hint: enter a rep range for this exercise (Edit exercise) to get one.</p>;
  }
  return <p className="hint" data-testid="hint">Progression idea <Badge kind="proposed" /> {hintText(h)}</p>;
}

function numOrNull(v: string): number | null | 'bad' {
  if (v.trim() === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : 'bad';
}

export function SetEditForm({ set, onSave, onCancel }: { set: SetRecord; onSave: (i: SetInput) => Promise<void>; onCancel: () => void }) {
  const [load, setLoad] = useState(set.load_kg?.toString() ?? '');
  const [reps, setReps] = useState(set.reps?.toString() ?? '');
  const [rir, setRir] = useState(set.rir?.toString() ?? '');
  const [warm, setWarm] = useState(set.warmup);
  const [pain, setPain] = useState(set.pain_note ?? '');
  const [err, setErr] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const l = numOrNull(load), r = numOrNull(reps), ri = numOrNull(rir);
    if (l === 'bad' || r === 'bad' || ri === 'bad') return setErr('Enter numbers only.');
    try { await onSave({ load_kg: l, reps: r, rir: ri, warmup: warm, pain_note: pain.trim() === '' ? null : pain }); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
  }
  return (
    <form className="edit-set" onSubmit={(e) => void save(e)} aria-label={`Edit set ${set.ordinal}`}>
      <div className="grid3">
        <label className="field">Load (kg)<input inputMode="decimal" value={load} onChange={(e) => setLoad(e.target.value)} /></label>
        <label className="field">Reps<input inputMode="numeric" value={reps} onChange={(e) => setReps(e.target.value)} /></label>
        <label className="field">RIR<input inputMode="decimal" value={rir} onChange={(e) => setRir(e.target.value)} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={warm} onChange={(e) => setWarm(e.target.checked)} /> Warm-up set</label>
      <label className="field">Pain note<input value={pain} maxLength={500} onChange={(e) => setPain(e.target.value)} /></label>
      {err && <p role="alert" className="error">{err}</p>}
      <div className="row gap wrap"><button type="submit" className="primary">Save set</button><button type="button" onClick={onCancel}>Cancel</button></div>
    </form>
  );
}

export function EditExercise({ ex, onSave }: { ex: Exercise; onSave: (p: { name?: string; primary_muscles?: string[]; rep_min?: number | null; rep_max?: number | null }) => Promise<void> }) {
  const [name, setName] = useState(ex.name);
  const [muscles, setMuscles] = useState(ex.primary_muscles.join(', '));
  const [mn, setMn] = useState(ex.rep_min?.toString() ?? '');
  const [mx, setMx] = useState(ex.rep_max?.toString() ?? '');
  const [err, setErr] = useState<string | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    const a = numOrNull(mn), b = numOrNull(mx);
    if (a === 'bad' || b === 'bad') return setErr('Rep range must be numbers.');
    setErr(null);
    try { await onSave({ name, primary_muscles: muscles.split(','), rep_min: a, rep_max: b }); } catch (x) { setErr(x instanceof Error ? x.message : String(x)); }
  }
  return (
    <details className="add-ex">
      <summary>Edit exercise</summary>
      <form onSubmit={(e) => void save(e)} aria-label={`Edit exercise ${ex.name}`}>
        <label className="field">Name (history is kept; equipment cannot be changed)<input value={name} maxLength={120} onChange={(e) => setName(e.target.value)} required /></label>
        <label className="field">Primary muscles (comma separated)<input value={muscles} onChange={(e) => setMuscles(e.target.value)} /></label>
        <div className="grid3">
          <label className="field">Rep range min<input inputMode="numeric" value={mn} onChange={(e) => setMn(e.target.value)} /></label>
          <label className="field">Rep range max<input inputMode="numeric" value={mx} onChange={(e) => setMx(e.target.value)} /></label>
        </div>
        {err && <p role="alert" className="error">{err}</p>}
        <button type="submit">Save exercise</button>
      </form>
    </details>
  );
}
