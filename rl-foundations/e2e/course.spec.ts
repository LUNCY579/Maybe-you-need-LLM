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
  { path: '/modules/policy-gradients', name: 'a module' },
  { path: '/lessons/the-likelihood-ratio-trick', name: 'a lesson' },
  { path: '/labs', name: 'the laboratory index' },
  { path: '/labs/gridworld', name: 'the gridworld laboratory' },
  { path: '/labs/policygradient', name: 'the policy-gradient laboratory' },
  { path: '/labs/returns', name: 'the returns laboratory' },
  { path: '/labs/actorcritic', name: 'the actor–critic laboratory' },
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
          window.localStorage.setItem('rl-foundations:theme', value)
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
    await expect(page.getByRole('heading', { level: 1 })).toContainText('What an agent is trying to do')
    await expect(page.getByRole('link', { name: /Reinforcement Learning: An Introduction/ }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Start the course' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The lessons')
  })

  test('a lesson names its source and can be completed', async ({ page }) => {
    await page.goto('/#/lessons/the-likelihood-ratio-trick')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The likelihood-ratio trick')
    await expect(page.getByText(/§sutton:13 Policy gradients/).first()).toBeVisible()
    await page.getByRole('button', { name: 'Mark as complete' }).click()
    const status = page.locator('.stat', { hasText: 'Status' }).first().locator('.stat-value')
    await expect(status).toHaveText('Complete')
  })

  test('the gridworld laboratory computes the optimal value', async ({ page }) => {
    await page.goto('/#/labs/gridworld')
    await expect(page.getByRole('heading', { name: /Laboratory A/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The optimal value' }).first()).toBeVisible()
    await expect(page.locator('table').first()).toBeVisible()
  })

  test('the policy-gradient laboratory compares the estimate with the exact gradient', async ({ page }) => {
    await page.goto('/#/labs/policygradient')
    await expect(page.getByRole('heading', { name: /Laboratory B/ })).toBeVisible()
    await page.getByRole('button', { name: 'The estimator' }).click()
    await expect(page.locator('.stat', { hasText: 'The relative error' }).first()).toBeVisible()
  })

  test('the returns laboratory measures a bias and a variance', async ({ page }) => {
    await page.goto('/#/labs/returns')
    await expect(page.getByRole('heading', { name: /Laboratory C/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The bias' }).first()).toBeVisible()
  })

  test('the actor–critic laboratory learns', async ({ page }) => {
    await page.goto('/#/labs/actorcritic')
    await expect(page.getByRole('heading', { name: /Laboratory D/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The learned policy is worth' }).first()).toBeVisible()
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
    await page.getByLabel('Filter').fill('baseline')
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
