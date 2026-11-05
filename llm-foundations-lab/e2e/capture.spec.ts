import { test } from '@playwright/test'

/**
 * Capture a screenshot of each major page so the visual result can be reviewed
 * without starting the site by hand. Not part of the test assertions.
 */
const PAGES = [
  ['landing', '/#/'],
  ['dashboard', '/#/dashboard'],
  ['lesson-transformer', '/#/lessons/generative-transformer'],
  ['lesson-alignment', '/#/lessons/alignment-dpo'],
  ['playground-transformer', '/#/playground?lab=transformer'],
  ['playground-sampling', '/#/playground?lab=sampling'],
  ['playground-learning', '/#/playground?lab=learning'],
  ['practice', '/#/practice'],
  ['glossary', '/#/glossary'],
  ['math', '/#/math'],
  ['sources', '/#/sources'],
] as const

test('capture screenshots', async ({ page, browserName }) => {
  // Twenty-two screenshots are taken, each of them after a page load and a
  // reload. The default timeout is not enough for that on a busy machine.
  test.setTimeout(240_000)
  // The screenshots are a visual record, not an assertion; one engine is enough.
  test.skip(browserName !== 'chromium', 'screenshots are captured with Chromium')
  await page.setViewportSize({ width: 1440, height: 1000 })
  for (const theme of ['light', 'dark'] as const) {
    for (const [name, path] of PAGES) {
      await page.goto(path)
      // The pages are loaded on demand, so the router is still settling when
      // the address changes. Waiting for the heading means the page is really
      // there before the theme is changed under it.
      await page.getByRole('heading', { level: 1 }).first().waitFor()
      await page.evaluate((value) => {
        window.localStorage.setItem('llm-foundations-lab:theme', value)
      }, theme)
      await page.reload()
      await page.waitForTimeout(700)
      const suffix = theme === 'dark' ? '-dark' : ''
      await page.screenshot({ path: `screenshots/${name}${suffix}.png`, fullPage: false })
    }

    // The command palette, which is only open on demand.
    await page.goto('/#/')
    await page.waitForTimeout(400)
    await page.keyboard.press('Control+k')
    await page.waitForTimeout(300)
    await page.getByRole('combobox', { name: 'Look for a lesson, a term, or a command' }).fill('attention')
    await page.waitForTimeout(250)
    await page.screenshot({ path: 'screenshots/palette.png', fullPage: false })
  }
})
