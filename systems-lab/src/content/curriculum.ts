/**
 * The course curriculum.
 *
 * The primary source is
 *
 *   T. Dao, D. Fu, F. L. Chiang et al.,
 *   "FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness",
 *   arXiv:2205.14135 [cs.LG] / NeurIPS 2022.
 *
 * Three further papers carry the rest of the course:
 *
 *   W. Kwon et al., "Efficient Memory Management for Large Language Model
 *   Serving with PagedAttention", arXiv:2309.06180 [cs.DC] / SOSP 2023;
 *
 *   D. Lepikhin, H. Lee, Y. Xu et al., "GShard: Scaling Giant Models with
 *   Conditional Computation and Automatic Sharding", arXiv:2006.16668 [cs.LG] / ICLR 2021;
 *
 *   C. Chen, S. Borgeaud, G. Irving et al., "SpecInfer: Accelerating
 *   Generative Large Language Model Serving with Tree-based Speculative
 *   Inference and Verification", arXiv:2305.09781 [cs.DC].
 *
 * The section map below is built from those works, and the test suite
 * refuses a lesson that cites a section which is not in it.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  flash: {
    id: 'dao-2022-flashattention',
    title: 'FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness',
    authors: 'Tri Dao, Daniel Y. Fu, Stefano Ermon, Atri Rudra, Christopher Ré',
    year: 2022,
    venue: 'arXiv:2205.14135 [cs.LG] / NeurIPS 2022',
    url: 'https://arxiv.org/abs/2205.14135',
  },
  vllm: {
    id: 'kwon-2023-vllm',
    title: 'Efficient Memory Management for Large Language Model Serving with PagedAttention',
    authors: 'Woosuk Kwon, Zhuohan Li, Siyuan Zhuang, Ying Sheng, Lianmin Zheng, Cody Hao Yu and others',
    year: 2023,
    venue: 'arXiv:2309.06180 [cs.DC] / SOSP 2023',
    url: 'https://arxiv.org/abs/2309.06180',
  },
  gshard: {
    id: 'lepikhin-2020-gshard',
    title: 'GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding',
    authors: 'Dmitry Lepikhin, HyoukJoong Lee, Yuanzhong Xu, Dehao Chen, Orhan Firat, Yanping Huang and others',
    year: 2020,
    venue: 'arXiv:2006.16668 [cs.LG] / ICLR 2021',
    url: 'https://arxiv.org/abs/2006.16668',
  },
  specinfer: {
    id: 'chen-2023-speculative',
    title: 'SpecInfer: Accelerating Generative Large Language Model Serving with Tree-based Speculative Inference and Verification',
    authors: 'Xupeng Miao, Gabriele Oliaro, Zhihao Zhang, Xinhao Cheng, Zeyu Wang, Zhengxin Zhang and others',
    year: 2023,
    venue: 'arXiv:2305.09781 [cs.DC] / ICASSP 2024',
    url: 'https://arxiv.org/abs/2305.09781',
  },
} as const

/** The section map of the sources this course cites. */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  'flash:1': { title: 'Introduction', note: 'The observation that the bottleneck is the memory traffic, not the arithmetic.' },
  'flash:2': { title: 'The GPU memory hierarchy', note: 'Why the arithmetic matters less than the movement of bytes, and what the on-chip memory is for.' },
  'flash:3': { title: 'The algorithm', note: 'The tiling, the running softmax, and the exactness of the result.' },
  'flash:3.1': { title: 'Tiling and the online softmax', note: 'How the softmax is accumulated without the whole matrix ever existing.' },
  'flash:3.2': { title: 'Exact attention', note: 'The claim that the answer is the same, and why that claim is not a small one.' },
  'flash:4': { title: 'The backward pass', note: 'The recomputation, and the arithmetic it buys with memory.' },
  'vllm:1': { title: 'Introduction', note: 'The serving problem: many sequences of different lengths, and one memory budget.' },
  'vllm:3': { title: 'The memory allocator', note: 'The page table, the block size, and the fragmentation that the paging removes.' },
  'vllm:3.1': { title: 'PagedAttention', note: 'The copy of the blocks the attention kernel needs, and the bookkeeping that makes it cheap.' },
  'gshard:1': { title: 'Introduction', note: 'Conditional computation: more parameters, the same arithmetic.' },
  'gshard:2': { title: 'Sparse layers', note: 'The top-k router, the capacity factor, and the tokens that fall off the end.' },
  'gshard:3': { title: 'Training', note: 'The auxiliary loss, and the balance it maintains.' },
  'specinfer:1': { title: 'Introduction', note: 'The idea of a small model proposing and a large model checking.' },
  'specinfer:3': { title: 'Speculative inference', note: 'The verification, the acceptance, and the exactness of the result.' },
  'specinfer:4': { title: 'Tree-based speculation', note: 'Several drafts at once, and the cost of checking them.' },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'attention-memory',
    chapter: 3,
    title: 'Attention Memory',
    tagline: 'The matrix you never have to build',
    summary:
      'The naive attention builds an N×N matrix that it needs once. This module is about what that costs, and about the algorithm that does not build it — and is still exact.',
    accent: 'indigo',
    outcomes: [
      'Say where the memory goes in a long-context attention, and how much of it is the score matrix',
      'Explain the running softmax, and why the tiled algorithm gives the same answer',
      'Account for the traffic the two algorithms move through the memory hierarchy',
    ],
  },
  {
    id: 'the-kv-cache',
    chapter: 3,
    title: 'The KV Cache',
    tagline: 'Why decoding is a memory problem',
    summary:
      'Decoding reads a model and grows a cache. This module is about the arithmetic intensity of that step, about the batch size that changes its regime, and about the page table that makes the memory usable.',
    accent: 'teal',
    outcomes: [
      'Compute the bytes the key and value cache holds, and the intensity of a decode step',
      'Explain why the intensity rises with the batch size and then stops rising',
      'Compare a padded allocation with a paged one',
    ],
  },
  {
    id: 'sparse-capacity',
    chapter: 2,
    title: 'Sparse Capacity',
    tagline: 'More parameters, the same arithmetic',
    summary:
      'A mixture of experts keeps many experts and activates few. This module is about the router, the imbalance it creates, the auxiliary loss that corrects it, and the tokens that fall off the end.',
    accent: 'amber',
    outcomes: [
      'Describe the router and the load balance it is supposed to maintain',
      'Compute the auxiliary loss, and see it grow when the router is biased',
      'Measure the overflow when a capacity factor is set',
    ],
  },
  {
    id: 'speculation',
    chapter: 3,
    title: 'Speculation',
    tagline: 'A small model proposes; a large one checks',
    summary:
      'Speculative decoding trades a cheap model for a few steps of an expensive one. This module is about the acceptance rate, about the exactness of the result, and about when the trade is worth making.',
    accent: 'emerald',
    outcomes: [
      'State the acceptance rule and compute the acceptance rate it implies',
      'Show that the procedure produces the target model’s own distribution',
      'Compute the speed-up, and say what it depends on',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  {
    id: 'the-matrix-you-never-build',
    moduleId: 'attention-memory',
    number: 1,
    title: 'The matrix you never build',
    subtitle: 'Where the memory goes in a long context',
    minutes: 24,
    objectives: [
      'Write the naive attention and say what it materialises',
      'Compute the size of the score matrix and the traffic it causes',
      'Distinguish the memory a training run needs from the memory a forward pass needs',
    ],
    keyIdeas: [
      'The score matrix is N by N, and it dwarfs everything else at a long context.',
      'It is written once and read once, and then it is thrown away.',
      'The training run is worse than the forward pass, because the backward pass needs the matrix kept.',
    ],
    interactive: {
      lab: 'attention',
      view: 'naive',
      title: 'Build the matrix',
      description: 'The naive attention, run here, with the memory and the traffic it uses.',
    },
    prerequisites: [],
    glossaryTerms: ['attention', 'score-matrix', 'arithmetic-intensity'],
    quizIds: ['q-attention-1', 'q-attention-2'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'flash:1',
        title: 'Introduction',
        note: 'The observation that the bottleneck is the memory traffic, not the arithmetic.',
      },
      {
        chapter: 3,
        section: 'flash:4',
        title: 'The backward pass',
        note: 'The recomputation, and the arithmetic it buys with memory.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-running-softmax',
    moduleId: 'attention-memory',
    number: 2,
    title: 'The running softmax',
    subtitle: 'An exact answer, computed without the matrix',
    minutes: 28,
    objectives: [
      'Describe the tiling: which block is resident, and which is streamed past',
      'Derive the running maximum, the running sum and the rescaling between them',
      'Check that the tiled algorithm and the naive one agree',
    ],
    keyIdeas: [
      'The softmax of a row can be accumulated as a running maximum and a running sum.',
      'When the maximum moves, the accumulator is rescaled — and that rescaling is what keeps it exact.',
      'The answer is identical; only the memory and the traffic differ.',
    ],
    interactive: {
      lab: 'attention',
      view: 'tiled',
      title: 'Stream the blocks',
      description: 'The same attention, tiled, and the difference in the memory it uses.',
    },
    prerequisites: ['the-matrix-you-never-build'],
    glossaryTerms: ['tiling', 'online-softmax', 'recomputation'],
    quizIds: ['q-attention-3'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'flash:3',
        title: 'The algorithm',
        note: 'The tiling, the running softmax, and the exactness of the result.',
      },
      {
        chapter: 3,
        section: 'flash:3.1',
        title: 'Tiling and the online softmax',
        note: 'How the softmax is accumulated without the whole matrix ever existing.',
      },
      {
        chapter: 3,
        section: 'flash:3.2',
        title: 'Exact attention',
        note: 'The claim that the answer is the same, and why that claim is not a small one.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'decoding-is-memory-bound',
    moduleId: 'the-kv-cache',
    number: 3,
    title: 'Decoding is memory-bound',
    subtitle: 'The arithmetic intensity of one token',
    minutes: 24,
    objectives: [
      'Compute the bytes the key and value cache holds for a given context',
      'Compute the arithmetic intensity of a decode step',
      'Explain why the intensity rises with the batch size and then stops',
    ],
    keyIdeas: [
      'A decode step is a matrix-vector product: two operations per byte of weights.',
      'The weights are read once for the batch; the cache is read once per sequence.',
      'So the batch amortises the weights and nothing else — and the intensity saturates.',
    ],
    interactive: {
      lab: 'kvcache',
      view: 'intensity',
      title: 'Measure the intensity',
      description: 'The arithmetic intensity of a decode step, as the batch size and the context grow.',
    },
    prerequisites: ['the-matrix-you-never-build'],
    glossaryTerms: ['kv-cache', 'arithmetic-intensity', 'decode-step'],
    quizIds: ['q-kv-1', 'q-kv-2'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'vllm:1',
        title: 'Introduction',
        note: 'The serving problem: many sequences of different lengths, and one memory budget.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-page-table',
    moduleId: 'the-kv-cache',
    number: 4,
    title: 'The page table',
    subtitle: 'Memory you can actually hand out',
    minutes: 22,
    objectives: [
      'Explain why a contiguous allocation wastes memory on the padding',
      'Describe the paged allocation and what it wastes instead',
      'Compute the waste of both for a set of sequence lengths',
    ],
    keyIdeas: [
      'A straightforward implementation gives every sequence a buffer as long as the longest one.',
      'Paging replaces the buffer with fixed-size blocks that can live anywhere.',
      'The waste becomes a fraction of a block per sequence rather than a fraction of the batch.',
    ],
    interactive: {
      lab: 'kvcache',
      view: 'paging',
      title: 'Fill the memory',
      description: 'A batch of sequences, and the memory each allocation scheme wastes.',
    },
    prerequisites: ['decoding-is-memory-bound'],
    glossaryTerms: ['paging', 'fragmentation', 'block-size'],
    quizIds: ['q-kv-3'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'vllm:3',
        title: 'The memory allocator',
        note: 'The page table, the block size, and the fragmentation that the paging removes.',
      },
      {
        chapter: 3,
        section: 'vllm:3.1',
        title: 'PagedAttention',
        note: 'The copy of the blocks the attention kernel needs, and the bookkeeping that makes it cheap.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-router',
    moduleId: 'sparse-capacity',
    number: 5,
    title: 'The router',
    subtitle: 'Which experts see this token',
    minutes: 24,
    objectives: [
      'Describe the top-k router and the probabilities it assigns',
      'Define the load of an expert and the probability mass it receives',
      'Explain what happens when the two disagree',
    ],
    keyIdeas: [
      'The router sends each token to the few experts with the highest scores.',
      'The load is what the experts actually got; the probability is what the router wanted.',
      'When they disagree, some experts are trained more than others — and the ones trained less are worse.',
    ],
    interactive: {
      lab: 'moe',
      view: 'routing',
      title: 'Route the tokens',
      description: 'A router here, on embeddings here, with the load it produces.',
    },
    prerequisites: [],
    glossaryTerms: ['router', 'load-balance', 'capacity-factor'],
    quizIds: ['q-moe-1'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'gshard:1',
        title: 'Introduction',
        note: 'Conditional computation: more parameters, the same arithmetic.',
      },
      {
        chapter: 2,
        section: 'gshard:2',
        title: 'Sparse layers',
        note: 'The top-k router, the capacity factor, and the tokens that fall off the end.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-auxiliary-loss',
    moduleId: 'sparse-capacity',
    number: 6,
    title: 'The auxiliary loss',
    subtitle: 'Paying a little to keep the experts equal',
    minutes: 24,
    objectives: [
      'Compute the auxiliary loss from the load and the probability',
      'Show that it grows when the router is biased',
      'Measure the overflow that a capacity factor allows',
    ],
    keyIdeas: [
      'The auxiliary loss is the number of tokens times the sum of the products of the two fractions.',
      'It is smallest when the load and the probability agree, and it pushes the router there.',
      'The capacity factor is the other half of the bargain: a hard limit, and the tokens it drops.',
    ],
    interactive: {
      lab: 'moe',
      view: 'balance',
      title: 'Break the balance',
      description: 'A biased router, the auxiliary loss it produces, and the tokens that overflow.',
    },
    prerequisites: ['the-router'],
    glossaryTerms: ['auxiliary-loss', 'load-balance', 'capacity-factor'],
    quizIds: ['q-moe-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'gshard:3',
        title: 'Training',
        note: 'The auxiliary loss, and the balance it maintains.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'proposing-and-checking',
    moduleId: 'speculation',
    number: 7,
    title: 'Proposing and checking',
    subtitle: 'The rule, and what it guarantees',
    minutes: 26,
    objectives: [
      'State the acceptance rule and compute the rate it implies',
      'Show that the procedure produces the target model’s own distribution',
      'Explain why the corrected token is drawn from the excess',
    ],
    keyIdeas: [
      'A drafted token is accepted with probability min(1, p(x)/q(x)).',
      'The expected acceptance is one minus the total variation between the two distributions.',
      'The two terms of the output distribution — the accepted and the corrected — add up to the target’s.',
    ],
    interactive: {
      lab: 'speculative',
      view: 'acceptance',
      title: 'Measure the acceptance',
      description: 'The acceptance rate, measured by running the rule.',
    },
    prerequisites: [],
    glossaryTerms: ['speculation', 'acceptance-rate', 'total-variation'],
    quizIds: ['q-speculative-1', 'q-speculative-2'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'specinfer:1',
        title: 'Introduction',
        note: 'The idea of a small model proposing and a large model checking.',
      },
      {
        chapter: 3,
        section: 'specinfer:3',
        title: 'Speculative inference',
        note: 'The verification, the acceptance, and the exactness of the result.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'when-speculation-pays',
    moduleId: 'speculation',
    number: 8,
    title: 'When speculation pays',
    subtitle: 'The trade, and its terms',
    minutes: 22,
    objectives: [
      'Compute the tokens produced per target step from the acceptance rate',
      'Compute the speed-up, and say what it depends on',
      'Explain why a closer draft model is worth more than a longer one',
    ],
    keyIdeas: [
      'The speed-up is the tokens per step, divided by the cost of the drafting.',
      'A draft that is close to the target is worth more than a long run of a bad one.',
      'The output is unchanged: the method buys time, not a different answer.',
    ],
    interactive: {
      lab: 'speculative',
      view: 'speedup',
      title: 'Price the speculation',
      description: 'The speed-up, as the acceptance rate and the relative cost of the two models move.',
    },
    prerequisites: ['proposing-and-checking'],
    glossaryTerms: ['speculation', 'acceptance-rate', 'draft-model'],
    quizIds: ['q-speculative-3'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'specinfer:4',
        title: 'Tree-based speculation',
        note: 'Several drafts at once, and the cost of checking them.',
      },
    ],
    furtherReading: [],
  },
]

/** The lessons of a module, in order. */
export function lessonsOfModule(moduleId: string): LessonMeta[] {
  return LESSONS.filter((lesson) => lesson.moduleId === moduleId)
}

/** A lesson by its id. */
export function lessonById(id: string): LessonMeta | undefined {
  return LESSONS.find((lesson) => lesson.id === id)
}

/** A module by its id. */
export function moduleById(id: string): ModuleMeta | undefined {
  return MODULES.find((module) => module.id === id)
}
