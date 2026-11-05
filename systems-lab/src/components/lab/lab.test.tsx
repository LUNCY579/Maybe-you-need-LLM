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
 * runtime error inside a `useMemo` is an empty page. So each of the six screens is
 * mounted here, at every one of its views, with the router the app actually gives it.
 *
 * This is also the test that turns a declared item of the ten source papers into a
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

const number = (text: string): number => Number.parseFloat(text)

describe('every laboratory screen', () => {
  for (const lab of LABS) {
    const views = LAB_VIEWS[lab.id] ?? []

    describe(lab.id, () => {
      it('renders', () => {
        renderLab(lab.id)
        expect(screen.getAllByRole('heading', { level: 2 }).length).toBeGreaterThan(0)
        expect(screen.getAllByText(/Laboratory [A-F] ·/).length).toBeGreaterThan(0)
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
 * Laboratory D's two loudest claims, read off the screen rather than the core.
 *
 * The first is the reason per-channel quantisation exists: a grid sized for the
 * outlier is too coarse for the ordinary channels by orders of magnitude. The
 * second is the reason a smooth migration is safe: it moves where the width sits,
 * not what the product is.
 */
describe('the quantised grid, on screen', () => {
  it('makes the per-channel scheme much better than the single grid', () => {
    renderLab('quantisation')
    const oneGrid = number(stat("One grid's error"))
    const perChannel = number(stat('One grid per channel'))
    expect(oneGrid).toBeGreaterThan(0)
    expect(perChannel).toBeLessThan(oneGrid / 4)
  })

  it('moves the outlier without changing a single dot product', () => {
    renderLab('quantisation', '?view=migration')
    const changes = column('The invariance', 'The value')
    expect(changes.length).toBeGreaterThan(0)
    expect(Number(changes[0])).toBeLessThan(1e-9)
  })

  it('spends four bits better on the bell than an even grid does', () => {
    renderLab('quantisation', '?view=codebook')
    const nf4 = number(stat('NF4, whole tensor'))
    const even = number(stat('The even grid, same range'))
    expect(nf4).toBeLessThan(even)
  })
})

/**
 * Laboratory C's branch, on screen: a 512-token request at a 16-token block is 32
 * full blocks, and each of the three children shares all 32 and owns only the block
 * it has been writing into. Copy-on-write is the difference between 35 blocks and
 * the 97 a copy of the whole prefix would need.
 */
describe('the branched cache, on screen', () => {
  it('shares the prefix and copies only the tail', () => {
    renderLab('kvcache', '?view=branch')
    const shared = column('The pool after the branches', 'Blocks shared with the parent')
    expect(shared.slice(1)).toEqual(['32', '32', '32'])
    expect(number(stat('The blocks held'))).toBe(35)
    expect(number(stat('The blocks a copy would need'))).toBe(97)
  })
})

/**
 * Laboratory F's central table: the three plans, and the only one that fits the
 * card the shape is quoted against. The arithmetic is the core's; this checks the
 * screen prints it in the order the paper argues for.
 */
describe('the fine-tuning budget, on screen', () => {
  it('orders the three plans, and leaves only QLoRA inside one card', () => {
    renderLab('finetune', '?view=budget')
    const full = column('The terms', 'Full fine-tuning')
    const lora = column('The terms', 'LoRA')
    const qlora = column('The terms', 'QLoRA')
    const last = (values: string[]) => number(values[values.length - 1]!)
    expect(last(qlora)).toBeLessThan(last(lora))
    expect(last(lora)).toBeLessThan(last(full))

    renderLab('finetune', '?view=device')
    const fits = column('The plans on this card', 'It fits')
    expect(fits).toEqual(['no', 'no', 'yes'])
  })

  it('keeps the adapters a small fraction of the matrices they adapt', () => {
    renderLab('finetune')
    const fraction = number(stat('Of the adapted matrices').replace('%', ''))
    expect(fraction).toBeLessThan(2)
  })
})
