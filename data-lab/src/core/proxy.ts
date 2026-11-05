/**
 * The proxy-model step, and what it is allowed to claim.
 *
 * DoReMi's argument has two parts, and only the first one is the expensive one.
 * A small *proxy* model is trained with group DRO over the domain mixture, which
 * produces domain weights that equalise the per-domain excess loss; those weights
 * are then reused to train a model orders of magnitude larger. The whole method
 * rests on the second step transferring: that a 280M model's opinion about the
 * value of a domain is a good enough guide for an 8B model. The paper's evidence
 * is a *ranking* — the mixtures the proxy prefers are the mixtures the big model
 * prefers — not a claim that the two loss numbers agree.
 *
 * This module reproduces both halves at toy scale:
 *
 * - `extrapolateWeights` is the stated arithmetic of the handover. The proxy
 *   weights are not simply reused; a chosen target domain is pinned at a fixed
 *   weight and what is left is redistributed in the proxy's proportions. That is
 *   a pure function with an exact answer, and it is checked as one.
 * - `proxyTransfer` runs the proxy (a few gradient steps on a small draw), then
 *   runs the big model on the same candidate mixtures, and reports the agreement
 *   between the two rankings by Spearman's rho alongside the worst-domain loss
 *   each mixture gives each arm.
 *
 * The transfer claim is measured, not assumed: the function returns whatever
 * correlation it finds, and the test beside it asserts only what the measurement
 * supports. Here the proxy is a linear softmax classifier trained for fewer steps
 * on fewer documents, so "the big model" means more compute rather than more
 * parameters — the weakest part of this laboratory, and labelled as such on
 * screen.
 *
 * What the measurement gives at this scale is no support for the transfer. Two
 * seeds give Spearman's rho of 1.000 and 0.200 between the arms' rankings of the
 * four candidate mixtures, and the proxy's group-DRO weights beat the natural
 * mixture on worst-domain loss at one seed (+0.0566) and lose at the other
 * (−0.0100). The extrapolated mixture is the *worst* of the four in both arms at
 * both seeds, which is the arithmetic of pinning rather than a bug: holding one
 * domain at 0.7 leaves 0.3 to share between four, and the worst domain in this
 * corpus is not the pinned one. DoReMi's extrapolation is stated here as the
 * mechanism it is, and its effect is reported as the toy scale shows it.
 */

import { DOMAINS, type Corpus } from './corpus'
import { compareMixtures, groupDroMixture, naturalMixture } from './mixture'
import { splitCorpus } from './filters'
import type { TrainingOptions } from './model'

/** The domain the extrapolation step pins by default: the smallest of the five. */
const DOMAIN_TARGET = DOMAINS.indexOf('reference')

/**
 * The handover from proxy to final mixture.
 *
 * `targetDomain` is pinned at `targetWeight`, and the remaining mass is split
 * between the other domains in the proxy's proportions, so the proxy's ordering
 * of the non-target domains survives the handover exactly.
 */
export function extrapolateWeights(proxyWeights: number[], targetDomain: number, targetWeight: number): number[] {
  if (targetDomain < 0 || targetDomain >= proxyWeights.length) {
    throw new RangeError(`no such domain ${targetDomain}`)
  }
  const rest = 1 - targetWeight
  const remaining = proxyWeights.reduce((sum, weight, index) => (index === targetDomain ? sum : sum + weight), 0)
  return proxyWeights.map((weight, index) => {
    if (index === targetDomain) return targetWeight
    if (remaining <= 0) return rest / Math.max(1, proxyWeights.length - 1)
    return (rest * weight) / remaining
  })
}

export interface TransferRow {
  name: string
  weights: number[]
  /** The worst domain's loss under the proxy arm. */
  proxyWorstLoss: number
  /** The worst domain's loss under the arm trained longer and on more data. */
  bigWorstLoss: number
  proxyMeanLoss: number
  bigMeanLoss: number
}

export interface ProxyTransferResult {
  rows: TransferRow[]
  /** The weights the proxy's group DRO found. */
  proxyWeights: number[]
  naturalWeights: number[]
  /** The proxy weights after the extrapolation step, pinned on `targetDomain`. */
  extrapolatedWeights: number[]
  targetDomain: number
  targetWeight: number
  /** Spearman's rho between the two arms' ranking of the candidate mixtures by worst loss. */
  rankCorrelation: number
  /** The natural mixture's big-arm worst loss minus the proxy weights' — positive means the proxy helped. */
  worstLossGain: number
  /** The same difference for the extrapolated mixture. */
  extrapolatedWorstLossGain: number
  proxySteps: number
  bigSteps: number
}

export interface ProxyTransferOptions {
  /** Gradient steps for the proxy arm. */
  proxySteps?: number
  /** Gradient steps for the big arm. */
  bigSteps?: number
  /** Documents drawn for each arm. */
  proxySampleSize?: number
  bigSampleSize?: number
  /** The domain the extrapolation step pins. */
  targetDomain?: number
  /** The weight the extrapolation step gives it. */
  targetWeight?: number
  /** The group-DRO strength used to find the proxy weights. */
  eta?: number
  rounds?: number
  seed?: number
}

/** Rank a list of numbers, ties averaged — the input Spearman needs. */
function ranks(values: number[]): number[] {
  const order = values.map((value, index) => ({ value, index })).sort((a, b) => a.value - b.value)
  const out = new Array<number>(values.length)
  let i = 0
  while (i < order.length) {
    let j = i
    while (j + 1 < order.length && order[j + 1]!.value === order[i]!.value) j++
    const average = (i + j + 2) / 2
    for (let k = i; k <= j; k++) out[order[k]!.index] = average
    i = j + 1
  }
  return out
}

/** Spearman's rho: the Pearson correlation of the two rank vectors. */
export function spearman(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length < 2) return 0
  const ra = ranks(a)
  const rb = ranks(b)
  const meanA = ra.reduce((x, y) => x + y, 0) / ra.length
  const meanB = rb.reduce((x, y) => x + y, 0) / rb.length
  let covariance = 0
  let varianceA = 0
  let varianceB = 0
  for (let i = 0; i < ra.length; i++) {
    const da = (ra[i] ?? 0) - meanA
    const db = (rb[i] ?? 0) - meanB
    covariance += da * db
    varianceA += da * da
    varianceB += db * db
  }
  const denominator = Math.sqrt(varianceA * varianceB)
  return denominator === 0 ? 0 : covariance / denominator
}

/**
 * Find the mixture with a proxy, then check what the bigger model says about it.
 *
 * The candidate list is the same for both arms — the natural mixture, the proxy's
 * group-DRO weights, those weights after extrapolation, and the uniform mixture —
 * so the comparison is between mixtures and nothing else. Both arms are scored on
 * the same held-out documents, which `compareMixtures` splits deterministically.
 */
export function proxyTransfer(corpus: Corpus, options: ProxyTransferOptions = {}): ProxyTransferResult {
  const settings: Required<ProxyTransferOptions> = {
    proxySteps: 40,
    bigSteps: 400,
    proxySampleSize: 160,
    bigSampleSize: 400,
    targetDomain: DOMAIN_TARGET,
    targetWeight: 0.7,
    eta: 1.0,
    rounds: 6,
    seed: 7,
    ...options,
  }

  const natural = naturalMixture(splitCorpus(corpus, 0.3).train)
  const dro = groupDroMixture(corpus, {
    eta: settings.eta,
    rounds: settings.rounds,
    sampleSize: settings.proxySampleSize,
    seed: settings.seed,
    training: { steps: settings.proxySteps, learningRate: 0.5 } satisfies TrainingOptions,
  })
  const proxyWeights = dro.weights
  const extrapolated = extrapolateWeights(proxyWeights, settings.targetDomain, settings.targetWeight)

  const candidates = [
    { name: 'the natural mixture', weights: natural },
    { name: 'the proxy’s group-DRO weights', weights: proxyWeights },
    { name: 'extrapolated from the proxy', weights: extrapolated },
    { name: 'the uniform mixture', weights: DOMAINS.map(() => 1 / DOMAINS.length) },
  ]

  const proxy = compareMixtures(corpus, candidates, {
    sampleSize: settings.proxySampleSize,
    seed: settings.seed,
    training: { steps: settings.proxySteps, learningRate: 0.5 },
  })
  const big = compareMixtures(corpus, candidates, {
    sampleSize: settings.bigSampleSize,
    seed: settings.seed,
    training: { steps: settings.bigSteps, learningRate: 0.5 },
  })

  const rows: TransferRow[] = candidates.map((candidate, index) => ({
    name: candidate.name,
    weights: candidate.weights,
    proxyWorstLoss: proxy[index]!.worstLoss,
    bigWorstLoss: big[index]!.worstLoss,
    proxyMeanLoss: proxy[index]!.meanLoss,
    bigMeanLoss: big[index]!.meanLoss,
  }))

  return {
    rows,
    proxyWeights,
    naturalWeights: natural,
    extrapolatedWeights: extrapolated,
    targetDomain: settings.targetDomain,
    targetWeight: settings.targetWeight,
    rankCorrelation: spearman(rows.map((row) => row.proxyWorstLoss), rows.map((row) => row.bigWorstLoss)),
    worstLossGain: rows[0]!.bigWorstLoss - rows[1]!.bigWorstLoss,
    extrapolatedWorstLossGain: rows[0]!.bigWorstLoss - rows[2]!.bigWorstLoss,
    proxySteps: settings.proxySteps,
    bigSteps: settings.bigSteps,
  }
}
