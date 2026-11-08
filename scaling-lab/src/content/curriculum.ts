/**
 * The course curriculum.
 *
 * The primary source is
 *
 *   J. Kaplan, S. McCandlish, T. Henrichsen et al.,
 *   "Scaling Laws for Neural Language Models",
 *   arXiv:2001.08361 [cs.CL].
 *
 * Three further papers carry the rest of the course:
 *
 *   J. Hoffmann, S. Borgeaud, N. Boulle et al.,
 *   "Training Compute-Optimal Large Language Models", arXiv:2203.15556 [cs.CL];
 *
 *   F. Muennighoff, A. M. Rush, B. Barak et al.,
 *   "Scaling Data-Constrained Language Models", arXiv:2305.16264 [cs.CL];
 *
 *   R. Schaeffer, B. Miranda, S. Koyejo et al.,
 *   "Are Emergent Abilities of Large Language Models a Mirage?", arXiv:2304.15004 [cs.CL].
 *
 * And two more carry the two modules that are not about a loss curve at all:
 *
 *   B. Sorscher, R. Geirhos, S. Shekhar, S. Ganguli, A. S. Morcos,
 *   "Beyond Neural Scaling Laws: Beating Power Law Scaling via Data Pruning",
 *   arXiv:2206.14486 [cs.LG];
 *
 *   J. Sevilla, L. Heim, A. Ho, T. Besiroglu, M. Hobbhahn, P. Villalobos,
 *   "Compute Trends Across Three Eras of Machine Learning", arXiv:2202.05924 [cs.LG].
 *
 * The section map below is built from those six works, and the test suite
 * refuses a lesson that cites a section which is not in it. The section
 * numbers of the last two were read off the published texts rather than
 * remembered: Sorscher et al. run 1 Introduction, 2 Background and related
 * work, 3 An analytic theory of data pruning, 4 Data pruning can beat power
 * law scaling in practice, 5 Benchmarking supervised pruning metrics on
 * ImageNet, 6 Self-supervised data pruning through a prototypicality metric,
 * 7 Discussion; Sevilla et al. run 1 Introduction, 2 Related work, 3 Trends,
 * 4 Conclusion.
 */

import type { LessonMeta, ModuleMeta, SourceRef } from '@llm-materials/course-core'

export type { LessonMeta, ModuleMeta, SourceRef }

export const SOURCES = {
  kaplan: {
    id: 'kaplan-2020',
    title: 'Scaling Laws for Neural Language Models',
    authors: 'Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B. Brown, Benjamin Chess, Rewon Child and others',
    year: 2020,
    venue: 'arXiv:2001.08361 [cs.CL]',
    url: 'https://arxiv.org/abs/2001.08361',
  },
  chinchilla: {
    id: 'hoffmann-2022',
    title: 'Training Compute-Optimal Large Language Models',
    authors: 'Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch, Elena Buchatskaya, Trevor Cai, Eliza Rutherford and others',
    year: 2022,
    venue: 'arXiv:2203.15556 [cs.CL] / NeurIPS 2022',
    url: 'https://arxiv.org/abs/2203.15556',
  },
  constrained: {
    id: 'muennighoff-2023-constrained',
    title: 'Scaling Data-Constrained Language Models',
    authors: 'Niklas Muennighoff, Alexander M. Rush, Boaz Barak, Teven Le Scao, Aleksandra Piktus, Nouamane Tazi and others',
    year: 2023,
    venue: 'arXiv:2305.16264 [cs.CL] / NeurIPS 2023',
    url: 'https://arxiv.org/abs/2305.16264',
  },
  mirage: {
    id: 'schaeffer-2023-mirage',
    title: 'Are Emergent Abilities of Large Language Models a Mirage?',
    authors: 'Rylan Schaeffer, Brando Miranda, Sanmi Koyejo',
    year: 2023,
    venue: 'arXiv:2304.15004 [cs.CL] / NeurIPS 2023',
    url: 'https://arxiv.org/abs/2304.15004',
  },
  sorscher: {
    id: 'sorscher-2022-beyond',
    title: 'Beyond neural scaling laws: beating power law scaling via data pruning',
    authors: 'Ben Sorscher, Robert Geirhos, Shashank Shekhar, Surya Ganguli, Ari S. Morcos',
    year: 2022,
    venue: 'arXiv:2206.14486 [cs.LG] / NeurIPS 2022',
    url: 'https://arxiv.org/abs/2206.14486',
  },
  /**
   * The record is keyed `paullada-2022-eras` in `references/manifest.json`, which
   * is the working name this collection filed it under. The paper itself is
   * Sevilla, Heim, Ho, Besiroglu, Hobbhahn & Villalobos, and the title, authors
   * and venue below are the published ones; only the catalogue key is inherited.
   */
  sevilla: {
    id: 'paullada-2022-eras',
    title: 'Compute Trends Across Three Eras of Machine Learning',
    authors: 'Jaime Sevilla, Lennart Heim, Anson Ho, Tamay Besiroglu, Marius Hobbhahn, Pablo Villalobos',
    year: 2022,
    venue: 'arXiv:2202.05924 [cs.LG] / ICLR 2022 Workshop on ML for Systems',
    url: 'https://arxiv.org/abs/2202.05924',
  },
} as const

/** The section map of the sources this course cites. */
export const SECTION_MAP: Record<string, { title: string; note: string }> = {
  'kaplan:1': { title: 'Introduction', note: 'The observation that started the field: the loss falls as a power law, and the loss of the best model at a given compute is itself a power law.' },
  'kaplan:1.1': { title: 'Summary of the scaling results', note: 'The three results, and the parameter-count and dataset-size exponents.' },
  'kaplan:2': { title: 'Main results', note: 'The measurement procedure: how the loss surface was measured and how the power laws were fitted.' },
  'kaplan:2.1': { title: 'Fitting scaling laws', note: 'The loss surface, the method of fitting, and the precautions against fitting noise.' },
  'kaplan:3': { title: 'Discussion', note: 'The caveats: the range of the fit, the possibility of a break, and what the laws do not say.' },
  'chinchilla:1': { title: 'Introduction', note: 'The claim: the compute-optimal model is not the biggest one, and the data has to grow with it.' },
  'chinchilla:3': { title: 'Compute-optimal training', note: 'The loss surface in two variables, and the optimisation of the allocation under a fixed budget.' },
  'chinchilla:3.1': { title: 'The optimal allocation', note: 'The condition that balances the two terms of the loss, and the closed form it gives.' },
  'chinchilla:4': { title: 'Results', note: 'The comparison of the compute-optimal models with the state of the art, and the tokens-per-parameter ratio.' },
  'constrained:1': { title: 'Introduction', note: 'The setting: what to do when the unique data runs out before the compute does.' },
  'constrained:3': { title: 'Repeating data', note: 'The number of repeats, the loss as a function of it, and the point at which repeats stop paying.' },
  'constrained:4': { title: 'Model size and data constraints', note: 'How the optimal model size changes when the data is constrained, and the repetition of the whole analysis.' },
  'constrained:5': { title: 'Discussion', note: 'The practical rules: how many repeats, and what to do when there is no more data.' },
  'mirage:1': { title: 'Introduction', note: 'The claim under examination: that some abilities appear suddenly, and that the appearance is a property of the metric.' },
  'mirage:3': { title: 'The metric', note: 'How a discontinuous metric on a continuous capability creates an apparent cliff, and the nonlinearity argument.' },
  'mirage:4': { title: 'Results', note: 'The experiments: emergent-looking abilities that are not emergent, and the metrics that reveal it.' },
  'sorscher:1': { title: 'Introduction', note: 'The claim that breaks the law: a pruned corpus can scale better than a larger one, because what matters is the information in the data and not its volume.' },
  'sorscher:2': { title: 'Background and related work', note: 'Where the volume laws come from, and why a similarity metric can beat them.' },
  'sorscher:3': { title: 'An analytic theory of data pruning', note: 'The percolation argument: clusters, rarity, and the keep fraction below which the tail of the distribution starts going and the curve breaks.' },
  'sorscher:4': { title: 'Data pruning can beat power law scaling in practice', note: 'The measured curves — the steep descent, the knee, the cliff — and the exponent the curated data reaches.' },
  'sorscher:5': { title: 'Benchmarking supervised pruning metrics on ImageNet', note: 'The ranking of the metrics at matched volume, and the finding that a metric’s own cost is part of the comparison.' },
  'sorscher:7': { title: 'Discussion', note: 'What the result says about data quality, and the limits of the theory: it is about a clustered corpus and a similarity metric.' },
  'sevilla:1': { title: 'Introduction', note: 'The measurement: training compute has grown log-linearly, and the growth has a break in it.' },
  'sevilla:3': { title: 'Trends', note: 'The three eras and the statistics reported for each — the slope in orders of magnitude a year, the doubling time, and the range of the runs.' },
  'sevilla:4': { title: 'Conclusion', note: 'What the trend is and is not: a fit to landmark runs, with the eras placed by the analyst rather than given by the data.' },
}

export const MODULES: ModuleMeta[] = [
  {
    id: 'power-laws',
    chapter: 1,
    title: 'Power Laws',
    tagline: 'The shape of the loss, and how its exponent is measured',
    summary:
      'A scaling law is a statement that the loss falls as a power of something. This module is about the shape, about how the exponent is measured, and about the things a fitted exponent does not tell you.',
    accent: 'indigo',
    outcomes: [
      'State what a power law says, and what its exponent means in practice',
      'Fit a power law by least squares in log–log space and read the R²',
      'Explain why the exponent of a fit depends on the range it was fitted over',
    ],
  },
  {
    id: 'compute',
    chapter: 2,
    title: 'Compute Optimality',
    tagline: 'A budget, and where it should be spent',
    summary:
      'The compute budget is the constraint, and under it the loss is minimised somewhere between "all parameters" and "all data". This module finds that somewhere, shows what it costs to miss it, and answers the older question of which model size a budget should buy.',
    accent: 'teal',
    outcomes: [
      'Write the loss surface in the model size and the dataset size',
      'Find the allocation that minimises the loss at a fixed compute budget',
      'Say what the tokens-per-parameter ratio at the optimum means, and what it does not',
      'Name the crossover at which a larger model starts to pay for itself',
    ],
  },
  {
    id: 'frontier',
    chapter: 3,
    title: 'The Frontier',
    tagline: 'Every allocation at every budget, and the law the best ones obey',
    summary:
      'Slide the allocation at a fixed budget and the loss traces a U. Do it at ten budgets and the bottoms of the U’s form a power law of their own. That law is the one a training budget is actually on, and the ratio at its minima is where the twenty-tokens rule comes from — and where it stops being a rule.',
    accent: 'violet',
    outcomes: [
      'Draw an IsoFLOP curve and read its minimum off the arms around it',
      'Derive the exponent of the frontier from the two single-variable exponents',
      'Say when tokens per parameter is a constant and when it is a trend',
      'Name the budget at which a finite corpus starts to bind',
    ],
  },
  {
    id: 'data-constraints',
    chapter: 4,
    title: 'Data Constraints',
    tagline: 'What to do when the data runs out',
    summary:
      'The regime where the unique data is exhausted and the training run has to go round again. The algebra of repetition is simple, and the bill it produces is not: three phases in the measured curve, and a closed form that says how many epochs were ever worth having.',
    accent: 'amber',
    outcomes: [
      'Define the number of repeats and the effective number of unique tokens',
      'Prove that repetition does not change the model a well-specified learner finds',
      'Measure the price of repetition against the same number of fresh rows',
      'Tell warmup, plateau and decay apart in a measured epoch curve',
      'State how many epochs the paper’s own constant says are nearly free',
    ],
  },
  {
    id: 'pruning',
    chapter: 5,
    title: 'Pruning and Percolation',
    tagline: 'What a corpus is worth when it is half as big',
    summary:
      'Volume is not the only variable a corpus has. Rank the rows by what they are worth and the loss falls faster than any law of volume alone; keep ranking and there comes a fraction below which the rows going are the ones nothing else can replace. Where that fraction is depends on the metric.',
    accent: 'sky',
    outcomes: [
      'State the percolation argument for a threshold keep fraction',
      'Rank four pruning metrics on one pool, and price what each ranking costs',
      'Predict a threshold from the structure of the pool and compare it with the measured one',
      'Say what the metric’s own error does to a cliff',
    ],
  },
  {
    id: 'emergence',
    chapter: 6,
    title: 'Emergence',
    tagline: 'The cliff, and the metric that makes it',
    summary:
      'Some abilities appear to arrive suddenly. The mechanism is a metric with a threshold in it, applied to a capability that rises smoothly. Both halves of that sentence are computable.',
    accent: 'rose',
    outcomes: [
      'Describe what an emergent curve looks like, and what an alternative metric shows',
      'Explain the mechanism by which a threshold in the metric creates a cliff',
      'Show that the point of the cliff moves when the metric’s threshold moves',
    ],
  },
  {
    id: 'hardware',
    chapter: 7,
    title: 'Compute Through Time',
    tagline: 'The trend under the budgets',
    summary:
      'A budget is a number until somebody buys the machine to spend it. The record of what has been spent grows log-linearly, with breaks in it that the analyst places rather than finds, and a scaling law turned into a rate is the only way to say what a loss cost in a given year.',
    accent: 'emerald',
    outcomes: [
      'Convert a slope in orders of magnitude a year into a doubling time and back',
      'Tell a break in a trend from a straight line that has been split anyway',
      'Say what a target loss costs, and the year it became buyable',
      'Name the assumption every date on that chain rests on',
    ],
  },
]

export const LESSONS: LessonMeta[] = [
  {
    id: 'what-a-power-law-says',
    moduleId: 'power-laws',
    number: 1,
    title: 'What a power law says',
    subtitle: 'And why the exponent is the number everyone quotes',
    minutes: 24,
    objectives: [
      'State the form of a scaling law and the three quantities in it',
      'Convert an exponent into the factor a doubling of the data buys',
      'Distinguish a power law in the loss from a power law in the error',
    ],
    keyIdeas: [
      'A power law says that the loss falls as L ∝ N^(−α) — a constant factor for every doubling.',
      'The exponent is the whole of the practical content: a doubling buys a factor 2^(−α).',
      'The error, not the loss, is the quantity that scales cleanly near the floor.',
    ],
    interactive: {
      lab: 'powerlaw',
      view: 'fit',
      title: 'Fit the law',
      description: 'Training runs here, a power law fitted to them here, and the factor a doubling buys.',
    },
    formulaIds: ['scaling-law', 'doubling-factor'],
    prerequisites: [],
    glossaryTerms: ['scaling-law', 'exponent', 'compute-budget'],
    quizIds: ['q-power-1', 'q-power-2', 'q-power-4'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'kaplan:1',
        title: 'Introduction',
        note: 'The observation that the loss falls as a power law, and that the loss of the best model at a given compute is itself a power law.',
      },
      {
        chapter: 1,
        section: 'kaplan:1.1',
        title: 'Summary of the scaling results',
        note: 'The three results, and the parameter-count and dataset-size exponents.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'how-the-exponent-is-measured',
    moduleId: 'power-laws',
    number: 2,
    title: 'How the exponent is measured',
    subtitle: 'Log–log space, and the range the fit depends on',
    minutes: 22,
    objectives: [
      'Fit a power law by least squares in log–log space',
      'Read the R² of the fit and say what it does and does not certify',
      'Show that the fitted exponent changes with the range of the data',
    ],
    keyIdeas: [
      'The fit is a straight line in log–log space, and ordinary least squares is the right tool for it.',
      'A high R² says the points are close to a line; it does not say the line will keep holding.',
      'A fitted exponent is an average over a range, and quoting it without the range is quoting half a result.',
    ],
    interactive: {
      lab: 'powerlaw',
      view: 'range',
      title: 'Change the range',
      description: 'The same runs, fitted over different ranges, and the exponent that comes out.',
    },
    formulaIds: ['log-log-fit', 'scaling-law'],
    prerequisites: ['what-a-power-law-says'],
    glossaryTerms: ['exponent', 'r-squared'],
    quizIds: ['q-power-3'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'kaplan:2.1',
        title: 'Fitting scaling laws',
        note: 'The loss surface, the method of fitting, and the precautions against fitting noise.',
      },
      {
        chapter: 3,
        section: 'kaplan:3',
        title: 'Discussion',
        note: 'The caveats: the range of the fit, the possibility of a break, and what the laws do not say.',
      },
    ],
    furtherReading: [
      {
        label: 'Beyond neural scaling laws: beating power law scaling via data pruning',
        href: 'https://arxiv.org/abs/2206.14486',
        note: 'A data-pruning method that beats the power law, and a check on what a law is.',
      },
    ],
  },
  {
    id: 'the-compute-budget',
    moduleId: 'compute',
    number: 3,
    title: 'The compute budget',
    subtitle: 'The constraint that makes the question a question',
    minutes: 20,
    objectives: [
      'Write the cost of a training run as a function of the parameters and the tokens',
      'Explain why a budget turns "how big" into "big in what way"',
      'Measure the loss along a fixed budget',
    ],
    keyIdeas: [
      'The cost of a run is the number of parameters times the number of tokens, times a constant.',
      'Under a fixed budget, more parameters means fewer tokens, and the loss of each is measured against the other.',
      'A budget is a statement about what cannot be had, and it is the only reason the allocation is a decision.',
    ],
    interactive: {
      lab: 'compute',
      view: 'curve',
      title: 'Walk the budget',
      description: 'The loss along a fixed compute budget, as the allocation slides from all data to all parameters.',
    },
    formulaIds: ['compute-cost', 'loss-surface'],
    prerequisites: ['what-a-power-law-says'],
    glossaryTerms: ['compute-budget', 'allocation'],
    quizIds: ['q-compute-1'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'chinchilla:1',
        title: 'Introduction',
        note: 'The claim: the compute-optimal model is not the biggest one, and the data has to grow with it.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-compute-optimal-allocation',
    moduleId: 'compute',
    number: 4,
    title: 'The compute-optimal allocation',
    subtitle: 'Where the two terms of the loss balance',
    minutes: 28,
    objectives: [
      'Write the two-variable loss surface and fit it',
      'Derive the condition that balances the two terms at the optimum',
      'Compute the allocation and the tokens-per-parameter ratio at a given budget',
    ],
    keyIdeas: [
      'The surface is E + A·N^(−α) + B·D^(−β): an irreducible term and two powers.',
      'At the optimum the two terms balance in a fixed ratio, and that fixes the allocation.',
      'The tokens-per-parameter ratio at the optimum is a consequence, not a setting.',
    ],
    interactive: {
      lab: 'compute',
      view: 'optimum',
      title: 'Find the optimum',
      description: 'The fitted surface, the budget, and the allocation that minimises the loss.',
    },
    formulaIds: ['optimal-allocation', 'isoflop-curve'],
    prerequisites: ['the-compute-budget'],
    glossaryTerms: ['allocation', 'loss-surface', 'tokens-per-parameter'],
    quizIds: ['q-compute-2', 'q-compute-3', 'q-optimal-ratio-1'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'chinchilla:3',
        title: 'Compute-optimal training',
        note: 'The loss surface in two variables, and the optimisation of the allocation under a fixed budget.',
      },
      {
        chapter: 3,
        section: 'chinchilla:3.1',
        title: 'The optimal allocation',
        note: 'The condition that balances the two terms of the loss, and the closed form it gives.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-crossover-between-size-and-data',
    moduleId: 'compute',
    number: 5,
    title: 'The crossover between size and data',
    subtitle: 'Kaplan’s question: at what budget does the bigger model start to pay?',
    minutes: 21,
    objectives: [
      'State what a crossover point is, and which two losses are being set equal',
      'Derive the product at which two given capacities are equally good',
      'Explain why the crossover moves when the pair of capacities gets wider',
    ],
    keyIdeas: [
      'At a fixed budget the two candidates get D = P/N rows each, so the comparison is one equation in one unknown.',
      'Below the crossover the small model trained on more data wins; above it the large model trained on less wins.',
      'The crossover is a property of the fitted surface, and it is only as good as the grid of runs the surface was fitted on.',
    ],
    interactive: {
      lab: 'compute',
      view: 'crossover',
      title: 'Find the crossover',
      description: 'Two capacities, one axis of budgets, and the point where the better choice changes sides.',
    },
    formulaIds: ['crossover-budget', 'loss-surface'],
    prerequisites: ['the-compute-optimal-allocation'],
    glossaryTerms: ['crossover', 'allocation', 'loss-surface'],
    quizIds: ['q-crossover-1', 'q-crossover-2'],
    sourceRefs: [
      {
        chapter: 2,
        section: 'kaplan:2',
        title: 'Main results',
        note: 'The measurement procedure behind the crossover idea: the loss surface measured on a grid of runs, and the comparison of model size against data at a fixed compute.',
      },
      {
        chapter: 3,
        section: 'chinchilla:3',
        title: 'Compute-optimal training',
        note: 'The same comparison read the other way: the optimum is where the two terms balance, and the crossover is the pair of allocations around it.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-isoflop-frontier',
    moduleId: 'frontier',
    number: 6,
    title: 'The IsoFLOP curves and the frontier',
    subtitle: 'A U at each budget, and the power law its bottoms obey',
    minutes: 26,
    objectives: [
      'Write the loss along a fixed budget and find its minimum in closed form',
      'State the exponent of the frontier and derive it from the two single-variable exponents',
      'Compare the analytic optimum with the one found by numeric search',
    ],
    keyIdeas: [
      'Every point of an IsoFLOP curve costs the same, so the curve is a statement about choice rather than about spend.',
      'The bottom is where the two marginal losses balance, and that balance gives N* and D* without a search.',
      'The bottoms across budgets fall as C^(−αβ/(α+β)) — the frontier is a consequence of the surface, not a new measurement.',
    ],
    interactive: {
      lab: 'isoflop',
      view: 'curve',
      title: 'Read the U’s',
      description: 'Three budgets, each with its own curve normalised by its own optimum, and the frontier through their minima.',
    },
    formulaIds: ['isoflop-curve', 'frontier-law'],
    prerequisites: ['the-compute-optimal-allocation'],
    glossaryTerms: ['isoflop-curve', 'frontier', 'loss-surface'],
    quizIds: ['q-isoflop-1', 'q-isoflop-2', 'q-isoflop-3'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'chinchilla:3',
        title: 'Compute-optimal training',
        note: 'The family of models trained along each fixed budget — the measurement the IsoFLOP curve is named after.',
      },
      {
        chapter: 3,
        section: 'chinchilla:3.1',
        title: 'The optimal allocation',
        note: 'The condition that balances the two terms at the minimum, and the frontier the minima trace.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-rule-at-the-frontier',
    moduleId: 'frontier',
    number: 7,
    title: 'The twenty-tokens rule, rederived',
    subtitle: 'What the ratio at the optimum is, and what it is not',
    minutes: 23,
    objectives: [
      'Derive the tokens-per-parameter ratio the optimum chooses for itself',
      'Measure the exponent of that ratio against the budget on a fitted surface',
      'Say which property of the surface makes the rule a constant, and which makes it a trend',
    ],
    keyIdeas: [
      'The ratio is a consequence: D*/N* has an exponent (α−β)/(α+β) and is flat only when the two exponents agree.',
      'The predicted allocation exponents and the measured ones are two instruments on one fact, and the screen prints both.',
      'A rule quoted without the budget it was measured at is a number that will not travel.',
    ],
    interactive: {
      lab: 'isoflop',
      view: 'rule',
      title: 'Measure the rule',
      description: 'The ratio at each budget, the exponent fitted through it, and the exponent the algebra predicts.',
    },
    formulaIds: ['tokens-rule', 'frontier-law'],
    prerequisites: ['the-isoflop-frontier'],
    glossaryTerms: ['tokens-per-parameter', 'frontier', 'exponent'],
    quizIds: ['q-rule-1', 'q-rule-2'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'chinchilla:4',
        title: 'Results',
        note: 'The reported tokens-per-parameter ratio at the compute optimum, and the comparison of the optimal models with the state of the art.',
      },
      {
        chapter: 3,
        section: 'chinchilla:3.1',
        title: 'The optimal allocation',
        note: 'Where the ratio comes from: the balance of the two terms, read as a number of tokens per parameter.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'when-the-pool-binds',
    moduleId: 'frontier',
    number: 8,
    title: 'When the pool binds',
    subtitle: 'The budget at which the data runs out, and what happens past it',
    minutes: 24,
    objectives: [
      'Compute the budget at which the optimal allocation asks for the whole corpus',
      'Explain why the frontier and the achievable loss come apart past that budget',
      'Read the price of the constraint off the optimum at a binding budget',
    ],
    keyIdeas: [
      'The frontier says how much data the optimum wants; a corpus is a finite number of rows, and that is where the two stories diverge.',
      'Beyond the binding budget, extra compute buys repeats rather than data, and the loss falls more slowly than the law says.',
      'The size of the pool is a variable, and the same budget is unconstrained in one corpus and bound in another.',
    ],
    interactive: {
      lab: 'isoflop',
      view: 'runout',
      title: 'Run the pool out',
      description: 'The budget where the demand for data meets the pool, and the price at each budget past it.',
    },
    formulaIds: ['isoflop-curve', 'repetition-law'],
    prerequisites: ['the-isoflop-frontier'],
    glossaryTerms: ['unique-pool', 'effective-data', 'isoflop-curve'],
    quizIds: ['q-pool-1', 'q-pool-2'],
    sourceRefs: [
      {
        chapter: 4,
        section: 'constrained:4',
        title: 'Model size and data constraints',
        note: 'How the optimal allocation changes when the unique data is exhausted before the compute is.',
      },
      {
        chapter: 3,
        section: 'chinchilla:3',
        title: 'Compute-optimal training',
        note: 'The unconstrained optimum the constrained one is measured against.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'three-phases-of-a-repeated-run',
    moduleId: 'data-constraints',
    number: 9,
    title: 'The three phases of a repeated run',
    subtitle: 'Warmup, plateau, and the turn upward',
    minutes: 25,
    objectives: [
      'Name the three phases and say what each one is a fact about',
      'Explain why the gap between the repeated and the fresh run is exactly zero at the first epoch',
      'Read the decay phase off a held-out curve rather than off a training curve',
    ],
    keyIdeas: [
      'At one epoch the two runs have read the same rows, so they are the same run — the warmup is arithmetic, not behaviour.',
      'The plateau is the pool’s empirical optimum in sight and the fresh data still buying real improvements.',
      'The decay is the repeated run walking towards a fit to the noise in its own pool, and it shows on held-out data first.',
    ],
    interactive: {
      lab: 'epochs',
      view: 'phases',
      title: 'Watch the phases',
      description: 'Two SGD runs over the same tokens, one on repeats and one on fresh rows, epoch by epoch.',
    },
    formulaIds: ['repetition-law', 'effective-data'],
    prerequisites: ['the-compute-budget'],
    glossaryTerms: ['epoch', 'unique-pool', 'repeats', 'effective-data'],
    quizIds: ['q-epoch-1', 'q-epoch-3', 'q-repetition-4'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'constrained:1',
        title: 'Introduction',
        note: 'The setting: what to do when the unique data runs out before the compute does, and the three-part shape of the answer.',
      },
      {
        chapter: 3,
        section: 'constrained:3',
        title: 'Repeating data',
        note: 'The measured curves whose phases this lesson is about.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'how-many-epochs',
    moduleId: 'data-constraints',
    number: 10,
    title: 'How many epochs before repetition dominates',
    subtitle: 'The dominance epoch, and the fraction that defines it',
    minutes: 22,
    objectives: [
      'Define the dominance epoch and say what it is measured against',
      'Show that the epoch you report depends on the fraction you chose',
      'Compare the measured dominance epoch with the one the paper’s constant predicts',
    ],
    keyIdeas: [
      'Repetition dominates when the next epoch is worth so little that the compute would have been better spent on new rows.',
      'The criterion is a fraction of the fresh run’s gain, and the table of fractions is the honest version of a single number.',
      'The closed form says half a fresh epoch at R★·ln 2 passes; the measured curve is allowed to disagree, and the screen prints the disagreement.',
    ],
    interactive: {
      lab: 'epochs',
      view: 'gains',
      title: 'Price the epochs',
      description: 'What one more epoch buys against what one more fresh epoch buys, and the dominance epoch at five different fractions.',
    },
    formulaIds: ['repetition-law'],
    prerequisites: ['three-phases-of-a-repeated-run'],
    glossaryTerms: ['dominance-epoch', 'epoch', 'effective-data'],
    quizIds: ['q-epoch-2'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'constrained:3',
        title: 'Repeating data',
        note: 'The number of repeats, the loss as a function of it, and the point at which repeats stop paying.',
      },
      {
        chapter: 5,
        section: 'constrained:5',
        title: 'Discussion',
        note: 'The practical rule: up to about four epochs is nearly free, and beyond that the value decays away.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-turn-upward',
    moduleId: 'data-constraints',
    number: 11,
    title: 'The turn upward, and the early-stopping epoch',
    subtitle: 'The pool gets easier while the model gets worse',
    minutes: 23,
    objectives: [
      'Explain why the loss on the pool keeps falling after the held-out loss has turned upward',
      'Read the best epoch off a held-out curve, and say what the run loses by passing it',
      'State why a single restart is not a curve',
    ],
    keyIdeas: [
      'The pool has its own optimum, which is a fit to the noise planted in the pool; past the shared optimum the two come apart.',
      'The third phase is not a change in the optimiser. It is the same descent aimed at a target that is not the task.',
      'The compute already spent is not a reason to keep going, and the loss that is visibly falling is not the loss being bought.',
    ],
    interactive: {
      lab: 'epochs',
      view: 'price',
      title: 'Watch the two curves part',
      description: 'The loss on the pool against the held-out loss, the turn, and the epoch the run should have stopped at.',
    },
    formulaIds: ['repetition-law', 'effective-data'],
    prerequisites: ['three-phases-of-a-repeated-run', 'how-many-epochs'],
    glossaryTerms: ['epoch', 'dominance-epoch', 'unique-pool'],
    quizIds: ['q-memorise-1'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'constrained:3',
        title: 'Repeating data',
        note: 'The measured epoch curves, and the point past which the held-out loss rises while the training loss falls.',
      },
      {
        chapter: 5,
        section: 'constrained:5',
        title: 'Discussion',
        note: 'The practical consequence: repetition is bounded, and the bound is found by early stopping rather than by arithmetic.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'when-the-data-runs-out',
    moduleId: 'data-constraints',
    number: 12,
    title: 'When the data runs out',
    subtitle: 'Repeats, and what they are worth',
    minutes: 24,
    objectives: [
      'Define the number of repeats and the effective number of unique tokens',
      'Write the loss of a learner trained on repeated data',
      'Show that repetition does not change the model a ridge estimator finds',
    ],
    keyIdeas: [
      'E repeats of U unique rows is E·U rows of training and U rows of information.',
      'The ridge normal equations are homogeneous in the data, so the solution is unchanged by repetition.',
      'What repetition buys is the illusion of progress: the same model, at a higher price.',
    ],
    interactive: {
      lab: 'repeats',
      view: 'price',
      title: 'Pay for the repeats',
      description: 'The repeated run against a fresh run of the same length, and the bill.',
    },
    formulaIds: ['repetition-invariance', 'effective-data'],
    prerequisites: ['the-compute-budget'],
    glossaryTerms: ['repeats', 'effective-data'],
    quizIds: ['q-data-1', 'q-data-2'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'constrained:1',
        title: 'Introduction',
        note: 'The setting: what to do when the unique data runs out before the compute does.',
      },
      {
        chapter: 3,
        section: 'constrained:3',
        title: 'Repeating data',
        note: 'The number of repeats, the loss as a function of it, and the point at which repeats stop paying.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-price-of-repetition',
    moduleId: 'data-constraints',
    number: 13,
    title: 'The price of repetition',
    subtitle: 'Fresh rows against the same rows again',
    minutes: 22,
    objectives: [
      'Compare a repeated run with a fresh run of the same length on the same held-out set',
      'Measure how the gap grows with the number of repeats',
      'State the practical rule the measurement supports',
    ],
    keyIdeas: [
      'Fresh rows keep improving the estimate; repeated rows stop improving it immediately.',
      'The gap between the two is the price of repetition, and it is paid in compute.',
      'The rule that falls out is about *unique* tokens, not about tokens.',
    ],
    interactive: {
      lab: 'repeats',
      view: 'curve',
      title: 'Watch the gap open',
      description: 'The two curves, and the gap between them, as the number of repeats grows.',
    },
    formulaIds: ['effective-data', 'repetition-law'],
    prerequisites: ['when-the-data-runs-out'],
    glossaryTerms: ['effective-data', 'repeats'],
    quizIds: ['q-data-3'],
    sourceRefs: [
      {
        chapter: 5,
        section: 'constrained:5',
        title: 'Discussion',
        note: 'The practical rules: how many repeats, and what to do when there is no more data.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'what-a-repeated-corpus-is-worth',
    moduleId: 'data-constraints',
    number: 14,
    title: 'The effective-data law',
    subtitle: 'D′ = U·(1 + R★·(1 − e^(−R/R★))), evaluated rather than quoted',
    minutes: 24,
    objectives: [
      'Write the law and say what each of the three quantities in it is',
      'Compute the ceiling a pool is ever worth, and the epoch at which a pass is worth half a fresh one',
      'Name the thing the law has no term for, and say which screen measures it',
    ],
    keyIdeas: [
      'The first pass is worth exactly itself; every later pass is worth e^(−R/R★) of a fresh epoch, which is a decay with no knee in it.',
      'R★ is the whole of the law’s content: it sets the ceiling U·(1 + R★) and the epoch at which the marginal pass halves.',
      'The law saturates and a real run turns upward, so the ceiling bounds the law’s optimism rather than the run’s achievement.',
    ],
    interactive: {
      lab: 'repeats',
      view: 'law',
      title: 'Evaluate the law',
      description: 'The effective data and the marginal value of a pass over a pool, at the paper’s constant and at any other.',
    },
    formulaIds: ['repetition-law', 'effective-data'],
    prerequisites: ['when-the-data-runs-out', 'the-turn-upward'],
    glossaryTerms: ['effective-data', 'repeats', 'dominance-epoch', 'unique-pool'],
    quizIds: ['q-law-1'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'constrained:3',
        title: 'Repeating data',
        note: 'The law itself: the effective number of unique tokens as a function of the repeats, and the constant fitted to the measured curves.',
      },
      {
        chapter: 5,
        section: 'constrained:5',
        title: 'Discussion',
        note: 'The rule of thumb read off the same expression near its start — up to about four epochs is nearly free.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-percolation-threshold',
    moduleId: 'pruning',
    number: 15,
    title: 'The percolation threshold',
    subtitle: 'When the rows going are the rows nothing else can replace',
    minutes: 25,
    objectives: [
      'State the percolation argument for a threshold keep fraction',
      'Read a threshold, a best fraction and a cliff edge off one pruning curve',
      'Explain why the threshold is a property of the metric’s queue rather than of the pool alone',
    ],
    keyIdeas: [
      'Volume laws say a smaller corpus is a worse corpus in a fixed way; percolation says that past some fraction the loss goes faster, because what is being removed stops being redundant.',
      'The rare rows carry the tail directions, and a direction covered by three rows stops existing when two of them are cut.',
      'Rank the same pool four ways and the same event happens at four different fractions, because each ranking loses the rare rows when its own queue reaches them.',
    ],
    interactive: {
      lab: 'percolation',
      view: 'threshold',
      title: 'Break the curve',
      description: 'The loss as the pool shrinks, against a random subset of the same size, with the threshold and the cliff edge marked.',
    },
    formulaIds: ['percolation-threshold', 'row-information'],
    prerequisites: ['what-a-power-law-says', 'when-the-data-runs-out'],
    glossaryTerms: ['percolation-threshold', 'rare-rows', 'pruning-metric', 'unique-pool'],
    quizIds: ['q-perc-1'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'sorscher:1',
        title: 'Introduction',
        note: 'The claim that breaks the law: a pruned corpus can scale better than a larger one, because the information in the data and not its volume is what the loss is a function of.',
      },
      {
        chapter: 3,
        section: 'sorscher:3',
        title: 'An analytic theory of data pruning',
        note: 'The percolation argument: clusters, rarity, and the keep fraction below which the tail of the distribution starts going.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'benchmarking-the-pruning-metrics',
    moduleId: 'pruning',
    number: 16,
    title: 'Four metrics on one pool',
    subtitle: 'Oracle, strong, weak, random — and what each ranking costs',
    minutes: 27,
    objectives: [
      'Rank four pruning metrics at matched volume and read each one’s own threshold',
      'Explain the difference between a comparison at matched volume and one at matched compute',
      'Say which of the four metrics a practitioner can actually compute, and what that costs',
    ],
    keyIdeas: [
      'The oracle ranks rows by the information they truly carry and nobody has it; it is the ceiling the computable metrics are scored against rather than a fifth option.',
      'A strong metric has to be fitted over the whole pool before it can score a row, so its win on volume has to survive a baseline handed the same number of extra rows.',
      'The paper’s ordering — strong beats weak, weak beats random, each with its own cliff — is a claim, and the table is the test of it on this pool with this seed.',
    ],
    interactive: {
      lab: 'percolation',
      view: 'benchmark',
      title: 'Rank the metrics',
      description: 'Each metric at the fraction where it is best, with its excess over random and its own cost in rows.',
    },
    formulaIds: ['row-information'],
    prerequisites: ['the-percolation-threshold'],
    glossaryTerms: ['pruning-metric', 'metric', 'rare-rows', 'percolation-threshold'],
    quizIds: ['q-perc-2', 'q-perc-3'],
    sourceRefs: [
      {
        chapter: 5,
        section: 'sorscher:5',
        title: 'Benchmarking supervised pruning metrics on ImageNet',
        note: 'The ranking of the metrics at matched volume, and the finding that a metric’s own cost is part of the comparison.',
      },
      {
        chapter: 2,
        section: 'sorscher:2',
        title: 'Background and related work',
        note: 'Where the volume laws come from, and why a similarity metric is expected to beat them.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'predicting-the-cliff',
    moduleId: 'pruning',
    number: 17,
    title: 'Predicting the cliff before it happens',
    subtitle: 'm rare rows per direction, and the survival of a queue with error in it',
    minutes: 26,
    objectives: [
      'Compute the threshold the structure of a pool predicts, with no free parameter',
      'Compare the predicted fraction with the measured one on the same pool',
      'Say what the prediction does as the metric’s error grows past the information spread',
    ],
    keyIdeas: [
      'The prediction is a survival calculation: how many rare rows are expected to outrank the cut at each keep fraction, against the number the tail directions need.',
      'At zero error the answer is the share of the pool that ranks above the rarest rare row — a property of the pool, not of the loss.',
      'Past the information spread a rare row survives a cut exactly as often as a bulk row does, the predicted threshold goes to one, and there is nothing left to prune.',
    ],
    interactive: {
      lab: 'percolation',
      view: 'predict',
      title: 'Make the prediction',
      description: 'The rare rows surviving each cut, the requirement the tail needs, and the prediction against the measurement.',
    },
    formulaIds: ['percolation-threshold', 'row-information'],
    prerequisites: ['the-percolation-threshold', 'benchmarking-the-pruning-metrics'],
    glossaryTerms: ['percolation-threshold', 'rare-rows', 'pruning-metric', 'cliff'],
    quizIds: ['q-pred-1'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'sorscher:3',
        title: 'An analytic theory of data pruning',
        note: 'The prediction: m rows per direction have to survive, and the keep fraction that does that is the threshold.',
      },
      {
        chapter: 7,
        section: 'sorscher:7',
        title: 'Discussion',
        note: 'The limits of the theory: it is about a clustered corpus and a similarity metric, and the numbers are the ones the argument needs.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'what-emergence-looks-like',
    moduleId: 'emergence',
    number: 18,
    title: 'What emergence looks like',
    subtitle: 'A score that is zero, and then is not',
    minutes: 22,
    objectives: [
      'Describe the shape of an emergent curve and what makes it striking',
      'Read an emergent curve and say what it does not establish about the model',
      'Compute the same capability under a second, continuous metric',
    ],
    keyIdeas: [
      'The curve is flat, then steep, and the steep part is where the attention goes.',
      'A flat region is not a model that cannot do the task; it is a metric that cannot see it.',
      'The same model, scored differently, can look smooth.',
    ],
    interactive: {
      lab: 'emergence',
      view: 'cliff',
      title: 'Look at the cliff',
      description: 'One capability, two metrics, and the two curves they produce.',
    },
    formulaIds: ['whole-sequence-score'],
    prerequisites: ['what-a-power-law-says'],
    glossaryTerms: ['emergence', 'metric'],
    quizIds: ['q-emergence-1'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'mirage:1',
        title: 'Introduction',
        note: 'The claim under examination: that some abilities appear suddenly, and that the appearance is a property of the metric.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'reproducing-the-artefact',
    moduleId: 'emergence',
    number: 19,
    title: 'Reproducing the artefact',
    subtitle: 'One sweep, two readings, and the gap between them',
    minutes: 24,
    objectives: [
      'Define the reporting floor and read an onset off it',
      'Find the widest gap between the per-token accuracy and the whole-sequence score on one sweep',
      'Explain why the location of a cliff is a fact about the floor as much as about the model',
    ],
    keyIdeas: [
      'The onset is the first point above a chosen floor, so the claimed discovery moves when the floor moves — and the floor is a defensible choice, which is not the same as a forced one.',
      'The gap is widest in the middle of the climb: that is where “the model cannot do this” and “the model gets most of the tokens right” are both true, and only one of them is about the metric.',
      'A cliff interval needs two onsets, and the underlying accuracy never has one because it never stops rising.',
    ],
    interactive: {
      lab: 'emergence',
      view: 'artefact',
      title: 'Measure the gap',
      description: 'Forty points over three decades of compute: the accuracy, the score, the difference, and the floor that decides where the cliff began.',
    },
    formulaIds: ['whole-sequence-score'],
    prerequisites: ['what-emergence-looks-like'],
    glossaryTerms: ['per-token-accuracy', 'metric', 'cliff', 'emergence'],
    quizIds: ['q-artefact-1'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'mirage:3',
        title: 'The metric',
        note: 'The argument that a nonlinear or thresholded metric on a smooth capability produces the appearance of a discontinuity.',
      },
      {
        chapter: 4,
        section: 'mirage:4',
        title: 'Results',
        note: 'The re-readings: abilities that look emergent under one metric and smooth under another, on the same models.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'what-causes-the-cliff',
    moduleId: 'emergence',
    number: 20,
    title: 'What causes the cliff',
    subtitle: 'A threshold in the metric, on a smooth capability',
    minutes: 26,
    objectives: [
      'Derive the whole-sequence score as a power of the per-token accuracy',
      'Show that the sharper the metric, the sharper the apparent transition',
      'Show that moving the metric’s threshold moves the cliff',
    ],
    keyIdeas: [
      'A whole-sequence score is the per-token accuracy raised to the length of the sequence.',
      'The longer the sequence, the steeper the apparent transition — and nothing about the model changed.',
      'The cliff is in the metric; the capability underneath it is smooth all the way.',
    ],
    interactive: {
      lab: 'emergence',
      view: 'metric',
      title: 'Move the metric',
      description: 'The same capability, scored with a threshold that moves.',
    },
    formulaIds: ['whole-sequence-score'],
    prerequisites: ['what-emergence-looks-like'],
    glossaryTerms: ['emergence', 'metric', 'per-token-accuracy'],
    quizIds: ['q-emergence-2', 'q-emergence-3', 'q-mirage-1'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'mirage:3',
        title: 'The metric',
        note: 'How a discontinuous metric on a continuous capability creates an apparent cliff, and the nonlinearity argument.',
      },
      {
        chapter: 4,
        section: 'mirage:4',
        title: 'Results',
        note: 'The experiments: emergent-looking abilities that are not emergent, and the metrics that reveal it.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'three-eras-of-compute',
    moduleId: 'hardware',
    number: 21,
    title: 'Three eras and one straight line',
    subtitle: 'The reported slope, the reported doubling, and the reported range',
    minutes: 22,
    objectives: [
      'Convert a slope in orders of magnitude a year into a doubling time, and back',
      'Say why the reported range of an era and the reported slope of it disagree',
      'Name which numbers on the screen are quoted from the paper rather than computed',
    ],
    keyIdeas: [
      'A slope and a doubling time are one statement in two units, and the conversion is exact: twelve times log₁₀2 divided by the months.',
      'A range is an envelope — the two most extreme runs — and a slope is a trend through a scattered middle, so reading the first as the second is how a headline growth rate is made.',
      'The eras are placed by the analyst: one boundary is a date in the middle of a year rather than a bin, because the event it marks is a date.',
    ],
    interactive: {
      lab: 'hardware',
      view: 'eras',
      title: 'Read the eras',
      description: 'Each era’s three readings of its own growth, and the rate the whole fixture’s trend gives back.',
    },
    formulaIds: ['compute-trend', 'doubling-factor'],
    prerequisites: ['how-the-exponent-is-measured'],
    glossaryTerms: ['log-linear-trend', 'doubling', 'trend-break'],
    quizIds: ['q-hardware-1', 'q-hardware-2', 'q-era-1'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'sevilla:1',
        title: 'Introduction',
        note: 'The measurement: training compute has grown log-linearly, and the growth has breaks in it.',
      },
      {
        chapter: 3,
        section: 'sevilla:3',
        title: 'Trends',
        note: 'The three eras and the statistics reported for each: the slope in orders of magnitude a year, the doubling time, and the range of the runs.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'the-break-in-the-trend',
    moduleId: 'hardware',
    number: 22,
    title: 'A break in the trend, and what it costs to claim one',
    subtitle: 'Every split, both sides fitted, and a penalty of two log n',
    minutes: 23,
    objectives: [
      'Describe the split search and the penalty a detected break has to pay',
      'Explain why a series that is exactly straight must not report a change of slope',
      'Say why a break is a claim about the future rather than a description of the past',
    ],
    keyIdeas: [
      'The search tries every split, fits both sides, and keeps the smallest residual sum of squares only once the split has paid for its two extra parameters.',
      'Requiring the two slopes to differ is what stops floating-point noise from being read as a discovery.',
      'One trend over a broken series is not wrong so much as averaged: it reports the middle of two rates and predicts neither.',
    ],
    interactive: {
      lab: 'hardware',
      view: 'trend',
      title: 'Find the break',
      description: 'A planted change of slope, the split the detector finds, and the single fit it replaces.',
    },
    formulaIds: ['compute-trend', 'log-log-fit'],
    prerequisites: ['three-eras-of-compute'],
    glossaryTerms: ['trend-break', 'log-linear-trend', 'r-squared'],
    quizIds: ['q-hardware-3'],
    sourceRefs: [
      {
        chapter: 3,
        section: 'sevilla:3',
        title: 'Trends',
        note: 'The piecewise fits: the eras are separate regressions, and the change between them is the result being reported.',
      },
      {
        chapter: 4,
        section: 'sevilla:4',
        title: 'Conclusion',
        note: 'What the trend is and is not: a fit to landmark runs, with the eras placed by the analyst rather than given by the data.',
      },
    ],
    furtherReading: [],
  },
  {
    id: 'what-a-trend-buys',
    moduleId: 'hardware',
    number: 23,
    title: 'What a trend buys, and the year it became buyable',
    subtitle: 'Inverting the frontier, dividing by a wall-clock, reading a series',
    minutes: 25,
    objectives: [
      'Name the three steps from a loss target to a year, and what each one assumes',
      'Explain why the factor between the budget’s units and FLOP/s moves every date and no shape',
      'Read the flag that says whether an answer was interpolated inside the series or projected outside it',
    ],
    keyIdeas: [
      'The frontier inverted gives the budget a loss costs, the budget over the run’s hours gives the rate, and the series read at the rate gives the year.',
      'The surface’s budget is in the units of its own runs, so the bridge to FLOP/s is an assumption; halving it changes every date by a predictable amount and changes nothing else.',
      'A target at or below the fitted floor cannot be bought at any price, and reporting that is the answer rather than a failure to produce one.',
    ],
    interactive: {
      lab: 'hardware',
      view: 'feasible',
      title: 'Price a loss in years',
      description: 'The whole chain in one table: the loss, its budget, the rate it needs, the year the series reaches it.',
    },
    formulaIds: ['compute-trend', 'frontier-law'],
    prerequisites: ['the-isoflop-frontier', 'three-eras-of-compute'],
    glossaryTerms: ['feasible-compute', 'log-linear-trend', 'irreducible-loss', 'frontier'],
    quizIds: ['q-feasible-1'],
    sourceRefs: [
      {
        chapter: 1,
        section: 'sevilla:1',
        title: 'Introduction',
        note: 'The reason a trend matters: it is the quantity that says when a given training run stops being science fiction.',
      },
      {
        chapter: 4,
        section: 'sevilla:4',
        title: 'Conclusion',
        note: 'The caution attached to any extrapolation of the fitted rates.',
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
