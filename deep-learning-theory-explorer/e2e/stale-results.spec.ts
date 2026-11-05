import { expect, test } from '@playwright/test';

/**
 * The numbers on screen while the next ones are computed.
 *
 * A laboratory computes a sweep: the numbers take a moment to arrive, and in
 * the meantime the panel still shows the numbers of the settings the reader
 * has just changed away from. Those are real numbers, but they are not the
 * numbers of the configuration in front of the reader, and they must not be
 * read as if they were.
 */
test.describe('stale results', () => {
  test('the laboratory says the numbers are from the previous settings', async ({ page }) => {
    await page.goto('/#/labs/physics');
    await expect(page.getByText('K^(1) → K^(L) measured')).toBeVisible({ timeout: 30_000 });

    // ask for the same configuration again: the computation starts over
    await page.getByRole('button', { name: /run again/i }).click();

    await expect(page.getByText(/numbers of the previous settings/)).toBeVisible({ timeout: 20_000 });
  });

  test('and the numbers are dimmed while they are stale', async ({ page }) => {
    await page.goto('/#/labs/physics');
    await expect(page.getByText('K^(1) → K^(L) measured')).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: /run again/i }).click();

    const stale = page.getByText(/numbers of the previous settings/);
    await expect(stale).toBeVisible({ timeout: 20_000 });
    // the dimming is on the wrapper around the numbers
    const dimmed = await stale.evaluate((el) => {
      const wrapper = el.parentElement;
      return wrapper?.className.includes('opacity-50') ?? false;
    });
    expect(dimmed).toBe(true);
  });
});
