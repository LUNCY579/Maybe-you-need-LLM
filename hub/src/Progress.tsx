/**
 * The learner's progress across the collection.
 *
 * Each course keeps its own progress record in the browser, under a key named
 * after the course. The hub reads all of them and shows the one thing a
 * reader of a collection wants: what they have done, and what to do next.
 *
 * Nothing leaves the browser: the hub reads the same local storage the
 * courses write, and nothing else.
 */

import { useEffect, useMemo, useState } from 'react'
import type { CatalogueManifest } from '@llm-materials/course-catalogue'
import { nextCourses, LEARNING_PATH } from '@llm-materials/course-catalogue'

export interface CourseProgress {
  id: string
  title: string
  /** The lessons the learner has marked complete. */
  completed: number
  /** The glossary terms they have marked as known. */
  knownTerms: number
}

/** The progress key of a course. */
export function progressKey(appId: string): string {
  return `${appId}:progress`
}

/**
 * Read one course's progress record.
 *
 * The stored shape is a versioned envelope, and the shape of the record
 * inside it is not this package's business — only the two counts are.
 */
export function readCourseProgress(appId: string): CourseProgress | null {
  try {
    const raw = window.localStorage.getItem(progressKey(appId))
    if (!raw) return null
    const parsed = JSON.parse(raw) as { version?: number; data?: unknown }
    const data = parsed?.data
    if (!data || typeof data !== 'object') return null
    const lessons = (data as { lessons?: Record<string, unknown> }).lessons ?? {}
    const known = (data as { knownTerms?: unknown[] }).knownTerms
    return {
      id: appId,
      title: appId,
      completed: Object.values(lessons).filter(
        (entry) => (entry as { complete?: boolean })?.complete === true,
      ).length,
      knownTerms: Array.isArray(known) ? known.length : 0,
    }
  } catch {
    return null
  }
}

/**
 * Read the progress of every course in the collection.
 *
 * The hook re-reads it on a storage event and on focus, so a learner who
 * finishes a lesson in another tab and comes back sees the hub update.
 */
export function readCollectionProgress(manifest: CatalogueManifest): CourseProgress[] {
  const rows: CourseProgress[] = []
  for (const app of manifest.apps) {
    if (app.status !== 'built') continue
    const progress = readCourseProgress(app.id)
    if (!progress) continue
    rows.push({ ...progress, title: app.title })
  }
  return rows
}

export function useCollectionProgress(manifest: CatalogueManifest): CourseProgress[] {
  const [rows, setRows] = useState<CourseProgress[]>(() => readCollectionProgress(manifest))

  useEffect(() => {
    const refresh = () => setRows(readCollectionProgress(manifest))
    refresh()
    window.addEventListener('storage', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      window.removeEventListener('storage', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [manifest])

  return rows
}

/**
 * The panel.
 *
 * It shows the courses the learner has touched, and the next course the
 * learning path recommends given what they have finished.
 */
export function CollectionProgressPanel({ manifest }: { manifest: CatalogueManifest }) {
  const rows = useCollectionProgress(manifest)

  const recommended = useMemo(() => {
    // The path is the recommendation, and the recommendation is what the
    // learner has not finished and whose prerequisites they have.
    const completed = new Set(rows.map((row) => row.id))
    const titles = new Map(manifest.apps.map((app) => [app.id, app.title]))
    return nextCourses(LEARNING_PATH, [...completed])
      .filter((id) => !completed.has(id))
      .map((id) => titles.get(id) ?? id)
  }, [rows, manifest])

  if (rows.length === 0) {
    return (
      <div className="catalogue-links-column">
        <h3 className="catalogue-links-heading">Your progress</h3>
        <p className="muted">
          Nothing yet. Each course keeps its own record in this browser, and the collection reads them all — so the
          hub can show where you are. Nothing is sent anywhere.
        </p>
      </div>
    )
  }

  return (
    <div className="catalogue-links-column">
      <h3 className="catalogue-links-heading">Your progress</h3>
      <ul className="catalogue-links-list">
        {rows.map((row) => (
          <li key={row.id}>
            <a href={`../${row.id}/`}>{row.title}</a>
            <span className="catalogue-links-note">
              {row.completed} lesson{row.completed === 1 ? '' : 's'} complete
              {row.knownTerms > 0 ? ` · ${row.knownTerms} terms marked as known` : ''}
            </span>
          </li>
        ))}
      </ul>
      {recommended.length > 0 ? (
        <p className="muted">
          The path would take you to <strong>{recommended[0]}</strong> next.
        </p>
      ) : null}
    </div>
  )
}
