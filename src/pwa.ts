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
    navigator.serviceWorker.register('./sw.js').then((reg) => {
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
