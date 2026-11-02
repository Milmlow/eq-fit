/* EQ Fit service worker. Generated into dist/sw.js at build time by scripts/pwa-plugin.ts (the cache name and the PRECACHE list are filled in there).
   It only ever touches the Cache Storage for static app files. It never reads or writes IndexedDB, so no update, install or
   cache clean-up can remove workout data. */
const CACHE = '__CACHE_NAME__';
const PRECACHE = /*PRECACHE*/[];
const abs = (u) => new URL(u, self.registration.scope).href;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE.map((u) => new Request(abs(u), { cache: 'reload' })))));
  // No automatic skipWaiting: a new version waits until the page asks for it (More > "Update now"), so a session is never swapped mid-edit.
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const k of await caches.keys()) if (k.startsWith('eqfit-static-') && k !== CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === 'navigate') {
    event.respondWith(caches.match(abs('./index.html')).then((r) => r || fetch(req)));
    return;
  }
  event.respondWith(caches.match(req, { ignoreSearch: true }).then((r) => r || fetch(req)));
});
