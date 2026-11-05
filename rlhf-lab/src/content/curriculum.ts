/**
 * The course curriculum.
 *
 * The primary source is
 *
 *   S. Huang, M. Noukhovitch, A. Hosseini, K. Rasul, W. Wang, L. Tunstall,
 *   "The N+ Implementation Details of RLHF with PPO: A Case Study on TL;DR
 *   Summarization", arXiv:2403.17031 [cs.LG] / COLM 2024.
 *
 * Three further papers carry part of the argument: PPO for the clipped
 * objective, TRPO for the trust region it approximates, and Gao, Schulman and
 * Hilton for the reward-overoptimisation result.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  nplus: {
    id: 'huang-2024',
    title: 'The N+ Implementation Details of RLHF with PPO: A Case Study on TL;DR Summarization',
    authors: 'Shengyi Huang, Michael Noukhovitch, Arian Hosseini, Kashif Rasul, Weixun Wang, Lewis Tunstall',
    year: 2024,
    venue: 'arXiv:2403.17031 [cs.LG] / COLM 2024',
    url: 'https://arxiv.org/abs/2403.17031',
  },
  ppo: {
    id: 'schulman-2017-ppo',
    title: 'Proximal Policy Optimization Algorithms',
    authors: 'John Schulman, Filip Wolski, Prafulla Dhariwal, Alec Radford, Oleg Klimov',
    year: 2017,
    venue: 'arXiv:1707.06347 [cs.LG]',
    url: 'https://arxiv.org/abs/1707.06347',
  },
  trpo: {
    id: 'schulman-2015-trpo',
    title: 'Trust Region Policy Optimization',
    authors: 'John Schulman, Sergey Levine, Philipp Moritz, Michael I. Jordan, Pieter Abbeel',
    year: 2015,
    venue: 'arXiv:1502.05477 [cs.LG] / ICML 2015',
    url: 'https://arxiv.org/abs/1502.05477',
  },
  overopt: {
    id: 'gao-2022-overopt',
    title: 'Scaling Laws for Reward Model Overoptimization',
    authors: 'Leo Gao, John Schulman, Jacob Hilton',
    year: 2022,
    venue: 'arXiv:2210.10760 [cs.LG] / ICLR 2023',
    url: 'https://arxiv.org/abs/2210.10760',
  },
} as const

/** The section map of the primary source. */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  '1': { title: 'Introduction', note: 'The claim: that the reported RLHF gains are not reproducible without the details.' },
  '2': { title: 'Background: PPO and the RLHF pipeline', note: 'The three stages, and the PPO objective they are built on.' },
  '3': { title: 'Experimental setup', note: 'The models, the datasets, and the reward model.' },
  '4': { title: 'Implementation details', note: 'The enumerated list of details that decide whether the pipeline works.' },
  '5': { title: 'Results', note: 'The reproduced scaling behaviours and the ablation over the details.' },
  '6': { title: 'Conclusion', note: 'The summary of what had to be true for the pipeline to train.' },
  A: { title: 'Additional experimental results', note: 'The per-detail ablations in full.' },
  B: { title: 'Hyperparameters', note: 'The settings, in full.' },
  C: { title: 'Prompts', note: 'The prompts used at each stage.' },
  D: { title: 'Reward model details', note: 'The reward model’s training and the noise scale that was used.' },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'gradients',
    chapter: 2,
    title: 'Policy Gradients',
    tagline: 'Optimising a distribution by moving its log-probabilities',
    summary:
      'RLHF optimises a policy, not a function. This module introduces the objective — the expected reward of the policy — and the estimator that makes it tractable: the score-function trick, which replaces a derivative through the model with a weighted log-probability.',
    accent: 'indigo',
    outcomes: [
      'State the objective RLHF maximises and why it is an expectation over a distribution',
      'Write the score-function estimator and explain what replaced the derivative',
      'Verify a policy gradient against a finite difference on a problem where the answer is known',
    ],
  },
  {
    id: 'trust-region',
    chapter: 2,
    title: 'Trust Regions',
    tagline: 'Bounding how far one update may move the policy',
    summary:
      'Taking a large step in the space of policies destroys the policy: the samples that justified the old estimate no longer represent the new one. This module covers the constraint that prevents it, and the algorithm that made it practical.',
    accent: 'teal',
    outcomes: [
      'Write the trust-region constraint and say what it is for',
      'Explain why a KL penalty and a KL constraint are not the same thing',
      'Describe the natural gradient and the conjugate-gradient step that replaces it',
    ],
  },
  {
    id: 'ppo',
    chapter: 2,
    title: 'Proximal Policy Optimization',
    tagline: 'The clipped surrogate, and what the clip actually does',
    summary:
      'PPO replaces the hard constraint with a clip: once the importance ratio passes a bound, the objective stops rewarding movement in that direction. This module derives the objective, shows exactly when the clip bites, and covers the advantage estimate that goes with it.',
    accent: 'amber',
    outcomes: [
      'Write the clipped surrogate and identify the region where the gradient vanishes',
      'Compute the clip fraction and say what it measures',
      'Explain why a step that is clipped has zero gradient rather than a smaller one',
      'Derive generalised advantage estimation from the one-step residual',
    ],
  },
  {
    id: 'kl-penalty',
    chapter: 2,
    title: 'The KL Penalty',
    tagline: 'What keeps the aligned model recognisably itself',
    summary:
      'The penalty term is the KL divergence from the supervised reference policy, and it has to be *estimated* from samples. This module compares the three estimators in common use, shows which of them is unbiased for what, and explains why the right choice depends on whether the KL is a penalty or a report.',
    accent: 'emerald',
    outcomes: [
      'State why the penalty is measured from the reference policy',
      'Compare the three KL estimators and say what each is unbiased for',
      'Explain why a penalty has to be non-negative and a reported number does not',
    ],
  },
  {
    id: 'details',
    chapter: 4,
    title: 'The N+ Details',
    tagline: 'What had to be true for the pipeline to train at all',
    summary:
      'The primary source’s contribution is an enumeration: twenty implementation details, each of which was found to matter, and a reproduction that only worked with most of them in place. This module treats that list as a checklist of the failure modes of RLHF training.',
    accent: 'rose',
    outcomes: [
      'Name the stages of an RLHF pipeline and the failure mode of each',
      'Explain why the scale of the reward model’s error decides how far the policy can be pushed',
      'Argue for the checklist as a way of reporting a training result',
    ],
  },
  {
    id: 'overoptimisation',
    chapter: 5,
    title: 'Reward Overoptimisation',
    tagline: 'The point where optimising harder makes things worse',
    summary:
      'A reward model is a proxy, and a proxy that is optimised past its accuracy stops being informative. This module builds the phenomenon exactly rather than describing it, and fits the two functional forms the overoptimisation paper reports.',
    accent: 'violet',
    outcomes: [
      'State the overoptimisation result and why a fixed-size proxy error is enough to cause it',
      'Compare reinforcement learning and best-of-n against the same proxy',
      'Fit and read the two functional forms the paper reports',
      'Explain what the turning point of the curve means operationally',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  /* ------------------------------------------------------------------ Module 1 */
  {
    id: 'the-objective',
    moduleId: 'gradients',
    number: 1,
    title: 'The objective',
    subtitle: 'Maximising an expectation over a distribution you are also changing',
    minutes: 22,
    objectives: [
      'Write the objective an RLHF pipeline maximises',
      'Explain why the gradient of an expectation is not the expectation of the gradient',
      'Compute the expected reward of a policy on a finite problem exactly',
    ],
    keyIdeas: [
      'The objective is E_{a~π}[r(a)] — a number that depends on the whole distribution.',
      'Moving the policy changes which actions are sampled, so the derivative has to account for that.',
      'On a finite problem the expectation is a finite sum, and its gradient is available exactly.',
    ],
    interactive: {
      lab: 'gradient',
      view: 'objective',
      title: 'The expected reward and its gradient',
      description: 'Compute the expected reward of a policy and check its gradient against a finite difference.',
    },
    prerequisites: [],
    glossaryTerms: ['policy', 'policy-gradient', 'objective', 'expectation'],
    quizIds: ['q-gradients-1', 'q-gradients-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'Background: PPO and the RLHF pipeline',
        page: 3,
        note: 'The three stages of the pipeline and the objective the policy stage optimises.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-estimator',
    moduleId: 'gradients',
    number: 2,
    title: 'The estimator',
    subtitle: 'The derivative you do not have to take',
    minutes: 24,
    objectives: [
      'Write the score-function estimator',
      'Explain what it costs to be unbiased instead of low-variance',
      'State the conditions the estimator needs',
    ],
    keyIdeas: [
      '∇E_π[r] = E_π[r · ∇log π] — the model’s own log-probability replaces its derivative.',
      'The trick needs the support of π to be unchanged as the parameters move.',
      'The estimator is unbiased but high-variance, which is what the value function is for.',
    ],
    interactive: {
      lab: 'gradient',
      view: 'estimator',
      title: 'The estimator against the exact gradient',
      description: 'Compare the score-function estimator with the exact gradient of a finite problem.',
    },
    prerequisites: ['the-objective'],
    glossaryTerms: ['score-function-estimator', 'baseline', 'variance'],
    quizIds: ['q-gradients-3'],
    sourceRefs: [],
    furtherReading: [
      {
        label: 'Sutton & Barto, Reinforcement Learning: An Introduction',
        href: 'http://incompleteideas.net/book/RLbook2020.pdf',
        note: 'The policy gradient theorem, from first principles.',
      },
    ],
  },

  /* ------------------------------------------------------------------ Module 2 */
  {
    id: 'trust-regions',
    moduleId: 'trust-region',
    number: 3,
    title: 'The trust region',
    subtitle: 'Bounding the step, not the reward',
    minutes: 24,
    objectives: [
      'Write the trust-region constraint',
      'Explain what a large step does to the samples that justified the old estimate',
      'Distinguish a KL penalty from a KL constraint',
    ],
    keyIdeas: [
      'The constraint is on the KL between the old and new policies, not on the objective.',
      'A KL *penalty* is a soft nudge; a KL *constraint* is a hard boundary that the optimiser respects.',
      'The bound is what makes the importance ratio a usable estimate of the new policy.',
    ],
    interactive: {
      lab: 'gradient',
      view: 'trust-region',
      title: 'How far a step moves the policy',
      description: 'Watch the KL between the old and new policies as the step size grows.',
    },
    prerequisites: ['the-estimator'],
    glossaryTerms: ['trust-region', 'importance-ratio', 'natural-gradient'],
    quizIds: ['q-trust-1', 'q-trust-2'],
    sourceRefs: [],
    furtherReading: [
      {
        label: 'Schulman et al., arXiv:1502.05477',
        href: 'https://arxiv.org/abs/1502.05477',
        note: 'TRPO: the constraint, the natural gradient, and the conjugate-gradient step.',
      },
    ],
  },

  {
    id: 'the-kl-penalty',
    moduleId: 'kl-penalty',
    number: 4,
    title: 'The KL penalty',
    subtitle: 'A number that has to be estimated from samples',
    minutes: 26,
    objectives: [
      'State what the penalty measures and against what',
      'Write the three estimators and say what each is unbiased for',
      'Explain why a penalty must be non-negative',
    ],
    keyIdeas: [
      'The penalty is the KL from the reference policy, and it is a *sample* estimate.',
      'The naive estimator is unbiased but can be negative; the squared one is positive but biased.',
      'The third estimator is positive, and its expectation is the chi-square divergence minus the KL — a detail most write-ups leave out.',
    ],
    interactive: {
      lab: 'kl',
      view: 'estimators',
      title: 'The three estimators, measured',
      description: 'Estimate the KL three ways and compare each against the quantity it is actually unbiased for.',
    },
    prerequisites: ['trust-regions'],
    glossaryTerms: ['kl-penalty', 'reference-policy', 'k3-estimator'],
    quizIds: ['q-kl-1', 'q-kl-2'],
    sourceRefs: [
      {
        chapter: 4,
        section: '4',
        title: 'Implementation details',
        page: 8,
        note: 'The KL estimator and the coefficient, among the enumerated details that decide whether training works.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 3 */
  {
    id: 'the-clipped-objective',
    moduleId: 'ppo',
    number: 5,
    title: 'The clipped objective',
    subtitle: 'Where the gradient goes to zero',
    minutes: 26,
    objectives: [
      'Write the clipped surrogate and find the region where the clip is active',
      'Explain why a clipped step has zero gradient rather than a smaller one',
      'Compute the clip fraction and say what it is for',
    ],
    keyIdeas: [
      'The objective takes the minimum of the clipped and unclipped terms.',
      'When the clip is active the objective is flat, so its gradient is exactly zero.',
      'The clip fraction is the diagnostic: it should fall as training goes well.',
    ],
    interactive: {
      lab: 'ppo',
      view: 'clip',
      title: 'Where the clip bites',
      description: 'Sweep the importance ratio and watch the objective and its gradient change.',
    },
    prerequisites: ['the-estimator'],
    glossaryTerms: ['clipped-surrogate', 'clip-fraction', 'importance-ratio'],
    quizIds: ['q-ppo-1', 'q-ppo-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'Background: PPO and the RLHF pipeline',
        page: 4,
        note: 'The PPO objective the pipeline is built on.',
      },
    ],
    furtherReading: [
      {
        label: 'Schulman et al., arXiv:1707.06347',
        href: 'https://arxiv.org/abs/1707.06347',
        note: 'The clipped surrogate objective, and the reason for the clip.',
      },
    ],
  },
  {
    id: 'advantages',
    moduleId: 'ppo',
    number: 6,
    title: 'Advantages and GAE',
    subtitle: 'The credit assignment, and its one hyperparameter',
    minutes: 24,
    objectives: [
      'Write the one-step temporal-difference residual',
      'Derive generalised advantage estimation from it',
      'Explain the bias–variance trade-off that λ controls',
    ],
    keyIdeas: [
      'δ_t = r_t + γV(s_{t+1}) − V(s_t) is the one-step surprise.',
      'GAE sums the residuals with a geometric discount, and λ sets how far it looks.',
      'λ = 0 is the one-step estimate; λ = 1 is the Monte Carlo return.',
    ],
    interactive: {
      lab: 'gae',
      view: 'lambda',
      title: 'The bias–variance trade-off in λ',
      description: 'Move λ and watch the advantage estimate move from the one-step residual to the Monte Carlo return.',
    },
    prerequisites: ['the-clipped-objective'],
    glossaryTerms: ['advantage', 'gae', 'value-function'],
    quizIds: ['q-ppo-3'],
    sourceRefs: [
      {
        chapter: 4,
        section: '4',
        title: 'Implementation details',
        page: 8,
        note: 'The advantage estimator and the discount among the enumerated details.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 4 */
  {
    id: 'the-pipeline',
    moduleId: 'details',
    number: 7,
    title: 'The three stages',
    subtitle: 'Supervised, then ranked, then optimised',
    minutes: 22,
    objectives: [
      'Name the three stages of an RLHF pipeline and what each produces',
      'Say what each stage can fail at',
      'Explain why the reference policy comes from the first stage',
    ],
    keyIdeas: [
      'The supervised stage produces the reference policy that the penalty is measured against.',
      'The reward stage produces a *ranking* of responses, which is what the third stage consumes.',
      'The third stage optimises a policy against a proxy, and that is where the danger is.',
    ],
    interactive: {
      lab: 'pipeline',
      view: 'stages',
      title: 'The pipeline and its failure modes',
      description: 'Walk the three stages and see what each one contributes to the final behaviour.',
    },
    prerequisites: ['the-kl-penalty'],
    glossaryTerms: ['rlhf-pipeline', 'reward-model', 'reference-policy', 'sft'],
    quizIds: ['q-details-1', 'q-details-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: '2',
        title: 'Background: PPO and the RLHF pipeline',
        page: 3,
        note: 'The three stages and the data that flows between them.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-checklist',
    moduleId: 'details',
    number: 8,
    title: 'The checklist',
    subtitle: 'Twenty details, and the argument for listing them',
    minutes: 20,
    objectives: [
      'Explain why a training result without its details is not reproducible',
      'Give two examples of a detail that silently decides whether training works',
      'Argue for publishing the checklist alongside the result',
    ],
    keyIdeas: [
      'The primary source’s contribution is an enumeration, not a new algorithm.',
      'Most of the details are about scale: the reward model’s noise, the learning rate, the number of epochs.',
      'A result that omits them cannot be reproduced, and cannot be believed.',
    ],
    interactive: {
      lab: 'pipeline',
      view: 'checklist',
      title: 'The checklist',
      description: 'The failure modes of each stage, and which detail guards against each one.',
    },
    prerequisites: ['the-pipeline'],
    glossaryTerms: ['reproducibility', 'reward-model'],
    quizIds: ['q-details-3'],
    sourceRefs: [
      {
        chapter: 4,
        section: '4',
        title: 'Implementation details',
        page: 8,
        note: 'The enumerated implementation details, and the argument that reproducing the reported behaviour required most of them.',
      },
      {
        chapter: 5,
        section: '5',
        title: 'Results',
        page: 10,
        note: 'The ablation over the details, and the scaling behaviours that were reproduced.',
      },
    ],
    furtherReading: [],
  },

  /* ------------------------------------------------------------------ Module 5 */
  {
    id: 'the-overoptimisation-result',
    moduleId: 'overoptimisation',
    number: 9,
    title: 'The overoptimisation result',
    subtitle: 'Goodhart, with a curve',
    minutes: 24,
    objectives: [
      'State the result: optimising a proxy harder eventually makes the true reward worse',
      'Explain why a fixed-size proxy error is enough to cause it',
      'Read the turning point of the curve operationally',
    ],
    keyIdeas: [
      'The proxy error does not grow as you push harder, so the gap between the proxy and the truth opens up.',
      'The true reward is maximised at a finite distance from the reference, not at infinity.',
      'Past that point, every unit of proxy reward costs more true reward than it gains.',
    ],
    interactive: {
      lab: 'overoptimisation',
      view: 'curve',
      title: 'The curve',
      description: 'Push the policy further and watch the proxy rise while the true reward turns over.',
    },
    prerequisites: ['the-pipeline'],
    glossaryTerms: ['overoptimisation', 'goodhart', 'proxy-reward'],
    quizIds: ['q-overopt-1', 'q-overopt-2'],
    sourceRefs: [
      {
        chapter: 5,
        section: '5',
        title: 'Results',
        page: 10,
        note: 'The reproduced overoptimisation behaviour and the two functional forms fitted to it.',
      },
    ],
    furtherReading: [
      {
        label: 'Gao, Schulman & Hilton, arXiv:2210.10760',
        href: 'https://arxiv.org/abs/2210.10760',
        note: 'The measurement of overoptimisation, and the scaling laws for it.',
      },
    ],
  },
  {
    id: 'the-functional-forms',
    moduleId: 'overoptimisation',
    number: 10,
    title: 'The functional forms',
    subtitle: 'Two curves, fitted to a curve',
    minutes: 22,
    objectives: [
      'Write the two functional forms the overoptimisation paper reports',
      'Fit them to a controlled setting and read the fit',
      'Compare reinforcement learning against best-of-n on the same proxy',
    ],
    keyIdeas: [
      'For best-of-n: R(d) = d(α − β d), a downward parabola through the origin.',
      'For reinforcement learning: R(d) = d(α − β log d), which turns over more slowly.',
      'Best-of-n optimises the *sample*; reinforcement learning optimises the *policy*, and the two behave differently.',
    ],
    interactive: {
      lab: 'overoptimisation',
      view: 'fits',
      title: 'Fitting the forms',
      description: 'Fit both functional forms to the measured curve and compare the two methods.',
    },
    prerequisites: ['the-overoptimisation-result'],
    glossaryTerms: ['overoptimisation', 'best-of-n', 'functional-form'],
    quizIds: ['q-overopt-3'],
    sourceRefs: [
      {
        chapter: 5,
        section: '5',
        title: 'Results',
        page: 10,
        note: 'The functional forms fitted to the gold reward as a function of the KL distance.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-operational-lesson',
    moduleId: 'overoptimisation',
    number: 11,
    title: 'The operational lesson',
    subtitle: 'Where to stop',
    minutes: 18,
    objectives: [
      'Say what the turning point tells an practitioner',
      'Explain the role of the KL coefficient as the thing that sets the stopping point',
      'Argue for reporting the distance travelled alongside the score',
    ],
    keyIdeas: [
      'The KL coefficient is the dial that decides how far the policy is allowed to travel.',
      'The turning point is where the marginal proxy reward equals the marginal true reward.',
      'A report that gives a score without the distance travelled cannot be compared with another one.',
    ],
    interactive: {
      lab: 'overoptimisation',
      view: 'lesson',
      title: 'Where to stop',
      description: 'Read the turning point off the curve and the KL coefficient that reaches it.',
    },
    prerequisites: ['the-functional-forms'],
    glossaryTerms: ['kl-coefficient', 'overoptimisation'],
    quizIds: ['q-overopt-4'],
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
