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

/** The browser objects registerServiceWorker touches, injectable so tests can simulate a browser without service workers. */
export interface PwaEnv {
  prod: boolean;
  nav: { serviceWorker?: ServiceWorkerContainer };
  win: Pick<Window, 'addEventListener' | 'location'>;
  doc: Pick<Document, 'addEventListener' | 'visibilityState'>;
}

export function registerServiceWorker(env: PwaEnv = { prod: import.meta.env.PROD, nav: navigator, win: window, doc: document }): void {
  const sw = env.nav.serviceWorker;
  if (!env.prod || !state.supported || !sw) return;
  sw.addEventListener('controllerchange', () => { if (applying) env.win.location.reload(); });
  env.win.addEventListener('load', () => {
    let pending: Promise<ServiceWorkerRegistration | undefined>;
    try { pending = Promise.resolve(sw.register('./sw.js')); } catch (e) { set({ error: e instanceof Error ? e.message : String(e) }); return; }
    pending.then((reg) => {
      // Some environments (service workers blocked by policy or by a test browser) resolve with nothing: treat that as "not available", not a crash.
      if (!reg) { set({ supported: false }); return; }
      const flag = () => { if (reg.waiting && sw.controller) { waiting = reg.waiting; set({ updateReady: true }); } };
      flag();
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => { if (w.state === 'installed') flag(); });
      });
      env.doc.addEventListener('visibilitychange', () => { if (env.doc.visibilityState === 'visible') void reg.update().catch(() => undefined); });
      void sw.ready.then(() => set({ offlineReady: true }));
    }, (e: unknown) => set({ error: e instanceof Error ? e.message : String(e) }));
  });
}

/** Test helper: put the module state back to a given starting point. */
export function resetPwaStateForTests(supported: boolean): void { state = { supported, offlineReady: false, updateReady: false, error: null }; waiting = null; applying = false; }
export function getPwaStateForTests(): PwaState { return state; }
