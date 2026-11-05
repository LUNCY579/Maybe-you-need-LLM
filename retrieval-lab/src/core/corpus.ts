/**
 * A corpus to retrieve from.
 *
 * The corpus is built so that the *lexical* and the *semantic* answers
 * differ, because that is the case the course is about. Every document is a
 * sample from a latent topic, and a topic has its own vocabulary as well as
 * the background vocabulary that every topic shares. A question mentions the
 * topic by words that are common across the whole corpus, so a lexical
 * retriever cannot tell the right document from the wrong one, while a model
 * that has learned the topic can.
 *
 * The ground truth is known: every question has exactly one relevant
 * document, and the laboratory measures the recall against it.
 */

import { createRng } from '@llm-materials/course-core'

export interface CorpusOptions {
  /** The number of documents. */
  size?: number
  /** The number of questions. */
  queries?: number
  /** The number of topics. */
  topics?: number
  /** The size of the background vocabulary. */
  background?: number
  /** The size of each topic's own vocabulary. */
  topicVocabulary?: number
  /** The average document length, in words. */
  length?: number
  /** The average question length, in words. */
  queryLength?: number
  /** The seed. */
  seed?: number
}

export interface Passage {
  id: number
  /** The words of the document. */
  words: number[]
  /** The latent topic. */
  topic: number
}

export interface Query {
  id: number
  /** The words of the question. */
  words: number[]
  /** The topic it is about. */
  topic: number
  /** The document that answers it. */
  relevant: number
}

export interface Corpus {
  passages: Passage[]
  queries: Query[]
  /** The size of the whole vocabulary. */
  vocabulary: number
  /** The number of topics. */
  topics: number
  /** The words that every topic shares. */
  background: number[]
  /** The words each topic owns. */
  topicWords: number[][]
  options: Required<CorpusOptions>
}

/** Build the corpus. */
export function buildCorpus(options: CorpusOptions = {}): Corpus {
  const settings: Required<CorpusOptions> = {
    size: 400,
    queries: 40,
    topics: 20,
    background: 600,
    topicVocabulary: 80,
    length: 60,
    queryLength: 10,
    seed: 4,
  }
  Object.assign(settings, options)

  const rng = createRng(settings.seed)
  const { topics, background, topicVocabulary } = settings

  // The background words are shared by every topic.
  const backgroundWords: number[] = []
  for (let i = 0; i < background; i++) backgroundWords.push(i)

  // Each topic owns a block of words, and the blocks do not overlap.
  const topicWords: number[][] = []
  for (let t = 0; t < topics; t++) {
    const words: number[] = []
    for (let i = 0; i < topicVocabulary; i++) words.push(background + t * topicVocabulary + i)
    topicWords.push(words)
  }
  const vocabulary = background + topics * topicVocabulary

  const passages: Passage[] = []
  for (let id = 0; id < settings.size; id++) {
    const topic = Math.floor(rng() * topics)
    const length = Math.max(8, Math.round(settings.length * (0.6 + rng() * 0.8)))
    const words: number[] = []
    // A document is mostly its own topic's words, with some background.
    for (let i = 0; i < length; i++) {
      const useTopic = rng() < 0.35
      if (useTopic) {
        const block = topicWords[topic]!
        words.push(block[Math.floor(rng() * block.length)] ?? 0)
      } else {
        words.push(backgroundWords[Math.floor(rng() * backgroundWords.length)] ?? 0)
      }
    }
    passages.push({ id, words, topic })
  }

  const queries: Query[] = []
  for (let id = 0; id < settings.queries; id++) {
    const topic = Math.floor(rng() * topics)
    const length = Math.max(4, Math.round(settings.queryLength * (0.6 + rng() * 0.8)))
    const words: number[] = []
    // A question is mostly background words: it names the topic the way a
    // person would, and the words it uses are everywhere in the corpus.
    for (let i = 0; i < length; i++) {
      if (rng() < 0.2) {
        const block = topicWords[topic]!
        words.push(block[Math.floor(rng() * block.length)] ?? 0)
      } else {
        words.push(backgroundWords[Math.floor(rng() * backgroundWords.length)] ?? 0)
      }
    }
    // The document that answers it: the one about the same topic, and
    // nothing else.
    const relevant = passages.find((passage) => passage.topic === topic)?.id ?? 0
    queries.push({ id, words, topic, relevant })
  }

  return { passages, queries, vocabulary, topics, background: backgroundWords, topicWords, options: settings }
}

/** The document frequency of every word: how many documents contain it. */
export function documentFrequency(corpus: Corpus): number[] {
  const counts = new Array<number>(corpus.vocabulary).fill(0)
  for (const passage of corpus.passages) {
    for (const word of new Set(passage.words)) counts[word] = (counts[word] ?? 0) + 1
  }
  return counts
}

/** The average document length. */
export function averageLength(corpus: Corpus): number {
  if (corpus.passages.length === 0) return 0
  const total = corpus.passages.reduce((sum, passage) => sum + passage.words.length, 0)
  return total / corpus.passages.length
}
