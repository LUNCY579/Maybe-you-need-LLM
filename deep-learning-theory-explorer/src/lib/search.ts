import { LESSONS } from '../content/lessons';
import { EQUATIONS } from '../content/equations';
import { QUIZ } from '../content/quizzes';
import { EXPERIMENTS } from '../content/experiments';
import { TERMS } from './terminology';
import { CONCEPTS } from '../content/concepts';

/**
 * Searching the whole curriculum.
 *
 * A student who remembers the phrase "depth-to-width ratio" should not have to
 * guess which of the ten lessons it is in. This module builds one index over
 * the lessons, the equations, the terminology, the assessment and the gallery,
 * and ranks the hits by where the match occurred: a title match beats a body
 * match, and a body match beats a match in a passing mention.
 */

export type SearchKind = 'lesson' | 'equation' | 'term' | 'question' | 'experiment' | 'concept';

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  /** the matched snippet, or the most relevant line */
  detail: string;
  route: string;
  score: number;
}

interface IndexEntry {
  kind: SearchKind;
  id: string;
  title: string;
  /** the text a match is looked for in, and shown as the snippet */
  body: string;
  route: string;
  /** extra searchable fields, weighted lower than the body */
  keywords: string;
}

/** Pull a short, readable snippet around the first occurrence of the query. */
function snippet(body: string, query: string, radius = 90): string {
  const at = body.toLowerCase().indexOf(query.toLowerCase());
  if (at < 0) return body.slice(0, radius * 2).trim();
  const start = Math.max(0, at - radius);
  const end = Math.min(body.length, at + query.length + radius);
  return `${start > 0 ? '…' : ''}${body.slice(start, end).trim()}${end < body.length ? '…' : ''}`;
}

/**
 * The words of a query.
 *
 * A reader does not type the exact phrase that is in the book. They type
 * "critical weight variance" and the book says "the critical value of the
 * weight variance"; they type "width depth ratio" and the book says
 * "depth-to-width ratio". So the query is split into words, and an entry
 * matches when it contains all of them — the words do not have to be
 * adjacent, and the order does not matter.
 */
const STOP_WORDS = new Set(['the', 'a', 'an', 'of', 'in', 'is', 'to', 'and', 'or', 'for', 'on', 'with', 'what', 'how', 'why']);

function queryWords(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9χλσμθΓΔ]+/)
    .map((w) => w.trim())
    .filter((w) => w.length >= 2 && !STOP_WORDS.has(w));
}

/** The position of a word in the text, or -1. */
function positionOf(text: string, word: string): number {
  return text.toLowerCase().indexOf(word);
}

/**
 * Score one entry against a query. Zero means "no match".
 *
 * The words are matched one by one, and the entry is scored by how much the
 * match matters — a title match is worth most — and by how close the words
 * are to each other, because a phrase that appears together is a better
 * answer than the same words scattered across a paragraph.
 */
function score(entry: IndexEntry, query: string): { score: number; snippet: string } {
  const q = query.toLowerCase().trim();
  const words = queryWords(q);
  if (words.length === 0) return { score: 0, snippet: '' };

  const title = entry.title.toLowerCase();
  const keywords = entry.keywords.toLowerCase();
  const body = entry.body.toLowerCase();
  const base = KIND_WEIGHT[entry.kind];

  // where the words are found, and how tightly
  let titleHits = 0;
  let keywordHits = 0;
  const bodyPositions: number[] = [];
  for (const word of words) {
    if (title.includes(word)) titleHits += 1;
    else if (keywords.includes(word)) keywordHits += 1;
    else {
      const at = positionOf(entry.body, word);
      if (at < 0) return { score: 0, snippet: '' };
      bodyPositions.push(at);
    }
  }
  if (titleHits + keywordHits + bodyPositions.length < words.length) return { score: 0, snippet: '' };

  // the whole query, if it is there verbatim, is the best possible answer
  if (title.includes(q)) {
    const position = title.indexOf(q);
    return { score: base - Math.min(40, position), snippet: snippet(entry.body, query) };
  }
  if (keywords.includes(q)) return { score: base - 45, snippet: snippet(entry.body, query) };
  if (body.includes(q)) return { score: base - 70, snippet: snippet(entry.body, query) };

  // otherwise: the words are there, but not as a phrase
  const spread = bodyPositions.length > 1 ? Math.max(...bodyPositions) - Math.min(...bodyPositions) : 0;
  const proximity = spread < 60 ? 12 : spread < 160 ? 6 : 0;
  const titleBonus = titleHits === words.length ? 20 : titleHits > 0 ? 10 : 0;
  const keywordBonus = keywordHits === words.length ? 8 : 0;
  const value = base - 70 + proximity + titleBonus + keywordBonus;

  // the snippet is around the first of the words
  const first = bodyPositions.length ? bodyPositions[0] : positionOf(entry.body, words[0]);
  const around = first >= 0 ? first : 0;
  const start = Math.max(0, around - 90);
  const end = Math.min(entry.body.length, around + 180);
  return {
    score: value,
    snippet: `${start > 0 ? '…' : ''}${entry.body.slice(start, end).trim()}${end < entry.body.length ? '…' : ''}`,
  };
}

function buildIndex(): IndexEntry[] {
  const entries: IndexEntry[] = [];

  for (const lesson of LESSONS) {
    const body = lesson.sections
      .flatMap((s) => s.blocks.flatMap((b) => (b.kind === 'p' ? [b.text] : b.kind === 'callout' ? [b.title, b.text] : b.kind === 'eq' ? [b.caption ?? ''] : [])))
      .join(' ')
      .replace(/\[\[([a-z0-9-]+)\]\]/g, ' $1 ');
    entries.push({
      kind: 'lesson',
      id: lesson.id,
      title: lesson.title,
      body,
      route: `/lessons/${lesson.id}`,
      keywords: `${lesson.chapter} ${lesson.summary} ${lesson.objectives.join(' ')}`,
    });
  }

  for (const eq of EQUATIONS) {
    entries.push({
      kind: 'equation',
      id: eq.id,
      title: eq.title,
      body: `${eq.meaning} ${eq.derivation.join(' ')} ${eq.assumptions.join(' ')} ${eq.symbols.map((s) => s.meaning).join(' ')}`,
      route: `/equations?eq=${eq.id}`,
      keywords: `${eq.ref} ${eq.symbols.map((s) => s.symbol).join(' ')}`,
    });
  }

  for (const term of TERMS) {
    entries.push({
      kind: 'term',
      id: term.id,
      title: `${term.name} (${term.symbol})`,
      body: term.meaning,
      route: term.equationId ? `/equations?eq=${term.equationId}` : '/prerequisites',
      keywords: term.ref,
    });
  }

  for (const q of QUIZ) {
    entries.push({
      kind: 'question',
      id: q.id,
      title: q.prompt,
      body: `${q.prompt} ${q.explanation} ${q.options.join(' ')}`,
      route: '/quiz',
      keywords: `${q.difficulty} ${q.citations.join(' ')}`,
    });
  }

  for (const exp of EXPERIMENTS) {
    entries.push({
      kind: 'experiment',
      id: exp.id,
      title: exp.name,
      body: `${exp.hypothesis} ${exp.description} ${exp.expected}`,
      route: '/gallery',
      keywords: exp.lab,
    });
  }

  // the theory atlas: its own vocabulary, and its entries are not in the
  // lesson, equation or question indexes
  for (const c of CONCEPTS) {
    entries.push({
      kind: 'concept',
      id: c.id,
      title: c.name,
      body: `${c.statement} ${c.implemented} ${c.ref}`,
      route: '/atlas',
      keywords: `${c.principle} ${c.kind}`,
    });
  }

  return entries;
}

let INDEX: IndexEntry[] | null = null;

function index(): IndexEntry[] {
  if (!INDEX) INDEX = buildIndex();
  return INDEX;
}

const KIND_LABEL: Record<SearchKind, string> = {
  lesson: 'Lesson',
  equation: 'Equation',
  term: 'Term',
  question: 'Question',
  experiment: 'Experiment',
  concept: 'Concept',
};

export function kindLabel(kind: SearchKind): string {
  return KIND_LABEL[kind];
}

/**
 * How much a hit of each kind is worth. A lesson is the best entry point for a
 * topic, an assessment question is the weakest: a reader who searches for a
 * phrase wants the place that *explains* it.
 */
const KIND_WEIGHT: Record<SearchKind, number> = {
  lesson: 100,
  equation: 95,
  concept: 92,
  term: 85,
  experiment: 80,
  question: 70,
};

/**
 * Search the curriculum. An empty query returns nothing; a one-character query
 * returns nothing, because it would match almost everything.
 */
export function searchCurriculum(query: string, limit = 12): SearchHit[] {
  const q = query.trim();
  if (q.length < 2) return [];
  const hits: SearchHit[] = [];
  const seen = new Set<string>();
  for (const entry of index()) {
    // one entry can match in several places; report it once
    const key = `${entry.kind}:${entry.id}`;
    if (seen.has(key)) continue;
    const { score: s, snippet: text } = score(entry, q);
    if (s <= 0) continue;
    seen.add(key);
    hits.push({ kind: entry.kind, id: entry.id, title: entry.title, detail: text, route: entry.route, score: s });
  }
  hits.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return hits.slice(0, limit);
}
