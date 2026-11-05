import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots';

test('capture the small-screen layout', async ({ page }) => {
  test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to regenerate the screenshots');
  mkdirSync(OUT, { recursive: true });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [route, name] of [
    ['/#/', 'mobile-overview'],
    ['/#/labs/physics', 'mobile-physics'],
    ['/#/dashboard', 'mobile-dashboard'],
    ['/#/lessons/criticality', 'mobile-lesson'],
  ] as const) {
    await page.goto(route);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }
});
