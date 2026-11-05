import { expect, test } from '@playwright/test';

/**
 * The connective tissue between a lesson and its experiment.
 *
 * Every lesson points at the experiment that makes it concrete. The other
 * direction was missing: a reader in a laboratory, moving a slider, had no
 * way back to the argument the experiment supports.
 */
test.describe('the lessons behind a laboratory', () => {
  test('a laboratory names the lessons it demonstrates', async ({ page }) => {
    await page.goto('/#/labs/initialization');
    const line = page.getByText('This is the experiment for');
    await expect(line).toBeVisible();
    // and the lessons it names are links that go to those lessons
    await expect(line.locator('..').getByRole('link', { name: 'lesson 2' })).toBeVisible();
  });

  test('the link goes to the lesson it names', async ({ page }) => {
    await page.goto('/#/labs/ntk');
    const link = page.getByRole('link', { name: 'lesson 9' }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/lessons\/ntk/);
  });

  test('a lesson offers the further laboratories that make it concrete', async ({ page }) => {
    await page.goto('/#/lessons/ntk');
    // Lesson 9 offers two laboratories: the optimization landscape it was
    // built around, and the prerequisite drills added since — one link each,
    // going where it says. The page has other links to the same laboratories,
    // so the assertion is made on the drill links themselves.
    const experiments = page.getByRole('link', { name: 'another experiment' });
    await expect(experiments).toHaveCount(2);
    const hrefs = await experiments.evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).getAttribute('href')));
    expect(hrefs).toEqual(expect.arrayContaining(['#/labs/landscape', '#/labs/drills']));

    await experiments.nth(hrefs.indexOf('#/labs/landscape')).click();
    await expect(page).toHaveURL(/\/labs\/landscape/);
  });

  test('the physics laboratory names the lesson that points at it', async ({ page }) => {
    await page.goto('/#/labs/physics');
    await expect(page.getByText('This is the experiment for')).toBeVisible();
    await expect(page.getByRole('link', { name: 'lesson 1' })).toBeVisible();
  });
});
