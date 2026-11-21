import { describe, expect, it } from 'vitest';
import { previewStrengthDistribution, untaggedImportedStrength } from '../src/lib/bulkStrength';
import type { TrainingEntry } from '../src/lib/dashboardFocus';

describe('bulk strength allocation', () => {
  it('spreads 132 sessions almost evenly', () => {
    expect(previewStrengthDistribution(132)).toEqual([
      { part: 'Chest', count: 27 }, { part: 'Back', count: 27 },
      { part: 'Shoulders', count: 26 }, { part: 'Legs', count: 26 },
      { part: 'Full body', count: 26 },
    ]);
  });
  it('targets only imported untagged strength, preserving manual tags and cardio', () => {
    const mock = (id:string, category:TrainingEntry['category'], body_parts?:string[]):TrainingEntry => ({
      id, date:'2026-08-21', order:id, title:id, category, sets:[],
      activity: { id, original_type:'Strength Training', body_parts } as NonNullable<TrainingEntry['activity']>,
    });
    expect(untaggedImportedStrength([
      mock('a','strength',['Chest']), mock('b','cardio'), mock('c','strength'),
    ]).map(x=>x.id)).toEqual(['c']);
  });
});
