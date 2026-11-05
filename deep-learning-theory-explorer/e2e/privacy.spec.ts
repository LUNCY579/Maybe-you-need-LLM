import { expect, test } from '@playwright/test';

/**
 * The privacy claim.
 *
 * The application says that everything lives in the reader's browser, that
 * there is no account, no telemetry and no server call. That is a claim about
 * the network, so it is tested against the network: every request the
 * application makes must go to the origin it was served from.
 */
test.describe('the application talks to nobody', () => {
  test('makes no request to another origin', async ({ page, baseURL }) => {
    const foreign: string[] = [];
    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('data:') || url.startsWith('blob:')) return;
      if (!url.startsWith(baseURL ?? '')) foreign.push(url);
    });

    for (const route of [
      '/#/',
      '/#/lessons/criticality',
      '/#/labs/physics',
      '/#/atlas',
      '/#/equations',
      '/#/quiz',
      '/#/dashboard',
      '/#/diagnostics',
      '/#/reading',
    ]) {
      await page.goto(route);
      await page.waitForTimeout(1200);
    }

    expect(foreign, `requests to another origin: ${foreign.join(', ')}`).toEqual([]);
  });

  test('sends no data anywhere: there is no analytics and no beacon', async ({ page }) => {
    const sent: string[] = [];
    page.on('request', (request) => {
      if (['POST', 'PUT', 'PATCH'].includes(request.method())) sent.push(`${request.method()} ${request.url()}`);
    });

    await page.goto('/#/lessons/criticality');
    await page.waitForTimeout(1500);
    await page.getByRole('button', { name: /mark completed/i }).first().click();
    await page.waitForTimeout(800);

    expect(sent).toEqual([]);
  });
});
