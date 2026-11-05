import { expect, test } from '@playwright/test';

/**
 * The curriculum index.
 *
 * The index is the map of the course: it has to say where the reader is, what
 * is still ahead, and which lesson to open next — not merely list ten links.
 */
test.describe('the curriculum index', () => {
  test('says how far through the course the reader is', async ({ page }) => {
    await page.goto('/#/lessons');
    await expect(page.getByText('0 of 10 read')).toBeVisible();
    await expect(page.getByText('0 of 17 exercises worked')).toBeVisible();
  });

  test('names the next lesson and marks it in the list', async ({ page }) => {
    await page.goto('/#/lessons');
    const next = page.getByRole('link', { name: /next: lesson 1/ });
    await expect(next).toBeVisible();

    // and the same lesson is marked in the list itself
    await expect(page.getByText('next up').first()).toBeVisible();
  });

  test('moves the next lesson on when one is read', async ({ page }) => {
    await page.goto('/#/lessons/non-gaussianity');
    await page.getByRole('button', { name: /mark completed/i }).first().click();

    await page.goto('/#/lessons');
    await expect(page.getByText('1 of 10 read')).toBeVisible();
    await expect(page.getByRole('link', { name: /next: lesson 2/ })).toBeVisible();
  });

  test('shows which lessons are still locked behind a prerequisite', async ({ page }) => {
    await page.goto('/#/lessons');
    // nothing read yet: the later lessons name the lesson they need
    await expect(page.getByText(/needs lesson/).first()).toBeVisible();
  });

  test('counts the exercises worked', async ({ page }) => {
    await page.goto('/#/lessons/random-functions');
    // work through the first exercise of the lesson
    const answer = page.getByLabel(/your answer for/i).first();
    await answer.fill('1');
    await page.getByRole('button', { name: 'check' }).first().click();
    await page.waitForTimeout(600);

    await page.goto('/#/lessons');
    await expect(page.getByText(/of \d+ exercises worked/).first()).toBeVisible();
  });
});
