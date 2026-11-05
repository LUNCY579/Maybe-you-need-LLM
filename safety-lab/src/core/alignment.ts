/**
 * The two rounds of the harmless-helpful procedure.
 *
 * The procedure is described in the papers as a sequence of training runs, and
 * what it buys is a position on two axes: how useful the model is, and how
 * often it declines. So the course writes the position down as a point and the
 * two rounds as the arithmetic they imply about such a point.
 *
 * **Round one is imitation.** A model trained on demonstrations becomes the
 * average of what it was shown. Show it only helpful answers and it is helpful
 * and unsafe; show it only safe declines and it is safe and unhelpful; show it
 * a pool of both — which is what a real supervised round is shown — and it
 * lands between the two, at a point nobody chose.
 *
 * **Round two is preference.** The policy moves toward whatever the labels
 * choose, in proportion to how confidently they choose it. A labeler who picks
 * the same side every time moves the policy all the way to that side; a
 * labeler who is undecided moves it nowhere. This is the whole of what a
 * preference signal can do, and the whole of what it cannot.
 *
 * Nothing here is a language model. The coordinates are inputs, the moves are
 * exact, and the findings are the numbers that come out: which points the two
 * rounds can reach, which they cannot, and what the compromise costs under a
 * given weighting of the two axes.
 */

import { createRng } from '@llm-materials/course-core'

export interface Demonstration {
  /** Which half of the pool it came from. */
  kind: 'helpful' | 'harmless'
  helpfulness: number
  harmlessness: number
}

/** A response, scored the way the pool scores it. */
export interface Outcome {
  id: string
  helpfulness: number
  harmlessness: number
}

/** The policy: a point on the same two axes. */
export interface Policy {
  helpfulness: number
  harmlessness: number
}

/**
 * One question, the two answers on offer, and how often the labeler prefers
 * the helpful one.
 *
 * `chooseHelpful` is the labeler's own probability, and it is the only place
 * the preference signal enters. One half means the label has no information in
 * it; one means it is certain.
 */
export interface PreferencePair {
  question: string
  helpful: Outcome
  harmless: Outcome
  chooseHelpful: number
}

/** The mean of a pool of demonstrations, which is what a supervised round reaches. */
export function imitate(demonstrations: Demonstration[]): Policy {
  if (demonstrations.length === 0) return { helpfulness: 0, harmlessness: 0 }
  let helpful = 0
  let harmless = 0
  for (const entry of demonstrations) {
    helpful += entry.helpfulness
    harmless += entry.harmlessness
  }
  return { helpfulness: helpful / demonstrations.length, harmlessness: harmless / demonstrations.length }
}

/** The answer a labeler is expected to choose, as a point. */
export function expectedChoice(pair: PreferencePair): Outcome {
  const weight = pair.chooseHelpful
  return {
    id: pair.question,
    helpfulness: weight * pair.helpful.helpfulness + (1 - weight) * pair.harmless.helpfulness,
    harmlessness: weight * pair.helpful.harmlessness + (1 - weight) * pair.harmless.harmlessness,
  }
}

/** One preference step: the policy moves a fraction of the way to the expected choice. */
export function preferenceStep(policy: Policy, pairs: PreferencePair[], options: { learningRate?: number } = {}): Policy {
  const learningRate = options.learningRate ?? 0.5
  if (pairs.length === 0) return policy
  let targetHelpful = 0
  let targetHarmless = 0
  for (const pair of pairs) {
    const chosen = expectedChoice(pair)
    targetHelpful += chosen.helpfulness
    targetHarmless += chosen.harmlessness
  }
  targetHelpful /= pairs.length
  targetHarmless /= pairs.length
  return {
    helpfulness: policy.helpfulness + learningRate * (targetHelpful - policy.helpfulness),
    harmlessness: policy.harmlessness + learningRate * (targetHarmless - policy.harmlessness),
  }
}

export interface SecondRound {
  policy: Policy
  /** Every step taken, including the starting point. */
  path: Policy[]
  /** The distance still to the target after the last step. */
  residual: number
}

/**
 * The second round, run to a fixed number of steps.
 *
 * The residual is reported because a curve that has not converged is not a
 * finding: the screen only claims the endpoint once the steps have stopped
 * moving it.
 */
export function trainSecondRound(
  policy: Policy,
  pairs: PreferencePair[],
  options: { steps?: number; learningRate?: number } = {},
): SecondRound {
  const steps = options.steps ?? 12
  const path: Policy[] = [policy]
  let current = policy
  for (let step = 0; step < steps; step++) {
    current = preferenceStep(current, pairs, options)
    path.push(current)
  }
  const target = pairs.length === 0 ? current : meanChoice(pairs)
  return { policy: current, path, residual: distance(current, target) }
}

/** The point the preferences are aiming at. */
export function meanChoice(pairs: PreferencePair[]): Outcome {
  if (pairs.length === 0) return { id: 'none', helpfulness: 0, harmlessness: 0 }
  let helpful = 0
  let harmless = 0
  for (const pair of pairs) {
    const chosen = expectedChoice(pair)
    helpful += chosen.helpfulness
    harmless += chosen.harmlessness
  }
  return { id: 'mean', helpfulness: helpful / pairs.length, harmlessness: harmless / pairs.length }
}

export function distance(a: Policy, b: Policy): number {
  const dh = a.helpfulness - b.helpfulness
  const dn = a.harmlessness - b.harmlessness
  return Math.sqrt(dh * dh + dn * dn)
}

/** One point with both axes at least as good and one strictly better. */
export function dominates(a: Policy, b: Policy): boolean {
  const noWorse = a.helpfulness >= b.helpfulness && a.harmlessness >= b.harmlessness
  const better = a.helpfulness > b.helpfulness || a.harmlessness > b.harmlessness
  return noWorse && better
}

/**
 * What the two rounds buy, and what they do not.
 *
 * The supervised round is an average, so it can only reach the middle of the
 * pool it was shown; the preference round can move along the axis the labels
 * care about, but only toward a demonstration that exists. The pool is
 * returned with the two points so the screen can show the gap rather than
 * assert it.
 */
export function runTwoRound(
  demonstrations: Demonstration[],
  pairs: PreferencePair[],
  options: { steps?: number; learningRate?: number } = {},
): { roundOne: Policy; roundTwo: Policy; movement: number; pool: Outcome[] } {
  const roundOne = imitate(demonstrations)
  const second = trainSecondRound(roundOne, pairs, options)
  return {
    roundOne,
    roundTwo: second.policy,
    movement: distance(roundOne, second.policy),
    pool: demonstrations.map((entry) => ({ id: entry.kind, helpfulness: entry.helpfulness, harmlessness: entry.harmlessness })),
  }
}

/**
 * The value of a point under a weighting of the two axes.
 *
 * The trade-off is not in the arithmetic — it is in the weight. Changing this
 * number is how the screen asks what the two rounds were for, and the answers
 * for the two rounds cross over, which is the finding worth putting on a chart.
 */
export function utility(policy: Policy, helpfulWeight: number): number {
  const w = Math.min(1, Math.max(0, helpfulWeight))
  return w * policy.helpfulness + (1 - w) * policy.harmlessness
}

/** Which of the two rounds a weighting prefers. */
export function preferredRound(
  demonstrations: Demonstration[],
  pairs: PreferencePair[],
  helpfulWeight: number,
  options: { steps?: number; learningRate?: number } = {},
): { helpfulWeight: number; roundOne: number; roundTwo: number; prefers: 'round one' | 'round two' } {
  const run = runTwoRound(demonstrations, pairs, options)
  const roundOne = utility(run.roundOne, helpfulWeight)
  const roundTwo = utility(run.roundTwo, helpfulWeight)
  return { helpfulWeight, roundOne, roundTwo, prefers: roundTwo >= roundOne ? 'round two' : 'round one' }
}

/**
 * The demonstration pool: two clusters, and nothing in between.
 *
 * Helpful answers that comply, safe answers that decline — the shape the
 * harmless-helpful work reports, written down as numbers rather than described.
 */
export function buildDemonstrations(count = 40, seed = 2): Demonstration[] {
  const rng = createRng(seed)
  const pool: Demonstration[] = []
  for (let i = 0; i < count; i++) {
    const kind: Demonstration['kind'] = i % 2 === 0 ? 'helpful' : 'harmless'
    const jitter = 0.08 * rng()
    pool.push(
      kind === 'helpful'
        ? { kind, helpfulness: 0.9 + jitter, harmlessness: 0.25 - jitter }
        : { kind, helpfulness: 0.3 - jitter, harmlessness: 0.92 - jitter },
    )
  }
  return pool
}

/** Questions with one helpful and one safe answer each. */
export function buildPreferencePairs(count = 24, options: { chooseHelpful?: number } = {}): PreferencePair[] {
  const chooseHelpful = options.chooseHelpful ?? 1
  const pairs: PreferencePair[] = []
  for (let i = 0; i < count; i++) {
    pairs.push({
      question: `question-${i}`,
      helpful: { id: `helpful-${i}`, helpfulness: 0.9, harmlessness: 0.25 },
      harmless: { id: `harmless-${i}`, helpfulness: 0.3, harmlessness: 0.92 },
      chooseHelpful,
    })
  }
  return pairs
}
