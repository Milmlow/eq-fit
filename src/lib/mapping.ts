// Reversible activity-type mapping. The ORIGINAL type is never changed; the mapped group is
// resolved at read time as: per-activity override > user type mapping > built-in default > 'other'.

export type Group = 'weights' | 'outdoor_run' | 'treadmill_run' | 'other';
export const GROUPS: Group[] = ['weights', 'outdoor_run', 'treadmill_run', 'other'];

export const DEFAULT_MAPPING: Readonly<Record<string, Group>> = {
  Cardio: 'weights', // explicit user assumption (reversible)
  'Strength Training': 'weights',
  Running: 'outdoor_run',
  'Treadmill Running': 'treadmill_run',
};

export function resolveGroup(
  originalType: string,
  perActivityOverride: Group | null,
  userMapping: ReadonlyMap<string, Group>,
): Group {
  return perActivityOverride ?? userMapping.get(originalType) ?? DEFAULT_MAPPING[originalType] ?? 'other';
}

export function isGroup(x: string): x is Group {
  return (GROUPS as string[]).includes(x);
}
