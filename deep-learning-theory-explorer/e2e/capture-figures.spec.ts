import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots';

test('capture lesson figures', async ({ page }) => {
  test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to regenerate the screenshots');
  mkdirSync(OUT, { recursive: true });
  const shots: Array<[string, string, number]> = [
    ['/#/lessons/bayesian', 'figure-gp', 1500],
    ['/#/lessons/ntk', 'figure-ntk', 1500],
    ['/#/lessons/representation-learning', 'figure-drift', 2500],
    ['/#/lessons/fluctuations', 'figure-fluctuation', 1500],
  ];
  for (const [route, name, wait] of shots) {
    await page.goto(route);
    await page.waitForTimeout(wait);
    const heading = page.getByRole('heading', { level: 2 }).first();
    await heading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1200);
    await page.screenshot({ path: `${OUT}/${name}.png` });
  }
});
