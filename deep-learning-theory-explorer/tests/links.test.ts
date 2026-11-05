import { describe, expect, it } from 'vitest';
import { CONCEPTS } from '../src/content/concepts';
import { LABS } from '../src/content/labs';
import { LESSONS } from '../src/content/lessons';
import { EQUATIONS } from '../src/content/equations';
import { TERMS } from '../src/lib/terminology';
import { READING } from '../src/content/reading';

/**
 * Every link in the content points somewhere.
 *
 * The connective tissue is built from strings: `/lessons/${id}`, `/labs/${id}`,
 * `/equations?eq=${id}`. A typo in one of those is a link that goes nowhere,
 * and nothing on the screen says so — the reader simply arrives at a page that
 * is not what the link promised. The targets are therefore checked against
 * the things they name.
 */

const LESSON_IDS = new Set(LESSONS.map((l) => l.id));

/** the laboratories the application actually serves, from the registry */
const LAB_IDS = new Set(LABS.map((l) => l.route.replace('/labs/', '')));

const EQUATION_IDS = new Set(EQUATIONS.map((e) => e.id));

/** Check one internal target. */
function checkTarget(to: string, where: string) {
  const lesson = /^\/lessons\/([a-z0-9-]+)$/.exec(to);
  if (lesson) {
    expect(LESSON_IDS.has(lesson[1]), `${where}: "${to}" names no lesson`).toBe(true);
    return;
  }
  const lab = /^\/labs\/([a-z-]+)$/.exec(to);
  if (lab) {
    expect(LAB_IDS.has(lab[1]), `${where}: "${to}" names no laboratory`).toBe(true);
    return;
  }
  const equation = /^\/equations\?eq=([a-z0-9-]+)$/.exec(to);
  if (equation) {
    expect(EQUATION_IDS.has(equation[1]), `${where}: "${to}" names no equation`).toBe(true);
    return;
  }
  // anything else must be one of the screens the application serves
  const known = ['/', '/prerequisites', '/lessons', '/gallery', '/equations', '/quiz', '/dashboard', '/sources', '/atlas', '/reading', '/diagnostics'];
  expect(known, `${where}: "${to}" is not a screen of this application`).toContain(to);
}

describe('the links in the content', () => {
  it('every atlas concept points at something that exists', () => {
    for (const concept of CONCEPTS) {
      for (const see of concept.see) {
        checkTarget(see.to, `the concept "${concept.name}"`);
      }
    }
  });

  it('every lesson points at a laboratory that exists', () => {
    for (const lesson of LESSONS) {
      if (lesson.experiment) {
        const lab = /^\/labs\/([a-z-]+)$/.exec(lesson.experiment.route);
        expect(lab, `the lesson "${lesson.title}" points at "${lesson.experiment.route}"`).not.toBeNull();
        expect(LAB_IDS.has(lab![1]), `the lesson "${lesson.title}" points at an unknown laboratory`).toBe(true);
      }
      for (const other of lesson.alsoExperiments ?? []) {
        const lab = /^\/labs\/([a-z-]+)$/.exec(other.route);
        expect(lab, `the lesson "${lesson.title}" points at "${other.route}"`).not.toBeNull();
        expect(LAB_IDS.has(lab![1]), `the lesson "${lesson.title}" points at an unknown laboratory`).toBe(true);
      }
    }
  });

  it('every term that names an equation names one that exists', () => {
    for (const term of TERMS) {
      if (!term.equationId) continue;
      expect(EQUATION_IDS.has(term.equationId), `the term "${term.name}" points at no equation`).toBe(true);
    }
  });

  it('every reading entry points at the places its idea appears here', () => {
    for (const entry of READING) {
      expect(entry.see.length, `the reading entry "${entry.id}" points at nothing`).toBeGreaterThan(0);
      for (const see of entry.see) {
        checkTarget(see.to, `the reading entry "${entry.id}"`);
      }
    }
  });
});
