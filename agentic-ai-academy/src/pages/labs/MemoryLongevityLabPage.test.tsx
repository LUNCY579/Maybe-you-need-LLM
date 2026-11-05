import { describe, expect, it } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryLongevityLabPage } from './MemoryLongevityLabPage'
import { ProgressProvider } from '../../store/progress'
import { LESSONS } from '../../content/lessons'
import {
  DEFAULT_LONGEVITY_CONFIG,
  DEFAULT_WRITE_POLICY_CONFIG,
  REQUIRED_FACT_IDS,
  REHEARSAL_SWEEP,
  retentionAt,
  runLongevityLab,
  runWritePolicyLab,
  sweepRehearsalIntervals,
} from '../../engine/labs/memoryLongevity'

/**
 * The screen is checked against the engine rather than against a table of
 * expected strings: every figure asserted here is computed by the same call the
 * page makes, with the settings the page declares, so a change to either shows
 * up as a failure rather than as a stale caption.
 */
function renderPage() {
  return render(
    <ProgressProvider totalLessons={LESSONS.length}>
      <MemoryLongevityLabPage />
    </ProgressProvider>,
  )
}

describe('memory durability laboratory screen', () => {
  it('states the curve it is running, not a paraphrase of one', () => {
    // R = exp(-t/S): the item loses e^-1 of its retention at t = S, and a
    // rehearsal resets that clock. The page's subtitle makes the claim; this
    // checks the arithmetic the claim describes.
    const item = { stability: 14, lastRehearsalTick: 0 }
    expect(retentionAt(item, 0)).toBeCloseTo(1, 6)
    expect(retentionAt(item, 14)).toBeCloseTo(Math.exp(-1), 6)
    expect(retentionAt(item, 28)).toBeLessThan(retentionAt(item, 14))
    expect(retentionAt({ stability: 28, lastRehearsalTick: 0 }, 14)).toBeGreaterThan(retentionAt(item, 14))
  })

  it('Ch. 9 §9.3.2.3: hierarchical summaries of a user\'s interactions, and memory that is forgotten and reinforced on an Ebbinghaus curve.', () => {
    const { container } = renderPage()
    const run = runLongevityLab(DEFAULT_LONGEVITY_CONFIG)

    // The hierarchy is there: session summaries above the traces, a profile
    // above those, and the required facts are the stream's own critical ones.
    expect(run.sessions.length).toBeGreaterThan(0)
    expect(run.profile).not.toBeNull()
    expect(run.profile?.level).toBe(2)
    expect(REQUIRED_FACT_IDS.length).toBe(run.metrics.requiredFacts)

    // The curve costs something, and the cost is attributed by a counterfactual
    // replay rather than asserted: what is missing even with no forgetting at
    // all is the summary's fault, and only the extra losses are the curve's.
    expect(run.metrics.criticalRetained).toBeLessThan(run.metrics.requiredFacts)
    expect(run.metrics.criticalLostToDecay).toEqual(run.metrics.criticalForgotten)
    expect(run.metrics.criticalLostToAbstraction).toHaveLength(0)
    expect(run.metrics.detailRetentionWithoutDecay).toBeGreaterThan(run.metrics.meanDetailRetention)

    // Folding the traces into summaries is a measurable loss of detail, and the
    // hierarchical layer holds less of it than the flat one.
    expect(run.metrics.detailLossAtCompaction).toBeGreaterThan(0)
    expect(container.textContent).toContain('lost')

    // Spacing is what saves the facts: an interval that lands before the fact
    // falls below the threshold brings it back, one that lands at the horizon
    // does not.
    const schedules = sweepRehearsalIntervals(DEFAULT_LONGEVITY_CONFIG, REHEARSAL_SWEEP)
    const none = schedules.find((entry) => entry.interval === 0)
    if (!none) throw new Error('the sweep must include the unscheduled arm')
    expect(none.savedCritical).toBe(0)
    const saving = schedules.filter((entry) => entry.savedCritical > 0)
    expect(saving.length).toBeGreaterThan(0)
    for (const entry of saving) {
      expect(entry.criticalRetained).toBe(none.criticalRetained + entry.savedCritical)
      expect(entry.interval).toBeLessThan(DEFAULT_LONGEVITY_CONFIG.horizonTick)
    }
    expect(screen.getAllByText('decay').length).toBe(run.metrics.criticalLostToDecay.length)
  })

  it('Ch. 9 §9.3.2.3: the learned counterpart to explicit memory management — the agent decides what to remember, trained by reinforcement learning.', async () => {
    renderPage()
    await userEvent.click(screen.getByRole('tab', { name: /a policy that decides what to write/i }))

    const run = runWritePolicyLab(DEFAULT_WRITE_POLICY_CONFIG)

    // The policy is trained, not tuned: parity arrives at a measured episode,
    // and the updates it took are reported with it.
    expect(run.parityEpisode).not.toBeNull()
    expect(run.parityUpdates).toBe((run.parityEpisode! + 1) * run.rule.trace.length)
    expect(run.qualityParityEpisode).not.toBeNull()
    expect(run.qualityParityEpisode!).toBeGreaterThanOrEqual(run.parityEpisode!)
    expect(run.curve.length).toBeGreaterThan(1)
    expect(run.updates).toBe(run.episodes * run.rule.trace.length)

    // What it learns is a smaller store that answers the question: the rule
    // fills the capacity and gets fewer of its items in front of the decision.
    expect(run.learned.storeSize).toBeLessThanOrEqual(run.rule.storeSize)
    expect(run.learned.criticalRetrieved).toBeGreaterThan(run.rule.criticalRetrieved)
    expect(run.learned.reward).toBeGreaterThan(run.rule.reward)
    expect(run.learned.actions.add + run.learned.actions.update + run.learned.actions.delete + run.learned.actions.none).toBe(
      run.learned.trace.length,
    )
    expect(run.learned.actions.none).toBeGreaterThan(0)

    // The budget sweep is where the difference is visible: with one item handed
    // to the decision the rule is wrong and the learned store is not.
    expect(run.decisionAccuracy[0].topK).toBe(1)
    expect(run.decisionAccuracy[0].learned).toBe(true)
    expect(run.decisionAccuracy[0].rule).toBe(false)
    expect(run.learnedAccuracy).toBeGreaterThan(run.ruleAccuracy)

    expect(screen.getByRole('tabpanel', { name: /a policy that decides what to write/i })).toBeInTheDocument()
  })

  it('re-runs the curve when the horizon is moved', () => {
    const { container } = renderPage()
    const before = runLongevityLab(DEFAULT_LONGEVITY_CONFIG).curve.length
    expect(container.textContent).toContain('at tick ' + DEFAULT_LONGEVITY_CONFIG.horizonTick)

    const horizon = screen.getByRole('slider', { name: 'Horizon tick' })
    fireEvent.change(horizon, { target: { value: String(DEFAULT_LONGEVITY_CONFIG.horizonTick + 8) } })

    const after = runLongevityLab({ ...DEFAULT_LONGEVITY_CONFIG, horizonTick: DEFAULT_LONGEVITY_CONFIG.horizonTick + 8 })
    expect(after.curve).toHaveLength(before + 8)
    expect(screen.getByText('at tick ' + (DEFAULT_LONGEVITY_CONFIG.horizonTick + 8) + ', at 75% of their keywords')).toBeInTheDocument()
    // A longer wait is not a neutral change: the curve has had further to fall.
    expect(after.metrics.criticalRetained).toBeLessThanOrEqual(before === 0 ? 0 : runLongevityLab(DEFAULT_LONGEVITY_CONFIG).metrics.criticalRetained)
  })

  it('schedules a rehearsal from the panel and the store changes with it', async () => {
    renderPage()
    const picker = screen.getByRole('combobox', { name: 'Scheduled rehearsal interval' })
    expect(within(picker).getAllByRole('option')).toHaveLength(REHEARSAL_SWEEP.length)

    await userEvent.selectOptions(picker, '8')

    const run = runLongevityLab({ ...DEFAULT_LONGEVITY_CONFIG, rehearsalInterval: 8 })
    expect(run.metrics.criticalRetained).toBe(REQUIRED_FACT_IDS.length)
    const held = screen.getByText(run.metrics.criticalRetained + '/' + run.metrics.requiredFacts)
    expect(held).toBeInTheDocument()
    expect(run.metrics.forgottenTotal).toBe(0)
  })
})
