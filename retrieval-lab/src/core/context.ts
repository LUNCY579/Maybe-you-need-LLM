/**
 * The long context, and the position it puts the evidence in.
 *
 * The claim the paper makes is that a model's use of a long context is not
 * uniform: the evidence near the beginning and near the end is used well, and
 * the evidence in the middle is used badly. The consequence for retrieval is
 * that *where* the retrieved passages are put matters as much as whether they
 * were retrieved at all.
 *
 * The reader here is a single-layer attention with a position-dependent
 * prior — the shape of the effect the paper measures, reduced to its
 * essentials and made computable. The accuracy of finding a needle in a
 * context is then a function of where the needle is, and the retrieval
 * pipeline is the thing that fixes it.
 */

import { createRng } from '@llm-materials/course-core'

export interface ContextOptions {
  /** The length of the context. */
  length?: number
  /** The strength of the position prior. */
  positionStrength?: number
  /** The temperature of the attention. */
  temperature?: number
  /** The seed. */
  seed?: number
}

/**
 * The position prior.
 *
 * A U-shape: the beginning and the end are attended to, and the middle is
 * not. It is the shape the measurements take, and it is the whole of the
 * mechanism the course is about.
 */
export function positionPrior(length: number, strength: number, position: number): number {
  const relative = length <= 1 ? 0 : position / (length - 1)
  // A quadratic well: high at the two ends, low in the middle.
  const distance = Math.abs(relative - 0.5) * 2
  return strength * (distance * distance - 0.25)
}

export interface NeedleResult {
  /** The position the needle was put at, as a fraction of the context. */
  relative: number
  /** The probability the reader attends to the needle. */
  attention: number
  /** Whether the reader found it. */
  found: boolean
}

/**
 * Put a needle in a context and see whether the reader finds it.
 *
 * The context is a set of distractors and one needle; the needle's token
 * matches the question's, and the distractors do not. The reader attends over
 * the context with the position prior on top, and the needle's share of the
 * attention is what decides whether it is found.
 */
export function findNeedle(
  options: ContextOptions & { position: number; questionWord: number; distractorWords: number[] },
): NeedleResult {
  const settings = { length: 100, positionStrength: 3, temperature: 1, seed: 1, ...options }
  const position = Math.max(0, Math.min(settings.length - 1, Math.round(settings.position)))
  const rng = createRng(settings.seed + position)

  // The context: the needle at its position, distractors everywhere else.
  const words: number[] = new Array<number>(settings.length).fill(0)
  for (let i = 0; i < settings.length; i++) {
    if (i === position) continue
    const distractor = settings.distractorWords[Math.floor(rng() * settings.distractorWords.length)] ?? 0
    words[i] = distractor
  }
  words[position] = settings.questionWord

  // The attention: the similarity of the question to each token, plus the
  // position prior.
  const scores = words.map((word, index) => {
    const similarity = word === settings.questionWord ? 1 : 0
    return (similarity + positionPrior(settings.length, settings.positionStrength, index)) / settings.temperature
  })
  const maximum = Math.max(...scores)
  const exponentials = scores.map((score) => Math.exp(score - maximum))
  const total = exponentials.reduce((a, b) => a + b, 0)
  const attention = (exponentials[position] ?? 0) / total

  return {
    relative: settings.length <= 1 ? 0 : position / (settings.length - 1),
    attention,
    found: attention > 1 / settings.length,
  }
}

/**
 * The accuracy of the retrieval-augmented reader, as a function of where the
 * evidence is.
 *
 * The retrieval pipeline is given the evidence: it puts the needle at the
 * position the retriever returned, which is the beginning of the context. The
 * long-context reader is given the same needle at every position, and the
 * reader has to find it wherever it is.
 */
export function needleCurve(
  options: ContextOptions & { questionWord: number; distractorWords: number[]; positions?: number },
): { relative: number; attention: number; found: boolean }[] {
  const settings = { length: 100, positionStrength: 3, temperature: 1, seed: 1, ...options }
  const count = settings.positions ?? 11
  const curve: { relative: number; attention: number; found: boolean }[] = []
  for (let i = 0; i < count; i++) {
    const relative = count === 1 ? 0.5 : i / (count - 1)
    const position = Math.round(relative * (settings.length - 1))
    curve.push(
      findNeedle({
        ...settings,
        position,
        questionWord: settings.questionWord,
        distractorWords: settings.distractorWords,
      }),
    )
  }
  return curve
}

export interface RagResult {
  /** Whether the reader found the evidence. */
  found: boolean
  /** The attention the reader paid to the evidence. */
  attention: number
  /** Where the evidence was put in the context. */
  position: number
}

/**
 * The retrieval-augmented reader.
 *
 * The retriever returns the evidence, and the evidence is put at the start of
 * the context. The reader then has to find it, and the position prior means
 * that it will.
 */
export function readWithRetrieval(
  options: ContextOptions & {
    questionWord: number
    distractorWords: number[]
    retrieved: boolean
    position?: number
  },
): RagResult {
  const settings = { length: 100, positionStrength: 3, temperature: 1, seed: 1, ...options }
  const position = settings.position ?? 0
  if (!settings.retrieved) {
    // The evidence is not there at all, and the reader can only attend to the
    // distractors.
    return { found: false, attention: 0, position }
  }
  const result = findNeedle({
    ...settings,
    position,
    questionWord: settings.questionWord,
    distractorWords: settings.distractorWords,
  })
  return { found: result.found, attention: result.attention, position }
}

/**
 * The accuracy of a long-context reader, against the accuracy of a reader that
 * is given the evidence by retrieval.
 *
 * The two numbers are the argument of the paper in one line: the long context
 * is not a substitute for the retrieval.
 */
export function compareReaders(
  options: ContextOptions & { questionWord: number; distractorWords: number[]; positions?: number },
): { longContext: number; retrieval: number } {
  const settings = { length: 100, positionStrength: 3, temperature: 1, seed: 1, ...options }
  const curve = needleCurve(settings)
  const longContext = curve.filter((point) => point.found).length / Math.max(1, curve.length)
  const retrieval =
    readWithRetrieval({
      ...settings,
      retrieved: true,
      position: 0,
      questionWord: settings.questionWord,
      distractorWords: settings.distractorWords,
    }).found
    ? 1
    : 0
  return { longContext, retrieval }
}
