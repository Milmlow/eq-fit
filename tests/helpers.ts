import 'fake-indexeddb/auto';
import { COLUMN_KINDS } from '../src/lib/columns';
import { RecompDB } from '../src/db/db';
import { Repo } from '../src/db/repo';

export const HEADERS = Object.keys(COLUMN_KINDS);
let n = 0;

export async function freshRepo(): Promise<Repo> {
  return Repo.open(new RecompDB(`test-${Date.now()}-${n++}`));
}

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;

/** Build a synthetic activity row (all 41 columns, '--' by default). */
export function row(o: Record<string, string>): string[] {
  const base: Record<string, string> = Object.fromEntries(HEADERS.map((h) => [h, '--']));
  Object.assign(base, { Favorite: 'false', Decompression: 'No', 'Training Stress Score®': '0.0', 'Number of Laps': '1', Title: 'x' }, o);
  return HEADERS.map((h) => base[h]);
}

export function csvOf(rows: string[][], headers = HEADERS): Uint8Array {
  const text = [headers, ...rows].map((r) => r.map(q).join(',')).join('\n') + '\n';
  return new TextEncoder().encode(text);
}
