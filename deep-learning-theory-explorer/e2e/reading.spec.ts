import { expect, test } from '@playwright/test';
import { READING } from '../src/content/reading';
import { READING_PATHS } from '../src/content/readingAids';

/**
 * The reading page's aids.
 *
 * The list is long; the year histogram and the curated paths are how a reader
 * gets into it. Both have to actually change what is on screen, not just exist.
 */
test.describe('the reading page', () => {
  test('the year histogram narrows the list to one year and clears again', async ({ page }) => {
    await page.goto('/#/reading');
    const inYear = READING.filter((entry) => entry.year === 2024);
    expect(inYear.length).toBeGreaterThan(0);

    const histogram = page.getByRole('group', { name: 'filter by publication year' });
    const bar = histogram.getByRole('button', {
      name: `2024: ${inYear.length} ${inYear.length === 1 ? 'entry' : 'entries'}`,
    });

    await bar.click();
    await expect(
      page.getByText(new RegExp(`${inYear.length} of ${READING.length} entries\\s+from 2024`)),
    ).toBeVisible();
    await expect(bar).toHaveAttribute('aria-pressed', 'true');

    await bar.click();
    await expect(page.getByText(new RegExp(`${READING.length} of ${READING.length} entries\\b`))).toBeVisible();
    await expect(bar).toHaveAttribute('aria-pressed', 'false');
  });

  test('a reading path lists its steps in order and points back into the list', async ({ page }) => {
    await page.goto('/#/reading');
    const panel = page.locator('section').filter({ has: page.getByRole('heading', { name: 'Reading paths' }) });
    await panel.getByRole('button', { name: 'How loss falls with scale' }).click();

    const path = READING_PATHS.find((candidate) => candidate.id === 'scaling');
    expect(path).toBeDefined();
    const steps = panel.locator('ol > li');
    await expect(steps).toHaveCount(path!.steps.length);

    for (const [index, id] of path!.steps.entries()) {
      const entry = READING.find((candidate) => candidate.id === id);
      expect(entry, id).toBeDefined();
      await expect(steps.nth(index)).toContainText(entry!.citation);
    }

    await steps.first().getByRole('button', { name: /find it in the list/ }).click();
    await expect(page.locator(`li#${path!.steps[0]}`)).toBeInViewport();
  });
});
