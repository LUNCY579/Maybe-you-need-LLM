import { expect, test } from '@playwright/test';

/**
 * The keyboard path.
 *
 * The application is built for the keyboard, so the keyboard has to be able to
 * get to the content without walking the whole navigation rail first, and the
 * focus ring has to be visible when it arrives.
 */
test.describe('the keyboard path', () => {
  test('the first thing the keyboard reaches is a way past the navigation', async ({ page }) => {
    await page.goto('/#/');
    await page.keyboard.press('Tab');

    const skip = page.getByRole('link', { name: 'Skip to the content' });
    await expect(skip).toBeFocused();
    // it is visible once it is focused, not before
    await expect(skip).toBeVisible();
  });

  test('the skip link moves the focus to the content, and does not break the router', async ({ page }) => {
    await page.goto('/#/lessons/criticality');
    await page.waitForTimeout(1200);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);

    // the focus is in the page, not in the navigation
    const inMain = await page.evaluate(() => {
      const main = document.getElementById('content');
      return main?.contains(document.activeElement) ?? false;
    });
    expect(inMain).toBe(true);

    // and the route is untouched: a fragment would have sent the router to /content
    await expect(page).toHaveURL(/\/lessons\/criticality/);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});
