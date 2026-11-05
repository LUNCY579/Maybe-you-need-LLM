/**
 * Speculative decoding — the draft-and-verify arm of Laboratory E.
 *
 * Autoregressive decoding produces one token per serial pass of the model,
 * and decode is memory-bandwidth-bound: each step moves the whole cache
 * through the processor to compute a single token. Leviathan, Kalman and
 * Matias (2023, arXiv:2211.17192, ICML 2023) add a small, cheap *draft*
 * model in front of the target. The draft proposes k tokens; the target
 * scores the k+1 positions in one parallel pass; each drafted token is
 * accepted with probability min(1, p(x)/q(x)); on the first rejection the
 * sampler draws from the residual norm(max(0, p − q)) and stops; if every
 * draft is accepted the target contributes one bonus token. The output
 * distribution is exactly p — the verification is rejection sampling, not
 * an approximation.
 *
 * What this module computes is the arithmetic of that scheme, exactly:
 *
 *  - `acceptanceRate` — α = Σ_x min(p(x), q(x)) = 1 − TV(p, q), the
 *    probability a drafted token is accepted, per position, under the iid
 *    model. This equality is the paper's own identity.
 *  - `expectedTokens` — E = (1 − α^(k+1)) / (1 − α), the expected number of
 *    tokens emitted per verification pass (accepted drafts plus one).
 *  - `speedup` — E / (1 + c·k), with c the draft's cost relative to one
 *    target pass and the parallel target pass counted as 1 however many
 *    positions it scores.
 *
 * Everything here is a closed-form calculation on two distributions. The
 * toy setup derives the "draft" from the target's own logits — a
 * temperature-and-noise perturbation, not a smaller model — and the screen
 * says so. No wall-clock figure is produced or implied; the paper's
 * reported speedups are quoted there as quoted.
 */

import { softmax } from './math'

/** The six-token toy vocabulary the screen shows. */
export const TOY_VOCAB = ['the', 'of', 'model', 'tokens', 'larger', 'mars'] as const

/** The target model's logits over the toy vocabulary — fixed, so the laboratory is deterministic. */
export const TARGET_LOGITS = [2.3, 1.8, 1.2, 0.5, -0.4, -1.3] as const

/**
 * A fixed perturbation direction used to make the toy draft imperfect in a
 * controlled way. Scaled by `draftNoise` in the setup; with the default it
 * moves the draft's preferences measurably off the target's without erasing
 * the shared peak.
 */
export const DRAFT_PERTURBATION = [0.7, -1.3, 1.1, 0.3, -0.8, 1.6] as const

export interface SpeculativeSetup {
  /** Temperature applied to the target's logits. */
  readonly targetTemp: number
  /** Temperature applied to the draft's (perturbed) logits. */
  readonly draftTemp: number
  /** How far the draft's logits are pushed from the target's, in logits of perturbation. */
  readonly draftNoise: number
  /** How many tokens the draft proposes per verification pass. */
  readonly draftLength: number
  /** The draft's cost relative to one target pass (a smaller model is typically 0.05–0.3). */
  readonly draftCost: number
}

export const DEFAULT_SPECULATIVE: SpeculativeSetup = {
  targetTemp: 1,
  draftTemp: 1.4,
  draftNoise: 0.9,
  draftLength: 4,
  draftCost: 0.15,
}

/** The target distribution over the toy vocabulary. */
export function targetDistribution(setup: SpeculativeSetup): number[] {
  return softmax([...TARGET_LOGITS], Math.max(setup.targetTemp, 0.05))
}

/** The draft distribution: the target's preferences, perturbed and re-tempered. */
export function draftDistribution(setup: SpeculativeSetup): number[] {
  const perturbed = TARGET_LOGITS.map((logit, index) => logit + setup.draftNoise * DRAFT_PERTURBATION[index])
  return softmax(perturbed, Math.max(setup.draftTemp, 0.05))
}

/** Total variation distance, ½ Σ |p − q|. */
export function totalVariation(p: readonly number[], q: readonly number[]): number {
  let sum = 0
  for (let index = 0; index < p.length; index += 1) sum += Math.abs(p[index] - q[index])
  return sum / 2
}

/**
 * The exact acceptance probability of one drafted token:
 * α = Σ_x min(p(x), q(x)) = 1 − TV(p, q).
 */
export function acceptanceRate(p: readonly number[], q: readonly number[]): number {
  let admitted = 0
  for (let index = 0; index < p.length; index += 1) admitted += Math.min(p[index], q[index])
  return admitted
}

/**
 * The distribution the rejection step resamples from: the residual mass
 * the draft failed to cover, renormalised. If every draft is accepted there
 * is no residual; if the residual is empty on a rejection, the token comes
 * from the bonus position instead and the arithmetic is unaffected.
 */
export function residualDistribution(p: readonly number[], q: readonly number[]): number[] {
  const residual = p.map((value, index) => Math.max(0, value - q[index]))
  const sum = residual.reduce((total, value) => total + value, 0)
  if (sum <= 0) return p.map(() => 0)
  return residual.map((value) => value / sum)
}

/**
 * Expected tokens emitted per verification pass:
 * E = (1 − α^(k+1)) / (1 − α), with E = k + 1 at α = 1.
 *
 * Derivation: the number of accepted drafts is a truncated geometric
 * variable — P(≥ j accepted) = α^j for j ≤ k — so the expected number of
 * accepted tokens is Σ_{j=1..k} α^j, and the pass always contributes one
 * more (the resampled token on rejection, or the bonus token when all k
 * pass).
 */
export function expectedTokens(alpha: number, draftLength: number): number {
  const k = Math.max(1, Math.floor(draftLength))
  if (alpha >= 1) return k + 1
  if (alpha <= 0) return 1
  return (1 - Math.pow(alpha, k + 1)) / (1 - alpha)
}

/**
 * Cost per verification pass in target-pass units: one parallel pass
 * (counted as 1 however many positions it scores) plus k draft passes at
 * relative cost c each.
 */
export function iterationCost(draftLength: number, draftCost: number): number {
  const k = Math.max(1, Math.floor(draftLength))
  return 1 + k * Math.max(draftCost, 0)
}

/**
 * Speedup over plain autoregressive decoding: tokens per verification pass
 * divided by the pass's cost. Values below 1 mean the draft is not paying
 * for itself under this cost model.
 */
export function speedup(alpha: number, draftLength: number, draftCost: number): number {
  return expectedTokens(alpha, draftLength) / iterationCost(draftLength, draftCost)
}

/**
 * The k in [1, maxK] that maximises the speedup; the first one wins ties.
 * With a free draft the optimum grows without bound, and with an expensive
 * draft it collapses to 1 — the interesting regime is in between.
 */
export function bestDraftLength(alpha: number, draftCost: number, maxK = 12): number {
  let best = 1
  let bestSpeedup = speedup(alpha, 1, draftCost)
  for (let k = 2; k <= maxK; k += 1) {
    const value = speedup(alpha, k, draftCost)
    if (value > bestSpeedup) {
      bestSpeedup = value
      best = k
    }
  }
  return best
}

export interface DraftLengthRow {
  readonly k: number
  readonly expected: number
  readonly cost: number
  readonly speedup: number
}

export interface SpeculativeReport {
  readonly setup: SpeculativeSetup
  readonly target: readonly number[]
  readonly draft: readonly number[]
  /** α = Σ min(p, q); also the sum of the admitted column on screen. */
  readonly alpha: number
  readonly variation: number
  readonly residual: readonly number[]
  readonly rows: readonly DraftLengthRow[]
  readonly bestK: number
  readonly bestSpeedup: number
}

/** Everything the screen prints, computed in one pass from the setup. */
export function speculativeReport(setup: SpeculativeSetup): SpeculativeReport {
  const target = targetDistribution(setup)
  const draft = draftDistribution(setup)
  const alpha = acceptanceRate(target, draft)
  const maxK = 12
  const rows: DraftLengthRow[] = Array.from({ length: maxK }, (_, index) => {
    const k = index + 1
    return { k, expected: expectedTokens(alpha, k), cost: iterationCost(k, setup.draftCost), speedup: speedup(alpha, k, setup.draftCost) }
  })
  const bestK = bestDraftLength(alpha, setup.draftCost, maxK)
  return {
    setup,
    target,
    draft,
    alpha,
    variation: totalVariation(target, draft),
    residual: residualDistribution(target, draft),
    rows,
    bestK,
    bestSpeedup: speedup(alpha, bestK, setup.draftCost),
  }
}
