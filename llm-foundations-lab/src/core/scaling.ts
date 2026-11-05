/**
 * The Chinchilla allocation, and where LLaMA sits against it.
 *
 * Hoffmann et al. (2022) fitted the compute-optimal allocation directly to the
 * minima of their IsoFLOP curves (their approach 3) and reported
 *
 *     N_opt ∝ C^0.46,   D_opt ∝ C^0.54
 *
 * for a budget C ≈ 6·N·D. Their largest run trained 70B parameters on 1.4T
 * tokens, which is the anchor below and is where "about twenty tokens per
 * parameter" comes from. The exponents and the anchor are quoted; every other
 * allocation on the screen is arithmetic on them. Because the exponents sum to
 * one, the allocation preserves 6·N·D exactly and only the ratio drifts with
 * compute.
 */

/** Training compute under the standard ≈ 6·N·D estimate, in FLOPs. */
export function trainingCompute(params: number, tokens: number): number {
  return 6 * Math.max(params, 1) * Math.max(tokens, 1)
}

export interface Allocation {
  /** Parameters. */
  params: number
  /** Training tokens. */
  tokens: number
  /** Training compute in FLOPs. */
  compute: number
  /** Tokens per parameter. */
  ratio: number
}

/** Hoffmann et al. 2022, Table 2 (approach 3) and the flagship 70B run. */
export const CHINCHILLA_ALLOCATION = {
  paramsExponent: 0.46,
  tokensExponent: 0.54,
  anchorParams: 70e9,
  anchorTokens: 1.4e12,
  /** 6·N·D at the anchor, ≈ 5.9e23 FLOPs. */
  anchorCompute: trainingCompute(70e9, 1.4e12),
} as const

/**
 * The compute-optimal allocation for a fixed budget.
 *
 * Both counts scale as a power of the budget relative to the anchor, so the
 * pair is exact at the anchor and 6·N·D returns the requested budget
 * everywhere, because the two exponents sum to one.
 */
export function optimalAllocation(compute: number): Allocation {
  const growth = Math.max(compute, 1) / CHINCHILLA_ALLOCATION.anchorCompute
  const params = CHINCHILLA_ALLOCATION.anchorParams * Math.pow(growth, CHINCHILLA_ALLOCATION.paramsExponent)
  const tokens = CHINCHILLA_ALLOCATION.anchorTokens * Math.pow(growth, CHINCHILLA_ALLOCATION.tokensExponent)
  return {
    params,
    tokens,
    compute,
    ratio: tokens / params,
  }
}

/** A published model as a (parameters, tokens) point. */
export interface ModelPoint {
  name: string
  params: number
  tokens: number
}

/** LLaMA 1's training budgets, from Touvron et al. 2023, Table 1. */
export const LLAMA_MODELS: readonly ModelPoint[] = [
  { name: 'LLaMA 7B', params: 6.7e9, tokens: 1.0e12 },
  { name: 'LLaMA 13B', params: 13.0e9, tokens: 1.0e12 },
  { name: 'LLaMA 33B', params: 32.5e9, tokens: 1.4e12 },
  { name: 'LLaMA 65B', params: 65.2e9, tokens: 1.4e12 },
]

export interface ModelComparison extends ModelPoint {
  compute: number
  ratio: number
  /** The allocation's parameters for this model's compute budget. */
  optimalParams: number
  /** The allocation's token count for this model's compute budget. */
  optimalTokens: number
  /** The allocation's token-to-parameter ratio at this budget. */
  optimalRatio: number
  /** This model's ratio divided by the allocation's ratio. */
  ratioMultiple: number
}

/** Each model against the Chinchilla allocation for its own compute budget. */
export function compareToOptimal(models: readonly ModelPoint[] = LLAMA_MODELS): ModelComparison[] {
  return models.map((model) => {
    const compute = trainingCompute(model.params, model.tokens)
    const optimal = optimalAllocation(compute)
    const ratio = model.tokens / model.params
    return {
      ...model,
      compute,
      ratio,
      optimalParams: optimal.params,
      optimalTokens: optimal.tokens,
      optimalRatio: optimal.ratio,
      ratioMultiple: ratio / optimal.ratio,
    }
  })
}
