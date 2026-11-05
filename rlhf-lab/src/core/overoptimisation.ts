/**
 * Reward overoptimisation.
 *
 * The central finding of Gao, Schulman and Hilton (2022) is that optimising a
 * *proxy* reward model harder does not make the *true* reward better, and
 * eventually makes it worse. The paper's contribution is to measure how, and
 * to fit a functional form to the curve.
 *
 * This module builds a setting where the phenomenon is exact rather than
 * observed:
 *
 * - The response space is a finite grid.
 * - The **true** reward r*(x) is known — the *gold reward model*. Every number
 *   reported here is measured against it, which is what makes the phenomenon
 * *visible* rather than a matter of opinion.
 * - The **proxy** reward r_φ(x) = r*(x) + ε(x), where ε is a fixed, zero-mean
 *   draw with scale τ. It is fixed across the whole optimisation, which is the
 *   whole point: the reward model's error does not grow as you push harder.
 * - The **reference** policy is a softmax on the grid, generally *not* centred
 *   where the gold reward is best.
 * - The optimised policy is the exponential tilt of the reference by the proxy
 *   reward, which is exactly the maximiser of the proxy reward subject to a
 *   KL budget.
 *
 * The result is the classic curve: the proxy reward rises without bound while
 * the true reward rises, turns over, and falls. And the paper's two functional
 * forms can be fitted to it.
 */

import { createRng, softmax } from '@llm-materials/course-core'
import type { Rng, Vector } from '@llm-materials/course-core'

export interface RewardSetting {
  /** The grid of responses. */
  points: number[]
  /** Where the gold reward is best — not where the reference policy points. */
  peak: number
  /** The true reward at each point. */
  trueReward: number[]
  /** The proxy reward at each point: the true reward plus a fixed error. */
  proxyReward: number[]
  /** The reference policy over the points. */
  reference: number[]
  /** The standard deviation of the reward model's error. */
  errorScale: number
  /** The slope of the reward model's systematic error. */
  errorSlope: number
  /** The index of the best point under the true reward. */
  bestIndex: number
  /** The index of the best point under the proxy reward. */
  proxyBestIndex: number
  /** The seed the random part of the error was drawn from. */
  seed: number
}

/**
 * Build the setting.
 *
 * The grid is centred on zero and the true reward is a negative quadratic.
 *
 * The reward model's error is **fixed** — it does not grow as the policy is
 * pushed harder — and it has two parts: a systematic slope, which is what
 * moves the proxy's optimum away from the true one, and a small random
 * wiggle, which is what makes the failure look organic rather than tidy.
 *
 * The gold reward is a negative quadratic centred at `peak`, while the
 * reference policy is a softmax centred on zero. The starting model is
 * therefore *not* where the gold reward is best — which is the situation a
 * fine-tuning run is actually in, and the reason the true reward can rise
 * before it falls.
 *
 * The systematic part is what guarantees the fall. With a slope `a`, the
 * proxy's optimum sits at about `peak + a / 2`, where the gold reward is
 * `−(a/2)²`. Pushing all the way to the proxy's optimum is therefore *worse*
 * than stopping short of it — which is the whole of the overoptimisation
 * result, exactly rather than approximately.
 */
export function buildRewardSetting(
  pointCount = 61,
  spread = 6,
  errorScale = 0.35,
  errorSlope = 3,
  seed = 13,
  peak = 2.5,
): RewardSetting {
  const rng = createRng(seed)
  const points: number[] = []
  for (let i = 0; i < pointCount; i++) {
    points.push(-spread + (2 * spread * i) / (pointCount - 1))
  }

  const trueReward = points.map((x) => -((x - peak) * (x - peak)))
  const proxyReward = trueReward.map(
    (r, i) => r + errorSlope * points[i]! + gaussianError(rng, errorScale),
  )

  // A reference policy centred on zero, softened so that the KL budget can be
  // spent gradually.
  const reference = softmax(
    points.map((x) => -0.5 * (x * x) / 0.9),
  )

  const bestIndex = argmax(trueReward)
  const proxyBestIndex = argmax(proxyReward)

  return {
    points,
    peak,
    trueReward,
    proxyReward,
    reference,
    errorScale,
    errorSlope,
    bestIndex,
    proxyBestIndex,
    seed,
  }
}

function gaussianError(rng: Rng, scale: number): number {
  let u = 0
  let v = 0
  while (u === 0) u = rng()
  while (v === 0) v = rng()
  return scale * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function argmax(values: Vector): number {
  let best = 0
  for (let i = 1; i < values.length; i++) {
    if ((values[i] ?? 0) > (values[best] ?? 0)) best = i
  }
  return best
}

/**
 * The exponential tilt of the reference by the proxy reward.
 *
 * π_λ(i) ∝ π_ref(i) · exp(λ · r_φ(i))
 *
 * This is the maximiser of E_π[r_φ] − (1/λ)·KL(π ‖ π_ref), and therefore
 * the policy that reaches a given KL budget.
 */
export function tiltedPolicy(setting: RewardSetting, lambda: number): Vector {
  const logits = setting.reference.map((p, i) => Math.log(Math.max(p, 1e-300)) + lambda * setting.proxyReward[i]!)
  return softmax(logits)
}

/** The KL divergence from the reference to a policy. */
export function klFromReference(setting: RewardSetting, policy: Vector): number {
  let kl = 0
  for (let i = 0; i < policy.length; i++) {
    const p = policy[i] ?? 0
    if (p <= 0) continue
    kl += p * (Math.log(p) - Math.log(Math.max(setting.reference[i] ?? 0, 1e-300)))
  }
  return kl
}

/** The expected reward under a policy. */
export function expectedReward(policy: Vector, rewards: Vector): number {
  let total = 0
  for (let i = 0; i < policy.length; i++) {
    total += (policy[i] ?? 0) * (rewards[i] ?? 0)
  }
  return total
}

export interface OveroptimisationPoint {
  /** The multiplier on the proxy reward. */
  lambda: number
  /** The KL distance from the reference. */
  kl: number
  /** The expected proxy reward under the tilted policy. */
  proxy: number
  /** The expected true reward under the tilted policy. */
  trueReward: number
  /** The true reward, relative to the best possible. */
  regret: number
}

export interface OveroptimisationCurve {
  points: OveroptimisationPoint[]
  /** The λ at which the true reward is maximised. */
  bestLambda: number
  /** The KL distance at which the true reward is maximised. */
  bestKl: number
  /** The best true reward achieved. */
  bestTrueReward: number
}

/**
 * Sweep the tilt and trace both curves.
 *
 * The turning point — where the true reward is maximised — is the point at
 * which the optimisation has gone just far enough.
 */
export function sweepOveroptimisation(
  setting: RewardSetting,
  maxLambda = 0.6,
  steps = 120,
): OveroptimisationCurve {
  const points: OveroptimisationPoint[] = []
  const bestTrue = Math.max(...setting.trueReward)

  for (let i = 0; i <= steps; i++) {
    const lambda = (maxLambda * i) / steps
    const policy = tiltedPolicy(setting, lambda)
    const kl = klFromReference(setting, policy)
    const proxy = expectedReward(policy, setting.proxyReward)
    const trueReward = expectedReward(policy, setting.trueReward)
    points.push({ lambda, kl, proxy, trueReward, regret: bestTrue - trueReward })
  }

  const best = points.reduce((a, b) => (b.trueReward > a.trueReward ? b : a))
  return {
    points,
    bestLambda: best.lambda,
    bestKl: best.kl,
    bestTrueReward: best.trueReward,
  }
}

/* ------------------------------------------------------------ best-of-n */

export interface BestOfNPoint {
  /** How many samples were drawn. */
  n: number
  /** The mean true reward of the selected sample. */
  selectedTrueReward: number
  /** The mean proxy reward of the selected sample. */
  selectedProxyReward: number
  /** The mean self-information, −log π_ref, of the selected response. */
  selectedKl: number  /** The number of trials. */
  trials: number
}

/**
 * Best-of-n sampling, by Monte Carlo.
 *
 * Draw n responses from the reference policy, keep the one with the highest
 * *proxy* reward, and look at its *true* reward. The selection is biased
 * towards the points where the reward model happened to be generous, and
 * those points are not the ones with the highest true reward.
 *
 * This is the measurement; `bestOfNDistribution` is the same quantity with no
 * sampling error. The `selectedKl` here is the mean self-information of the
 * *selected response* — the divergence of the point mass on it — which grows
 * without bound as n grows and is not comparable to the distance a policy
 * travels. Use `bestOfNDistribution` for the comparison against reinforcement
 * learning.
 */
export function bestOfN(
  setting: RewardSetting,
  n: number,
  trials = 4000,
  seed = 29,
): BestOfNPoint {
  const rng = createRng(seed)
  let trueTotal = 0
  let proxyTotal = 0
  let klTotal = 0

  for (let t = 0; t < trials; t++) {
    let bestIndex = -1
    let bestProxy = -Infinity
    let selected = -1
    for (let s = 0; s < n; s++) {
      const index = sampleFrom(setting.reference, rng)
      const proxy = setting.proxyReward[index] ?? 0
      if (proxy > bestProxy) {
        bestProxy = proxy
        bestIndex = index
      }
    }
    selected = bestIndex
    trueTotal += setting.trueReward[selected] ?? 0
    proxyTotal += setting.proxyReward[selected] ?? 0

    // The KL of the point-mass policy that selected this response.
    const selectedProbs = setting.reference.map((_, i) => (i === selected ? 1 : 0))
    klTotal += klFromReference(setting, selectedProbs)
  }

  return {
    n,
    selectedTrueReward: trueTotal / trials,
    selectedProxyReward: proxyTotal / trials,
    selectedKl: klTotal / trials,
    trials,
  }
}

function sampleFrom(probs: Vector, rng: Rng): number {
  const u = rng()
  let cumulative = 0
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i] ?? 0
    if (u <= cumulative) return i
  }
  return probs.length - 1
}

/**
 * The distribution best-of-n actually induces, computed exactly.
 *
 * Selecting the highest-proxy sample out of n draws from the reference is a
 * policy, and like any policy it has a distribution over the grid and therefore
 * a KL distance from the reference. That is the only way the two methods can be
 * compared honestly: reinforcement learning is given a budget and best-of-n is
 * asked what the same budget costs it.
 *
 * The index i wins when every other draw is at or below it and the uniform
 * tie-break among the draws that landed exactly on i picks it. With s the mass
 * below i including itself, and q = π_i / s the chance that a draw inside that
 * set is i, the tie factor is E[1/(1+K)] for K a Binomial(n−1, q), which has the
 * closed form below. At n = 1 the factor is 1 and the set is empty, so the
 * induced law is the reference exactly.
 */
export function bestOfNDistribution(setting: RewardSetting, n: number): {
  policy: Vector
  kl: number
  trueReward: number
  proxyReward: number
} {
  const logWeights: number[] = []
  for (let i = 0; i < setting.points.length; i++) {
    const own = setting.reference[i] ?? 0
    if (own <= 0) {
      logWeights.push(-Infinity)
      continue
    }
    const proxy = setting.proxyReward[i] ?? 0
    let below = 0
    for (let j = 0; j < setting.points.length; j++) {
      if ((setting.proxyReward[j] ?? 0) <= proxy) below += setting.reference[j] ?? 0
    }
    const q = below > 0 ? own / below : 0
    const m = n - 1
    const tie = m === 0 ? 1 : q > 0 ? (1 - (1 - q) ** (m + 1)) / ((m + 1) * q) : 1
    // Kept in log space: below^(n-1) underflows to zero long before n reaches
    // the sizes this comparison uses.
    logWeights.push(Math.log(own) + m * Math.log(Math.max(below, 1e-300)) + Math.log(tie))
  }

  const top = Math.max(...logWeights)
  const weights = logWeights.map((w) => (Number.isFinite(w) ? Math.exp(w - top) : 0))
  const total = weights.reduce((a, b) => a + b, 0)
  const policy = weights.map((w) => (total > 0 ? w / total : 0))
  return {
    policy,
    kl: klFromReference(setting, policy),
    trueReward: expectedReward(policy, setting.trueReward),
    proxyReward: expectedReward(policy, setting.proxyReward),
  }
}

/**
 * The tilt that spends exactly the given KL budget.
 *
 * The distance travelled is monotone in λ, so a bisection finds the multiplier
 * the budget corresponds to. That is what makes the comparison a comparison: the
 * two methods are then asked for the same number of nats.
 *
 * The tilt saturates: as λ grows the policy collapses onto the point mass at the
 * proxy's best point, so the reachable distance has a ceiling of
 * −log π_ref(i*). A budget past that ceiling cannot be spent, and `reachable`
 * says so rather than silently returning the capped policy.
 */
export function policyForBudget(setting: RewardSetting, budget: number, maxLambda = 8): {
  policy: Vector
  lambda: number
  kl: number
  trueReward: number
  proxyReward: number
  reachable: boolean
  ceiling: number
} {
  const at = (lambda: number) => {
    const policy = tiltedPolicy(setting, lambda)
    return {
      policy,
      lambda,
      kl: klFromReference(setting, policy),
      trueReward: expectedReward(policy, setting.trueReward),
      proxyReward: expectedReward(policy, setting.proxyReward),
    }
  }
  const ceiling = -Math.log(Math.max(setting.reference[setting.proxyBestIndex] ?? 1e-300, 1e-300))
  const withFlag = (result: ReturnType<typeof at>) => ({
    ...result,
    reachable: budget <= ceiling + 1e-9,
    ceiling,
  })
  if (budget <= 0) return withFlag(at(0))
  let high = Math.max(maxLambda, 1e-6)
  let guard = 0
  while (at(high).kl < budget && guard < 60) {
    high *= 2
    guard += 1
  }
  let low = 0
  for (let step = 0; step < 60; step++) {
    const middle = (low + high) / 2
    if (at(middle).kl < budget) low = middle
    else high = middle
  }
  return withFlag(at((low + high) / 2))
}

/**
 * The two methods at the same distance.
 *
 * Best-of-n only takes integer sample sizes, so the budget is bracketed by the
 * two neighbouring n and the reward is interpolated between them linearly in the
 * KL. The bracket is reported rather than hidden.
 */
export function compareAtBudgets(
  setting: RewardSetting,
  budgets: number[],
  sizes = [1, 2, 4, 8, 16, 32, 64, 128, 256, 512, 1024, 2048, 4096],
): {
  budget: number
  rlTrueReward: number
  rlProxyReward: number
  rlKl: number
  reachable: boolean
  bonTrueReward: number
  bonProxyReward: number
  bonKl: number
  lowN: number
  highN: number
  bonKlLow: number
  bonKlHigh: number
}[] {
  const ladder = sizes.map((n) => ({ n, ...bestOfNDistribution(setting, n) }))
  return budgets.map((budget) => {
    const rl = policyForBudget(setting, budget)
    let low = ladder[0]!
    let high = ladder[ladder.length - 1]!
    for (let index = 1; index < ladder.length; index++) {
      if (ladder[index]!.kl >= budget) {
        low = ladder[index - 1]!
        high = ladder[index]!
        break
      }
      if (index === ladder.length - 1) {
        low = ladder[index - 1]!
        high = ladder[index]!
      }
    }
    const span = high.kl - low.kl
    const weight = span > 0 ? Math.min(1, Math.max(0, (budget - low.kl) / span)) : 0
    const mix = (a: number, b: number) => a + weight * (b - a)
    return {
      budget,
      rlTrueReward: rl.trueReward,
      rlProxyReward: rl.proxyReward,
      rlKl: rl.kl,
      reachable: rl.reachable,
      bonTrueReward: mix(low.trueReward, high.trueReward),
      bonProxyReward: mix(low.proxyReward, high.proxyReward),
      bonKl: low.kl + weight * span,
      lowN: low.n,
      highN: high.n,
      bonKlLow: low.kl,
      bonKlHigh: high.kl,
    }
  })
}

/**
 * The same setting with a reward model fitted on more data.
 *
 * Both parts of the error are estimated from preference pairs, so both shrink as
 * one over the square root of the count — the rate a least-squares fit gives a
 * slope with. `referenceData` fixes the calibration: the model built at that
 * count has the errors `buildRewardSetting` was given. Nothing else changes, so
 * the only difference between two settings is how much was spent on the judge.
 */
export function rewardModelAtData(setting: RewardSetting, data: number, referenceData = 100): RewardSetting {
  const shrink = Math.sqrt(referenceData / data)
  const spread = setting.points[setting.points.length - 1] ?? 6
  // The same seed draws the same wiggles over the same grid, so scaling the two
  // error terms leaves the shape of the error in place and only shrinks it.
  return buildRewardSetting(
    setting.points.length,
    spread,
    setting.errorScale * shrink,
    setting.errorSlope * shrink,
    setting.seed,
    setting.peak,
  )
}

/* --------------------------------------------------- the paper's fits */

/**
 * The functional form the paper fits to best-of-n.
 *
 * R_boN(d) = d · (α_boN − β_boN · d)
 */
export interface OveroptimisationFit {
  form: 'bon' | 'rl'
  alpha: number
  beta: number
  /** The R² of the fit. */
  r2: number
  /** The fitted values, in the order they were given. */
  fitted: number[]
}

/**
 * Fit R(d) = d(α − β d) to the given points by least squares.
 *
 * The model is linear in (α, β) once d is factored out, so the fit is an
 * ordinary least-squares problem.
 */
export function fitBestOfNForm(distances: number[], rewards: number[]): OveroptimisationFit {
  // rewards[i] ≈ α·d_i − β·d_i²
  const design: number[][] = distances.map((d) => [d, -d * d])
  const { coefficients } = leastSquares(design, rewards)
  const [alpha, beta] = coefficients
  const fitted = distances.map((d) => alpha * d - beta * d * d)
  return { form: 'bon', alpha, beta, r2: rSquared(rewards, fitted), fitted }
}

/**
 * Fit R(d) = d(α − β log d) to the given points by least squares.
 */
export function fitReinforcementLearningForm(distances: number[], rewards: number[]): OveroptimisationFit {
  // rewards[i] ≈ α·d_i − β·d_i·log(d_i)
  const design: number[][] = distances.map((d) => [d, -d * Math.log(Math.max(d, 1e-12))])
  const { coefficients } = leastSquares(design, rewards)
  const [alpha, beta] = coefficients
  const fitted = distances.map((d) => alpha * d - beta * d * Math.log(Math.max(d, 1e-12)))
  return { form: 'rl', alpha, beta, r2: rSquared(rewards, fitted), fitted }
}

interface LeastSquaresResult {
  coefficients: number[]
}

/** Ordinary least squares with an intercept, solved by normal equations. */
function leastSquares(design: number[][], response: number[]): LeastSquaresResult {
  const p = design[0]?.length ?? 0
  const xtx: number[][] = Array.from({ length: p }, () => new Array<number>(p).fill(0))
  const xty: number[] = new Array<number>(p).fill(0)

  for (let i = 0; i < design.length; i++) {
    const row = design[i]!
    for (let a = 0; a < p; a++) {
      xty[a] += row[a]! * response[i]!
      for (let b = 0; b < p; b++) xtx[a]![b]! += row[a]! * row[b]!
    }
  }

  // Solve the (p × p) system by Gaussian elimination with partial pivoting.
  const m = xtx.map((row, i) => [...row, xty[i]!])
  for (let col = 0; col < p; col++) {
    let pivot = col
    for (let row = col + 1; row < p; row++) {
      if (Math.abs(m[row]![col]!) > Math.abs(m[pivot]![col]!)) pivot = row
    }
    const tmp = m[pivot]!
    m[pivot] = m[col]!
    m[col] = tmp
    const diag = m[col]![col]!
    if (Math.abs(diag) < 1e-12) continue
    for (let k = col; k <= p; k++) m[col]![k]! /= diag
    for (let row = 0; row < p; row++) {
      if (row === col) continue
      const factor = m[row]![col]!
      for (let k = col; k <= p; k++) m[row]![k]! -= factor * m[col]![k]!
    }
  }

  return { coefficients: m.map((row) => row[p]!) }
}

function rSquared(observed: number[], predicted: number[]): number {
  const mean = observed.reduce((a, b) => a + b, 0) / observed.length
  const ssTot = observed.reduce((acc, v) => acc + (v - mean) ** 2, 0)
  const ssRes = observed.reduce((acc, v, i) => acc + (v - (predicted[i] ?? 0)) ** 2, 0)
  return ssTot <= 0 ? 0 : 1 - ssRes / ssTot
}

/* ------------------------------------------- the fits, on the gain they belong on */

/**
 * The paper's forms are fitted to the *gain*, against the paper's *distance*.
 *
 * R(d) = d(α − β d) is zero at d = 0, so fitting it to an absolute reward asks
 * a curve that starts at the reference's reward to start at nothing. The gain
 * over the reference is the quantity the form describes, and the only one for
 * which α is the initial rate of improvement.
 *
 * And d is √KL, not KL. That choice is what makes best-of-n a parabola: the
 * gain a selection buys grows like √KL near the start, so on the KL axis the
 * same curve has an infinite initial slope and no parabola fits it. Gao et al.
 * call √KL the distance for the same reason.
 */
export interface GainCurve {
  /** The gold reward of the reference policy — the zero of the gain. */
  baseline: number
  /** The distances travelled, √KL, in the order the sweep produced them. */
  distances: number[]
  gains: number[]
  fit: OveroptimisationFit
  /** The distance at which the gain is largest. */
  bestDistance: number
  /** The KL at which the gain is largest. */
  bestKl: number
  /** How large the gain gets there. */
  bestGain: number
}

/** The gain curve for reinforcement learning: the tilt, swept. */
export function reinforcementLearningGain(
  setting: RewardSetting,
  maxLambda = 1.2,
  steps = 120,
): GainCurve {
  const baseline = expectedReward(setting.reference, setting.trueReward)
  const curve = sweepOveroptimisation(setting, maxLambda, steps)
  const distances = curve.points.map((point) => Math.sqrt(Math.max(point.kl, 1e-12)))
  const gains = curve.points.map((point) => point.trueReward - baseline)
  return {
    baseline,
    distances,
    gains,
    fit: fitReinforcementLearningForm(distances, gains),
    bestDistance: Math.sqrt(Math.max(curve.bestKl, 1e-12)),
    bestKl: curve.bestKl,
    bestGain: curve.bestTrueReward - baseline,
  }
}

/** The gain curve for best-of-n: the exact induced distribution, at a ladder of sample sizes. */
export function bestOfNGain(setting: RewardSetting, sizes = [2, 4, 8, 16, 32, 64, 128, 256, 1024, 4096]): GainCurve {
  const baseline = expectedReward(setting.reference, setting.trueReward)
  const ladder = sizes.map((n) => bestOfNDistribution(setting, n))
  const distances = ladder.map((point) => Math.sqrt(Math.max(point.kl, 1e-12)))
  const gains = ladder.map((point) => point.trueReward - baseline)
  const best = gains.reduce((a, b) => (b > a ? b : a), -Infinity)
  const bestIndex = gains.indexOf(best)
  return {
    baseline,
    distances,
    gains,
    fit: fitBestOfNForm(distances, gains),
    bestDistance: distances[bestIndex] ?? 0,
    bestKl: ladder[bestIndex]?.kl ?? 0,
    bestGain: best,
  }
}

/** A row of the α-and-β table: one reward model, fitted both ways. */
export interface GrowthRow {
  /** How many preference pairs the reward model was fitted on. */
  data: number
  errorScale: number
  errorSlope: number
  /** How far the proxy's best point is from the gold one, in grid units. */
  optimumGap: number
  rlAlpha: number
  rlBeta: number
  rlR2: number
  bonAlpha: number
  bonBeta: number
  bonR2: number
  /** The distance at which the RL gain peaks. */
  bestDistance: number
  /** The KL at which the RL gain peaks. */
  bestKl: number
  /** How high the RL gain gets. */
  bestGain: number
  /** The gold gain of the policy at the ceiling — pushing as far as the proxy allows. */
  gainAtCeiling: number
  /** How much the proxy reward gains over the reference at the ceiling. */
  proxyGainAtCeiling: number
}

/**
 * The paper's headline: what happens to α and β as the reward model is fitted on more data.
 *
 * The claim is that α rises and β falls. Both are measured here on the gain,
 * against the same gold reward model, with only the reward model's error
 * changing.
 */
export function alphaBetaAcrossData(
  setting: RewardSetting,
  sizes = [1, 4, 16, 64, 256, 1024, 4096, 16384],
  referenceData = 100,
  maxLambda = 1.2,
  steps = 100,
): GrowthRow[] {
  return sizes.map((data) => {
    const model = rewardModelAtData(setting, data, referenceData)
    const rl = reinforcementLearningGain(model, maxLambda, steps)
    const bon = bestOfNGain(model)
    const ceiling = policyForBudget(model, 1e6)
    return {
      data,
      errorScale: model.errorScale,
      errorSlope: model.errorSlope,
      optimumGap: Math.abs(model.points[model.proxyBestIndex]! - model.points[model.bestIndex]!),
      rlAlpha: rl.fit.alpha,
      rlBeta: rl.fit.beta,
      rlR2: rl.fit.r2,
      bonAlpha: bon.fit.alpha,
      bonBeta: bon.fit.beta,
      bonR2: bon.fit.r2,
      bestDistance: rl.bestDistance,
      bestKl: rl.bestKl,
      bestGain: rl.bestGain,
      gainAtCeiling: ceiling.trueReward - rl.baseline,
      proxyGainAtCeiling: ceiling.proxyReward - expectedReward(model.reference, model.proxyReward),
    }
  })
}
