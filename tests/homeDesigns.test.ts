import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const ui = (file: string) => readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8');

describe('Home design trial', () => {
  it('offers three layouts with a durable browser preference', () => {
    const home = ui('HomeMasthead.tsx');
    for (const design of ['pit-lane', 'front-page', 'after-hours']) expect(home).toContain(design);
    expect(home).toContain('eqfit.home-design');
    expect(home).toContain('aria-pressed');
  });
  it('puts the shared workout entry before optional panels in every focus', () => {
    const pulse = ui('ActivityPulse.tsx');
    expect(pulse.indexOf('<HomeMasthead')).toBeLessThan(pulse.indexOf('<Tribunal'));
    expect(pulse).toContain('Training details');
    expect(pulse).not.toContain("focus!=='free'&&trainingAction");
    expect(ui('Today.tsx')).toContain('<Routines compact');
    expect(ui('Routines.tsx')).toContain('{compact && shortcut && repeatShortcut(shortcut)}');
  });
});

describe('Home palette contrast', () => {
  const css = ui('themes.css');
  const luminance = (hex: string) => {
    const channels = hex.slice(1).match(/../g)!.map(pair => {
      const value = parseInt(pair, 16) / 255;
      return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
    });
    return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
  };
  for (const name of ['pit-lane', 'front-page', 'after-hours']) {
    it(name + ' has legible body and button text', () => {
      const block = css.match(new RegExp('\\.home-' + name + '\\s*\\{([^}]+)'))![1];
      const token = (name: string) => block.match(new RegExp('--home-' + name + ':\\s*(#[a-fA-F0-9]{6})'))![1];
      for (const [foreground, background] of [['ink', 'bg'], ['button-ink', 'accent']]) {
        const values = [luminance(token(foreground)), luminance(token(background))].sort((a, b) => b - a);
        expect((values[0] + .05) / (values[1] + .05)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});
