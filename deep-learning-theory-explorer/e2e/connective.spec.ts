import { expect, test } from '@playwright/test';

/**
 * The application's connective tissue: the shared setup, the clickable terms,
 * the shareable link and the data export. These are the features that turn six
 * screens into one laboratory.
 */

const numberFor = (page: import('@playwright/test').Page, label: string) =>
  page.locator('label').filter({ hasText: label }).locator('input[type=number]');

test.describe('the shared setup', () => {
  test('a change in one laboratory is a change in every other', async ({ page }) => {
    await page.goto('/#/labs/physics');
    const cw = numberFor(page, 'Weight variance');
    await cw.fill('1.75');
    await cw.blur();
    await expect(cw).toHaveValue('1.75');

    await page.goto('/#/labs/ntk');
    await expect(numberFor(page, 'Weight variance')).toHaveValue('1.75');

    await page.goto('/#/labs/width-depth');
    await expect(numberFor(page, 'Weight variance')).toHaveValue('1.75');
  });

  test('the shared setup survives a reload', async ({ page }) => {
    await page.goto('/#/labs/physics');
    const cw = numberFor(page, 'Weight variance');
    await cw.fill('1.6');
    await cw.blur();
    await expect(cw).toHaveValue('1.6');
    await page.reload();
    await expect(numberFor(page, 'Weight variance')).toHaveValue('1.6');
  });

  test('a shared link reproduces the setup for a second reader', async ({ page }) => {
    await page.goto('/#/labs/physics');
    const cw = numberFor(page, 'Weight variance');
    await cw.fill('1.9');
    await cw.blur();
    await expect(cw).toHaveValue('1.9');

    // build the link the same way the button does
    const link = await page.evaluate(() => {
      const s = new URLSearchParams();
      s.set('s', 'act=tanh,cw=1.9,cb=0,dp=12,wd=64,sd=1,init=gaussian,ind=gaussian,ins=1,idim=8,ns=32,nk=6');
      return `${location.origin}${location.pathname}?${s.toString()}${location.hash}`;
    });

    // a second reader, with a clean browser, opens it
    const context = await page.context().browser()!.newContext();
    const other = await context.newPage();
    await other.goto(link);
    await expect(numberFor(other, 'Weight variance')).toHaveValue('1.9');
    await context.close();
  });

  test('the dashboard shows the setup the laboratories are using', async ({ page }) => {
    await page.goto('/#/labs/physics');
    const cw = numberFor(page, 'Weight variance');
    await cw.fill('1.4');
    await cw.blur();

    await page.goto('/#/dashboard');
    await expect(page.getByRole('heading', { name: 'Your current experiment' })).toBeVisible();
    const panel = page.locator('section').filter({ hasText: 'Your current experiment' }).first();
    await expect(panel).toContainText('1.4');
  });
});

test.describe('clickable terms', () => {
  test('a term in the lesson prose opens its definition', async ({ page }) => {
    await page.goto('/#/lessons/criticality');
    const term = page.locator('button[data-term="chi-parallel"]').first();
    await expect(term).toBeVisible();
    await term.click();
    const dialog = page.getByRole('dialog').first();
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText(/parallel susceptibility/);
    await expect(dialog).toContainText(/magnitude/);
  });

  test('the terminology is listed on the prerequisite navigator', async ({ page }) => {
    await page.goto('/#/prerequisites');
    await expect(page.getByRole('heading', { name: 'The notation you will meet' })).toBeVisible();
    await expect(page.getByText('parallel susceptibility').first()).toBeVisible();
    await expect(page.getByText('neural tangent kernel').first()).toBeVisible();
  });
});

test.describe('data export', () => {
  test('the physics laboratory offers its numbers as a CSV', async ({ page }) => {
    await page.goto('/#/labs/physics');
    await expect(page.getByRole('heading', { name: 'Layer-by-layer numbers' })).toBeVisible({ timeout: 60_000 });
    const button = page.getByRole('button', { name: 'download CSV' }).first();
    await expect(button).toBeVisible();
    // the button is disabled only when there is nothing to export
    await expect(button).toBeEnabled();
  });
});
