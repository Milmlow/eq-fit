// Demo values for screenshots only. These are the designer's reference values, NOT Royce's data.
import type { HeroData } from './hero';

export function demoFromSearch(search: string): boolean {
  return new URLSearchParams(search).get('demo') === '1';
}

export const DEMO_HERO: HeroData = {
  dateLabel: 'Mon 2 Nov',
  title: 'Weights session',
  exerciseName: 'Bench Press',
  beat: {
    kind: 'target',
    last: { load_kg: 80, reps: 8 },
    target: { load_kg: 80, reps: 9, progressed: false },
    alternative: { load_kg: 82.5, reps: 6 },
    pr: true,
  },
  lastWeek: { start: '2026-10-26', end: '2026-11-01', lifts: 5, runs: 3, km: 26.49 },
  paceSec: 349,
};
