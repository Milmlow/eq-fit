import type { TrainingEntry } from './dashboardFocus';
import { weeklyEffort } from './weeklyEffort';
import { mondayOf } from './summary';

export const HOME_DESIGNS = [
  { id: 'pit-lane', label: 'Pit Lane', title: 'Ready to race.' },
  { id: 'front-page', label: 'Front Page', title: 'The training edition.' },
  { id: 'after-hours', label: 'After Hours', title: 'Night shift.' },
] as const;
export type HomeDesign = typeof HOME_DESIGNS[number];

export function readHomeDesign(storage: Pick<Storage, 'getItem'> | null): HomeDesign {
  try {
    return HOME_DESIGNS.find(design => design.id === storage?.getItem('eqfit.home-design')) ?? HOME_DESIGNS[0];
  } catch {
    return HOME_DESIGNS[0];
  }
}

export function homeOverview(entries: TrainingEntry[], today: string) {
  const start = mondayOf(today);
  const week = entries.filter(entry => entry.date >= start && entry.date <= today);
  const recent = entries.filter(entry => entry.date <= today).slice(0, 3);
  const runs = entries.filter(entry => entry.date <= today && entry.category === 'run').slice(0, 3);
  const effort = weeklyEffort(week);
  return {
    start, week, recent, runs, effort,
    workingSets: week.filter(entry => entry.category === 'strength').reduce((total, entry) => total + entry.sets.filter(set => !set.warmup).length, 0),
  };
}
