import { describe, expect, it } from 'vitest'
import { buildCorpus, DOMAINS } from './corpus'
import { splitCorpus } from './filters'
import {
  compareMixtures,
  drawMixture,
  excessLosses,
  fitPerDomainModels,
  groupDroMixture,
  mixtureWith,
  naturalMixture,
  solveOptimalMixture,
} from './mixture'

/**
 * Group-DRO as a data-mixture objective.
 *
 * DoReMi's first half: hold a set of domain weights, train a model, raise each
 * domain's weight in proportion to how badly its group is doing, renormalise,
 * repeat. The promise is that the weights come to *equalise the excess loss*,
 * and that a mixture chosen this way beats the natural mixture on the domain
 * that was doing worst — without much cost to the average.
 *
 * The four things below are checked separately, because the paper's argument
 * needs all of them and this laboratory only has some of them:
 *
 * - the update is what it says it is (with `eta = 0` the mixture must not move);
 * - the worst held-out domain's loss does fall, and the mean does not;
 * - the per-round curve is not a monotone descent, because every round retrains
 *   a fresh model on a fresh draw;
 * - the closed-form solver in `solveOptimalMixture` assumes each domain's loss
 *   *rises* with its weight, and three of the five domains here do not.
 *
 * Every number is measured on the seed-17, 400-document corpus with the default
 * settings, so all of it is reproducible but none of it is a claim about DoReMi's
 * own numbers: the proxy here is a 48-feature linear softmax, not a 280M
 * transformer, and the domains are five synthetic token distributions.
 */

const corpus = buildCorpus({ seed: 17, size: 400 })
const train = splitCorpus(corpus, 0.3).train
const natural = naturalMixture(train)

const dro = groupDroMixture(corpus)
const etaZero = groupDroMixture(corpus, { eta: 0 })
const etaFour = groupDroMixture(corpus, { eta: 4 })

const models = fitPerDomainModels(corpus)
const solved = solveOptimalMixture(models)

const comparison = compareMixtures(corpus, [
  { name: 'the natural mixture', weights: natural },
  { name: 'the group-DRO weights', weights: dro.weights },
  { name: 'the uniform mixture', weights: mixtureWith(0, 1 / DOMAINS.length) },
  { name: 'the solved mixture', weights: solved.weights },
])
const [naturalRow, droRow, uniformRow, solvedRow] = comparison as [
  (typeof comparison)[0],
  (typeof comparison)[0],
  (typeof comparison)[0],
  (typeof comparison)[0],
]

const r4 = (values: number[]) => values.map((value) => Number(value.toFixed(4)))
const spread = (values: number[]) => Math.max(...values) - Math.min(...values)
/** The spread of the numbers as the table shows them, so the arithmetic is checkable. */
const spread4 = (values: number[]) => Number(spread(r4(values)).toFixed(4))
/** A difference of the numbers as the table shows them, rounded the same way. */
const delta4 = (from: number, to: number) => Number((r4([from])[0]! - r4([to])[0]!).toFixed(4))

describe('Group-DRO as a data-mixture objective', () => {
  it('does not move the mixture at all when the exponent is zero', () => {
    // eta = 0 multiplies every weight by exp(0) and renormalises, which must be
    // the identity — the test the update has to pass before anything else means
    expect(r4(etaZero.weights)).toEqual(r4(natural))
    expect(r4(dro.weights)).toEqual([0.1339, 0.1705, 0.2091, 0.2881, 0.1984])
    expect(dro.weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12)
    // the corpus is *nearly* but not exactly balanced: 280 train documents over
    // five domains, so the natural mixture is not the uniform one
    expect(natural).not.toEqual(mixtureWith(0, 1 / DOMAINS.length))
    expect(r4(natural)).toEqual([0.1964, 0.1964, 0.2071, 0.2179, 0.1821])
  })

  it('lowers the worst held-out domain and leaves the mean where it was', () => {
    // the domain that was worst under the natural mixture is the one the mixture
    // is being asked to rescue
    expect(naturalRow.perDomainLoss.indexOf(Math.max(...naturalRow.perDomainLoss))).toBe(4)
    expect(DOMAINS[4]).toBe('reference')
    expect(r4(naturalRow.perDomainLoss)).toEqual([0.3004, 0.4117, 0.2845, 0.4512, 0.5605])
    expect(r4(droRow.perDomainLoss)).toEqual([0.2881, 0.4631, 0.2934, 0.4422, 0.5046])
    // the gain on the worst domain is 0.0559, on the mean 0.0033: seventeen times
    // the size of the average effect, which is what group DRO is for
    expect(droRow.worstLoss).toBeLessThan(naturalRow.worstLoss)
    expect(delta4(naturalRow.worstLoss, droRow.worstLoss)).toBe(0.0559)
    expect(delta4(naturalRow.meanLoss, droRow.meanLoss)).toBe(0.0033)
    // ...and it is not free: the same reweighting costs overall accuracy
    expect(droRow.accuracy).toBeLessThan(naturalRow.accuracy)
    expect(r4([naturalRow.accuracy, droRow.accuracy, uniformRow.accuracy, solvedRow.accuracy])).toEqual([
      0.875, 0.8583, 0.8583, 0.8583,
    ])
    // the uniform mixture is worse on the worst domain than the natural one, so
    // the gain above is not simply "flatter weights are better"
    expect(uniformRow.worstLoss).toBeGreaterThan(naturalRow.worstLoss)
    expect(r4([naturalRow.worstLoss, droRow.worstLoss, uniformRow.worstLoss, solvedRow.worstLoss])).toEqual([
      0.5605, 0.5046, 0.5831, 0.5171,
    ])
  })

  it('rescues the worst domain and takes the weight from two others', () => {
    // books loses the most weight, 0.1964 -> 0.1339, and its held-out loss falls
    // a little rather than rising, because it was never the binding constraint
    expect(delta4(natural[0]!, dro.weights[0]!)).toBe(0.0625)
    expect(droRow.perDomainLoss[0]!).toBeLessThan(naturalRow.perDomainLoss[0]!)
    // news also loses weight, and its loss does rise
    expect(delta4(natural[1]!, dro.weights[1]!)).toBe(0.0259)
    expect(droRow.perDomainLoss[1]!).toBeGreaterThan(naturalRow.perDomainLoss[1]!)
    // the worst domain under the natural mixture is the one DoReMi is meant to
    // rescue; it gets 0.0163 more of the corpus and its loss falls 0.0559
    expect(delta4(dro.weights[4]!, natural[4]!)).toBe(0.0163)
    expect(delta4(naturalRow.perDomainLoss[4]!, droRow.perDomainLoss[4]!)).toBe(0.0559)
    // the domain that got the largest share of the corpus is not the one whose
    // loss the loop ended on: forum took 0.2881 and code still measured worst
    expect(dro.weights.indexOf(Math.max(...dro.weights))).toBe(3)
    expect(dro.groupLosses.indexOf(Math.max(...dro.groupLosses))).toBe(2)
  })

  it('does not trace a monotone descent, round by round', () => {
    expect(r4(dro.worstLossHistory)).toEqual([0.3351, 0.4419, 0.3267, 0.3352, 0.3258, 0.2995, 0.3274, 0.2672])
    expect(r4(dro.meanLossHistory)).toEqual([0.2713, 0.292, 0.2594, 0.2416, 0.2626, 0.213, 0.2768, 0.2342])
    // the last round is better than the first on both, which is the claim; the
    // three rises in between are not a contradiction, they are a fresh model and
    // a fresh draw of the same size every round, so round-to-round movement mixes
    // the mixture with sampling noise
    expect(dro.worstLossHistory[7]!).toBeLessThan(dro.worstLossHistory[0]!)
    expect(dro.meanLossHistory[7]!).toBeLessThan(dro.meanLossHistory[0]!)
    const rises = dro.worstLossHistory.filter((value, index) => index > 0 && value > dro.worstLossHistory[index - 1]!)
    expect(rises).toHaveLength(3)
    // and the worst-domain history is always at or above the mean history, by
    // construction: the max of a set is never below its average
    for (let i = 0; i < dro.worstLossHistory.length; i++) {
      expect(dro.worstLossHistory[i]!).toBeGreaterThanOrEqual(dro.meanLossHistory[i]!)
    }
  })

  it('equalises the losses at eta one and overshoots at eta four', () => {
    // the weights spread monotonically with the exponent, which is the mechanism
    expect([spread4(etaZero.weights), spread4(dro.weights), spread4(etaFour.weights)]).toEqual([0.0358, 0.1542, 0.4553])
    // the loss spread is smallest at the middle setting: feeding the worst group
    // more data helps until it stops being a guide and becomes a monopoly
    expect([spread4(etaZero.groupLosses), spread4(dro.groupLosses), spread4(etaFour.groupLosses)]).toEqual([
      0.1532, 0.0646, 0.2277,
    ])
    expect(spread(dro.groupLosses)).toBeLessThan(spread(etaZero.groupLosses))
    expect(spread(etaFour.groupLosses)).toBeGreaterThan(spread(etaZero.groupLosses))
    // at eta four, 47% of the corpus goes to one domain and 1.7% to another
    expect(r4(etaFour.weights)).toEqual([0.0165, 0.1349, 0.1593, 0.4718, 0.2175])
    expect(r4(etaFour.groupLosses)).toEqual([0.0502, 0.2497, 0.2614, 0.2779, 0.2271])
    // the domain it starved is the one whose loss fell hardest, which is exactly
    // the failure the extrapolation step is supposed to protect against
    expect(etaFour.groupLosses[0]!).toBeLessThan(etaZero.groupLosses[0]!)
  })

  it('shows the closed-form solver trusting slopes that are not there', () => {
    // the linear model L_d(w) = a_d w + b_d, fitted from three mixtures per domain
    expect(models.map((model) => Number(model.a.toFixed(4)))).toEqual([0.1325, -0.1766, -0.034, -0.182, 0.0183])
    expect(models.map((model) => Number(model.b.toFixed(4)))).toEqual([0.3161, 0.4668, 0.3294, 0.5451, 0.5882])
    // three of five slopes are negative: for those domains, more weight makes the
    // loss *smaller*, so the equalisation formula has no stationary point to find
    expect(models.filter((model) => model.a < 0)).toHaveLength(3)
    expect(r4(solved.weights)).toEqual([0.1005, 0, 0.8995, 0, 0])
    // it puts nine tenths of the corpus on `code`, the domain with the negative
    // slope, and divides by max(a, 1e-9) on the way there
    expect(DOMAINS[2]).toBe('code')
    expect(solved.worstLoss).toBeCloseTo(Math.max(...models.map((model) => model.b)), 6)
    // the prediction is 0.5882; the trained mixture measures 0.5171 on the same
    // held-out set. The solver's own objective is off by 0.071, and the mixture
    // is worse than the natural one on the mean and on the accuracy
    expect(r4(excessLosses(models, solved.weights))).toEqual([0.3294, 0.4668, 0.2989, 0.5451, 0.5882])
    expect(Number(solvedRow.worstLoss.toFixed(4))).toBe(0.5171)
    expect(solvedRow.meanLoss).toBeGreaterThan(naturalRow.meanLoss)
    expect(solvedRow.accuracy).toBeLessThan(naturalRow.accuracy)
    // and the two domains it actually funded are not equalised at all, which is
    // what the negative slope does to the formula
    const funded = excessLosses(models, solved.weights)
    expect(funded[0]! - funded[2]!).toBeGreaterThan(0.03)
  })

  it('draws the mixture it was given', () => {
    const onlyReference = drawMixture(train, [0, 0, 0, 0, 1], 50, 3)
    expect(onlyReference).toHaveLength(50)
    expect(new Set(onlyReference.map((document) => document.domain))).toEqual(new Set(['reference']))
    // the same seed gives the same draw, which is why every comparison here is a
    // comparison of mixtures and not of random streams
    expect(drawMixture(train, [0, 0, 0, 0, 1], 50, 3).map((document) => document.id)).toEqual(
      onlyReference.map((document) => document.id),
    )
    const counts = new Map<string, number>()
    for (const document of drawMixture(train, [0.5, 0.2, 0.1, 0.1, 0.1], 1000, 5)) {
      counts.set(document.domain, (counts.get(document.domain) ?? 0) + 1)
    }
    expect([...counts.values()].reduce((sum, value) => sum + value, 0)).toBe(1000)
    expect(counts.get('books')).toBe(527)
    expect(counts.get('books')!).toBeGreaterThan(counts.get('news')!)
    expect(counts.get('news')!).toBeGreaterThan(counts.get('reference')!)
  })

  it('defines mixtureWith as the arithmetic it claims', () => {
    expect(mixtureWith(2, 0.6)).toEqual([0.1, 0.1, 0.6, 0.1, 0.1])
    expect(mixtureWith(0, 0.2)).toEqual([0.2, 0.2, 0.2, 0.2, 0.2])
    expect(mixtureWith(4, 0)).toEqual([0.25, 0.25, 0.25, 0.25, 0])
    for (const weights of [mixtureWith(0, 0.9), mixtureWith(4, 0.01)]) {
      expect(weights).toHaveLength(DOMAINS.length)
      expect(weights.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 12)
    }
  })
})
