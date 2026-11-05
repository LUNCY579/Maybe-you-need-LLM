import { expect, test } from '@playwright/test';

/**
 * The representation laboratory is pausable: the training is driven from a
 * generator, so the run can be suspended and the current weights inspected.
 * The NTK laboratory displays the Jacobian that the kernel is built from.
 */

test.describe('pausable training', () => {
  test('the representation run can be paused and resumed', async ({ page }) => {
    await page.goto('/#/labs/representation');

    // The run starts by itself; wait for it to be under way.
    await expect(page.getByRole('button', { name: 'pause' })).toBeVisible({ timeout: 30_000 });

    await page.getByRole('button', { name: 'pause' }).click();
    await expect(page.getByRole('button', { name: 'resume' })).toBeVisible();
    await expect(page.getByText(/Paused\. The weights are exactly as they were/)).toBeVisible();

    // The step counter must not advance while paused.
    const badge = page.locator('text=step ').first();
    const before = await badge.innerText();
    await page.waitForTimeout(1200);
    expect(await badge.innerText()).toBe(before);

    await page.getByRole('button', { name: 'resume' }).click();
    await expect(page.getByRole('button', { name: 'pause' })).toBeVisible();
  });

  test('the run reaches the end and reports the width comparison', async ({ page }) => {
    await page.goto('/#/labs/representation');
    await expect(page.getByRole('heading', { name: 'Width comparison: how much does the representation move?' })).toBeVisible({
      timeout: 120_000,
    });
    await expect(page.getByText('finished')).toBeVisible({ timeout: 120_000 });
  });
});

test.describe('the NTK laboratory shows the Jacobian', () => {
  test('the parameter gradient and the per-layer norms are displayed', async ({ page }) => {
    await page.goto('/#/labs/ntk');
    await expect(page.getByRole('heading', { name: /The Jacobian: what the NTK is built from/ })).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByRole('heading', { name: 'Which layers carry the gradient' })).toBeVisible();
    await expect(page.getByText(/for every one of the/)).toBeVisible();
  });
});
