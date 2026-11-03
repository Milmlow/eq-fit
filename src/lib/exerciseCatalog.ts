/** Small built-in menu. Names + equipment retain the existing exact-match identity rules. */
export interface CatalogMovement { name: string; muscles: string[]; equipment: string[] }
export const EXERCISE_CATALOG: CatalogMovement[] = [
  { name: 'Bench press', muscles: ['chest'], equipment: ['Barbell', 'Dumbbell'] },
  { name: 'Squat', muscles: ['quads', 'glutes'], equipment: ['Barbell', 'Dumbbell'] },
  { name: 'Deadlift', muscles: ['hamstrings', 'glutes'], equipment: ['Barbell', 'Dumbbell'] },
  { name: 'Chin-ups', muscles: ['back', 'biceps'], equipment: ['Bodyweight', 'Assisted machine'] },
  { name: 'Row', muscles: ['back'], equipment: ['Dumbbell', 'Barbell', 'Cable'] },
  { name: 'Shoulder press', muscles: ['shoulders'], equipment: ['Dumbbell', 'Barbell'] },
  { name: 'Lat pulldown', muscles: ['back'], equipment: ['Cable'] },
  { name: 'Biceps curl', muscles: ['biceps'], equipment: ['Dumbbell', 'Barbell', 'Cable'] },
  { name: 'Triceps pushdown', muscles: ['triceps'], equipment: ['Cable'] },
  { name: 'Leg press', muscles: ['quads', 'glutes'], equipment: ['Machine'] },
  { name: 'Lateral raise', muscles: ['shoulders'], equipment: ['Dumbbell', 'Cable'] },
  { name: 'Push-ups', muscles: ['chest'], equipment: ['Bodyweight'] },
];
export function nextWorkoutName(names: string[]): string {
  const used = new Set(names.map(n => n.trim().toLowerCase()));
  let i = 1; while (used.has(`workout ${i}`)) i++;
  return `Workout ${i}`;
}
