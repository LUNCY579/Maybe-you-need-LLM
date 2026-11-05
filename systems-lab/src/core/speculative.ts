/**
 * Speculative decoding.
 *
 * A small model proposes tokens and a large model checks them in one pass.
 * The check is exact — the accepted tokens have the same distribution under
 * the procedure as under the large model alone — and the speed comes from
 * doing the expensive model's work once for several tokens instead of once
 * for each.
 *
 * The quantity that decides whether it is worth it is the acceptance rate,
 * and it is a computable quantity: it depends on how close the two models
 * are, and the simulation in this module measures it.
 */

import { createRng } from '@llm-materials/course-core'

export interface SpeculativeOptions {
  /** How many tokens the draft model proposes. */
  draftLength?: number
  /** The seed. */
  seed?: number
  /** How many steps to simulate. */
  steps?: number
}

export interface SpeculativeResult {
  /** The number of tokens the draft proposed. */
  proposed: number
  /** The number of tokens the target accepted. */
  accepted: number
  /** The number of steps the target had to run. */
  targetSteps: number
  /** The number of tokens the target produced on its own. */
  targetTokens: number
  /** The fraction of the proposed tokens that were accepted. */
  acceptanceRate: number
  /** The tokens produced per target step. */
  tokensPerStep: number
  /** The number of target steps the plain method would have needed. */
  baselineSteps: number
  /** The speed-up, given the relative cost of the two models. */
  speedup: number
}

/**
 * The acceptance rate of a draft model.
 *
 * The rule is the one the procedure actually uses: a drafted token x is
 * accepted with probability min(1, p(x)/q(x)), where p is the target's
 * distribution and q the draft's. Averaged over the tokens the draft
 * produces, the expected acceptance is 1 − TV(q, p) — the fraction of the
 * draft's mass that the target agrees with.
 *
 * The simulation below draws the drafted token and applies the rule; the
 * closed form is checked against it.
 */
export function acceptanceRate(
  draft: number[],
  target: number[],
  options: { seed?: number; trials?: number } = {},
): number {
  const settings = { seed: 1, trials: 2000, ...options }
  const rng = createRng(settings.seed)
  let accepted = 0
  for (let trial = 0; trial < settings.trials; trial++) {
    const drafted = sampleFrom(draft, rng)
    const draftProbability = draft[drafted] ?? 0
    const targetProbability = target[drafted] ?? 0
    const rule = draftProbability <= 0 ? 0 : Math.min(1, targetProbability / draftProbability)
    if (rng() < rule) accepted++
  }
  return accepted / settings.trials
}

/** The acceptance rate the rule implies, without a simulation. */
export function closedFormAcceptanceRate(draft: number[], target: number[]): number {
  return 1 - totalVariation(draft, target)
}

/** The overlap between two discrete distributions, in total variation. */
export function totalVariation(a: number[], b: number[]): number {
  const length = Math.max(a.length, b.length)
  let total = 0
  for (let i = 0; i < length; i++) total += Math.abs((a[i] ?? 0) - (b[i] ?? 0))
  return total / 2
}

/** Draw a symbol from a distribution. */
export function sampleFrom(distribution: number[], rng: () => number): number {
  const u = rng()
  let cumulative = 0
  for (let i = 0; i < distribution.length; i++) {
    cumulative += distribution[i] ?? 0
    if (u <= cumulative) return i
  }
  return distribution.length - 1
}

/**
 * The modified rejection rule, one drafted token at a time.
 *
 * The target does not sample a token at the position and compare it with the
 * draft's; that would accept a drafted token only when the two draws happened
 * to agree, and it would leave the output distributed by the product of the two
 * rather than by the target's own. What the target does is score the token the
 * draft chose and keep it with probability min(1, p(x)/q(x)) — the probability
 * that the draft was not too keen on it — and replace it by a draw from the
 * part of the target the draft left uncovered when it is not kept.
 *
 * That is the rule the acceptance rate of 1 − TV belongs to, and it is the one
 * every run in this module uses.
 */
export function proposeAndVerify(
  draft: number[],
  target: number[],
  rng: () => number,
): { token: number; accepted: boolean } {
  const drafted = sampleFrom(draft, rng)
  const q = draft[drafted] ?? 0
  const p = target[drafted] ?? 0
  if (rng() < (q <= 0 ? 0 : Math.min(1, p / q))) return { token: drafted, accepted: true }
  return { token: sampleFrom(residual(draft, target), rng), accepted: false }
}

/**
 * The part of the target's distribution a draft did not cover, as a distribution.
 *
 * The positive parts of p − q sum to the total variation between the two, which
 * is well under one, so they have to be renormalised before they can be drawn
 * from. Skip that and the draw falls off the end of the cumulative sum whenever
 * the random number exceeds the variation — which is nearly always — and the
 * last symbol of the vocabulary swallows every correction the procedure makes.
 */
export function residual(draft: number[], target: number[]): number[] {
  const excess = target.map((value, i) => Math.max(0, value - (draft[i] ?? 0)))
  const total = excess.reduce((a, b) => a + b, 0)
  // Nothing left over means the draft already covers the target; the corrected
  // token is then the target's own next draw.
  if (total <= 0) return target.slice()
  return excess.map((value) => value / total)
}

/**
 * The accepted prefix.
 *
 * Whether the drafts are checked one at a time or all in one pass, the run
 * keeps the leading tokens that survived and stops at the first that did not:
 * a token after a rejection would follow a prefix that does not exist. This is
 * that read-out, expressed as a comparison of two token lists — which is also
 * what a deterministic pair of models does, the target's argmax standing in for
 * its distribution. The sampling runs below use the rejection rule instead and
 * keep the same leading-run shape.
 */
export function verify(
  drafted: number[],
  targetSamples: number[],
): { accepted: number; corrected: number | null } {
  let accepted = 0
  for (let i = 0; i < drafted.length; i++) {
    if (drafted[i] === targetSamples[i]) {
      accepted++
    } else {
      return { accepted, corrected: targetSamples[i] ?? null }
    }
  }
  return { accepted, corrected: null }
}

/**
 * A simulation of a whole speculative decoding run.
 *
 * The draft and the target are two distributions over the same vocabulary,
 * and the draft is the target with some probability mass moved to a
 * neighbouring symbol — which is what a smaller model looks like.
 */
export function simulateSpeculative(
  target: number[],
  options: SpeculativeOptions & { draftNoise?: number; draftCost?: number } = {},
): SpeculativeResult {
  const settings = {
    draftLength: 4,
    seed: 7,
    steps: 400,
    draftNoise: 0.15,
    draftCost: 0.1,
    ...options,
  }
  const rng = createRng(settings.seed)
  const draft = perturbed(target, settings.draftNoise, settings.seed + 1)

  let proposed = 0
  let accepted = 0
  let targetSteps = 0
  let targetTokens = 0

  for (let step = 0; step < settings.steps; step++) {
    // The draft proposes a run of tokens and the target scores all of them in
    // one pass, so every position is a proposal whether or not the run reaches
    // it. The accepted prefix is the leading run of kept tokens.
    let run = 0
    let alive = true
    for (let i = 0; i < settings.draftLength; i++) {
      const outcome = proposeAndVerify(draft, target, rng)
      proposed++
      if (alive && outcome.accepted) run++
      else alive = false
    }
    accepted += run
    targetSteps += 1
    // The target produces the accepted tokens, plus one more: the corrected
    // token after a rejection, or its own next token when everything was kept.
    targetTokens += run + 1
  }

  const rate = proposed === 0 ? 0 : accepted / proposed
  const tokensPerStep = targetSteps === 0 ? 0 : targetTokens / targetSteps
  const baselineSteps = targetTokens
  // The cost of a step: the target's, plus the draft's for the proposals.
  const cost = 1 + settings.draftCost * settings.draftLength
  const baselineCost = baselineSteps

  return {
    proposed,
    accepted,
    targetSteps,
    targetTokens,
    acceptanceRate: rate,
    tokensPerStep,
    baselineSteps,
    speedup: baselineCost === 0 ? 0 : baselineSteps / (targetSteps * cost),
  }
}

/**
 * A distribution moved towards its neighbours.
 *
 * This is what a smaller model looks like from the outside: mostly the same,
 * with some of the probability on the wrong symbol.
 */
export function perturbed(distribution: number[], noise: number, seed: number): number[] {
  const rng = createRng(seed)
  const result = distribution.map((value) => value * (1 - noise))
  for (let i = 0; i < distribution.length; i++) {
    const move = (distribution[i] ?? 0) * noise
    const neighbour = (i + 1) % distribution.length
    result[neighbour] = (result[neighbour] ?? 0) + move * (0.5 + 0.5 * rng())
    result[i] = (result[i] ?? 0) + move * (0.5 - 0.5 * rng())
  }
  const total = result.reduce((a, b) => a + b, 0)
  return result.map((value) => value / total)
}

/**
 * The distribution the procedure produces, computed from the rule.
 *
 * A drafted token x is accepted with probability min(1, p(x)/q(x)), and when
 * it is rejected the token is resampled from the part of the target's
 * distribution the draft did not cover. The two terms add up to exactly p:
 * min(q, p) from the accepted tokens and max(0, p − q) from the corrected
 * ones. The draft changes how many steps the procedure needs; it does not
 * change what comes out.
 */
export function speculativeDistribution(
  target: number[],
  options: { draftNoise?: number; seed?: number } = {},
): number[] {
  const settings = { draftNoise: 0.15, seed: 3, ...options }
  const draft = perturbed(target, settings.draftNoise, settings.seed)
  return target.map((p, i) => {
    const q = draft[i] ?? 0
    return Math.min(p, q) + Math.max(0, p - q)
  })
}

/**
 * The distribution the procedure produces, measured.
 *
 * This runs the procedure itself — draw from the draft, accept or correct —
 * and counts what came out. The test suite checks that the measured
 * distribution is the target's, which is the property the whole method
 * rests on.
 */
export function measuredOutputDistribution(
  target: number[],
  options: { draftNoise?: number; seed?: number; trials?: number } = {},
): number[] {
  const settings = { draftNoise: 0.15, seed: 3, trials: 20000, ...options }
  const rng = createRng(settings.seed)
  const draft = perturbed(target, settings.draftNoise, settings.seed + 1)
  const counts = new Array<number>(target.length).fill(0)

  for (let trial = 0; trial < settings.trials; trial++) {
    const outcome = proposeAndVerify(draft, target, rng)
    counts[outcome.token] = (counts[outcome.token] ?? 0) + 1
  }

  return counts.map((count) => count / settings.trials)
}

/**
 * The draft tree.
 *
 * A chain of drafts commits to one continuation: if the third token is wrong
 * the fourth and fifth were never worth proposing. A tree proposes several
 * continuations at once and lets the target choose, which costs a wider
 * forward pass but gives the run several chances at every depth.
 *
 * The shape is a depth and a width: `width` candidates at each of `depth`
 * levels, so the target's pass is over depth × width positions and the whole
 * tree is paid for whether or not the accepted path uses it. That is the cost
 * the paper's title refers to, and it is why the tree is small.
 */
export interface TreeShape {
  /** How many tokens deep the tree reaches. */
  depth: number
  /** How many candidates it keeps at each level. */
  width: number
}

/** The positions the target has to score for a tree of this shape. */
export function treeNodes(shape: TreeShape): number {
  return Math.max(0, shape.depth) * Math.max(1, shape.width)
}

/** The chain with the same number of positions: the thing the tree is compared to. */
export function chainOfSameCost(nodes: number): TreeShape {
  return { depth: Math.max(1, nodes), width: 1 }
}

/**
 * The expected number of accepted tokens, without simulating it.
 *
 * A token matched by the target with probability a, so a chain of k drafted
 * tokens survives to the end with probability a^k. A tree with w candidates at
 * each level survives if *any* of its w chains does, which is 1 − (1 − a^k)^w,
 * and the expectation is the sum of those over the depths: the probability that
 * the accepted length is at least k.
 *
 * The independence is the toy's: in this simulation every position is drawn
 * from the same distribution, so the events are genuinely independent. A real
 * draft's accuracy depends on the prefix it follows, and the corollary is that
 * the formula is an upper bound on what a hedged tree achieves in practice.
 */
export function expectedAcceptedTokens(acceptance: number, shape: TreeShape): number {
  const a = Math.min(1, Math.max(0, acceptance))
  let total = 0
  for (let k = 1; k <= shape.depth; k++) {
    const survives = a ** k
    total += 1 - (1 - survives) ** Math.max(1, shape.width)
  }
  return total
}

/** The closed form for a chain, which is the tree with one candidate per level. */
export function expectedChainTokens(acceptance: number, depth: number): number {
  return expectedAcceptedTokens(acceptance, { depth, width: 1 })
}

export interface TreeRunResult {
  /** The shape of the tree the run used. */
  shape: TreeShape
  /** The positions the target scored per step. */
  nodesPerStep: number
  /** The tokens the run produced per step, including the target's own. */
  tokensPerStep: number
  /** The accepted drafted tokens per step. */
  acceptedPerStep: number
  /** Tokens produced per position the target scored, which is the fair comparison. */
  tokensPerNode: number
  /** The acceptance rate measured from the run. */
  acceptanceRate: number
  /** The same run as a chain of the same cost. */
  chain: { shape: TreeShape; tokensPerStep: number; tokensPerNode: number }
  /** The closed form for the shape, from the measured acceptance. */
  expected: number
}

/**
 * A run of tree drafting against a run of chain drafting at the same cost.
 *
 * Each step, the tree proposes `width` candidates at each of `depth` levels and
 * the target samples at every one of them; the accepted run is the longest of
 * the candidates' prefixes that matched, and the target's own sample at the
 * first place they failed is the token that follows. The chain gets the same
 * number of positions and spends them all at one depth.
 *
 * The result is the trade the papers draw a figure for, and it has a
 * cross-over: the tree is a hedge, and a hedge pays when the drafts are bad and
 * wastes positions when they are good.
 */
interface RunMeasurement {
  tokens: number
  accepted: number
  proposed: number
  matched: number
  nodes: number
}

/**
 * The whole shape is scored, whether or not the accepted path uses it.
 *
 * The target does not know where the first mismatch is before the pass, so it
 * scores every position of the tree: that is the cost. Each position runs the
 * rejection rule above, and the accepted prefix is read out afterwards as the
 * longest leading run of kept tokens among the candidates.
 */
function runShape(
  target: number[],
  draft: number[],
  shape: TreeShape,
  rng: () => number,
  steps: number,
): RunMeasurement {
  let tokens = 0
  let accepted = 0
  let proposed = 0
  let matched = 0
  for (let step = 0; step < steps; step++) {
    let longest = 0
    for (let candidate = 0; candidate < Math.max(1, shape.width); candidate++) {
      let run = 0
      let alive = true
      for (let depth = 0; depth < shape.depth; depth++) {
        const outcome = proposeAndVerify(draft, target, rng)
        proposed++
        if (outcome.accepted) matched++
        if (alive && outcome.accepted) run++
        else alive = false
      }
      if (run > longest) longest = run
    }
    accepted += longest
    // The target's own token at the position where the accepted run stopped.
    tokens += longest + 1
  }
  return { tokens, accepted, proposed, matched, nodes: treeNodes(shape) * steps }
}

export function simulateTreeSpeculative(
  target: number[],
  options: { shape?: TreeShape; draftNoise?: number; seed?: number; steps?: number } = {},
): TreeRunResult {
  const settings = {
    shape: { depth: 4, width: 2 },
    draftNoise: 0.4,
    seed: 11,
    steps: 400,
    ...options,
  }
  const shape = settings.shape
  const draft = perturbed(target, settings.draftNoise, settings.seed + 1)

  const tree = runShape(target, draft, shape, createRng(settings.seed), settings.steps)
  const chainShape = chainOfSameCost(treeNodes(shape))
  const chain = runShape(target, draft, chainShape, createRng(settings.seed + 500), settings.steps)

  const rate = tree.proposed === 0 ? 0 : tree.matched / tree.proposed
  const treeTokens = settings.steps === 0 ? 0 : tree.tokens / settings.steps
  const chainTokens = settings.steps === 0 ? 0 : chain.tokens / settings.steps
  return {
    shape,
    nodesPerStep: treeNodes(shape),
    tokensPerStep: treeTokens,
    acceptedPerStep: settings.steps === 0 ? 0 : tree.accepted / settings.steps,
    tokensPerNode: tree.nodes === 0 ? 0 : tree.tokens / tree.nodes,
    acceptanceRate: rate,
    chain: {
      shape: chainShape,
      tokensPerStep: chainTokens,
      tokensPerNode: chain.nodes === 0 ? 0 : chain.tokens / chain.nodes,
    },
    expected: expectedAcceptedTokens(rate, shape) + 1,
  }
}

/**
 * The acceptance at which hedging stops paying.
 *
 * Below it the tree produces more tokens per position than the chain of the
 * same cost; above it the chain does. The search is over the acceptance rate
 * because the two closed forms cross once: the hedge's advantage shrinks as the
 * drafts get better, and its cost does not shrink at all.
 *
 * Zero means the tree never wins — there is nothing to hedge against — and one
 * means it wins everywhere in the range.
 */
export function crossoverAcceptance(
  shape: TreeShape,
  options: { resolution?: number } = {},
): number {
  const resolution = Math.max(2, options.resolution ?? 200)
  const chain = chainOfSameCost(treeNodes(shape))
  for (let i = 1; i <= resolution; i++) {
    const acceptance = i / resolution
    const tree = expectedAcceptedTokens(acceptance, shape)
    const chainTokens = expectedAcceptedTokens(acceptance, chain)
    if (tree <= chainTokens) return acceptance
  }
  return 1
}

/**
 * Multi-head drafting: Medusa.
 *
 * Instead of a second model that generates a chain, the model keeps its own
 * last layer and grows k extra heads on top of the same hidden state, each of
 * which proposes the token one, two, … k positions ahead. There is no draft
 * model to run, so the proposals are almost free; what is not free is that the
 * head for position four is guessing four tokens ahead from one state, and it
 * is worse at it than the head for position one.
 *
 * The acceptance of the i-th head is a measurable quantity, and the number of
 * tokens the step produces is the sum of the prefix products of those
 * acceptances — which is the closed form the paper's speed-up figures come from,
 * and it is checkable against a simulation.
 */
export interface MedusaOptions {
  /** How many extra heads. */
  heads?: number
  /** How far each head's distribution is from the target's, growing with the head. */
  headNoise?: number
  /** The seed. */
  seed?: number
  /** How many steps to run. */
  steps?: number
}

export interface MedusaResult {
  /** The acceptance rate of each head, from the closed form. */
  acceptance: number[]
  /** The rate measured by drawing, for each head among the times it was reached. */
  measuredAcceptance: number[]
  /** The tokens per step, measured. */
  tokensPerStep: number
  /** The tokens per step the prefix-product formula gives from the closed-form acceptances. */
  expectedTokensPerStep: number
  /** The target steps the plain method would have needed for the same tokens. */
  baselineSteps: number
  /** The speed-up over one token per step. */
  speedup: number
}

/**
 * The heads' distributions.
 *
 * Each head proposes from the target's distribution moved further away the
 * further ahead it is asked to look, which is the shape of the real thing: a
 * head predicting four tokens ahead has four chances to be wrong before the
 * first one, and the toy gives it proportionally more noise for it.
 */
export function medusaHeads(
  target: number[],
  options: { heads?: number; headNoise?: number; seed?: number } = {},
): number[][] {
  const settings = { heads: 4, headNoise: 0.12, seed: 21, ...options }
  return Array.from({ length: settings.heads }, (_, i) =>
    perturbed(target, Math.min(0.95, settings.headNoise * (i + 1)), settings.seed + i),
  )
}

/**
 * The expected tokens per step, from the heads' acceptances.
 *
 * The step keeps the first drafted token with probability a₁, the second only
 * if the first was kept, and so on, and whatever the run keeps it adds the
 * target's own token at the end. So the expectation is one plus the sum of the
 * running products — and it is monotone in the number of heads, because a head
 * can only ever add to the accepted prefix.
 */
export function expectedMedusaTokens(acceptance: number[]): number {
  let running = 1
  let total = 1
  for (const a of acceptance) {
    running *= Math.min(1, Math.max(0, a))
    total += running
  }
  return total
}

/**
 * A whole Medusa run.
 *
 * Each step the heads propose and the target scores what they proposed with the
 * rejection rule above; the accepted prefix is the run of heads kept from the
 * first one. The closed form is checked against this, which is the point of the
 * module: the speed-up is not a measured accident, it is the prefix product.
 *
 * A head is only asked when every head before it was kept, so each head's
 * measured rate is its acceptance among the steps that reached it — which is the
 * conditional the prefix product is made of.
 */
export function simulateMedusa(
  target: number[],
  options: MedusaOptions = {},
): MedusaResult {
  const settings = { heads: 4, headNoise: 0.12, seed: 21, steps: 600, ...options }
  const rng = createRng(settings.seed)
  const heads = medusaHeads(target, settings)
  const acceptance = heads.map((head) => closedFormAcceptanceRate(head, target))

  let tokens = 0
  const matches = heads.map(() => 0)
  const proposals = heads.map(() => 0)

  for (let step = 0; step < settings.steps; step++) {
    let kept = 0
    for (let head = 0; head < heads.length; head++) {
      const draft = heads[head] ?? target
      const outcome = proposeAndVerify(draft, target, rng)
      proposals[head] = (proposals[head] ?? 0) + 1
      if (outcome.accepted) matches[head] = (matches[head] ?? 0) + 1
      if (!outcome.accepted) break
      kept++
    }
    tokens += kept + 1
  }

  const measuredAcceptance = matches.map((match, head) =>
    (proposals[head] ?? 0) === 0 ? 0 : match / (proposals[head] ?? 0),
  )
  const steps = Math.max(1, settings.steps)
  return {
    acceptance,
    measuredAcceptance,
    tokensPerStep: tokens / steps,
    expectedTokensPerStep: expectedMedusaTokens(acceptance),
    baselineSteps: tokens,
    speedup: tokens / steps,
  }
}

