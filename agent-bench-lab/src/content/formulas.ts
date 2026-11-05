/**
 * The equation reference.
 */

export interface FormulaEntry {
  id: string
  title: string
  latex: string
  reference: { source: string; location: string; url: string }
  meaning: string
  symbols: { symbol: string; name: string; note: string }[]
  assumptions: string[]
  derivation: string[]
  example: { given: string; result: string; note: string }
}

const SWEBENCH_URL = 'https://arxiv.org/abs/2310.06770'
const AGENTBENCH_URL = 'https://arxiv.org/abs/2308.03688'
const WEBARENA_URL = 'https://arxiv.org/abs/2307.13854'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'wilson-interval',
    title: 'The Wilson interval for a proportion',
    latex: '\\frac{\\hat{p} + z^2/(2n) \\pm z\\sqrt{\\hat{p}(1-\\hat{p})/n + z^2/(4n^2)}}{1 + z^2/n}',
    reference: { source: 'This course', location: 'The task-design laboratory', url: SWEBENCH_URL },
    meaning:
      'The interval on a score, in a form that stays inside the unit interval and stays sensible near zero.',
    symbols: [
      { symbol: '\\hat{p}', name: 'the observed proportion', note: 'The number of solved tasks over the number of tasks.' },
      { symbol: 'n', name: 'the number of tasks', note: 'The size of the sample.' },
      { symbol: 'z', name: 'the confidence multiplier', note: 'One and a nought six for ninety-five per cent.' },
    ],
    assumptions: [
      'The tasks are a sample from a population of tasks.',
      'The observations are independent, which is the assumption a task set is most likely to break.',
    ],
    derivation: [
      'The normal approximation fails near zero and near one, which is where benchmark scores often are.',
      'The Wilson interval comes from keeping the same quadratic form and solving for the interval that contains the true proportion.',
      'It is asymmetric and it never leaves the unit interval.',
    ],
    example: {
      given: 'Twelve solved out of two hundred.',
      result: 'The estimate is six per cent, and the interval runs from about three and a half to about ten per cent.',
      note: 'The normal approximation would have put the lower bound below zero.',
    },
  },
  {
    id: 'tasks-needed',
    title: 'The number of tasks a difference needs',
    latex: 'n \\gtrsim \\frac{2 z^2 p(1-p)}{\\delta^2}',
    reference: { source: 'This course', location: 'The task-design laboratory', url: SWEBENCH_URL },
    meaning:
      'How many tasks a benchmark needs before a difference of a given size is distinguishable from the noise.',
    symbols: [
      { symbol: '\\delta', name: 'the difference to be detected', note: 'The gap between the two systems.' },
      { symbol: 'p', name: 'the rate around which the comparison happens', note: 'Usually the lower of the two scores.' },
    ],
    assumptions: [
      'The two systems are compared on the same tasks, so the task-difficulty variation cancels.',
    ],
    derivation: [
      'The standard error of a proportion falls as one over the square root of the number of tasks.',
      'So the number of tasks needed for a difference to stand out of the noise grows as one over the square of the difference.',
      'Halving the difference needs four times the tasks.',
    ],
    example: {
      given: 'A difference of two points at a rate of thirty per cent.',
      result: 'A few thousand tasks; a difference of twenty points needs a few dozen.',
      note: 'Which is why a benchmark of a hundred tasks can rank systems and cannot separate two close ones.',
    },
  },
  {
    id: 'evaluation-criterion',
    title: 'The evaluation criterion',
    latex: '\\mathrm{solved}(p) = \\mathbb{1}\\left[ F \\to P \\wedge P \\to P \\right]',
    reference: { source: 'Jimenez et al. (2023)', location: 'Section 3.1', url: SWEBENCH_URL },
    meaning:
      'A patch solves the task when the failing test starts failing and ends passing, and the tests that were passing keep passing.',
    symbols: [
      { symbol: 'F', name: 'the tests that fail before the patch', note: 'The ones the task is about.' },
      { symbol: 'P', name: 'the tests that pass before the patch', note: 'The ones the patch must not break.' },
    ],
    assumptions: [
      'The tests are correct: the failing test fails because of the bug, and the passing tests pass because the code is right.',
    ],
    derivation: [
      'Without the first condition there is no task.',
      'Without the second, a patch that changes the failing test satisfies the first one and nothing else.',
      'Together they are what makes the verdict mean that the task was solved.',
    ],
    example: {
      given: 'A patch that makes the failing test pass by editing the test.',
      result: 'The first condition holds and the second does not save you, because the test is not trustworthy.',
      note: 'Which is why a patch that touches a test file is not accepted at all.',
    },
  },
  {
    id: 'pass-at-k',
    title: 'The unbiased estimate of pass@k',
    latex: '\\mathrm{pass@}k = 1 - \\frac{\\binom{n-c}{k}}{\\binom{n}{k}}',
    reference: { source: 'This course', location: 'The variance laboratory', url: AGENTBENCH_URL },
    meaning:
      'The chance that at least one of k attempts succeeds, estimated from n samples of which c succeeded.',
    symbols: [
      { symbol: 'n', name: 'the number of samples per task', note: 'How many times the solver was run.' },
      { symbol: 'c', name: 'the number of samples that succeeded', note: 'For this task.' },
      { symbol: 'k', name: 'the number of attempts counted', note: 'The budget the caller is allowed.' },
    ],
    assumptions: [
      'The samples for a task are exchangeable, which is what makes the combinatorial correction exact.',
    ],
    derivation: [
      'If the k attempts are drawn without replacement from the n samples, the chance that none of them is a success is the chance of drawing k failures.',
      'That chance is the ratio of the two binomial coefficients.',
      'Subtracting it from one gives the estimator.',
    ],
    example: {
      given: 'One success in four samples.',
      result: 'pass@1 is a quarter and pass@2 is a half.',
      note: 'The naive estimate would say pass@1 is a quarter and pass@2 is a half too — and the difference shows up as the budget grows.',
    },
  },
  {
    id: 'variance-of-a-score',
    title: 'The variance of a score across runs',
    latex: '\\mathrm{Var}(\\hat{p}) = \\frac{1}{R}\\sum_{r=1}^{R}\\left(p_r - \\bar{p}\\right)^2',
    reference: { source: 'This course', location: 'The variance laboratory', url: AGENTBENCH_URL },
    meaning:
      'How much the score moves when the solver is run again, over R runs.',
    symbols: [
      { symbol: 'p_r', name: 'the score of the r-th run', note: 'The fraction of tasks solved.' },
      { symbol: '\\bar{p}', name: 'the mean of the runs', note: 'The estimate of the rate.' },
    ],
    assumptions: [
      'The runs are independent, which they are not when they share a task set — and the task set is the larger of the two sources of variation.',
    ],
    derivation: [
      'Averaging the squared deviations from the mean is the variance.',
      'The standard deviation is the square root, and it is the width of the interval the score should be reported with.',
    ],
    example: {
      given: 'Scores of 12%, 15% and 9% over three runs.',
      result: 'The standard deviation is about three points.',
      note: 'And a difference of two points between two systems is inside that.',
    },
  },
  {
    id: 'paired-test',
    title: 'The paired sign test',
    latex: 'p = 2 \\sum_{i=0}^{m} \\binom{n}{i} 2^{-n}',
    reference: { source: 'This course', location: 'The variance laboratory', url: AGENTBENCH_URL },
    meaning:
      'The probability that the wins and the losses of a paired comparison are a coin flip.',
    symbols: [
      { symbol: 'n', name: 'the number of tasks where the two systems disagree', note: 'The tasks they agree on carry no information.' },
      { symbol: 'm', name: 'the smaller of the two counts', note: 'The one in the tail of the binomial.' },
    ],
    assumptions: [
      'The disagreements are independent and the direction of each is a fair coin under the null.',
    ],
    derivation: [
      'Only the tasks where the systems disagree carry information.',
      'Under the null, each disagreement is a coin flip.',
      'The probability of the observed imbalance, doubled for the two tails, is the p-value.',
    ],
    example: {
      given: 'Thirty wins and two losses.',
      result: 'The p-value is small, and the comparison is significant.',
      note: 'And the paired test is more sensitive than comparing two independent scores, because the task difficulty cancels.',
    },
  },
  {
    id: 'overlap',
    title: 'The n-gram overlap of a passage',
    latex: '\\mathrm{overlap}(p, c, n) = \\frac{1}{|p| - n + 1}\\sum_{i} \\mathbb{1}\\left[ p_i \\in c^{(n)} \\right]',
    reference: { source: 'This course', location: 'The contamination laboratory', url: WEBARENA_URL },
    meaning:
      'The fraction of a passage’s n-grams that appear in the corpus — the measure of contamination.',
    symbols: [
      { symbol: 'p', name: 'the passage', note: 'The solution to the task.' },
      { symbol: 'c', name: 'the corpus', note: 'The training data.' },
      { symbol: 'c^{(n)}', name: 'the set of the corpus’s n-grams', note: 'Taken over every document.' },
    ],
    assumptions: [
      'A long shared run of n-grams means the passage is in the corpus.',
    ],
    derivation: [
      'Count the passage’s n-grams.',
      'Count how many appear in the corpus.',
      'The ratio is the overlap, and a passage with a high overlap was probably in there.',
    ],
    example: {
      given: 'A passage copied verbatim into the corpus.',
      result: 'The overlap is one.',
      note: 'And a lightly edited copy has a high overlap at a short n-gram and a low one at a long n-gram.',
    },
  },
]
