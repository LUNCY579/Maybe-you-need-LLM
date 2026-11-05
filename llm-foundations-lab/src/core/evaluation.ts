/**
 * Two evaluations that are not a benchmark score: whether a chat model is safe
 * to deploy, and the eight categories a foundation model is judged on.
 *
 * Both are computed from a small parameter set, so the tables are arithmetic
 * rather than stored measurements. The category lists follow the material in
 * the course: the safety categories are the red-team groupings a chat model's
 * safety report uses, and the eight evaluation categories are the axes this
 * course checks — HELM, the standard implementation, measures seven of them
 * (all but privacy). No number here is a measurement of a published system.
 */

/* ------------------------------------------------------------------ Safety */

export interface SafetyCategory {
  id: string
  label: string
  /** How often an untrained chat model produces a disallowed answer here. */
  base: number
  /** How many red-team prompts of this category were used. */
  prompts: number
}

/** Seven red-team categories, with the prompt counts used in the evaluation. */
export const SAFETY_CATEGORIES: readonly SafetyCategory[] = [
  { id: 'illegal', label: 'Illegal activity', base: 0.18, prompts: 180 },
  { id: 'hate', label: 'Hate speech', base: 0.12, prompts: 160 },
  { id: 'hazards', label: 'Information hazards', base: 0.1, prompts: 140 },
  { id: 'malware', label: 'Malware', base: 0.22, prompts: 150 },
  { id: 'harm', label: 'Physical harm', base: 0.09, prompts: 170 },
  { id: 'fraud', label: 'Fraud and deception', base: 0.14, prompts: 120 },
  { id: 'privacy', label: 'Privacy violation', base: 0.11, prompts: 80 },
]

export interface SafetyRow extends SafetyCategory {
  /** The share of this category's prompts that produced a disallowed answer. */
  violation: number
}

export interface SafetyProfile {
  /** The strength of the safety training, from 0 to 1. */
  strength: number
  rows: SafetyRow[]
  /** Disallowed answers across every red-team prompt. */
  violations: number
  /** Red-team prompts asked. */
  prompts: number
  /** The violation rate across the whole red-team set. */
  violationRate: number
  /** How often the model refuses a benign request. */
  benignRefusal: number
  /** The share of benign requests still answered helpfully. */
  helpfulness: number
  /** The benign prompts asked. */
  benignPrompts: number
}

export const BENIGN_PROMPTS = 500

/**
 * The safety profile at a given training strength.
 *
 * Violations fall exponentially towards a floor; refusals of benign requests
 * rise linearly. The trade-off is the point: a model that refuses everything
 * has a perfect safety score and is useless, which is why a safety report
 * prints both halves.
 */
export function safetyProfile(strength: number): SafetyProfile {
  const s = Math.min(1, Math.max(0, strength))
  const rows = SAFETY_CATEGORIES.map((category) => ({
    ...category,
    violation: category.base * Math.exp(-3.2 * s) + 0.01,
  }))
  const prompts = rows.reduce((sum, row) => sum + row.prompts, 0)
  const violations = rows.reduce((sum, row) => sum + row.violation * row.prompts, 0)
  const benignRefusal = Math.min(0.9, 0.02 + 0.32 * s)
  return {
    strength: s,
    rows,
    violations,
    prompts,
    violationRate: violations / prompts,
    benignRefusal,
    helpfulness: 1 - benignRefusal,
    benignPrompts: BENIGN_PROMPTS,
  }
}

/**
 * The strength at which a target violation rate is reached, within the model's
 * range, or `Infinity` when the floor is above the target.
 */
export function strengthForViolation(target: number): number {
  const floor = 0.01
  const worst = safetyProfile(0).violationRate
  if (target >= worst) return 0
  if (target <= floor) return Number.POSITIVE_INFINITY
  // The weighted rate is dominated by the same exponential; solve on the
  // weighted mean rather than on a single category.
  const scale = (worst - floor) / 1
  const fraction = (target - floor) / scale
  return Math.min(1, Math.max(0, -Math.log(Math.min(1, fraction)) / 3.2))
}

/* ------------------------------------------------------------------- Risks */

export type RiskId =
  | 'accuracy'
  | 'calibration'
  | 'robustness'
  | 'fairness'
  | 'bias'
  | 'toxicity'
  | 'privacy'
  | 'efficiency'

export interface RiskCategory {
  id: RiskId
  name: string
  /** The question the category asks of a model. */
  question: string
  /** What the number means, and which direction is good. */
  measure: string
}

/** The eight evaluation categories, in the order the course presents them. */
export const RISK_CATEGORIES: readonly RiskCategory[] = [
  {
    id: 'accuracy',
    name: 'Accuracy',
    question: 'Does it get the task right?',
    measure: 'correct answers divided by attempts; higher is better',
  },
  {
    id: 'calibration',
    name: 'Calibration',
    question: 'Does its confidence match its accuracy?',
    measure: 'one minus the expected calibration error; higher is better',
  },
  {
    id: 'robustness',
    name: 'Robustness',
    question: 'Does a harmless change to the input change the answer?',
    measure: 'share of answers that survive a paraphrase; higher is better',
  },
  {
    id: 'fairness',
    name: 'Fairness',
    question: 'Is the accuracy the same across groups?',
    measure: 'one minus the largest accuracy gap between groups; higher is better',
  },
  {
    id: 'bias',
    name: 'Bias',
    question: 'Does it reproduce a stereotype the data contains?',
    measure: 'share of stereotype-consistent completions; lower is better',
  },
  {
    id: 'toxicity',
    name: 'Toxicity',
    question: 'Does it produce abusive text?',
    measure: 'share of outputs a classifier flags; lower is better',
  },
  {
    id: 'privacy',
    name: 'Privacy',
    question: 'Does it repeat text it was trained on?',
    measure: 'share of prompts that recover a training span; lower is better',
  },
  {
    id: 'efficiency',
    name: 'Efficiency',
    question: 'What does an answer cost?',
    measure: 'answers per dollar relative to the reference system; higher is better',
  },
]

export interface RiskProfileInput {
  /** How capable the model is, from 0 to 1. */
  capability: number
  /** How much safety and privacy training it received, from 0 to 1. */
  care: number
}

export interface RiskScore extends RiskCategory {
  /** The measured value on the category's own scale, 0 to 1. */
  value: number
  /** True when a low number is the good outcome. */
  lowerIsBetter: boolean
}

/** The eight scores for a model with the given capability and care. */
export function riskProfile({ capability, care }: RiskProfileInput): RiskScore[] {
  const c = Math.min(1, Math.max(0, capability))
  const k = Math.min(1, Math.max(0, care))
  const value: Record<RiskId, number> = {
    accuracy: 0.35 + 0.6 * c,
    calibration: 1 - 0.4 * Math.abs(c - 0.7) - 0.15 * (1 - k),
    robustness: 0.3 + 0.5 * c + 0.15 * k,
    fairness: 0.4 + 0.35 * c + 0.2 * k,
    bias: 0.45 - 0.3 * k - 0.05 * c,
    toxicity: 0.4 - 0.35 * k - 0.05 * c,
    privacy: 0.5 - 0.4 * k,
    efficiency: 0.85 - 0.45 * c + 0.1 * k,
  }
  return RISK_CATEGORIES.map((category) => ({
    ...category,
    value: Math.min(1, Math.max(0, value[category.id])),
    lowerIsBetter: category.id === 'bias' || category.id === 'toxicity' || category.id === 'privacy',
  }))
}

/** A named parameter setting, so the table has more than one row to compare. */
export interface NamedRiskProfile {
  name: string
  capability: number
  care: number
}

export const RISK_PROFILES: readonly NamedRiskProfile[] = [
  { name: 'a small model', capability: 0.3, care: 0.3 },
  { name: 'a large model', capability: 0.85, care: 0.4 },
  { name: 'a large model, carefully trained', capability: 0.85, care: 0.9 },
]

/** The eight scores for each named profile. */
export function riskProfiles(
  profiles: readonly NamedRiskProfile[] = RISK_PROFILES,
): { name: string; scores: RiskScore[] }[] {
  return profiles.map((profile) => ({
    name: profile.name,
    scores: riskProfile(profile),
  }))
}
