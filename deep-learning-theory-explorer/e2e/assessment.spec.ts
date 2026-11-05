import { expect, test } from '@playwright/test';

/**
 * Assessment and persistence: answers are scored, the score is stored locally, and
 * the stored state survives a full page reload. Nothing leaves the browser.
 */

test.beforeEach(async ({ page }) => {
  await page.goto('/#/');
  await page.evaluate(() => window.localStorage.clear());
});

test('a multiple-choice answer is scored and the score is shown', async ({ page }) => {
  await page.goto('/#/quiz');
  await expect(page.getByText('Question 1 of 20')).toBeVisible();
  await expect(page.getByText('score 0/0')).toBeVisible();

  // Pick the first option, submit, and read the revealed state.
  const options = page.locator('ul li button');
  await options.first().click();
  await page.getByRole('button', { name: 'submit answer' }).click();
  await expect(page.getByText('Explanation', { exact: true })).toBeVisible();
  await expect(page.getByText('Sources:')).toBeVisible();

  // The score badge must have moved off 0/0.
  await expect(page.getByText(/score [01]\/1/)).toBeVisible();
});

test('revealing an answer shows the explanation without scoring it', async ({ page }) => {
  await page.goto('/#/quiz');
  await page.getByRole('button', { name: 'reveal', exact: true }).click();
  await expect(page.getByText('Explanation', { exact: true })).toBeVisible();
  await expect(page.getByText('score 0/0')).toBeVisible();
});

test('a question answered wrongly is listed for review, with its explanation', async ({ page }) => {
  await page.goto('/#/quiz');
  await expect(page.getByText('The ones you got wrong')).toBeVisible();

  // the first question carries a numeric answer: give it a wrong one
  await page.getByPlaceholder('numeric answer').fill('12345');
  await page.getByRole('button', { name: 'submit answer' }).click();
  await expect(page.getByText('Explanation', { exact: true })).toBeVisible();

  // the wrong answer is now listed for review, with the explanation and a way back
  const review = page.locator('section', { hasText: 'The ones you got wrong' }).last();
  await expect(review).toContainText('revisit the lesson');
});

  test('a question that can be answered numerically is also answerable by choosing the option', async ({ page }) => {
    await page.goto('/#/quiz');
    // Find the question that carries a numeric answer: the ReLU critical C_W.
    const numeric = page.getByPlaceholder('numeric answer');
    let found = false;
    for (let i = 0; i < 20; i++) {
      if (await numeric.isVisible().catch(() => false)) {
        found = true;
        break;
      }
      await page.getByRole('button', { name: /next question/ }).click();
      await page.waitForTimeout(120);
    }
    expect(found).toBe(true);

    // Choosing the right option must be accepted, without typing a number.
    const options = page.locator('ul li button');
    const count = await options.count();
    let marked = false;
    for (let i = 0; i < count; i++) {
      await options.nth(i).click();
      await page.getByRole('button', { name: 'submit answer' }).click();
      const verdict = await page.getByText(/Marked correct on your/).count();
      if (verdict > 0) {
        marked = true;
        break;
      }
      await page.getByRole('button', { name: /next question/ }).click();
      await page.waitForTimeout(120);
    }
    expect(marked).toBe(true);
  });

  test('a wrong option and a wrong number are both rejected', async ({ page }) => {
    await page.goto('/#/quiz');
    const numeric = page.getByPlaceholder('numeric answer');
    for (let i = 0; i < 20; i++) {
      if (await numeric.isVisible().catch(() => false)) break;
      await page.getByRole('button', { name: /next question/ }).click();
      await page.waitForTimeout(120);
    }
    await numeric.fill('-999');
    await page.locator('ul li button').first().click();
    await page.getByRole('button', { name: 'submit answer' }).click();
    await expect(page.getByText(/Marked correct on your/)).toHaveCount(0);
  });

  test('the quiz score survives a reload', async ({ page }) => {
  await page.goto('/#/quiz');
  await page.locator('ul li button').first().click();
  await page.getByRole('button', { name: 'submit answer' }).click();
  await expect(page.getByText(/score [01]\/1/)).toBeVisible();

  await page.reload();
  await expect(page.getByText(/score [01]\/1/)).toBeVisible();
});

test('marking a lesson complete is reflected in the dashboard after a reload', async ({ page }) => {
  await page.goto('/#/lessons/non-gaussianity');
  await expect(page.getByText('Learning objectives')).toBeVisible();

  await page.getByRole('button', { name: /mark completed/i }).first().click();

  await page.goto('/#/dashboard');
  await expect(page.getByText('Lesson progress')).toBeVisible();
  const stat = page.locator('div').filter({ hasText: /^Lessons completed$/ }).first();
  await expect(stat).toBeVisible();
  await expect(page.getByText('1 / 10').first()).toBeVisible();

  await page.reload();
  await expect(page.getByText('1 / 10').first()).toBeVisible();
});

test('the dashboard can be reset, which clears the stored progress', async ({ page }) => {
  await page.goto('/#/quiz');
  await page.locator('ul li button').first().click();
  await page.getByRole('button', { name: 'submit answer' }).click();
  await expect(page.getByText(/score [01]\/1/)).toBeVisible();

  await page.goto('/#/dashboard');
  await page.getByRole('button', { name: /reset progress/i }).click();
  await page.getByRole('button', { name: /erase everything/i }).click();
  await page.reload();
  await page.goto('/#/quiz');
  await expect(page.getByText('score 0/0')).toBeVisible();
});
