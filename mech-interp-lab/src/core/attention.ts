/**
 * Attention heads, their circuits, and the paths between them.
 *
 * A shallow transformer can be read as a sum of *circuits*, and that is the
 * move the mathematical framework makes. Write the residual stream of a token
 * as `x`, and one head as four matrices: `W_Q`, `W_K` take it to `R^d_head` and
 * `W_V`, `W_O` carry it through `R^d_value` and back. With the vectors stored as
 * columns — `y = W x`, which is what `matVec` wants — the head does two separate
 * things, and they factor:
 *
 *   score(i, j) = x_i^T (W_Q^T W_K) x_j / sqrt(d_head)       the **QK circuit**
 *   output(i)   = sum_j attention(i, j) (W_O W_V) x_j         the **OV circuit**
 *
 * `W_Q^T W_K` decides *where the head looks*; `W_O W_V` decides *what it writes
 * when it gets there*. Each is one `d_model x d_model` matrix, read off the head
 * independently of the other — which is what makes a head interpretable at all.
 * The papers write these products the other way round, because they use row
 * vectors; they are the same two matrices.
 *
 * Because a head's output is a sum over source positions, its contribution to a
 * final logit splits exactly into one term per position:
 *
 *   readout . output(i) = sum_j attention(i, j) * (readout . OV x_j)
 *
 * The first factor is the *where*, the second the *what*, and the sum is the
 * pathway decomposition. It is an identity and not an approximation, so this
 * module tests it to machine precision instead of admiring it.
 *
 * Composed heads need a second tool. A head in the second layer reads a residual
 * stream the first layer wrote into, so its QK circuit is a property of the
 * *path* from that earlier head, not of the head alone. The framework's answer
 * is path patching: substitute one head's output inside one circuit input of
 * another and see what moves. `patchPath` does that; `patchComponent` does the
 * plain activation patching that a circuit search runs on.
 *
 * The models here are hand-wired or seeded-random, and they are small: two
 * layers, a handful of heads, a residual stream of 16 dimensions. They carry the
 * same algebra as a real transformer, but nothing in this module was trained on
 * text, and every laboratory that shows one says so.
 */

import {
  addVectors,
  createRng,
  dot,
  gaussian,
  matVec,
  matmul,
  outer,
  softmax,
  subtractVectors,
  transpose,
  zeros,
} from '@llm-materials/course-core'
import type { Matrix, Rng, Vector } from '@llm-materials/course-core'

/** Which of a head's three inputs a patch is applied to. */
export type Circuit = 'query' | 'key' | 'value'

/** How a caller names the circuits to patch: `'qk'` means query and key together. */
export type CircuitChoice = Circuit | 'qk'

/**
 * One attention head.
 *
 * The convention is `y = W x`, so a matrix's *rows* are output coordinates:
 * `W_Q`, `W_K` are `d_head x d_model`, `W_V` is `d_value x d_model` and `W_O` is
 * `d_model x d_value`. That is the transpose of the way a paper writes them, and
 * it is the shape `matVec` wants.
 */
export interface HeadParams {
  name: string
  /** d_head x d_model. */
  query: Matrix
  /** d_head x d_model. */
  key: Matrix
  /** d_value x d_model. */
  value: Matrix
  /** d_model x d_value. */
  output: Matrix
  /**
   * The score added at relative distance: `distanceBias[k]` is added to
   * `score(i, j)` where `k = i - j`. This is how a purely positional head — the
   * previous-token head of the induction and IOI circuits — attends to the
   * token before it without regard to what that token is.
   */
  distanceBias: number[]
  /** Softmax temperature for this head. */
  temperature: number
}

/** A wired model: an embedding, some layers of heads, a readout. */
export interface AttentionModel {
  dimension: number
  keyDimension: number
  valueDimension: number
  vocabulary: number
  /** vocabulary x d_model; row `t` is the embedding of token `t`. */
  embedding: Matrix
  /** vocabulary x d_model; row `t` is the direction that scores token `t`. */
  readout: Matrix
  /** `layers[layer][head]`. Every head in a layer reads the same input. */
  layers: HeadParams[][]
}

/** One head's behaviour on one run. */
export interface HeadRun {
  layer: number
  head: number
  name: string
  /** `pattern[i][j]`, causal and row-normalised: zero wherever `j > i`. */
  pattern: number[][]
  /** The vector this head writes at each position, in `R^d_model`. */
  outputs: Vector[]
}

/** A full forward pass, with everything a patch needs to reach. */
export interface Run {
  tokens: number[]
  /** `inputs[layer][position]` is the residual stream that layer reads. */
  inputs: Vector[][]
  /** Every head of every layer, in order. Read one with `headRun`. */
  heads: HeadRun[]
  /** The residual stream after the last layer. */
  final: Vector[]
  /** `logits[position][token]`. */
  logits: number[][]
}

/* ------------------------------------------------------------- circuit algebra */

/**
 * A rank-one matrix `write * read^T`.
 *
 * Applying it is `matVec(outer(write, read), x) = write * (read . x)`: read the
 * stream along `read`, write that much of `write`. Every circuit in the IOI
 * model is built this way, which is what makes "this head copies the name of the
 * subject" a statement about two vectors rather than about an opaque matrix.
 */
export function rankOne(write: Vector, read: Vector): Matrix {
  return outer(write, read)
}

/** The standard basis vector `e[index]` in `R^dimension`. */
export function basis(dimension: number, index: number): Vector {
  const vector = new Array<number>(dimension).fill(0)
  vector[index] = 1
  return vector
}

/** The QK circuit `W_Q^T W_K`: the matrix that decides where the head looks. */
export function qkCircuit(head: HeadParams): Matrix {
  return matmul(transpose(head.query), head.key)
}

/** The OV circuit `W_O W_V`: the matrix that decides what the head writes. */
export function ovCircuit(head: HeadParams): Matrix {
  return matmul(head.output, head.value)
}

export interface CircuitShape {
  /** Entries away from zero by more than `tolerance`. */
  nonZero: number
  cells: number
  /** The Frobenius norm: the total magnitude the circuit carries. */
  frobenius: number
  /** The single largest-magnitude entry. */
  largest: number
}

/**
 * How big a circuit is, in the two senses that matter: how much of the matrix it
 * fills, and how much signal the part it fills carries. A rank-one circuit written
 * from two sparse vectors has a handful of non-zero cells and a small Frobenius
 * norm; a random one fills everything.
 */
export function circuitShape(matrix: Matrix, tolerance = 1e-12): CircuitShape {
  let nonZero = 0
  let squareSum = 0
  let largest = 0
  for (const row of matrix) {
    for (const value of row) {
      if (Math.abs(value) > tolerance) nonZero += 1
      squareSum += value * value
      if (Math.abs(value) > Math.abs(largest)) largest = value
    }
  }
  return { nonZero, cells: matrix.length * (matrix[0]?.length ?? 0), frobenius: Math.sqrt(squareSum), largest }
}

/* ---------------------------------------------------------------- constructing */

interface HeadShell {
  dimension: number
  keyDimension: number
  valueDimension: number
}

/** A head that looks nowhere and writes nothing. */
export function emptyHead(name: string, shell: HeadShell): HeadParams {
  const { dimension, keyDimension, valueDimension } = shell
  return {
    name,
    query: zeros(keyDimension, dimension),
    key: zeros(keyDimension, dimension),
    value: zeros(valueDimension, dimension),
    output: zeros(dimension, valueDimension),
    distanceBias: [],
    temperature: 1,
  }
}

/** A head with seeded random weights — what the identity tests run on, so that nothing passes by coincidence. */
export function randomHead(name: string, shell: HeadShell, rng: Rng): HeadParams {
  const head = emptyHead(name, shell)
  const fill = (matrix: Matrix) => {
    const spread = 1 / Math.sqrt(Math.max(1, matrix[0].length))
    for (const row of matrix) for (let i = 0; i < row.length; i++) row[i] = gaussian(rng) * spread
  }
  fill(head.query)
  fill(head.key)
  fill(head.value)
  fill(head.output)
  return head
}

export interface ModelOptions {
  dimension?: number
  keyDimension?: number
  valueDimension?: number
  vocabulary?: number
  /** How many heads per layer. */
  layers?: number[]
  seed?: number
}

/** A seeded model with random weights and a random embedding. */
export function randomModel(options: ModelOptions = {}): AttentionModel {
  const dimension = options.dimension ?? 16
  const keyDimension = options.keyDimension ?? 4
  const valueDimension = options.valueDimension ?? dimension
  const vocabulary = options.vocabulary ?? 12
  const layerWidths = options.layers ?? [2, 2]
  const rng = createRng(options.seed ?? 7)
  const shell = { dimension, keyDimension, valueDimension }
  const spread = 1 / Math.sqrt(dimension)

  const randomMatrix = (rows: number, cols: number): Matrix => {
    const matrix = zeros(rows, cols)
    for (const row of matrix) for (let i = 0; i < row.length; i++) row[i] = gaussian(rng) * spread
    return matrix
  }

  return {
    dimension,
    keyDimension,
    valueDimension,
    vocabulary,
    embedding: randomMatrix(vocabulary, dimension),
    readout: randomMatrix(vocabulary, dimension),
    layers: layerWidths.map((width, layer) =>
      Array.from({ length: width }, (_, head) => randomHead(`layer ${layer} head ${head}`, shell, rng)),
    ),
  }
}

/* ------------------------------------------------------------------- attention */

/**
 * The score matrix of a head on some residual-stream inputs.
 *
 * `scores[i][j]` is defined only for `j <= i`; the entries above the diagonal
 * are left at zero and never read, because the softmax is taken over the causal
 * prefix rather than over a row of `-Infinity`s.
 */
export function headScores(head: HeadParams, queryInputs: Vector[], keyInputs?: Vector[]): number[][] {
  const keys = keyInputs ?? queryInputs
  const keyScale = Math.sqrt(Math.max(1, head.query.length))
  const queries = queryInputs.map((input) => matVec(head.query, input))
  const keyed = keys.map((input) => matVec(head.key, input))
  const scores: number[][] = []
  for (let i = 0; i < queryInputs.length; i++) {
    const row = new Array<number>(queryInputs.length).fill(0)
    for (let j = 0; j <= i; j++) {
      row[j] = dot(queries[i], keyed[j]) / keyScale + (head.distanceBias[i - j] ?? 0)
    }
    scores.push(row)
  }
  return scores
}

/** The causal, row-normalised attention pattern of a head. */
export function attentionPattern(head: HeadParams, queryInputs: Vector[], keyInputs?: Vector[]): number[][] {
  const scores = headScores(head, queryInputs, keyInputs)
  return scores.map((row, i) => [
    ...softmax(row.slice(0, i + 1), Math.max(1e-6, head.temperature)),
    ...new Array<number>(row.length - (i + 1)).fill(0),
  ])
}

/** What the combined OV circuit writes from one input: `(W_O W_V) x`. */
export function ovWrites(head: HeadParams, input: Vector): Vector {
  return matVec(ovCircuit(head), input)
}

/**
 * What the head writes from one input, the way a transformer actually does it:
 * `W_O (W_V x)`.
 *
 * This and `ovWrites` are the same vector — the framework's whole claim is that
 * they are — and the tests check that they agree on random weights, so a
 * factorisation error cannot survive.
 */
export function valueWrites(head: HeadParams, input: Vector): Vector {
  return matVec(head.output, matVec(head.value, input))
}

/** The vectors a head writes at every position, given its attention pattern. */
export function headOutputs(head: HeadParams, inputs: Vector[], pattern?: number[][]): { pattern: number[][]; outputs: Vector[] } {
  const weights = pattern ?? attentionPattern(head, inputs)
  const written = inputs.map((input) => valueWrites(head, input))
  return { pattern: weights, outputs: mixByPattern(weights, written, head.output.length) }
}

function mixByPattern(pattern: number[][], written: Vector[], dimension: number): Vector[] {
  return pattern.map((row, i) => {
    const out = new Array<number>(dimension).fill(0)
    for (let j = 0; j <= i; j++) {
      const weight = row[j]
      if (weight === 0) continue
      for (let d = 0; d < dimension; d++) out[d] += weight * written[j][d]
    }
    return out
  })
}

/* --------------------------------------------------------------------- running */

/** Per-head, per-circuit input adjustments — the mechanism behind path patching. */
export interface HeadPatch {
  layer: number
  head: number
  /** Which input of this head is adjusted. */
  circuit: Circuit
  /** Added to that input at each position. */
  correction: Vector[]
}

export interface RunOptions {
  /** Whole heads whose written vectors are replaced. */
  replaced?: { layer: number; head: number; outputs: Vector[] }[]
  /** Additive adjustments to one head's circuit inputs. */
  patches?: HeadPatch[]
}

function correctionFor(patches: HeadPatch[] | undefined, layer: number, head: number, circuit: Circuit): Vector[] | undefined {
  const found = patches?.find((patch) => patch.layer === layer && patch.head === head && patch.circuit === circuit)
  return found?.correction
}

function adjust(stream: Vector[], correction: Vector[] | undefined): Vector[] {
  if (!correction) return stream
  return stream.map((row, position) => addVectors(row, correction[position]))
}

/** One forward pass. `runModel` is this with no options. */
export function execute(model: AttentionModel, tokens: number[], options: RunOptions = {}): Run {
  const inputs: Vector[][] = []
  const heads: HeadRun[] = []
  let stream = tokens.map((token) => model.embedding[token].slice())

  for (let layer = 0; layer < model.layers.length; layer++) {
    inputs.push(stream.map((row) => row.slice()))
    const layerHeads: HeadRun[] = []
    for (let head = 0; head < model.layers[layer].length; head++) {
      const params = model.layers[layer][head]
      const queryInputs = adjust(stream, correctionFor(options.patches, layer, head, 'query'))
      const keyInputs = adjust(stream, correctionFor(options.patches, layer, head, 'key'))
      const valueInputs = adjust(stream, correctionFor(options.patches, layer, head, 'value'))
      const pattern = attentionPattern(params, queryInputs, keyInputs)
      const override = options.replaced?.find((item) => item.layer === layer && item.head === head)?.outputs
      layerHeads.push({
        layer,
        head,
        name: params.name,
        pattern,
        outputs: override ?? mixByPattern(pattern, valueInputs.map((input) => valueWrites(params, input)), model.dimension),
      })
    }
    // Every head in a layer reads the same input and writes into the same
    // stream, so the additions happen only once the whole layer is done.
    for (const head of layerHeads) {
      stream = stream.map((row, position) => addVectors(row, head.outputs[position]))
    }
    heads.push(...layerHeads)
  }

  const logits = stream.map((row) => model.readout.map((direction) => dot(direction, row)))
  return { tokens, inputs, heads, final: stream, logits }
}

/** The clean forward pass. */
export function runModel(model: AttentionModel, tokens: number[]): Run {
  return execute(model, tokens)
}

/** The recorded behaviour of one head in a run. */
export function headRun(run: Run, layer: number, head: number): HeadRun {
  const found = run.heads.find((item) => item.layer === layer && item.head === head)
  if (!found) throw new RangeError(`headRun: no head ${layer}:${head} in this run.`)
  return found
}

/* -------------------------------------------------------------------- patching */

/** What a patch report measures: the gap between two vocabulary directions at one position. */
export interface Measure {
  /** The position whose logits are read. */
  position: number
  /** The token that should win. */
  winner: number
  /** The token that should lose. */
  loser: number
}

/** The metric: `logit[winner] - logit[loser]` at the measure's position. */
export function logitDifference(run: { logits: number[][] }, measure: Measure): number {
  const logits = run.logits[measure.position]
  return logits[measure.winner] - logits[measure.loser]
}

export interface PatchReport {
  layer: number
  head: number
  name: string
  kind: 'component' | 'path'
  /** For a path patch: the head whose output was substituted. */
  via?: { layer: number; head: number }
  /** For a path patch: which circuit read the substitution, when it was only one. */
  circuit?: Circuit
  cleanMetric: number
  patchedMetric: number
  /** The signed change in the metric. */
  effect: number
  /**
   * True when the patch is a *zeroing*: the substituted vectors are all zero, so
   * the effect is the component's own contribution rather than a move toward
   * some other input. A greedy search adds these up; mixing the two kinds would
   * double-count an ablation as a move toward the corrupted run.
   */
  isAblation: boolean
}

/** A patch report scaled against the gap it is trying to reproduce. */
export interface NormalisedPatch extends PatchReport {
  /** 1 when the patch reproduces the whole gap, 0 when it changes nothing. */
  fraction: number
}

function report(
  clean: Run,
  patched: Run,
  measure: Measure,
  identity: {
    layer: number
    head: number
    name: string
    kind: PatchReport['kind']
    via?: PatchReport['via']
    circuit?: PatchReport['circuit']
    isAblation: boolean
  },
): PatchReport {
  const cleanMetric = logitDifference(clean, measure)
  const patchedMetric = logitDifference(patched, measure)
  return { ...identity, cleanMetric, patchedMetric, effect: patchedMetric - cleanMetric }
}

/** The run in which a set of heads writes zeroes, for an ablation score. */
export function ablatedRun(model: AttentionModel, clean: Run, targets: { layer: number; head: number }[]): Run {
  return ablateHeads(model, clean.tokens, targets)
}

/**
 * Activation patching: hold the clean run, write `target`'s vectors as the other
 * run wrote them, and let everything downstream recompute.
 *
 * A head whose patch moves the answer was doing the work; one that leaves the
 * answer alone was not. When the source is the run with that head ablated —
 * `ablatedRun` — the effect is the head's own causal contribution rather than a
 * move toward a different input, and the report says which of the two it is.
 */
export function patchComponent(
  model: AttentionModel,
  clean: Run,
  source: Run,
  target: { layer: number; head: number },
  measure: Measure,
): PatchReport {
  const patched = execute(model, clean.tokens, {
    replaced: [{ layer: target.layer, head: target.head, outputs: headRun(source, target.layer, target.head).outputs }],
  })
  const substituted = headRun(source, target.layer, target.head).outputs
  const isAblation = substituted.every((vector) => vector.every((value) => value === 0))
  return report(clean, patched, measure, {
    layer: target.layer,
    head: target.head,
    name: model.layers[target.layer][target.head].name,
    kind: 'component',
    isAblation,
  })
}

/**
 * Path patching: substitute one head's output inside one circuit input of
 * another head, and change nothing else.
 *
 * This is "does head A matter to head B's keys", asked directly. The correction
 * is the difference the substitution makes to the stream B reads — the `via`
 * head's output in the other run minus its output in this one — applied only to
 * the chosen circuits. `'qk'` adjusts query and key together, which is the
 * framework's QK path; `'value'` alone is its OV path.
 */
export function patchPath(
  model: AttentionModel,
  clean: Run,
  source: Run,
  options: { from: { layer: number; head: number }; to: { layer: number; head: number }; circuits: CircuitChoice[] },
  measure: Measure,
): PatchReport {
  if (options.from.layer >= options.to.layer) {
    throw new RangeError(
      `patchPath: head ${options.from.layer}:${options.from.head} cannot reach head ${options.to.layer}:${options.to.head}. Only an earlier layer writes the stream a later head reads.`,
    )
  }
  const via = headRun(source, options.from.layer, options.from.head).outputs
  const here = headRun(clean, options.from.layer, options.from.head).outputs
  const correction = via.map((vector, position) => subtractVectors(vector, here[position]))
  const circuits: Circuit[] = options.circuits.flatMap((choice) => (choice === 'qk' ? (['query', 'key'] as Circuit[]) : [choice]))
  const patched = execute(model, clean.tokens, {
    patches: circuits.map((circuit) => ({ layer: options.to.layer, head: options.to.head, circuit, correction })),
  })
  return report(clean, patched, measure, {
    layer: options.to.layer,
    head: options.to.head,
    name: model.layers[options.to.layer][options.to.head].name,
    kind: 'path',
    via: options.from,
    circuit: circuits.length === 1 ? circuits[0] : undefined,
    isAblation: false,
  })
}

/** Ablate a set of heads: run the model with them writing zeroes. */
export function ablateHeads(model: AttentionModel, tokens: number[], targets: { layer: number; head: number }[]): Run {
  const zero: Vector[] = tokens.map(() => new Array<number>(model.dimension).fill(0))
  return execute(model, tokens, { replaced: targets.map((target) => ({ ...target, outputs: zero })) })
}

/**
 * Scale a set of patches against the gap they are trying to reproduce.
 *
 * `gap` is `metric(corrupted) - metric(clean)` for a run in which the whole
 * computation is corrupted, so a patch that reproduces that gap scores 1 and one
 * that changes nothing scores 0. A search over edges runs on these numbers,
 * which is why the definition lives next to them.
 */
export function normalise(effects: PatchReport[], gap: number): NormalisedPatch[] {
  return effects.map((effect) => ({ ...effect, fraction: Math.abs(gap) < 1e-12 ? 0 : effect.effect / gap }))
}

/* -------------------------------------------------------------- decomposition */

export interface PathTerm {
  /** The source position this term comes from. */
  source: number
  /** How much attention the head put there. */
  attention: number
  /** What the readout makes of what the head would write from there. */
  writes: number
  /** `attention * writes`: this term's contribution to the logit difference. */
  term: number
}

export interface Pathway {
  layer: number
  head: number
  position: number
  terms: PathTerm[]
  /** The sum of the terms — provably the head's whole effect on the metric. */
  total: number
  /** The same effect measured by zeroing the head and running the model again. */
  measured: number
  /** `total - measured`, which the tests drive to zero. */
  discrepancy: number
}

/**
 * The pathway decomposition of one head's contribution to the metric.
 *
 * For a head in the **last layer** the effect on the logit difference splits
 * exactly into a term per source position, because the readout and the OV
 * circuit are linear and attention is the only non-linearity in the path:
 *
 *   readout_diff . output(i) = sum_j attention(i, j) * readout_diff . (OV x_j)
 *
 * A head in an earlier layer has no such decomposition — its effect runs through
 * the softmax of the layer above, which is not linear — and asking for one
 * throws, rather than returning a number that merely looks plausible. That
 * distinction is the content of the laboratory, not a footnote.
 */
export function decomposePathway(
  model: AttentionModel,
  run: Run,
  options: { layer: number; head: number; position: number; measure: Measure },
): Pathway {
  const lastLayer = model.layers.length - 1
  if (options.layer !== lastLayer) {
    throw new RangeError(
      `decomposePathway: only the last layer's heads have an exact pathway decomposition (asked for layer ${options.layer} of ${model.layers.length}).`,
    )
  }
  const head = model.layers[options.layer][options.head]
  const inputs = run.inputs[options.layer]
  const pattern = headRun(run, options.layer, options.head).pattern
  const readoutDiff = subtractVectors(model.readout[options.measure.winner], model.readout[options.measure.loser])

  const terms: PathTerm[] = []
  for (let source = 0; source <= options.position; source++) {
    const attention = pattern[options.position][source]
    const writes = dot(readoutDiff, ovWrites(head, inputs[source]))
    terms.push({ source, attention, writes, term: attention * writes })
  }
  const total = terms.reduce((acc, term) => acc + term.term, 0)

  const ablated = ablateHeads(model, run.tokens, [{ layer: options.layer, head: options.head }])
  const measured = logitDifference(run, options.measure) - logitDifference(ablated, options.measure)

  return {
    layer: options.layer,
    head: options.head,
    position: options.position,
    terms,
    total,
    measured,
    discrepancy: total - measured,
  }
}

/**
 * The same split on the *attention* side: which positions a head is being sent
 * to, and what its QK circuit found there.
 */
export function queryPathway(
  head: HeadParams,
  run: Run,
  options: { layer: number; head: number; position: number },
): { source: number; attention: number; score: number }[] {
  const scores = headScores(head, run.inputs[options.layer])
  const pattern = headRun(run, options.layer, options.head).pattern
  const out: { source: number; attention: number; score: number }[] = []
  for (let source = 0; source <= options.position; source++) {
    out.push({ source, attention: pattern[options.position][source], score: scores[options.position][source] })
  }
  return out
}

/**
 * The head's own write, read straight off the logit direction.
 *
 * This is the *direct* effect: what the head's output is worth to the answer at
 * this position, before anything downstream gets to use it. A head can score
 * exactly zero here and still decide the answer — which is the reason the IOI
 * paper's first step finds only part of the circuit, and the reason path patching
 * exists. `decomposePathway` is the same number split per source position, and is
 * only exact for a last-layer head; this needs no such restriction, because it is
 * not claiming to be the head's total effect.
 */
export function directLogitEffect(
  model: AttentionModel,
  run: Run,
  target: { layer: number; head: number },
  measure: Measure,
): number {
  const readoutDiff = subtractVectors(model.readout[measure.winner], model.readout[measure.loser])
  return dot(readoutDiff, headRun(run, target.layer, target.head).outputs[measure.position])
}

/** The largest-magnitude term of a pathway — the display's headline number. */
export function dominantTerm(pathway: Pathway): PathTerm {
  let best = pathway.terms[0]
  for (const term of pathway.terms) if (Math.abs(term.term) > Math.abs(best.term)) best = term
  return best
}
