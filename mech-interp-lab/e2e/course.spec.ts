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
  { path: '/modules/superposition', name: 'a module' },
  { path: '/lessons/the-toy-model', name: 'a lesson' },
  { path: '/labs', name: 'the laboratory index' },
  { path: '/labs/superposition', name: 'the superposition laboratory' },
  { path: '/labs/autoencoder', name: 'the autoencoder laboratory' },
  { path: '/labs/patching', name: 'the patching laboratory' },
  { path: '/labs/attention', name: 'the attention laboratory' },
  { path: '/labs/induction', name: 'the induction laboratory' },
  { path: '/labs/circuit', name: 'the circuit discovery laboratory' },
  { path: '/labs/ioi', name: 'the IOI laboratory' },
  { path: '/labs/circuit?view=prune', name: 'the pruning view, deep-linked' },
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
          window.localStorage.setItem('mech-interp-lab:theme', value)
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
    await expect(page.getByRole('heading', { level: 1 })).toContainText('What a model computes')
    await expect(
      page.getByRole('link', { name: /Sparse Autoencoders Find Highly Interpretable Features/ }).first(),
    ).toBeVisible()
    await page.getByRole('link', { name: 'Start the course' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The lessons')
  })

  test('a lesson names its source and can be completed', async ({ page }) => {
    await page.goto('/#/lessons/the-toy-model')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The toy model')
    await expect(page.getByText(/§sae:2 Taking Features out of Superposition/).first()).toBeVisible()
    await page.getByRole('button', { name: 'Mark as complete' }).click()
    const status = page.locator('.stat', { hasText: 'Status' }).first().locator('.stat-value')
    await expect(status).toHaveText('Complete')
  })

  test('the superposition laboratory reports a computed loss', async ({ page }) => {
    await page.goto('/#/labs/superposition')
    await expect(page.getByRole('heading', { name: /Laboratory A/ })).toBeVisible()
    const loss = page.locator('.stat', { hasText: 'The loss' }).first().locator('.stat-value')
    await expect(loss).toContainText(/[0-9]/)
  })

  test('the number of dimensions changes the interference', async ({ page }) => {
    await page.goto('/#/labs/superposition')
    const interference = page.locator('.stat', { hasText: 'The interference' }).first().locator('.stat-value')
    const before = await interference.textContent()
    await page.getByRole('slider', { name: /Dimensions/ }).fill('16')
    await expect(interference).not.toHaveText(before ?? '')
  })

  test('the autoencoder laboratory trains an autoencoder', async ({ page }) => {
    await page.goto('/#/labs/autoencoder')
    await expect(page.getByRole('heading', { name: /Laboratory B/ })).toBeVisible()
    await page.getByRole('button', { name: 'Train from scratch' }).click()
    await expect(page.locator('.stat', { hasText: 'The reconstruction error' }).first()).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The L0' }).first()).toBeVisible()
  })

  test('the patching laboratory reports an effect and a faithfulness', async ({ page }) => {
    await page.goto('/#/labs/patching')
    await expect(page.getByRole('heading', { name: /Laboratory C/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The largest effect' }).first()).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The faithfulness' }).first()).toBeVisible()
  })

  test('the attention laboratory splits a head exactly', async ({ page }) => {
    await page.goto('/#/labs/attention')
    await expect(page.getByRole('heading', { name: /Laboratory D/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The split' }).first()).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The discrepancy' }).first()).toContainText(/0(\.0+)?|e-/)
  })

  test('the circuit laboratory finds the circuit the model is wired with', async ({ page }) => {
    await page.goto('/#/labs/circuit')
    await expect(page.getByRole('heading', { name: /Laboratory F/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The circuit found' }).first()).toContainText(/[0-9]+ edges/)
  })

  test('the IOI laboratory runs the four steps', async ({ page }) => {
    await page.goto('/#/labs/ioi')
    await expect(page.getByRole('heading', { name: /Laboratory G/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The circuit found' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'The published circuit' }).click()
    await expect(page.getByText(/Everything on this tab is quoted/)).toBeVisible()
  })

  test('a lesson deep-links to the view it names', async ({ page }) => {
    await page.goto('/#/lessons/automating-the-search')
    await page.getByRole('link', { name: /Open/ }).click()
    await expect(page).toHaveURL(/view=prune/)
    await expect(page.getByRole('button', { name: 'The pruning' })).toHaveAttribute('aria-pressed', 'true')
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
    await page.getByLabel('Filter').fill('interference')
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
    await expect(page.getByText(/Nothing is reproduced|reproduced/i).first()).toBeVisible()
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
