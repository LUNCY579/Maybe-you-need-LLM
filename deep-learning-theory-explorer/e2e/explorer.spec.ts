import { expect, test } from '@playwright/test';

/**
 * The equation explorer is an interactive tool, not a list: terms are clickable,
 * a lookup searches the whole curriculum, and the worked example is evaluated
 * live in the browser.
 */

test.describe('equation explorer', () => {
  test('a term lookup finds symbols across the curriculum and opens the defining equation', async ({ page }) => {
    await page.goto('/#/equations');
    await expect(page.getByRole('heading', { name: 'Equation explorer' })).toBeVisible();

    const lookup = page.getByPlaceholder(/chi, susceptibility/i);
    await lookup.fill('susceptibility');

    await expect(page.getByRole('heading', { name: 'Search results' })).toBeVisible();
    const hits = page.locator('ul li button');
    expect(await hits.count()).toBeGreaterThan(0);

    // clicking a hit selects the equation that defines the term and focuses it
    await hits.first().click();
    await expect(page.getByText('Focused term')).toBeVisible();
    await expect(page.getByText(/Defined in/)).toBeVisible();
  });

  test('the notation glossary is present and searchable', async ({ page }) => {
    await page.goto('/#/equations');
    await expect(page.getByRole('heading', { name: 'Notation glossary' })).toBeVisible();
    await expect(page.getByText('rescaled weight variance').first()).toBeVisible();

    // the glossary narrows with the lookup box
    await page.getByPlaceholder(/chi, susceptibility/i).fill('rescaled weight variance');
    await expect(page.getByText(/glossary entry match/)).toBeVisible();
  });

  test('the live evaluation recomputes when the activation changes', async ({ page }) => {
    await page.goto('/#/equations');
    // pick an entry whose worked example depends on the activation
    await page.getByRole('button', { name: /The two criticality conditions/ }).first().click();
    await expect(page.getByText('Live evaluation now')).toBeVisible();

    const live = page.locator('table').filter({ hasText: 'Computed value' }).first();
    const before = await live.innerText();
    await expect(live).toContainText('tanh');

    await page.locator('select').first().selectOption('relu');
    await expect.poll(async () => live.innerText()).not.toBe(before);
    await expect(live).toContainText('ReLU');
  });
});
