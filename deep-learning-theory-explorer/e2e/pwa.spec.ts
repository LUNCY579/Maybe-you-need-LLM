import { expect, test } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The offline build.
 *
 * The service worker is registered only in a production build, so these tests
 * run against the built bundle rather than the development server: the worker
 * is served from the same origin as the bundle and caches it.
 */
test.describe('the service worker', () => {
  test.skip(
    !process.env.PWA,
    'set PWA=1 to test the service worker against the production build',
  );

  test('registers, caches the shell, and serves the application with the network off', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);

    const registered = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return Boolean(reg.active);
    });
    expect(registered).toBe(true);

    // The worker only intercepts the requests of the pages it controls, so
    // the first load after the activation is the one that fills the cache.
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 20_000 });
    await page.reload();
    await page.waitForTimeout(2000);

    // the shell and the assets are in the cache
    const cached = await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names[0]);
      const keys = await cache.keys();
      return keys.map((k) => k.url);
    });
    expect(cached.some((u) => u.endsWith('/index.html') || u.endsWith('/'))).toBe(true);
    expect(cached.some((u) => u.includes('/assets/') && u.endsWith('.js'))).toBe(true);

    // with the network off, the application still loads
    await page.context().setOffline(true);
    await page.reload();
    await page.waitForTimeout(2000);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.context().setOffline(false);
  });

  test('drops the assets of a previous build when the shell changes', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(1500);
    await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller), undefined, { timeout: 20_000 });
    await page.reload();
    await page.waitForTimeout(1500);

    // an asset left over from a build that is no longer deployed
    await page.evaluate(async () => {
      const names = await caches.keys();
      const cache = await caches.open(names[0]);
      await cache.put('/assets/old-build-abc123.js', new Response('the previous build'));
    });

    // the served shell changes, as it would on a new deployment
    const indexPath = join(process.cwd(), 'dist', 'index.html');
    const original = readFileSync(indexPath, 'utf8');
    writeFileSync(indexPath, original.replace('</body>', '<!-- a new build --></body>'));
    try {
      await page.reload();
      await page.waitForTimeout(2000);
      const stillCached = await page.evaluate(async () => {
        const names = await caches.keys();
        const cache = await caches.open(names[0]);
        return Boolean(await cache.match('/assets/old-build-abc123.js'));
      });
      expect(stillCached).toBe(false);

      // and the application still works afterwards
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    } finally {
      writeFileSync(indexPath, original);
    }
  });
});
