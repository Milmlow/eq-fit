import Papa from 'papaparse';
import { REQUIRED_HEADERS } from './columns';
import { sha256Bytes } from './hash';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;

export interface ParsedCsv {
  fileSha256: string;
  headers: string[];
  rows: string[][];
  /** Structural problems. Any entry here means the file must be rejected. */
  structuralErrors: string[];
}

/** Parse bytes into rows without interpreting cells. Pure; touches no database. */
export async function parseCsvBytes(bytes: Uint8Array): Promise<ParsedCsv> {
  const fileSha256 = await sha256Bytes(bytes);
  const structuralErrors: string[] = [];
  if (bytes.byteLength === 0) {
    return { fileSha256, headers: [], rows: [], structuralErrors: ['file is empty'] };
  }
  if (bytes.byteLength > MAX_FILE_BYTES) {
    return { fileSha256, headers: [], rows: [], structuralErrors: [`file larger than ${MAX_FILE_BYTES} bytes`] };
  }
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return { fileSha256, headers: [], rows: [], structuralErrors: ['file is not valid UTF-8'] };
  }
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);

  const res = Papa.parse<string[]>(text, { header: false, skipEmptyLines: 'greedy', delimiter: ',' });
  for (const e of res.errors) {
    // Delimiter auto-detect noise is irrelevant; we pass delimiter explicitly.
    structuralErrors.push(`row ${(e.row ?? 0) + 1}: ${e.type}: ${e.message}`);
  }
  const all = res.data;
  if (all.length < 2) {
    structuralErrors.push('file has no data rows');
    return { fileSha256, headers: all[0] ?? [], rows: [], structuralErrors };
  }
  const headers = all[0].map((h) => h.trim());
  for (const req of REQUIRED_HEADERS) {
    if (!headers.includes(req)) structuralErrors.push(`required header missing: ${req}`);
  }
  if (new Set(headers).size !== headers.length) structuralErrors.push('duplicate header names');
  const rows = all.slice(1);
  rows.forEach((r, i) => {
    if (r.length !== headers.length) {
      structuralErrors.push(`data row ${i + 1}: expected ${headers.length} fields, found ${r.length} (truncated or malformed)`);
    }
  });
  return { fileSha256, headers, rows, structuralErrors };
}
