import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App'
import { LABS } from '../content/labs'
import { LESSONS, MODULES } from '../content/curriculum'

/**
 * The pages that count things, mounted the way the app mounts them.
 *
 * A page that says how many lessons or laboratories the course has is making a claim
 * about its own files, and a hard-coded number goes stale the moment a lesson is added
 * somewhere else. So the claim is checked against the arrays it is supposed to be read
 * from, which is the only way to notice the drift rather than to re-read the prose.
 */

const at = (path: string) => {
  window.location.hash = path
  return render(<App />)
}

afterEach(cleanup)

const text = (element: Element | null) => (element?.textContent ?? '').replace(/\s+/g, ' ')

/** The app is on a hash router, so a link’s href carries a leading `#` the route does not. */
const routes = (selector: string) =>
  Array.from(document.querySelectorAll(selector)).map((link) => (link.getAttribute('href') ?? '').replace(/^#/, ''))

describe('the overview', () => {
  it('lists every laboratory in the registry, and no other', () => {
    at('#/')
    const cards = document.querySelectorAll('.lab-card')
    expect(cards.length).toBe(LABS.length)
    for (const lab of LABS) {
      const card = Array.from(cards).find((element) => text(element).includes(lab.name))
      expect(card, lab.name).toBeDefined()
      expect(text(card ?? null), lab.name).toContain(lab.blurb)
    }
  })

  it('states the counts the course actually has', () => {
    at('#/')
    const body = document.body.textContent ?? ''
    expect(body).toContain(`${MODULES.length} modules, ${LESSONS.length} lessons, ${LABS.length} laboratories`)
    expect(body).toContain(`${LABS.length} screens`)
  })

  it('links every laboratory to its screen', () => {
    at('#/')
    const hrefs = routes('.lab-card')
    expect(hrefs.length).toBe(LABS.length)
    for (const lab of LABS) expect(hrefs, lab.id).toContain(`/labs/${lab.id}`)
  })

  it('links every module to its page', () => {
    at('#/')
    const hrefs = routes('.module-card')
    expect(hrefs.length).toBe(MODULES.length)
    for (const module of MODULES) expect(hrefs, module.id).toContain(`/modules/${module.id}`)
  })
})

describe('the lesson index', () => {
  it('states the lesson and module counts it renders', () => {
    at('#/lessons')
    expect(text(document.querySelector('.page-lede'))).toContain(
      `${LESSONS.length} lessons in ${MODULES.length} modules`,
    )
    expect(document.querySelectorAll('.lesson-link').length).toBe(LESSONS.length)
  })

  it('puts every lesson behind a link', () => {
    at('#/lessons')
    const hrefs = routes('.lesson-link')
    for (const lesson of LESSONS) expect(hrefs, lesson.id).toContain(`/lessons/${lesson.id}`)
    expect(hrefs.length).toBe(LESSONS.length)
  })
})
