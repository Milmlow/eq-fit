import type { Repo } from '../db/repo';
import type { Activity } from '../db/types';
import { COLUMN_KINDS, parseCell, type Cell } from './columns';
import { parseCsvBytes } from './csv';
import { canonicalRowHash, newId } from './hash';
import { resolveGroup, type Group } from './mapping';

export interface RowError {
  row: number; // 1-based data row
  column: string;
  message: string;
}

export type PreparedRow = Omit<Activity, 'batch_id'>;

export interface ImportPreview {
  fileName: string | null;
  fileSha256: string;
  headers: string[];
  columnCount: number;
  rowCount: number;
  structuralErrors: string[];
  rowErrors: RowError[];
  /** True when the file may not be committed (any structural or row error). */
  blocked: boolean;
  alreadyImported: boolean;
  duplicateRows: number; // rows whose dedupe key already exists in the database
  newRows: number;
  /** original type -> { count, mapped group } */
  types: { type: string; count: number; mapped: Group }[];
  warnings: string[];
  prepared: PreparedRow[];
}

const HEADER_COUNT_EXPECTED = 41;

/** Build a full preview. Reads the database (for duplicate detection) but never writes. */
export async function buildPreview(bytes: Uint8Array, repo: Repo, fileName: string | null = null): Promise<ImportPreview> {
  const parsed = await parseCsvBytes(bytes);
  const base: ImportPreview = {
    fileName, fileSha256: parsed.fileSha256, headers: parsed.headers, columnCount: parsed.headers.length,
    rowCount: parsed.rows.length, structuralErrors: parsed.structuralErrors, rowErrors: [], blocked: false,
    alreadyImported: !!(await repo.findBatchByFileHash(parsed.fileSha256)), duplicateRows: 0, newRows: 0,
    types: [], warnings: [], prepared: [],
  };
  if (parsed.structuralErrors.length > 0) return { ...base, blocked: true };

  const { headers, rows } = parsed;
  if (headers.length !== HEADER_COUNT_EXPECTED) {
    base.warnings.push(`expected ${HEADER_COUNT_EXPECTED} columns, file has ${headers.length}`);
  }
  const unknown = headers.filter((h) => !(h in COLUMN_KINDS));
  if (unknown.length) base.warnings.push(`unrecognised (kept as text): ${unknown.join(', ')}`);

  const idx = (h: string) => headers.indexOf(h);
  const occurrences = new Map<string, number>();
  const prepared: PreparedRow[] = [];
  const rowErrors: RowError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowHash = await canonicalRowHash(row);
    const occ = occurrences.get(rowHash) ?? 0;
    occurrences.set(rowHash, occ + 1);

    const rawFields: Record<string, string> = {};
    const cells: Record<string, Cell> = {};
    headers.forEach((h, c) => {
      rawFields[h] = row[c];
      const kind = COLUMN_KINDS[h] ?? 'text';
      const r = parseCell(kind, row[c]);
      cells[h] = r.value;
      if (r.error) rowErrors.push({ row: i + 1, column: h, message: r.error });
    });

    const type = row[idx('Activity Type')].trim();
    if (type === '') rowErrors.push({ row: i + 1, column: 'Activity Type', message: 'empty activity type' });
    const ts = cells['Date'];
    if (ts === null || typeof ts !== 'string') {
      rowErrors.push({ row: i + 1, column: 'Date', message: 'missing timestamp' });
      continue;
    }
    const isSwim = type === 'Pool Swim'; // distance is metres and pace is per 100 m: not km / sec-per-km
    const num = (h: string) => (typeof cells[h] === 'number' ? (cells[h] as number) : null);
    prepared.push({
      id: newId(), owner_id: null,
      source_file_sha256: parsed.fileSha256, row_index: i, row_hash: rowHash, dedupe_key: `${rowHash}#${occ}`,
      raw_row: row, raw_fields: rawFields, parsed: cells,
      timestamp_local: ts, date: ts.slice(0, 10), original_type: type, mapping_override: null,
      title: row[idx('Title')] ?? '',
      distance_km: isSwim ? null : num('Distance'),
      duration_seconds: num('Time'),
      calories: num('Calories'),
      avg_hr: num('Avg HR'),
      avg_pace_sec_per_km: isSwim ? null : num('Avg Pace'),
    });
  }

  const existing = prepared.length ? await repo.existingDedupeKeys(prepared.map((p) => p.dedupe_key)) : new Set<string>();
  const maps = await repo.getTypeMappings();
  const counts = new Map<string, number>();
  for (const p of prepared) counts.set(p.original_type, (counts.get(p.original_type) ?? 0) + 1);
  const types = [...counts.entries()]
    .map(([type, count]) => ({ type, count, mapped: resolveGroup(type, null, maps) }))
    .sort((a, b) => b.count - a.count);

  const duplicateRows = prepared.filter((p) => existing.has(p.dedupe_key)).length;
  return {
    ...base, rowErrors, blocked: rowErrors.length > 0, duplicateRows,
    newRows: prepared.length - duplicateRows, types, prepared,
  };
}

export interface CommitResult {
  added: number;
  skippedDuplicates: number;
}

/** Commit a preview atomically. A blocked preview is refused and nothing is written. */
export async function commitPreview(preview: ImportPreview, repo: Repo): Promise<CommitResult> {
  if (preview.blocked) throw new Error('import blocked: fix the listed errors; no rows were written');
  const batch = await repo.commitImport(
    {
      file_sha256: preview.fileSha256, file_name: preview.fileName, imported_at: new Date().toISOString(),
      headers: preview.headers, source_row_count: preview.rowCount, new_row_count: 0, skipped_duplicate_count: 0,
    },
    preview.prepared,
  );
  return { added: batch.new_row_count, skippedDuplicates: batch.skipped_duplicate_count };
}
