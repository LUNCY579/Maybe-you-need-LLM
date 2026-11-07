import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { LESSONS, MODULES } from '../content/curriculum'
import { LABS } from '../content/labs'
import { TOY_MODEL } from '../core/denoiser'
import { LandingPage } from './LandingPage'

/**
 * The landing page states three counts and a training budget. Each is derived from the same
 * source the rest of the app uses, and this test is what keeps the prose and that source
 * agreeing.
 */

afterEach(cleanup)

function renderPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  )
}

describe('the landing page states the shape of the course', () => {
  it('counts what the registry and the curriculum contain', () => {
    renderPage()
    const subtitle = screen.getByText(
      `${MODULES.length} modules, ${LESSONS.length} lessons, ${LABS.length} laboratories`,
    )
    expect(subtitle).toBeTruthy()
    expect(subtitle.textContent).toBe('6 modules, 12 lessons, 7 laboratories')
  })

  it('links every registered laboratory, in registry order', () => {
    renderPage()
    const cards = Array.from(document.querySelectorAll('.lab-card'))
    expect(cards).toHaveLength(LABS.length)
    expect(cards.map((card) => card.querySelector('.lab-card-name')?.textContent)).toEqual(
      LABS.map((lab) => lab.name),
    )
    expect(cards.map((card) => card.getAttribute('href'))).toEqual(LABS.map((lab) => `/labs/${lab.id}`))
    // the heading quotes the same count, so a laboratory added to the registry cannot leave it stale
    expect(screen.getByText(`The ${LABS.length} laboratories`)).toBeTruthy()
  })

  it('quotes the budget the laboratory actually trains with', () => {
    renderPage()
    const note = document.querySelector('aside.callout-warning')
    const text = note?.querySelector('.callout-body')?.textContent?.replace(/\s+/g, ' ') ?? ''
    expect(text).toContain(`trained for ${TOY_MODEL.steps} steps`)
    expect(text).toContain(`ring of ${TOY_MODEL.modes} Gaussian modes`)
    // the old page claimed 900 steps, a third of the budget the button actually spends
    expect(text).not.toContain('900 steps')
  })
})
