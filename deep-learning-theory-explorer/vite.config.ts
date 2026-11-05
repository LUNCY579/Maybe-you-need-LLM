import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';

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
    buildStart() {
      try {
        execFileSync(process.execPath, [resolve(process.cwd(), 'tools', 'readCollection.mjs')], {
          cwd: process.cwd(),
          stdio: 'inherit',
        });
      } catch {
        console.warn('the collection could not be read; the copy in the repository is used instead.');
      }
    },
  };
}

export default defineConfig({
  plugins: [react(), readTheCollection()],
  define: {
    // The modular Plotly build is written for Node as well as the browser and
    // refers to `global`, which the browser does not have. The development
    // server does not rewrite it for us the way the bundler does.
    global: 'globalThis',
  },
  server: {
    port: 5178,
    strictPort: false,
  },
  build: {
    // The charting library is still large, but only the traces this
    // application draws are bundled; it is code-split behind a dynamic import
    // in the Plot component.
    chunkSizeWarningLimit: 2000,
  },
  test: {
    globals: true,
    environment: 'jsdom',
    include: ['tests/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30000,
  },
});
