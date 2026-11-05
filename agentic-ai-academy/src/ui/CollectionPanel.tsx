import { collectionCourses, collectionHref, coursesToReadNext, sharedConcepts } from '../content/collection'
import { Panel } from './primitives'

/**
 * The rest of the collection.
 *
 * A reader who has finished a lesson here has somewhere to go next, and the
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

  return (
    <Panel
      title="The rest of the collection"
      subtitle={`${courses.length} courses, one catalogue: what to read after this, and why.`}
      className="space-y-3"
    >
      <div>
        <p className="text-muted text-sm leading-relaxed">
          This course is one of {courses.length} interactive courses in the LLM Materials collection, each built from a
          primary source and each with its own laboratories. The collection&rsquo;s catalogue says what to read after
          this, and why.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div>
          <h4 className="text-muted text-xs font-semibold tracking-wide uppercase">What to read next</h4>
          {next.length === 0 ? (
            <p className="text-muted mt-2 text-xs">The catalogue puts no course after this one yet.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {next.map((course) => (
                <li key={course.id} className="surface rounded-xl border p-3">
                  <a className="focus-ring text-sm font-medium underline" href={collectionHref(course.id)}>
                    {course.title} ↗
                  </a>
                  <p className="text-muted mt-1 text-xs leading-relaxed">{course.summary}</p>
                  <p className="text-muted mt-1 text-xs">{course.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="text-muted text-xs font-semibold tracking-wide uppercase">The ideas it shares</h4>
          <p className="text-muted mt-1 text-xs">
            These are the ideas the collection index says this course teaches. The index is a claim about teaching
            order, not about the mathematics.
          </p>
          <ul className="mt-2 space-y-1.5">
            {concepts.map((concept) => (
              <li key={concept.id} className="surface rounded-xl border p-3">
                <p className="text-sm font-medium">{concept.term}</p>
                <p className="text-muted mt-1 text-xs leading-relaxed">{concept.summary}</p>
                {concept.alsoIn.length > 0 ? (
                  <p className="text-muted mt-1 text-xs">
                    also in{' '}
                    {concept.alsoIn.map((id, index) => (
                      <span key={id}>
                        {index > 0 && ', '}
                        <a className="focus-ring underline" href={collectionHref(id)}>
                          {courses.find((course) => course.id === id)?.title ?? id}
                        </a>
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="text-muted mt-1 text-xs">taught only here</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  )
}
