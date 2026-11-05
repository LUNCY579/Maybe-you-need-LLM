/**
 * The IOI circuit, and the four steps that found it.
 *
 * Wang et al. (2022) reverse-engineered one behaviour of GPT-2 small — given
 * "When Mary and John went to the store, John gave a drink to", answer *Mary* —
 * and the result is the most detailed circuit ever read out of a language model:
 * 26 attention heads in seven classes. What this module does is reproduce the
 * **procedure**, on a model small enough to check, so that the four steps can be
 * run rather than described.
 *
 * **What is real and what is a toy.** The circuit below is a hand-wired
 * three-layer model with four heads, one per class the procedure needs: a
 * duplicate-token head, an S-inhibition head, a name mover and a backup name
 * mover. It is not GPT-2 small. Its vocabulary is eight tokens, its residual stream
 * is sixteen dimensions, and every weight is set by the rules in `buildIoiModel()`.
 * The published head indices, class names and paper figures are carried as *quoted
 * data* in `publishedIoICircuit()` and `PAPER_FIGURES`, so a screen can show both
 * without confusing them.
 *
 * **Why the toy is enough.** The interesting thing about the IOI discovery is the
 * order of the questions. The heads that decide which name gets copied have **no
 * direct effect at all** on the answer: what they write lands in part of the stream
 * the readout never looks at. Step 1 cannot find them, and only step 2's path patch
 * can. Our toy reproduces exactly that — the S-inhibition head's direct score is
 * zero to machine precision — which is what makes it a demonstration of the method
 * rather than a repainting of the paper's figure.
 *
 * **The one deliberate simplification.** The residual stream carries a constant
 * direction (dimension 15), which the embedding writes into every token. That is
 * what lets a head ask "is this candidate a name?" without needing any content at
 * its own position. GPT-2 gets the same effect from biases and unembedding
 * components; here it is one dimension, so it can be pointed at.
 *
 * **What the toy does not reproduce.** The paper's §3.4 result is that the backup
 * movers *take over* when the name movers are removed — their attention on the
 * object rises. Here the two movers are the same circuit at different gains, so
 * their ablation shares are exactly additive: removing one leaves the other at its
 * own unchanged strength. The redundancy check in `ioiWorkflow` computes both
 * numbers, and the screen says which of the two behaviours it is showing.
 */

import {
  ablateHeads,
  basis,
  directLogitEffect,
  emptyHead,
  logitDifference,
  patchPath,
  runModel,
  type AttentionModel,
  type CircuitChoice,
  type Measure,
  type Run,
} from './attention'
import type { Matrix } from '@llm-materials/course-core'

/* ------------------------------------------------------------------ the prompt */

/** The words of the paper's prompt, in the order the compressed template uses them. */
export const IOI_TOKENS = ['when', 'mary', 'and', 'john', 'store', 'gave', 'drink', 'to'] as const

/** `when mary and john store john gave drink to`: the subject `john` occurs twice, the object `mary` once. */
export const IOI_SEQUENCE = [0, 1, 2, 3, 4, 3, 5, 6, 7]

/** The four token roles the paper names, by position in `IOI_SEQUENCE`. */
export const IOI_ROLES = {
  /** The indirect object: the answer. */
  io: 1,
  /** The subject's first occurrence. */
  s1: 3,
  /** The subject's second occurrence — the doubled name. */
  s2: 5,
  /** The position whose logits are read. */
  end: 8,
} as const

/** `mary` against `john`, at END: the paper's logit difference. */
export const IOI_MEASURE: Measure = { position: IOI_ROLES.end, winner: 1, loser: 3 }

/**
 * The same template with the two names exchanged, so the doubled name is now the
 * object's. The circuit was not written for this prompt — its mary and john
 * dimensions are interchangeable by construction — which is what makes it worth
 * running the four steps on: a lookup table would fail here.
 */
export const IOI_MIRROR_SEQUENCE = [0, 3, 2, 1, 4, 1, 5, 6, 7]

/** Now the answer is `john`, the indirect object of the mirrored prompt. */
export const IOI_MIRROR_MEASURE: Measure = { position: IOI_ROLES.end, winner: 3, loser: 1 }

/* --------------------------------------------------------------- the stream */

/** Which block of the stream holds what, so a screen can colour it. */
export const IOI_BLOCKS = {
  /** The token itself, which the readout reads. */
  identity: 0,
  /** Which name this token is, and whether it is a name at all. */
  name: 8,
  /** Markers: doubled names, inhibition, and the constant direction. */
  mark: 11,
} as const

export const IOI_DIMENSION = 16

const MARK = {
  doubledMary: 11,
  doubledJohn: 12,
  inhibitedMary: 13,
  inhibitedJohn: 14,
  constant: 15,
} as const

const NAME = { mary: 8, john: 9, isName: 10 } as const

const ID = [0, 1, 2, 3, 4, 5, 6, 7]

/**
 * What each of the sixteen stream dimensions carries, derived from the constants
 * above rather than written out again, so a screen can label a coordinate and be
 * sure the label still matches the wiring.
 */
export const IOI_DIMENSION_NAMES: string[] = (() => {
  const named: Record<number, string> = {
    [NAME.mary]: 'mary',
    [NAME.john]: 'john',
    [NAME.isName]: 'is a name',
    [MARK.doubledMary]: 'doubled mary',
    [MARK.doubledJohn]: 'doubled john',
    [MARK.inhibitedMary]: 'inhibited mary',
    [MARK.inhibitedJohn]: 'inhibited john',
    [MARK.constant]: 'constant',
  }
  return Array.from({ length: IOI_DIMENSION }, (_, dimension) => named[dimension] ?? IOI_TOKENS[dimension] ?? `dimension ${dimension}`)
})()

/**
 * A head shell for the given widths.
 *
 * Every head below replaces all four of its matrices, so these widths only set
 * what `emptyHead` starts from; they are given per head so that a head's
 * `query.length` is honest even before the assignment that overwrites it.
 */
const shell = (keyDimension: number, valueDimension: number) => ({
  dimension: IOI_DIMENSION,
  keyDimension,
  valueDimension,
})

/** A `indices.length x DIMENSION` matrix whose rows pick stream coordinates out. */
function reader(indices: number[]): Matrix {
  return indices.map((index) => basis(IOI_DIMENSION, index))
}

/** A `DIMENSION x width` matrix that sends each value coordinate into a stream coordinate. */
function writer(width: number, routes: { from: number; to: number; gain: number }[]): Matrix {
  const matrix = Array.from({ length: IOI_DIMENSION }, () => new Array<number>(width).fill(0))
  for (const route of routes) {
    const row = matrix[route.to]
    if (!row) throw new RangeError(`writer: dimension ${route.to} is outside the stream.`)
    row[route.from] = route.gain
  }
  return matrix
}

/**
 * The toy circuit: four heads, one per class, in three layers.
 *
 * 1. The **duplicate-token head** matches the current token against earlier
 *    occurrences of itself and marks the position it lands on — here S2 gets
 *    `doubledJohn`, and no other position gets a mark big enough to be read.
 * 2. The **S-inhibition head** looks for the marked position, reads which name it
 *    is, and writes that name *negatively* into END's marker block. It never
 *    touches a logit.
 * 3. The **name mover** at END scores each candidate as `is-a-name` minus
 *    `is-the-inhibited-name`, so the inhibition decides where it looks, and its OV
 *    circuit copies the attended token's identity into the logits. The
 *    **backup name mover** is the same circuit at a third of the gain — the
 *    redundancy of §3.4, in one weight, and additive rather than a takeover.
 */
export function buildIoiModel(): AttentionModel {
  const duplicateToken = emptyHead('duplicate-token head', shell(ID.length, 2))
  duplicateToken.query = reader(ID)
  duplicateToken.key = reader(ID)
  // A token is never its own earlier occurrence.
  duplicateToken.distanceBias = [-12]
  duplicateToken.temperature = 0.05
  duplicateToken.value = reader([NAME.mary, NAME.john])
  duplicateToken.output = writer(2, [
    { from: 0, to: MARK.doubledMary, gain: 1 },
    { from: 1, to: MARK.doubledJohn, gain: 1 },
  ])

  const sInhibition = emptyHead('S-inhibition head', shell(2, 2))
  sInhibition.query = reader([MARK.constant, MARK.constant])
  sInhibition.key = reader([MARK.doubledMary, MARK.doubledJohn])
  sInhibition.temperature = 0.05
  sInhibition.value = reader([NAME.mary, NAME.john])
  sInhibition.output = writer(2, [
    { from: 0, to: MARK.inhibitedMary, gain: -1 },
    { from: 1, to: MARK.inhibitedJohn, gain: -1 },
  ])

  // One QK circuit and one OV route, shared by both movers: the backup is the
  // same head at a third of the gain, which is the difference the paper draws
  // between the two classes.
  const moverQuery = reader([MARK.inhibitedMary, MARK.inhibitedJohn, MARK.constant])
  const moverKey = reader([NAME.mary, NAME.john, NAME.isName])
  const moverValue = reader(ID)
  const copyToLogits = (gain: number): Matrix => writer(ID.length, ID.map((dimension) => ({ from: dimension, to: dimension, gain })))

  const nameMover = emptyHead('name mover head', shell(3, ID.length))
  nameMover.query = moverQuery
  nameMover.key = moverKey
  nameMover.temperature = 0.05
  nameMover.value = moverValue
  nameMover.output = copyToLogits(5)

  const backup = emptyHead('backup name mover', shell(3, ID.length))
  backup.query = moverQuery
  backup.key = moverKey
  backup.temperature = 0.1
  backup.value = moverValue
  backup.output = copyToLogits(1.5)

  const embedding = IOI_TOKENS.map((_, token) => {
    const vector = basis(IOI_DIMENSION, token)
    vector[MARK.constant] = 1
    if (token === 1) vector[NAME.mary] = 1
    if (token === 3) vector[NAME.john] = 1
    if (token === 1 || token === 3) vector[NAME.isName] = 1
    return vector
  })

  return {
    dimension: IOI_DIMENSION,
    keyDimension: 8,
    valueDimension: 8,
    vocabulary: IOI_TOKENS.length,
    embedding,
    readout: IOI_TOKENS.map((_, token) => basis(IOI_DIMENSION, token)),
    layers: [[duplicateToken], [sInhibition], [nameMover, backup]],
  }
}

/** The model, built once for callers that only read it. */
export const ioiModel = buildIoiModel()

/** The layer and head of each class of the toy circuit. */
export const IOI_HEADS = {
  duplicateToken: { layer: 0, head: 0 },
  sInhibition: { layer: 1, head: 0 },
  nameMover: { layer: 2, head: 0 },
  backup: { layer: 2, head: 1 },
} as const

/* --------------------------------------------------------- the published circuit */

export interface PublishedClass {
  /** The class name as the paper gives it. */
  name: string
  /** GPT-2 small heads, written `layer.index` as the paper writes them. */
  heads: string[]
  /** Heads the paper assigns to the class while saying the assignment is not clean. */
  fuzzy: string[]
  /** What the class does, in the paper's own terms. */
  role: string
  section: string
}

/**
 * The published circuit, as quoted data.
 *
 * These are the paper's numbers and the paper's names, not ours: nothing here is
 * computed. Checked against the arXiv text (2211.00593) on 2026-10-29; a claim that
 * could not be found there is left out rather than approximated — which is why the
 * Negative Name Mover row says less than the others.
 *
 * `heads: 26` is the paper's own total, kept separate from the list below so that a
 * transcription slip shows up as a failed test rather than being quietly absorbed by
 * counting the rows.
 */
export function publishedIoICircuit(): { heads: number; classes: number; model: string; prompt: string; circuit: PublishedClass[] } {
  const circuit: PublishedClass[] = [
    {
      name: 'Name Mover Heads',
      heads: ['9.6', '9.9', '10.0'],
      fuzzy: [],
      role: 'Attend from END to a name and copy it into the logits; all three have a copy score above 95%.',
      section: '§3.1',
    },
    {
      name: 'S-Inhibition Heads',
      heads: ['7.3', '7.9', '8.6', '8.10'],
      fuzzy: [],
      role: 'Act at END and attend to the subject, so the name movers look at the indirect object instead.',
      section: '§3.2',
    },
    {
      name: 'Duplicate Token Heads',
      heads: ['3.0', '0.1'],
      fuzzy: ['0.10'],
      role: 'Attend from a token to an earlier copy of it, moving S1’s information to S2. Head 0.10 is the paper’s “fuzzy” case.',
      section: '§3.3',
    },
    {
      name: 'Induction Heads',
      heads: ['5.5', '6.9'],
      fuzzy: ['5.8', '5.9'],
      role: 'The same composition one layer up, matching on the previous token rather than the current one.',
      section: '§3.3',
    },
    {
      name: 'Previous Token Heads',
      heads: ['4.11', '2.2'],
      fuzzy: [],
      role: 'Write each token’s predecessor, which is what lets an induction head match on it.',
      section: 'appendix D',
    },
    {
      name: 'Negative Name Mover Heads',
      heads: ['10.7', '11.10'],
      fuzzy: [],
      role: 'The class whose effect on the logit difference runs the other way to the name movers’.',
      section: '§3.1',
    },
    {
      name: 'Backup Name Mover Heads',
      heads: ['9.0', '10.1', '10.6', '10.10', '10.2', '11.9', '11.2', '9.7'],
      fuzzy: [],
      role: 'Eight heads that do the name movers’ job less well, and take over when the name movers are removed.',
      section: '§3.4',
    },
  ]

  return {
    heads: 26,
    classes: circuit.length,
    model: 'GPT-2 small (12 layers x 12 heads)',
    prompt: 'When Mary and John went to the store, John gave a drink to',
    circuit,
  }
}

/** Every head the transcription names, clean and fuzzy together. */
export function publishedHeadCount(): number {
  return publishedIoICircuit().circuit.reduce((total, entry) => total + entry.heads.length + entry.fuzzy.length, 0)
}

/** The paper's own account of how good its circuit is, quoted rather than recomputed. */
export const PAPER_FIGURES = {
  source: 'arXiv:2211.00593',
  /** Mean logit difference over the paper's prompt distribution. */
  meanLogitDifference: 3.56,
  /** How much of the model's logit difference the 26-head circuit reproduces. */
  circuitShareOfPerformance: 0.87,
  /** Prompts on which GPT-2 small prefers the indirect object to the subject. */
  ioOverSubject: 0.993,
} as const

/* ------------------------------------------------------------------- the steps */

export interface Intervention {
  /** The head the intervention was done to. */
  target: { layer: number; head: number; name: string }
  /** For a path patch: whose ablated output was substituted into it. */
  via?: { layer: number; head: number; name: string }
  /** Which circuit of the target the substitution read. */
  circuits?: CircuitChoice[]
  /** `metric(patched) - metric(clean)`, or the head's own write for a direct score. */
  effect: number
  /** `effect / metric(clean)`: the share of the answer it moves. */
  share: number
}

export interface WorkflowStep {
  id: 'direct' | 'attention' | 'upstream' | 'criteria'
  title: string
  question: string
  sections: string
  /** The share of the logit difference a result has to move to count as found. */
  criterion: number
  results: Intervention[]
  /** The heads this step identifies, by name. */
  found: string[]
}

export interface IoiCriteria {
  /** The logit difference with every discovered head ablated. */
  afterCircuitAblation: number
  /** And with the model untouched. */
  clean: number
  /** `1 - ablated / clean`: the share of the behaviour the circuit accounts for. 1 is complete. */
  completeness: number
  /** Every member of the circuit ablated alone. */
  minimality: Intervention[]
  /** The two movers alone and together — the paper's §3.4 redundancy. */
  redundancy: { eachAlone: number[]; bothTogether: number }
}

export interface IoiWorkflow {
  steps: WorkflowStep[]
  criteria: IoiCriteria
  /** The circuit the four steps arrive at, as head names. */
  discovered: string[]
}

const CRITERION = 0.01

function headsOf(model: AttentionModel): { layer: number; head: number; name: string }[] {
  const out: { layer: number; head: number; name: string }[] = []
  model.layers.forEach((layer, l) => layer.forEach((head, h) => out.push({ layer: l, head: h, name: head.name })))
  return out
}

function earlierThan(model: AttentionModel, target: { layer: number }): { layer: number; head: number; name: string }[] {
  return headsOf(model).filter((candidate) => candidate.layer < target.layer)
}

/** The metric of the model with a set of heads writing zeroes. */
export function ablatedMetric(
  model: AttentionModel,
  tokens: number[],
  targets: { layer: number; head: number }[],
  measure: Measure,
): number {
  return logitDifference(ablateHeads(model, tokens, targets), measure)
}

/**
 * Path-patch an earlier head's *ablated* output into one circuit of a later head.
 *
 * Ablation rather than a second input is what the paper uses: the question is
 * "does what this head writes matter to that head's attention", asked with
 * everything else held at the clean run.
 */
function pathEffect(
  model: AttentionModel,
  clean: Run,
  via: { layer: number; head: number; name: string },
  to: { layer: number; head: number; name: string },
  circuits: CircuitChoice[],
  measure: Measure,
  metric: number,
): Intervention {
  const source = ablateHeads(model, clean.tokens, [via])
  const report = patchPath(model, clean, source, { from: via, to, circuits }, measure)
  return { target: to, via, circuits, effect: report.effect, share: report.effect / metric }
}

function ranked(results: Intervention[], criterion: number, by: 'target' | 'via'): string[] {
  const names = new Set<string>()
  for (const result of results) {
    if (Math.abs(result.share) < criterion) continue
    const named = by === 'via' ? result.via : result.target
    if (named) names.add(named.name)
  }
  return [...names]
}

/**
 * The paper's procedure, run on our circuit.
 *
 * §3.1 asks which heads move the answer with their own write. §3.2 asks which heads
 * move it *through those heads' attention* — a path patch into the query, the
 * framework's way of asking who decided where a head looked. §3.3 asks the same
 * question one layer down. §4 then asks whether the list is enough (completeness)
 * and whether every item on it is needed (minimality), with the backup movers as
 * the check that a list can pass both and still be missing half the story.
 *
 * Every number comes from an intervention on the model. The only thing carried in
 * from the paper is the order of the questions.
 */
export function ioiWorkflow(
  model: AttentionModel = ioiModel,
  tokens: number[] = IOI_SEQUENCE,
  measure: Measure = IOI_MEASURE,
): IoiWorkflow {
  const clean = runModel(model, tokens)
  const metric = logitDifference(clean, measure)
  const all = headsOf(model)

  const direct: Intervention[] = all.map((head) => {
    const effect = directLogitEffect(model, clean, head, measure)
    return { target: head, effect, share: effect / metric }
  })
  const directStep: WorkflowStep = {
    id: 'direct',
    title: 'Which heads affect the output directly?',
    question:
      'Read what each head writes at the answer position against the two name directions. Whatever moves the answer on its own is on the surface of the circuit; whatever does not is still doing work nobody has found yet.',
    sections: '§3.1',
    criterion: CRITERION,
    results: direct,
    found: ranked(direct, CRITERION, 'target'),
  }

  const movers = all.filter((head) => directStep.found.includes(head.name))
  const attention: Intervention[] = []
  for (const mover of movers) {
    for (const candidate of earlierThan(model, mover)) {
      for (const circuits of [['query'] as CircuitChoice[], ['key'] as CircuitChoice[], ['value'] as CircuitChoice[]]) {
        attention.push(pathEffect(model, clean, candidate, mover, circuits, measure, metric))
      }
    }
  }
  const attentionStep: WorkflowStep = {
    id: 'attention',
    title: 'Which heads choose where those heads look?',
    question:
      'Path-patch every earlier head into the query, the key and the value of each mover, ablating it. A head that matters through the query and nowhere else is deciding what the mover attends to, and has no direct effect at all.',
    sections: '§3.2',
    criterion: CRITERION,
    results: attention,
    found: ranked(attention, CRITERION, 'via'),
  }

  const upstream: Intervention[] = []
  for (const name of attentionStep.found) {
    const foundHead = all.find((head) => head.name === name)
    if (!foundHead) continue
    for (const candidate of earlierThan(model, foundHead)) {
      for (const circuits of [['query'] as CircuitChoice[], ['key'] as CircuitChoice[], ['value'] as CircuitChoice[]]) {
        upstream.push(pathEffect(model, clean, candidate, foundHead, circuits, measure, metric))
      }
    }
  }
  const upstreamStep: WorkflowStep = {
    id: 'upstream',
    title: 'What do those heads read?',
    question:
      'One layer down, the same question: path-patch into the circuits of the heads step two found. This is how the paper reached the duplicate-token and induction classes.',
    sections: '§3.3 and §3.4',
    criterion: CRITERION,
    results: upstream,
    found: ranked(upstream, CRITERION, 'via'),
  }

  const discovered = [...new Set([...directStep.found, ...attentionStep.found, ...upstreamStep.found])]
  const members = all.filter((head) => discovered.includes(head.name))
  const afterCircuitAblation = ablatedMetric(model, tokens, members, measure)

  // The redundancy check is on the class step one found — the heads that write the
  // answer themselves — asked alone and then together.
  const moverMembers = members.filter((head) => directStep.found.includes(head.name))
  const redundancy = {
    eachAlone: moverMembers.map((head) => 1 - ablatedMetric(model, tokens, [head], measure) / metric),
    bothTogether: 1 - ablatedMetric(model, tokens, moverMembers, measure) / metric,
  }

  const criteria: IoiCriteria = {
    afterCircuitAblation,
    clean: metric,
    completeness: metric === 0 ? 0 : 1 - afterCircuitAblation / metric,
    minimality: members.map((head) => {
      const effect = ablatedMetric(model, tokens, [head], measure) - metric
      return { target: head, effect, share: effect / metric }
    }),
    redundancy,
  }

  return { steps: [directStep, attentionStep, upstreamStep], criteria, discovered }
}

/** The attention each head of the toy circuit puts on each position, at END. */
export function ioiAttention(
  model: AttentionModel = ioiModel,
  tokens: number[] = IOI_SEQUENCE,
): { name: string; layer: number; head: number; atEnd: number[] }[] {
  const run = runModel(model, tokens)
  return run.heads.map((head) => ({
    name: head.name,
    layer: head.layer,
    head: head.head,
    atEnd: head.pattern[IOI_ROLES.end] ?? [],
  }))
}
