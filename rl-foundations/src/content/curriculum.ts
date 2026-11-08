/**
 * The course curriculum.
 *
 * The primary source is
 *
 *   R. S. Sutton, A. G. Barto,
 *   "Reinforcement Learning: An Introduction" (second edition),
 *   MIT Press, 2018.
 *
 * Two further works carry the rest of the course:
 *
 *   OpenAI, "Spinning Up in Deep RL", an online course with reference code;
 *
 *   G. Williams, C. J. C. Burges, "Asymptotic Confidence Bounds for the Monte
 *   Carlo Estimation of the Value Function: A Bootstrap Approach",
 *   Machine Learning 8, 375-389, 1990.
 *
 * The section map below is built from those works, and the test suite
 * refuses a lesson that cites a section which is not in it.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  sutton: {
    id: 'sutton-barto',
    title: 'Reinforcement Learning: An Introduction (second edition)',
    authors: 'Richard S. Sutton, Andrew G. Barto',
    year: 2018,
    venue: 'MIT Press; the authors publish the complete PDF free',
    url: 'http://incompleteideas.net/book/the-book-2nd.html',
  },
  spinningup: {
    id: 'spinning-up',
    title: 'Spinning Up in Deep RL',
    authors: 'OpenAI',
    year: 2019,
    venue: 'An online course with reference implementations',
    url: 'https://spinningup.openai.com/',
  },
  gae: {
    id: 'williams-1992-gae',
    title: 'Asymptotic Confidence Bounds for the Monte Carlo Estimation of the Value Function: A Bootstrap Approach',
    authors: 'Gert Williams, Christopher J. C. Burges',
    year: 1990,
    venue: 'Machine Learning 8, 375-389',
    url: 'https://link.springer.com/article/10.1007/BF00983696',
  },
} as const

/** The section map of the sources this course cites. */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  'sutton:3': { title: 'The Markov Decision Process', note: 'States, actions, rewards, transitions and returns, and what the Markov property buys.' },
  'sutton:4': { title: 'The value function', note: 'What a value function is, what it is worth, and the two ways of writing it.' },
  'sutton:5': { title: 'One-step prediction methods', note: 'The temporal-difference error, and the update it produces.' },
  'sutton:6': { title: 'Policy evaluation', note: 'Finding the value of a given policy by iteration.' },
  'sutton:9': { title: 'Value iteration', note: 'The Bellman optimality equation, and the sweep that solves it.' },
  'sutton:13': { title: 'Policy gradients', note: 'The likelihood-ratio trick, the policy gradient theorem, and what the estimate is.' },
  'spinningup:2': { title: 'The reinforcement learning problem', note: 'The return, the discount, and the vocabulary of the course.' },
  'spinningup:3': { title: 'Deriving the policy gradient', note: 'The derivation, the estimators, and the variance of each of them.' },
  'spinningup:4': { title: 'Beyond policy gradients', note: 'The actor-critic family and what it adds.' },
  'gae:1': { title: 'The bootstrap estimator', note: 'The λ-return, the variance–bias trade-off, and the general advantage estimate.' },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'the-mdp',
    chapter: 3,
    title: 'The MDP',
    tagline: 'The problem, written down exactly',
    summary:
      'States, actions, rewards, transitions and returns. The Markov property, the discount, and the two things the discount is for.',
    accent: 'indigo',
    outcomes: [
      'Write down a Markov decision process and say what the Markov property rules out',
      'Compute a return, and say what the discount is for',
      'Say what a policy is, and what a stochastic policy buys',
    ],
  },
  {
    id: 'value-functions',
    chapter: 4,
    title: 'Value functions',
    tagline: 'What a state is worth, and how to find out',
    summary:
      'The value of a state under a policy, the value of the best policy, and the two sweeps that compute them exactly.',
    accent: 'teal',
    outcomes: [
      'State the Bellman equation and say what each term is',
      'Compute a value function by policy evaluation, and check that it satisfies the equation',
      'Compute the optimal value function and read the optimal policy off it',
    ],
  },
  {
    id: 'policy-gradients',
    chapter: 13,
    title: 'Policy gradients',
    tagline: 'The gradient, and how to estimate it while acting',
    summary:
      'The likelihood-ratio trick, the policy gradient theorem, and the estimator that follows from it — checked here against the exact gradient of the exact expected return.',
    accent: 'amber',
    outcomes: [
      'Derive the likelihood-ratio trick from the definition of the gradient',
      'State the policy gradient theorem and say what it is the gradient of',
      'Estimate the gradient while acting, and check the estimate against the exact answer',
    ],
  },
  {
    id: 'actor-critic',
    chapter: 10,
    title: 'Actor–critic',
    tagline: 'A smaller signal, and what it costs',
    summary:
      'The baseline that removes the variance, the λ-return and the general advantage estimate, and the loop that puts them together.',
    accent: 'emerald',
    outcomes: [
      'Say what a baseline does to the expectation and to the variance',
      'Compare the n-step and the λ-return as estimators of the advantage',
      'Run an actor–critic loop and read its learning curves',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  {
    id: 'states-and-returns',
    moduleId: 'the-mdp',
    number: 1,
    title: 'States and returns',
    subtitle: 'The problem, written down exactly',
    minutes: 24,
    objectives: [
      'Write down a Markov decision process',
      'Compute the return of a trajectory, with and without a discount',
      'Say what the Markov property rules out and what it buys',
    ],
    keyIdeas: [
      'A Markov decision process is a tuple: states, actions, a reward function and a transition kernel.',
      'The Markov property says the next state depends only on the present one — not on the whole history.',
      'The discount is not a preference; it is what makes the infinite sum converge and what makes the problem finite.',
    ],
    interactive: {
      lab: 'gridworld',
      view: 'world',
      title: 'Walk the grid',
      description: 'The gridworld, its transition kernel, and the return of a trajectory.',
    },
    prerequisites: [],
    glossaryTerms: ['mdp', 'return', 'discount', 'policy'],
    quizIds: ['q-mdp-1', 'q-mdp-2', 'q-mdp-markov', 'q-discount-converge'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'sutton:3',
        title: 'The Markov Decision Process',
        note: 'The formalisation, and the returns.',
      },
      {
        chapter: 2,
        section: 'spinningup:2',
        title: 'The reinforcement learning problem',
        note: 'The return, the discount, and the vocabulary.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-value-function',
    moduleId: 'value-functions',
    number: 2,
    title: 'The value function',
    subtitle: 'What a state is worth',
    minutes: 26,
    objectives: [
      'Define the value of a state under a policy',
      'State the Bellman equation and say what each term is',
      'Explain why the value is a fixed point, and what that means',
    ],
    keyIdeas: [
      'The value of a state is the expected return from it, under a policy.',
      'The Bellman equation says the value is the reward plus the discounted value of the next state.',
      'Iterating the equation converges to the value: it is a contraction, and the iteration is a fixed-point method.',
    ],
    interactive: {
      lab: 'gridworld',
      view: 'value',
      title: 'Sweep the values',
      description: 'The value iteration, sweep by sweep, and the policy it produces.',
    },
    prerequisites: ['states-and-returns'],
    glossaryTerms: ['value-function', 'bellman-equation'],
    quizIds: ['q-value-1', 'q-bellman-shape'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'sutton:4',
        title: 'The value function',
        note: 'What a value function is, and the two ways of writing it.',
      },
      {
        chapter: 6,
        section: 'sutton:6',
        title: 'Policy evaluation',
        note: 'Finding the value of a policy by iteration.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-likelihood-ratio-trick',
    moduleId: 'policy-gradients',
    number: 3,
    title: 'The likelihood-ratio trick',
    subtitle: 'How the gradient is turned into something you can measure while acting',
    minutes: 28,
    objectives: [
      'Derive the likelihood-ratio trick from the definition of the gradient',
      'Explain what the trick does to the terms that do not depend on the parameters',
      'Write the estimator that follows from it',
      'Check the derivation on a problem small enough to compute it exactly',
    ],
    keyIdeas: [
      'The gradient of a log-probability is the score function.',
      'Multiplying by the likelihood turns an expectation under one distribution into an expectation under another.',
      'Everything that does not depend on the parameters drops out, and what is left can be sampled.',
      'With one state the expectation is a finite sum, so the three forms of the gradient can be printed side by side and their difference is arithmetic error rather than luck.',
    ],
    interactive: {
      lab: 'policygradient',
      view: 'derivation',
      title: 'Derive it, and check it',
      description:
        'One state, so every line of the derivation is computable: the gradient three ways, the exact moments of the sampled estimate, and the sixty uphill steps the derivative predicts. The next two views run the same estimator on the gridworld against a finite difference, with and without a baseline.',
    },
    prerequisites: ['states-and-returns'],
    glossaryTerms: ['score-function', 'log-probability', 'likelihood-ratio', 'bandit', 'reinforce'],
    quizIds: ['q-gradient-1', 'q-gradient-2'],
    sourceRefs: [
      {
        chapter: 13,
        section: 'sutton:13',
        title: 'Policy gradients',
        note: 'The likelihood-ratio trick, the policy gradient theorem, and the estimate.',
      },
      {
        chapter: 3,
        section: 'spinningup:3',
        title: 'Deriving the policy gradient',
        note: 'The derivation and the estimators that follow from it.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-baseline',
    moduleId: 'actor-critic',
    number: 4,
    title: 'The baseline',
    subtitle: 'A smaller signal that means the same thing',
    minutes: 24,
    objectives: [
      'Show that a baseline does not change the expectation of the gradient',
      'Explain why a good baseline reduces the variance so much',
      'Say what the advantage is, and what it is worth',
      'Say which rewards a step may be weighted by, and why the choice is free in expectation',
    ],
    keyIdeas: [
      'Subtracting any function of the state leaves the expected gradient unchanged.',
      'The reason is that the baseline does not depend on the action, so its expectation is zero.',
      'A good baseline removes the part of the return that was going to happen anyway, and that part is most of the noise.',
      'The same argument covers the weighting: the rewards a step arrived with cannot be influenced by it, so dropping them changes the spread and not the mean.',
    ],
    interactive: {
      lab: 'returns',
      view: 'weighting',
      title: 'Reward-to-go, and the spread it leaves',
      description:
        'One estimator, two weights: the rewards still to come, and the whole episode’s return. The two means agree to the sampling noise of the batches, and the two spreads do not. Laboratory B holds the other half of the saving — the same comparison with the value of the state subtracted.',
    },
    prerequisites: ['the-likelihood-ratio-trick'],
    glossaryTerms: ['baseline', 'advantage', 'reward-to-go'],
    quizIds: ['q-actor-1', 'q-baseline-exact'],
    sourceRefs: [
      {
        chapter: 13,
        section: 'sutton:13',
        title: 'Policy gradients',
        note: 'The baseline, and what it does to the variance of the estimate.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-n-step-return',
    moduleId: 'actor-critic',
    number: 5,
    title: 'The n-step return',
    subtitle: 'Trading the bias of the bootstrap against the noise of the sample',
    minutes: 26,
    objectives: [
      'Compute the n-step return',
      'Say what makes it biased, and what makes it noisy',
      'Explain why the two ends of the range are bad in different ways',
    ],
    keyIdeas: [
      'The n-step return bootstraps after n steps, and the bootstrap is biased while the sample is noisy.',
      'The one-step return is the least noisy and the most biased; the Monte Carlo return is the reverse.',
      'The λ-return is a mixture, and λ is the knob between them.',
    ],
    interactive: {
      lab: 'returns',
      view: 'nstep',
      title: 'Count the steps',
      description: 'The n-step returns of a real trajectory, and the truth they are aiming at.',
    },
    prerequisites: ['the-baseline'],
    glossaryTerms: ['n-step-return', 'bootstrap', 'lambda-return'],
    quizIds: ['q-actor-2'],
    sourceRefs: [
      {
        chapter: 5,
        section: 'sutton:5',
        title: 'One-step prediction methods',
        note: 'The temporal-difference error, and the update it produces.',
      },
      {
        chapter: 1,
        section: 'gae:1',
        title: 'The bootstrap estimator',
        note: 'The λ-return and the trade-off it makes.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-lambda-return',
    moduleId: 'actor-critic',
    number: 6,
    title: 'The λ-return',
    subtitle: 'A whole family of estimators, and the one knob',
    minutes: 24,
    objectives: [
      'Compute the λ-return and the general advantage estimate',
      'Measure the bias and the variance of an estimator, rather than assuming them',
      'Say where the best λ is, and why it depends on the horizon',
    ],
    keyIdeas: [
      'The λ-return is a weighted mixture of the n-step returns, with weights (1−λ)λ^(n−1).',
      'The general advantage estimate is the same thing, written in terms of the temporal-difference errors.',
      'The best λ is the one that matches the estimator to the horizon you actually have.',
    ],
    interactive: {
      lab: 'returns',
      view: 'lambda',
      title: 'Sweep λ',
      description: 'The bias and the variance of the estimator, measured, as λ moves.',
    },
    prerequisites: ['the-n-step-return'],
    glossaryTerms: ['lambda-return', 'general-advantage'],
    quizIds: ['q-actor-3', 'q-lambda-two-step'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'gae:1',
        title: 'The bootstrap estimator',
        note: 'The λ-return, the variance–bias trade-off, and the general advantage estimate.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-actor-critic-loop',
    moduleId: 'actor-critic',
    number: 7,
    title: 'The actor–critic loop',
    subtitle: 'The two halves, and how they are put together',
    minutes: 26,
    objectives: [
      'Say what the actor does and what the critic does',
      'Describe the temporal-difference update the critic makes',
      'Run the loop and read the learning curve it produces',
    ],
    keyIdeas: [
      'The critic estimates the value; the actor follows the advantage the critic makes available.',
      'The critic is a bootstrapping estimator, so it is biased and it is noisy, and it learns fast.',
      'The two halves have different learning rates, and the difference matters.',
    ],
    interactive: {
      lab: 'actorcritic',
      view: 'loop',
      title: 'Run the loop',
      description: 'The actor–critic loop, run here, with its learning curves.',
    },
    prerequisites: ['the-lambda-return'],
    glossaryTerms: ['actor-critic', 'temporal-difference', 'advantage'],
    quizIds: ['q-actor-4'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'spinningup:4',
        title: 'Beyond policy gradients',
        note: 'The actor–critic family and what it adds.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-optimal-policy',
    moduleId: 'value-functions',
    number: 8,
    title: 'The optimal policy',
    subtitle: 'And the answer every laboratory is checked against',
    minutes: 22,
    objectives: [
      'Compute the optimal value function by value iteration',
      'Read the greedy policy off the optimal value function',
      'Say what a policy gradient is trying to find, in these terms',
    ],
    keyIdeas: [
      'The optimal value function is the largest value any policy achieves, and it satisfies its own Bellman equation.',
      'The greedy policy with respect to the optimal value function is optimal.',
      'A policy gradient is a stochastic way of finding the same thing, without ever writing the equation down.',
    ],
    interactive: {
      lab: 'gridworld',
      view: 'optimal',
      title: 'See the optimum',
      description: 'The optimal policy and the value of reaching the goal, computed exactly.',
    },
    prerequisites: ['the-value-function'],
    glossaryTerms: ['optimal-policy', 'value-iteration'],
    quizIds: ['q-value-2'],
    sourceRefs: [
      {
        chapter: 9,
        section: 'sutton:9',
        title: 'Value iteration',
        note: 'The Bellman optimality equation, and the sweep that solves it.',
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
