/**
 * Instruction tuning, and the tax it pays.
 *
 * Tuning a model on instructions makes it better at following them and
 * something else at everything it was good at before. The second effect has a
 * name — the alignment tax — and it is a measurement, not a slogan: the
 * accuracy the model had on the original task, before and after.
 *
 * The experiment here is small and exact. A model is a rule over a task; the
 * tuning makes it better at the instructions and slightly worse at the task it
 * came from; and the tax is the difference, measured on held-out data.
 */

export interface InstructionExample {
  /** The instruction. */
  instruction: string
  /** The answer the instruction calls for. */
  target: string
  /** The answer the original task called for. */
  original: string
}

export interface TuningOptions {
  /** How strongly the tuning moves the model. */
  strength?: number
  /** The seed. */
  seed?: number
}

export interface TaxReport {
  /** The accuracy at the instructions, before and after. */
  beforeInstructions: number
  afterInstructions: number
  /** The accuracy at the original task, before and after. */
  beforeOriginal: number
  afterOriginal: number
  /** The tax: the accuracy given up on the original task. */
  tax: number
  /** The gain: the accuracy gained on the instructions. */
  gain: number
  /** The ratio of the two. */
  ratio: number
}

/**
 * A synthetic set of instructions.
 *
 * Each example has an instruction the model does not follow, a target it
 * should produce, and the original answer it would have produced.
 */
export function buildInstructions(count = 60, seed = 4): InstructionExample[] {
  void seed
  const examples: InstructionExample[] = []
  for (let i = 0; i < count; i++) {
    examples.push({
      instruction: `answer the question in the form "the answer is ${i}"`,
      target: `the answer is ${i}`,
      original: `${i}`,
    })
  }
  return examples
}

/**
 * The model's behaviour, before and after the tuning.
 *
 * The model is a rule: it follows the instruction when the instruction is
 * present and the tuning has taught it to, and it answers the original way
 * otherwise. The tuning moves the first behaviour up and the second down.
 */
export function measureTax(
  examples: InstructionExample[],
  options: TuningOptions = {},
): TaxReport {
  const settings = { strength: 0.5, seed: 4, ...options }
  const total = Math.max(1, examples.length)

  // Before the tuning the model ignores the instruction: it answers the
  // original way, every time.
  const beforeInstructions = 0
  const beforeOriginal = 1

  let following = 0
  let displaced = 0
  for (const example of examples) {
    const follows = pseudoRandom(settings.seed, example.instruction) < settings.strength
    if (follows) {
      following++
      // Following the instruction is what displaces the original behaviour.
      if (pseudoRandom(settings.seed + 1, example.instruction) < settings.strength) displaced++
    }
  }

  const afterInstructions = following / total
  const afterOriginal = 1 - displaced / total
  const gain = afterInstructions - beforeInstructions
  const tax = beforeOriginal - afterOriginal
  return {
    beforeInstructions,
    afterInstructions,
    beforeOriginal,
    afterOriginal,
    tax,
    gain,
    ratio: gain === 0 ? 0 : tax / gain,
  }
}

/** A deterministic pseudo-random number in the unit interval, from a string. */
function pseudoRandom(seed: number, key: string): number {
  let hash = seed >>> 0
  for (let i = 0; i < key.length; i++) {
    hash = Math.imul(hash ^ key.charCodeAt(i), 0x01000193) >>> 0
  }
  return (hash % 100000) / 100000
}

/**
 * The curve of the tax against the strength of the tuning.
 *
 * The gain rises with the strength and so does the tax, and the ratio between
 * them is the number a practitioner is shopping for.
 */
export function taxCurve(
  examples: InstructionExample[],
  strengths: number[],
  options: TuningOptions = {},
): { strength: number; gain: number; tax: number; ratio: number }[] {
  return strengths.map((strength) => {
    const report = measureTax(examples, { ...options, strength })
    return { strength, gain: report.gain, tax: report.tax, ratio: report.ratio }
  })
}
