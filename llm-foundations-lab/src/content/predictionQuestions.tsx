import type { ReactNode } from 'react'
import {
  DEFAULT_TRAINING_CONFIG,
  TRAIN_CORPUS,
  buildVocab,
  encodeCorpus,
  predictNext,
  train,
  transitionMatrix,
  weightNorm,
} from '../core/training'
import {
  TOY_LOGIT_TOKENS,
  TOY_LOGITS,
  decodeDistribution,
} from '../core/sampling'
import {
  PREFERENCE_DATASET,
  dpoLogOdds,
  dpoPreferenceProbability,
  policyDistribution,
  runAlignment,
} from '../core/alignment'
import {
  DEFAULT_KV_CONFIG,
  attentionMultiplyAdds,
  decodeMultiplyAdds,
  formatBytes,
  gqaMemoryRatio,
  kvCacheBytes,
  type KvCacheConfig,
} from '../core/inference'
import { TOY_SENTENCES, tokenize, type TokenizerMode } from '../core/tokenizer'
import { entropy, fmt } from '../core/math'

/**
 * Prediction exercises.
 *
 * Each exercise asks the learner to work out what an algorithm will do, and
 * then checks their answer against the algorithm itself. The correct option is
 * *computed*, never stored, so an exercise can never quietly disagree with the
 * laboratory it teaches from — and the test suite asserts that every question
 * has exactly one correct option.
 *
 * They live beside the quiz bank because they are course content rather than
 * interface: the laboratories render them.
 */
export interface PredictionOption {
  /** What the reader sees. */
  label: ReactNode
  /** Whether this option is the correct one. */
  correct: boolean
  /** Optional extra explanation shown once the answer is revealed. */
  detail?: ReactNode
}

export interface PredictionQuestion {
  id: string
  /** The question, including any worked numbers. */
  prompt: ReactNode
  /** A short lead-in above the question. */
  context?: ReactNode
  options: PredictionOption[]
  /** Shown after answering: the reasoning and the numbers. */
  explanation: ReactNode
}

/**
 * Build a set of numeric options around a computed value.
 *
 * The true value is always present, exactly once, and the distractors are
 * plausible near-misses. Deriving the options from the value rather than
 * hard-coding them means an exercise cannot quietly end up with no correct
 * answer when the underlying computation changes.
 */
export function numericOptions(value: number, count = 4): number[] {
  const isInteger = Number.isInteger(value)
  const round = (input: number) => (isInteger ? Math.round(input) : Math.round(input * 100) / 100)
  const rounded = round(value)
  const options = [rounded]
  for (const offset of [1, -1, 2, -2, 0.1, -0.1, 0.05, -0.05, 0.2, -0.2, 3, -3]) {
    if (options.length >= count) break
    const candidate = round(rounded + offset)
    if (candidate < 0) continue
    if (!options.some((existing) => Math.abs(existing - candidate) < 1e-9)) options.push(candidate)
  }
  return options
}

/**
 * Rotate a list so that a particular item is not always in the same place.
 * The rotation is deterministic, so the exercise is reproducible.
 */
export function rotateOptions<T>(items: readonly T[], correctIndex: number): T[] {
  if (items.length === 0) return []
  const offset = correctIndex % items.length
  return [...items.slice(offset), ...items.slice(0, offset)]
}

/* ------------------------------------------------------------------ *
 * Tokenizer: how many units will it produce?
 * ------------------------------------------------------------------ */

export function buildTokenizerQuestions(): PredictionQuestion[] {
  const plan: { sentence: string; mode: TokenizerMode; modeLabel: string }[] = [
    { sentence: TOY_SENTENCES[0], mode: 'word', modeLabel: 'word level' },
    { sentence: TOY_SENTENCES[0], mode: 'char', modeLabel: 'character level' },
    { sentence: TOY_SENTENCES[2], mode: 'word', modeLabel: 'word level' },
    { sentence: TOY_SENTENCES[2], mode: 'subword', modeLabel: 'greedy subword' },
    { sentence: TOY_SENTENCES[3], mode: 'word', modeLabel: 'word level' },
    { sentence: TOY_SENTENCES[3], mode: 'subword', modeLabel: 'greedy subword' },
  ]

  return plan.map((item, index) => {
    const result = tokenize(item.sentence, { mode: item.mode })
    const correct = result.sequenceLength
    const units = result.tokens.map((token) => token.text)
    // The candidates are derived from the true count, and the correct one is
    // rotated out of first place so its position carries no information.
    const candidates = Array.from(new Set([correct, correct + 1, Math.max(1, correct - 1), correct + 2]))
    const options = rotateOptions(candidates, index % candidates.length)
    return {
      id: `tokenizer-${index}`,
      context: (
        <>
          How many units will the <span className="font-mono text-indigo">{item.modeLabel}</span> tokenizer produce
          for this sentence?
        </>
      ),
      prompt: `“${item.sentence}”`,
      options: options.map((value) => ({
        label: (
          <span className="font-mono">
            {value} unit{value === 1 ? '' : 's'}
          </span>
        ),
        correct: value === correct,
      })),
      explanation: (
        <>
          The tokenizer produces {correct} unit{correct === 1 ? '' : 's'}. The actual segmentation is:
          <span className="mt-2 block font-mono text-xs">{units.join(' · ')}</span>
        </>
      ),
    }
  })
}

/* ------------------------------------------------------------------ *
 * Sampling: what will the decoder do?
 * ------------------------------------------------------------------ */

export function buildSamplingQuestions(): PredictionQuestion[] {
  const base = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, {
    temperature: 1,
    topK: 12,
    topP: 1,
    seed: 42,
  })

  const best = base.candidates[0]
  const runnerUp = base.candidates[1]
  const tokenOptions = rotateOptions(
    [best, runnerUp, ...base.candidates.slice(2, 5)],
    0,
  )

  const nucleus = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, {
    temperature: 1,
    topK: 12,
    topP: 0.9,
    seed: 42,
  })
  const nucleusSize = nucleus.candidates.length
  const nucleusMass = nucleus.candidates.reduce((sum, candidate) => sum + candidate.probability, 0)

  const hot = decodeDistribution(TOY_LOGITS, TOY_LOGIT_TOKENS, {
    temperature: 0.5,
    topK: 12,
    topP: 1,
    seed: 42,
  })
  const entropyAtOne = entropy(base.probabilities)
  const entropyAtHalf = entropy(hot.probabilities)
  const sharper = entropyAtHalf < entropyAtOne

  return [
    {
      id: 'sampling-argmax',
      context:
        'The laboratory starts from a fixed logit vector. Which token does the model consider most likely?',
      prompt: 'At temperature 1, which token has the highest probability?',
      options: tokenOptions.map((candidate) => ({
        label: <span className="font-mono">{candidate.token}</span>,
        correct: candidate.token === best.token,
      })),
      explanation: (
        <>
          <span className="font-mono">{best.token}</span> has the highest logit ({fmt(best.logit, 2)}), and the softmax is
          monotone, so the highest logit is also the highest probability:{' '}
          <span className="font-mono text-teal">{fmt(best.probability, 4)}</span>. The runner-up{' '}
          <span className="font-mono">{runnerUp.token}</span> sits at{' '}
          <span className="font-mono text-teal">{fmt(runnerUp.probability, 4)}</span> — a long way behind, because a
          softmax turns a logit gap into a probability gap.
        </>
      ),
    },
    {
      id: 'sampling-nucleus',
      context:
        'Now apply a nucleus threshold of 0.9 on its own, with top-k wide enough not to interfere. How many tokens survive?',
      prompt: 'How many candidates remain after top-p = 0.9?',
      options: numericOptions(nucleusSize).map((value) => ({
        label: <span className="font-mono">{value}</span>,
        correct: value === nucleusSize,
      })),
      explanation: (
        <>
          The nucleus is the smallest prefix of the ranking whose cumulative probability reaches 0.9. Here that is{' '}
          <span className="font-mono text-teal">{nucleusSize} tokens</span>, carrying{' '}
          <span className="font-mono">{fmt(nucleusMass, 4)}</span> of the mass. Every token that was filtered out had
          essentially no chance of being drawn anyway.
        </>
      ),
    },
    {
      id: 'sampling-multiplier',
      context: 'Temperature does not change the logits; it changes how much they are multiplied before the softmax.',
      prompt: 'At temperature 0.5, by what factor are the logits multiplied?',
      options: [0.5, 1, 2, 4].map((value) => ({
        label: <span className="font-mono">× {value}</span>,
        correct: value === 2,
      })),
      explanation: (
        <>
          Temperature divides the logits, so the multiplier is <span className="font-mono">1/τ = 1/0.5 = 2</span>. A logit
          of {fmt(TOY_LOGITS[0], 1)} becomes {fmt(TOY_LOGITS[0] / 0.5, 1)}, and a gap of 0.8 in the logits becomes a gap
          of 1.6.
        </>
      ),
    },
    {
      id: 'sampling-sharpness',
      context: 'Same logits, different temperature. Compare the entropy of the two distributions.',
      prompt: 'At temperature 0.5, is the distribution sharper or flatter than at temperature 1?',
      options: [
        { label: 'Sharper', correct: sharper },
        { label: 'Flatter', correct: !sharper },
        { label: 'Unchanged', correct: false },
      ],
      explanation: (
        <>
          {sharper ? 'Sharper' : 'Flatter'}. The entropy of the final distribution falls from{' '}
          <span className="font-mono text-teal">{fmt(entropyAtOne, 3)} nats</span> at temperature 1 to{' '}
          <span className="font-mono text-teal">{fmt(entropyAtHalf, 3)} nats</span> at temperature 0.5. Low temperature
          concentrates the mass on the leading token; high temperature spreads it.
        </>
      ),
    },
  ]
}

/* ------------------------------------------------------------------ *
 * Alignment: what does each objective do to the policy?
 * ------------------------------------------------------------------ */

export function buildAlignmentQuestions(): PredictionQuestion[] {
  const example = PREFERENCE_DATASET[0]
  const rejectedIndex = example.candidates.findIndex((candidate) => candidate.id === example.rejected)
  const otherIndex = example.candidates.findIndex(
    (candidate) => candidate.id !== example.chosen && candidate.id !== example.rejected,
  )

  const sft = runAlignment({ objective: 'sft', learningRate: 0.5, steps: 120, beta: 0.6 })
  const dpo = runAlignment({ objective: 'dpo', learningRate: 0.5, steps: 120, beta: 0.6 })

  const before = policyDistribution({ w: [0.2, 0.2, 0.2], beta: 0.6 }, example.candidates)
  const after = policyDistribution({ w: sft.params.w, beta: 0.6 }, example.candidates)

  const preferredAfter = example.candidates[after.indexOf(Math.max(...after))]
  const rejectedBefore = before[rejectedIndex]
  const rejectedAfter = after[rejectedIndex]
  const otherBefore = before[otherIndex]
  const otherAfter = after[otherIndex]

  const dpoParams = { w: dpo.params.w, beta: 0.6 }
  const d = dpoLogOdds(dpoParams, example)
  const preference = dpoPreferenceProbability(dpoParams, example)

  return [
    {
      id: 'alignment-preferred',
      context:
        'The policy is a softmax over three responses, described by three features. After imitation training, which response does it rank first?',
      prompt: 'After SFT training, which candidate has the highest probability?',
      options: example.candidates.map((candidate) => ({
        label: <span className="font-mono text-xs">{candidate.id}</span>,
        correct: candidate.id === preferredAfter.id,
      })),
      explanation: (
        <>
          The trained policy puts <span className="font-mono text-teal">{fmt(Math.max(...after), 4)}</span> on{' '}
          <span className="font-mono">{preferredAfter.id}</span>, the response the demonstration labelled as chosen. The
          point of imitation is exactly this: the probability mass moves toward the demonstrated answer.
        </>
      ),
    },
    {
      id: 'alignment-rejected',
      context:
        'SFT never looks at the rejected response. It only maximises the likelihood of the chosen one. What happens to the rejected response anyway?',
      prompt: 'After SFT training, has the probability of the rejected response gone up or down?',
      options: [
        { label: 'Up', correct: false },
        { label: 'Down', correct: rejectedAfter < rejectedBefore },
        { label: 'Unchanged', correct: false },
      ],
      explanation: (
        <>
          It falls, from <span className="font-mono text-teal">{fmt(rejectedBefore, 4)}</span> to{' '}
          <span className="font-mono text-teal">{fmt(rejectedAfter, 4)}</span>. The softmax is normalised: raising the
          chosen response's probability necessarily lowers the others'. This is why an imitation-trained model can be pushed
          away from answers it was never shown to be wrong.
        </>
      ),
    },
    {
      id: 'alignment-third',
      context:
        'The third candidate was never compared with the chosen one either. It is not in the demonstration and not the rejected response.',
      prompt: 'What happens to the probability of the third candidate during SFT?',
      options: [
        { label: 'It goes up', correct: otherAfter > otherBefore },
        { label: 'It goes down', correct: otherAfter < otherBefore },
        { label: 'It is untouched', correct: false },
      ],
      explanation: (
        <>
          It falls too, from <span className="font-mono text-teal">{fmt(otherBefore, 4)}</span> to{' '}
          <span className="font-mono text-teal">{fmt(otherAfter, 4)}</span>, even though the objective never mentioned
          it. That is the limit of imitation: it can only push probability toward what it has seen, and everything else
          loses.
        </>
      ),
    },
    {
      id: 'alignment-sigmoid',
      context:
        'The Bradley–Terry model turns a reward difference into a preference probability. Take a difference of exactly 1.0.',
      prompt: 'What is the probability that the preferred response is chosen?',
      options: numericOptions(1 / (1 + Math.exp(-1))).map((value) => ({
        label: <span className="font-mono">{value.toFixed(2)}</span>,
        correct: Math.abs(value - Math.round((1 / (1 + Math.exp(-1))) * 100) / 100) < 1e-9,
      })),
      explanation: (
        <>
          The Bradley–Terry probability is the sigmoid of the score difference, so a difference of 1 gives{' '}
          <span className="font-mono text-teal">{fmt(1 / (1 + Math.exp(-1)), 4)}</span>. The sigmoid compresses a
          difference into a probability: even a confidently preferred response does not get probability 1, which is the
          right behaviour when the preference data is noisy.
        </>
      ),
    },
    {
      id: 'alignment-dpo',
      context: 'Now the same pair, but trained with the DPO objective instead of imitation.',
      prompt: 'After DPO training, what is the probability that the chosen response is preferred to the rejected one?',
      options: numericOptions(preference).map((value) => ({
        label: <span className="font-mono">{value.toFixed(2)}</span>,
        correct: Math.abs(value - Math.round(preference * 100) / 100) < 1e-9,
      })),
      explanation: (
        <>
          About <span className="font-mono text-teal">{fmt(preference, 4)}</span>, from a log-odds of{' '}
          <span className="font-mono">{fmt(d, 4)}</span>. Unlike SFT, DPO is trained on the comparison itself, so the
          quantity it reports is a preference probability rather than a likelihood.
        </>
      ),
    },
  ]
}

/* ------------------------------------------------------------------ *
 * Learning: what does the optimiser actually do?
 * ------------------------------------------------------------------ */

export function buildLearningQuestions(): PredictionQuestion[] {
  const base = train({ ...DEFAULT_TRAINING_CONFIG })
  const slow = train({ ...DEFAULT_TRAINING_CONFIG, learningRate: 0.01 })
  const regularised = train({ ...DEFAULT_TRAINING_CONFIG, l2: 1 })

  const finalLoss = (run: typeof base) => run.history[run.history.length - 1].trainLoss
  const firstLoss = (run: typeof base) => run.history[0].trainLoss

  const vocab = buildVocab(TRAIN_CORPUS)
  const pairs = encodeCorpus(TRAIN_CORPUS, vocab)
  const prediction = predictNext(base.model, 'the')

  /*
   * The options are the model's own top candidates, with the right answer
   * rotated out of first place. Deriving them from the model means the
   * exercise cannot offer a set of answers that does not contain the right one.
   */
  const afterThe = transitionMatrix(base.model)[vocab.index['the']] ?? []
  const ranked = afterThe
    .map((probability, index) => ({ token: vocab.tokens[index], probability }))
    .filter((entry) => entry.probability > 1e-6)
    .sort((a, b) => b.probability - a.probability)
  const candidates = ranked.slice(0, 4)
  const correctRank = candidates.findIndex((entry) => entry.token === prediction?.token)
  const options = rotateOptions(candidates, correctRank < 0 ? 0 : correctRank)

  const divergent = train({ ...DEFAULT_TRAINING_CONFIG, learningRate: 100, steps: 20 })
  // The question is answered by what the trainer actually reports, not by
  // assuming a threshold: either the run is flagged as diverged, or the loss
  // ended above where it started.
  const diverged = divergent.diverged || !Number.isFinite(finalLoss(divergent))
  const endedWorse = diverged || finalLoss(divergent) > firstLoss(divergent)

  return [
    {
      id: 'learning-next-token',
      context:
        'The model is a bigram: it predicts the next word from the previous one. After training on the toy corpus, look at what follows “the”.',
      prompt: 'Which token does the trained model rank first after “the”?',
      options: options.map((entry) => ({
        label: <span className="font-mono">{entry.token}</span>,
        correct: entry.token === prediction?.token,
      })),
      explanation: (
        <>
          The trained model puts <span className="font-mono text-teal">{fmt(prediction?.probability ?? 0, 4)}</span> on{' '}
          <span className="font-mono">{prediction?.token}</span>. The corpus says “the model learns from text” more
          often than any other continuation, and the bigram simply memorised the most frequent successor — which is
          exactly what a bigram can do, and all it can do.
        </>
      ),
    },
    {
      id: 'learning-targets',
      context:
        'Each adjacent pair of words in the corpus is one training example for a bigram model. Count them before you answer.',
      prompt: 'How many training examples does the corpus produce?',
      options: numericOptions(pairs.length).map((value) => ({
        label: <span className="font-mono">{value}</span>,
        correct: value === pairs.length,
      })),
      explanation: (
        <>
          <span className="font-mono text-teal">{pairs.length}</span> bigram pairs. A sentence of{' '}
          <span className="font-mono">m</span> words gives <span className="font-mono">m − 1</span> pairs, because the
          last word has no successor inside the sentence.
        </>
      ),
    },
    {
      id: 'learning-rate',
      context:
        'Two runs, the same data, the same number of steps. Only the learning rate differs. Compare the loss each one ends at.',
      prompt: 'Which learning rate ends with the lower training loss?',
      options: [
        { label: '0.01', correct: finalLoss(slow) <= finalLoss(base) },
        { label: '0.8', correct: finalLoss(base) < finalLoss(slow) },
      ],
      explanation: (
        <>
          The larger step reaches{' '}
          <span className="font-mono text-teal">{fmt(finalLoss(base), 4)}</span> against{' '}
          <span className="font-mono">{fmt(finalLoss(slow), 4)}</span> for the small step, from the same starting loss of{' '}
          <span className="font-mono">{fmt(firstLoss(base), 4)}</span>. A bigger step covers more ground per update — until
          it is too big.
        </>
      ),
    },
    {
      id: 'learning-regularisation',
      context:
        'L2 regularisation adds a penalty on the size of the weights. It changes what the optimum is, not only how fast it is reached.',
      prompt: 'With L2 regularisation switched on, is the final weight norm larger or smaller?',
      options: [
        { label: 'Larger', correct: weightNorm(regularised.model) > weightNorm(base.model) },
        { label: 'Smaller', correct: weightNorm(regularised.model) <= weightNorm(base.model) },
        { label: 'Unchanged', correct: false },
      ],
      explanation: (
        <>
          Smaller: <span className="font-mono text-teal">{fmt(weightNorm(regularised.model), 4)}</span> against{' '}
          <span className="font-mono">{fmt(weightNorm(base.model), 4)}</span>. The penalty is paid by shrinking the
          weights, so a regularised model is a smaller model. That is the trade the hyper-parameter names.
        </>
      ),
    },
    {
      id: 'learning-divergence',
      context: 'Now make the learning rate absurd. What does the loss do?',
      prompt: 'With a learning rate of 100, what happens to the loss?',
      options: [
        { label: 'It still falls, just unevenly', correct: !endedWorse },
        { label: 'It diverges — the loss ends above where it started', correct: endedWorse },
        { label: 'Nothing; the rate does not matter', correct: false },
      ],
      explanation: (
        <>
          {diverged ? 'It diverges outright: the parameters leave the representable range.' : 'It ends worse than it started.'}{' '}
          The run began at <span className="font-mono text-teal">{fmt(firstLoss(divergent), 4)}</span> and finished at{' '}
          <span className="font-mono">{fmt(finalLoss(divergent), 4)}</span>. A step of size 100 times a gradient
          overshoots the minimum by a factor of a hundred, and the next gradient is taken from a point further away
          still. The laboratory reports the failure rather than quietly continuing — which is what a real trainer does too.
        </>
      ),
    },
  ]
}

/* ------------------------------------------------------------------ *
 * Inference: what does serving actually cost?
 * ------------------------------------------------------------------ */

export function buildInferenceQuestions(): PredictionQuestion[] {
  const config: KvCacheConfig = { ...DEFAULT_KV_CONFIG }
  const base = kvCacheBytes(config)
  const doubled = kvCacheBytes({ ...config, batchSize: config.batchSize * 2 })
  const longer = kvCacheBytes({ ...config, contextLength: config.contextLength * 2 })
  const ratio = gqaMemoryRatio(config)

  const prefillSmall = attentionMultiplyAdds(1000, 128, 32)
  const prefillLarge = attentionMultiplyAdds(2000, 128, 32)
  const decodeSmall = decodeMultiplyAdds(1000, 128, 32)
  const decodeLarge = decodeMultiplyAdds(2000, 128, 32)

  return [
    {
      id: 'inference-cache-batch',
      context:
        'The KV cache holds the keys and values for every token in the context, for every request being served at once.',
      prompt: 'If you double the number of requests served at once, what happens to the cache?',
      options: [
        { label: 'It doubles', correct: doubled === base * 2 },
        { label: 'It quadruples', correct: doubled === base * 4 },
        { label: 'It is unchanged', correct: doubled === base },
      ],
      explanation: (
        <>
          It doubles, to <span className="font-mono text-teal">{formatBytes(doubled)}</span> from{' '}
          <span className="font-mono">{formatBytes(base)}</span>. The cache is per request, so serving more requests at
          once multiplies the memory — which is why batching trades memory for throughput.
        </>
      ),
    },
    {
      id: 'inference-cache-context',
      context: 'Now keep the batch size fixed and double the context length instead.',
      prompt: 'What happens to the cache when the context doubles?',
      options: [
        { label: 'It doubles', correct: longer === base * 2 },
        { label: 'It quadruples', correct: longer === base * 4 },
        { label: 'It is unchanged', correct: longer === base },
      ],
      explanation: (
        <>
          It doubles, to <span className="font-mono text-teal">{formatBytes(longer)}</span>. The cache holds one entry per
          token per layer, so it grows linearly with the context — unlike the attention computation itself, which grows
          quadratically. That is the asymmetry that makes long contexts expensive.
        </>
      ),
    },
    {
      id: 'inference-gqa',
      context:
        'Grouped-query attention lets several query heads share one key/value head. The cache stores only the key/value heads.',
      prompt: 'What fraction of the full multi-head cache does grouped-query attention use here?',
      options: numericOptions(ratio).map((value) => ({
        label: <span className="font-mono">{value.toFixed(2)}</span>,
        correct: Math.abs(value - Math.round(ratio * 100) / 100) < 1e-9,
      })),
      explanation: (
        <>
          <span className="font-mono text-teal">{fmt(ratio, 4)}</span> of the full cache. The cache is proportional to
          the number of key/value heads, so sharing them across query heads divides the memory by the sharing factor —
          with no change to the shape of the attention computation itself.
        </>
      ),
    },
    {
      id: 'inference-prefill',
      context:
        'Prefill processes the whole prompt at once. Its attention work is the number of query-key pairs, which is quadratic in the context length.',
      prompt: 'Doubling the context from 1000 to 2000 tokens multiplies the prefill attention work by what factor?',
      options: [2, 3, 4, 8].map((value) => ({
        label: <span className="font-mono">× {value}</span>,
        correct: prefillLarge === prefillSmall * value,
      })),
      explanation: (
        <>
          × {fmt(prefillLarge / prefillSmall, 4)}. Every query attends to every key, so the pairs grow as the square of
          the context. This is the term that makes a long prompt expensive to ingest, and the reason prefill is a separate
          phase from decoding.
        </>
      ),
    },
    {
      id: 'inference-decode',
      context: 'Decoding processes one token at a time against the cached keys and values.',
      prompt: 'And the decode attention work — how does it grow over the same change?',
      options: [2, 3, 4, 8].map((value) => ({
        label: <span className="font-mono">× {value}</span>,
        correct: decodeLarge === decodeSmall * value,
      })),
      explanation: (
        <>
          × {fmt(decodeLarge / decodeSmall, 4)} — it grows linearly, because only one query is processed and it is
          compared against the cached keys. The cache is what turns decode from a quadratic cost into a linear one; that is
          the entire point of storing it.
        </>
      ),
    },
  ]
}
