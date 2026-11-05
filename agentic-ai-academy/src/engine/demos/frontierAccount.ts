/**
 * The frontier audit: what this course can measure, and what it can only repeat.
 *
 * Chapter 23 measures agentic LLMs against the frontier of their day and, in
 * passing, records an unusually candid statement of what a large model does and
 * does not do. §23.2.8.1 reports a benchmark study of then-current frontier
 * models which "did not find that models could generate novel hypotheses,
 * algorithms, architectures, or make substantial scientific improvements", while
 * noting that the same systems write papers that "look good, on the surface".
 * §23.2.1 states the mechanism plainly — "Language models are functions: the
 * output that they compute is only based on their input — they are memory-less
 * between calls." §3.4 adds the provenance warning: these are vendor reports,
 * often without peer review, with the data recipe left out, "nonetheless useful
 * to derive insights into what LLMs can and cannot do".
 *
 * That is the shape of an honest comparison, and it is the shape this module
 * copies. There are two columns and they are not the same kind of thing:
 *
 *  - **Measured here.** This course's own numbers, computed by this app: what a
 *    deterministic rule-based stand-in achieves on the reasoning battery (the
 *    reasoning-depth solver run with a fixed policy — see `reasoningDepth.ts`),
 *    and what fraction of the course's own exam questions in that family the
 *    stand-in can answer at all rather than abstain on.
 *  - **Reported, not measured.** Statements drawn from the source text, cited by
 *    chapter and section. They carry a provenance label and contain no numbers.
 *    Nothing in this module reproduces, estimates or paraphrases a published
 *    score, and no figure it displays is attributed to GPT-4 or to any other
 *    model: the audit has no way to run one and says so.
 *
 * The third thing computed here is the honest part of the chapter's own claim:
 * of the limitations Ch. 23 §23.2 records, how many does *this course* actually
 * teach? That is a coverage count over the course's own lesson text, and it is a
 * statement about the course, not a score for the paper.
 */

import { ALL_QUESTIONS, LESSONS } from '../../content/lessons'
import type { LessonBlock, QuizQuestion } from '../../types/curriculum'
import {
  DEFAULT_REASONING_DEPTH_CONFIG,
  TASK_FAMILIES,
  measureFamily,
  type FamilyMeasurement,
  type ReasoningDepthConfig,
  type TaskFamilyId,
} from './reasoningDepth'

/* ------------------------------------------------------------------ */
/* The reported column                                                 */
/* ------------------------------------------------------------------ */

/**
 * The only provenance a comparison cell may carry.
 *
 * A cell is a quotation-shaped object: it records what the chapter says the
 * frontier does, and it is incapable of recording a number. `reportedCellViolations`
 * is the machine-checked version of that rule.
 */
export type ComparisonProvenance = 'reported-not-measured-here'

export const COMPARISON_PROVENANCE: ComparisonProvenance = 'reported-not-measured-here'

export interface ReportedCell {
  /** Words only. Any digit here is a bug, because it would read as a measurement. */
  claim: string
  /** Chapter and section, plus the source the chapter is reading. */
  source: string
  provenance: ComparisonProvenance
}

export const FRONTIER_REPORT: Record<TaskFamilyId, ReportedCell> = {
  arithmetic: {
    claim:
      'The chapter records chain-of-thought as having improved reasoning ability significantly, and records in the same breath that it works better in some domains than in others. It records no rate for a battery of this kind.',
    source: 'Ch. 23 §23.1.1 and §23.2.2 (Overthinking), reading Sprague et al. (2024), arXiv:2409.12183',
    provenance: COMPARISON_PROVENANCE,
  },
  symbolic: {
    claim:
      'The chapter records that a model\'s stated reasoning may not be causally responsible for the output it produces — faithfulness — so a derivation written out on screen is not by itself evidence of the derivation that happened.',
    source: 'Ch. 23 §23.2.3 (Hallucination and Explainability); the GPT-4 Technical Report, arXiv:2303.08774, is the frontier the chapter measures against',
    provenance: COMPARISON_PROVENANCE,
  },
  knowledge: {
    claim:
      'The chapter records that a language model is a function, memory-less between calls, with the context window as the only place a fact can be supplied, and that context windows remain limited. It records no fact-checking rate.',
    source: 'Ch. 23 §23.2.1 (Memory and Self-reflection); the GPT-4 Technical Report, arXiv:2303.08774, is the frontier the chapter measures against',
    provenance: COMPARISON_PROVENANCE,
  },
  commonsense: {
    claim:
      'The chapter records hallucination as answers that sound plausible and are factually incorrect, which is exactly the class of judgement a rule has no purchase on.',
    source: 'Ch. 23 §23.2.3 (Hallucination and Explainability); the GPT-4 Technical Report, arXiv:2303.08774, is the frontier the chapter measures against',
    provenance: COMPARISON_PROVENANCE,
  },
  writing: {
    claim:
      'The chapter records a benchmark study of then-current frontier models that did not find they could generate novel hypotheses, algorithms or architectures, even though the same systems make it easy to produce papers that look good on the surface.',
    source: 'Ch. 23 §23.2.8.1 (AI Science), reading Nathani et al. (2025); the GPT-4 Technical Report, arXiv:2303.08774, is the frontier the chapter measures against',
    provenance: COMPARISON_PROVENANCE,
  },
}

/**
 * Cells whose provenance is not what it claims to be.
 *
 * Three checks, all mechanical: the label must be the reported one, the claim
 * must contain no digit at all (a number in the comparison column would read as
 * a measurement, which is the failure this module exists to prevent), and the
 * citation must name a chapter. An empty array is the only acceptable result,
 * and the audit surfaces the array so a screen can never hide behind it.
 */
export function reportedCellViolations(cells: ReportedCell[] = Object.values(FRONTIER_REPORT)): string[] {
  const violations: string[] = []
  for (const [index, cell] of cells.entries()) {
    const label = `comparison cell ${index + 1}`
    if (cell.provenance !== COMPARISON_PROVENANCE) {
      violations.push(`${label}: provenance is "${cell.provenance}", not "${COMPARISON_PROVENANCE}"`)
    }
    if (/\d/.test(cell.claim)) {
      violations.push(`${label}: the claim carries a digit, so it would read as a measurement`)
    }
    if (!/^Ch\.\s*\d/.test(cell.source)) {
      violations.push(`${label}: the source does not open with a chapter citation`)
    }
    if (/\d\s*%|\bscore\s|\baccuracy\s*\d/i.test(cell.claim)) {
      violations.push(`${label}: the claim reads like a benchmark result`)
    }
  }
  return violations
}

/* ------------------------------------------------------------------ */
/* The measured column: the course's own question bank                 */
/* ------------------------------------------------------------------ */

/**
 * The fixed stand-in configuration.
 *
 * It is the reasoning-depth solver run as style A at one step and the default
 * error rate, i.e. the least generous policy the battery has: no chain, no tool,
 * no tuning. The audit uses it so that the measured column cannot be argued
 * about — it is a single declared policy, not the best of nine.
 */
export const STAND_IN_DEPTH_CONFIG: ReasoningDepthConfig = {
  ...DEFAULT_REASONING_DEPTH_CONFIG,
  style: 'A',
  chainLength: 1,
  seed: 11,
}

/**
 * Words worth counting.
 *
 * Function words are dropped outright: an option that shares "the" and "model"
 * with the lesson text has not been recalled, it has been paraphrased. A short
 * floor on word length keeps the counts on content rather than on articles, and
 * the list is the same discipline the collection's own coverage audit applies.
 */
const STOP_WORDS = new Set([
  'that', 'this', 'with', 'from', 'they', 'their', 'there', 'which', 'would', 'could',
  'should', 'because', 'while', 'when', 'what', 'than', 'then', 'into', 'onto', 'about',
  'have', 'has', 'had', 'will', 'must', 'can', 'cannot', 'does', 'done', 'over', 'under',
  'more', 'most', 'less', 'very', 'both', 'each', 'some', 'such', 'only', 'other',
  'answer', 'question', 'options', 'correct', 'explain', 'before', 'after',
])

function contentWords(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of text.toLowerCase().split(/[^a-z0-9²÷×−]+/)) {
    const word = raw.replace(/[^a-z0-9]/g, '')
    if (word.length < 5) continue
    if (STOP_WORDS.has(word)) continue
    out.add(word)
  }
  return out
}

/** Blocks that carry answers rather than teaching: excluded from the corpus on purpose. */
function isTeachingText(block: LessonBlock): boolean {
  const kind = block.kind
  return kind !== 'checkpoint' && kind !== 'predict'
}

function blockText(block: LessonBlock): string[] {
  if (!isTeachingText(block)) return []
  switch (block.kind) {
    case 'prose':
      return [block.markdown]
    case 'formula':
      return [block.caption ?? '', block.latex]
    case 'callout':
      return [block.title, block.markdown]
    case 'list':
      return block.items
    case 'diagram':
      return [block.caption]
    case 'code':
      return [block.code, block.caption ?? '']
    case 'table':
      return [block.caption, ...block.headers, ...block.rows.flat()]
    case 'example':
      return [block.title, block.takeaway, ...block.steps.flatMap((step) => [step.label, step.detail])]
    case 'lab-link':
      return [block.title, block.description]
    case 'demo':
      return [block.title, block.intro]
    default:
      return []
  }
}

/**
 * The course's own words for a chapter: the lesson text that teaches it.
 *
 * The quiz and the prediction blocks are deliberately not part of it, because a
 * stand-in that read the answer key would not be a stand-in, it would be a
 * copy. `provenance.textbookChapters` is the course's declaration of which
 * chapters a lesson teaches, so the mapping is the app's own, not invented here.
 */
export function chapterCorpus(chapter: number): Set<string> {
  const words = new Set<string>()
  for (const lesson of LESSONS) {
    if (!lesson.provenance.textbookChapters.includes(chapter)) continue
    const text = [
      lesson.title,
      lesson.summary,
      ...lesson.objectives.map((objective) => objective.text),
      ...lesson.sections.flatMap((section) => [section.title, ...section.blocks.flatMap(blockText)]),
      ...lesson.advancedSections.flatMap((section) => [section.title, ...section.blocks.flatMap(blockText)]),
    ].join(' ')
    for (const word of contentWords(text)) words.add(word)
  }
  return words
}

export interface StandInVerdict {
  questionId: string
  /** The option the rule picks, or null when it abstains. */
  picked: number | null
  /** Overlap with the chapter's own lesson text, per option. */
  scores: number[]
  /** True when the rule has something to say at all. */
  answerable: boolean
  /** Why the rule abstained, when it does. */
  reason: string
  /** True when the rule's pick is the bank's key — measured, not assumed. */
  matchesKey: boolean
}

/**
 * The trivial heuristic, stated in full.
 *
 * It answers a multiple-choice question by choosing the option whose wording
 * overlaps the course's own lesson text for that chapter most strongly. It
 * abstains when nothing overlaps or when two options tie, because a rule with
 * no basis has no answer. That is the whole of it: no model, no embedding, no
 * tuning against the key. The point of running it on the bank is to see how far
 * "echo the material you were given" gets you, which is a question about the
 * bank, not about a language model.
 */
export function standInVerdict(question: QuizQuestion, corpus?: Set<string>): StandInVerdict {
  const words = corpus ?? chapterCorpus(question.source.chapter)
  const scores = question.options.map((option) => {
    let hits = 0
    for (const word of contentWords(option)) if (words.has(word)) hits += 1
    return hits
  })
  const best = Math.max(...scores)
  const top = scores.filter((score) => score === best).length

  if (best === 0) {
    return { questionId: question.id, picked: null, scores, answerable: false, reason: 'no content word of any option appears in the chapter\'s own text', matchesKey: false }
  }
  if (top > 1) {
    return { questionId: question.id, picked: null, scores, answerable: false, reason: `${top} options tie on overlap, so the rule has no basis to choose`, matchesKey: false }
  }
  const picked = scores.indexOf(best)
  return { questionId: question.id, picked, scores, answerable: true, reason: 'one option overlaps the chapter text more than every other', matchesKey: picked === question.correct }
}

/** The questions the course actually asks, of this kind. */
export function questionsForFamily(family: TaskFamilyId): QuizQuestion[] {
  const definition = TASK_FAMILIES.find((entry) => entry.id === family)
  if (!definition) return []
  return ALL_QUESTIONS.filter((question) => definition.chapters.includes(question.source.chapter))
}

export interface ExamCoverage {
  family: TaskFamilyId
  familyLabel: string
  /** Chapters credited to this family by the battery's own family table. */
  chapters: number[]
  questions: number
  answerable: number
  /** Null when the bank holds no question of this family — reported, not invented. */
  answerableFraction: number | null
  matchesKey: number
  /** Of the questions the rule answered, how many it answered correctly. */
  precisionWhenAnswering: number | null
}

/**
 * The coverage record for an explicit pool.
 *
 * `auditExamCoverage` is this function over the family's banked questions; the
 * pool is a parameter so the empty case is reachable and reportable rather than
 * hypothetical — a family the bank holds no question for says so with null.
 */
export function examCoverage(family: TaskFamilyId, pool: QuizQuestion[]): ExamCoverage {
  const definition = TASK_FAMILIES.find((entry) => entry.id === family)
  const corpusCache = new Map<number, Set<string>>()
  const verdicts = pool.map((question) => {
    const key = question.source.chapter
    const corpus = corpusCache.get(key) ?? chapterCorpus(key)
    corpusCache.set(key, corpus)
    return standInVerdict(question, corpus)
  })
  const answerable = verdicts.filter((verdict) => verdict.answerable).length
  const matchesKey = verdicts.filter((verdict) => verdict.matchesKey).length
  return {
    family,
    familyLabel: definition?.label ?? family,
    chapters: [...(definition?.chapters ?? [])],
    questions: pool.length,
    answerable,
    answerableFraction: pool.length === 0 ? null : answerable / pool.length,
    matchesKey,
    precisionWhenAnswering: answerable === 0 ? null : matchesKey / answerable,
  }
}

export function auditExamCoverage(family: TaskFamilyId): ExamCoverage {
  return examCoverage(family, questionsForFamily(family))
}

/* ------------------------------------------------------------------ */
/* The honest account: which limitations this course teaches           */
/* ------------------------------------------------------------------ */

export interface FrontierLimitation {
  id: string
  /** The section number as the chapter records it. */
  section: string
  /** What §23.2 says the limitation is, in the chapter's terms. */
  statement: string
  /**
   * Phrases the course's own lesson text has to contain for this to count as
   * taught. Authored before the search ran, one concept each, so a hit is a
   * statement about the course and not about the search.
   */
  markers: string[]
}

export const FRONTIER_LIMITATIONS: FrontierLimitation[] = [
  {
    id: 'memory',
    section: 'Ch. 23 §23.2.1',
    statement: 'The model is a function, memory-less between calls; the context window is finite and the past has to be re-supplied.',
    markers: ['memory-less', 'context window', 'episodic memory', 'self-reflection'],
  },
  {
    id: 'scale',
    section: 'Ch. 23 §23.2.2',
    statement: 'Scaling is plateauing — data, money and power — and more thinking effort can tip into overthinking.',
    markers: ['scaling', 'plateau', 'chain of thought', 'training data'],
  },
  {
    id: 'hallucination',
    section: 'Ch. 23 §23.2.3',
    statement: 'Hallucination and explainability: plausible answers that are wrong, and stated reasoning that may not cause the output.',
    markers: ['hallucinat', 'explainab', 'faithful', 'interpretab'],
  },
  {
    id: 'consciousness',
    section: 'Ch. 23 §23.2.4',
    statement: 'Emotional behaviour and consciousness: the tendency to read purpose and feeling into an algorithm, and what follows from it.',
    markers: ['conscious', 'anthropomorph', 'sentient', 'emotional behavio'],
  },
  {
    id: 'social',
    section: 'Ch. 23 §23.2.5',
    statement: 'Social behaviour in simulation is heavily shaped by the prompt script, and emergent behaviour is hard to validate.',
    markers: ['emergent', 'social simulat', 'multi-agent', 'role-play'],
  },
  {
    id: 'legal',
    section: 'Ch. 23 §23.2.6',
    statement: 'Legal and ethical aspects: agents act with real consequences, and responsibility and liability are unresolved.',
    markers: ['ethical', 'legal', 'responsibility', 'safety'],
  },
  {
    id: 'crime',
    section: 'Ch. 23 §23.2.7',
    statement: 'Crime: convincing synthetic behaviour makes social engineering, persuasion and fraud harder to tell apart.',
    markers: ['crime', 'fraud', 'social engineering', 'criminal'],
  },
  {
    id: 'applications',
    section: 'Ch. 23 §23.2.8',
    statement: 'Limitations of applications: proofs of concept impress at first sight, and the consequences in medicine, commerce and trading may not be easy to fix.',
    markers: ['high-stakes', 'medicine', 'e-commerce', 'trading'],
  },
]

export interface LimitationEvidence {
  lessonSlug: string
  lessonTitle: string
  sectionTitle: string
  excerpt: string
  marker: string
}

export interface LimitationAuditRow {
  limitation: FrontierLimitation
  taught: boolean
  mentions: number
  evidence: LimitationEvidence[]
}

export interface LimitationAudit {
  rows: LimitationAuditRow[]
  /** How many of the limitations the chapter records this course actually teaches. */
  taughtCount: number
  total: number
  coverage: number
  /** The ones it does not, named. */
  untaught: string[]
  /** The corpus the search ran over, so the count can be audited. */
  corpusLessons: number
  corpusSections: number
}

function lessonTeachingText(): { lesson: (typeof LESSONS)[number]; sectionTitle: string; text: string }[] {
  const out: { lesson: (typeof LESSONS)[number]; sectionTitle: string; text: string }[] = []
  for (const lesson of LESSONS) {
    for (const section of [...lesson.sections, ...lesson.advancedSections]) {
      out.push({
        lesson,
        sectionTitle: section.title,
        text: [section.title, ...section.blocks.flatMap(blockText)].join(' '),
      })
    }
  }
  return out
}

function excerptAround(text: string, marker: string): string {
  const index = text.toLowerCase().indexOf(marker.toLowerCase())
  if (index === -1) return text.slice(0, 140)
  const start = Math.max(0, text.lastIndexOf(' ', Math.max(0, index - 60)))
  const end = text.indexOf(' ', index + marker.length + 60)
  return text.slice(start, end === -1 ? index + marker.length + 60 : end).trim()
}

/**
 * Which limitations the chapter records, and which of them this course teaches.
 *
 * The search is over the course's own lesson sections — the same teaching text
 * the stand-in reads, answer key excluded. A section counts once per limitation,
 * whatever the number of hits inside it, so a lesson that repeats a phrase is
 * not worth more than one that says it plainly.
 */
export function auditLimitations(): LimitationAudit {
  const sections = lessonTeachingText()
  const rows: LimitationAuditRow[] = FRONTIER_LIMITATIONS.map((limitation) => {
    const evidence: LimitationEvidence[] = []
    let mentions = 0
    for (const section of sections) {
      const lower = section.text.toLowerCase()
      const hit = limitation.markers.find((marker) => lower.includes(marker.toLowerCase()))
      if (!hit) continue
      mentions += 1
      if (evidence.length < 3) {
        evidence.push({
          lessonSlug: section.lesson.slug,
          lessonTitle: section.lesson.title,
          sectionTitle: section.sectionTitle,
          excerpt: excerptAround(section.text, hit),
          marker: hit,
        })
      }
    }
    return { limitation, taught: mentions > 0, mentions, evidence }
  })

  return {
    rows,
    taughtCount: rows.filter((row) => row.taught).length,
    total: rows.length,
    coverage: rows.filter((row) => row.taught).length / rows.length,
    untaught: rows.filter((row) => !row.taught).map((row) => row.limitation.section),
    corpusLessons: LESSONS.length,
    corpusSections: sections.length,
  }
}

/* ------------------------------------------------------------------ */
/* The audit                                                           */
/* ------------------------------------------------------------------ */

export interface AuditRow {
  family: TaskFamilyId
  familyLabel: string
  basis: string
  decomposable: boolean
  /** Measured: the fixed stand-in on this family's battery tasks. */
  standIn: FamilyMeasurement | null
  /** Measured: the course's own exam questions in this family. */
  exam: ExamCoverage
  /** Reported text, never a number. */
  reported: ReportedCell
}

export interface FrontierAuditResult {
  rows: AuditRow[]
  provenance: { violations: string[]; ok: boolean; cells: number }
  limitations: LimitationAudit
  /**
   * Measured over the course's own bank. `questions` is the pool the audit
   * actually reads — the banked questions in the five families' credited
   * chapters — so `answerableFraction` is `answerable / questions` and never a
   * number divided by a larger denominator. `wholeBank` is reported alongside it
   * so the pool's size is visible instead of implied.
   */
  bank: {
    questions: number
    wholeBank: number
    answerable: number
    answerableFraction: number
    matchesKey: number
  }
  summary: string
}

/**
 * The whole audit. Deterministic: the question bank and the lesson text are the
 * repository's own files, and the stand-in runs at one fixed seed.
 */
export function runFrontierAudit(config: ReasoningDepthConfig = STAND_IN_DEPTH_CONFIG): FrontierAuditResult {
  const rows: AuditRow[] = TASK_FAMILIES.map((family) => ({
    family: family.id,
    familyLabel: family.label,
    basis: family.basis,
    decomposable: family.decomposable,
    standIn: measureFamily(family.id, config),
    exam: auditExamCoverage(family.id),
    reported: FRONTIER_REPORT[family.id],
  }))

  const violations = reportedCellViolations(rows.map((row) => row.reported))
  // The chapters behind the five families are disjoint, but the pool is deduped
  // by question id so the count cannot silently double a shared chapter.
  const pool = new Map<string, QuizQuestion>()
  for (const row of rows) {
    for (const question of questionsForFamily(row.family)) {
      if (!pool.has(question.id)) pool.set(question.id, question)
    }
  }
  const verdicts = [...pool.values()]
  const corpusCache = new Map<number, Set<string>>()
  const answered = verdicts.map((question) => {
    const key = question.source.chapter
    const corpus = corpusCache.get(key) ?? chapterCorpus(key)
    corpusCache.set(key, corpus)
    return standInVerdict(question, corpus)
  })
  const answerable = answered.filter((verdict) => verdict.answerable).length

  const limitations = auditLimitations()
  const standsIn = rows.map((row) => row.standIn).filter((row): row is FamilyMeasurement => row !== null)
  const meanStandIn =
    standsIn.length === 0 ? 0 : standsIn.reduce((sum, row) => sum + row.accuracy, 0) / standsIn.length

  return {
    rows,
    provenance: { violations, ok: violations.length === 0, cells: rows.length },
    limitations,
    bank: {
      questions: verdicts.length,
      wholeBank: ALL_QUESTIONS.length,
      answerable,
      answerableFraction: verdicts.length === 0 ? 0 : answerable / verdicts.length,
      matchesKey: answered.filter((verdict) => verdict.matchesKey).length,
    },
    summary: `The stand-in solves ${Math.round(meanStandIn * 100) / 100} of the hand-authored battery it is given, and can put an answer to ${answerable} of the ${verdicts.length} course questions banked in these five families (${limitations.taughtCount} of the ${limitations.total} limitations Ch. 23 records appear in this course's lesson text). None of these numbers describe a model.`,
  }
}
