/**
 * The scaling frontier.
 *
 * The IsoFLOP method: for each model size, find the data that spends the
 * same compute, and look at the loss along that line. The best point on each
 * line is the compute-optimal allocation for that budget, and the envelope
 * of those points is the frontier.
 *
 * The loss model is the one from the scaling-law literature:
 *
 *   L(N, D) = (N_c / N)^α_N · (D_c / D)^α_D + L_irr
 *
 * fitted so that the compute-optimal frontier passes through a reference
 * point. It is a model of a power law, not a claim about any particular run.
 */

export interface ScalingPoint {
  /** The number of parameters. */
  parameters: number
  /** The number of training tokens. */
  tokens: number
  /** The compute, in FLOPs. */
  compute: number
  /** The loss at this allocation. */
  loss: number
}

export interface Frontier {
  /** The reference point the loss model is anchored to. */
  reference: { parameters: number; tokens: number; loss: number }
  /** The exponents. */
  alphaParameters: number
  alphaTokens: number
  /** The irreducible loss. */
  irreducible: number
  /** The points on the frontier, cheapest first. */
  points: ScalingPoint[]
}

/** The default exponents, from the scaling-law literature. */
export const DEFAULT_EXPONENTS = {
  alphaParameters: 0.076,
  alphaTokens: 0.095,
  irreducible: 1.69,
}

/** The reference point: the compute-optimal allocation at 70B parameters. */
export const REFERENCE = {
  parameters: 70e9,
  tokens: 1.4e12,
  loss: 1.69,
}

/**
 * The loss of a model of a given size trained on a given number of tokens.
 */
export function scalingLoss(
  parameters: number,
  tokens: number,
  reference = REFERENCE,
  exponents = DEFAULT_EXPONENTS,
): number {
  const { alphaParameters, alphaTokens, irreducible } = exponents
  return (
    (reference.parameters / parameters) ** alphaParameters *
      (reference.tokens / tokens) ** alphaTokens +
    irreducible
  )
}

/** The compute a run spends, in FLOPs. */
export function computeOf(parameters: number, tokens: number): number {
  return 6 * parameters * tokens
}

/**
 * The compute-optimal allocation for a fixed compute budget.
 *
 * At the optimum the marginal return of a parameter equals the marginal
 * return of a token, which gives a fixed ratio between them.
 */
export function computeOptimalAllocation(
  compute: number,
  reference = REFERENCE,
  exponents = DEFAULT_EXPONENTS,
): { parameters: number; tokens: number; loss: number } {
  const { alphaParameters, alphaTokens } = exponents

  // The compute-optimal ratio follows from the two power laws:
  //   D ∝ N^(α_N / α_D)
  const exponent = alphaParameters / alphaTokens
  const referenceCompute = computeOf(reference.parameters, reference.tokens)

  // The scale factor s with parameters = s · N_ref and tokens = s^(1/exponent) · D_ref.
  const scale = (compute / referenceCompute) ** (1 / (1 + exponent))
  const parameters = scale * reference.parameters
  const tokens = scale ** (1 / exponent) * reference.tokens

  return { parameters, tokens, loss: scalingLoss(parameters, tokens, reference, exponents) }
}

/**
 * Trace the compute-optimal frontier.
 *
 * For each compute budget, the loss of the best allocation.
 */
export function traceFrontier(
  budgets: number[],
  reference = REFERENCE,
  exponents = DEFAULT_EXPONENTS,
): ScalingPoint[] {
  return budgets.map((compute) => {
    const allocation = computeOptimalAllocation(compute, reference, exponents)
    return {
      parameters: allocation.parameters,
      tokens: allocation.tokens,
      compute,
      loss: allocation.loss,
    }
  })
}

/**
 * The IsoFLOP lines.
 *
 * For each model size, the loss as the data is swept, with the points that
 * spend the same compute marked.
 */
export function isoFlopLine(
  parameters: number,
  tokenCounts: number[],
  reference = REFERENCE,
  exponents = DEFAULT_EXPONENTS,
): ScalingPoint[] {
  return tokenCounts.map((tokens) => ({
    parameters,
    tokens,
    compute: computeOf(parameters, tokens),
    loss: scalingLoss(parameters, tokens, reference, exponents),
  }))
}

/**
 * The rule of thumb: the tokens per parameter at the compute-optimal frontier.
 */
export function tokensPerParameter(
  compute: number,
  reference = REFERENCE,
  exponents = DEFAULT_EXPONENTS,
): number {
  const allocation = computeOptimalAllocation(compute, reference, exponents)
  return allocation.tokens / allocation.parameters
}
