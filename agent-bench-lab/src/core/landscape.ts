/**
 * The three benchmarks the course reads beside SWE-bench.
 *
 * GAIA asks how hard a question is and how many tools it needs; AgentBench
 * asks whether one average is a fair account of eight environments; WebArena
 * asks whether the environment itself can be replayed. All three are modelled
 * here, so the screens can put a number on each claim.
 *
 * The models are synthetic and analytic — a logistic curve, a step budget, a
 * deterministic state machine — not replications of the published tables. The
 * screens say so wherever one of these numbers is printed.
 */

import { createRng } from '@llm-materials/course-core'

/* ------------------------------------------------------------------ SWE-bench */

export interface FileSizeBucket {
  /** The number of files the task touches. */
  files: number
  /** The tasks in this bucket. */
  tasks: number
  /** The tasks the solver resolves. */
  solved: number
  /** The resolution rate. */
  rate: number
}

/**
 * The probability a single-file solver resolves a task of a given size.
 *
 * Every extra file is another place the patch can fail to be found, and the
 * decay is proportional to the remaining headroom. This is the shape the
 * SWE-bench paper reports; the constants are chosen to make the curve legible,
 * not fitted to its table.
 */
export function resolutionProbability(files: number): number {
  return 0.82 * Math.exp(-0.22 * Math.max(0, files - 1))
}

/**
 * Resolution rate as a function of the number of files a task touches.
 *
 * The rate is the expectation of `resolutionProbability` over a fixed number
 * of tasks per bucket, rounded to whole tasks, so the table adds up.
 */
export function resolutionByFileSize(options: { maxFiles?: number; tasksPerBucket?: number } = {}): FileSizeBucket[] {
  const maxFiles = Math.max(1, options.maxFiles ?? 8)
  const tasksPerBucket = Math.max(1, options.tasksPerBucket ?? 40)
  return Array.from({ length: maxFiles }, (_, index) => {
    const files = index + 1
    const solved = Math.round(resolutionProbability(files) * tasksPerBucket)
    return { files, tasks: tasksPerBucket, solved, rate: solved / tasksPerBucket }
  })
}

/* ---------------------------------------------------------------------- GAIA */

export type GaiaLevel = 1 | 2 | 3

export const GAIA_LEVELS: { level: GaiaLevel; baseRate: number; label: string; note: string }[] = [
  { level: 1, baseRate: 0.78, label: 'Level 1', note: 'one lookup, one tool' },
  { level: 2, baseRate: 0.48, label: 'Level 2', note: 'several steps, two tools' },
  { level: 3, baseRate: 0.22, label: 'Level 3', note: 'a long chain, three or more tools' },
]

export interface GaiaQuestion {
  id: number
  level: GaiaLevel
  /** The number of tools a complete answer needs. */
  tools: number
  /** The number of steps in the reference answer. */
  steps: number
}

/**
 * A synthetic question set with GAIA's three levels.
 *
 * Each question records what the benchmark annotates — the level, the number
 * of steps in the reference answer, and the number of tools it needs — because
 * the difference between the levels is a difference in those two counts.
 */
export function gaiaQuestions(count = 90, seed = 7): GaiaQuestion[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, (_, id) => {
    const draw = rng()
    const level: GaiaLevel = draw < 0.38 ? 1 : draw < 0.74 ? 2 : 3
    const tools = level + (rng() < 0.3 ? 1 : 0)
    const steps = level + Math.floor(rng() * (level + 1))
    return { id, level, tools, steps }
  })
}

export interface ToolBudgetRow {
  /** The tools the solver is given. */
  tools: number
  /** The success rate on each level, and on the whole set. */
  level1: number
  level2: number
  level3: number
  overall: number
}

/**
 * Success as a function of the tool budget.
 *
 * A question is answered only if the budget reaches the tools it needs, and
 * then at the level's base rate. The budget is the curve's only moving part,
 * which is the claim the figure makes: at a fixed capability, the tool count
 * decides which questions are even reachable.
 */
export function successByToolBudget(questions: GaiaQuestion[], maxTools = 4): ToolBudgetRow[] {
  const rows: ToolBudgetRow[] = []
  for (let budget = 0; budget <= maxTools; budget++) {
    const rate = (level: GaiaLevel) => {
      const atLevel = questions.filter((question) => question.level === level)
      if (atLevel.length === 0) return 0
      const base = GAIA_LEVELS.find((entry) => entry.level === level)!.baseRate
      return (atLevel.filter((question) => question.tools <= budget).length / atLevel.length) * base
    }
    const reachable = questions.filter((question) => question.tools <= budget).length
    rows.push({
      tools: budget,
      level1: rate(1),
      level2: rate(2),
      level3: rate(3),
      overall: questions.length === 0 ? 0 : (reachable / questions.length) * 0.5,
    })
  }
  return rows
}

/** How many questions of each level need more tools than the budget. */
export function toolShortfall(questions: GaiaQuestion[], budget: number): Record<GaiaLevel, number> {
  const short = { 1: 0, 2: 0, 3: 0 }
  for (const question of questions) {
    if (question.tools > budget) short[question.level] += 1
  }
  return short
}

/* -------------------------------------------------------------- reliability */

/**
 * Successes per task over repeated trials, for the pass^k table.
 *
 * Each task is tried `samples` times at a fixed success rate, which is the
 * setup τ-bench reports: a single pass rate hides whether the successes are
 * consistent, and the repeated trials are what make consistency measurable.
 */
export function repeatedTrialCounts(
  count = 40,
  samples = 10,
  seed = 11,
  successRate = 0.6,
): number[] {
  const rng = createRng(seed)
  return Array.from({ length: count }, () => {
    let successes = 0
    for (let trial = 0; trial < samples; trial++) if (rng() < successRate) successes += 1
    return successes
  })
}

/* ---------------------------------------------------------------- AgentBench */

export interface Environment {
  id: string
  name: string
  /** How hard the environment is, on the same scale as capability. */
  difficulty: number
}

export const AGENTBENCH_ENVIRONMENTS: Environment[] = [
  { id: 'os', name: 'Operating system', difficulty: 0.32 },
  { id: 'db', name: 'Database', difficulty: 0.45 },
  { id: 'kg', name: 'Knowledge graph', difficulty: 0.38 },
  { id: 'card', name: 'Digital card game', difficulty: 0.62 },
  { id: 'puzzle', name: 'Lateral thinking', difficulty: 0.5 },
  { id: 'house', name: 'House holding', difficulty: 0.58 },
  { id: 'shop', name: 'Web shopping', difficulty: 0.28 },
  { id: 'web', name: 'Web browsing', difficulty: 0.4 },
]

export interface ModelProfile {
  id: string
  name: string
  /** One capability per environment, in the environment order. */
  capabilities: number[]
}

/**
 * Four solvers with different shapes.
 *
 * The large model is strong everywhere except the card game; the specialist is
 * weak everywhere except the card game. The pair is the argument: the average
 * ranks the large model first, and the per-environment results do not.
 */
export const MODEL_PROFILES: ModelProfile[] = [
  { id: 'small', name: 'the small model', capabilities: Array(8).fill(0.3) },
  { id: 'medium', name: 'the medium model', capabilities: Array(8).fill(0.48) },
  { id: 'large', name: 'the large model', capabilities: [0.66, 0.66, 0.66, 0.2, 0.62, 0.6, 0.68, 0.64] },
  { id: 'specialist', name: 'the card specialist', capabilities: [0.24, 0.24, 0.24, 0.8, 0.24, 0.24, 0.24, 0.24] },
]

export interface EnvironmentScore {
  environment: Environment
  /** The score of each model, in the model order. */
  scores: number[]
}

/** A logistic score for one model in one environment. */
export function scoreOf(capability: number, difficulty: number): number {
  return 1 / (1 + Math.exp(-4 * (capability - difficulty)))
}

/** The full score matrix, computed from the profiles and the environments. */
export function environmentScores(
  models: ModelProfile[] = MODEL_PROFILES,
  environments: Environment[] = AGENTBENCH_ENVIRONMENTS,
): EnvironmentScore[] {
  return environments.map((environment) => ({
    environment,
    scores: models.map((model) => scoreOf(model.capabilities[environments.indexOf(environment)] ?? 0.3, environment.difficulty)),
  }))
}

export interface ModelSummary {
  model: ModelProfile
  mean: number
  min: number
  max: number
  /** The spread between the best and the worst environment. */
  spread: number
  /** The environments where this model has the highest score. */
  wins: number
}

export interface LandscapeSummary {
  models: ModelSummary[]
  /** The model with the highest mean. */
  bestByAverage: string
  /** The model that wins the most environments. */
  bestByWins: string
  /** The number of environments where the best average is not the best score. */
  exceptions: number
}

/**
 * The average, the worst environment, and who actually won what.
 *
 * The average is over the same eight environments for every model, so the
 * comparison is fair; the question is what it hides. `exceptions` counts the
 * environments where the highest average is not the highest score, and it is
 * the number the screen puts beside the average.
 */
export function landscapeSummary(
  rows: EnvironmentScore[],
  models: ModelProfile[] = MODEL_PROFILES,
): LandscapeSummary {
  const summaries = models.map((model, index) => {
    const values = rows.map((row) => row.scores[index] ?? 0)
    const mean = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length)
    const min = Math.min(...values)
    const max = Math.max(...values)
    const wins = rows.filter((row) => {
      const best = Math.max(...row.scores)
      return (row.scores[index] ?? 0) >= best - 1e-12
    }).length
    return { model, mean, min, max, spread: max - min, wins }
  })
  const bestByAverage = summaries.reduce((best, entry) => (entry.mean > best.mean ? entry : best), summaries[0]!)
  const bestByWins = summaries.reduce((best, entry) => (entry.wins > best.wins ? entry : best), summaries[0]!)
  const exceptions = rows.filter((row) => {
    const best = Math.max(...row.scores)
    return (row.scores[models.indexOf(bestByAverage.model)] ?? 0) < best - 1e-12
  }).length
  return {
    models: summaries,
    bestByAverage: bestByAverage.model.name,
    bestByWins: bestByWins.model.name,
    exceptions,
  }
}

/* ------------------------------------------------------------------ WebArena */

export type ShopAction = 'search' | 'add' | 'remove' | 'checkout' | 'back'

export interface ShopState {
  /** The action count, starting at zero for the initial state. */
  step: number
  /** The items in the cart. */
  cart: number
  /** The page the browser is showing. */
  page: string
}

/**
 * Replay a recorded trajectory in a deterministic environment.
 *
 * The environment is self-hosted and seeded, which is WebArena's property: the
 * same seed and the same actions give the same states, and a change to one
 * action changes the states from that step onward and no earlier.
 */
export function replay(actions: ShopAction[], seed: number): ShopState[] {
  let cart = Math.abs(Math.trunc(seed)) % 3
  let page = 'home'
  const states: ShopState[] = [{ step: 0, cart, page }]
  actions.forEach((action, index) => {
    if (action === 'search') page = 'results'
    else if (action === 'add') {
      cart += 1
      page = 'cart'
    } else if (action === 'remove') {
      cart = Math.max(0, cart - 1)
      page = 'cart'
    } else if (action === 'checkout') page = cart > 0 ? 'confirm' : 'cart'
    else page = 'home'
    states.push({ step: index + 1, cart, page })
  })
  return states
}

/** The first step at which two trajectories disagree, or -1 if they never do. */
export function divergenceStep(left: ShopAction[], right: ShopAction[], seed: number): number {
  const a = replay(left, seed)
  const b = replay(right, seed)
  for (let index = 0; index < Math.max(a.length, b.length); index++) {
    const x = a[index]
    const y = b[index]
    if (!x || !y || x.cart !== y.cart || x.page !== y.page) return index
  }
  return -1
}

/** A short digest of a trajectory, for printing two runs side by side. */
export function replayDigest(states: ShopState[]): string {
  return states.map((state) => `${state.step}:${state.page}:${state.cart}`).join('|')
}
