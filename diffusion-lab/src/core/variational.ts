/**
 * The variational bound.
 *
 * The training objective of a diffusion model is a bound on the negative log
 * likelihood, decomposed into a term per timestep (equation 5):
 *
 *   L = D_KL(q(x_T|x_0) ‖ p(x_T))
 *     + Σ_{t>1} D_KL(q(x_{t−1}|x_t,x_0) ‖ p_θ(x_{t−1}|x_t))
 *     − log p_θ(x_0|x_1)
 *
 * Every KL term compares two Gaussians, so it has a closed form. This module
 * implements that comparison, the per-term weights, and the simplification
 * that the paper actually trains with.
 */

import { clamp } from '@llm-materials/course-core'
import { posteriorMean, posteriorVariance } from './forward.js'
import { reverseStd } from './reverse.js'
import type { ReverseConfig } from './reverse.js'
import type { Schedule } from './schedules.js'

/**
 * The KL divergence between two univariate Gaussians, in nats.
 *
 * D_KL(N(m₁, s₁²) ‖ N(m₂, s₂²)) = ln(s₂/s₁) + (s₁² + (m₁−m₂)²) / (2 s₂²) − ½
 */
export function gaussianKl(
  mean1: number,
  std1: number,
  mean2: number,
  std2: number,
): number {
  const s1 = Math.max(1e-12, std1)
  const s2 = Math.max(1e-12, std2)
  return Math.log(s2 / s1) + (s1 * s1 + (mean1 - mean2) ** 2) / (2 * s2 * s2) - 0.5
}

/** The KL divergence between two diagonal Gaussians, summed over dimensions. */
export function diagonalGaussianKl(
  mean1: number[],
  std1: number,
  mean2: number[],
  std2: number,
): number {
  let total = 0
  for (let i = 0; i < mean1.length; i++) {
    total += gaussianKl(mean1[i], std1, mean2[i] ?? 0, std2)
  }
  return total
}

/**
 * The term L_{t−1} for a specific (x_t, x_0) pair and a specific prediction.
 *
 * The "posterior" is the true q(x_{t−1}|x_t,x_0); the "model" is the reverse
 * process mean the network produced, with the reverse-process variance.
 */
export function boundTerm(
  xT: number[],
  x0: number[],
  t: number,
  predictedMean: number[],
  config: ReverseConfig,
): number {
  const { schedule } = config
  const index = Math.min(schedule.steps - 1, Math.max(0, Math.round(t)))
  const trueMean = posteriorMean(xT, x0, index, schedule)
  const trueStd = Math.sqrt(posteriorVariance(index, schedule))
  const modelStd = reverseStd(index, schedule, config.variance)
  return diagonalGaussianKl(trueMean, trueStd, predictedMean, modelStd)
}

/**
 * The weight of the simplified objective relative to the true bound.
 *
 * Equation 12 gives the weighted term
 *
 *   β_t² / (2 σ_t² α_t (1 − ᾱ_t)) · ‖ε − ε_θ‖²
 *
 * and the simplified objective of equation 14 uses a weight of 1. The ratio
 * between them is what the paper means by "the simplified objective down-weights
 * loss terms corresponding to small t".
 */
export function simplifiedObjectiveRatio(t: number, config: ReverseConfig): number {
  const { schedule } = config
  const index = Math.min(schedule.steps - 1, Math.max(0, Math.round(t)))
  const beta = schedule.betas[index]
  const alpha = schedule.alphas[index]
  const alphaBar = schedule.alphaBars[index]
  const sigma = reverseStd(index, schedule, config.variance)
  const weight = beta ** 2 / (2 * sigma ** 2 * alpha * (1 - alphaBar))
  return weight
}

/**
 * The weight curve of the true bound, normalised so that its maximum is one.
 *
 * The simplified objective is this curve flattened to one.
 */
export function weightCurves(schedule: Schedule, config: ReverseConfig): {
  weighted: number[]
  simplified: number[]
  maxWeighted: number
} {
  const weighted = schedule.betas.map((_, t) => simplifiedObjectiveRatio(t, config))
  const maxWeighted = Math.max(...weighted)
  return {
    weighted: weighted.map((w) => w / maxWeighted),
    simplified: weighted.map(() => 1),
    maxWeighted,
  }
}

/**
 * The total bound, term by term, for a fixed pair of endpoints.
 *
 * This is the decomposition of equation 5, with the terminal term L_T
 * included. The terminal term is the KL between the forward marginal at T and
 * the standard normal prior, and it does not depend on θ at all when the
 * forward variances are fixed.
 */
export interface BoundDecomposition {
  /** The KL from the terminal marginal to the prior. */
  terminal: number
  /** One KL per step, indexed by t. */
  terms: number[]
  /** The sum of everything. */
  total: number
}

export function decomposeBound(
  x0: number[],
  xT: number[],
  predictedMeans: (number[] | null)[],
  config: ReverseConfig,
): BoundDecomposition {
  const { schedule } = config
  const terms: number[] = []
  let total = 0

  const alphaBar = schedule.alphaBars[schedule.steps - 1]
  const terminal = 0.5 * (alphaBar / Math.max(1e-12, 1 - alphaBar) + Math.log(Math.max(1e-12, 1 - alphaBar)) - 1)
  total += terminal

  for (let t = 1; t < schedule.steps; t++) {
    const predicted = predictedMeans[t - 1]
    if (!predicted) continue
    const term = boundTerm(xT, x0, t, predicted, config)
    terms.push(term)
    total += term
  }

  return { terminal, terms, total }
}

/**
 * The rate–distortion view of the bound.
 *
 * The bound's KL terms are the *rate* and the reconstruction error is the
 * *distortion*. The paper reports that the rate is 1.78 bits per dimension and
 * the distortion 1.97 bits per dimension for its best CIFAR-10 model; the
 * laboratory reports the same decomposition for its toy model.
 */
export function rateDistortionBits(gaussianKLDivergences: number[]): {
  rate: number
  perStep: number[]
} {
  const perStep = gaussianKLDivergences.map((kl) => kl / Math.log(2))
  const rate = perStep.reduce((a, b) => a + b, 0)
  return { rate, perStep }
}

/**
 * The distortion of the current clean-sample estimate, in bits per dimension.
 *
 * The paper defines distortion as ‖x_0 − x̂_0‖² / D in the 0–255 scale; the
 * laboratory uses the same shape on its own data scale.
 */
export function distortionBits(x0: number[], x0Estimate: number[], dimension: number): number {
  let squared = 0
  for (let i = 0; i < dimension; i++) {
    squared += (x0[i] - (x0Estimate[i] ?? 0)) ** 2
  }
  const mse = squared / Math.max(1, dimension)
  return 0.5 * Math.log2(Math.max(1e-12, mse)) + 0.5 * Math.log2(2 * Math.PI * Math.E)
}

/** The number of bits needed to encode a Gaussian at a given variance. */
export function gaussianRateBits(variance: number): number {
  return clamp(0.5 * Math.log2(Math.max(1e-12, 2 * Math.PI * Math.E * variance)), 0, 64)
}
