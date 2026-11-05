import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * The browser suite.
 *
 * It covers the student's journey — read a lesson, answer a question, run a
 * laboratory, use the search, export the progress — and audits every page
 * against the WCAG 2.1 A and AA criteria with axe-core, in both the light and
 * the dark theme.
 */

const PAGES = [
  { path: '/', name: 'the overview' },
  { path: '/lessons', name: 'the lessons' },
  { path: '/modules/forward', name: 'a module' },
  { path: '/lessons/the-closed-form', name: 'a lesson' },
  { path: '/labs', name: 'the laboratory index' },
  { path: '/labs/forward', name: 'the forward laboratory' },
  { path: '/labs/schedules', name: 'the schedule laboratory' },
  { path: '/labs/guidance', name: 'the guidance laboratory' },
  { path: '/labs/variational', name: 'the bound laboratory' },
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
          window.localStorage.setItem('diffusion-lab:theme', value)
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
  test('the overview links to the course and names the source', async ({ page }) => {
    await page.goto('/#')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Diffusion models')
    await expect(
      page.getByRole('link', { name: /Denoising Diffusion Probabilistic Models/ }).first(),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Start the course' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The lessons')
  })

  test('a lesson names its source and can be completed', async ({ page }) => {
    await page.goto('/#/lessons/the-closed-form')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The closed form')
    await expect(page.getByText(/§2 Background/)).toBeVisible()
    await page.getByRole('button', { name: 'Mark as complete' }).click()
    const status = page.locator('.stat', { hasText: 'Status' }).first().locator('.stat-value')
    await expect(status).toHaveText('Complete')
  })

  test('the laboratory reports computed values rather than placeholders', async ({ page }) => {
    await page.goto('/#/labs/forward')
    await expect(page.getByRole('heading', { name: /Laboratory A/ })).toBeVisible()
    // The signal-to-noise ratio is a computed number, not a dash.
    const snr = page.locator('.stat', { hasText: 'SNR' }).first()
    await expect(snr.locator('.stat-value')).not.toHaveText('—')
    await expect(snr.locator('.stat-value')).not.toHaveText('')
  })

  test('the timestep control changes the computed signal-to-noise ratio', async ({ page }) => {
    await page.goto('/#/labs/forward')
    const snr = page.locator('.stat', { hasText: 'SNR' }).first().locator('.stat-value')
    const before = await snr.textContent()
    await page.getByRole('slider', { name: /Timestep/ }).fill('150')
    await expect(snr).not.toHaveText(before ?? '')
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
    await page.getByLabel('Filter').fill('posterior')
    await expect(cards.first()).toBeVisible()
    const filtered = await cards.count()
    expect(filtered).toBeGreaterThan(0)
    expect(filtered).toBeLessThan(total)
  })

  test('the search finds a lesson and opens it', async ({ page }) => {
    await page.goto('/#')
    await page.getByRole('button', { name: /Search/ }).click()
    await page.locator('#course-search').fill('closed form')
    await expect(page.locator('.search-results a').first()).toBeVisible()
    await page.locator('.search-results a').first().click()
    await expect(page).toHaveURL(/closed-form/)
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
