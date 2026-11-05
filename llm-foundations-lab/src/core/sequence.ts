/**
 * Three ways to mix information across a sequence, compared on the quantities
 * that decided the argument: how far the signal travels, how much each layer
 * costs, and whether the whole sequence can be computed at once.
 *
 * The comparisons are exact for the idealised architectures and asymptotic
 * (constants dropped) — they are the standard reading of the convolutional,
 * recurrent and attention layers, computed rather than quoted so the numbers
 * move with the sequence length and the kernel width.
 */

export type SequenceKind = 'cnn' | 'rnn' | 'attention'

export interface SequenceRow {
  kind: SequenceKind
  name: string
  /** The longest path a signal travels between two positions, in layers or steps. */
  path: number
  /** How many previous positions one output can see, in tokens. */
  receptiveField: number
  /** Whether a whole sequence is computed in parallel. */
  parallel: boolean
  /** Multiply-adds for one layer over the sequence. */
  work: number
}

/**
 * The comparison at a sequence length `n` and a convolution kernel `kernel`.
 *
 * A convolutional stack covers the sequence in ceil(log_kernel(n)) layers, so
 * its path grows logarithmically; an RNN needs one step per position, so its
 * path is linear and it cannot be parallelised across time; attention connects
 * every pair in one layer, so its path is one — and its work is quadratic.
 */
export function sequenceComparison(n: number, kernel = 3): SequenceRow[] {
  const length = Math.max(1, Math.floor(n))
  const width = Math.max(2, Math.floor(kernel))
  return [
    {
      kind: 'cnn',
      name: 'Convolution',
      path: convolutionDepth(length, width),
      receptiveField: length,
      parallel: true,
      work: length * width,
    },
    {
      kind: 'rnn',
      name: 'Recurrence',
      path: length,
      receptiveField: length,
      parallel: false,
      work: length,
    },
    {
      kind: 'attention',
      name: 'Attention',
      path: 1,
      receptiveField: length,
      parallel: true,
      work: length * length,
    },
  ]
}

/** The layers a convolutional stack needs to see the whole sequence. */
export function convolutionDepth(n: number, kernel = 3): number {
  const length = Math.max(1, Math.floor(n))
  const width = Math.max(2, Math.floor(kernel))
  // log(9) / log(3) is 2.0000000000000004 in floating point; the epsilon keeps
  // exact powers of the kernel from needing one layer too many.
  return Math.ceil(Math.log(length) / Math.log(width) - 1e-12)
}

/** Attention's work as a multiple of recurrence's, for one layer. */
export function attentionWorkRatio(n: number): number {
  return Math.max(1, Math.floor(n))
}
