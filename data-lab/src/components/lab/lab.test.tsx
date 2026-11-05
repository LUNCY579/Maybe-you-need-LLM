import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it } from 'vitest'
import { ITEM_TO_LAB, LAB_IDS, LABS } from '../../content/labs'
import { LAB_GALLERY, LAB_SCREENS, LAB_VIEWS, labScreen } from './index'

/**
 * The registry and the screens, together.
 *
 * A screen is the only place a declared manifest item and a core function's
 * number meet, and both sides fail quietly: a registry entry with no component
 * behind it is a card that opens an empty panel, and a view a screen never
 * reaches is a measurement nobody sees. So every laboratory named in
 * `content/labs.ts` is mounted here and every view it declares is opened.
 *
 * This file is also what turns a declared item into a checked one for the
 * coverage audit: an item counts as tested when a test renders the registry,
 * which is to say when the screen that claims it is known to run.
 */

function renderLab(id: string) {
  const Screen = LAB_SCREENS[id]
  return render(
    <MemoryRouter initialEntries={[`/labs/${id}`]}>
      <Screen />
    </MemoryRouter>,
  )
}

// Vitest runs without globals, so testing-library's automatic cleanup is not installed.
afterEach(cleanup)

const pressed = (label: string) => screen.getByRole('button', { name: label }).getAttribute('aria-pressed')

/** Every cell the screen prints as a number: table bodies and stat values. */
function numericCells(): string[] {
  const cells = [...document.querySelectorAll('tbody td')].map((cell) => cell.textContent ?? '')
  const stats = [...document.querySelectorAll('.stat-value')].map((node) => node.textContent ?? '')
  return [...cells, ...stats]
}

describe('the laboratory registry', () => {
  it('names eight screens, in the order the letters claim', () => {
    expect(LAB_IDS).toEqual(['pipeline', 'budget', 'midas', 'dedup', 'mixture', 'proxy', 'refinement', 'collapse'])
    expect(LAB_GALLERY.map((lab) => lab.name)).toEqual([
      'A · The pipeline',
      'B · Deduplication',
      'C · The mixture',
      'D · Collapse',
      'E · MIDAS and the reference model',
      'F · The budget',
      'G · The loop',
      'H · The proxy step',
    ])
  })

  it('has a screen and a view list for every declaration', () => {
    for (const lab of LABS) {
      expect(labScreen(lab.id), `${lab.id} has no component`).toBeDefined()
      expect(LAB_VIEWS[lab.id]?.length ?? 0, `${lab.id} declares no views`).toBeGreaterThanOrEqual(2)
    }
  })

  it('answers each manifest item with exactly one screen', () => {
    const items = LABS.flatMap((lab) => lab.delivers)
    expect(items.length).toBe(13)
    expect(new Set(items).size).toBe(items.length)
    // a duplicate would slip through the Map unnoticed, so the two sizes must agree
    expect(ITEM_TO_LAB.size).toBe(items.length)
    for (const item of items) expect(ITEM_TO_LAB.get(item), item).toBeTruthy()
  })

  it('gives each screen the letter it prints, and a route under its id', () => {
    for (const lab of LABS) {
      expect(lab.route).toBe(`/labs/${lab.id}`)
      expect(lab.name).toMatch(/^[A-H] · /)
    }
    expect(new Set(LAB_GALLERY.map((lab) => lab.name[0])).size).toBe(LABS.length)
  })
})

describe('every laboratory screen', () => {
  for (const lab of LABS) {
    const views = LAB_VIEWS[lab.id] ?? []

    describe(lab.id, () => {
      it('is the laboratory its card promises, and opens on its first view', () => {
        renderLab(lab.id)
        expect(screen.getByRole('heading', { level: 2, name: `Laboratory ${lab.name}` })).toBeInTheDocument()
        expect(pressed(views[0]!)).toBe('true')
        for (const view of views.slice(1)) expect(pressed(view)).toBe('false')
      })

      it('computes a screenful of numbers on every one of its views', () => {
        renderLab(lab.id)
        for (const view of views) {
          fireEvent.click(screen.getByRole('button', { name: view }))
          expect(pressed(view), `${lab.id} · ${view} did not open`).toBe('true')

          const text = document.body.textContent ?? ''
          // A formatting failure is a whole-page affair: an unguarded field prints
          // its token in every cell that touched it, so the page is scanned for
          // the four tokens that can only come from a broken number.
          for (const broken of ['NaN', 'undefined', 'Infinity', '[object']) {
            expect(text.includes(broken), `${lab.id} · ${view} shows ${broken}`).toBe(false)
          }

          const cells = numericCells()
          expect(cells.length, `${lab.id} · ${view} prints no table`).toBeGreaterThan(5)
          for (const cell of cells) {
            expect(cell, `${lab.id} · ${view} prints an empty cell`).not.toBe('')
            expect(cell.trim(), `${lab.id} · ${view} prints a null cell`).not.toMatch(/^(null|NaN|undefined)$/)
          }
        }
      })
    })
  }
})

/**
 * Two tables the screens make their argument with, read off the screen rather
 * than the core. Both are structurally checked — what the baseline row prints,
 * whether a mixture is still a mixture — plus the one ordering the surrounding
 * prose leans on.
 */
describe('the numbers the prose leans on', () => {
  /** One column of the table captioned `caption`, by header index. */
  function column(caption: string, at: number): string[] {
    const table = screen
      .getAllByRole('table')
      .find((node) => node.querySelector('caption')?.textContent?.includes(caption))
    if (!table) throw new Error(`no table captioned ${caption}`)
    return [...table.querySelectorAll('tbody tr')].map((row) => row.querySelectorAll('td')[at]?.textContent ?? '')
  }

  it('keeps every row of the mixture ablation a mixture', () => {
    renderLab('mixture')
    fireEvent.click(screen.getByRole('button', { name: 'One component at a time' }))
    const names = column('One component at a time', 0)
    expect(names[0]).toBe('the natural mixture')
    expect(names.length).toBe(6)
    for (const weights of column('One component at a time', 1)) {
      const parts = weights.split(' · ').map(Number.parseFloat)
      expect(parts).toHaveLength(5)
      // printed at two decimals, so five rounded parts can be a centimetre off a whole
      expect(parts.reduce((sum, part) => sum + part, 0)).toBeCloseTo(1, 1)
    }
    // the baseline is the row everything else is differenced against, so it prints no difference
    const changes = column('One component at a time', 5)
    expect(changes[0]).toBe('—')
    for (const change of changes.slice(1)) expect(Number.isNaN(Number.parseFloat(change)), change).toBe(false)
  })

  it('shows the budget gain collapse once the steps are matched', () => {
    renderLab('budget')
    fireEvent.click(screen.getByRole('button', { name: 'The three gains' }))
    const gains = column('Which comparison buys which claim', 3).map(Number.parseFloat)
    expect(gains).toHaveLength(3)
    expect(gains.every((gain) => !Number.isNaN(gain))).toBe(true)
    // row three holds the documents and the steps constant; the screen's whole
    // argument is that what survives that is smaller than what the other two compare
    expect(Math.abs(gains[2]!)).toBeLessThan(Math.abs(gains[0]!))
    expect(Math.abs(gains[0]!)).toBeLessThan(Math.abs(gains[1]!))
  })
})
