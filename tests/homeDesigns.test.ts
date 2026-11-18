import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { HOME_DESIGNS, homeOverview, readHomeDesign } from '../src/lib/homeOverview';
import { trainingDashboard } from '../src/lib/dashboardFocus';
import type { Activity, Workout, SetRecord } from '../src/db/types';

const ui = (file: string) => readFileSync(new URL('../src/ui/' + file, import.meta.url), 'utf8');

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
      const block = [...css.matchAll(new RegExp('\\.home-' + name + '\\s*\\{([^}]+)', 'g'))].map(match => match[1]).join('');
      const token = (name: string) => [...block.matchAll(new RegExp('--home-' + name + ':\\s*(#[a-fA-F0-9]{6})', 'g'))].at(-1)![1];
      for (const [foreground, background] of [['ink', 'bg'], ['ink', 'surface'], ['muted', 'bg'], ['muted', 'surface'], ['error', 'surface'], ['button-ink', 'accent'], ['accent', 'track']]) {
        const values = [luminance(token(foreground)), luminance(token(background))].sort((a, b) => b - a);
        expect((values[0] + .05) / (values[1] + .05)).toBeGreaterThanOrEqual(4.5);
      }
    });
  }
});


describe('Home data and preferences', () => {
  it('restores each design, falls back for old values and handles blocked storage', () => {
    for (const design of HOME_DESIGNS) expect(readHomeDesign({ getItem: () => design.id })).toBe(design);
    expect(readHomeDesign({ getItem: () => 'old-theme' }).id).toBe('pit-lane');
    expect(readHomeDesign({ getItem: () => { throw new Error('blocked'); } }).id).toBe('pit-lane');
  });
  it('uses linked activity counts, excludes warm-ups, old and future records, and keeps missing metrics unknown', () => {
    const activity = { id: 'watch', date: '2026-11-18', timestamp_local: '2026-11-18 07:00:00',
      original_type: 'Strength Training', title: 'Gym', duration_seconds: null } as Activity;
    const workout = { id: 'lift', date: activity.date, created_at: '2026-11-18T07:00:00Z', kind: 'weights',
      status: 'done', linked_activity_id: 'watch' } as Workout;
    const sets = [{ workout_id: 'lift', warmup: false }, { workout_id: 'lift', warmup: true }] as SetRecord[];
    const future = { ...workout, id: 'future', date: '2026-11-19', linked_activity_id: null };
    const old = { ...workout, id: 'old', date: '2026-11-15', linked_activity_id: null };
    const entries = trainingDashboard([activity], [workout, future, old], sets, '2026-11-18', 'all').entries;
    const home = homeOverview(entries, '2026-11-18');
    expect(home.effort.sessions).toBe(1);
    expect(home.effort.strength).toBe(1);
    expect(home.workingSets).toBe(1);
    expect(home.effort.minutes).toBeNull();
    expect(home.effort.km).toBeNull();
    expect(home.recent.map(entry => entry.id)).toEqual(['lift', 'old']);
  });
});
