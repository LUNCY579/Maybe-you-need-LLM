/**
 * Reasoning depth: how long a chain of thought has to be before it stops paying.
 *
 * Two chapters make a claim and a warning about the same object.
 *
 *  - **Ch. 6 §6.1 and Ch. 9 §9.2.1.3 — the claim.** Chain-of-thought prompting is
 *    *interaction style C*: the prompt supplies examples of the intermediate
 *    *steps*, so the answer is conditioned on a reasoning chain the model wrote
 *    itself. It is not style A (the query and nothing else) and it is not style
 *    B or the ReAct loop, where an action puts a question to the world and an
 *    *observation comes back into the context*. In style C nothing external
 *    returns; the chain is the model talking to itself inside one generation.
 *  - **Ch. 23 §23.2.2, the paragraph the book titles "Overthinking" — the
 *    warning.** "Scaling studies into chain of thought also reveal limitations of
 *    more thinking effort. Chain of thought works better for some domains than
 *    for others [Sprague et al., 2024]. Furthermore, deeper reasoning may lead to
 *    overthinking, where the reasoning process becomes less effective as more
 *    effort is spent [Liu et al., 2024, Wu et al., 2025]."
 *
 * Both statements are about a *shape*, so both are computable. A chain of k steps
 * has to survive k steps; a step that carries more of the problem is more likely
 * to go wrong than a step that carries less; and an extra step that carries
 * nothing new cannot add information, it can only add a place to fail. That is
 * the whole mechanism, and it is enough to produce both the win on arithmetic and
 * symbolic work and the loss on knowledge, commonsense and open-ended writing.
 *
 * The three policies implemented here are the three the book names, and they map
 * onto the node kinds the workflow engine already has (`src/engine/workflow.ts`):
 *
 *  - **style A** — `input → reasoning → response`: one step, the whole problem.
 *  - **style C** — `input → reasoning × k → response`: k steps, no observation.
 *  - **style B** — `input → (reasoning → tool → observation) × k → response`:
 *    k steps, each followed by a call to something outside the model that can
 *    check the state and hand it back corrected, at a token cost.
 *
 * This engine is a deterministic analogue over a hand-authored battery. No model
 * is called, no network is used, and every figure is a measurement over seeded
 * samples, so the same configuration always gives the same numbers. The battery
 * is a measuring instrument, not a benchmark of any real system: what is measured
 * here is the arithmetic of decomposition and compounding, nothing more.
 */

import { createRng } from '../prng'

/* ------------------------------------------------------------------ */
/* Styles                                                              */
/* ------------------------------------------------------------------ */

/** The three interaction styles the battery runs. */
export type ReasoningStyle = 'A' | 'C' | 'B'

/**
 * The styles, in the book's own terms.
 *
 * `workflowNodes` is the shape each policy has in the visual builder, so the
 * comparison here is not a new vocabulary: it is the same reason–act–observe
 * graph with different pieces present.
 */
export const REASONING_STYLES: {
  value: ReasoningStyle
  label: string
  chapters: string
  workflowNodes: string[]
  description: string
}[] = [
  {
    value: 'A',
    label: 'Style A · direct answer',
    chapters: 'Ch. 6 §6.1; Ch. 9 §9.2.1',
    workflowNodes: ['input', 'reasoning', 'response'],
    description:
      'The query and nothing else. One generation carries the entire problem, so there is exactly one place for the work to go wrong — and no place for it to be broken apart.',
  },
  {
    value: 'C',
    label: 'Style C · chain of thought',
    chapters: 'Ch. 6 §6.1.3; Ch. 9 §9.2.1.3',
    workflowNodes: ['input', 'reasoning', 'reasoning', 'response'],
    description:
      'Intermediate steps, produced by the model itself. Nothing external returns to the chain, so a step can only reduce the load its neighbours carry or add a place to fail.',
  },
  {
    value: 'B',
    label: 'Style B · act, then read the observation',
    chapters: 'Ch. 6 §6.2; Ch. 9 §9.2.1; Ch. 11',
    workflowNodes: ['input', 'reasoning', 'tool', 'observation', 'response'],
    description:
      'Each step is followed by a call to something outside the model — a re-execution, a rule checker, a lookup — whose observation rewrites the state. It costs a tool call and an observation, and it helps only where a check exists to be made.',
  },
]

/**
 * Probability that a check catches a step that already went wrong.
 *
 * Not one: a checker verifies the result a step states, not the reasoning that
 * produced it, so a wrong step that reports a self-consistent result survives
 * the check. The residual is this engine's own parameter and nothing about any
 * deployed model.
 */
export const CHECKER_REPAIR_PROBABILITY = 0.9

/** Tokens a style-B step spends on the tool call and the observation it returns. */
export const CHECKER_CALL_TOKENS = 24

/* ------------------------------------------------------------------ */
/* Battery                                                             */
/* ------------------------------------------------------------------ */

export type TaskFamilyId = 'arithmetic' | 'symbolic' | 'knowledge' | 'commonsense' | 'writing'

export interface TaskFamily {
  id: TaskFamilyId
  label: string
  /**
   * Whether a longer chain splits the work or merely re-renders it.
   *
   * `true`  — the task is a sequence of dependent operations, so k steps can
   * each carry fewer of them. This is the only case in which a longer chain can
   * reduce the chance that any single step fails.
   * `false` — every step must carry the whole problem state, because there is
   * no dependent sequence to cut. Extra steps then re-emit what was already
   * emitted, which is pure added risk. This is what "adds no observation" means
   * in the arithmetic of this engine.
   */
  decomposable: boolean
  /** Whether an external check of a step exists at all, for style B. */
  externallyCheckable: boolean
  /** Where the course teaches this kind of work; the audit pools its questions by it. */
  chapters: number[]
  basis: string
}

export const TASK_FAMILIES: TaskFamily[] = [
  {
    id: 'arithmetic',
    label: 'Arithmetic',
    decomposable: true,
    externallyCheckable: true,
    chapters: [6],
    basis:
      'Ch. 6 §6.1: the problems chain of thought was written for — multi-digit and grade-school arithmetic, whose derivation is a sequence of dependent operations, each of which a calculator can re-execute.',
  },
  {
    id: 'symbolic',
    label: 'Symbolic manipulation',
    decomposable: true,
    externallyCheckable: true,
    chapters: [9],
    basis:
      'Ch. 6 §6.2 and Ch. 9 §9.2.1.3: rule-following over a stated notation. The steps are ordered and each one can be checked against the rule, which is why a step-by-step form decomposes here too.',
  },
  {
    id: 'knowledge',
    label: 'Knowledge retrieval',
    decomposable: false,
    externallyCheckable: true,
    chapters: [12],
    basis:
      'Ch. 12: a fact is either present in the weights or in a source, and no further derivation step produces it. A lookup is an external check; an added reasoning step is not.',
  },
  {
    id: 'commonsense',
    label: 'Commonsense judgement',
    decomposable: false,
    externallyCheckable: false,
    chapters: [1],
    basis:
      'Ch. 1 §1.2 and Ch. 15: a one-move judgement about a described situation. There is no dependent sequence to cut and no rule outside the model that says whether the judgement is right.',
  },
  {
    id: 'writing',
    label: 'Open-ended writing',
    decomposable: false,
    externallyCheckable: false,
    chapters: [23],
    basis:
      'Ch. 23 §23.2.8.1, which records that generated papers "look good, on the surface": an artefact that has to satisfy several constraints at once. Each step must still hold every constraint, so splitting the emission does not lighten any step.',
  },
]

export const TASK_FAMILY_BY_ID = new Map(TASK_FAMILIES.map((family) => [family.id, family]))

export interface ReasoningTask {
  id: string
  family: TaskFamilyId
  /** The problem, in words a student can read. */
  label: string
  /**
   * Elementary operations the task genuinely requires.
   *
   * For a decomposable family this is the number of dependent operations, so it
   * is also the chain length at which the decomposition is complete. For an
   * indivisible family it is the number of constraints or facts every step has
   * to hold at once.
   */
  operations: number
  promptTokens: number
  /** Tokens the model emits per reasoning step. */
  stepTokens: number
  /** Whether a deterministic check of one step exists (from the family). */
  checkable: boolean
  note: string
}

/**
 * A task is authored without a `checkable` flag on purpose: whether a step can
 * be checked is a property of the family, so the helper derives it and a task
 * can never be quietly handed a calculator its family does not have.
 */
const task = (input: Omit<ReasoningTask, 'checkable'>): ReasoningTask => ({
  ...input,
  checkable: TASK_FAMILY_BY_ID.get(input.family)!.externallyCheckable,
})

/**
 * The battery. Hand-authored, fourteen tasks in five families, separated by
 * whether the work decomposes, and labelled as an instrument rather than a
 * benchmark: it measures the arithmetic of splitting a task, not any system.
 */
export const REASONING_TASKS: ReasoningTask[] = [
  // Arithmetic — a dependent sequence, and every step can be re-executed.
  task({
    id: 'a-mixed-ops',
    family: 'arithmetic',
    label: 'Evaluate 3 + 12 × 4 − 7 ÷ 7 + 5 × 2.',
    operations: 6,
    promptTokens: 34,
    stepTokens: 16,
    note: 'Six dependent operations under precedence: the division, the two multiplications, then the addition and the subtraction, left to right.',
  }),
  task({
    id: 'a-fraction',
    family: 'arithmetic',
    label: 'Simplify (3/4 + 5/6) × 2/3.',
    operations: 7,
    promptTokens: 36,
    stepTokens: 18,
    note: 'Common denominator, two rescalings, the sum of the numerators, the product of the numerators, the product of the denominators, the reduction.',
  }),
  task({
    id: 'a-long-multiply',
    family: 'arithmetic',
    label: 'Multiply 417 × 286.',
    operations: 8,
    promptTokens: 30,
    stepTokens: 14,
    note: 'Three partial products, two place-value shifts, two additions into the running total, and the final carry. The textbook example of work that decomposes.',
  }),
  // Symbolic — ordered rule applications, each verifiable against the rule.
  task({
    id: 's-linear',
    family: 'symbolic',
    label: 'Solve 2(x − 3) = 4x + 10 for x.',
    operations: 5,
    promptTokens: 28,
    stepTokens: 15,
    note: 'Expand, gather the x terms, gather the constants, divide, substitute back to confirm. Substitution is the check the engine assumes exists.',
  }),
  task({
    id: 's-factor',
    family: 'symbolic',
    label: 'Factor x² − 5x + 6.',
    operations: 4,
    promptTokens: 31,
    stepTokens: 17,
    note: 'Find the pair, write the factors, expand to confirm, state the roots.',
  }),
  task({
    id: 's-exponent',
    family: 'symbolic',
    label: 'Simplify (2x³y²)² ÷ 4x²y.',
    operations: 6,
    promptTokens: 33,
    stepTokens: 16,
    note: 'The outer power over the coefficient and over each exponent, then the subtraction of exponents for x and for y, then the reduction of the coefficient.',
  }),
  // Knowledge — the fact is present or it is not; a step cannot manufacture it.
  task({
    id: 'k-single-fact',
    family: 'knowledge',
    label: 'In what year was the transformer architecture paper published?',
    operations: 1,
    promptTokens: 32,
    stepTokens: 12,
    note: 'One recollection. Every further step re-states it, and a re-statement is a chance to change it.',
  }),
  task({
    id: 'k-two-hop',
    family: 'knowledge',
    label: 'Which company published the paper that introduced in-context learning?',
    operations: 2,
    promptTokens: 38,
    stepTokens: 13,
    note: 'Two recollections joined, but no derivation: the second does not follow from the first, so cutting the task into steps gives nothing.',
  }),
  task({
    id: 'k-list-property',
    family: 'knowledge',
    label: 'Which European capital sits on two continents?',
    operations: 1,
    promptTokens: 33,
    stepTokens: 12,
    note: 'A lookup. Style B can query a source; style C can only re-assert what it already said.',
  }),
  // Commonsense — one move, no external rule that settles it.
  task({
    id: 'c-weather-object',
    family: 'commonsense',
    label: 'A paper book is left on a windowsill in the rain overnight. Is it readable in the morning?',
    operations: 1,
    promptTokens: 40,
    stepTokens: 11,
    note: 'The judgement is a single inference from a world model; spelling it out over five steps re-runs the same inference five times.',
  }),
  task({
    id: 'c-ordering',
    family: 'commonsense',
    label: 'Making toast and pouring coffee: which ordering gets both on the table soonest?',
    operations: 2,
    promptTokens: 44,
    stepTokens: 14,
    note: 'Two considerations — overlap and the toast cooling — resolved in one judgement, not a chain.',
  }),
  // Writing — several constraints an artefact must satisfy at once.
  task({
    id: 'w-summary',
    family: 'writing',
    label: 'Summarise the paragraph in two sentences, keeping every figure and the caveat.',
    operations: 3,
    promptTokens: 120,
    stepTokens: 62,
    note: 'Length, fidelity, and the caveat: three constraints, each of which every draft must satisfy. A second draft does not reduce what the first carried.',
  }),
  task({
    id: 'w-tone',
    family: 'writing',
    label: 'Rewrite the reply so that it apologises without admitting liability.',
    operations: 3,
    promptTokens: 96,
    stepTokens: 58,
    note: 'Tone, the admission line, and the facts already stated: three constraints the whole artefact has to satisfy at once.',
  }),
  task({
    id: 'w-agenda',
    family: 'writing',
    label: 'Draft a 30-minute agenda covering four topics.',
    operations: 4,
    promptTokens: 78,
    stepTokens: 44,
    note: 'Four topics, one time budget, and a total that has to come back to thirty minutes. Splitting the emission leaves every step carrying all four.',
  }),
]

export const REASONING_TASK_BY_ID = new Map(REASONING_TASKS.map((entry) => [entry.id, entry]))

export function tasksInFamily(family: TaskFamilyId): ReasoningTask[] {
  return REASONING_TASKS.filter((entry) => entry.family === family)
}

/* ------------------------------------------------------------------ */
/* The mechanics                                                       */
/* ------------------------------------------------------------------ */

/**
 * How the required operations are distributed over a chain.
 *
 * A decomposable family really does split: `k` steps carry the operations as
 * evenly as `k` allows, and a step that would carry nothing still has to emit
 * something, so its load is one. An indivisible family does not split at all:
 * every step carries the whole problem, because there is no dependent sequence
 * to cut — which is the precise sense in which an extra step there "adds no
 * observation".
 */
export function stepLoads(family: TaskFamily, operations: number, chainLength: number): number[] {
  const k = Math.max(1, Math.floor(chainLength))
  if (!family.decomposable) {
    return Array.from({ length: k }, () => Math.max(1, operations))
  }
  const base = Math.floor(operations / k)
  const remainder = operations % k
  return Array.from({ length: k }, (_, index) => Math.max(1, base + (index < remainder ? 1 : 0)))
}

/**
 * Probability that a step goes wrong.
 *
 * One explicit linear law, no hidden constants: a step's risk is the per-step
 * error rate times the load it carries, capped at certainty. Raising the number
 * of steps at a fixed error rate is therefore a trade of load against exposure,
 * and the trade only exists in a family that can be split.
 */
export function stepFailureProbability(load: number, perStepError: number): number {
  return Math.min(1, Math.max(0, load * perStepError))
}

export interface ReasoningDepthConfig {
  style: ReasoningStyle
  /** Steps in the chain. Style A always runs one step; style B uses it too. */
  chainLength: number
  /** Per-elementary-operation probability that a step introduces an error. */
  perStepError: number
  /** Sampled executions per task; every accuracy figure is measured over these. */
  trials: number
  seed: number
}

export const DEFAULT_REASONING_DEPTH_CONFIG: ReasoningDepthConfig = {
  style: 'C',
  chainLength: 4,
  perStepError: 0.04,
  trials: 400,
  seed: 7,
}

/** The chain lengths the sweep walks. */
export const CHAIN_LENGTH_SWEEP = [1, 2, 3, 4, 5, 6, 8, 10]

/** One sampled execution of one task, reported step by step. */
export interface StepRecord {
  index: number
  kind: 'reason' | 'check'
  /** Operations this step carries. Zero for a check, which computes nothing. */
  load: number
  failureProbability: number
  failed: boolean
  repaired: boolean
}

export interface TaskMeasurement {
  task: ReasoningTask
  family: TaskFamily
  style: ReasoningStyle
  chainLength: number
  /** Measured: sampled executions whose every step survived. */
  accuracy: number
  correctTrials: number
  trials: number
  /** Reasoning steps per execution. */
  reasoningSteps: number
  /** Tool calls plus observations per execution — style B only. */
  toolSteps: number
  tokensPerExecution: number
  /** Executions in which a check caught a step that had already gone wrong. */
  repairedTrials: number
  /** The first sampled execution, for the trace on screen. */
  trace: StepRecord[]
}

/**
 * Style A always runs a single step: that is the definition of it, and it is
 * what makes the three policies comparable at all.
 */
export function effectiveChainLength(style: ReasoningStyle, chainLength: number): number {
  return style === 'A' ? 1 : Math.max(1, Math.floor(chainLength))
}

/**
 * The stream for one execution of one task.
 *
 * It depends on the seed, the task and the trial number — and on nothing else.
 * Not on the style, not on the chain length. Two policies therefore draw the
 * same early numbers for the same trial, which is what makes the difference
 * between them a measurement rather than sampling noise.
 */
function rngForExecution(seed: number, taskIndex: number, trial: number) {
  return createRng((seed * 1000003 + (taskIndex + 1) * 40503 + (trial + 1) * 99991) >>> 0)
}

export function measureTask(taskIndex: number, config: ReasoningDepthConfig): TaskMeasurement {
  const entry = REASONING_TASKS[taskIndex] ?? REASONING_TASKS[0]
  const family = TASK_FAMILY_BY_ID.get(entry.family)!
  const style = config.style
  const chainLength = effectiveChainLength(style, config.chainLength)
  const loads = stepLoads(family, entry.operations, chainLength)
  const withCheck = style === 'B' && entry.checkable
  const trials = Math.max(1, Math.floor(config.trials))

  let correct = 0
  let repaired = 0
  let trace: StepRecord[] = []

  for (let trial = 0; trial < trials; trial += 1) {
    const rng = rngForExecution(config.seed, taskIndex, trial)
    const records: StepRecord[] = []
    let failed = false
    let savedThisRun = false

    for (let index = 0; index < loads.length; index += 1) {
      const load = loads[index]
      const failureProbability = stepFailureProbability(load, config.perStepError)
      const stepFailed = load > 0 && rng.chance(failureProbability)
      const repairedStep = stepFailed && withCheck && rng.chance(CHECKER_REPAIR_PROBABILITY)
      records.push({
        index,
        kind: 'reason',
        load,
        failureProbability,
        failed: stepFailed,
        repaired: repairedStep,
      })
      if (stepFailed && !repairedStep) {
        failed = true
        break
      }
      if (repairedStep) savedThisRun = true
      if (style === 'B') {
        records.push({
          index,
          kind: 'check',
          load: 0,
          failureProbability: 0,
          failed: false,
          repaired: false,
        })
      }
    }

    if (!failed) correct += 1
    if (savedThisRun) repaired += 1
    if (trial === 0) trace = records
  }

  const reasoningSteps = loads.length
  const toolSteps = style === 'B' ? reasoningSteps : 0
  return {
    task: entry,
    family,
    style,
    chainLength,
    accuracy: correct / trials,
    correctTrials: correct,
    trials,
    reasoningSteps,
    toolSteps,
    tokensPerExecution:
      entry.promptTokens + reasoningSteps * entry.stepTokens + toolSteps * CHECKER_CALL_TOKENS,
    repairedTrials: repaired,
    trace,
  }
}

export interface FamilyMeasurement {
  family: TaskFamily
  taskCount: number
  accuracy: number
  meanReasoningSteps: number
  meanToolSteps: number
  /** Mean tokens per execution, averaged over the family's tasks. */
  meanTokens: number
  /** Tokens for one pass of the family's tasks, once each. */
  totalTokens: number
  measurements: TaskMeasurement[]
}

/** One family under one configuration, from the task indices that belong to it. */
function measureTaskIndices(indices: number[], config: ReasoningDepthConfig): FamilyMeasurement | null {
  const measurements = indices.map((index) => measureTask(index, config))
  if (measurements.length === 0) return null
  const family = measurements[0].family
  const mean = (pick: (item: TaskMeasurement) => number) =>
    measurements.reduce((sum, item) => sum + pick(item), 0) / measurements.length
  return {
    family,
    taskCount: measurements.length,
    accuracy: mean((item) => item.accuracy),
    meanReasoningSteps: mean((item) => item.reasoningSteps),
    meanToolSteps: mean((item) => item.toolSteps),
    meanTokens: mean((item) => item.tokensPerExecution),
    totalTokens: measurements.reduce((sum, item) => sum + item.tokensPerExecution, 0),
    measurements,
  }
}

/** One family under one configuration. Null when the family has no tasks. */
export function measureFamily(familyId: TaskFamilyId, config: ReasoningDepthConfig): FamilyMeasurement | null {
  return measureTaskIndices(
    REASONING_TASKS.map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.family === familyId)
      .map(({ index }) => index),
    config,
  )
}

/** Every family at once, so the three policies share one sampling pass. */
function measureAllFamilies(config: ReasoningDepthConfig): Map<TaskFamilyId, FamilyMeasurement> {
  const indexed = REASONING_TASKS.map((entry, index) => ({ id: entry.family, index }))
  const out = new Map<TaskFamilyId, FamilyMeasurement>()
  for (const family of TASK_FAMILIES) {
    const measurement = measureTaskIndices(
      indexed.filter((entry) => entry.id === family.id).map((entry) => entry.index),
      config,
    )
    if (measurement) out.set(family.id, measurement)
  }
  return out
}

function aggregateAccuracy(measurements: Map<TaskFamilyId, FamilyMeasurement>): number {
  const rows = [...measurements.values()]
  if (rows.length === 0) return 0
  return rows.reduce((sum, row) => sum + row.accuracy, 0) / rows.length
}

function aggregateTokens(measurements: Map<TaskFamilyId, FamilyMeasurement>): number {
  return [...measurements.values()].reduce((sum, row) => sum + row.meanTokens, 0)
}

export interface FamilyComparison {
  family: TaskFamily
  /** The style currently chosen on screen. */
  current: FamilyMeasurement
  /** Style A at the same error rate — the baseline the chapter's claim is measured against. */
  direct: FamilyMeasurement
  /** Style B at the same chain length — the policy that gets an observation back. */
  checked: FamilyMeasurement
  /** Current minus style A: positive means more depth paid here. */
  deltaVsDirect: number
  /** Current minus style B: what a chain gives up against a tool at the same length. */
  deltaVsChecked: number
  tokenRatioVsDirect: number
  /** Measured verdict for this family at this chain length. */
  verdict: 'depth-pays' | 'depth-costs' | 'flat'
}

export interface SweepPoint {
  chainLength: number
  perFamily: Record<TaskFamilyId, number>
  aggregate: number
  meanTokens: number
}

export interface DepthBatteryResult {
  config: ReasoningDepthConfig
  perFamily: FamilyComparison[]
  /** Style C's measured accuracy as the chain lengthens, family by family. */
  sweep: SweepPoint[]
  /** Chain length at which each family's measured accuracy peaks. */
  crossover: Record<TaskFamilyId, number>
  aggregateCrossover: number
  aggregateAtChainLength: number
  aggregateAtOne: number
  aggregateGain: number
  /** The battery's answer to "does more depth pay", measured not asserted. */
  moreDepthPays: boolean
  /** Families whose measured accuracy at the current length is below style A. */
  familiesWhereDepthHurts: TaskFamilyId[]
  familiesWhereDepthHelps: TaskFamilyId[]
  directAggregate: number
  checkedAggregate: number
  aggregateTokenRatio: number
}

function flat(config: ReasoningDepthConfig, style: ReasoningStyle, chainLength: number): ReasoningDepthConfig {
  return { ...config, style, chainLength }
}

/**
 * The whole battery: the current configuration, both comparators, and the
 * chain-length sweep that locates the crossover.
 */
export function runDepthBattery(config: ReasoningDepthConfig): DepthBatteryResult {
  const current = measureAllFamilies(config)
  const direct = measureAllFamilies(flat(config, 'A', 1))
  const checked = measureAllFamilies(flat(config, 'B', config.chainLength))

  const perFamily: FamilyComparison[] = []
  for (const family of TASK_FAMILIES) {
    const now = current.get(family.id)
    const base = direct.get(family.id)
    const withTool = checked.get(family.id)
    if (!now || !base || !withTool) continue
    const deltaVsDirect = now.accuracy - base.accuracy
    const deltaVsChecked = now.accuracy - withTool.accuracy
    perFamily.push({
      family,
      current: now,
      direct: base,
      checked: withTool,
      deltaVsDirect,
      deltaVsChecked,
      tokenRatioVsDirect: now.meanTokens / Math.max(1, base.meanTokens),
      verdict: deltaVsDirect > 0.005 ? 'depth-pays' : deltaVsDirect < -0.005 ? 'depth-costs' : 'flat',
    })
  }

  const sweep: SweepPoint[] = CHAIN_LENGTH_SWEEP.map((chainLength) => {
    const at = measureAllFamilies(flat(config, 'C', chainLength))
    const perFamilyAt = {} as Record<TaskFamilyId, number>
    for (const family of TASK_FAMILIES) perFamilyAt[family.id] = at.get(family.id)?.accuracy ?? 0
    return {
      chainLength,
      perFamily: perFamilyAt,
      aggregate: aggregateAccuracy(at),
      meanTokens: aggregateTokens(at),
    }
  })

  const crossover = {} as Record<TaskFamilyId, number>
  for (const family of TASK_FAMILIES) {
    const best = sweep.reduce((top, point) =>
      point.perFamily[family.id] > top.perFamily[family.id] + 1e-12 ? point : top,
    )
    crossover[family.id] = best.chainLength
  }

  const aggregateBest = sweep.reduce((top, point) => (point.aggregate > top.aggregate + 1e-12 ? point : top))
  const atOne = sweep.find((point) => point.chainLength === 1)
  const aggregateAtOne = atOne?.aggregate ?? 0
  const atCurrent = measureAllFamilies(flat(config, 'C', config.chainLength))
  const aggregateAtChainLength = aggregateAccuracy(atCurrent)

  return {
    config,
    perFamily,
    sweep,
    crossover,
    aggregateCrossover: aggregateBest.chainLength,
    aggregateAtChainLength,
    aggregateAtOne,
    aggregateGain: aggregateAtChainLength - aggregateAtOne,
    moreDepthPays: aggregateBest.chainLength > 1,
    familiesWhereDepthHurts: perFamily.filter((row) => row.verdict === 'depth-costs').map((row) => row.family.id),
    familiesWhereDepthHelps: perFamily.filter((row) => row.verdict === 'depth-pays').map((row) => row.family.id),
    directAggregate: aggregateAccuracy(direct),
    checkedAggregate: aggregateAccuracy(checked),
    aggregateTokenRatio: aggregateTokens(current) / Math.max(1, aggregateTokens(direct)),
  }
}
