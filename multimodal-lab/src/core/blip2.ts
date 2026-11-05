/**
 * The frozen bridge.
 *
 * BLIP-2 keeps the image encoder and the language model frozen and trains a
 * small set of learned queries — the Q-Former — to read the image encoder's
 * patch tokens and present them to the language model. This is a toy of that
 * arrangement, and it is a toy on purpose: the attention is hand-wired from
 * seeded vectors and the parameter counts are a one-block model of the bridge.
 * Nothing here is a trained checkpoint.
 *
 * What the toy can show exactly is the shape of the argument: the frozen
 * towers contribute most of the parameters and none of the gradient, and the
 * part that is trained is small enough to print.
 */

import { createRng } from '@llm-materials/course-core'

export interface BridgeOptions {
  /** The learned queries, the Q-Former's inputs. */
  queries?: number
  /** The patch tokens the image encoder produces. */
  patches?: number
  /** The width of every vector in the bridge. */
  width?: number
  /** How sharply a query chooses among the patches. */
  temperature?: number
  seed?: number
}

const DEFAULTS: Required<BridgeOptions> = {
  queries: 16,
  patches: 32,
  width: 64,
  temperature: 0.2,
  seed: 7,
}

function resolved(options: BridgeOptions): Required<BridgeOptions> {
  return { ...DEFAULTS, ...options }
}

/** A seeded matrix of unit-scale vectors: rows × width, every value in [−1, 1). */
function vectors(rows: number, width: number, seed: number): number[][] {
  const rng = createRng(seed)
  return Array.from({ length: rows }, () =>
    Array.from({ length: width }, () => rng() * 2 - 1),
  )
}

/** The patch tokens the frozen image encoder is taken to produce. */
export function patchEmbeddings(options: BridgeOptions = {}): number[][] {
  const { patches, width, seed } = resolved(options)
  return vectors(patches, width, seed)
}

/** The learned queries. */
export function queryEmbeddings(options: BridgeOptions = {}): number[][] {
  const { queries, width, seed } = resolved(options)
  return vectors(queries, width, seed + 1)
}

/**
 * The cross-attention of the queries on the patches: queries × patches, with
 * each query's row a softmax over the patches. The scores are scaled by
 * 1/√width, as in the transformer.
 */
export function bridgeAttention(options: BridgeOptions = {}): number[][] {
  const { queries, patches, width, temperature, seed } = resolved(options)
  const patchesVectors = patchEmbeddings({ patches, width, seed })
  const queryVectors = queryEmbeddings({ queries, width, seed })
  const scale = 1 / Math.sqrt(Math.max(width, 1))
  const tau = Math.max(temperature, 1e-6)

  return queryVectors.map((query) => {
    const scores = patchesVectors.map((patch) => {
      let dot = 0
      for (let index = 0; index < width; index++) dot += (query[index] ?? 0) * (patch[index] ?? 0)
      return (dot * scale) / tau
    })
    const maximum = Math.max(...scores)
    const exponentials = scores.map((score) => Math.exp(score - maximum))
    const total = exponentials.reduce((sum, value) => sum + value, 0)
    return exponentials.map((value) => value / total)
  })
}

export interface QueryReport {
  /** The patch index the query attends to most. */
  topPatch: number
  /** Its weight. */
  topWeight: number
  /** How many patches hold more than twice the uniform share. */
  aboveChance: number
  /** The entropy of the query's attention, in nats. */
  entropy: number
  /** The most the entropy could be, log of the number of patches. */
  maximumEntropy: number
}

/** What one query does with the patch tokens. */
export function queryReport(weights: number[]): QueryReport {
  if (weights.length === 0) {
    return { topPatch: -1, topWeight: 0, aboveChance: 0, entropy: 0, maximumEntropy: 0 }
  }
  let topPatch = 0
  let topWeight = weights[0] ?? 0
  for (let index = 1; index < weights.length; index++) {
    if ((weights[index] ?? 0) > topWeight) {
      topPatch = index
      topWeight = weights[index] ?? 0
    }
  }
  const uniform = 1 / weights.length
  const aboveChance = weights.filter((weight) => weight > 2 * uniform).length
  let entropy = 0
  for (const weight of weights) if (weight > 0) entropy -= weight * Math.log(weight)
  return {
    topPatch,
    topWeight,
    aboveChance,
    entropy,
    maximumEntropy: Math.log(weights.length),
  }
}

/* -------------------------------------------------------------------------- */
/* The parameter bill                                                          */
/* -------------------------------------------------------------------------- */

export interface BudgetOptions {
  /** The width of every vector in the bridge. */
  width?: number
  /** The learned queries. */
  queries?: number
  /** The width of the projection into the language model's token space. */
  vocabulary?: number
  /** The frozen image encoder, assumed to be a ViT-B/16-sized tower. */
  encoder?: number
  /** The frozen language model, assumed to be an OPT-6.7B-sized tower. */
  language?: number
}

export interface Budget {
  /** The queries, and the one trainable attention block. */
  queryParameters: number
  attentionParameters: number
  /** The projection from the bridge into the language model. */
  projectionParameters: number
  trainable: number
  frozen: number
  /** The trainable fraction of the whole. */
  share: number
}

const VIT_BASE = 86_000_000
const OPT_6_7B = 6_700_000_000

/**
 * The parameter bill of one bridge block. The four attention matrices and the
 * projection are the toy's accounting; a real Q-Former has many blocks, which
 * makes the trainable side larger and does not change the shape of the answer.
 */
export function parameterBudget(options: BudgetOptions = {}): Budget {
  const {
    width = 64,
    queries = 16,
    vocabulary = 32000,
    encoder = VIT_BASE,
    language = OPT_6_7B,
  } = options
  const queryParameters = queries * width
  const attentionParameters = 4 * width * width
  const projectionParameters = width * vocabulary
  const trainable = queryParameters + attentionParameters + projectionParameters
  const frozen = encoder + language
  return {
    queryParameters,
    attentionParameters,
    projectionParameters,
    trainable,
    frozen,
    share: frozen + trainable === 0 ? 0 : trainable / (trainable + frozen),
  }
}

export { VIT_BASE, OPT_6_7B }
