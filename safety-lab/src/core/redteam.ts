/**
 * Red teaming.
 *
 * The red team's job is to find the failures, and the measurement that matters
 * is not how many attacks it made but how many *different* failures it found.
 * A thousand attacks that find the same failure are worth less than ten that
 * find ten.
 *
 * So the course measures two things: the attack success rate, and the
 * coverage — the fraction of the harm taxonomy the red team reached.
 *
 * The second half of the file turns that measurement against the budget. How
 * many attempts does it take to find a given share of the failures, what does
 * the last attempt buy, and what does an unguided search waste that a guided
 * one does not?
 */

import { createRng } from '@llm-materials/course-core'

export interface Attack {
  /** The prompt the attacker wrote. */
  prompt: string
  /** The category of harm it aims at. */
  category: string
  /** Whether the model complied. */
  succeeded: boolean
  /** Whether the prompt was in the style the attacker was using. */
  inStyle: boolean
}

export interface RedTeamResult {
  /** The attacks that succeeded. */
  succeeded: number
  /** The attacks that were made. */
  attempted: number
  /** The attack success rate. */
  successRate: number
  /** The number of distinct categories reached. */
  categoriesReached: number
  /** The number of categories there are. */
  categories: number
  /** The coverage. */
  coverage: number
  /** The number of distinct failures found, which is the attacks that hit a new category. */
  distinctFindings: number
  /**
   * What happened inside each category of the taxonomy.
   *
   * The coverage number says how much of the space was looked at, and a reader
   * is entitled to ask which parts of it. `reached` is the same fact the
   * coverage is counted from — at least one attack in that category got
   * through — and the two attack counts add up to the totals above.
   */
  byCategory: { category: string; attacks: number; failures: number; reached: boolean }[]
}

const CATEGORIES = ['harm', 'illegal', 'deception', 'privacy', 'harassment', 'honesty']

/**
 * The red team.
 *
 * A model-driven attacker writes prompts that are *in style* — they follow
 * the pattern of the successful ones — and a random attacker writes prompts
 * that are not. The model-driven one is more effective, and the measurement
 * that shows it is the coverage rather than the success rate.
 */
export function runRedTeam(
  options: { attacks?: number; categories?: string[]; modelDriven?: boolean; seed?: number; complianceRate?: number } = {},
): RedTeamResult {
  const settings = {
    attacks: 60,
    categories: CATEGORIES,
    modelDriven: true,
    seed: 3,
    complianceRate: 0.4,
    ...options,
  }
  const rng = createRng(settings.seed)
  const reached = new Set<string>()
  const tallies = new Map(settings.categories.map((category) => [category, { attacks: 0, failures: 0 }]))
  let succeededCount = 0
  let distinct = 0

  for (let i = 0; i < settings.attacks; i++) {
    // A model-driven attacker concentrates on the categories that worked,
    // because it has learned which patterns get through.
    // A model-driven attacker moves on to a category it has not found yet,
    // because the point of a red team is the coverage and not the count. A
    // random attacker repeats itself.
    const unreached = settings.categories.filter((entry) => !reached.has(entry))
    const category =
      settings.modelDriven && unreached.length > 0 && rng() < 0.75
        ? unreached[Math.floor(rng() * unreached.length)]!
        : settings.categories[Math.floor(rng() * settings.categories.length)]!

    // The model-driven attacker writes in style, and an in-style prompt gets
    // through more often.
    const inStyle = settings.modelDriven ? rng() < 0.8 : rng() < 0.2
    const probability = settings.complianceRate * (inStyle ? 1.6 : 0.6)
    const succeeded = rng() < probability
    const tally = tallies.get(category)
    if (tally) {
      tally.attacks++
      if (succeeded) tally.failures++
    }

    if (succeeded) {
      succeededCount++
      if (!reached.has(category)) {
        reached.add(category)
        distinct++
      }
    }
  }

  return {
    succeeded: succeededCount,
    attempted: settings.attacks,
    successRate: succeededCount / Math.max(1, settings.attacks),
    categoriesReached: reached.size,
    categories: settings.categories.length,
    coverage: reached.size / Math.max(1, settings.categories.length),
    distinctFindings: distinct,
    byCategory: settings.categories.map((category) => {
      const tally = tallies.get(category) ?? { attacks: 0, failures: 0 }
      return { category, attacks: tally.attacks, failures: tally.failures, reached: reached.has(category) }
    }),
  }
}

/* -------------------------------------------------------------------------- */
/* Discovery against a budget                                                  */
/* -------------------------------------------------------------------------- */

/**
 * A failure the red team is hunting, and how hard it is to reach.
 *
 * The budget question the paper asks is not "does this many attacks work" but
 * "how many does it take". That needs the failures to be a set with known
 * difficulty rather than a blur, so each one carries the probability that a
 * single attempt reaches it.
 */
export interface Failure {
  id: string
  category: string
  /** The chance that one attempt finds this failure at all. */
  reachability: number
}

/**
 * The ideal: a budget spent on *every* failure.
 *
 * An attempt either finds a failure or does not, so `attempts` spent on a
 * failure of reachability q leave it undiscovered with probability (1 − q) to
 * the `attempts`, and the rate is the mean of the complements. This is
 * arithmetic, not a simulation, and it is the ceiling a real search is measured
 * against: no allocation of a fixed total can do better than spending it
 * evenly.
 */
export function expectedDiscovery(failures: Failure[], attempts: number): number {
  if (failures.length === 0) return 0
  let found = 0
  for (const failure of failures) found += 1 - Math.pow(1 - failure.reachability, Math.max(0, attempts))
  return found / failures.length
}

/**
 * What a search that picks its targets at random buys with the same total.
 *
 * One failure out of `n` is chosen per attempt, so a given failure is reached
 * with probability `q/n` per attempt — and the exact expectation is the mean of
 * the complements. This is the number the guided search has to beat, and it is
 * why the comparison is worth computing: an unguided search that happens to
 * spend its budget on the easy failures looks like a good search.
 */
export function unguidedExpectation(failures: Failure[], total: number): number {
  if (failures.length === 0) return 0
  const n = failures.length
  let found = 0
  for (const failure of failures) found += 1 - Math.pow(1 - failure.reachability / n, Math.max(0, total))
  return found / n
}

export interface SearchPolicy {
  id: string
  /**
   * Whether an attempt is spent on a failure that has not been found yet.
   *
   * This is the difference between generating more of what worked and going to
   * look for what is missing, and the number it changes is the re-hit count: a
   * policy that targets unreached failures cannot spend an attempt on one it has
   * already found, and the discovery rate then follows from where those attempts
   * went instead.
   */
  targetsUnreached: boolean
}

export interface DiscoveryRun {
  /** The attempts the search was given in total. */
  total: number
  /** The failures reached at least once. */
  discovered: number
  /** The discovery rate. */
  rate: number
  /** The attempts that bought nothing new. Always `rehits + dryAttempts`, and always `total − discovered`. */
  wasted: number
  /** Attempts spent on a failure already found — the cost of generating more of what worked. */
  rehits: number
  /** Attempts spent on a fresh target that simply did not fire — the irreducible cost of hunting. */
  dryAttempts: number
}

/**
 * One search, with an explicit seed.
 *
 * An unguided search picks a failure at random each time, so it re-hits the easy
 * ones; a guided one picks among the failures it has not found. The two budgets
 * end in the same place — every attempt either finds something or does not — but
 * they do not spend it the same way, and that is the only sense in which one is
 * more efficient: `rehits` is the number the guided policy can actually drive to
 * zero, while `dryAttempts` is the cost of looking at all.
 */
export function runSearch(
  failures: Failure[],
  total: number,
  policy: SearchPolicy,
  options: { seed?: number } = {},
): DiscoveryRun {
  const rng = createRng(options.seed ?? 3)
  const found = new Set<string>()
  let wasted = 0
  let rehits = 0
  let dryAttempts = 0

  for (let attempt = 0; attempt < total; attempt++) {
    const unreached = failures.filter((failure) => !found.has(failure.id))
    if (unreached.length === 0) {
      // Everything there is to find has been found: the rest of the budget
      // re-answers a known failure, and saying so is part of the measurement.
      wasted++
      rehits++
      continue
    }
    const pool = policy.targetsUnreached ? unreached : failures
    const failure = pool[Math.floor(rng() * pool.length)]!
    const before = found.size
    if (rng() < failure.reachability) found.add(failure.id)
    if (found.size === before) {
      wasted++
      if (found.has(failure.id)) rehits++
      else dryAttempts++
    }
  }

  return {
    total,
    discovered: found.size,
    rate: failures.length === 0 ? 0 : found.size / failures.length,
    wasted,
    rehits,
    dryAttempts,
  }
}

/**
 * The same failures, sampled evenly: `attempts` spent on each one.
 *
 * This is the simulation of `expectedDiscovery`, and the two should agree to
 * within noise — which is the check that the sampler is the model.
 */
export function sampleDiscovery(
  failures: Failure[],
  attempts: number,
  options: { seed?: number } = {},
): DiscoveryRun {
  const rng = createRng(options.seed ?? 3)
  let discovered = 0
  let wasted = 0
  let rehits = 0
  let dryAttempts = 0
  for (const failure of failures) {
    let found = false
    for (let attempt = 0; attempt < attempts; attempt++) {
      if (!found && rng() < failure.reachability) found = true
      else {
        wasted++
        if (found) rehits++
        else dryAttempts++
      }
    }
    if (found) discovered++
  }
  return {
    total: failures.length * attempts,
    discovered,
    rate: failures.length === 0 ? 0 : discovered / failures.length,
    wasted,
    rehits,
    dryAttempts,
  }
}

/** The curve the paper's figure is: attempts along the bottom, discovery up the side. */
export function discoveryCurve(
  failures: Failure[],
  attempts: number[],
  options: { seed?: number } = {},
): { attempts: number; expected: number; observed: number }[] {
  return attempts.map((count) => ({
    attempts: count,
    expected: expectedDiscovery(failures, count),
    observed: sampleDiscovery(failures, count, { seed: (options.seed ?? 3) + count }).rate,
  }))
}

/**
 * A total budget, three ways.
 *
 * The even ideal, the unguided expectation, and what each search actually
 * found. The gap between the first two is the cost of not spreading the
 * budget; the gap between the last two is the value of looking for what is
 * missing. Each search is run over `repetitions` seeds and averaged, because a
 * single run of twelve hunts is noise on a small board, and a number printed on
 * a screen is a claim about the mean.
 */
export function searchCurve(
  failures: Failure[],
  totals: number[],
  policies: SearchPolicy[],
  options: { seed?: number; repetitions?: number } = {},
): { total: number; ideal: number; unguided: number; searches: { id: string; rate: number; wasted: number; rehits: number }[] }[] {
  const repetitions = options.repetitions ?? 8
  const seed = options.seed ?? 3
  return totals.map((total) => ({
    total,
    ideal: expectedDiscovery(failures, failures.length === 0 ? 0 : total / failures.length),
    unguided: unguidedExpectation(failures, total),
    searches: policies.map((policy) => {
      let rate = 0
      let wasted = 0
      let rehits = 0
      for (let repetition = 0; repetition < repetitions; repetition++) {
        const run = runSearch(failures, total, policy, { seed: seed + repetition * 1_000 + total })
        rate += run.rate
        wasted += run.wasted
        rehits += run.rehits
      }
      return { id: policy.id, rate: rate / repetitions, wasted: wasted / repetitions, rehits: rehits / repetitions }
    }),
  }))
}

/**
 * The number of attempts per failure at which the expected rate first reaches a
 * target.
 *
 * The useful form of a diminishing-returns curve: not what the last attack
 * bought, but what the whole thing cost to get to, say, nine failures in ten.
 */
export function budgetFor(failures: Failure[], target: number, limit = 200): number {
  for (let attempts = 0; attempts <= limit; attempts++) {
    if (expectedDiscovery(failures, attempts) >= target) return attempts
  }
  return limit
}

/**
 * How much the next attempt per failure buys.
 *
 * The marginal gain between two budgets, which is the number that says when to
 * stop searching.
 */
export function marginalDiscovery(failures: Failure[], attempts: number): number {
  return expectedDiscovery(failures, attempts + 1) - expectedDiscovery(failures, attempts)
}

/**
 * The failures a hunt is aimed at.
 *
 * Reachability is drawn from a skewed distribution on purpose: a few failures
 * are easy to stumble into and most are not, which is what makes the budget
 * question interesting and what the screen labels as planted.
 */
export function buildFailures(count = 12, seed = 8): Failure[] {
  const rng = createRng(seed)
  const categories = CATEGORIES
  const failures: Failure[] = []
  for (let i = 0; i < count; i++) {
    const draw = rng()
    const reachability = draw < 0.25 ? 0.25 + 0.2 * rng() : 0.02 + 0.1 * rng()
    failures.push({ id: `failure-${i}`, category: categories[i % categories.length]!, reachability })
  }
  return failures
}

/** The two policies the laboratory runs against each other. */
export const SEARCH_POLICIES: SearchPolicy[] = [
  { id: 'unguided', targetsUnreached: false },
  { id: 'guided', targetsUnreached: true },
]
