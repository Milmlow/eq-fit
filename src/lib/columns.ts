import { parseApostropheNumber, parseBool, parseDuration, parseNumber, parsePace, parseTimestamp, type Parsed } from './parse';

export type Kind = 'text' | 'number' | 'apostrophe' | 'duration' | 'pace' | 'timestamp' | 'bool';

/** Known export headers (English). Unknown/localized headers are kept as text and never rejected. */
export const COLUMN_KINDS: Readonly<Record<string, Kind>> = {
  'Activity Type': 'text',
  Date: 'timestamp',
  Favorite: 'bool',
  Title: 'text',
  Distance: 'number',
  Calories: 'number',
  Time: 'duration',
  'Avg HR': 'number',
  'Max HR': 'number',
  'Aerobic TE': 'number',
  'Avg Run Cadence': 'number',
  'Max Run Cadence': 'number',
  'Avg Pace': 'pace',
  'Best Pace': 'pace',
  'Total Ascent': 'number',
  'Total Descent': 'number',
  'Avg Stride Length': 'number',
  'Avg Vertical Ratio': 'number',
  'Avg Vertical Oscillation': 'number',
  'Avg Ground Contact Time': 'number',
  'Avg GAP': 'pace',
  'Normalized Power® (NP®)': 'number',
  'Training Stress Score®': 'number',
  'Avg Power': 'number',
  'Max Power': 'number',
  'Total Strokes': 'number',
  'Avg. Swolf': 'number',
  'Avg Stroke Rate': 'number',
  Steps: 'number',
  'Total Reps': 'number',
  'Total Sets': 'number',
  'Body Battery Drain': 'apostrophe',
  'Min Temp': 'number',
  Decompression: 'text',
  'Best Lap Time': 'duration',
  'Number of Laps': 'number',
  'Max Temp': 'number',
  'Moving Time': 'duration',
  'Elapsed Time': 'duration',
  'Min Elevation': 'apostrophe',
  'Max Elevation': 'apostrophe',
};

export const REQUIRED_HEADERS = ['Activity Type', 'Date'] as const;

export type Cell = number | boolean | string | null;

export function parseCell(kind: Kind, raw: string): Parsed<Cell> {
  switch (kind) {
    case 'number': return parseNumber(raw);
    case 'apostrophe': return parseApostropheNumber(raw);
    case 'duration': return parseDuration(raw);
    case 'pace': return parsePace(raw);
    case 'timestamp': return parseTimestamp(raw);
    case 'bool': return parseBool(raw);
    default: return { value: raw };
  }
}
