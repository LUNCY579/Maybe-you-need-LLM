import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vitest/config'

/**
 * Reads the collection this course belongs to, before the build.
 *
 * The course says what to read next, and the collection knows what that is.
 * The knowledge is read from the collection and written into this repository
 * by `tools/readCollection.mjs`, so that a hand-written copy of the
 * collection's catalogue — which would go out of date the moment a course
 * was added — is never made.
 *
 * The script fails when the collection is not there, and the copy already in
 * the repository is used instead. A clone of this repository on its own still
 * builds, and still says something true.
 */
function readTheCollection() {
  return {
    name: 'read-the-collection',
    apply: 'build' as const,
    async buildStart() {
      try {
        execFileSync(process.execPath, [resolve(process.cwd(), 'tools', 'readCollection.mjs')], {
          cwd: process.cwd(),
          stdio: 'inherit',
        })
      } catch {
        console.warn('the collection could not be read; the copy in the repository is used instead.')
      }
    },
  }
}

/**
 * Stamps the build into the service worker.
 *
 * The service worker caches the whole course, and its cache was named after
 * nothing in particular, so it never changed. That sounds harmless and is
 * not: every deployment writes new files with new names in them, the old
 * ones stay in the reader's cache forever, and the cache grows without
 * bound until the browser starts refusing to store anything.
 *
 * Naming the cache after the build fixes both halves of it. The cache is
 * different for each release, so the old one is deleted when the new worker
 * takes over; and the worker file itself changes with the build, so the
 * browser notices that there is a new one and installs it.
 *
 * The identifier is a hash of the build manifest, so it changes exactly when
 * the course does.
 */
function stampTheServiceWorker() {
  return {
    name: 'stamp-the-service-worker',
    apply: 'build' as const,
    async closeBundle() {
      const outDir = resolve(process.cwd(), 'dist')
      const manifestPath = resolve(outDir, 'manifest.json')
      const workerPath = resolve(outDir, 'sw.js')

      let identifier = 'development'
      try {
        const manifest = await readFile(manifestPath, 'utf8')
        identifier = createHash('sha256').update(manifest).digest('hex').slice(0, 12)
      } catch {
        // Without a manifest there is nothing to hash, and the worker keeps
        // the name it had, which is the safe thing to do.
      }

      try {
        const worker = await readFile(workerPath, 'utf8')
        await writeFile(workerPath, worker.replaceAll('__BUILD_ID__', identifier), 'utf8')
      } catch {
        // A build with no service worker is a build that does not work
        // offline, but it is not a build that should fail.
      }
    },
  }
}

export default defineConfig({
  // Relative base so the built site works from any static host path (HashRouter is used).
  base: './',
  plugins: [react(), tailwindcss(), readTheCollection(), stampTheServiceWorker()],
  build: {
    target: 'es2022',
    sourcemap: false,
    /*
      The manifest lists every file the build produced, which is what the
      service worker reads to precache the whole course. Without it the
      worker could only cache the files a reader happened to visit.
    */
    manifest: 'manifest.json',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/core/**/*.ts'],
      exclude: ['src/core/**/*.test.ts'],
    },
  },
})
