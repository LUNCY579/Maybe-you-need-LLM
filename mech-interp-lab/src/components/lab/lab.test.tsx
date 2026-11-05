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
 * The one control on the circuit screen that changes what the search is being asked,
 * rather than how hard it looks. Moving the corruption swaps which half of the circuit
 * is detectable, and the wiring the answer is graded against does not move — which is
 * the claim the screen's last tab exists to make.
 */
describe('the circuit screen’s corruption control', () => {
  const stat = (label: string) => screen.getByText(label).parentElement?.textContent ?? ''

  it('reports a different subgraph against the same wiring', () => {
    renderLab('circuit', '?view=check')
    expect(stat('Needed and found')).toContain('3 of 4')
    expect(stat('The wiring needs')).toContain('4 edges')
    expect(stat('Both corruptions')).toContain('4 of 4')

    fireEvent.click(screen.getByRole('button', { name: 'The token it copies' }))
    expect(stat('Needed and found')).toContain('2 of 4')
    expect(stat('The wiring needs')).toContain('4 edges')
    expect(stat('Both corruptions')).toContain('4 of 4')

    fireEvent.click(screen.getByRole('button', { name: 'The earlier occurrence' }))
    expect(stat('Needed and found')).toContain('3 of 4')
  })

  it('names the position each corruption erases', () => {
    renderLab('circuit', '?view=scores')
    expect(document.body.textContent).toContain('Position 1')
    fireEvent.click(screen.getByRole('button', { name: 'The token it copies' }))
    expect(document.body.textContent).toContain('Position 2')
  })
})
