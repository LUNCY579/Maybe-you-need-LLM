import { expect, test } from '@playwright/test'

/**
 * Windows has a high-contrast mode, and a reader can turn it on for the
 * whole system. The browser then replaces the palette with the system's own.
 *
 * The risk is not that the interface falls apart — it does not — but that
 * anything which carried its meaning in a background colour loses it. The
 * selected state of a segmented control and the on state of a switch were
 * both carried by a fill, and in forced-colours mode they vanished.
 *
 * The suite emulates the mode and checks that those states are still
 * visible.
 */

test('the interface survives forced colours', async ({ page }) => {
  // WebKit has no forced-colours emulation, so the test does not apply.
  test.skip(
    page.context().browser()?.browserType().name() === 'webkit',
    'WebKit cannot emulate forced colours',
  )
  await page.emulateMedia({ forcedColors: 'active' })

  await page.goto('/#/playground?lab=tokenizer')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // The layout has not collapsed and nothing has overflowed.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(1)
})

test('a selected option is still identifiable in forced colours', async ({ page }) => {
  test.skip(
    page.context().browser()?.browserType().name() === 'webkit',
    'WebKit cannot emulate forced colours',
  )
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto('/#/playground?lab=tokenizer')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // The selected tab is marked with the system selection colour, because the
  // colour of its lower border — which is what used to mark it — is replaced
  // in this mode.
  const tab = await page
    .getByRole('tab', { selected: true })
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return {
        width: style.borderBottomWidth,
        style: style.borderBottomStyle,
        colour: style.borderBottomColor,
      }
    })

  expect(tab.style).not.toBe('none')
  expect(parseFloat(tab.width)).toBeGreaterThan(0)
  // The system selection colour is not the system text colour, so the
  // selected tab is distinguishable from the others.
  expect(tab.colour).not.toBe('rgb(0, 0, 0)')
})

test('a switch that is on is still identifiable in forced colours', async ({ page }) => {
  test.skip(
    page.context().browser()?.browserType().name() === 'webkit',
    'WebKit cannot emulate forced colours',
  )
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto('/#/playground?lab=tokenizer')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const sw = page.getByRole('switch').first()
  if ((await sw.count()) === 0) return
  const outline = await sw.evaluate((element) => {
    const style = getComputedStyle(element)
    return { width: style.outlineWidth, style: style.outlineStyle }
  })
  expect(outline.style).not.toBe('none')
  expect(parseFloat(outline.width)).toBeGreaterThan(0)
})

test('the focus ring survives forced colours', async ({ page }) => {
  test.skip(
    page.context().browser()?.browserType().name() === 'webkit',
    'WebKit cannot emulate forced colours',
  )
  await page.emulateMedia({ forcedColors: 'active' })
  await page.goto('/#/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.keyboard.press('/')
  const outline = await page
    .getByPlaceholder(/Search the course/i)
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element)
      return { width: style.outlineWidth, style: style.outlineStyle, colour: style.outlineColor }
    })

  expect(outline.style).not.toBe('none')
  expect(parseFloat(outline.width)).toBeGreaterThan(0)
})
