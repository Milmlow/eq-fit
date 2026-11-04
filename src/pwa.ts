// Service worker registration and the "new version ready" state. Updates are applied only when the user asks.
// The worker caches static files only; it never touches IndexedDB, so updating cannot remove data.
import { useSyncExternalStore } from 'react';

export interface PwaState { supported: boolean; offlineReady: boolean; updateReady: boolean; error: string | null }
let state: PwaState = { supported: typeof navigator !== 'undefined' && 'serviceWorker' in navigator, offlineReady: false, updateReady: false, error: null };
const listeners = new Set<() => void>();
const set = (p: Partial<PwaState>) => { state = { ...state, ...p }; listeners.forEach((l) => l()); };
let waiting: ServiceWorker | null = null;
let applying = false;

export function usePwa(): PwaState {
  return useSyncExternalStore((l) => { listeners.add(l); return () => { listeners.delete(l); }; }, () => state);
}

/** Ask the waiting worker to take over; the page reloads once it has (see controllerchange below). */
export function applyUpdate(): void {
  if (!waiting) return;
  applying = true;
  waiting.postMessage({ type: 'SKIP_WAITING' });
}

export function registerServiceWorker(): void {
  if (!import.meta.env.PROD || !state.supported) return;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (applying) window.location.reload(); });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).then((reg) => {
      const flag = () => { if (reg.waiting && navigator.serviceWorker.controller) { waiting = reg.waiting; set({ updateReady: true }); } };
      flag();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed') flag(); });
      });
      document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') void reg.update().catch(() => undefined); });
      void navigator.serviceWorker.ready.then(() => set({ offlineReady: true }));
    }, (e: unknown) => set({ error: e instanceof Error ? e.message : String(e) }));
  });
}

/** Refresh the app shell only. Never clear user storage or unregister the worker. */
export async function refreshApp(): Promise<void> {
  if (navigator.onLine === false) throw new Error('You’re offline. Connect to the internet, then try Refresh app again.');
  if (!('serviceWorker' in navigator)) { window.location.reload(); return; }
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) { window.location.reload(); return; }
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      reg.update(),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Update check timed out. Please try again.')), 15000); }),
    ]);
  } finally { clearTimeout(timer); }
  const installing = reg.installing;
  if (installing && installing.state !== 'installed' && installing.state !== 'activated') {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timeout); installing.removeEventListener('statechange', changed); };
      const changed = () => {
        if (installing.state === 'installed' || installing.state === 'activated') { cleanup(); resolve(); }
        else if (installing.state === 'redundant') { cleanup(); reject(new Error('The update could not be downloaded. Please try again.')); }
      };
      const timeout = setTimeout(() => { cleanup(); reject(new Error('The update is still downloading. Try Refresh app again shortly.')); }, 20000);
      installing.addEventListener('statechange', changed);
      changed();
    });
  }
  if (!reg.waiting) { window.location.reload(); return; }
  await new Promise<void>((resolve, reject) => {
    const cleanup = () => { clearTimeout(timeout); navigator.serviceWorker.removeEventListener('controllerchange', changed); };
    const changed = () => { cleanup(); resolve(); window.location.reload(); };
    const timeout = setTimeout(() => { cleanup(); reject(new Error('The update is ready but could not activate. Close and reopen EQ Fit, then try again.')); }, 15000);
    navigator.serviceWorker.addEventListener('controllerchange', changed);
    reg.waiting!.postMessage({ type: 'SKIP_WAITING' });
  });
}
