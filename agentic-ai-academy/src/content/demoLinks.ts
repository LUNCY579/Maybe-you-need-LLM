import { GLOSSARY } from './glossary'
import { normaliseKey } from './glossaryIndex'
import { LESSONS } from './lessons'
import type { DemoId } from '../types/curriculum'

/**
 * Which demonstration exercises which concept.
 *
 * The glossary tells a student what a term means; the demonstrations are where
 * they can *try* it. This map connects the two, so that a student who reads
 * "Tool use" and wants to see what choosing a tool actually feels like has one
 * click between them and the demonstration.
 *
 * The lesson is derived rather than written down: the demo lives in exactly
 * one lesson, so the link cannot drift out of date.
 */
export const DEMO_FOR_TERM: Record<string, DemoId> = {
  // The planning demonstration.
  Planning: 'planning',
  'Agentic loop': 'planning',
  Reasoning: 'planning',
  'Chain of thought': 'planning',
  Environment: 'planning',

  // The memory demonstration.
  'Memory architecture': 'memory',
  'Continual learning': 'memory',
  'Embedding': 'memory',
  'Vector database': 'memory',

  // The context-window demonstration.
  'Context window': 'context-window',
  'Context management': 'context-window',
  'Prompt compression': 'context-window',
  'Truncation': 'context-window',

  // The tool-selection demonstration.
  'Tool use': 'tool-selection',
  'Tool use architecture': 'tool-selection',
  'Planner-Caller-Summarizer': 'tool-selection',
  'Model Context Protocol (MCP)': 'tool-selection',
  Robustness: 'tool-selection',
  Safety: 'tool-selection',
  'Human-in-the-loop': 'tool-selection',

  // The retrieval demonstration.
  'Retrieval-augmented generation (RAG)': 'retrieval',
  Retrieval: 'retrieval',
  'Recall@k': 'retrieval',
  'Mean reciprocal rank (MRR)': 'retrieval',
  Faithfulness: 'retrieval',

  // The curation demonstration.
  Curation: 'curation',
  'Synthetic data': 'curation',

  // The social-dilemma demonstration.
  'Machine behaviour': 'dilemma',
  'Policy': 'dilemma',
  'Reinforcement learning': 'dilemma',
  'Multi-agent': 'dilemma',
  'Role-based multi-agent system': 'dilemma',
  'Social chain of thought': 'dilemma',
  'Knowing-doing gap': 'dilemma',
  'Theory of mind (LLM evaluation)': 'dilemma',
}

/** The lesson a demonstration lives in, derived from the lesson content. */
export function lessonForDemo(demo: DemoId): string | undefined {
  const lesson = LESSONS.find((candidate) =>
    [...candidate.sections, ...candidate.advancedSections].some((section) =>
      section.blocks.some((block) => block.kind === 'demo' && block.demo === demo),
    ),
  )
  return lesson?.slug
}

/** A link into the lesson that holds a demonstration, with the demo anchored. */
export function routeForDemo(demo: DemoId): string | null {
  const slug = lessonForDemo(demo)
  return slug ? `/lesson/${slug}#demo-${demo}` : null
}

/** The demonstration that exercises a glossary term, if there is one. */
export function demoForTerm(term: string): DemoId | undefined {
  const exact = GLOSSARY.find((entry) => entry.term === term)
  if (exact?.demo) return exact.demo
  // The lookup is normalised, because the book mixes hyphens and en dashes
  // in the same term name.
  const key = normaliseKey(term)
  for (const [name, demo] of Object.entries(DEMO_FOR_TERM)) {
    if (normaliseKey(name) === key) return demo
  }
  return undefined
}
