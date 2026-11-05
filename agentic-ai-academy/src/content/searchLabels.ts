import type { SearchKind } from './searchIndex'

/**
 * The labels for the kinds of thing a search can find.
 *
 * They live in their own module so that the search *index* can be loaded on
 * demand. If the dialog imported them from the index module, the whole index
 * — every lesson, section, glossary term and question — would be pulled into
 * the initial bundle, and the dynamic import would quietly do nothing.
 */
export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  lesson: 'Lesson',
  section: 'Lesson section',
  glossary: 'Glossary term',
  question: 'Assessment question',
  lab: 'Laboratory',
  reference: 'Reference',
}
