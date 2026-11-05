/**
 * Concepts that are linked automatically inside lesson prose.
 *
 * The glossary holds every term in the course. This file holds the subset that
 * is distinctive enough to be worth linking on first mention, together with the
 * surface form to look for in the text.
 *
 * The curation matters. Linking every glossary term would be noisy: "token",
 * "softmax", "logits" and "prompt" appear constantly, and a page of dotted
 * underlines teaches nothing. The terms left out are still in the glossary and
 * still reachable from the glossary page and the course search; they are simply
 * not decorated in the prose.
 *
 * Matching is case-insensitive but only fires on a word boundary, and only for
 * the first mention of a term in a section.
 */
import { GLOSSARY, type GlossaryEntry } from './glossary'

export interface ConceptSurface {
  /** Glossary id. */
  id: string
  /** The text to look for in the prose. */
  surface: string
}

/**
 * Surface form → glossary id.
 *
 * The order here is the order of preference when two matches overlap: longer
 * surfaces are tried first, so "scaled dot-product attention" wins over
 * "attention".
 */
export const AUTO_LINKED_CONCEPTS: ConceptSurface[] = [
  { id: 'supervised-fine-tuning', surface: 'supervised fine-tuning' },
  { id: 'masked-language-model', surface: 'masked language model' },
  { id: 'masked-language-model', surface: 'masked-token prediction' },
  { id: 'scaled-dot-product-attention', surface: 'scaled dot-product attention' },
  { id: 'retrieval-augmented-generation', surface: 'retrieval-augmented generation' },
  { id: 'retrieval-augmented-generation', surface: 'RAG' },
  { id: 'grouped-query-attention', surface: 'grouped-query attention' },
  { id: 'in-context-learning', surface: 'in-context learning' },
  { id: 'zero-shot', surface: 'zero-shot prompting' },
  { id: 'few-shot', surface: 'few-shot prompting' },
  { id: 'chain-of-thought', surface: 'chain of thought' },
  { id: 'chain-of-thought', surface: 'chain-of-thought' },
  { id: 'problem-decomposition', surface: 'problem decomposition' },
  { id: 'self-refinement', surface: 'self-refinement' },
  { id: 'instruction-tuning', surface: 'instruction tuning' },
  { id: 'cross-entropy-loss', surface: 'cross-entropy' },
  { id: 'bradley-terry', surface: 'Bradley–Terry' },
  { id: 'bradley-terry', surface: 'Bradley-Terry' },
  { id: 'kl-divergence', surface: 'KL divergence' },
  { id: 'reward-model', surface: 'reward model' },
  { id: 'reference-model', surface: 'reference model' },
  { id: 'log-ratio', surface: 'log-ratio' },
  { id: 'kv-cache', surface: 'KV cache' },
  { id: 'context-window', surface: 'context window' },
  { id: 'prefix-caching', surface: 'prefix caching' },
  { id: 'continuous-batching', surface: 'continuous batching' },
  { id: 'position-extrapolation', surface: 'position interpolation' },
  { id: 'top-k', surface: 'top-k' },
  { id: 'top-p', surface: 'top-p' },
  { id: 'greedy-decoding', surface: 'greedy decoding' },
  { id: 'beam-search', surface: 'beam search' },
  { id: 'prefill', surface: 'prefill' },
  { id: 'inference-time-scaling', surface: 'inference-time scaling' },
  { id: 'test-time-compute', surface: 'test-time compute' },
  { id: 'process-supervision', surface: 'process supervision' },
  { id: 'outcome-evaluation', surface: 'outcome-based evaluation' },
  { id: 'credit-assignment', surface: 'credit assignment' },
  { id: 'on-policy-distillation', surface: 'on-policy distillation' },
  { id: 'process-supervision', surface: 'process reward model' },
  { id: 'scaling-law', surface: 'scaling law' },
  { id: 'data-parallelism', surface: 'data parallelism' },
  { id: 'tensor-parallelism', surface: 'tensor parallelism' },
  { id: 'span-corruption', surface: 'span corruption' },
  { id: 'positional-encoding', surface: 'positional encoding' },
  { id: 'token-embedding', surface: 'token embedding' },
  { id: 'causal-mask', surface: 'causal mask' },
  { id: 'autoregressive', surface: 'autoregressive' },
  { id: 'language-model', surface: 'language model' },
  { id: 'foundation-model', surface: 'foundation model' },
  { id: 'self-supervision', surface: 'self-supervision' },
  { id: 'pre-training', surface: 'pre-training' },
  { id: 'fine-tuning', surface: 'fine-tuning' },
  { id: 'cosine-similarity', surface: 'cosine similarity' },
  { id: 'soft-prompt', surface: 'soft prompt' },
  { id: 'tool-use', surface: 'tool use' },
  { id: 'throughput', surface: 'throughput' },
  { id: 'verifier', surface: 'verifier' },
  { id: 'search-strategy', surface: 'search strategy' },
  { id: 'benchmark', surface: 'benchmark' },
  { id: 'contamination', surface: 'contamination' },
  { id: 'pass-at-k', surface: 'pass@k' },
  { id: 'rlhf', surface: 'RLHF' },
  { id: 'dpo', surface: 'DPO' },
  { id: 'ppo', surface: 'PPO' },
]

/** Glossary entries keyed by id. */
export const GLOSSARY_BY_ID = new Map<string, GlossaryEntry>(GLOSSARY.map((entry) => [entry.id, entry]))

/**
 * Surfaces sorted longest-first, so that a longer phrase wins over a shorter
 * one that starts at the same place.
 */
const SORTED_SURFACES = [...AUTO_LINKED_CONCEPTS].sort((a, b) => b.surface.length - a.surface.length)

/** A match found in a stretch of prose. */
export interface ConceptMatch {
  start: number
  end: number
  id: string
  surface: string
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

const MATCHERS = SORTED_SURFACES.map((concept) => ({
  concept,
  pattern: new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(concept.surface)}(?![\\p{L}\\p{N}])`, 'giu'),
}))

/**
 * Find the concept mentions in a stretch of text.
 *
 * At most one match is reported per glossary id, so a term is linked once even
 * if it appears several times in the same stretch. Overlapping matches are
 * resolved in favour of the earliest, and then the longest.
 */
export function findConceptMatches(text: string, alreadyLinked: Set<string>): ConceptMatch[] {
  const found: ConceptMatch[] = []
  for (const { concept, pattern } of MATCHERS) {
    if (alreadyLinked.has(concept.id)) continue
    pattern.lastIndex = 0
    const match = pattern.exec(text)
    if (!match) continue
    found.push({
      start: match.index,
      end: match.index + match[0].length,
      id: concept.id,
      surface: match[0],
    })
  }
  // Keep the earliest match; on a tie keep the longer one.
  found.sort((a, b) => a.start - b.start || b.end - a.end)
  const kept: ConceptMatch[] = []
  for (const candidate of found) {
    if (kept.some((existing) => candidate.start < existing.end && existing.start < candidate.end)) {
      continue
    }
    kept.push(candidate)
  }
  return kept
}
