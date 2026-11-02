// The Start button's action. Real mode reuses the Repo's single "open or create today's weights workout" logic.
// Demo mode never touches the database.
import type { Repo } from '../db/repo';

export type StartResult = { kind: 'demo' } | { kind: 'opened'; id: string; created: boolean };

export async function startToday(repo: Repo, today: string, demo: boolean): Promise<StartResult> {
  if (demo) return { kind: 'demo' };
  const { workout, created } = await repo.openOrCreateWeightsWorkout(today);
  // Never report success unless the workout can be read back.
  if (!(await repo.getWorkout(workout.id))) throw new Error('could not start the session: the workout was not saved');
  return { kind: 'opened', id: workout.id, created };
}
