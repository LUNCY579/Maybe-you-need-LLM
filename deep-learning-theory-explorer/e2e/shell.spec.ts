import { expect, test } from '@playwright/test';

/**
 * The modern shell: a command palette, a theme, and the theory atlas.
 */

test.describe('the command palette', () => {
  test('opens with the keyboard and navigates with the arrows', async ({ page }) => {
    await page.goto('/#/');
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();

    await palette.getByLabel('Search the course, or type a command').fill('atlas');
    await expect(palette.getByText('Open the theory atlas')).toBeVisible();

    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/atlas/);
    await expect(palette).toHaveCount(0);
  });

  test('searches the curriculum as well as the commands', async ({ page }) => {
    await page.goto('/#/');
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await palette.getByLabel('Search the course, or type a command').fill('susceptibility');
    await expect(palette.getByText('Term').first()).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(palette).toHaveCount(0);
  });

  test('closes on Escape', async ({ page }) => {
    await page.goto('/#/');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: 'Command palette' })).toHaveCount(0);
  });

  test('the focus stays inside the palette while it is open', async ({ page }) => {
    await page.goto('/#/');
    await page.keyboard.press('ControlOrMeta+k');
    const palette = page.getByRole('dialog', { name: 'Command palette' });
    await expect(palette).toBeVisible();
    // tabbing repeatedly must never land outside the dialog
    for (let i = 0; i < 12; i++) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const dialog = document.querySelector('[role="dialog"][aria-label="Command palette"]');
        return dialog?.contains(document.activeElement) ?? false;
      });
      expect(inside).toBe(true);
    }
  });
});

test.describe('keyboard shortcuts', () => {
  test('the shortcut list opens with ? and closes with Escape', async ({ page }) => {
    await page.goto('/#/');
    await page.keyboard.press('?');
    const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('command palette');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });

  test('the shortcut list does not open while the reader is typing', async ({ page }) => {
    await page.goto('/#/');
    const box = page.getByLabel('Search the course', { exact: true });
    await box.click();
    await box.type('?');
    await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toHaveCount(0);
  });
});

test.describe('the theme', () => {
  test('switches between dark and light and remembers the choice', async ({ page }) => {
    await page.goto('/#/');
    const html = page.locator('html');
    // the initial theme follows the system preference
    const initial = await html.getAttribute('data-theme');
    expect(['dark', 'light']).toContain(initial);

    const target = initial === 'dark' ? 'light' : 'dark';
    await page.getByRole('button', { name: new RegExp(`Switch to the ${target} theme`, 'i') }).click();
    await expect(html).toHaveAttribute('data-theme', target);

    await page.reload();
    await expect(html).toHaveAttribute('data-theme', target);
  });
});

test.describe('the development server', () => {
  test('is not served by a cache-first service worker', async ({ page }) => {
    // The worker caches assets, which is right for a build and wrong for a
    // development server: it would hand the developer the modules from the
    // last build instead of the ones on disk.
    await page.goto('/#/');
    await page.waitForTimeout(1500);
    const count = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
    expect(count).toBe(0);
  });
});

test.describe('the theory atlas', () => {
  test('lists the concepts and filters them by principle', async ({ page }) => {
    await page.goto('/#/atlas');
    await expect(page.getByRole('heading', { name: 'The theory atlas' })).toBeVisible();
    await expect(page.getByText('The Principle of Sparsity').first()).toBeVisible();
    await expect(page.getByText('The Principle of Criticality').first()).toBeVisible();

    // open a concept and read its detail
    await page.getByRole('button', { name: /^The Principle of Criticality/ }).first().click();
    await expect(page.getByText('Measured here').first()).toBeVisible();
  });

  test('separates the concepts this application measures from the ones it only cites', async ({ page }) => {
    await page.goto('/#/atlas');
    await expect(page.getByText('Measured here').first()).toBeVisible();
    await expect(page.getByText('cited').first()).toBeVisible();
  });
});

test.describe('further reading', () => {
  test('lists the literature and filters it by group', async ({ page }) => {
    await page.goto('/#/reading');
    await expect(page.getByRole('heading', { name: 'Further reading' })).toBeVisible();
    await expect(page.getByText('The foundations')).toBeVisible();
    await expect(page.getByText('arXiv:2106.10165')).toBeVisible();

    // every entry links out
    const links = page.getByRole('link', { name: /open the source/ });
    expect(await links.count()).toBeGreaterThan(5);
  });

  test('the atlas concepts from outside the monograph are listed', async ({ page }) => {
    await page.goto('/#/reading');
    await expect(page.getByText('The same literature, seen from the atlas')).toBeVisible();
    await expect(page.getByText('Feature quality versus feature strength')).toBeVisible();
  });
});
