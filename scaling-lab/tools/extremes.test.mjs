import { describe, expect, it } from 'vitest'
import { LAB_IDS } from '../src/content/labs'
import { LAB_DOMAINS } from '../src/content/labDomains'
import { brokenCells, extremeScenarios, sweep } from './run-lab.mjs'

/**
 * Every laboratory, dragged to the ends of its sliders.
 *
 * The screens are tested at the scenario they start at, and a reader never stops
 * there: they push the noise to 0.4, or the budget two decades past the grid, or the
 * restarts down to one, and a number that is quietly wrong at an endpoint is a number
 * a reader carries out of the course. The sweep is the runner's own composition — the
 * same `trainingSurface`, the same tables — so what fails here would have shown on the
 * page too, and `npm run lab -- all --extremes` prints this list without a test
 * runner.
 *
 * `lab.test.tsx` reads the endpoints off the rendered sliders, so this sweep cannot
 * be left behind while a screen widens.
 */

describe('the terminal sweep of the slider extremes', () => {
  for (const id of LAB_IDS) {
    it(`prints no broken number anywhere ${id} can be dragged`, () => {
      const { visits, offenders } = sweep(id)
      expect(visits).toBeGreaterThan(1)
      expect(offenders, offenders.join('\n')).toEqual([])
    })
  }

  it('visits every endpoint of every field, and both corners', () => {
    for (const id of LAB_IDS) {
      const domain = LAB_DOMAINS[id] ?? {}
      const visits = extremeScenarios(id)
      expect(visits.length, id).toBe(3 + Object.values(domain).reduce((sum, values) => sum + values.length, 0))

      const low = visits[visits.length - 2].settings
      const high = visits[visits.length - 1].settings
      for (const [field, values] of Object.entries(domain)) {
        const sorted = typeof values[0] === 'number' ? [...values].sort((a, b) => a - b) : values
        expect(low[field], `${id}.${field} at its minimum`).toBe(sorted[0])
        expect(high[field], `${id}.${field} at its maximum`).toBe(sorted[sorted.length - 1])
      }
    }
  })

  it('reads a broken number as broken', () => {
    // The sweep is worth nothing if it cannot see the thing it looks for, so the
    // detector is checked against a result that is broken in each of the four ways
    // a result is made of: a setting, a stat value, a stat note, a table cell.
    const broken = {
      settings: [['capacity', Number.NaN]],
      stats: [
        ['the loss', Number.POSITIVE_INFINITY, 'a clean note'],
        ['the floor', undefined, 'see above'],
        ['the gap', 0.012, 'measured against null'],
      ],
      tables: [{ caption: 'the grid', header: ['capacity', 'loss'], rows: [[8, {}], [16, 0.42]] }],
    }
    expect(brokenCells(broken)).toHaveLength(5)

    const clean = { settings: [['decay', 0.75]], stats: [['the loss', '0.42', 'dominance is a word, not a marker']], tables: [] }
    expect(brokenCells(clean)).toEqual([])
  })
})
