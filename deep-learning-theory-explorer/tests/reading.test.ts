import { describe, expect, it } from 'vitest';
import { READING, READING_GROUPS } from '../src/content/reading';
import { CONCEPTS } from '../src/content/concepts';

/**
 * The reading list.
 *
 * Every entry is a citation a reader might follow, so the invariants are
 * strict: a real link, a year, a group, and a statement of what the paper
 * contributes and where the idea is used in this application.
 */
describe('the reading list', () => {
  it('has a unique id, a year, a group and a link for every entry', () => {
    const ids = READING.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of READING) {
      expect(r.citation.length, r.id).toBeGreaterThan(30);
      expect(r.citation.startsWith('"'), `${r.id} gives a title without its authors`).toBe(false);
      expect(r.contributes.length, r.id).toBeGreaterThan(40);
      expect(r.where.length, r.id).toBeGreaterThan(5);
      expect(r.year, r.id).toBeGreaterThan(2000);
      expect(r.year, r.id).toBeLessThanOrEqual(new Date().getFullYear());
      expect(r.url, r.id).toMatch(/^https:\/\//);
      expect(READING_GROUPS.some((g) => g.id === r.group), `${r.id} has group ${r.group}`).toBe(true);
    }
  });

  it('covers every group', () => {
    for (const g of READING_GROUPS) {
      expect(READING.filter((r) => r.group === g.id).length, g.id).toBeGreaterThan(0);
    }
  });

  it('includes the monograph itself and the authors&rsquo; overview', () => {
    const all = READING.map((r) => r.citation).join(' ');
    expect(all).toContain('2106.10165');
    expect(all).toContain('Effective Theory of Deep Neural Networks');
  });

  it('keeps the scaling-laws thread stocked with its three anchors', () => {
    const scaling = READING.filter((r) => r.group === 'scaling');
    expect(scaling.length).toBeGreaterThanOrEqual(3);
    const urls = scaling.map((r) => r.url).join(' ');
    for (const id of ['2102.06701', '2210.16859', '2402.01092']) {
      expect(urls, `the scaling group lost arXiv:${id}`).toContain(id);
    }
  });

  it('links each atlas concept that came from outside the monograph to a paper', () => {
    for (const c of CONCEPTS.filter((x) => x.principle === 'beyond')) {
      expect(c.url, `${c.id} has no link`).toMatch(/^https:\/\//);
    }
  });
});
