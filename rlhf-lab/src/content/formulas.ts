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

const NPLUS_URL = 'https://arxiv.org/abs/2403.17031'
const PPO_URL = 'https://arxiv.org/abs/1707.06347'
const TRPO_URL = 'https://arxiv.org/abs/1502.05477'
const OVEROPT_URL = 'https://arxiv.org/abs/2210.10760'

export const FORMULAS: FormulaEntry[] = [
  {
    id: 'rlhf-objective',
    title: 'The RLHF objective',
    latex: 'J(\\theta) = \\mathbb{E}_{x \\sim \\pi_\\theta(\\cdot|x)}\\bigl[r_\\phi(x)\\bigr] - \\beta\\,\\mathrm{KL}\\bigl(\\pi_\\theta(\\cdot|x)\\,\\|\\,\\pi_{\\mathrm{ref}}(\\cdot|x)\\bigr)',
    reference: { source: 'Huang et al. (2024)', location: 'The policy stage objective', url: NPLUS_URL },
    meaning:
      'Maximise the expected reward under the policy, minus a penalty for how far the policy has moved from the reference. The coefficient β is the dial on that distance.',
    symbols: [
      { symbol: 'r_\\phi(x)', name: 'the proxy reward', note: 'The reward model’s score, which is wrong in a way that matters.' },
      { symbol: '\\pi_{\\mathrm{ref}}', name: 'the reference policy', note: 'Normally the supervised model from the first stage.' },
      { symbol: '\\beta', name: 'the KL coefficient', note: 'Larger means the policy travels less far.' },
    ],
    assumptions: [
      'The reward model is fixed during the policy stage.',
      'The KL is measured against the reference at every step.',
    ],
    derivation: [
      'Start from the expected reward under the current policy.',
      'Add a term that is zero when the policy equals the reference and grows as it departs.',
      'The KL divergence is the natural choice: it is zero exactly at equality and is well-behaved away from it.',
    ],
    example: {
      given: 'A policy that has moved to a KL of 0.5 from the reference, with β = 0.1.',
      result: 'The penalty contributes 0.05 to the objective.',
      note: 'A tenth of a nat of divergence costs half a percent of the reward scale.',
    },
  },
  {
    id: 'score-function',
    title: 'The score-function estimator',
    latex: '\\nabla_\\theta\\,\\mathbb{E}_{a\\sim\\pi_\\theta}[r(a)] = \\mathbb{E}_{a\\sim\\pi_\\theta}\\bigl[r(a)\\,\\nabla_\\theta \\log \\pi_\\theta(a)\\bigr]',
    reference: { source: 'This course, after the policy gradient theorem', location: 'The estimator', url: NPLUS_URL },
    meaning:
      'The derivative of an expectation over a distribution that is itself changing. The model’s log-probability stands in for the model’s derivative.',
    symbols: [
      { symbol: '\\nabla_\\theta \\log \\pi_\\theta(a)', name: 'the score', note: 'How much more likely the action is when the parameters move a certain way.' },
    ],
    assumptions: [
      'The support of the policy does not depend on the parameters.',
      'The expectations are taken under the current policy.',
    ],
    derivation: [
      'Write the expectation as an integral against the policy density.',
      'Differentiate; the density’s own derivative appears.',
      'Replace that derivative using the identity ∇p = p ∇log p.',
    ],
    example: {
      given: 'A policy that puts probability 0.7 on action a, with reward 2.',
      result: 'The score for a is 1 − 0.7 = 0.3, so the gradient contribution is 2 × 0.3 = 0.6.',
      note: 'The gradient of a softmax’s log-probability is onehot(a) − π, and it sums to zero.',
    },
  },
  {
    id: 'baseline',
    title: 'Why a baseline is free',
    latex: '\\mathbb{E}_{a\\sim\\pi_\\theta}\\bigl[(r(a) - b)\\,\\nabla_\\theta\\log\\pi_\\theta(a)\\bigr] = \\nabla_\\theta\\,\\mathbb{E}_{a\\sim\\pi_\\theta}[r(a)]',
    reference: { source: 'This course', location: 'The baseline identity', url: NPLUS_URL },
    meaning:
      'Subtracting any constant that does not depend on the action leaves the estimator unbiased. That is why the value function can be used as a baseline for free.',
    symbols: [
      { symbol: 'b', name: 'the baseline', note: 'Any action-independent constant; the value function is the best choice.' },
    ],
    assumptions: ['The baseline does not depend on the action that was taken.'],
    derivation: [
      'Split the expectation into the reward term and the baseline term.',
      'The baseline term is ∇_θ Σ_a π_θ(a) b = b ∇_θ 1 = 0.',
      'So the two gradients are equal.',
    ],
    example: {
      given: 'A policy with three actions of equal probability, and rewards 0, 1, 2.',
      result: 'The baseline term contributes exactly zero to the gradient.',
      note: 'Choosing b as the mean reward reduces the variance without touching the bias.',
    },
  },
  {
    id: 'importance-ratio',
    title: 'The importance ratio',
    latex: 'r_t(\\theta) = \\frac{\\pi_\\theta(a_t \\mid s_t)}{\\pi_{\\mathrm{old}}(a_t \\mid s_t)}',
    reference: { source: 'Schulman et al. (2017)', location: 'The ratio in the PPO objective', url: PPO_URL },
    meaning:
      'The correction that lets samples collected under one policy estimate the objective of another. It is the quantity the clip acts on.',
    symbols: [
      { symbol: '\\pi_{\\mathrm{old}}', name: 'the behaviour policy', note: 'The policy the samples were collected under.' },
    ],
    assumptions: ['The old policy gives the sampled actions non-zero probability.'],
    derivation: [
      'The objective is an expectation under the new policy.',
      'Reweight the samples from the old policy by the density ratio.',
      'The ratio is one when the two policies agree.',
    ],
    example: {
      given: 'A new policy that puts 0.4 on an action the old policy put 0.2 on.',
      result: 'The ratio is 2.',
      note: 'The objective doubles the contribution of that sample, because it is twice as likely now.',
    },
  },
  {
    id: 'clipped-objective',
    title: 'The clipped surrogate',
    latex: 'L^{\\mathrm{CLIP}}(\\theta) = \\mathbb{E}_t\\Bigl[\\min\\bigl(r_t(\\theta) A_t,\\; \\operatorname{clip}(r_t(\\theta), 1-\\varepsilon, 1+\\varepsilon) A_t\\bigr)\\Bigr]',
    reference: { source: 'Schulman et al. (2017)', location: 'The PPO objective', url: PPO_URL },
    meaning:
      'The objective takes the *minimum* of the clipped and unclipped terms, so it never rewards pushing a ratio past the bound in a direction that would increase the objective.',
    symbols: [
      { symbol: '\\varepsilon', name: 'the clip range', note: 'Usually 0.2.' },
      { symbol: 'A_t', name: 'the advantage', note: 'Positive means the action was better than average.' },
    ],
    assumptions: [
      'The advantage is a fixed estimate for the step.',
      'The old policy is the one the samples came from.',
    ],
    derivation: [
      'Start from the surrogate r_t A_t.',
      'For a positive advantage, the objective should stop growing once r_t passes 1 + ε.',
      'Taking the minimum of the two branches does exactly that, and symmetrically for a negative advantage.',
    ],
    example: {
      given: 'ε = 0.2, r_t = 1.5, A_t = 1.',
      result: 'min(1.5, 1.2) = 1.2.',
      note: 'And because the clipped branch is the minimum and is flat, the gradient there is zero.',
    },
  },
  {
    id: 'td-residual',
    title: 'The one-step temporal-difference residual',
    latex: '\\delta_t = r_t + \\gamma V(s_{t+1}) - V(s_t)',
    reference: { source: 'This course', location: 'The advantage estimate', url: NPLUS_URL },
    meaning:
      'How much the world surprised the critic. It is the one-step version of the advantage, and generalised advantage estimation is a geometric sum of these.',
    symbols: [
      { symbol: '\\delta_t', name: 'the residual', note: 'The TD(λ) special case of the general residual.' },
      { symbol: 'V(s_{t+1})', name: 'the next value', note: 'Zero at a terminal state.' },
    ],
    assumptions: ['The value function is a reasonable estimate of the return.'],
    derivation: [
      'The advantage is the return minus the value.',
      'Approximate the return by one step of reward plus the bootstrapped value.',
      'Subtract the value of the current state.',
    ],
    example: {
      given: 'r_t = 1, γ = 0.9, V(s_{t+1}) = 0.6, V(s_t) = 0.5.',
      result: 'δ_t = 1 + 0.54 − 0.5 = 1.04.',
      note: 'The world was worth more than the critic expected.',
    },
  },
  {
    id: 'gae',
    title: 'Generalised advantage estimation',
    latex: 'A_t^{\\mathrm{GAE}(\\gamma,\\lambda)} = \\sum_{l \\ge 0} (\\gamma\\lambda)^l \\delta_{t+l}',
    reference: { source: 'This course', location: 'The advantage estimate', url: NPLUS_URL },
    meaning:
      'A geometrically weighted sum of the residuals, with λ deciding how far ahead it looks. λ = 0 is the one-step residual; λ = 1 is the Monte Carlo return.',
    symbols: [
      { symbol: '\\lambda', name: 'the trace-decay parameter', note: 'Between 0 and 1.' },
    ],
    assumptions: ['The residuals are computed backwards along the trajectory, and the last step is terminal.'],
    derivation: [
      'Define the advantage recursively: A_t = δ_t + γλ A_{t+1}.',
      'Unroll the recursion to get the geometric sum.',
      'λ interpolates between the one-step estimate and the full return.',
    ],
    example: {
      given: 'δ_0 = 1, δ_1 = 0.5, γ = 0.9, λ = 0.5.',
      result: 'A_0 = 1 + 0.45 × 0.5 = 1.225.',
      note: 'Compare the Monte Carlo answer, which would be the discounted sum of the two rewards.',
    },
  },
  {
    id: 'kl-estimators',
    title: 'The three KL estimators',
    latex: 'k_1 = \\log\\frac{\\pi}{\\pi_{\\mathrm{ref}}}, \\qquad k_2 = \\Bigl(\\log\\frac{\\pi}{\\pi_{\\mathrm{ref}}}\\Bigr)^2, \\qquad k_3 = \\frac{\\pi}{\\pi_{\\mathrm{ref}}} - 1 - \\log\\frac{\\pi}{\\pi_{\\mathrm{ref}}}',
    reference: { source: 'This course', location: 'The penalty laboratory', url: NPLUS_URL },
    meaning:
      'Three ways to estimate the same divergence from samples. The first is unbiased but can be negative; the second is positive but biased; the third is positive and is the usual choice for a penalty.',
    symbols: [
      { symbol: '\\pi / \\pi_{\\mathrm{ref}}', name: 'the density ratio', note: 'Computed per sample.' },
    ],
    assumptions: ['The samples are drawn from the current policy.'],
    derivation: [
      'k1 is the log-ratio, whose expectation under the current policy is the KL.',
      'k2 squares it, which removes the sign but adds a positive bias.',
      'k3 uses the ratio itself; its expectation is the chi-square divergence minus the KL.',
    ],
    example: {
      given: 'π = 0.5 and π_ref = 0.25 on the sampled action.',
      result: 'k1 = 0.693, k2 = 0.480, k3 = 0.307.',
      note: 'All three are positive here, but only k1 is unbiased for the KL in general.',
    },
  },
  {
    id: 'chi-square',
    title: 'What the third estimator actually estimates',
    latex: '\\mathbb{E}_{x\\sim\\pi}\\bigl[k_3\\bigr] = \\underbrace{\\sum_x \\frac{(\\pi(x) - \\pi_{\\mathrm{ref}}(x))^2}{\\pi_{\\mathrm{ref}}(x)}}_{\\chi^2(\\pi\\|\\pi_{\\mathrm{ref}})} - \\mathrm{KL}(\\pi\\|\\pi_{\\mathrm{ref}})',
    reference: { source: 'This course', location: 'The penalty laboratory', url: NPLUS_URL },
    meaning:
      'The expectation of the third estimator is the chi-square divergence minus the KL. For small divergences the two are close, which is why the estimator is used in practice — but the identity is worth knowing.',
    symbols: [
      { symbol: '\\chi^2(\\pi\\|\\pi_{\\mathrm{ref}})', name: 'the chi-square divergence', note: 'Always non-negative.' },
    ],
    assumptions: ['The expectation is taken over samples from the current policy.'],
    derivation: [
      'E[r] = Σ_x π(x)·π(x)/π_ref(x) = 1 + χ².',
      'E[log r] = KL.',
      'So E[k3] = (1 + χ²) − 1 − KL.',
    ],
    example: {
      given: 'π = (0.5, 0.5) and π_ref = (0.7, 0.3).',
      result: 'χ² = 0.190, KL = 0.087, so E[k3] = 0.103.',
      note: 'A direct evaluation of the estimator over the two actions gives the same number.',
    },
  },
  {
    id: 'trust-region-constraint',
    title: 'The trust-region constraint',
    latex: '\\max_\\theta\\; \\mathbb{E}_t\\bigl[r_t(\\theta) A_t\\bigr] \\quad \\text{subject to} \\quad \\mathrm{KL}(\\pi_\\theta \\| \\pi_{\\mathrm{old}}) \\le \\delta',
    reference: { source: 'Schulman et al. (2015)', location: 'The TRPO objective', url: TRPO_URL },
    meaning:
      'Maximise the surrogate subject to a bound on how far the policy may move. The bound is not about the reward; it is about the validity of the estimate.',
    symbols: [
      { symbol: '\\delta', name: 'the trust-region radius', note: 'Usually around 0.01.' },
    ],
    assumptions: ['The importance ratio is a good approximation to the new policy inside the region.'],
    derivation: [
      'The surrogate uses samples from the old policy.',
      'Those samples describe the old policy, so the surrogate is only meaningful while the two are close.',
      'Constrain the distance rather than hoping the step size happens to be small.',
    ],
    example: {
      given: 'A step that moves the policy by a KL of 0.02, with δ = 0.01.',
      result: 'The step is outside the region and must be shortened.',
      note: 'Which is what the conjugate-gradient line search does.',
    },
  },
  {
    id: 'overoptimisation-bon',
    title: 'The best-of-n overoptimisation form',
    latex: 'R_{\\mathrm{boN}}(d) = d\\,\\bigl(\\alpha_{\\mathrm{boN}} - \\beta_{\\mathrm{boN}} d\\bigr)',
    reference: { source: 'Gao, Schulman & Hilton (2022)', location: 'The functional form fitted to best-of-n', url: OVEROPT_URL },
    meaning:
      'The true reward as a function of the KL distance travelled, under best-of-n sampling. A downward parabola through the origin: it rises, turns over, and falls.',
    symbols: [
      { symbol: 'd', name: 'the KL distance', note: 'How far the policy has moved from the reference.' },
      { symbol: '\\alpha, \\beta', name: 'the fitted coefficients', note: 'They scale with the size of the reward model.' },
    ],
    assumptions: ['The distance is measured as the KL from the reference policy.'],
    derivation: [
      'Measure the true reward at a range of distances travelled.',
      'The curve rises at first and then turns over.',
      'Fit a quadratic through the origin, which is linear in the two coefficients once d is factored out.',
    ],
    example: {
      given: 'α = 1.2 and β = 0.4.',
      result: 'The turning point is at d = 1.5, where the true reward is 0.9.',
      note: 'Past that distance, every further step costs more than it gains.',
    },
  },
  {
    id: 'overoptimisation-rl',
    title: 'The reinforcement-learning overoptimisation form',
    latex: 'R_{\\mathrm{RL}}(d) = d\\,\\bigl(\\alpha_{\\mathrm{RL}} - \\beta_{\\mathrm{RL}} \\log d\\bigr)',
    reference: { source: 'Gao, Schulman & Hilton (2022)', location: 'The functional form fitted to reinforcement learning', url: OVEROPT_URL },
    meaning:
      'The same measurement under policy optimisation. The log makes the curve turn over more slowly than the best-of-n parabola, because the policy moves rather than the sample.',
    symbols: [
      { symbol: '\\log d', name: 'the logarithmic term', note: 'Defined for d > 0; the distance is never zero in practice.' },
    ],
    assumptions: ['The same distance measure and the same reward model as the best-of-n fit.'],
    derivation: [
      'Measure the true reward at a range of distances.',
      'The curve turns over later than the best-of-n one.',
      'Fit a model linear in α and β once d and d log d are used as the regressors.',
    ],
    example: {
      given: 'α = 1.2 and β = 0.4.',
      result: 'The turning point is at d ≈ 1.49, and the value there is ≈ 0.97.',
      note: 'The shapes are close, which is the point: both turn over at a finite distance.',
    },
  },
  {
    id: 'tilted-policy',
    title: 'The policy that reaches a KL budget',
    latex: '\\pi_\\lambda(i) \\propto \\pi_{\\mathrm{ref}}(i)\\,\\exp\\bigl(\\lambda\\, r_\\phi(i)\\bigr)',
    reference: { source: 'This course', location: 'The overoptimisation laboratory', url: OVEROPT_URL },
    meaning:
      'The maximiser of the expected proxy reward subject to a KL budget, in closed form. It is the policy that an ideal constrained optimiser would find, and it is what the laboratory traces.',
    symbols: [
      { symbol: '\\lambda', name: 'the multiplier', note: 'Larger means more reward and more distance.' },
    ],
    assumptions: ['The KL budget is the only constraint, and the reward is linear in the policy.'],
    derivation: [
      'Maximise E_π[r] − (1/λ)·KL(π ‖ π_ref).',
      'The stationary point of that expression is the exponential tilt.',
      'Sweep λ to trace the whole curve.',
    ],
    example: {
      given: 'A reference that puts 0.5 on each of two actions, and a proxy that scores them 1 and 0.',
      result: 'At λ = 1 the tilt puts 0.73 on the first action.',
      note: 'As λ grows the policy concentrates on the proxy’s favourite point.',
    },
  },
  {
    id: 'advantage-standardisation',
    title: 'Advantage standardisation',
    latex: '\\hat{A}_t = \\frac{A_t - \\mu_A}{\\sigma_A + \\varepsilon}',
    reference: { source: 'This course', location: 'The implementation details', url: NPLUS_URL },
    meaning:
      'Rescaling the advantages by their running standard deviation, so that the learning rate means the same thing regardless of the reward scale.',
    symbols: [
      { symbol: '\\sigma_A', name: 'the standard deviation', note: 'Usually the running standard deviation over the batch.' },
      { symbol: '\\varepsilon', name: 'a guard', note: 'Prevents division by zero.' },
    ],
    assumptions: ['The advantages are approximately symmetric around zero.'],
    derivation: [
      'The advantage scale varies with the reward scale.',
      'Standardising makes the effective step size independent of that scale.',
      'The gradient direction is unchanged; only the step size is.',
    ],
    example: {
      given: 'Advantages of 2 and 4, with mean 3 and standard deviation 1.',
      result: 'They become −1 and +1.',
      note: 'The direction is unchanged; the magnitudes are not.',
    },
  },
]
