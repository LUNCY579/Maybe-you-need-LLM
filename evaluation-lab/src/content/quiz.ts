/**
 * The assessment bank.
 */

import type { QuizQuestion } from '@llm-materials/course-core'

export type { QuizQuestion }

const MTBENCH = { label: 'Zheng et al. (2023)' }
const ARENA = { label: 'Chiang et al. (2024)' }
const HELM = { label: 'Liang et al. (2023)' }
const TRENCHES = { label: 'Reuel et al. (2024)' }
const COURSE = { label: 'This course' }

export const QUIZ: QuizQuestion[] = [
  /* ------------------------------------------------------------------ judging */
  {
    id: 'q-judging-1',
    kind: 'multiple-choice',
    prompt: 'What is an LLM-as-a-judge asked to do?',
    topic: 'Judging with a model',
    difficulty: 'warmup',
    options: [
      { id: 'a', label: 'Score an answer against a reference answer', feedback: 'That is the scoring setup, not the pairwise one.' },
      { id: 'b', label: 'Choose between two candidate answers', feedback: 'Correct.' },
      { id: 'c', label: 'Rewrite the answer to improve it', feedback: 'That is a critique, not a judgement.' },
      { id: 'd', label: 'Check the answer against the ground truth', feedback: 'If the ground truth were available, the judge would not be needed.' },
    ],
    correctOptionId: 'b',
    explanation:
      'The judge sees a question and two answers and names the better one. The advantage over scoring against a reference is that no single phrasing has to be declared correct.',
    citation: MTBENCH,
    lessonId: 'what-a-judge-is',
  },
  {
    id: 'q-judging-2',
    kind: 'boolean',
    prompt: 'The judge’s preferences are the judge model’s preferences.',
    topic: 'Judging with a model',
    difficulty: 'core',
    truth: true,
    explanation:
      'Yes. A judge is a model, and whatever it has come to prefer — position, length, its own family’s style — comes through into every judgement it makes.',
    citation: MTBENCH,
    lessonId: 'what-a-judge-is',
  },
  {
    id: 'q-judging-3',
    kind: 'multiple-choice',
    prompt: 'What does the position-swap test measure?',
    topic: 'Agreement and consistency',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'How often the judge agrees with a human', feedback: 'That is the agreement rate.' },
      { id: 'b', label: 'How often the judge gives the same answer when the order is changed', feedback: 'Correct.' },
      { id: 'c', label: 'How good the judge is at explaining itself', feedback: 'Explanation quality is a separate question.' },
      { id: 'd', label: 'How expensive the judge is to run', feedback: 'Cost is a real consideration, but it is not what the swap test measures.' },
    ],
    correctOptionId: 'b',
    explanation:
      'Consistency is measured against the judge itself: the same pair, presented in both orders, should produce the same preference. A failure to do so means the judge answered a different question.',
    citation: MTBENCH,
    lessonId: 'agreement-and-consistency',
  },

  /* ------------------------------------------------------------------ biases */
  {
    id: 'q-biases-1',
    kind: 'multiple-choice',
    prompt: 'How is position bias usually fixed?',
    topic: 'The biases of a judge',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'By presenting each pair in both orders and taking the majority', feedback: 'Correct, at the cost of double the votes.' },
      { id: 'b', label: 'By making the judge stronger', feedback: 'A stronger judge is not a more consistent one.' },
      { id: 'c', label: 'By using a longer prompt', feedback: 'Prompt length does not remove a positional preference.' },
      { id: 'd', label: 'By scoring against a reference answer instead', feedback: 'That changes the protocol rather than fixing the bias.' },
    ],
    correctOptionId: 'a',
    explanation:
      'Presenting both orders and taking the majority cancels a first-position preference exactly, because the bias then favours each answer equally often. It doubles the cost, which is why it is often skipped.',
    citation: MTBENCH,
    lessonId: 'position-bias',
  },
  {
    id: 'q-biases-2',
    kind: 'numeric',
    prompt:
      'A judge prefers the first position in 62% of 1000 comparisons where the two answers are equally good. What is the excess preference, in percentage points?',
    topic: 'The biases of a judge',
    difficulty: 'hard',
    answer: 12,
    tolerance: 0,
    unit: 'percentage points',
    explanation:
      'Exactly 12 percentage points above the 50% that a fair judge would show. That excess is the position bias, and it is what the swap test is for.',
    citation: COURSE,
    lessonId: 'position-bias',
  },
  {
    id: 'q-biases-3',
    kind: 'multiple-choice',
    prompt: 'Which of these does the position-swap protocol NOT fix?',
    topic: 'The biases of a judge',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'Position bias', feedback: 'Fixed: each answer is first equally often.' },
      { id: 'b', label: 'Verbosity bias', feedback: 'Correct — swapping positions does nothing about a preference for length.' },
      { id: 'c', label: 'The order effect on the wording', feedback: 'Also cancelled by the swap.' },
      { id: 'd', label: 'A first-answer recency effect', feedback: 'Also cancelled by the swap.' },
    ],
    correctOptionId: 'b',
    explanation:
      'The swap cancels anything that depends on *position*. A preference for longer answers does not depend on position, so it survives the swap intact and has to be measured separately.',
    citation: MTBENCH,
    lessonId: 'verbosity-and-self',
  },
  {
    id: 'q-biases-4',
    kind: 'boolean',
    prompt: 'Making the judge model stronger removes its verbosity bias.',
    topic: 'The biases of a judge',
    difficulty: 'hard',
    truth: false,
    explanation:
      'No. The primary source reports that a stronger judge does not remove the bias. Scaling the judge does not scale away its preferences.',
    citation: MTBENCH,
    lessonId: 'verbosity-and-self',
  },

  /* ------------------------------------------------------------------ agreement */
  {
    id: 'q-agreement-1',
    kind: 'multiple-choice',
    prompt: 'Why does an agreement rate fall when the question set gets harder?',
    topic: 'Human agreement',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The judge becomes less accurate', feedback: 'Partly true, but not the main mechanism.' },
      { id: 'b', label: 'The answers get closer, so both the judge and the human are near a coin flip', feedback: 'Correct.' },
      { id: 'c', label: 'Harder questions are longer, which activates the verbosity bias', feedback: 'A confound, not the mechanism.' },
      { id: 'd', label: 'Human annotators get tired', feedback: 'Not the mechanism either.' },
    ],
    correctOptionId: 'b',
    explanation:
      'When the two answers are close in quality, the true preference is genuinely ambiguous, so a correct judge will often differ from a correct human. A low agreement on a hard set can mean the judge is right.',
    citation: MTBENCH,
    lessonId: 'what-agreement-means',
  },
  {
    id: 'q-agreement-2',
    kind: 'multiple-choice',
    prompt: 'What is the right number to compare a judge’s agreement rate against?',
    topic: 'Human agreement',
    difficulty: 'core',
    options: [
      { id: 'a', label: '100%', feedback: 'Human annotators do not agree with each other 100% of the time.' },
      { id: 'b', label: 'The agreement of two humans on the same question set', feedback: 'Correct.' },
      { id: 'c', label: '50%', feedback: 'That is the chance baseline, not the ceiling.' },
      { id: 'd', label: 'The judge’s score on a different benchmark', feedback: 'Not comparable.' },
    ],
    correctOptionId: 'b',
    explanation:
      'The inter-annotator agreement is the ceiling. A judge at 80% where humans agree with each other 85% is close to the best available measurement, not three-quarters of the way to perfect.',
    citation: COURSE,
    lessonId: 'what-agreement-means',
  },

  /* ------------------------------------------------------------------ arena */
  {
    id: 'q-arena-1',
    kind: 'multiple-choice',
    prompt: 'In the Bradley–Terry model, what does the strength θ_i represent?',
    topic: 'Arena rankings',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'The number of votes model i received', feedback: 'Close, but not what the model says.' },
      { id: 'b', label: 'A number such that the chance of i beating j depends on θ_i − θ_j', feedback: 'Correct.' },
      { id: 'c', label: 'The accuracy of model i on the benchmark', feedback: 'Not connected in the model.' },
      { id: 'd', label: 'The cost of one vote for model i', feedback: 'Not represented at all.' },
    ],
    correctOptionId: 'b',
    explanation:
      'Pr(i beats j) = σ(θ_i − θ_j). The strength is not a count of votes; it is the parameter of the difference, and the model says a pair of votes for i and one for j is worth more than a tie.',
    citation: ARENA,
    lessonId: 'bradley-terry',
  },
  {
    id: 'q-arena-2',
    kind: 'numeric',
    prompt:
      'In a Bradley–Terry model with strengths θ_A = 1 and θ_B = 0, what is the probability that A beats B?',
    topic: 'Arena rankings',
    difficulty: 'hard',
    answer: 0.7310586,
    tolerance: 0.0001,
    explanation:
      'σ(1 − 0) = 1/(1 + e⁻¹) ≈ 0.731. Note that it is not 0.5: a strength difference of one already gives a clear favourite.',
    citation: ARENA,
    lessonId: 'bradley-terry',
  },
  {
    id: 'q-arena-3',
    kind: 'multiple-choice',
    prompt: 'Why is an Elo rating not a confidence interval?',
    topic: 'The interval and the cost',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'Elo ratings are not computed from votes', feedback: 'They are.' },
      { id: 'b', label: 'Elo is an online update, so its result depends on the order the votes arrived in', feedback: 'Correct.' },
      { id: 'c', label: 'Elo assumes the models are equally good to start', feedback: 'It starts everyone at the same rating, which is not the same thing.' },
      { id: 'd', label: 'Elo cannot handle draws', feedback: 'It can.' },
    ],
    correctOptionId: 'b',
    explanation:
      'A bootstrap interval resamples the votes and refits, and it means the same thing whatever order they arrived in. An online rating carries the path with it.',
    citation: ARENA,
    lessonId: 'confidence-and-cost',
  },

  /* ------------------------------------------------------------------ benchmark */
  {
    id: 'q-benchmark-1',
    kind: 'numeric',
    prompt:
      'A benchmark has 200 questions and a model scores 60% on them. 10% of the questions are contaminated and on those the model scores 90% instead of 60%. What is the reported score?',
    topic: 'Contamination',
    difficulty: 'hard',
    answer: 63,
    tolerance: 0,
    unit: 'percent',
    explanation:
      'Exactly 63%. Twenty contaminated questions at 90% contribute 18 successes where 12 were expected, and 180 clean ones at 60% contribute 108: (18 + 108) / 200 = 0.63. The inflation is 3 percentage points.',
    citation: COURSE,
    lessonId: 'contamination',
  },
  {
    id: 'q-benchmark-2',
    kind: 'multiple-choice',
    prompt: 'Why can contamination move a ranking more than it moves any single score?',
    topic: 'Contamination',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'Because contamination inflates every model equally', feedback: 'Equal inflation moves a ranking not at all.' },
      { id: 'b', label: 'Because contamination is usually differential: one model has seen the benchmark and the others have not', feedback: 'Correct.' },
      { id: 'c', label: 'Because the error bars shrink under contamination', feedback: 'Unrelated.' },
      { id: 'd', label: 'Because rankings are computed from fewer votes', feedback: 'Unrelated.' },
    ],
    correctOptionId: 'b',
    explanation:
      'A common shift changes every model’s score by the same amount and leaves the order alone. A differential shift — one model contaminated, the others not — is precisely a change in the order.',
    citation: COURSE,
    lessonId: 'contamination',
  },
  {
    id: 'q-benchmark-3',
    kind: 'multi-select',
    prompt: 'Which of these are design decisions a benchmark author makes?',
    topic: 'What a benchmark is for',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'Which questions to ask', feedback: 'Correct.' },
      { id: 'b', label: 'How the answers are scored', feedback: 'Correct.' },
      { id: 'c', label: 'What the score is called', feedback: 'Cosmetic, but it is part of the framing.' },
      { id: 'd', label: 'Which models are evaluated', feedback: 'Correct — a benchmark of one model measures nothing about the others.' },
    ],
    correctOptionIds: ['a', 'b', 'd'],
    explanation:
      'The question set, the scoring procedure and the set of models under test are all choices. Each one is a claim about what matters, and each one can be argued for.',
    citation: HELM,
    lessonId: 'what-a-benchmark-is',
  },

  /* ------------------------------------------------------------------ measurement */
  {
    id: 'q-measurement-1',
    kind: 'numeric',
    prompt:
      'A model scores 50% on a benchmark of 400 questions. What is the standard error of that score?',
    topic: 'The standard error',
    difficulty: 'hard',
    answer: 0.0125,
    tolerance: 0.0001,
    explanation:
      '√(0.5 × 0.5 / 400) = √(0.000625) = 0.0125. The 95% interval is therefore roughly 50% ± 2.5 percentage points.',
    citation: COURSE,
    lessonId: 'standard-error',
  },
  {
    id: 'q-measurement-2',
    kind: 'multiple-choice',
    prompt: 'To halve the width of a confidence interval, how many times more questions are needed?',
    topic: 'The standard error',
    difficulty: 'core',
    options: [
      { id: 'a', label: 'Twice as many', feedback: 'That would be a linear improvement, but the interval falls as one over the square root of N.' },
      { id: 'b', label: 'Four times as many', feedback: 'Correct.' },
      { id: 'c', label: 'Ten times as many', feedback: 'Too many.' },
      { id: 'd', label: 'Half as many', feedback: 'The wrong direction.' },
    ],
    correctOptionId: 'b',
    explanation:
      'The width goes as 1/√N, so halving it needs N to grow by a factor of four. This is the arithmetic behind why large benchmarks are expensive.',
    citation: COURSE,
    lessonId: 'standard-error',
  },
  {
    id: 'q-measurement-3',
    kind: 'boolean',
    prompt: 'A benchmark with very low power will report real differences as ties.',
    topic: 'How many questions',
    difficulty: 'core',
    truth: true,
    explanation:
      'Yes. If the test cannot detect the difference, the difference does not appear — and a leaderboard that reports a tie there is reporting an artefact of the question count.',
    citation: COURSE,
    lessonId: 'how-many-questions',
  },
  {
    id: 'q-measurement-4',
    kind: 'multi-select',
    prompt: 'What should a leaderboard print next to every score?',
    topic: 'What to publish',
    difficulty: 'hard',
    options: [
      { id: 'a', label: 'A confidence interval', feedback: 'Correct.' },
      { id: 'b', label: 'The number of questions used', feedback: 'Correct: without it the interval cannot be checked.' },
      { id: 'c', label: 'The provider of the model', feedback: 'Correct, and increasingly a part of the story.' },
      { id: 'd', label: 'The logo of the organisation that ran it', feedback: 'Not a measurement.' },
    ],
    correctOptionIds: ['a', 'b', 'c'],
    explanation:
      'An interval, the question count, and enough about the protocol to reproduce it. The newest criticism of the field is that the last of these is often missing, and that the leaderboard has become the thing being optimised.',
    citation: TRENCHES,
    lessonId: 'the-honest-summary',
  },
]
