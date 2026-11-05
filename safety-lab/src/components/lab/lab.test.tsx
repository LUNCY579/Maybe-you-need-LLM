import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { LABS } from '../../content/labs'
import { LAB_SCREENS, LAB_VIEWS } from './index'

/**
 * The screens, rendered.
 *
 * A screen is the only place a lesson's deep link and a core function's number meet,
 * and both fail silently: a view a screen does not have opens the wrong panel, and a
 * runtime error inside a `useMemo` is an empty page. So each screen is mounted here,
 * at every view it declares, with the router the app actually gives it.
 *
 * This is also the test that turns a declared item of the source papers into a
 * delivered one: the coverage audit counts an item as checked when a test renders the
 * registry, which is to say when the screen that claims it is known to run.
 */

function renderLab(id: string, search = '') {
  const Screen = LAB_SCREENS[id]
  return render(
    <MemoryRouter initialEntries={[`/labs/${id}${search}`]}>
      <Screen />
    </MemoryRouter>,
  )
}

// Vitest runs without globals, so testing-library's automatic cleanup is not installed.
afterEach(cleanup)

const pressed = (label: string) => screen.getByRole('button', { name: label }).getAttribute('aria-pressed')

describe('every laboratory screen', () => {
  for (const lab of LABS) {
    const views = LAB_VIEWS[lab.id] ?? []

    describe(lab.id, () => {
      it('renders', () => {
        renderLab(lab.id)
        expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Laboratory [A-G] ·/).length).toBeGreaterThan(0)
      })

      it('opens on its first view', () => {
        renderLab(lab.id)
        expect(pressed(views[0]!.label)).toBe('true')
        for (const view of views.slice(1)) expect(pressed(view.label)).toBe('false')
      })

      it('opens at the view a deep link asks for', () => {
        for (const view of views) {
          const { unmount } = renderLab(lab.id, `?view=${view.value}`)
          const link = `${lab.id}?view=${view.value}`
          expect(pressed(view.label), link).toBe('true')
          const text = document.body.textContent ?? ''
          expect(text.length, `${link} renders an empty panel`).toBeGreaterThan(200)
          unmount()
        }
      })

      it('falls back to its default when asked for a view it does not have', () => {
        renderLab(lab.id, '?view=not-a-view')
        expect(pressed(views[0]!.label)).toBe('true')
      })

      it('puts the view in the URL, so a click and a deep link agree', () => {
        const second = views[1]
        if (!second) return
        const { unmount } = renderLab(lab.id)
        fireEvent.click(screen.getByRole('button', { name: second.label }))
        expect(pressed(second.label)).toBe('true')
        expect(pressed(views[0]!.label)).toBe('false')
        const clicked = document.body.textContent ?? ''
        unmount()

        // The state is the query parameter, not a hook that was seeded from it once:
        // arriving at the link shows exactly what clicking the tab showed.
        const deep = renderLab(lab.id, `?view=${second.value}`)
        expect(document.body.textContent ?? '').toBe(clicked)
        deep.unmount()
      })

      it('prints no broken number on any view', () => {
        for (const view of views) {
          const { unmount } = renderLab(lab.id, `?view=${view.value}`)
          const text = document.body.textContent ?? ''
          const link = `${lab.id}?view=${view.value}`
          for (const broken of ['NaN', 'undefined', 'Infinity', '[object', 'null']) {
            expect(text.includes(broken), `${link} shows ${broken}`).toBe(false)
          }
          unmount()
        }
      })
    })
  }
})

/**
 * The one control on the sleeper screen that changes what the classifier is told,
 * rather than how much data it has.
 *
 * The two sheets are the same corpus, the same fit and the same audit; the only
 * difference is which column the team asked for. A cue that was not given a column
 * gets a weight of exactly nothing and every harm riding on it goes uncounted, which
 * is the whole result of the paper and the one thing on these screens a reader should
 * not have to take on trust.
 */
describe('the sleeper screen’s label sheet', () => {
  const valueOf = (label: string) =>
    screen.getByText(label).closest('.stat')?.querySelector('.stat-value')?.textContent ?? ''

  it('catches the cued harm only when the sheet names the cue that carries it', () => {
    renderLab('sleeper', '?view=miss')

    // The screen opens on the sheet that names the innocent cue.
    const blind = valueOf('The cued behaviour caught')
    expect(blind.startsWith('0 of '), blind).toBe(true)
    expect(valueOf('The weight on the cue it was given')).toBe('0')

    fireEvent.click(screen.getByRole('button', { name: 'The cue that carries it (date)' }))
    const total = blind.split(' of ')[1]
    expect(valueOf('The cued behaviour caught')).toBe(`${total} of ${total}`)
    expect(valueOf('The weight on the cue it was given')).not.toBe('0')
  })

  it('leaves the reported harm unchanged, which is the point', () => {
    renderLab('sleeper', '?view=miss')
    const reported = valueOf('The harm the evaluation reports')
    fireEvent.click(screen.getByRole('button', { name: 'The cue that carries it (date)' }))
    // The evaluation set never fires the cue, so neither sheet sees the cued half.
    expect(valueOf('The harm the evaluation reports')).toBe(reported)
    expect(Number.parseFloat(valueOf('The harm there actually is'))).toBeGreaterThan(
      Number.parseFloat(reported),
    )
  })
})
