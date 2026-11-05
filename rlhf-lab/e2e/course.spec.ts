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
  { path: '/modules/ppo', name: 'a module' },
  { path: '/lessons/the-clipped-objective', name: 'a lesson' },
  { path: '/labs', name: 'the laboratory index' },
  { path: '/labs/gradient', name: 'the gradient laboratory' },
  { path: '/labs/ppo', name: 'the clipped objective laboratory' },
  { path: '/labs/gae', name: 'the advantage laboratory' },
  { path: '/labs/kl', name: 'the KL laboratory' },
  { path: '/labs/overoptimisation', name: 'the overoptimisation laboratory' },
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
          window.localStorage.setItem('rlhf-lab:theme', value)
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
    await expect(page.getByRole('heading', { level: 1 })).toContainText('human feedback')
    await expect(page.getByRole('link', { name: /N\+ Implementation Details/ }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Start the course' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The lessons')
  })

  test('a lesson names its source and can be completed', async ({ page }) => {
    await page.goto('/#/lessons/the-clipped-objective')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The clipped objective')
    await expect(page.getByText(/§2 Background/).first()).toBeVisible()
    await page.getByRole('button', { name: 'Mark as complete' }).click()
    const status = page.locator('.stat', { hasText: 'Status' }).first().locator('.stat-value')
    await expect(status).toHaveText('Complete')
  })

  test('the gradient laboratory checks its gradient against a finite difference', async ({ page }) => {
    await page.goto('/#/labs/gradient')
    await expect(page.getByRole('heading', { name: /Laboratory A/ })).toBeVisible()
    const error = page.locator('.stat', { hasText: 'Worst gradient error' }).first()
    await expect(error.locator('.stat-value')).toContainText('e-')
  })

  test('the clip range changes the clipped objective', async ({ page }) => {
    await page.goto('/#/labs/ppo')
    const objective = page.locator('.stat', { hasText: 'Mean clipped objective' }).first()
    const before = await objective.locator('.stat-value').textContent()
    await page.getByRole('slider', { name: /clip range/ }).fill('0.05')
    await expect(objective.locator('.stat-value')).not.toHaveText(before ?? '')
  })

  test('the overoptimisation laboratory shows the true reward turning over', async ({ page }) => {
    await page.goto('/#/labs/overoptimisation')
    await expect(page.getByRole('heading', { name: /Laboratory F/ })).toBeVisible()
    const best = page.locator('.stat', { hasText: 'The best true reward' }).first()
    await expect(best.locator('.stat-value')).toBeVisible()
    const far = page.locator('.stat', { hasText: 'The true reward at the far end' }).first()
    await expect(far.locator('.stat-value')).toBeVisible()
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
    await page.getByLabel('Filter').fill('clip')
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
