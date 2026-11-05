import { describe, expect, it } from 'vitest'
import {
  CONTEXT_SCENARIOS,
  CONTEXT_SCENARIO_BY_ID,
  assembleContext,
  type ContextScenario,
} from './contextWindow'

const refund = CONTEXT_SCENARIO_BY_ID.get('refund-window') as ContextScenario
const report = CONTEXT_SCENARIO_BY_ID.get('headline-number') as ContextScenario
const ship = CONTEXT_SCENARIO_BY_ID.get('ship-tonight') as ContextScenario

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
      for (const policy of ['truncate', 'relevance', 'compress', 'page'] as const) {
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
      const outcomes = (['truncate', 'relevance', 'compress', 'page'] as const).map((policy) =>
        assembleContext(scenario, scenario.budget, policy),
      )
      expect(outcomes.some((outcome) => outcome.correct)).toBe(true)
      expect(outcomes.some((outcome) => !outcome.correct)).toBe(true)
    }
  })
})
