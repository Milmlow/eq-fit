import type { TrainingEntry } from './dashboardFocus';
import { BODY_PARTS } from './sessionActivity';
import { needsInput, weeklyEffort } from './weeklyEffort';
import { summariseRuns } from './running';
import { mondayOf } from './summary';

export { BODY_PARTS } from './sessionActivity';

export function sessionParts(entry: TrainingEntry): string[] {
  if (entry.category !== 'strength') return [];
  return [...new Set([...(entry.activity?.body_parts ?? []), ...(entry.workout?.body_parts ?? [])])]
    .filter(part => BODY_PARTS.includes(part));
}

export function trainingBalance(entries: TrainingEntry[], today: string) {
  const recorded = entries.filter(entry => entry.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date) || b.order.localeCompare(a.order) || a.id.localeCompare(b.id));
  const start = mondayOf(today);
  const week = recorded.filter(entry => entry.date >= start);
  const effort = weeklyEffort(week);
  const runs = summariseRuns(week.filter(entry => entry.category === 'run').map(entry => ({
    date: entry.date, group: 'outdoor_run' as const,
    distance_km: entry.activity?.distance_km ?? null,
    avg_pace_sec_per_km: entry.activity?.avg_pace_sec_per_km ?? null,
  })), start, today, true);
  const pending = recorded.filter(entry => entry.activity && needsInput(entry, sessionParts(entry)));
  const areas = BODY_PARTS.map(part => ({
    part, count: week.filter(entry => sessionParts(entry).includes(part)).length,
  }));
  return {
    start, week, effort, runs, areas, pending,
    missingDistance: runs.runs - week.filter(entry => entry.category === 'run' && entry.activity?.distance_km != null).length,
    untaggedStrength: week.filter(entry => entry.category === 'strength' && !sessionParts(entry).length).length,
    other: week.filter(entry => entry.category === 'other').length,
  };
}
