/**
 * The contrastive model.
 *
 * Two encoders — one for the image, one for the text — and a loss that says
 * the two members of a pair should be closer to each other than to any of the
 * other pairs in the batch. Everything the paper's method buys comes from that
 * one sentence: a shared space, learned from pairs, with no labels at all.
 *
 * The implementation here is small enough to be exact: the encoders are linear
 * maps over one-hot inputs, the dataset is generated, and the gradient of the
 * contrastive loss is derived by hand and checked against a finite difference.
 */

import { createRng } from '@llm-materials/course-core'

export const CLASSES = ['cat', 'dog', 'car', 'plane', 'tree', 'lamp'] as const
export const CLASS_COUNT = CLASSES.length

export interface Pair {
  /** The index of the class the pair is about. */
  label: number
  /** The image: a one-hot vector over the pixels. */
  image: number[]
  /** The caption: a one-hot vector over the words. */
  caption: number[]
}

export interface DatasetOptions {
  /** The number of pairs. */
  size?: number
  /** The number of pixels. */
  pixels?: number
  /** The number of words. */
  words?: number
  /** The seed. */
  seed?: number
}

/**
 * The dataset.
 *
 * Every class owns a few pixels and a few words, and a pair is one pixel and
 * one word from the same class. The two modalities share no features — a
 * pixel and a word are different one-hot spaces — and the only thing that
 * connects them is the class.
 */
export function buildPairs(options: DatasetOptions = {}): Pair[] {
  const settings = { size: 240, pixels: 24, words: 30, seed: 5, ...options }
  const rng = createRng(settings.seed)
  const pairs: Pair[] = []

  for (let i = 0; i < settings.size; i++) {
    const label = Math.floor(rng() * CLASS_COUNT)
    const image = new Array<number>(settings.pixels).fill(0)
    const caption = new Array<number>(settings.words).fill(0)
    for (let k = 0; k < 4; k++) {
      image[(label * 3 + k) % settings.pixels] = 1
      caption[(label * 4 + k) % settings.words] = 1
    }
    for (let k = 0; k < 2; k++) image[Math.floor(rng() * settings.pixels)] = 1
    for (let k = 0; k < 2; k++) caption[Math.floor(rng() * settings.words)] = 1
    pairs.push({ label, image, caption })
  }

  return pairs
}

export interface Encoder {
  /** The projection from the input to the embedding. */
  w: number[][]
  /** The bias. */
  b: number[]
  /** The dimension of the embedding. */
  dimension: number
}

/** A random projection, which is where the training starts. */
export function randomEncoder(inputs: number, dimension: number, seed = 1): Encoder {
  const rng = createRng(seed)
  const w: number[][] = []
  for (let i = 0; i < inputs; i++) {
    const row: number[] = []
    for (let d = 0; d < dimension; d++) row.push((rng() * 2 - 1) * 0.05)
    w.push(row)
  }
  return { w, b: new Array<number>(dimension).fill(0), dimension }
}

/** The embedding of an input, as a plain array. */
export function embed(encoder: Encoder, input: number[]): number[] {
  const result = new Array<number>(encoder.dimension).fill(0)
  for (let i = 0; i < input.length; i++) {
    const weight = input[i] ?? 0
    if (weight === 0) continue
    const row = encoder.w[i]!
    for (let d = 0; d < encoder.dimension; d++) result[d] = (result[d] ?? 0) + weight * (row[d] ?? 0)
  }
  return result.map((value, index) => value + (encoder.b[index] ?? 0))
}

/** The inner product of two embeddings. */
export function dot(a: number[], b: number[]): number {
  let total = 0
  for (let i = 0; i < Math.min(a.length, b.length); i++) total += (a[i] ?? 0) * (b[i] ?? 0)
  return total
}

/** The cosine similarity of two embeddings. */
export function cosine(a: number[], b: number[]): number {
  const normA = Math.sqrt(a.reduce((sum, value) => sum + value * value, 0))
  const normB = Math.sqrt(b.reduce((sum, value) => sum + value * value, 0))
  if (normA === 0 || normB === 0) return 0
  return dot(a, b) / (normA * normB)
}

/* -------------------------------------------------------------------------- */
/* The loss and its gradient                                                    */
/* -------------------------------------------------------------------------- */

export interface Batch {
  images: number[][]
  captions: number[][]
}

/** The similarities of every image with every caption. */
export function similarityMatrix(
  image: Encoder,
  text: Encoder,
  batch: Batch,
): number[][] {
  const imageEmbeddings = batch.images.map((input) => embed(image, input))
  const textEmbeddings = batch.captions.map((input) => embed(text, input))
  return imageEmbeddings.map((imageEmbedding) =>
    textEmbeddings.map((textEmbedding) => dot(imageEmbedding, textEmbedding)),
  )
}

/** The contrastive loss of a batch. */
export function contrastiveLoss(
  image: Encoder,
  text: Encoder,
  batch: Batch,
  temperature: number,
): number {
  const logits = similarityMatrix(image, text, batch)
  const size = logits.length
  if (size === 0) return 0
  let loss = 0
  for (let i = 0; i < size; i++) {
    const row = logits[i]!
    const maximum = Math.max(...row)
    const exponentials = row.map((value) => Math.exp((value - maximum) / temperature))
    const total = exponentials.reduce((a, b) => a + b, 0)
    loss -= Math.log(Math.max(exponentials[i] ?? 1e-12, 1e-12) / total)
  }
  return loss / size
}

export interface TemperaturePoint {
  /** The temperature the row was computed at. */
  temperature: number
  /** The contrastive loss at that temperature. */
  loss: number
  /** The mean softmax probability of the caption each image was paired with. */
  matchedProbability: number
  /** The mean entropy of the distribution over the batch, in nats. */
  entropy: number
  /** exp(entropy): how many captions the distribution behaves as if it were spread over. */
  effectiveNegatives: number
}

/**
 * What the temperature does to one fixed batch.
 *
 * The similarities do not change; only the divisor does. A small temperature
 * turns each row into a near one-hot choice, so the matched caption holds
 * almost all of the probability and the loss falls — along with the gradient,
 * which carries the same 1/τ. A large one flattens the row towards the uniform
 * distribution, where the matched caption holds 1/B and the loss is log B.
 *
 * The entropy is the measurement that makes the trade visible: it runs from
 * zero (one caption) to log B (all of them), and exp(entropy) is the number of
 * captions the row is effectively spread over.
 */
export function temperatureSweep(
  image: Encoder,
  text: Encoder,
  batch: Batch,
  temperatures: number[] = [0.05, 0.1, 0.25, 0.5, 1, 2],
): TemperaturePoint[] {
  const logits = similarityMatrix(image, text, batch)
  const size = logits.length
  if (size === 0) {
    return temperatures.map((temperature) => ({
      temperature,
      loss: 0,
      matchedProbability: 0,
      entropy: 0,
      effectiveNegatives: 1,
    }))
  }

  return temperatures.map((temperature) => {
    const tau = Math.max(temperature, 1e-6)
    let loss = 0
    let matched = 0
    let entropy = 0
    for (let i = 0; i < size; i++) {
      const row = logits[i]!
      const maximum = Math.max(...row)
      const exponentials = row.map((value) => Math.exp((value - maximum) / tau))
      const total = exponentials.reduce((sum, value) => sum + value, 0)
      const probabilities = exponentials.map((value) => value / total)
      loss -= Math.log(Math.max(probabilities[i] ?? 1e-12, 1e-12))
      matched += probabilities[i] ?? 0
      for (const probability of probabilities) {
        if (probability > 0) entropy -= probability * Math.log(probability)
      }
    }
    const meanEntropy = entropy / size
    return {
      temperature,
      loss: loss / size,
      matchedProbability: matched / size,
      entropy: meanEntropy,
      effectiveNegatives: Math.exp(meanEntropy),
    }
  })
}

/**
 * The gradient of the contrastive loss.
 *
 * The softmax over the captions gives the probability of each pairing; the
 * gradient of the cross-entropy is that probability minus the indicator of the
 * true pairing, and the chain rule through the similarities gives the
 * gradient with respect to the two embedding matrices.
 */
export function contrastiveGradient(
  image: Encoder,
  text: Encoder,
  batch: Batch,
  temperature: number,
): { imageW: number[][]; imageB: number[]; textW: number[][]; textB: number[] } {
  const logits = similarityMatrix(image, text, batch)
  const size = logits.length
  const dimension = image.dimension
  const imageGradient = Array.from({ length: size }, () => new Array<number>(dimension).fill(0))
  const textGradient = Array.from({ length: size }, () => new Array<number>(dimension).fill(0))

  for (let i = 0; i < size; i++) {
    const row = logits[i]!
    const maximum = Math.max(...row)
    const exponentials = row.map((value) => Math.exp((value - maximum) / temperature))
    const total = exponentials.reduce((a, b) => a + b, 0)
    for (let j = 0; j < size; j++) {
      const probability = (exponentials[j] ?? 0) / total
      const delta = (probability - (i === j ? 1 : 0)) / (size * temperature)
      if (delta === 0) continue
      const textEmbedding = embed(text, batch.captions[j]!)
      const imageEmbedding = embed(image, batch.images[i]!)
      for (let d = 0; d < dimension; d++) {
        imageGradient[i]![d] = (imageGradient[i]![d] ?? 0) + delta * (textEmbedding[d] ?? 0)
        textGradient[j]![d] = (textGradient[j]![d] ?? 0) + delta * (imageEmbedding[d] ?? 0)
      }
    }
  }

  // The gradient with respect to the parameters of each encoder.
  const imageW = image.w.map(() => new Array<number>(dimension).fill(0))
  const imageB = new Array<number>(dimension).fill(0)
  for (let i = 0; i < size; i++) {
    for (let d = 0; d < dimension; d++) {
      imageB[d] = (imageB[d] ?? 0) + (imageGradient[i]?.[d] ?? 0)
      for (let f = 0; f < image.w.length; f++) {
        imageW[f]![d] = (imageW[f]![d] ?? 0) + (imageGradient[i]?.[d] ?? 0) * (batch.images[i]?.[f] ?? 0)
      }
    }
  }

  const textW = text.w.map(() => new Array<number>(dimension).fill(0))
  const textB = new Array<number>(dimension).fill(0)
  for (let j = 0; j < size; j++) {
    for (let d = 0; d < dimension; d++) {
      textB[d] = (textB[d] ?? 0) + (textGradient[j]?.[d] ?? 0)
      for (let f = 0; f < text.w.length; f++) {
        textW[f]![d] = (textW[f]![d] ?? 0) + (textGradient[j]?.[d] ?? 0) * (batch.captions[j]?.[f] ?? 0)
      }
    }
  }

  return { imageW, imageB, textW, textB }
}

/* -------------------------------------------------------------------------- */
/* The training                                                                */
/* -------------------------------------------------------------------------- */

export interface TrainingOptions {
  /** The dimension of the embedding. */
  dimension?: number
  /** The number of gradient steps. */
  steps?: number
  /** The learning rate. */
  learningRate?: number
  /** The temperature. */
  temperature?: number
  /** The batch size. */
  batchSize?: number
  /** The seed. */
  seed?: number
}

export interface TrainingResult {
  /** The image encoder. */
  image: Encoder
  /** The text encoder. */
  text: Encoder
  /** The loss at each step. */
  history: number[]
  /** The fraction of pairs retrieved correctly, image to text. */
  retrieval: number
}

/** Train the two encoders with the contrastive loss. */
export function trainContrastive(pairs: Pair[], options: TrainingOptions = {}): TrainingResult {
  const settings = {
    dimension: 32,
    steps: 800,
    learningRate: 0.8,
    temperature: 0.5,
    batchSize: 24,
    seed: 2,
    ...options,
  }
  const rng = createRng(settings.seed)
  let image = randomEncoder(pairs[0]?.image.length ?? 24, settings.dimension, settings.seed)
  let text = randomEncoder(pairs[0]?.caption.length ?? 30, settings.dimension, settings.seed + 1)
  const history: number[] = []

  for (let step = 0; step < settings.steps; step++) {
    const chosen: number[] = []
    while (chosen.length < Math.min(settings.batchSize, pairs.length)) {
      const index = Math.floor(rng() * pairs.length)
      if (!chosen.includes(index)) chosen.push(index)
    }
    const batch: Batch = {
      images: chosen.map((index) => pairs[index]!.image),
      captions: chosen.map((index) => pairs[index]!.caption),
    }

    const loss = contrastiveLoss(image, text, batch, settings.temperature)
    const gradient = contrastiveGradient(image, text, batch, settings.temperature)

    // The learning rate decays, so the run settles instead of oscillating.
    // The gradient carries a factor of 1/τ, so below the temperature the rate
    // was calibrated at the step is scaled down with it; otherwise a cold
    // setting turns the same step into an explosion.
    const calibration = Math.min(1, settings.temperature / 0.5)
    const rate = (settings.learningRate * calibration) / Math.sqrt(1 + step / 60)

    const nextImageW = image.w.map((row) => row.slice())
    for (let f = 0; f < nextImageW.length; f++) {
      for (let d = 0; d < settings.dimension; d++) {
        nextImageW[f]![d] = (nextImageW[f]![d] ?? 0) - rate * (gradient.imageW[f]?.[d] ?? 0)
      }
    }
    const nextTextW = text.w.map((row) => row.slice())
    for (let f = 0; f < nextTextW.length; f++) {
      for (let d = 0; d < settings.dimension; d++) {
        nextTextW[f]![d] = (nextTextW[f]![d] ?? 0) - rate * (gradient.textW[f]?.[d] ?? 0)
      }
    }
    image = { ...image, w: nextImageW }
    text = { ...text, w: nextTextW }
    history.push(loss)
  }

  // The retrieval is measured against a fixed number of candidates, the way a
  // real index is: the top one among forty is a meaningful number.
  return { image, text, history, retrieval: retrievalAccuracy(pairs, image, text, { limit: 40 }) }
}

/**
 * The retrieval accuracy.
 *
 * For every image, the caption it should go with is the closest one, and the
 * fraction that is right is the score.
 */
export function retrievalAccuracy(
  pairs: Pair[],
  image: Encoder,
  text: Encoder,
  options: { limit?: number } = {},
): number {
  const limit = options.limit ?? pairs.length
  let correct = 0
  const imageEmbeddings = pairs.slice(0, limit).map((pair) => embed(image, pair.image))
  const textEmbeddings = pairs.slice(0, limit).map((pair) => embed(text, pair.caption))
  for (let i = 0; i < limit; i++) {
    let best = -Infinity
    let bestIndex = -1
    for (let j = 0; j < limit; j++) {
      const score = dot(imageEmbeddings[i]!, textEmbeddings[j]!)
      if (score > best) {
        best = score
        bestIndex = j
      }
    }
    if (bestIndex === i) correct++
  }
  return limit === 0 ? 0 : correct / limit
}

/* -------------------------------------------------------------------------- */
/* The modality gap                                                             */
/* -------------------------------------------------------------------------- */

export interface GapReport {
  /** The mean similarity between two images. */
  withinImages: number
  /** The mean similarity between two captions. */
  withinText: number
  /** The mean similarity between an image and a caption. */
  between: number
  /** The gap: the mean within-modal similarity minus the between-modal one. */
  gap: number
}

/** The modality gap. */
export function modalityGap(
  pairs: Pair[],
  image: Encoder,
  text: Encoder,
  options: { limit?: number } = {},
): GapReport {
  const limit = options.limit ?? Math.min(80, pairs.length)
  const imageEmbeddings = pairs.slice(0, limit).map((pair) => embed(image, pair.image))
  const textEmbeddings = pairs.slice(0, limit).map((pair) => embed(text, pair.caption))

  const meanWithin = (embeddings: number[][]) => {
    let total = 0
    let count = 0
    for (let i = 0; i < embeddings.length; i++) {
      for (let j = i + 1; j < embeddings.length; j++) {
        total += cosine(embeddings[i]!, embeddings[j]!)
        count++
      }
    }
    return count === 0 ? 0 : total / count
  }

  let between = 0
  for (const imageEmbedding of imageEmbeddings) {
    for (const textEmbedding of textEmbeddings) {
      between += cosine(imageEmbedding, textEmbedding)
    }
  }
  between = imageEmbeddings.length === 0 ? 0 : between / (imageEmbeddings.length * textEmbeddings.length)

  const withinImages = meanWithin(imageEmbeddings)
  const withinText = meanWithin(textEmbeddings)
  return { withinImages, withinText, between, gap: (withinImages + withinText) / 2 - between }
}

/* -------------------------------------------------------------------------- */
/* The zero-shot classifier                                                     */
/* -------------------------------------------------------------------------- */

/** The prompt templates, and what they are worth. */
export const PROMPTS = [
  'a photo of a {}.',
  'a blurry photo of a {}.',
  'a photo of the {}.',
  'a close-up photo of a {}.',
]

/**
 * The zero-shot classifier.
 *
 * The class names are written out, embedded with the text encoder, and the
 * image is assigned to the closest of them. The prompt is part of the method,
 * and the laboratory measures what each template is worth.
 */
export function zeroShot(
  pairs: Pair[],
  image: Encoder,
  text: Encoder,
  options: { prompt?: string; limit?: number } = {},
): number {
  const settings = { prompt: PROMPTS[0]!, limit: pairs.length, ...options }
  const classEmbeddings = CLASSES.map((name) => {
    const caption = new Array<number>(text.w.length).fill(0)
    const template = settings.prompt.replace('{}', name)
    for (let i = 0; i < template.length; i++) {
      caption[i % caption.length] = (caption[i % caption.length] ?? 0) + 1
    }
    return embed(text, caption)
  })

  const limit = Math.min(settings.limit, pairs.length)
  let correct = 0
  for (let i = 0; i < limit; i++) {
    const embedding = embed(image, pairs[i]!.image)
    let best = -Infinity
    let bestIndex = -1
    for (let c = 0; c < classEmbeddings.length; c++) {
      const score = dot(embedding, classEmbeddings[c]!)
      if (score > best) {
        best = score
        bestIndex = c
      }
    }
    if (bestIndex === pairs[i]!.label) correct++
  }
  return limit === 0 ? 0 : correct / limit
}
