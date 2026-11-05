import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end checks run against the real Vite dev server on a dedicated port so
 * they never fight with a server the developer already has open.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  /*
    The default per-test budget. A few tests do a great deal of work —
    eighteen lesson loads, or twenty-four accessibility audits — and give
    themselves a longer one. The rest are given enough room to survive a
    machine that is busy with something else, which is a normal thing for a
    machine to be.
  */
  timeout: 90_000,
  /*
    How long an assertion waits for the thing it is asserting. Ten seconds
    is enough on a quiet machine and not enough on a busy one, and a test
    that fails because the machine was busy reports a defect in the course
    that is not in the course.
  */
  expect: { timeout: 20_000 },
  /*
    The visual baselines live with the other screenshots rather than in a
    per-engine directory, because they are compared in one engine only.
    Keeping them in `screenshots/` means a reviewer sees the pictures and
    the code in the same place.
  */
  snapshotPathTemplate: '{outputDir}/../screenshots/baseline/{arg}{ext}',
  reporter: [['list']],
  use: {
    baseURL: process.env.MEASURE_URL ?? 'http://127.0.0.1:5213',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /offline\.spec\.ts/ },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: /offline\.spec\.ts/ },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: /offline\.spec\.ts/ },
    /*
      The offline test runs against a published build, because the service
      worker is only registered in one. It runs in one engine: the point is
      that the course works with no network, not that three engines agree
      about it.
    */
    {
      name: 'offline',
      use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5214' },
      testMatch: /offline\.spec\.ts/,
    },
  ],
  webServer: [
    {
      command: 'npm run dev -- --port 5213 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:5213',
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      /*
        The published build, for the offline test. The service worker is
        registered only in a production build, so the offline test has to be
        served the production build.
      */
      command: 'npm run build && npm run preview -- --port 5214 --strictPort --host 127.0.0.1',
      url: 'http://127.0.0.1:5214',
      reuseExistingServer: true,
      timeout: 180_000,
    },
  ],
})
