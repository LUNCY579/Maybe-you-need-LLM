import { test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/** Capture screenshots of every screen for visual inspection. */
const OUT = 'screenshots';

test('capture all screens', async ({ page }) => {
  // A development tool, not a gate: skipped unless CAPTURE=1 is set.
  test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to regenerate the screenshots');
  mkdirSync(OUT, { recursive: true });
  const routes: Array<[string, string]> = [
    ['/#/', 'overview'],
    ['/#/prerequisites', 'prerequisites'],
    ['/#/lessons', 'lessons'],
    ['/#/lessons/universality', 'lesson-universality'],
    ['/#/gallery', 'gallery'],
    ['/#/equations', 'equations'],
    ['/#/quiz', 'quiz'],
    ['/#/dashboard', 'dashboard'],
    ['/#/sources', 'sources'],
    ['/#/reading', 'reading'],
    ['/#/atlas', 'atlas'],
    ['/#/diagnostics', 'diagnostics'],
    ['/#/labs/physics', 'lab-physics'],
    ['/#/labs/initialization', 'lab-initialization'],
    ['/#/labs/landscape', 'lab-landscape'],
    ['/#/labs/width-depth', 'lab-width-depth'],
    ['/#/labs/ntk', 'lab-ntk'],
    ['/#/labs/representation', 'lab-representation'],
  ];
  for (const [route, name] of routes) {
    await page.goto(route);
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });
  }

  // a lesson with a guided exercise, scrolled to the exercises panel
  await page.goto('/#/lessons/criticality');
  await page.waitForTimeout(1200);
  const input = page.getByLabel(/your answer for/i).first();
  await input.fill('2');
  await page.getByRole('button', { name: 'check', exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.getByRole('heading', { name: 'Exercises' }).scrollIntoViewIfNeeded();
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/lesson-guided-exercise.png`, fullPage: false });

  // the gallery with a preset loaded into its laboratory
  await page.goto('/#/gallery');
  await page.waitForTimeout(800);
  const card = page.locator('section').filter({ hasText: 'ReLU at the Kaiming point' }).first();
  await card.getByRole('link', { name: /open .* with these settings/i }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/lab-preset-loaded.png`, fullPage: false });
});
