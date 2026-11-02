// Loads everything the Today hero shows, from existing repository reads and pure functions. Read-only.
import type { Repo } from '../db/repo';
import { beatLastTime, type BeatResult } from './beatLastTime';
import { fourWeekPace, formatTodayLabel, lastWeekStats, type LastWeek } from './todayStats';
import { addDays } from './summary';
import type { AchievedPr } from './pr';

export interface HeroData {
  dateLabel: string;
  title: string;
  exerciseName: string | null;
  beat: BeatResult;
  lastWeek: LastWeek;
  paceSec: number | null;
  /** PRs achieved today (best set per exercise). Empty most days. */
  achieved: AchievedView[];
}

export interface AchievedView { exerciseName: string; equipment: string; load_kg: number; reps: number; e1rm: number; previousBest: number }

/** One entry per exercise: the highest-e1RM PR set dated `today`. */
export async function loadAchievedToday(repo: Repo, today: string): Promise<AchievedView[]> {
  const todays = (await repo.achievedPrs()).filter((p: AchievedPr) => p.date === today);
  const best = new Map<string, AchievedPr>();
  for (const p of todays) { const cur = best.get(p.exerciseId); if (!cur || p.e1rm > cur.e1rm) best.set(p.exerciseId, p); }
  const out: AchievedView[] = [];
  for (const p of best.values()) {
    const ex = await repo.getExercise(p.exerciseId);
    if (ex) out.push({ exerciseName: ex.name, equipment: ex.equipment, load_kg: p.load_kg, reps: p.reps, e1rm: p.e1rm, previousBest: p.previousBest });
  }
  return out.sort((a, b) => (a.exerciseName < b.exerciseName ? -1 : 1));
}

export async function loadHero(repo: Repo, today: string): Promise<HeroData> {
  const [todays, rows, latest, achieved] = await Promise.all([
    repo.workoutsBetween(today, today), repo.activitiesBetween(addDays(today, -35), today), repo.latestActivityDate(), loadAchievedToday(repo, today),
  ]);
  const statRows = rows.map((a) => ({ date: a.date, group: a.group, distance_km: a.distance_km, duration_seconds: a.duration_seconds, avg_pace_sec_per_km: a.avg_pace_sec_per_km }));
  const base = {
    dateLabel: formatTodayLabel(today),
    lastWeek: lastWeekStats(statRows, today, latest),
    paceSec: fourWeekPace(statRows, today, latest),
    achieved,
  };

  const planned = todays.find((w) => w.kind === 'weights' && w.status === 'planned');
  if (!planned) return { ...base, title: 'Weights session', exerciseName: null, beat: { kind: 'none' } };

  const own = await repo.setsForWorkout(planned.id);
  const ids = [...new Set([...planned.planned_exercise_ids, ...own.map((s) => s.exercise_id)])];
  let firstName: string | null = null;
  for (const id of ids) {
    const ex = await repo.getExercise(id);
    if (!ex) continue;
    firstName ??= ex.name;
    const prior = await repo.priorComparable(planned, id);
    if (!prior) continue;
    const history = await repo.exerciseHistory(id);
    const beat = beatLastTime({
      lastSets: prior.sets, allSets: history.flatMap((h) => h.sets), repMin: ex.rep_min ?? null, repMax: ex.rep_max ?? null,
    });
    if (beat.kind !== 'none') return { ...base, title: planned.name || 'Weights session', exerciseName: ex.name, beat };
  }
  return { ...base, title: planned.name || 'Weights session', exerciseName: firstName, beat: { kind: 'none' } };
}
