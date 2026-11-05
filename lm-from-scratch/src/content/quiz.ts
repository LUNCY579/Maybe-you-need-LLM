/**
 * The assessment bank.
 */

import type { QuizQuestion } from '@llm-materials/course-core'

export type { QuizQuestion }

const CS336 = { label: 'CS336: Language Modeling from Scratch' }
const CHINCHILLA = { label: 'Hoffmann et al. (2022)' }
const COURSE = { label: 'This course' }

export const QUIZ: QuizQuestion[] = [
  {
    id: 'q-tokenisation-1',
    kind: 'multiple-choice',
    prompt: 'What does a byte-pair encoding start from?',
    topic: 'The tokeniser',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The 256 bytes of the text', feedback: 'Correct, which is why it can represent any text.' },
      { id: 'b', label: 'A fixed list of words', feedback: 'Then it could not represent text outside the list.' },
      { id: 'c', label: 'The most frequent words in the corpus', feedback: 'That is roughly what it discovers, but it starts from bytes.' },
      { id: 'd', label: 'Unicode code points', feedback: 'Starting from bytes is simpler and loses nothing.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Starting from the bytes means the tokeniser can represent any text at all, and the merges it learns are whatever the corpus supports.',
    citation: CS336,
    lessonId: 'the-tokeniser',
  },
  {
    id: 'q-tokenisation-2',
    kind: 'numeric',
    prompt:
      'A corpus is 8,000,000 bytes of text and the tokeniser produces 2,000,000 tokens. How many bytes per token is that?',
    topic: 'The tokeniser',
    difficulty: 'core',
    answer: 4,
    tolerance: 0,
    unit: 'bytes per token',
    explanation:
      'Exactly 4 bytes per token. The ratio is the number that decides the training bill: a corpus of B bytes becomes B ÷ 4 tokens, and the compute follows the token count.',
    citation: COURSE,
    lessonId: 'the-tokeniser',
  },
  {
    id: 'q-tokenisation-3',
    kind: 'multiple-choice',
    prompt: 'Why does a larger vocabulary not simply make training cheaper?',
    topic: 'The vocabulary economy',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'Because the embedding and output matrices get larger', feedback: 'Correct — that is half of it.' },
      { id: 'b', label: 'Because the sequences get longer, so the attention cost grows', feedback: 'Correct — that is the other half.' },
      { id: 'c', label: 'Because the optimiser has more states to carry', feedback: 'That follows from the parameters growing, but it is not the reason.' },
      { id: 'd', label: 'It does make training cheaper', feedback: 'It moves cost from the sequence to the parameters.' },
    ],
    correctOptionId: 'a',
    explanation:
      'A larger vocabulary shortens the sequence but enlarges the two vocabulary-sized matrices. The two effects pull in opposite directions, which is why the vocabulary and the width have to be chosen together.',
    citation: CS336,
    lessonId: 'the-vocabulary-economy',
  },
  {
    id: 'q-architecture-1',
    kind: 'multiple-choice',
    prompt: 'Which part of a decoder block usually holds the most parameters?',
    topic: 'The decoder block',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The feed-forward block', feedback: 'Correct: two matrices of width × dFf each.' },
      { id: 'b', label: 'The attention projections', feedback: 'They are four square matrices, usually smaller than the feed-forward.' },
      { id: 'c', label: 'The layer norms', feedback: 'They have two numbers per dimension.' },
      { id: 'd', label: 'The residual connections', feedback: 'They have no parameters at all.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The feed-forward block has a width × dFf matrix and a dFf × width matrix, and with dFf usually several times the width it dominates the block.',
    citation: CS336,
    lessonId: 'the-decoder-block',
  },
  {
    id: 'q-architecture-2',
    kind: 'boolean',
    prompt: 'A pre-norm block normalises its input before the sub-layer rather than after it.',
    topic: 'The decoder block',
    difficulty: 'core',
    truth: true,
    explanation:
      'Yes. Normalising first keeps the residual stream unscaled, which is what makes a deep stack of blocks trainable without careful initialisation.',
    citation: CS336,
    lessonId: 'the-decoder-block',
  },
  {
    id: 'q-architecture-3',
    kind: 'numeric',
    prompt:
      'A model has a vocabulary of 32,000, a width of 768 and 12 layers, and it ties its output projection to the embedding. How many parameters does the embedding account for, in millions?',
    topic: 'The parameter budget',
    difficulty: 'hard',
    answer: 24.576,
    tolerance: 0.001,
    unit: 'million parameters',
    explanation:
      '32,000 × 768 = 24,576,000, which is 24.576 million. With the output tied, the vocabulary-sized parameters are paid for once instead of twice.',
    citation: COURSE,
    lessonId: 'the-parameter-budget',
  },
  {
    id: 'q-accounting-1',
    kind: 'numeric',
    prompt:
      'A matrix–matrix multiply of an m × k by a k × n matrix costs how many floating-point operations?',
    topic: 'The FLOPs',
    difficulty: 'core',
    answer: 2,
    tolerance: 0,
    explanation:
      'Exactly 2mnk. There are mn outputs, each needing k multiplications and k additions, and the additions are counted as a second operation.',
    citation: CS336,
    lessonId: 'the-flops',
  },
  {
    id: 'q-accounting-2',
    kind: 'multiple-choice',
    prompt: 'Why is a training step about three forward passes?',
    topic: 'The FLOPs',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The backward pass costs about twice the forward pass', feedback: 'Correct.' },
      { id: 'b', label: 'The optimiser needs a second pass to check the update', feedback: 'No.' },
      { id: 'c', label: 'The activations are recomputed', feedback: 'Only with checkpointing, and that trades compute for memory.' },
      { id: 'd', label: 'The data is loaded twice', feedback: 'No.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The backward pass computes the gradient with respect to the inputs and the gradient with respect to the weights, and the second of those costs about as much as the forward pass itself.',
    citation: CS336,
    lessonId: 'the-flops',
  },
  {
    id: 'q-accounting-3',
    kind: 'multiple-choice',
    prompt: 'What is the arithmetic intensity of a kernel?',
    topic: 'The memory hierarchy',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'Floating-point operations per byte of memory traffic', feedback: 'Correct.' },
      { id: 'b', label: 'Bytes of memory per floating-point operation', feedback: 'That is the reciprocal.' },
      { id: 'c', label: 'The fraction of the peak rate the kernel reaches', feedback: 'That is the efficiency, not the intensity.' },
      { id: 'd', label: 'The number of arithmetic units the kernel uses', feedback: 'No.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Intensity is operations per byte. Compare it with the machine’s balance point — the intensity at which the two ceilings meet — and you know which of them binds.',
    citation: CS336,
    lessonId: 'the-memory-hierarchy',
  },
  {
    id: 'q-accounting-4',
    kind: 'multiple-choice',
    prompt: 'Why is the attention kernel memory bound even when the whole training step is not?',
    topic: 'The memory hierarchy',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'Its intensity is fixed by the head dimension, which is small', feedback: 'Correct.' },
      { id: 'b', label: 'It runs on a slower processor', feedback: 'Not the reason.' },
      { id: 'c', label: 'It reads more data than the other kernels', feedback: 'It reads a lot, but the point is the ratio.' },
      { id: 'd', label: 'It uses more arithmetic units', feedback: 'No.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The attention kernel does about dModel of arithmetic per byte it moves, which is below the balance point of a modern accelerator. That is why it has to be tiled, and why FlashAttention is a memory-layout problem as much as an arithmetic one.',
    citation: CS336,
    lessonId: 'the-memory-hierarchy',
  },
  {
    id: 'q-systems-1',
    kind: 'multiple-choice',
    prompt: 'What does data parallelism split?',
    topic: 'Parallelism',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The batch', feedback: 'Correct.' },
      { id: 'b', label: 'The layers', feedback: 'That is pipeline parallelism.' },
      { id: 'c', label: 'The individual matrices', feedback: 'That is tensor parallelism.' },
      { id: 'd', label: 'The vocabulary', feedback: 'No.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Data parallelism gives every device the same model and a different slice of the batch, then all-reduces the gradients before the update.',
    citation: CS336,
    lessonId: 'parallelism',
  },
  {
    id: 'q-systems-2',
    kind: 'boolean',
    prompt: 'Data parallelism is worth it when the gradient all-reduce costs less than the arithmetic it saves.',
    topic: 'Parallelism',
    difficulty: 'hard',
    truth: true,
    explanation:
      'Yes. The all-reduce touches every parameter, and the saving from a larger batch is the difference in the number of steps. Past some size the communication wins.',
    citation: CS336,
    lessonId: 'parallelism',
  },
  {
    id: 'q-data-1',
    kind: 'multiple-choice',
    prompt: 'What is the mixture in a data pipeline?',
    topic: 'The data pipeline',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The proportions in which the sources are combined', feedback: 'Correct.' },
      { id: 'b', label: 'The list of filters applied to the corpus', feedback: 'That is the filter set.' },
      { id: 'c', label: 'The order the documents are shuffled in', feedback: 'No.' },
      { id: 'd', label: 'The tokeniser’s merge list', feedback: 'No.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The mixture is a decision about what the model should know, and it deserves the same argument as any other hyperparameter.',
    citation: CS336,
    lessonId: 'the-data-pipeline',
  },
  {
    id: 'q-data-2',
    kind: 'boolean',
    prompt: 'Deduplication only tidies the corpus up; it does not change what the model learns.',
    topic: 'The data pipeline',
    difficulty: 'hard',
    truth: false,
    explanation:
      'No. Repeated text is a signal — the model learns differently when a document appears ten times — and removing it changes both the token count and the distribution.',
    citation: CS336,
    lessonId: 'the-data-pipeline',
  },
  {
    id: 'q-training-1',
    kind: 'multiple-choice',
    prompt: 'What does the cross-entropy loss measure for a language model?',
    topic: 'The training loop',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The negative log-probability the model assigned to the token that actually came next', feedback: 'Correct.' },
      { id: 'b', label: 'The error in the predicted token', feedback: 'Not a differentiable objective.' },
      { id: 'c', label: 'The distance between the prediction and the label', feedback: 'That is a different loss, and a worse one here.' },
      { id: 'd', label: 'The perplexity', feedback: 'The perplexity is the exponentiated loss.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Averaged over the tokens, the cross-entropy is the negative log-likelihood of the corpus under the model, which is exactly what the model is trying to minimise.',
    citation: COURSE,
    lessonId: 'the-training-loop',
  },
  {
    id: 'q-training-2',
    kind: 'numeric',
    prompt: 'A model reaches a cross-entropy of 2.3026. What is its perplexity?',
    topic: 'The perplexity',
    difficulty: 'core',
    answer: 10,
    tolerance: 0,
    explanation:
      'e^2.3026 = 10, so exactly 10. A perplexity of 10 means the model was as uncertain about each token as a ten-way choice.',
    citation: COURSE,
    lessonId: 'the-perplexity',
  },
  {
    id: 'q-training-3',
    kind: 'multiple-choice',
    prompt: 'Why is the validation loss a different measurement from the training loss?',
    topic: 'The perplexity',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'It is computed on data the model never trained on', feedback: 'Correct.' },
      { id: 'b', label: 'It is computed with a different tokeniser', feedback: 'It should be the same tokeniser.' },
      { id: 'c', label: 'It is the training loss, averaged', feedback: 'That is the training loss.' },
      { id: 'd', label: 'It uses a different loss function', feedback: 'It should be the same loss.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The training loss is a diagnostic of the optimiser; the validation loss is a measurement of the model. The gap between them is the overfitting.',
    citation: CS336,
    lessonId: 'the-perplexity',
  },
  {
    id: 'q-training-4',
    kind: 'multiple-choice',
    prompt: 'What does the IsoFLOP method find?',
    topic: 'Projecting the next run',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'The model size that minimises the loss for a fixed compute budget', feedback: 'Correct.' },
      { id: 'b', label: 'The largest model the hardware can hold', feedback: 'A memory constraint, not an optimum.' },
      { id: 'c', label: 'The number of epochs before overfitting', feedback: 'No.' },
      { id: 'd', label: 'The learning rate schedule', feedback: 'No.' },
    ],
    correctOptionId: 'a',
    explanation:
      'For each model size, find the data that uses the same compute, and read the best point off the curve. Chinchilla used it to find the compute-optimal allocation.',
    citation: CHINCHILLA,
  },
]
