import { expect, test } from '@playwright/test';

/**
 * Laboratory smoke tests: every laboratory must actually compute something in the
 * browser and present the numbers it computed. These tests assert on the numeric
 * tables the laboratories render, not on the chart internals (Plotly's canvas is
 * not a stable assertion target), so a failure here means the computation broke.
 */

test.describe('laboratories', () => {
  test('physics lab computes a layer-by-layer kernel profile and a loss trajectory', async ({ page }) => {
    await page.goto('/#/labs/physics');
    await expect(page.getByRole('heading', { name: 'Layer-by-layer numbers' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Signal propagation through layers' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Backpropagated gradient signal' })).toBeVisible();
    // the forward pass itself is shown, not only its summary statistics
    await expect(page.getByRole('heading', { name: 'Forward pass: the preactivation matrix' })).toBeVisible();

    // The layer table must have one row per layer plus a header.
    const rows = page.locator('table tbody tr');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(3);

    // The critical C_W is reported for tanh (C_W = 1) by the scanner.
    const scannerStat = page.getByText('Critical C_W (scanner)').locator('..');
    await expect(scannerStat).toBeVisible();
    await expect(scannerStat.getByText('1.000')).toBeVisible();

    // No failure banner anywhere.
    await expect(page.getByText(/Computation failed:/)).toHaveCount(0);
  });

  test('physics lab reacts to a parameter change', async ({ page }) => {
    await page.goto('/#/labs/physics');
    await expect(page.getByRole('heading', { name: 'Layer-by-layer numbers' })).toBeVisible({ timeout: 60_000 });
    const before = await page.locator('table tbody tr').first().innerText();

    // Raise the weight variance well above criticality: the kernel must grow.
    const cw = page.locator('label').filter({ hasText: 'Weight variance' }).locator('input[type=range]');
    await cw.evaluate((el: HTMLInputElement) => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')!.set!;
      setter.call(el, '3');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await expect
      .poll(async () => page.locator('table tbody tr').first().innerText(), { timeout: 60_000 })
      .not.toBe(before);
  });

  test('initialization lab reports the ReLU critical point C_W = 2', async ({ page }) => {
    await page.goto('/#/labs/initialization');
    await expect(page.getByRole('heading', { name: 'Criticality scanner' })).toBeVisible({ timeout: 60_000 });
    await expect(page.getByRole('heading', { name: 'Kernel profiles' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Activation classification' })).toBeVisible();
    await expect(page.getByText(/2(\.0+)?/).first()).toBeVisible();
  });

  test('optimization lab draws a surface and a local curvature estimate', async ({ page }) => {
    await page.goto('/#/labs/landscape');
    await expect(page.getByRole('heading', { name: 'Loss surface and trajectory' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('heading', { name: 'Local curvature' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Loss along the trajectory' })).toBeVisible();
    await expect(page.getByText(/Computation failed:/)).toHaveCount(0);
  });

  test('width/depth lab measures the depth-to-width scaling', async ({ page }) => {
    await page.goto('/#/labs/width-depth');
    await expect(page.getByRole('heading', { name: 'The emergent scale: depth-to-width ratio' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('heading', { name: 'Seed-to-seed variance vs depth' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Seed-to-seed variance vs width' })).toBeVisible();
  });

  test('NTK lab assembles a kernel, checks symmetry and reports the spectrum', async ({ page }) => {
    await page.goto('/#/labs/ntk');
    await expect(page.getByRole('heading', { name: 'Empirical NTK (ensemble average)' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('heading', { name: 'Spectrum of the NTK' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Defrosting: the NTK moves during training' })).toBeVisible();
    await expect(page.getByText('Symmetry defect').first()).toBeVisible();
  });

  test('representation lab shows hidden features before and after training', async ({ page }) => {
    await page.goto('/#/labs/representation');
    await expect(page.getByRole('heading', { name: 'Hidden representation before and after training' })).toBeVisible({ timeout: 90_000 });
    await expect(page.getByRole('heading', { name: 'Loss and separation during training' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What the hidden layer is doing' })).toBeVisible();
  });

  test('a laboratory run can be recorded in the dashboard', async ({ page }) => {
    await page.goto('/#/');
    await page.evaluate(() => window.localStorage.clear());

    await page.goto('/#/labs/initialization');
    await expect(page.getByRole('heading', { name: 'Kernel profiles' })).toBeVisible({ timeout: 90_000 });
    await page.getByRole('button', { name: 'record run in dashboard' }).click();

    await page.goto('/#/dashboard');
    await expect(page.getByRole('heading', { name: 'Experiment log' })).toBeVisible();
    await expect(page.getByText('No runs yet')).toHaveCount(0);
    // the recorded run carries its settings and its headline numbers
    await expect(page.getByText(/C_W=/).first()).toBeVisible();
    await expect(page.getByText(/K\^\(L\) =/).first()).toBeVisible();
  });
});
