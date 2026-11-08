/**
 * The course curriculum.
 *
 * The primary source is
 *
 *   F. Muennighoff, A. M. Rush, B. Barak, T. Zhang, E. Caballero,
 *   "DataComp: In search of the next generation of multimodal datasets",
 *   arXiv:2304.14108 [cs.CV] / NeurIPS 2023 Datasets and Benchmarks.
 *
 * Three further papers carry the rest of the course:
 *
 *   G. Penedo, Q. Xiao et al., "The RefinedWeb Dataset for Falcon LLM",
 *   arXiv:2306.01116 [cs.CL];
 *
 *   S. Xie et al., "DoReMi: Optimizing Data Mixtures Speeds Up Language Model
 *   Pretraining", arXiv:2305.10429 [cs.LG] / NeurIPS 2023;
 *
 *   I. Gerstgrasser et al., "The Curse of Recursion: Training on Generated
 *   Data Makes Models Forget", arXiv:2305.17493 [cs.LG] / Nature 2024.
 *
 * The section map below is built from those four works, and the test suite
 * refuses a lesson that cites a section which is not in it.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  datacomp: {
    id: 'muennighoff-2023-datacomp',
    title: 'DataComp: In search of the next generation of multimodal datasets',
    authors: 'Samir Yitzhak Gadre, Gabriel Ilharco, Alex Fang, Jonathan Hayase, Georgios Smyrnis, Thao Nguyen and others',
    year: 2023,
    venue: 'arXiv:2304.14108 [cs.CV] / NeurIPS 2023 Datasets and Benchmarks',
    url: 'https://arxiv.org/abs/2304.14108',
  },
  refinedweb: {
    id: 'penedo-2023-refinedweb',
    title: 'The RefinedWeb Dataset for Falcon LLM: Outperforming Curated Corpora with Web Data, and Web Data Only',
    authors: 'Guilherme Penedo, Quentin Malartic, Daniel Hesslow, Ruxandra Cojocaru, Alessandro Cappelli, Hamza Alobeidli and others',
    year: 2023,
    venue: 'arXiv:2306.01116 [cs.CL]',
    url: 'https://arxiv.org/abs/2306.01116',
  },
  doremi: {
    id: 'xie-2023-doremi',
    title: 'DoReMi: Optimizing Data Mixtures Speeds Up Language Model Pretraining',
    authors: 'Sang Michael Xie, Hieu Pham, Xuanyi Dong, Nan Du, Hanxiao Liu, Yifeng Lu and others',
    year: 2023,
    venue: 'arXiv:2305.10429 [cs.LG] / NeurIPS 2023',
    url: 'https://arxiv.org/abs/2305.10429',
  },
  recursion: {
    id: 'gerstgrasser-2024-recursion',
    title: 'The Curse of Recursion: Training on Generated Data Makes Models Forget',
    authors: 'Ilia Shumailov, Zakhar Shumaylov, Yiren Zhao, Yarin Gal, Nicolas Papernot, Ross Anderson',
    year: 2024,
    venue: 'arXiv:2305.17493 [cs.LG] / Nature 2024',
    url: 'https://arxiv.org/abs/2305.17493',
  },
} as const

/** The section map of the sources this course cites. */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  'datacomp:1': { title: 'Introduction', note: 'The benchmark as a contest: one dataset, one metric, and a set of rules for how to make the training set.' },
  'datacomp:3': { title: 'Improving the data', note: 'The filtering pipeline: what to remove and what to keep.' },
  'datacomp:3.1': { title: 'Basic filtering', note: 'The structural filters, and the rule that filtering must be cheap enough to apply to billions of documents.' },
  'datacomp:3.2': { title: 'CLIP filtering', note: 'Filtering by the similarity of an image to its caption, and why a semantic signal beats a syntactic one.' },
  'datacomp:4': { title: 'Benchmarking', note: 'How a filtering recipe is scored: the metric, the reference models and the compute budget.' },
  'datacomp:5': { title: 'Results', note: 'What each filter is worth, measured by the model trained on what survives it.' },
  'refinedweb:1': { title: 'Introduction', note: 'The claim under test: that web data alone, filtered well, beats a curated corpus.' },
  'refinedweb:2': { title: 'Data filtering', note: 'The Midas pipeline: the order of the filters and why the order is part of the method.' },
  'refinedweb:2.1': { title: 'Midas', note: 'The reference model, the rules and the four filters that follow from them.' },
  'refinedweb:2.2': { title: 'Perplexity filtering', note: 'Fitting a language model on a sample of the crawl and removing the documents it finds unlikely.' },
  'refinedweb:2.3': { title: 'Deduplication', note: 'Exact, fuzzy and semantic deduplication, and the compute each one costs.' },
  'refinedweb:3': { title: 'Results', note: 'The ablation table: what each stage of the pipeline is worth.' },
  'doremi:1': { title: 'Introduction', note: 'The mixture as a policy over domains, and the claim that it can be optimised.' },
  'doremi:3': { title: 'Method', note: 'The two steps: learning a mixture on a small proxy, and transferring it to a large model.' },
  'doremi:3.1': { title: 'Group distributionally robust optimisation', note: 'Optimising the worst domain rather than the average, and the group weights it produces.' },
  'doremi:3.2': { title: 'The mixture optimisation', note: 'The linear model of each domain’s loss, and the closed-form solution for the mixture.' },
  'doremi:4': { title: 'Results', note: 'The speed-up measured on a larger model under a fixed compute budget.' },
  'recursion:1': { title: 'Introduction', note: 'The question: what happens to a model trained on data that a model wrote.' },
  'recursion:2': { title: 'The models', note: 'The bounded and unbounded models, and the difference between them.' },
  'recursion:3': { title: 'The curse of recursion', note: 'The theorem: the tail of the distribution is lost, generation after generation.' },
  'recursion:4': { title: 'Discussion', note: 'What the result does and does not say about real training runs.' },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'sources',
    chapter: 1,
    title: 'Sources',
    tagline: 'What a crawl gives you, and what it costs',
    summary:
      'A web crawl is a large, noisy, duplicated and partly hostile collection of text. This module is about the shape of that collection, and about the frontier between how much data you have and how good it is.',
    accent: 'indigo',
    outcomes: [
      'Say what a corpus is worth, and how that is measured',
      'Read an ablation table as a set of measurements',
    ],
  },
  {
    id: 'filtering',
    chapter: 3,
    title: 'Filtering',
    tagline: 'Removing what the model should not have seen',
    summary:
      'The filtering pipeline: the structural rules, the reference model, the perplexity filter, and the ablation table that says what each stage is worth.',
    accent: 'teal',
    outcomes: [
      'List the stages of a filtering pipeline and explain the order',
      'Compute a document’s perplexity, and say why the reference model has to be an n-gram model',
    ],
  },
  {
    id: 'dedup',
    chapter: 2,
    title: 'Deduplication',
    tagline: 'The same document twice is not twice the data',
    summary:
      'Exact hashing, fuzzy matching by shingle overlap, the sub-quadratic search that makes it affordable, and the separate problem of decontamination.',
    accent: 'amber',
    outcomes: [
      'Estimate a similarity with MinHash, and find the pairs with an LSH index',
      'Apply a decontamination test, and say how it can fail',
    ],
  },
  {
    id: 'mixtures',
    chapter: 3,
    title: 'Mixtures',
    tagline: 'A mixture is a policy over domains',
    summary:
      'How the proportions of a training set are chosen: the worst-domain objective, the linear model of each domain’s loss, and the closed-form solution.',
    accent: 'emerald',
    outcomes: [
      'Describe a mixture as a policy over domains',
      'Optimise it for the worst domain, and solve the mixture in closed form',
    ],
  },
  {
    id: 'collapse',
    chapter: 3,
    title: 'Collapse',
    tagline: 'Training on what a model wrote',
    summary:
      'The recursive training loop at toy scale: why the tail of a distribution is the first thing to disappear, what real data in the mixture does about it, and what the same argument says about a filter retrained on its own survivors.',
    accent: 'rose',
    outcomes: [
      'Run the recursive training loop at toy scale',
      'Explain why the tail goes first, and what real data does about it',
      'Tell the two recursions apart: the model that writes the data, and the filter refitted on what it left behind',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  {
    id: 'what-a-crawl-gives-you',
    moduleId: 'sources',
    number: 1,
    title: 'What a crawl gives you',
    subtitle: 'The shape of the raw material',
    minutes: 22,
    objectives: [
      'Describe the four properties of a web crawl that make it hard to train on',
      'Explain why a corpus is measured by the model it produces rather than by its size',
      'Read the ablation table of a filtering pipeline as a set of measurements',
    ],
    keyIdeas: [
      'A crawl is large, noisy, duplicated and partly adversarial.',
      'The score of a filter is the model trained on what survives it, not the number of documents it removed.',
      'Filtering is a benchmark: the same rules, the same budget, the same metric.',
    ],
    interactive: {
      lab: 'pipeline',
      view: 'pipeline',
      title: 'Run the pipeline',
      description: 'Take a raw corpus through the filters and watch what each stage removes.',
    },
    prerequisites: [],
    glossaryTerms: ['corpus', 'ablation', 'data-licence'],
    quizIds: ['q-sources-1', 'q-sources-2'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'datacomp:1',
        title: 'Introduction',
        note: 'The framing of the benchmark: a common dataset, a common metric and a common set of rules, so that filtering recipes can be compared.',
      },
      {
        chapter: 1,
        section: 'refinedweb:1',
        title: 'Introduction',
        note: 'The claim the whole pipeline is built to test — that well-filtered web data beats a curated corpus.',
      },
    ],
    furtherReading: [
      {
        label: 'Dolma: an Open Corpus of Three Trillion Tokens',
        href: 'https://arxiv.org/abs/2402.00159',
        note: 'What a fully open corpus looks like, and the decontamination procedure it needs.',
      },
    ],
  },
  {
    id: 'the-quality-frontier',
    moduleId: 'sources',
    number: 2,
    title: 'The quality–quantity frontier',
    subtitle: 'What a fixed compute budget buys',
    minutes: 20,
    objectives: [
      'State the trade-off a fixed compute budget forces between data quantity and data quality',
      'Explain why a smaller, cleaner dataset can beat a larger, noisier one',
      'Compute the effective number of tokens a filtering budget actually buys',
    ],
    keyIdeas: [
      'At a fixed compute budget, the tokens you can afford are the ones that matter.',
      'Filtering is a trade: you spend compute on selection to buy back the compute you spend on training.',
      'A corpus of a hundred billion tokens is not a hundred billion tokens of training.',
    ],
    interactive: {
      lab: 'budget',
      view: 'study',
      title: 'Spend one budget five ways',
      description:
        'Five rows trained under the same token and compute budget — the raw corpus, the filtered one at full and at half budget, the control with the same documents and the same steps, and an oracle nobody can run.',
    },
    prerequisites: ['what-a-crawl-gives-you'],
    glossaryTerms: ['compute-budget', 'ablation'],
    quizIds: ['q-sources-3', 'q-frontier-trade'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'datacomp:4',
        title: 'Benchmarking',
        note: 'The fixed compute budget and the fixed metric that make two filtering recipes comparable.',
      },
      {
        chapter: 3,
        section: 'datacomp:5',
        title: 'Results',
        note: 'The measured trade between how much data survives and how good the model trained on it is.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-filtering-pipeline',
    moduleId: 'filtering',
    number: 3,
    title: 'The filtering pipeline',
    subtitle: 'The order of the filters is part of the method',
    minutes: 26,
    objectives: [
      'List the stages of a filtering pipeline in the order they are applied and say why',
      'Explain why cheap structural filters run before expensive model-based ones',
      'Read a stage-by-stage count and say what it implies about the corpus',
    ],
    keyIdeas: [
      'Structural filters first, model-based filters second, deduplication last.',
      'Every filter that runs late has to look at more documents.',
      'A filter that removes a document the model would have learned from is a bug, not a filter.',
    ],
    interactive: {
      lab: 'pipeline',
      view: 'stages',
      title: 'Read the stage counts',
      description: 'The pipeline reports what each stage removed; the laboratory recomputes it from the corpus.',
    },
    prerequisites: ['what-a-crawl-gives-you'],
    glossaryTerms: ['filtering-pipeline', 'reference-model'],
    quizIds: ['q-filtering-1', 'q-filtering-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'refinedweb:2',
        title: 'Data filtering',
        note: 'The pipeline and the argument that the order of the stages is part of the method, not an implementation detail.',
      },
      {
        chapter: 3,
        section: 'datacomp:3.1',
        title: 'Basic filtering',
        note: 'The cheap structural rules, and the compute budget that makes them necessary.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-reference-model',
    moduleId: 'filtering',
    number: 4,
    title: 'The reference model',
    subtitle: 'Perplexity, and why the model has to be an n-gram model',
    minutes: 28,
    objectives: [
      'Define the perplexity of a document under a language model',
      'Explain why a unigram model fails to remove boilerplate and an n-gram model succeeds',
      'Compute a document’s perplexity with stupid backoff',
    ],
    keyIdeas: [
      'Perplexity is the exponential of the mean negative log-likelihood per token.',
      'Stupid backoff discounts the probability once for every level of context that is missing.',
      'Boilerplate has common words in an unusual arrangement, and only the arrangement gives it away.',
    ],
    interactive: {
      lab: 'midas',
      view: 'perplexity',
      title: 'Cut at a quantile of the reference model',
      description:
        'The same corpus scored under references fitted on different pools — the crawl, one domain, another — and the two rules that use them: the near-duplicate clusters MIDAS keeps, and the perplexity cut taken at a quantile.',
    },
    prerequisites: ['the-filtering-pipeline'],
    glossaryTerms: ['perplexity', 'reference-model', 'boilerplate'],
    quizIds: ['q-filtering-3', 'q-unigram-boiler'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'refinedweb:2.2',
        title: 'Perplexity filtering',
        note: 'Fitting a language model on a sample of the crawl, and removing the documents it finds unlikely.',
      },
      {
        chapter: 2,
        section: 'refinedweb:2.1',
        title: 'Midas',
        note: 'The reference model and the rules derived from it.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'exact-and-fuzzy',
    moduleId: 'dedup',
    number: 5,
    title: 'Exact and fuzzy',
    subtitle: 'Shingles, Jaccard, and a search that is not quadratic',
    minutes: 25,
    objectives: [
      'Define the Jaccard similarity of two shingle sets',
      'Explain how a MinHash signature estimates it and what its error is',
      'Describe how Locality-Sensitive Hashing makes the search sub-quadratic',
    ],
    keyIdeas: [
      'A document is a set of its token n-grams, and two documents are duplicates when those sets overlap.',
      'A MinHash signature estimates the Jaccard similarity in k hash functions instead of |A ∩ B| comparisons.',
      'The band structure of the LSH index decides which pairs are compared for real.',
    ],
    interactive: {
      lab: 'dedup',
      view: 'fuzzy',
      title: 'Find the near-duplicates',
      description: 'The corpus is deduplicated here, with the candidate pairs the index proposed shown alongside the pairs it verified.',
    },
    prerequisites: ['what-a-crawl-gives-you'],
    glossaryTerms: ['shingle', 'jaccard', 'minhash', 'lsh'],
    quizIds: ['q-dedup-1', 'q-dedup-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'refinedweb:2.3',
        title: 'Deduplication',
        note: 'The three kinds of deduplication and the compute each one costs.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'decontamination',
    moduleId: 'dedup',
    number: 6,
    title: 'Decontamination',
    subtitle: 'A benchmark the model has seen is not a measurement',
    minutes: 20,
    objectives: [
      'Explain what decontamination is for and how it differs from deduplication',
      'Apply an n-gram overlap test between a corpus and a benchmark',
      'State the two ways a decontamination procedure can be wrong',
    ],
    keyIdeas: [
      'Deduplication removes copies of each other; decontamination removes copies of the test set.',
      'The overlap test is an n-gram test, and the n has to be long enough to be unmistakable.',
      'A decontamination procedure that is too aggressive removes real data; one that is too lax leaves the leak in.',
    ],
    interactive: {
      lab: 'dedup',
      view: 'decontamination',
      title: 'Contaminate the benchmark',
      description: 'Documents are copied into the corpus and the filter has to find them.',
    },
    prerequisites: ['exact-and-fuzzy'],
    glossaryTerms: ['decontamination', 'benchmark-contamination'],
    quizIds: ['q-dedup-3', 'q-decontam-wrong'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'refinedweb:2.3',
        title: 'Deduplication',
        note: 'Deduplication against the evaluation sets, which is where decontamination enters the pipeline.',
      },
    ],
    furtherReading: [
      {
        label: 'Dolma: an Open Corpus of Three Trillion Tokens',
        href: 'https://arxiv.org/abs/2402.00159',
        note: 'The decontamination procedure of a fully open corpus, in detail.',
      },
    ],
  },
  {
    id: 'a-mixture-is-a-policy',
    moduleId: 'mixtures',
    number: 7,
    title: 'A mixture is a policy',
    subtitle: 'Proportions, domains, and what they cost',
    minutes: 22,
    objectives: [
      'Describe a data mixture as a probability distribution over domains',
      'Explain why a mixture is a decision about which capability to buy',
      'Measure the per-domain loss of a model trained under a given mixture',
    ],
    keyIdeas: [
      'The mixture decides how much of the model’s capacity goes to each kind of text.',
      'A domain that is under-represented is a domain the model will be weak in.',
      'The average loss is not the loss that matters when the use is specialised.',
    ],
    interactive: {
      lab: 'mixture',
      view: 'natural',
      title: 'See the natural mixture',
      description: 'The mixture the corpus proposes, and the per-domain loss of the model trained on it.',
    },
    prerequisites: ['the-filtering-pipeline'],
    glossaryTerms: ['mixture', 'domain', 'group-dro'],
    quizIds: ['q-mixtures-1', 'q-mixture-capability'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'doremi:1',
        title: 'Introduction',
        note: 'The mixture as a policy over domains, and the claim that it can be optimised rather than guessed.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'optimising-the-mixture',
    moduleId: 'mixtures',
    number: 8,
    title: 'Optimising the mixture',
    subtitle: 'The worst domain, and a closed-form answer',
    minutes: 34,
    objectives: [
      'Explain the group distributionally robust objective and the update it produces',
      'Fit a linear model of a domain’s loss as a function of its weight',
      'Solve the mixture problem in closed form and check the solution',
      'Name the two steps of the method, and what has to hold for the proxy’s weights to travel to a bigger model',
    ],
    keyIdeas: [
      'Group DRO raises the weight of whichever group is doing worst, and trains on the reweighted sample.',
      'If each domain’s loss is linear in its weight, the optimal mixture equalises the active domains.',
      'The optimal mixture is found by a one-dimensional search for the level at which the weights sum to one.',
      'The weights are learned on a proxy and extrapolated for the target, so the proxy’s ranking has to agree with the target’s — where it does not, the handed-over weights are the weights of a different run.',
    ],
    interactive: {
      lab: 'proxy',
      view: 'transfer',
      title: 'Hand the weights to a bigger run',
      description:
        'The extrapolation arithmetic that rescales the proxy’s weights around a pinned domain, and the ranking the method depends on, tested against the run it came from.',
    },
    prerequisites: ['a-mixture-is-a-policy'],
    glossaryTerms: ['group-dro', 'excess-loss'],
    quizIds: ['q-mixtures-2', 'q-mixtures-3'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'doremi:3',
        title: 'Method',
        note: 'The two steps: a mixture learned on a small proxy under a fixed budget, then transferred to a larger model.',
      },
      {
        chapter: 3,
        section: 'doremi:3.1',
        title: 'Group distributionally robust optimisation',
        note: 'The worst-group objective and the group weights it produces.',
      },
      {
        chapter: 3,
        section: 'doremi:3.2',
        title: 'The mixture optimisation',
        note: 'The linear model of each domain’s loss, and the closed-form solution for the mixture.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'recursive-training',
    moduleId: 'collapse',
    number: 9,
    title: 'Recursive training',
    subtitle: 'What a model writes, and what a model trained on it keeps',
    minutes: 26,
    objectives: [
      'Describe the recursive training loop and the model it produces at each generation',
      'Explain why the tail of a distribution is the first thing to disappear',
      'Compare a bounded model with an unbounded one, and the two failures',
    ],
    keyIdeas: [
      'Train on data, generate from the model, train on that, and the distribution moves away from the original.',
      'A bounded model loses the tail completely; an unbounded model floors it.',
      'Real data in the mixture is what keeps the tail alive.',
    ],
    interactive: {
      lab: 'collapse',
      view: 'generations',
      title: 'Run the recursion',
      description: 'The loop, run here, with the tail’s mass measured at every generation.',
    },
    prerequisites: ['the-filtering-pipeline'],
    glossaryTerms: ['model-collapse', 'tail', 'bounded-model'],
    quizIds: ['q-collapse-1', 'q-collapse-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'recursion:3',
        title: 'The curse of recursion',
        note: 'The result: the tail of the distribution is lost, generation after generation.',
      },
      {
        chapter: 2,
        section: 'recursion:2',
        title: 'The models',
        note: 'The bounded and unbounded models, and the different fates of their tails.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-refinement-loop',
    moduleId: 'collapse',
    number: 10,
    title: 'The refinement loop',
    subtitle: 'Retraining the filter on what it left behind',
    minutes: 24,
    objectives: [
      'Describe the loop that refits the reference model on the survivors and filters again',
      'Explain why a purer corpus can be a worse training set for the model it produces',
      'Compare several passes at a given total removal with one pass that removes the same amount at once',
    ],
    keyIdeas: [
      'Refit the reference on the survivors, cut again at the same quantile, and every pass leaves a corpus of higher measured quality.',
      'The measured quality of the corpus and the loss on it are two different things: here the first rises while the second does too.',
      'Four gentle passes and one hard one can remove exactly the same total, because the removals compose — and only the loop refits the reference on what each earlier pass left behind.',
    ],
    interactive: {
      lab: 'refinement',
      view: 'passes',
      title: 'Run the loop pass after pass',
      description:
        'The reference retrained on each pass’s survivors, with the corpus quality and the held-out loss plotted on the same axes — and one pass against four at the same total removal.',
    },
    prerequisites: ['recursive-training'],
    glossaryTerms: ['reference-model', 'perplexity', 'model-collapse'],
    quizIds: ['q-collapse-3', 'q-collapse-4'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'recursion:4',
        title: 'Discussion',
        note: 'What the recursion result does and does not say about a real training run — and about a filter trained on its own output.',
      },
      {
        chapter: 1,
        section: 'recursion:1',
        title: 'Introduction',
        note: 'The question the loop is a version of: what happens to a model trained on data a model produced.',
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
