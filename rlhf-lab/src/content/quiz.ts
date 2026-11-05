/**
 * The assessment bank.
 */

import type { QuizQuestion } from '@llm-materials/course-core'

export type { QuizQuestion }

const NPLUS = { label: 'Huang et al. (2024)' }
const PPO = { label: 'Schulman et al. (2017)' }
const TRPO = { label: 'Schulman et al. (2015)' }
const OVEROPT = { label: 'Gao, Schulman & Hilton (2022)' }
const COURSE = { label: 'This course' }

export const QUIZ: QuizQuestion[] = [
  {
    id: 'q-gradients-1',
    kind: 'multiple-choice',
    prompt: 'What does an RLHF policy stage maximise?',
    topic: 'The objective',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The expected reward under the policy, minus a KL penalty', feedback: 'Correct.' },
      { id: 'b', label: 'The reward of the single best response', feedback: 'That is a best-of-n objective, not a policy objective.' },
      { id: 'c', label: 'The likelihood of the reference responses', feedback: 'That is the supervised stage.' },
      { id: 'd', label: 'The log-probability of the policy’s samples', feedback: 'That is an objective, but it is not the one being maximised.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The objective is an expectation over the actions the policy samples, minus a penalty for moving away from the reference. The penalty is part of the objective, not a regulariser bolted on afterwards.',
    citation: NPLUS,
    lessonId: 'the-objective',
  },
  {
    id: 'q-gradients-2',
    kind: 'boolean',
    prompt: 'The gradient of an expectation is the expectation of the gradient.',
    topic: 'The objective',
    difficulty: 'core',
    truth: false,
    explanation:
      'No — and this is the whole reason the score-function estimator exists. The distribution is being moved, so the derivative has to account for that. The score-function estimator is the identity that makes it possible without differentiating through the model.',
    citation: COURSE,
    lessonId: 'the-objective',
  },
  {
    id: 'q-gradients-3',
    kind: 'multiple-choice',
    prompt: 'What does the score-function estimator replace?',
    topic: 'The estimator',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The derivative of the model, with its own log-probability', feedback: 'Correct.' },
      { id: 'b', label: 'The reward, with the value function', feedback: 'The value function is a baseline, not a replacement for the derivative.' },
      { id: 'c', label: 'The expectation, with a sample', feedback: 'The expectation is replaced by a Monte Carlo estimate; the derivative is replaced by the score.' },
      { id: 'd', label: 'The KL penalty, with a constraint', feedback: 'Different mechanism entirely.' },
    ],
    correctOptionId: 'a',
    explanation:
      '∇E_π[r] = E_π[r · ∇log π]. The model’s own log-probability stands in for the model’s derivative, which is what makes the estimator possible for a language model whose output layer is enormous.',
    citation: COURSE,
    lessonId: 'the-estimator',
  },
  {
    id: 'q-trust-1',
    kind: 'multiple-choice',
    prompt: 'What is the purpose of the trust-region constraint?',
    topic: 'The trust region',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'To keep the samples that justified the old estimate valid', feedback: 'Correct.' },
      { id: 'b', label: 'To stop the policy from producing low-probability text', feedback: 'That is a decoding constraint, not a training one.' },
      { id: 'c', label: 'To make the reward model more accurate', feedback: 'The constraint cannot change the reward model.' },
      { id: 'd', label: 'To keep the loss from diverging', feedback: 'Gradient clipping does that; the trust region is about the validity of the estimate.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The importance ratio is only a usable correction while the two policies are close. A large step makes the collected samples a poor description of the new policy, and the estimate silently becomes wrong.',
    citation: TRPO,
    lessonId: 'trust-regions',
  },
  {
    id: 'q-trust-2',
    kind: 'multiple-choice',
    prompt: 'How is a KL penalty different from a KL constraint?',
    topic: 'The trust region',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'A penalty is a soft term in the objective; a constraint is a boundary the optimiser respects', feedback: 'Correct.' },
      { id: 'b', label: 'They are the same thing with different names', feedback: 'They behave differently, and the difference matters.' },
      { id: 'c', label: 'A penalty is computed exactly and a constraint is estimated', feedback: 'Both are usually estimated from samples.' },
      { id: 'd', label: 'A constraint is a regulariser and a penalty is a hyperparameter', feedback: 'A coefficient is a hyperparameter either way.' },
    ],
    correctOptionId: 'a',
    explanation:
      'A penalty trades reward against distance at whatever ratio the coefficient sets. A constraint says the distance may not exceed δ, and the optimiser adjusts the step to respect it.',
    citation: TRPO,
    lessonId: 'trust-regions',
  },
  {
    id: 'q-kl-1',
    kind: 'multiple-choice',
    prompt: 'Which of the three KL estimators is unbiased for the KL divergence?',
    topic: 'The KL penalty',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'The log-ratio, k1', feedback: 'Correct — but it can be negative, which is why it is not used as a penalty.' },
      { id: 'b', label: 'The squared log-ratio, k2', feedback: 'It is always positive but biased upwards.' },
      { id: 'c', label: 'r − 1 − log r, k3', feedback: 'Its expectation is the chi-square divergence minus the KL, not the KL.' },
      { id: 'd', label: 'None of them', feedback: 'One of them is.' },
    ],
    correctOptionId: 'a',
    explanation:
      'E_π[log(π/π_ref)] is exactly the KL. The other two are used for different reasons: k2 because it is positive, k3 because it is positive and has lower variance — not because it is unbiased for the KL.',
    citation: COURSE,
    lessonId: 'the-kl-penalty',
  },
  {
    id: 'q-kl-2',
    kind: 'numeric',
    prompt:
      'A policy puts probability 0.5 on an action and the reference puts 0.25 on it. What is the log-ratio, in nats?',
    topic: 'The KL penalty',
    difficulty: 'core',
    answer: 0.6931472,
    tolerance: 0.0001,
    explanation:
      'log(0.5/0.25) = log 2 ≈ 0.693 nats. The k3 estimator on the same sample would be 2 − 1 − log 2 ≈ 0.307.',
    citation: COURSE,
    lessonId: 'the-kl-penalty',
  },
  {
    id: 'q-ppo-1',
    kind: 'multiple-choice',
    prompt: 'What happens to the gradient of the clipped objective when the clip is active?',
    topic: 'The clipped objective',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'It becomes exactly zero', feedback: 'Correct.' },
      { id: 'b', label: 'It becomes smaller but stays non-zero', feedback: 'No — the objective is flat in that region.' },
      { id: 'c', label: 'It is clipped to a small value', feedback: 'That is gradient clipping, a different mechanism.' },
      { id: 'd', label: 'It is rescaled by the clip factor', feedback: 'Not what happens.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Where the clip is active the objective is min(clipped, unclipped) and the clipped branch is the smaller one — and it is a constant. The gradient is therefore exactly zero, not merely small. That is the mechanism: the step is discarded, not shrunk.',
    citation: PPO,
    lessonId: 'the-clipped-objective',
  },
  {
    id: 'q-ppo-2',
    kind: 'numeric',
    prompt:
      'With ε = 0.2, what is the clipped objective when the importance ratio is 2.0 and the advantage is 1?',
    topic: 'The clipped objective',
    difficulty: 'core',
    answer: 1.2,
    tolerance: 0,
    explanation:
      'Exactly 1.2. The ratio is clipped to 1 + ε = 1.2, and the minimum of the two branches is the clipped one, because the advantage is positive.',
    citation: PPO,
    lessonId: 'the-clipped-objective',
  },
  {
    id: 'q-ppo-3',
    kind: 'multiple-choice',
    prompt: 'What does λ = 1 in generalised advantage estimation give?',
    topic: 'Advantages and GAE',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The Monte Carlo return, minus the baseline', feedback: 'Correct: unbiased, high variance.' },
      { id: 'b', label: 'The one-step temporal-difference residual', feedback: 'That is λ = 0.' },
      { id: 'c', label: 'The importance ratio', feedback: 'Unrelated.' },
      { id: 'd', label: 'Zero', feedback: 'Only if the rewards and values happen to cancel.' },
    ],
    correctOptionId: 'a',
    explanation:
      'λ = 1 makes the geometric sum telescope into the discounted return. It is unbiased and noisy; λ = 0 is the one-step residual, which is tight and biased.',
    citation: COURSE,
    lessonId: 'advantages',
  },
  {
    id: 'q-details-1',
    kind: 'multiple-choice',
    prompt: 'Which stage of the RLHF pipeline produces the reference policy?',
    topic: 'The three stages',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'Supervised fine-tuning', feedback: 'Correct.' },
      { id: 'b', label: 'Reward modelling', feedback: 'The reward model produces a ranking, not a policy.' },
      { id: 'c', label: 'Policy optimisation', feedback: 'That stage is the one the reference constrains.' },
      { id: 'd', label: 'Evaluation', feedback: 'Not a training stage.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The reference policy is the supervised model. The KL penalty is measured against it, so the reference decides both the direction and the size of the movement the third stage is allowed.',
    citation: NPLUS,
    lessonId: 'the-pipeline',
  },
  {
    id: 'q-details-2',
    kind: 'multiple-choice',
    prompt: 'What does the reward model produce?',
    topic: 'The three stages',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'A scalar score for a response', feedback: 'Correct, and the score is wrong in a way that matters.' },
      { id: 'b', label: 'A new policy', feedback: 'No — the policy is what the third stage produces.' },
      { id: 'c', label: 'A preference between two responses', feedback: 'It is trained on preferences but scores them individually.' },
      { id: 'd', label: 'A dataset', feedback: 'It consumes one.' },
    ],
    correctOptionId: 'a',
    explanation:
      'A scalar per response, trained from pairwise preferences. The third stage then maximises the expected score — and the error in that score is what makes overoptimisation possible.',
    citation: NPLUS,
    lessonId: 'the-pipeline',
  },
  {
    id: 'q-details-3',
    kind: 'boolean',
    prompt: 'The primary source’s main contribution is a new algorithm.',
    topic: 'The checklist',
    difficulty: 'hard',
    truth: false,
    explanation:
      'No. Its contribution is an enumeration and a reproduction: twenty implementation details that the reported behaviour depended on, and a demonstration that most of them had to be in place for the pipeline to train at all.',
    citation: NPLUS,
    lessonId: 'the-checklist',
  },
  {
    id: 'q-overopt-1',
    kind: 'multiple-choice',
    prompt: 'What is the overoptimisation result?',
    topic: 'The overoptimisation result',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'Optimising a proxy reward harder eventually makes the true reward worse', feedback: 'Correct.' },
      { id: 'b', label: 'A bigger reward model always gives a better policy', feedback: 'The opposite, for a fixed policy optimisation budget.' },
      { id: 'c', label: 'Reward models cannot be trained at all', feedback: 'They can, and they are useful.' },
      { id: 'd', label: 'The KL penalty should be removed', feedback: 'The opposite: the penalty is what limits the damage.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The true reward is maximised at a finite distance from the reference. Past that point every unit of proxy reward costs more true reward than it gains — which is Goodhart’s law with a curve attached.',
    citation: OVEROPT,
    lessonId: 'the-overoptimisation-result',
  },
  {
    id: 'q-overopt-2',
    kind: 'multiple-choice',
    prompt: 'Why is a fixed-size reward-model error enough to cause overoptimisation?',
    topic: 'The overoptimisation result',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'Because the error does not grow as the policy is pushed, so the gap between proxy and truth opens up', feedback: 'Correct.' },
      { id: 'b', label: 'Because the error is random and noise is always harmful', feedback: 'The harm comes from the policy finding and exploiting the error.' },
      { id: 'c', label: 'Because a fixed error makes the reward model worse over time', feedback: 'The reward model is fixed; it is the policy that moves.' },
      { id: 'd', label: 'Because the KL penalty grows with the error', feedback: 'The penalty grows with the distance travelled, which is a different thing.' },
    ],
    correctOptionId: 'a',
    explanation:
      'The proxy’s error is a fixed landscape. Pushing the policy further finds the high spots in that landscape, and the further you go the more the proxy is rewarding its own noise rather than the truth.',
    citation: OVEROPT,
    lessonId: 'the-overoptimisation-result',
  },
  {
    id: 'q-overopt-3',
    kind: 'multiple-choice',
    prompt: 'Which functional form does the overoptimisation paper fit for best-of-n?',
    topic: 'The functional forms',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'R(d) = d(α − β d)', feedback: 'Correct.' },
      { id: 'b', label: 'R(d) = d(α − β log d)', feedback: 'That is the form for reinforcement learning.' },
      { id: 'c', label: 'R(d) = α e^(−β d)', feedback: 'Not one of the two.' },
      { id: 'd', label: 'R(d) = α d² + β', feedback: 'Not one of the two.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Best-of-n: a downward parabola through the origin, R(d) = d(α − βd). Reinforcement learning: R(d) = d(α − β log d), which turns over more slowly because the policy moves rather than the sample.',
    citation: OVEROPT,
    lessonId: 'the-functional-forms',
  },
  {
    id: 'q-overopt-4',
    kind: 'multiple-choice',
    prompt: 'What does the turning point of the overoptimisation curve tell an practitioner?',
    topic: 'The operational lesson',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'The distance at which the marginal proxy reward equals the marginal true reward', feedback: 'Correct.' },
      { id: 'b', label: 'The point at which the reward model stops working', feedback: 'The reward model never worked exactly; the point is where its error starts to dominate.' },
      { id: 'c', label: 'The number of training steps to stop at', feedback: 'Unrelated.' },
      { id: 'd', label: 'That the KL penalty should be removed', feedback: 'The opposite.' },
    ],
    correctOptionId: 'a',
    explanation:
      'It is the optimal stopping point for a fixed budget, and it is what the KL coefficient is set to reach. Past it, the run is spending compute to make the true outcome worse.',
    citation: OVEROPT,
    lessonId: 'the-operational-lesson',
  },
]
