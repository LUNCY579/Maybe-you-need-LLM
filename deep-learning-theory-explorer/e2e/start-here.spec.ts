import { expect, test } from '@playwright/test';

/**
 * The entry point: a reader who has never seen the application should be able
 * to reach a running, configured experiment in two clicks.
 */

test.describe('starting here', () => {
  test('the overview offers a configured entry into the laboratory', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: 'Start here' })).toBeVisible();

    // pick an activation
    await page.getByRole('button', { name: 'tanh', exact: true }).click();
    // the panel states the critical value for the chosen activation
    await expect(page.getByText(/The critical value for tanh is/)).toBeVisible();

    // and the prediction updates with the weight variance
    await expect(page.getByText(/What the theory predicts/)).toBeVisible();
    await expect(page.getByText(/the kernel/).first()).toBeVisible();

    // the button opens the laboratory already configured
    await page.getByRole('button', { name: /open the physics laboratory with these settings/i }).click();
    await expect(page).toHaveURL(/\/labs\/physics/);
    await expect(page.getByRole('heading', { name: 'Neural network physics lab' })).toBeVisible();
    const activation = page.locator('label').filter({ hasText: 'Activation' }).locator('select');
    await expect(activation).toHaveValue('tanh');
  });

  test('an activation that cannot be critical says so', async ({ page }) => {
    await page.goto('/#/');
    await page.getByRole('button', { name: 'Sigmoid', exact: true }).click();
    await expect(page.getByText(/There is no critical value for Sigmoid/)).toBeVisible();
    // The sentence carries the number the scanner computed, not a restatement
    // of the book: C_b = -sigma(0)^2/sigma'(0)^2 = -4.
    await expect(page.locator('p').filter({ hasText: /C_b = -4\.00/ })).toBeVisible();
    // And the sentence is a description of the slider rather than its name: a
    // control named by a whole paragraph is a control nobody can find again.
    await expect(page.getByRole('slider')).toHaveAccessibleName('Weight variance C_W');
    await expect(page.getByText(/blacklist/)).toBeVisible();
  });

  test('the overview explains how the pieces connect', async ({ page }) => {
    await page.goto('/#/');
    await expect(page.getByRole('heading', { name: 'How the pieces connect' })).toBeVisible();
    await expect(page.getByText('One shared setup')).toBeVisible();
    await expect(page.getByText('Clickable symbols')).toBeVisible();
    await expect(page.getByText('Shareable links')).toBeVisible();
    await expect(page.getByText('Data you can check')).toBeVisible();
  });
});
