import { collectionCourses, collectionHref, coursesToReadNext, sharedConcepts } from '../../content/collection'
import { Panel } from '../ui/primitives'

/**
 * The rest of the collection.
 *
 * A reader who has finished a module here has somewhere to go next, and the
 * collection knows where: its learning path says which course builds on this
 * one and why, and its concept index says which ideas are taught in more than
 * one place.
 *
 * The data comes from the collection's own catalogue. It is written into this
 * repository by `tools/readCollection.mjs`, which the build runs, so it
 * cannot fall behind the collection it describes.
 */
export function CollectionPanel() {
  const courses = collectionCourses()
  const next = coursesToReadNext()
  const concepts = sharedConcepts()

  // A course with no neighbours is a course on its own, and the panel would
  // be saying so at length.
  if (courses.length <= 1) return null

  // The catalogue names a course by its identifier; a reader needs its title
  // and its address.
  const byId = new Map(courses.map((course) => [course.id, course]))

  return (
    <Panel>
      <h2 className="font-display text-lg font-semibold text-fg">The rest of the collection</h2>
      <p className="mt-1 text-sm text-muted">
        This course is the first of {courses.length} interactive courses in the LLM Materials collection, each built
        from a primary source and each with its own laboratories. The collection's catalogue says what to read after
        this, and why.
      </p>

      <div className="mt-4 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-sm font-semibold text-fg">What to read next</h3>
          {next.length === 0 ? (
            <p className="mt-2 text-xs text-muted">This course is at the end of the path, for now.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {next.map((course) => (
                <li key={course.id} className="rounded-xl border border-line bg-panel-2/40 p-3">
                  <a
                    href={collectionHref(course.id)}
                    className="text-sm font-medium text-indigo no-underline hover:underline"
                  >
                    {course.title} ↗
                  </a>
                  <p className="mt-1 text-xs text-muted">{course.summary}</p>
                  <p className="mt-1 text-xs text-faint">{course.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="font-display text-sm font-semibold text-fg">The ideas it shares</h3>
          <p className="mt-1 text-xs text-muted">
            These are the ideas the collection index says this course teaches. The index is a claim about teaching order,
            not about the mathematics.
          </p>
          <ul className="mt-2 space-y-1.5">
            {concepts.map((concept) => (
              <li key={concept.id} className="rounded-xl border border-line bg-panel-2/40 p-3">
                <p className="text-sm font-medium text-fg">{concept.term}</p>
                <p className="mt-1 text-xs text-muted">{concept.summary}</p>
                {concept.alsoIn.length > 0 ? (
                  <p className="mt-1 text-xs text-faint">
                    also in{' '}
                    {concept.alsoIn.map((id, index) => (
                      <span key={id}>
                        {index > 0 && ', '}
                        <a href={collectionHref(id)} className="text-indigo no-underline hover:underline">
                          {byId.get(id)?.title ?? id}
                        </a>
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="mt-1 text-xs text-faint">taught only here</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  )
}
