/**
 * The collection-wide search.
 *
 * One index over everything: the courses, the sources, the concepts and the
 * edges of the learning path. The search itself is the one in the shared
 * core, so the ranking is the same everywhere in the collection, and a
 * reader who learns to search in one course has learned it for good.
 */

import { search, type SearchDocument, type SearchHit, type SearchOptions } from '@llm-materials/course-core'
import type { CatalogueManifest } from './manifest'
import LESSONS from './lessons.data.json'
import { CONCEPTS } from './concepts'
import { LEARNING_PATH } from './paths'

/** The kind of a document in the collection index. */
export type CatalogueKind = 'Course' | 'Source' | 'Concept' | 'Path' | 'Lesson'

/** A document in the collection index, with the route it opens. */
export interface CatalogueDocument extends SearchDocument {
  kind: CatalogueKind
  /** The course the document belongs to, when it belongs to one. */
  app?: string
}

/**
 * Build the index.
 *
 * The routes are relative to the collection's front door, so the same index
 * works in the hub and in a course application that links out to the hub.
 */
export function buildCatalogueIndex(manifest: CatalogueManifest): CatalogueDocument[] {
  const documents: CatalogueDocument[] = []

  for (const app of manifest.apps) {
    documents.push({
      id: `app:${app.id}`,
      title: app.title,
      summary: app.modules.join(' · '),
      body: `${app.modules.join(' ')} ${app.id} ${app.status}`,
      kind: 'Course',
      app: app.id,
      keywords: [app.status],
      href: `/${app.id}/`,
    })
  }

  for (const source of manifest.sources) {
    documents.push({
      id: `source:${source.id}`,
      title: source.title,
      summary: `${source.authors.join(', ')} · ${source.year}`,
      body: `${source.title} ${source.authors.join(' ')} ${source.venue} ${source.gapClosed} ${source.labs.join(' ')}`,
      kind: 'Source',
      app: source.app,
      keywords: [source.kind, source.role, source.venue],
      href: `/#/source/${source.id}`,
    })
  }

  for (const concept of CONCEPTS) {
    documents.push({
      id: `concept:${concept.id}`,
      title: concept.term,
      summary: concept.summary,
      body: `${concept.term} ${concept.summary} ${concept.courses.join(' ')}`,
      kind: 'Concept',
      keywords: concept.courses,
      href: `/#/concept/${concept.id}`,
    })
  }

  for (const edge of LEARNING_PATH.edges) {
    const from = LEARNING_PATH.courses.find((course) => course.id === edge.from)
    const to = LEARNING_PATH.courses.find((course) => course.id === edge.to)
    documents.push({
      id: `path:${edge.from}->${edge.to}`,
      title: `${from?.title ?? edge.from} → ${to?.title ?? edge.to}`,
      summary: edge.reason,
      body: `${edge.from} ${edge.to} ${edge.reason}`,
      kind: 'Path',
      href: `/#/path/${edge.from}`,
    })
  }

  return documents
}

/** The default weights: a course title matters more than a source mention. */
export const CATALOGUE_SEARCH_OPTIONS: SearchOptions = {
  limit: 30,
  titleWeight: 3,
  summaryWeight: 2,
  keywordWeight: 1.5,
  kindWeights: { Course: 1.4, Concept: 1.1, Source: 1, Path: 0.8 },
}

/** Search the collection. */
export function searchCatalogue(
  documents: CatalogueDocument[],
  query: string,
  options: Partial<SearchOptions> = {},
): SearchHit[] {
  return search(documents, query, { ...CATALOGUE_SEARCH_OPTIONS, ...options })
}

/**
 * The documents of the *rest* of the collection, for a course's own search.
 *
 * A learner in one course should be able to type a word and find the lesson
 * that teaches it, the course it is in, the source it is written from, or
 * the idea it is an instance of.
 *
 * The lessons of the other courses come from the collected lesson index, which
 * is built at build time from the courses themselves, so they cannot drift
 * from the courses they describe.
 *
 * The `base` is the relative path back to the hub.
 */
export function collectionDocuments(
  manifest: CatalogueManifest,
  currentAppId: string,
  hubBase = '../hub/',
  siblingBase = '../',
): CatalogueDocument[] {
  const documents = buildCatalogueIndex(manifest).filter(
    (document) => document.app !== currentAppId || document.kind !== 'Course',
  )
  return [
    ...documents.map((document) => ({
      ...document,
      href: document.href.startsWith('#/') ? `${hubBase}${document.href.slice(1)}` : document.href,
    })),
    ...buildLessonIndex(currentAppId, siblingBase),
  ]
}

/**
 * The lesson index of the collection.
 *
 * Every lesson of every course, with a link to it. The lessons of the course
 * doing the searching are left out — that course has them already, and in
 * more detail.
 */
export function buildLessonIndex(currentAppId = '', base = '../'): CatalogueDocument[] {
  const documents: CatalogueDocument[] = []
  for (const course of LESSONS.courses) {
    if (course.id === currentAppId) continue
    for (const lesson of course.lessons) {
      documents.push({
        id: `lesson:${course.id}:${lesson.id}`,
        title: lesson.title,
        summary: `${course.title} · ${lesson.subtitle}`,
        body: `${lesson.title} ${lesson.subtitle} ${lesson.body}`,
        kind: 'Lesson',
        app: course.id,
        keywords: [course.title, lesson.moduleTitle],
        href: `${base}${course.id}/#/lessons/${lesson.id}`,
      })
    }
  }
  return documents
}
