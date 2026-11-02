import { describe, expect, it } from 'vitest';
import { parseApostropheNumber, parseBool, parseDuration, parseNumber, parsePace, parseTimestamp } from '../src/lib/parse';

describe('parseNumber', () => {
  it('parses quoted thousands separators', () => {
    expect(parseNumber('1,115').value).toBe(1115);
    expect(parseNumber('12,176').value).toBe(12176);
    expect(parseNumber('1,150').value).toBe(1150);
    expect(parseNumber('1,234,567').value).toBe(1234567);
  });
  it('treats -- and empty as null without error', () => {
    expect(parseNumber('--')).toEqual({ value: null });
    expect(parseNumber('')).toEqual({ value: null });
    expect(parseNumber('  ')).toEqual({ value: null });
  });
  it('preserves zero (zero is not missing)', () => {
    expect(parseNumber('0').value).toBe(0);
    expect(parseNumber('0.00').value).toBe(0);
    expect(parseNumber('0.0').value).toBe(0);
  });
  it('parses plain decimals and negatives', () => {
    expect(parseNumber('12.44').value).toBe(12.44);
    expect(parseNumber('-3').value).toBe(-3);
  });
  it('reports malformed numbers as errors, never coerces', () => {
    expect(parseNumber('12,34').error).toBeDefined();
    expect(parseNumber('abc').error).toBeDefined();
    expect(parseNumber('1,15').value).toBeNull();
  });
});

describe('parseDuration', () => {
  it('parses hh:mm:ss to seconds', () => {
    expect(parseDuration('01:18:50').value).toBe(4730);
    expect(parseDuration('00:00:00').value).toBe(0);
  });
  it('parses fractional seconds', () => {
    expect(parseDuration('00:03:40.6').value).toBeCloseTo(220.6, 6);
    expect(parseDuration('01:08:49.5').value).toBeCloseTo(4129.5, 6);
  });
  it('parses mm:ss.s as seen in short activities', () => {
    expect(parseDuration('10:00.0').value).toBe(600);
    expect(parseDuration('07:14.2').value).toBeCloseTo(434.2, 6);
  });
  it('treats --:--:-- and -- as null', () => {
    expect(parseDuration('--:--:--')).toEqual({ value: null });
    expect(parseDuration('--')).toEqual({ value: null });
  });
  it('flags invalid durations', () => {
    expect(parseDuration('1:99:00').error).toBeDefined();
    expect(parseDuration('soon').error).toBeDefined();
  });
});

describe('parsePace', () => {
  it('parses m:ss as seconds per km, not decimal minutes', () => {
    expect(parsePace('6:20').value).toBe(380);
    expect(parsePace('3:36').value).toBe(216);
    expect(parsePace('10:05').value).toBe(605);
  });
  it('null for missing', () => {
    expect(parsePace('--')).toEqual({ value: null });
  });
  it('decimal values (cycling/golf speeds) are not pace: null, no error', () => {
    expect(parsePace('21.9')).toEqual({ value: null });
  });
  it('rejects malformed pace', () => {
    expect(parsePace('6:75').error).toBeDefined();
    expect(parsePace('fast').error).toBeDefined();
  });
});

describe('parseApostropheNumber (Body Battery Drain rule)', () => {
  it("strips exactly one leading apostrophe: \"'-19\" -> -19", () => {
    expect(parseApostropheNumber("'-19").value).toBe(-19);
    expect(parseApostropheNumber("'-2").value).toBe(-2);
  });
  it('leaves numbers without apostrophe alone', () => {
    expect(parseApostropheNumber('-19').value).toBe(-19);
    expect(parseApostropheNumber('67').value).toBe(67);
  });
  it('handles missing', () => {
    expect(parseApostropheNumber('--')).toEqual({ value: null });
  });
  it('does not strip a second apostrophe or accept non-numeric remainder', () => {
    expect(parseApostropheNumber("''-5").error).toBeDefined();
    expect(parseApostropheNumber("'abc").error).toBeDefined();
    expect(parseApostropheNumber("'").value).toBeNull();
  });
  it('preserves zero after apostrophe', () => {
    expect(parseApostropheNumber("'0").value).toBe(0);
  });
});

describe('parseTimestamp / parseBool', () => {
  it('returns the local timestamp string unchanged (no timezone conversion)', () => {
    expect(parseTimestamp('2026-11-01 06:28:42').value).toBe('2026-11-01 06:28:42');
  });
  it('rejects impossible dates and formats', () => {
    expect(parseTimestamp('2026-02-30 10:00:00').error).toBeDefined();
    expect(parseTimestamp('2026-11-01T06:28:42Z').error).toBeDefined();
    expect(parseTimestamp('').error).toBeDefined();
  });
  it('parses booleans', () => {
    expect(parseBool('false').value).toBe(false);
    expect(parseBool('true').value).toBe(true);
    expect(parseBool('maybe').error).toBeDefined();
  });
});
