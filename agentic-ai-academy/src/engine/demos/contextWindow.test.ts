import { describe, expect, it } from 'vitest'
import {
  CONTEXT_POLICIES,
  CONTEXT_SCENARIOS,
  CONTEXT_SCENARIO_BY_ID,
  GIST_FEATURES,
  GIST_TRAINING,
  assembleContext,
  gistModelFor,
  scoreGistItem,
  trainGistModel,
  type ContextItem,
  type ContextScenario,
} from './contextWindow'

const refund = CONTEXT_SCENARIO_BY_ID.get('refund-window') as ContextScenario
const report = CONTEXT_SCENARIO_BY_ID.get('headline-number') as ContextScenario
const ship = CONTEXT_SCENARIO_BY_ID.get('ship-tonight') as ContextScenario
const ALL_POLICIES = CONTEXT_POLICIES.map((entry) => entry.value)

describe('assembling the context window', () => {
  it('keeps everything when it all fits', () => {
    const outcome = assembleContext(refund, 500, 'truncate')
    expect(outcome.dropped).toHaveLength(0)
    expect(outcome.used).toBe(outcome.totalTokens)
    expect(outcome.intact).toBe(true)
    expect(outcome.correct).toBe(true)
  })

  it('never lets the prompt exceed the budget', () => {
    for (const scenario of CONTEXT_SCENARIOS) {
      for (const policy of ALL_POLICIES) {
        for (const budget of [40, 60, 80, 100, 120, 150, 200]) {
          const outcome = assembleContext(scenario, budget, policy)
          expect(outcome.used).toBeLessThanOrEqual(budget)
        }
      }
    }
  })

  it('protects the instruction and the task from truncation', () => {
    const outcome = assembleContext(refund, 120, 'truncate')
    const kept = outcome.kept.map((entry) => entry.item.id)
    expect(kept).toContain('system')
    expect(kept).toContain('goal')
  })

  it('reports an overflow when the instruction and the task do not fit', () => {
    const outcome = assembleContext(refund, 20, 'truncate')
    expect(outcome.overflow).toBe(true)
    expect(outcome.correct).toBe(false)
    expect(outcome.explanation).toMatch(/cannot run the agent/i)
  })

  it('drops the decisive fact when truncating from the oldest', () => {
    const outcome = assembleContext(refund, 120, 'truncate')
    expect(outcome.kept.map((entry) => entry.item.id)).not.toContain('order-record')
    expect(outcome.intact).toBe(false)
    expect(outcome.answer).toBe(refund.wrongAnswer)
  })

  it('keeps the decisive fact when retrieving what bears on the goal', () => {
    const outcome = assembleContext(refund, 120, 'relevance')
    const kept = outcome.kept.map((entry) => entry.item.id)
    expect(kept).toContain('order-record')
    expect(outcome.intact).toBe(true)
    expect(outcome.answer).toBe(refund.correctAnswer)
  })

  it('loses the detail when compressing, even though the item is still there', () => {
    const outcome = assembleContext(refund, 120, 'compress')
    const kept = outcome.kept.find((entry) => entry.item.id === 'order-record')
    expect(kept).toBeDefined()
    expect(kept?.compressed).toBe(true)
    expect(kept?.retains).toBe(false)
    expect(outcome.intact).toBe(false)
    expect(outcome.explanation).toMatch(/no longer contains the fact/i)
  })

  it('pages the overflow out rather than losing it', () => {
    const outcome = assembleContext(refund, 120, 'page')
    expect(outcome.pagedOut.length).toBeGreaterThan(0)
    expect(outcome.recalled).not.toBeNull()
    expect(outcome.intact).toBe(true)
  })

  it('can recall the wrong item, and then get the answer wrong', () => {
    const outcome = assembleContext(ship, ship.budget, 'page')
    expect(outcome.recalled?.id).toBe('window')
    expect(outcome.intact).toBe(false)
    expect(outcome.answer).toBe(ship.wrongAnswer)
  })

  it('keeps both decisive facts when retrieving in the two-condition scenario', () => {
    const outcome = assembleContext(ship, ship.budget, 'relevance')
    const kept = outcome.kept.map((entry) => entry.item.id)
    expect(kept).toContain('test-run')
    expect(kept).toContain('window')
    expect(outcome.correct).toBe(true)
  })

  it('loses the number in the middle of a report when compressing', () => {
    const outcome = assembleContext(report, 100, 'compress')
    const kept = outcome.kept.find((entry) => entry.item.id === 'metrics')
    expect(kept?.compressed).toBe(true)
    expect(kept?.retains).toBe(false)
    expect(outcome.answer).toBe(report.wrongAnswer)
  })

  it('keeps the number in the middle of a report when retrieving', () => {
    const outcome = assembleContext(report, 100, 'relevance')
    expect(outcome.kept.map((entry) => entry.item.id)).toContain('metrics')
    expect(outcome.answer).toBe(report.correctAnswer)
  })

  it('is deterministic', () => {
    const first = assembleContext(refund, 120, 'compress')
    const second = assembleContext(refund, 120, 'compress')
    expect(first.kept.map((entry) => entry.item.id)).toEqual(second.kept.map((entry) => entry.item.id))
    expect(first.used).toBe(second.used)
  })

  it('gives every scenario a decisive fact, so the policies can be compared', () => {
    for (const scenario of CONTEXT_SCENARIOS) {
      expect(scenario.items.filter((item) => item.critical).length).toBeGreaterThan(0)
      expect(scenario.correctAnswer).not.toBe(scenario.wrongAnswer)
    }
  })

  it('never counts a protected item against the overflow', () => {
    const outcome = assembleContext(refund, 120, 'relevance')
    const protectedTokens = refund.items
      .filter((item) => item.kind === 'system' || item.kind === 'goal')
      .reduce((sum, item) => sum + item.tokens, 0)
    expect(outcome.used).toBeGreaterThanOrEqual(protectedTokens)
  })

  it('makes the policies disagree, so there is something to discover', () => {
    // If every policy gave the same answer the demonstration would have
    // nothing to show. Each scenario must have a budget at which at least one
    // policy loses the decisive fact and at least one keeps it.
    for (const scenario of CONTEXT_SCENARIOS) {
      const outcomes = ALL_POLICIES.map((policy) => assembleContext(scenario, scenario.budget, policy))
      expect(outcomes.some((outcome) => outcome.correct)).toBe(true)
      expect(outcomes.some((outcome) => !outcome.correct)).toBe(true)
    }
  })
})

describe('the learned compressor', () => {
  /**
   * The claim §9.3.2.2 makes for trained compression is that the choice of what to keep is
   * fitted rather than written. Everything below is the arithmetic that backs that up: the
   * signals the fit is allowed to see, the curve it descended, the order it then put the
   * material in, and the one place where that order costs the answer.
   */
  const decisionsOf = (scenario: ContextScenario, budget: number) =>
    (assembleContext(scenario, budget, 'gist').gist?.decisions ?? [])

  it('scores each window with a compressor trained on the other windows', () => {
    for (const scenario of CONTEXT_SCENARIOS) {
      const model = gistModelFor(scenario)
      expect(model.trainedOn).toEqual(
        CONTEXT_SCENARIOS.filter((entry) => entry.id !== scenario.id).map((entry) => entry.id),
      )
      const outcome = assembleContext(scenario, scenario.budget, 'gist')
      expect(outcome.gist?.heldOut).toBe(scenario.id)
      expect(outcome.gist?.model).toEqual(model)
    }
  })

  it('sees five hand-built signals and never the answer key', () => {
    const decisions = decisionsOf(refund, refund.budget)
    expect(decisions.length).toBeGreaterThan(0)
    for (const decision of decisions) {
      expect(Object.keys(decision.features).sort()).toEqual([
        'compressible',
        'cost',
        'questionOverlap',
        'recency',
        'tagOverlap',
      ])
    }
    expect(GIST_FEATURES.map((entry) => entry.key)).not.toContain('critical')

    // The stronger claim, checked rather than asserted: move the answer key to a different
    // item inside the window being compressed, and not one score moves. The label only ever
    // enters on the right-hand side of a fit made over the *other* windows.
    const moved: ContextScenario = {
      ...refund,
      items: refund.items.map((item) =>
        item.id === 'order-record'
          ? { ...item, critical: false }
          : item.id === 'catalogue'
            ? { ...item, critical: true }
            : item,
      ),
    }
    const scores = new Map(decisions.map((decision) => [decision.item.id, decision.score]))
    const after = decisionsOf(moved, refund.budget)
    expect(after).toHaveLength(scores.size)
    for (const decision of after) {
      expect(decision.score).toBe(scores.get(decision.item.id))
    }
    // The ranking is a property of the surface; the verdict is a property of the label.
    expect(assembleContext(moved, refund.budget, 'gist').intact).toBe(false)
  })

  it('starts the fit at chance and drives the loss down without a step back up', () => {
    for (const scenario of CONTEXT_SCENARIOS) {
      const model = gistModelFor(scenario)
      expect(model.epochs).toBe(GIST_TRAINING.epochs)
      expect(model.loss).toHaveLength(GIST_TRAINING.epochs)
      // An untrained scorer puts every item at fifty-fifty, so the curve begins at ln 2.
      expect(model.loss[0]).toBeCloseTo(Math.LN2, 12)
      for (let epoch = 1; epoch < model.loss.length; epoch += 1) {
        expect(model.loss[epoch]).toBeLessThanOrEqual(model.loss[epoch - 1] + 1e-12)
      }
      expect(model.loss[model.loss.length - 1]).toBeLessThan(model.loss[0] / 3)
    }
  })

  it('counts the material it was trained on', () => {
    const isFree = (item: ContextItem) => item.kind !== 'system' && item.kind !== 'goal'
    const freeItems = CONTEXT_SCENARIOS.reduce(
      (sum, scenario) => sum + scenario.items.filter(isFree).length,
      0,
    )
    const decisive = CONTEXT_SCENARIOS.reduce(
      (sum, scenario) => sum + scenario.items.filter((item) => item.critical).length,
      0,
    )
    const whole = trainGistModel()
    expect(whole.trainedOn).toEqual(CONTEXT_SCENARIOS.map((entry) => entry.id))
    expect(whole.examples).toBe(freeItems)
    expect(whole.positives).toBe(decisive)
    expect(freeItems).toBeGreaterThan(whole.positives * 2)

    for (const scenario of CONTEXT_SCENARIOS) {
      const held = gistModelFor(scenario)
      expect(held.examples).toBe(freeItems - scenario.items.filter(isFree).length)
      expect(held.positives).toBe(decisive - scenario.items.filter((item) => item.critical).length)
    }
  })

  it('fits the same weights every time it is asked, and worse ones in fewer epochs', () => {
    const first = trainGistModel(CONTEXT_SCENARIOS, { exclude: 'ship-tonight' })
    const second = trainGistModel(CONTEXT_SCENARIOS, { exclude: 'ship-tonight' })
    expect(second.weights).toEqual(first.weights)
    expect(second.bias).toBe(first.bias)
    expect(second.loss).toEqual(first.loss)

    const early = trainGistModel(CONTEXT_SCENARIOS, { exclude: 'ship-tonight', epochs: 20 })
    expect(early.loss).toHaveLength(20)
    expect(early.loss[19]).toBeGreaterThan(first.loss[first.loss.length - 1])
  })

  it('puts every score in the range it claims and ranks by it', () => {
    const model = gistModelFor(ship)
    const decisions = decisionsOf(ship, ship.budget)
    for (const decision of decisions) {
      expect(decision.score).toBeGreaterThanOrEqual(0)
      expect(decision.score).toBeLessThanOrEqual(1)
      expect(decision.score).toBeCloseTo(scoreGistItem(decision.features, model), 12)
    }
    for (let index = 1; index < decisions.length; index += 1) {
      expect(decisions[index - 1].score).toBeGreaterThanOrEqual(decisions[index].score)
    }
  })

  it('ranks the decisive material out of sample, and says where it does not', () => {
    for (const scenario of CONTEXT_SCENARIOS) {
      const trace = assembleContext(scenario, scenario.budget, 'gist').gist
      expect(trace).not.toBeNull()
      const ranking = trace!.ranking
      const decisive = scenario.items.filter((item) => item.critical).length
      const other = scenario.items.filter(
        (item) => !item.critical && item.kind !== 'system' && item.kind !== 'goal',
      ).length
      expect(ranking.pairs).toBe(decisive * other)
      expect(ranking.concordant).toBeLessThanOrEqual(ranking.pairs)
      expect(ranking.auc).toBeCloseTo(ranking.concordant / ranking.pairs, 12)
    }

    const aucOf = (id: string) => {
      const scenario = CONTEXT_SCENARIO_BY_ID.get(id) as ContextScenario
      return assembleContext(scenario, scenario.budget, 'gist').gist?.ranking.auc
    }
    expect(aucOf('refund-window')).toBe(1)
    expect(aucOf('ship-tonight')).toBe(1)
    // The report is the honest case: the decisive fact is a figure in the middle of a
    // document whose neighbours share its vocabulary, and two thirds of the pairs is what
    // a fit made on the other two windows gets.
    expect(aucOf('headline-number')).toBeCloseTo(2 / 3, 12)
  })

  it('keeps the delivery date in full where the hand-written summary dropped it', () => {
    const outcome = assembleContext(refund, refund.budget, 'gist')
    expect(decisionsOf(refund, refund.budget).find((entry) => entry.item.id === 'order-record')?.action).toBe('full')
    expect(outcome.intact).toBe(true)
    expect(outcome.answer).toBe(refund.correctAnswer)
    expect(assembleContext(refund, refund.budget, 'truncate').intact).toBe(false)
    expect(assembleContext(refund, refund.budget, 'compress').intact).toBe(false)
  })

  it('carries the caveat: the number in the middle is ranked third and then cut', () => {
    const outcome = assembleContext(report, report.budget, 'gist')
    expect(decisionsOf(report, report.budget).slice(0, 3).map((entry) => entry.item.id)).toEqual([
      'intro',
      'segment-1',
      'metrics',
    ])
    const kept = outcome.kept.find((entry) => entry.item.id === 'metrics')
    expect(kept?.compressed).toBe(true)
    expect(kept?.retains).toBe(false)
    expect(outcome.intact).toBe(false)
    expect(outcome.answer).toBe(report.wrongAnswer)
    expect(outcome.explanation).toMatch(/high enough to keep and short enough to lose/i)
    // The same fit, the same ranking, and a window wide enough for the full text: the loss
    // was the room, not the score.
    expect(assembleContext(report, 120, 'gist').intact).toBe(true)
  })

  it('learns the opposite of the truncation rule', () => {
    // In all three fits the recency weight came out negative: what the corpus teaches is that
    // the decisive fact tends to arrive early, which is precisely what dropping the oldest
    // material assumes is worthless.
    for (const scenario of CONTEXT_SCENARIOS) {
      expect(gistModelFor(scenario).weights.recency).toBeLessThan(0)
    }
    const outcome = assembleContext(refund, refund.budget, 'gist')
    expect(outcome.gist?.decisions.filter((entry) => entry.item.id === 'order-record')).toHaveLength(1)
    expect(outcome.dropped.map((item) => item.id)).toContain('catalogue')
    expect(outcome.kept.map((entry) => entry.item.id)).toContain('order-record')
  })

  it('gives an item the longest form the room allows, not the shortest that fits', () => {
    // A compressor that always summarised would be the hand-written policy with extra steps.
    const outcome = assembleContext(report, 120, 'gist')
    const free = outcome.kept.filter(
      (entry) => entry.item.kind !== 'system' && entry.item.kind !== 'goal',
    )
    const actions = decisionsOf(report, 120).filter((entry) => entry.action !== 'drop')
    expect(actions.filter((entry) => entry.action === 'full').length).toBe(
      free.filter((entry) => !entry.compressed).length,
    )
    expect(actions.some((entry) => entry.action === 'gist')).toBe(true)
  })

  it('is offered as a policy, and leaves no trace under the others', () => {
    expect(ALL_POLICIES).toContain('gist')
    const entry = CONTEXT_POLICIES.find((policy) => policy.value === 'gist')
    expect(entry?.label).toBe('Learned compression')
    expect(entry?.description).toMatch(/trained on the other windows/)

    for (const policy of ALL_POLICIES.filter((value) => value !== 'gist')) {
      expect(assembleContext(refund, refund.budget, policy).gist).toBeNull()
    }
    // A window too small to hold the instruction has nothing for a compressor to rank.
    const overflow = assembleContext(refund, 20, 'gist')
    expect(overflow.overflow).toBe(true)
    expect(overflow.gist).toBeNull()
  })
})
