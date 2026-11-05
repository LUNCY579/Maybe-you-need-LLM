import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { LABS } from '../../content/labs'
import { LAB_SCREENS, LAB_VIEWS } from './index'
import { JudgeLab } from './JudgeLab'
import { BiasesLab } from './BiasesLab'
import { ArenaLab } from './ArenaLab'
import { BenchmarkLab } from './BenchmarkLab'
import { MeasurementLab } from './MeasurementLab'

/**
 * The screens, rendered.
 *
 * A screen is where a lesson's deep link and a core function's number meet, and
 * both fail silently: a view a screen does not have opens the wrong panel, and
 * a runtime error inside a `useMemo` is an empty page. Every screen is mounted
 * here at every view it declares.
 *
 * This is also the test that turns a declared item of the manifest into a
 * checked one: the coverage audit counts an item as tested when a test renders
 * the screen its registry entry names.
 */

function renderLab(id: string, search = '') {
  const Screen = LAB_SCREENS[id]
  if (!Screen) throw new Error(`no such laboratory: ${id}`)
  return render(
    <MemoryRouter initialEntries={[`/labs/${id}${search}`]}>
      <Screen />
    </MemoryRouter>,
  )
}

// Vitest runs without globals, so testing-library's automatic cleanup is not installed.
afterEach(cleanup)

const pressed = (label: string) => screen.getByRole('button', { name: label }).getAttribute('aria-pressed')

function column(caption: string, header: string): string[] {
  const table = screen
    .getAllByRole('table')
    .find((node) => node.querySelector('caption')?.textContent?.includes(caption))
  if (!table) throw new Error(`no table captioned ${caption}`)
  const headers = [...table.querySelectorAll('thead th')].map((cell) => cell.textContent)
  const at = headers.indexOf(header)
  if (at < 0) throw new Error(`no column ${header} in ${caption}: it has ${headers.join(', ')}`)
  return [...table.querySelectorAll('tbody tr')].map((row) => row.querySelectorAll('td')[at]?.textContent ?? '')
}

function stat(label: string): string {
  const node = [...document.querySelectorAll('.stat')].find(
    (candidate) => candidate.querySelector('.stat-label')?.textContent === label,
  )
  if (!node) throw new Error(`no stat labelled ${label}`)
  return node.querySelector('.stat-value')?.textContent ?? ''
}

const number = (text: string): number => Number.parseFloat(text)

describe('every laboratory screen', () => {
  it('is reachable from the screen map', () => {
    expect(LAB_SCREENS).toEqual({
      judge: JudgeLab,
      biases: BiasesLab,
      arena: ArenaLab,
      benchmark: BenchmarkLab,
      measurement: MeasurementLab,
    })
  })

  for (const lab of LABS) {
    const views = LAB_VIEWS[lab.id] ?? []

    describe(lab.id, () => {
      it('renders', () => {
        renderLab(lab.id)
        expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Laboratory [A-E] ·/).length).toBeGreaterThan(0)
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
          expect((document.body.textContent ?? '').length, `${link} renders an empty panel`).toBeGreaterThan(200)
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

describe('the claims the screens print', () => {
  it('has a judge that agrees with the human better than chance', () => {
    renderLab('judge', '?view=agreement')
    expect(number(stat('Agreement with the human'))).toBeGreaterThan(50)
    expect(number(stat('Consistency'))).toBeGreaterThan(50)
  })

  it('prefers the first position when the position bias is turned on', () => {
    renderLab('biases', '?view=position')
    expect(number(stat('First-position rate'))).toBeGreaterThan(50)
    expect(number(stat('Excess preference'))).toBeGreaterThan(0)
  })

  it('lowers agreement on its own family as the self-preference grows, and leaves the rest alone', () => {
    renderLab('biases', '?view=self')
    const mixed = column('The sweep, row by row', 'Agreement, mixed').map((value) => number(value))
    const same = column('The sweep, row by row', 'Agreement, same').map((value) => number(value))
    expect(mixed.length).toBe(11)
    expect(mixed[mixed.length - 1]!).toBeLessThan(mixed[0]! - 3)
    expect(same[same.length - 1]!).toBe(same[0]!)
  })

  it('keeps most of the ranking when half the questions are dropped', () => {
    renderLab('arena', '?view=stability')
    const kept = number(stat('Pair orders kept'))
    expect(kept).toBeGreaterThan(50)
    expect(kept).toBeLessThanOrEqual(100)
    const rows = column('Stability, against the subset size', 'Pairs in the same order')
    expect(rows.length).toBe(8)
  })

  it('separates the arena’s top two only when the votes allow it', () => {
    renderLab('arena', '?view=cost')
    const verdict = column('The top two', 'Value')
    expect(verdict.some((cell) => cell === 'yes' || cell === 'no')).toBe(true)
  })

  it('leaves some models off the multi-metric frontier', () => {
    renderLab('benchmark', '?view=tradeoffs')
    const frontier = number(stat('Points on the frontier'))
    expect(frontier).toBeGreaterThan(0)
    expect(frontier).toBeLessThan(6)
  })

  it('flatters the public winner against the private score', () => {
    renderLab('benchmark', '?view=private')
    expect(number(stat('The optimism'))).toBeGreaterThan(0)
  })

  it('moves the score when the decoder changes', () => {
    renderLab('measurement', '?view=decoding')
    expect(number(stat('Shift against greedy decoding'))).toBeGreaterThan(0)
    const rows = column('The sweep, row by row', 'Temperature')
    expect(rows.length).toBe(8)
  })
})
