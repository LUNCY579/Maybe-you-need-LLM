import { describe, expect, it } from 'vitest'
import {
  capacityOverflow,
  deadZoneSteps,
  fairShare,
  firstMovedStep,
  idealExperts,
  lambdaSweep,
  largestRise,
  loadBalanceLoss,
  lossCurve,
  routeByNeed,
  routerCorrection,
  routingInstability,
  trainLoadBalancer,
} from './moe'

/**
 * The claims the load-balancing screen makes.
 *
 * The router here is a toy — synthetic tokens with a planted preference for a
 * few experts, and a bias that moves by the correction the auxiliary loss
 * implies — so the tests are about the controller's dynamics, which is what the
 * toy is a model of, and not about a language model's loss.
 */
describe('the auxiliary loss', () => {
  it('is exactly one when the router is balanced, at any top-k', () => {
    const experts = 8
    const load = Array.from({ length: experts }, () => fairShare(experts, 1))
    const probability = Array.from({ length: experts }, () => 1 / experts)
    expect(loadBalanceLoss(load, probability, { topK: 1 })).toBeCloseTo(1, 12)
    const two = Array.from({ length: experts }, () => fairShare(experts, 2))
    expect(loadBalanceLoss(two, probability, { topK: 2 })).toBeCloseTo(1, 12)
  })

  it('rises with the imbalance it is meant to remove', () => {
    const skewed = [0.7, 0.1, 0.1, 0.1]
    const flat = [0.25, 0.25, 0.25, 0.25]
    expect(loadBalanceLoss(skewed, skewed, { topK: 1 })).toBeCloseTo(2.08, 6)
    // It is a product, so it needs the two halves to lean the same way to see
    // the leaning: a load the probabilities do not share reads as balanced.
    expect(loadBalanceLoss(skewed, flat, { topK: 1 })).toBeCloseTo(1, 12)
    // And pushing the two against each other reads as *better* than balanced,
    // which is what an over-corrected controller leaves behind.
    expect(loadBalanceLoss(skewed, [0.1, 0.7, 0.1, 0.1], { topK: 1 })).toBeLessThan(0.7)
  })

  it('pushes each expert away from its excess, and adds to nothing', () => {
    const load = [0.5, 0.2, 0.2, 0.1]
    const correction = routerCorrection(load, 0.1, 1)
    expect(correction.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 12)
    expect(correction[0]).toBeLessThan(0) // the busiest is discouraged
    expect(correction[3]).toBeGreaterThan(0) // the emptiest encouraged
    expect(correction[3]!).toBeGreaterThan(correction[2]!)
    // The gain scales the whole update and nothing else.
    const doubled = routerCorrection(load, 0.2, 1)
    correction.forEach((value, index) => expect(value * 2).toBeCloseTo(doubled[index]!, 12))
  })

  it('targets the fair share of the assignments, which is top-k over the experts', () => {
    expect(fairShare(8, 1)).toBeCloseTo(0.125, 12)
    expect(fairShare(8, 2)).toBeCloseTo(0.25, 12)
    // A top-2 router at capacity one has room for two assignments per token, so
    // a balanced load fills it exactly; read the factor per token and it drops
    // half of them for no reason at all.
    const balanced = capacityOverflow([1, 1], 1, { tokens: 100, topK: 2 })
    expect(balanced.droppedFraction).toBe(0)
    const perToken = capacityOverflow([1, 1], 1, { tokens: 100, topK: 2, perSlot: false })
    expect(perToken.droppedFraction).toBeCloseTo(0.5, 12)
  })
})

describe('the planted need the loss is in tension with', () => {
  it('follows the concentration it is given', () => {
    const spread = (ideals: number[]) => {
      const counts = new Map<number, number>()
      for (const expert of ideals) counts.set(expert, (counts.get(expert) ?? 0) + 1)
      const fractions = Array.from({ length: 8 }, (_, e) => (counts.get(e) ?? 0) / ideals.length)
      return Math.max(...fractions) / Math.min(...fractions.filter((f) => f > 0))
    }
    expect(spread(idealExperts(2000, 8, 0, 3))).toBeLessThan(2)
    expect(spread(idealExperts(2000, 8, 0.8, 3))).toBeGreaterThan(4)
  })

  it('is served exactly by a router with no bias', () => {
    const ideals = idealExperts(256, 8, 0.8, 3)
    const routing = routeByNeed(ideals, 8, [0, 0, 0, 0, 0, 0, 0, 0], 1)
    expect(routing.accuracy).toBe(1)
    expect(routing.load).toEqual(routing.idealLoad)
    expect(routing.maxLoad).toBeGreaterThan(fairShare(8, 1) * 2)
  })

  it('is given up when the bias prefers another expert', () => {
    const ideals = idealExperts(256, 8, 0.8, 3)
    const flat = [0, 0, 0, 0, 0, 0, 0, 0]
    const slight = [0, 0, 0, 0, 0, 0, 0, 1]
    const strong = [0, 0, 0, 0, 0, 0, 0, 4]
    // A bias of one is smaller than the gap between needing an expert and not
    // needing it, so the tokens keep their expert; a bias of four moves them
    // all, and the router serves the bias instead of the data.
    expect(routeByNeed(ideals, 8, flat, 1).accuracy).toBe(1)
    expect(routeByNeed(ideals, 8, slight, 1).accuracy).toBe(1)
    const withBias = routeByNeed(ideals, 8, strong, 1)
    expect(withBias.accuracy).toBeLessThan(0.1)
    expect(withBias.load[7]).toBeGreaterThan(fairShare(8, 1) * 0.9)
  })
})

describe('the controller the auxiliary loss is', () => {
  it('does nothing at all when its gain is zero', () => {
    const trained = trainLoadBalancer({ lambda: 0, steps: 12 })
    const first = trained.steps[0]!
    for (const step of trained.steps) {
      expect(step.balanceLoss).toBe(first.balanceLoss)
      expect(step.accuracy).toBe(first.accuracy)
      expect(step.droppedFraction).toBe(first.droppedFraction)
      expect(step.maxLoad).toBe(first.maxLoad)
    }
    expect(trained.oscillates).toBe(false)
    expect(trained.spike).toBe(0)
    expect(largestRise(lossCurve(trained.steps))).toBe(0)
  })

  it('moves the probabilities long before it moves the argmax', () => {
    const trained = trainLoadBalancer({ lambda: 0.05 })
    const first = trained.steps[0]!
    const last = trained.steps[trained.steps.length - 1]!
    expect(last.balanceLoss).toBeLessThan(first.balanceLoss)
    for (let i = 1; i < trained.steps.length; i++) {
      expect(trained.steps[i]!.balanceLoss).toBeLessThan(trained.steps[i - 1]!.balanceLoss)
    }
    // The hard routing has not changed by a single token: no load moved, no
    // expert changed hands, nothing was misrouted.
    expect(last.maxLoad).toBe(first.maxLoad)
    expect(last.minLoad).toBe(first.minLoad)
    expect(last.busiest).toBe(first.busiest)
    expect(last.accuracy).toBe(first.accuracy)
    expect(trained.oscillates).toBe(false)
    expect(trained.spike).toBe(0)
  })

  it('jumps the load all at once, and swings after the jump', () => {
    const settled = trainLoadBalancer({ lambda: 0.1 })
    const swinging = trainLoadBalancer({ lambda: 0.15 })
    expect(settled.oscillates).toBe(false)
    expect(swinging.oscillates).toBe(true)
    const first = swinging.steps[0]!
    const last = swinging.steps[swinging.steps.length - 1]!
    // The step that crosses the gap empties one expert and changes which expert
    // is the busiest — and the accuracy pays for it in the same step.
    expect(last.minLoad).toBeLessThan(first.minLoad)
    expect(last.busiest).not.toBe(first.busiest)
    expect(last.accuracy).toBeLessThan(first.accuracy)
    // The loss curve rises in places where the gentle controller's only ever
    // fell: one twentieth more gain and the spike is there.
    expect(largestRise(lossCurve(swinging.steps, { lambda: 0.15 }))).toBeGreaterThan(0.5)
    expect(largestRise(lossCurve(settled.steps, { lambda: 0.1 }))).toBe(0)
  })

  it('buys an imbalance worse than the one it set out to remove', () => {
    const overdriven = trainLoadBalancer({ lambda: 0.4 })
    const first = overdriven.steps[0]!
    const last = overdriven.steps[overdriven.steps.length - 1]!
    expect(overdriven.oscillates).toBe(true)
    expect(last.balanceLoss).toBeGreaterThan(first.balanceLoss)
    expect(last.accuracy).toBeLessThan(0.5)
    expect(last.droppedFraction).toBeGreaterThan(first.droppedFraction)
  })

  it('sweeps the gain from a router that works to one that hurts itself', () => {
    const sweep = lambdaSweep({ lambdas: [0, 0.05, 0.1, 0.2, 0.4] })
    expect(sweep[0]!.accuracy).toBe(1)
    expect(sweep[0]!.oscillates).toBe(false)
    expect(sweep[1]!.oscillates).toBe(false)
    expect(sweep[2]!.oscillates).toBe(false)
    for (const entry of sweep.slice(3)) expect(entry.oscillates).toBe(true)
    // The accuracy is never better than the router that follows the data.
    for (const entry of sweep) expect(entry.accuracy).toBeLessThanOrEqual(1)
    expect(sweep[4]!.accuracy).toBeLessThan(sweep[2]!.accuracy)
    expect(sweep[4]!.droppedFraction).toBeGreaterThan(sweep[0]!.droppedFraction)
  })
})

describe('top-1 against top-2 at the same capacity', () => {
  it('piles every token onto the busiest expert in its second slot', () => {
    const { top1, top2 } = routingInstability({ lambda: 0 })
    const first = top1.steps[0]!
    const second = top2.steps[0]!
    // The data alone gives the busiest expert a quarter of the tokens; the
    // second slot of a top-2 router gives it all of them.
    expect(second.maxLoad).toBeCloseTo(1, 6)
    expect(first.maxLoad).toBeLessThan(0.4)
    expect(second.droppedFraction).toBeGreaterThan(first.droppedFraction)
    expect(second.droppedFraction).toBeGreaterThan(0.4)
    expect(first.droppedFraction).toBeLessThan(0.25)
    // And neither of them loses a token that it needed: the second slot is
    // never the one the token wanted, so it is the one that overflows.
    expect(second.accuracy).toBe(1)
    expect(first.accuracy).toBe(1)
  })

  it('is less sensitive to the same gain, because a lost second slot costs less', () => {
    const { top1, top2 } = routingInstability({ lambda: 0.15 })
    const first = top1.steps[top1.steps.length - 1]!
    const second = top2.steps[top2.steps.length - 1]!
    expect(top1.oscillates).toBe(true)
    // The correction moves a top-2 router's load less for the same bias, so the
    // loop gain is lower: the coefficient that makes the top-1 curve spike
    // barely disturbs this one, and no token loses the expert it needed.
    expect(largestRise(lossCurve(top2.steps, { lambda: 0.15 }))).toBeLessThan(
      largestRise(lossCurve(top1.steps, { lambda: 0.15 })),
    )
    expect(second.accuracy).toBe(1)
    expect(first.accuracy).toBeLessThan(1)
  })
})

describe('the loss curve the run implies', () => {
  it('adds the three terms it says it adds', () => {
    const curve = lossCurve([
      { step: 0, auxiliaryLoss: 8, balanceLoss: 1, maxLoad: 0.125, minLoad: 0.125, spread: 0, droppedFraction: 0, accuracy: 1, busiest: 0 },
      { step: 1, auxiliaryLoss: 8, balanceLoss: 2, maxLoad: 0.25, minLoad: 0, spread: 0.25, droppedFraction: 0.25, accuracy: 0.5, busiest: 3 },
    ], { lambda: 0.1, penaltyPerMisroutedToken: 3, penaltyPerDroppedToken: 4 })
    expect(curve[0]!.loss).toBe(0) // balanced, nothing dropped, nothing misrouted
    expect(curve[1]!.misroutePenalty).toBeCloseTo(1.5, 12)
    expect(curve[1]!.dropPenalty).toBeCloseTo(1, 12)
    expect(curve[1]!.balancePenalty).toBeCloseTo(0.1, 12)
    expect(curve[1]!.loss).toBeCloseTo(2.6, 12)
  })

  it('finds the spike as the largest rise between neighbouring steps', () => {
    const trained = trainLoadBalancer({ lambda: 0.4 })
    const curve = lossCurve(trained.steps, { lambda: 0.4 })
    expect(largestRise(curve)).toBeGreaterThan(1)
    let worst = 0
    for (let i = 1; i < curve.length; i++) {
      worst = Math.max(worst, curve[i]!.loss - curve[i - 1]!.loss)
    }
    expect(largestRise(curve)).toBeCloseTo(worst, 12)
    // A curve that only ever falls has no spike, however big it gets.
    expect(largestRise(curve.map((point) => ({ ...point, loss: -point.step })))).toBe(0)
  })
})

/**
 * The delay, measured and predicted.
 *
 * These two are the screen's most specific claim: that the silence before the
 * jump has a closed form, and that it is the *bias* that moves during it rather
 * than the decision. The settings are the screen's own defaults, so the table a
 * reader compares against is the one this test checks.
 */
describe('the dead zone in the argmax', () => {
  const settings = { tokens: 200, experts: 8, concentration: 0.8, capacityFactor: 1.25, seed: 4 }

  it('is the reciprocal of the gain times the spread, at top-1', () => {
    const initial = trainLoadBalancer({ ...settings, topK: 1, lambda: 0.1, steps: 1 })
    const first = initial.steps[0]!
    const spread = first.maxLoad - first.minLoad
    for (const lambda of [0.05, 0.1, 0.15, 0.2, 0.3]) {
      const predicted = deadZoneSteps(spread, lambda)
      const measured = firstMovedStep({ ...settings, topK: 1, lambda, steps: 160 })
      expect(measured, `nothing moved at λ = ${lambda} within 160 steps`).not.toBeNull()
      // One step, not a proportion: the prediction counts the bias crossing the
      // gap and the run notices on the step after it happens.
      expect(Math.abs((measured ?? 0) - predicted), `λ = ${lambda}`).toBeLessThanOrEqual(1)
    }
  })

  it('is never reached when there is nothing to correct', () => {
    expect(deadZoneSteps(0, 0.1)).toBe(Number.POSITIVE_INFINITY)
    expect(deadZoneSteps(0.2, 0)).toBe(Number.POSITIVE_INFINITY)
    expect(firstMovedStep({ ...settings, topK: 1, lambda: 0, steps: 40 })).toBeNull()
  })

  it('shortens as the gain or the imbalance grows', () => {
    expect(deadZoneSteps(0.2, 0.1)).toBeGreaterThan(deadZoneSteps(0.4, 0.1))
    expect(deadZoneSteps(0.2, 0.1)).toBeGreaterThan(deadZoneSteps(0.2, 0.4))
    expect(deadZoneSteps(0.2, 0.1)).toBeCloseTo(50, 12)
  })

  it('is a top-1 statement, because a second slot only needs the largest bias', () => {
    // The same gain at top-2 changes which expert holds the other slot on the
    // very first step: the gap the bias has to cross is between two *biases*,
    // not between needing an expert and not needing it.
    expect(firstMovedStep({ ...settings, topK: 2, lambda: 0.05, steps: 20 })).toBe(1)
    expect(firstMovedStep({ ...settings, topK: 2, lambda: 0.3, steps: 20 })).toBe(1)
    expect(firstMovedStep({ ...settings, topK: 2, lambda: 0, steps: 20 })).toBeNull()
  })
})
