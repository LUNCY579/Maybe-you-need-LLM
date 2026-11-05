import { COLLECTION_COURSES, COLLECTION_NEXT, COLLECTION_SHARED_CONCEPTS } from './collection.generated'

/**
 * The collection this course belongs to.
 *
 * The course is one of the collection's built courses — the catalogue says how
 * many, and the landing page prints that number rather than a copy of it —
 * each built from a primary source and each with its own laboratories. The
 * collection's catalogue says which course builds on this one and why, and
 * which ideas are taught in more than one place.
 *
 * A reader who has just finished a module here has somewhere to go next, and
 * it is not this course's business to be the only thing they can read. So the
 * landing page says what is next and why.
 *
 * The data comes from the collection and is written into
 * `collection.generated.ts` by `tools/readCollection.mjs`, which the build
 * runs. It is not written by hand here, because a hand-written copy of the
 * collection's catalogue is a copy that goes out of date the moment a course
 * is added.
 */

/** The identifier of this course within the collection. */
export const THIS_COURSE_ID = 'llm-foundations-lab'

/**
 * Where the collection's other courses live, relative to this one.
 *
 * The collection is served with each course in a directory of its own, so a
 * sibling course is one directory up. The prefix is configurable because the
 * course is also useful on its own: a reader who has only this course should
 * still be able to read it.
 */
const COLLECTION_BASE = import.meta.env.VITE_COLLECTION_BASE ?? '../'

/** The address of another course in the collection. */
export function collectionHref(courseId: string): string {
  return `${COLLECTION_BASE}${courseId}/`
}

/** The courses in the collection, this one first. */
export function collectionCourses() {
  return COLLECTION_COURSES
}

/** The courses that build on this one, and why they come after it. */
export function coursesToReadNext() {
  return COLLECTION_NEXT
}

/**
 * The ideas the collection teaches in more than one place.
 *
 * The first of those places is this course. A reader who has met the idea
 * here and meets it again in another course should be able to see that it is
 * the same idea.
 */
export function sharedConcepts() {
  return COLLECTION_SHARED_CONCEPTS
}
