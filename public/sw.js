// The production build injects every emitted asset and a content-based revision.
const CACHE_NAME = 'todop-cache-__BUILD_ID__';
const PRECACHE_URLS = [];
const PRECACHE_PATHS = new Set(PRECACHE_URLS);

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_URLS.map(url => new Request(url, { cache: 'reload' })));
    // Updates wait for existing tabs to close, keeping each open app on one build.
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('todop-cache-') && key !== CACHE_NAME).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  const path = request.mode === 'navigate' ? '/index.html' : url.pathname;
  // Cache only build assets; never user files, backups or arbitrary responses.
  if (!PRECACHE_PATHS.has(path)) return;
  event.respondWith((async () => {
    // A late fetch from the old worker must not recreate its deleted cache.
    return await caches.match(path, { cacheName: CACHE_NAME }) || fetch(request);
  })());
});
