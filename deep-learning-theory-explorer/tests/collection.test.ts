import { describe, expect, it } from 'vitest';
import {
  collectionCourses,
  collectionHref,
  coursesToReadNext,
  sharedConcepts,
  THIS_COURSE_ID,
} from '../src/content/collection';

/**
 * The collection this course belongs to.
 *
 * The data is written by `tools/readCollection.mjs`, which reads the
 * collection's own catalogue. These tests check that what was written is
 * usable, and that the course is in it.
 */

describe('the collection', () => {
  it('contains this course', () => {
    expect(collectionCourses().some((course) => course.id === THIS_COURSE_ID)).toBe(true);
  });

  it('describes a course the same way in both lists', () => {
    // The course list and the "read next" list are written from the same
    // catalogue but are separate arrays, so a change to one can leave the
    // other describing the same course differently.
    const byId = new Map(collectionCourses().map((course) => [course.id, course]));
    for (const course of coursesToReadNext()) {
      const listed = byId.get(course.id);
      expect(listed?.title, `${course.id} has a different title in each list`).toBe(course.title);
      expect(listed?.summary, `${course.id} has a different summary in each list`).toBe(course.summary);
    }
  });

  it('names every course it lists', () => {
    for (const course of collectionCourses()) {
      expect(course.id.length).toBeGreaterThan(0);
      expect(course.title.length).toBeGreaterThan(0);
      expect(course.modules.length, `${course.id} has no modules`).toBeGreaterThan(0);
      expect(course.summary.length, `${course.id} has no summary`).toBeGreaterThan(0);
    }
  });

  it('gives every course a distinct identifier', () => {
    const ids = collectionCourses().map((course) => course.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('the courses to read next', () => {
  it('are courses that exist', () => {
    const ids = collectionCourses().map((course) => course.id);
    for (const course of coursesToReadNext()) {
      expect(ids, `${course.id} is not a course in the collection`).toContain(course.id);
    }
  });

  it('are listed once each', () => {
    const ids = coursesToReadNext().map((course) => course.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('say why they come after this one', () => {
    // The reason is the whole point: "read the next course" is much less use
    // than "read it because the theory explains why the loss falls".
    for (const course of coursesToReadNext()) {
      expect(course.reason.length, `${course.id} has no reason`).toBeGreaterThan(20);
    }
  });

  it('are not this course', () => {
    for (const course of coursesToReadNext()) {
      expect(course.id).not.toBe(THIS_COURSE_ID);
    }
  });
});

describe('the shared ideas', () => {
  it('name themselves', () => {
    for (const concept of sharedConcepts()) {
      expect(concept.term.length).toBeGreaterThan(0);
      expect(concept.summary.length).toBeGreaterThan(0);
    }
  });

  it('point only at courses a reader can open', () => {
    // The panel turns each of these identifiers into a link with that course's
    // title, so an identifier with no course behind it is a broken promise: the
    // catalogue's concept index can name a course that is recorded but not
    // built, and the generator has to drop it rather than link it.
    const ids = collectionCourses().map((course) => course.id);
    for (const concept of sharedConcepts()) {
      expect(Array.isArray(concept.alsoIn)).toBe(true);
      for (const id of concept.alsoIn) {
        expect(id).not.toBe(THIS_COURSE_ID);
        expect(ids, `${concept.term} is said to be taught in ${id}, which is not in the collection`).toContain(id);
      }
    }
  });

  it('are a non-trivial part of the collection', () => {
    // If the index went empty the panel would still render, and would say
    // nothing. The catalogue is expected to carry more than one shared idea
    // that involves this course.
    expect(sharedConcepts().length).toBeGreaterThan(1);
  });
});

describe('the address of another course', () => {
  it('is relative, so that it does not depend on where the collection is served from', () => {
    // The collection is served with each course in a directory of its own, so
    // a sibling course is one directory up. An absolute address would break the
    // moment the collection was served from a sub-path.
    expect(collectionHref('scaling-lab')).toBe('../scaling-lab/');
  });
});
