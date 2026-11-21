import { describe, expect, it } from 'vitest';
import { muscleHistory, isEstimatedStrength } from '../src/lib/muscleHistory';
import type { TrainingEntry } from '../src/lib/dashboardFocus';

const strength = (id: string, part: string, estimated = false, date = '2026-11-18'):TrainingEntry => ({
  id, date, order:id, title:'Strength', category:'strength', sets:[],
  activity:{id, original_type:'Strength Training', body_parts:[part], body_parts_estimated:estimated} as NonNullable<TrainingEntry['activity']>,
});
describe('muscle history', () => {
  it('separates estimated from confirmed labels without inventing records', () => {
    const rows = muscleHistory([strength('a','Chest',true),strength('b','Chest'),strength('c','Legs')], '2026-11-18');
    expect(rows.find(x=>x.part==='Chest')).toMatchObject({total:2,estimated:1,confirmed:1});
    expect(rows.find(x=>x.part==='Legs')).toMatchObject({total:1,estimated:0,confirmed:1});
    expect(rows.find(x=>x.part==='Back')).toMatchObject({total:0,estimated:0,confirmed:0});
  });
  it('excludes future and nonstrength sessions, counts multi-group workouts independently', () => {
    const mixed = strength('multi','Chest');
    mixed.activity!.body_parts=['Chest','Back'];
    const run = {...strength('run','Legs'),category:'run' as const};
    expect(muscleHistory([mixed,run,strength('future','Chest',false,'2026-11-23')],'2026-11-22')
      .map(x=>x.total)).toEqual([1,1,0,0,0]);
    expect(isEstimatedStrength(mixed)).toBe(false);
  });
});
