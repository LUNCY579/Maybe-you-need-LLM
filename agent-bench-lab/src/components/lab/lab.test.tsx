import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { LABS } from '../../content/labs'
import { LAB_SCREENS, LAB_VIEWS } from './index'

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
  it('resolves fewer tasks as the task touches more files', () => {
    renderLab('design', '?view=size')
    const rates = column('The resolution by file size', 'The rate').map((value) => number(value))
    expect(rates.length).toBe(8)
    expect(rates[0]!).toBeGreaterThan(rates[rates.length - 1]!)
  })

  it('gets harder from GAIA level one to level three', () => {
    renderLab('design', '?view=questions')
    const levels = column('The GAIA levels', 'The level')
    expect(levels).toEqual(['Level 1', 'Level 2', 'Level 3'])
    expect(number(stat('A level-1 answer'))).toBeGreaterThan(number(stat('A level-3 answer')))
  })

  it('shows the first condition accepting what the pair rejects', () => {
    renderLab('verifier', '?view=harness')
    expect(number(stat('The first condition alone accepts'))).toBeGreaterThan(
      number(stat('The pair accepts')),
    )
    expect(number(stat('The cheats it caught'))).toBeGreaterThan(0)
  })

  it('shows reliability falling as the trials are repeated', () => {
    renderLab('baselines', '?view=reliability')
    expect(number(stat('pass^1'))).toBeGreaterThan(number(stat('pass^2')))
    expect(number(stat('pass^2'))).toBeGreaterThan(number(stat('pass^8')))
  })

  it('shows an average that hides a failed environment', () => {
    const profiles = renderLab('environments', '?view=profiles')
    expect(number(stat('Environments where the average is wrong'))).toBeGreaterThan(0)
    profiles.unmount()

    renderLab('environments', '?view=average')
    const mean = number(stat('The large model’s mean'))
    const worst = number(stat('Its worst environment'))
    expect(mean).toBeGreaterThan(worst + 20)
  })

  it('replays the same environment to the same states', () => {
    renderLab('environments', '?view=reproducibility')
    expect(stat('The two runs')).toBe('identical')
    expect(number(stat('The changed action diverges at').replace('step ', ''))).toBe(3)
  })
})
