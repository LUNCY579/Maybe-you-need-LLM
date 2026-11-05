import { expect, test } from '@playwright/test';

/**
 * Guided exercises: the numerical answer is computed by the app, and the
 * learner's own value is checked against that live computation.
 */

test.describe('guided exercises', () => {
  test('a correct value is accepted and recorded', async ({ page }) => {
    await page.goto('/#/lessons/criticality');
    await expect(page.getByRole('heading', { name: 'Exercises' })).toBeVisible();

    // Lesson 6 asks for the ReLU critical C_W, which is 2.
    const input = page.getByLabel(/your answer for/i).first();
    await input.fill('2');
    await page.getByRole('button', { name: 'check', exact: true }).first().click();

    await expect(page.getByText('Correct.').first()).toBeVisible();
    await expect(page.getByText(/matches the computed/).first()).toBeVisible();
  });

  test('a wrong value is rejected and the computed value is shown', async ({ page }) => {
    await page.goto('/#/lessons/criticality');
    const input = page.getByLabel(/your answer for/i).first();
    await input.fill('1.7');
    await page.getByRole('button', { name: 'check', exact: true }).first().click();

    await expect(page.getByText('Not yet.').first()).toBeVisible();
    await expect(page.getByText(/the app computes/).first()).toBeVisible();
  });

  test('the method used and the tolerance are stated', async ({ page }) => {
    await page.goto('/#/lessons/criticality');
    await expect(page.getByText(/Computed here by the app:/).first()).toBeVisible();
    await expect(page.getByText(/Accepted tolerance/).first()).toBeVisible();
  });

  test('a solved exercise is counted on the dashboard', async ({ page }) => {
    await page.goto('/#/');
    await page.evaluate(() => window.localStorage.clear());

    await page.goto('/#/lessons/criticality');
    const input = page.getByLabel(/your answer for/i).first();
    await input.fill('2');
    await page.getByRole('button', { name: 'check', exact: true }).first().click();
    await expect(page.getByText('Correct.').first()).toBeVisible();

    await page.goto('/#/dashboard');
    await expect(page.getByText('Exercises worked').first()).toBeVisible();
    await expect(page.getByText('1 / 17').first()).toBeVisible();
  });
});
