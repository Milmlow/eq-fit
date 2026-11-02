import type { SetRecord } from '../db/types';

export const MAX_TEXT = 500;

export function exerciseKey(name: string, equipment: string): string {
  return `${name.trim().toLowerCase().replace(/\s+/g, ' ')}|${equipment.trim().toLowerCase().replace(/\s+/g, ' ')}`;
}

export interface SetInput {
  load_kg: number | null;
  reps: number | null;
  rir: number | null;
  warmup: boolean;
  pain_note: string | null;
}

/** Returns a list of problems (empty = valid). Unknown stays null; nothing is defaulted to zero. */
export function validateSet(s: SetInput): string[] {
  const errs: string[] = [];
  if (s.load_kg !== null && (!Number.isFinite(s.load_kg) || s.load_kg < 0 || s.load_kg > 1000)) errs.push('load must be 0 to 1000 kg');
  if (s.reps !== null && (!Number.isInteger(s.reps) || s.reps < 0 || s.reps > 1000)) errs.push('reps must be a whole number 0 to 1000');
  if (s.rir !== null && (!Number.isFinite(s.rir) || s.rir < 0 || s.rir > 10 || (s.rir * 2) % 1 !== 0)) errs.push('RIR must be 0 to 10 in steps of 0.5');
  if (s.load_kg === null && s.reps === null) errs.push('enter a load or reps');
  if (s.pain_note !== null && s.pain_note.length > MAX_TEXT) errs.push(`pain note over ${MAX_TEXT} characters`);
  return errs;
}

export function validateName(label: string, v: string, required = true): string[] {
  const t = v.trim();
  if (required && t === '') return [`${label} is required`];
  if (t.length > 120) return [`${label} over 120 characters`];
  return [];
}

/** "60 kg x 8", "x 8" (no load recorded), "60 kg" (reps unknown). Never prints 0 for unknown. */
export function formatSet(s: Pick<SetRecord, 'load_kg' | 'reps' | 'rir' | 'warmup'>): string {
  const load = s.load_kg === null ? null : `${s.load_kg} kg`;
  const reps = s.reps === null ? null : `${s.reps}`;
  const core = load && reps ? `${load} x ${reps}` : load ? `${load} (reps unknown)` : `${reps} reps (load unknown)`;
  return `${s.warmup ? 'warm-up ' : ''}${core}${s.rir !== null ? ` @RIR ${s.rir}` : ''}`;
}

/** Lexicographic ordering key for workouts: date then creation time. */
export function workoutOrderKey(w: { date: string; created_at: string }): string {
  return `${w.date}|${w.created_at}`;
}
