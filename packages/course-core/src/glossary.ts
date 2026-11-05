/**
 * The glossary model shared by every course.
 *
 * A term carries a plain-language definition, the terms it depends on, and a
 * source attribution. The dependency edges are the interesting part: they are
 * what lets a course draw a prerequisite map and what lets a learner find out
 * *why* a term is unfamiliar.
 */

export type GlossaryCategory =
  | 'concept'
  | 'mathematics'
  | 'method'
  | 'measurement'
  | 'notation'
  | 'mechanism'

export interface GlossaryTerm {
  id: string
  term: string
  /** One-sentence definition. */
  short: string
  /** The longer explanation shown on the glossary page. */
  long: string
  category: GlossaryCategory
  /** Ids of terms that should be understood first. */
  prerequisites: string[]
  /** Where the definition comes from, when it is not a course-authored term. */
  attribution?: { label: string; href?: string; isCourseAuthored?: boolean }
  /** A worked number, where it helps. */
  example?: { question: string; answer: string }
}

export function termById(terms: GlossaryTerm[], id: string): GlossaryTerm | undefined {
  return terms.find((t) => t.id === id)
}

export function termsInCategory(terms: GlossaryTerm[], category: GlossaryCategory): GlossaryTerm[] {
  return terms.filter((t) => t.category === category)
}

/** Terms that depend on a given term. */
export function dependentsOfTerm(terms: GlossaryTerm[], termId: string): GlossaryTerm[] {
  return terms.filter((t) => t.prerequisites.includes(termId))
}

/**
 * Detect a cycle in the term dependency graph.
 *
 * Returns the ids involved in a cycle, or an empty array when the graph is a
 * DAG. A cycle would make the "understand this first" ordering impossible.
 */
export function findTermCycle(terms: GlossaryTerm[]): string[] {
  const byId = new Map(terms.map((t) => [t.id, t]))
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

  for (const term of terms) visit(term.id)
  return cycle
}

/** Group terms by their first letter, for an index. */
export function groupByInitial(terms: GlossaryTerm[]): { letter: string; terms: GlossaryTerm[] }[] {
  const groups = new Map<string, GlossaryTerm[]>()
  for (const term of terms) {
    const letter = (term.term[0] ?? '#').toUpperCase()
    const list = groups.get(letter) ?? []
    list.push(term)
    groups.set(letter, list)
  }
  return [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([letter, list]) => ({ letter, terms: list.sort((a, b) => a.term.localeCompare(b.term)) }))
}
