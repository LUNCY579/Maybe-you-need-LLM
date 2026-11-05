import { expect, test } from '@playwright/test';

/**
 * The experiment log.
 *
 * A log of experiments that cannot be repeated is a diary rather than a
 * record: the seed is what determines the numbers, so a run that does not
 * carry its settings cannot be checked. The log therefore keeps the settings,
 * and can put them back.
 */
test.describe('the experiment log', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/');
    await page.evaluate(() => window.localStorage.clear());
  });

  test('a recorded run keeps the settings it was made with, and can restore them', async ({ page }) => {
    // change the shared setup, then run the physics lab
    await page.goto('/#/labs/physics');
    await page.waitForTimeout(3000);
    const width = page.getByLabel(/Width \(neurons per hidden layer\) value/i);
    await width.fill('96');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /record run in dashboard/i }).click();

    await page.goto('/#/dashboard');
    const log = page.locator('section', { hasText: 'Experiment log' }).last();
    const run = log.locator('li').first();
    await expect(run).toBeVisible();
    // the seed is in the summary, so the run can be repeated
    await expect(run).toContainText(/seed \d+/);

    // change the setup away from what the run used
    await page.goto('/#/labs/physics');
    await page.waitForTimeout(2500);
    await page.getByLabel(/Width \(neurons per hidden layer\) value/i).fill('32');
    await page.waitForTimeout(1200);

    // and put it back from the log
    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: /restore these settings/i }).first().click();

    await page.goto('/#/labs/physics');
    await page.waitForTimeout(2500);
    await expect(page.getByLabel(/Width \(neurons per hidden layer\) value/i)).toHaveValue('96');
  });

  test('a pasted record cannot smuggle an impossible setting into the setup', async ({ page }) => {
    await page.goto('/#/dashboard');
    const record = {
      version: 1,
      lessons: {},
      exercises: {},
      quiz: [],
      runs: [
        {
          id: 'physics-lab',
          lab: 'physics',
          summary: 'a hostile record',
          ranAt: new Date().toISOString(),
          metrics: {},
          setup: { width: -100, depth: 0, activation: 'nope', seed: 7 },
        },
      ],
      equationsViewed: [],
      notes: {},
    };
    await page.getByText('or paste a progress record').click();
    await page.getByLabel('a progress record to import').fill(JSON.stringify(record));
    await page.getByRole('button', { name: 'import this record' }).click();
    await page.waitForTimeout(800);

    // the run is there, but the settings it carries have been checked
    await expect(page.getByText('a hostile record')).toBeVisible();    await page.getByRole('button', { name: /restore these settings/i }).first().click();
    await page.goto('/#/labs/physics');
    await page.waitForTimeout(2500);
    const width = await page.getByLabel(/Width \(neurons per hidden layer\) value/i).inputValue();
    expect(Number(width)).toBeGreaterThan(0);
  });
});
