import { expect, test } from '@playwright/test';

/**
 * The global search: a student who remembers a phrase should be able to find
 * the page that explains it, without knowing where it lives.
 */

test.describe('global search', () => {
  test('finds a lesson and navigates to it', async ({ page }) => {
    await page.goto('/#/');
    const box = page.getByLabel('Search the course', { exact: true });
    await box.fill('universality');
    const hit = page.locator('button[data-search-kind="lesson"]').first();
    await expect(hit).toBeVisible();
    await hit.click();
    await expect(page).toHaveURL(/\/lessons\/universality/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Universality');
  });

  test('finds a term and opens the equation that derives it', async ({ page }) => {
    await page.goto('/#/');
    const box = page.getByLabel('Search the course', { exact: true });
    await box.fill('susceptibility');
    const term = page.locator('button[data-search-kind="term"]').first();
    await expect(term).toBeVisible();
    await term.click();
    await expect(page).toHaveURL(/\/equations/);
  });

  test('finds a thing whose words the reader remembered in a different order', async ({ page }) => {
    await page.goto('/#/');
    const box = page.getByLabel('Search the course', { exact: true });
    await box.fill('critical weight variance');
    const hit = page.locator('button[data-search-kind="lesson"]').first();
    await expect(hit).toBeVisible();
  });

  test('says so when nothing matches, and suggests what to try', async ({ page }) => {
    await page.goto('/#/');
    const box = page.getByLabel('Search the course', { exact: true });
    await box.fill('zzzqqqxyzzy');
    await expect(page.getByText(/Nothing in the course matches/)).toBeVisible();
  });

  test('the keyboard opens it, and the arrow keys move through the results', async ({ page }) => {
    await page.goto('/#/');
    await page.keyboard.press('/');
    const box = page.getByLabel('Search the course', { exact: true });
    await expect(box).toBeFocused();
    // a phrase that lives in a lesson
    await box.fill('Wick contraction');
    await expect(page.getByText('Lesson').first()).toBeVisible();

    // the best match is the lesson that explains it
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/lessons\/non-gaussianity/);

    // and the arrow keys move to the next result
    await page.goto('/#/');
    await page.keyboard.press('/');
    await page.getByLabel('Search the course', { exact: true }).fill('Wick contraction');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/equations/);
  });

  test('it finds the theory atlas concepts too', async ({ page }) => {
    await page.goto('/#/');
    const box = page.getByLabel('Search the course', { exact: true });
    await box.fill('quartic coupling');
    await expect(page.getByText('Concept').first()).toBeVisible();
  });

  test('a one-character query does not flood the results', async ({ page }) => {
    await page.goto('/#/');
    const box = page.getByLabel('Search the course', { exact: true });
    await box.fill('k');
    await expect(page.getByText(/Nothing in the course matches/)).toHaveCount(0);
  });
});
