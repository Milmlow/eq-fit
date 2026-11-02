// WCAG 2.x contrast for every text/background and UI token pair, in every theme, read straight from src/ui/themes.css.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const css = readFileSync(new URL('../src/ui/themes.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

function tokens(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const names = [...m[1].matchAll(/data-theme="(\w+)"/g)].map((x) => x[1]);
    for (const n of names) {
      const t = (out[n] ??= {});
      for (const d of m[2].matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)) t[d[1]] = d[2].toLowerCase();
    }
  }
  return out;
}
const channel = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const lum = (hex: string) => { const n = parseInt(hex.slice(1), 16); return 0.2126 * channel(n >> 16) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255); };
export const ratio = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

// [foreground token, background token, minimum ratio, what it is]. 4.5 = normal text; 3 = UI component / graphic boundary.
const PAIRS: [string, string, number, string][] = [
  ['fg', 'bg', 4.5, 'body text on page'], ['muted', 'bg', 4.5, 'secondary text on page'],
  ['fg', 'paper', 4.5, 'text on solid text panel (Crazy text-safe region)'], ['muted', 'paper', 4.5, 'secondary text on text panel'],
  ['fg', 'card', 4.5, 'text on card'], ['muted', 'card', 4.5, 'secondary text on card'],
  ['pr-ink', 'paper', 4.5, 'New PR stamp on its panel'], ['pr-ink', 'bg', 4.5, 'New PR stamp on page'],
  ['on-accent', 'accent', 4.5, 'Start and Today\'s target text on vermilion'],
  ['on-blue', 'blue', 4.5, 'Last time text on cobalt'],
  ['on-acc', 'acc', 4.5, 'primary button text'],
  ['tab-ink', 'tab-bg', 4.5, 'inactive tab label'], ['tab-active', 'tab-bg', 4.5, 'active tab label'],
  ['err', 'bg', 4.5, 'error text'], ['err', 'card', 4.5, 'error text on card'], ['err', 'paper', 4.5, 'error text on panel'],
  ['warn', 'bg', 4.5, 'warning text'], ['warn', 'card', 4.5, 'warning text on card'],
  ['disabled-fg', 'disabled-bg', 4.5, 'disabled button text'],
  ['line', 'bg', 3, 'dividers and borders on page'], ['line', 'card', 3, 'borders on card'], ['line', 'paper', 3, 'borders on panel'],
  ['focus', 'bg', 3, 'focus ring on page'], ['focus', 'card', 3, 'focus ring on card'], ['focus', 'paper', 3, 'focus ring on panel'],
  ['tab-focus', 'tab-bg', 3, 'focus ring on tab bar'],
  ['accent', 'bg', 3, 'Start panel edge against page'], ['accent', 'paper', 3, 'vermilion underline/panel against text panel'],
  ['blue', 'bg', 3, 'Last time panel edge against page'], ['acc', 'bg', 3, 'primary button edge against page'],
  ['tab-active', 'tab-bg', 3, 'active tab marker bar'],
  ['acc', 'paper', 3, 'Stage 5 progress bar fill on its track'],
  ['fg', 'accent', 3, 'Stage 5 achieved-PR block border against its fill'], ['line', 'paper', 3, 'Stage 5 progress bar outline'],
];

const T = tokens();
const REQUIRED = [...new Set(PAIRS.flatMap(([a, b]) => [a, b]))];

describe('contrast: themes.css tokens (WCAG AA)', () => {
  it('all three themes are defined, each with every token the pairs use', () => {
    expect(Object.keys(T).sort()).toEqual(['crazy', 'dark', 'light']);
    for (const [name, t] of Object.entries(T)) for (const k of REQUIRED) expect(t[k], `${name} --${k}`).toMatch(/^#[0-9a-f]{6}$/);
  });
  for (const theme of ['light', 'dark', 'crazy']) {
    describe(theme, () => {
      for (const [fg, bg, min, what] of PAIRS) {
        it(`${what}: --${fg} on --${bg} >= ${min}:1`, () => {
          const r = ratio(T[theme][fg], T[theme][bg]);
          expect(r, `${T[theme][fg]} on ${T[theme][bg]} = ${r.toFixed(2)}`).toBeGreaterThanOrEqual(min);
        });
      }
    });
  }
  it('sanity: the calculator gives the WCAG reference values', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(ratio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
  });
});
