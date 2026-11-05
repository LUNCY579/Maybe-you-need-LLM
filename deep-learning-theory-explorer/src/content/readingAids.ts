import type { ReadingEntry, ReadingGroup } from './reading';

/**
 * The reading list is long enough that a reader needs two things from it: a
 * way to narrow it down, and a reason to read it in one order rather than
 * another. Both are plain functions here, so the page only has to render what
 * they return and the tests can check them without a browser.
 */

export interface ReadingFilter {
  group: ReadingGroup | 'all';
  query: string;
  year: number | 'all';
}

export function filterReading(entries: ReadingEntry[], filter: ReadingFilter): ReadingEntry[] {
  const q = filter.query.trim().toLowerCase();
  return entries.filter((entry) => {
    if (filter.group !== 'all' && entry.group !== filter.group) return false;
    if (filter.year !== 'all' && entry.year !== filter.year) return false;
    if (q && !`${entry.citation} ${entry.contributes} ${entry.where}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

export interface YearCount {
  year: number;
  count: number;
}

/**
 * Every year between the oldest and the newest entry, including the years with
 * nothing in them: a gap on the timeline is information, and dropping it would
 * make the list look denser than it is.
 */
export function yearHistogram(entries: ReadingEntry[]): YearCount[] {
  if (entries.length === 0) return [];
  const counts = new Map<number, number>();
  for (const entry of entries) counts.set(entry.year, (counts.get(entry.year) ?? 0) + 1);
  const first = Math.min(...counts.keys());
  const last = Math.max(...counts.keys());
  const histogram: YearCount[] = [];
  for (let year = first; year <= last; year += 1) {
    histogram.push({ year, count: counts.get(year) ?? 0 });
  }
  return histogram;
}

export function sortByYear(entries: ReadingEntry[], direction: 'newest' | 'oldest'): ReadingEntry[] {
  const sign = direction === 'newest' ? -1 : 1;
  return [...entries].sort((a, b) => sign * (a.year - b.year));
}

export interface ReadingPath {
  id: string;
  name: string;
  blurb: string;
  /** entry ids, in the order to read them */
  steps: string[];
}

export const READING_PATHS: ReadingPath[] = [
  {
    id: 'kernel',
    name: 'The shortest path to the kernel',
    blurb: 'Four papers that build the frozen-kernel picture the second half of the monograph lives in.',
    steps: ['poole-2016', 'lee-2018', 'jacot-2018', 'chizat-2019'],
  },
  {
    id: 'scaling',
    name: 'How loss falls with scale',
    blurb: 'From the taxonomy of scaling regimes to a solvable model of the curves themselves.',
    steps: ['bahri-2021', 'maloney-2022', 'bordelon-2024'],
  },
  {
    id: 'late',
    name: 'Why generalization can arrive late',
    blurb: 'From the grokking phenomenon to the lazy-to-rich account of it, and to what feature learning actually buys.',
    steps: ['power-2022', 'kumar-2023', 'feature-quality-2025'],
  },
  {
    id: 'open',
    name: 'Where the theory is still open',
    blurb: 'The papers to read if you want to work on what the book leaves out.',
    steps: ['yang-2021', 'lauditi-2025', 'multiscale-2025', 'feature-quality-2025', 'ntk-depth-2025'],
  },
];

export function resolveReadingPath(path: ReadingPath, entries: ReadingEntry[]): ReadingEntry[] {
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  return path.steps.map((id) => {
    const entry = byId.get(id);
    if (!entry) throw new Error(`reading path ${path.id} names an entry that does not exist: ${id}`);
    return entry;
  });
}
