/**
 * The collection's interface pieces.
 *
 * These are the components that every application in the collection can use:
 * the course list, the learning path, the concept index, and the small
 * "the rest of the collection" panel that every course can show at the
 * bottom of its overview page.
 *
 * They are deliberately plain. The point of the shared layer is that a new
 * course gets the whole collection's navigation for free, and that the
 * collection looks like one thing rather than ten.
 */

import type { ReactNode } from 'react'
import type { CatalogueApp, CatalogueManifest, CatalogueSource } from './manifest'
import { builtApps, orderedApps, sourcesOfApp } from './manifest'
import { CONCEPTS, conceptsOfCourse, sharedConcepts } from './concepts'
import { LEARNING_PATH, layersOf, nextCourses, prerequisitesOf } from './paths'
import { buildCatalogueIndex, searchCatalogue, type CatalogueDocument } from './search'

/* -------------------------------------------------------------------------- */
/* The course list                                                             */
/* -------------------------------------------------------------------------- */

export function CourseList({
  manifest,
  only = 'all',
}: {
  manifest: CatalogueManifest
  only?: 'all' | 'built' | 'planned'
}): ReactNode {
  const apps = orderedApps(manifest).filter((app) => only === 'all' || app.status === only)
  return (
    <ul className="catalogue-course-list">
      {apps.map((app) => (
        <li key={app.id} className={`catalogue-course catalogue-course-${app.status}`}>
          <a className="catalogue-course-link" href={`/${app.id}/`}>
            <span className="catalogue-course-title">{app.title}</span>
            <span className="catalogue-course-modules">{app.modules.join(' · ')}</span>
            <span className={`catalogue-badge catalogue-badge-${app.status}`}>
              {app.status === 'built' ? 'built' : 'planned'}
            </span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/* The learning path                                                           */
/* -------------------------------------------------------------------------- */

export function LearningPathView({
  completed = [],
  available = [],
  hrefBase = '/',
}: {
  completed?: string[]
  available?: string[]
  /** The prefix a link to a course needs, relative to the page showing the path. */
  hrefBase?: string
}): ReactNode {
  const layers = layersOf(LEARNING_PATH)
  const done = new Set(completed)
  const built = new Set(available)
  const next = new Set(nextCourses(LEARNING_PATH, completed, available))
  const title = (id: string) => LEARNING_PATH.courses.find((course) => course.id === id)?.title ?? id

  return (
    <div className="catalogue-path">
      {layers.map((layer, index) => (
        <div key={index} className="catalogue-path-layer">
          <h3 className="catalogue-path-level">Level {index + 1}</h3>
          <ul className="catalogue-path-courses">
            {layer.map((id) => {
              /*
                A course that is built is one a reader can open from the path
                itself; a planned course stays a name with its prerequisites.
              */
              const open = built.has(id)
              return (
                <li
                  key={id}
                  className={
                    done.has(id)
                      ? 'catalogue-path-course catalogue-path-course-done'
                      : next.has(id)
                        ? 'catalogue-path-course catalogue-path-course-next'
                        : 'catalogue-path-course'
                  }
                >
                  {open ? (
                    <a className="catalogue-path-course-title" href={`${hrefBase}${id}/`}>
                      {title(id)}
                    </a>
                  ) : (
                    <span className="catalogue-path-course-title">{title(id)}</span>
                  )}
                  <span className="catalogue-path-course-note">
                    {done.has(id)
                      ? 'finished'
                      : next.has(id)
                        ? 'ready to start'
                        : `needs ${prerequisitesOf(LEARNING_PATH, id).map(title).join(', ') || 'nothing'}`}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

/** The edges of the path, as a list a reader can follow. */
export function PathEdges(): ReactNode {
  return (
    <ul className="catalogue-edge-list">
      {LEARNING_PATH.edges.map((edge) => {
        const from = LEARNING_PATH.courses.find((course) => course.id === edge.from)?.title ?? edge.from
        const to = LEARNING_PATH.courses.find((course) => course.id === edge.to)?.title ?? edge.to
        return (
          <li key={`${edge.from}->${edge.to}`} className="catalogue-edge">
            <span className="catalogue-edge-from">{from}</span>
            <span className="catalogue-edge-arrow" aria-hidden="true">
              →
            </span>
            <span className="catalogue-edge-to">{to}</span>
            <span className="catalogue-edge-reason">{edge.reason}</span>
          </li>
        )
      })}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/* The concept index                                                           */
/* -------------------------------------------------------------------------- */

export function ConceptIndex({ sharedOnly = false, focusTerm }: { sharedOnly?: boolean; focusTerm?: string | null }): ReactNode {
  const concepts = sharedOnly ? sharedConcepts() : CONCEPTS
  const title = (id: string) => LEARNING_PATH.courses.find((course) => course.id === id)?.title ?? id
  return (
    <ul className="catalogue-concept-list">
      {concepts.map((concept) => (
        <li
          key={concept.id}
          className={
            focusTerm && concept.term === focusTerm
              ? 'catalogue-concept catalogue-concept-focus'
              : 'catalogue-concept'
          }
          data-concept-term={concept.term}
        >
          <span className="catalogue-concept-term">{concept.term}</span>
          <span className="catalogue-concept-summary">{concept.summary}</span>
          <span className="catalogue-concept-courses">{concept.courses.map(title).join(' · ')}</span>
        </li>
      ))}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/* The source list                                                             */
/* -------------------------------------------------------------------------- */

export function SourceList({
  manifest,
  app,
  limit,
}: {
  manifest: CatalogueManifest
  app?: string
  limit?: number
}): ReactNode {
  const sources = app
    ? sourcesOfApp(manifest, app)
    : manifest.sources.filter((source) => source.role === 'primary')
  const shown = limit ? sources.slice(0, limit) : sources
  return (
    <ul className="catalogue-source-list">
      {shown.map((source) => (
        <li key={source.id} className="catalogue-source">
          <a href={source.url} rel="noreferrer" className="catalogue-source-title">
            {source.title}
          </a>
          <span className="catalogue-source-venue">
            {source.authors.join(', ')} · {source.year} · {source.venue}
          </span>
          <span className="catalogue-source-licence">{source.license}</span>
        </li>
      ))}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/* The search                                                                 */
/* -------------------------------------------------------------------------- */

export function CatalogueSearch({
  manifest,
  query,
  limit = 20,
  onOpen,
}: {
  manifest: CatalogueManifest
  query: string
  limit?: number
  /**
   * Called when a hit is opened. The component's own hrefs are only meaningful
   * where a router understands them; a page that shows the hits itself should
   * take the hit over and decide what opening it means.
   */
  onOpen?: (document: CatalogueDocument) => void
}): ReactNode {
  const documents: CatalogueDocument[] = buildCatalogueIndex(manifest)
  const hits = query.trim().length === 0 ? [] : searchCatalogue(documents, query, { limit })
  if (hits.length === 0) {
    return <p className="muted">Nothing matched that.</p>
  }
  return (
    <ul className="catalogue-search-results">
      {hits.map((hit) => (
        <li key={hit.document.id} className="catalogue-search-hit">
          <span className="catalogue-search-kind">{hit.document.kind}</span>
          <a
            href={hit.document.href}
            className="catalogue-search-title"
            onClick={
              onOpen
                ? (event) => {
                    event.preventDefault()
                    // The index built above is the source of these hits, so the
                    // document carries the catalogue's kind and app with it.
                    onOpen(hit.document as CatalogueDocument)
                  }
                : undefined
            }
          >
            {hit.document.title}
          </a>
          <span className="catalogue-search-summary">{hit.document.summary}</span>
        </li>
      ))}
    </ul>
  )
}

/* -------------------------------------------------------------------------- */
/* The panel a course can show at the bottom of its overview                   */
/* -------------------------------------------------------------------------- */

export function CollectionLinks({
  manifest,
  currentAppId,
  limit = 6,
}: {
  manifest: CatalogueManifest
  currentAppId: string
  limit?: number
}): ReactNode {
  const built = builtApps(manifest)
  const builtIds = new Set(built.map((app) => app.id))
  const titleById = new Map(built.map((app) => [app.id, app.title]))
  const others = built.filter((app) => app.id !== currentAppId).slice(0, limit)
  const concepts = conceptsOfCourse(currentAppId).slice(0, 6)
  /*
    The successors come with the reason the catalogue gives for the order.
    The reason is the point of the list: "read the next course" is much less
    use than "read it because the theory explains why the loss falls".
  */
  const next = LEARNING_PATH.edges
    .filter((edge) => edge.from === currentAppId && builtIds.has(edge.to))
    .map((edge) => ({
      course: LEARNING_PATH.courses.find((course) => course.id === edge.to),
      reason: edge.reason,
    }))
    .filter((entry) => entry.course)

  return (
    <div className="catalogue-links">
      <div className="catalogue-links-column">
        <h3 className="catalogue-links-heading">The rest of the collection</h3>
        <ul className="catalogue-links-list">
          {others.map((app: CatalogueApp & { sources: number }) => (
            <li key={app.id}>
              <a href={`/${app.id}/`}>{app.title}</a>
              <span className="catalogue-links-note">
                {app.modules.length} modules · {app.sources} sources
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="catalogue-links-column">
        <h3 className="catalogue-links-heading">What to read next</h3>
        {next.length > 0 ? (
          <ul className="catalogue-links-list">
            {next.map(({ course, reason }) => (
              <li key={course!.id}>
                <a href={`/${course!.id}/`}>{course!.title}</a>
                <span className="catalogue-links-note">{course!.summary}</span>
                <span className="catalogue-links-note">{reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">This course is at the end of the path, for now.</p>
        )}
        {/*
          These are the ideas this course teaches, not the ones it assumes.
          The index can name a course that is recorded but not built, so the
          links are filtered to courses a reader can open.
        */}
        <h3 className="catalogue-links-heading">The ideas it shares</h3>
        <ul className="catalogue-links-list">
          {concepts.map((concept) => {
            const alsoIn = concept.courses.filter((id) => id !== currentAppId && builtIds.has(id))
            return (
              <li key={concept.id}>
                <span className="catalogue-links-term">{concept.term}</span>
                <span className="catalogue-links-note">{concept.summary}</span>
                {alsoIn.length > 0 ? (
                  <span className="catalogue-links-note">
                    also in{' '}
                    {alsoIn.map((id, index) => (
                      <span key={id}>
                        {index > 0 && ', '}
                        <a href={`/${id}/`}>{titleById.get(id) ?? id}</a>
                      </span>
                    ))}
                  </span>
                ) : null}
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}

/** The sources of a course, in the shape the collection pages use. */
export function courseSources(manifest: CatalogueManifest, appId: string): CatalogueSource[] {
  return sourcesOfApp(manifest, appId)
}
