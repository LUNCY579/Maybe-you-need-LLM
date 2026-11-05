import { defineConfig, devices } from '@playwright/test'

/**
 * The browser suite runs against the production build, because that is what a
 * learner actually opens. The accessibility audit uses axe-core over every
 * page, in both themes, and fails the build on any violation of the WCAG 2.1
 * A or AA criteria.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4174',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4174 --host 127.0.0.1',
    url: 'http://127.0.0.1:4174',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
