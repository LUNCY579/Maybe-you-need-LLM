import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { LABS } from '../../content/labs'
import { EPOCHS_DEFAULTS } from '../../content/labDefaults'
import { LAB_DOMAINS } from '../../content/labDomains'
import { LAB_SCREENS, LAB_VIEWS } from './index'

/**
 * The screens, rendered.
 *
 * A screen is the only place a lesson’s deep link and a core function’s number meet,
 * and both fail silently: a view a screen does not have opens the wrong panel, and a
 * runtime error inside a `useMemo` is an empty page. So each of the eight screens is
 * mounted here, at every one of its twenty-three views, with the router the app
 * actually gives it.
 *
 * This is also the test that turns a declared item of the six source papers into a
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

/** One column of the table whose caption contains `caption`, as printed on screen. */
function column(caption: string, header: string): string[] {
  const table = screen.getAllByRole('table').find((node) => node.querySelector('caption')?.textContent?.includes(caption))
  if (!table) throw new Error(`no table captioned ${caption}`)
  const headers = [...table.querySelectorAll('thead th')].map((cell) => cell.textContent)
  const at = headers.indexOf(header)
  if (at < 0) throw new Error(`no column ${header} in ${caption}: it has ${headers.join(', ')}`)
  return [...table.querySelectorAll('tbody tr')].map((row) => row.querySelectorAll('td')[at]?.textContent ?? '')
}

/** One stat's printed value, by its label. */
function stat(label: string): string {
  const node = [...document.querySelectorAll('.stat')].find(
    (candidate) => candidate.querySelector('.stat-label')?.textContent === label,
  )
  if (!node) throw new Error(`no stat labelled ${label}`)
  return node.querySelector('.stat-value')?.textContent ?? ''
}

describe('every laboratory screen', () => {
  for (const lab of LABS) {
    const views = LAB_VIEWS[lab.id] ?? []

    describe(lab.id, () => {
      it('renders', () => {
        renderLab(lab.id)
        expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Laboratory [A-H] ·/).length).toBeGreaterThan(0)
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
 * The two claims the course makes most loudly, read off the screens rather than off
 * the core they are computed in.
 *
 * The first is the reason the repeats screen exists: a ridge solution is homogeneous
 * in the data, so reading every row four times finds the identical model and the only
 * thing that changes is the bill. The second is the arithmetic of the epoch screen’s
 * construction: at the first epoch the repeated run and the fresh run have read the
 * same rows, so they are the same run and the gap between them is not small but zero.
 */
describe('the price of repetition, on screen', () => {
  it('leaves the repeated run’s loss unchanged however many times the rows are read', () => {
    renderLab('repeats', '?view=price')
    const repeated = column('The price of each round of repeats', 'The repeated run')
    const fresh = column('The price of each round of repeats', 'The fresh run')
    expect(repeated.length).toBeGreaterThan(1)
    expect(new Set(repeated).size, repeated.join(', ')).toBe(1)
    // Same learner, same held-out set, more rows read: the fresh curve keeps falling.
    expect(Number.parseFloat(fresh[fresh.length - 1]!)).toBeLessThan(Number.parseFloat(fresh[0]!))
  })
})

describe('the epoch curve, on screen', () => {
  it('starts at a gap of exactly nothing, because the first epoch is one pass either way', () => {
    renderLab('epochs', '?view=phases')
    const gaps = column('Every epoch boundary, as measured', 'The gap')
    expect(Number.parseFloat(gaps[0]!)).toBe(0)
    expect(Number.parseFloat(gaps[gaps.length - 1]!)).toBeGreaterThan(0)
  })
})

/**
 * The two numbers the runner caught the screens getting wrong.
 *
 * Both were consistent between the page and the terminal, which is the point: a
 * diagnostic that reads a curve stripped of its compute axis answers "no cliff" in
 * both places, and a surface fit whose intercept went negative prints a negative
 * loss in both places. Agreement between two implementations of the same bug is not
 * a check, so these are pinned against the quantities the lessons claim.
 */
describe('the cliff, on screen', () => {
  it('measures the sharpness on the axis the sweep was made along', () => {
    renderLab('emergence')
    const cliff = stat('The sharpness of the cliff')
    const control = stat('The same for a one-token task')
    expect(cliff).not.toBe('no cliff')
    expect(control).not.toBe('no cliff')
    // The long task is the sharper reading: its score goes from a tenth of its best to
    // nine tenths inside a smaller factor of compute than the one-token control, which
    // is the cliff the lesson says is in the metric rather than the model.
    expect(Number.parseFloat(cliff)).toBeLessThan(Number.parseFloat(control))
  })
})

describe('the fitted surface, on screen', () => {
  it('hands the reader a floor that is a loss, and an optimum above it', () => {
    renderLab('compute', '?view=optimum')
    const terms = column('The fitted surface', 'The term')
    const values = column('The fitted surface', 'Its value')
    const meanings = column('The fitted surface', 'What it is')
    const at = terms.indexOf('E')
    expect(at).toBeGreaterThanOrEqual(0)
    const floor = Number.parseFloat(values[at]!)
    expect(Number.isFinite(floor)).toBe(true)
    expect(floor).toBeGreaterThanOrEqual(0)
    // A floor held at its boundary is said to be, rather than printed as a measurement.
    if (floor === 0) expect(meanings[at]!).toContain('held at zero')
    for (const value of column('Every run, and the surface’s prediction of it', 'Surface loss')) {
      expect(Number.parseFloat(value)).toBeGreaterThanOrEqual(0)
    }
  })
})

/**
 * The range a reader can drag, against the range the terminal sweep walks.
 *
 * `tools/extremes.test.mjs` runs every laboratory at the endpoints listed in
 * `labDomains.ts`, and the list is a copy of the `min` and `max` written on the
 * sliders. A copy drifts: widen a slider to let a reader try something new and the
 * sweep goes on certifying a domain the screen no longer has. Reading the bounds off
 * the rendered inputs is the only check that notices.
 */
describe('the sliders, against the domain the sweep walks', () => {
  for (const lab of LABS) {
    it(`reaches no bound that the sweep does not visit, on ${lab.id}`, () => {
      const bounds = new Set<number>()
      for (const view of LAB_VIEWS[lab.id] ?? []) {
        const { unmount } = renderLab(lab.id, `?view=${view.value}`)
        for (const input of Array.from(document.querySelectorAll('input[type="range"]'))) {
          for (const attribute of ['min', 'max']) {
            const value = Number(input.getAttribute(attribute))
            if (Number.isFinite(value)) bounds.add(value)
          }
        }
        unmount()
      }
      expect(bounds.size, `${lab.id} renders no slider`).toBeGreaterThan(0)

      // A log-scaled slider carries the decade and the scenario holds the number, so a
      // bound is visited if the sweep lists it or lists the number it stands for.
      const visited = new Set<number>()
      for (const values of Object.values(LAB_DOMAINS[lab.id] ?? {})) {
        for (const value of values) if (typeof value === 'number') visited.add(value)
      }
      // The one bound the screen computes rather than writes: the batch cannot pass
      // half the unique rows, so its maximum moves with the slider above it.
      const derived = lab.id === 'epochs' ? [Math.max(1, Math.floor(EPOCHS_DEFAULTS.unique / 2))] : []

      for (const bound of bounds) {
        const shown = Number.isFinite(10 ** bound) ? 10 ** bound : Number.NaN
        const covered = visited.has(bound) || visited.has(shown) || derived.includes(bound)
        expect(covered, `${lab.id} has a slider bound at ${bound} that labDomains.ts does not list`).toBe(true)
      }
    })
  }
})
