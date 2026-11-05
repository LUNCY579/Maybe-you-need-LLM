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
  { path: '/modules/red-teaming', name: 'a module' },
  { path: '/lessons/the-critique-and-revise-loop', name: 'a lesson' },
  { path: '/labs', name: 'the laboratory index' },
  { path: '/labs/constitution', name: 'the constitution laboratory' },
  { path: '/labs/constitution?view=critics', name: 'the two critics compared, deep-linked' },
  { path: '/labs/alignment', name: 'the two-round laboratory' },
  { path: '/labs/redteam', name: 'the red-team laboratory' },
  { path: '/labs/redteam?view=budget', name: 'the search-budget view, deep-linked' },
  { path: '/labs/sleeper', name: 'the cued-behaviour laboratory' },
  { path: '/labs/preference', name: 'the labeler-consistency laboratory' },
  { path: '/labs/sycophancy', name: 'the sycophancy laboratory' },
  { path: '/labs/privacy', name: 'the privacy laboratory' },
  { path: '/labs/privacy?view=membership', name: 'the membership-attack view, deep-linked' },
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
          window.localStorage.setItem('safety-lab:theme', value)
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
    await expect(page.getByRole('heading', { level: 1 })).toContainText('What a safety claim is worth')
    await expect(page.getByRole('link', { name: /Constitutional AI/ }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Start the course' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The lessons')
  })

  test('a lesson names its source and can be completed', async ({ page }) => {
    await page.goto('/#/lessons/the-critique-and-revise-loop')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The critique-and-revise loop')
    await expect(page.getByText(/§cai:2 The supervised stage/).first()).toBeVisible()
    await page.getByRole('button', { name: 'Mark as complete' }).click()
    const status = page.locator('.stat', { hasText: 'Status' }).first().locator('.stat-value')
    await expect(status).toHaveText('Complete')
  })

  test('the constitution laboratory runs the loop', async ({ page }) => {
    await page.goto('/#/labs/constitution')
    await expect(page.getByRole('heading', { name: /Laboratory A/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The harm before' }).first()).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The judge’s agreement' }).first()).toBeVisible()
  })

  test('the two-round laboratory shows what each round reaches', async ({ page }) => {
    await page.goto('/#/labs/alignment')
    await expect(page.getByRole('heading', { name: /Laboratory B/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The movement' }).first()).toBeVisible()
  })

  test('the red-team laboratory reports a coverage', async ({ page }) => {
    await page.goto('/#/labs/redteam')
    await expect(page.getByRole('heading', { name: /Laboratory C/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The coverage' }).first()).toBeVisible()
  })

  test('the cued-behaviour laboratory reports the under-count', async ({ page }) => {
    await page.goto('/#/labs/sleeper')
    await expect(page.getByRole('heading', { name: /Laboratory D/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The harm there actually is' }).first()).toBeVisible()
  })

  test('the labeler laboratory separates agreement from consistency', async ({ page }) => {
    await page.goto('/#/labs/preference')
    await expect(page.getByRole('heading', { name: /Laboratory E/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'Two looks agree' }).first()).toBeVisible()
  })

  test('the sycophancy laboratory measures the flip rate', async ({ page }) => {
    await page.goto('/#/labs/sycophancy')
    await expect(page.getByRole('heading', { name: /Laboratory F/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The flip rate' }).first()).toBeVisible()
  })

  test('the privacy laboratory reports the exposure', async ({ page }) => {
    await page.goto('/#/labs/privacy')
    await expect(page.getByRole('heading', { name: /Laboratory G/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The exposure' }).first()).toBeVisible()
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
    await page.getByLabel('Filter').fill('judge')
    const filtered = await cards.count()
    expect(filtered).toBeGreaterThan(0)
    expect(filtered).toBeLessThan(total)
  })

  test('the equations page shows a derivation', async ({ page }) => {
    await page.goto('/#/equations')
    await page.getByRole('button', { name: 'The symbols, the derivation and an example' }).first().click()
    await expect(page.getByRole('heading', { name: 'The derivation' })).toBeVisible()
  })

  test('the sources page states the licensing position', async ({ page }) => {
    await page.goto('/#/sources')
    await expect(page.getByText(/Nothing from any of them is|reproduced/i).first()).toBeVisible()
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
