// Field-level parsers for the Garmin-style Activities.csv export.
// Every parser returns { value, error? }. Missing markers give value null with no error.
// Unparseable text gives value null WITH an error: nothing is silently coerced.

export interface Parsed<T> {
  value: T | null;
  error?: string;
}

const MISSING = new Set(['', '--', '--:--:--']);

export function isMissing(s: string): boolean {
  return MISSING.has(s.trim());
}

const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;
const THOUSANDS_NUMBER = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/;

/** "1,115" -> 1115, "0.00" -> 0 (zero preserved), "--" / "" -> null. */
export function parseNumber(raw: string): Parsed<number> {
  const s = raw.trim();
  if (isMissing(s)) return { value: null };
  if (PLAIN_NUMBER.test(s)) return { value: Number(s) };
  if (THOUSANDS_NUMBER.test(s)) return { value: Number(s.replace(/,/g, '')) };
  return { value: null, error: `not a number: ${JSON.stringify(raw)}` };
}

/**
 * Body Battery Drain, Min Elevation and Max Elevation are exported with ONE leading
 * apostrophe before a negative number ("'-19"). Rule: strip exactly one leading
 * apostrophe, and only when what remains is a valid number. Anything else is an error.
 */
export function parseApostropheNumber(raw: string): Parsed<number> {
  const s = raw.trim();
  if (isMissing(s)) return { value: null };
  if (s.startsWith("'")) {
    const rest = s.slice(1);
    const r = parseNumber(rest);
    if (r.value === null) return { value: null, error: `apostrophe value not numeric: ${JSON.stringify(raw)}` };
    return r;
  }
  return parseNumber(s);
}

const DURATION_HMS = /^(\d+):([0-5]\d):([0-5]\d(?:\.\d+)?)$/;
const DURATION_MS = /^(\d+):([0-5]\d(?:\.\d+)?)$/;

/** Durations (not wall-clock): "01:18:50" -> 4730, "00:03:40.6" -> 220.6, "10:00.0" -> 600. */
export function parseDuration(raw: string): Parsed<number> {
  const s = raw.trim();
  if (isMissing(s)) return { value: null };
  let m = DURATION_HMS.exec(s);
  if (m) return { value: Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) };
  m = DURATION_MS.exec(s);
  if (m) return { value: Number(m[1]) * 60 + Number(m[2]) };
  return { value: null, error: `not a duration: ${JSON.stringify(raw)}` };
}

const PACE = /^(\d+):([0-5]\d)$/;

/**
 * Pace "m:ss" -> seconds per unit ("6:20" -> 380). NOT decimal minutes.
 * Decimal-looking values ("2.8", "21.9") are cycling/golf speeds, not m:ss pace; they are
 * left null with no error (raw value is preserved) rather than misread as pace.
 */
export function parsePace(raw: string): Parsed<number> {
  const s = raw.trim();
  if (isMissing(s)) return { value: null };
  const m = PACE.exec(s);
  if (m) return { value: Number(m[1]) * 60 + Number(m[2]) };
  if (PLAIN_NUMBER.test(s)) return { value: null };
  return { value: null, error: `not a pace: ${JSON.stringify(raw)}` };
}

const TIMESTAMP = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/;

/** Local timestamp as exported. No timezone conversion is applied (export has no offset). */
export function parseTimestamp(raw: string): Parsed<string> {
  const s = raw.trim();
  const m = TIMESTAMP.exec(s);
  if (!m) return { value: null, error: `not a timestamp (YYYY-MM-DD HH:MM:SS): ${JSON.stringify(raw)}` };
  const [, y, mo, d, h, mi, se] = m.map(Number);
  const dt = new Date(Date.UTC(y, mo - 1, d, h, mi, se));
  const ok = dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d && h < 24 && mi < 60 && se < 60;
  return ok ? { value: s } : { value: null, error: `invalid calendar date/time: ${JSON.stringify(raw)}` };
}

export function parseBool(raw: string): Parsed<boolean> {
  const s = raw.trim().toLowerCase();
  if (s === 'true') return { value: true };
  if (s === 'false') return { value: false };
  if (isMissing(s)) return { value: null };
  return { value: null, error: `not a boolean: ${JSON.stringify(raw)}` };
}
