import { LESSONS, MODULES } from './curriculum'
import { GLOSSARY, FORMULAS } from './glossary'
import { EXPLANATIONS } from './explanations'
import { PAGE_ROUTES } from './routes'
import { CONFIDENCE_LABEL, MODULE_STATUS } from './status'

/**
 * The index of everything in the course that can be found.
 *
 * The header search and the command palette both read this index, so a term
 * that is reachable from one is reachable from the other. The index is built
 * once and then held, because it is derived from the curriculum and never
 * changes while the course is running.
 */

export type SearchKind =
  | 'lesson'
  | 'module'
  | 'glossary'
  | 'formula'
  | 'page'
  | 'question'
  | 'status'

export interface SearchHit {
  kind: SearchKind
  id: string
  title: string
  detail: string
  href: string
  /**
   * Additional lines that count as part of this entry for matching, and that
   * are shown as a snippet when one of them is what matched. The objectives and
   * key ideas of a lesson are the closest thing it has to an index, and they
   * are already data — so the search can reach them without rendering the
   * lesson body.
   */
  searchText?: string[]
}

/**
 * The pages of the course, as the search shows them.
 *
 * The list comes from the course's own declaration of its pages, so a page
 * that is added to the course is findable. It used to be written out here,
 * and the status page was missing from it for a while — the same drift as
 * the accessibility audit, in a fourth place.
 */
export const STATIC_PAGES: SearchHit[] = PAGE_ROUTES.filter((route) => route.search).map((route) => ({
  kind: 'page',
  id: route.name,
  title: (route.search as { title: string; detail: string }).title,
  detail: (route.search as { title: string; detail: string }).detail,
  href: route.path,
}))

export function buildIndex(): SearchHit[] {
  const hits: SearchHit[] = [...STATIC_PAGES]
  for (const module of MODULES) {
    hits.push({
      kind: 'module',
      id: module.id,
      title: module.title,
      detail: `Module ${module.chapter} · ${module.pages}`,
      href: `/modules/${module.id}`,
      searchText: [
        module.tagline,
        module.summary,
        ...module.misconceptions.flatMap((entry) => [entry.mistake, entry.correction]),
      ],
    })
  }
  /*
    What each module's standing is now, and what has moved. A reader who
    half-remembers a phrase — "brevity bias", or "context collapse" — can
    find the module it belongs to, which they could not before: the page
    that carried those phrases was not in the index.
  */
  for (const status of MODULE_STATUS) {
    const module = MODULES.find((item) => item.id === status.moduleId)
    if (!module) continue
    hits.push({
      kind: 'status',
      id: status.moduleId,
      title: `${module.title} — how settled is this?`,
      detail: `${CONFIDENCE_LABEL[status.confidence]} · what has moved since the book`,
      href: `/status#${status.moduleId}`,
      searchText: [status.moving, status.settled],
    })
  }
  for (const lesson of LESSONS) {    hits.push({
      kind: 'lesson',
      id: lesson.id,
      title: `${String(lesson.number).padStart(2, '0')} · ${lesson.title}`,
      detail: lesson.subtitle,
      href: `/lessons/${lesson.id}`,
      searchText: [...lesson.objectives, ...lesson.keyIdeas, lesson.subtitle],
    })
  }
  for (const entry of GLOSSARY) {
    hits.push({
      kind: 'glossary',
      id: entry.id,
      title: entry.term,
      detail: entry.short,
      href: `/glossary?term=${entry.id}`,
      searchText: [entry.definition],
    })
  }
  for (const formula of FORMULAS) {
    hits.push({
      kind: 'formula',
      id: formula.id,
      title: formula.name,
      detail: `§${formula.section} · p.${formula.page}`,
      href: `/math?formula=${formula.id}`,
      searchText: [formula.explanation],
    })
  }
  /*
   * The self-explanation questions. A reader who half-remembers the question
   * a lesson asks can find it here, and so can a reader looking for the
   * lesson that asks about a particular idea.
   */
  for (const explanation of EXPLANATIONS) {
    const lesson = LESSONS.find((item) => item.id === explanation.lessonId)
    hits.push({
      kind: 'question',
      id: explanation.lessonId,
      title: explanation.prompt,
      detail: lesson ? `The question at the end of “${lesson.title}”` : 'A self-explanation question',
      href: `/lessons/${explanation.lessonId}#explain-back`,
      // Only the question, not the model answer. The answer is a page of
      // prose per lesson, and the search is for the question a reader
      // half-remembers — the lesson itself is the better target for a
      // concept.
      searchText: [],
    })
  }
  return hits
}

/** A short label for each kind of entry, for the interface. */
export const KIND_LABEL: Record<SearchKind, string> = {
  lesson: 'Lesson',
  module: 'Module',
  glossary: 'Term',
  formula: 'Formula',
  page: 'Page',
  question: 'Question',
  status: 'Currency',
}
