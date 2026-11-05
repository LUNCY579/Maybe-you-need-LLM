/**
 * Contamination, and the overlap that detects it.
 *
 * A benchmark task is contaminated when the model has already seen the
 * answer. The detection is an overlap test: the solution to the task and the
 * training corpus are compared, and a long shared passage is the signal.
 *
 * The course measures it the way it is measured in practice — with an
 * n-gram overlap — and it measures the two things that make the measurement
 * arguable: the length of the n-gram, and the threshold.
 */

import { createRng } from '@llm-materials/course-core'
import type { Task } from './tasks'

/** The words of a task's solution, as a passage. */
export function solutionWords(task: Task, vocabulary = 500): number[] {
  const rng = createRng(task.id * 7919 + 13)
  const words: number[] = []
  for (let i = 0; i < 40; i++) words.push(Math.floor(rng() * vocabulary))
  return words
}

/** A training corpus, generated with the tasks' solutions mixed in. */
export function buildTrainingCorpus(
  tasks: Task[],
  options: { documents?: number; vocabulary?: number; seed?: number; editRate?: number } = {},
): number[][] {
  const settings = { documents: 200, vocabulary: 500, seed: 5, editRate: 0.1, ...options }
  const rng = createRng(settings.seed)
  const documents: number[][] = []
  const leaked = tasks.filter((task) => task.contaminated)

  // One document per contaminated task, holding a lightly edited copy of its
  // solution. One copy and not several: several copies of the same solution
  // reconstruct it between them, and then the length of the n-gram stops
  // deciding anything.
  for (const task of leaked) {
    const words: number[] = []
    for (const word of solutionWords(task, settings.vocabulary)) {
      words.push(rng() < settings.editRate ? Math.floor(rng() * settings.vocabulary) : word)
    }
    for (let j = 0; j < 30; j++) words.push(Math.floor(rng() * settings.vocabulary))
    documents.push(words)
  }

  // The rest of the corpus is noise.
  while (documents.length < settings.documents) {
    const words: number[] = []
    for (let j = 0; j < 60; j++) words.push(Math.floor(rng() * settings.vocabulary))
    documents.push(words)
  }
  return documents
}

/** The fraction of a passage's n-grams that appear in a document. */
export function overlapFraction(passage: number[], document: number[], n: number): number {
  if (passage.length < n) return 0
  const documentGrams = new Set<string>()
  for (let i = 0; i + n <= document.length; i++) {
    documentGrams.add(document.slice(i, i + n).join(','))
  }
  let shared = 0
  let total = 0
  for (let i = 0; i + n <= passage.length; i++) {
    total++
    if (documentGrams.has(passage.slice(i, i + n).join(','))) shared++
  }
  return total === 0 ? 0 : shared / total
}

/** The largest overlap a passage has with any document of a corpus. */
export function maximumOverlap(passage: number[], corpus: number[][], n: number): number {
  let best = 0
  for (const document of corpus) {
    const overlap = overlapFraction(passage, document, n)
    if (overlap > best) best = overlap
  }
  return best
}

/**
 * The fraction of a passage's n-grams that appear anywhere in a corpus.
 *
 * The *maximum* over the documents is the wrong measure: one unedited copy
 * anywhere in the corpus makes it one for every n-gram length, and the length
 * of the n-gram stops mattering. The union over the corpus is the measure the
 * contamination literature uses, and it is the one the n-gram length decides.
 */
export function corpusOverlap(passage: number[], corpus: number[][], n: number): number {
  if (passage.length < n) return 0
  const corpusGrams = new Set<string>()
  for (const document of corpus) {
    for (let i = 0; i + n <= document.length; i++) {
      corpusGrams.add(document.slice(i, i + n).join(','))
    }
  }
  let shared = 0
  let total = 0
  for (let i = 0; i + n <= passage.length; i++) {
    total++
    if (corpusGrams.has(passage.slice(i, i + n).join(','))) shared++
  }
  return total === 0 ? 0 : shared / total
}

export interface ContaminationReport {
  /** The n-gram length used. */
  n: number
  /** The threshold used. */
  threshold: number
  /** The tasks flagged as contaminated. */
  flagged: number
  /** The tasks that really are contaminated. */
  actuallyContaminated: number
  /** Of the flagged ones, how many really were. */
  correct: number
  /** Of the really contaminated ones, how many were caught. */
  caught: number
  /** The false-positive rate. */
  falsePositiveRate: number
  /** The true-positive rate. */
  truePositiveRate: number
}

/**
 * Measure the contamination.
 *
 * The report gives the two rates that decide whether the test is worth
 * running: what fraction of the tasks it wrongly flags, and what fraction of
 * the contaminated tasks it catches.
 */
export function measureContamination(
  tasks: Task[],
  corpus: number[][],
  options: { n?: number; threshold?: number; vocabulary?: number } = {},
): ContaminationReport {
  const settings = { n: 12, threshold: 0.5, vocabulary: 500, ...options }
  let flagged = 0
  let actuallyContaminated = 0
  let correct = 0
  let caught = 0

  for (const task of tasks) {
    const passage = solutionWords(task, settings.vocabulary)
    const overlap = corpusOverlap(passage, corpus, settings.n)
    const isFlagged = overlap >= settings.threshold
    if (task.contaminated) actuallyContaminated++
    if (isFlagged) {
      flagged++
      if (task.contaminated) {
        caught++
        correct++
      }
    }
  }

  const truePositives = correct
  const falsePositives = flagged - truePositives
  return {
    n: settings.n,
    threshold: settings.threshold,
    flagged,
    actuallyContaminated,
    correct: truePositives,
    caught,
    falsePositiveRate: flagged === 0 ? 0 : falsePositives / flagged,
    truePositiveRate: actuallyContaminated === 0 ? 0 : caught / actuallyContaminated,
  }
}

/**
 * The overlap, as a function of the n-gram length.
 *
 * The length is a choice with two failure modes: too short and ordinary
 * documents match, and too long and an edited copy slips through. The table
 * is the argument for the choice.
 */
export function overlapByLength(
  tasks: Task[],
  corpus: number[][],
  lengths: number[],
  options: { vocabulary?: number } = {},
): { n: number; falsePositiveMean: number; truePositiveMean: number }[] {
  const settings = { vocabulary: 500, ...options }
  return lengths.map((n) => {
    const leaked = tasks.filter((task) => task.contaminated)
    const clean = tasks.filter((task) => !task.contaminated)
    const meanOf = (subset: Task[]) =>
      subset.length === 0
        ? 0
        : subset.reduce(
            (sum, task) => sum + corpusOverlap(solutionWords(task, settings.vocabulary), corpus, n),
            0,
          ) / subset.length
    return { n, falsePositiveMean: meanOf(clean), truePositiveMean: meanOf(leaked) }
  })
}
