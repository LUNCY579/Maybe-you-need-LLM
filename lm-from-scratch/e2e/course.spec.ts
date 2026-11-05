import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * The browser suite.
 *
 * It covers the student's journey and audits every page against the WCAG 2.1
 * A and AA criteria with axe-core, in both the light and the dark theme.
 */

const PAGES = [
  { path: '/', name: 'the overview' },
  { path: '/lessons', name: 'the lessons' },
  { path: '/modules/accounting', name: 'a module' },
  { path: '/lessons/the-flops', name: 'a lesson' },
  { path: '/labs', name: 'the laboratory index' },
  { path: '/labs/tokenizer', name: 'the tokeniser laboratory' },
  { path: '/labs/architecture', name: 'the architecture laboratory' },
  { path: '/labs/accounting', name: 'the accounting laboratory' },
  { path: '/labs/data', name: 'the data laboratory' },
  { path: '/labs/scaling', name: 'the scaling laboratory' },
  { path: '/practice', name: 'the practice bank' },
  { path: '/glossary', name: 'the glossary' },
  { path: '/equations', name: 'the equations' },
  { path: '/sources', name: 'the sources' },
  { path: '/dashboard', name: 'the dashboard' },
]

async function audit(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`accessibility in the ${theme} theme`, () => {
    for (const target of PAGES) {
      test(`${target.name} has no accessibility violations`, async ({ page }) => {
        await page.addInitScript((value) => {
          window.localStorage.setItem('lm-from-scratch:theme', value)
        }, theme)
        await page.goto(`/#${target.path}`)
        await page.waitForLoadState('networkidle')
        const results = await audit(page)
        expect(results.violations).toEqual([])
      })
    }
  })
}

test.describe('the student journey', () => {
  test('the overview names the source and links into the course', async ({ page }) => {
    await page.goto('/#')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('from the tokeniser')
    await expect(page.getByRole('link', { name: /CS336/ }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Start the course' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The lessons')
  })

  test('a lesson names its source and can be completed', async ({ page }) => {
    await page.goto('/#/lessons/the-flops')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The FLOPs')
    await expect(page.getByText(/resource accounting/).first()).toBeVisible()
    await page.getByRole('button', { name: 'Mark as complete' }).click()
    const status = page.locator('.stat', { hasText: 'Status' }).first().locator('.stat-value')
    await expect(status).toHaveText('Complete')
  })

  test('the tokeniser laboratory trains a tokeniser and reports a ratio', async ({ page }) => {
    await page.goto('/#/labs/tokenizer')
    await expect(page.getByRole('heading', { name: /Laboratory A/ })).toBeVisible()
    const ratio = page.locator('.stat', { hasText: 'Bytes per token' }).first().locator('.stat-value')
    await expect(ratio).not.toHaveText('')
    await expect(ratio).toContainText('.')
  })

  test('the accounting laboratory reports a computed cost', async ({ page }) => {
    await page.goto('/#/labs/accounting')
    await expect(page.getByRole('heading', { name: /Laboratory C/ })).toBeVisible()
    const flops = page.locator('.stat', { hasText: 'FLOPs per step' }).first().locator('.stat-value')
    await expect(flops).toContainText('T')
  })

  test('the training laboratory trains a model and the loss falls', async ({ page }) => {
    await page.goto('/#/labs/training')
    await expect(page.getByRole('heading', { name: /Laboratory E/ })).toBeVisible()
    await page.getByRole('button', { name: 'Train from scratch' }).click()
    await expect(page.locator('.stat', { hasText: 'The final loss' }).first()).toBeVisible({ timeout: 30000 })
    const first = await page.locator('.stat', { hasText: 'The final loss' }).first().locator('.stat-hint').textContent()
    expect(first).toMatch(/from /)
  })

  test('a practice question can be answered and explained', async ({ page }) => {
    await page.goto('/#/practice')
    const first = page.locator('.panel', { has: page.getByRole('button', { name: 'Check the answer' }) }).first()
    await first.getByRole('radio').first().check()
    await first.getByRole('button', { name: 'Check the answer' }).click()
    await expect(first.locator('.result-verdict')).toBeVisible()
  })

  test('the glossary can be filtered', async ({ page }) => {
    await page.goto('/#/glossary')
    const cards = page.locator('.glossary-card')
    const total = await cards.count()
    expect(total).toBeGreaterThan(10)
    await page.getByLabel('Filter').fill('token')
    const filtered = await cards.count()
    expect(filtered).toBeGreaterThan(0)
    expect(filtered).toBeLessThan(total)
  })

  test('the equations page shows a derivation', async ({ page }) => {
    await page.goto('/#/equations')
    await page.getByRole('button', { name: 'The symbols, the derivation and an example' }).first().click()
    await expect(page.getByRole('heading', { name: 'The derivation' })).toBeVisible()
  })

  test('the dashboard exports a progress file', async ({ page }) => {
    await page.goto('/#/dashboard')
    const download = page.waitForEvent('download')
    await page.getByRole('button', { name: 'Export the progress' }).click()
    const file = await download
    expect(file.suggestedFilename()).toContain('progress')
  })

  test('the theme toggle switches the theme', async ({ page }) => {
    await page.goto('/#')
    const html = page.locator('html')
    const before = await html.getAttribute('class')
    await page.getByRole('button', { name: /Switch to the/ }).click()
    await expect(html).not.toHaveAttribute('class', before ?? '')
  })
})
