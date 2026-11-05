/**
 * Tokenizer laboratory core.
 *
 * IMPORTANT PEDAGOGICAL CONTRACT
 * ------------------------------
 * This is a *teaching* tokenizer with an explicit, human-readable toy vocabulary.
 * It is not a production tokenizer and it does not reproduce the segmentation of
 * GPT, Llama, BERT, or any other real model. Production systems use exactly the
 * same three ideas shown here (word/character/subword units) but learn the
 * subword inventory from data with algorithms such as BPE, WordPiece or Unigram.
 * The course states this difference wherever tokenization is shown.
 */

export type TokenizerMode = 'word' | 'char' | 'subword'

export interface ToyToken {
  /** Surface text of the token. */
  text: string
  /** Index into the toy vocabulary, or null when the unit is out of vocabulary. */
  id: number | null
  /** Character offsets in the original text, half-open [start, end). */
  start: number
  end: number
  /** True when the unit could not be mapped to the toy vocabulary. */
  oov: boolean
}

export interface TokenizationResult {
  mode: TokenizerMode
  text: string
  /** Text as normalised before lookup (lower-cased when `lowercase` is on). */
  normalized: string
  tokens: ToyToken[]
  ids: (number | null)[]
  /** Number of units; this is the sequence length the model would consume. */
  sequenceLength: number
  oovCount: number
  /** Share of units that were out of vocabulary, in [0, 1]. */
  oovRate: number
}

export interface TokenizerOptions {
  mode: TokenizerMode
  /** Lower-case before vocabulary lookup. */
  lowercase?: boolean
  /** Maximum subword piece length used by the greedy longest-match strategy. */
  maxPieceLength?: number
}

/** Reserved ids come first so that the vocabulary reads like a real one. */
export const SPECIAL_TOKENS = ['<pad>', '<unk>', '<bos>', '<eos>'] as const
export const UNK_ID = 1

/**
 * An explicit toy vocabulary. The list mixes whole words, frequent subword pieces
 * and characters; the subword mode composes words out of the pieces with a greedy
 * longest-match walk. Ids are simply positions in this array.
 *
 * Every surface appears exactly once, so an id maps to exactly one string and
 * `vocabSize()` equals the number of distinct entries. (A unit test enforces
 * this — a duplicated entry would silently create an unreachable id.)
 */
export const TOY_VOCAB: readonly string[] = [
  ...SPECIAL_TOKENS,
  // Whole words.
  'the', 'a', 'language', 'model', 'models', 'learns', 'learn', 'learning', 'from',
  'text', 'tokens', 'token', 'and', 'predicts', 'next', 'word', 'attention', 'heads',
  'query', 'key', 'value', 'vectors', 'softmax', 'scores', 'mask', 'causal', 'prompt',
  'prompts', 'generates', 'sample', 'sampling', 'temperature', 'reward', 'policy',
  'preference', 'reasoning', 'inference', 'cache', 'context', 'is', 'of', 'to', 'in',
  'with', 'that', 'we', 'can', 'see', 'how', 'works', 'by', 'large',
  // Frequent subword pieces (lower-case, no leading space marker in this teaching vocabulary).
  'ing', 'ed', 'er', 'est', 'ly', 'tion', 'sion', 'ness', 'ment', 'able', 'ible',
  'pre', 'post', 'un', 're', 'dis', 'trans', 'form', 'former', 'format', 'texts',
  'tokenizer', 'embed', 'embeds', 'embedding', 'embeddings', 'position', 'positional',
  'encode', 'encoder', 'decode', 'decoder', 'generation', 'generate', 'generated',
  'probabilit', 'probability', 'distribut', 'distribution', 'normal', 'normalize',
  'norm', 'layer', 'blocks', 'block', 'head', 'multi', 'self', 'cross', 'train',
  'trained', 'training', 'fine', 'tune', 'tuning', 'align', 'aligned', 'alignment',
  'human', 'feedback', 'direct', 'optimization', 'loss', 'gradient', 'step', 'steps',
  'rate', 'batch', 'epoch', 'epochs', 'regular', 'regularization', 'overfit',
  'validation', 'dataset', 'data', 'corpus', 'string', 'strings', 'wordpiece',
  'byte', 'bytes', 'pair', 'encoding', 'encodings', 'vocab', 'vocabulary',
  'length', 'window', 'beam', 'greedy', 'nucleus', 'top', 'k', 'p', 'logits',
  'logit', 'probabilities', 'candidate', 'candidates', 'rank',
  'ranking', 'response', 'responses', 'answer', 'answers', 'chain', 'thought',
  'refine', 'verifier', 'verify', 'search', 'tree', 'path', 'paths', 'compute',
  'computation', 'latency', 'memory', 'float', 'precision', 'offline',
  'online', 'reinforcement', 'supervised', 'unsupervised', 'selfsupervised',
  // Digits and common punctuation.
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '.', ',', '!', '?', ':', ';',
  "'", '"', '(', ')', '[', ']', '-', '_', '/', '=', '+', '*', '#', '@', '&', '%',
  '$', '<', '>', '{', '}', '|', '\\', '^', '~', '`',
  // Single letters (needed by character mode). 'a', 'k' and 'p' already appear
  // above as standalone entries, so they are not repeated here.
  ...['b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'l', 'm', 'n', 'o', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'],
]

export const ID_BY_SURFACE = new Map<string, number>()
TOY_VOCAB.forEach((surface, index) => {
  if (!ID_BY_SURFACE.has(surface)) ID_BY_SURFACE.set(surface, index)
})

export function vocabSize(): number {
  return TOY_VOCAB.length
}

export function idForSurface(surface: string): number | null {
  const id = ID_BY_SURFACE.get(surface)
  return id === undefined ? null : id
}

export function surfaceForId(id: number): string {
  return TOY_VOCAB[id] ?? '<invalid>'
}

export function isInVocabulary(surface: string): boolean {
  return ID_BY_SURFACE.has(surface)
}

/**
 * Split a raw string into word-ish units.
 * Whitespace separates units; punctuation is treated as its own unit, mirroring
 * the "split on whitespace and punctuation" convention used in the book when
 * word-level units are discussed (Chapter 1, tokenization discussion).
 */
function splitWordUnits(text: string): { text: string; start: number; end: number }[] {
  const units: { text: string; start: number; end: number }[] = []
  let i = 0
  const isSpace = (ch: string) => /\s/.test(ch)
  const isPunct = (ch: string) => /[.,!?;:'"()[\]{}<>=+*/\\|^~`@#$%&_-]/.test(ch)
  while (i < text.length) {
    if (isSpace(text[i])) {
      i += 1
      continue
    }
    const start = i
    if (isPunct(text[i])) {
      units.push({ text: text[i], start, end: i + 1 })
      i += 1
      continue
    }
    while (i < text.length && !isSpace(text[i]) && !isPunct(text[i])) i += 1
    units.push({ text: text.slice(start, i), start, end: i })
  }
  return units
}

/**
 * Default cap on the length of a subword piece.
 *
 * It must be large enough for the longest entry in the toy vocabulary
 * ('regularization' is 14 characters), otherwise those pieces could never be
 * produced and the greedy matcher would shatter them into near-character
 * sequences. 16 is a comfortable upper bound, not a target length.
 */
export const DEFAULT_MAX_PIECE_LENGTH = 16

/**
 * Greedy longest-match segmentation over the toy vocabulary.
 * The walk is left to right: at each position take the longest vocabulary piece
 * that matches; if a single character is unknown, emit <unk> for that character.
 */
function greedySubword(
  text: string,
  startOffset: number,
  maxPieceLength: number,
): ToyToken[] {
  const tokens: ToyToken[] = []
  let i = 0
  while (i < text.length) {
    const ch = text[i]
    if (/\s/.test(ch)) {
      i += 1
      continue
    }
    let matched: { surface: string; length: number; id: number } | null = null
    const maxLen = Math.min(maxPieceLength, text.length - i)
    for (let len = maxLen; len >= 1; len--) {
      const candidate = text.slice(i, i + len)
      const id = idForSurface(candidate)
      if (id !== null && id >= SPECIAL_TOKENS.length) {
        matched = { surface: candidate, length: len, id }
        break
      }
    }
    if (matched) {
      tokens.push({
        text: matched.surface,
        id: matched.id,
        start: startOffset + i,
        end: startOffset + i + matched.length,
        oov: false,
      })
      i += matched.length
    } else {
      tokens.push({
        text: ch,
        id: null,
        start: startOffset + i,
        end: startOffset + i + 1,
        oov: true,
      })
      i += 1
    }
  }
  return tokens
}

/** Run the toy tokenizer. Pure and deterministic. */
export function tokenize(text: string, options: TokenizerOptions): TokenizationResult {
  const { mode, lowercase = true, maxPieceLength = DEFAULT_MAX_PIECE_LENGTH } = options
  const normalized = lowercase ? text.toLowerCase() : text
  let tokens: ToyToken[] = []

  if (mode === 'char') {
    for (let i = 0; i < normalized.length; i++) {
      const ch = normalized[i]
      if (/\s/.test(ch)) continue
      const id = idForSurface(ch)
      tokens.push({
        text: ch,
        id: id !== null && id >= SPECIAL_TOKENS.length ? id : null,
        start: i,
        end: i + 1,
        oov: id === null || id < SPECIAL_TOKENS.length,
      })
    }
  } else if (mode === 'word') {
    for (const unit of splitWordUnits(normalized)) {
      const id = idForSurface(unit.text)
      const inVocab = id !== null && id >= SPECIAL_TOKENS.length
      tokens.push({ ...unit, id: inVocab ? id : null, oov: !inVocab })
    }
  } else {
    tokens = greedySubword(normalized, 0, maxPieceLength)
  }

  const ids = tokens.map((t) => t.id)
  const oovCount = tokens.filter((t) => t.oov).length
  return {
    mode,
    text,
    normalized,
    tokens,
    ids,
    sequenceLength: tokens.length,
    oovCount,
    oovRate: tokens.length === 0 ? 0 : oovCount / tokens.length,
  }
}

/**
 * A fully in-vocabulary reference sentence pair used by the exercises so that the
 * "predict the sequence length" quiz items have exact, checkable answers.
 */
export const TOY_SENTENCES: readonly string[] = [
  'the model learns from text',
  'attention heads query key value',
  'tokenizer turns text into tokens',
  'the large language model generates text',
]
