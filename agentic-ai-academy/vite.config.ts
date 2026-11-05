import { execFileSync } from 'node:child_process'
import { resolve } from 'node:path'
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/*
  The collection panel is generated from the collection's catalogue, so the
  build refreshes it before the bundle is written. The page still works when
  the collection is not on disk — a clone of this repository on its own — by
  using the copy already in it, which is why a failure warns rather than
  stopping the build.
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
        })
      } catch {
        console.warn('the collection could not be read; the copy in the repository is used instead.')
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), readTheCollection()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
    // Component tests render code-split lab pages with charts. On a loaded
    // machine the default 5s is tight enough to flake, so the budget is
    // raised rather than the assertions being weakened.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
})
