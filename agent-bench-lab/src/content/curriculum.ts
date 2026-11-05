/**
 * The course curriculum.
 *
 * The primary source is
 *
 *   C. E. Jimenez, S. Pombra, A. M. Agarwal et al.,
 *   "SWE-bench: Can Language Models Resolve Real-World GitHub Issues?",
 *   arXiv:2310.06770 [cs.SE] / ICLR 2024.
 *
 * Three further papers carry the rest of the course:
 *
 *   G. Mialon et al., "GAIA: a benchmark for General AI Assistants",
 *   arXiv:2311.12983 [cs.AI] / ICLR 2024;
 *
 *   T. Liu et al., "AgentBench: Evaluating LLMs as Agents",
 *   arXiv:2308.03688 [cs.AI] / ICLR 2024;
 *
 *   X. Zhou et al., "WebArena: A Realistic Web Environment for Building
 *   Autonomous Agents", arXiv:2307.13854 [cs.AI] / ICLR 2024.
 *
 * The section map below is built from those works, and the test suite
 * refuses a lesson that cites a section which is not in it.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  swebench: {
    id: 'jimenez-2023-swebench',
    title: 'SWE-bench: Can Language Models Resolve Real-World GitHub Issues?',
    authors: 'Carlos E. Jimenez, John Yang, Alexander Wettig, Shunyu Yao, Kexin Pei, Ofir Press and others',
    year: 2023,
    venue: 'arXiv:2310.06770 [cs.SE] / ICLR 2024',
    url: 'https://arxiv.org/abs/2310.06770',
  },
  gaia: {
    id: 'mialon-2023-gaia',
    title: 'GAIA: a benchmark for General AI Assistants',
    authors: 'Grégoire Mialon, Clémentine Fourrier, Craig Swift, Thomas Wolf, Yann LeCun, Thomas Scialom',
    year: 2023,
    venue: 'arXiv:2311.12983 [cs.AI] / ICLR 2024',
    url: 'https://arxiv.org/abs/2311.12983',
  },
  agentbench: {
    id: 'liu-2023-agentbench',
    title: 'AgentBench: Evaluating LLMs as Agents',
    authors: 'Xiao Liu, Hao Yu, Hanchen Zhang, Yifan Xu, Xuanyu Lei, Hanyu Lai and others',
    year: 2023,
    venue: 'arXiv:2308.03688 [cs.AI] / ICLR 2024',
    url: 'https://arxiv.org/abs/2308.03688',
  },
  webarena: {
    id: 'zhou-2024-webarena',
    title: 'WebArena: A Realistic Web Environment for Building Autonomous Agents',
    authors: 'Shuyan Zhou, Frank F. Xu, Hao Zhu, Xuhui Zhou, Robert Lo, Abishek Sridhar and others',
    year: 2024,
    venue: 'arXiv:2307.13854 [cs.AI] / ICLR 2024',
    url: 'https://arxiv.org/abs/2307.13854',
  },
} as const

/** The section map of the sources this course cites. */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  'swebench:1': { title: 'Introduction', note: 'The claim: resolving a real issue is a different problem from writing a function.' },
  'swebench:3': { title: 'The benchmark', note: 'The tasks, the repositories, and the criterion that decides whether a task is solved.' },
  'swebench:3.1': { title: 'The evaluation criterion', note: 'The two conditions: the failing test must pass, and the passing tests must keep passing.' },
  'swebench:4': { title: 'The results', note: 'The agentless baseline, and the argument that the agent is not the bottleneck.' },
  'swebench:5': { title: 'Discussion', note: 'The contamination, the variance, and what a score on a task set means.' },
  'gaia:1': { title: 'Introduction', note: 'What a general assistant has to do, and why the questions are graded objectively.' },
  'gaia:3': { title: 'The questions', note: 'The three levels, and the design of the questions at each.' },
  'agentbench:3': { title: 'The environments', note: 'The eight environments, and what each one measures.' },
  'webarena:1': { title: 'Introduction', note: 'Why a realistic web environment is hard to build and what it is for.' },
  'webarena:4': { title: 'Evaluation', note: 'The evaluation functions, and the difference between them and a string match.' },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'task-design',
    chapter: 3,
    title: 'Task Design',
    tagline: 'What a benchmark is made of',
    summary:
      'The tasks, the difficulty mix, and the number of them. What a score on a task set means, and what it does not.',
    accent: 'indigo',
    outcomes: [
      'Say what makes a task a task, and what makes it a good one',
      'Compute the uncertainty on a score, and the number of tasks a difference needs',
      'Explain why a task set is a sample and the score is an estimate',
    ],
  },
  {
    id: 'verification',
    chapter: 3,
    title: 'Verification',
    tagline: 'The criterion that decides the task',
    summary:
      'The two conditions a solution must satisfy, the failure mode a criterion has to catch, and what a verifier costs.',
    accent: 'teal',
    outcomes: [
      'State the two conditions and say what each is for',
      'Describe the failure a verifier has to catch, and how it is caught',
      'Explain why a verifier is the part of the benchmark that is hardest to get right',
    ],
  },
  {
    id: 'the-baselines',
    chapter: 4,
    title: 'The Baselines',
    tagline: 'What a score has to beat',
    summary:
      'The agentless baseline, the agent that tries several times, and the arithmetic of what the second one costs.',
    accent: 'amber',
    outcomes: [
      'Describe the agentless baseline and why it is the number to beat',
      'Compare an agent with the baseline on the same tasks',
      'Measure the cost of the agent in attempts, and say what it buys',
    ],
  },
  {
    id: 'variance-and-contamination',
    chapter: 5,
    title: 'Variance and Contamination',
    tagline: 'The two ways a benchmark lies to you',
    summary:
      'The variance of a score, the difference between one run and many, and the overlap test that finds a task the model has already seen.',
    accent: 'emerald',
    outcomes: [
      'Compute the variance of a score, and the interval that goes with it',
      'Explain the unbiased estimate of pass@k, and why a single run overstates it',
      'Measure contamination with an n-gram overlap, and say what the length of the n-gram decides',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  {
    id: 'what-a-task-is',
    moduleId: 'task-design',
    number: 1,
    title: 'What a task is',
    subtitle: 'And what makes a good one',
    minutes: 24,
    objectives: [
      'Say what a benchmark task is: an environment, a goal and a verdict',
      'Explain the three properties a good task set has',
      'Describe what a difficulty mix does to a score',
    ],
    keyIdeas: [
      'A task is a starting state, a goal, and something that decides whether the goal was reached.',
      'A good task set is diverse, verified, and hard enough that the trivial strategies fail.',
      'The difficulty mix is a choice, and it decides what the score means.',
    ],
    interactive: {
      lab: 'design',
      view: 'tasks',
      title: 'Look at the tasks',
      description: 'The task set, its difficulty mix, and the interval on its score.',
    },
    prerequisites: [],
    glossaryTerms: ['benchmark', 'task', 'difficulty-mix'],
    quizIds: ['q-design-1', 'q-design-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'swebench:3',
        title: 'The benchmark',
        note: 'The tasks, the repositories, and the criterion that decides whether a task is solved.',
      },
      {
        chapter: 3,
        section: 'gaia:3',
        title: 'The questions',
        note: 'The three levels, and the design of the questions at each.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-score-and-its-uncertainty',
    moduleId: 'task-design',
    number: 2,
    title: 'The score and its uncertainty',
    subtitle: 'What a number on a task set means',
    minutes: 26,
    objectives: [
      'Explain why a score on a task set is an estimate rather than a fact',
      'Compute the interval on a score, and say why the usual one is wrong near zero',
      'Compute how many tasks a given difference needs',
    ],
    keyIdeas: [
      'The tasks are a sample, and the score estimates the rate on the population.',
      'The interval on a proportion is not symmetric, and near zero the normal approximation is nonsense.',
      'A difference between two systems has to be bigger than the noise before it means anything.',
    ],
    interactive: {
      lab: 'design',
      view: 'interval',
      title: 'Size the uncertainty',
      description: 'The interval on a score, and the number of tasks a difference needs.',
    },
    prerequisites: ['what-a-task-is'],
    glossaryTerms: ['interval', 'sample', 'power'],
    quizIds: ['q-design-3'],
    sourceRefs: [
      {
        chapter: 5,
        section: 'swebench:5',
        title: 'Discussion',
        note: 'The variance, and what a score on a task set means.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-evaluation-criterion',
    moduleId: 'verification',
    number: 3,
    title: 'The evaluation criterion',
    subtitle: 'The two conditions',
    minutes: 26,
    objectives: [
      'State the two conditions a solution must satisfy',
      'Say what each condition is for, and what fails without it',
      'Explain why the criterion is the hardest part of a benchmark to get right',
    ],
    keyIdeas: [
      'The failing test must start failing and end passing, and the passing tests must keep passing.',
      'The first condition alone is satisfied by a solver that changes the test.',
      'The second condition is what makes the first one mean something.',
    ],
    interactive: {
      lab: 'verifier',
      view: 'criterion',
      title: 'Check the criterion',
      description: 'The four kinds of patch, and the verdict each one gets.',
    },
    prerequisites: ['what-a-task-is'],
    glossaryTerms: ['verifier', 'fail-to-pass', 'pass-to-pass'],
    quizIds: ['q-verify-1', 'q-verify-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'swebench:3.1',
        title: 'The evaluation criterion',
        note: 'The two conditions: the failing test must pass, and the passing tests must keep passing.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-cheat',
    moduleId: 'verification',
    number: 4,
    title: 'The cheat',
    subtitle: 'What a criterion has to catch',
    minutes: 22,
    objectives: [
      'Describe the failure mode a solver that changes the test exploits',
      'Explain how the criterion catches it',
      'Say what a score means when the criterion is weak',
    ],
    keyIdeas: [
      'A solver that can change the test does not have to solve the task.',
      'The criterion catches it by requiring the other tests to keep passing, and by distrusting a patch that touches a test.',
      'A benchmark whose criterion is weak measures something else, and does not say what.',
    ],
    interactive: {
      lab: 'verifier',
      view: 'cheat',
      title: 'Watch the cheat',
      description: 'A solver that changes the test, and the score it would have got.',
    },
    prerequisites: ['the-evaluation-criterion'],
    glossaryTerms: ['verifier', 'gaming'],
    quizIds: ['q-verify-3'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'swebench:3.1',
        title: 'The evaluation criterion',
        note: 'The criterion, and the failure it has to catch.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-agentless-baseline',
    moduleId: 'the-baselines',
    number: 5,
    title: 'The agentless baseline',
    subtitle: 'What a score has to beat',
    minutes: 24,
    objectives: [
      'Describe the agentless baseline and what it does',
      'Explain why it is the number every agent has to beat',
      'Compare it with an agent on the same tasks',
    ],
    keyIdeas: [
      'The baseline retrieves the relevant file and makes one obvious change.',
      'Most of what an agent adds is the ability to try again, and that has a price.',
      'The comparison has to be on the same tasks, with the same verifier.',
    ],
    interactive: {
      lab: 'baselines',
      view: 'comparison',
      title: 'Run the baseline',
      description: 'The agentless baseline, its score, and the interval on it.',
    },
    prerequisites: ['the-evaluation-criterion'],
    glossaryTerms: ['agentless-baseline', 'solver'],
    quizIds: ['q-baseline-1'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'swebench:4',
        title: 'The results',
        note: 'The agentless baseline, and the argument that the agent is not the bottleneck.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-price-of-trying-again',
    moduleId: 'the-baselines',
    number: 6,
    title: 'The price of trying again',
    subtitle: 'What the agent spends',
    minutes: 22,
    objectives: [
      'Measure the number of attempts an agent makes',
      'Compare the agent with the baseline on the same tasks',
      'Say what the extra attempts buy and what they cost',
    ],
    keyIdeas: [
      'An agent that tries several times solves more tasks and makes more attempts.',
      'The attempts are the cost, and they are paid in model calls.',
      'So the comparison is not between the two scores but between the two scores per attempt.',
    ],
    interactive: {
      lab: 'baselines',
      view: 'comparison',
      title: 'Run the agent',
      description: 'The agent, the attempts it makes, and the tasks it solves.',
    },
    prerequisites: ['the-agentless-baseline'],
    glossaryTerms: ['solver', 'pass-at-k'],
    quizIds: ['q-baseline-2'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'swebench:4',
        title: 'The results',
        note: 'The comparison of the agent with the baseline.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'one-run-or-many',
    moduleId: 'variance-and-contamination',
    number: 7,
    title: 'One run or many',
    subtitle: 'The variance, and the pass@k estimator',
    minutes: 26,
    objectives: [
      'Compute the variance of a score across runs',
      'Explain why a single run overstates pass@k, and what the unbiased estimate is',
      'Say how many samples a comparison needs',
    ],
    keyIdeas: [
      'A solver is stochastic, so one run is one sample of a distribution.',
      'The naive estimate of pass@k is biased upwards, and the correction is what makes two sample budgets comparable.',
      'The paired comparison is more sensitive than comparing two independent scores.',
    ],
    interactive: {
      lab: 'baselines',
      view: 'variance',
      title: 'Measure the variance',
      description: 'The score across repeated runs, and the interval it implies.',
    },
    prerequisites: ['the-score-and-its-uncertainty'],
    glossaryTerms: ['variance', 'pass-at-k', 'paired-comparison'],
    quizIds: ['q-variance-1', 'q-variance-2'],
    sourceRefs: [
      {
        chapter: 5,
        section: 'swebench:5',
        title: 'Discussion',
        note: 'The variance of a score across runs.',
      },
      {
        chapter: 3,
        section: 'agentbench:3',
        title: 'The environments',
        note: 'The eight environments, and what each one measures.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'has-the-model-seen-it',
    moduleId: 'variance-and-contamination',
    number: 8,
    title: 'Has the model seen it?',
    subtitle: 'Contamination, and the overlap that finds it',
    minutes: 26,
    objectives: [
      'Describe what benchmark contamination is and why it invalidates a score',
      'Measure it with an n-gram overlap, and report the two rates it gives',
      'Say what the length of the n-gram decides, and what the threshold decides',
    ],
    keyIdeas: [
      'A task the model has already seen is not a measurement of anything.',
      'The detection is an overlap test, and it has two failure modes: too short a match catches ordinary text, too long a match misses an edited copy.',
      'So the length and the threshold are decisions, and the rates they give are the report.',
    ],
    interactive: {
      lab: 'contamination',
      view: 'contamination',
      title: 'Look for the leak',
      description: 'The overlap of every task’s solution with a training corpus, and the rates the test gives.',
    },
    prerequisites: ['one-run-or-many'],
    glossaryTerms: ['contamination', 'overlap-test'],
    quizIds: ['q-contamination-1', 'q-contamination-2'],
    sourceRefs: [
      {
        chapter: 5,
        section: 'swebench:5',
        title: 'Discussion',
        note: 'The contamination, and what it does to a score.',
      },
      {
        chapter: 4,
        section: 'webarena:4',
        title: 'Evaluation',
        note: 'The evaluation functions, and the difference between them and a string match.',
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
