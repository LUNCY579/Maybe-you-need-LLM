/**
 * The course curriculum.
 *
 * The primary source is
 *
 *   L. Zheng, W.-L. Chiang, H. Zhang, J. E. Gonzalez, I. Stoica,
 *   "Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena",
 *   arXiv:2306.05685 [cs.CL] / NeurIPS 2023 Datasets and Benchmarks.
 *
 * Four further papers are cited where they carry part of the argument: HELM
 * for the holistic framing, Chatbot Arena for the human votes, the Leaderboard
 * Illusion for the newest criticism, and Lessons from the Trenches for the
 * practical failure modes.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  mtbench: {
    id: 'zheng-2023',
    title: 'Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena',
    authors: 'Lianmin Zheng, Wei-Lin Chiang, Ying Sheng, Siyuan Zhuang, Zhanghao Wu, Yonghao Zhuang and others',
    year: 2023,
    venue: 'arXiv:2306.05685 [cs.CL] / NeurIPS 2023 Datasets and Benchmarks',
    url: 'https://arxiv.org/abs/2306.05685',
  },
  helm: {
    id: 'lian-2023-helm',
    title: 'Holistic Evaluation of Language Models',
    authors: 'Percy Liang, Rishi Bommasani, Tony Lee, Dimitris Tsipras, Dilara Soylu, Michihiro Yasunaga and others',
    year: 2023,
    venue: 'arXiv:2211.09110 [cs.CL] / TMLR 2023',
    url: 'https://arxiv.org/abs/2211.09110',
  },
  arena: {
    id: 'chi-2024-arena',
    title: 'Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference',
    authors: 'Wei-Lin Chiang, Lianmin Zheng, Ying Sheng, Anastasios Nikolas Angelopoulos, Tianle Li, Dacheng Li and others',
    year: 2024,
    venue: 'arXiv:2403.04132 [cs.CL] / ICML 2024',
    url: 'https://arxiv.org/abs/2403.04132',
  },
  illusion: {
    id: 'singhal-2025-illusion',
    title: 'The Leaderboard Illusion',
    authors: 'Shivalika Singh, Yiyang Nan, Alex Wang, Daniel D\'Souza, Sayash Kapoor, Ahmet Üstün and others',
    year: 2025,
    kind: 'paper',
    venue: 'arXiv:2504.20879 [cs.LG]',
    url: 'https://arxiv.org/abs/2504.20879',
  },
  trenches: {
    id: 'reuel-2024-trenches',
    title: 'Lessons from the Trenches on Reproducible Evaluation of Language Models',
    authors: 'Stella Biderman, Hailey Schoelkopf, Lintang Sutawika, Leo Gao, Jonathan Tow, Baber Abbasi and others',
    year: 2024,
    kind: 'paper',
    venue: 'arXiv:2405.14782 [cs.LG]',
    url: 'https://arxiv.org/abs/2405.14782',
  },
} as const

/**
 * The section map of the primary source.
 *
 * The test suite refuses any lesson that cites a section which is not here.
 */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  '1': { title: 'Introduction', note: 'The proposal to use a strong model as a judge, and the claim that it agrees with humans.' },
  '2': { title: 'MT-Bench and the judge', note: 'The question set, the judging prompt, and the agreement measurements.' },
  '3': { title: 'Chatbot Arena', note: 'The human preference arena and the Bradley–Terry model behind its ranking.' },
  '4': { title: 'Limitations', note: 'The biases the paper measures: position, verbosity and self-enhancement.' },
  '5': { title: 'Related work', note: 'Where model-based evaluation sits among the alternatives.' },
  '6': { title: 'Conclusion', note: 'The summary of what the method does and does not establish.' },
  A: { title: 'Additional experimental results', note: 'The larger agreement and consistency tables.' },
  B: { title: 'Prompt templates', note: 'The exact prompts used for the judge and for the reference answer.' },
  C: { title: 'Experimental details', note: 'The models, the decoding parameters and the cost of the votes.' },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'judging',
    chapter: 2,
    title: 'Judging with a Model',
    tagline: 'A strong model asked to pick the better of two answers',
    summary:
      'The central idea of model-based evaluation: instead of writing a reference answer, show a judge model two candidate answers and ask which is better. This module sets out the method, the measurement of how often it agrees with a human, and the consistency check that most people do not run.',
    accent: 'indigo',
    outcomes: [
      'State what an LLM-as-a-judge is asked to do, and what it is not asked to do',
      'Measure agreement with a human and explain what the number means',
      'Measure consistency under a permutation, and say why it is the harder test',
      'Explain why the agreement number is a property of the question set as well as of the judge',
    ],
  },
  {
    id: 'biases',
    chapter: 4,
    title: 'The Biases of a Judge',
    tagline: 'Position, verbosity, and liking your own answers',
    summary:
      'A judge is a model, and models have preferences that have nothing to do with quality. This module takes the three biases the primary source measures, isolates each one, and measures it rather than describing it.',
    accent: 'teal',
    outcomes: [
      'Define position bias, verbosity bias and self-enhancement bias',
      'Design an experiment that isolates one bias',
      'Read a consistency number and connect it to position bias',
      'Say which of the three biases a pairwise protocol can fix for free',
    ],
  },
  {
    id: 'agreement',
    chapter: 2,
    title: 'Human Agreement',
    tagline: 'What the agreement number actually tells you',
    summary:
      'An agreement rate of 80% sounds good and is often quoted without context. This module treats the number as what it is — a measurement with a denominator, a question set and a protocol — and asks what happens when the denominator changes.',
    accent: 'amber',
    outcomes: [
      'Compute an agreement rate and identify its denominator',
      'Explain why agreement and consistency are different numbers',
      'Predict how a harder question set changes the agreement rate',
      'Argue for reporting the judge against a human baseline rather than against 100%',
    ],
  },
  {
    id: 'arena',
    chapter: 3,
    title: 'Arena Rankings',
    tagline: 'Turning pairwise votes into a leaderboard',
    summary:
      'An arena collects votes and produces a ranking. This module covers the Bradley–Terry model that Chatbot Arena uses, the confidence interval that should accompany it, and the cost of a vote — which is what limits how precise a leaderboard can be.',
    accent: 'emerald',
    outcomes: [
      'Fit a Bradley–Terry model to pairwise votes and read the strengths',
      'Compute a bootstrap confidence interval on a ranking',
      'Explain why an Elo rating is not a confidence interval',
      'Estimate how many votes it takes to separate two models',
    ],
  },
  {
    id: 'benchmark',
    chapter: 2,
    title: 'Benchmark Design',
    tagline: 'What you put in the question set decides what comes out',
    summary:
      'A benchmark is a measurement instrument, and instruments have design decisions. This module covers contamination — what happens when the test set is in the training set — and the way contamination moves a ranking more than it moves a score.',
    accent: 'rose',
    outcomes: [
      'Compute the score inflation a contamination fraction produces',
      'Explain why differential contamination moves rankings more than scores',
      'Say what a benchmark author should do about it',
      'Distinguish contamination from saturation and from overfitting',
    ],
  },
  {
    id: 'measurement',
    chapter: 4,
    title: 'Measurement',
    tagline: 'The number on the leaderboard has an error bar',
    summary:
      'A score from N questions is a proportion, and a proportion has a standard error. This module computes it, shows how the interval narrows, and asks how many questions you need to tell two models apart — a question that is usually not asked.',
    accent: 'violet',
    outcomes: [
      'Compute the standard error of a benchmark score',
      'Explain why the interval narrows as one over the square root of N',
      'Compute the number of questions needed to detect a given difference',
      'Argue for publishing an interval next to every score',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  /* ------------------------------------------------------------------ Module 1 */
  {
    id: 'what-a-judge-is',
    moduleId: 'judging',
    number: 1,
    title: 'What a judge is asked to do',
    subtitle: 'Two answers, one question, one preference',
    minutes: 20,
    objectives: [
      'State the task the judge is given and the shape of its output',
      'Explain why pairwise comparison is easier for a model than scoring',
      'Say what the judge is not being asked to do',
    ],
    keyIdeas: [
      'The judge sees two answers to the same question and names the better one.',
      'Pairwise comparison avoids writing a reference answer, which is where most benchmarks go wrong.',
      'The judge is a model, so its preferences are the model’s preferences.',
    ],
    interactive: {
      lab: 'judge',
      view: 'agreement',
      title: 'The judge against the human',
      description: 'Measure how often a judge agrees with the human, and how often it agrees with itself.',
    },
    prerequisites: [],
    glossaryTerms: ['llm-as-a-judge', 'pairwise-comparison', 'judge', 'agreement-rate'],
    quizIds: ['q-judging-1', 'q-judging-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'MT-Bench and the judge',
        page: 4,
        note: 'The judging prompt, the pairwise format, and the agreement measurement against human preference.',
      },
      {
        chapter: 1,
        section: '1',
        title: 'Introduction',
        page: 1,
        note: 'The claim that a strong model can substitute for human annotation, and the cost of that substitution.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'agreement-and-consistency',
    moduleId: 'judging',
    number: 2,
    title: 'Agreement and consistency',
    subtitle: 'Two different numbers, and the second one is the harder test',
    minutes: 22,
    objectives: [
      'Define agreement with a human and consistency under a permutation',
      'Explain what a consistency failure tells you that a low agreement does not',
      'Design the swap test',
    ],
    keyIdeas: [
      'Agreement is measured against a human; consistency is measured against the judge itself.',
      'Swapping the two answers must not change the preference — and if it does, the judge is answering a different question.',
      'A judge can be consistent and still be systematically wrong.',
    ],
    interactive: {
      lab: 'judge',
      view: 'consistency',
      title: 'The swap test',
      description: 'Judge the same pair twice, with the positions swapped, and count the flips.',
    },
    prerequisites: ['what-a-judge-is'],
    glossaryTerms: ['consistency', 'position-bias'],
    quizIds: ['q-judging-3'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'MT-Bench and the judge',
        page: 5,
        note: 'The position-swap experiment and the consistency figures reported alongside the agreement rate.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 2 */
  {
    id: 'position-bias',
    moduleId: 'biases',
    number: 3,
    title: 'Position bias',
    subtitle: 'The answer in front of it',
    minutes: 20,
    objectives: [
      'Define position bias and describe the swap test that detects it',
      'Compute the rate at which a judge prefers the first position',
      'Explain why a pairwise protocol can fix position bias for free',
    ],
    keyIdeas: [
      'A judge asked the same question twice, with the answers swapped, should answer differently.',
      'A fair protocol presents each pair in both orders and takes the majority.',
      'The cost is double the votes, which is why arenas that skip it look cheap.',
    ],
    interactive: {
      lab: 'biases',
      view: 'position',
      title: 'Measure the position preference',
      description: 'Count how often the judge prefers the answer in the first position.',
    },
    prerequisites: ['agreement-and-consistency'],
    glossaryTerms: ['position-bias', 'consistency'],
    quizIds: ['q-biases-1', 'q-biases-2'],
    sourceRefs: [
      {
        chapter: 4,
        section: '4',
        title: 'Limitations',
        page: 9,
        note: 'The position bias measurement and the mitigation the paper proposes.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'verbosity-and-self',
    moduleId: 'biases',
    number: 4,
    title: 'Verbosity and self-enhancement',
    subtitle: 'Longer answers, and answers like mine',
    minutes: 22,
    objectives: [
      'Define verbosity bias and self-enhancement bias',
      'Isolate each bias in an experiment',
      'Say which of the two a protocol can fix and which it cannot',
    ],
    keyIdeas: [
      'A judge prefers the longer answer even when the shorter one is better.',
      'A judge prefers answers from models similar to itself.',
      'Neither bias is fixed by swapping positions; both have to be measured.',
    ],
    interactive: {
      lab: 'biases',
      view: 'verbosity',
      title: 'Isolate the verbosity bias',
      description: 'Hold the quality fixed, vary the length, and count the preference.',
    },
    prerequisites: ['position-bias'],
    glossaryTerms: ['verbosity-bias', 'self-enhancement-bias'],
    quizIds: ['q-biases-3', 'q-biases-4'],
    sourceRefs: [
      {
        chapter: 4,
        section: '4',
        title: 'Limitations',
        page: 9,
        note: 'The verbosity bias and the self-enhancement bias, and the finding that a stronger judge does not remove them.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 3 */
  {
    id: 'what-agreement-means',
    moduleId: 'agreement',
    number: 5,
    title: 'What an agreement rate means',
    subtitle: 'The denominator is doing most of the work',
    minutes: 20,
    objectives: [
      'Compute an agreement rate and state its denominator',
      'Explain why the same judge can score 65% or 85% on two question sets',
      'Argue for a human baseline',
    ],
    keyIdeas: [
      'An agreement rate is a measurement with a denominator, and the denominator is a design decision.',
      'On a question set where the answers are close, the judge will disagree with the human a lot — correctly.',
      'The number to compare against is the agreement of two humans, not 100%.',
    ],
    interactive: {
      lab: 'judge',
      view: 'difficulty',
      title: 'Agreement against difficulty',
      description: 'See how the agreement rate falls as the questions get harder.',
    },
    prerequisites: ['what-a-judge-is'],
    glossaryTerms: ['agreement-rate', 'human-baseline'],
    quizIds: ['q-agreement-1', 'q-agreement-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'MT-Bench and the judge',
        page: 6,
        note: 'The agreement rate of 80.9% against human preference, and the comparison with the inter-annotator agreement.',
      },
      {
        chapter: 1,
        section: '1',
        title: 'Introduction',
        page: 2,
        note: 'The claim that a judge can reach agreement with experts, and the conditions under which it holds.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 4 */
  {
    id: 'bradley-terry',
    moduleId: 'arena',
    number: 6,
    title: 'From votes to a ranking',
    subtitle: 'The Bradley–Terry model',
    minutes: 26,
    objectives: [
      'Write the Bradley–Terry model and its likelihood',
      'Explain why the strengths are only identified up to a constant',
      'Read a fitted ranking and say what the strengths mean',
    ],
    keyIdeas: [
      'Pr(i beats j) = σ(θ_i − θ_j): one number per model, one difference per comparison.',
      'The likelihood is a sum of logarithms, and it can be maximised directly.',
      'The model is fitted by maximum likelihood, not by an update rule.',
    ],
    interactive: {
      lab: 'arena',
      view: 'ranking',
      title: 'Fit a ranking to the votes',
      description: 'Collect the votes and fit a Bradley–Terry model to them.',
    },
    prerequisites: ['what-a-judge-is'],
    glossaryTerms: ['bradley-terry', 'elo', 'arena'],
    quizIds: ['q-arena-1', 'q-arena-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: '3',
        title: 'Chatbot Arena',
        page: 7,
        note: 'The Bradley–Terry model behind the arena ranking, and the bootstrap confidence intervals reported with it.',
      },
      {
        chapter: 3,
        section: '3',
        title: 'Chatbot Arena',
        page: 8,
        note: 'The cost of the votes, and the observation that the number of votes per model varies widely.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'confidence-and-cost',
    moduleId: 'arena',
    number: 7,
    title: 'The interval and the cost',
    subtitle: 'How precise is a leaderboard, and what does precision cost?',
    minutes: 22,
    objectives: [
      'Compute a bootstrap interval on a fitted ranking',
      'Explain why an Elo rating is not an interval',
      'Estimate the number of votes needed to separate two models',
    ],
    keyIdeas: [
      'Resampling the votes and refitting gives an interval on the ranking.',
      'Elo is an online update rule, so its result depends on the order the votes arrived in.',
      'Votes are not free, and the price of precision is the thing that limits a leaderboard.',
    ],
    interactive: {
      lab: 'arena',
      view: 'interval',
      title: 'How many votes to tell them apart',
      description: 'Watch the confidence interval on the top two models shrink as the votes accumulate.',
    },
    prerequisites: ['bradley-terry'],
    glossaryTerms: ['bootstrap', 'confidence-interval', 'elo'],
    quizIds: ['q-arena-3'],
    sourceRefs: [
      {
        chapter: 3,
        section: '3',
        title: 'Chatbot Arena',
        page: 8,
        note: 'The bootstrap procedure and the reported intervals on the arena ranking.',
      },
      {
        chapter: 3,
        section: '3',
        title: 'Chatbot Arena',
        page: 8,
        note: 'The cost of the votes: how many are needed before the ranking stabilises.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 5 */
  {
    id: 'contamination',
    moduleId: 'benchmark',
    number: 8,
    title: 'Contamination',
    subtitle: 'When the test set is in the training set',
    minutes: 22,
    objectives: [
      'Compute the score inflation a contamination fraction produces',
      'Explain why differential contamination moves rankings more than scores',
      'Distinguish contamination from saturation and from overfitting',
    ],
    keyIdeas: [
      'A contaminated question is answered from memory rather than from capability.',
      'The score inflation is proportional to the contaminated fraction.',
      'When only some models are contaminated, the ranking moves more than any single score.',
    ],
    interactive: {
      lab: 'benchmark',
      view: 'contamination',
      title: 'What contamination does to a score',
      description: 'Sweep the contaminated fraction and watch the reported score drift.',
    },
    prerequisites: [],
    glossaryTerms: ['contamination', 'benchmark', 'saturation'],
    quizIds: ['q-benchmark-1', 'q-benchmark-2'],
    sourceRefs: [
      {
        chapter: 6,
        section: '6',
        title: 'Conclusion',
        page: 12,
        note: 'The paper’s statement of what the method does not address, including the contamination question.',
      },
    ],
    furtherReading: [
      {
        label: 'The Leaderboard Illusion, arXiv:2504.20879',
        href: 'https://arxiv.org/abs/2504.20879',
        note: 'The newest and sharpest criticism of the evaluation ecosystem.',
      },
    ],
  },
  {
    id: 'what-a-benchmark-is',
    moduleId: 'benchmark',
    number: 9,
    title: 'What a benchmark is for',
    subtitle: 'Two things it has to do at once',
    minutes: 20,
    objectives: [
      'State the two things a benchmark has to do at once',
      'Explain the tension between breadth and depth in a question set',
      'Say what the holistic framing adds to a single score',
    ],
    keyIdeas: [
      'A benchmark has to be hard enough to separate models and easy enough to run.',
      'A single number hides the trade-offs; a set of numbers shows them.',
      'The question set is a claim about what matters, and it should be argued for.',
    ],
    interactive: {
      lab: 'benchmark',
      view: 'design',
      title: 'Build a question set',
      description: 'See how the difficulty mix of a question set changes what the score measures.',
    },
    prerequisites: ['contamination'],
    glossaryTerms: ['benchmark', 'holistic-evaluation'],
    quizIds: ['q-benchmark-3'],
    sourceRefs: [],
    furtherReading: [
      {
        label: 'HELM, arXiv:2211.09110',
        href: 'https://arxiv.org/abs/2211.09110',
        note: 'The multi-metric, multi-scenario alternative to a single score.',
      },
    ],
  },

  /* ------------------------------------------------------------------ Module 6 */
  {
    id: 'standard-error',
    moduleId: 'measurement',
    number: 10,
    title: 'The standard error',
    subtitle: 'The number that should be next to the score',
    minutes: 20,
    objectives: [
      'Compute the standard error of a benchmark score',
      'Explain the one-over-the-square-root-of-N rule',
      'Argue for publishing the interval with the score',
    ],
    keyIdeas: [
      'A score from N binary outcomes is a proportion, with variance p(1−p)/N.',
      'To halve the interval you need four times as many questions.',
      'A difference smaller than the interval is not a difference.',
    ],
    interactive: {
      lab: 'measurement',
      view: 'interval',
      title: 'How the interval narrows',
      description: 'Plot the width of the confidence interval against the number of questions.',
    },
    prerequisites: [],
    glossaryTerms: ['standard-error', 'confidence-interval'],
    quizIds: ['q-measurement-1', 'q-measurement-2'],
    sourceRefs: [
      {
        chapter: 5,
        section: '5',
        title: 'Related work',
        page: 11,
        note: 'Where the paper situates itself among the measurement-based approaches to evaluation.',
      },
    ],
    furtherReading: [
      {
        label: 'Lessons from the Trenches, arXiv:2405.14782',
        href: 'https://arxiv.org/abs/2405.14782',
        note: 'The practical failure modes: seeds, decoders, chat templates, and how much each one moves a score.',
      },
    ],
  },
  {
    id: 'how-many-questions',
    moduleId: 'measurement',
    number: 11,
    title: 'How many questions',
    subtitle: 'The question nobody asks before the benchmark is released',
    minutes: 22,
    objectives: [
      'Compute the number of questions needed to detect a given difference',
      'Explain the power of a comparison',
      'Say what happens when the difference you care about is smaller than the noise',
    ],
    keyIdeas: [
      'The number of questions needed grows as the square of the inverse of the difference.',
      'A benchmark that cannot detect the difference you care about is not measuring it.',
      'Halving the effect size quadruples the cost.',
    ],
    interactive: {
      lab: 'measurement',
      view: 'power',
      title: 'The cost of detecting a small difference',
      description: 'Compute how many questions a given difference needs, and watch the curve.',
    },
    prerequisites: ['standard-error'],
    glossaryTerms: ['power', 'standard-error'],
    quizIds: ['q-measurement-3'],
    sourceRefs: [],
    furtherReading: [],
  },
  {
    id: 'the-honest-summary',
    moduleId: 'measurement',
    number: 12,
    title: 'What to publish',
    subtitle: 'The minimum a leaderboard should print',
    minutes: 18,
    objectives: [
      'List what a leaderboard should print next to every score',
      'Explain why the question count belongs there',
      'Argue for reporting the judge against a human baseline',
    ],
    keyIdeas: [
      'A score without an interval is a claim, not a measurement.',
      'A score without a question count cannot be compared with anything.',
      'A score without the protocol cannot be reproduced.',
    ],
    interactive: {
      lab: 'measurement',
      view: 'summary',
      title: 'What the interval looks like',
      description: 'The same score, with and without its interval, and what a reader can conclude from each.',
    },
    prerequisites: ['how-many-questions'],
    glossaryTerms: ['confidence-interval', 'human-baseline'],
    quizIds: ['q-measurement-4'],
    sourceRefs: [],
    furtherReading: [],
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
