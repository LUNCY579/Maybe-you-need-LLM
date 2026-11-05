/**
 * The induction circuit, wired as a two-layer attention model.
 *
 * `induction.ts` draws the same circuit as a pair of hand-computed attention
 * patterns, which is the clearest way to see what an induction head does. This
 * module builds it the way a transformer does — one-hot token embeddings, a
 * positional head in layer 0, content heads in layer 1 — so that the machinery of
 * `attention.ts` can be pointed at a circuit whose ground truth is known.
 *
 * That matters for the circuit search. An interpretation of a real model can only
 * be checked against more interventions; an interpretation of *this* model can be
 * checked against the wiring, which is why the search's answer is a test rather
 * than a claim.
 *
 * The stream has eighteen dimensions, split into three blocks of six:
 *
 * | Block | Dimensions | What lives there |
 * | --- | --- | --- |
 * | identity | 0..5 | the token itself, written by the embedding and read by the readout |
 * | shifted | 6..11 | the token *before* this one, written by the previous-token head |
 * | marker | 12..17 | a copy of an earlier occurrence of this token, written by the duplicate-token head |
 *
 * A logit is an identity coordinate of the final stream, which is why a head can
 * "copy a token" simply by writing that token's one-hot into the identity block.
 * Nothing here was trained: the wiring is the claim, and the temperature of each
 * head is what makes its attention a near-hard choice rather than a blur.
 */

import { basis, emptyHead, rankOne, type AttentionModel, type HeadRun, type HeadParams, type Run } from './attention'
import { EMBED_NODE, READOUT_NODE, headNode } from './circuitDiscovery'

/** The dimension blocks, so a screen can name what it is drawing. */
export const BLOCKS = {
  identity: 0,
  shifted: 6,
  marker: 12,
} as const

/** Width of every block, and of the vocabulary. */
export const BLOCK_WIDTH = 6

/** The dimension of the model this module builds. */
export const DIMENSION = 18

/** The vocabulary, named for the demonstration. */
export const INDUCTION_TOKENS = ['bos', 'a', 'b', 'c', 'd', 'eos'] as const

/** The sequence the demonstration runs on: `bos a b c d a b c`. */
export const INDUCTION_SEQUENCE = [0, 1, 2, 3, 4, 1, 2, 3]

/** The second `a` asks the circuit for `b`, and the second `b` asks for `c`. */
export const INDUCTION_TEST_POSITIONS = [5, 6] as const

/** A `BLOCK_WIDTH x DIMENSION` matrix that reads one block of the stream. */
function readBlock(offset: number) {
  return Array.from({ length: BLOCK_WIDTH }, (_, row) =>
    Array.from({ length: DIMENSION }, (_, column) => (column === row + offset ? 1 : 0)),
  )
}

/** A `DIMENSION x BLOCK_WIDTH` matrix that writes one block of the stream, with gain. */
function writeBlock(offset: number, gain: number) {
  return Array.from({ length: DIMENSION }, (_, row) =>
    Array.from({ length: BLOCK_WIDTH }, (_, column) => (row === column + offset ? gain : 0)),
  )
}

/** A head that reads the stream at `keyBlock` on one side and `queryBlock` on the other. */
function matcher(queryBlock: number, keyBlock: number): Pick<HeadParams, 'query' | 'key'> {
  return { query: readBlock(queryBlock), key: readBlock(keyBlock) }
}

/** A head whose OV circuit copies one block of the attended position into another. */
function copier(sourceBlock: number, targetBlock: number, gain: number): Pick<HeadParams, 'value' | 'output'> {
  return { value: readBlock(sourceBlock), output: writeBlock(targetBlock, gain) }
}

const shell = { dimension: DIMENSION, keyDimension: BLOCK_WIDTH, valueDimension: BLOCK_WIDTH }

/**
 * The wired model: a positional previous-token head, a duplicate-token head, and
 * an induction head that reads what the first of them wrote.
 */
export function buildInductionModel(): AttentionModel {
  const previousToken = emptyHead('previous-token head', shell)
  // No content weights at all: this head is sent to distance 1 and nowhere else.
  previousToken.distanceBias = [0, 12]
  previousToken.temperature = 0.05
  Object.assign(previousToken, copier(BLOCKS.identity, BLOCKS.shifted, 1))

  const duplicateToken = emptyHead('duplicate-token head', shell)
  Object.assign(duplicateToken, matcher(BLOCKS.identity, BLOCKS.identity))
  // A token is never its own earlier occurrence, so distance 0 is suppressed.
  duplicateToken.distanceBias = [-12]
  duplicateToken.temperature = 0.05
  Object.assign(duplicateToken, copier(BLOCKS.identity, BLOCKS.marker, 1))

  const induction = emptyHead('induction head', shell)
  Object.assign(induction, matcher(BLOCKS.identity, BLOCKS.shifted))
  induction.temperature = 0.02
  // The gain is why the copy beats the token already sitting in the identity
  // block: at the final position the circuit predicts `b`, but `a` is present too.
  Object.assign(induction, copier(BLOCKS.identity, BLOCKS.identity, 4))

  return {
    dimension: DIMENSION,
    keyDimension: BLOCK_WIDTH,
    valueDimension: BLOCK_WIDTH,
    vocabulary: INDUCTION_TOKENS.length,
    embedding: INDUCTION_TOKENS.map((_, token) => basis(DIMENSION, token)),
    readout: INDUCTION_TOKENS.map((_, token) => basis(DIMENSION, token)),
    layers: [[previousToken, duplicateToken], [induction]],
  }
}

/** The model, built once for callers that only read it. */
export const inductionModel = buildInductionModel()

/** The recorded behaviour of a named head in a run. */
export function namedHead(run: Run, name: string): HeadRun {
  const found = run.heads.find((head) => head.name === name)
  if (!found) throw new RangeError(`namedHead: no head called ${name} in this run.`)
  return found
}

/**
 * The positions at which an earlier occurrence makes the next token predictable,
 * and what it is.
 *
 * Derived from the sequence rather than recorded, so changing the demonstration
 * cannot leave the expectation stale.
 */
export function inductionTargets(
  sequence: number[] = INDUCTION_SEQUENCE,
): { position: number; match: number; expected: number }[] {
  const out: { position: number; match: number; expected: number }[] = []
  for (let position = 1; position < sequence.length - 1; position++) {
    for (let earlier = 0; earlier < position; earlier++) {
      if (sequence[earlier] === sequence[position]) {
        out.push({ position, match: earlier + 1, expected: sequence[earlier + 1] })
        break
      }
    }
  }
  return out
}

/** The name of a component, for a search report. */
export function componentName(model: AttentionModel, layer: number, head: number): string {
  return model.layers[layer][head].name
}

/** Where a token replacement can land so that it takes the circuit apart. */
export type CorruptionSite = 'occurrence' | 'successor'

/**
 * The two positions worth corrupting for one target, and what each erases.
 *
 * Both break the behaviour, and they do it at opposite ends of the circuit: the
 * occurrence is what the match is against, the successor is what gets copied. This is
 * the screen's central knob, so the search's answer is read against it rather than
 * around it.
 */
export const CORRUPTION_SITES: { value: CorruptionSite; label: string; role: string; note: string }[] = [
  {
    value: 'occurrence',
    label: 'The earlier occurrence',
    role: 'earlier occurrence',
    note: 'The token the head matches against. Erasing it breaks the pointer, so the shift and the key edge are the ones that carry the behaviour.',
  },
  {
    value: 'successor',
    label: 'The token it copies',
    role: 'token it copies',
    note: 'What the head reads once it has matched. Erasing it breaks the content, so the value and logit edges carry it and the pointer is never tested.',
  },
]

/** One site's entry, for a screen that has to name it. */
export function corruptionSite(site: CorruptionSite) {
  const found = CORRUPTION_SITES.find((entry) => entry.value === site)
  if (!found) throw new RangeError(`corruptionSite: no site ${site}.`)
  return found
}

/** The sequence position a site names, for a target from `inductionTargets`. */
export function sitePosition(target: { position: number; match: number }, site: CorruptionSite): number {
  return site === 'occurrence' ? target.match - 1 : target.match
}

/**
 * The circuit, stated as a graph rather than as a wiring.
 *
 * Four edges, one per step of the algorithm: the embedding feeds the previous-token
 * head's *value* (so a token can be copied), that head's write reaches the induction
 * head's *keys* (so the match is against what came before each position), the
 * embedding feeds the induction head's own *value* (so what it copies is the token
 * identity, not the shift), and the induction head's write reaches the logits.
 * Nothing else in this model can carry the behaviour: the duplicate-token head writes
 * the marker block, which no head reads and the readout ignores.
 *
 * The value edge of the induction head is the one a hand-drawn picture usually leaves
 * implicit — the copy has to come from somewhere. Cut it and the graph restores none
 * of the behaviour when the corruption erases the token being copied, which is the
 * corruption that tests it.
 *
 * This is the ground truth the circuit search is graded against. It is derived from the
 * wiring above rather than from a result the search produced, which is the only order
 * that makes the grade mean anything.
 *
 * One warning, because it is the whole point of the laboratory: *no single corruption
 * needs all four*. Replacing the earlier occurrence makes the shift and the match
 * necessary and leaves the copy's content untouched; replacing the token that gets
 * copied does exactly the reverse. Each search answer is therefore a proper subset, and
 * the wiring is their union. A discovered circuit is a claim about a behaviour *and*
 * the intervention that isolates it, never about the model alone.
 */
export function inductionCircuitEdges(): string[] {
  const previous = headNode(0, 0)
  const induction = headNode(1, 0)
  return [
    `${EMBED_NODE}->${previous}:value`,
    `${EMBED_NODE}->${induction}:value`,
    `${previous}->${induction}:key`,
    `${induction}->${READOUT_NODE}:logit`,
  ]
}

/** Re-exported because a screen describing a circuit wants the rank-one word. */
export { rankOne }
