import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end configuration.
 *
 * The suite runs against the Vite dev server so that the tests exercise the same
 * module graph the developer sees (no stale build artefacts, no divergence between
 * `npm run build` and `npm run dev`). Only Chromium is used: the numerical core is
 * plain TypeScript, so a single engine is enough to verify navigation, computation
 * and persistence.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 90_000,
  expect: { timeout: 20_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: {
    // Vite binds to `localhost`, which on Windows resolves to IPv6 ::1 first.
    // Using the hostname rather than 127.0.0.1 keeps the suite portable.
    baseURL: 'http://localhost:5179',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 960 },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --port 5179 --strictPort',
    url: 'http://localhost:5179',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
