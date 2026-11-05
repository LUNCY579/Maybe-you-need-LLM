import { describe, expect, it } from 'vitest'
import { createRng } from '@llm-materials/course-core'
import {
  acceptanceRate,
  chainOfSameCost,
  closedFormAcceptanceRate,
  crossoverAcceptance,
  expectedAcceptedTokens,
  expectedChainTokens,
  expectedMedusaTokens,
  medusaHeads,
  measuredOutputDistribution,
  perturbed,
  proposeAndVerify,
  residual,
  sampleFrom,
  simulateMedusa,
  simulateSpeculative,
  simulateTreeSpeculative,
  speculativeDistribution,
  totalVariation,
  treeNodes,
  verify,
} from './speculative'

/** A vocabulary of `symbols` tokens with a non-uniform, planted distribution. */
function makeTarget(symbols: number, seed: number): number[] {
  const rng = createRng(seed)
  const weights = Array.from({ length: symbols }, () => 0.2 + rng() * 3)
  const total = weights.reduce((a, b) => a + b, 0)
  return weights.map((value) => value / total)
}

const target = makeTarget(12, 3)
const wide = makeTarget(24, 3)

/** The largest distance between two distributions, symbol by symbol. */
function maxDeviation(a: number[], b: number[]): number {
  return Math.max(...a.map((value, i) => Math.abs(value - (b[i] ?? 0))))
}

describe('the modified rejection rule', () => {
  it('renormalises the residual it resamples from', () => {
    const draft = perturbed(target, 0.15, 4)
    const excess = target.map((p, i) => Math.max(0, p - (draft[i] ?? 0)))
    const residualDraft = residual(draft, target)
    // The positive parts of p − q sum to the total variation, which is a small
    // fraction. Drawn from unnormalised they would run off the end of the
    // cumulative sum for almost every random number.
    expect(excess.reduce((a, b) => a + b, 0)).toBeLessThan(0.2)
    expect(residualDraft.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12)
    expect(residualDraft.every((value, i) => (draft[i]! >= target[i]! ? value === 0 : value > 0))).toBe(true)
    // Every uncovered symbol keeps its share of the uncovered mass.
    const share = excess.reduce((a, b) => a + b, 0)
    expect(residualDraft[3]!).toBeCloseTo(excess[3]! / share, 12)
    // A draft that covers the target leaves nothing to correct.
    expect(residual(target, target)).toEqual(target)
  })

  it('draws from the target, not from anything the draft agrees with', () => {
    // This is the property the whole method rests on, so it is measured at two
    // precisions rather than asserted at one: the distance to the target has to
    // shrink with the number of trials, which is what sampling noise looks like.
    expect(maxDeviation(speculativeDistribution(target), target)).toBe(0)
    const coarse = measuredOutputDistribution(target, { trials: 40000 })
    const fine = measuredOutputDistribution(target, { trials: 200000, seed: 5 })
    expect(maxDeviation(coarse, target)).toBeLessThan(0.005)
    expect(maxDeviation(fine, target)).toBeLessThan(0.002)
    // A different draft quality, the same output.
    for (const draftNoise of [0.05, 0.5]) {
      expect(
        maxDeviation(
          measuredOutputDistribution(target, { draftNoise, trials: 40000, seed: 17 }),
          target,
        ),
      ).toBeLessThan(0.006)
    }
  })

  it('accepts the overlap and nothing else', () => {
    const draft = perturbed(target, 0.3, 6)
    // 1 − TV is the fraction of the draft's mass the target agrees with, and the
    // rule is drawn often enough to be the same number.
    expect(closedFormAcceptanceRate(draft, target)).toBeCloseTo(
      1 - totalVariation(draft, target),
      12,
    )
    expect(acceptanceRate(draft, target, { trials: 20000, seed: 2 })).toBeCloseTo(
      closedFormAcceptanceRate(draft, target),
      1,
    )
    // The same model drafting itself is never refused, and TV is symmetric.
    expect(closedFormAcceptanceRate(target, target)).toBe(1)
    expect(acceptanceRate(target, target, { trials: 2000 })).toBe(1)
    expect(totalVariation(draft, target)).toBe(totalVariation(target, draft))
    // Worse drafts, in order: the noise the toy moves is the disagreement.
    const rates = [0, 0.2, 0.6, 1].map((noise) =>
      closedFormAcceptanceRate(perturbed(target, noise, 6), target),
    )
    for (let i = 1; i < rates.length; i++) expect(rates[i]!).toBeLessThan(rates[i - 1]!)
  })

  it('keeps the prefix and stops at the first refusal', () => {
    expect(verify([1, 2, 3], [1, 2, 3])).toEqual({ accepted: 3, corrected: null })
    expect(verify([1, 2, 3], [1, 9, 3])).toEqual({ accepted: 1, corrected: 9 })
    // A token after a refusal is worth nothing, however good it looks.
    expect(verify([1, 2], [7, 2])).toEqual({ accepted: 0, corrected: 7 })
    expect(verify([], [1])).toEqual({ accepted: 0, corrected: null })
  })

  it('is the rule every run uses, and it never returns an impossible token', () => {
    const rng = createRng(9)
    const draft = perturbed(target, 0.4, 10)
    const seen = new Set<number>()
    let corrections = 0
    for (let i = 0; i < 4000; i++) {
      const outcome = proposeAndVerify(draft, target, rng)
      expect(outcome.token).toBeGreaterThanOrEqual(0)
      expect(outcome.token).toBeLessThan(target.length)
      seen.add(outcome.token)
      if (!outcome.accepted) corrections++
    }
    // The corrected token comes from the residual, so it is a symbol the draft
    // had under-weighted — and it exists at all only because the draft is wrong.
    expect(corrections).toBeGreaterThan(0)
    expect(corrections).toBeLessThan(4000)
    expect(seen.size).toBe(target.length)
    expect(sampleFrom(target, () => 0.999)).toBe(target.length - 1)
  })
})

describe('a chain of drafts', () => {
  it('produces the accepted prefix plus one token of the target’s own', () => {
    const draftLength = 4
    const run = simulateSpeculative(target, { draftLength, steps: 800 })
    // The rate the run reports is the prefix kept over every position proposed,
    // which is the closed form divided by the draft length — not the per-token
    // acceptance, which is higher.
    const acceptance = closedFormAcceptanceRate(perturbed(target, 0.15, 8), target)
    const expectedPrefix = expectedChainTokens(acceptance, draftLength)
    expect(run.acceptanceRate).toBeCloseTo(expectedPrefix / draftLength, 1)
    expect(run.tokensPerStep).toBeCloseTo(expectedPrefix + 1, 1)
    expect(run.targetTokens).toBe(run.baselineSteps)
    expect(run.targetSteps).toBe(800)
    expect(run.proposed).toBe(800 * draftLength)
  })

  it('gains from a longer draft, but not in proportion to it', () => {
    const lengths = [1, 2, 4, 8, 16].map((draftLength) => ({
      draftLength,
      run: simulateSpeculative(wide, { draftLength, steps: 1500 }),
    }))
    for (let i = 1; i < lengths.length; i++) {
      expect(lengths[i]!.run.tokensPerStep).toBeGreaterThan(lengths[i - 1]!.run.tokensPerStep)
      // Doubling the draft never doubles the output: the prefix has to survive
      // every extra position to count, and the far ones rarely do.
      expect(lengths[i]!.run.tokensPerStep).toBeLessThan(2 * lengths[i - 1]!.run.tokensPerStep)
      // And each extra proposal is worth less than the one before it.
      expect(lengths[i]!.run.tokensPerStep / lengths[i]!.draftLength).toBeLessThan(
        lengths[i - 1]!.run.tokensPerStep / lengths[i - 1]!.draftLength,
      )
    }
    // And the fraction of the proposals that survive falls all the way down.
    for (let i = 1; i < lengths.length; i++) expect(lengths[i]!.run.acceptanceRate).toBeLessThan(lengths[i - 1]!.run.acceptanceRate)
  })

  it('is only a speed-up while the draft is cheaper than the target', () => {
    // The tokens do not care what the draft costs — only the wall time does, and
    // at a draft as expensive as the target, speculation is a loss.
    const cheap = simulateSpeculative(wide, { draftCost: 0.05, steps: 600 })
    const dear = simulateSpeculative(wide, { draftCost: 1, steps: 600 })
    expect(cheap.tokensPerStep).toBeCloseTo(dear.tokensPerStep, 6)
    expect(cheap.speedup).toBeGreaterThan(dear.speedup)
    expect(dear.speedup).toBeLessThan(1)
    expect(cheap.speedup).toBeGreaterThan(2)
    // The arithmetic the screen quotes, term by term: the step costs the
    // target's pass plus one draft pass per proposed token.
    expect(dear.speedup).toBeCloseTo(dear.baselineSteps / (dear.targetSteps * (1 + 1 * 4)), 6)
    expect(cheap.speedup).toBeCloseTo(cheap.baselineSteps / (cheap.targetSteps * (1 + 0.05 * 4)), 6)
  })
})

describe('the tree', () => {
  it('is paid for in full whether or not the accepted path uses it', () => {
    const shape = { depth: 4, width: 2 }
    expect(treeNodes(shape)).toBe(8)
    const chain = chainOfSameCost(treeNodes(shape))
    expect(chain.width).toBe(1)
    expect(treeNodes(chain)).toBe(treeNodes(shape))
    expect(treeNodes({ depth: 0, width: 3 })).toBe(0)
    // The chain's depth is the tree's whole budget, spent at one level.
    expect(chain.depth).toBe(8)
  })

  it('hedges: a second candidate helps, a third helps less', () => {
    const acceptance = 0.7
    // One candidate at a time: each extra chance at every level is worth less
    // than the one before, because it only pays when all the others failed.
    const unit = [1, 2, 3, 4, 5].map((width) => expectedAcceptedTokens(acceptance, { depth: 4, width }))
    for (let i = 1; i < unit.length; i++) expect(unit[i]!).toBeGreaterThan(unit[i - 1]!)
    for (let i = 2; i < unit.length; i++) {
      const gain = unit[i]! - unit[i - 1]!
      const previous = unit[i - 1]! - unit[i - 2]!
      expect(gain).toBeLessThan(previous)
    }
    // Doubling the width never doubles the harvest, which is the same fact
    // stated as the yield per position the screen plots.
    const doubled = [1, 2, 4, 8].map((width) => ({
      width,
      tokens: expectedAcceptedTokens(acceptance, { depth: 4, width }),
    }))
    for (let i = 1; i < doubled.length; i++) {
      expect(doubled[i]!.tokens).toBeLessThan(2 * doubled[i - 1]!.tokens)
      expect(doubled[i]!.tokens / doubled[i]!.width).toBeLessThan(doubled[i - 1]!.tokens / doubled[i - 1]!.width)
    }
    // One candidate per level is the chain, by definition and by value.
    expect(expectedAcceptedTokens(acceptance, { depth: 4, width: 1 })).toBe(
      expectedChainTokens(acceptance, 4),
    )
    for (const width of [1, 2, 3]) {
      const depths = [1, 2, 4, 8].map((depth) => expectedAcceptedTokens(acceptance, { depth, width }))
      for (let i = 1; i < depths.length; i++) expect(depths[i]!).toBeGreaterThan(depths[i - 1]!)
    }
    // A perfect draft needs no hedge and a hopeless one gets nothing from it.
    expect(expectedAcceptedTokens(1, { depth: 4, width: 2 })).toBe(4)
    expect(expectedAcceptedTokens(0, { depth: 4, width: 2 })).toBe(0)
  })

  it('has a crossover, and the two closed forms change sides across it', () => {
    const shape = { depth: 4, width: 2 }
    const chain = chainOfSameCost(treeNodes(shape))
    const crossover = crossoverAcceptance(shape)
    expect(crossover).toBeGreaterThan(0.3)
    expect(crossover).toBeLessThan(1)
    // Below it the hedge wins; above it the positions are better spent deeper.
    for (const acceptance of [crossover - 0.12, crossover - 0.03]) {
      expect(expectedAcceptedTokens(acceptance, shape)).toBeGreaterThan(
        expectedAcceptedTokens(acceptance, chain),
      )
    }
    for (const acceptance of [crossover + 0.02, crossover + 0.12]) {
      expect(expectedAcceptedTokens(acceptance, shape)).toBeLessThan(
        expectedAcceptedTokens(acceptance, chain),
      )
    }
    // A width-one tree is the chain, so there is no acceptance at which it wins.
    expect(crossoverAcceptance({ depth: 4, width: 1 })).toBeLessThanOrEqual(1 / 200)
    // Reaching deeper is worth more than reaching wider, because a hedge at the
    // bottom of the tree only pays if the top of it survived.
    expect(crossoverAcceptance({ depth: 8, width: 2 })).toBeGreaterThan(crossover)
  })

  it('measures what the closed form predicts', () => {
    const shape = { depth: 4, width: 2 }
    const run = simulateTreeSpeculative(wide, { shape, draftNoise: 0.4, steps: 4000 })
    expect(run.nodesPerStep).toBe(8)
    expect(run.acceptanceRate).toBeCloseTo(
      closedFormAcceptanceRate(perturbed(wide, 0.4, 12), wide),
      1,
    )
    // The closed form is computed from the acceptance the run measured, so the
    // two agree to within the run's own noise.
    expect(run.tokensPerStep).toBeGreaterThan(run.expected * 0.95)
    expect(run.tokensPerStep).toBeLessThan(run.expected * 1.05)
    expect(run.tokensPerStep).toBeGreaterThan(run.acceptedPerStep)
    expect(run.tokensPerNode * run.nodesPerStep).toBeCloseTo(run.tokensPerStep, 6)
    expect(run.chain.tokensPerNode * 8).toBeCloseTo(run.chain.tokensPerStep, 6)
  })

  it('wins only against a bad draft, exactly where the crossover says', () => {
    const shape = { depth: 4, width: 2 }
    const bad = simulateTreeSpeculative(wide, { shape, draftNoise: 1, steps: 4000 })
    const good = simulateTreeSpeculative(wide, { shape, draftNoise: 0.6, steps: 4000 })
    // Below the crossover the hedge is worth more per position than the chain;
    // above it the tree is a chain with its positions split.
    expect(bad.acceptanceRate).toBeLessThan(crossoverAcceptance(shape))
    expect(good.acceptanceRate).toBeGreaterThan(crossoverAcceptance(shape))
    expect(bad.tokensPerNode).toBeGreaterThan(bad.chain.tokensPerNode)
    expect(good.tokensPerNode).toBeLessThan(good.chain.tokensPerNode)
    // Both runs take more tokens per step than the chain — the hedge wastes
    // positions, not tokens; it is the *cost per token* that is the trade.
    expect(bad.tokensPerStep).toBeGreaterThan(bad.chain.tokensPerStep)
    // With one candidate per level the tree is the chain, and the two runs of
    // the same shape differ only by their seeds.
    const flat = simulateTreeSpeculative(wide, { shape: { depth: 4, width: 1 }, draftNoise: 0.8, steps: 4000 })
    expect(flat.tokensPerNode).toBeCloseTo(flat.chain.tokensPerNode, 2)
  })
})

describe('medusa heads', () => {
  it('guesses worse the further ahead it looks', () => {
    const heads = medusaHeads(wide)
    expect(heads).toHaveLength(4)
    const acceptance = heads.map((head) => closedFormAcceptanceRate(head, wide))
    for (let i = 1; i < acceptance.length; i++) expect(acceptance[i]!).toBeLessThan(acceptance[i - 1]!)
    // The head for position one is a draft of the target's own next token, so it
    // is the best of them, and none of them is useless.
    expect(acceptance[0]!).toBeGreaterThan(0.9)
    expect(acceptance[3]!).toBeGreaterThan(0.5)
  })

  it('is the prefix product, measured', () => {
    expect(expectedMedusaTokens([])).toBe(1)
    expect(expectedMedusaTokens([0, 0, 0])).toBe(1)
    expect(expectedMedusaTokens([1, 1, 1])).toBe(4)
    expect(expectedMedusaTokens([0.5, 0.5])).toBeCloseTo(1 + 0.5 + 0.25, 12)

    const run = simulateMedusa(wide, { steps: 30000 })
    // The speed-up is not a measured accident: the run's tokens per step are the
    // running products of the heads' closed-form acceptances, plus the target's
    // own token.
    let running = 1
    const prefixProducts = run.acceptance.reduce((sum, a) => {
      running *= a
      return sum + running
    }, 0)
    expect(run.expectedTokensPerStep).toBeCloseTo(1 + prefixProducts, 9)
    expect(run.tokensPerStep).toBeGreaterThan(run.expectedTokensPerStep * 0.98)
    expect(run.tokensPerStep).toBeLessThan(run.expectedTokensPerStep * 1.02)
    expect(run.speedup).toBeCloseTo(run.tokensPerStep, 12)
    expect(run.baselineSteps).toBeCloseTo(run.tokensPerStep * 30000, 6)
  })

  it('measures each head among the steps that reached it', () => {
    const run = simulateMedusa(wide, { steps: 8000 })
    expect(run.measuredAcceptance).toHaveLength(4)
    for (let head = 0; head < run.measuredAcceptance.length; head++) {
      // The conditional acceptance the loop measures is the same quantity the
      // prefix product multiplies, so they agree to within the sampling error —
      // which grows with the head, since fewer steps reach it.
      expect(Math.abs(run.measuredAcceptance[head]! - run.acceptance[head]!)).toBeLessThan(0.02)
    }
    // A head is only asked when every head before it was kept.
    const reach = run.acceptance
      .map((_, i) => run.acceptance.slice(0, i).reduce((a, b) => a * b, 1))
      .map((p) => p * 8000)
    expect(reach[0]).toBe(8000)
    expect(reach[3]!).toBeLessThan(reach[2]!)
    expect(reach[3]!).toBeGreaterThan(8000 * 0.6)
  })

  it('buys less with each extra head', () => {
    const ladder = [1, 2, 3, 4, 5, 6].map((heads) => simulateMedusa(wide, { heads, steps: 12000 }))
    for (let i = 1; i < ladder.length; i++) {
      expect(ladder[i]!.expectedTokensPerStep).toBeGreaterThan(ladder[i - 1]!.expectedTokensPerStep)
      // The measured run follows the same curve, which is the point of the toy:
      // the heads are free, and their accuracy is what the paper trades against.
      expect(ladder[i]!.tokensPerStep).toBeGreaterThan(ladder[i - 1]!.tokensPerStep)
    }
    for (let i = 2; i < ladder.length; i++) {
      // The head for position six only counts when the five before it were
      // kept, so its marginal contribution is the product of six acceptances —
      // and that shrinks with every head added.
      const gain = ladder[i]!.expectedTokensPerStep - ladder[i - 1]!.expectedTokensPerStep
      const previous = ladder[i - 1]!.expectedTokensPerStep - ladder[i - 2]!.expectedTokensPerStep
      expect(gain).toBeLessThan(previous)
    }
  })
})
