/**
 * The multi-hop question, and what each scorer can see of it.
 *
 * A multi-hop question needs two documents at once: one for each of its two
 * aspects. The three scorers keep different amounts of the question:
 *
 * - The lexical score keeps the words. It can find the document a question
 *   shares a word with, and it cannot find the one it paraphrases.
 * - The dense score keeps one vector for the whole question. It can find a
 *   document about the question's topic, but a long document is diluted by
 *   everything else it contains, and the exact evidence slips out of the top
 *   of the ranking.
 * - The late interaction keeps a vector per word and scores a document by the
 *   best match for each word. The diluted document keeps the exact match that
 *   the average loses.
 *
 * The corpus here is constructed rather than trained, so that each of those
 * statements is a property of the scoring function rather than a claim about
 * a particular encoder. The embeddings are fixed, the ground truth is known,
 * and every number is computed.
 */

import { createRng } from '@llm-materials/course-core'
import type { Corpus } from './corpus'
import { bm25, buildIndex, type Bm25Index } from './sparse'

export interface MultiHopOptions {
  /** The number of aspects a question can combine. */
  aspects?: number
  /** The documents about each aspect that do not contain the exact evidence. */
  topicalPerAspect?: number
  /** The documents with no aspect at all. */
  randomDocuments?: number
  /** The background tokens padding every document. */
  padding?: number
  /** The width of a token vector. */
  dimension?: number
  /** The seed. */
  seed?: number
}

export type DocumentRole = 'evidence' | 'topical' | 'random'

export interface MultiHopDocument {
  id: number
  /** One vector per token. */
  tokens: number[][]
  /** One word id per token, for the lexical retriever. */
  symbols: number[]
  aspect: number | null
  role: DocumentRole
}

export interface MultiHopQuestion {
  id: number
  tokens: number[][]
  symbols: number[]
  /** The two documents that together answer it. */
  evidence: [number, number]
}

export interface MultiHopWorld {
  documents: MultiHopDocument[]
  questions: MultiHopQuestion[]
  dimension: number
  /** The number of distinct word ids. */
  vocabulary: number
}

const DEFAULTS: Required<MultiHopOptions> = {
  aspects: 8,
  topicalPerAspect: 8,
  randomDocuments: 40,
  padding: 36,
  dimension: 16,
  seed: 7,
}

/** A random unit vector. */
function unitVector(rng: () => number, dimension: number): number[] {
  const vector: number[] = []
  for (let i = 0; i < dimension; i++) vector.push(rng() * 2 - 1)
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => value / norm)
}

/**
 * A unit vector orthogonal to a set of directions.
 *
 * The background is chosen this way so that the only similarity between a
 * question and a document is the one the aspect puts there: the demonstration
 * is about dilution, not about accidental alignment.
 */
function orthogonalUnit(rng: () => number, dimension: number, span: number[][]): number[] {
  for (let attempt = 0; attempt < 20; attempt++) {
    let vector = unitVector(rng, dimension)
    for (const direction of span) {
      const projection = dot(vector, direction)
      vector = vector.map((value, index) => value - projection * (direction[index] ?? 0))
    }
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
    if (norm > 1e-6) return vector.map((value) => value / norm)
  }
  return unitVector(rng, dimension)
}

/** A vector near another one: a fixed share along it, the rest orthogonal. */
function nearVector(base: number[], rng: () => number, dimension: number, closeness: number, span: number[][]): number[] {
  const noise = orthogonalUnit(rng, dimension, span)
  const vector = base.map((value, index) => closeness * value + Math.sqrt(1 - closeness * closeness) * (noise[index] ?? 0))
  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => value / norm)
}

const EXACT_SYMBOL = 100
const RELATED_SYMBOL = 1000
const PARAPHRASE_SYMBOL = 5000

/** Build the constructed multi-hop world. */
export function buildMultiHopWorld(options: MultiHopOptions = {}): MultiHopWorld {
  const settings = { ...DEFAULTS, ...options }
  const { aspects, dimension } = settings
  const rng = createRng(settings.seed)

  const primary: number[][] = []
  const related: number[][] = []
  for (let aspect = 0; aspect < aspects; aspect++) {
    // The aspects are mutually orthogonal, so a question's two directions do
    // not interfere by accident.
    const direction = orthogonalUnit(rng, dimension, primary)
    primary.push(direction)
    related.push(nearVector(direction, rng, dimension, 0.6, primary))
  }

  // The background vocabulary is shared by every document, orthogonal to every
  // aspect, and it is what dilutes the single vector.
  const backgroundCount = 24
  const background: number[][] = []
  for (let i = 0; i < backgroundCount; i++) background.push(orthogonalUnit(rng, dimension, primary))

  const documents: MultiHopDocument[] = []
  const pad = (): { tokens: number[][]; symbols: number[] } => {
    const tokens: number[][] = []
    const symbols: number[] = []
    for (let i = 0; i < settings.padding; i++) {
      const word = Math.floor(rng() * backgroundCount)
      tokens.push(background[word]!)
      symbols.push(word)
    }
    return { tokens, symbols }
  }

  for (let aspect = 0; aspect < aspects; aspect++) {
    // The evidence: the exact vector, in a document full of everything else.
    const evidencePadding = pad()
    documents.push({
      id: documents.length,
      tokens: [primary[aspect]!, ...evidencePadding.tokens],
      symbols: [EXACT_SYMBOL + aspect, ...evidencePadding.symbols],
      aspect,
      role: 'evidence',
    })

    // The topical documents: about the aspect, but carrying the nearby vector
    // rather than the exact one.
    for (let copy = 0; copy < settings.topicalPerAspect; copy++) {
      const topicalPadding = pad()
      const topicalTokens: number[][] = []
      const topicalSymbols: number[] = []
      for (let token = 0; token < 4; token++) {
        topicalTokens.push(related[aspect]!)
        topicalSymbols.push(RELATED_SYMBOL + aspect * 4 + token)
      }
      documents.push({
        id: documents.length,
        tokens: [...topicalTokens, ...topicalPadding.tokens],
        symbols: [...topicalSymbols, ...topicalPadding.symbols],
        aspect,
        role: 'topical',
      })
    }
  }

  for (let i = 0; i < settings.randomDocuments; i++) {
    const randomPadding = pad()
    documents.push({
      id: documents.length,
      tokens: randomPadding.tokens,
      symbols: randomPadding.symbols,
      aspect: null,
      role: 'random',
    })
  }

  const questions: MultiHopQuestion[] = []
  for (let aspect = 0; aspect < aspects; aspect += 2) {
    const first = aspect
    const second = (aspect + 1) % aspects
    const evidenceFirst = documents.find((document) => document.role === 'evidence' && document.aspect === first)!
    const evidenceSecond = documents.find((document) => document.role === 'evidence' && document.aspect === second)!
    questions.push({
      id: questions.length,
      // The first word is a paraphrase that occurs in no document; the second
      // is the exact word of the second evidence document.
      tokens: [primary[first]!, primary[second]!],
      symbols: [PARAPHRASE_SYMBOL + questions.length, EXACT_SYMBOL + second],
      evidence: [evidenceFirst.id, evidenceSecond.id],
    })
  }

  return {
    documents,
    questions,
    dimension,
    vocabulary: PARAPHRASE_SYMBOL + questions.length + 1,
  }
}

/** A corpus over the document symbols, so that the lexical scorer is real BM25. */
function lexicalCorpus(world: MultiHopWorld): { corpus: Corpus; index: Bm25Index } {
  const corpus: Corpus = {
    passages: world.documents.map((document) => ({
      id: document.id,
      words: document.symbols,
      topic: document.aspect ?? -1,
    })),
    queries: [],
    vocabulary: world.vocabulary,
    topics: 0,
    background: [],
    topicWords: [],
    options: {
      size: world.documents.length,
      queries: 0,
      topics: 0,
      background: 0,
      topicVocabulary: 0,
      length: 0,
      queryLength: 0,
      seed: 0,
    },
  }
  return { corpus, index: buildIndex(corpus) }
}

function dot(a: number[], b: number[]): number {
  let total = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) total += (a[i] ?? 0) * (b[i] ?? 0)
  return total
}

/** The normalised sum of the token vectors: the single-vector reading. */
function bagVector(tokens: number[][]): number[] {
  const dimension = tokens[0]?.length ?? 0
  const sum = new Array<number>(dimension).fill(0)
  for (const token of tokens) {
    for (let i = 0; i < dimension; i++) sum[i] = (sum[i] ?? 0) + (token[i] ?? 0)
  }
  const norm = Math.sqrt(sum.reduce((total, value) => total + value * value, 0)) || 1
  return sum.map((value) => value / norm)
}

/** The late-interaction score: each question token takes its best match. */
export function maxSimVectors(question: number[][], document: number[][]): number {
  let total = 0
  for (const token of question) {
    let best = -Infinity
    for (const candidate of document) {
      const similarity = dot(token, candidate)
      if (similarity > best) best = similarity
    }
    total += Number.isFinite(best) ? best : 0
  }
  return total
}

export type MultiHopMethod = 'lexical' | 'dense' | 'late'

/**
 * A fixed tie-break.
 *
 * A lexical scorer gives every document that shares no word with the question
 * the same score, and the order among those zeros is arbitrary. A stable hash
 * keeps the order fixed without letting the ground truth decide it.
 */
function tieBreak(id: number): number {
  let x = id + 0x9e3779b9
  x = Math.imul(x ^ (x >>> 16), 0x85ebca6b)
  x = Math.imul(x ^ (x >>> 13), 0xc2b2ae35)
  return (x ^ (x >>> 16)) >>> 0
}

function rankWith(
  world: MultiHopWorld,
  index: Bm25Index,
  question: MultiHopQuestion,
  method: MultiHopMethod,
): { id: number; score: number }[] {
  const questionBag = bagVector(question.tokens)
  const scores = world.documents.map((document) => {
    let score: number
    if (method === 'lexical') score = bm25(index, question.symbols, document.symbols)
    else if (method === 'dense') score = dot(questionBag, bagVector(document.tokens))
    else score = maxSimVectors(question.tokens, document.tokens)
    return { id: document.id, score }
  })
  scores.sort((a, b) => b.score - a.score || tieBreak(a.id) - tieBreak(b.id))
  return scores
}

/** The scored documents for a question, best first. */
export function rankMultiHop(
  world: MultiHopWorld,
  question: MultiHopQuestion,
  method: MultiHopMethod,
): { id: number; score: number }[] {
  const { index } = lexicalCorpus(world)
  return rankWith(world, index, question, method)
}

export interface MethodResult {
  /** The fraction of questions whose two evidence documents are both in the top k. */
  both: number
  /** The fraction with at least one of them in the top k. */
  atLeastOne: number
  /** The mean rank of the first evidence document, counting from one. */
  meanRank: number
}

/** The three methods on the same questions, at a depth k. */
export function compareMultiHop(world: MultiHopWorld, k = 10): Record<MultiHopMethod, MethodResult> {
  const methods: MultiHopMethod[] = ['lexical', 'dense', 'late']
  const { index } = lexicalCorpus(world)
  const result = {} as Record<MultiHopMethod, MethodResult>
  for (const method of methods) {
    let both = 0
    let atLeastOne = 0
    let rankTotal = 0
    for (const question of world.questions) {
      const ranked = rankWith(world, index, question, method)
      const positions = question.evidence.map((id) => ranked.findIndex((entry) => entry.id === id) + 1)
      const inTop = positions.filter((position) => position > 0 && position <= k).length
      if (inTop === 2) both++
      if (inTop > 0) atLeastOne++
      rankTotal += Math.min(...positions.filter((position) => position > 0))
    }
    const count = Math.max(1, world.questions.length)
    result[method] = { both: both / count, atLeastOne: atLeastOne / count, meanRank: rankTotal / count }
  }
  return result
}

/** The recall of both evidence documents at each depth, for a curve. */
export function multiHopCurve(
  world: MultiHopWorld,
  maximum = 40,
): { k: number; lexical: number; dense: number; late: number }[] {
  const curve: { k: number; lexical: number; dense: number; late: number }[] = []
  for (let k = 1; k <= maximum; k++) {
    const result = compareMultiHop(world, k)
    curve.push({ k, lexical: result.lexical.both, dense: result.dense.both, late: result.late.both })
  }
  return curve
}

/** The rank of each evidence document for one question, under each method. */
export function evidenceRanks(
  world: MultiHopWorld,
  question: MultiHopQuestion,
): Record<MultiHopMethod, [number, number]> {
  const methods: MultiHopMethod[] = ['lexical', 'dense', 'late']
  const result = {} as Record<MultiHopMethod, [number, number]>
  for (const method of methods) {
    const ranked = rankMultiHop(world, question, method)
    const ranks = question.evidence.map((id) => ranked.findIndex((entry) => entry.id === id) + 1)
    result[method] = [ranks[0] ?? 0, ranks[1] ?? 0]
  }
  return result
}
