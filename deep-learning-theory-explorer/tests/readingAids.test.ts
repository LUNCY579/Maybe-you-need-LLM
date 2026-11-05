import { describe, expect, it } from 'vitest';
import { READING } from '../src/content/reading';
import {
  READING_PATHS,
  filterReading,
  resolveReadingPath,
  sortByYear,
  yearHistogram,
} from '../src/content/readingAids';

/**
 * The interactive aids on the reading page: the filter, the year histogram,
 * the sort order and the curated paths. They are pure functions, so the page's
 * behaviour can be checked without a browser.
 */
describe('the reading aids', () => {
  it('filters by group and leaves the other groups out', () => {
    const shown = filterReading(READING, { group: 'scaling', query: '', year: 'all' });
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((entry) => entry.group === 'scaling')).toBe(true);
  });

  it('filters by year', () => {
    const shown = filterReading(READING, { group: 'all', query: '', year: 2018 });
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.every((entry) => entry.year === 2018)).toBe(true);
  });

  it('searches the citation, the contribution and the place it is used', () => {
    const byCitation = filterReading(READING, { group: 'all', query: '  NEURAL TANGENT ', year: 'all' });
    expect(byCitation.some((entry) => /neural tangent/i.test(entry.citation))).toBe(true);
    expect(
      byCitation.every((entry) => /neural tangent/i.test(`${entry.citation} ${entry.contributes} ${entry.where}`)),
    ).toBe(true);

    const byContribution = filterReading(READING, { group: 'all', query: 'compute-optimal', year: 'all' });
    expect(byContribution.length).toBeGreaterThan(0);
    expect(byContribution.every((entry) => /compute-optimal/i.test(entry.contributes))).toBe(true);

    const byWhere = filterReading(READING, { group: 'all', query: 'defrosting', year: 'all' });
    expect(byWhere.length).toBeGreaterThan(0);
    expect(byWhere.every((entry) => /defrosting/i.test(entry.where))).toBe(true);
  });

  it('combines the three filters', () => {
    const shown = filterReading(READING, { group: 'the-ntk', query: 'kernel', year: 2018 });
    expect(shown.length).toBeGreaterThan(0);
    for (const entry of shown) {
      expect(entry.group, entry.id).toBe('the-ntk');
      expect(entry.year, entry.id).toBe(2018);
    }
  });

  it('returns the whole list when nothing is selected', () => {
    const shown = filterReading(READING, { group: 'all', query: '', year: 'all' });
    expect(shown.map((entry) => entry.id)).toEqual(READING.map((entry) => entry.id));
  });

  it('counts one bar per year, with the empty years kept and the total equal to the list', () => {
    const histogram = yearHistogram(READING);
    expect(histogram.length).toBeGreaterThan(1);
    for (let i = 1; i < histogram.length; i += 1) {
      expect(histogram[i].year, 'the histogram skips a year').toBe(histogram[i - 1].year + 1);
    }
    expect(histogram.reduce((sum, bin) => sum + bin.count, 0)).toBe(READING.length);
    expect(yearHistogram([])).toEqual([]);
  });

  it('sorts by year without changing the order it was given', () => {
    const original = READING.map((entry) => entry.id);
    const newest = sortByYear(READING, 'newest');
    const oldest = sortByYear(READING, 'oldest');
    for (let i = 1; i < newest.length; i += 1) {
      expect(newest[i].year, `${newest[i].id} is out of order`).toBeLessThanOrEqual(newest[i - 1].year);
    }
    for (let i = 1; i < oldest.length; i += 1) {
      expect(oldest[i].year, `${oldest[i].id} is out of order`).toBeGreaterThanOrEqual(oldest[i - 1].year);
    }
    expect(newest.length).toBe(READING.length);
    expect(READING.map((entry) => entry.id)).toEqual(original);
  });

  it('has paths that all resolve, in the order they name', () => {
    expect(READING_PATHS.length).toBeGreaterThanOrEqual(3);
    expect(new Set(READING_PATHS.map((path) => path.id)).size).toBe(READING_PATHS.length);
    for (const path of READING_PATHS) {
      expect(path.steps.length, path.id).toBeGreaterThanOrEqual(3);
      expect(new Set(path.steps).size, `${path.id} repeats a step`).toBe(path.steps.length);
      const resolved = resolveReadingPath(path, READING);
      expect(resolved.map((entry) => entry.id), path.id).toEqual(path.steps);
    }
  });

  it('fails loudly when a path names a paper that is not in the list', () => {
    const broken = { ...READING_PATHS[0], steps: ['no-such-paper'] };
    expect(() => resolveReadingPath(broken, READING)).toThrow(/does not exist/);
  });
});
