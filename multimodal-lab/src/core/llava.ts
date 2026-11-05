/**
 * The projection and the instruction data.
 *
 * LLaVA turns a frozen vision encoder's tokens into tokens a language model can
 * read with one learned linear map — the projection — and trains that map on
 * instruction data written from image captions. This module computes both at a
 * size small enough to print: the projection's dimensions and its parameter
 * count, and a deterministic generator that turns a caption into questions and
 * exact answers.
 *
 * The weights are seeded and illustrative, not trained. What is exact is the
 * arithmetic: the matrix has one row per vision dimension and one column per
 * language dimension, so its parameter count depends on the two widths and not
 * on how many tokens are projected, and every generated answer is a function of
 * the caption it came from.
 */

import { createRng } from '@llm-materials/course-core'

/* -------------------------------------------------------------------------- */
/* The projection                                                               */
/* -------------------------------------------------------------------------- */

export interface ProjectionOptions {
  /** The width of a token from the vision encoder. */
  visionWidth?: number
  /** The width of a token in the language model. */
  languageWidth?: number
  /** How many visual tokens are projected. */
  tokens?: number
  seed?: number
}

export interface ProjectionReport {
  visionWidth: number
  languageWidth: number
  /** Visual tokens in, and the same number out: the projection changes width, not count. */
  tokens: number
  /** The entries of the matrix itself. */
  matrixParameters: number
  /** The output bias, one per language width. */
  biasParameters: number
  /** Matrix and bias together. */
  parameters: number
  /** The width of each output token. */
  outputWidth: number
}

const PROJECTION_DEFAULTS: Required<ProjectionOptions> = {
  visionWidth: 1024,
  languageWidth: 4096,
  tokens: 576,
  seed: 11,
}

/**
 * A seeded projection matrix: `visionWidth` rows of `languageWidth` entries.
 *
 * The scale is 1/√visionWidth, which is the scale a linear layer is usually
 * initialised at, so the projected coordinates are of unit-ish size rather
 * than growing with the input width.
 */
export function projectionMatrix(visionWidth: number, languageWidth: number, seed = 11): number[][] {
  if (visionWidth <= 0 || languageWidth <= 0) {
    throw new RangeError(`projectionMatrix: the widths must be positive, received ${visionWidth} × ${languageWidth}`)
  }
  const rng = createRng(seed)
  const scale = 1 / Math.sqrt(visionWidth)
  return Array.from({ length: visionWidth }, () =>
    Array.from({ length: languageWidth }, () => (rng() * 2 - 1) * scale),
  )
}

/** Apply the projection to one token: `Wᵀx + b`, or just `Wᵀx` without the bias. */
export function project(matrix: number[][], token: number[], bias?: number[]): number[] {
  const languageWidth = matrix[0]?.length ?? 0
  const result = new Array<number>(languageWidth).fill(0)
  for (let row = 0; row < Math.min(matrix.length, token.length); row++) {
    const weight = token[row] ?? 0
    if (weight === 0) continue
    const entries = matrix[row]!
    for (let column = 0; column < languageWidth; column++) {
      result[column] = (result[column] ?? 0) + weight * (entries[column] ?? 0)
    }
  }
  if (bias) {
    for (let column = 0; column < languageWidth; column++) {
      result[column] = (result[column] ?? 0) + (bias[column] ?? 0)
    }
  }
  return result
}

/** The dimensions and the bill of one linear projection. */
export function projectionReport(options: ProjectionOptions = {}): ProjectionReport {
  const { visionWidth, languageWidth, tokens } = { ...PROJECTION_DEFAULTS, ...options }
  if (visionWidth <= 0 || languageWidth <= 0) {
    throw new RangeError(`projectionReport: the widths must be positive, received ${visionWidth} × ${languageWidth}`)
  }
  if (tokens < 0) throw new RangeError(`projectionReport: the token count must not be negative, received ${tokens}`)
  const matrixParameters = visionWidth * languageWidth
  const biasParameters = languageWidth
  return {
    visionWidth,
    languageWidth,
    tokens,
    matrixParameters,
    biasParameters,
    parameters: matrixParameters + biasParameters,
    outputWidth: languageWidth,
  }
}

/* -------------------------------------------------------------------------- */
/* The instruction data                                                         */
/* -------------------------------------------------------------------------- */

export const SUBJECTS = ['cat', 'dog', 'horse', 'bird', 'robot', 'boat'] as const
export const OBJECTS = ['ball', 'lamp', 'book', 'cup', 'tree', 'kite'] as const
export const SUPPORTS = ['table', 'grass', 'snow', 'sand', 'floor'] as const

export interface Caption {
  subject: string
  object: string
  support: string
  /** The caption the instruction data is generated from. */
  text: string
}

/** A deterministic set of captions, each with a subject, an object and a surface. */
export function buildCaptions(count = 12, seed = 9): Caption[] {
  const rng = createRng(seed)
  const captions: Caption[] = []
  for (let index = 0; index < count; index++) {
    const subject = SUBJECTS[Math.floor(rng() * SUBJECTS.length)]!
    const object = OBJECTS[Math.floor(rng() * OBJECTS.length)]!
    const support = SUPPORTS[Math.floor(rng() * SUPPORTS.length)]!
    captions.push({
      subject,
      object,
      support,
      text: `a ${subject} and a ${object} on the ${support}.`,
    })
  }
  return captions
}

export type InstructionKind = 'describe' | 'presence' | 'absence' | 'count' | 'relation'

export interface GeneratedInstruction {
  /** The caption the pair was written from. */
  caption: string
  kind: InstructionKind
  question: string
  answer: string
}

/** An object the caption does not mention, so that the absence question has a true answer. */
function absentObject(caption: Caption): string {
  return OBJECTS.find((name) => name !== caption.object && name !== caption.subject) ?? 'lamp'
}

/**
 * The five instruction pairs one caption supports.
 *
 * Every answer is determined by the caption: which things are present, how many
 * objects there are, and what the subject is next to. The generator never
 * invents a fact, which is the property that makes caption-derived instruction
 * data cheap and checkable.
 */
export function instructionsFromCaption(caption: Caption): GeneratedInstruction[] {
  const absent = absentObject(caption)
  return [
    {
      caption: caption.text,
      kind: 'describe',
      question: 'What is in the image?',
      answer: `A ${caption.subject} and a ${caption.object} on the ${caption.support}.`,
    },
    {
      caption: caption.text,
      kind: 'presence',
      question: `Is there a ${caption.subject} in the image?`,
      answer: 'Yes.',
    },
    {
      caption: caption.text,
      kind: 'absence',
      question: `Is there a ${absent} in the image?`,
      answer: 'No.',
    },
    {
      caption: caption.text,
      kind: 'count',
      question: 'How many objects are there?',
      answer: '2.',
    },
    {
      caption: caption.text,
      kind: 'relation',
      question: `What is the ${caption.subject} next to?`,
      answer: `A ${caption.object}.`,
    },
  ]
}

export interface InstructionReport {
  captions: number
  total: number
  perCaption: number
  byKind: Record<InstructionKind, number>
}

/** Generate the pairs, and count what came out. */
export function generateInstructionData(captions: Caption[]): {
  data: GeneratedInstruction[]
  report: InstructionReport
} {
  const data = captions.flatMap(instructionsFromCaption)
  const byKind: Record<InstructionKind, number> = {
    describe: 0,
    presence: 0,
    absence: 0,
    count: 0,
    relation: 0,
  }
  for (const entry of data) byKind[entry.kind] += 1
  return {
    data,
    report: {
      captions: captions.length,
      total: data.length,
      perCaption: captions.length === 0 ? 0 : data.length / captions.length,
      byKind,
    },
  }
}

/**
 * Whether a generated answer is the one its caption implies.
 *
 * A small independent check, used by the test suite and by the laboratory: it
 * re-derives the answer from the caption rather than trusting the generator's
 * own branch.
 */
export function answerIsExact(entry: GeneratedInstruction): boolean {
  const match = entry.caption.match(/^a (\w+) and a (\w+) on the (\w+)\.$/)
  if (!match) return false
  const [, subject, object] = match
  switch (entry.kind) {
    case 'describe':
      return entry.answer.toLowerCase() === `a ${subject} and a ${object} on the ${match[3]}.`
    case 'presence':
      return entry.answer === 'Yes.' && entry.question.toLowerCase().includes(`a ${subject} `)
    case 'absence':
      return (
        entry.answer === 'No.' &&
        !entry.question.toLowerCase().includes(`a ${subject} `) &&
        !entry.question.toLowerCase().includes(`a ${object} `)
      )
    case 'count':
      return entry.answer === '2.'
    case 'relation':
      return entry.answer.toLowerCase() === `a ${object}.`
  }
}
