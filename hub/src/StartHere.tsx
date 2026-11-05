/**
 * What to do next.
 *
 * The hub already shows every course and every source, and it shows what the
 * learner has finished. This panel answers the question that comes before
 * either: given what this browser knows, where should the next hour go?
 *
 * The answer comes from the learning path, not from a hand-written list. A
 * course the learner has begun is offered first, because finishing something
 * beats starting something; otherwise the path's starting course is offered.
 */

import type { CatalogueManifest } from '@llm-materials/course-catalogue'
import { LEARNING_PATH, nextCourses, startingCourses } from '@llm-materials/course-catalogue'
import { useCollectionProgress } from './Progress'

export function StartHere({ manifest }: { manifest: CatalogueManifest }) {
  const rows = useCollectionProgress(manifest)
  const built = manifest.apps.filter((app) => app.status === 'built')
  const builtIds = built.map((app) => app.id)
  const titles = new Map(built.map((app) => [app.id, app.title]))

  const begun = rows
    .filter((row) => builtIds.includes(row.id) && (row.completed > 0 || row.knownTerms > 0))
    .sort((a, b) => b.completed - a.completed)

  const inProgress = begun[0]
  const startId = inProgress?.id ?? startingCourses(LEARNING_PATH, builtIds)[0]
  const nextId = nextCourses(
    LEARNING_PATH,
    begun.map((row) => row.id),
    builtIds,
  ).find((id) => id !== startId)

  if (!startId) return null

  const target = titles.get(startId) ?? startId
  const next = nextId ? (titles.get(nextId) ?? nextId) : undefined

  return (
    <section className="hub-start" aria-labelledby="hub-start-title">
      <div className="hub-start-copy">
        <p className="hub-start-kicker">Start here</p>
        <h3 id="hub-start-title" className="hub-start-title">
          {inProgress ? 'Pick up where you left off' : `Begin with ${target}`}
        </h3>
        <p className="hub-start-note">
          {inProgress ? (
            <>
              <strong>{target}</strong> has {inProgress.completed} lesson
              {inProgress.completed === 1 ? '' : 's'} complete
              {inProgress.knownTerms > 0 ? ` and ${inProgress.knownTerms} terms marked as known` : ''} in this browser.
              Everything stays here.
            </>
          ) : (
            <>
              Nothing on the learning path comes before <strong>{target}</strong>, so it is the cheapest place to
              start. Every lesson ends at a laboratory that runs in this browser.
            </>
          )}
        </p>
        {next ? (
          <p className="hub-start-note">
            The path then leads to <strong>{next}</strong>.
          </p>
        ) : null}
      </div>
      <div className="hub-start-actions">
        <a className="hub-start-button" href={`../${startId}/`}>
          {inProgress ? 'Continue' : 'Start'} {target} <span aria-hidden="true">→</span>
        </a>
        <a className="hub-start-secondary" href="#path">
          See the whole path
        </a>
      </div>
    </section>
  )
}
