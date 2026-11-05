import { expect, test } from '@playwright/test';

/**
 * The dashboard: the learner's own record.
 *
 * The record lives in local storage and nowhere else, so the two things that
 * must be true are that it can be taken away, and that it cannot be taken away
 * by accident.
 */

test.describe('the progress record', () => {
  test('asks before it erases, and keeps the record when the answer is no', async ({ page }) => {
    await page.goto('/#/lessons/non-gaussianity');
    // mark a lesson done so there is something to lose
    await page.getByRole('button', { name: /mark completed/i }).first().click();

    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: 'reset progress' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('cannot be undone');

    await page.getByRole('button', { name: 'keep it' }).click();
    await expect(dialog).toHaveCount(0);

    // the lesson is still marked
    await page.goto('/#/lessons/non-gaussianity');
    await expect(page.getByRole('button', { name: /completed/i }).first()).toBeVisible();
  });

  test('erases the record when the answer is yes', async ({ page }) => {
    await page.goto('/#/lessons/non-gaussianity');
    await page.getByRole('button', { name: /mark completed/i }).first().click();

    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: 'reset progress' }).click();
    await page.getByRole('button', { name: 'erase everything' }).click();

    await expect(page.getByText('Lessons completed')).toBeVisible();
    await expect(page.getByText('0 / 10').first()).toBeVisible();
  });

  test('the escape key means "no"', async ({ page }) => {
    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: 'reset progress' }).click();
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('the focus cannot wander behind the dialog', async ({ page }) => {
    await page.goto('/#/dashboard');
    await page.getByRole('button', { name: 'reset progress' }).click();
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="alertdialog"]');
        return dialog?.contains(document.activeElement) ?? false;
      });
      expect(inside).toBe(true);
    }
  });
});

test.describe('the small-screen section strip', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test('shows the sections and marks the one being read', async ({ page }) => {
    await page.goto('/#/labs/ntk');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    await expect(nav).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Lessons' })).toBeVisible();
    await expect(page.locator('[data-active="true"]')).toHaveText('D · Neural tangent kernel');
  });

  test('can be scrolled to reach the sections off the right edge', async ({ page }) => {
    await page.goto('/#/');
    const nav = page.getByRole('navigation', { name: 'Sections' });
    const scrollable = await nav.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrollable).toBe(true);

    await nav.evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await expect(nav.getByRole('link', { name: 'Self-test' })).toBeInViewport();
  });
});
