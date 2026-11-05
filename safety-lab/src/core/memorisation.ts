/**
 * Memorisation: who can tell, and what they can take back.
 *
 * Two questions the extraction literature asks about the same fact. The first
 * is an attack on the *training set*: given a record and a model, decide
 * whether the model was trained on it. The second is an attack on the record
 * itself: given a prefix, make the model say the rest back. Both are governed
 * by one quantity — how many times the model saw that sequence — and the
 * laboratory computes what each attack is worth as that number moves.
 *
 * The model is a count model, and it is worth being explicit about why that is
 * not a cheat. A model that has seen a continuation `c` times, under a uniform
 * prior over `T` possibilities, puts probability
 *
 *     (c + prior/T) / (c + prior)
 *
 * on it: exactly one over `T` at `c = 0`, and one as `c` grows. Everything the
 * two attacks can do follows from that curve, so the toy does not stand in for
 * the mechanism — it *is* the mechanism, at a size where the answer can be
 * checked by hand.
 *
 * What the laboratory then shows is the shape of the result. With a prior of
 * eight over sixteen tokens, a record seen once is given one in six and a record
 * seen sixteen times two in three, against one in sixteen for anything the model
 * has never seen — so the gap the attacks feed on is eleven to one at the top of
 * the duplication range and under three to one for a record seen once, and it
 * opens entirely along the duplication axis. An attacker who has a copy of the
 * record gets a one-sided test at a single query: the model either says it back
 * or it does not, and a model that says a never-seen record back does so one
 * time in sixteen. Give the same attacker sixteen queries and the test becomes
 * a rate rather than a coin, which is where the real numbers come from. Power
 * is bought with queries, near-duplicates cost precision, and both of those are
 * curves this file computes.
 */

import { createRng } from '@llm-materials/course-core'

/** The number of tokens the toy model chooses between. */
export const TOKENS = 16

/**
 * The prior mass, in pseudocounts: how many copies of *something else* the
 * model believes before it has seen this record at all.
 *
 * It is eight rather than one because one is a model that memorises on sight,
 * and the whole interest of the result is in the gap between seeing a record
 * once and seeing it sixteen times.
 */
export const PRIOR = 8

/**
 * The probability a model gives the continuation it has seen `count` times.
 *
 * One over the alphabet when it has never seen it, and one when it has seen
 * only that. This is the only function in the file that models a mind; the
 * rest is what an attacker can do with it.
 */
export function continuationProbability(count: number, options: { tokens?: number; prior?: number } = {}): number {
  const tokens = options.tokens ?? TOKENS
  const prior = options.prior ?? PRIOR
  const copies = Math.max(0, count)
  return (copies + prior / tokens) / (copies + prior)
}

/**
 * A record, and what the model queried does with it.
 *
 * `probability` is the model's own number: the chance that it says this
 * record's continuation when prompted with its prefix. A member of the
 * training set got there by being in it `count` times; a near-duplicate got
 * there by resembling something that was; an outsider has nothing but the
 * prior.
 */
export interface Candidate {
  id: string
  /** The continuation the attacker is testing for. */
  continuation: number
  /** How many times the model saw this exact record. */
  count: number
  /** The model's probability for the continuation. */
  probability: number
  /** Whether it really was in the training set — the secret the attack guesses. */
  member: boolean
}

/**
 * How many times out of `queries` the model said this record back.
 *
 * A real attacker does not get one token out of a model; they get a window of
 * them, and they count. The count is a binomial with the model's own
 * probability as its parameter, which is what makes the rest of this file
 * checkable rather than merely plausible.
 */
export function sampleContinuation(candidate: Candidate, queries: number, seed: number): number {
  const rng = createRng(seed)
  let verbatim = 0
  for (let query = 0; query < Math.max(0, Math.floor(queries)); query++) if (rng() < candidate.probability) verbatim++
  return verbatim
}

/**
 * One sampled query: does the model say the record back?
 *
 * This is the one-query case of `sampleContinuation`, and the chance of a true
 * answer is the model's own probability for this continuation — an outsider is
 * caught exactly as often as it looks like a member, which is one time in `T`.
 * Nothing in this file needs a second draw to explain itself, and the
 * arithmetic line in `duplicationCurve` is only a check if that is true.
 */
export function emitsVerbatim(candidate: Candidate, seed: number): boolean {
  return sampleContinuation(candidate, 1, seed) > 0
}

/**
 * The attacker's estimate of the probability, from the count.
 *
 * Jeffreys smoothing: a record that never came back is not assigned zero, which
 * would make its log-ratio minus infinity and the ordering of the candidates
 * depend on how many of them got no hits. The smoothing changes no ranking —
 * every candidate is estimated from the same number of queries — it only keeps
 * the scores finite.
 */
export function estimatedProbability(verbatim: number, queries: number): number {
  return (verbatim + 0.5) / (queries + 1)
}

/**
 * What the attacker can see.
 *
 * The reference model is a second model trained without this record, and its
 * probability is the baseline: what a model says by chance. The score is the
 * log of the ratio, which is the prediction-difference attack at temperature
 * zero — the strongest form the paper reports, and the one that needs no
 * gradient access.
 */
export function attackScore(candidate: Candidate, reference: number): number {
  return Math.log(candidate.probability / reference)
}

/**
 * The score a candidate has to beat.
 *
 * Not zero. The attacker's estimate is a count over a finite budget, and a
 * baseline model is expected to return `reference × queries` hits on its own —
 * one hit in sixteen queries, for instance. A candidate that matches that is
 * saying nothing, and a candidate that merely *looks* better than a model that
 * never saw the record is the false positive the whole literature is careful
 * about. So the line is the baseline's own estimate, smoothed the same way as
 * the candidate's, and a candidate at exactly the baseline lands on it and is
 * not flagged.
 */
export function baselineThreshold(reference: number, queries: number): number {
  return Math.log((reference * queries + 0.5) / (queries + 1) / reference)
}

export interface AttackResult {
  /** The candidates the attack called members. */
  flagged: number
  /** The queries each candidate was given, so a result can be compared at equal cost. */
  queries: number
  /** The share of the real members it caught. */
  truePositiveRate: number
  /** The share of the outsiders it wrongly caught. */
  falsePositiveRate: number
  /** Right answers over all answers, which is the number a leaderboard would show. */
  accuracy: number
  /** Of the things it called a member, how many were. */
  precision: number
  /** The chance a random member outscores a random outsider: the threshold-free version. */
  auc: number
}

/**
 * The attack, run over a set of candidates.
 *
 * `reference` is what the attacker's baseline model gives the same continuation,
 * and the whole shape of the result depends on it: a lower baseline makes every
 * gap look like memorisation. It is passed in rather than assumed because it is
 * the attacker's choice, not the victim's.
 *
 * `queries` is the other half of that choice. At one query the statistic is a
 * coin — a member clears the line exactly as often as it happens to say the
 * record back — so a clean corpus gives an attack barely better than chance no
 * matter how much duplication it contains. Power is bought with queries, and
 * the curve of AUC against query count is the number the defence budget is
 * actually set by. The default `threshold` moves with the budget, because a
 * line drawn against one is meaningless against the other.
 */
export function membershipAttack(
  candidates: Candidate[],
  options: { reference?: number; threshold?: number; seed?: number; queries?: number } = {},
): AttackResult {
  const reference = options.reference ?? 1 / TOKENS
  const queries = options.queries ?? 16
  const threshold = options.threshold ?? baselineThreshold(reference, queries)
  const seed = options.seed ?? 5

  let truePositive = 0
  let members = 0
  let falsePositive = 0
  let outsiders = 0
  let correct = 0
  let flagged = 0

  const scores: { score: number; member: boolean }[] = candidates.map((candidate, index) => {
    const verbatim = sampleContinuation(candidate, queries, seed + index * 977)
    return {
      score: Math.log(estimatedProbability(verbatim, queries) / reference),
      member: candidate.member,
    }
  })

  for (const entry of scores) {
    const called = entry.score > threshold
    if (called) flagged++
    if (entry.member) {
      members++
      if (called) truePositive++
    } else {
      outsiders++
      if (called) falsePositive++
    }
    if (called === entry.member) correct++
  }

  let wins = 0
  let pairs = 0
  for (const member of scores.filter((entry) => entry.member)) {
    for (const outsider of scores.filter((entry) => !entry.member)) {
      pairs++
      if (member.score > outsider.score) wins++
      else if (member.score === outsider.score) wins += 0.5
    }
  }

  return {
    flagged,
    queries,
    truePositiveRate: members === 0 ? 0 : truePositive / members,
    falsePositiveRate: outsiders === 0 ? 0 : falsePositive / outsiders,
    accuracy: scores.length === 0 ? 0 : correct / scores.length,
    precision: flagged === 0 ? 0 : truePositive / flagged,
    auc: pairs === 0 ? 0 : wins / pairs,
  }
}

/**
 * Verbatim extraction: the share of the records the model gives back whole.
 *
 * The same probability, the same query, a different question. Membership asks
 * whether a record was seen; extraction asks how much of the corpus an attacker
 * can walk away with. They move together, and the curve is the reason the two
 * papers are read as one argument.
 */
export function extractionAccuracy(candidates: Candidate[], options: { seed?: number } = {}): number {
  const seed = options.seed ?? 5
  if (candidates.length === 0) return 0
  let recovered = 0
  candidates.forEach((candidate, index) => {
    if (emitsVerbatim(candidate, seed + index * 977)) recovered++
  })
  return recovered / candidates.length
}

/**
 * The same rate before anyone draws a sample.
 *
 * Extraction is a mean of independent Bernoullis, so its expectation is the
 * mean of the probabilities — no simulation needed. The pair is the check the
 * laboratory runs on itself: `extractionAccuracy` on a real corpus should sit
 * within noise of this, and if it does not, the sampling is broken rather than
 * the phenomenon.
 */
export function expectedExtraction(candidates: Candidate[]): number {
  if (candidates.length === 0) return 0
  return candidates.reduce((sum, candidate) => sum + candidate.probability, 0) / candidates.length
}

/**
 * The two curves against the duplication rate.
 *
 * One record seen `count` times, queried by an attacker who has the reference
 * model's baseline: the membership score and the extraction rate, at every
 * `count`. `probability` is the expected extraction rate and `observed` the
 * sampled one, so the two disagreeing by more than noise is a bug in this file
 * rather than a finding. The score grows with the logarithm of the same
 * probability, which is why the two curves that the literature reports
 * separately have the same axis.
 */
export function duplicationCurve(
  counts: number[],
  options: { samples?: number; seed?: number; member?: boolean } = {},
): { count: number; probability: number; observed: number; score: number }[] {
  const samples = options.samples ?? 200
  const seed = options.seed ?? 11
  return counts.map((count) => {
    const probability = continuationProbability(count)
    const candidate: Candidate = {
      id: `dup-${count}`,
      continuation: 0,
      count,
      probability,
      member: options.member ?? count > 0,
    }
    let recovered = 0
    for (let index = 0; index < samples; index++) {
      if (emitsVerbatim(candidate, seed + index)) recovered++
    }
    return { count, probability, observed: recovered / samples, score: attackScore(candidate, 1 / TOKENS) }
  })
}

/**
 * Attack power against the attacker's budget.
 *
 * The same corpus queried a different number of times, with the decision line
 * redrawn at each budget so that the rows are comparable as tests of the same
 * strength. The curve is the honest version of the result: the papers'
 * near-perfect AUCs are the far end of it, and the defence that a rate limit
 * buys is the near end. Every row reuses one seed, so a row that moves the AUC
 * by less than the noise between two neighbouring budgets has not moved it.
 */
export function queryCurve(
  candidates: Candidate[],
  queries: number[],
  options: { reference?: number; threshold?: number; seed?: number } = {},
): { queries: number; auc: number; truePositiveRate: number; falsePositiveRate: number; precision: number; flagged: number }[] {
  return queries.map((count) => {
    const result = membershipAttack(candidates, { ...options, queries: count })
    return {
      queries: count,
      auc: result.auc,
      truePositiveRate: result.truePositiveRate,
      falsePositiveRate: result.falsePositiveRate,
      precision: result.precision,
      flagged: result.flagged,
    }
  })
}

/**
 * A corpus, with a duplication rate you can set.
 *
 * `repeatShare` is the fraction of the records that appear more than once, and
 * `nearDuplicateShare` is the fraction of the *outsiders* that resemble a
 * trained record closely enough to raise its probability without being in the
 * set. The second is the one that makes the attack honest: a corpus with no
 * near-duplicates gives a test that cannot fail, and a real corpus has plenty.
 */
export function buildCorpus(
  count = 80,
  options: { repeatShare?: number; maxCount?: number; nearDuplicateShare?: number; seed?: number } = {},
): Candidate[] {
  const repeatShare = options.repeatShare ?? 0.35
  const maxCount = options.maxCount ?? 16
  const nearDuplicateShare = options.nearDuplicateShare ?? 0.25
  const rng = createRng(options.seed ?? 13)

  const candidates: Candidate[] = []
  for (let index = 0; index < count; index++) {
    const member = rng() < 0.5
    let copies = 0
    if (member) copies = rng() < repeatShare ? 2 + Math.floor(rng() * (maxCount - 1)) : 1
    const nearDuplicate = !member && rng() < nearDuplicateShare
    candidates.push({
      id: `record-${index}`,
      continuation: Math.floor(rng() * TOKENS),
      count: copies,
      probability: member ? continuationProbability(copies) : nearDuplicate ? continuationProbability(1) * 0.6 : 1 / TOKENS,
      member,
    })
  }
  return candidates
}
