/**
 * The shared concepts, in a course.
 *
 * A course's own glossary is the reference; the collection's concept index is
 * the *cross-reference*. A learner who has met the *baseline* in one course
 * and meets it in another should be able to see that it is the same idea, and
 * this is where they see it.
 *
 * The panel is rendered on every course's glossary page, and it lists the
 * ideas the collection index says this course teaches.
 */

import { CONCEPTS } from './concepts'

export function SharedConcepts({ courseId }: { courseId: string }) {
  const concepts = CONCEPTS.filter((concept) => concept.courses.includes(courseId))
  if (concepts.length === 0) return null

  return (
    <div className="catalogue-shared-concepts">
      <h2 className="section-heading">The shared ideas</h2>
      <p className="body-text">
        These are the ideas the collection index says this course teaches, and the other courses that teach them
        too. The index is a claim about teaching order, not about the mathematics.
      </p>
      <ul className="catalogue-shared-concept-list">
        {concepts.map((concept) => (
          <li key={concept.id} className="catalogue-shared-concept">
            <span className="catalogue-shared-concept-term">{concept.term}</span>
            <span className="catalogue-shared-concept-summary">{concept.summary}</span>
            <span className="catalogue-shared-concept-courses">
              {concept.courses.length > 1
                ? `also in ${concept.courses.filter((id) => id !== courseId).join(', ')}`
                : 'taught only here'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
