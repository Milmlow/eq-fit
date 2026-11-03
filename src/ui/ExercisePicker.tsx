import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Exercise } from '../db/types';
import { exerciseKey } from '../lib/training';
import { EXERCISE_CATALOG, type CatalogMovement } from '../lib/exerciseCatalog';
import { MovementArt } from './MovementArt';

export interface ExercisePickerProps {
  existing: Exercise[]; selected?: Exercise[];
  onPick: (id: string) => Promise<unknown>;
  onCreate: (name: string, equipment: string, muscles: string[]) => Promise<unknown>;
  onBusyChange?: (busy: boolean) => void;
}
export function ExercisePicker({ existing, selected = [], onPick, onCreate, onBusyChange, children }: ExercisePickerProps & { children: ReactNode }) {
  const [movement, setMovement] = useState<CatalogMovement | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const lock = useRef(false);
  const selectedKeys = new Set(selected.map(e => e.exercise_key));
  async function add(name: string, equipment: string, muscles: string[], id?: string) {
    if (lock.current || selectedKeys.has(exerciseKey(name, equipment))) return;
    lock.current = true; setBusy(true); onBusyChange?.(true); setError('');
    try {
      const exact = existing.find(e => e.exercise_key === exerciseKey(name, equipment));
      if (id || exact) await onPick(id ?? exact!.id); else await onCreate(name, equipment, muscles);
      setMovement(null); setNotice(`${name} added`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not add exercise. Try again.'); }
    finally { lock.current = false; setBusy(false); onBusyChange?.(false); }
  }
  return <div className="picture-picker">
    <p className="muted small">Tap a picture to add it.</p>
    {existing.length > 0 && <details className="your-exercises" open><summary>Your exercises</summary>
      <div className="exercise-tile-grid your-tile-grid">{[...existing].sort((a,b) => b.created_at.localeCompare(a.created_at)).map(ex => <button key={ex.id} type="button" disabled={busy} className="exercise-tile" onClick={() => void add(ex.name, ex.equipment, ex.primary_muscles, ex.id)}>
        <MovementArt name={ex.name} /><strong>{ex.name}</strong><small>{ex.equipment || 'Custom'}</small>
      </button>)}</div>
    </details>}
    <details className="more-movements" open={!existing.length}><summary>{existing.length ? 'More exercises' : 'Choose an exercise'}</summary>
    <div className="exercise-tile-grid">{EXERCISE_CATALOG.map(m => {
      const added = m.equipment.some(eq => selectedKeys.has(exerciseKey(m.name, eq)));
      const full = m.equipment.every(eq => selectedKeys.has(exerciseKey(m.name, eq)));
      return <button key={m.name} type="button" disabled={busy || full} className={`exercise-tile ${added ? 'picked' : ''}`} aria-label={`${m.name}${full ? ', added' : m.equipment.length === 1 ? ', add' : ', choose equipment'}`} onClick={() => {
        setError(''); if (m.equipment.length === 1) void add(m.name, m.equipment[0], m.muscles); else setMovement(m);
      }}><MovementArt name={m.name} /><strong>{m.name}</strong>{added && <span className="tile-tick" aria-hidden="true">✓</span>}</button>;
    })}</div>
    </details>
    <p className="picker-notice" role="status">{notice}</p>
    {error && !movement && <p role="alert" className="error">{error}</p>}
    <details className="custom-exercise"><summary>+ Add something else</summary>{children}</details>
    {movement && <EquipmentDialog movement={movement} selectedKeys={selectedKeys} busy={busy} error={error} onClose={() => setMovement(null)} onPick={eq => void add(movement.name, eq, movement.muscles)} />}
  </div>;
}
function EquipmentDialog({ movement, selectedKeys, busy, error, onPick, onClose }: {
  movement: CatalogMovement; selectedKeys: Set<string>; busy: boolean; error: string; onPick: (equipment: string) => void; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current!; el.showModal(); return () => el.close(); }, []);
  return <dialog ref={dialog} className="equipment-dialog" aria-labelledby="equipment-title" onCancel={e => { if (busy) e.preventDefault(); else onClose(); }}>
    <div className="row gap"><h2 id="equipment-title">{movement.name}</h2><button type="button" disabled={busy} onClick={onClose} aria-label="Close equipment choice">×</button></div>
    <p className="muted">Which equipment?</p>
    <div className="equipment-tiles">{movement.equipment.map(eq => {
      const added = selectedKeys.has(exerciseKey(movement.name, eq));
      return <button key={eq} type="button" disabled={busy || added} onClick={() => onPick(eq)}><EquipmentArt equipment={eq} /><strong>{eq}</strong>{added && <span>Added ✓</span>}</button>;
    })}</div>
    {error && <p role="alert" className="error">{error}</p>}
  </dialog>;
}
function EquipmentArt({ equipment }: { equipment: string }) {
  return <svg viewBox="0 0 96 80" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {equipment === 'Barbell' ? <path d="M10 40h76M18 23v34m10-42v50m40-50v50m10-42v34" /> : equipment === 'Dumbbell' ? <><path d="m21 58 45-37M12 47l18 22M20 38l18 22M57 12l18 22M65 4l18 22" /></> : equipment === 'Bodyweight' ? <><circle cx="48" cy="15" r="8" /><path d="M48 24v25M23 29l25 9 25-9M48 49 30 72m18-23 18 23" /></> : <><path d="M17 72V10h62v62M10 72h76M24 18h48M48 18v24m-14 0h28M62 51h11m-11 8h11m-11 8h11" /><circle cx="48" cy="15" r="5" /></>}
  </svg>;
}
