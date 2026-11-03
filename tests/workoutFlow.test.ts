import { describe, expect, it } from 'vitest';
import type { SetRecord, Workout } from '../src/db/types';
import { entryDefaults, resumeExercise, workoutChoices } from '../src/lib/workoutFlow';

const workout = (id: string, date: string, status: 'planned' | 'done', ids: string[] = []): Workout => ({
  id, date, status, planned_exercise_ids: ids, kind: 'weights', name: '', notes: '', owner_id: null,
  linked_activity_id: null, created_at: `${date}T10:00:00Z`,
});
const set = (workout_id: string, exercise_id: string, ordinal: number, load_kg: number | null, reps: number | null, warmup = false): SetRecord => ({
  id: `${workout_id}-${ordinal}`, workout_id, exercise_id, ordinal, load_kg, reps, warmup,
  rir: null, pain_note: null, owner_id: null, created_at: '2026-11-03T10:00:00Z',
});

describe('low-friction workout choices', () => {
  it('resumes an interrupted older workout without changing its date; ignores stale empty drafts and future plans', () => {
    const old = workout('old', '2026-11-01', 'planned', ['bench']);
    const today = workout('today', '2026-11-03', 'planned');
    const rows = [old, today, workout('empty', '2026-10-01', 'planned'), workout('future', '2026-11-04', 'planned', ['bench'])];
    expect(workoutChoices(rows, [], '2026-11-03').pending).toEqual([old]);
    expect(old.date).toBe('2026-11-01');
  });
  it('only offers repeats with actual sets, with latest first and a short list', () => {
    const rows = Array.from({length: 7}, (_, i) => workout(String(i), `2026-10-${20 + i}`, 'done', ['bench']));
    const sets = rows.map(w => set(w.id, 'bench', 1, 50, 10));
    const result = workoutChoices([...rows, workout('empty', '2026-11-03', 'done', ['bench'])], sets, '2026-11-03');
    expect(result.recent.map(w => w.id)).toEqual(['6', '5', '4', '3', '2']);
    expect(result.counts.get('6')).toBe(1);
  });
  it('resumes the last actually logged exercise, not the first planned one', () => {
    expect(resumeExercise(['bench', 'row'], [set('a', 'bench', 1, 50, 10), set('a', 'row', 2, 40, 8)])).toBe(1);
    expect(resumeExercise(['bench'], [])).toBe(0);
  });
});

describe('next set suggestions remain separate from completion', () => {
  it('follows varying previous reps and restores the correct next set after reopening', () => {
    const prior = [set('a', 'bench', 1, 50, 10), set('a', 'bench', 2, 50, 8)];
    expect(entryDefaults(prior, [set('b', 'bench', 1, 50, 10)])).toEqual({load: '50', reps: '8'});
    expect(prior).toHaveLength(2);
  });
  it('reuses this session’s latest adjustment once previous sets run out', () => {
    expect(entryDefaults([set('a', 'bench', 1, 50, 10)], [set('b', 'bench', 1, 45, 8)])).toEqual({load: '45', reps: '8'});
  });
  it('never turns a warm-up into working-set values or fills unknown values with zero', () => {
    expect(entryDefaults([], [set('a', 'bench', 1, 20, 12, true)])).toEqual({load: '', reps: '8'});
    expect(entryDefaults([set('a', 'bench', 1, null, null)], [])).toEqual({load: '', reps: ''});
  });
});
