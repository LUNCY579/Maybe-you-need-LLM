import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots';

test('capture the dashboard', async ({ page }) => {
  test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to regenerate the screenshots');
  mkdirSync(OUT, { recursive: true });
  await page.goto('/#/dashboard');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/dashboard.png` });
  await page.goto('/#/lessons/criticality');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/lesson-with-notes.png` });
});
