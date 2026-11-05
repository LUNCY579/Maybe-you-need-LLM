/**
 * The course curriculum.
 *
 * The primary source is the Stanford course
 *
 *   CS336: Language Modeling from Scratch
 *   https://cs336.stanford.edu/
 *
 * Its lecture materials are published under the MIT licence, and its lecture
 * sequence is what this course follows. Two papers are cited where the course
 * needs the primary result: Chinchilla for the compute-optimal allocation and
 * Kaplan et al. for the power laws.
 *
 * The source map below is the *lecture* map, because that is what the course
 * materials are organised by. The test suite refuses a lesson that cites a
 * lecture which does not exist.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  cs336: {
    id: 'cs336',
    title: 'CS336: Language Modeling from Scratch',
    authors: 'Stanford CS336 staff',
    year: 2026,
    venue: 'stanford-cs336.github.io — the Spring 2025 and Spring 2026 offerings',
    url: 'https://cs336.stanford.edu/',
  },
  chinchilla: {
    id: 'hoffmann-2022',
    title: 'Training Compute-Optimal Large Language Models',
    authors: 'Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch, Elena Buchatskaya, Trevor Cai, Eliza Rutherford and others',
    year: 2022,
    venue: 'arXiv:2203.15556 [cs.CL] / NeurIPS 2022',
    url: 'https://arxiv.org/abs/2203.15556',
  },
  kaplan: {
    id: 'kaplan-2020',
    title: 'Scaling Laws for Neural Language Models',
    authors: 'Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B. Brown, Benjamin Chess, Rewon Child and others',
    year: 2020,
    venue: 'arXiv:2001.08361 [cs.CL]',
    url: 'https://arxiv.org/abs/2001.08361',
  },
} as const

/** The lecture map of the primary source. */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  '1': {
    title: 'Overview and tokenization',
    note: 'The shape of the course, and the byte-pair encoding the tokeniser is built from.',
  },
  '2': {
    title: 'PyTorch and resource accounting',
    note: 'FLOPs, arithmetic intensity, the memory hierarchy, and what a training step actually costs.',
  },
  '3': {
    title: 'Architectures and hyperparameters',
    note: 'The decoder block, the model dimensions, and the choices a run makes before it starts.',
  },
  '4': {
    title: 'Attention alternatives and mixture of experts',
    note: 'What the attention block is, and the sparse alternatives.',
  },
  '5': {
    title: 'GPUs, TPUs and the memory hierarchy',
    note: 'The hardware the arithmetic has to fit into.',
  },
  '6': {
    title: 'Kernels and Triton',
    note: 'Writing a kernel, and why the layout of the data matters.',
  },
  '7': {
    title: 'Parallelism',
    note: 'Data, tensor and pipeline parallelism, and the communication each one needs.',
  },
  '8': {
    title: 'Scaling laws',
    note: 'The power laws, the IsoFLOP methodology, and the compute-optimal allocation.',
  },
  '9': {
    title: 'Inference',
    note: 'Prefill, decode, and the arithmetic of serving a model.',
  },
  '10': {
    title: 'Evaluation',
    note: 'What a benchmark measures, and the protocol that has to be reported with it.',
  },
  '11': {
    title: 'Scaling laws, continued',
    note: 'Fitting the laws to your own runs, and the compute-optimal frontier.',
  },
  '12': {
    title: 'Evaluation, continued',
    note: 'The evaluation harness, and the reproducibility of a number.',
  },
  '13': {
    title: 'Data — sources and datasets',
    note: 'Where the tokens come from, and what a token is worth.',
  },
  '14': {
    title: 'Data — filtering, deduplication and mixing',
    note: 'The pipeline that turns a corpus into a training set.',
  },
  '15': {
    title: 'Post-training: supervised finetuning',
    note: 'The first post-training stage, and what it is for.',
  },
  '16': {
    title: 'Post-training: reinforcement learning',
    note: 'The second stage, and why it needs the first one.',
  },
  '17': {
    title: 'Alignment and multimodality',
    note: 'The third stage, and what the interfaces are for.',
  },
  'assignment1': {
    title: 'Assignment 1 — Basics',
    note: 'The tokeniser, the model, the optimiser, and a training run that has to converge.',
  },
  'assignment2': {
    title: 'Assignment 2 — Systems',
    note: 'Profiling, a memory-efficient attention kernel, and a distributed training run.',
  },
  'assignment3': {
    title: 'Assignment 3 — Scaling',
    note: 'Fitting a scaling law to your own runs and projecting from it.',
  },
  'assignment4': {
    title: 'Assignment 4 — Data',
    note: 'Converting raw text into a training set, and measuring what the filtering did.',
  },
  'assignment5': {
    title: 'Assignment 5 — Alignment and reasoning',
    note: 'Supervised finetuning and reinforcement learning, on a task with a verifiable answer.',
  },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'tokenisation',
    chapter: 1,
    title: 'Tokenisation',
    tagline: 'The first decision, and the one everything else is priced against',
    summary:
      'A tokeniser decides what a token is, and therefore how long your corpus is, how big your embedding table is, and how many tokens of compute your training run costs. This module builds a byte-pair encoding from scratch and measures the trade-off it sets up.',
    accent: 'indigo',
    outcomes: [
      'Train a byte-pair encoding and explain the merge rule',
      'Compute the bytes-per-token ratio and say what it decides',
      'Explain why the vocabulary size and the sequence length trade against each other',
    ],
  },
  {
    id: 'architecture',
    chapter: 3,
    title: 'The Architecture',
    tagline: 'A stack of matrices, and the shapes that go with them',
    summary:
      'The decoder-only transformer is a small number of matrices. This module writes them down, counts their parameters, and shows which of them dominate the bill.',
    accent: 'teal',
    outcomes: [
      'Write the decoder block: the attention, the feed-forward, and the residual connections',
      'Count the parameters of a model and say which part dominates',
      'Explain what tying the output projection to the embedding does',
    ],
  },
  {
    id: 'accounting',
    chapter: 2,
    title: 'Resource Accounting',
    tagline: 'How much arithmetic, and how much memory, and which one binds',
    summary:
      'Before you train anything, you can work out what it will cost. This module counts the floating-point operations of a training step, the memory it needs, and the arithmetic intensity that decides whether the arithmetic units or the memory bandwidth is the bottleneck.',
    accent: 'amber',
    outcomes: [
      'Count the FLOPs of a forward pass and of a training step',
      'Compute the memory a training step needs, in all four of its components',
      'Compute the arithmetic intensity and place it against the machine’s balance point',
      'Explain why the attention kernel is memory bound even when the step is not',
    ],
  },
  {
    id: 'systems',
    chapter: 7,
    title: 'Systems and Parallelism',
    tagline: 'What it costs to spread a model across machines',
    summary:
      'A model that does not fit on one device has to be split. This module covers the three kinds of parallelism and, for each of them, the communication that has to happen and the arithmetic it buys.',
    accent: 'emerald',
    outcomes: [
      'Name the three kinds of parallelism and what each one splits',
      'Compute the communication a data-parallel step needs',
      'Compute the ratio of communication to computation, and say when it stops paying',
    ],
  },
  {
    id: 'data',
    chapter: 14,
    title: 'Data',
    tagline: 'The part of the pipeline that decides what the model knows',
    summary:
      'The tokens are the training set, and how they are chosen is a research decision in its own right. This module covers the sources, the filtering, the deduplication, and what each stage is for.',
    accent: 'rose',
    outcomes: [
      'Say what each stage of a data pipeline is for',
      'Explain why deduplication changes the token count',
      'Argue for the mixture being a decision rather than a default',
    ],
  },
  {
    id: 'training',
    chapter: 10,
    title: 'Training and Evaluation',
    tagline: 'The loop, the loss, and what the number means',
    summary:
      'A training run is a loop over batches, and a language model is trained to predict the next token. This module runs a real one, in the browser, and reports what the loss and the perplexity actually measure.',
    accent: 'violet',
    outcomes: [
      'Run a training loop and read the loss curve',
      'Explain what the cross-entropy loss is measuring, token by token',
      'Convert a loss into a perplexity and say what the conversion assumes',
      'Say why a validation loss is a different measurement from a training loss',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  {
    id: 'the-tokeniser',
    moduleId: 'tokenisation',
    number: 1,
    title: 'The tokeniser',
    subtitle: 'Learning to merge bytes into words',
    minutes: 24,
    objectives: [
      'State the byte-pair encoding rule and run it by hand on a short example',
      'Explain why the encoding starts from bytes rather than characters',
      'Compute the bytes-per-token ratio of a corpus',
    ],
    keyIdeas: [
      'The tokeniser is trained, not designed: the merges are whatever the corpus supports.',
      'Starting from bytes means the vocabulary can represent any text, at the price of a long sequence.',
      'The bytes-per-token ratio is the number that decides your training bill.',
    ],
    interactive: {
      lab: 'tokenizer',
      view: 'merges',
      title: 'Watch the merges happen',
      description: 'Train a byte-pair encoding on a generated corpus and watch the merges accumulate.',
    },
    prerequisites: [],
    glossaryTerms: ['tokeniser', 'byte-pair-encoding', 'vocabulary', 'bytes-per-token'],
    quizIds: ['q-tokenisation-1', 'q-tokenisation-2'],
    sourceRefs: [
      {
        chapter: 1,
        section: '1',
        title: 'Overview and tokenization',
        page: 1,
        note: 'The tokenisation approach the assignment builds on, and the reason the vocabulary size and the sequence length trade against each other.',
      },
      {
        chapter: 'assignment1',
        section: 'assignment1',
        title: 'Assignment 1 — Basics',
        page: 1,
        note: 'The tokeniser, the model and the optimiser the assignment asks you to build.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-vocabulary-economy',
    moduleId: 'tokenisation',
    number: 2,
    title: 'The vocabulary economy',
    subtitle: 'Every token you save is a parameter you do not have',
    minutes: 18,
    objectives: [
      'Explain the trade between the vocabulary size and the sequence length',
      'Compute the embedding parameters a vocabulary implies',
      'Argue for a particular vocabulary size on cost grounds',
    ],
    keyIdeas: [
      'A larger vocabulary means a longer sequence for the same text, and more parameters in the embedding.',
      'The cost of a vocabulary is paid twice: in parameters, and in tokens.',
      'The optimum depends on the model width, which is why the two cannot be chosen separately.',
    ],
    interactive: {
      lab: 'tokenizer',
      view: 'economics',
      title: 'The cost of a vocabulary',
      description: 'Watch the embedding parameters and the corpus length move against each other.',
    },
    prerequisites: ['the-tokeniser'],
    glossaryTerms: ['vocabulary', 'embedding', 'context-length'],
    quizIds: ['q-tokenisation-3'],
    sourceRefs: [
      {
        chapter: 1,
        section: '1',
        title: 'Overview and tokenization',
        page: 1,
        note: 'The argument that the vocabulary size and the model dimensions have to be chosen together.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 2 */
  {
    id: 'the-decoder-block',
    moduleId: 'architecture',
    number: 3,
    title: 'The decoder block',
    subtitle: 'Attention, a feed-forward layer, and two residual connections',
    minutes: 26,
    objectives: [
      'Write the decoder block and name every tensor in it',
      'Explain the pre-norm ordering and what it buys',
      'Explain why the feed-forward block is usually wider than the residual stream',
    ],
    keyIdeas: [
      'A block is a residual connection around an attention, and another around a feed-forward.',
      'The feed-forward block is where most of the parameters live.',
      'The pre-norm ordering keeps the residual stream clean, which is what makes deep stacks trainable.',
    ],
    interactive: {
      lab: 'architecture',
      view: 'parameters',
      title: 'Count the parameters',
      description: 'Count every parameter of a model and see which part of it dominates.',
    },
    prerequisites: ['the-vocabulary-economy'],
    glossaryTerms: ['transformer', 'attention', 'feed-forward', 'residual-connection', 'rmsnorm'],
    quizIds: ['q-architecture-1', 'q-architecture-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: '3',
        title: 'Architectures and hyperparameters',
        page: 1,
        note: 'The architecture the assignment builds, and the hyperparameter choices it makes.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-parameter-budget',
    moduleId: 'architecture',
    number: 4,
    title: 'The parameter budget',
    subtitle: 'Which matrices are large, and why',
    minutes: 18,
    objectives: [
      'Break a model’s parameters into their components',
      'Explain when the embedding dominates the parameter count',
      'Explain what tying the output projection does',
    ],
    keyIdeas: [
      'The embedding and the output projection are the only vocabulary-sized matrices.',
      'Tying them halves the largest single block of parameters, at the cost of some capability.',
      'Everything else scales with the width and the depth, not the vocabulary.',
    ],
    interactive: {
      lab: 'architecture',
      view: 'budget',
      title: 'The budget',
      description: 'The parameter breakdown as the width, the depth and the vocabulary move.',
    },
    prerequisites: ['the-decoder-block'],
    glossaryTerms: ['parameter-count', 'weight-tying'],
    quizIds: ['q-architecture-3'],
    sourceRefs: [
      {
        chapter: 3,
        section: '3',
        title: 'Architectures and hyperparameters',
        page: 1,
        note: 'The model dimensions and how they are chosen.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 3 */
  {
    id: 'the-flops',
    moduleId: 'accounting',
    number: 5,
    title: 'The FLOPs',
    subtitle: 'What a training step costs before you run it',
    minutes: 24,
    objectives: [
      'Count the FLOPs of a forward pass from the matrix shapes alone',
      'Explain why a training step is about three forward passes',
      'Predict how the cost changes with the width, the depth and the sequence length',
    ],
    keyIdeas: [
      'A matrix–matrix multiply of an m × k by a k × n costs 2mnk floating-point operations.',
      'The backward pass costs about twice the forward pass, so a step is about three forwards.',
      'The cost of a run is the cost of a step times the number of steps, and nothing is a surprise.',
    ],
    interactive: {
      lab: 'accounting',
      view: 'flops',
      title: 'Count the arithmetic',
      description: 'Break a training step into its terms and watch them move with the shape.',
    },
    prerequisites: ['the-decoder-block'],
    glossaryTerms: ['flops', 'training-step', 'arithmetic-intensity'],
    quizIds: ['q-accounting-1', 'q-accounting-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'PyTorch and resource accounting',
        page: 1,
        note: 'The FLOP accounting, and the rule that a matrix–matrix multiply costs 2mnk.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-memory-hierarchy',
    moduleId: 'accounting',
    number: 6,
    title: 'The memory hierarchy',
    subtitle: 'The wall your arithmetic runs into',
    minutes: 26,
    objectives: [
      'Compute the memory a training step needs, in all four of its components',
      'Compute the arithmetic intensity and compare it with the machine’s balance point',
      'Explain why the attention kernel is memory bound even when the whole step is not',
    ],
    keyIdeas: [
      'Four things have to fit: the parameters, the gradients, the optimiser state and the activations.',
      'Arithmetic intensity is the number of operations per byte, and it decides what the bottleneck is.',
      'The attention kernel’s intensity is fixed by the head dimension, which is why it has to be tiled.',
    ],
    interactive: {
      lab: 'accounting',
      view: 'roofline',
      title: 'The roofline',
      description: 'Place the workload on the roofline and see which constraint binds.',
    },
    prerequisites: ['the-flops'],
    glossaryTerms: ['arithmetic-intensity', 'roofline', 'balance-point', 'activation-memory'],
    quizIds: ['q-accounting-3', 'q-accounting-4'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'PyTorch and resource accounting',
        page: 2,
        note: 'The memory hierarchy, the arithmetic intensity, and the roofline.',
      },
      {
        chapter: 5,
        section: '5',
        title: 'GPUs, TPUs and the memory hierarchy',
        page: 1,
        note: 'The hardware the arithmetic has to fit into, and the balance point of a real accelerator.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 4 */
  {
    id: 'parallelism',
    moduleId: 'systems',
    number: 7,
    title: 'Parallelism',
    subtitle: 'Three ways to split a model, and what each one costs',
    minutes: 24,
    objectives: [
      'Name data, tensor and pipeline parallelism and what each splits',
      'Compute the communication a data-parallel step needs',
      'Compute the ratio of communication to computation, and say when it stops paying',
    ],
    keyIdeas: [
      'Data parallelism splits the batch and adds a gradient all-reduce per step.',
      'Tensor parallelism splits a single matrix and adds an all-reduce per layer.',
      'Pipeline parallelism splits the layers and adds a point-to-point send per stage.',
      'The split is worth it when the communication is smaller than the arithmetic it saves.',
    ],
    interactive: {
      lab: 'accounting',
      view: 'roofline',
      title: 'What the split costs',
      description: 'The communication a data-parallel step needs, against the arithmetic it buys.',
    },
    prerequisites: ['the-memory-hierarchy'],
    glossaryTerms: ['data-parallelism', 'tensor-parallelism', 'pipeline-parallelism', 'all-reduce'],
    quizIds: ['q-systems-1', 'q-systems-2'],
    sourceRefs: [
      {
        chapter: 7,
        section: '7',
        title: 'Parallelism',
        page: 1,
        note: 'The three kinds of parallelism, and the communication each one requires.',
      },
      {
        chapter: 'assignment2',
        section: 'assignment2',
        title: 'Assignment 2 — Systems',
        page: 1,
        note: 'The systems assignment: profiling, a memory-efficient kernel, and a distributed run.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 5 */
  {
    id: 'the-data-pipeline',
    moduleId: 'data',
    number: 8,
    title: 'The data pipeline',
    subtitle: 'From a crawl to a training set',
    minutes: 22,
    objectives: [
      'Name the stages of a language-modeling data pipeline and what each is for',
      'Explain why deduplication changes the token count',
      'Argue that the mixture is a decision rather than a default',
    ],
    keyIdeas: [
      'Every filtering stage removes tokens, and the stages are not independent.',
      'Deduplication is not a tidy-up; it changes what the model learns.',
      'The mixture over sources is a research decision, and it should be argued for.',
    ],
    interactive: {
      lab: 'data',
      view: 'pipeline',
      title: 'The pipeline',
      description: 'Run a corpus through the stages and watch the token count fall.',
    },
    prerequisites: ['the-vocabulary-economy'],
    glossaryTerms: ['corpus', 'deduplication', 'filtering', 'mixture'],
    quizIds: ['q-data-1', 'q-data-2'],
    sourceRefs: [
      {
        chapter: 13,
        section: '13',
        title: 'Data — sources and datasets',
        page: 1,
        note: 'The sources, and the question of what a token is worth.',
      },
      {
        chapter: 14,
        section: '14',
        title: 'Data — filtering, deduplication and mixing',
        page: 1,
        note: 'The filtering, the deduplication and the mixing.',
      },
      {
        chapter: 'assignment4',
        section: 'assignment4',
        title: 'Assignment 4 — Data',
        page: 1,
        note: 'The data assignment: build the pipeline and measure what the filtering did.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 6 */
  {
    id: 'the-training-loop',
    moduleId: 'training',
    number: 9,
    title: 'The training loop',
    subtitle: 'Batches, gradients, and the loss that falls',
    minutes: 26,
    objectives: [
      'Describe the training loop and say what each step does',
      'Explain the cross-entropy loss as a sum over tokens',
      'Explain what the loss curve does and does not tell you',
    ],
    keyIdeas: [
      'A step is a batch, a forward pass, a backward pass and an update.',
      'The loss is the average negative log-probability of the tokens that came next.',
      'A falling loss is evidence the model is fitting; it is not evidence it generalises.',
    ],
    interactive: {
      lab: 'training',
      view: 'run',
      title: 'Run a training loop',
      description: 'Train a real transformer in the browser and watch the loss fall.',
    },
    prerequisites: ['the-decoder-block', 'the-flops'],
    glossaryTerms: ['cross-entropy', 'batch', 'gradient-accumulation', 'perplexity'],
    quizIds: ['q-training-1', 'q-training-2'],
    sourceRefs: [
      {
        chapter: 'assignment1',
        section: 'assignment1',
        title: 'Assignment 1 — Basics',
        page: 1,
        note: 'The training loop, the optimiser, and a run that has to converge.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-perplexity',
    moduleId: 'training',
    number: 10,
    title: 'The perplexity, and the number behind it',
    subtitle: 'What the loss means when you exponentiate it',
    minutes: 18,
    objectives: [
      'Convert a cross-entropy loss into a perplexity',
      'State what the perplexity assumes about the distribution',
      'Explain why the validation loss is a different measurement',
    ],
    keyIdeas: [
      'The perplexity is the loss, exponentiated: it is a number of effective choices.',
      'It assumes the model is being scored against one fixed distribution.',
      'A validation loss is a measurement; a training loss is a diagnostic.',
    ],
    interactive: {
      lab: 'training',
      view: 'perplexity',
      title: 'The number and what is behind it',
      description: 'Read the perplexity alongside the loss and the validation number.',
    },
    prerequisites: ['the-training-loop'],
    glossaryTerms: ['perplexity', 'validation-loss', 'overfitting'],
    quizIds: ['q-training-3'],
    sourceRefs: [
      {
        chapter: 10,
        section: '10',
        title: 'Evaluation',
        page: 1,
        note: 'What a benchmark measures, and the protocol that has to be reported with it.',
      },
      {
        chapter: 12,
        section: '12',
        title: 'Evaluation, continued',
        page: 1,
        note: 'The evaluation harness and the reproducibility of a number.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-scaling-law',
    moduleId: 'training',
    number: 11,
    title: 'Projecting the next run',
    subtitle: 'What a power law lets you say before you spend the money',
    minutes: 20,
    objectives: [
      'State the shape of the scaling laws and what they predict',
      'Explain the compute-optimal allocation and the rule of thumb it gives',
      'Say what a scaling law cannot tell you',
    ],
    keyIdeas: [
      'The loss falls as a power law in the compute, the data and the parameters.',
      'For a fixed compute, there is an optimal size, and Chinchilla found where.',
      'A scaling law is an extrapolation, and its uncertainty grows with the distance.',
    ],
    interactive: {
      lab: 'scaling',
      view: 'isoflop',
      title: 'The IsoFLOP picture',
      description: 'Trace the compute-optimal frontier and read the optimal allocation off it.',
    },
    prerequisites: ['the-flops'],
    glossaryTerms: ['scaling-law', 'isoflop', 'compute-optimal'],
    quizIds: ['q-training-4'],
    sourceRefs: [
      {
        chapter: 8,
        section: '8',
        title: 'Scaling laws',
        page: 1,
        note: 'The power laws and the IsoFLOP methodology.',
      },
      {
        chapter: 11,
        section: '11',
        title: 'Scaling laws, continued',
        page: 1,
        note: 'Fitting the laws to your own runs and projecting from them.',
      },
    ],
    furtherReading: [
      {
        label: 'Hoffmann et al., arXiv:2203.15556',
        href: 'https://arxiv.org/abs/2203.15556',
        note: 'The compute-optimal allocation and the rule of thumb it gives.',
      },
      {
        label: 'Kaplan et al., arXiv:2001.08361',
        href: 'https://arxiv.org/abs/2001.08361',
        note: 'The power laws themselves.',
      },
    ],
  },
]

export function lessonsOfModule(moduleId: string): LessonMeta[] {
  return LESSONS.filter((lesson) => lesson.moduleId === moduleId).sort((a, b) => a.number - b.number)
}

export function lessonById(id: string): LessonMeta | undefined {
  return LESSONS.find((lesson) => lesson.id === id)
}

export function moduleById(id: string): ModuleMeta | undefined {
  return MODULES.find((module) => module.id === id)
}
