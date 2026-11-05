/**
 * The equation reference.
 *
 * Every entry gives the result, where it comes from, what every symbol is,
 * the assumptions it rests on, a derivation and a worked example.
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

const KAPLAN_URL = 'https://arxiv.org/abs/2001.08361'
const CHINCHILLA_URL = 'https://arxiv.org/abs/2203.15556'
const CONSTRAINED_URL = 'https://arxiv.org/abs/2305.16264'
const MIRAGE_URL = 'https://arxiv.org/abs/2304.15004'
const SORSCHER_URL = 'https://arxiv.org/abs/2206.14486'
const SEVILLA_URL = 'https://arxiv.org/abs/2202.05924'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'scaling-law',
    title: 'A scaling law',
    latex: 'L(N) = \\left(\\frac{N_{\\mathrm{c}}}{N}\\right)^{\\alpha}',
    reference: { source: 'Kaplan et al. (2020)', location: 'Section 1.1', url: KAPLAN_URL },
    meaning:
      'The loss falls as a power of the quantity being scaled. The coefficient is written as a critical size, so that the law reads as a ratio.',
    symbols: [
      { symbol: 'N', name: 'the quantity being scaled', note: 'The number of tokens, the number of parameters, or the compute.' },
      { symbol: 'N_{\\mathrm{c}}', name: 'the critical size', note: 'The size at which the loss is one unit.' },
      { symbol: '\\alpha', name: 'the exponent', note: 'How fast the loss falls. Its practical content is the factor a doubling buys.' },
    ],
    assumptions: [
      'The measurement is in a region where the law holds, which is established by the fit and not by the form.',
      'The floor of the loss is far enough below that it does not bend the curve.',
    ],
    derivation: [
      'Empirically, the log of the loss falls linearly with the log of the quantity being scaled.',
      'Exponentiating gives the power law.',
      'Writing the coefficient as N_c^(−α) fixes the units of the loss at one.',
    ],
    example: {
      given: 'A law with α = 0.2 and a loss of 2 at 1000 tokens.',
      result: 'At 2000 tokens the loss is 2 × 2^(−0.2) = 1.741.',
      note: 'A doubling buys about 13%.',
    },
  },
  {
    id: 'doubling-factor',
    title: 'The factor a doubling buys',
    latex: '\\frac{L(2N)}{L(N)} = 2^{-\\alpha}',
    reference: { source: 'This course', location: 'The power-law laboratory', url: KAPLAN_URL },
    meaning:
      'The multiplicative improvement that a doubling of the scaled quantity buys. It is the form in which a scaling law is worth quoting.',
    symbols: [
      { symbol: '\\alpha', name: 'the exponent', note: 'The same exponent as in the law itself.' },
    ],
    assumptions: [
      'The doubling stays inside the region where the law holds.',
    ],
    derivation: [
      'Substitute 2N for N in the law.',
      'The factor is 2^(−α) because (2N)^(−α) = N^(−α)·2^(−α).',
    ],
    example: {
      given: 'An exponent of 0.5.',
      result: 'The factor is 2^(−0.5) = 0.707, so a doubling improves the loss by about 29%.',
      note: 'Which is the difference between a law worth obeying and one worth ignoring.',
    },
  },
  {
    id: 'compute-cost',
    title: 'The cost of a training run',
    latex: 'C = 6 N D',
    reference: { source: 'Hoffmann et al. (2022)', location: 'Section 3', url: CHINCHILLA_URL },
    meaning:
      'The arithmetic a training run costs, in floating-point operations, up to the constant that counts the arithmetic in the forward and backward passes.',
    symbols: [
      { symbol: 'N', name: 'the number of parameters', note: 'Every parameter is read once per token.' },
      { symbol: 'D', name: 'the number of training tokens', note: 'Every token causes a pass over the parameters.' },
      { symbol: '6', name: 'the constant', note: 'A few operations per parameter per token, in the convention this course follows.' },
    ],
    assumptions: [
      'The model is trained on every token once, with a constant amount of work per token.',
      'The constant does not depend on the architecture, which is an approximation.',
    ],
    derivation: [
      'The forward pass costs a constant number of operations per parameter per token.',
      'The backward pass costs about twice the forward pass.',
      'The constant absorbs all of that.',
    ],
    example: {
      given: 'A model with 70 billion parameters trained on 1.4 trillion tokens.',
      result: 'The cost is 6 × 7e10 × 1.4e12 = 5.88e23 floating-point operations.',
      note: 'Which is the number people quote when they say a run cost five hundred million dollars.',
    },
  },
  {
    id: 'loss-surface',
    title: 'The two-variable loss surface',
    latex: 'L(N, D) = E + A N^{-\\alpha} + B D^{-\\beta}',
    reference: { source: 'Hoffmann et al. (2022)', location: 'Section 3', url: CHINCHILLA_URL },
    meaning:
      'The loss as a function of the model size and the dataset size: a floor, a term that falls with the model, and a term that falls with the data.',
    symbols: [
      { symbol: 'E', name: 'the irreducible loss', note: 'The floor no model beats.' },
      { symbol: 'A, B', name: 'the coefficients of the two terms', note: 'They set the scale of each term.' },
      { symbol: '\\alpha, \\beta', name: 'the two exponents', note: 'They set where the optimum sits.' },
    ],
    assumptions: [
      'The three terms are additive, which the fit checks.',
      'The exponents are the same across the region being fitted.',
    ],
    derivation: [
      'Each of the two error sources — not enough capacity, not enough data — contributes a power law.',
      'The floor is the part of the loss that is neither.',
      'Adding them gives the surface.',
    ],
    example: {
      given: 'E = 0.2, A = 1, α = 0.5, B = 2, β = 0.5, N = 1000 and D = 1000.',
      result: 'The loss is 0.2 + 0.0316 + 0.0632 = 0.295.',
      note: 'The two terms are in the ratio 1 to 2 here, and that ratio is what the optimum fixes.',
    },
  },
  {
    id: 'optimal-allocation',
    title: 'The condition at the compute optimum',
    latex: '\\alpha A N^{-\\alpha} = \\beta B D^{-\\beta}',
    reference: { source: 'Hoffmann et al. (2022)', location: 'Section 3.1', url: CHINCHILLA_URL },
    meaning:
      'At the allocation that minimises the loss under a fixed budget, the two terms of the surface balance in a fixed ratio.',
    symbols: [
      { symbol: 'A N^{-\\alpha}', name: 'the capacity term', note: 'The part of the loss that more parameters would fix.' },
      { symbol: 'B D^{-\\beta}', name: 'the data term', note: 'The part that more data would fix.' },
    ],
    assumptions: [
      'The budget is fixed and the allocation is free.',
      'The surface is differentiable at the optimum, which it is away from the edges.',
    ],
    derivation: [
      'Write the budget as N·D = P and substitute D = P/N into the surface.',
      'Differentiate with respect to N and set the result to zero.',
      'The condition that falls out is that α times the capacity term equals β times the data term.',
    ],
    example: {
      given: 'A = 1, B = 2, α = β = 0.5 and a budget of N·D = 1e6.',
      result: 'The condition gives N = D/4, so N = 500 and D = 2000.',
      note: 'Four tokens per parameter at that budget.',
    },
  },
  {
    id: 'repetition-invariance',
    title: 'The effect of repetition on a ridge solution',
    latex: 'X^{\\top} X \\to E\\, X^{\\top} X, \\quad X^{\\top} y \\to E\\, X^{\\top} y \\quad \\Longrightarrow \\quad w \\text{ unchanged}',
    reference: { source: 'This course', location: 'The repeats laboratory', url: CONSTRAINED_URL },
    meaning:
      'Repeating every row of the training data E times multiplies both sides of the normal equations by E, so the solution does not change.',
    symbols: [
      { symbol: 'X', name: 'the design matrix', note: 'One row per training example.' },
      { symbol: 'E', name: 'the number of repeats', note: 'How many times the unique data is read.' },
      { symbol: 'w', name: 'the ridge solution', note: 'What the learner would find.' },
    ],
    assumptions: [
      'The penalty is relative to the mean loss, so it is scaled with the number of rows.',
      'The learner is closed-form, so there is no optimisation noise to accumulate.',
    ],
    derivation: [
      'The normal equations are (XᵀX/N + λI)w = Xᵀy/N.',
      'Repeating every row E times multiplies both XᵀX and Xᵀy by E, and the N in the denominator by E.',
      'Every term is multiplied by the same factor, so the solution is identical.',
    ],
    example: {
      given: 'A dataset of 100 unique rows, read four times.',
      result: 'The model is the same as the one trained on the 100 rows once.',
      note: 'The only difference is the bill: four times the arithmetic for the same answer.',
    },
  },
  {
    id: 'effective-data',
    title: 'The effective amount of data',
    latex: 'D_{\\mathrm{eff}} = \\frac{D_{\\mathrm{total}}}{E} = \\frac{D_{\\mathrm{total}}^{2}}{D_{\\mathrm{unique}}}',
    reference: { source: 'Muennighoff et al. (2023)', location: 'Section 3', url: CONSTRAINED_URL },
    meaning:
      'The number of unique rows a run actually learned from, which is what the loss curve should be read against.',
    symbols: [
      { symbol: 'D_{\\mathrm{total}}', name: 'the tokens read', note: 'The size of the training run.' },
      { symbol: 'D_{\\mathrm{unique}}', name: 'the unique tokens', note: 'The size of the dataset before repetition.' },
      { symbol: 'E', name: 'the number of repeats', note: 'The ratio of the two.' },
    ],
    assumptions: [
      'Every unique row is read the same number of times, which is what a standard training schedule does.',
    ],
    derivation: [
      'The number of repeats is the total read divided by the unique rows.',
      'The effective data is the total read divided by the number of repeats.',
      'The two together give the effective data as the total squared over the unique.',
    ],
    example: {
      given: 'A run of 400 billion tokens over a unique dataset of 100 billion tokens.',
      result: 'The number of repeats is 4 and the effective data is 100 billion tokens.',
      note: 'The loss curve of that run should be compared with a run of 100 billion fresh tokens, not with 400.',
    },
  },
  {
    id: 'whole-sequence-score',
    title: 'The whole-sequence score',
    latex: 'S_{\\mathrm{seq}} = q^{L}',
    reference: { source: 'Schaeffer et al. (2023)', location: 'Section 3', url: MIRAGE_URL },
    meaning:
      'The score of a task scored only when every token is right, given a per-token accuracy. It is the mechanism by which a smooth capability produces an apparent cliff.',
    symbols: [
      { symbol: 'q', name: 'the per-token accuracy', note: 'The smooth, underlying quantity.' },
      { symbol: 'L', name: 'the length of the sequence', note: 'The number of tokens that must all be right.' },
      { symbol: 'S_{\\mathrm{seq}}', name: 'the score', note: 'The probability that the whole sequence is right.' },
    ],
    assumptions: [
      'The tokens are correct independently, which is a simplification and a generous one.',
      'The metric gives no partial credit, which is the usual case for exact match.',
    ],
    derivation: [
      'The probability that all L tokens are right is the product of L probabilities.',
      'If each is q, the product is q^L.',
      'A number below one, raised to a higher power, falls further and faster — so the transition sharpens as L grows.',
    ],
    example: {
      given: 'A per-token accuracy of 0.95 and a sequence of ten tokens.',
      result: 'The score is 0.95^10 = 0.599.',
      note: 'The model is right about 95% of the time and scores under 60%. Change the metric and the cliff moves.',
    },
  },
  {
    id: 'isoflop-curve',
    title: 'The IsoFLOP curve',
    latex: 'L(N;C) = E + A\\,N^{-\\alpha} + B\\left(\\frac{C}{kN}\\right)^{-\\beta},\\qquad N^{*} = \\left(\\frac{\\alpha A}{\\beta B}\\right)^{\\frac{1}{\\alpha+\\beta}} P^{\\frac{\\beta}{\\alpha+\\beta}}',
    reference: { source: 'Hoffmann et al. (2022)', location: 'Section 3', url: CHINCHILLA_URL },
    meaning:
      'The loss along one fixed compute budget, as the allocation slides between parameters and data. It is a U: too small a model and the capacity term dominates, too big and the data term does. Its bottom is the compute-optimal allocation.',
    symbols: [
      { symbol: 'C', name: 'the budget', note: 'Fixed, so that every point on the curve costs the same.' },
      { symbol: 'k', name: 'the FLOPs per parameter per token', note: 'Six for a transformer’s forward and backward pass.' },
      { symbol: 'P', name: 'the product the budget pins down', note: 'P = C / k = N·D.' },
      { symbol: 'N^{*}', name: 'the optimal capacity', note: 'Where the two arms of the U balance.' },
    ],
    assumptions: [
      'The surface is the two-power form with a constant floor, fitted inside the region it is used in.',
      'The budget is exactly the product k·N·D, so spending on one axis is taken off the other.',
    ],
    derivation: [
      'Put D = P/N into the surface, so the loss is a function of N alone at fixed P.',
      'Differentiate: the capacity term contributes −αA·N^(−α−1) and the data term +βB·P^(−β)·N^(β−1).',
      'Set the sum to zero and rearrange: N^(α+β) = αA/(βB) · P^β, which is the expression above.',
      'The second derivative is positive there, so the stationary point is the bottom of the U rather than its top.',
    ],
    example: {
      given: 'A surface with α = β and A = B, at a product P of 10^6.',
      result: 'N* = 10^3 and D* = 10^3: the budget splits evenly, and any other split is worse.',
      note: 'The laboratory measures the arms of this U by running the allocations rather than by trusting the algebra.',
    },
  },
  {
    id: 'frontier-law',
    title: 'The law the minima obey',
    latex: 'L^{*}(C) = E + K\\,C^{-\\gamma},\\qquad \\gamma = \\frac{\\alpha\\beta}{\\alpha+\\beta}',
    reference: { source: 'Hoffmann et al. (2022)', location: 'Section 3.1', url: CHINCHILLA_URL },
    meaning:
      'The bottom of each IsoFLOP curve, traced across budgets, is itself a power law. Its exponent is made of the two single-variable exponents and of nothing else, which is why the compute-optimal law can be predicted from the parameter and data laws.',
    symbols: [
      { symbol: 'L^{*}(C)', name: 'the best loss at budget C', note: 'The loss of the compute-optimal allocation.' },
      { symbol: 'K', name: 'the frontier’s coefficient', note: 'Fixed by A, B, α and β; the laboratory measures it at a unit budget.' },
      { symbol: '\\gamma', name: 'the frontier exponent', note: 'The harmonic half of the two exponents: always smaller than either.' },
    ],
    assumptions: [
      'Both terms of the surface are powers with positive exponents over the whole range of budgets.',
      'The optimum is interior — no constraint on the pool and no hard floor on either axis.',
    ],
    derivation: [
      'At the optimum, N ∝ P^(β/(α+β)), so the capacity term falls as P^(−αβ/(α+β)).',
      'D* = P/N* ∝ P^(α/(α+β)), so the data term falls as P^(−βα/(α+β)) — the same power.',
      'Both terms therefore fall at γ = αβ/(α+β), and their sum is a constant times that same power.',
      'Since P is proportional to C, the exponent in the budget is the exponent in the product.',
    ],
    example: {
      given: 'α = β = 0.5, so γ = 0.25.',
      result: 'A budget ten times larger leaves the excess loss at 10^(−0.25) = 0.56 of what it was; a doubling leaves it at 0.84.',
      note: 'A doubling buys about 16% at the frontier, which is the number a training budget is actually worth.',
    },
  },
  {
    id: 'tokens-rule',
    title: 'The tokens-per-parameter rule',
    latex: '\\frac{D^{*}}{N^{*}} = \\left(\\frac{\\beta B}{\\alpha A}\\right)^{\\frac{2}{\\alpha+\\beta}} P^{\\frac{\\alpha-\\beta}{\\alpha+\\beta}}',
    reference: { source: 'Hoffmann et al. (2022)', location: 'Section 4', url: CHINCHILLA_URL },
    meaning:
      'The ratio the optimum chooses for itself. It is a constant only when the two exponents are equal; otherwise it drifts with the budget as a power whose exponent is (α−β)/(α+β). That is the whole content of the rule quoted as “twenty tokens per parameter”.',
    symbols: [
      { symbol: 'D^{*}/N^{*}', name: 'tokens per parameter at the optimum', note: 'A consequence of the surface, not a setting.' },
      { symbol: '\\alpha-\\beta', name: 'the difference of the exponents', note: 'When it is zero the ratio is a constant; when it is not, the rule is a trend.' },
    ],
    assumptions: [
      'The same two-power surface as the IsoFLOP curve.',
      'The budget range is one in which neither term has saturated against the floor.',
    ],
    derivation: [
      'Divide D* = P/N* by N* from the IsoFLOP result.',
      'The P powers combine as 1 − 2β/(α+β) = (α−β)/(α+β).',
      'The constant is the reciprocal of N*’s constant, squared in the appropriate powers, which is (βB/αA)^(2/(α+β)).',
    ],
    example: {
      given: 'A surface whose fitted exponents are α = 0.44 and β = 0.61.',
      result: 'The exponent of the ratio is (0.44−0.61)/1.05 = −0.16, so tokens per parameter falls as budgets rise.',
      note: 'Quoting “20” without the budget it was measured at is quoting a number that is not constant.',
    },
  },
  {
    id: 'crossover-budget',
    title: 'The crossover between two model sizes',
    latex: 'P^{*\\beta} = \\frac{B\\left(N_2^{\\beta} - N_1^{\\beta}\\right)}{A\\left(N_1^{-\\alpha} - N_2^{-\\alpha}\\right)}',
    reference: { source: 'Kaplan et al. (2020)', location: 'Section 2', url: KAPLAN_URL },
    meaning:
      'The compute at which a larger model trained on less data becomes better than a smaller model trained on more. Below it the small model wins; above it the large one does. It is the point at which “scale up” stops being advice about the parameters and starts being advice about the corpus.',
    symbols: [
      { symbol: 'N_1', name: 'the smaller capacity', note: 'The model that is cheaper to fill.' },
      { symbol: 'N_2', name: 'the larger capacity', note: 'The model that needs the data.' },
      { symbol: 'P^{*}', name: 'the product at the crossover', note: 'The budget divided by k.' },
    ],
    assumptions: [
      'Both models are trained at the same compute, so each gets D = P/N.',
      'The floor E is the same for both and cancels.',
    ],
    derivation: [
      'Write both losses on the surface with D = P/N.',
      'Set them equal; the E terms cancel and the two powers rearrange to the expression above.',
      'Solve for P by taking the 1/β power — the crossover exists because the two sides have opposite signs when N₂ > N₁.',
    ],
    example: {
      given: 'A surface with α = β = 0.5, A = B = 1, and the pair N₁ = 4, N₂ = 16.',
      result: 'P* = (2 / 0.25)² = 64, so a budget of 384 at k = 6, and both models then sit at E + 0.75.',
      note: 'The screen walks the whole table on the laboratory’s own surface, so the reader can see the crossover move as the pair gets wider.',
    },
  },
  {
    id: 'repetition-law',
    title: 'What a repeated corpus is worth',
    latex: "D_{\\mathrm{eff}} = U\\left(1 + R^{\\star}\\left(1 - e^{-R/R^{\\star}}\\right)\\right)",
    reference: { source: 'Muennighoff et al. (2023)', location: 'Section 3', url: CONSTRAINED_URL },
    meaning:
      'The effective amount of unique data a run of R extra passes over a pool of U tokens is worth. It saturates: the pool can never be worth more than U·(1 + R★), however many times it is read.',
    symbols: [
      { symbol: 'U', name: 'the unique tokens', note: 'The size of the pool.' },
      { symbol: 'R', name: 'the extra passes', note: 'The epoch count minus one.' },
      { symbol: 'R^{\\star}', name: 'the repetition constant', note: 'Fitted; the paper’s data-side value is 15.39.' },
    ],
    assumptions: [
      'Every row is read the same number of times.',
      'The law is a fit over the regime 1 to 16 epochs, and is used inside it.',
    ],
    derivation: [
      'The marginal epoch of the expression is e^(−R/R★): the first repeat is worth almost a fresh one, the twentieth is worth nothing.',
      'Summing that decay from zero to R gives R★(1 − e^(−R/R★)) fresh-equivalents.',
      'Adding the pool itself gives the law.',
    ],
    example: {
      given: 'A pool read four times, so R = 3, at the paper’s R★ = 15.39.',
      result: 'D_eff = U·(1 + 15.39·(1 − e^(−3/15.39))) = 3.73·U, so four epochs are worth 3.73 fresh passes.',
      note: 'The screen prints the measured curve next to this closed form, and the two are different instruments.',
    },
  },
  {
    id: 'percolation-threshold',
    title: 'The percolation threshold of a pruned pool',
    latex: 'f^{\\star} \\approx \\frac{m\\,d_{\\mathrm{tail}}}{N}\\quad\\text{with}\\quad \\mathbb{E}[\\text{rare kept}] = \\sum_{n\\,\\mathrm{rare}} \\Phi\\!\\left(\\frac{\\ell_n - \\tau(f)}{\\sigma}\\right)',
    reference: { source: 'Sorscher et al. (2022)', location: 'Section 3', url: SORSCHER_URL },
    meaning:
      'The keep fraction at which a pruned corpus stops working. Above it the bulk that goes is redundant and the loss barely moves; at it, the rare rows that carry the tail directions start going and the curve breaks.',
    symbols: [
      { symbol: 'd_{\\mathrm{tail}}', name: 'the tail directions', note: 'The parts of the task only a handful of rows carry.' },
      { symbol: 'm', name: 'the rows needed per direction', note: 'Three in the laboratory, because one row fixes a direction but does not test it.' },
      { symbol: 'N', name: 'the size of the pool', note: 'All of it, rare and bulk together.' },
      { symbol: '\\ell_n', name: 'the log information of row n', note: '‖x‖²/σ² for a linear-Gaussian row.' },
      { symbol: '\\sigma', name: 'the metric’s own error', note: 'Zero is a perfect metric; the threshold moves with it.' },
    ],
    assumptions: [
      'The tail directions need a fixed number of rows each, and a direction with none is lost.',
      'The metric ranks rows by informativeness, so the cut is a threshold on ℓ rather than a random subsample.',
    ],
    derivation: [
      'The requirement is m·d_tail rare rows; with a perfect metric, keeping fraction f keeps the top f·N rows.',
      'Setting the top fraction equal to the requirement gives f★ ≈ m·d_tail/N.',
      'With a noisy metric the surviving count is the sum of the normal tails above the cut, and the cut τ(f) is found by bisection on the same mixture.',
      'Because that sum falls as f falls, there is a smallest f at which it still reaches the requirement: the threshold.',
    ],
    example: {
      given: 'The laboratory’s pool: 400 rows, 24 dimensions of which the last 4 are tail directions, m = 3.',
      result: 'The requirement is 12 rows, so the predicted threshold is 12/400 = 3% of the pool.',
      note: 'The screen compares that with the threshold the training runs actually break at.',
    },
  },
  {
    id: 'compute-trend',
    title: 'A trend in compute, and what it buys',
    latex: 'T_{\\mathrm{double}} = \\frac{12\\log_{10} 2}{s}\\ \\text{months},\\qquad \\frac{L(t+1)}{L(t)} = 10^{-\\gamma s}',
    reference: { source: 'Sevilla et al. (2022)', location: 'Section 3', url: SEVILLA_URL },
    meaning:
      'A log-linear trend in compute, stated in the two units it is quoted in — orders of magnitude a year and months per doubling — and turned into a capability by the frontier exponent. A hardware trend is only a capability once it is multiplied by a law.',
    symbols: [
      { symbol: 's', name: 'orders of magnitude a year', note: 'The slope of the log-compute trend.' },
      { symbol: 'T_{\\mathrm{double}}', name: 'months per doubling', note: 'The same slope in the other unit: 24 months is s = 0.15.' },
      { symbol: '\\gamma', name: 'the frontier exponent', note: 'From the law the minima obey, not from the hardware.' },
    ],
    assumptions: [
      'The trend is log-linear over the window it is quoted for; a break makes a single slope meaningless.',
      'The money to spend the capability exists, and a run fits in the wall-clock assumed.',
    ],
    derivation: [
      'A doubling is log₁₀2 orders of magnitude, so the doubling time in years is log₁₀2/s; twelve times that is in months.',
      'The frontier says the best loss at budget C falls as C^(−γ), so a year multiplying C by 10^s multiplies the excess loss by 10^(−γs).',
      'Inverting the same law gives the budget a target loss costs, and so the year that target became buyable.',
    ],
    example: {
      given: 'The deep-learning era, reported as 0.6 orders of magnitude a year and a doubling every 5.7 months, against a frontier exponent of 0.25.',
      result: 'The slope converts to 6.0 months a doubling — the paper’s two statistics disagree by half a month — and the loss factor is 10^(−0.15) = 0.71 a year.',
      note: 'The era’s numbers are quoted from the paper; the conversion, the disagreement and the multiplication by γ are this course’s arithmetic, and screen H prints all three.',
    },
  },
  {
    id: 'log-log-fit',
    title: 'Fitting a law by least squares',
    latex: '\\min_{a,b}\\sum_i\\left(a + b\\log x_i - \\log y_i\\right)^2,\\qquad \\alpha = -b',
    reference: { source: 'Kaplan et al. (2020)', location: 'Section 2.1', url: KAPLAN_URL },
    meaning:
      'The estimator behind every exponent in this course. A power law is a straight line in logs, so the exponent is the negative of the fitted slope and the coefficient is the intercept.',
    symbols: [
      { symbol: 'x_i', name: 'the scaled quantity', note: 'Tokens, parameters, or the product the budget pins down.' },
      { symbol: 'y_i', name: 'the measured loss', note: 'The held-out loss of run i.' },
      { symbol: 'b', name: 'the fitted slope', note: 'The negative of the exponent.' },
    ],
    assumptions: [
      'The errors are multiplicative, which is what taking logs assumes when the residuals are fitted in log space.',
      'Every point is in the region where one law describes the curve.',
    ],
    derivation: [
      'Write the law as log y = a − α log x.',
      'Least squares in the two coefficients is ordinary linear regression on the logged columns.',
      'The R² of that regression is the fraction of the log-loss variance the line explains — a number about the fit, not about the range.',
    ],
    example: {
      given: 'The laboratory’s 20 runs, fitted over capacities 4 to 64.',
      result: 'The slope in log–log space is negative, and −b is the exponent the screen prints as α.',
      note: 'The same runs fitted over half the range give a different α, which is the point of screen A’s second tab.',
    },
  },
  {
    id: 'row-information',
    title: 'What one row is worth',
    latex: 'I_n = \\frac{x_n x_n^{\\mathsf T}}{\\sigma_n^{2}},\\qquad \\operatorname{tr} I_n = \\frac{\\lVert x_n\\rVert^{2}}{\\sigma_n^{2}}',
    reference: { source: 'Sorscher et al. (2022)', location: 'Section 3', url: SORSCHER_URL },
    meaning:
      'The information a single labelled row carries about the fitted parameters, for a linear model with per-row noise. Its trace is the scalar a pruning metric is trying to rank by, and it is exactly computable here — which is what lets the laboratory define a best possible metric.',
    symbols: [
      { symbol: 'x_n', name: 'the row', note: 'Its amplitude is what a norm-based metric sees.' },
      { symbol: '\\sigma_n', name: 'the noise on that row’s label', note: 'Invisible to the inputs, decisive in the ratio.' },
      { symbol: '\\operatorname{tr} I_n', name: 'the scalar informativeness', note: 'Large when the row is far out and its label is clean.' },
    ],
    assumptions: [
      'The model is linear in the features and the noise is independent per row.',
      'The metric may use the labels; a norm-only metric is estimating this quantity without σ.',
    ],
    derivation: [
      'For a Gaussian likelihood the Fisher information is the outer product of the gradient of the log-likelihood, which for a linear row is x xᵀ/σ².',
      'A scalar ranking needs one number per row, so take the trace.',
      'A residual-based score sees the small σ because it fits the row; a norm-based score sees only the large ‖x‖.',
    ],
    example: {
      given: 'A rare row with an ordinary norm and a label noise ten times smaller than the bulk’s.',
      result: 'Its information is about two orders above a bulk row of the same size, and a norm ranks it in the middle of the pool.',
      note: 'That single mismatch is why the two metrics have two different cliffs.',
    },
  },
]
