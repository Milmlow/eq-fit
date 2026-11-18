import { expect, it } from 'vitest';
import type { Activity, SetRecord, Workout } from '../src/db/types';
import { trainingDashboard } from '../src/lib/dashboardFocus';
import { trainingBalance } from '../src/lib/trainingBalance';
import { allocateSession } from '../src/lib/sessionActivity';
import { freshRepo } from './helpers';

const activity = (id: string, type: string, date = '2026-11-18', extra: Partial<Activity> = {}): Activity => ({
  id, original_type: type, title: type, date, timestamp_local: date + ' 07:00:00', distance_km: null,
  avg_pace_sec_per_km: null, ...extra,
} as Activity);
const overview = (activities: Activity[], workouts: Workout[] = []) =>
  trainingBalance(trainingDashboard(activities, workouts, [] as SetRecord[], '2026-11-18', 'all').entries, '2026-11-18');

it('uses the same week for distance and weighted pace and preserves missing data', () => {
  const data = overview([
    activity('a', 'Running', '2026-11-16', { distance_km: 5, avg_pace_sec_per_km: 360 }),
    activity('b', 'Treadmill Running', '2026-11-17', { distance_km: 10, avg_pace_sec_per_km: 300 }),
    activity('missing', 'Running'),
    activity('old', 'Running', '2026-11-15', { distance_km: 50, avg_pace_sec_per_km: 200 }),
    activity('future', 'Running', '2026-11-19', { distance_km: 50, avg_pace_sec_per_km: 200 }),
    activity('walk', 'Walking', '2026-11-18', { distance_km: 2, avg_pace_sec_per_km: 100 }),
  ]);
  expect(data.runs).toMatchObject({ km: 15, paceSecPerKm: 320, runs: 3, runsWithPace: 2 });
  expect(data.missingDistance).toBe(1);
  expect(overview([]).runs).toMatchObject({ km: null, paceSecPerKm: null });
});

it('presents the newest Garmin session needing input and counts linked body areas once', () => {
  const a = activity('watch', 'Strength Training', '2026-11-18', { body_parts: ['Chest', 'Back'] });
  const linked = { id: 'w', linked_activity_id: a.id, date: a.date, kind: 'weights', status: 'done',
    created_at: a.date + 'T07:00:00Z', body_parts: ['Chest'] } as Workout;
  const data = overview([
    a, activity('older', 'Cardio', '2026-11-10'),
    activity('new', 'Cardio', '2026-11-17'),
    activity('tagged', 'Strength Training', '2026-11-16', { body_parts: ['Legs'] }),
  ], [linked]);
  expect(data.pending.map(entry => entry.id)).toEqual(['new', 'older']);
  expect(data.effort.strength).toBe(2);
  expect(data.areas.find(area => area.part === 'Chest')?.count).toBe(1);
  expect(data.areas.find(area => area.part === 'Back')?.count).toBe(1);
});

it('saves classification and areas atomically for both linked records and rolls back missing rows', async () => {
  const repo = await freshRepo();
  const a = activity('watch', 'Cardio');
  await repo.db.activities.add(a);
  const workout = await repo.createWorkout({ date: a.date, name: 'Session', kind: 'other' });
  await repo.linkActivity(workout.id, a.id);
  await allocateSession(repo, { activity: a, workout }, 'Strength', ['Chest', 'Back', 'Chest']);
  expect((await repo.db.activities.get(a.id))?.body_parts).toEqual(['Chest', 'Back']);
  expect((await repo.getWorkout(workout.id))?.session_activity).toBe('Strength');
  expect((await repo.db.activities.get(a.id))?.original_type).toBe('Cardio');
  await expect(allocateSession(repo, { activity: a, workout: { ...workout, id: 'missing' } }, 'Strength', ['Legs'])).rejects.toThrow();
  expect((await repo.db.activities.get(a.id))?.body_parts).toEqual(['Chest', 'Back']);
  await expect(allocateSession(repo, { activity: a }, 'Strength', ['Made up'])).rejects.toThrow('Invalid body areas');
  repo.db.close();
});
