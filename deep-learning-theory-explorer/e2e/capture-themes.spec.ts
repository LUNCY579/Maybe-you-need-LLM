import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots';

test('capture both themes', async ({ page }) => {
  test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to regenerate the screenshots');
  mkdirSync(OUT, { recursive: true });

  for (const theme of ['dark', 'light'] as const) {
    await page.goto('/#/');
    await page.evaluate((t) => {
      localStorage.setItem('dlte.theme.v1', t);
      document.documentElement.setAttribute('data-theme', t);
    }, theme);
    await page.reload();
    await page.waitForTimeout(1800);

    for (const [route, name] of [
      ['/#/', 'overview'],
      ['/#/atlas', 'atlas'],
      ['/#/labs/physics', 'lab-physics'],
      ['/#/lessons/criticality', 'lesson-criticality'],
    ] as const) {
      await page.goto(route);
      await page.waitForTimeout(1800);
      await page.screenshot({ path: `${OUT}/${name}-${theme}.png` });
    }
  }
});
