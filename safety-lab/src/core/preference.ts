/**
 * What a consistent labeler rewards.
 *
 * A preference label is a person's answer to "which of these do you prefer",
 * and a reward model is a count of those answers. Two properties of the person
 * matter and are usually conflated: whether they agree with themselves from one
 * look to the next, and which way they lean. The first is what the papers report
 * as an agreement number. The second is what the policy ends up learning.
 *
 * The model is small enough to state exactly. Each labeler has a latent side —
 * the answer they would give twice — and a consistency: the probability that a
 * look reports it rather than drawing afresh from the same lean. From those two
 * numbers follow the repeat-agreement rate (`expectedRepeatAgreement`, which is
 * arithmetic and not a simulation), the correlation between two looks of the
 * same person, which turns out to be consistency squared and nothing else
 * (`lookCorrelation`), and the probability that a majority of them picks the
 * agreeing side (`expectedMajorityRate`), a mixture of two binomial tails.
 *
 * The finding is the opposite of the one the folklore states, and the laboratory
 * only reports it because the arithmetic forced it. Consistency does not make a
 * lean more learnable; it makes it more *faithful*, and those are different
 * numbers. A scattered labeler leaning 0.6 toward agreeing hands the reward
 * model a majority that agrees 0.648 of the time, because independent looks are
 * a Condorcet jury and the majority of a biased coin is more biased than the
 * coin is. A consistent labeler with the same lean hands over 0.600 — the lean,
 * nothing more. Walk the lean the other way, to 0.4, and scattered gives 0.352
 * while consistent gives 0.400: there the noise had been helping.
 *
 * So consistency is the thing that stops a reward model from over-shooting the
 * people it is meant to be measuring. It cannot repair a bad lean and it does
 * not amplify a good one; it removes the one mechanism in the pipeline that made
 * the outcome more extreme than the labelers. The number worth fixing is still
 * the lean. The number worth reporting is fidelity to it, and `effectiveLooks`
 * is the bridge between the two — how many independent opinions a panel of
 * correlated looks is actually worth.
 *
 * The version of this that belongs in a review: at three looks and a lean of
 * 0.6, walking consistency from zero to one takes the repeat-agreement rate from
 * 0.52 to 1.00 — the number a team puts on slide four — while the sycophancy the
 * policy learns goes the other way, from 0.648 down to 0.600. The reported
 * metric and the outcome move in opposite directions, and only the arithmetic
 * above says so.
 */

import { createRng } from '@llm-materials/course-core'

/**
 * A question, and whether the person who asked it already believes the right
 * answer.
 *
 * The labeler is not asked "is this correct" but "which do you prefer", so the
 * agreeing answer is *also* the right answer whenever the user happens to be
 * right — and that is why a sycophantic policy can score well on accuracy and
 * still be badly behaved. The split between the two is the `userRightRate` the
 * set is built with.
 */
export interface Question {
  id: string
  userIsRight: boolean
}

export interface Labeler {
  id: string
  /** The probability that the labeler's latent side is the answer that agrees with the user. */
  agreeRate: number
  /** The probability that a given look reports the latent side rather than a fresh draw. */
  consistency: number
  /** How many looks the labeler is asked for. */
  looks: number
}

export interface Labels {
  /** The side the labeler would report twice, had they been perfectly consistent. */
  latent: 'agree' | 'dissent'
  /** One entry per look. */
  choices: ('agree' | 'dissent')[]
}

/**
 * The labels of one labeler on one question, from an explicit seed.
 *
 * The latent side is drawn first, because it is the thing that persists; each
 * look either reports it or draws afresh from the same lean.
 */
export function labelQuestion(labeler: Labeler, seed: number): Labels {
  const rng = createRng(seed)
  const latent: Labels['latent'] = rng() < labeler.agreeRate ? 'agree' : 'dissent'
  const choices: Labels['choices'] = []
  for (let look = 0; look < labeler.looks; look++) {
    if (rng() < labeler.consistency) choices.push(latent)
    else choices.push(rng() < labeler.agreeRate ? 'agree' : 'dissent')
  }
  return { latent, choices }
}

/**
 * The probability that two looks agree, computed rather than sampled.
 *
 * Both latent, one latent and one fresh, or both fresh — three cases, and the
 * last two agree only when the fresh draw happens to land on the same side,
 * which is `agreeRate² + (1 − agreeRate)²`. This is the formula the laboratory
 * checks its own simulation against.
 */
export function expectedRepeatAgreement(labeler: Labeler): number {
  const same = labeler.agreeRate ** 2 + (1 - labeler.agreeRate) ** 2
  const bothLatent = labeler.consistency ** 2
  const rest = 1 - bothLatent
  return bothLatent + rest * same
}

/** The share of the looks that went to the agreeing answer. */
export function agreeShare(labels: Labels): number {
  if (labels.choices.length === 0) return 0
  return labels.choices.filter((choice) => choice === 'agree').length / labels.choices.length
}

/**
 * The correlation between two looks from the same labeler.
 *
 * Consistency squared, and nothing else — not the lean, not the number of
 * looks. The derivation is short and worth doing once: the probability that two
 * looks both say "agree" is `c²·a + (1 − c²)·a²`, because they agree with each
 * other's latent side together only when both report it. Subtract the `a²` that
 * independence would give and divide by the variance `a(1 − a)` and what is left
 * is `c²`.
 *
 * This is the number that makes a panel of looks a lie. Three looks from a
 * perfectly consistent labeler are one look said three times, and any statistic
 * that counts them as three is over-confident by design.
 */
export function lookCorrelation(labeler: Labeler): number {
  return labeler.consistency ** 2
}

/**
 * How many independent opinions a set of correlated looks is worth.
 *
 * The standard design effect for a correlated sample: `m / (1 + (m − 1)ρ)`. It
 * runs from `m` at a consistency of zero to exactly one at a consistency of
 * one, which is the whole argument for asking more people instead of asking one
 * person more often.
 */
export function effectiveLooks(labeler: Labeler): number {
  const looks = Math.max(1, Math.floor(labeler.looks))
  return looks / (1 + (looks - 1) * lookCorrelation(labeler))
}

/**
 * The probability that a majority of independent looks says "agree".
 *
 * A strict majority: an even panel that lands on a tie gives the reward model no
 * side, and `readReward` sends ties to dissent. So this is the upper tail of a
 * binomial, summed from the exact middle plus one — which for odd `looks` is the
 * Condorcet jury term and for `p` on either side of one half moves away from `p`
 * in the direction it is already going.
 */
export function majorityProbability(p: number, looks: number): number {
  const n = Math.max(0, Math.floor(looks))
  if (p <= 0) return 0
  if (p >= 1) return 1
  let term = Math.pow(1 - p, n)
  let tail = 0
  for (let k = 1; k <= n; k++) {
    term *= ((n - k + 1) / k) * (p / (1 - p))
    if (k > n / 2) tail += term
  }
  return tail
}

/**
 * The probability the reward model picks the agreeing side — computed, not run.
 *
 * Condition on the latent side, which is "agree" with probability `a`. Given it,
 * a look says "agree" when it reports the latent side or when its fresh draw
 * happens to land there: `c + (1 − c)·a`. Given dissent, only the fresh draw can
 * say agree: `(1 − c)·a`. Looks are independent once the latent side is fixed,
 * so each branch is a binomial tail and the answer is their mixture.
 *
 * At a consistency of one the two branches are certain and impossible and the
 * whole thing collapses to `a` — the reward model reports the person. At zero
 * both branches are the same tail and it collapses to `majorityProbability(a, m)`
 * — the reward model reports the jury. Every real labeler is between the two,
 * and this is the function that says where.
 */
export function expectedMajorityRate(labeler: Labeler): number {
  const lean = labeler.agreeRate
  const looks = Math.max(1, Math.floor(labeler.looks))
  const consistency = labeler.consistency
  const givenAgree = consistency + (1 - consistency) * lean
  const givenDissent = (1 - consistency) * lean
  return lean * majorityProbability(givenAgree, looks) + (1 - lean) * majorityProbability(givenDissent, looks)
}

export interface RewardRead {
  /** The reward model's own number: which side it thinks the labelers prefer. */
  prefers: 'agree' | 'dissent'
  /** The share of the labels that went to the side it picked. */
  reward: number
  /** How far that share is from a tie — the confidence the policy sees. */
  margin: number
  /** Whether the count recovered the side the labeler would have given twice. */
  faithful: boolean
}

/**
 * The reward model, which is a count.
 *
 * A tie goes to dissent — the conservative choice, and the one that keeps an
 * undecided labeler from looking like a harmful one.
 */
export function readReward(labels: Labels): RewardRead {
  const share = agreeShare(labels)
  const prefers: 'agree' | 'dissent' = share > 0.5 ? 'agree' : 'dissent'
  return {
    prefers,
    reward: prefers === 'agree' ? share : 1 - share,
    margin: Math.abs(share - 0.5) * 2,
    faithful: prefers === labels.latent,
  }
}

/** The side of the pair that is actually right. */
export function rightSide(question: Question): 'agree' | 'dissent' {
  return question.userIsRight ? 'agree' : 'dissent'
}

export interface PolicyOutcome {
  /** The share of the questions where the policy gave the answer that agrees with the user. */
  sycophancyRate: number
  /** The share where it gave the right answer, which is not the complement unless the users were all wrong. */
  accuracy: number
  /** The reward the policy collected, averaged over the questions. */
  meanReward: number
  /** How confidently the reward model was decided, averaged over the questions. */
  meanConfidence: number
}

/**
 * What a policy that follows these labels does.
 *
 * The policy takes the reward model's side on every question. Sycophancy and
 * accuracy are not complements here, and that is the point: a policy that
 * always agrees is *right* exactly as often as the people it agrees with are
 * right, which lets it pass an accuracy check while it is doing the thing the
 * check was supposed to catch.
 */
export function trainPolicy(labeler: Labeler, questions: Question[], options: { seed?: number } = {}): PolicyOutcome {
  const seed = options.seed ?? 3
  let sycophantic = 0
  let right = 0
  let reward = 0
  let confidence = 0
  questions.forEach((question, index) => {
    const read = readReward(labelQuestion(labeler, seed + index * 101))
    if (read.prefers === 'agree') sycophantic++
    if (read.prefers === rightSide(question)) right++
    reward += read.reward
    confidence += read.margin
  })
  const count = Math.max(1, questions.length)
  return {
    sycophancyRate: sycophantic / count,
    accuracy: right / count,
    meanReward: reward / count,
    meanConfidence: confidence / count,
  }
}

/**
 * The sweep the finding lives in.
 *
 * The lean is held still and the consistency is walked from scattered to
 * perfect. At a lean of one half the curve is flat, because there is nothing to
 * be faithful to; on either side of it the sampled sycophancy moves *toward* the
 * lean rather than past it, and `expectedMajorityRate` says exactly where it
 * lands — `majorityProbability` at the scattered end, the bare lean at the
 * consistent one. The `gap` column is the difference between the two ends, which
 * is the amplification that consistency takes away.
 */
export function consistencySweep(
  labeler: { agreeRate: number; looks: number },
  consistencies: number[],
  questions: Question[],
  options: { seed?: number } = {},
): {
  consistency: number
  sycophancyRate: number
  expectedSycophancy: number
  accuracy: number
  expectedAgreement: number
  effectiveLooks: number
  gap: number
}[] {
  return consistencies.map((consistency) => {
    const withConsistency: Labeler = { id: 'sweep', agreeRate: labeler.agreeRate, consistency, looks: labeler.looks }
    const outcome = trainPolicy(withConsistency, questions, options)
    const expected = expectedMajorityRate(withConsistency)
    return {
      consistency,
      sycophancyRate: outcome.sycophancyRate,
      expectedSycophancy: expected,
      accuracy: outcome.accuracy,
      expectedAgreement: expectedRepeatAgreement(withConsistency),
      effectiveLooks: effectiveLooks(withConsistency),
      gap: outcome.sycophancyRate - expected,
    }
  })
}

/**
 * The same walk done on the lean instead, which is the axis that actually
 * decides the outcome.
 */
export function leanSweep(
  labeler: { consistency: number; looks: number },
  agreeRates: number[],
  questions: Question[],
  options: { seed?: number } = {},
): { agreeRate: number; sycophancyRate: number; expectedSycophancy: number; accuracy: number }[] {
  return agreeRates.map((agreeRate) => {
    const withLean: Labeler = { id: 'sweep', agreeRate, consistency: labeler.consistency, looks: labeler.looks }
    const outcome = trainPolicy(withLean, questions, options)
    return {
      agreeRate,
      sycophancyRate: outcome.sycophancyRate,
      expectedSycophancy: expectedMajorityRate(withLean),
      accuracy: outcome.accuracy,
    }
  })
}

/**
 * The agreement between two labelers, which is the number a team reports
 * because it is the only agreement they can see.
 *
 * Two labelers each draw their own latent side, so their looks are independent
 * even when each of them is perfectly consistent: the expected agreement is
 * `a·b + (1−a)(1−b)` and contains no consistency term at all. That is the
 * distinction the laboratory is built on — a consistency number read across
 * *people* measures the shared lean, and only a number read across *looks at
 * the same pair* measures consistency.
 */
export function interLabelerAgreement(
  a: Labeler,
  b: Labeler,
  options: { seed?: number; samples?: number } = {},
): { observed: number; expected: number } {
  const samples = options.samples ?? 400
  const seed = options.seed ?? 17
  let agreed = 0
  for (let index = 0; index < samples; index++) {
    const first = labelQuestion(a, seed + index).choices[0]!
    const second = labelQuestion(b, seed + 7919 + index).choices[0]!
    if (first === second) agreed++
  }
  return { observed: agreed / samples, expected: a.agreeRate * b.agreeRate + (1 - a.agreeRate) * (1 - b.agreeRate) }
}

/**
 * The consistency two labelers show each other on repeat looks — the number
 * that *does* move with consistency, and the one an agreement report usually
 * forgets to separate from the paragraph above.
 */
export function repeatAgreementCurve(labeler: Labeler, consistencies: number[]): { consistency: number; expected: number }[] {
  return consistencies.map((consistency) => ({
    consistency,
    expected: expectedRepeatAgreement({ ...labeler, consistency }),
  }))
}

/**
 * The set of questions, with the share of them where the user's stated belief
 * happens to be right.
 *
 * `userRightRate` is the number that decides whether agreeing is a virtue, so
 * the laboratory sets it on purpose rather than inheriting it from a fixture.
 */
export function buildQuestions(count = 60, options: { userRightRate?: number; seed?: number } = {}): Question[] {
  const userRightRate = options.userRightRate ?? 0
  const rng = createRng(options.seed ?? 23)
  return Array.from({ length: count }, (_, index) => ({
    id: `question-${index}`,
    userIsRight: rng() < userRightRate,
  }))
}
