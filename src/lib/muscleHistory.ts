import type { TrainingEntry } from './dashboardFocus';
import { sessionParts } from './trainingBalance';
import { BULK_STRENGTH_AREAS } from './bulkStrength';

/** Report category provenance separately; estimated sessions never imply verified exercise or PR history. */
export function isEstimatedStrength(entry: TrainingEntry): boolean {
  return Boolean(entry.activity?.body_parts_estimated || entry.workout?.body_parts_estimated);
}
export function muscleHistory(entries: TrainingEntry[], today: string) {
  const strength = entries.filter(e => e.date <= today && e.category === 'strength');
  return BULK_STRENGTH_AREAS.map(part => {
    const sessions = strength.filter(e => sessionParts(e).includes(part))
      .sort((a,b) => b.date.localeCompare(a.date) || b.order.localeCompare(a.order));
    const estimated = sessions.filter(isEstimatedStrength).length;
    return { part, total: sessions.length, confirmed: sessions.length - estimated, estimated, sessions };
  });
}
