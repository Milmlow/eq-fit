import { describe, expect, it } from 'vitest';
import type { TrainingEntry } from '../src/lib/dashboardFocus';
import type { Session } from '../src/lib/activityPulse';
import type { Exercise } from '../src/db/types';
import { challenge, dayReply, reviewWeek, tribunalPrompt, verdict } from '../src/lib/tribunal';

const entry = (date: string, category: TrainingEntry['category']): TrainingEntry => ({
  id: date, date, category, order: date, title: 'Private activity title', sets: [],
});

describe('weekly Tribunal', () => {
  it('uses the selected Monday-to-Sunday window and includes walking as other cardio', () => {
    const rows = [entry('2026-11-17', 'run'), entry('2026-11-16', 'cardio'), entry('2026-11-15', 'strength'), entry('2026-11-18', 'run')];
    const current = reviewWeek(rows, [], [], '2026-11-17');
    expect(current.facts[0]).toBe('0 strength · 1 run · 1 other cardio');
    expect(dayReply(current, 'Check Tuesday.')).toContain('Private activity title');
    expect(dayReply(current, 'Check Friday')).toContain('still ahead');
    expect(dayReply(current, 'Give it to me as a headline')).toBeUndefined();
    expect(current.dailyFacts).toEqual(['2026-11-17: run', '2026-11-16: cardio']);
    expect(reviewWeek(rows, [], [], '2026-11-17', true).rows).toEqual([rows[2]]);
    expect(verdict(current, 'race')).not.toBe(verdict(current, 'foreman'));
  });

  it('keeps empty weeks neutral and offers a flexible challenge', () => {
    expect(verdict(reviewWeek([], [], [], '2026-11-17'), 'tribunal')).toContain('Nothing on the record');
    expect(challenge('variety')).toContain('route');
  });

  it('supplies verified reps from the selected week without sending raw session titles', () => {
    const exercise = { id: 'bench', name: 'Bench press', equipment: 'Barbell' } as Exercise;
    const lift = (date: string, reps: number): Session => ({
      id: date, date, order: date, kind: 'weights', title: 'Private activity title',
      workout: { status: 'done' }, sets: [{ exercise_id: 'bench', load_kg: 80, reps, warmup: false }],
    } as Session);
    const current = reviewWeek([entry('2026-11-17', 'strength')], [lift('2026-11-17', 9), lift('2026-11-13', 8)], [exercise], '2026-11-17');
    expect(current.facts.at(-1)).toContain('80 kg × 9');
    expect(current.facts.at(-1)).toContain('8 reps');
    const prompt = tribunalPrompt([...current.facts, ...current.dailyFacts], 'race', 'Check Tuesday');
    expect(prompt).toContain('Check Tuesday');
    expect(prompt).not.toContain('Private activity title');
  });
});
