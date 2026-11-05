import { expect, test } from '@playwright/test';

/**
 * The gallery presets are only worth having if they can be *loaded*. This suite
 * checks that clicking a preset puts its settings into the right laboratory and
 * that the laboratory shows the hypothesis and the expected outcome.
 *
 * Since the laboratories share a setup, a preset loaded in one of them is
 * immediately visible in the others — which is itself tested here.
 */

const selectFor = (page: import('@playwright/test').Page, label: string) =>
  page.locator('label').filter({ hasText: label }).locator('select');
const numberFor = (page: import('@playwright/test').Page, label: string) =>
  page.locator('label').filter({ hasText: label }).locator('input[type=number]');

test.describe('experiment gallery presets', () => {
  test('a link written by hand loads the preset', async ({ page }) => {
    // the router's own query parameter, inside the hash
    await page.goto('/#/labs/initialization?preset=relu-kaiming');
    await expect(page.getByText('Gallery preset loaded')).toBeVisible();
    await expect(page.getByText('ReLU at the Kaiming point')).toBeVisible();
  });

  test('a preset loads into its laboratory with the stated settings', async ({ page }) => {
    await page.goto('/#/gallery');
    await expect(page.getByRole('heading', { name: 'Experiment gallery' })).toBeVisible();

    // The ReLU preset: C_W = 2, depth 16, width 128.
    const card = page.locator('section').filter({ hasText: 'ReLU at the Kaiming point' }).first();
    await expect(card).toBeVisible();
    await card.getByRole('link', { name: /open .* with these settings/i }).click();

    await expect(page).toHaveURL(/preset=relu-kaiming/);
    await expect(page.getByText('Gallery preset loaded')).toBeVisible();
    await expect(page.getByText('ReLU at the Kaiming point')).toBeVisible();
    // the hypothesis and the expected outcome are shown next to the measurement
    await expect(page.getByText(/Hypothesis:/)).toBeVisible();
    await expect(page.getByText(/Expected:/)).toBeVisible();

    // and the settings really arrived in the shared setup
    await expect(numberFor(page, 'Weight variance')).toHaveValue('2');
    // and Laboratory A's controlled comparison is anchored on that value
    await expect(page.getByText('C_W = 2.0 (critical)').first()).toBeVisible();
  });

  test('a preset for the physics laboratory fills the shared controls', async ({ page }) => {
    await page.goto('/#/gallery');
    const card = page.locator('section').filter({ hasText: 'the criticality sweep' }).first();
    await card.getByRole('link', { name: /open .* with these settings/i }).click();

    await expect(page).toHaveURL(/preset=physics-critical-sweep/);
    await expect(page.getByText('Gallery preset loaded')).toBeVisible();
    await expect(numberFor(page, 'Weight variance')).toHaveValue('1');
    await expect(numberFor(page, 'Depth (layers)')).toHaveValue('16');
    await expect(numberFor(page, 'Width (neurons per hidden layer)')).toHaveValue('128');
  });

  test('a preset for the representation laboratory loads its dataset', async ({ page }) => {
    await page.goto('/#/gallery');
    const card = page.locator('section').filter({ hasText: 'Feature drift shrinks with width' }).first();
    await card.getByRole('link', { name: /open .* with these settings/i }).click();

    await expect(page).toHaveURL(/preset=representation-drift/);
    await expect(page.getByText('Gallery preset loaded')).toBeVisible();
    await expect(selectFor(page, 'Dataset')).toHaveValue('two-moons');
    await expect(numberFor(page, 'Width (neurons per hidden layer)')).toHaveValue('32');
  });

  test('a preset for the optimization laboratory switches the objective slice', async ({ page }) => {
    await page.goto('/#/gallery');
    const card = page.locator('section').filter({ hasText: 'Non-convex slice of a real network' }).first();
    await card.getByRole('link', { name: /open .* with those settings|with these settings/i }).click();

    await expect(page).toHaveURL(/preset=landscape-nonconvex/);
    await expect(page.getByText('Gallery preset loaded')).toBeVisible();
    await expect(selectFor(page, 'Which two parameters move?')).toHaveValue('hidden');
  });

  test('the setup is shared: a change in one laboratory is a change in all of them', async ({ page }) => {
    // Set C_W in the physics laboratory...
    await page.goto('/#/labs/physics');
    const cw = numberFor(page, 'Weight variance');
    await cw.fill('1.75');
    await cw.blur();
    await expect(cw).toHaveValue('1.75');

    // ... and find it in a different laboratory.
    await page.goto('/#/labs/ntk');
    await expect(numberFor(page, 'Weight variance')).toHaveValue('1.75');
  });
});
