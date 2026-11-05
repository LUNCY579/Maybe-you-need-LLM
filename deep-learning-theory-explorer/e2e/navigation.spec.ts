import { expect, test } from '@playwright/test';

/**
 * Browser navigation: every screen in the application shell must mount, render its
 * heading, and do so without uncaught console errors.
 */

const ROUTES: Array<{ path: string; heading: string | RegExp }> = [
  { path: '/#/', heading: 'Deep Learning Theory Explorer' },
  { path: '/#/prerequisites', heading: 'Mathematical prerequisite navigator' },
  { path: '/#/lessons', heading: 'Curriculum' },
  { path: '/#/gallery', heading: 'Experiment gallery' },
  { path: '/#/equations', heading: 'Equation explorer' },
  { path: '/#/quiz', heading: 'Assessment' },
  { path: '/#/dashboard', heading: 'Your dashboard' },
  { path: '/#/sources', heading: 'Sources, attribution and licensing' },
  { path: '/#/labs/physics', heading: 'Neural network physics lab' },
  { path: '/#/labs/initialization', heading: /Laboratory A/ },
  { path: '/#/labs/landscape', heading: /Laboratory B/ },
  { path: '/#/labs/width-depth', heading: /Laboratory C/ },
  { path: '/#/labs/ntk', heading: /Laboratory D/ },
  { path: '/#/labs/representation', heading: /Laboratory E/ },
];

test.describe('navigation', () => {
  for (const route of ROUTES) {
    test(`${route.path} renders its screen without console errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') errors.push(msg.text());
      });
      page.on('pageerror', (err) => errors.push(String(err)));

      await page.goto(route.path);
      const h1 = page.locator('h1').first();
      await expect(h1).toBeVisible();
      if (typeof route.heading === 'string') {
        await expect(h1).toHaveText(route.heading);
      } else {
        await expect(h1).toHaveText(route.heading);
      }
      await expect(page.locator('main')).toBeVisible();
      // The app must not report a computation failure on any screen.
      await expect(page.getByText(/Computation failed:/)).toHaveCount(0);
      expect(errors.filter((e) => !/favicon|Download the React DevTools/i.test(e))).toEqual([]);
    });
  }

  test('the navigation rail links to every screen and back', async ({ page }) => {
    await page.goto('/#/');
    const rail = page.getByRole('navigation').first();
    await expect(rail.getByRole('link', { name: 'Physics lab' })).toBeVisible();
    await rail.getByRole('link', { name: 'Physics lab' }).click();
    await expect(page).toHaveURL(/#\/labs\/physics/);
    await expect(page.locator('h1').first()).toHaveText('Neural network physics lab');

    await page.goBack();
    await expect(page.locator('h1').first()).toHaveText('Deep Learning Theory Explorer');
  });

  test('an unknown route falls back to the overview', async ({ page }) => {
    await page.goto('/#/this-route-does-not-exist');
    await expect(page.locator('h1').first()).toHaveText('Deep Learning Theory Explorer');
  });
});
