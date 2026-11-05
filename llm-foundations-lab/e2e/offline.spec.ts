import { expect, test } from '@playwright/test'

/**
 * The course, with no network.
 *
 * Everything in this course is computed in the browser: the laboratories
 * run in the page and the progress file is in local storage. That makes it
 * worth being able to open the course on a train, on a plane, or on a
 * machine that has never been online.
 *
 * The service worker is registered only in a published build, so this test
 * runs against the production build served by `vite preview` rather than
 * against the development server the rest of the suite uses.
 */

test('the course opens with no network at all', async ({ page, context }) => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()

  // Wait for the service worker to take control of the page.
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 20_000,
  })

  // The worker precaches the whole course, so a lesson that has never been
  // opened is available too.
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
})

test('a lesson that was never opened is available offline', async ({ page, context }) => {
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 20_000,
  })

  // Let the worker finish precaching the built files.
  await page.waitForTimeout(1500)

  await context.setOffline(true)
  await page.goto('/#/lessons/reasoning-training')
  await expect(
    page.getByRole('heading', { level: 1, name: 'Learning to reason' }),
  ).toBeVisible({ timeout: 20_000 })
})

test('the cache is named after the build, and only the build', async ({ page }) => {
  /*
    The cache used to be named after nothing in particular, so it never
    changed: every release added its files to a cache that was never
    emptied, and the reader's storage filled up with courses they had
    already read. The cache is named after the build now, and the old one is
    deleted when the new worker takes over.
  */
  await page.goto('/')
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 20_000,
  })

  const names = await page.evaluate(() => caches.keys())
  expect(names.length).toBeGreaterThan(0)
  for (const name of names) {
    // The name carries the build's identifier, and it is this course's.
    expect(name).toMatch(/^llm-foundations-lab-[0-9a-f]{12}$/)
  }

  // And the worker that was served carries the build's identifier rather
  // than the placeholder the build replaces.
  const source = await page.evaluate(async () => {
    const response = await fetch('./sw.js')
    return response.text()
  })
  expect(source).not.toContain('__BUILD_ID__')
  expect(source).toContain('CACHE_PREFIX')
})

test('a laboratory still runs with no network', async ({ page, context }) => {
  await page.goto('/#/playground?lab=tokenizer')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 20_000,
  })
  await page.waitForTimeout(1500)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 20_000 })

  // The laboratory computes in the page, so it works with no network.
  const input = page.getByTestId('tokenizer-input')
  if ((await input.count()) > 0) {
    await input.fill('the model learns from text')
    await expect(page.getByTestId('token-chips').first()).toBeVisible()
  }
})
