/**
 * The terminology registry.
 *
 * Every symbol the curriculum leans on, with the meaning a reader needs the
 * first time they meet it and the place in the book where it is defined. The
 * equation explorer, the lessons and the laboratories all draw from this one
 * list, so a term cannot mean two different things in two places.
 */

export interface Term {
  /** the key used in the [[term-id]] markup */
  id: string;
  /** the LaTeX for the symbol */
  symbol: string;
  /** a short name */
  name: string;
  /** what it means, in one or two sentences */
  meaning: string;
  /** where the book defines it */
  ref: string;
  /** the equation-explorer entry that derives it, when there is one */
  equationId?: string;
}

export const TERMS: Term[] = [
  {
    id: 'kernel',
    symbol: 'K^{(\\ell)}',
    name: 'kernel',
    meaning:
      'The mean squared preactivation in layer ℓ, averaged over the neurons. It is the infinite-width two-point correlator: the only number that the layer recursion needs.',
    ref: 'eq. (5.1)',
    equationId: 'linear-covariance',
  },
  {
    id: 'g-k',
    symbol: 'g(K)',
    name: 'the helper function g',
    meaning:
      'g(K) = E[σ(z)²] for z ~ N(0, K). All of the recursion for the kernel is g applied repeatedly, so g is where the activation function enters the theory.',
    ref: 'eq. (5.49)',
  },
  {
    id: 'chi-parallel',
    symbol: '\\chi_{\\parallel}',
    name: 'parallel susceptibility',
    meaning:
      'χ∥ = C_W g′(K): how fast a change in the *magnitude* of a layer’s preactivations grows with depth. The subscript says the perturbation keeps the input’s direction.',
    ref: 'eq. (5.50)',
    equationId: 'chi-parallel',
  },
  {
    id: 'chi-perp',
    symbol: '\\chi_{\\perp}',
    name: 'perpendicular susceptibility',
    meaning:
      'χ⊥ = C_W E[σ′(z)²]: how fast a change in the *direction* of a layer’s preactivations grows. It is the susceptibility behind the exploding- and vanishing-gradient problem.',
    ref: 'eq. (5.51)',
    equationId: 'chi-perp',
  },
  {
    id: 'criticality',
    symbol: '\\chi_{\\parallel}(K_\\infty)=\\chi_{\\perp}(K_\\infty)=1',
    name: 'criticality',
    meaning:
      'The two conditions that define the critical initialization: neither parallel nor perpendicular perturbations grow or decay exponentially with depth.',
    ref: 'eq. (5.55)',
    equationId: 'criticality-conditions',
  },
  {
    id: 'cw',
    symbol: 'C_W',
    name: 'rescaled weight variance',
    meaning:
      'Var(W) = C_W / n: the order-one part of the weight variance. It is the initialization hyperparameter the theory is about.',
    ref: 'eq. (4.2)',
  },
  {
    id: 'cb',
    symbol: 'C_b',
    name: 'bias variance',
    meaning:
      'Var(b) = C_b: the order-one part of the bias variance. It adds a depth-independent floor to the kernel, and for most activations criticality requires C_b = 0.',
    ref: 'eq. (4.2)',
  },
  {
    id: 'a2',
    symbol: 'A^2',
    name: 'the scale-invariant constant',
    meaning:
      'A² = (a₊² + a₋²)/2 for a scale-invariant activation σ(z) = a₊z or a₋z. It is the only activation-dependent number in the critical initialization: C_W = 1/A².',
    ref: 'eq. (5.61)',
    equationId: 'scale-invariant-critical',
  },
  {
    id: 'a1',
    symbol: 'a_1',
    name: 'the quartic coupling',
    meaning:
      'The O(K²) coefficient of g(K), a₁ = (3/4)γ₂² + γ₁γ₃. Its sign decides whether the K = 0 fixed point is attractive (a₁ < 0) or repulsive (a₁ > 0).',
    ref: 'eq. (5.86)',
    equationId: 'kzero-power-law',
  },
  {
    id: 'kstar',
    symbol: 'K_*',
    name: 'the fixed-point kernel',
    meaning:
      'The kernel value the recursion converges to, K_* = C_b + C_W g(K_*). The critical initialization is the one for which a nontrivial K_* exists.',
    ref: 'eq. (5.56)',
  },
  {
    id: 'four-point',
    symbol: 'G^{(4)} - \\big(G^{(2)}\\big)^2',
    name: 'the connected four-point correlator',
    meaning:
      'The excess of the fourth moment over the Gaussian prediction. It is the cumulant that measures interaction between neurons, and at criticality it grows like 2(ℓ−1)/n.',
    ref: 'eq. (3.28)',
    equationId: 'fluctuation-law',
  },
  {
    id: 'aspect-ratio',
    symbol: 'r = L/n',
    name: 'the depth-to-width ratio',
    meaning:
      'The emergent scale of the whole theory: the finite-width corrections grow like L/n, so the effective description is accurate exactly when the network is short and fat.',
    ref: 'eq. (0.19)',
  },
  {
    id: 'theta',
    symbol: '\\Theta',
    name: 'the neural tangent kernel',
    meaning:
      'Θ(x, x′) = Σ_θ ∂f(x)/∂θ · ∂f(x′)/∂θ: the Gram matrix of the parameter gradients. It is the Hamiltonian of gradient descent, and it is fixed by the initialization at infinite width.',
    ref: 'eq. (7.17)',
    equationId: 'ntk-definition',
  },
  {
    id: 'dntk',
    symbol: '\\frac{d\\Theta}{dt}',
    name: 'the differential of the NTK',
    meaning:
      'How the kernel moves during training. It is the object that makes representation learning possible: at infinite width it vanishes, and the features are frozen.',
    ref: '§11.1',
    equationId: 'dntk',
  },
  {
    id: 'eta',
    symbol: '\\eta',
    name: 'the learning rate',
    meaning:
      'The step size of the gradient update, θ ← θ − η ∇L. For a quadratic loss the stable range is η < 2/λ_max.',
    ref: 'eq. (7.8)',
    equationId: 'gradient-descent-stability',
  },
  {
    id: 'preactivation',
    symbol: 'z^{(\\ell)}',
    name: 'the preactivation',
    meaning:
      'The vector entering layer ℓ before the activation is applied: z^(ℓ) = W^(ℓ)h^(ℓ−1) + b^(ℓ).',
    ref: 'eq. (4.1)',
  },
  {
    id: 'gamma-p',
    symbol: '\\gamma_p',
    name: 'the Taylor coefficients',
    meaning:
      'σ(z) = Σ_p γ_p z^p / p!. The first few of them determine which universality class an activation belongs to: γ₀ = 0 and γ₁ ≠ 0 is the K = 0 class.',
    ref: 'eq. (5.80)',
  },
  {
    id: 'frozen',
    symbol: '\\Theta^{(\\ell)}',
    name: 'the frozen NTK',
    meaning:
      'The infinite-width limit of the kernel, which does not depend on the training data or the training algorithm. "Kernel learning" is the practice of training with it held fixed.',
    ref: 'eqs. (9.5)-(9.7)',
    equationId: 'ntk-recursion',
  },
];

export const TERM_BY_ID: Record<string, Term> = Object.fromEntries(TERMS.map((t) => [t.id, t]));

export function getTerm(id: string): Term | undefined {
  return TERM_BY_ID[id];
}
