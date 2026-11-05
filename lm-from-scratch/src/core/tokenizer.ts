/**
 * Byte-pair encoding, trained from scratch.
 *
 * The tokeniser is the first thing you have to build, and the first thing
 * whose cost you have to pay. CS336's first lecture is entirely about it, and
 * the reasons are worth stating:
 *
 * - a vocabulary that is too small makes the model's embedding table enormous
 *   for no benefit, because the sequence gets correspondingly longer;
 * - a vocabulary that is too large makes the output softmax enormous;
 * - and the *bytes per token* ratio decides how many tokens your corpus
 *   becomes, which decides how much it costs to train on it.
 *
 * The implementation here is the standard merge procedure: start from bytes,
 * and repeatedly merge the most frequent adjacent pair until the vocabulary is
 * the size you asked for.
 */

import { createRng } from '@llm-materials/course-core'
import type { Rng } from '@llm-materials/course-core'

export interface Tokenizer {
  /** The merges, in the order they were learned. */
  merges: [number, number][]
  /** The vocabulary, from token 0 upwards. */
  vocabulary: string[]
  /** How many merges were learned. */
  size: number
}

export interface TokenizedCorpus {
  /** The corpus as token ids. */
  ids: number[]
  /** The number of bytes in the original corpus. */
  bytes: number
  /** The number of tokens the corpus became. */
  tokens: number
  /** Bytes per token. */
  bytesPerToken: number
  /** The number of distinct tokens used. */
  distinctTokens: number
}

/** The frequency of each adjacent pair in a sequence of token ids. */
export function pairFrequencies(ids: number[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (let i = 0; i + 1 < ids.length; i++) {
    const key = `${ids[i]},${ids[i + 1]}`
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/**
 * Train a byte-pair encoding on a corpus.
 *
 * `corpus` is the raw text. The bytes of the text become the initial tokens,
 * so the tokeniser never sees a character it cannot represent.
 */
export function trainTokenizer(corpus: string, vocabSize: number): Tokenizer {
  if (vocabSize < 256) {
    throw new RangeError(`trainTokenizer: a vocabulary of ${vocabSize} is smaller than the 256 bytes`)
  }

  // The initial vocabulary is the 256 single bytes.
  const vocabulary: string[] = []
  for (let i = 0; i < 256; i++) {
    vocabulary.push(byteToToken(i))
  }

  const ids = Array.from(new TextEncoder().encode(corpus))
  const merges: [number, number][] = []
  const mergeOrder = new Map<string, number>()

  while (vocabulary.length < vocabSize) {
    const frequencies = pairFrequencies(ids)
    if (frequencies.size === 0) break

    let bestKey = ''
    let bestCount = -1
    for (const [key, count] of frequencies) {
      // Ties are broken by the pair's ids, so the result does not depend on
      // the iteration order of the map.
      if (count > bestCount || (count === bestCount && key < bestKey)) {
        bestKey = key
        bestCount = count
      }
    }
    if (bestCount <= 0) break

    const [a, b] = bestKey.split(',').map(Number) as [number, number]
    const newId = vocabulary.length
    merges.push([a, b])
    mergeOrder.set(bestKey, newId)
    vocabulary.push(`<${newId}>`)

    // Apply the merge everywhere it occurs.
    const merged: number[] = []
    for (let i = 0; i < ids.length; ) {
      if (i + 1 < ids.length && ids[i] === a && ids[i + 1] === b) {
        merged.push(newId)
        i += 2
      } else {
        merged.push(ids[i]!)
        i++
      }
    }
    ids.length = 0
    for (const id of merged) ids.push(id)
  }

  return { merges, vocabulary, size: vocabulary.length }
}

/** The printable name of a single byte. */
function byteToToken(byte: number): string {
  if (byte >= 33 && byte <= 126) return String.fromCharCode(byte)
  if (byte === 32) return 'Ġ'
  if (byte === 10) return 'Ċ'
  if (byte === 13) return 'ĉ'
  if (byte === 9) return 'ĉ'
  if (byte < 32 || byte > 126) {
    return `<0x${byte.toString(16).padStart(2, '0').toUpperCase()}>`
  }
  return `<0x${byte.toString(16).padStart(2, '0').toUpperCase()}>`
}

/**
 * Encode a string with a trained tokeniser.
 *
 * The merges are applied in the order they were learned, which is what makes
 * the encoding deterministic and invertible.
 */
export function encode(tokenizer: Tokenizer, text: string): number[] {
  let ids = Array.from(new TextEncoder().encode(text))

  tokenizer.merges.forEach(([a, b], index) => {
    const newId = 256 + index
    const merged: number[] = []
    for (let i = 0; i < ids.length; ) {
      if (i + 1 < ids.length && ids[i] === a && ids[i + 1] === b) {
        merged.push(newId)
        i += 2
      } else {
        merged.push(ids[i]!)
        i++
      }
    }
    ids = merged
  })

  return ids
}

/** Decode token ids back into bytes. */
export function decode(tokenizer: Tokenizer, ids: number[]): Uint8Array {
  // Expand each id into the bytes it stands for, by reversing the merges.
  const byteOf = new Map<number, number[]>()
  for (let i = 0; i < 256; i++) byteOf.set(i, [i])
  tokenizer.merges.forEach(([a, b], index) => {
    byteOf.set(256 + index, [...(byteOf.get(a) ?? []), ...(byteOf.get(b) ?? [])])
  })

  const bytes: number[] = []
  for (const id of ids) {
    bytes.push(...(byteOf.get(id) ?? []))
  }
  return Uint8Array.from(bytes)
}

/** Tokenise a corpus and report the statistics that matter. */
export function tokenizeCorpus(tokenizer: Tokenizer, corpus: string): TokenizedCorpus {
  const ids = encode(tokenizer, corpus)
  const bytes = new TextEncoder().encode(corpus).length
  return {
    ids,
    bytes,
    tokens: ids.length,
    bytesPerToken: ids.length === 0 ? 0 : bytes / ids.length,
    distinctTokens: new Set(ids).size,
  }
}

/**
 * Train a tokeniser and report what it cost and what it bought.
 *
 * The two numbers that matter are the vocabulary size — which sets the size of
 * the embedding and the output matrices — and the bytes per token, which sets
 * how many tokens the corpus becomes and therefore how many tokens of
 * compute the training run costs.
 */
export interface TokenizerEconomics {
  vocabularySize: number
  bytesPerToken: number
  /** The tokens the corpus became, for a corpus of this size. */
  corpusTokens: number
  /** The parameters the embedding and output matrices need, for a given width. */
  embeddingParameters: number
  /** What the same corpus would have cost in tokens with a one-token-per-byte scheme. */
  naiveTokens: number
}

export function tokenizerEconomics(
  tokenizer: Tokenizer,
  corpus: string,
  modelWidth: number,
): TokenizerEconomics {
  const stats = tokenizeCorpus(tokenizer, corpus)
  return {
    vocabularySize: tokenizer.size,
    bytesPerToken: stats.bytesPerToken,
    corpusTokens: stats.tokens,
    embeddingParameters: tokenizer.size * modelWidth,
    naiveTokens: stats.bytes,
  }
}

/**
 * A generated corpus with a little structure, so the tokeniser has something
 * to find.
 *
 * The structure matters: a tokeniser trained on uniform noise learns nothing
 * useful, and the bytes-per-token ratio would be exactly one.
 */
export function generateCorpus(
  documents: number,
  wordsPerDocument: number,
  seed = 5,
  vocabularySize = 40,
): string {
  const rng = createRng(seed)
  const words: string[] = []
  for (let i = 0; i < vocabularySize; i++) {
    words.push(`word${i}`)
  }

  const parts: string[] = []
  for (let d = 0; d < documents; d++) {
    const sentences: string[] = []
    for (let s = 0; s < Math.max(1, Math.floor(wordsPerDocument / 8)); s++) {
      const length = 4 + Math.floor(rng() * 8)
      const sentence: string[] = []
      for (let w = 0; w < length; w++) {
        sentence.push(words[Math.floor(rng() * words.length)]!)
      }
      sentences.push(sentence.join(' '))
    }
    parts.push(sentences.join('. ') + '.')
  }
  return parts.join('\n\n')
}

/** A seeded generator, re-exported so the laboratories need one import. */
export { createRng }
export type { Rng }
