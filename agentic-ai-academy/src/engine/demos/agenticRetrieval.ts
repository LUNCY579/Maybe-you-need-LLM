/**
 * Agentic retrieval: the agent decides whether, what and how often to retrieve.
 *
 * Chapter 12 teaches the retrieve-then-generate pipeline first (§12.2–12.4), and
 * then says the pipeline is not an agent. Three claims carry that transition, and
 * all three are measurable rather than rhetorical:
 *
 *  - **Adaptive retrieval with critique** (Self-RAG, Asai et al. 2023, §12.4).
 *    Retrieval should be *gated*: the agent judges whether the question needs a
 *    lookup at all, retrieves, then grades each passage as supported or not and
 *    answers, re-retrieves with a rewritten query, or abstains. The gate and the
 *    critic are both decisions that can be wrong, and their errors are cheap to
 *    measure once they are code.
 *  - **Question decomposition for multi-hop retrieval** (Self-Ask, Press et al.
 *    2022, §12.4). A two-hop question cannot be expressed as one query, so one
 *    retrieval for the whole question misses the bridge fact — while decomposing
 *    hands the next query an intermediate answer that may be wrong. Decomposition
 *    buys coverage and costs propagation, in the same run.
 *  - **The survey that maps agentic RAG onto the single-shot pipeline the chapter
 *    teaches** (Chen et al. 2025, §12.6). The taxonomy is a set of *pipeline
 *    shapes* — single-shot, router, adaptive retrieval, decomposition — and the
 *    shapes are comparable on one case set. That comparison is what this file
 *    computes.
 *
 * What this engine is and is not. It calls no model and uses no randomness: the
 * critic, the gate and the retriever are scoring functions over hand-authored
 * case data, and the same inputs always give the same numbers. The case set is
 * synthetic and exists to be a measuring instrument, so every figure below is a
 * measurement of *these* shapes on *this* set. No number in the Self-RAG, Self-Ask
 * or agentic-RAG survey papers is reproduced here, and none of the outputs should
 * be read as an estimate of a deployed system's accuracy, cost or latency.
 *
 * The passages, the retrieval primitive and the attention curve are the ones the
 * §12.2–12.4 pipeline already uses, imported from `./retrieval` so the two halves
 * of the chapter share one corpus and one definition of "the model used it".
 */

import {
  RETRIEVAL_CASES,
  retrieve,
  salienceAt,
  type Passage,
  type RetrievalCase,
} from './retrieval'

/* ------------------------------------------------------------------ */
/* The shared lexical core                                             */
/* ------------------------------------------------------------------ */

/**
 * Words that carry no signal about which document to open, so the gate and the
 * critic both ignore them. The list is short and deliberately ordinary: it is a
 * toy stemmer over a toy corpus, and pretending otherwise would be the first
 * dishonest thing in the file.
 */
const STOP_WORDS = new Set([
  'a', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'been', 'but', 'by', 'can',
  'did', 'do', 'does', 'for', 'from', 'had', 'has', 'have', 'how', 'i', 'if',
  'in', 'into', 'is', 'it', 'its', 'me', 'more', 'most', 'not', 'of', 'on', 'or',
  'our', 'so', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'this', 'to', 'up', 'us', 'was', 'we', 'were', 'what', 'when', 'where', 'which',
  'who', 'why', 'will', 'with', 'you', 'your',
])

/** A crude stem, so "supplies", "supplied" and "supply" are one word. */
function stem(word: string): string {
  let w = word
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1)
  return w.length > 5 ? w.slice(0, 5) : w
}

/** The content words of a piece of text, stemmed and de-duplicated. */
export function contentWords(text: string): string[] {
  const seen: string[] = []
  for (const raw of text.toLowerCase().match(/[a-z0-9]+/g) ?? []) {
    if (raw.length < 3 || STOP_WORDS.has(raw)) continue
    const key = stem(raw)
    if (!seen.includes(key)) seen.push(key)
  }
  return seen
}

/** The content words a query and a passage share. */
export function sharedStems(query: string, text: string): string[] {
  const inText = new Set(contentWords(text))
  return contentWords(query).filter((word) => inText.has(word))
}

/**
 * What share of the question's content words the passage contains.
 *
 * This is the whole of the "retriever" in this file: a real function of the two
 * strings, not a hand-tuned number. The hand-authored numbers are the
 * similarities in `retrieval.ts` and the facts below, exactly as in the rest of
 * the engine.
 */
export function overlapScore(query: string, text: string): number {
  const queryWords = contentWords(query)
  if (queryWords.length === 0) return 0
  return sharedStems(query, text).length / queryWords.length
}

/** Words that mark a passage as *stating* something usable rather than raising a topic. */
const ASSERTIVE_MARKERS = [
  'decided', 'refuses', 'must', 'may return', 'not covered', 'is treated',
  'cannot', 'refuse', 'required', 'holds the launch',
]

/** Whether the passage states a fact, as opposed to discussing the subject. */
export function isAssertive(text: string): boolean {
  const lower = text.toLowerCase()
  if (/\d/.test(lower)) return true
  return ASSERTIVE_MARKERS.some((marker) => lower.includes(marker))
}

/* ------------------------------------------------------------------ */
/* Cost model                                                          */
/* ------------------------------------------------------------------ */

/**
 * The bookkeeping of a retrieval turn.
 *
 * These are arithmetic constants, not measurements: a token count estimated from
 * words, and a latency charged per retrieval, per passage graded and per
 * generation turn. They are enough to compare shapes on *relative* cost, and they
 * are not an estimate of any running system.
 */
export const COST_MODEL = {
  /** The query and its framing, charged once per retrieval. */
  retrievalOverheadTokens: 14,
  /** A retrieval round trip. */
  retrievalLatencyMs: 40,
  /** The critic prompt for one passage. */
  criticTokensPerPassage: 6,
  /** The critic's own round trip, per passage graded. */
  criticLatencyMsPerPassage: 5,
  /** One generation turn. */
  generationLatencyMs: 120,
} as const

/** A deterministic token estimate: words, scaled. */
export function estimateTokens(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words * 1.35))
}

/* ------------------------------------------------------------------ */
/* Configuration                                                       */
/* ------------------------------------------------------------------ */

export interface AgenticRetrievalConfig {
  /** Passages taken per retrieval. */
  k: number
  /** The critic's threshold: a passage is supported at or above this score. */
  criticThreshold: number
  /** The gate opens when the question shares at least this many content words with the corpus. */
  minCorpusOverlap: number
  /** How many times the agent may rewrite its query and go round again. */
  maxRewrites: number
  /** Facts the single-shot pipeline puts in one window. */
  factWindow: number
  /** A hop is trusted only when its best fact beats the runner-up by this margin. */
  minHopMargin: number
}

export const DEFAULT_AGENTIC_CONFIG: AgenticRetrievalConfig = {
  k: 2,
  criticThreshold: 0.45,
  minCorpusOverlap: 2,
  maxRewrites: 1,
  factWindow: 3,
  minHopMargin: 0.05,
}

/* ================================================================== */
/* (a) Adaptive retrieval with critique                                */
/* ================================================================== */

export interface CritiqueCase {
  id: string
  title: string
  question: string
  /** Which of the §12.2 corpora the retriever searches. */
  corpusId: string
  /** Whether the corpus can answer this at all. */
  needsRetrieval: boolean
  /** The passage that decides the answer, when there is one. */
  decisivePassageId?: string
  /** The rewritten query the agent issues on the second pass. */
  rewrite: string
  /** The answer when the decisive passage reached the window and was believed. */
  answer: string
  /** The answer from the model's own knowledge, for a question that needs no lookup. */
  internalAnswer: string
  /** The answer the model gives when it has nothing to stand on. */
  wrongAnswer: string
  /** What the case measures. */
  note: string
  /** Set on the cases built to fail: the id of the documented failure. */
  nullCaseId?: string
  /** The sentence the screen prints when that failure fires. */
  nullLesson?: string
}

export const CRITIC_WEIGHTS = {
  /** The cross-encoder's reading of passage-against-question. */
  rerank: 0.5,
  /** How much of the question the passage actually contains. */
  coverage: 0.3,
  /** Whether the passage states a fact rather than raising a topic. */
  assertive: 0.2,
} as const

export interface CriticFeatures {
  rerank: number
  coverage: number
  assertive: 0 | 1
}

/**
 * The critic's view of one passage, as hand-authored features of its text.
 *
 * Note what is *not* here: the critic never sees the ground-truth `relevant`
 * flag. It sees the cross-encoder score, the lexical coverage of the question,
 * and whether the passage reads as an assertion. That is the whole of its
 * knowledge, which is why it can be wrong, and why its errors are the interesting
 * measurements in this section.
 */
export function criticFeatures(query: string, passage: Passage): CriticFeatures {
  return {
    rerank: passage.rerank,
    coverage: overlapScore(query, passage.text),
    assertive: isAssertive(passage.text) ? 1 : 0,
  }
}

/** The scalar a passage is graded against `criticThreshold`. */
export function criticScore(features: CriticFeatures): number {
  return (
    CRITIC_WEIGHTS.rerank * features.rerank +
    CRITIC_WEIGHTS.coverage * features.coverage +
    CRITIC_WEIGHTS.assertive * features.assertive
  )
}

export function isSupported(query: string, passage: Passage, config: AgenticRetrievalConfig): boolean {
  return criticScore(criticFeatures(query, passage)) >= config.criticThreshold
}

export type RetrievalPolicy = 'always-retrieve' | 'gated-critic'

export type CriticAction =
  | 'answer-internally'
  | 'answer'
  | 'answer-after-rewrite'
  | 'abstain'

export interface GradedPassage {
  passage: Passage
  score: number
  supported: boolean
  /** Whether this is the passage that decides the answer. */
  decisive: boolean
  /** Its position in the window, and how much of the window's attention it got. */
  position: number
  salience: number
}

export interface CritiqueRun {
  caseId: string
  title: string
  question: string
  policy: RetrievalPolicy
  /** Whether the gate let a retrieval through. */
  gateOpened: boolean | null
  corpusOverlap: number
  retrievals: number
  rewrites: number
  graded: GradedPassage[]
  /** The window the answer was read from. */
  windowOf: string[]
  /** The passage the agent answered from, chosen by the critic and nothing else. */
  believedPassageId: string | null
  believedScore: number | null
  /** Non-relevant passages the critic turned away. */
  decoysRejected: number
  /** Non-relevant passages the critic waved through, and answered from. */
  decoysAccepted: number
  /** The decisive passage's verdict, or null when it was never graded. */
  decisiveVerdict: 'supported' | 'rejected' | null
  decisiveReachedWindow: boolean
  decisiveUsed: boolean
  action: CriticAction
  answer: string
  correct: boolean
  abstained: boolean
  tokens: number
  latencyMs: number
  trace: string[]
  /** True when this run is one of the documented failures of the mechanism. */
  nullCase: boolean
  lesson: string
}

/**
 * The corpus as a `RetrievalCase`, with this question in it.
 *
 * `retrieve` is reused for what it actually does well here — choosing the top-k
 * and placing the passages in the window — while the decisive passage, the
 * answers and the note belong to the critique case. `retrieve`'s own `recalled`
 * and `used` flags describe the *corpus's* question, so they are recomputed below
 * against `decisivePassageId` instead of being trusted.
 */
function corpusAsCase(entry: CritiqueCase, question: string): RetrievalCase {
  const base = RETRIEVAL_CASES.find((item) => item.id === entry.corpusId) ?? RETRIEVAL_CASES[0]
  return {
    ...base,
    id: `${entry.id}:${base.id}`,
    title: `${entry.title} (against the "${base.title}" corpus)`,
    question,
    answer: entry.answer,
    distractedAnswer: entry.wrongAnswer,
    note: entry.note,
  }
}

function passageTokens(passages: Passage[]): number {
  return passages.reduce((sum, passage) => sum + estimateTokens(passage.text), 0)
}

function grade(entry: CritiqueCase, question: string, passages: Passage[], config: AgenticRetrievalConfig): GradedPassage[] {
  return passages.map((passage, position) => ({
    passage,
    score: criticScore(criticFeatures(question, passage)),
    supported: criticScore(criticFeatures(question, passage)) >= config.criticThreshold,
    decisive: passage.id === entry.decisivePassageId,
    position,
    salience: salienceAt(position, passages.length),
  }))
}

/** How many content words the question shares with the whole corpus. */
export function corpusOverlap(question: string, entry: CritiqueCase): number {
  const base = RETRIEVAL_CASES.find((item) => item.id === entry.corpusId) ?? RETRIEVAL_CASES[0]
  const inCorpus = new Set(base.passages.flatMap((passage) => contentWords(passage.text)))
  return contentWords(question).filter((word) => inCorpus.has(word)).length
}

/**
 * The plain pipeline the chapter teaches first: retrieve the top-k and answer.
 * It never abstains, so it never says "I do not have that".
 */
function runAlwaysRetrieve(entry: CritiqueCase, config: AgenticRetrievalConfig): CritiqueRun {
  const outcome = retrieve(corpusAsCase(entry, entry.question), config.k, 'bi-encoder')
  const selected = outcome.selected.map((item) => item.passage)
  const graded = grade(entry, entry.question, selected, config)
  const decisive = graded.find((item) => item.decisive)
  const used = decisive !== undefined && decisive.salience >= 0.5
  const correct = entry.needsRetrieval ? used : false

  return {
    caseId: entry.id,
    title: entry.title,
    question: entry.question,
    policy: 'always-retrieve',
    gateOpened: null,
    corpusOverlap: corpusOverlap(entry.question, entry),
    retrievals: 1,
    rewrites: 0,
    graded,
    windowOf: selected.map((passage) => passage.id),
    // It answers from the whole window, and the closest passage leads it.
    believedPassageId: selected[0]?.id ?? null,
    believedScore: graded[0]?.score ?? null,
    // The plain pipeline has no critic, so it rejects nothing: every decoy that
    // the retriever put in the window is a decoy it waved through.
    decoysRejected: 0,
    decoysAccepted: graded.filter((item) => !item.decisive).length,
    decisiveVerdict: null,
    decisiveReachedWindow: decisive !== undefined,
    decisiveUsed: used,
    action: 'answer',
    answer: correct ? entry.answer : entry.wrongAnswer,
    correct,
    abstained: false,
    tokens:
      estimateTokens(entry.question) +
      COST_MODEL.retrievalOverheadTokens +
      passageTokens(outcome.selected.map((item) => item.passage)) +
      estimateTokens(correct ? entry.answer : entry.wrongAnswer),
    latencyMs: COST_MODEL.retrievalLatencyMs + COST_MODEL.generationLatencyMs,
    trace: [`retrieved ${outcome.selected.length} passages, answered from the window`],
    nullCase: false,
    lesson: '',
  }
}

/**
 * The gated pipeline: judge, retrieve, critique, then answer, rewrite or abstain.
 *
 * The rewrite is modelled the way a rewrite actually works — as a second query
 * whose own wording is scored against the same pool — rather than as a magic
 * reordering. The second pass ranks the pool by the critic's score under the
 * rewritten query and takes the top-k of that, so the rewrite only helps when the
 * rewritten wording genuinely lands on the decisive passage's text.
 */
function runGatedCritic(entry: CritiqueCase, config: AgenticRetrievalConfig): CritiqueRun {
  const overlap = corpusOverlap(entry.question, entry)
  const gateOpened = overlap >= config.minCorpusOverlap
  const trace: string[] = []
  const graded: GradedPassage[] = []
  let retrievals = 0
  let rewrites = 0
  let tokens = estimateTokens(entry.question)
  let latencyMs = 0

  if (!gateOpened) {
    trace.push(
      `gate closed: the question shares ${overlap} content word${overlap === 1 ? '' : 's'} with the corpus, below ${config.minCorpusOverlap}`,
    )
    const answer = entry.needsRetrieval ? entry.wrongAnswer : entry.internalAnswer
    return {
      caseId: entry.id,
      title: entry.title,
      question: entry.question,
      policy: 'gated-critic',
      gateOpened: false,
      corpusOverlap: overlap,
      retrievals: 0,
      rewrites: 0,
      graded,
      windowOf: [],
      believedPassageId: null,
      believedScore: null,
      decoysRejected: 0,
      decoysAccepted: 0,
      decisiveVerdict: null,
      decisiveReachedWindow: false,
      decisiveUsed: false,
      action: 'answer-internally',
      answer,
      correct: !entry.needsRetrieval,
      abstained: false,
      tokens: tokens + estimateTokens(answer),
      latencyMs: COST_MODEL.generationLatencyMs,
      trace,
      nullCase: entry.needsRetrieval,
      lesson: entry.needsRetrieval
        ? 'The gate is a lexical heuristic and it closed on a question the corpus answers. A retrieval avoided is only free when it was not needed.'
        : '',
    }
  }

  trace.push(`gate opened: ${overlap} shared content words, at least ${config.minCorpusOverlap}`)
  const base = RETRIEVAL_CASES.find((item) => item.id === entry.corpusId) ?? RETRIEVAL_CASES[0]

  /**
   * One retrieval and one grading pass.
   *
   * The first pass selects the way the §12.2 pipeline does, by similarity. A
   * later pass is a *rewritten query*, so it selects by the rewritten wording:
   * the pool is re-scored against the new query string and the top-k of that is
   * what comes back. Nothing here reads the ground-truth relevance flag.
   */
  const runPass = (query: string, rewritten: boolean): GradedPassage[] => {
    retrievals += 1
    const selected = rewritten
      ? [...base.passages]
          .sort(
            (a, b) =>
              criticScore(criticFeatures(query, b)) - criticScore(criticFeatures(query, a)) ||
              a.id.localeCompare(b.id),
          )
          .slice(0, config.k)
      : retrieve(corpusAsCase(entry, query), config.k, 'bi-encoder').selected.map((item) => item.passage)
    const window = grade(entry, query, selected, config)
    graded.push(...window)
    tokens +=
      COST_MODEL.retrievalOverheadTokens +
      estimateTokens(query) +
      passageTokens(selected) +
      window.length * COST_MODEL.criticTokensPerPassage
    latencyMs += COST_MODEL.retrievalLatencyMs + window.length * COST_MODEL.criticLatencyMsPerPassage
    return window
  }

  /** The best passage the critic believed, by its own score. Tie-broken by position. */
  const believed = (window: GradedPassage[]): GradedPassage | undefined =>
    [...window]
      .filter((item) => item.supported)
      .sort((a, b) => b.score - a.score || a.position - b.position)[0]

  const firstWindow = runPass(entry.question, false)
  const firstBest = believed(firstWindow)
  trace.push(
    firstBest
      ? `the critic believed "${firstBest.passage.id}" at ${firstBest.score.toFixed(2)}, and rejected ${firstWindow.length - firstWindow.filter((item) => item.supported).length} passage(s)`
      : `the critic rejected all ${firstWindow.length} passage(s), the best at ${Math.max(0, ...firstWindow.map((item) => item.score)).toFixed(2)} against ${config.criticThreshold}`,
  )

  let window = firstWindow
  let best = firstBest
  if (!best && config.maxRewrites > 0) {
    rewrites += 1
    trace.push(`rewritten query: "${entry.rewrite}"`)
    const secondWindow = runPass(entry.rewrite, true)
    window = secondWindow
    best = believed(secondWindow)
    trace.push(
      best
        ? `the rewrite put "${best.passage.id}" at the front, believed at ${best.score.toFixed(2)}`
        : `the rewrite produced nothing the critic believed, the best at ${Math.max(0, ...secondWindow.map((item) => item.score)).toFixed(2)}`,
    )
  }

  let action: CriticAction
  let answer = entry.wrongAnswer
  let correct = false
  let abstained = false

  if (!best) {
    action = 'abstain'
    abstained = true
  } else {
    action = rewrites > 0 ? 'answer-after-rewrite' : 'answer'
    // The agent answers from the passage it believed. Whether that passage is the
    // one that decides the answer is decided here by the experiment, not by the
    // agent — and a believed passage in the middle of a wide window is read the
    // way §12.2 says a middle is read.
    correct = entry.needsRetrieval && best.decisive && best.salience >= 0.5
    answer = correct ? entry.answer : entry.wrongAnswer
    if (!correct && best.salience < 0.5) {
      trace.push(`"${best.passage.id}" was believed and buried in the middle of a ${config.k}-passage window`)
    }
  }

  tokens += estimateTokens(answer)
  latencyMs += COST_MODEL.generationLatencyMs

  const gradedDecoys = graded.filter((item) => !item.decisive)
  const decoysRejected = gradedDecoys.filter((item) => !item.supported).length
  const decoysAccepted = gradedDecoys.filter((item) => item.supported).length
  const decisiveGraded = graded.find((item) => item.decisive)
  const failed = !correct || abstained

  return {
    caseId: entry.id,
    title: entry.title,
    question: entry.question,
    policy: 'gated-critic',
    gateOpened: true,
    corpusOverlap: overlap,
    retrievals,
    rewrites,
    graded,
    windowOf: window.map((item) => item.passage.id),
    believedPassageId: best?.passage.id ?? null,
    believedScore: best?.score ?? null,
    decoysRejected,
    decoysAccepted,
    decisiveVerdict: decisiveGraded ? (decisiveGraded.supported ? 'supported' : 'rejected') : null,
    decisiveReachedWindow: graded.some((item) => item.decisive),
    decisiveUsed: Boolean(best && best.decisive && best.salience >= 0.5),
    action,
    answer,
    correct,
    abstained,
    tokens,
    latencyMs,
    trace,
    nullCase: entry.nullCaseId !== undefined && failed,
    lesson: failed ? entry.nullLesson ?? '' : '',
  }
}

/** The aggregate a policy earns over the critique case set. */
export interface CritiqueSummary {
  policy: RetrievalPolicy
  label: string
  cases: number
  retrievalsIssued: number
  /** Questions the gate closed on that the corpus could not have answered. */
  retrievalsAvoided: number
  /** Questions the gate closed on that it should not have. */
  wronglySkipped: number
  rewrites: number
  decoysRejected: number
  decoysAccepted: number
  correct: number
  correctRate: number
  abstentions: number
  wrongAnswers: number
  tokens: number
  latencyMs: number
  /** Tokens spent on each answer that was right. */
  tokensPerCorrect: number
  runs: CritiqueRun[]
}

function summarise(policy: RetrievalPolicy, label: string, runs: CritiqueRun[]): CritiqueSummary {
  const skipped = runs.filter((run) => run.gateOpened === false)
  const wronglySkipped = skipped.filter((run) => !run.correct).length
  return {
    policy,
    label,
    cases: runs.length,
    retrievalsIssued: runs.reduce((sum, run) => sum + run.retrievals, 0),
    retrievalsAvoided: skipped.length - wronglySkipped,
    wronglySkipped,
    rewrites: runs.reduce((sum, run) => sum + run.rewrites, 0),
    decoysRejected: runs.reduce((sum, run) => sum + run.decoysRejected, 0),
    decoysAccepted: runs.reduce((sum, run) => sum + run.decoysAccepted, 0),
    correct: runs.filter((run) => run.correct).length,
    correctRate: runs.length === 0 ? 0 : runs.filter((run) => run.correct).length / runs.length,
    abstentions: runs.filter((run) => run.abstained).length,
    wrongAnswers: runs.filter((run) => !run.correct && !run.abstained).length,
    tokens: runs.reduce((sum, run) => sum + run.tokens, 0),
    latencyMs: runs.reduce((sum, run) => sum + run.latencyMs, 0),
    tokensPerCorrect: Math.round(
      runs.reduce((sum, run) => sum + run.tokens, 0) /
        Math.max(1, runs.filter((run) => run.correct).length),
    ),
    runs,
  }
}

/** Run the whole critique case set under both policies. */
export function runAdaptiveRetrieval(
  config: AgenticRetrievalConfig = DEFAULT_AGENTIC_CONFIG,
  cases: CritiqueCase[] = CRITIQUE_CASES,
): { baseline: CritiqueSummary; gated: CritiqueSummary; runs: CritiqueRun[] } {
  const baselineRuns = cases.map((entry) => runAlwaysRetrieve(entry, config))
  const gatedRuns = cases.map((entry) => runGatedCritic(entry, config))
  return {
    baseline: summarise('always-retrieve', 'Always retrieve top-k', baselineRuns),
    gated: summarise('gated-critic', 'Gated retrieval with critique', gatedRuns),
    runs: [...baselineRuns, ...gatedRuns],
  }
}

/* ================================================================== */
/* (b) Question decomposition                                          */
/* ================================================================== */

export interface Fact {
  id: string
  /** The entity the fact is about. */
  subject: string
  /** What kind of question the fact answers. */
  relation: string
  /** The value a correct hop returns. */
  object: string
  text: string
  /** A superseded record, kept in the store because that is what stores do. */
  stale?: boolean
}

export const FACT_RELATIONS: Record<string, string> = {
  'covers-part': 'covers which part',
  'supplied-by': 'is supplied by which company',
  'ships-from': 'ships from which depot',
  'delay-days': 'reported how many days of delay',
  'managed-by': 'is managed by whom',
}

export const FACT_STORE: Fact[] = [
  {
    id: 'f-invoice-4171',
    subject: 'invoice 4171',
    relation: 'covers-part',
    object: 'the 12V sensor module',
    text: 'Invoice 4171 covers the 12V sensor module, ordered in March.',
  },
  {
    id: 'f-invoice-4288',
    subject: 'invoice 4288',
    relation: 'covers-part',
    object: 'the CAN bus adapter',
    text: 'Invoice 4288 covers the CAN bus adapter, ordered in March.',
  },
  {
    id: 'f-sensor-supplier',
    subject: 'the 12V sensor module',
    relation: 'supplied-by',
    object: 'Nordwind Components',
    text: 'The 12V sensor module is supplied by Nordwind Components.',
  },
  {
    id: 'f-sensor-supplier-stale',
    subject: 'the 12V sensor module',
    relation: 'supplied-by',
    object: 'Halvorsen Components',
    text: 'The 12V sensor module was supplied by Halvorsen Components until the 2025 resourcing review.',
    stale: true,
  },
  {
    id: 'f-adapter-supplier',
    subject: 'the CAN bus adapter',
    relation: 'supplied-by',
    object: 'Halvorsen Components',
    text: 'The CAN bus adapter is supplied by Halvorsen Components.',
  },
  {
    id: 'f-nordwind-depot',
    subject: 'Nordwind Components',
    relation: 'ships-from',
    object: 'the Rotterdam depot',
    text: 'Nordwind Components ships from the Rotterdam depot.',
  },
  {
    id: 'f-halvorsen-depot',
    subject: 'Halvorsen Components',
    relation: 'ships-from',
    object: 'the Antwerp depot',
    text: 'Halvorsen Components ships from the Antwerp depot.',
  },
  {
    id: 'f-rotterdam-delay-april',
    subject: 'the Rotterdam depot',
    relation: 'delay-days',
    object: 'nine days',
    text: 'The Rotterdam depot reported a nine day delay in April.',
  },
  {
    id: 'f-rotterdam-delay-march',
    subject: 'the Rotterdam depot',
    relation: 'delay-days',
    object: 'four days',
    text: 'The Rotterdam depot reported a four day delay in March.',
  },
  {
    id: 'f-antwerp-delay-april',
    subject: 'the Antwerp depot',
    relation: 'delay-days',
    object: 'two days',
    text: 'The Antwerp depot reported a two day delay in April.',
  },
  {
    id: 'f-rotterdam-manager',
    subject: 'the Rotterdam depot',
    relation: 'managed-by',
    object: 'Ines Berger',
    text: 'The Rotterdam depot is managed by Ines Berger.',
  },
  {
    id: 'f-antwerp-manager',
    subject: 'the Antwerp depot',
    relation: 'managed-by',
    object: 'Jonas Meyer',
    text: 'The Antwerp depot is managed by Jonas Meyer.',
  },
]

export const FACT_BY_ID = new Map(FACT_STORE.map((fact) => [fact.id, fact]))

/** Where a hop gets the entity it asks about. */
export interface HopSubject {
  kind: 'given' | 'hop'
  /** The entity, when it is stated in the question. */
  value?: string
  /** The hop whose answer supplies the entity. */
  from?: number
}

export interface Hop {
  subject: HopSubject
  relation: string
  /** The fact that answers this hop. */
  targetFactId: string
}

export interface MultiHopQuestion {
  id: string
  title: string
  question: string
  hops: Hop[]
  /** The fact the final answer comes from. */
  finalFactId: string
  answer: string
  /**
   * What a flat retrieval answers with when the chain did not close.
   *
   * The §12.2 pipeline does not refuse: it generates from whatever reached the
   * window, which is how a system that retrieved the bridge fact can answer a
   * "which company" question with a part name. Recording that is what makes the
   * hallucination column in section (c) mean something.
   */
  distractedAnswer: string
  note: string
}

export const MULTIHOP_QUESTIONS: MultiHopQuestion[] = [
  {
    id: 'mh-one-hop',
    title: 'One hop, stated plainly',
    question: 'Which depot does Nordwind Components ship from?',
    hops: [
      { subject: { kind: 'given', value: 'Nordwind Components' }, relation: 'ships-from', targetFactId: 'f-nordwind-depot' },
    ],
    finalFactId: 'f-nordwind-depot',
    answer: 'the Rotterdam depot',
    distractedAnswer: 'the Antwerp depot',
    note: 'The control. One hop, so decomposition has nothing to add and costs what the single-shot pipeline costs.',
  },
  {
    id: 'mh-invoice-supplier',
    title: 'Two hops: the invoice, then its supplier',
    question: 'Which company supplies the part on invoice 4171?',
    hops: [
      { subject: { kind: 'given', value: 'invoice 4171' }, relation: 'covers-part', targetFactId: 'f-invoice-4171' },
      { subject: { kind: 'hop', from: 0 }, relation: 'supplied-by', targetFactId: 'f-sensor-supplier' },
    ],
    finalFactId: 'f-sensor-supplier',
    answer: 'Nordwind Components',
    distractedAnswer: 'the 12V sensor module',
    note: 'A flat query mentions the invoice and the relation, never the part between them, so the bridge fact is invisible to it.',
  },
  {
    id: 'mh-depot-manager',
    title: 'Four hops: the invoice, its supplier, its depot, its manager',
    question: 'Who manages the depot that ships the supplier of the part on invoice 4288?',
    hops: [
      { subject: { kind: 'given', value: 'invoice 4288' }, relation: 'covers-part', targetFactId: 'f-invoice-4288' },
      { subject: { kind: 'hop', from: 0 }, relation: 'supplied-by', targetFactId: 'f-adapter-supplier' },
      { subject: { kind: 'hop', from: 1 }, relation: 'ships-from', targetFactId: 'f-halvorsen-depot' },
      { subject: { kind: 'hop', from: 2 }, relation: 'managed-by', targetFactId: 'f-antwerp-manager' },
    ],
    finalFactId: 'f-antwerp-manager',
    answer: 'Jonas Meyer',
    distractedAnswer: 'the CAN bus adapter',
    note: 'Four retrievals, each one worded from the answer before it. A single query cannot express any of the last three.',
  },
  {
    id: 'mh-sensor-delay',
    title: 'Three hops over a store with a stale record',
    question: 'How many days of delay did the depot of the supplier of the 12V sensor module report in April?',
    hops: [
      { subject: { kind: 'given', value: 'the 12V sensor module' }, relation: 'supplied-by', targetFactId: 'f-sensor-supplier' },
      { subject: { kind: 'hop', from: 0 }, relation: 'ships-from', targetFactId: 'f-nordwind-depot' },
      { subject: { kind: 'hop', from: 1 }, relation: 'delay-days', targetFactId: 'f-rotterdam-delay-april' },
    ],
    finalFactId: 'f-rotterdam-delay-april',
    answer: 'nine days',
    distractedAnswer: 'four days',
    note: 'The first hop runs against two near-identical supplier facts, one of them superseded. This is where decomposition pays for trusting its own intermediate answer.',
  },
]

export interface HopRun {
  index: number
  /** The query the agent actually issued, in real words. */
  query: string
  /** The entity the query was built from, and where it came from. */
  subjectUsed: string
  /** The entity the question called for. */
  subjectWanted: string
  chosen: Fact | null
  runnerUp: Fact | null
  topScore: number
  margin: number
  trusted: boolean
  correct: boolean
  retrievals: number
  tokens: number
  latencyMs: number
}

export type DecompositionPolicy = 'single-shot' | 'decomposed'

export interface DecompositionRun {
  questionId: string
  title: string
  question: string
  policy: DecompositionPolicy
  hops: HopRun[]
  /** The hops the question needs, whatever the policy did about them. */
  hopsRequired: number
  /** Hops this policy answered with the right fact. */
  hopsCovered: number
  /** Correct hops over required hops. */
  hopCoverage: number
  /** Needed facts that reached a window. */
  recall: number
  /** Needed facts that reached a window *and* sat where the model attends. */
  factsUsed: number
  answer: string
  correct: boolean
  /** The hop where a wrong intermediate answer was fed forward, if any. */
  propagated: HopRun | null
  retrievals: number
  tokens: number
  latencyMs: number
  trace: string[]
}

/** What a pipeline says when the window did not give it an answer. */
const NO_ANSWER = 'The store does not say.'

/** A fact's score against a query: the share of the query's content words it contains. */
function factScore(query: string, fact: Fact): number {
  return overlapScore(query, fact.text)
}

/**
 * Rank the fact store against a query.
 *
 * The margin is measured against the *whole* ranking, before the window is cut,
 * because that is what an ambiguity is: the runner-up does not have to be in the
 * window for the hop to be a coin toss between two near-identical records.
 */
function rankFacts(
  query: string,
  limit: number,
): { chosen: Fact | null; runnerUp: Fact | null; topScore: number; margin: number; window: Fact[] } {
  const scored = FACT_STORE.map((fact) => ({ fact, score: factScore(query, fact) })).sort(
    (a, b) => b.score - a.score || a.fact.id.localeCompare(b.fact.id),
  )
  const nonZero = scored.filter((entry) => entry.score > 0)
  const first = nonZero[0]
  const second = nonZero[1]
  return {
    chosen: first ? first.fact : null,
    runnerUp: second ? second.fact : null,
    topScore: first ? first.score : 0,
    // A hop with no competitor at all is not ambiguous; a hop whose only
    // competitor is one shared word away is.
    margin: first && second ? first.score - second.score : first ? 1 : 0,
    window: nonZero.slice(0, Math.max(1, limit)).map((entry) => entry.fact),
  }
}

/** The query a decomposition step writes for one hop, in words. */
export function hopQuery(hop: Hop, subject: string): string {
  const label = FACT_RELATIONS[hop.relation] ?? hop.relation
  return `${subject} ${label}`
}

function neededFacts(entry: MultiHopQuestion): Fact[] {
  return entry.hops.map((hop) => FACT_BY_ID.get(hop.targetFactId) as Fact)
}

/**
 * One retrieval for the whole question, then read the answer off the window.
 *
 * The window is placed exactly like the §12.2 pipeline's: the facts arrive in
 * score order and the model attends to the ends of it best, so a fact that lands
 * in the middle was retrieved and not used.
 */
function runSingleShot(entry: MultiHopQuestion, config: AgenticRetrievalConfig): DecompositionRun {
  const ranked = rankFacts(entry.question, config.factWindow)
  const needed = neededFacts(entry)
  const placed = ranked.window.map((fact, position) => ({ fact, position, salience: salienceAt(position, ranked.window.length) }))
  const reached = needed.filter((fact) => placed.some((item) => item.fact.id === fact.id))
  const used = reached.filter((fact) => {
    const item = placed.find((entry2) => entry2.fact.id === fact.id)
    return item !== undefined && item.salience >= 0.5
  })
  const finalPlaced = placed.find((item) => item.fact.id === entry.finalFactId && item.salience >= 0.5)
  const correct = used.length === needed.length && finalPlaced !== undefined
  // The flat pipeline does not know the chain failed, so it answers anyway.
  const answer = correct ? entry.answer : entry.distractedAnswer
  const trace = placed.map((item) =>
    `position ${item.position + 1}: ${item.fact.id} (attended ${Math.round(item.salience * 100)}%)${needed.some((n) => n.id === item.fact.id) ? ' [needed]' : ''}`,
  )
  return {
    questionId: entry.id,
    title: entry.title,
    question: entry.question,
    policy: 'single-shot',
    hops: [],
    // One flat query can only stand in for a hop when the fact that answers that
    // hop reached the window and sat where the model reads best. That is the
    // single-shot policy's own hop coverage, and the middle of the window is what
    // usually costs it.
    hopsRequired: needed.length,
    hopsCovered: used.length,
    hopCoverage: needed.length === 0 ? 1 : used.length / needed.length,
    recall: needed.length === 0 ? 1 : reached.length / needed.length,
    factsUsed: used.length,
    answer,
    correct,
    propagated: null,
    retrievals: 1,
    tokens:
      estimateTokens(entry.question) +
      COST_MODEL.retrievalOverheadTokens +
      ranked.window.reduce((sum, fact) => sum + estimateTokens(fact.text), 0) +
      estimateTokens(answer),
    latencyMs: COST_MODEL.retrievalLatencyMs + COST_MODEL.generationLatencyMs,
    trace: [
      `one retrieval for the whole question: ${ranked.window.length} facts in the window`,
      ...trace,
      `${reached.length} of ${needed.length} needed facts reached the window, ${used.length} of them where the model attends`,
    ],
  }
}

/**
 * One retrieval per hop, each query written from the previous hop's answer.
 *
 * Two things can go wrong and both are measured. A hop's window is one fact, so
 * nothing lands in the middle — that is the gain decomposition buys. And an
 * ambiguous hop, where the store holds two near-identical records, hands the next
 * query the wrong entity: that is the cost.
 */
function runDecomposed(entry: MultiHopQuestion, config: AgenticRetrievalConfig): DecompositionRun {
  const hops: HopRun[] = []
  const trace: string[] = []
  const answers: string[] = []
  let retrievals = 0
  let tokens = estimateTokens(entry.question)
  let latencyMs = 0
  let propagated: HopRun | null = null
  let finalAnswer = NO_ANSWER
  let correct = false

  entry.hops.forEach((hop, index) => {
    const prior = hop.subject.kind === 'hop' ? entry.hops[hop.subject.from as number] : undefined
    const wanted =
      hop.subject.kind === 'given'
        ? (hop.subject.value as string)
        : (prior ? (FACT_BY_ID.get(prior.targetFactId)?.object ?? '') : '')
    const used = hop.subject.kind === 'given' ? (hop.subject.value as string) : (answers[hop.subject.from as number] ?? '')
    const query = hopQuery(hop, used)
    const ranked = rankFacts(query, 1)
    const target = FACT_BY_ID.get(hop.targetFactId) as Fact
    const trusted = ranked.margin >= config.minHopMargin
    const chosen = trusted ? ranked.chosen : ranked.runnerUp ?? ranked.chosen
    const hopCorrect = chosen !== null && chosen.id === target.id
    retrievals += 1
    tokens +=
      COST_MODEL.retrievalOverheadTokens +
      estimateTokens(query) +
      estimateTokens(ranked.window[0]?.text ?? '')
    latencyMs += COST_MODEL.retrievalLatencyMs + COST_MODEL.generationLatencyMs

    answers.push(hopCorrect ? target.object : (chosen?.object ?? ''))
    const run: HopRun = {
      index,
      query,
      subjectUsed: used,
      subjectWanted: wanted,
      chosen,
      runnerUp: ranked.runnerUp,
      topScore: ranked.topScore,
      margin: ranked.margin,
      trusted,
      correct: hopCorrect,
      retrievals: 1,
      tokens,
      latencyMs,
    }
    hops.push(run)
    if (!hopCorrect && hop.subject.kind === 'hop') propagated = propagated ?? run
    trace.push(
      `hop ${index + 1}: "${query}" -> ${chosen ? chosen.id : 'nothing'} (margin ${ranked.margin.toFixed(3)}${trusted ? ', trusted' : ', below the threshold, the runner-up was taken'})${hopCorrect ? '' : ` — wanted ${target.id}`}`,
    )
    if (index === entry.hops.length - 1) {
      finalAnswer = hopCorrect ? target.object : (chosen?.object ?? 'The store does not say.')
      correct = hopCorrect && hops.every((item) => item.correct)
    }
  })

  const needed = neededFacts(entry)
  // A hop's window is a single fact, so nothing lands in the middle: for this
  // policy "used" can only mean "the hop picked the fact the question needed".
  const used = hops.filter((hop) => hop.correct).length
  return {
    questionId: entry.id,
    title: entry.title,
    question: entry.question,
    policy: 'decomposed',
    hops,
    hopsRequired: entry.hops.length,
    hopsCovered: hops.filter((hop) => hop.correct).length,
    hopCoverage: hops.length === 0 ? 0 : hops.filter((hop) => hop.correct).length / hops.length,
    recall: needed.length === 0 ? 1 : hops.filter((hop) => hop.chosen && needed.some((f) => f.id === hop.chosen?.id)).length / needed.length,
    factsUsed: used,
    answer: finalAnswer,
    correct,
    propagated,
    retrievals,
    tokens: tokens + estimateTokens(finalAnswer),
    latencyMs,
    trace,
  }
}

export interface DecompositionSummary {
  policy: DecompositionPolicy
  label: string
  questions: number
  hopsRequired: number
  /** Hops answered correctly, over the hops the question needs. */
  hopCoverage: number
  answersRecovered: number
  recoveryRate: number
  recall: number
  retrievals: number
  tokens: number
  latencyMs: number
  /** One run per question, in the order the questions are stored. */
  runs: DecompositionRun[]
}

function summariseDecomposition(policy: DecompositionPolicy, label: string, runs: DecompositionRun[]): DecompositionSummary {
  const hopsRequired = runs.reduce((sum, run) => sum + run.hopsRequired, 0)
  const hopsCovered = runs.reduce((sum, run) => sum + run.hopsCovered, 0)
  return {
    policy,
    label,
    questions: runs.length,
    hopsRequired,
    hopCoverage: hopsRequired === 0 ? 0 : hopsCovered / hopsRequired,
    answersRecovered: runs.filter((run) => run.correct).length,
    recoveryRate: runs.length === 0 ? 0 : runs.filter((run) => run.correct).length / runs.length,
    recall: runs.length === 0 ? 0 : runs.reduce((sum, run) => sum + run.recall, 0) / runs.length,
    retrievals: runs.reduce((sum, run) => sum + run.retrievals, 0),
    tokens: runs.reduce((sum, run) => sum + run.tokens, 0),
    latencyMs: runs.reduce((sum, run) => sum + run.latencyMs, 0),
    runs,
  }
}

export function runQuestionDecomposition(
  config: AgenticRetrievalConfig = DEFAULT_AGENTIC_CONFIG,
  questions: MultiHopQuestion[] = MULTIHOP_QUESTIONS,
): { singleShot: DecompositionSummary; decomposed: DecompositionSummary } {
  return {
    singleShot: summariseDecomposition('single-shot', 'One retrieval for the whole question', questions.map((q) => runSingleShot(q, config))),
    decomposed: summariseDecomposition('decomposed', 'One retrieval per sub-question', questions.map((q) => runDecomposed(q, config))),
  }
}

/* ================================================================== */
/* (c) The four pipeline shapes                                        */
/* ================================================================== */

export type PipelineShape = 'single-shot' | 'router' | 'adaptive-critic' | 'decompose-then-retrieve'

export const PIPELINE_SHAPES: { value: PipelineShape; label: string; description: string }[] = [
  {
    value: 'single-shot',
    label: 'Single-shot',
    description:
      'The pipeline the chapter teaches first: retrieve the top passages for the question as the user wrote it, generate, stop.',
  },
  {
    value: 'router',
    label: 'Router',
    description:
      'A classifier sends each question to a branch — no lookup, one corpus lookup, or a multi-hop chain — and the branch runs once.',
  },
  {
    value: 'adaptive-critic',
    label: 'Adaptive retrieval with critique',
    description:
      'Gate, retrieve, grade every passage, then answer, rewrite or abstain. One hop only: it has no way to chain.',
  },
  {
    value: 'decompose-then-retrieve',
    label: 'Decompose, then retrieve',
    description:
      'Write the sub-questions and retrieve for each, feeding every answer into the next query. No gate: it looks things up because it can.',
  },
]

export interface PipelineCase {
  id: string
  title: string
  kind: 'lookup' | 'no-retrieval' | 'multi-hop'
  /** The critique case, for a lookup or no-retrieval row. */
  critiqueId?: string
  /** The multi-hop question, for a chain row. */
  questionId?: string
  note: string
}

/** One row per question each shape is supposed to handle. */
export const PIPELINE_CASES: PipelineCase[] = [
  { id: 'pc-warranty', title: 'What is a warranty?', kind: 'no-retrieval', critiqueId: 'c-what-is-warranty', note: 'A definition the corpus does not own.' },
  { id: 'pc-rag', title: 'What does retrieval-augmented generation mean?', kind: 'no-retrieval', critiqueId: 'c-what-is-rag', note: 'General knowledge, no lookup available or needed.' },
  { id: 'pc-returns', title: 'The refund window', kind: 'lookup', critiqueId: 'c-return-window', note: 'The decisive passage is not the closest one.' },
  { id: 'pc-migration', title: 'Rolling a migration back', kind: 'lookup', critiqueId: 'c-rollback', note: 'The decisive passage is fourth by similarity.' },
  { id: 'pc-meeting', title: 'The order of the meeting', kind: 'lookup', critiqueId: 'c-meeting-order', note: 'The plain pipeline gets this right; the critic does not.' },
  { id: 'pc-reason', title: 'Why shops offer refunds', kind: 'no-retrieval', critiqueId: 'c-refund-reason', note: 'A reason question over a policy that states only windows.' },
  { id: 'pc-supplier', title: 'The supplier of the part on invoice 4171', kind: 'multi-hop', critiqueId: undefined, questionId: 'mh-invoice-supplier', note: 'Two hops, and a flat query mentions only the first.' },
  { id: 'pc-manager', title: 'The manager of the depot of the supplier', kind: 'multi-hop', critiqueId: undefined, questionId: 'mh-depot-manager', note: 'Four hops.' },
  { id: 'pc-delay', title: 'The April delay behind the sensor module', kind: 'multi-hop', critiqueId: undefined, questionId: 'mh-sensor-delay', note: 'Three hops, over a store holding a superseded record.' },
]

/**
 * The router's own decisions.
 *
 * A router is a classifier and classifiers are hand-wrong sometimes, so the
 * table encodes what this router believes rather than the truth: it sends one
 * question that needs no lookup to the corpus, because the question contains the
 * corpus's word.
 */
const ROUTER_ROUTES: Record<string, 'internal' | 'lookup' | 'chain'> = {
  'c-what-is-warranty': 'internal',
  'c-what-is-rag': 'internal',
  'c-refund-reason': 'internal',
  'c-return-window': 'lookup',
  'c-rollback': 'lookup',
  'c-meeting-order': 'lookup',
  'mh-invoice-supplier': 'chain',
  'mh-depot-manager': 'chain',
  'mh-sensor-delay': 'lookup',
}

export interface PipelineRun {
  caseId: string
  title: string
  kind: PipelineCase['kind']
  shape: PipelineShape
  retrievals: number
  /** Needed passages or facts that reached a window, as a share. Null when nothing was needed. */
  recall: number | null
  correct: boolean
  abstained: boolean
  /**
   * Answered, and should not have: the question had no answer in the store, or the
   * passage it answered from was not the one that decides it. This is the column
   * that separates a wrong answer from an honest "I do not know".
   */
  hallucinated: boolean
  tokens: number
  latencyMs: number
  outcome: string
}

export interface PipelineRow {
  shape: PipelineShape
  label: string
  description: string
  cases: number
  recall: number | null
  correct: number
  correctRate: number
  retrievals: number
  tokens: number
  latencyMs: number
  abstentions: number
  /** Answers given where the store had none. */
  hallucinations: number
  runs: PipelineRun[]
}

function critiqueCaseById(id: string | undefined): CritiqueCase | undefined {
  return CRITIQUE_CASES.find((entry) => entry.id === id)
}

function questionById(id: string | undefined): MultiHopQuestion | undefined {
  return MULTIHOP_QUESTIONS.find((entry) => entry.id === id)
}

/** A lookup run expressed in pipeline terms, from whichever engine actually ran it. */
function fromCritique(caseEntry: PipelineCase, run: CritiqueRun, shape: PipelineShape): PipelineRun {
  return {
    caseId: caseEntry.id,
    title: caseEntry.title,
    kind: caseEntry.kind,
    shape,
    retrievals: run.retrievals,
    // A question the corpus does not own has no recall to miss, so it is left out
    // of the recall denominator rather than scored zero.
    recall: run.decisiveReachedWindow ? 1 : caseEntry.kind === 'lookup' ? 0 : null,
    correct: run.correct,
    abstained: run.abstained,
    hallucinated: !run.abstained && !run.correct,
    tokens: run.tokens,
    latencyMs: run.latencyMs,
    outcome: run.abstained ? 'abstained' : run.correct ? 'answered correctly' : 'answered wrongly',
  }
}

function fromDecomposition(caseEntry: PipelineCase, run: DecompositionRun, shape: PipelineShape): PipelineRun {
  return {
    caseId: caseEntry.id,
    title: caseEntry.title,
    kind: caseEntry.kind,
    shape,
    retrievals: run.retrievals,
    recall: run.recall,
    correct: run.correct,
    // A decomposition that comes back with nothing says so; one that comes back
    // with the wrong entity does not. Only the first counts as an abstention.
    abstained: run.answer === NO_ANSWER,
    hallucinated: !run.correct && run.answer !== NO_ANSWER,
    tokens: run.tokens,
    latencyMs: run.latencyMs,
    outcome: run.correct
      ? 'answered correctly'
      : run.answer === NO_ANSWER
        ? 'answered "the store does not say"'
        : `answered "${run.answer}" from the window — the chain did not close`,
  }
}

/**
 * A fact graded as if it were a passage.
 *
 * The triples carry no cross-encoder reading — nothing in this file pretends a
 * hand-authored sentence was scored by a model that never ran — so the critic's
 * rerank term is zero on this pool and only coverage and assertiveness count.
 * That is a *harder* bar than a corpus passage has to clear, and it is why the
 * critic shape abstains on the chain rows instead of guessing.
 */
function factAsPassage(fact: Fact): Passage {
  return {
    id: fact.id,
    label: `${fact.subject} ${fact.relation}`,
    text: fact.text,
    similarity: 0,
    rerank: 0,
    relevant: false,
    topic: fact.subject,
  }
}

/**
 * The critic shape on a multi-hop question: one window, no chaining.
 *
 * Everything is computed — the window, the grades, the abstention, the cost. The
 * only thing this shape cannot do is write a second query from a first answer,
 * and the measurement of that is the whole row.
 */
function runCriticOnChain(caseEntry: PipelineCase, question: MultiHopQuestion, config: AgenticRetrievalConfig): PipelineRun {
  const window = rankFacts(question.question, config.k).window
  const graded = window.map((fact, position) => {
    const passage = factAsPassage(fact)
    const score = criticScore(criticFeatures(question.question, passage))
    return { fact, passage, score, position, supported: score >= config.criticThreshold, salience: salienceAt(position, window.length) }
  })
  const needed = neededFacts(question)
  const usedNeeded = needed.filter((fact) =>
    graded.some((item) => item.fact.id === fact.id && item.salience >= 0.5),
  )
  const believed = graded.some((item) => item.supported)
  const correct = believed && usedNeeded.length === needed.length
  const abstained = !believed
  return {
    caseId: caseEntry.id,
    title: caseEntry.title,
    kind: 'multi-hop',
    shape: 'adaptive-critic',
    retrievals: 1,
    recall: needed.length === 0 ? null : usedNeeded.length / needed.length,
    correct,
    abstained,
    hallucinated: !abstained && !correct,
    tokens:
      estimateTokens(question.question) +
      COST_MODEL.retrievalOverheadTokens +
      window.reduce((sum, fact) => sum + estimateTokens(fact.text), 0) +
      graded.length * COST_MODEL.criticTokensPerPassage +
      estimateTokens(correct ? question.answer : NO_ANSWER),
    latencyMs:
      COST_MODEL.retrievalLatencyMs +
      graded.length * COST_MODEL.criticLatencyMsPerPassage +
      COST_MODEL.generationLatencyMs,
    outcome: abstained
      ? `abstained: nothing in a ${config.k}-fact window cleared the critic, and this shape writes no second query`
      : correct
        ? 'answered correctly'
        : 'answered wrongly: one window was believed without the chain being checked',
  }
}

/** The single-shot pipeline on a lookup question: retrieve top-k, generate, stop. */
function runShape(shape: PipelineShape, entry: PipelineCase, config: AgenticRetrievalConfig): PipelineRun {
  const critique = critiqueCaseById(entry.critiqueId)
  const question = questionById(entry.questionId)

  if (shape === 'single-shot') {
    if (question) return fromDecomposition(entry, runSingleShot(question, config), shape)
    return fromCritique(entry, runAlwaysRetrieve(critique as CritiqueCase, config), shape)
  }

  if (shape === 'router') {
    const key = critique?.id ?? question?.id ?? entry.id
    const branch = ROUTER_ROUTES[key] ?? 'lookup'
    if (branch === 'internal') {
      const tokens = estimateTokens((critique?.question ?? entry.title) + (critique?.internalAnswer ?? ''))
      return {
        caseId: entry.id,
        title: entry.title,
        kind: entry.kind,
        shape,
        retrievals: 0,
        recall: null,
        correct: critique !== undefined && !critique.needsRetrieval,
        abstained: false,
        hallucinated: !(critique !== undefined && !critique.needsRetrieval),
        tokens,
        latencyMs: COST_MODEL.generationLatencyMs,
        outcome: critique && !critique.needsRetrieval ? 'answered internally, correctly' : 'answered internally, wrongly',
      }
    }
    if (branch === 'chain' && question) return fromDecomposition(entry, runSingleShot(question, config), shape)
    if (question) {
      // A chain sent down the lookup branch: one flat retrieval, one hop at best.
      const out = fromDecomposition(entry, runSingleShot(question, config), shape)
      return { ...out, outcome: `${out.outcome} (routed to the lookup branch, so the chain was never written)` }
    }
    return fromCritique(entry, runAlwaysRetrieve(critique as CritiqueCase, config), shape)
  }

  if (shape === 'adaptive-critic') {
    if (critique) return fromCritique(entry, runGatedCritic(critique, config), shape)
    return runCriticOnChain(entry, question as MultiHopQuestion, config)
  }

  // decompose-then-retrieve: always looks things up, because it has no gate.
  if (question) return fromDecomposition(entry, runDecomposed(question, config), shape)
  return oneHopDecomposition(entry, critique as CritiqueCase, config)
}

/**
 * A lookup question run through the decomposition machinery: one hop, one
 * retrieval, worded from the question as the user wrote it. There is no gate, so
 * a question the corpus does not own still gets a round trip.
 */
function oneHopDecomposition(caseEntry: PipelineCase, entry: CritiqueCase, config: AgenticRetrievalConfig): PipelineRun {
  const base = RETRIEVAL_CASES.find((item) => item.id === entry.corpusId) ?? RETRIEVAL_CASES[0]
  const pool = base.passages.map((passage) => ({ passage, score: overlapScore(entry.question, passage.text) }))
  const window = [...pool]
    .sort((a, b) => b.score - a.score || a.passage.id.localeCompare(b.passage.id))
    .slice(0, Math.max(1, config.k))
  const placed = window.map((item, position) => ({
    ...item,
    position,
    salience: salienceAt(position, window.length),
  }))
  const decisive = placed.find((item) => item.passage.id === entry.decisivePassageId)
  const used = decisive !== undefined && decisive.salience >= 0.5
  const correct = entry.needsRetrieval ? used : false
  return {
    caseId: caseEntry.id,
    title: caseEntry.title,
    kind: caseEntry.kind,
    shape: 'decompose-then-retrieve',
    retrievals: 1,
    recall: decisive ? 1 : entry.needsRetrieval ? 0 : null,
    correct,
    abstained: false,
    hallucinated: !correct,
    tokens:
      estimateTokens(entry.question) +
      COST_MODEL.retrievalOverheadTokens +
      placed.reduce((sum, item) => sum + estimateTokens(item.passage.text), 0) +
      estimateTokens(correct ? entry.answer : entry.wrongAnswer),
    latencyMs: COST_MODEL.retrievalLatencyMs + COST_MODEL.generationLatencyMs,
    outcome: correct ? 'answered correctly' : 'answered wrongly',
  }
}

function average(values: number[]): number | null {
  const kept = values.filter((value) => Number.isFinite(value))
  if (kept.length === 0) return null
  return kept.reduce((sum, value) => sum + value, 0) / kept.length
}

export interface PipelineComparison {
  rows: PipelineRow[]
  /** Every run behind the rows, one per shape per case, for the screen to filter. */
  runs: PipelineRun[]
}

/**
 * The four shapes, over one case set, on one budget model.
 *
 * This compares *shapes* on a controlled synthetic set. It reproduces no number
 * from any survey: what it says is that, on these nine questions, with this
 * critic and this retriever, this shape issues this many retrievals.
 */
export function comparePipelines(
  config: AgenticRetrievalConfig = DEFAULT_AGENTIC_CONFIG,
  cases: PipelineCase[] = PIPELINE_CASES,
): PipelineComparison {
  const rows = PIPELINE_SHAPES.map((shape) => {
    const runs = cases.map((entry) => runShape(shape.value, entry, config))
    const recall = average(runs.map((run) => run.recall).filter((value): value is number => value !== null))
    return {
      shape: shape.value,
      label: shape.label,
      description: shape.description,
      cases: runs.length,
      recall,
      correct: runs.filter((run) => run.correct).length,
      correctRate: runs.length === 0 ? 0 : runs.filter((run) => run.correct).length / runs.length,
      retrievals: runs.reduce((sum, run) => sum + run.retrievals, 0),
      tokens: runs.reduce((sum, run) => sum + run.tokens, 0),
      latencyMs: runs.reduce((sum, run) => sum + run.latencyMs, 0),
      abstentions: runs.filter((run) => run.abstained).length,
      hallucinations: runs.filter((run) => run.hallucinated).length,
      runs,
    }
  })
  return { rows, runs: rows.flatMap((row) => row.runs) }
}

/* ================================================================== */
/* The case set                                                        */
/* ================================================================== */

/**
 * The critique cases, with two of them deliberately built so the critic is wrong.
 *
 * `nullCaseId` and `nullLesson` are the engine's own note that a documented
 * failure fired on this case; the on-screen table repeats it in the same words.
 */
export const CRITIQUE_CASES: CritiqueCase[] = [
  {
    id: 'c-what-is-warranty',
    title: 'A definition, not a lookup',
    question: 'What is a warranty?',
    corpusId: 'refund-policy',
    needsRetrieval: false,
    rewrite: 'what a warranty covers under the returns policy',
    answer: 'Not applicable: the question was answerable without the corpus.',
    internalAnswer:
      'A warranty is an undertaking by the seller that the goods will work as stated for a set period, and that faults inside it are repaired or replaced.',
    wrongAnswer: 'The policy does not define a warranty, so there is nothing to say.',
    note: 'The corpus owns no fact of this kind, and the question shares one content word with it. A pipeline that retrieves anyway pays for the trip and learns nothing.',
  },
  {
    id: 'c-what-is-rag',
    title: 'General knowledge over a returns corpus',
    question: 'In general, what does retrieval augmented generation mean?',
    corpusId: 'refund-policy',
    needsRetrieval: false,
    rewrite: 'retrieval augmented generation definition in the policy corpus',
    answer: 'Not applicable: the question was answerable without the corpus.',
    internalAnswer:
      'Retrieval-augmented generation is putting retrieved text in the prompt before the model writes its answer, so the answer is grounded in material the model was not trained on.',
    wrongAnswer: 'The corpus describes returns and shipping, which is not the question asked.',
    note: 'Nothing in the corpus shares a content word with the question. This is the case the gate exists for.',
  },
  {
    id: 'c-return-window',
    title: 'The decoy at the top',
    question: 'How many days does a customer have to return an item for a refund?',
    corpusId: 'refund-policy',
    needsRetrieval: true,
    decisivePassageId: 'p-returns',
    rewrite: 'how many days after delivery can an unused item be returned for a refund',
    answer:
      'Thirty days from delivery. The window runs from the delivery date, not the order date, so the two can be weeks apart.',
    internalAnswer: 'A refund is usually available for some weeks after a purchase, depending on the shop.',
    wrongAnswer: 'The retrieved passages describe shipping and warranty, not the refund window.',
    note: 'The closest passage is about shipping times and the second is about warranty. Both are rejected by the critic, and the rewritten query reaches the passage that answers.',
  },
  {
    id: 'c-rollback',
    title: 'The decisive passage is not in the first window at all',
    question: 'How do I roll back a failed schema migration?',
    corpusId: 'migration-guide',
    needsRetrieval: true,
    decisivePassageId: 'm-rollback',
    rewrite: 'which command reverses a migration and when it refuses to run',
    answer:
      'Run the down script: `migrate down --to <version>`. It refuses to reverse a migration if data written since depends on the new columns.',
    internalAnswer: 'Migrations are usually forward only, so you restore from a backup.',
    wrongAnswer: 'The passages retrieved talk about connecting and backups, not about reversing a migration.',
    note: 'Nothing in the first window answers the question, so the critic forces a rewrite. The rewrite is scored against the same pool, and the rollback passage wins it.',
  },
  {
    id: 'c-meeting-order',
    title: 'The critic rejects the passage that answers',
    question: 'What topics did the meeting cover, and in what order?',
    corpusId: 'meeting-notes',
    needsRetrieval: true,
    decisivePassageId: 'n-agenda',
    rewrite: 'which topics the meeting covered, listed in the order they took place',
    answer: 'The launch date, the pricing change and the support rota, in that order.',
    internalAnswer: 'Meeting notes usually follow the agenda, but I cannot say what this one covered.',
    wrongAnswer:
      'The team decided to hold the launch on 4 November, provided the payment provider integration finished by 1 November.',
    nullCaseId: 'critic-rejects-the-decisive-passage',
    nullLesson:
      'The agenda passage is the first by similarity, sits at the front of the window and answers the question, so the plain pipeline gets it right. The critic scores it below the threshold in force, because the cross-encoder figure carried in the corpus was authored for the launch-date question and this passage was a distractor there. Support scoring inherits its training distribution, and here that costs a correct answer the cheaper pipeline had.',
    note: 'This is the honest null: the critic is wrong, the table says so, and lowering the threshold fixes it at the cost of letting decoys through.',
  },
  {
    id: 'c-refund-reason',
    title: 'The critic believes a passage that does not answer',
    question: 'Why do shops offer refunds on unused items?',
    corpusId: 'refund-policy',
    needsRetrieval: false,
    rewrite: 'why customers may return an unused item for a refund',
    answer: 'Not applicable: the corpus states the window, never the reason.',
    internalAnswer:
      'Because a shop that takes back goods that did not suit sells more of them: the refund is a promise about the next purchase, not about this one.',
    wrongAnswer:
      'Shops offer refunds because the policy says unused items may be returned within thirty days of delivery.',
    nullCaseId: 'critic-believes-an-unresponsive-passage',
    nullLesson:
      'The gate opened on this one, because the question is built out of the corpus\u2019s own words. The returns passage then scores well on the critic \u2014 it asserts, it covers the wording, the cross-encoder likes it \u2014 and the agent answers a "why" question with a "how many days" passage. Support is not the same thing as responsiveness, and a critic that grades only support cannot tell the two apart.',
    note: 'The second honest null: the critic is right that the passage is sound and wrong that it answers.',
  },
]
