import { DIAGRAM_IDS } from '../content/diagramIds'
import { DEMO_IDS } from '../content/demos'
/**
 * Curriculum schema for Agentic AI Academy.
 *
 * The schema is intentionally broader than the current release so that the
 * remaining chapters of the textbook can be added without changing the
 * rendering or progress layers.
 */

export type PartId =
  | 'part-1-language-modeling'
  | 'part-2-reasoning'
  | 'part-3-agents'
  | 'part-4-tools-assistants'
  | 'part-5-behavior-cognition'
  | 'part-6-advanced'
  | 'part-7-conclusion'

export interface BookPart {
  id: PartId
  order: number
  title: string
  /** Chapter numbers that this part covers in the source textbook. */
  chapters: number[]
  summary: string
  accent: 'cyan' | 'violet' | 'emerald' | 'amber' | 'rose'
}

export interface BookChapter {
  number: number
  title: string
  part: PartId
  /** Page number in the arXiv PDF (2610.13455v1). */
  page: number
  isCaseStudy: boolean
  /** Chapters marked with * in the book are advanced topics. */
  isAdvanced: boolean
}

export type LessonDifficulty = 'core' | 'advanced'

export interface LearningObjective {
  text: string
  /** Chapter / section the objective is derived from. */
  source: string
}

export interface SourceRef {
  /** e.g. "Chapter 9, Section 9.2.1" */
  label: string
  chapter: number
  section?: string
  page?: number
  /** true when the linked content is derived from the textbook. */
  primary: boolean
}

export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  /** Index into `options`. */
  correct: number
  explanation: string
  /** Chapter / section the question is sourced from. */
  source: SourceRef
  difficulty: LessonDifficulty
  /**
   * An instruction for checking the answer, naming the control to change.
   *
   * A question the student cannot test is a question they can only guess at.
   * This turns each diagnostic into an experiment: set the control to this
   * value, look, and see whether the prediction holds.
   */
  tryIt?: string
}

export type LessonBlock =
  | { kind: 'prose'; markdown: string }
  | { kind: 'list'; ordered?: boolean; items: string[] }
  | { kind: 'formula'; latex: string; caption?: string }
  | { kind: 'diagram'; diagram: DiagramId; caption: string }
  | { kind: 'code'; language: string; code: string; caption?: string }
  | {
      kind: 'callout'
      tone: 'info' | 'warning' | 'insight' | 'source'
      title: string
      markdown: string
    }
  | {
      kind: 'table'
      caption: string
      headers: string[]
      rows: string[][]
    }
  | {
      kind: 'example'
      title: string
      steps: { label: string; detail: string }[]
      takeaway: string
    }
  | {
      kind: 'checkpoint'
      question: string
      answer: string
    }
  | {
      /**
       * A prediction the student commits to before the answer is revealed.
       *
       * Retrieving a fact is easy; recognising that you did not know it is
       * what makes the fact stick. These blocks ask the student to commit to
       * an answer, and only then show the explanation — and a wrong
       * prediction joins the review queue like any other mistake.
       */
      kind: 'predict'
      question: QuizQuestion
    }
  | {
      kind: 'lab-link'
      labId: string
      title: string
      description: string
    }
  | {
      /** An interactive demonstration, embedded in the prose where the concept is introduced. */
      kind: 'demo'
      demo: DemoId
      title: string
      intro: string
    }

/**
 * The interactive demonstrations that can be embedded in a lesson.
 *
 * Derived from the registry in `content/demos.ts`, so the renderer and the
 * content validator agree on which demonstrations exist.
 */
export type DemoId = (typeof DEMO_IDS)[number]

/**
 * The registered diagram identifiers.
 *
 * Derived from the data so that a new diagram cannot be added to the
 * renderer without also being known to the content validator.
 */
export type DiagramId = (typeof DIAGRAM_IDS)[number]

export interface LessonSection {
  id: string
  title: string
  /** Minimal markdown subset rendered by the lesson reader. */
  blocks: LessonBlock[]
}

/**
 * The material a lesson author writes.
 *
 * The advanced-track material is supplied separately (see
 * `content/lessons/advancedTrack.ts`) and merged in by the lesson index, so
 * that authoring a lesson never requires touching the track plumbing.
 */
export interface LessonContent {
  id: string
  slug: string
  order: number
  part: PartId
  /**
   * Additional parts of the textbook this lesson also draws on.
   *
   * A few lessons legitimately straddle a part boundary in the book — the
   * BALROG case study (Ch. 10) sits in Part III but is taught together with
   * the multi-step reasoning material (Ch. 6). Listing the extra parts keeps
   * the curriculum navigator honest about where the material actually comes
   * from instead of forcing a single label.
   */
  secondaryParts: PartId[]
  title: string
  summary: string
  /** Estimated study time in minutes. */
  minutes: number
  difficulty: LessonDifficulty
  prerequisites: string[]
  objectives: LearningObjective[]
  sections: LessonSection[]
  quiz: QuizQuestion[]
  sources: SourceRef[]
  /**
   * The primary literature behind the lesson.
   *
   * The textbook is a survey, and a survey points at the papers it is
   * summarising. These are those papers, so a student who wants to go past
   * the course has a route rather than a dead end. The ids refer to the
   * entries in `content/references.ts`.
   */
  furtherReading?: { referenceId: string; note: string }[]
  /** Textbook vs supplementary educational material. */
  provenance: {
    textbookChapters: number[]
    supplementaryNote: string
  }
  keywords: string[]
}

export interface Lesson extends LessonContent {
  /**
   * Extra sections that only appear on the advanced track.
   *
   * These carry the harder treatment of the same material: quantitative
   * derivations, counterexamples, and design trade-offs that the core track
   * deliberately does not develop.
   */
  advancedSections: LessonSection[]
  /** Questions that only appear on the advanced track. */
  advancedQuiz: QuizQuestion[]
}

export interface GlossaryTerm {
  term: string
  definition: string
  source: SourceRef | null
  related: string[]
  /** Lessons where the term is introduced or used. */
  lessons: string[]
  /**
   * Alternative spellings that should link to this term in the prose.
   *
   * Abbreviations are derived automatically (the "RAG" in "Retrieval-
   * augmented generation (RAG)"), but an author can list them explicitly.
   */
  aliases?: string[]
  /**
   * The interactive demonstration in which this concept can be tried.
   *
   * It turns a definition into a route into the material: a student who reads
   * "Tool use" can go straight to the place where they choose a tool.
   */
  demo?: DemoId
}

export interface Reference {
  id: string
  authors: string
  year: number
  title: string
  venue: string
  url?: string
  /** How this reference is used inside the course. */
  usedFor: string
  /** Provenance check result for third-party artefacts. */
  licenseNote: string
}
