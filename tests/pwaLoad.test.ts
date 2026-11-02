// Stage 4's registerServiceWorker threw "Cannot read properties of undefined (reading 'waiting')" when register() resolved with nothing
// (service workers blocked). The app must load cleanly in that case and in a browser with no service worker support at all.
import { beforeEach, describe, expect, it } from 'vitest';
import { getPwaStateForTests, registerServiceWorker, resetPwaStateForTests, type PwaEnv } from '../src/pwa';

function fakeEnv(sw: unknown, prod = true): { env: PwaEnv; fireLoad: () => void; unhandled: unknown[] } {
  let onLoad: (() => void) | null = null;
  const unhandled: unknown[] = [];
  const env = {
    prod,
    nav: sw === undefined ? {} : { serviceWorker: sw },
    win: { addEventListener: (t: string, cb: () => void) => { if (t === 'load') onLoad = cb; }, location: { reload: () => undefined } },
    doc: { addEventListener: () => undefined, visibilityState: 'visible' },
  } as unknown as PwaEnv;
  return { env, fireLoad: () => onLoad?.(), unhandled };
}
const swWith = (register: () => unknown) => ({ addEventListener: () => undefined, register, ready: new Promise(() => undefined), controller: null });
const flush = () => new Promise((r) => setTimeout(r, 0));

describe('service worker registration without support', () => {
  beforeEach(() => resetPwaStateForTests(true));

  it('does nothing and does not throw when the browser has no serviceWorker at all', () => {
    resetPwaStateForTests(false);
    const { env, fireLoad } = fakeEnv(undefined);
    expect(() => { registerServiceWorker(env); fireLoad(); }).not.toThrow();
    expect(getPwaStateForTests().supported).toBe(false);
  });

  it('survives register() resolving with undefined (blocked service workers): no TypeError, reported as unsupported', async () => {
    const { env, fireLoad } = fakeEnv(swWith(() => Promise.resolve(undefined)));
    const rejections: unknown[] = [];
    const onRej = (e: unknown) => rejections.push(e);
    process.on('unhandledRejection', onRej);
    registerServiceWorker(env); fireLoad(); await flush(); await flush();
    process.off('unhandledRejection', onRej);
    expect(rejections).toEqual([]);
    expect(getPwaStateForTests()).toMatchObject({ supported: false, updateReady: false, offlineReady: false });
  });

  it('survives register() throwing or rejecting, and records the message', async () => {
    const a = fakeEnv(swWith(() => { throw new Error('blocked'); }));
    registerServiceWorker(a.env); a.fireLoad(); await flush();
    expect(getPwaStateForTests().error).toBe('blocked');
    resetPwaStateForTests(true);
    const b = fakeEnv(swWith(() => Promise.reject(new Error('denied'))));
    registerServiceWorker(b.env); b.fireLoad(); await flush(); await flush();
    expect(getPwaStateForTests().error).toBe('denied');
  });

  it('does nothing outside production builds', () => {
    const { env, fireLoad } = fakeEnv(swWith(() => { throw new Error('should not run'); }), false);
    expect(() => { registerServiceWorker(env); fireLoad(); }).not.toThrow();
  });
});
