import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import App from '../App'
import { LABS } from '../content/labs'
import { LESSONS, MODULES, lessonById } from '../content/curriculum'
import { FORMULAS } from '../content/formulas'

/**
 * The pages that count things, mounted the way the app mounts them.
 *
 * A page that says how many lessons or laboratories the course has is making a claim
 * about its own files, and a hard-coded number goes stale the moment a lesson is added
 * somewhere else — which is exactly what happened when four screens became eight. So
 * the claim is checked against the arrays it is supposed to be read from, which is the
 * only way to notice the drift rather than to re-read the prose.
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

describe('the laboratory index', () => {
  it('lists every screen, and offers every screen as a tab from inside one', () => {
    at('#/labs')
    expect(document.querySelectorAll('.lab-card').length).toBe(LABS.length)

    at('#/labs/isoflop')
    const tabs = routes('.lab-tab')
    expect(tabs.length).toBe(LABS.length)
    for (const lab of LABS) expect(tabs, lab.id).toContain(`/labs/${lab.id}`)
    expect(document.querySelectorAll('.lab-tab-active').length).toBe(1)
  })

  it('says so when the route asks for a screen that does not exist', () => {
    at('#/labs/not-a-lab')
    expect(text(document.querySelector('.page-title'))).toContain('No such laboratory')
  })
})

describe('a lesson page', () => {
  it('shows the lesson its own equations, and none it does not claim', () => {
    at('#/lessons/the-isoflop-frontier')
    const lesson = lessonById('the-isoflop-frontier')!
    const blocks = document.querySelectorAll('.math-block')
    expect(blocks.length).toBe(lesson.formulaIds?.length ?? 0)

    // The panel used to carry two hard-coded diffusion expressions that belonged to no
    // lesson in this course; the equations it prints now come from the reference.
    const titles = lesson.formulaIds?.map((id) => FORMULAS.find((formula) => formula.id === id)?.title) ?? []
    const body = document.body.textContent ?? ''
    for (const title of titles) expect(body, title).toContain(title)
  })

  it('sends the reader to the tab the lesson is written about', () => {
    at('#/lessons/what-a-trend-buys')
    const lesson = lessonById('what-a-trend-buys')!
    expect(routes('.btn-primary')).toContain(`/labs/${lesson.interactive.lab}?view=${lesson.interactive.view}`)
  })

  it('renders every lesson without an error boundary catching it', () => {
    for (const lesson of LESSONS) {
      at(`#/lessons/${lesson.id}`)
      const body = document.body.textContent ?? ''
      expect(body, lesson.id).not.toContain('Something went wrong')
      expect(body, lesson.id).toContain(lesson.title)
      cleanup()
    }
  })
})
