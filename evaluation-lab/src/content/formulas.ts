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

const MTBENCH_URL = 'https://arxiv.org/abs/2306.05685'
const ARENA_URL = 'https://arxiv.org/abs/2403.04132'
const HELM_URL = 'https://arxiv.org/abs/2211.09110'
const TRENCHES_URL = 'https://arxiv.org/abs/2405.14782'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'bradley-terry',
    title: 'The Bradley–Terry model',
    latex: '\\Pr(i \\succ j) = \\frac{e^{\\theta_i}}{e^{\\theta_i} + e^{\\theta_j}} = \\sigma(\\theta_i - \\theta_j)',
    reference: { source: 'Chiang et al. (2024)', location: 'The Bradley–Terry model behind the arena ranking', url: ARENA_URL },
    meaning:
      'Each model has a strength, and the chance that it beats another is a function of the difference between the two strengths. One number per model, one difference per comparison.',
    symbols: [
      { symbol: '\\theta_i', name: 'the strength', note: 'Only differences are identified, so the strengths are usually centred to sum to zero.' },
      { symbol: '\\sigma', name: 'the logistic function', note: 'σ(z) = 1/(1 + e⁻ᶻ).' },
    ],
    assumptions: [
      'Every comparison is between two items from the same population.',
      'The same latent strength explains every comparison involving that item.',
    ],
    derivation: [
      'Suppose a comparison between i and j is a noisy observation of a single underlying preference.',
      'Write the probability of i winning as proportional to e^θ_i, with the normaliser making the two probabilities sum to one.',
      'Dividing the two gives the logistic form above.',
    ],
    example: {
      given: 'θ_A = 1.0 and θ_B = 0.0.',
      result: 'Pr(A beats B) = 1/(1 + e⁻¹) ≈ 0.731.',
      note: 'A strength difference of one already makes A a clear favourite.',
    },
  },
  {
    id: 'bt-likelihood',
    title: 'The Bradley–Terry log-likelihood',
    latex: '\\log L(\\theta) = \\sum_{(i,j)} \\left[ \\mathbb{1}_{i \\succ j} \\log \\sigma(\\theta_i - \\theta_j) + \\mathbb{1}_{j \\succ i} \\log \\sigma(\\theta_j - \\theta_i) \\right]',
    reference: { source: 'Chiang et al. (2024)', location: 'The likelihood the arena ranking maximises', url: ARENA_URL },
    meaning:
      'The log-likelihood of the observed comparisons under the model. It is a sum of terms that depend on one difference each, so it can be maximised directly by gradient ascent.',
    symbols: [
      { symbol: '\\mathbb{1}_{i \\succ j}', name: 'the indicator', note: 'One if i beat j in that comparison, zero otherwise.' },
    ],
    assumptions: ['Comparisons are independent of one another, given the strengths.'],
    derivation: [
      'The likelihood of the whole comparison set is the product of the likelihoods of each comparison.',
      'Take logarithms to turn the product into a sum.',
      'Each factor is σ(θ_i − θ_j), so the gradient of the log-likelihood with respect to θ_i has a closed form.',
    ],
    example: {
      given: 'One comparison in which A beats B, with θ_A = θ_B = 0.',
      result: 'log L = log 0.5 = −0.693.',
      note: 'The worst case: the model cannot explain the comparison at all.',
    },
  },
  {
    id: 'agreement',
    title: 'The agreement rate',
    latex: '\\text{agreement} = \\frac{\\#\\{\\text{comparisons where the judge agrees with the human}\\}}{\\#\\{\\text{comparisons made}\\}}',
    reference: { source: 'Zheng et al. (2023)', location: 'The agreement measurement', url: MTBENCH_URL },
    meaning:
      'How often the judge’s choice matches the human’s. It is a proportion, so it has a denominator — and the denominator is a design decision, not a fact about the judge.',
    symbols: [
      { symbol: '\\#\\{\\cdot\\}', name: 'the count', note: 'Over the comparisons actually made, after any filtering.' },
    ],
    assumptions: ['The human preference is the reference, and the human is treated as correct.'],
    derivation: [
      'For each comparison, record whether the judge and the human chose the same answer.',
      'Count the agreements and divide by the total number of comparisons.',
      'The variance of the resulting proportion is p(1−p)/n.',
    ],
    example: {
      given: 'The judge agrees with the human on 71 of 80 comparisons.',
      result: '71/80 = 88.75%.',
      note: 'The standard error on that figure is about 3.7 percentage points, so the interval is roughly 81% to 96%.',
    },
  },
  {
    id: 'consistency',
    title: 'The consistency rate',
    latex: '\\text{consistency} = \\frac{\\#\\{\\text{pairs where the same answer was preferred in both orders}\\}}{\\#\\{\\text{pairs judged twice}\\}}',
    reference: { source: 'Zheng et al. (2023)', location: 'The position-swap experiment', url: MTBENCH_URL },
    meaning:
      'How often the judge prefers the same answer when the two answers are swapped. A perfectly consistent judge scores 100% here, whatever its opinion is.',
    symbols: [
      { symbol: '\\text{both orders}', name: 'the permutation', note: 'Each pair is judged twice, once in each order.' },
    ],
    assumptions: ['The judge is presented with the same question and the same two answers in both orders.'],
    derivation: [
      'Judge the pair with A first, then again with B first.',
      'Record which *answer* was preferred each time.',
      'Consistency is the fraction of pairs where the two judgements agree on the answer.',
    ],
    example: {
      given: 'A judge flips its answer in 8 of 100 pairs.',
      result: 'Consistency = 92%.',
      note: 'The remaining 8% is a direct measurement of its position sensitivity.',
    },
  },
  {
    id: 'position-rate',
    title: 'The first-position rate',
    latex: '\\text{first-position rate} = \\frac{\\#\\{\\text{comparisons where the first answer was preferred}\\}}{\\#\\{\\text{comparisons made}\\}}',
    reference: { source: 'Zheng et al. (2023)', location: 'The position-bias measurement', url: MTBENCH_URL },
    meaning:
      'How often the judge preferred whichever answer it saw first. Measured on pairs where the two answers are equally good, so that the position is the only thing that can decide.',
    symbols: [
      { symbol: '50\\%', name: 'the fair value', note: 'A judge with no position preference sits exactly here.' },
    ],
    assumptions: ['The pairs used are ones where the true quality is equal, so there is nothing else to prefer.'],
    derivation: [
      'Construct pairs whose true qualities are equal.',
      'Judge each pair, with the position randomised.',
      'Count how often the first answer won; the excess over one half is the bias.',
    ],
    example: {
      given: 'The first answer was preferred in 620 of 1000 comparisons.',
      result: 'The rate is 62%, so the excess preference is 12 percentage points.',
      note: 'Presenting both orders and taking the majority cancels this exactly.',
    },
  },
  {
    id: 'standard-error',
    title: 'The standard error of a benchmark score',
    latex: '\\mathrm{SE}(\\hat{p}) = \\sqrt{\\frac{\\hat{p}(1 - \\hat{p})}{N}}',
    reference: { source: 'Standard result; the quantity a leaderboard omits', location: 'The evaluation literature', url: HELM_URL },
    meaning:
      'How much a score from N questions wobbles around the true pass rate. It is the number that should appear next to every score on a leaderboard.',
    symbols: [
      { symbol: '\\hat{p}', name: 'the observed score', note: 'The proportion of questions passed.' },
      { symbol: 'N', name: 'the number of questions', note: 'The sample size.' },
    ],
    assumptions: ['The questions are independent and drawn from the same distribution.'],
    derivation: [
      'The score is a sample proportion, whose variance is p(1−p)/N.',
      'The standard error is the square root of that variance.',
      'The interval is the score plus and minus 1.96 standard errors.',
    ],
    example: {
      given: 'A score of 70% on 100 questions.',
      result: 'SE = √(0.7 × 0.3 / 100) ≈ 0.046.',
      note: 'The 95% interval is roughly 70% ± 9 percentage points.',
    },
  },
  {
    id: 'sample-size',
    title: 'The number of questions needed',
    latex: 'N \\approx \\frac{\\left(z_{\\alpha/2}\\sqrt{2p(1-p)} + z_{\\beta}\\sqrt{2p(1-p)}\\right)^2}{\\Delta^2}',
    reference: { source: 'Standard result; the calculation a benchmark designer should do first', location: 'The evaluation literature', url: HELM_URL },
    meaning:
      'How many questions are needed to detect a difference of Δ between two models, at a significance level α and a power of 1 − β.',
    symbols: [
      { symbol: '\\Delta', name: 'the difference to detect', note: 'The smaller it is, the more questions are needed.' },
      { symbol: 'z_{\\alpha/2}', name: 'the significance quantile', note: '1.96 for α = 0.05.' },
      { symbol: 'z_{\\beta}', name: 'the power quantile', note: '0.84 for 80% power.' },
    ],
    assumptions: ['The two models are scored on the same questions, so the comparison is paired.'],
    derivation: [
      'The difference of two independent proportions has standard error √(2p(1−p)/N).',
      'For the difference to exceed the significance threshold with probability 1 − β, solve for N.',
      'The result grows as the inverse square of Δ.',
    ],
    example: {
      given: 'Two models scoring 70% and 60%, at α = 0.05 and 80% power.',
      result: 'Roughly 400 questions.',
      note: 'Halving the difference to five points needs about 1,600.',
    },
  },
  {
    id: 'power',
    title: 'The power of the comparison',
    latex: '\\mathrm{power} = \\Pr\\!\\left(\\left|\\frac{\\hat{p}_1 - \\hat{p}_2}{\\sqrt{2\\hat{p}(1-\\hat{p})/N}}\\right| > z_{\\alpha/2}\\right)',
    reference: { source: 'Standard result', location: 'The evaluation literature', url: HELM_URL },
    meaning:
      'The probability that the test detects a real difference, given that there is one. A benchmark with low power reports ties where there are differences.',
    symbols: [
      { symbol: '\\hat{p}_1, \\hat{p}_2', name: 'the two scores', note: 'On the same questions.' },
    ],
    assumptions: ['The normal approximation to the sampling distribution of the difference.'],
    derivation: [
      'The statistic is the difference divided by its standard error.',
      'Under the alternative it is shifted away from zero by Δ/SE.',
      'The power is the probability that it still falls outside the rejection region.',
    ],
    example: {
      given: 'A 10-point difference on 100 questions.',
      result: 'Power is around 55%.',
      note: 'More than half of the real differences would be reported as ties.',
    },
  },
  {
    id: 'contamination-inflation',
    title: 'The inflation contamination produces',
    latex: '\\hat{p}_{\\text{reported}} = (1 - f)\\,\\hat{p} + f\\,\\hat{p}\\,\\gamma, \\qquad \\Delta\\hat{p} = f\\,\\hat{p}\\,(\\gamma - 1)',
    reference: { source: 'This course', location: 'The contamination laboratory', url: MTBENCH_URL },
    meaning:
      'When a fraction f of the questions are contaminated and the model scores a factor γ times higher on them, the reported score rises by f·p·(γ − 1).',
    symbols: [
      { symbol: 'f', name: 'the contaminated fraction', note: 'The proportion of the benchmark that was in the training data.' },
      { symbol: '\\gamma', name: 'the inflation factor', note: 'How much better the model does on a memorised question.' },
    ],
    assumptions: ['The contamination is spread evenly over the score, so it is an average rather than a shift of particular questions.'],
    derivation: [
      'Split the questions into the clean fraction 1 − f and the contaminated fraction f.',
      'Average the two scores over the whole benchmark.',
      'The excess over the true score is f·p·(γ − 1).',
    ],
    example: {
      given: 'A score of 60% on 200 questions, 10% contaminated, with γ = 1.5.',
      result: 'The reported score is 63%, an inflation of 3 percentage points.',
      note: 'And nobody knows f, which is why a contaminated score cannot be checked.',
    },
  },
  {
    id: 'elo-update',
    title: 'The Elo update',
    latex: "R'_i = R_i + K\\left(S_i - E_i\\right), \\qquad E_i = \\frac{1}{1 + 10^{(R_j - R_i)/400}}",
    reference: { source: 'Chiang et al. (2024)', location: 'The rating system used before Bradley–Terry', url: ARENA_URL },
    meaning:
      'Each comparison moves two ratings by an amount proportional to how far the result was from what the ratings predicted.',
    symbols: [
      { symbol: 'K', name: 'the learning rate', note: 'Usually 32.' },
      { symbol: 'S_i', name: 'the actual score', note: '1 for a win, 0.5 for a draw, 0 for a loss.' },
      { symbol: 'E_i', name: 'the expected score', note: 'What the ratings predicted.' },
    ],
    assumptions: ['Ratings are on the scale where a 400-point gap means ten to one.'],
    derivation: [
      'If the ratings predict a certain expected score and the actual score differs, the difference is a signal.',
      'Add a fixed fraction of that difference to the rating.',
      'Repeat for every comparison in order.',
    ],
    example: {
      given: 'Two players at 1500 and 1500, and the first one wins, with K = 32.',
      result: 'The first moves to 1516 and the second to 1484.',
      note: 'Because the update is online, the final ratings depend on the order the votes arrived in.',
    },
  },
  {
    id: 'judge-score',
    title: 'What the judge is actually computing',
    latex: 's_{\\text{judge}}(a) = q(a) + \\beta_{\\text{pos}}\\,\\pi(a) + \\beta_{\\text{len}}\\,\\ell(a) + \\beta_{\\text{self}}\\,f(a) + \\varepsilon',
    reference: { source: 'This course', location: 'The judge laboratory', url: MTBENCH_URL },
    meaning:
      'The model the laboratory measures is a judge whose score is the answer’s true usefulness plus three biases plus noise. Writing it down is what makes each bias separately measurable.',
    symbols: [
      { symbol: 'q(a)', name: 'the true usefulness', note: 'What a careful human would judge.' },
      { symbol: '\\pi(a)', name: 'the position effect', note: 'Positive for the first answer, negative for the second.' },
      { symbol: '\\ell(a)', name: 'the length effect', note: 'The answer’s length relative to its competitor’s.' },
      { symbol: 'f(a)', name: 'the family effect', note: 'One if the answer comes from the judge’s own family.' },
      { symbol: '\\varepsilon', name: 'the judge’s own noise', note: 'The part that is not bias at all.' },
    ],
    assumptions: ['The biases add, and each can be switched on independently.'],
    derivation: [
      'Start from the score the judge would give with no bias at all: the true usefulness.',
      'Add the contribution of each bias, which is a fixed shift in the direction that bias goes.',
      'Add the noise, which is what makes the judge fallible even when unbiased.',
    ],
    example: {
      given: 'A true quality of 0.6, a first position, a length advantage of 0.2, and a position bias of 0.1.',
      result: 'The score is 0.6 + 0.1 + 0.2·β_len, before noise.',
      note: 'The laboratory turns each coefficient on in turn and measures what it does.',
    },
  },
  {
    id: 'bootstrap-interval',
    title: 'A bootstrap interval on a ranking',
    latex: '\\hat{\\theta}^{\\ast} = \\arg\\max_\\theta L(\\theta;\\,\\mathcal{D}^{\\ast}), \\qquad \\mathcal{D}^{\\ast} = \\text{resample}(\\mathcal{D})',
    reference: { source: 'Chiang et al. (2024)', location: 'The bootstrap procedure behind the arena intervals', url: ARENA_URL },
    meaning:
      'Resample the votes with replacement, refit the model, and repeat. The spread of the fitted strengths is the uncertainty in the ranking.',
    symbols: [
      { symbol: '\\mathcal{D}^{\\ast}', name: 'a bootstrap sample', note: 'A resampled set of votes.' },
      { symbol: '\\hat{\\theta}^{\\ast}', name: 'the refitted strength', note: 'One per bootstrap sample.' },
    ],
    assumptions: ['The votes are exchangeable, so a resample is a plausible dataset.'],
    derivation: [
      'Resample the votes independently with replacement, keeping each pair’s total votes fixed.',
      'Refit the Bradley–Terry model on the resampled votes.',
      'Take the 2.5th and 97.5th percentiles of the resulting strengths.',
    ],
    example: {
      given: '400 bootstrap samples.',
      result: 'The interval is the 10th and 390th ordered strengths.',
      note: 'The same procedure also gives the probability that a model is first.',
    },
  },
  {
    id: 'vote-cost',
    title: 'The cost of a vote',
    latex: 'N_{\\text{votes}} = \\frac{\\left(z_{\\alpha/2} + z_{\\beta}\\right)^2}{p(1-p)\\,\\Delta^2}',
    reference: { source: 'Chiang et al. (2024)', location: 'The cost of the votes', url: ARENA_URL },
    meaning:
      'How many pairwise comparisons it takes to establish that one model is better than another, given a true win rate p.',
    symbols: [
      { symbol: 'p', name: 'the true win rate', note: 'The probability the better model wins a single comparison.' },
      { symbol: '\\Delta', name: 'the effect', note: 'On the logit scale: p = σ(Δ).' },
    ],
    assumptions: ['The comparisons are independent, which is approximately true when they are on different questions.'],
    derivation: [
      'The number of wins in n comparisons is binomial with mean np and variance np(1−p).',
      'Require the 95% lower bound on the win count to exceed half the comparisons.',
      'Solve for n.',
    ],
    example: {
      given: 'A true win rate of 0.6 and 95% confidence.',
      result: 'About 100 comparisons to establish the difference.',
      note: 'At a win rate of 0.55, it is about 400 — and a vote costs money per model queried.',
    },
  },
  {
    id: 'holistic-metrics',
    title: 'Holistic evaluation as a set of measurements',
    latex: '\\vec{s} = \\bigl(s_1, s_2, \\dots, s_k\\bigr), \\qquad \\text{reported as a point in a } k\\text{-dimensional trade-off space}',
    reference: { source: 'Liang et al. (2023)', location: 'The multi-metric framing', url: HELM_URL },
    meaning:
      'Instead of one score, a vector of scores across scenarios and metrics, so that the trade-offs between them are visible rather than averaged away.',
    symbols: [
      { symbol: 's_i', name: 'the i-th measurement', note: 'One scenario, one metric.' },
      { symbol: 'k', name: 'the number of measurements', note: 'Each with its own uncertainty.' },
    ],
    assumptions: ['Scenarios can be weighted, but the weighting is a value judgement and should be stated.'],
    derivation: [
      'Measure each scenario separately, so that the costs of one do not hide inside another.',
      'Report the vector, not a scalar summary of it.',
      'Let the reader decide which trade-off they care about.',
    ],
    example: {
      given: 'Two models that trade accuracy against latency.',
      result: 'The single-score leaderboard picks one; the vector shows both.',
      note: 'Averaging the two is a choice, and it is a choice someone made for you.',
    },
  },
  {
    id: 'reproducibility-drift',
    title: 'How far a score moves for trivial reasons',
    latex: '\\Delta s = s(\\text{seed}, \\text{decoder}, \\text{template}, \\text{prompt}) - s(\\text{reference configuration})',
    reference: { source: 'Reuel et al. (2024)', location: 'The reproducibility lessons', url: TRENCHES_URL },
    meaning:
      'The difference a score moves when the decoding seed, the decoder, the chat template or the judge prompt changes — all of which are choices, and none of which are the model.',
    symbols: [
      { symbol: '\\Delta s', name: 'the drift', note: 'How much of a reported difference is an artefact of the harness.' },
    ],
    assumptions: ['The model and the question set are held fixed.'],
    derivation: [
      'Hold the model fixed and vary one harness choice at a time.',
      'Measure the score each time.',
      'The spread across those runs is the harness noise floor.',
    ],
    example: {
      given: 'A reported gap of one point between two models, and a harness drift of 1.5 points.',
      result: 'The gap is inside the noise.',
      note: 'This is the boring failure that invalidates more leaderboards than the exotic ones.',
    },
  },
]
