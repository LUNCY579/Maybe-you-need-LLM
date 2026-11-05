/**
 * A policy, its gradients, and its distance from a reference.
 *
 * The setting is a contextual bandit: a small number of contexts, each with a
 * small number of actions, and a logit vector per context. Everything the
 * course needs — the probability of an action, the gradient of the expected
 * reward, the KL divergence from a reference policy, and the exact entropy —
 * is computable in closed form, which is what makes the laboratory a
 * measuring instrument rather than an illustration.
 */

import { createRng, softmax, solveLinear } from '@llm-materials/course-core'
import type { Matrix, Vector } from '@llm-materials/course-core'

export interface Bandit {
  /** How many contexts there are. */
  contexts: number
  /** How many actions each context has. */
  actions: number
  /** One logit vector per context, laid out row-major. */
  logits: number[]
}

export function createBandit(contexts: number, actions: number, seed = 1): Bandit {
  const logits: number[] = []
  let state = seed >>> 0
  for (let i = 0; i < contexts * actions; i++) {
    state = (state * 1664525 + 1013904223) >>> 0
    logits.push((state / 4294967296) * 1.2 - 0.6)
  }
  return { contexts, actions, logits }
}

/** The probability of each action in a context. */
export function actionProbs(bandit: Bandit, context: number): Vector {
  const start = context * bandit.actions
  return softmax(bandit.logits.slice(start, start + bandit.actions))
}

/** The log-probability of an action in a context. */
export function logProb(bandit: Bandit, context: number, action: number): number {
  const probs = actionProbs(bandit, context)
  return Math.log(Math.max(probs[action] ?? 0, 1e-300))
}

/**
 * The gradient of the log-probability of an action with respect to the
 * logits of its context.
 *
 * For a softmax, ∂log π(a)/∂logit_j is onehot(a)_j − π_j.
 */
export function logProbGradient(bandit: Bandit, context: number, action: number): number[] {
  const probs = actionProbs(bandit, context)
  const gradient = probs.map((p) => -p)
  gradient[action] = (gradient[action] ?? 0) + 1
  return gradient
}

/**
 * The expected reward under the policy, and the gradient of it.
 *
 * The expectation is a finite sum, so it is exact. The gradient is
 * Σ_a π(a) · r(a) · ∇log π(a), which is the usual policy-gradient identity
 * written out.
 *
 * The sum is over every context, so the number is a total across prompts rather
 * than a reward per prompt; `meanReward` is the one a table of rewards is worth
 * quoting as.
 */
export function expectedReward(
  bandit: Bandit,
  rewards: number[][],
): { reward: number; gradient: number[] } {
  const gradient = new Array<number>(bandit.logits.length).fill(0)
  let reward = 0

  for (let context = 0; context < bandit.contexts; context++) {
    const probs = actionProbs(bandit, context)
    const row = rewards[context] ?? []
    for (let action = 0; action < bandit.actions; action++) {
      const p = probs[action] ?? 0
      const r = row[action] ?? 0
      reward += p * r
      const logGrad = logProbGradient(bandit, context, action)
      for (let j = 0; j < bandit.actions; j++) {
        gradient[context * bandit.actions + j] += p * r * (logGrad[j] ?? 0)
      }
    }
  }

  return { reward, gradient }
}

/**
 * The reward one prompt is worth to the policy, averaged over the prompts.
 *
 * The pipeline's stages are scored this way: a policy's gold reward means the
 * same number of reward units per prompt whether the task has six prompts or
 * sixty, which a total does not.
 */
export function meanReward(bandit: Bandit, rewards: number[][]): number {
  return expectedReward(bandit, rewards).reward / Math.max(1, bandit.contexts)
}

/**
 * The KL divergence from a reference policy, averaged over the contexts.
 *
 * KL(π ‖ π_ref) = Σ_a π(a) · (log π(a) − log π_ref(a)).
 */
export function klToReference(
  bandit: Bandit,
  reference: Bandit,
  contexts?: number[],
): { mean: number; perContext: number[] } {
  const list = contexts ?? Array.from({ length: bandit.contexts }, (_, i) => i)
  const perContext: number[] = []

  for (const context of list) {
    const probs = actionProbs(bandit, context)
    const referenceProbs = actionProbs(reference, context)
    let kl = 0
    for (let action = 0; action < bandit.actions; action++) {
      const p = probs[action] ?? 0
      if (p <= 0) continue
      kl += p * (Math.log(p) - Math.log(Math.max(referenceProbs[action] ?? 0, 1e-300)))
    }
    perContext.push(kl)
  }

  const mean = perContext.length === 0 ? 0 : perContext.reduce((a, b) => a + b, 0) / perContext.length
  return { mean, perContext }
}

/** The entropy of a context's policy, in nats. */
export function contextEntropy(bandit: Bandit, context: number): number {
  const probs = actionProbs(bandit, context)
  let entropy = 0
  for (const p of probs) {
    if (p > 0) entropy -= p * Math.log(p)
  }
  return entropy
}

/** The average entropy across the contexts. */
export function meanEntropy(bandit: Bandit): number {
  let total = 0
  for (let context = 0; context < bandit.contexts; context++) {
    total += contextEntropy(bandit, context)
  }
  return bandit.contexts === 0 ? 0 : total / bandit.contexts
}

/** A copy of a bandit, for snapshotting. */
export function cloneBandit(bandit: Bandit): Bandit {
  return { contexts: bandit.contexts, actions: bandit.actions, logits: bandit.logits.slice() }
}

/**
 * The same policy with every logit multiplied.
 *
 * The argmax in each context is unchanged; only the confidence is. What does
 * move is the curvature, which is why a step size means something different on a
 * peaked policy than on a flat one, and why the laboratory can dial sharpness
 * without changing what the policy wants.
 */
export function sharpen(bandit: Bandit, factor: number): Bandit {
  return {
    contexts: bandit.contexts,
    actions: bandit.actions,
    logits: bandit.logits.map((value) => value * factor),
  }
}

/**
 * The advantage of each action: its reward minus the reward the policy expects
 * in that context.
 *
 * Subtracting the expectation is a baseline in its purest form — it changes no
 * gradient, because the score function averages to zero, and it is the quantity
 * the natural gradient of a reward turns out to be.
 */
export function advantage(bandit: Bandit, rewards: number[][]): number[] {
  const values: number[] = []
  for (let context = 0; context < bandit.contexts; context++) {
    const probs = actionProbs(bandit, context)
    const row = rewards[context] ?? []
    let expectation = 0
    for (let action = 0; action < bandit.actions; action++) {
      expectation += (probs[action] ?? 0) * (row[action] ?? 0)
    }
    for (let action = 0; action < bandit.actions; action++) {
      values.push((row[action] ?? 0) - expectation)
    }
  }
  return values
}

/**
 * The greedy action in a context — the one the policy would pick if it were
 * asked to commit.
 */
export function greedyAction(bandit: Bandit, context: number): number {
  const probs = actionProbs(bandit, context)
  let best = 0
  for (let action = 1; action < probs.length; action++) {
    if ((probs[action] ?? 0) > (probs[best] ?? 0)) best = action
  }
  return best
}

/**
 * The value each context is worth to this policy: E_π[r] with the expectation
 * over that context's actions only.
 *
 * The exact critic — what a perfectly fitted value function would say — which
 * is what makes an advantage error-free and leaves the estimator's treatment of
 * it the only thing a laboratory can measure.
 */
export function contextValues(bandit: Bandit, rewards: number[][]): number[] {
  const values: number[] = []
  for (let context = 0; context < bandit.contexts; context++) {
    const probs = actionProbs(bandit, context)
    const row = rewards[context] ?? []
    values.push(probs.reduce((sum, p, action) => sum + p * (row[action] ?? 0), 0))
  }
  return values
}

/**
 * A reward landscape: one number per context and action.
 *
 * The landscape is constructed rather than measured — it is the same kind of
 * object as the bandit itself, and the laboratory uses it because its optimum
 * is in the interior and its curvature is uneven.
 */
export function rewardLandscape(contexts: number, actions: number): number[][] {
  return Array.from({ length: contexts }, (_, context) =>
    Array.from({ length: actions }, (_, action) =>
      Math.cos((context + 1) * 0.7) * Math.cos((action + 1) * 0.5) -
      0.03 * (action - context) ** 2,
    ),
  )
}

/**
 * The Fisher matrix of one context of a softmax policy.
 *
 * For a softmax it is diag(π) − ππᵀ, which is also the Hessian of the
 * log-partition function of that context. The second statement is what makes
 * the finite-difference trick below possible, and the first is what makes it
 * checkable: on a policy this small the product can be computed exactly and
 * compared.
 */
export function fisherMatrix(bandit: Bandit, context: number): Matrix {
  const probs = actionProbs(bandit, context)
  return probs.map((p, row) =>
    probs.map((q, column) => (row === column ? p * (1 - q) : -p * q)),
  )
}

/** The Fisher-vector product of the whole policy, block by block, computed exactly. */
export function fisherVectorProduct(bandit: Bandit, vector: number[]): number[] {
  const product = new Array<number>(bandit.logits.length).fill(0)
  for (let context = 0; context < bandit.contexts; context++) {
    const probs = actionProbs(bandit, context)
    const start = context * bandit.actions
    let expectation = 0
    for (let action = 0; action < bandit.actions; action++) {
      expectation += (probs[action] ?? 0) * (vector[start + action] ?? 0)
    }
    for (let action = 0; action < bandit.actions; action++) {
      product[start + action] = (probs[action] ?? 0) * ((vector[start + action] ?? 0) - expectation)
    }
  }
  return product
}

/**
 * The same product by finite differences.
 *
 * Because the Fisher is the Hessian of the log-partition function and the
 * gradient of that function is the probability vector,
 *
 *   (F·v)_i ≈ ( π_i(θ + εv) − π_i(θ − εv) ) / (2ε)
 *
 * A network cannot form the Fisher, but it can be evaluated at two perturbed
 * weight vectors, which is the whole of the trick and the reason a natural step
 * is affordable at all.
 */
export function fisherVectorProductByFiniteDifference(
  bandit: Bandit,
  vector: number[],
  epsilon = 1e-5,
): number[] {
  const up = { ...bandit, logits: bandit.logits.map((value, index) => value + epsilon * (vector[index] ?? 0)) }
  const down = { ...bandit, logits: bandit.logits.map((value, index) => value - epsilon * (vector[index] ?? 0)) }
  const product = new Array<number>(bandit.logits.length).fill(0)
  for (let context = 0; context < bandit.contexts; context++) {
    const upProbs = actionProbs(up, context)
    const downProbs = actionProbs(down, context)
    for (let action = 0; action < bandit.actions; action++) {
      product[context * bandit.actions + action] =
        ((upProbs[action] ?? 0) - (downProbs[action] ?? 0)) / (2 * epsilon)
    }
  }
  return product
}

/**
 * The quadratic form vᵀFv, averaged over the contexts: the KL a step of size v
 * costs, to second order.
 *
 * Averaging is deliberate. Every distance in this application is a mean over
 * contexts, because `klToReference` is one, so a step size means the same
 * distance here that the laboratories report.
 */
export function fisherQuadraticForm(bandit: Bandit, vector: number[]): number {
  const product = fisherVectorProduct(bandit, vector)
  const total = product.reduce((sum, value, index) => sum + value * (vector[index] ?? 0), 0)
  return total / Math.max(bandit.contexts, 1)
}

/**
 * The natural gradient of a vector, damped.
 *
 * Each context is a separate (actions × actions) system, (F + damping·I)x = g.
 * The damping is not decoration: the softmax Fisher is singular along the
 * direction that shifts every logit in a context by the same amount, because
 * that direction changes no probability at all.
 *
 * For the gradient of an expected reward the solve has an answer worth naming.
 * That gradient is π_a(r_a − E[r]) per context and the Fisher is diag(π) − ππᵀ,
 * so the solution is the advantage r_a − E[r] itself, up to a per-context
 * constant the softmax cannot see — which is to say the natural direction of a
 * reward and the direction the KL penalty tilts a policy by are one direction.
 */
export function naturalGradient(bandit: Bandit, gradient: number[], damping = 1e-3): number[] {
  const natural = new Array<number>(bandit.logits.length).fill(0)
  for (let context = 0; context < bandit.contexts; context++) {
    const start = context * bandit.actions
    const matrix = fisherMatrix(bandit, context).map((row, i) =>
      row.map((value, j) => value + (i === j ? damping : 0)),
    )
    const right = gradient.slice(start, start + bandit.actions)
    const solution = solveLinear(matrix, right)
    for (let action = 0; action < bandit.actions; action++) natural[start + action] = solution[action] ?? 0
  }
  return natural
}

/**
 * A step in a direction, scaled until its predicted KL cost is η²/2.
 *
 * The scaling is what makes a step size mean something: δ = η·v/√(vᵀFv) has
 * Fisher norm η, so its second-order cost is η²/2 whatever the direction and
 * whatever the reward scale.
 */
export function scaledStep(bandit: Bandit, direction: number[], eta: number): number[] {
  const cost = Math.sqrt(Math.max(fisherQuadraticForm(bandit, direction), 1e-24))
  const scale = eta / cost
  return direction.map((value) => value * scale)
}

/**
 * The multiple of a direction whose *measured* KL cost is the budget.
 *
 * Found by bisection on the exact cost, which is monotone in the multiple. This
 * is how a step that was not scaled by the Fisher can still be compared with
 * one that was: match what they cost, not what they are called.
 */
export function stepForCost(
  bandit: Bandit,
  direction: number[],
  budget: number,
): { delta: number[]; cost: number; tries: number } {
  let low = 0
  let high = 1
  while (stepCost(bandit, direction.map((value) => value * high)).exact < budget && high < 1e6) {
    high *= 2
  }
  let tries = 0
  while (high - low > 1e-12 && tries < 200) {
    const middle = (low + high) / 2
    const cost = stepCost(bandit, direction.map((value) => value * middle)).exact
    if (cost < budget) low = middle
    else high = middle
    tries++
  }
  const scale = (low + high) / 2
  const delta = direction.map((value) => value * scale)
  return { delta, cost: stepCost(bandit, delta).exact, tries }
}

/** What a step in the logits cost, measured and predicted. */
export function stepCost(bandit: Bandit, delta: number[]): { predicted: number; exact: number } {
  const moved: Bandit = {
    contexts: bandit.contexts,
    actions: bandit.actions,
    logits: bandit.logits.map((value, index) => value + (delta[index] ?? 0)),
  }
  return {
    predicted: 0.5 * fisherQuadraticForm(bandit, delta),
    exact: klToReference(moved, bandit).mean,
  }
}

/**
 * Apply a gradient step to the logits.
 */
export function applyStep(bandit: Bandit, gradient: number[], learningRate: number): Bandit {
  const logits = bandit.logits.map((value, index) => value + learningRate * (gradient[index] ?? 0))
  return { contexts: bandit.contexts, actions: bandit.actions, logits }
}

/**
 * What one KL budget buys, in three directions.
 *
 * "Steepest ascent under a KL constraint" is a statement about the ruler, not
 * about the objective: maximising gᵀδ subject to δᵀFδ ≤ 2ε has the solution
 * δ ∝ F⁻¹g, so the natural step is the best step *of that distance*. The claim
 * is checkable, because on a bandit the distance and the gain can both be
 * measured rather than predicted. Every direction below is scaled by bisection
 * until its measured cost equals the natural step's, so the numbers in the table
 * are gains bought with the same distance.
 */
export interface MatchedCostComparison {
  eta: number
  /** The measured KL cost of the natural step: the budget the others are matched to. */
  budget: number
  naturalGain: number
  vanillaGain: number
  /** The two steps' length in logits, at that identical distance. */
  naturalLength: number
  vanillaLength: number
  /** The best and mean gain over random directions at the same measured cost. */
  bestRandomGain: number
  meanRandomGain: number
  samples: number
  /** Whether the natural step beat every random direction it was compared with. */
  naturalBeatsAll: boolean
}

export function matchedCostComparison(
  bandit: Bandit,
  rewards: number[][],
  eta = 0.2,
  samples = 64,
  seed = 11,
  damping = 1e-3,
): MatchedCostComparison {
  const gradient = expectedReward(bandit, rewards).gradient
  const before = expectedReward(bandit, rewards).reward
  const gain = (delta: number[]) => expectedReward(applyStep(bandit, delta, 1), rewards).reward - before

  const natural = scaledStep(bandit, naturalGradient(bandit, gradient, damping), eta)
  const budget = stepCost(bandit, natural).exact
  const vanilla = stepForCost(bandit, gradient, budget)

  const rng = createRng(seed)
  let bestRandomGain = -Infinity
  let randomTotal = 0
  for (let sample = 0; sample < samples; sample++) {
    const vector = bandit.logits.map(() => rng() * 2 - 1)
    const random = stepForCost(bandit, vector, budget)
    const value = gain(random.delta)
    randomTotal += value
    if (value > bestRandomGain) bestRandomGain = value
  }

  const naturalGain = gain(natural)
  const length = (delta: number[]) => Math.sqrt(delta.reduce((sum, value) => sum + value * value, 0))
  return {
    eta,
    budget,
    naturalGain,
    naturalLength: length(natural),
    vanillaGain: gain(vanilla.delta),
    vanillaLength: length(vanilla.delta),
    bestRandomGain: samples > 0 ? bestRandomGain : Number.NaN,
    meanRandomGain: samples > 0 ? randomTotal / samples : Number.NaN,
    samples,
    naturalBeatsAll: samples > 0 ? naturalGain > bestRandomGain : true,
  }
}
