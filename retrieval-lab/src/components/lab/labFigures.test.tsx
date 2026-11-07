import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { fmt } from '@llm-materials/course-core'
import { buildCorpus, documentFrequency } from '../../core/corpus'
import { bm25, buildIndex, meanReciprocalRank, randomRecall, recallAt } from '../../core/sparse'
import {
  denseRank,
  denseRecall,
  indexSize,
  lateInteractionRank,
  lengthBias,
  maxSimScore,
  recallByDimension,
  trainEncoder,
} from '../../core/dense'
import { buildMultiHopWorld, compareMultiHop, evidenceRanks, multiHopCurve } from '../../core/multihop'
import { compareReaders, needleCurve, readWithRetrieval } from '../../core/context'
import { memoryReport } from '../../core/memory'
import { LAB_SCREENS } from './screens'

/**
 * The figures on the laboratory screens, recomputed from the core.
 *
 * `labs.test.tsx` proves that the screens open: it looks for the panel titles. It cannot say
 * whether the number inside the panel is the number the application computes, and a screen can
 * go wrong there in two ways that leave the layout untouched — it can print a figure from a
 * different configuration than the controls hold, or it can keep showing one after the control
 * moved. So every assertion here calls the same pure function the screen calls, with the same
 * settings the controls show by default, and compares the result with the text in the page.
 */

const DISTRACTORS = [11, 12, 13, 14, 15, 16]
const QUESTION_WORD = 21

function renderLab(id: string) {
  const Screen = LAB_SCREENS[id]
  if (!Screen) throw new Error(`no screen is registered for ${id}`)
  return render(<Screen />)
}

function stat(label: string): { value: string; hint: string } {
  const node = screen.getByText(label, { selector: '.stat-label' }) as HTMLElement
  const box = node.parentElement as HTMLElement
  return {
    value: (box.querySelector('.stat-value') as HTMLElement).textContent as string,
    hint: (box.querySelector('.stat-hint')?.textContent ?? '') as string,
  }
}

/** The body rows of the table with this caption, as the page prints them. */
function rows(caption: string): string[][] {
  const node = screen.getByText(caption, { selector: 'caption' }) as HTMLElement
  const table = node.closest('table') as HTMLTableElement
  return [...table.querySelectorAll('tbody tr')].map((row) =>
    [...row.querySelectorAll('td')].map((cell) => (cell.textContent ?? '').trim()),
  )
}

function setSlider(label: string, value: number) {
  // The Slider primitive keeps the current value inside its label element, so the accessible
  // name of the control is the label with the number appended.
  const pattern = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
  fireEvent.change(screen.getByRole('slider', { name: pattern }), { target: { value: String(value) } })
}

/** The number of distinct words two texts share — the overlap the screen reports. */
function overlapOf(a: number[], b: number[]): number {
  const set = new Set(b)
  let count = 0
  for (const word of new Set(a)) if (set.has(word)) count++
  return count
}

afterEach(cleanup)

describe('the sparse laboratory prints what the index holds', () => {
  const corpus = buildCorpus({ size: 400, seed: 4 })
  const index = buildIndex(corpus)

  it('prices the index and measures the retriever with the default settings', () => {
    renderLab('sparse')

    expect(stat('The postings').value).toBe(index.postingCount.toLocaleString())
    const recall = recallAt(index, corpus, { k: 10, k1: 1.2, b: 0.75 })
    const random = randomRecall(corpus, 10)
    expect(stat('The recall at ten').value).toBe(`${fmt(recall * 100, 1)}%`)
    expect(stat('The recall at ten').hint).toBe(`against ${fmt(random * 100, 1)}% at random`)
    expect(stat('The reciprocal rank').value).toBe(fmt(meanReciprocalRank(index, corpus, { k1: 1.2, b: 0.75 }), 4))
    expect(stat('The words in the question').value).toBe(String(corpus.queries[0]!.words.length))

    expect(rows('The index')).toEqual([
      ['the documents', String(index.documents)],
      ['the postings', String(index.postingCount)],
      ['the postings per document', fmt(index.postingCount / Math.max(1, index.documents), 1)],
      ['the words in the vocabulary', String(corpus.vocabulary)],
      ['the average document length', fmt(index.averageLength, 1)],
    ])
  })

  it('lists the document frequency at the buckets it shows, and only those with entries', () => {
    renderLab('sparse')
    const frequencies = documentFrequency(corpus)
    const expected = [1, 2, 5, 10, 50, 100]
      .map((bucket) => [String(bucket), String(frequencies.filter((value) => value === bucket).length)])
      .filter((row) => Number(row[1]) > 0)
    expect(rows('The document frequency')).toEqual(expected)

    // The corpus is built so that a question names its topic with words that are everywhere,
    // which is the whole of the lexical retriever's problem. The table above is where that
    // shows up: the topic's own words are rare, the shared words are not.
    const topicWord = corpus.topicWords[0]![0]!
    const backgroundWord = corpus.background[0]!
    expect(frequencies[topicWord]!).toBeLessThan(frequencies[backgroundWord]!)
  })

  it('ranks the first question with the scores of the engine', () => {
    renderLab('sparse')
    fireEvent.click(screen.getByRole('button', { name: 'The score' }))

    const query = corpus.queries[0]!
    const ranked = corpus.passages
      .map((passage) => ({
        id: passage.id,
        length: passage.words.length,
        score: bm25(index, query.words, passage.words, { k1: 1.2, b: 0.75 }),
        relevant: passage.id === query.relevant,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)

    expect(rows('The ranking')).toEqual(
      ranked.map((row) => [String(row.id), String(row.length), fmt(row.score, 3), row.relevant ? 'yes' : '—']),
    )

    const relevant = corpus.passages[query.relevant]!
    const overlap = overlapOf(query.words, relevant.words)
    expect(
      screen.getByText(new RegExp(`share ${overlap} distinct words out of ${query.words.length}`)),
    ).toBeInTheDocument()
  })

  it('re-scores everything when the term-frequency saturation moves', () => {
    renderLab('sparse')
    fireEvent.click(screen.getByRole('button', { name: 'The score' }))

    const before = rows('The ranking')
    setSlider('k1', 0)

    // At k1 = 0 the term frequency drops out of the score entirely, so the ranking is the
    // sum of the inverse document frequencies of the words the document happens to share.
    const recall = recallAt(index, corpus, { k: 10, k1: 0, b: 0.75 })
    expect(stat('The recall at ten').value).toBe(`${fmt(recall * 100, 1)}%`)
    expect(stat('The reciprocal rank').value).toBe(fmt(meanReciprocalRank(index, corpus, { k1: 0, b: 0.75 }), 4))
    expect(stat('The postings').value).toBe(index.postingCount.toLocaleString())

    const query = corpus.queries[0]!
    const atK1Zero = corpus.passages
      .map((passage) => ({ id: passage.id, score: bm25(index, query.words, passage.words, { k1: 0, b: 0.75 }) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
    for (const [row, expected] of rows('The ranking').entries()) {
      expect(expected[0]).toBe(String(atK1Zero[row]!.id))
      expect(expected[2]).toBe(fmt(atK1Zero[row]!.score, 3))
    }

    // The length of a document no longer matters at all, so the score of a document is a
    // function of the words it shares with the question alone: the sum of their inverse
    // document frequencies, once per occurrence in the question. Two documents that contain
    // the same words must therefore tie, however different their lengths are.
    const idfOfShared = (documentWords: number[]) => {
      const present = new Set(documentWords)
      return query.words.reduce((sum, word) => sum + (present.has(word) ? (index.idf[word] ?? 0) : 0), 0)
    }
    const byDistinctWords = new Map<string, { score: number; words: number[] }>()
    for (const passage of corpus.passages) {
      const key = [...new Set(passage.words)].sort((a, b) => a - b).join(',')
      byDistinctWords.set(key, {
        score: bm25(index, query.words, passage.words, { k1: 0, b: 0.75 }),
        words: passage.words,
      })
    }
    for (const entry of byDistinctWords.values()) {
      expect(entry.score).toBeCloseTo(idfOfShared(entry.words), 10)
    }
    const lengths = corpus.passages.map((passage) => passage.words.length)
    expect(Math.max(...lengths)).toBeGreaterThan(Math.min(...lengths))

    // The control has to move something, and this is the thing it moves: the scores. The
    // recall at ten is not sensitive to it in this corpus — every question here shares only
    // background words with its answer, so which documents reach the top ten is decided by
    // the inverse document frequencies before saturation enters at all.
    const after = rows('The ranking')
    expect(after.some((row, position) => row[2] !== before[position]![2])).toBe(true)
  })

  it('builds a different corpus when the seed moves', () => {
    renderLab('sparse')
    const postings = stat('The postings').value
    setSlider('Seed', 9)

    const other = buildCorpus({ size: 400, seed: 9 })
    const rebuilt = buildIndex(other)
    expect(stat('The postings').value).toBe(rebuilt.postingCount.toLocaleString())
    expect(stat('The words in the question').value).toBe(String(other.queries[0]!.words.length))
    expect(rows('The index')).toEqual([
      ['the documents', String(rebuilt.documents)],
      ['the postings', String(rebuilt.postingCount)],
      ['the postings per document', fmt(rebuilt.postingCount / Math.max(1, rebuilt.documents), 1)],
      ['the words in the vocabulary', String(other.vocabulary)],
      ['the average document length', fmt(rebuilt.averageLength, 1)],
    ])
    expect(stat('The postings').value).not.toBe(postings)
  })
})

describe('the dense laboratory prints what the encoder trained here', () => {
  const corpus = buildCorpus({ size: 400, seed: 4 })
  const settings = { steps: 150, dimension: 24, temperature: 0.1, seed: 5 }
  const index = buildIndex(corpus)
  const query = corpus.queries[0]!

  it('ranks with the embedding it trained and quotes the loss it ended on', () => {
    renderLab('dense')
    const trained = trainEncoder(corpus, settings)

    expect(stat('The dense recall at ten').value).toBe(`${fmt(denseRecall(corpus, trained.encoder, 10) * 100, 1)}%`)
    expect(stat('The lexical recall at ten').value).toBe(`${fmt(recallAt(index, corpus, { k: 10 }) * 100, 1)}%`)
    expect(stat('A random ranking').value).toBe(`${fmt(randomRecall(corpus, 10) * 100, 1)}%`)
    expect(stat('The final loss').value).toBe(fmt(trained.history[trained.history.length - 1] ?? 0, 4))

    const ranked = denseRank(corpus, trained.encoder, query.words)
    expect(rows('The ranking')).toEqual(
      ranked.slice(0, 10).map((row) => [
        String(row.id),
        fmt(row.score, 5),
        row.id === query.relevant ? 'yes' : '—',
      ]),
    )

    // The premise of the whole laboratory, measured: the learned space beats the words.
    expect(denseRecall(corpus, trained.encoder, 10)).toBeGreaterThan(recallAt(index, corpus, { k: 10 }))
  }, 180_000)

  it('prints the two retrievers at every depth it lists', () => {
    renderLab('dense')
    fireEvent.click(screen.getByRole('button', { name: 'The training' }))
    const trained = trainEncoder(corpus, settings)

    expect(rows('The comparison')).toEqual(
      [1, 5, 10, 20].map((k) => [
        String(k),
        `${fmt(recallAt(index, corpus, { k }) * 100, 1)}%`,
        `${fmt(denseRecall(corpus, trained.encoder, k) * 100, 1)}%`,
        `${fmt(randomRecall(corpus, k) * 100, 1)}%`,
      ]),
    )

    // The caption says the gap opens immediately, so the trained retriever has to be ahead at
    // the shallowest depth listed — not merely ahead on average.
    expect(denseRecall(corpus, trained.encoder, 1)).toBeGreaterThan(recallAt(index, corpus, { k: 1 }))
  }, 180_000)

  it('counts the parameters of the two encoders from the width the control holds', () => {
    renderLab('dense')
    fireEvent.click(screen.getByRole('button', { name: 'The two encoders' }))
    const tied = trainEncoder(corpus, settings)
    const separate = trainEncoder(corpus, { ...settings, separate: true })
    const one = corpus.vocabulary * settings.dimension + settings.dimension

    expect(stat('The recall, one encoder').value).toBe(`${fmt(denseRecall(corpus, tied.encoder, 10) * 100, 1)}%`)
    expect(stat('The recall, two encoders').value).toBe(`${fmt(separate.recall * 100, 1)}%`)
    expect(stat('The parameters, one encoder').value).toBe(one.toLocaleString())
    expect(stat('The parameters, two encoders').value).toBe((2 * one).toLocaleString())

    expect(rows('The bill of materials')).toEqual([
      ['the query encoder', 'the question', one.toLocaleString(), 'at query time'],
      ['the document encoder', 'one document', one.toLocaleString(), 'once, before the index is built'],
      ['the reader', 'the question and the passages', 'counted in Laboratory D', 'at answer time'],
    ])

    // The width is a control, and the bill is the vocabulary times it: moving it has to move
    // the number the panel prints, or the panel is decoration.
    setSlider('The dimension', 32)
    const wider = corpus.vocabulary * 32 + 32
    expect(stat('The parameters, one encoder').value).toBe(wider.toLocaleString())
    expect(stat('The parameters, two encoders').value).toBe((2 * wider).toLocaleString())
  }, 300_000)

  it('sweeps the recall at the widths it names, on the same sixty steps', () => {
    renderLab('dense')
    fireEvent.click(screen.getByRole('button', { name: 'The dimension' }))
    expect(screen.getByText('Seven trainings, one click')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Run the sweep' }))
    const sweep = recallByDimension(corpus, [4, 8, 16, 24, 32, 48, 64], { steps: 60, seed: 5 })
    expect(rows('The sweep')).toEqual(
      sweep.map((point) => [
        String(point.dimension),
        point.parameters.toLocaleString(),
        `${fmt(point.recall * 100, 1)}%`,
      ]),
    )

    // "A cost that is exactly linear in the width" is a claim about the parameters column, and
    // the width times the vocabulary plus the bias is what the sweep returns.
    for (const point of sweep) {
      expect(point.parameters).toBe(point.dimension * (corpus.vocabulary + 1))
    }
    expect(sweep).toHaveLength(7)
  }, 600_000)
})

describe('the long-context laboratory prints what the reader does', () => {
  const settings = { length: 100, positionStrength: 3, temperature: 1, seed: 4 }
  const withQuestion = { ...settings, questionWord: QUESTION_WORD, distractorWords: DISTRACTORS }

  it('reports the two accuracies and the two attentions from the engine', () => {
    renderLab('context')
    const comparison = compareReaders(withQuestion)
    expect(stat('The long-context accuracy').value).toBe(`${fmt(comparison.longContext * 100, 0)}%`)
    expect(stat('With the evidence retrieved').value).toBe(`${fmt(comparison.retrieval * 100, 0)}%`)

    const retrieved = readWithRetrieval({ ...withQuestion, retrieved: true, position: 0 })
    const lost = readWithRetrieval({ ...withQuestion, retrieved: false })
    expect(stat('The attention at the start').value).toBe(fmt(retrieved.attention, 4))
    expect(stat('The attention with nothing retrieved').value).toBe(fmt(lost.attention, 4))
    expect(lost.attention).toBe(0)

    expect(rows('The two cases')).toEqual([
      ['the evidence was retrieved', 'at the start of the context', fmt(retrieved.attention, 4), retrieved.found ? 'yes' : 'no'],
      ['the evidence was lost', 'nowhere', fmt(lost.attention, 4), lost.found ? 'yes' : 'no'],
    ])

    // Retrieval is the whole of the difference this screen claims, so the two accuracies it
    // prints must not be equal — and the long-context reader must be the worse of the pair.
    expect(comparison.retrieval).toBeGreaterThan(comparison.longContext)
  })

  it('lists every position of the needle and shows the dip in the middle', () => {
    renderLab('context')
    fireEvent.click(screen.getByRole('button', { name: 'The position' }))

    const curve = needleCurve(withQuestion)
    expect(rows('The position effect')).toEqual(
      curve.map((point) => [`${fmt(point.relative * 100, 0)}%`, fmt(point.attention, 5), point.found ? 'yes' : 'no']),
    )

    // The caption asserts that the ends are used and the middle is not; the curve the table
    // prints is the evidence for it, so the claim is checked against that curve rather than
    // repeated from it.
    const middle = curve[Math.floor(curve.length / 2)]!.attention
    for (const end of [curve[0]!, curve[curve.length - 1]!]) {
      expect(end.attention).toBeGreaterThan(middle)
    }
    expect(curve[0]!.relative).toBe(0)
    expect(curve[curve.length - 1]!.relative).toBe(1)
  })

  it('moves the whole curve when the position prior is switched off', () => {
    renderLab('context')
    fireEvent.click(screen.getByRole('button', { name: 'The position' }))
    const before = rows('The position effect')

    setSlider('The strength of the position prior', 0)
    const flat = needleCurve({ ...withQuestion, positionStrength: 0 })
    expect(rows('The position effect')).toEqual(
      flat.map((point) => [`${fmt(point.relative * 100, 0)}%`, fmt(point.attention, 5), point.found ? 'yes' : 'no']),
    )
    // With no position prior the reader has no reason to prefer one place over another, so the
    // attention must be the same at every position: the dip in the panel above is a property of
    // the prior, not of the document.
    const values = flat.map((point) => point.attention)
    for (const value of values) expect(value).toBeCloseTo(values[0]!, 12)
    expect(rows('The position effect')).not.toEqual(before)
  })

  it('bills the two memories at the settings the controls hold', () => {
    renderLab('context')
    fireEvent.click(screen.getByRole('button', { name: 'The two memories' }))

    const report = memoryReport({ parameters: 7e9, passages: 21e6, dimension: 768, bytesPerValue: 4 })
    expect(stat('The weights').value).toBe(`${fmt(report.parametricGB, 1)} GB`)
    expect(stat('The index').value).toBe(`${fmt(report.nonParametricGB, 1)} GB`)
    expect(stat('The index over the weights').value).toBe(`${fmt(report.ratio, 2)}×`)
    expect(stat('The corpus where they cross').value).toBe(
      `${Math.round(report.crossoverPassages).toLocaleString()} passages`,
    )

    expect(rows('The two memories')).toEqual([
      ['the parametric memory', '7,000,000,000 parameters at 2 bytes', `${fmt(report.parametricGB, 1)} GB`, 'the choice of model'],
      [
        'the non-parametric memory',
        '21,000,000 passages × 768 values at 4 bytes',
        `${fmt(report.nonParametricGB, 1)} GB`,
        'every passage written, deleted or re-encoded',
      ],
    ])

    expect(rows('A decade at a time')).toEqual(
      [1e6, 1e7, 1e8, 1e9, 1e10].map((count) => {
        const decade = memoryReport({ parameters: 7e9, passages: count, dimension: 768, bytesPerValue: 4 })
        return [
          count.toLocaleString(),
          `${fmt(decade.nonParametricGB, 1)} GB`,
          `${fmt(decade.ratio, 2)}×`,
        ]
      }),
    )

    // The line the screen draws its argument on: the index is linear in the corpus, so each
    // decade multiplies both the size and the ratio by ten.
    const ratios = rows('A decade at a time').map((row) => Number(row[2].replace('×', '')))
    for (let i = 1; i < ratios.length; i++) {
      expect(ratios[i]!).toBeCloseTo(ratios[i - 1]! * 10, 1)
    }
  })

  it('halves the index and doubles the crossover at half precision', () => {
    renderLab('context')
    fireEvent.click(screen.getByRole('button', { name: 'The two memories' }))
    const before = stat('The index').value

    fireEvent.click(screen.getByRole('button', { name: 'half precision' }))
    const report = memoryReport({ parameters: 7e9, passages: 21e6, dimension: 768, bytesPerValue: 2 })
    expect(stat('The index').value).toBe(`${fmt(report.nonParametricGB, 1)} GB`)
    expect(stat('The index over the weights').value).toBe(`${fmt(report.ratio, 2)}×`)
    expect(stat('The corpus where they cross').value).toBe(
      `${Math.round(report.crossoverPassages).toLocaleString()} passages`,
    )
    // The weights are not re-encoded, so only the index moves — and the crossover, which is
    // where the two bills meet, moves by exactly the factor the vectors changed by.
    expect(stat('The weights').value).toBe(`${fmt(report.parametricGB, 1)} GB`)
    expect(report.crossoverPassages).toBeCloseTo(memoryReport({ bytesPerValue: 4 }).crossoverPassages * 2, 6)
    expect(stat('The index').value).not.toBe(before)

    setSlider('The width of a passage vector', 896)
    const wider = memoryReport({ parameters: 7e9, passages: 21e6, dimension: 896, bytesPerValue: 2 })
    expect(stat('The index').value).toBe(`${fmt(wider.nonParametricGB, 1)} GB`)
    expect(rows('The two memories')[1]![1]).toBe('21,000,000 passages × 896 values at 2 bytes')
  })
})

describe('the late-interaction laboratory prints what the encoder learned', () => {
  const corpus = buildCorpus({ size: 400, seed: 4 })
  const settings = { steps: 150, dimension: 24, seed: 5 }
  const query = corpus.queries[0]!

  // The screen trains the encoder inside a useMemo, so the test trains one and shares it
  // between the assertions rather than paying for the same 150 steps four times.
  let cached: ReturnType<typeof trainEncoder> | null = null
  const trained = () => (cached ??= trainEncoder(corpus, settings))

  it('scores the question word by word and prices both indexes', () => {
    renderLab('late')
    const encoder = trained().encoder

    expect(stat('The length bias').value).toBe(fmt(lengthBias(corpus, encoder, query.words, { normalise: false }), 4))
    expect(stat('The single-vector recall').value).toBe(`${fmt(denseRecall(corpus, encoder, 10) * 100, 1)}%`)
    expect(stat('The vectors in a single-vector index').value).toBe(indexSize(corpus, false).toLocaleString())
    expect(stat('The vectors in a late index').value).toBe(indexSize(corpus, true).toLocaleString())
    // The callout prints the same two figures as the stats above it, and the whole of its
    // argument is the ratio between them: one vector per document against one per word.
    expect(indexSize(corpus, true)).toBeGreaterThan(indexSize(corpus, false))
    expect(indexSize(corpus, true)).toBe(corpus.passages.reduce((sum, passage) => sum + passage.words.length, 0))

    const ranked = lateInteractionRank(corpus, encoder, query.words, { normalise: false })
    expect(rows('The ranking')).toEqual(
      ranked.slice(0, 12).map((row) => {
        const passage = corpus.passages.find((entry) => entry.id === row.id)
        return [String(row.id), String(passage?.words.length ?? 0), fmt(row.score, 5), row.id === query.relevant ? 'yes' : '—']
      }),
    )
  }, 180_000)

  it('divides the score by the candidates when the normalisation is switched on', () => {
    renderLab('late')
    const encoder = trained().encoder
    const raw = lengthBias(corpus, encoder, query.words, { normalise: false })
    const before = rows('The ranking')

    fireEvent.click(screen.getByRole('button', { name: 'Off' }))

    const normalised = lengthBias(corpus, encoder, query.words, { normalise: true })
    expect(stat('The length bias').value).toBe(fmt(normalised, 4))

    const ranked = lateInteractionRank(corpus, encoder, query.words, { normalise: true })
    expect(rows('The ranking')).toEqual(
      ranked.slice(0, 12).map((row) => [
        String(row.id),
        String(corpus.passages.find((entry) => entry.id === row.id)?.words.length ?? 0),
        fmt(row.score, 5),
        row.id === query.relevant ? 'yes' : '—',
      ]),
    )

    // The caption says the maximum inherits a preference for length and that the normalisation
    // is measurable. The core's own comment predicts the direction — dividing by the number of
    // candidates over-corrects — and the measurement agrees with it rather than with the
    // intuition that the division cancels the bias: the correlation gets larger, not smaller.
    expect(Math.abs(normalised)).toBeGreaterThan(Math.abs(raw))

    // One row of the table, traced back to the scorer that produced it.
    const top = ranked[0]!
    const passage = corpus.passages.find((entry) => entry.id === top.id)!
    expect(rows('The ranking')[0]![2]).toBe(
      fmt(maxSimScore(encoder, query.words, passage.words, corpus.vocabulary, { normalise: true }), 5),
    )
    expect(rows('The ranking')).not.toEqual(before)
  }, 180_000)

  it('re-trains the encoder on the seed without rebuilding the corpus', () => {
    renderLab('late')
    const postings = stat('The vectors in a late index').value
    const scores = rows('The ranking').map((row) => row[2])
    setSlider('Seed', 9)
    const encoder = trainEncoder(corpus, { ...settings, seed: 9 }).encoder

    // The corpus is built at seed 4 however the seed control is moved, so the index it needs and
    // the length of the documents are fixed; what the control changes is the encoder, and the
    // screen has to follow it into the scores it prints.
    expect(stat('The vectors in a late index').value).toBe(postings)
    expect(stat('The vectors in a single-vector index').value).toBe(indexSize(corpus, false).toLocaleString())
    expect(stat('The single-vector recall').value).toBe(`${fmt(denseRecall(corpus, encoder, 10) * 100, 1)}%`)
    expect(stat('The length bias').value).toBe(fmt(lengthBias(corpus, encoder, query.words, { normalise: false }), 4))

    const ranked = lateInteractionRank(corpus, encoder, query.words, { normalise: false })
    const after = rows('The ranking')
    expect(after).toEqual(
      ranked.slice(0, 12).map((row) => [
        String(row.id),
        String(corpus.passages.find((entry) => entry.id === row.id)?.words.length ?? 0),
        fmt(row.score, 5),
        row.id === query.relevant ? 'yes' : '—',
      ]),
    )
    // A different encoder means different vectors, so at least one of the twelve scores has to
    // be a different number. Both seeds do reach a recall of ten of one hundred, which is why
    // the scores rather than the recall are the reading that shows the control biting.
    expect(after.some((row, position) => row[2] !== scores[position])).toBe(true)
  }, 180_000)

  it('compares the three scorers on the world the seed builds', () => {
    renderLab('late')
    fireEvent.click(screen.getByRole('button', { name: 'The multi-hop question' }))

    const world = buildMultiHopWorld({ seed: 7 })
    const comparison = compareMultiHop(world, 10)
    expect(stat('The candidates').value).toBe(String(world.documents.length))
    for (const [method, label] of [
      ['lexical', 'Both found, lexical'],
      ['dense', 'Both found, dense'],
      ['late', 'Both found, late'],
    ] as const) {
      expect(stat(label).value).toBe(`${fmt(comparison[method].both * 100, 0)}%`)
    }

    expect(rows('The three scorers')).toEqual(
      (['lexical', 'dense', 'late'] as const).map((method) => [
        method === 'late' ? 'the late interaction' : `the ${method} score`,
        `${fmt(comparison[method].both * 100, 0)}%`,
        `${fmt(comparison[method].atLeastOne * 100, 0)}%`,
        fmt(comparison[method].meanRank, 1),
      ]),
    )

    const ranks = world.questions.map((question) => evidenceRanks(world, question))
    expect(rows('The ranks')).toEqual(
      world.questions.map((question, index) => [
        String(question.id),
        question.evidence.join(' and '),
        ranks[index]!.lexical.join(', '),
        ranks[index]!.dense.join(', '),
        ranks[index]!.late.join(', '),
      ]),
    )

    // The claim under the third figure: the late interaction puts each document at the top,
    // the lexical scorer finds only the hop whose word the question uses, and the dense one
    // is diluted. The table above is the evidence, so the sentence is checked against it.
    for (const entry of ranks) {
      expect(Math.max(...entry.late)).toBeLessThanOrEqual(2)
      expect(Math.min(...entry.lexical)).toBeLessThanOrEqual(2)
      expect(Math.max(...entry.lexical)).toBeGreaterThan(10)
    }
    expect(comparison.late.both).toBeGreaterThan(comparison.dense.both)
    expect(comparison.late.both).toBeGreaterThan(comparison.lexical.both)
  }, 180_000)

  it('draws the curve it prints from the same world', () => {
    renderLab('late')
    fireEvent.click(screen.getByRole('button', { name: 'The multi-hop question' }))
    const world = buildMultiHopWorld({ seed: 7 })
    const curve = multiHopCurve(world, 30)
    const comparison = compareMultiHop(world, 10)

    // The depth the panel sweeps to is thirty, so the point at k = 10 in the curve is the
    // number the stats above it print, and the curve is monotone in k by construction.
    const atTen = curve.find((point) => point.k === 10)!
    expect(atTen.late).toBe(comparison.late.both)
    expect(atTen.dense).toBe(comparison.dense.both)
    expect(atTen.lexical).toBe(comparison.lexical.both)
    expect(curve[0]!.k).toBe(1)
    expect(curve[curve.length - 1]!.k).toBe(30)
    for (let i = 1; i < curve.length; i++) {
      for (const method of ['lexical', 'dense', 'late'] as const) {
        expect(curve[i]![method]).toBeGreaterThanOrEqual(curve[i - 1]![method])
      }
    }

    setSlider('Seed', 9)
    const other = buildMultiHopWorld({ seed: 11 })
    expect(stat('The candidates').value).toBe(String(other.documents.length))
    expect(stat('Both found, late').value).toBe(`${fmt(compareMultiHop(other, 10).late.both * 100, 0)}%`)
    expect(rows('The ranks')).toEqual(
      other.questions.map((question) => {
        const entry = evidenceRanks(other, question)
        return [
          String(question.id),
          question.evidence.join(' and '),
          entry.lexical.join(', '),
          entry.dense.join(', '),
          entry.late.join(', '),
        ]
      }),
    )
  }, 180_000)
})
