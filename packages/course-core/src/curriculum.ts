/**
 * The curriculum model shared by every course application.
 *
 * A course is a list of modules, each holding lessons, and each lesson pointing
 * at a lab, a set of glossary terms, a set of assessment questions and — the
 * part that makes the courses trustworthy — a list of source references into
 * the book or paper the course was written from.
 *
 * The reference type is deliberately strict: a lesson that claims a source
 * must name a chapter and a section, and the section must exist in the
 * source map. The test suite in each course enforces that.
 */

export type Accent = 'indigo' | 'teal' | 'amber' | 'emerald' | 'rose' | 'violet' | 'sky'

export interface SourceRef {
  /**
   * The chapter, lecture or section identifier in the source.
   *
   * A number for a paper or a book, and a string for something that is
   * organised by lecture rather than by chapter.
   */
  chapter: number | string
  /** Section number exactly as printed, e.g. "2.1.1". */
  section: string
  /** Section title as printed. */
  title: string
  /** Page number in the source PDF, when the source is paginated. */
  page?: number
  /** What this course takes from that section. */
  note: string
}

export interface InteractiveRef {
  /** Which laboratory to open. */
  lab: string
  /** Which view of the laboratory to open by default. */
  view?: string
  title: string
  description: string
}

export interface LessonMeta {
  id: string
  moduleId: string
  number: number
  title: string
  subtitle: string
  /** Estimated study time in minutes. */
  minutes: number
  objectives: string[]
  keyIdeas: string[]
  interactive: InteractiveRef
  /** Ids of lessons that should be read first. The graph must be acyclic. */
  prerequisites: string[]
  /** Glossary term ids used in this lesson. */
  glossaryTerms: string[]
  /**
   * Equation-reference ids this lesson is about.
   *
   * The lesson page prints these as "the mathematics of this lesson", which is a
   * claim about the course's own reference rather than a hard-coded formula — so
   * a wrong id is a broken promise on the page, and the content test fails it.
   */
  formulaIds?: string[]
  /** Assessment question ids for this lesson. */
  quizIds: string[]
  sourceRefs: SourceRef[]
  furtherReading: { label: string; href: string; note: string }[]
}

export interface ModuleMeta {
  id: string
  /** Chapter in the source document that this module covers. */
  chapter: number
  title: string
  tagline: string
  summary: string
  accent: Accent
  /** Page range in the source PDF, when the source is paginated. */
  pages?: string
  outcomes: string[]
}

/** A lesson's lesson body, split into readable blocks. */
export type LessonBlock =
  | { kind: 'paragraph'; text: string }
  | { kind: 'heading'; text: string; level: 2 | 3 }
  | { kind: 'list'; items: string[]; ordered?: boolean }
  | { kind: 'callout'; tone: 'note' | 'warning' | 'definition'; title: string; text: string }
  | { kind: 'formula'; latex: string; caption?: string }
  | { kind: 'interactive'; lab: string; view?: string; title: string; description: string }
  | { kind: 'exercise'; title: string; body: string; answer: string }

export interface LessonContent {
  id: string
  blocks: LessonBlock[]
}

/* ------------------------------------------------------------------ selectors */

export function moduleById(modules: ModuleMeta[], id: string): ModuleMeta | undefined {
  return modules.find((m) => m.id === id)
}

export function lessonsOfModule(lessons: LessonMeta[], moduleId: string): LessonMeta[] {
  return lessons.filter((l) => l.moduleId === moduleId).sort((a, b) => a.number - b.number)
}

export function lessonById(lessons: LessonMeta[], id: string): LessonMeta | undefined {
  return lessons.find((l) => l.id === id)
}

/** Map of module id → lesson ids, used by the progress summary. */
export function moduleLessonIds(modules: ModuleMeta[], lessons: LessonMeta[]): Record<string, string[]> {
  const map: Record<string, string[]> = {}
  for (const module of modules) map[module.id] = []
  for (const lesson of lessons) {
    if (!map[lesson.moduleId]) map[lesson.moduleId] = []
    map[lesson.moduleId].push(lesson.id)
  }
  return map
}

/**
 * Detect a cycle in the prerequisite graph.
 *
 * Returns the ids involved in a cycle, or an empty array when the graph is a
 * DAG. Every course runs this in its test suite, because a cycle would make
 * the "read this first" hints impossible to satisfy.
 */
export function findPrerequisiteCycle(lessons: LessonMeta[]): string[] {
  const byId = new Map(lessons.map((l) => [l.id, l]))
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []
  let cycle: string[] = []

  const visit = (id: string): void => {
    if (cycle.length > 0) return
    const current = state.get(id)
    if (current === 'done') return
    if (current === 'visiting') {
      const start = stack.indexOf(id)
      cycle = stack.slice(start === -1 ? 0 : start)
      cycle.push(id)
      return
    }
    state.set(id, 'visiting')
    stack.push(id)
    for (const prereq of byId.get(id)?.prerequisites ?? []) {
      if (byId.has(prereq)) visit(prereq)
      if (cycle.length > 0) return
    }
    stack.pop()
    state.set(id, 'done')
  }

  for (const lesson of lessons) visit(lesson.id)
  return cycle
}

/** Lessons that depend on a given lesson, directly. */
export function dependentsOf(lessons: LessonMeta[], lessonId: string): string[] {
  return lessons.filter((l) => l.prerequisites.includes(lessonId)).map((l) => l.id)
}

/** Topological order of lessons by prerequisite, or `null` when there is a cycle. */
export function prerequisiteOrder(lessons: LessonMeta[]): string[] | null {
  if (findPrerequisiteCycle(lessons).length > 0) return null
  const byId = new Map(lessons.map((l) => [l.id, l]))
  const visited = new Set<string>()
  const order: string[] = []
  const visit = (id: string): void => {
    if (visited.has(id)) return
    visited.add(id)
    for (const prereq of byId.get(id)?.prerequisites ?? []) {
      if (byId.has(prereq)) visit(prereq)
    }
    order.push(id)
  }
  for (const lesson of lessons) visit(lesson.id)
  return order
}
