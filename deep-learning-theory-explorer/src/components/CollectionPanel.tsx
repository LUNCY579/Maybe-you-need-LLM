import { collectionCourses, collectionHref, coursesToReadNext, sharedConcepts } from '../content/collection';
import { Panel } from './ui';

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
  const courses = collectionCourses();
  const next = coursesToReadNext();
  const concepts = sharedConcepts();

  // A course with no neighbours is a course on its own, and the panel would
  // be saying so at length.
  if (courses.length <= 1) return null;

  // The catalogue names a course by its identifier; a reader needs its title
  // and its address.
  const byId = new Map(courses.map((course) => [course.id, course]));

  return (
    <Panel
      title="The rest of the collection"
      subtitle={`${courses.length} courses, one catalogue: what to read after this, and why.`}
    >
      <p className="text-[13.5px] leading-relaxed text-lab-200">
        This course is one of {courses.length} interactive courses in the LLM Materials collection, each built from a
        primary source and each with its own laboratories. The collection's catalogue says what to read after this,
        and why.
      </p>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <h3 className="text-[12.5px] font-semibold text-lab-100">What to read next</h3>
          {next.length === 0 ? (
            <p className="mt-2 text-[12px] text-lab-400">This course is at the end of the path, for now.</p>
          ) : (
            <ul className="mt-2 space-y-2">
              {next.map((course) => (
                <li key={course.id} className="rounded border border-lab-700 bg-lab-850/50 p-3">
                  <a
                    href={collectionHref(course.id)}
                    className="text-[12.5px] font-medium text-signal-blue no-underline hover:underline"
                  >
                    {course.title} ↗
                  </a>
                  <p className="mt-1 text-[12px] leading-relaxed text-lab-300">{course.summary}</p>
                  <p className="mt-1 text-[11.5px] text-lab-400">{course.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-[12.5px] font-semibold text-lab-100">The ideas it shares</h3>
          <p className="mt-1 text-[11.5px] text-lab-400">
            These are the ideas the collection index says this course teaches. The index is a claim about teaching
            order, not about the mathematics.
          </p>
          <ul className="mt-2 space-y-1.5">
            {concepts.map((concept) => (
              <li key={concept.id} className="rounded border border-lab-700 bg-lab-850/50 p-3">
                <p className="text-[12.5px] font-medium text-lab-100">{concept.term}</p>
                <p className="mt-1 text-[12px] leading-relaxed text-lab-300">{concept.summary}</p>
                {concept.alsoIn.length > 0 ? (
                  <p className="mt-1 text-[11.5px] text-lab-400">
                    also in{' '}
                    {concept.alsoIn.map((id, index) => (
                      <span key={id}>
                        {index > 0 && ', '}
                        <a href={collectionHref(id)} className="text-signal-blue no-underline hover:underline">
                          {byId.get(id)?.title ?? id}
                        </a>
                      </span>
                    ))}
                  </p>
                ) : (
                  <p className="mt-1 text-[11.5px] text-lab-400">taught only here</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Panel>
  );
}
