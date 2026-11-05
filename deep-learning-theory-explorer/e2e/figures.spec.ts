import { expect, test } from '@playwright/test';

/**
 * The lessons carry live figures: a computation next to the sentence that
 * makes the claim. They must render, and they must respond.
 */

test.describe('live lesson figures', () => {
  test('a lesson renders its figure and the figure computes', async ({ page }) => {
    await page.goto('/#/lessons/criticality');
    await expect(page.getByRole('heading', { name: 'The kernel profile at a chosen weight variance' })).toBeVisible({
      timeout: 30_000,
    });
    // the critical value of the tanh activation is reported
    await expect(page.getByText(/critical C_W = 1\.0/)).toBeVisible();
    // and the susceptibilities are computed at the chosen C_W
    await expect(page.getByText(/χ∥ \/ χ⊥/).first()).toBeVisible();
  });

  test('a figure responds to its own controls', async ({ page }) => {
    await page.goto('/#/lessons/linear-criticality');
    await expect(page.getByRole('heading', { name: 'The deep linear recursion' })).toBeVisible({ timeout: 30_000 });

    const readout = page.locator('div').filter({ hasText: /^G\^\(L\)\/G\^\(0\) = C_W\^L:/ }).first();
    const before = await readout.innerText();
    expect(before).toContain('1.000');

    // move C_W above the critical value
    const slider = page
      .locator('label')
      .filter({ hasText: 'Weight variance' })
      .locator('input[type=range]')
      .first();
    await slider.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(el, '1.3');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });

    await expect
      .poll(async () => readout.innerText(), { timeout: 20_000 })
      .not.toBe(before);
    // 1.3^20 is about 190
    await expect(readout).toContainText('190');
  });

  test('the power-law figure compares the exact recursion with the asymptotic law', async ({ page }) => {
    await page.goto('/#/lessons/universality');
    await expect(page.getByRole('heading', { name: 'The K = 0 class decays by a power law' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/asymptote at ℓ = 200/).first()).toBeVisible();
    await expect(page.getByText(/exact recursion/).first()).toBeVisible();
  });

  test('the fluctuation figure reports the depth-to-width ratio', async ({ page }) => {
    await page.goto('/#/lessons/fluctuations');
    await expect(page.getByRole('heading', { name: 'The fluctuation law' })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/ℓ\/n =/).first()).toBeVisible();  });

  test('the non-Gaussianity figure compares widths', async ({ page }) => {
    await page.goto('/#/lessons/non-gaussianity');
    await expect(page.getByRole('heading', { name: 'The connected four-point correlator' })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText('width 1')).toBeVisible();
  });

  test('the NTK figure checks the closed form against the measurement', async ({ page }) => {
    await page.goto('/#/lessons/ntk');
    await expect(page.getByRole('heading', { name: 'The two-layer NTK: closed form against measurement' })).toBeVisible({
      timeout: 60_000,
    });
    // the figure reports how far the two curves are apart
    await expect(page.getByText(/relative error/).first()).toBeVisible();
  });

  test('the feature-drift figure measures three real trainings', async ({ page }) => {
    await page.goto('/#/lessons/representation-learning');
    await expect(
      page.getByRole('heading', { name: 'How far the representation moves, and how the width changes it' }),
    ).toBeVisible({
      timeout: 90_000,
    });
    await expect(page.getByText(/drift at width 8/)).toBeVisible();
    await expect(page.getByText(/at width 128/)).toBeVisible();
    // the step size is a control, because the trend belongs to a regime
    await expect(page.getByRole('slider', { name: /Learning rate/ })).toBeVisible();
  });

  test('the Gaussian-process figure computes the infinite-width posterior', async ({ page }) => {
    await page.goto('/#/lessons/bayesian');
    await expect(page.getByRole('heading', { name: 'The infinite-width limit is a Gaussian process' })).toBeVisible({
      timeout: 30_000,
    });
    // the figure says plainly what it is and is not
    await expect(page.getByText('What this figure is, and is not')).toBeVisible();
    await expect(page.getByText(/not a finite-width Bayesian posterior/)).toBeVisible();
  });

  test('a figure that belongs to a lesson is not shown in another', async ({ page }) => {
    await page.goto('/#/lessons/bayesian');
    await expect(page.getByRole('heading', { name: 'The fluctuation law' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'The kernel profile at a chosen weight variance' })).toHaveCount(0);
  });
});
