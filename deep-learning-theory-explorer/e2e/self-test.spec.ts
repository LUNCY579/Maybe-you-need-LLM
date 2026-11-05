import { expect, test } from '@playwright/test';

/**
 * The self-test.
 *
 * The self-test is the application's own audit: it re-checks the load-bearing
 * numbers in the reader's browser, with the same code the laboratories use. A
 * reader who is not going to trust a number on screen should be able to check
 * that this machine agrees with the theory.
 */
test.describe('the self-test', () => {
  test('runs every check and reports what it measured', async ({ page }) => {
    await page.goto('/#/diagnostics');
    await page.getByRole('button', { name: /run the self-test/i }).click();

    await expect(page.getByText('Every check passed')).toBeVisible({ timeout: 60_000 });

    // the checks are listed with the claim, the book reference and the
    // measurement, so the reader can see what was checked
    await expect(page.getByText('The deep linear kernel recursion')).toBeVisible();
    await expect(page.getByText('The K = 0 power law')).toBeVisible();
    await expect(page.getByText('The NTK is a Gram matrix')).toBeVisible();
  });

  test('checks the quadrature against an independent rule, because every theory curve rests on it', async ({ page }) => {
    await page.goto('/#/diagnostics');
    await page.getByRole('button', { name: /run the self-test/i }).click();
    await expect(page.getByText('Every check passed')).toBeVisible({ timeout: 60_000 });

    const row = page.locator('tr', { hasText: 'The quadrature against an independent rule' });
    await expect(row).toBeVisible();
    await expect(row).toContainText('pass');
  });

  test('says what a self-test is not', async ({ page }) => {
    await page.goto('/#/diagnostics');
    await expect(page.getByText('A check is not a proof')).toBeVisible();
    await expect(page.getByText(/It covers the load-bearing parts only/)).toBeVisible();
  });
});
