/*
 * The service worker.
 *
 * The application is a static bundle and every number in it is computed in the
 * browser, so once the bundle is cached the whole laboratory works offline.
 * The cache is versioned: a new build invalidates the old one, and the network
 * is tried first for navigations so that a reader never gets a stale shell.
 */

const CACHE = 'dlte-v1';

const SHELL = ['./', './index.html', './manifest.webmanifest', './icon.svg'];

/**
 * Drop the assets of a previous build.
 *
 * Every build produces new file names, so the assets of the last build are
 * never requested again — but a cache-first worker keeps them for ever, and
 * a few builds of this application add up to several megabytes of fonts and
 * a plotting library that nobody will ever ask for. When the shell changes,
 * the old assets go with it.
 */
async function dropSupersededAssets(cache, keep) {
  const keys = await cache.keys();
  await Promise.all(
    keys
      .filter((request) => !keep.some((k) => request.url.endsWith(k)))
      .map((request) => cache.delete(request)),
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => undefined),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // navigations: network first, so the shell is fresh, then the cache
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async (response) => {
          const cache = await caches.open(CACHE);
          const text = await response.clone().text();
          const previous = await cache.match(request);
          if (previous) {
            const old = await previous.text();
            if (old !== text) {
              // a new build: the old assets are dead weight
              await dropSupersededAssets(cache, ['/index.html', '/manifest.webmanifest', '/icon.svg']);
            }
          }
          await cache.put(request, new Response(text, { headers: response.headers }));
          return response;
        })
        .catch(() => caches.match(request).then((hit) => hit || caches.match('./index.html'))),
    );
    return;
  }

  // assets: cache first, then the network, and remember what we fetched
  event.respondWith(
    caches.match(request).then(
      (hit) =>
        hit ||
        fetch(request).then((response) => {
          if (response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy)).catch(() => undefined);
          }
          return response;
        }),
    ),
  );
});
