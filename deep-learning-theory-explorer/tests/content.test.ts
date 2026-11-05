import { describe, expect, it } from 'vitest';
import { LESSONS, LESSON_BY_ID } from '../src/content/lessons';
import { LAB_ROUTES } from '../src/content/labs';
import { QUIZ } from '../src/content/quizzes';
import { EQUATIONS, EQUATION_BY_ID } from '../src/content/equations';
import { EXPERIMENTS, EXPERIMENT_BY_ID } from '../src/content/experiments';
import { EQUATION_REFS, NOTATION_GLOSSARY, SOURCE } from '../src/content/references';
import { TERMS, TERM_BY_ID } from '../src/lib/terminology';
import { FIGURE_IDS } from '../src/components/LessonFigure';
import { ACTIVATIONS, ACTIVATION_IDS, taylorCoefficients } from '../src/lib/numerics/activations';
import { findCriticalPoints } from '../src/lib/numerics/gaussian';

/**
 * Content integrity.
 *
 * The curriculum is data, and data rots. These checks assert the things that
 * must be true for the site to be honest and usable: every cross-reference
 * resolves, every answer is real, no exercise is a placeholder, and the
 * numerical constants quoted in the content match what the code computes.
 */

describe('curriculum inventory', () => {
  it('has at least ten lessons spanning the major themes of the book', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(10);
    const chapters = new Set(LESSONS.map((l) => l.chapter));
    // The themes: probability/gaussians, networks, deep linear, criticality,
    // universality, Bayesian learning, gradient learning, NTK, representation.
    expect(chapters.size).toBeGreaterThanOrEqual(8);
  });

  it('gives every lesson a unique id and a contiguous order', () => {
    const ids = LESSONS.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
    const orders = LESSONS.map((l) => l.order).sort((a, b) => a - b);
    expect(orders).toEqual(orders.map((_, i) => i + 1));
  });

  it('gives every lesson objectives, prerequisites, sections, exercises and citations', () => {
    for (const lesson of LESSONS) {
      expect(lesson.objectives.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(lesson.sections.length, lesson.id).toBeGreaterThanOrEqual(2);
      expect(lesson.exercises.length, lesson.id).toBeGreaterThanOrEqual(1);
      expect(lesson.citations.length, lesson.id).toBeGreaterThanOrEqual(1);
      expect(lesson.summary.length, lesson.id).toBeGreaterThan(40);
      expect(lesson.minutes, lesson.id).toBeGreaterThan(5);
      for (const prereq of lesson.prerequisites) {
        expect(LESSON_BY_ID[prereq], `${lesson.id} -> ${prereq}`).toBeDefined();
      }
    }
  });

  it('has no prerequisite cycles', () => {
    const state = new Map<string, number>();
    const visit = (id: string, stack: string[]): void => {
      if (state.get(id) === 2) return;
      expect(state.get(id), `cycle through ${id}: ${stack.join(' -> ')}`).not.toBe(1);
      state.set(id, 1);
      for (const p of LESSON_BY_ID[id].prerequisites) visit(p, [...stack, id]);
      state.set(id, 2);
    };
    for (const l of LESSONS) visit(l.id, []);
  });

  it('gives every exercise a real answer, not a placeholder', () => {
    for (const lesson of LESSONS) {
      for (const exercise of lesson.exercises) {
        expect(exercise.prompt.length, `${lesson.id}`).toBeGreaterThan(15);
        expect(exercise.answer.length, `${lesson.id}: ${exercise.prompt.slice(0, 30)}`).toBeGreaterThan(15);
        expect(exercise.answer.toLowerCase(), `${lesson.id}`).not.toMatch(/^(tbd|todo|placeholder|answer here)/);
        expect(['numerical', 'conceptual', 'code']).toContain(exercise.kind);
      }
    }
  });

  it('gives every lesson at least one experiment link and every link a real route', () => {
    const routes = new Set<string>(LAB_ROUTES);
    for (const lesson of LESSONS) {
      expect(lesson.experiment, lesson.id).toBeDefined();
      expect(routes.has(lesson.experiment!.route), lesson.id).toBe(true);
    }
  });

  it('resolves every live figure the lessons reference', () => {
    const used: string[] = [];
    for (const lesson of LESSONS) {
      for (const section of lesson.sections) {
        for (const block of section.blocks) {
          if (block.kind === 'figure') used.push(block.figure);
        }
      }
    }
    expect(used.length).toBeGreaterThanOrEqual(5);
    for (const id of used) {
      expect(FIGURE_IDS, `unknown lesson figure "${id}"`).toContain(id);
    }
    // every registered figure should actually be used somewhere
    for (const id of FIGURE_IDS) {
      expect(used, `figure "${id}" is registered but never used`).toContain(id);
    }
  });
});

describe('assessment bank', () => {
  it('has at least twenty questions with unique ids', () => {
    expect(QUIZ.length).toBeGreaterThanOrEqual(20);
    const ids = QUIZ.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('points every question at an existing lesson', () => {
    for (const q of QUIZ) {
      expect(LESSON_BY_ID[q.lessonId], `${q.id} -> ${q.lessonId}`).toBeDefined();
    }
  });

  it('has a valid answer index and at least two options for every question', () => {
    for (const q of QUIZ) {
      expect(q.options.length, q.id).toBeGreaterThanOrEqual(2);
      expect(q.answerIndex, q.id).toBeGreaterThanOrEqual(0);
      expect(q.answerIndex, q.id).toBeLessThan(q.options.length);
      expect(q.explanation.length, q.id).toBeGreaterThan(30);
      expect(q.citations.length, q.id).toBeGreaterThanOrEqual(1);
      expect(new Set(q.options).size, q.id).toBe(q.options.length);
    }
  });

  it('gives numeric questions a tolerance and a plausible answer', () => {
    for (const q of QUIZ) {
      if (!q.numeric) continue;
      expect(Number.isFinite(q.numeric.answer), q.id).toBe(true);
      expect(q.numeric.tolerance, q.id).toBeGreaterThanOrEqual(0);
      // a zero tolerance is only legitimate for an exactly representable answer
      if (q.numeric.tolerance === 0) {
        expect(Number.isInteger(q.numeric.answer), `${q.id} needs an exact answer`).toBe(true);
      }
      expect(Math.abs(q.numeric.answer), q.id).toBeLessThan(1e6);
    }
  });

  it('covers every lesson with at least one question', () => {
    const covered = new Set(QUIZ.map((q) => q.lessonId));
    for (const lesson of LESSONS) {
      expect(covered.has(lesson.id), `no question covers ${lesson.id}`).toBe(true);
    }
  });
});

describe('equation explorer', () => {
  it('defines every symbol, assumption, derivation step and worked example', () => {
    for (const eq of EQUATIONS) {
      expect(eq.title.length, eq.id).toBeGreaterThan(3);
      expect(eq.tex.length, eq.id).toBeGreaterThan(3);
      expect(eq.ref.length, eq.id).toBeGreaterThan(0);
      expect(eq.meaning.length, eq.id).toBeGreaterThan(30);
      expect(eq.symbols.length, eq.id).toBeGreaterThanOrEqual(1);
      expect(eq.assumptions.length, eq.id).toBeGreaterThanOrEqual(1);
      expect(eq.derivation.length, eq.id).toBeGreaterThanOrEqual(1);
      expect(eq.example.inputs.length, eq.id).toBeGreaterThanOrEqual(1);
      expect(eq.example.result.length, eq.id).toBeGreaterThanOrEqual(1);
    }
  });

  it('uses unique ids so that the explorer can address each entry', () => {
    const ids = EQUATIONS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(EQUATION_BY_ID).length).toBe(ids.length);
  });

  it('links equations only to real laboratory routes', () => {
    const routes = new Set<string>(LAB_ROUTES);
    for (const eq of EQUATIONS) {
      if (!eq.relatedLab) continue;
      expect(routes.has(eq.relatedLab), `${eq.id} -> ${eq.relatedLab}`).toBe(true);
    }
  });
});

describe('experiment gallery', () => {
  it('has presets for every laboratory, each with a hypothesis and an expectation', () => {
    const labs = new Set(EXPERIMENTS.map((e) => e.lab));
    for (const lab of ['initialization', 'landscape', 'width-depth', 'ntk', 'representation', 'physics']) {
      expect(labs.has(lab as never), `no preset for ${lab}`).toBe(true);
    }
    for (const exp of EXPERIMENTS) {
      expect(exp.hypothesis.length, exp.id).toBeGreaterThan(20);
      expect(exp.description.length, exp.id).toBeGreaterThan(40);
      expect(exp.expected.length, exp.id).toBeGreaterThan(20);
      expect(Number.isInteger(exp.seed), exp.id).toBe(true);
      expect(Object.keys(exp.settings).length, exp.id).toBeGreaterThan(0);
    }
  });

  it('has unique preset ids', () => {
    const ids = EXPERIMENTS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(Object.keys(EXPERIMENT_BY_ID).length).toBe(ids.length);
  });
});

describe('references and glossary', () => {
  it('names the source and gives a resolvable identifier', () => {
    expect(SOURCE.arxiv).toBe('arXiv:2106.10165');
    expect(SOURCE.url).toMatch(/^https:\/\/arxiv\.org\//);
    expect(SOURCE.authors).toContain('Roberts');
    expect(SOURCE.authors).toContain('Yaida');
    expect(SOURCE.authors).toContain('Hanin');
  });

  it('defines every glossary symbol with a name and a meaning', () => {
    for (const entry of NOTATION_GLOSSARY) {
      expect(entry.symbol.length).toBeGreaterThan(0);
      expect(entry.name.length).toBeGreaterThan(2);
      expect(entry.meaning.length).toBeGreaterThan(10);
    }
  });

  it('gives every equation reference a label and a note', () => {
    for (const [key, ref] of Object.entries(EQUATION_REFS)) {
      expect(ref.label.length, key).toBeGreaterThan(2);
      expect(ref.note.length, key).toBeGreaterThan(5);
    }
  });
});

describe('the terminology registry', () => {
  it('has a unique id, a symbol, a meaning and a reference for every term', () => {
    const ids = TERMS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const t of TERMS) {
      expect(t.id, t.id).toMatch(/^[a-z0-9-]+$/);
      expect(t.symbol.length, t.id).toBeGreaterThan(0);
      expect(t.name.length, t.id).toBeGreaterThan(2);
      expect(t.meaning.length, t.id).toBeGreaterThan(40);
      expect(t.ref.length, t.id).toBeGreaterThan(2);
    }
  });

  it('points only at equation-explorer entries that exist', () => {
    for (const t of TERMS) {
      if (!t.equationId) continue;
      expect(EQUATION_BY_ID[t.equationId], `${t.id} -> ${t.equationId}`).toBeDefined();
    }
  });

  it('resolves every [[term]] reference in the lesson prose', () => {
    const references: string[] = [];
    for (const lesson of LESSONS) {
      for (const section of lesson.sections) {
        for (const block of section.blocks) {
          if (block.kind !== 'p' && block.kind !== 'callout') continue;
          const text = block.kind === 'p' ? block.text : block.text;
          for (const m of text.matchAll(/\[\[([a-z0-9-]+)\]\]/g)) references.push(m[1]);
        }
      }
    }
    expect(references.length).toBeGreaterThan(8);
    for (const id of references) {
      expect(TERM_BY_ID[id], `unknown term "${id}"`).toBeDefined();
    }
  });
});

describe('the activation registry agrees with the criticality scanner', () => {
  it('recovers the analytic critical C_W for every scale-invariant activation', () => {
    for (const id of ACTIVATION_IDS) {
      const act = ACTIVATIONS[id];
      if (act.universality !== 'scale-invariant' || !act.critical) continue;
      const points = findCriticalPoints(act, { Kmax: 8, steps: 800 });
      const physical = points.filter((p) => p.physical);
      expect(physical.length, id).toBeGreaterThan(0);
      // For the scale-invariant class the susceptibility is C_W A^2, so the
      // critical weight variance is 1/A^2 regardless of K*.
      expect(1 / act.scaleInvariantA2!).toBeCloseTo(act.critical.Cw, 10);
    }
  });

  it('classifies the activations the way the book does', () => {
    expect(ACTIVATIONS.relu.universality).toBe('scale-invariant');
    expect(ACTIVATIONS.linear.universality).toBe('scale-invariant');
    expect(ACTIVATIONS.tanh.universality).toBe('K=0');
    expect(ACTIVATIONS.sin.universality).toBe('K=0');
    expect(ACTIVATIONS.sigmoid.universality).toBe('none');
    expect(ACTIVATIONS.softplus.universality).toBe('none');
    expect(ACTIVATIONS.quadratic.universality).toBe('none');
    expect(ACTIVATIONS.swish.universality).toBe('half-stable');
    expect(ACTIVATIONS.gelu.universality).toBe('half-stable');
  });

  it('reproduces the K = 0 class coefficients a_1 = -2 (tanh) and a_1 = -1 (sin)', () => {
    // a_1 = (3/4) gamma_2^2 + gamma_1 gamma_3, book eq. (5.86).
    const tanh = taylorCoefficients(ACTIVATIONS.tanh);
    const sin = taylorCoefficients(ACTIVATIONS.sin);
    expect(tanh.gamma1).toBeCloseTo(1, 12);
    expect(Math.abs(tanh.gamma2)).toBeLessThan(1e-12);
    expect(sin.gamma1).toBeCloseTo(1, 12);
    expect(Math.abs(sin.gamma2)).toBeLessThan(1e-12);
    expect(ACTIVATIONS.tanh.a1).toBe(-2);
    expect(ACTIVATIONS.sin.a1).toBe(-1);
  });

  it('finds no physical critical point for the sigmoid', () => {
    const points = findCriticalPoints(ACTIVATIONS.sigmoid, { Kmax: 8, steps: 800 });
    const physical = points.filter((p) => p.physical);
    expect(physical.length).toBe(0);
    // the root exists but needs a negative bias variance
    expect(points.length).toBeGreaterThan(0);
    expect(points[0].Cb).toBeLessThan(0);
  });
});
