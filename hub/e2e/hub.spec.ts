import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * The hub's browser suite.
 *
 * The hub is the collection's front door, so it is audited in the same way
 * as every course: with axe-core, over the whole page, in both themes.
 */

async function audit(page: import('@playwright/test').Page) {
  return new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
}

for (const theme of ['dark', 'light'] as const) {
  test.describe(`accessibility in the ${theme} theme`, () => {
    test('the collection page has no accessibility violations', async ({ page }) => {
      await page.addInitScript((value) => {
        window.localStorage.setItem('llm-materials:theme', value)
      }, theme)
      await page.goto('/')
      await page.waitForLoadState('networkidle')
      const results = await audit(page)
      expect(results.violations).toEqual([])
    })
  })
}

test.describe('the collection page', () => {
  test('it names the collection and counts the courses', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('courses')
    await expect(page.locator('.hub-course').first()).toBeVisible()
  })

  test('it offers a starting course from the path', async ({ page }) => {
    await page.goto('/')
    const start = page.locator('.hub-start')
    await expect(start).toBeVisible()
    await expect(start.getByRole('heading')).toContainText('Begin with')
    await expect(start.getByRole('link', { name: /Start/ })).toBeVisible()
  })

  test('it filters the courses by level on the path', async ({ page }) => {
    await page.goto('/')
    const courses = page.locator('.hub-course')
    const total = await courses.count()
    expect(total).toBeGreaterThan(5)
    await page.getByRole('button', { name: /^Level 1/ }).click()
    const filtered = await courses.count()
    expect(filtered).toBeGreaterThan(0)
    expect(filtered).toBeLessThan(total)
  })

  test('it searches the whole collection', async ({ page }) => {
    await page.goto('/')
    await page.getByLabel('Search the collection').fill('perplexity')
    await expect(page.locator('.catalogue-search-hit').first()).toBeVisible()
  })

  test('it shows the learning path', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'The learning path' })).toBeVisible()
    await expect(page.locator('.catalogue-path-course').first()).toBeVisible()
  })

  test('it lists the sources with their licences', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'The sources' })).toBeVisible()
    await expect(page.locator('.catalogue-source-row').first()).toBeVisible()
  })

  test('the theme toggle switches the theme', async ({ page }) => {
    await page.goto('/')
    const html = page.locator('html')
    const before = await html.getAttribute('data-theme')
    await page.getByRole('button', { name: /Switch to the/ }).click()
    await expect(html).not.toHaveAttribute('data-theme', before ?? '')
  })

  test('it lists the sources and filters them', async ({ page }) => {
    await page.goto('/')
    const browser = page.locator('.catalogue-source-browser')
    await expect(browser.locator('.catalogue-source-row').first()).toBeVisible()
    const total = await browser.locator('.catalogue-source-row').count()
    expect(total).toBeGreaterThan(50)

    await page.getByLabel('The course').selectOption('data-lab')
    const filtered = await browser.locator('.catalogue-source-row').count()
    expect(filtered).toBeGreaterThan(0)
    expect(filtered).toBeLessThan(total)
  })

  test('it has a shared glossary', async ({ page }) => {
    await page.goto('/')
    const glossary = page.locator('.catalogue-glossary')
    await expect(glossary.locator('.catalogue-glossary-entry').first()).toBeVisible()
    const count = await glossary.locator('.catalogue-glossary-entry').count()
    expect(count).toBeGreaterThan(10)
    await page.getByLabel('Search the glossary').fill('baseline')
    await expect(glossary.getByText('The baseline')).toBeVisible()
  })

  test('it shows the learner’s progress across the collection', async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        'data-lab:progress',
        JSON.stringify({
          version: 1,
          data: {
            lessons: { 'what-a-task-is': { complete: true }, bm25: { complete: true } },
            quiz: {},
            knownTerms: ['benchmark'],
            tracks: {},
            flags: {},
          },
        }),
      )
    })
    await page.goto('/')
    const panel = page.locator('#progress')
    await expect(panel.getByText('Data Lab')).toBeVisible()
    await expect(panel.getByText(/2 lessons complete/)).toBeVisible()
    await expect(panel.getByText(/terms marked as known/)).toBeVisible()
  })
})
