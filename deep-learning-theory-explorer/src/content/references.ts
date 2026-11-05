/**
 * Source attribution.
 *
 * This project explains and experiments with material from:
 *
 *   Daniel A. Roberts, Sho Yaida, and Boris Hanin,
 *   "The Principles of Deep Learning Theory: An Effective Theory Approach to
 *    Understanding Neural Networks", Cambridge University Press (2022).
 *   arXiv:2106.10165  https://arxiv.org/abs/2106.10165
 *
 * All lesson prose, diagrams, code, datasets and figures in this app are original
 * work written for this project. Nothing is copied from the book: equations are
 * re-derived/transcribed as mathematical statements (factual content, not
 * protected expression), and the app cites the book by chapter, section and
 * equation number. See docs/LICENSING.md for the full statement.
 */

export const SOURCE = {
  shortTitle: 'The Principles of Deep Learning Theory',
  authors: 'D. A. Roberts, S. Yaida & B. Hanin',
  publisher: 'Cambridge University Press, 2022',
  arxiv: 'arXiv:2106.10165',
  url: 'https://arxiv.org/abs/2106.10165',
} as const;

export interface Citation {
  /** e.g. "§5.1" or "eq. (5.67)" */
  label: string;
  /** what the source supports */
  note: string;
}

export function cite(label: string, note: string): Citation {
  return { label, note };
}

/** Equation-level references used by the formula explorer and the laboratories. */
export const EQUATION_REFS = {
  forward: { label: 'eq. (4.1)', note: 'MLP layer iteration z^(l) = W^(l)h^(l-1) + b^(l)' },
  init: { label: 'eq. (4.2)', note: 'Gaussian initialization with variance C_W/n' },
  kernelRecursion: { label: 'eq. (5.1)', note: 'infinite-width kernel recursion' },
  firstLayerKernel: { label: 'eq. (5.2)', note: 'initial condition K^(1)' },
  gHelper: { label: 'eq. (5.5)/(5.49)', note: 'helper function g(K)' },
  chiParallel: { label: 'eq. (5.50)', note: 'parallel susceptibility' },
  chiPerp: { label: 'eq. (5.51)', note: 'perpendicular susceptibility' },
  hHelper: { label: 'eq. (5.52)', note: 'h(K), the [2]-component driver' },
  criticality: { label: 'eq. (5.55)', note: 'χ∥ = 1 and χ⊥ = 1' },
  scaleInvariant: { label: 'eqs. (5.60)-(5.67)', note: 'scale-invariant class and Kaiming initialization' },
  secondCondition: { label: 'eq. (5.73)', note: 'numerical criticality condition' },
  sigmoidFailure: { label: '§5.3.2', note: 'sigmoid and softplus cannot be tuned to criticality' },
  monomials: { label: 'eq. (5.78)', note: 'nonlinear monomials obstruct criticality' },
  kzeroClass: { label: 'eqs. (5.89)-(5.90)', note: 'K = 0 universality class' },
  powerLaw: { label: 'eq. (5.92)', note: 'kernel power-law decay 1/((-a₁)ℓ)' },
  halfStable: { label: '§5.3.4', note: 'SWISH/GELU half-stable universality class' },
  aspectRatio: { label: '§5.4', note: 'depth-to-width ratio as the cutoff of the effective theory' },
  linearFluctuation: { label: 'eq. (3.28)', note: 'G⁽⁴⁾ - (G⁽²⁾)² = 2(ℓ-1)/n (G⁽²⁾)²' },
  fluctuationVariance: { label: 'eq. (3.33)', note: 'Var[O^(ℓ)] grows linearly with depth at criticality' },
  ntkDefinition: { label: 'eq. (7.17)', note: 'neural tangent kernel' },
  ntkDynamics: { label: 'eqs. (7.19)-(7.20)', note: 'observable evolution under a GD update' },
  ntkRecursion: { label: 'eqs. (9.5)-(9.7)', note: 'frozen NTK recursion and its initial condition' },
  lrScaling: { label: 'eqs. (8.6)-(8.7)', note: 'learning-rate tensor scaled by 1/n per layer' },
  kernelLearning: { label: '§10.2', note: 'kernel learning: GD as kernel regression at infinite width' },
  noRepLearning: { label: '§6.3.3, §10.1.2', note: 'absence of representation learning at infinite width' },
  repLearning: { label: '§6.4.3, §11', note: 'representation learning as a finite-width effect' },
  dntk: { label: '§11.1', note: 'differential of the NTK' },
  bayes: { label: '§6.2', note: 'Bayesian model fitting and model comparison' },
  nearlyGaussian: { label: '§1.3', note: 'nearly-Gaussian distributions and connected correlators' },
} as const;

export const NOTATION_GLOSSARY: Array<{ symbol: string; name: string; meaning: string }> = [
  { symbol: 'n_l', name: 'layer width', meaning: 'number of neurons in layer l (n₀ is the input dimension)' },
  { symbol: 'L', name: 'depth', meaning: 'number of layers, including the output layer' },
  { symbol: 'C_W', name: 'rescaled weight variance', meaning: 'Var(W_ij^(l)) = C_W / n_{l-1}' },
  { symbol: 'C_b', name: 'bias variance', meaning: 'Var(b_i^(l)) = C_b' },
  { symbol: 'z^(l)', name: 'preactivation', meaning: 'the vector before the activation in layer l' },
  { symbol: 'K^(l)', name: 'kernel', meaning: 'infinite-width mean of the preactivation inner product; the two-point correlator G^(l)' },
  { symbol: 'g(K)', name: 'single-input expectation', meaning: 'E[σ(z)²] for z ~ N(0,K)' },
  { symbol: 'χ∥', name: 'parallel susceptibility', meaning: 'C_W g′(K): growth of magnitude perturbations' },
  { symbol: 'χ⊥', name: 'perpendicular susceptibility', meaning: 'C_W E[σ′(z)²]_K: growth of angular perturbations' },
  { symbol: 'a₁', name: 'quartic coupling', meaning: 'O(K²) coefficient of g(K); controls the K = 0 fixed-point stability' },
  { symbol: 'Θ', name: 'neural tangent kernel', meaning: 'sum of parameter-gradient inner products, governing GD dynamics' },
  { symbol: 'η', name: 'learning rate', meaning: 'step size of the gradient update' },
  { symbol: 'ℓ', name: 'layer index', meaning: 'used interchangeably with l for the layer position' },
];
