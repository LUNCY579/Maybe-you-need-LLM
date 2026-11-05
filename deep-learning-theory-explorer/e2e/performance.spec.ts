import { expect, test } from '@playwright/test';

/**
 * The page never freezes.
 *
 * A long task is a block of JavaScript that occupies the main thread for more
 * than fifty milliseconds: the reader cannot scroll, click or select anything
 * while it runs. Two of them were found here — a lesson figure training three
 * networks in the middle of the render, and the charting library being
 * evaluated in full — and this test is what keeps them from coming back.
 *
 * The budget is deliberately generous. What matters is that a reader is never
 * locked out of the page for a noticeable fraction of a second.
 */

const LESSONS = [
  '/#/lessons/non-gaussianity',
  '/#/lessons/random-functions',
  '/#/lessons/linear-criticality',
  '/#/lessons/fluctuations',
  '/#/lessons/rg-flow',
  '/#/lessons/criticality',
  '/#/lessons/universality',
  '/#/lessons/bayesian',
  '/#/lessons/ntk',
  '/#/lessons/representation-learning',
];

/** the longest single block of main-thread work that is tolerated, in ms */
const BUDGET = 400;

test.describe('the page never freezes', () => {
  /*
   * A timing test is sensitive to the machine: when the suite is running
   * everything at once, the browser's own work takes longer and the measured
   * block grows. The budget is for the application, not for a busy computer,
   * so a measurement is allowed one retry before it is believed.
   */
  test.describe.configure({ retries: 1 });

  for (const route of LESSONS) {
    test(`reading ${route} does not block the reader`, async ({ page }) => {
      await page.addInitScript(() => {
        window.__long = [] as number[];
        new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) window.__long.push(Math.round(entry.duration));
        }).observe({ entryTypes: ['longtask'] });
      });

      await page.goto(route);
      // The first visit pays for fetching and warming the charting library; a
      // reader pays it once. The measurement is of the second visit, which is
      // what a reader who is actually reading experiences.
      await page.waitForTimeout(4000);
      await page.reload();
      // long enough for the figures to have computed and the chart to have drawn
      await page.waitForTimeout(6000);

      const long = await page.evaluate(() => (window.__long ?? []) as number[]);
      const worst = long.length ? Math.max(...long) : 0;
      expect(worst, `long tasks on ${route}: ${long.join(', ')} ms`).toBeLessThan(BUDGET);
    });
  }
});
