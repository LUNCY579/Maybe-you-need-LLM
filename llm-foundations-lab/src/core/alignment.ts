/**
 * Alignment laboratory core: supervised fine-tuning vs. preference-based learning.
 *
 * Model of the world (deliberately small and transparent)
 * ------------------------------------------------------
 * Each candidate response y is described by three human-interpretable features
 *   phi(y) = [helpfulness, safety, conciseness]  ∈ [0, 1]³
 * A policy is a linear score over those features:
 *   z(y) = β · (w · phi(y))       and     π(w)(y) = softmax_y z(y)
 * The reference policy is the same form with w_ref (the "checkpoint before
 * preference tuning"). Every equation below is evaluated exactly, and the unit
 * tests check the analytic gradients against finite differences.
 *
 * Book equations implemented here:
 *   Bradley–Terry preference probability Pr(ya ≻ yb) = sigmoid(r(a) − r(b))   (§4.3.2, Eq. 4.35)
 *   Bradley–Terry reward-model loss L_r = −E log Pr(ya ≻ yb)                   (§4.3.2, Eq. 4.36)
 *   DPO reward re-parameterisation r = β log(π/π_ref) (+ const)               (§4.4.2, Eq. 4.80)
 *   DPO preference probability via ratios                                     (§4.4.2, Eq. 4.81)
 *   DPO loss L = −E log Pr(ya ≻ yb)                                           (§4.4.2, Eq. 4.82)
 *
 * This is an educational linear model, not a language model: the course says so
 * wherever these numbers appear.
 */
import { sigmoid, softplus, type Vector } from './math'

export interface CandidateResponse {
  id: string
  /** Short, original text shown as the candidate answer. */
  text: string
  /** Feature vector phi(y) ∈ [0, 1]³: helpfulness, safety, conciseness. */
  features: [number, number, number]
}

export interface PreferenceExample {
  prompt: string
  candidates: CandidateResponse[]
  /** id of the preferred (chosen) response. */
  chosen: string
  /** id of the rejected response. */
  rejected: string
  /** Why a human preferred it — shown in the UI. */
  rationale: string
}

export const FEATURE_NAMES = ['helpfulness', 'safety', 'conciseness'] as const

/** A small, fully original preference dataset used by the laboratory. */
export const PREFERENCE_DATASET: readonly PreferenceExample[] = [
  {
    prompt: 'Explain what a token is in one sentence.',
    candidates: [
      {
        id: 'a1',
        text: 'A token is a small unit of text — often a word piece — that the model reads and predicts.',
        features: [0.9, 0.8, 0.6],
      },
      {
        id: 'a2',
        text: 'A token is a token, obviously. Next question.',
        features: [0.15, 0.7, 0.9],
      },
      {
        id: 'a3',
        text: 'Tokens are internal secrets and cannot be described; ask the vendor.',
        features: [0.2, 0.5, 0.4],
      },
    ],
    chosen: 'a1',
    rejected: 'a2',
    rationale: 'The preferred answer is specific and complete; the rejected one is dismissive and carries no information.',
  },
  {
    prompt: 'A user asks how to disable a safety filter in a deployed system.',
    candidates: [
      {
        id: 'b1',
        text: 'I can explain why the filter exists and suggest a safe configuration review with your team.',
        features: [0.7, 0.95, 0.5],
      },
      {
        id: 'b2',
        text: 'Here are three undocumented environment variables that bypass it.',
        features: [0.6, 0.05, 0.9],
      },
      {
        id: 'b3',
        text: 'Filters are pointless; ignore them entirely.',
        features: [0.2, 0.1, 0.9],
      },
    ],
    chosen: 'b1',
    rejected: 'b2',
    rationale: 'The preferred answer is safe and still useful; the rejected one trades safety for a shortcut.',
  },
  {
    prompt: 'Summarise a long report for a busy reader.',
    candidates: [
      {
        id: 'c1',
        text: 'Three findings, one risk, one recommended action — in five lines.',
        features: [0.85, 0.8, 0.95],
      },
      {
        id: 'c2',
        text: 'The report contains several sections. Each section discusses topics that are discussed in it. In conclusion, the report is long and has sections.',
        features: [0.35, 0.8, 0.15],
      },
      {
        id: 'c3',
        text: 'I cannot summarise without the full text, the author list, and a signed request form.',
        features: [0.3, 0.85, 0.4],
      },
    ],
    chosen: 'c1',
    rejected: 'c2',
    rationale: 'The preferred answer is concise and decision-oriented; the rejected one restates the input without information.',
  },
  {
    prompt: 'Answer a question about an uncertain fact.',
    candidates: [
      {
        id: 'd1',
        text: 'The evidence points to X, though it is contested; here is what would change my answer.',
        features: [0.8, 0.9, 0.6],
      },
      {
        id: 'd2',
        text: 'X is definitely true, no doubt at all, and anyone who disagrees is wrong.',
        features: [0.4, 0.6, 0.8],
      },
      {
        id: 'd3',
        text: 'I refuse to answer questions about facts.',
        features: [0.1, 0.9, 0.9],
      },
    ],
    chosen: 'd1',
    rejected: 'd2',
    rationale: 'The preferred answer communicates calibrated uncertainty; the rejected one overstates confidence.',
  },
]

export interface PolicyParams {
  /** Linear weights over phi. */
  w: Vector
  /** Scaling β of the reward/ratio term. */
  beta: number
}

export const W_REFERENCE: Vector = [0.4, 0.35, 0.25]

/** Scores z(y) = β (w · phi(y)) for every candidate in an example. */
export function scores(params: PolicyParams, candidates: CandidateResponse[]): Vector {
  return candidates.map((c) => params.beta * dot3(params.w, c.features))
}

function dot3(a: number[], b: readonly number[]): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
}

/** Softmax policy over the candidate set. */
export function policyDistribution(params: PolicyParams, candidates: CandidateResponse[]): Vector {
  const z = scores(params, candidates)
  const max = Math.max(...z)
  const exps = z.map((v) => Math.exp(v - max))
  const total = exps.reduce((s, v) => s + v, 0)
  return exps.map((v) => v / total)
}

/**
 * Supervised fine-tuning loss on one example: the negative log-likelihood of the
 * chosen response. SFT imitates the preferred answer and never sees the rejected one.
 */
export function sftLoss(params: PolicyParams, example: PreferenceExample): number {
  const probs = policyDistribution(params, example.candidates)
  const index = example.candidates.findIndex((c) => c.id === example.chosen)
  if (index < 0) throw new Error(`chosen id ${example.chosen} is not among the candidates`)
  return -Math.log(Math.max(probs[index], 1e-12))
}

/** Gradient of the SFT loss with respect to w: β Σ_j (π_j − 1[j = chosen]) φ_j. */
export function sftGradient(params: PolicyParams, example: PreferenceExample): Vector {
  const probs = policyDistribution(params, example.candidates)
  const chosenIndex = example.candidates.findIndex((c) => c.id === example.chosen)
  const grad: Vector = [0, 0, 0]
  example.candidates.forEach((candidate, j) => {
    const coefficient = probs[j] - (j === chosenIndex ? 1 : 0)
    for (let k = 0; k < 3; k++) grad[k] += params.beta * coefficient * candidate.features[k]
  })
  return grad
}

/**
 * DPO log-odds term for a pair:
 *   d = β [ (w − w_ref)·(φ(ya) − φ(yb)) ]
 * which equals β [ log(π(ya)/π_ref(ya)) − log(π(yb)/π_ref(yb)) ] because the
 * partition functions cancel inside a single preference pair (book Eq. 4.81).
 */
export function dpoLogOdds(params: PolicyParams, example: PreferenceExample): number {
  const a = example.candidates.find((c) => c.id === example.chosen)
  const b = example.candidates.find((c) => c.id === example.rejected)
  if (!a || !b) throw new Error('preference example is missing its chosen or rejected response')
  const delta = [0, 1, 2].map((k) => a.features[k] - b.features[k])
  const wDiff = params.w.map((v, k) => v - W_REFERENCE[k])
  return params.beta * dot3(wDiff, delta)
}

/** Pr(ya ≻ yb | x) under the DPO re-parameterisation (Eq. 4.81). */
export function dpoPreferenceProbability(params: PolicyParams, example: PreferenceExample): number {
  return sigmoid(dpoLogOdds(params, example))
}

/** DPO loss L = −log Pr(ya ≻ yb) = softplus(−d) (Eq. 4.82). */
export function dpoLoss(params: PolicyParams, example: PreferenceExample): number {
  return softplus(-dpoLogOdds(params, example))
}

/** Gradient of the DPO loss with respect to w: −σ(−d) β (φ(ya) − φ(yb)). */
export function dpoGradient(params: PolicyParams, example: PreferenceExample): Vector {
  const a = example.candidates.find((c) => c.id === example.chosen)
  const b = example.candidates.find((c) => c.id === example.rejected)
  if (!a || !b) throw new Error('preference example is missing its chosen or rejected response')
  const d = dpoLogOdds(params, example)
  const coefficient = -sigmoid(-d) * params.beta
  return [0, 1, 2].map((k) => coefficient * (a.features[k] - b.features[k]))
}

/**
 * Bradley–Terry reward model: a second linear model trained on the same pairs.
 * This is the step RLHF needs before reinforcement learning can start.
 */
export function rewardModelLoss(w: Vector, example: PreferenceExample): number {
  const a = example.candidates.find((c) => c.id === example.chosen)
  const b = example.candidates.find((c) => c.id === example.rejected)
  if (!a || !b) throw new Error('preference example is missing its chosen or rejected response')
  const d = dot3(w, a.features) - dot3(w, b.features)
  return softplus(-d)
}

export function rewardModelGradient(w: Vector, example: PreferenceExample): Vector {
  const a = example.candidates.find((c) => c.id === example.chosen)
  const b = example.candidates.find((c) => c.id === example.rejected)
  if (!a || !b) throw new Error('preference example is missing its chosen or rejected response')
  const d = dot3(w, a.features) - dot3(w, b.features)
  const coefficient = -sigmoid(-d)
  return [0, 1, 2].map((k) => coefficient * (a.features[k] - b.features[k]))
}

export type AlignmentObjective = 'sft' | 'dpo' | 'reward'

export interface AlignmentStep {
  step: number
  loss: number
  /** Mean preference probability on the training pairs. */
  meanPreferenceProbability: number
  weights: Vector
}

export interface AlignmentRunOptions {
  objective: AlignmentObjective
  learningRate: number
  steps: number
  beta: number
  examples?: readonly PreferenceExample[]
  initialWeights?: Vector
}

/**
 * Train the toy policy (or reward model) with full-batch gradient descent.
 * The returned trajectory is computed from the gradients above — the chart in the
 * laboratory is a real optimisation curve.
 */
export function runAlignment(options: AlignmentRunOptions): {
  history: AlignmentStep[]
  params: PolicyParams
  finalLoss: number
} {
  const {
    objective,
    learningRate,
    steps,
    beta,
    examples = PREFERENCE_DATASET,
    initialWeights = [0.2, 0.2, 0.2],
  } = options
  if (!Number.isFinite(learningRate) || learningRate <= 0) {
    throw new RangeError(`learningRate must be positive and finite, received ${learningRate}`)
  }
  let w = [...initialWeights]
  const params: PolicyParams = { w, beta }
  const history: AlignmentStep[] = []
  const lossFor = (example: PreferenceExample): number => {
    if (objective === 'sft') return sftLoss(params, example)
    if (objective === 'dpo') return dpoLoss(params, example)
    return rewardModelLoss(w, example)
  }
  const gradFor = (example: PreferenceExample): Vector => {
    if (objective === 'sft') return sftGradient(params, example)
    if (objective === 'dpo') return dpoGradient(params, example)
    return rewardModelGradient(w, example)
  }
  const measure = () => {
    const losses = examples.map(lossFor)
    // The reported probability is the one that is meaningful for the objective:
    //   sft    → π(chosen | x), the probability the imitation objective maximises
    //   dpo    → Pr(ya ≻ yb | x) under the DPO re-parameterisation (Eq. 4.81)
    //   reward → Pr(ya ≻ yb | x) under the Bradley–Terry reward model (Eq. 4.35)
    const probabilities = examples.map((e) => {
      if (objective === 'reward') {
        const chosen = e.candidates.find((c) => c.id === e.chosen)!
        const rejected = e.candidates.find((c) => c.id === e.rejected)!
        return sigmoid(dot3(w, chosen.features) - dot3(w, rejected.features))
      }
      if (objective === 'sft') {
        const probs = policyDistribution(params, e.candidates)
        const index = e.candidates.findIndex((c) => c.id === e.chosen)
        return probs[index] ?? 0
      }
      return dpoPreferenceProbability(params, e)
    })
    const mean = probabilities.reduce((s, v) => s + v, 0) / probabilities.length
    history.push({
      step: history.length,
      loss: losses.reduce((s, v) => s + v, 0) / losses.length,
      meanPreferenceProbability: mean,
      weights: [...w],
    })
  }

  measure()
  for (let step = 0; step < steps; step++) {
    const grad: Vector = [0, 0, 0]
    for (const example of examples) {
      const g = gradFor(example)
      for (let k = 0; k < 3; k++) grad[k] += g[k] / examples.length
    }
    w = w.map((value, k) => value - learningRate * grad[k])
    params.w = w
    measure()
  }
  return { history, params, finalLoss: history[history.length - 1].loss }
}

/** Numerically estimated gradient for tests and for the "check the maths" panel. */
export function numericalAlignmentGradient(
  objective: AlignmentObjective,
  params: PolicyParams,
  example: PreferenceExample,
  k: number,
  epsilon = 1e-5,
): number {
  const lossAt = (w: Vector): number => {
    const p: PolicyParams = { w, beta: params.beta }
    if (objective === 'sft') return sftLoss(p, example)
    if (objective === 'dpo') return dpoLoss(p, example)
    return rewardModelLoss(w, example)
  }
  const up = [...params.w]
  const down = [...params.w]
  up[k] += epsilon
  down[k] -= epsilon
  return (lossAt(up) - lossAt(down)) / (2 * epsilon)
}

/**
 * Reward implied by the DPO re-parameterisation (Eq. 4.80), up to the constant
 * β log Z(x):  r(x, y) = β log(π(y|x) / π_ref(y|x)) + β log Z(x)
 *                     = β (w − w_ref) · φ(y) + β log Z(x).
 */
export function impliedReward(
  params: PolicyParams,
  response: CandidateResponse,
  referenceWeights: Vector = W_REFERENCE,
): number {
  let score = 0
  for (let k = 0; k < 3; k++) {
    score += (params.w[k] - referenceWeights[k]) * response.features[k]
  }
  return params.beta * score
}
