import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { LABS } from '../src/content/labs'

/**
 * The browser suite.
 *
 * It covers the student's journey and audits every page against the WCAG 2.1
 * A and AA criteria with axe-core, in both the light and the dark theme.
 *
 * The laboratories are walked from the registry rather than from a list written here,
 * because the list written here was four deep links that had been renumbered: a screen
 * added to `labs.ts` is audited by this file without anyone remembering to add it.
 */

const PAGES = [
  { path: '/', name: 'the overview' },
  { path: '/lessons', name: 'the lessons' },
  { path: '/modules/compute', name: 'a module' },
  { path: '/lessons/the-compute-budget', name: 'a lesson' },
  { path: '/labs', name: 'the laboratory index' },
  ...LABS.map((lab) => ({ path: `/labs/${lab.id}`, name: `the ${lab.id} laboratory` })),
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
          window.localStorage.setItem('scaling-lab:theme', value)
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
    await expect(page.getByRole('heading', { level: 1 })).toContainText('How the loss falls')
    await expect(page.getByRole('link', { name: /Scaling Laws for Neural Language Models/ }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Start the course' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The lessons')
  })

  test('a lesson names its source and can be completed', async ({ page }) => {
    await page.goto('/#/lessons/the-compute-budget')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The compute budget')
    await expect(page.getByText(/§chinchilla:1 Introduction/).first()).toBeVisible()
    await page.getByRole('button', { name: 'Mark as complete' }).click()
    const status = page.locator('.stat', { hasText: 'Status' }).first().locator('.stat-value')
    await expect(status).toHaveText('Complete')
  })

  for (const lab of LABS) {
    // The letter is in the registry, not here: these assertions were written against
    // `Laboratory C` and `Laboratory D`, and the screens were renumbered when the four
    // new laboratories joined them.
    const letter = lab.name.split(' · ')[0]

    test(`the ${lab.id} laboratory opens on its first view and prints its numbers`, async ({ page }) => {
      await page.goto(`/#/labs/${lab.id}`)
      await expect(page.getByRole('heading', { name: new RegExp(`Laboratory ${letter}`) })).toBeVisible()
      const tabs = page.getByRole('group', { name: 'View' }).getByRole('button')
      expect(await tabs.count()).toBeGreaterThan(1)
      await expect(tabs.first()).toHaveAttribute('aria-pressed', 'true')
      await expect(page.locator('.stat').first()).toBeVisible()
      // A screen whose numbers are computed shows them in something readable: a chart
      // to look at or a table to read. Which of the two, and on which tab, is the
      // screen's business — every one of them has at least one of the two.
      await expect(page.locator('svg, table').first()).toBeVisible()
    })

    test(`the ${lab.id} laboratory keeps the view a reader clicked when the page reloads`, async ({ page }) => {
      await page.goto(`/#/labs/${lab.id}`)
      const tabs = page.getByRole('group', { name: 'View' }).getByRole('button')
      const last = tabs.last()
      const label = ((await last.textContent()) ?? '').trim()
      await last.click()
      await expect(last).toHaveAttribute('aria-pressed', 'true')
      const url = page.url()
      expect(url).toContain('?view=')

      // The link a reader could send to a colleague is the state they clicked into.
      await page.goto(url)
      await expect(page.getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-pressed', 'true')
      await expect(tabs.first()).toHaveAttribute('aria-pressed', 'false')
    })
  }

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
    await page.getByLabel('Filter').fill('perplexity')
    const filtered = await cards.count()
    expect(filtered).toBeGreaterThanOrEqual(0)
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
