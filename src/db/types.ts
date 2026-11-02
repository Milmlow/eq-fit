import type { Group } from '../lib/mapping';
import type { Cell } from '../lib/columns';

/** Every record has a UUID `id` and a nullable `owner_id` (reserved for possible later private sync; no sync is built). */
interface Base {
  id: string;
  owner_id: string | null;
}

export interface MigrationRecord {
  version: number;
  name: string;
  applied_at: string;
}

export interface ImportBatch extends Base {
  file_sha256: string;
  file_name: string | null;
  imported_at: string;
  headers: string[];
  source_row_count: number;
  new_row_count: number;
  skipped_duplicate_count: number;
}

export interface Activity extends Base {
  batch_id: string;
  source_file_sha256: string;
  row_index: number; // 0-based position in source file
  row_hash: string; // SHA-256 of canonical row (all cells, header order)
  dedupe_key: string; // row_hash + '#' + occurrence index among identical rows in the file
  raw_row: string[]; // original cells exactly as exported
  raw_fields: Record<string, string>; // header -> original cell (all original fields, localized headers kept)
  parsed: Record<string, Cell>; // header -> typed value
  timestamp_local: string; // 'YYYY-MM-DD HH:mm:ss' as exported; timezone unknown, never converted
  date: string; // 'YYYY-MM-DD'
  original_type: string; // never modified
  mapping_override: Group | null; // per-activity, reversible (null = follow type mapping)
  title: string;
  distance_km: number | null;
  duration_seconds: number | null;
  calories: number | null;
  avg_hr: number | null;
  avg_pace_sec_per_km: number | null;
}

export interface TypeMapping extends Base {
  original_type: string; // used as the lookup key
  target: Group;
  updated_at: string;
}
