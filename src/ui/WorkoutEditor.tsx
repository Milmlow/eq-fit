import { useCallback, useEffect, useRef, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Exercise, SetRecord, Workout } from '../db/types';
import { hintText, progressionHint } from '../lib/lifting';
import { formatSet, type SetInput } from '../lib/training';
import { nextSuggestion, loadMode } from '../lib/strengthProgress';
import { Badge } from './Badge';
import { SessionFinish } from './SessionFinish';
import './workouts.css';
import { ExercisePicker, type ExercisePickerProps } from './ExercisePicker';
import { NumberPicker } from './QuickLift';

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
  const [active, setActive] = useState(0);
  const [setBusy, setSetBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [routineName, setRoutineName] = useState<string | null>(null);
  const [routineMessage, setRoutineMessage] = useState('');
  const actionLock = useRef(false);
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

  async function finish() {
    if (!workout || actionLock.current) return;
    actionLock.current = true; setSaving(true); setError(null);
    try { await repo.updateWorkout(workout.id, { status: 'done' }); await load(); onChanged(); setFinished(true); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not finish session. Please retry.'); }
    finally { actionLock.current = false; setSaving(false); }
  }
  async function saveRoutine() {
    if (actionLock.current) return;
    actionLock.current = true; setSaving(true); setError(null);
    try { await repo.saveRoutine(routineName ?? workout?.name ?? '', blocks.map(b => b.exercise.id)); setRoutineMessage('Saved in Your workouts.'); onChanged(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save workout.'); }
    finally { actionLock.current = false; setSaving(false); }
  }
  if (finished) return <SessionFinish repo={repo} workoutId={workoutId} onDone={onClose} onEdit={() => setFinished(false)} />;
  if (!workout) return <p>Loading workout…</p>;
  const inWorkout = new Set(blocks.map((b) => b.exercise.id));
  const addable = all.filter((e) => !inWorkout.has(e.id));

  return (
    <section className="card focused-workout" aria-label={`Workout ${workout.name || workout.kind}`}>
      <div className="row">
        <h3 className="flush">{workout.name || (workout.kind === 'run' ? 'Run' : 'Weights')} <span className="muted">({workout.date})</span></h3>
        <button disabled={saving || setBusy} onClick={onClose}>Close</button>
      </div>
      {blocks.length > 0 && <div className="exercise-navigation">
        <label className="field">Exercise {Math.min(active + 1, blocks.length)} of {blocks.length}
          <select disabled={setBusy} value={Math.min(active, blocks.length - 1)} onChange={e => setActive(Number(e.target.value))}>{blocks.map((b, i) => <option key={b.exercise.id} value={i}>{b.exercise.name}</option>)}</select>
        </label>
      </div>}
      {error && <p role="alert" className="error">{error}</p>}

      {blocks.length === 0 && <p className="muted" data-testid="no-exercises">No exercises yet. Add one below (nothing is pre-filled).</p>}
      {blocks.map((b, index) => (
        <div key={b.exercise.id} hidden={index !== Math.min(active, blocks.length - 1)}><ExerciseBlock key={b.exercise.id} block={b} workout={workout} onBusyChange={setSetBusy} onAdd={async input => { await repo.addSet(workout.id, b.exercise.id, input); await load(); onChanged(); }} onRemove={(id) => run(() => repo.removeSet(id))} onEditSet={async (id, input) => { await repo.updateSet(id, input); await load(); onChanged(); }} onEditExercise={async patch => { await repo.updateExercise(b.exercise.id, patch); await load(); onChanged(); }} /></div>
      ))}

      {blocks.length > 1 && <div className="row gap exercise-next">
        <button disabled={active === 0 || setBusy} onClick={() => setActive(n => Math.max(0, n - 1))}>Previous</button>
        {active < blocks.length - 1 && <button className="primary" disabled={setBusy} onClick={() => setActive(n => n + 1)}>Next exercise →</button>}
      </div>}
      <AddExercise selected={blocks.map(b => b.exercise)} initiallyOpen={!blocks.length} onBusyChange={setSetBusy}
        existing={addable}
        onPick={async id => { await repo.updateWorkout(workout.id, { planned_exercise_ids: [...workout.planned_exercise_ids, id] }); await load(); onChanged(); setActive(blocks.length); }}
        onCreate={async (name, equipment, muscles) => {
          await repo.db.transaction('rw', repo.db.exercises, repo.db.workouts, async () => {
            const ex = await repo.createExercise(name, equipment, muscles);
            await repo.updateWorkout(workout.id, { planned_exercise_ids: [...new Set([...workout.planned_exercise_ids, ex.id])] });
          });
          await load(); onChanged(); setActive(blocks.length);
        }}
      />

      <details className="session-notes"><summary>Session name & notes</summary>
      <label className="field">Name
        <input defaultValue={workout.name} maxLength={120} onBlur={(e) => e.target.value !== workout.name && void run(() => repo.updateWorkout(workout.id, { name: e.target.value }))} />
      </label>
      <label className="field">Notes
        <textarea defaultValue={workout.notes} maxLength={2000} rows={2} onBlur={(e) => e.target.value !== workout.notes && void run(() => repo.updateWorkout(workout.id, { notes: e.target.value }))} />
      </label>
      </details>
      {workout.kind === 'weights' && blocks.length > 0 && <details className="save-routine"><summary>Save exercise list as a workout</summary>
        <label className="field">Workout name<input value={routineName ?? workout.name} maxLength={120} onChange={e => setRoutineName(e.target.value)} /></label>
        <button disabled={saving} onClick={() => void saveRoutine()}>Save workout</button>
        {routineMessage && <p role="status">{routineMessage}</p>}
      </details>}
      <div className="row wrap gap">
        {workout.status === 'planned'
          ? <button className="primary" onClick={() => void finish()} disabled={saving || setBusy || (workout.kind === 'weights' && !blocks.some(b => b.sets.length))} >Finish session ✓</button>
          : <button onClick={() => void run(() => repo.updateWorkout(workout.id, { status: 'planned' }))}>Mark as planned</button>}
        <details><summary>Session options</summary><button className="danger" disabled={saving || setBusy} onClick={() => { if (window.confirm('Remove this workout and its sets?')) void run(async () => { await repo.removeWorkout(workout.id); onClose(); }); }}>Remove workout</button></details>
      </div>
    </section>
  );
}

function ExerciseBlock({ block, workout, onAdd, onRemove, onEditSet, onEditExercise, onBusyChange }: {
  block: Block; workout: Workout; onBusyChange: (busy: boolean) => void;
  onAdd: (i: { load_kg: number | null; reps: number | null; rir: number | null; warmup: boolean; pain_note: string | null }) => Promise<void>;
  onRemove: (id: string) => Promise<void>;
  onEditSet: (id: string, input: SetInput) => Promise<void>;
  onEditExercise: (patch: { name?: string; primary_muscles?: string[]; rep_min?: number | null; rep_max?: number | null }) => Promise<void>;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const suggestion = nextSuggestion(block.prior?.sets ?? [], block.sets);
  const last = block.sets[block.sets.length - 1] ?? suggestion.working;
  const [load, setLoad] = useState(last?.load_kg?.toString() ?? '');
  const [reps, setReps] = useState(last?.reps?.toString() ?? '8');
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
    setErr(null); setSubmitting(true); onBusyChange(true);
    try {
      await onAdd({ load_kg: l, reps: r, rir: ri, warmup: warm, pain_note: pain.trim() === '' ? null : pain });
      const next = nextSuggestion(block.prior?.sets ?? [], [...block.sets, { warmup: warm } as SetRecord]).working;
      setLoad(next?.load_kg?.toString() ?? load); setReps(next?.reps?.toString() ?? reps);
      setPain(''); setRir(''); setWarm(false);
    } catch (e) { setErr(e instanceof Error ? e.message : 'Set was not saved. Retry.'); }
    finally { submitLock.current = false; setSubmitting(false); onBusyChange(false); }
  }

  return (
    <div className="exercise" role="group" aria-labelledby={id}>
      <h4 className="active-exercise-title" id={id}>{ex.name}{ex.equipment && <span className="muted"> ({ex.equipment})</span>}</h4>
      {block.sets.length > 0 && <div className="logged-sets" role="group" aria-label={`Sets logged today for ${ex.name}`}>
        <div className="set-table-head"><span>Set</span><span>Last time</span><span>{loadMode(ex) === 'assisted' ? 'Assist kg' : loadMode(ex) === 'bodyweight' ? '+kg' : 'kg'} × reps</span><span>Saved</span></div>
        {block.sets.map((s, index) => {
          const prior = block.prior?.sets.filter(p => p.warmup === s.warmup)[block.sets.slice(0, index).filter(p => p.warmup === s.warmup).length];
          return <div key={s.id}>
            {editing === s.id ? <><SetEditForm set={s} onSave={async input => { await onEditSet(s.id, input); setEditing(null); }} onCancel={() => setEditing(null)} /><button aria-label={`Remove set ${s.ordinal}`} onClick={() => void onRemove(s.id)}>Remove set</button></> : <>
              <div className="set-table-row"><span>{s.warmup ? 'W' : block.sets.slice(0, index + 1).filter(p => !p.warmup).length}</span><small>{prior ? `${prior.load_kg ?? '—'} × ${prior.reps ?? '—'}` : '—'}</small><strong>{s.load_kg ?? '—'} × {s.reps ?? '—'}</strong><button aria-label={`Edit set ${s.ordinal}`} onClick={() => setEditing(s.id)}>✓</button></div>
              {(s.rir !== null || s.pain_note) && <p className="muted small">{s.rir !== null && `RIR ${s.rir}`}{s.pain_note && ` · ${s.pain_note}`}</p>}

            </>}
          </div>;
        })}
      </div>}
      <form className="next-set-form" onSubmit={(e) => void submit(e)} aria-label={`Log a set of ${ex.name}`}>
        <div className="set-compare"><span>{warm ? 'Warm-up' : 'Working set'} {block.sets.filter(s=>s.warmup===warm).length+1}</span><span>Previous: <strong>{(warm?suggestion.warmup:suggestion.working) ? formatSet((warm?suggestion.warmup:suggestion.working)!) : '—'}</strong></span></div>
        {load === '' && loadMode(ex) !== 'bodyweight' && <div className="weight-shortcuts" aria-label="Weight shortcuts">{[20,40,60,80].map(kg => <button key={kg} type="button" onClick={() => setLoad(String(kg))}>{kg} kg</button>)}</div>}
        <div className="visual-set-inputs">
          <NumberPicker label={loadMode(ex) === 'assisted' ? 'Assistance (kg)' : loadMode(ex) === 'bodyweight' ? 'Added load (kg)' : 'Load (kg)'} value={load} onChange={setLoad} step={2.5} min={0} max={1000} optional />
          <NumberPicker label="Reps" value={reps} onChange={setReps} step={1} min={0} max={1000} optional />
        </div>
        <label className="check"><input type="checkbox" checked={warm} onChange={(e) => { const isWarm=e.target.checked; setWarm(isWarm); const s=isWarm?suggestion.warmup:suggestion.working; if(s){setLoad(s.load_kg?.toString()??'');setReps(s.reps?.toString()??'');} }} /> Warm-up set</label>
        <details><summary>RIR / pain note</summary><label className="field">RIR (optional)<input inputMode="decimal" value={rir} onChange={e=>setRir(e.target.value)}/></label>
        <label className="field">Pain note (optional)<input value={pain} maxLength={500} onChange={(e) => setPain(e.target.value)} /></label>
        </details>
        {err && <p role="alert" className="error">{err}</p>}
        <button type="submit" className="primary log-set" disabled={submitting} data-workout={workout.id}>{submitting ? 'Saving…' : '✓ Log completed set'}</button>
      </form>
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
    </div>
  );
}

export function AddExercise(props: ExercisePickerProps & { initiallyOpen?: boolean; alwaysOpen?: boolean }) {
  const content = <ExercisePicker {...props}><ManualExerciseForm {...props} initiallyOpen /></ExercisePicker>;
  return props.alwaysOpen ? content : <details className="add-ex" open={props.initiallyOpen || undefined}><summary>+ Add exercise</summary>{content}</details>;
}

function ManualExerciseForm({ existing, onPick, onCreate, initiallyOpen = false, onBusyChange }: {
  existing: Exercise[]; onPick: (id: string) => Promise<unknown>; onCreate: (n: string, e: string, m: string[]) => Promise<unknown>; initiallyOpen?: boolean; onBusyChange?: (busy: boolean) => void;
}) {
  const [pick, setPick] = useState('');
  const [name, setName] = useState('');
  const [equip, setEquip] = useState('');
  const [muscles, setMuscles] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function add(create: boolean) {
    if (lock.current) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setError('');
    try {
      if (create) { await onCreate(name, equip, muscles.split(',')); setName(''); setEquip(''); setMuscles(''); }
      else { await onPick(pick); setPick(''); }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add exercise. Your entry is still here.'); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <details className="add-ex" open={initiallyOpen || undefined}>
    <summary>Custom exercise details</summary>
    <fieldset disabled={busy}>
      {existing.length > 0 && <div className="row gap wrap">
        <label className="field grow">Your exercises<select value={pick} onChange={e => setPick(e.target.value)}>
          <option value="">Choose...</option>{existing.map(e => <option key={e.id} value={e.id}>{e.name}{e.equipment ? ` (${e.equipment})` : ''}</option>)}
        </select></label><button disabled={!pick} onClick={() => void add(false)}>Add</button>
      </div>}
      <form onSubmit={e => { e.preventDefault(); void add(true); }}>
        <label className="field">New exercise name<input value={name} maxLength={120} onChange={e => setName(e.target.value)} required /></label>
        <label className="field">Equipment<input value={equip} maxLength={120} placeholder="e.g. Barbell or cable machine" onChange={e => setEquip(e.target.value)} /></label>
        <details><summary>Muscles (optional)</summary><label className="field">Primary muscles<input value={muscles} onChange={e => setMuscles(e.target.value)} placeholder="e.g. chest, triceps" /></label></details>
        <button type="submit">Create and add</button>
      </form>
      {error && <p role="alert" className="error">{error}</p>}
    </fieldset>
  </details>;
}

function HintLine({ block }: { block: Block }) {
  if (loadMode(block.exercise) !== 'external') return <p className="muted small">Compare your recorded reps and load; no automatic load increase is suggested for this equipment.</p>;
  const h = progressionHint(block.exercise.rep_max ?? null, block.prior?.sets ?? []);
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
