import type { Workout } from '../db/types';
import type { Group } from './mapping';
import { addDays, mondayOf } from './summary';
import { recentCompleteWeeks, summariseRuns, type RunInput } from './running';

/** Compare the same elapsed weekdays, never a partial week against seven days. */
export function runningProgress(rows: RunInput[], today: string, treadmill = false) {
  const start = mondayOf(today);
  return {
    week: summariseRuns(rows, start, today, treadmill, 'This week'),
    month: summariseRuns(rows, `${today.slice(0, 7)}-01`, today, treadmill, 'This month'),
    previousElapsed: summariseRuns(rows, addDays(start, -7), addDays(today, -7), treadmill, 'Same days last week'),
    weeks: recentCompleteWeeks(today, 4).map(w => summariseRuns(rows, w.start, w.end, treadmill, w.start)),
  };
}

/** Count recorded training days, not an invented readiness score or unbroken daily streak. */
export function trainingDays(activities: { id: string; date: string; group: Group }[], workouts: Workout[], today: string) {
  const start = mondayOf(today);
  const recorded = new Set([
    ...activities.filter(a => a.group !== 'other').map(a => a.date),
    ...workouts.filter(w => w.status === 'done').map(w => w.date),
  ]);
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(start, i);
    return { date, future: date > today, recorded: date <= today && recorded.has(date) };
  });
}
