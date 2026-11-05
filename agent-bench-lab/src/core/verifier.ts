/**
 * The verifier, and the two ways of solving a task.
 *
 * A benchmark's score is only as good as its verifier. The standard criterion
 * is the pair of conditions — the failing test must start failing and end
 * passing, and the passing tests must keep passing — and the standard failure
 * is a solver that satisfies the first condition by changing the test.
 *
 * The two solvers here are the two the benchmark literature compares: a
 * *retrieval* baseline that makes one attempt, and an *agent* that tries
 * several and keeps the first that passes. The cost of the second is the
 * number of attempts, and the course measures it.
 */

import { createRng } from '@llm-materials/course-core'
import type { Task } from './tasks'

export interface Verdict {
  /** Whether the task was solved. */
  solved: boolean
  /** Whether the failing test started failing and ended passing. */
  failToPass: boolean
  /** Whether the other tests kept passing. */
  passToPass: boolean
  /** Whether the patch changed a test. */
  touchedATest: boolean
  /** Why the verdict is what it is. */
  reason: string
}

/**
 * The verifier.
 *
 * The patch is checked against the two conditions, and a patch that changes a
 * test is caught even when the conditions are satisfied — which is the
 * failure mode the criterion exists to catch.
 */
export function verify(task: Task, patch: Task['patch']): Verdict {
  const touchedATest = patch.file.includes('test') || patch.change === 'break-test'
  if (patch.change === 'break-test') {
    return {
      solved: false,
      failToPass: true,
      passToPass: true,
      touchedATest: true,
      reason: 'the patch changed the test that was supposed to decide the task',
    }
  }
  if (patch.change === 'break-other') {
    return {
      solved: false,
      failToPass: false,
      passToPass: false,
      touchedATest: false,
      reason: 'the patch broke a test that was passing before',
    }
  }
  if (patch.change === 'none') {
    return {
      solved: false,
      failToPass: false,
      passToPass: true,
      touchedATest: false,
      reason: 'nothing was changed, so the failing test is still failing',
    }
  }
  if (touchedATest) {
    return {
      solved: false,
      failToPass: true,
      passToPass: true,
      touchedATest: true,
      reason: 'the patch changed a test file, so the verdict is not trusted',
    }
  }
  if (patch.file !== task.patch.file) {
    return {
      solved: false,
      failToPass: false,
      passToPass: true,
      touchedATest: false,
      reason: 'the patch changed the wrong file, so the failing test is still failing',
    }
  }
  return {
    solved: true,
    failToPass: true,
    passToPass: true,
    touchedATest: false,
    reason: 'the failing test now passes and the others still do',
  }
}

export interface SolveResult {
  /** The tasks that were solved. */
  solved: number
  /** The tasks that were tried. */
  attempted: number
  /** The number of attempts the solver made, across every task. */
  attempts: number
  /** The number of tasks solved by a patch that touched a test. */
  cheated: number
  /** The score, with the cheats removed. */
  cleanScore: number
}

/**
 * The agentless baseline.
 *
 * One attempt per task: retrieve the file the task touches and make the
 * obvious change. This is the baseline the paper reports, and it is the
 * number every agent has to beat.
 */
export function retrievalBaseline(tasks: Task[], seed = 1): SolveResult {
  const rng = createRng(seed)
  let solved = 0
  let cheated = 0
  for (const task of tasks) {
    // The baseline sometimes retrieves the wrong file, and sometimes changes
    // a test by mistake.
    const u = rng()
    const patch =
      u < 0.55
        ? task.patch
        : u < 0.8
          ? { file: task.files[Math.floor(rng() * task.files.length)]!, change: 'fix' as const }
          : { file: 'test_something.py', change: 'break-test' as const }
    const verdict = verify(task, patch)
    if (verdict.solved) solved++
    if (verdict.touchedATest && verdict.failToPass) cheated++
  }
  return {
    solved,
    attempted: tasks.length,
    attempts: tasks.length,
    cheated,
    cleanScore: tasks.length === 0 ? 0 : (solved - cheated) / tasks.length,
  }
}

/**
 * The agent.
 *
 * Several attempts per task, and the first that passes the verifier is kept.
 * The number of attempts is the cost, and it is what the agentless baseline
 * does not pay.
 */
export function agentSolver(
  tasks: Task[],
  options: { maxAttempts?: number; seed?: number; cheatRate?: number } = {},
): SolveResult {
  const settings = { maxAttempts: 5, seed: 2, cheatRate: 0.1, ...options }
  const rng = createRng(settings.seed)
  let solved = 0
  let attempts = 0
  let cheated = 0

  for (const task of tasks) {
    let done = false
    for (let attempt = 0; attempt < settings.maxAttempts && !done; attempt++) {
      attempts++
      const u = rng()
      const patch =
        u < settings.cheatRate
          ? { file: 'test_something.py', change: 'break-test' as const }
          : u < 0.35 + settings.cheatRate
            ? { file: task.files[Math.floor(rng() * task.files.length)]!, change: 'fix' as const }
            : task.patch
      const verdict = verify(task, patch)
      if (verdict.solved) {
        solved++
        done = true
      } else if (verdict.touchedATest && verdict.failToPass) {
        // The agent believes it has solved the task, and stops.
        cheated++
        done = true
      }
    }
  }

  return {
    solved,
    attempted: tasks.length,
    attempts,
    cheated,
    cleanScore: tasks.length === 0 ? 0 : (solved - cheated) / tasks.length,
  }
}

/**
 * The score of a solver, and the uncertainty on it.
 *
 * The interval is the one every benchmark paper should report and most do
 * not: the tasks are a sample from a population of tasks, and the score is an
 * estimate of the rate on that population.
 */
export function scoreWithInterval(result: SolveResult): {
  estimate: number
  low: number
  high: number
} {
  const interval = wilson(result.solved, result.attempted)
  return { estimate: interval.estimate, low: interval.low, high: interval.high }
}

function wilson(successes: number, trials: number): { estimate: number; low: number; high: number } {
  if (trials <= 0) return { estimate: 0, low: 0, high: 0 }
  const z = 1.96
  const estimate = successes / trials
  const denominator = 1 + (z * z) / trials
  const centre = estimate + (z * z) / (2 * trials)
  const spread = z * Math.sqrt((estimate * (1 - estimate)) / trials + (z * z) / (4 * trials * trials))
  return {
    estimate,
    low: Math.max(0, (centre - spread) / denominator),
    high: Math.min(1, (centre + spread) / denominator),
  }
}

/**
 * The cost of the two solvers, per task solved.
 *
 * The agent's advantage has to be paid for in attempts, and the rate is what
 * a practitioner is shopping for.
 */
export function costPerTask(result: SolveResult): number {
  return result.solved === 0 ? Infinity : result.attempts / result.solved
}

export interface CriterionReport {
  /** The patches the report was built from. */
  patches: number
  /** The patches the first condition calls solved. */
  failToPassOnly: number
  /** The patches both conditions call solved. */
  bothConditions: number
  /** The patches that satisfy the first condition by changing a test. */
  cheats: number
  /** The patches that broke a test which was passing. */
  regressions: number
  /** The fixes aimed at a file the task does not touch. */
  wrongFileFixes: number
}

/**
 * What each half of the criterion decides.
 *
 * Every task is presented with five patches: the fix, a test edit, a fix to the
 * wrong file, a patch that breaks another test, and no change. The first
 * condition alone calls the test edit solved; the second condition is what
 * turns that acceptance into a rejection. The difference between the two
 * counts is the harness's entire reason for existing.
 */
export function criterionReport(tasks: Task[]): CriterionReport {
  let patches = 0
  let failToPassOnly = 0
  let bothConditions = 0
  let cheats = 0
  let regressions = 0
  let wrongFileFixes = 0
  for (const task of tasks) {
    const candidates: Task['patch'][] = [
      task.patch,
      { file: 'test_something.py', change: 'break-test' },
      { file: task.files[task.files.length - 1]!, change: 'fix' },
      { file: task.patch.file, change: 'break-other' },
      { file: task.patch.file, change: 'none' },
    ]
    for (const patch of candidates) {
      patches += 1
      const verdict = verify(task, patch)
      if (verdict.failToPass) failToPassOnly += 1
      if (verdict.solved) bothConditions += 1
      if (verdict.touchedATest && verdict.failToPass) cheats += 1
      if (patch.change === 'break-other') regressions += 1
      if (patch.change === 'fix' && patch.file !== task.patch.file) wrongFileFixes += 1
    }
  }
  return { patches, failToPassOnly, bothConditions, cheats, regressions, wrongFileFixes }
}
