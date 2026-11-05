/**
 * Post-training on a task with a verifiable answer.
 *
 * Assignment 5 of CS336 is about alignment and reasoning, and its two stages
 * are supervised fine-tuning and reinforcement learning. Both are hard to see
 * inside a language model, so this module makes them small enough to compute
 * exactly: the policy is a softmax over a handful of *candidate reasoning
 * traces* for an arithmetic problem, and the reward comes from a verifier that
 * reads the answer off the trace and checks it against the arithmetic.
 *
 * The policy is tabular on purpose. It is not a language model, and the
 * interface says so. What it shares with one is the thing the assignment is
 * about: a distribution over responses, a demonstration set that covers part of
 * the input space, a verifier that can score any response, and the two update
 * rules that turn those into SFT and RL.
 *
 * The problem space is split by the parity of the sum. The demonstrations only
 * cover the even sums — a stand-in for the long tail every demonstration set
 * misses — so SFT learns the format on half the space and leaves the other half
 * at chance. The verifier covers both halves, which is why RL can improve the
 * half the demonstrations never showed.
 */

import { createRng } from '@llm-materials/course-core'
import type { Rng } from '@llm-materials/course-core'

/* ------------------------------------------------------------------- the task */

export interface Candidate {
  /** The strategy's position in the policy's action set. */
  id: number
  strategy: string
  trace: string
  answer: number
  /** Whether the verifier accepts the trace's answer. */
  correct: boolean
}

export interface Problem {
  id: number
  a: number
  b: number
  /** The answer the verifier checks against. */
  answer: number
  /** 0 for an even sum, 1 for an odd one. */
  parity: 0 | 1
  prompt: string
  candidates: Candidate[]
}

export const STRATEGIES = [
  { key: 'add', name: 'add the two numbers' },
  { key: 'subtract', name: 'subtract the second from the first' },
  { key: 'multiply', name: 'multiply the two numbers' },
  { key: 'off-by-one', name: 'add the two numbers and one' },
] as const

/** The number after the last `=` in a trace, or `NaN`. */
export function parseAnswer(trace: string): number {
  const equals = trace.lastIndexOf('=')
  if (equals < 0) return Number.NaN
  const value = Number(trace.slice(equals + 1).trim())
  return Number.isFinite(value) ? value : Number.NaN
}

/**
 * The verifier.
 *
 * It checks the *answer*, not the method. A trace that adds one to the sum is
 * rejected even though it begins with the right operation, which is the whole
 * point of a verifiable reward: it cannot be fooled by a plausible-looking
 * response.
 */
export function verifyTrace(problem: Problem, trace: string): boolean {
  return parseAnswer(trace) === problem.answer
}

/** Build one problem, with the four candidate traces. */
export function makeProblem(a: number, b: number, id = 0): Problem {
  const answer = a + b
  const traces = [
    `${a} + ${b} = ${answer}`,
    `${a} − ${b} = ${a - b}`,
    `${a} × ${b} = ${a * b}`,
    `${a} + ${b} = ${answer + 1}`,
  ]
  const problem: Problem = {
    id,
    a,
    b,
    answer,
    parity: (answer % 2 === 0 ? 0 : 1) as 0 | 1,
    prompt: `${a} + ${b}`,
    candidates: traces.map((trace, candidate) => ({
      id: candidate,
      strategy: STRATEGIES[candidate]!.name,
      trace,
      answer: parseAnswer(trace),
      correct: false,
    })),
  }
  for (const candidate of problem.candidates) {
    candidate.correct = verifyTrace(problem, candidate.trace)
  }
  return problem
}

/**
 * A set of problems.
 *
 * The numbers are drawn from 0 to 9, so a sum is at most 18 and the answer is
 * one or two characters — small enough that the candidate traces stay legible.
 * `parity` restricts the set to even or odd sums, which is how the
 * demonstration set is kept to half the space.
 */
export function makeProblems(
  count: number,
  seed = 1,
  parity?: 0 | 1,
): Problem[] {
  const rng = createRng(seed)
  const problems: Problem[] = []
  while (problems.length < count) {
    const a = 1 + Math.floor(rng() * 9)
    const b = 1 + Math.floor(rng() * 9)
    if (parity !== undefined && (a + b) % 2 !== parity) continue
    // A problem needs exactly one correct candidate, or the "correct trace"
    // is not well defined: at 2 and 2 the product is the sum as well.
    if (a * b === a + b || a - b === a + b) continue
    problems.push(makeProblem(a, b, problems.length))
  }
  return problems
}

/* ---------------------------------------------------------------- the policy */

/**
 * The policy's parameters: a score for each candidate strategy in each parity
 * context. Two contexts times four candidates is eight numbers.
 */
export type PolicyParameters = number[][]

export function initialPolicy(): PolicyParameters {
  return [
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]
}

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores)
  const exps = scores.map((score) => Math.exp(score - max))
  const total = exps.reduce((sum, value) => sum + value, 0)
  return exps.map((value) => value / total)
}

/** The distribution over the four candidate strategies in one context. */
export function policyProbabilities(parameters: PolicyParameters, parity: 0 | 1): number[] {
  return softmax(parameters[parity] ?? [0, 0, 0, 0])
}

/** The probability the policy gives to the correct trace of a problem. */
export function probabilityOfCorrect(parameters: PolicyParameters, problem: Problem): number {
  const probabilities = policyProbabilities(parameters, problem.parity)
  let probability = 0
  for (const candidate of problem.candidates) {
    if (candidate.correct) probability += probabilities[candidate.id] ?? 0
  }
  return probability
}

export interface PolicyReport {
  /** The expected accuracy over the problems: the probability of the correct trace. */
  accuracy: number
  /** The same, over the even problems only. */
  even: number
  /** The same, over the odd problems only. */
  odd: number
  /** The mean entropy of the policy's distributions, in nats. */
  entropy: number
  perProblem: { id: number; parity: 0 | 1; probability: number }[]
}

/** Score a policy on a set of problems. */
export function evaluatePolicy(parameters: PolicyParameters, problems: Problem[]): PolicyReport {
  let total = 0
  let even = 0
  let evenCount = 0
  let odd = 0
  let oddCount = 0
  let entropy = 0
  const perProblem: PolicyReport['perProblem'] = []

  for (const problem of problems) {
    const probability = probabilityOfCorrect(parameters, problem)
    total += probability
    if (problem.parity === 0) {
      even += probability
      evenCount++
    } else {
      odd += probability
      oddCount++
    }
    const distribution = policyProbabilities(parameters, problem.parity)
    entropy += -distribution.reduce((sum, p) => sum + (p > 0 ? p * Math.log(p) : 0), 0)
    perProblem.push({ id: problem.id, parity: problem.parity, probability })
  }

  const count = Math.max(1, problems.length)
  return {
    accuracy: total / count,
    even: evenCount === 0 ? 0 : even / evenCount,
    odd: oddCount === 0 ? 0 : odd / oddCount,
    entropy: entropy / count,
    perProblem,
  }
}

/* ---------------------------------------------------------------------- SFT */

export interface SftOptions {
  epochs?: number
  learningRate?: number
}

export interface SftStep {
  epoch: number
  loss: number
  accuracy: number
}

export interface SftResult {
  parameters: PolicyParameters
  history: SftStep[]
}

/**
 * Supervised fine-tuning: raise the log-probability of the demonstrated trace.
 *
 * The loss is the cross-entropy of the demonstration's correct candidate under
 * the policy, and its gradient with respect to the scores is the policy's
 * probabilities minus the one-hot target — the same gradient every
 * classifier's cross-entropy produces. There is no reward and no sampling
 * here; the demonstrations are the whole signal.
 */
export function supervisedFineTune(
  parameters: PolicyParameters,
  demonstrations: Problem[],
  options: SftOptions = {},
): SftResult {
  const epochs = options.epochs ?? 40
  const learningRate = options.learningRate ?? 1
  const updated: PolicyParameters = parameters.map((row) => row.slice())
  const history: SftStep[] = []

  for (let epoch = 0; epoch < epochs; epoch++) {
    const gradient: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    for (const problem of demonstrations) {
      const probabilities = policyProbabilities(updated, problem.parity)
      const target = problem.candidates.find((candidate) => candidate.correct)!.id
      for (let candidate = 0; candidate < 4; candidate++) {
        gradient[problem.parity]![candidate]! += (probabilities[candidate] ?? 0) - (candidate === target ? 1 : 0)
      }
    }
    const scale = learningRate / Math.max(1, demonstrations.length)
    for (let parity = 0; parity < 2; parity++) {
      for (let candidate = 0; candidate < 4; candidate++) {
        updated[parity]![candidate]! -= scale * gradient[parity]![candidate]!
      }
    }

    const report = evaluatePolicy(updated, demonstrations)
    history.push({
      epoch: epoch + 1,
      loss: -Math.log(Math.max(1e-12, report.accuracy)),
      accuracy: report.accuracy,
    })
  }

  return { parameters: updated, history }
}

/* ----------------------------------------------------------------------- RL */

export interface RlOptions {
  steps?: number
  batchSize?: number
  learningRate?: number
  seed?: number
  /** How quickly the reward baseline follows the batch mean. */
  baselineRate?: number
}

export interface RlStep {
  step: number
  /** The mean verifier reward in the batch. */
  reward: number
  /** The expected accuracy over the whole problem set. */
  accuracy: number
  /** The baseline the reward was measured against. */
  baseline: number
  /** The mean entropy of the policy after the update. */
  entropy: number
}

export interface RlResult {
  parameters: PolicyParameters
  history: RlStep[]
}

/**
 * REINFORCE with a moving-average baseline.
 *
 * For each sampled problem the policy picks a trace, the verifier accepts or
 * rejects its answer, and the scores move in the direction that makes the
 * sampled trace more or less likely — weighted by how much the reward beat the
 * baseline. The baseline is what keeps the variance manageable: without it, a
 * batch of successes would push every trace up, including the wrong ones.
 */
export function reinforce(
  parameters: PolicyParameters,
  problems: Problem[],
  options: RlOptions = {},
): RlResult {
  const steps = options.steps ?? 80
  const batchSize = options.batchSize ?? 32
  const learningRate = options.learningRate ?? 0.5
  const baselineRate = options.baselineRate ?? 0.1
  const rng = createRng(options.seed ?? 3)
  const updated: PolicyParameters = parameters.map((row) => row.slice())
  const history: RlStep[] = []
  let baseline = 0.25

  for (let step = 0; step < steps; step++) {
    const gradient: number[][] = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ]
    let rewardTotal = 0

    for (let sample = 0; sample < batchSize; sample++) {
      const problem = problems[Math.floor(rng() * problems.length)]!
      const probabilities = policyProbabilities(updated, problem.parity)
      const chosen = sampleIndex(rng, probabilities)
      const reward = problem.candidates[chosen]!.correct ? 1 : 0
      rewardTotal += reward
      const advantage = reward - baseline
      for (let candidate = 0; candidate < 4; candidate++) {
        gradient[problem.parity]![candidate]! +=
          advantage * ((candidate === chosen ? 1 : 0) - (probabilities[candidate] ?? 0))
      }
    }

    const scale = learningRate / Math.max(1, batchSize)
    for (let parity = 0; parity < 2; parity++) {
      for (let candidate = 0; candidate < 4; candidate++) {
        updated[parity]![candidate]! += scale * gradient[parity]![candidate]!
      }
    }

    const reward = rewardTotal / Math.max(1, batchSize)
    baseline = (1 - baselineRate) * baseline + baselineRate * reward
    const report = evaluatePolicy(updated, problems)
    history.push({ step: step + 1, reward, accuracy: report.accuracy, baseline, entropy: report.entropy })
  }

  return { parameters: updated, history }
}

/** Draw an index from a categorical distribution. */
export function sampleIndex(rng: Rng, probabilities: number[]): number {
  const total = probabilities.reduce((sum, value) => sum + value, 0)
  let draw = rng() * total
  for (let index = 0; index < probabilities.length; index++) {
    draw -= probabilities[index] ?? 0
    if (draw <= 0) return index
  }
  return probabilities.length - 1
}

/* ---------------------------------------------------------------- diagnostics */

/** The mean KL divergence from one policy to another over the two contexts. */
export function policyKl(reference: PolicyParameters, other: PolicyParameters): number {
  let total = 0
  for (const parity of [0, 1] as const) {
    const referenceProbabilities = policyProbabilities(reference, parity)
    const otherProbabilities = policyProbabilities(other, parity)
    for (let candidate = 0; candidate < 4; candidate++) {
      const p = referenceProbabilities[candidate] ?? 0
      const q = otherProbabilities[candidate] ?? 0
      if (p > 0 && q > 0) total += p * Math.log(p / q)
    }
  }
  return total / 2
}
