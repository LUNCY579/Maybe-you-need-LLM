import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ContextWindowDemo } from './ContextWindowDemo'
import {
  CONTEXT_POLICIES,
  CONTEXT_SCENARIO_BY_ID,
  GIST_FEATURES,
  assembleContext,
  type ContextScenario,
} from '../../engine/demos/contextWindow'

/**
 * The screen is checked against the engine, not against a table of expected strings: every
 * figure asserted here is recomputed by the same call the page makes, at the settings the
 * page declares, so a change to the mechanism shows up as a failure rather than as a stale
 * caption.
 *
 * The learned policy is the part worth pinning. Its panel prints a training run — the windows
 * it was fitted on, the loss per epoch, the weights, the ranking — and each of those is a
 * claim about arithmetic the engine, not the caption, has to support.
 */
const refund = CONTEXT_SCENARIO_BY_ID.get('refund-window') as ContextScenario
const report = CONTEXT_SCENARIO_BY_ID.get('headline-number') as ContextScenario
const ship = CONTEXT_SCENARIO_BY_ID.get('ship-tonight') as ContextScenario

function renderDemo() {
  render(<ContextWindowDemo />)
}

function choosePolicy(name: RegExp) {
  fireEvent.click(screen.getByRole('radio', { name }))
}

function chooseScenario(scenario: ContextScenario) {
  fireEvent.change(screen.getByLabelText(/context window scenario/i), { target: { value: scenario.id } })
}

function setWindow(size: number) {
  fireEvent.change(screen.getByLabelText(/Window size/), { target: { value: String(size) } })
}

function panel() {
  return screen.getByRole('region', { name: /what the learned compressor did/i })
}

const actionWords = {
  full: 'kept in full',
  gist: 'kept as a summary',
  drop: 'dropped for room',
} as const

describe('the context window demonstration', () => {
  it('offers the trained compressor beside the hand-written policies', () => {
    renderDemo()
    for (const policy of CONTEXT_POLICIES) {
      expect(screen.getByRole('radio', { name: new RegExp(policy.label) })).toBeInTheDocument()
    }
    expect(screen.getAllByRole('radio')).toHaveLength(CONTEXT_POLICIES.length)
    expect(screen.getByRole('radio', { name: /Learned compression/ })).toHaveAccessibleName(
      /trained on the other windows/,
    )
    // The trained panel is not part of the screen until the policy that produces it is chosen.
    expect(screen.queryByRole('region', { name: /what the learned compressor did/i })).toBeNull()
  })

  it('prints the fit the engine ran, not a picture of one', () => {
    renderDemo()
    chooseScenario(refund)
    choosePolicy(/Learned compression/)

    const trace = assembleContext(refund, refund.budget, 'gist').gist
    expect(trace).not.toBeNull()
    const model = trace!.model
    const section = panel()
    expect(
      within(section).getByText(new RegExp(`${model.examples} items, ${model.positives} of them decisive`)),
    ).toBeInTheDocument()
    for (const id of model.trainedOn) {
      const title = CONTEXT_SCENARIO_BY_ID.get(id)!.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      expect(within(section).getByText(new RegExp(title))).toBeInTheDocument()
    }
    expect(within(section).getByText(model.loss[0].toFixed(3))).toBeInTheDocument()
    expect(within(section).getByText(model.loss[model.loss.length - 1].toFixed(3))).toBeInTheDocument()
    expect(
      within(section).getByText(new RegExp(`ends at ${model.loss[model.loss.length - 1].toFixed(3)} after`)),
    ).toBeInTheDocument()
    for (const feature of GIST_FEATURES) {
      const weight = model.weights[feature.key]
      expect(within(section).getByText(feature.label)).toBeInTheDocument()
      expect(within(section).getByText(feature.note)).toBeInTheDocument()
      expect(within(section).getByText(weight >= 0 ? `+${weight.toFixed(2)}` : weight.toFixed(2))).toBeInTheDocument()
    }
    expect(within(section).getByText(`intercept ${model.bias.toFixed(2)}`)).toBeInTheDocument()
  })

  it('shows the score it gave each piece of material, in the order it used it', () => {
    renderDemo()
    chooseScenario(ship)
    choosePolicy(/Learned compression/)

    const trace = assembleContext(ship, ship.budget, 'gist').gist!
    const rows = within(
      within(panel()).getByRole('list', { name: /the order it put the material in/i }),
    ).getAllByRole('listitem')
    expect(rows).toHaveLength(trace.decisions.length)
    trace.decisions.forEach((decision, index) => {
      const row = rows[index]
      expect(within(row).getByText(decision.item.label)).toBeInTheDocument()
      expect(within(row).getByText(decision.score.toFixed(3))).toBeInTheDocument()
      expect(within(row).getByText(actionWords[decision.action])).toBeInTheDocument()
      if (decision.item.critical) expect(within(row).getByText('· decisive')).toBeInTheDocument()
    })
    // The same scores are repeated beside the material itself, so the ranking can be read
    // against the window it produced.
    expect(screen.getAllByText(/^score \d/)).toHaveLength(trace.decisions.length)
    expect(
      screen.getByText(`${trace.ranking.auc.toFixed(2)} of decisive pairs ordered here`),
    ).toBeInTheDocument()
    expect(
      screen.getByText(new RegExp(`trained on ${trace.model.trainedOn.length} other windows`)),
    ).toBeInTheDocument()
  })

  it('shows the caveat a trained compressor inherits: ranked third, then cut', () => {
    renderDemo()
    chooseScenario(report)
    choosePolicy(/Learned compression/)

    const outcome = assembleContext(report, report.budget, 'gist')
    expect(outcome.intact).toBe(false)
    expect(within(panel()).getByText('Report: headline metrics')).toBeInTheDocument()
    expect(screen.getByRole('status').textContent).toContain(report.wrongAnswer)
    expect(screen.getByRole('status').textContent).toMatch(/high enough to keep and short enough to lose/i)
    const cut = outcome.kept.filter((entry) => entry.compressed && !entry.retains)
    expect(screen.getAllByText('compressed, fact lost')).toHaveLength(cut.length)
    expect(cut.map((entry) => entry.item.id)).toContain('metrics')
  })

  it('and shows that the room, not the score, is what lost the number', () => {
    renderDemo()
    chooseScenario(report)
    choosePolicy(/Learned compression/)
    setWindow(120)

    const outcome = assembleContext(report, 120, 'gist')
    expect(outcome.intact).toBe(true)
    expect((screen.getByLabelText(/Window size/) as HTMLInputElement).value).toBe('120')
    expect(screen.getByRole('status').textContent).toContain(report.correctAnswer)
    expect(screen.getByRole('status').textContent).toMatch(/ranked the decisive material above/i)
    expect(outcome.kept.find((entry) => entry.item.id === 'metrics')?.compressed).toBe(false)
    const full = assembleContext(report, 120, 'gist').gist!.decisions.filter((entry) => entry.action === 'full')
    expect(within(panel()).getAllByText(actionWords.full)).toHaveLength(full.length)
  })

  it('protects the instruction and the task from a compressor, as from every other policy', () => {
    renderDemo()
    chooseScenario(refund)
    choosePolicy(/Learned compression/)

    const outcome = assembleContext(refund, refund.budget, 'gist')
    expect(outcome.used).toBeLessThanOrEqual(outcome.budget)
    for (const item of refund.items.filter((entry) => entry.kind === 'system' || entry.kind === 'goal')) {
      const row = screen.getByText(item.label).closest('li') as HTMLElement
      expect(within(row).getByText('protected')).toBeInTheDocument()
      expect(within(row).getByText(`${item.tokens}t`)).toBeInTheDocument()
      // A protected item is never scored: the compressor has no choice about it.
      expect(within(row).queryByText(/^score \d/)).toBeNull()
    }
  })

  it('lets the trained scorer be reached from the buttons as well as the radios', () => {
    renderDemo()
    choosePolicy(/Truncate/)
    expect(screen.queryByRole('region', { name: /what the learned compressor did/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /score it with the trained compressor/i }))
    expect(within(panel()).getByText('What the compressor was trained on')).toBeInTheDocument()
    // and the scope note is on the screen, not only in the source
    expect(within(panel()).getByText(/not gist tokens inside a language model/i)).toBeInTheDocument()
  })
})
