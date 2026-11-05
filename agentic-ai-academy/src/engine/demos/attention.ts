/**
 * Attention as a soft lookup.
 *
 * Chapter 2 §2.3.4 describes attention in two steps, and they are the two
 * steps this engine computes:
 *
 *  1. "Compare the current decoder state with each encoder hidden state by
 *     applying a similarity function (such as a dot product) to see how well
 *     they match."
 *  2. "Pass these scores through a softmax function so they sum to 1,
 *     effectively creating a probability distribution over the input tokens."
 *
 * The context vector is then "a linear combination of all encoder hidden
 * states", with the attention weights as the coefficients — and that is the
 * part that is easy to read past. Because *every* input gets a weight, the
 * mechanism never looks at one thing. It looks at everything, with a
 * distribution over it.
 *
 * That has two consequences the demonstration makes visible:
 *
 *  - **The query is half the lookup.** A vague query puts the weight on the
 *    passage that is *about* the subject rather than the passage that
 *    *answers* the question, and no amount of sharpening fixes it.
 *  - **The scale decides whether a lookup is a lookup.** The softmax can be
 *    made arbitrarily flat, and a flat distribution over six passages is not
 *    "the model considered all six"; it is a context vector that is the
 *    average of all six, with the right answer contributing a minority
 *    share.
 *
 * It is also the mechanism underneath the retrieval demonstration: a retriever
 * is a soft lookup over a corpus, and everything that goes wrong in
 * retrieval goes wrong here first.
 *
 * This is a toy: one head, four dimensions, and hand-written vectors. It is
 * not a language model and it does not pretend to be one. What it is faithful
 * to is the *mechanism* — the dot product, the softmax, the linear
 * combination — and that is what the chapter describes.
 */

export interface AttentionKey {
  id: string
  label: string
  /** A short excerpt. */
  text: string
  /** The passage's embedding. */
  vector: number[]
  /** Whether this passage answers the question. */
  relevant?: boolean
}

export interface AttentionQuery {
  id: string
  label: string
  /** The query's embedding. */
  vector: number[]
  /** What the query is asking for, in words. */
  prompt: string
}

export interface AttentionCase {
  id: string
  title: string
  context: string
  /** The question the reader is trying to answer. */
  question: string
  queries: AttentionQuery[]
  keys: AttentionKey[]
  /** The answer, when the context points at it. */
  answer: string
  /** The answer the model gives when the context points at the decoy. */
  wrongAnswer: string
  /** The note on what the case is for. */
  note: string
}

export interface AttentionOutcome {
  /** The attention weight on each passage, in the order of the corpus. */
  weights: { key: AttentionKey; weight: number; score: number }[]
  /** The context vector: the weighted combination of the passages. */
  context: number[]
  /**
   * The entropy of the distribution, in bits.
   *
   * Zero means all the weight is on one passage; log₂(n) means it is spread
   * evenly.
   */
  entropy: number
  /**
   * The effective number of passages attended to.
   *
   * The perplexity of the distribution: how many passages the model is
   * behaving as if it were reading. One is a lookup. Six is an average.
   */
  effectiveKeys: number
  /** The passage with the most weight. */
  winner: AttentionKey
  /** Whether the winner is the one that answers the question. */
  correct: boolean
  /** The answer the model gives. */
  answer: string
  /** One sentence on what happened. */
  explanation: string
}

/** The dot product of two vectors. */
export function dot(a: number[], b: number[]): number {
  let total = 0
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) total += a[i] * b[i]
  return total
}

/** The softmax of a list of scores, stably computed. */
export function softmax(scores: number[]): number[] {
  const highest = Math.max(...scores)
  const exponentials = scores.map((score) => Math.exp(score - highest))
  const total = exponentials.reduce((sum, value) => sum + value, 0)
  return exponentials.map((value) => value / total)
}

/**
 * Run one attention lookup.
 *
 * The scale is the only thing the student changes about the *mechanism*, and
 * it is the knob that turns a lookup into an average.
 */
export function attend(scenario: AttentionCase, query: AttentionQuery, scale: number): AttentionOutcome {
  const scores = scenario.keys.map((key) => dot(query.vector, key.vector) * scale)
  const weights = softmax(scores)

  const context = scenario.keys[0].vector.map((_, index) =>
    scenario.keys.reduce((sum, key, position) => sum + key.vector[index] * weights[position], 0),
  )

  const entropy = -weights.reduce((sum, weight) => sum + (weight > 0 ? weight * Math.log2(weight) : 0), 0)
  const effectiveKeys = Math.pow(2, entropy)

  const best = weights.reduce((bestSoFar, weight, index) => (weight > weights[bestSoFar] ? index : bestSoFar), 0)
  const winner = scenario.keys[best]
  /**
   * The answer is right only when the right passage dominates the context.
   *
   * Having the most weight is not enough: a distribution spread over six
   * passages is not a lookup, it is an average, and the model answers from
   * the average.
   */
  const correct = winner.relevant === true && weights[best] >= 0.4

  let explanation: string
  if (!correct) {
    explanation =
      'The weight went to the passage that talks about the subject rather than the one that answers the question. A soft lookup is only as good as the query it is given, and sharpening the scale cannot repair a query that asks the wrong thing.'
  } else if (weights[best] < 0.4) {
    explanation =
      'The right passage has the most weight, but not much of it: the distribution is spread over the whole corpus, so the context vector is close to an average of everything rather than to the answer. This is what a flat softmax does.'
  } else {
    explanation =
      'The weight is concentrated on the passage that answers the question. The context vector is close to that passage and little else, which is what a lookup is supposed to look like.'
  }

  return {
    weights: scenario.keys.map((key, index) => ({ key, weight: weights[index], score: scores[index] })),
    context,
    entropy,
    effectiveKeys,
    winner,
    correct,
    answer: correct ? scenario.answer : scenario.wrongAnswer,
    explanation,
  }
}

/* ------------------------------------------------------------------ */
/* Cases                                                               */
/* ------------------------------------------------------------------ */

export const ATTENTION_CASES: AttentionCase[] = [
  {
    id: 'transformer',
    title: 'What does attention do?',
    context:
      'A reader wants to know how attention computes the context vector. The corpus holds six passages about language models. Only one of them answers the question; another one mentions attention constantly and answers something else entirely.',
    question: 'How does attention compute the context vector?',
    queries: [
      {
        id: 'precise',
        label: 'A precise query',
        prompt: 'how does attention compute the context vector',
        vector: [0.9, 0.95, 0.2, 0.2],
      },
      {
        id: 'vague',
        label: 'A vague query',
        prompt: 'tell me about attention',
        vector: [0.8, 0.35, 0.55, 0.4],
      },
      {
        id: 'lexical',
        label: 'A query that repeats the keyword',
        prompt: 'attention attention attention examples',
        vector: [0.95, 0.1, 0.5, 0.9],
      },
    ],
    keys: [
      {
        id: 'k-paper',
        label: 'Attention Is All You Need',
        text: 'The attention weights are computed by a dot product against every input, normalised by a softmax, and used to take a weighted sum of the value vectors.',
        vector: [0.95, 0.9, 0.3, 0.2],
        relevant: true,
      },
      {
        id: 'k-blog',
        label: 'Ten things people get wrong about attention',
        text: 'Attention is the most talked-about part of any model. Here are ten misconceptions about attention, and why they matter.',
        vector: [0.9, 0.25, 0.6, 0.5],
      },
      {
        id: 'k-rnn',
        label: 'How recurrent networks work',
        text: 'A recurrent network carries a hidden state forward one step at a time, which is what makes it slow and what makes it good at long sequences.',
        vector: [0.3, 0.5, 0.6, 0.4],
      },
      {
        id: 'k-tokenizer',
        label: 'How tokenizers work',
        text: 'A tokenizer splits text into sub-word units. The size of the vocabulary and the way it splits are choices with real consequences.',
        vector: [0.1, 0.6, 0.5, 0.3],
      },
      {
        id: 'k-embeddings',
        label: 'Embeddings, in one page',
        text: 'An embedding is a point in a space, and two sentences are close when they mean something similar.',
        vector: [0.4, 0.3, 0.5, 0.3],
      },
      {
        id: 'k-hardware',
        label: 'Attention and GPUs',
        text: 'Attention is quadratic in the sequence length, which is why accelerators matter so much for long contexts.',
        vector: [0.6, 0.35, 0.4, 0.6],
      },
    ],
    answer:
      'The weights come from a dot product against every input, a softmax normalises them, and the context vector is their weighted sum of the value vectors.',
    wrongAnswer:
      'Attention is the part of the model that decides which words matter; the ten common misconceptions are worth reading first.',
    note:
      'The decoy passage is about attention and says nothing about how it works. A query that names the mechanism finds it; a query that names the subject finds the decoy instead — and no amount of sharpening changes that.',
  },
]

export const ATTENTION_CASE_BY_ID = new Map(ATTENTION_CASES.map((entry) => [entry.id, entry]))
