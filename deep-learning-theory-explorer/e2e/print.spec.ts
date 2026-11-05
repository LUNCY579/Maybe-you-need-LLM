import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const OUT = 'screenshots';

/**
 * The printed page.
 *
 * A lesson is a document that people read on paper, so the print view has to
 * be a document too: ink on white, the argument and the answers, the figures
 * and the reader's own notes, and none of the instrument panel.
 */
test.describe('the printed lesson', () => {
  test('prints as a document, not as a screenshot of the screen', async ({ page }) => {
    test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to regenerate the screenshots');
    mkdirSync(OUT, { recursive: true });

    await page.goto('/#/lessons/criticality');
    await page.waitForTimeout(2500);

    // a note, so the printout can be checked for carrying it
    const notes = page.getByLabel(/your notes on lesson/i);
    await notes.fill('Criticality needs two conditions, not one. The parallel susceptibility fixes the scale.');
    await page.waitForTimeout(400);

    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${OUT}/print-lesson.png`, fullPage: true });
    await page.emulateMedia({ media: 'screen' });
  });

  test('prints to a PDF the way a printer would', async ({ page }) => {
    test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to regenerate the screenshots');
    mkdirSync(OUT, { recursive: true });

    // The paper is narrower than the screen, so the page is laid out at the
    // paper width first. This is what the print preview does.
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.goto('/#/lessons/criticality');
    await page.waitForTimeout(3000);
    const notes = page.getByLabel(/your notes on lesson/i);
    await notes.fill('Criticality needs two conditions, not one. The parallel susceptibility fixes the scale.');
    await page.waitForTimeout(400);

    // page.pdf() re-lays the document out to the paper, exactly as the print
    // dialog does, so this is the real print path rather than an emulation.
    await page.pdf({ path: `${OUT}/print-lesson.pdf`, format: 'A4', printBackground: true });
  });

  test('a laboratory prints as a lab sheet: the results, not the sliders', async ({ page }) => {
    test.skip(!process.env.CAPTURE, 'set CAPTURE=1 to regenerate the screenshots');
    mkdirSync(OUT, { recursive: true });

    await page.setViewportSize({ width: 794, height: 1123 });
    await page.goto('/#/labs/physics');
    await page.waitForTimeout(4000);
    await page.pdf({ path: `${OUT}/print-lab.pdf`, format: 'A4', printBackground: true });
  });

  test('the chart is re-measured for the paper', async ({ page }) => {
    await page.setViewportSize({ width: 794, height: 1123 });
    await page.goto('/#/lessons/criticality');
    // the charting library is loaded on demand; wait for the chart to exist
    await page.waitForFunction(
      () => {
        const svg = document.querySelector('.js-plotly-plot svg.main-svg');
        return svg !== null && svg.getBoundingClientRect().width > 0;
      },
      undefined,
      { timeout: 30_000 },
    );
    await page.waitForTimeout(500);

    const before = await page.evaluate(() => {
      const el = document.querySelector('.js-plotly-plot');
      const svg = el?.querySelector('svg.main-svg');
      return {
        container: Math.round(el?.parentElement?.getBoundingClientRect().width ?? 0),
        svg: Math.round(svg?.getBoundingClientRect().width ?? 0),
      };
    });

    await page.emulateMedia({ media: 'print' });
    await page.waitForTimeout(2000);

    const after = await page.evaluate(() => {
      const el = document.querySelector('.js-plotly-plot');
      const svg = el?.querySelector('svg.main-svg');
      return {
        container: Math.round(el?.parentElement?.getBoundingClientRect().width ?? 0),
        svg: Math.round(svg?.getBoundingClientRect().width ?? 0),
      };
    });

    // the chart fills its container, on the screen and on the paper
    expect(before.svg).toBeGreaterThan(before.container * 0.9);
    expect(after.svg).toBeGreaterThan(after.container * 0.9);
  });

  test('the answers are on the paper even when they are folded away on screen', async ({ page }) => {
    await page.goto('/#/lessons/random-functions');
    await page.waitForTimeout(1500);

    const answer = page.getByText(/any infinite-width limit/).first();
    // folded away on the screen
    await expect(answer).toBeHidden();

    await page.emulateMedia({ media: 'print' });
    await expect(answer).toBeVisible();
  });

  test('the navigation and the controls are not on the paper', async ({ page }) => {
    await page.goto('/#/lessons/criticality');
    await page.waitForTimeout(1500);
    await page.emulateMedia({ media: 'print' });

    await expect(page.getByRole('navigation', { name: 'Sections' })).toBeHidden();
    await expect(page.getByRole('button', { name: /mark completed/i })).toBeHidden();
  });

  test('the notes are on the paper', async ({ page }) => {
    await page.goto('/#/lessons/criticality');
    await page.waitForTimeout(1500);
    const notes = page.getByLabel(/your notes on lesson/i);
    await notes.fill('A note that must survive the print.');
    await page.emulateMedia({ media: 'print' });
    await expect(notes).toBeVisible();
    await expect(notes).toHaveValue('A note that must survive the print.');
  });
});
