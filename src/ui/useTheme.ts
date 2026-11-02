import { useCallback, useEffect, useState } from 'react';
import { applyTheme, loadPref, resolveTheme, savePref, type ThemeName, type ThemePref } from '../lib/theme';

const query = () => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null);
const store = () => { try { return window.localStorage; } catch { return null; } };

/** Resolve and apply the theme to <html> before first render (no flash, no remount of the React tree). */
export function initTheme(): void {
  applyTheme(document.documentElement, resolveTheme(loadPref(store()), !!query()?.matches));
}

/** Theme state lives here, outside all workout data. Changing it only sets data-theme and one localStorage key. */
export function useTheme(): { pref: ThemePref; theme: ThemeName; setPref: (p: ThemePref) => void; persisted: boolean } {
  const [pref, setPrefState] = useState<ThemePref>(() => loadPref(store()));
  const [dark, setDark] = useState(() => !!query()?.matches);
  const [persisted, setPersisted] = useState(true);
  useEffect(() => {
    const q = query();
    if (!q) return;
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  const theme = resolveTheme(pref, dark);
  useEffect(() => { applyTheme(document.documentElement, theme); }, [theme]);
  const setPref = useCallback((p: ThemePref) => { setPrefState(p); setPersisted(savePref(store(), p)); }, []);
  return { pref, theme, setPref, persisted };
}
