import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    // Without this the default glob also matches `dist/catalogue.test.js`, so the package ran
    // its own compiled output and reported twice the tests it has.
    include: ['src/**/*.test.ts'],
  },
})
