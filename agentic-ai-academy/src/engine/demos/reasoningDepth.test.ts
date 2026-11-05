import { describe, expect, it } from 'vitest'
import {
  CHAIN_LENGTH_SWEEP,
  CHECKER_CALL_TOKENS,
  DEFAULT_REASONING_DEPTH_CONFIG,
  REASONING_STYLES,
  REASONING_TASKS,
  TASK_FAMILIES,
  TASK_FAMILY_BY_ID,
  effectiveChainLength,
  measureFamily,
  runDepthBattery,
  stepFailureProbability,
  stepLoads,
} from './reasoningDepth'

const config = { ...DEFAULT_REASONING_DEPTH_CONFIG }
const at = (patch: Partial<typeof config>) => ({ ...config, ...patch })

describe('the reasoning depth battery', () => {
  it('Ch. 6 and Ch. 9: chain-of-thought prompting as interaction style C.', () => {
    // The claim is about a shape: style C emits steps and receives no
    // observation, style A emits one step, style B puts a call to the world in
    // between and reads something back. That difference is what the engine
    // runs, and it is measured rather than declared.
    const chain = measureFamily('arithmetic', at({ style: 'C', chainLength: 5 }))!
    const direct = measureFamily('arithmetic', at({ style: 'A', chainLength: 5 }))!
    const acting = measureFamily('arithmetic', at({ style: 'B', chainLength: 5 }))!

    expect(chain.meanReasoningSteps).toBe(5)
    expect(chain.meanToolSteps).toBe(0)
    expect(direct.meanReasoningSteps).toBe(1)
    expect(acting.meanReasoningSteps).toBe(5)
    // Style B is the only policy with an observation returning to it, so it is
    // the only one that spends a tool call — and it spends one per step.
    expect(acting.meanToolSteps).toBe(5)
    expect(direct.meanToolSteps).toBe(0)
    expect(acting.meanTokens).toBeGreaterThan(chain.meanTokens)
    expect(chain.meanTokens).toBeGreaterThan(direct.meanTokens)

    // And the shape is the workflow builder's shape, not a new vocabulary.
    for (const style of REASONING_STYLES) {
      expect(style.workflowNodes).toContain('reasoning')
      if (style.value === 'B') expect(style.workflowNodes).toEqual(expect.arrayContaining(['tool', 'observation']))
      if (style.value !== 'B') expect(style.workflowNodes).not.toContain('tool')
    }
    expect(effectiveChainLength('A', 9)).toBe(1)
  })

  it("Ch. 23 §23.2.2: the measurement behind the chapter's warning that more thinking is not always better.", () => {
    const battery = runDepthBattery(at({ style: 'C', chainLength: 6 }))

    // Depth pays inside a family that decomposes, but only up to the length the
    // work has: measured at its own crossover the arithmetic chain beats the
    // single step, and the win is small.
    const atCrossover = runDepthBattery(at({ style: 'C', chainLength: battery.crossover.arithmetic }))
    const arithmetic = atCrossover.perFamily.find((row) => row.family.id === 'arithmetic')!
    expect(arithmetic.deltaVsDirect).toBeGreaterThan(0)

    // And past the peak the chain is strictly worse than the chain that stopped
    // there, at strictly more cost: that is overthinking, in two figures.
    const peakPoint = battery.sweep.find((point) => point.chainLength === battery.crossover.arithmetic)!
    const beyond = battery.sweep.find((point) => point.chainLength === 10)!
    expect(beyond.perFamily.arithmetic).toBeLessThan(peakPoint.perFamily.arithmetic)
    expect(beyond.meanTokens).toBeGreaterThan(peakPoint.meanTokens)

    // So the battery has to be reported as a split verdict rather than a win:
    // more than one family is measured below style A at a chain length where at
    // least one decomposable family is above it.
    const losses = battery.perFamily.filter((row) => row.verdict === 'depth-costs').map((row) => row.family.id)
    expect(losses.length).toBeGreaterThan(1)
    expect(battery.familiesWhereDepthHurts.length).toBeGreaterThan(0)
    expect(battery.aggregateGain).toBeLessThan(0)
  })

  it('measures the warning that extra thinking is not always better where the work does not split', () => {
    // The warning is that a chain which adds no information only adds places to
    // fail. Measured: with the error rate held fixed, the indivisible families
    // get strictly worse the longer the chain is, monotonically, and their
    // accuracy peaks at a single step.
    const battery = runDepthBattery(at({ style: 'C', chainLength: 6 }))

    for (const familyId of ['knowledge', 'commonsense', 'writing'] as const) {
      expect(battery.crossover[familyId]).toBe(1)
      const single = battery.sweep.find((point) => point.chainLength === 1)
      const short = battery.sweep.find((point) => point.chainLength === 2)
      const long = battery.sweep.find((point) => point.chainLength === 8)
      expect(short!.perFamily[familyId]).toBeLessThan(single!.perFamily[familyId])
      expect(long!.perFamily[familyId]).toBeLessThan(short!.perFamily[familyId])
    }

    // The aggregate over the whole battery peaks at one step, so "think longer"
    // is not a strategy on this instrument — it is a cost.
    expect(battery.aggregateCrossover).toBe(1)
    expect(battery.aggregateAtOne).toBeGreaterThan(battery.aggregateAtChainLength)
  })

  it('locates a crossover inside a family that decomposes', () => {
    const battery = runDepthBattery(at({ style: 'C', chainLength: 6 }))
    expect(battery.crossover.arithmetic).toBeGreaterThan(1)
    expect(battery.crossover.symbolic).toBeGreaterThan(1)
    const peak = battery.sweep.find((point) => point.chainLength === battery.crossover.arithmetic)
    for (const point of battery.sweep) {
      expect(point.perFamily.arithmetic).toBeLessThanOrEqual(peak!.perFamily.arithmetic + 1e-9)
    }
    expect(CHAIN_LENGTH_SWEEP).toContain(battery.crossover.arithmetic)
  })

  it('splits the operations of a decomposable task and re-renders the whole state for an indivisible one', () => {
    const arithmetic = TASK_FAMILY_BY_ID.get('arithmetic')!
    const knowledge = TASK_FAMILY_BY_ID.get('knowledge')!
    // Six operations over four steps: two steps carry two, two carry one.
    expect(stepLoads(arithmetic, 6, 4)).toEqual([2, 2, 1, 1])
    // A chain longer than the work still emits steps, and an empty step still
    // carries one operation's worth of risk.
    expect(stepLoads(arithmetic, 4, 6)).toEqual([1, 1, 1, 1, 1, 1])
    // A single step always carries the whole task, in either family.
    expect(stepLoads(arithmetic, 4, 1)).toEqual([4])
    expect(stepLoads(knowledge, 1, 1)).toEqual([1])
    // The indivisible family carries the whole problem in every step, which is
    // the precise sense in which an extra step adds nothing.
    expect(stepLoads(knowledge, 2, 5)).toEqual([2, 2, 2, 2, 2])
    expect(stepLoads(knowledge, 2, 1)).toEqual([2])
  })

  it('makes a step harder in proportion to what it carries, and never past certainty', () => {
    expect(stepFailureProbability(0, 0.03)).toBe(0)
    expect(stepFailureProbability(1, 0.03)).toBeCloseTo(0.03, 10)
    expect(stepFailureProbability(4, 0.03)).toBeCloseTo(0.12, 10)
    expect(stepFailureProbability(400, 0.03)).toBe(1)
    // Every accuracy figure on screen is the product of these survivals, so a
    // task with more operations has to be beaten by a longer chain or not at all.
    const long = measureFamily('arithmetic', at({ style: 'A' }))!
    const short = measureFamily('arithmetic', at({ style: 'A', perStepError: 0 }))!
    expect(short.accuracy).toBe(1)
    expect(long.accuracy).toBeLessThan(1)
  })

  it('gives a tool an observation to return only where there is something to check', () => {
    // Arithmetic can be re-executed, so style B repairs what style C propagates.
    const arithmeticChain = measureFamily('arithmetic', at({ style: 'C', chainLength: 6 }))!
    const arithmeticChecked = measureFamily('arithmetic', at({ style: 'B', chainLength: 6 }))!
    expect(arithmeticChecked.accuracy).toBeGreaterThan(arithmeticChain.accuracy)

    // A commonsense judgement has no external check, so style B is style C with
    // a bill attached: the same accuracy, strictly more tokens.
    const commonsenseChain = measureFamily('commonsense', at({ style: 'C', chainLength: 4 }))!
    const commonsenseChecked = measureFamily('commonsense', at({ style: 'B', chainLength: 4 }))!
    expect(commonsenseChecked.accuracy).toBe(commonsenseChain.accuracy)
    expect(commonsenseChecked.meanToolSteps).toBe(4)
    expect(commonsenseChecked.meanTokens - commonsenseChain.meanTokens).toBeCloseTo(4 * CHECKER_CALL_TOKENS, 6)
  })

  it('is deterministic: the same configuration gives the same measured figures', () => {
    const first = runDepthBattery(at({ chainLength: 5, seed: 3 }))
    const second = runDepthBattery(at({ chainLength: 5, seed: 3 }))
    expect(second).toEqual(first)
    expect(JSON.stringify(second.perFamily)).toBe(JSON.stringify(first.perFamily))
  })

  it('moves with its inputs instead of restating a constant', () => {
    const careless = runDepthBattery(at({ perStepError: 0.08, chainLength: 6 }))
    const careful = runDepthBattery(at({ perStepError: 0.005, chainLength: 6 }))
    for (const family of TASK_FAMILIES) {
      const a = careless.sweep.at(-1)!.perFamily[family.id]
      const b = careful.sweep.at(-1)!.perFamily[family.id]
      expect(b).toBeGreaterThanOrEqual(a)
    }
    // A longer chain on an indivisible family is worse at any error rate above
    // zero, and the gap has to widen as the error rate rises.
    const smallGap = careful.perFamily.find((row) => row.family.id === 'knowledge')!
    const largeGap = careless.perFamily.find((row) => row.family.id === 'knowledge')!
    expect(Math.abs(largeGap.deltaVsDirect)).toBeGreaterThan(Math.abs(smallGap.deltaVsDirect))
  })

  it('is a labelled instrument: the battery is hand-authored and separated by family', () => {
    expect(REASONING_TASKS.length).toBeGreaterThanOrEqual(10)
    for (const family of TASK_FAMILIES) {
      const entries = REASONING_TASKS.filter((entry) => entry.family === family.id)
      expect(entries.length).toBeGreaterThan(0)
      for (const entry of entries) {
        expect(entry.operations).toBeGreaterThan(0)
        expect(entry.promptTokens).toBeGreaterThan(0)
        expect(entry.stepTokens).toBeGreaterThan(0)
        // The check a policy can make is the family's property, not a per-task
        // favouritism: nothing is quietly given a calculator.
        expect(entry.checkable).toBe(family.externallyCheckable)
      }
      // Decomposability is the only difference that can make depth pay.
      if (!family.decomposable) {
        const chain = measureFamily(family.id, at({ style: 'C', chainLength: 6 }))!
        const direct = measureFamily(family.id, at({ style: 'A' }))!
        expect(chain.accuracy).toBeLessThanOrEqual(direct.accuracy + 1e-9)
      }
    }
    const aggregate = runDepthBattery(at({ chainLength: 8 }))
    expect(aggregate.moreDepthPays).toBe(false)
    expect(aggregate.aggregateCrossover).toBe(1)
  })

  it('reports a measured split verdict rather than a headline', () => {
    const battery = runDepthBattery(at({ style: 'C', chainLength: 4 }))
    expect(battery.aggregateGain).toBeLessThan(0)
    expect(battery.directAggregate).toBeGreaterThan(battery.aggregateAtChainLength)
    expect(battery.aggregateTokenRatio).toBeGreaterThan(1)
    expect(battery.familiesWhereDepthHelps.every((id) => TASK_FAMILY_BY_ID.get(id)!.decomposable)).toBe(true)
  })
})
