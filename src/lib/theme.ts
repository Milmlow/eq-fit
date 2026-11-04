// Theme preference. A tiny local preference (one localStorage key); NOT part of workout data or any backup.
export const THEME_KEY = 'eqfit.theme';
export type ThemePref = 'system' | 'light' | 'dark' | 'crazy' | 'girl-power';
export type ThemeName = 'light' | 'dark' | 'crazy' | 'girl-power';
export const THEME_PREFS: { pref: ThemePref; label: string }[] = [
  { pref: 'system', label: 'System' }, { pref: 'light', label: 'Light' }, { pref: 'dark', label: 'Dark' }, { pref: 'crazy', label: 'Crazy' }, { pref: 'girl-power', label: 'Girl Power 🌸' },
];
/** Used until Royce picks one. */
export const DEFAULT_PREF: ThemePref = 'dark';

type ReadStore = { getItem(k: string): string | null } | undefined | null;
type WriteStore = { setItem(k: string, v: string): void } | undefined | null;

export function parsePref(v: unknown): ThemePref | null {
  return v === 'system' || v === 'light' || v === 'dark' || v === 'crazy' || v === 'girl-power' ? v : null;
}

/** Stored explicit choice, else the default. Storage failures (private mode, blocked) fall back to the default. */
export function loadPref(store: ReadStore): ThemePref {
  try { return parsePref(store?.getItem(THEME_KEY)) ?? DEFAULT_PREF; } catch { return DEFAULT_PREF; }
}

/** Returns false (and keeps the in-memory choice) when storage is unavailable. */
export function savePref(store: WriteStore, pref: ThemePref): boolean {
  try { if (!store) return false; store.setItem(THEME_KEY, pref); return true; } catch { return false; }
}

/** System follows the OS light/dark setting; it never resolves to Crazy. */
export function resolveTheme(pref: ThemePref, prefersDark: boolean): ThemeName {
  return pref === 'system' ? (prefersDark ? 'dark' : 'light') : pref;
}

export function applyTheme(el: { setAttribute(name: string, value: string): void }, theme: ThemeName): void {
  el.setAttribute('data-theme', theme);
}
