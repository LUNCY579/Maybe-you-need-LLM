import { expect, test } from '@playwright/test'
import { COLLECTION_COURSES, COLLECTION_NEXT, COLLECTION_SHARED_CONCEPTS } from '../src/content/collection.generated'

/**
 * The panel that says where this course sits in the collection.
 *
 * Its data is generated from the collection's own catalogue by
 * tools/readCollection.mjs, so the assertions read that same generated file:
 * a panel that showed three of the successors, or a directory name where a
 * title belongs, would otherwise look fine.
 */

test.describe('the rest of the collection', () => {
  test('the landing page points at the courses the catalogue puts after this one', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'The rest of the collection' })).toBeVisible()

    if (COLLECTION_NEXT.length === 0) {
      await expect(page.getByText('The catalogue puts no course after this one yet.')).toBeVisible()
    } else {
      const successors = page
        .locator('h4', { hasText: 'What to read next' })
        .locator('xpath=following-sibling::ul[1]')
        .locator('li')
      await expect(successors).toHaveCount(COLLECTION_NEXT.length)

      for (const course of COLLECTION_NEXT) {
        const link = page.locator(`a[href="../${course.id}/"]`).first()
        await expect(link).toBeVisible()
        await expect(link).toContainText(course.title)
        // The reason is the point of the panel; a bare list of links says nothing.
        await expect(page.getByText(course.reason, { exact: true }).first()).toBeVisible()
      }
    }

    for (const concept of COLLECTION_SHARED_CONCEPTS) {
      for (const id of concept.alsoIn) {
        const title = COLLECTION_COURSES.find((course) => course.id === id)?.title
        expect(title, `${id} is in the concept index but not in the course list`).toBeTruthy()
        await expect(page.locator(`a[href="../${id}/"]`).first()).toContainText(title as string)
      }
    }

    // The count on screen is the size of the catalogue, not a rounded claim.
    await expect(
      page.getByText(`one of ${COLLECTION_COURSES.length} interactive courses`, { exact: false }).first(),
    ).toBeVisible()
  })

  test('every link in the panel leaves the application, and says so', async ({ page }) => {
    await page.goto('/')
    const panel = page
      .locator('div.surface')
      .filter({ has: page.getByRole('heading', { name: 'The rest of the collection' }) })
      .last()
    // A relative "../<course>/" address is only correct in a build that sits
    // inside the collection. Every link the panel draws must use it, so a link
    // that was written as an in-app route is caught here rather than in the
    // 404 the reader would meet.
    const hrefs = await panel.locator('a').evaluateAll((links) => links.map((link) => link.getAttribute('href')))
    expect(hrefs.length).toBeGreaterThan(0)
    for (const href of hrefs) {
      expect(href, 'a link in the panel is not a collection address').toMatch(/^\.\.\/[a-z0-9-]+\/$/)
    }
  })
})
