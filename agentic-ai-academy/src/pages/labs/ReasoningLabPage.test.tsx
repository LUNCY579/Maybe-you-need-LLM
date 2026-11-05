import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ReasoningLabPage } from './ReasoningLabPage'
import { ProgressProvider } from '../../store/progress'
import { LESSONS } from '../../content/lessons'
import {
  DEFAULT_REASONING_DEPTH_CONFIG,
  runDepthBattery,
} from '../../engine/demos/reasoningDepth'
import { STAND_IN_DEPTH_CONFIG, runFrontierAudit } from '../../engine/demos/frontierAccount'

/**
 * The screen is checked against the engine, not against a table of expected
 * strings: every figure asserted here is computed by the same call the page
 * makes, at the settings the page declares, so a change to the mechanism shows
 * up as a failure rather than as a stale caption.
 */
function renderPage() {
  return render(
    <ProgressProvider totalLessons={LESSONS.length}>
      <ReasoningLabPage />
    </ProgressProvider>,
  )
}

describe('reasoning depth laboratory screen', () => {
  it('reports the depth verdict family by family, and the split is what decides it', () => {
    renderPage()
    expect(screen.getByRole('heading', { level: 1, name: /reasoning depth/i })).toBeInTheDocument()

    const battery = runDepthBattery(DEFAULT_REASONING_DEPTH_CONFIG)
    expect(battery.perFamily).toHaveLength(5)
    expect(battery.directAggregate).toBeGreaterThan(battery.aggregateAtChainLength)
    expect(battery.moreDepthPays).toBe(false)
    expect(battery.aggregateCrossover).toBe(1)

    // The mechanism under test, not a preference about it: a longer chain helps
    // only where the sequence of steps divides the work.
    const gaining = battery.perFamily.filter((row) => row.deltaVsDirect > 0)
    expect(gaining.map((row) => row.family.id).sort()).toEqual(['arithmetic', 'symbolic'])
    for (const row of battery.perFamily) {
      expect(row.family.decomposable).toBe(row.deltaVsDirect > 0)
    }
    expect(battery.crossover.arithmetic).toBe(2)
    expect(battery.crossover.symbolic).toBe(4)

    // An external check is paid for in tokens, and it only pays where there is
    // something outside the chain to read.
    for (const row of battery.perFamily) {
      if (row.family.externallyCheckable) expect(row.checked.accuracy).toBeGreaterThan(row.current.accuracy)
      else expect(row.checked.accuracy).toBe(row.current.accuracy)
      expect(row.checked.meanTokens).toBeGreaterThan(row.current.meanTokens)
    }

    expect(screen.getByText(/Measured, not asserted/)).toBeInTheDocument()
    expect(screen.getAllByText('depth pays').length).toBe(gaining.length)
    expect(screen.getAllByText('depth costs').length).toBe(battery.perFamily.length - gaining.length)
  })

  it('is flat everywhere at a per-step error rate of zero, which is the check that the crossover is measured', () => {
    const zero = runDepthBattery({ ...DEFAULT_REASONING_DEPTH_CONFIG, perStepError: 0 })
    for (const row of zero.perFamily) {
      expect(row.deltaVsDirect).toBe(0)
      expect(row.verdict).toBe('flat')
    }

    renderPage()
    const slider = screen.getByRole('slider', { name: 'Per-step error rate' })
    fireEvent.change(slider, { target: { value: '0' } })
    expect((slider as HTMLInputElement).value).toBe('0')
    expect(screen.getAllByText('flat').length).toBe(5)
  })

  it('Ch. 23: the frontier the chapter measures itself against, and a rare honest account of what a large model does and does not do.', () => {
    renderPage()
    const audit = runFrontierAudit(STAND_IN_DEPTH_CONFIG)

    // The reported column carries no number, and the engine enforces that.
    expect(audit.provenance.cells).toBe(5)
    expect(audit.provenance.violations).toEqual([])
    expect(audit.provenance.ok).toBe(true)
    // Every reported cell wears the label, and the two method panels explain the
    // label in prose — so the screen shows the string at least once per cell.
    expect(screen.getAllByText('reported-not-measured-here').length).toBeGreaterThanOrEqual(audit.provenance.cells)

    // The coverage count is a statement about this repository, and it reports its
    // own gap instead of rounding it away.
    expect(audit.limitations.total).toBe(8)
    expect(audit.limitations.taughtCount).toBe(7)
    expect(audit.limitations.untaught).toEqual(['Ch. 23 §23.2.7'])
    // The gap is shown twice over: as the row for that limitation, and in the
    // tile that counts what the course leaves untaught.
    expect(screen.getByText('Ch. 23 §23.2.7')).toBeInTheDocument()
    expect(screen.getAllByText(/Ch\. 23 §23\.2\.7/)).toHaveLength(2)
    expect(screen.getAllByText('not taught')).toHaveLength(1)

    // The stand-in is scored against the course's own bank, abstentions included.
    // The pool size is content-driven — it grows whenever a laboratory banks a new
    // question — so what is checked here is that the audit divides by the pool it
    // actually read, and that the screen prints the pair rather than a rate.
    expect(audit.bank.questions).toBeLessThan(audit.bank.wholeBank)
    expect(audit.bank.answerable).toBeGreaterThan(0)
    expect(audit.bank.answerableFraction).toBeCloseTo(audit.bank.answerable / audit.bank.questions, 10)
    expect(screen.getByText(`${audit.bank.answerable}/${audit.bank.questions}`)).toBeInTheDocument()
    expect(audit.bank.matchesKey).toBeLessThanOrEqual(audit.bank.answerable)
    for (const row of audit.rows) {
      expect(row.exam.answerable).toBeLessThanOrEqual(row.exam.questions)
      expect(row.exam.matchesKey).toBeLessThanOrEqual(row.exam.answerable)
    }
  })

  it('re-runs the battery when a slider moves, and switches which policy the measured column runs', async () => {
    renderPage()
    const baseline = runDepthBattery(DEFAULT_REASONING_DEPTH_CONFIG)

    const chain = screen.getByRole('slider', { name: 'Chain length' })
    fireEvent.change(chain, { target: { value: '10' } })
    expect((chain as HTMLInputElement).value).toBe('10')
    const swept = runDepthBattery({ ...DEFAULT_REASONING_DEPTH_CONFIG, chainLength: 10 })
    expect(swept.aggregateAtChainLength).toBeLessThan(baseline.aggregateAtChainLength)
    const shown = (swept.aggregateAtChainLength * 100).toFixed(1)
    expect(screen.getAllByText(new RegExp(shown.replace('.', '\\.') + '%')).length).toBeGreaterThan(0)

    const picker = screen.getByRole('combobox', { name: 'Stand-in policy' })
    expect(within(picker).getAllByRole('option')).toHaveLength(2)
    await userEvent.selectOptions(picker, 'current')
    expect(screen.getByText(new RegExp("the battery's current policy: style " + DEFAULT_REASONING_DEPTH_CONFIG.style))).toBeInTheDocument()
  })

  it('is deterministic: the same settings give the same sweep, family by family', () => {
    const a = runDepthBattery(DEFAULT_REASONING_DEPTH_CONFIG)
    const b = runDepthBattery(DEFAULT_REASONING_DEPTH_CONFIG)
    expect(JSON.stringify(a.sweep)).toEqual(JSON.stringify(b.sweep))
    expect(JSON.stringify(a.perFamily.map((row) => [row.direct.accuracy, row.current.accuracy, row.checked.accuracy])))
      .toEqual(JSON.stringify(b.perFamily.map((row) => [row.direct.accuracy, row.current.accuracy, row.checked.accuracy])))
    expect(JSON.stringify(runFrontierAudit(STAND_IN_DEPTH_CONFIG).rows)).toEqual(JSON.stringify(runFrontierAudit(STAND_IN_DEPTH_CONFIG).rows))
  })
})
