// Self-chosen weekly goals. Nothing is created by default. Pure functions; mirrored by tests/oracle/oracle_push.py.
// Weeks are Monday-Sunday. No streaks anywhere: a missed week is just a number.
import type { GoalKind, GoalRevision } from '../db/types';
import type { Group } from './mapping';
import { normaliseMuscles } from './lifting';
import { addDays, mondayOf } from './summary';

export const GOAL_KINDS: { kind: GoalKind; label: string; unit: string; template: string }[] = [
  { kind: 'lifts_per_week', label: 'Lifts per week', unit: 'lifts', template: 'Lifts per week' },
  { kind: 'runs_per_week', label: 'Runs per week', unit: 'runs', template: 'Runs per week' },
  { kind: 'km_per_week', label: 'Kilometres per week', unit: 'km', template: 'Kilometres per week' },
  { kind: 'sets_per_muscle_per_week', label: 'Working sets per muscle per week', unit: 'sets', template: 'Sets per week' },
];
export const isGoalKind = (k: string): k is GoalKind => GOAL_KINDS.some((g) => g.kind === k);
export const unitOf = (kind: GoalKind): string => GOAL_KINDS.find((g) => g.kind === kind)?.unit ?? '';

export interface GoalInput {
  kind: GoalKind;
  name: string;
  target: number;
  muscle: string | null;
  include_treadmill: boolean;
}

export function validateGoal(g: GoalInput): string[] {
  const errs: string[] = [];
  if (!isGoalKind(g.kind)) errs.push('choose a goal type');
  const name = g.name.trim();
  if (name === '') errs.push('goal name is required');
  if (name.length > 120) errs.push('goal name over 120 characters');
  if (!Number.isFinite(g.target) || g.target <= 0 || g.target > 100000) errs.push('target must be a number above 0 (up to 100000)');
  if (g.kind === 'lifts_per_week' || g.kind === 'runs_per_week' || g.kind === 'sets_per_muscle_per_week') {
    if (Number.isFinite(g.target) && !Number.isInteger(g.target)) errs.push('this target must be a whole number');
  }
  if (g.kind === 'sets_per_muscle_per_week') {
    const m = normaliseMuscles([g.muscle ?? '']);
    if (m.length === 0) errs.push('enter the muscle to count');
    if ((g.muscle ?? '').length > 60) errs.push('muscle over 60 characters');
  } else if (g.muscle !== null) errs.push('muscle only applies to sets-per-muscle goals');
  if (g.kind === 'lifts_per_week' && g.include_treadmill) errs.push('treadmill only applies to run goals');
  return errs;
}

/** The revision in force for each goal in the week starting `weekStart` (a Monday); archived goals are dropped. Oldest week first is not assumed. */
export function activeGoalsForWeek(revs: GoalRevision[], weekStart: string): GoalRevision[] {
  const by = new Map<string, GoalRevision>();
  const order = [...revs].sort((a, b) => {
    const ea = mondayOf(a.effective_from), eb = mondayOf(b.effective_from);
    return ea !== eb ? (ea < eb ? -1 : 1) : a.created_at !== b.created_at ? (a.created_at < b.created_at ? -1 : 1) : a.id < b.id ? -1 : 1;
  });
  for (const r of order) if (mondayOf(r.effective_from) <= weekStart) by.set(r.goal_id, r);
  // Display order = when the goal was first created (its root revision), so editing a goal never moves it.
  const rootAt = new Map(revs.filter((r) => r.id === r.goal_id).map((r) => [r.goal_id, r.created_at]));
  const at = (r: GoalRevision) => rootAt.get(r.goal_id) ?? r.created_at;
  return [...by.values()].filter((r) => !r.archived).sort((a, b) => (at(a) < at(b) ? -1 : at(a) > at(b) ? 1 : a.goal_id < b.goal_id ? -1 : 1));
}

export interface FactActivity { id: string; date: string; group: Group; distance_km: number | null }
export interface FactWorkout { id: string; date: string; kind: 'weights' | 'run' | 'other'; status: 'planned' | 'done'; linked_activity_id: string | null }
export interface FactSet { date: string; warmup: boolean; muscles: string[] }
export interface WeekFacts { activities: FactActivity[]; workouts: FactWorkout[]; sets: FactSet[]; latestActivityDate: string | null }

export interface GoalProgress {
  goal: GoalRevision;
  weekStart: string;
  weekEnd: string;
  value: number;
  target: number;
  /** 0..1, capped at 1 for the bar. */
  fraction: number;
  met: boolean;
  /** Watch import does not reach this week, so only logged workouts could be counted. The value is a floor, not a total. */
  partial: boolean;
}

const r2 = (x: number) => Math.round(x * 100) / 100;

/**
 * lifts  = weights-group activities in the week + done weights workouts with no linked activity (a linked workout is its activity).
 * runs   = outdoor-run activities (+ treadmill when the goal says so) + done run workouts with no linked activity.
 * km     = sum of distance over those run activities that have a distance (unknown distance adds nothing, it is not 0 km run).
 * sets   = non-warm-up sets in the week whose exercise lists the goal's muscle.
 * `partial` (lifts, runs, km): the newest imported activity is before this week, so watch data is missing, not zero.
 */
export function goalValue(g: GoalRevision, weekStart: string, f: WeekFacts): { value: number; partial: boolean } {
  const end = addDays(weekStart, 6);
  const inWeek = (d: string) => d >= weekStart && d <= end;
  const partial = g.kind !== 'sets_per_muscle_per_week' && (f.latestActivityDate === null || f.latestActivityDate < weekStart);
  if (g.kind === 'sets_per_muscle_per_week') {
    const want = normaliseMuscles([g.muscle ?? ''])[0];
    const n = f.sets.filter((s) => inWeek(s.date) && !s.warmup && normaliseMuscles(s.muscles).includes(want)).length;
    return { value: n, partial: false };
  }
  if (g.kind === 'lifts_per_week') {
    const acts = f.activities.filter((a) => inWeek(a.date) && a.group === 'weights').length;
    const wos = f.workouts.filter((w) => inWeek(w.date) && w.kind === 'weights' && w.status === 'done' && w.linked_activity_id === null).length;
    return { value: acts + wos, partial };
  }
  const groups: Group[] = g.include_treadmill ? ['outdoor_run', 'treadmill_run'] : ['outdoor_run'];
  const runs = f.activities.filter((a) => inWeek(a.date) && groups.includes(a.group));
  if (g.kind === 'runs_per_week') {
    const wos = f.workouts.filter((w) => inWeek(w.date) && w.kind === 'run' && w.status === 'done' && w.linked_activity_id === null).length;
    return { value: runs.length + wos, partial };
  }
  return { value: r2(runs.reduce((a, r) => a + (r.distance_km ?? 0), 0)), partial };
}

export function weekProgress(revs: GoalRevision[], weekStart: string, f: WeekFacts): GoalProgress[] {
  return activeGoalsForWeek(revs, weekStart).map((goal) => {
    const { value, partial } = goalValue(goal, weekStart, f);
    return { goal, weekStart, weekEnd: addDays(weekStart, 6), value, target: goal.target, fraction: Math.min(1, value / goal.target), met: value >= goal.target, partial };
  });
}

/** Neutral wording, never punitive. `isPast` = the week has finished. */
export function progressText(p: GoalProgress, isPast: boolean): string {
  const unit = unitOf(p.goal.kind);
  const v = p.goal.kind === 'km_per_week' ? p.value.toFixed(2) : String(p.value);
  const base = `${v} of ${p.target} ${unit}`;
  const tail = p.partial ? ' (watch import does not reach this week: logged workouts only)' : p.met ? ' reached' : isPast ? '' : ' so far';
  return `${base}${tail}`;
}
