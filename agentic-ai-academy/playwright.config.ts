import { defineConfig, devices } from '@playwright/test'

/**
 * Browser smoke tests.
 *
 * The suite runs against the production build (`vite preview`) so that what is
 * verified is what a static host would serve. Port 4318 is used to avoid
 * colliding with a developer's own dev server.
 *
 * The matrix covers Chromium, Firefox and WebKit. WebKit in particular is
 * worth having: it is the engine behind Safari, and it is stricter about
 * `localStorage` in private contexts and about CSS `:focus-visible`.
 *
 * The accessibility audit is the slowest spec, so it is limited to Chromium —
 * the rules axe checks are engine-independent, and running the same audit
 * three times adds minutes without adding signal.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 45_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4318',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    // Bind explicitly to 127.0.0.1: on Windows, `localhost` resolves to IPv6
    // first, so a server bound to `localhost` is not reachable over IPv4.
    command: 'npm run preview -- --port 4318 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4318',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
