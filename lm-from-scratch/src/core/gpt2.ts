/**
 * The GPT-2 byte-level byte-pair encoding, reproduced from its published merge table.
 *
 * This is not a tokeniser *like* the one in production: it is the one in
 * production. GPT-2's vocabulary is 50,257 tokens — the 256 byte symbols, the
 * 50,000 merges in `gpt2-vocab.bpe`, and the end-of-text marker — and the ids
 * below are GPT-2's ids, so `encodeGpt2('hello')` is `[31373]` for the same
 * reason it is in the released model.
 *
 * The merge table is OpenAI's, released with the model under the MIT licence;
 * `src/content/sources.ts` records the provenance. Two facts make the table
 * enough to reproduce the encoding without the 1 MB `encoder.json`:
 *
 * - the 256 base ids are the byte-to-unicode symbols sorted by code point, so
 *   the base vocabulary can be rebuilt from the byte mapping alone;
 * - every merged token's id is 256 plus its rank in the merge table.
 *
 * The text is split with GPT-2's own pre-tokenisation pattern before the merges
 * are applied, because the merges are defined per word: running the merge
 * procedure across a word boundary would produce tokens the released tokeniser
 * cannot produce.
 */

import mergeTable from '../content/gpt2-vocab.bpe?raw'
import type { TokenizedCorpus } from './tokenizer'

/** GPT-2's vocabulary: 256 bytes + 50,000 merges + the end-of-text token. */
export const GPT2_VOCAB_SIZE = 50257

/** The id of `<|endoftext|>`, the only token the merge table does not produce. */
export const GPT2_END_OF_TEXT = 50256

/**
 * GPT-2's byte-to-unicode mapping.
 *
 * The point of the mapping is that every one of the 256 bytes becomes a
 * printable character, so a merge table can be written as text. The printable
 * ranges map to themselves; the remaining 68 bytes map to code points 256–323
 * in byte order.
 */
const BYTE_TO_CHAR: string[] = []
const CHAR_TO_BYTE = new Map<string, number>()
{
  const mapped: number[] = []
  for (let byte = 0; byte < 256; byte++) {
    if ((byte >= 0x21 && byte <= 0x7e) || (byte >= 0xa1 && byte <= 0xac) || (byte >= 0xae && byte <= 0xff)) {
      mapped.push(byte)
    }
  }
  const chars: number[] = mapped.slice()
  let extra = 0
  for (let byte = 0; byte < 256; byte++) {
    if (!mapped.includes(byte)) {
      mapped.push(byte)
      chars.push(256 + extra)
      extra++
    }
  }
  for (let index = 0; index < mapped.length; index++) {
    const char = String.fromCodePoint(chars[index]!)
    BYTE_TO_CHAR[mapped[index]!] = char
    CHAR_TO_BYTE.set(char, mapped[index]!)
  }
}

/** The base tokens in id order: the byte symbols sorted by code point. */
const BASE_TOKENS: string[] = [...BYTE_TO_CHAR].sort((a, b) => a.codePointAt(0)! - b.codePointAt(0)!)
const BASE_IDS = new Map(BASE_TOKENS.map((token, id) => [token, id]))

/** The merges, in rank order. Every line is a pair of token strings. */
const MERGES: [string, string][] = []
for (const line of mergeTable.split('\n')) {
  // Only the header starts with `#`; a merge line can begin with the `#`
  // token itself, and skipping those would shift every rank after them.
  if (line.length === 0 || line.startsWith('#version')) continue
  const space = line.indexOf(' ')
  MERGES.push([line.slice(0, space), line.slice(space + 1)])
}

/** The rank of a pair, which is also its id minus 256. */
const RANKS = new Map<string, number>()
MERGES.forEach(([left, right], rank) => RANKS.set(left + '\u0000' + right, rank))

/**
 * GPT-2's pre-tokenisation.
 *
 * Contractions are kept together, words carry their leading space, numbers are
 * split from letters, and whitespace runs are their own tokens. The pattern is
 * the one in OpenAI's encoder; the `u` flag is what makes `\p{L}` mean
 * "any letter" rather than the ASCII subset.
 */
export const GPT2_PATTERN =
  /'s|'t|'re|'ve|'m|'ll|'d| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+/gu

/** The text of a token id, as GPT-2's vocabulary spells it. */
export function gpt2TokenText(id: number): string {
  if (!Number.isInteger(id) || id < 0 || id >= GPT2_VOCAB_SIZE) {
    throw new RangeError(`gpt2TokenText: ${id} is not a GPT-2 token id`)
  }
  if (id === GPT2_END_OF_TEXT) return '<|endoftext|>'
  if (id < 256) return BASE_TOKENS[id]!
  return MERGES[id - 256]!.join('')
}

/** The bytes a token id stands for. */
export function gpt2TokenBytes(id: number): Uint8Array {
  const text = gpt2TokenText(id)
  const bytes: number[] = []
  for (const char of text) {
    const byte = CHAR_TO_BYTE.get(char)
    if (byte !== undefined) bytes.push(byte)
  }
  return Uint8Array.from(bytes)
}

/** The merge procedure, applied to one pre-tokenised piece of text. */
function encodePiece(piece: string): number[] {
  const bytes = new TextEncoder().encode(piece)
  let symbols: { text: string; id: number }[] = []
  for (const byte of bytes) {
    const text = BYTE_TO_CHAR[byte]!
    symbols.push({ text, id: BASE_IDS.get(text)! })
  }

  while (symbols.length > 1) {
    let bestRank = Number.POSITIVE_INFINITY
    let bestIndex = -1
    for (let index = 0; index + 1 < symbols.length; index++) {
      const rank = RANKS.get(symbols[index]!.text + '\u0000' + symbols[index + 1]!.text)
      if (rank !== undefined && rank < bestRank) {
        bestRank = rank
        bestIndex = index
      }
    }
    if (bestIndex < 0) break

    // The pair's rank is its token id once merged, and the merge applies to
    // every occurrence of the pair in the piece.
    const left = symbols[bestIndex]!.text
    const right = symbols[bestIndex + 1]!.text
    const merged = { text: left + right, id: 256 + bestRank }
    const next: { text: string; id: number }[] = []
    for (let index = 0; index < symbols.length; ) {
      if (
        index + 1 < symbols.length &&
        symbols[index]!.text === left &&
        symbols[index + 1]!.text === right
      ) {
        next.push(merged)
        index += 2
      } else {
        next.push(symbols[index]!)
        index++
      }
    }
    symbols = next
  }

  return symbols.map((symbol) => symbol.id)
}

/** Encode text with GPT-2's tokeniser. */
export function encodeGpt2(text: string): number[] {
  const ids: number[] = []
  for (const match of text.matchAll(GPT2_PATTERN)) {
    ids.push(...encodePiece(match[0]))
  }
  return ids
}

/** Decode GPT-2 ids back into text. */
export function decodeGpt2(ids: readonly number[]): string {
  const bytes: number[] = []
  for (const id of ids) {
    for (const byte of gpt2TokenBytes(id)) bytes.push(byte)
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Uint8Array.from(bytes))
}

/** One token, for display: its id, its vocabulary spelling and its bytes. */
export interface Gpt2Segment {
  id: number
  /** The token as the vocabulary spells it — spaces appear as `Ġ`. */
  text: string
  /** The characters a reader should see, with the space marker drawn as `·`. */
  display: string
  bytes: number
}

/** A passage, tokenised and ready to display. */
export function gpt2Segments(text: string): Gpt2Segment[] {
  return encodeGpt2(text).map((id) => {
    const vocabularyText = gpt2TokenText(id)
    return {
      id,
      text: vocabularyText,
      display: vocabularyText.replaceAll('Ġ', '·').replaceAll('Ċ', '⏎'),
      bytes: gpt2TokenBytes(id).length,
    }
  })
}

/** Tokenise a text and report the statistics that matter. */
export function tokenizeWithGpt2(text: string): TokenizedCorpus {
  const ids = encodeGpt2(text)
  const bytes = new TextEncoder().encode(text).length
  return {
    ids,
    bytes,
    tokens: ids.length,
    bytesPerToken: ids.length === 0 ? 0 : bytes / ids.length,
    distinctTokens: new Set(ids).size,
  }
}
