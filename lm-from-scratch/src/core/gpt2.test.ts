import { describe, expect, it } from 'vitest'
import {
  GPT2_VOCAB_SIZE,
  decodeGpt2,
  encodeGpt2,
  gpt2Segments,
  gpt2TokenText,
  tokenizeWithGpt2,
} from './gpt2.js'
import { datasetText, realDocuments, splitCorpus } from '../content/realDataset.js'

describe("GPT-2's byte-level BPE", () => {
  it('reproduces the published token ids', () => {
    // These are the ids the released GPT-2 encoder produces. If the merge
    // table, the base-id ordering or the pre-tokenisation were wrong, they
    // would not come out.
    expect(encodeGpt2('hello')).toEqual([31373])
    expect(encodeGpt2('Hello')).toEqual([15496])
    expect(encodeGpt2('hello world')).toEqual([31373, 995])
  })

  it('round-trips the real dataset through the tokenizer', () => {
    const text = datasetText()
    const ids = encodeGpt2(text)
    expect(decodeGpt2(ids)).toBe(text)
  })

  it('spells the tokens the way the vocabulary does', () => {
    expect(gpt2TokenText(0)).toBe('!')
    expect(gpt2TokenText(31373)).toBe('hello')
    expect(gpt2Segments('hello world').map((segment) => segment.display)).toEqual(['hello', '·world'])
  })

  it('compresses real English below one token per byte', () => {
    const stats = tokenizeWithGpt2(datasetText())
    expect(stats.tokens).toBeLessThan(stats.bytes)
    expect(stats.bytesPerToken).toBeGreaterThan(2)
    expect(stats.distinctTokens).toBeLessThan(GPT2_VOCAB_SIZE)
  })

  it('refuses an id outside the vocabulary', () => {
    expect(() => gpt2TokenText(GPT2_VOCAB_SIZE)).toThrow(RangeError)
  })

  it('splits the excerpt into training and validation documents', () => {
    const split = splitCorpus(realDocuments(), 0.2)
    expect(split.training.documents.length).toBe(4)
    expect(split.validation.documents.length).toBe(1)
    // Each split loses the paragraph separators it no longer contains; there
    // were four of them in the whole excerpt and three survive across the two
    // splits, so four characters of the whole are accounted for once.
    expect(split.training.bytes + split.validation.bytes).toBe(datasetText().length - 2)
  })
})
