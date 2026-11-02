// CSV export (workouts/sets and running periods). Text cells are guarded against spreadsheet formula injection:
// a text cell that starts with = + - @ tab or CR gets a leading apostrophe. Numbers are written as numbers (they cannot be formulas).
import type { Exercise, SetRecord, Workout } from '../db/types';
import { lastCompleteMonth, recentCompleteWeeks, summariseRuns, type RunInput } from './running';
import { workoutOrderKey } from './training';

const BOM = String.fromCharCode(0xfeff);
export type CsvCell = string | number | boolean | null | undefined;

export function guardCell(s: string): string {
  return s !== '' && '=+-@\t\r'.includes(s[0]) ? `'${s}` : s;
}

function field(v: CsvCell): string {
  if (v === null || v === undefined) return '';
  const text = typeof v === 'string' ? guardCell(v) : typeof v === 'boolean' ? (v ? 'true' : 'false') : String(v);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** CRLF line endings and a UTF-8 BOM, so Excel opens it as UTF-8. Unknown values stay blank (never 0). */
export function toCsv(header: string[], rows: CsvCell[][]): string {
  return `${BOM}${[header, ...rows].map((r) => r.map(field).join(',')).join('\r\n')}\r\n`;
}

export const SETS_HEADER = ['workout_date', 'workout_name', 'workout_kind', 'workout_status', 'workout_notes', 'exercise', 'equipment', 'set_number', 'load_kg', 'reps', 'rir', 'warmup', 'pain_note'];

/** One row per logged set; a workout with no sets still gets one row (exercise and set columns blank). */
export function setsCsv(workouts: Workout[], exercises: Exercise[], sets: SetRecord[]): string {
  const ex = new Map(exercises.map((e) => [e.id, e]));
  const rows: CsvCell[][] = [];
  for (const w of [...workouts].sort((a, b) => (workoutOrderKey(a) < workoutOrderKey(b) ? -1 : workoutOrderKey(a) > workoutOrderKey(b) ? 1 : 0))) {
    const head: CsvCell[] = [w.date, w.name, w.kind, w.status, w.notes];
    const mine = sets.filter((s) => s.workout_id === w.id).sort((a, b) => a.ordinal - b.ordinal);
    if (mine.length === 0) rows.push([...head, null, null, null, null, null, null, null, null]);
    for (const s of mine) {
      const e = ex.get(s.exercise_id);
      rows.push([...head, e?.name ?? null, e?.equipment ?? null, s.ordinal, s.load_kg, s.reps, s.rir, s.warmup, s.pain_note]);
    }
  }
  return toCsv(SETS_HEADER, rows);
}

export const RUNNING_HEADER = ['period', 'start', 'end', 'treadmill_included', 'runs', 'runs_with_pace', 'km', 'pace_sec_per_km'];

/** The Run tab's periods (4 complete weeks, their union, last complete month), once outdoor-only and once with treadmill. */
export function runningCsv(rows: RunInput[], today: string): string {
  const weeks = recentCompleteWeeks(today, 4);
  const month = lastCompleteMonth(today);
  const out: CsvCell[][] = [];
  for (const tread of [false, true]) {
    const periods = [
      ...weeks.map((w, i) => summariseRuns(rows, w.start, w.end, tread, `Week ${i + 1} of 4`)),
      summariseRuns(rows, weeks[0].start, weeks[3].end, tread, '4 weeks combined'),
      summariseRuns(rows, month.start, month.end, tread, `Month ${month.label}`),
    ];
    for (const p of periods) out.push([p.label, p.start, p.end, tread, p.runs, p.runsWithPace, p.km, p.paceSecPerKm]);
  }
  return toCsv(RUNNING_HEADER, out);
}
