import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    fs: {
      // The catalogue lives in the workspace, one directory up.
      allow: ['..'],
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
  },
  test: {
    environment: 'node',
    // The browser suite is Playwright's, not Vitest's.
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
