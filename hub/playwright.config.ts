import { defineConfig, devices } from '@playwright/test'

/**
 * The hub's browser suite.
 *
 * It audits the one page against the WCAG 2.1 A and AA criteria with
 * axe-core, in both themes, and checks the parts of the page that are the
 * hub's own job: the search, the path and the theme.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  expect: { timeout: 10_000 },
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4181',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview -- --port 4181 --host 127.0.0.1',
    url: 'http://127.0.0.1:4181',
    reuseExistingServer: false,
    timeout: 180_000,
  },
})
