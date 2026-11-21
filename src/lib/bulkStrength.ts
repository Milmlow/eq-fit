import type { Repo } from '../db/repo';
import type { TrainingEntry } from './dashboardFocus';
import { sessionParts } from './trainingBalance';

/** Estimates only: no claim that Garmin recorded these muscle groups. */
export const BULK_STRENGTH_AREAS = ['Chest', 'Back', 'Shoulders', 'Legs', 'Full body'] as const;
export type StrengthArea = typeof BULK_STRENGTH_AREAS[number];

type Snapshot = { id: string; target: 'activity' | 'workout'; body_parts: string[] | undefined; applied: StrengthArea };
export type BulkStrengthUndo = Snapshot[];

/** Only imported, untagged, recognised strength sessions; never overwrite user classifications. */
export function untaggedImportedStrength(entries: TrainingEntry[]): TrainingEntry[] {
  return entries.filter(e => e.activity && e.category === 'strength' && sessionParts(e).length === 0)
    .sort((a, b) => a.date.localeCompare(b.date) || a.order.localeCompare(b.order) || a.id.localeCompare(b.id));
}
export function previewStrengthDistribution(count: number) {
  return BULK_STRENGTH_AREAS.map((part, i) => ({
    part, count: Math.floor(count / 5) + (i < count % 5 ? 1 : 0),
  }));
}
/** Single atomic write, snapshot returned for immediate undo. IDs are checked again inside the transaction. */
export async function bulkBalanceStrength(repo: Repo, entries: TrainingEntry[]): Promise<BulkStrengthUndo> {
  const eligible = untaggedImportedStrength(entries);
  if (!eligible.length) return [];
  return repo.db.transaction('rw', repo.db.activities, repo.db.workouts, async () => {
    const undo: Snapshot[] = [];
    for (let i = 0; i < eligible.length; i++) {
      const entry = eligible[i];
      const area = BULK_STRENGTH_AREAS[i % BULK_STRENGTH_AREAS.length];
      for (const [target, id] of [
        ['activity', entry.activity?.id],
        ['workout', entry.workout?.id],
      ] as const) {
        if (!id) continue;
        const table = target === 'activity' ? repo.db.activities : repo.db.workouts;
        const record = await table.get(id);
        if (!record || (record.body_parts?.length ?? 0) !== 0) throw Error('Sessions changed. Refresh before bulk categorising.');
        undo.push({ id, target, body_parts: record.body_parts ? [...record.body_parts] : undefined, applied: area });
        if (!(await table.update(id, { body_parts: [area] }))) throw Error('Session missing');
      }
    }
    return undo;
  });
}
export async function undoBulkBalanceStrength(repo: Repo, snapshots: BulkStrengthUndo): Promise<void> {
  await repo.db.transaction('rw', repo.db.activities, repo.db.workouts, async () => {
    for (const s of snapshots) {
      const table = s.target === 'activity' ? repo.db.activities : repo.db.workouts;
      const record = await table.get(s.id);
      if (!record) throw Error('Session missing');
      // Do not erase a manual change made after the bulk operation.
      if (!record.body_parts || record.body_parts.length !== 1 ||
          record.body_parts[0] !== s.applied)
        throw Error('A session was edited after allocation. Undo cancelled.');
      if (!(await table.update(s.id, { body_parts: s.body_parts }))) throw Error('Session missing');
    }
  });
}
