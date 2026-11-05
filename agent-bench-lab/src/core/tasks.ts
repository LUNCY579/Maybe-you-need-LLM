/**
 * A benchmark, and the statistics of measuring one.
 *
 * A benchmark is a set of tasks with a verdict for each. Everything else —
 * the difficulty mix, the number of tasks, the confidence interval on the
 * score, the number of samples needed to see a difference — follows from
 * that, and all of it is computable.
 *
 * The tasks here are synthetic: each has a set of files, a patch that fixes
 * it, and a test suite that decides whether the patch worked. That is enough
 * to make every claim in the course checkable.
 */

import { createRng } from '@llm-materials/course-core'

export interface Task {
  id: number
  /** The difficulty: the number of attempts a solver needs, on average. */
  difficulty: number
  /** The files of the repository the task touches. */
  files: string[]
  /** The test that must go from failing to passing. */
  failingTest: string
  /** The tests that must keep passing. */
  passingTests: string[]
  /** The patch that fixes the task. */
  patch: Patch
  /** Whether the task's solution appears in the training corpus. */
  contaminated: boolean
}

export interface Patch {
  /** The file the patch changes. */
  file: string
  /** What the patch does. */
  change: 'fix' | 'break-test' | 'break-other' | 'none'
}

export interface TaskSetOptions {
  /** The number of tasks. */
  size?: number
  /** The seed. */
  seed?: number
  /** The fraction of the tasks that are contaminated. */
  contamination?: number
}

export interface TaskSet {
  tasks: Task[]
  /** The number of files in every repository. */
  files: string[]
}

/** Build the task set. */
export function buildTaskSet(options: TaskSetOptions = {}): TaskSet {
  const settings = { size: 60, seed: 3, contamination: 0.1, ...options }
  const rng = createRng(settings.seed)
  const files = ['core.py', 'utils.py', 'api.py', 'models.py', 'views.py', 'jobs.py', 'parser.py', 'cache.py']

  const tasks: Task[] = []
  for (let id = 0; id < settings.size; id++) {
    const count = 1 + Math.floor(rng() * 3)
    const touched: string[] = []
    for (let i = 0; i < count; i++) touched.push(files[Math.floor(rng() * files.length)]!)
    tasks.push({
      id,
      difficulty: rng(),
      files: [...new Set(touched)],
      failingTest: `test_${['fix', 'handle', 'parse', 'index'][Math.floor(rng() * 4)]}_${id}`,
      passingTests: Array.from({ length: 2 + Math.floor(rng() * 5) }, () => `test_other_${Math.floor(rng() * 50)}`),
      patch: { file: '', change: 'none' },
      contaminated: rng() < settings.contamination,
    })
  }

  // The patch that fixes each task is known: it changes one of the files the
  // task touches.
  for (const task of tasks) {
    task.patch = { file: task.files[Math.floor(rng() * task.files.length)]!, change: 'fix' }
  }

  return { tasks, files }
}

/* -------------------------------------------------------------------------- */
/* The statistics of a score                                                   */
/* -------------------------------------------------------------------------- */

export interface Interval {
  /** The point estimate. */
  estimate: number
  /** The lower end of the interval. */
  low: number
  /** The upper end of the interval. */
  high: number
  /** The width of the interval. */
  width: number
}

/**
 * The Wilson score interval for a proportion.
 *
 * The normal approximation is the wrong one near zero and near one, which is
 * exactly where a benchmark's score often is: a system that solves two tasks
 * out of two hundred has a score of one per cent, and the interval the normal
 * approximation gives is nonsense.
 */
export function wilsonInterval(successes: number, trials: number, z = 1.96): Interval {
  if (trials <= 0) return { estimate: 0, low: 0, high: 0, width: 0 }
  const estimate = successes / trials
  const denominator = 1 + (z * z) / trials
  const centre = estimate + (z * z) / (2 * trials)
  const spread = z * Math.sqrt((estimate * (1 - estimate)) / trials + (z * z) / (4 * trials * trials))
  const low = Math.max(0, (centre - spread) / denominator)
  const high = Math.min(1, (centre + spread) / denominator)
  return { estimate, low, high, width: high - low }
}

/**
 * The number of tasks needed to tell two systems apart.
 *
 * The question is the one every benchmark paper has to answer: with this many
 * tasks, is a difference of this size distinguishable from the noise? The
 * answer is the smallest sample whose interval is narrower than the difference.
 */
export function tasksNeededForDifference(
  difference: number,
  options: { rate?: number; confidence?: number } = {},
): number {
  const settings = { rate: 0.3, confidence: 1.96, ...options }
  for (let n = 10; n < 20000; n += 10) {
    const interval = wilsonInterval(Math.round(settings.rate * n), n, settings.confidence)
    if (interval.width / 2 < difference) return n
  }
  return 20000
}

/**
 * The probability that the better system really is better.
 *
 * A paired comparison: the same tasks, two systems, and the number of tasks
 * on which they disagree. The exact test is the sign test over the
 * disagreements.
 */
export function pairedSignTest(
  wins: number,
  losses: number,
): { p: number; total: number; better: boolean } {
  const total = wins + losses
  if (total === 0) return { p: 1, total, better: false }
  const smaller = Math.min(wins, losses)
  let tail = 0
  for (let i = 0; i <= smaller; i++) {
    tail += binomialProbability(total, i)
  }
  const p = Math.min(1, 2 * tail)
  return { p, total, better: wins > losses && p < 0.05 }
}

/** The probability of exactly k successes in n trials, at rate p. */
export function binomialProbability(n: number, k: number, p = 0.5): number {
  let coefficient = 1
  for (let i = 0; i < k; i++) coefficient = (coefficient * (n - i)) / (i + 1)
  return coefficient * p ** k * (1 - p) ** (n - k)
}

/**
 * The unbiased estimate of pass@k from a smaller number of samples.
 *
 * When a solver is run once per task, the estimate of pass@k is biased
 * upwards; the unbiased estimator corrects for it, and the correction is what
 * makes two different sample budgets comparable.
 */
export function passAtK(successes: number[], samples: number, k: number): number {
  if (k > samples) return NaN
  let total = 0
  for (const count of successes) {
    const failures = samples - count
    total += 1 - binomialCoefficient(failures, k) / binomialCoefficient(samples, k)
  }
  return total / successes.length
}

/**
 * pass^k: the probability that all k trials on a task succeed.
 *
 * This is the reliability question rather than the capability one. pass@k asks
 * whether a solver can succeed once in k tries; pass^k asks whether it succeeds
 * every time, which is what an agent a user has to rely on must do. For a task
 * with c successes in n samples the unbiased estimate is C(c,k)/C(n,k), and the
 * set's estimate is the mean over tasks.
 */
export function passPowerK(successes: number[], samples: number, k: number): number {
  if (k > samples) return NaN
  if (successes.length === 0) return NaN
  let total = 0
  for (const count of successes) {
    total += binomialCoefficient(count, k) / binomialCoefficient(samples, k)
  }
  return total / successes.length
}

/** The binomial coefficient, for the pass@k estimator. */
export function binomialCoefficient(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  let result = 1
  for (let i = 0; i < k; i++) result = (result * (n - i)) / (i + 1)
  return result
}

/**
 * The number of tasks a benchmark needs for a given precision.
 *
 * The width of the interval around a score falls as the square root of the
 * number of tasks, so doubling the tasks buys a factor of the square root in
 * precision. The table is the argument for a benchmark of a given size.
 */
export function precisionTable(successes: number, trials: number): { n: number; width: number }[] {
  const rows: { n: number; width: number }[] = []
  for (let n = 10; n <= trials; n += Math.max(1, Math.floor(trials / 20))) {
    const scaled = Math.round((successes / trials) * n)
    rows.push({ n, width: wilsonInterval(scaled, n).width })
  }
  return rows
}
