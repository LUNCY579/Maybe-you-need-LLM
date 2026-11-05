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
  { path: '/modules/filtering', name: 'a module' },
  { path: '/lessons/the-reference-model', name: 'a lesson' },
  { path: '/labs', name: 'the laboratory index' },
  { path: '/labs/pipeline', name: 'the pipeline laboratory' },
  { path: '/labs/budget', name: 'the budget laboratory' },
  { path: '/labs/midas', name: 'the MIDAS laboratory' },
  { path: '/labs/dedup', name: 'the deduplication laboratory' },
  { path: '/labs/mixture', name: 'the mixture laboratory' },
  { path: '/labs/proxy', name: 'the proxy laboratory' },
  { path: '/labs/refinement', name: 'the refinement laboratory' },
  { path: '/labs/collapse', name: 'the collapse laboratory' },
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
          window.localStorage.setItem('data-lab:theme', value)
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
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The data, and what it does')
    await expect(page.getByRole('link', { name: /DataComp/ }).first()).toBeVisible()
    await page.getByRole('link', { name: 'Start the course' }).click()
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The lessons')
  })

  test('a lesson names its source and can be completed', async ({ page }) => {
    await page.goto('/#/lessons/the-reference-model')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('The reference model')
    await expect(page.getByText(/§refinedweb:2.2 Perplexity filtering/).first()).toBeVisible()
    await page.getByRole('button', { name: 'Mark as complete' }).click()
    const status = page.locator('.stat', { hasText: 'Status' }).first().locator('.stat-value')
    await expect(status).toHaveText('Complete')
  })

  test('the pipeline laboratory reports what the filters removed', async ({ page }) => {
    await page.goto('/#/labs/pipeline')
    await expect(page.getByRole('heading', { name: /Laboratory A/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'Documents kept' }).first()).toBeVisible()
    await expect(page.locator('table').first()).toBeVisible()
  })

  test('the perplexity threshold changes how much survives', async ({ page }) => {
    await page.goto('/#/labs/pipeline')
    const kept = page.locator('.stat', { hasText: 'Documents kept' }).first().locator('.stat-value')
    const before = await kept.textContent()
    await page.getByRole('slider', { name: /perplexity threshold/ }).fill('400')
    await expect(kept).not.toHaveText(before ?? '')
  })

  test('the deduplication laboratory finds the near-duplicates', async ({ page }) => {
    await page.goto('/#/labs/dedup')
    await expect(page.getByRole('heading', { name: /Laboratory B/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'Removed as duplicates' }).first()).toBeVisible()
  })

  test('the mixture laboratory compares the mixtures', async ({ page }) => {
    await page.goto('/#/labs/mixture')
    await expect(page.getByRole('heading', { name: /Laboratory C/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The worst domain' }).first()).toBeVisible()
  })

  test('the collapse laboratory loses the tail', async ({ page }) => {
    await page.goto('/#/labs/collapse')
    await expect(page.getByRole('heading', { name: /Laboratory D/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The original tail mass' }).first()).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The symbols it can still say' }).first()).toBeVisible()
  })

  test('the budget laboratory prints the three gains side by side', async ({ page }) => {
    await page.goto('/#/labs/budget')
    await expect(page.getByRole('heading', { name: /Laboratory F/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'Tokens in the full budget' }).first()).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'Filtered against the control' }).first()).toBeVisible()
  })

  test('the MIDAS laboratory keeps a cluster rather than collapsing it', async ({ page }) => {
    await page.goto('/#/labs/midas')
    await expect(page.getByRole('heading', { name: /Laboratory E/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'Boilerplate and unseen text' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'The similar documents' }).click()
    await expect(page.locator('table', { hasText: 'What the filter grouped' }).first()).toBeVisible()
  })

  test('the refinement laboratory shows quality and loss moving together', async ({ page }) => {
    await page.goto('/#/labs/refinement')
    await expect(page.getByRole('heading', { name: /Laboratory G/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'Held-out loss, first pass to last' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'One pass against four' }).click()
    await expect(page.locator('.stat', { hasText: 'Both arms end at' }).first()).toBeVisible()
  })

  test('the proxy laboratory shows the handover and the trip', async ({ page }) => {
    await page.goto('/#/labs/proxy')
    await expect(page.getByRole('heading', { name: /Laboratory H/ })).toBeVisible()
    await expect(page.locator('.stat', { hasText: 'The scaling factor' }).first()).toBeVisible()
    await page.getByRole('button', { name: 'The trip' }).click()
    await expect(page.locator('.stat', { hasText: "Spearman's rho between the arms" }).first()).toBeVisible()
  })

  test('every laboratory the index promises has a screen behind it', async ({ page }) => {
    await page.goto('/#/labs')
    await expect(page.getByRole('link', { name: /A · The pipeline/ })).toBeVisible()
    await expect(page.getByRole('link', { name: /H · The proxy step/ })).toBeVisible()
    await expect(page.locator('.lab-card')).toHaveCount(8)
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
    await page.getByLabel('Filter').fill('perplexity')
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
