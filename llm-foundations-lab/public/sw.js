/*
  The course, offline.

  Everything in this course is computed in the browser: the laboratories run
  in the page, the progress file is in local storage, and there is no server
  to ask. That makes it worth being able to open the course on a train, on a
  plane, or on a machine that has never been online.

  The service worker is registered only in a published build. In development
  it would cache the source files the developer is about to change, which is
  a well-known way to spend an afternoon confused.

  Two rules, and the reason for each:

  - The page itself is fetched from the network first, and the cached copy is
    the fallback. A new release of the course therefore reaches the reader on
    their next visit rather than whenever the cache happens to expire.

  - The built assets are fetched from the cache first. Their names contain a
    hash of their contents, so a given name always means the same file, and a
    cached one can never be out of date. When a file is not cached it is
    fetched and cached, and the next visit does not need the network.

  The cache is named after the build, which the build writes into this file.
  Without that, every release would add its files to a cache that was never
  emptied, and the reader's storage would fill up with courses they had
  already read.
*/

const BUILD_ID = '__BUILD_ID__'
const CACHE_NAME = `llm-foundations-lab-${BUILD_ID}`

/**
 * The prefix this course's caches carry.
 *
 * The cache store belongs to the origin, not to the course. The collection
 * serves several courses from one origin, and each of them has a worker, so
 * a worker that emptied every cache but its own would empty the other
 * courses' caches as well. Only caches with this prefix are this course's.
 */
const CACHE_PREFIX = 'llm-foundations-lab-'

/** The files that make the application boot. */
const SHELL_URLS = ['./', './index.html']

/**
 * Every file the build produced.
 *
 * The build writes a manifest listing its chunks, the stylesheets they pull
 * in and the fonts they need. Reading it means the whole course can be
 * cached at install time, rather than only the parts a reader happens to
 * have visited — which is the difference between a course that is available
 * offline and one that is available offline for the lessons you have
 * already seen.
 */
async function builtFiles() {
  const manifestUrl = new URL('manifest.json', self.registration.scope).toString()
  const response = await fetch(manifestUrl)
  if (!response.ok) return []
  const manifest = await response.json()
  const files = new Set()
  for (const entry of Object.values(manifest)) {
    if (entry && typeof entry.file === 'string') files.add(entry.file)
    for (const stylesheet of (entry && entry.css) || []) files.add(stylesheet)
    for (const asset of (entry && entry.assets) || []) files.add(asset)
  }
  return [...files]
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_NAME)
      await cache.addAll(SHELL_URLS)
      const files = await builtFiles()
      // One file that fails must not stop the whole install, so each is
      // fetched on its own.
      await Promise.allSettled(
        files.map((file) =>
          cache.add(new URL(file, self.registration.scope).toString()).catch(() => undefined),
        ),
      )
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            // Only this course's older caches. The cache store belongs to the
            // origin, and the collection serves several courses from one
            // origin, each with a worker of its own.
            .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  )
})

/** Is this a request for one of the built assets? */
function isBuiltAsset(url) {
  return url.pathname.startsWith('/assets/') || /\.(js|css|woff2?|ttf|svg|png|jpg)$/.test(url.pathname)
}

/**
 * Find a cached response, ignoring the `Vary` header.
 *
 * The server sends `Vary: Origin`, and a module script is fetched with the
 * `crossorigin` attribute, so the request that asks for a file carries an
 * `Origin` header that the one that cached it did not. A cache match that
 * honours `Vary` therefore misses every asset, and the course fails to
 * start with no network. The files are the same either way — their names
 * contain a hash of their contents — so the varying header is noise here.
 *
 * Only this course's own cache is searched. A match anywhere in the origin's
 * cache could be another course's file, and serving that would be worse than
 * not serving anything.
 */
async function matchCached(request) {
  const cache = await caches.open(CACHE_NAME)
  return cache.match(request, { ignoreVary: true })
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // The page: network first, cache as the fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(SHELL_URLS[0], copy))
          return response
        })
        .catch(() =>
          matchCached(SHELL_URLS[0]).then((cached) => cached ?? Response.error()),
        ),
    )
    return
  }

  // The assets: cache first, because their names say what they contain.
  if (isBuiltAsset(url)) {
    event.respondWith(
      matchCached(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone()
              caches.open(CACHE_NAME).then((cache) => cache.put(request, copy))
            }
            return response
          }),
      ),
    )
  }
})
