import { useEffect, useRef, useState } from 'react';
import type { Repo } from '../db/repo';
import type { Routine } from '../db/types';
import { exerciseKey } from '../lib/training';
import { saveWorkoutSelection, workoutExerciseChoices, type ExerciseChoice } from '../lib/workoutBuilder';
import { MovementArt } from './MovementArt';

export function WorkoutBuilder({ repo, routine, defaultName, today, onSaved, onCancel }: {
  repo: Repo; routine?: Routine; defaultName: string; today: string;
  onSaved: (workoutId?: string) => void; onCancel: () => void;
}) {
  const [name, setName] = useState(routine?.name ?? defaultName);
  const [choices, setChoices] = useState<ExerciseChoice[]>([]);
  const [keys, setKeys] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [expanded, setExpanded] = useState(!routine);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [customName, setCustomName] = useState('');
  const [equipment, setEquipment] = useState('');
  const [customOpen, setCustomOpen] = useState(false);
  const lock = useRef(false);
  const title = useRef<HTMLHeadingElement>(null);
  useEffect(() => { title.current?.focus(); }, []);
  useEffect(() => {
    let live = true;
    void repo.listExercises().then(exercises => {
      if (!live) return;
      const options = workoutExerciseChoices(exercises);
      const selected = (routine?.exercise_ids ?? []).map(id => options.find(x => x.id === id)?.key);
      if (selected.some(x => !x)) { setError('An exercise is missing. Reopen the workout after restoring it.'); return; }
      setChoices(options); setKeys(selected as string[]); setLoaded(true);
    }).catch(() => { if (live) setError('Could not load exercises. Please reopen this screen.'); });
    return () => { live = false; };
  }, [repo, routine]);
  function toggle(key: string) { setKeys(old => old.includes(key) ? old.filter(x => x !== key) : [...old, key]); }
  function move(index: number, direction: number) {
    setKeys(old => { const next = [...old]; [next[index], next[index + direction]] = [next[index + direction], next[index]]; return next; });
  }
  function addCustom(e: React.FormEvent) {
    e.preventDefault();
    const key = exerciseKey(customName, equipment);
    if (!customName.trim()) return;
    setChoices(old => old.some(x => x.key === key) ? old : [...old, { key, name: customName.trim(), equipment: equipment.trim(), muscles: [] }]);
    setKeys(old => old.includes(key) ? old : [...old, key]);
    setCustomName(''); setEquipment(''); setCustomOpen(false);
  }
  async function save(start: boolean) {
    if (lock.current || !loaded || !keys.length) return;
    lock.current = true; setBusy(true); setError('');
    try {
      const selected = keys.map(key => choices.find(x => x.key === key)!);
      const result = await saveWorkoutSelection(repo, name.trim() || defaultName, selected, routine?.id, start ? today : undefined);
      onSaved(result.workout?.id);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Your choices are still here.'); }
    finally { lock.current = false; setBusy(false); }
  }
  const selected = keys.map(key => choices.find(x => x.key === key)!);
  const filtered = choices.filter(x => `${x.name} ${x.equipment}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <div className="workout-builder">
    <div className="builder-heading"><h3 id="builder-title" ref={title} tabIndex={-1}>{routine ? 'Edit workout' : 'Create workout'}</h3><button disabled={busy} onClick={onCancel}>Cancel</button></div>
    <fieldset disabled={busy || !loaded}>
      <details className="builder-name"><summary>{name || defaultName}<span>Rename</span></summary><label className="field">Workout name<input value={name} maxLength={120} onChange={e => setName(e.target.value)} /></label></details>
      <h4 className="builder-section-title">In your workout <span aria-live="polite">{keys.length}</span></h4>
      {!keys.length && <p className="builder-empty">Tick exercises below. They’ll appear here.</p>}
      <div className="selected-exercise-tiles">{selected.map((ex, index) => <article key={ex.key} className="selected-exercise-tile">
        <span className="exercise-order">{index + 1}</span><button type="button" className="remove-selection" aria-label={`Remove ${ex.name} ${ex.equipment}`} onClick={() => toggle(ex.key)}>×</button>
        <MovementArt name={ex.name} /><strong>{ex.name}</strong><small>{ex.equipment || 'Custom'}</small>
      </article>)}</div>
      <div className="exercise-checklist">
        <button type="button" className="checklist-toggle" aria-expanded={expanded} aria-controls="workout-exercise-options" onClick={() => setExpanded(x => !x)}><span>{keys.length ? 'Add / remove exercises' : 'Choose exercises'}</span><span aria-hidden="true">{expanded ? '⌃' : '⌄'}</span></button>
        <div id="workout-exercise-options" hidden={!expanded}>
          <label className="field checklist-search">Find an exercise<input type="search" placeholder="Search (optional)" value={query} onChange={e => setQuery(e.target.value)} /></label>
          <div className="checklist-scroll" role="group" aria-label="Choose exercises">{filtered.map(ex => <label key={ex.key} className={`exercise-check-row ${keys.includes(ex.key) ? 'is-selected' : ''}`}>
            <input type="checkbox" checked={keys.includes(ex.key)} onChange={() => toggle(ex.key)} />
            <MovementArt name={ex.name} /><span><strong>{ex.name}</strong><small>{ex.equipment || 'Custom'}</small></span>
          </label>)}{!filtered.length && <p className="muted">No matches. Try another name or add your own below.</p>}</div>
          <button type="button" className="checklist-done" onClick={() => setExpanded(false)}>Done choosing · {keys.length}</button>
        </div>
      </div>
      {keys.length > 1 && <details className="builder-order"><summary>Change order <span aria-hidden="true">⌄</span></summary><ol>{selected.map((ex, i) => <li key={ex.key}><span>{ex.name}<small>{ex.equipment}</small></span><button type="button" disabled={i === 0} aria-label={`Move ${ex.name} ${ex.equipment} up`} onClick={() => move(i, -1)}>↑</button><button type="button" disabled={i === keys.length - 1} aria-label={`Move ${ex.name} ${ex.equipment} down`} onClick={() => move(i, 1)}>↓</button></li>)}</ol></details>}
      <details className="builder-custom" open={customOpen} onToggle={e => setCustomOpen(e.currentTarget.open)}><summary>+ Add your own exercise</summary>
        <form onSubmit={addCustom}><label className="field">Exercise name<input required value={customName} maxLength={120} onChange={e => setCustomName(e.target.value)} /></label><label className="field">Equipment (optional)<input value={equipment} maxLength={120} onChange={e => setEquipment(e.target.value)} /></label><button type="submit">Add to workout</button></form>
      </details>
      <div className={`builder-actions ${expanded ? 'choosing' : ''}`}><button type="button" className="primary" disabled={!keys.length} onClick={() => void save(false)}>{busy ? 'Saving…' : 'Save workout'}</button><button type="button" disabled={!keys.length} onClick={() => void save(true)}>Save & start →</button></div>
    </fieldset>
    {!loaded && !error && <p role="status">Loading exercises…</p>}
    {error && <p role="alert" className="error">{error}</p>}
  </div>;
}
