import { describe, expect, it } from 'vitest';
import { CHECKS, runDiagnostics } from '../src/lib/diagnostics';
import { CONCEPTS, PRINCIPLES, conceptsByPrinciple } from '../src/content/concepts';
import { LESSONS } from '../src/content/lessons';
import { EQUATION_BY_ID } from '../src/content/equations';

/**
 * The self-test and the theory atlas.
 *
 * The self-test is the same set of checks the reader can run in their own
 * browser, so it is held to the same standard: every check must pass, here and
 * there.
 */

describe('the self-test', () => {
  it('has a coherent set of checks', () => {
    expect(CHECKS.length).toBeGreaterThanOrEqual(10);
    const ids = CHECKS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CHECKS) {
      expect(c.name.length, c.id).toBeGreaterThan(3);
      expect(c.claim.length, c.id).toBeGreaterThan(20);
    }
  });

  it('passes every check', () => {
    const results = runDiagnostics();
    for (const r of results) {
      expect(r.error, `${r.name}: ${r.error ?? ''}`).toBeUndefined();
      expect(r.passed, `${r.name}: measured ${r.measured}, expected ${r.expected} (tolerance ${r.tolerance})`).toBe(true);
    }
  });

  it('records how long each check took', () => {
    const results = runDiagnostics();
    for (const r of results) {
      expect(r.durationMs).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(r.durationMs)).toBe(true);
    }
  });
});

describe('the theory atlas', () => {
  it('organises the concepts under the principles, with no orphans', () => {
    const principleIds = new Set(PRINCIPLES.map((p) => p.id));
    for (const c of CONCEPTS) {
      expect(principleIds.has(c.principle), `${c.id} has principle ${c.principle}`).toBe(true);
    }
    // every principle has at least one concept
    for (const p of PRINCIPLES) {
      expect(conceptsByPrinciple(p.id).length, p.id).toBeGreaterThan(0);
    }
  });

  it('gives every concept a unique id, a statement, a reference and a status', () => {
    const ids = CONCEPTS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const c of CONCEPTS) {
      expect(c.name.length, c.id).toBeGreaterThan(2);
      expect(c.statement.length, c.id).toBeGreaterThan(30);
      expect(c.ref.length, c.id).toBeGreaterThan(0);
      expect(['computed', 'cited'], c.id).toContain(c.status);
      expect(c.implemented.length, c.id).toBeGreaterThan(30);
      expect(c.see.length, c.id).toBeGreaterThan(0);
    }
  });

  it('points only at routes that exist', () => {
    const lessonIds = new Set(LESSONS.map((l) => l.id));
    for (const c of CONCEPTS) {
      for (const s of c.see) {
        expect(s.to.startsWith('/'), `${c.id} -> ${s.to}`).toBe(true);
        if (s.to.startsWith('/lessons/')) {
          const id = s.to.split('/').pop()!;
          expect(lessonIds.has(id), `${c.id} -> ${s.to} is not a lesson`).toBe(true);
        }
        if (s.to.startsWith('/equations?eq=')) {
          const id = s.to.split('=')[1];
          expect(EQUATION_BY_ID[id], `${c.id} -> ${s.to}`).toBeDefined();
        }
        if (s.to.startsWith('/labs/')) {
          expect(['physics', 'initialization', 'landscape', 'width-depth', 'ntk', 'representation'], `${c.id} -> ${s.to}`).toContain(
            s.to.split('/')[2],
          );
        }
      }
    }
  });

  it('marks a concept as computed only when the application really computes it', () => {
    // every concept marked "computed" must link to a laboratory or a lesson
    // that carries a live figure — otherwise the tag is a claim without a place
    // to check it.
    for (const c of CONCEPTS) {
      if (c.status !== 'computed') continue;
      const live = c.see.some((s) => s.to.startsWith('/labs/') || s.to.startsWith('/lessons/'));
      expect(live, `${c.id} is marked computed but links nowhere live`).toBe(true);
    }
  });

  it('separates the concepts that came from outside the monograph', () => {
    const beyond = CONCEPTS.filter((c) => c.principle === 'beyond');
    expect(beyond.length).toBeGreaterThanOrEqual(4);
    for (const c of beyond) {
      expect(c.ref, `${c.id} must carry a reference`).toMatch(/external/);
    }
  });
});
