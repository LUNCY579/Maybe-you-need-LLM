import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots';

test('capture the new screens', async ({ page }) => {
  test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to regenerate the screenshots');
  mkdirSync(OUT, { recursive: true });

  // the theory atlas, with a concept opened
  await page.goto('/#/atlas');
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: /^The Principle of Criticality/ }).first().click();
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/atlas-open.png` });

  // the self-test, run
  await page.goto('/#/diagnostics');
  await page.waitForTimeout(800);
  await page.getByRole('button', { name: /run the self-test/i }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: `${OUT}/diagnostics.png` });

  // the command palette
  await page.goto('/#/');
  await page.waitForTimeout(600);
  await page.keyboard.press('ControlOrMeta+k');
  await page.waitForTimeout(400);
  await page.keyboard.type('criticality');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/palette.png` });

  // a lesson with the atlas cross-links
  await page.goto('/#/lessons/criticality');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/lesson-criticality.png` });
});
