/**
 * Activation functions, annotated with the classification used in Chapter 5 of
 * Roberts, Yaida & Hanin, "The Principles of Deep Learning Theory" (arXiv:2106.10165).
 *
 * The book's criticality analysis depends on which universality class an activation
 * belongs to:
 *
 *  - Scale-invariant: sigma(lambda z) = lambda sigma(z) for lambda > 0, i.e.
 *      sigma(z) = a_+ z for z >= 0, a_- z for z < 0. Then g(K) = A^2 K with
 *      A^2 = (a_+^2 + a_-^2)/2, giving a constant parallel susceptibility
 *      chi_parallel = chi_perp = C_W A^2 and critical initialization
 *      (C_b, C_W) = (0, 1/A^2)   [book eq. (5.67)].
 *  - K = 0 class: smooth activations with sigma(0) = 0 and sigma'(0) != 0 (tanh, sin).
 *      Critical initialization is (C_b, C_W) = (0, 1/gamma_1^2) [eq. (5.90)] and the
 *      kernel decays by a power law K^(l) ~ 1/((-a_1) l) [eqs. (5.91)-(5.92)].
 *  - No criticality: sigmoid, softplus, nonlinear monomials... for which the
 *      criticality conditions cannot be satisfied by physical hyperparameters
 *      (Section 5.3.2). They are still available here so that students can *see*
 *      the failure rather than take it on faith.
 *  - Half-stable: SWISH/GELU-like activations whose non-trivial fixed point is
 *      unstable from one side (Section 5.3.4). The critical hyperparameters for
 *      these are found numerically by the criticality scanner.
 *
 * The Taylor coefficient notation gamma_p with sigma(z) = sum_p gamma_p z^p / p!
 * follows the book (eq. (5.80)).
 */

export type ActivationId =
  | 'linear'
  | 'relu'
  | 'leakyRelu'
  | 'tanh'
  | 'sin'
  | 'quadratic'
  | 'sigmoid'
  | 'softplus'
  | 'gelu'
  | 'swish';

export type UniversalityClass = 'scale-invariant' | 'K=0' | 'none' | 'half-stable';

export interface ActivationSpec {
  id: ActivationId;
  label: string;
  latex: string;
  f: (z: number) => number;
  df: (z: number) => number;
  d2f: (z: number) => number;
  universality: UniversalityClass;
  /** A^2 = (a_+^2 + a_-^2)/2 for scale-invariant activations */
  scaleInvariantA2?: number;
  /** gamma_1 = sigma'(0) for the K = 0 class */
  gamma1?: number;
  /** a_1, the O(K^2) coefficient of g(K) for the K = 0 class (book eq. (5.86)) */
  a1?: number;
  /** analytic critical hyperparameters when known in closed form */
  critical?: { Cw: number; Cb: number } | null;
  /** short statement of why the function is (or is not) tunable to criticality */
  criticalityNote: string;
  /** section(s) of the book where this activation is discussed */
  refs: string[];
}

const SQRT_2_OVER_PI = Math.sqrt(2 / Math.PI);

/** numerically safe softplus */
const softplus = (z: number) => (z > 30 ? z : Math.log1p(Math.exp(z)));
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

export const ACTIVATIONS: Record<ActivationId, ActivationSpec> = {
  linear: {
    id: 'linear',
    label: 'Linear',
    latex: '\\sigma(z)=z',
    f: (z) => z,
    df: () => 1,
    d2f: () => 0,
    universality: 'scale-invariant',
    scaleInvariantA2: 1,
    critical: { Cw: 1, Cb: 0 },
    criticalityNote:
      'A^2 = 1, so the critical weight variance is C_W = 1. Deep linear networks are the exactly solvable warm-up of Chapter 3.',
    refs: ['§2.2', '§3.2', 'eq. (5.67)'],
  },
  relu: {
    id: 'relu',
    label: 'ReLU',
    latex: '\\sigma(z)=\\max(0,z)',
    f: (z) => (z > 0 ? z : 0),
    df: (z) => (z > 0 ? 1 : 0),
    d2f: () => 0,
    universality: 'scale-invariant',
    scaleInvariantA2: 0.5,
    critical: { Cw: 2, Cb: 0 },
    criticalityNote:
      'A^2 = (1^2 + 0^2)/2 = 1/2, so criticality requires C_W = 2: this is the familiar He/Kaiming initialization, derived here from criticality [eq. (5.67)].',
    refs: ['§2.2', '§5.2', 'eq. (5.67)'],
  },
  leakyRelu: {
    id: 'leakyRelu',
    label: 'Leaky ReLU (0.1)',
    latex: '\\sigma(z)=\\max(z,0.1z)',
    f: (z) => (z > 0 ? z : 0.1 * z),
    df: (z) => (z > 0 ? 1 : 0.1),
    d2f: () => 0,
    universality: 'scale-invariant',
    scaleInvariantA2: (1 + 0.01) / 2,
    critical: { Cw: 2 / 1.01, Cb: 0 },
    criticalityNote:
      'A^2 = (1 + 0.1^2)/2 = 0.505, so C_W^crit = 1/0.505 ≈ 1.980. The negative slope adds a second contribution to the variance.',
    refs: ['§2.2', '§5.2'],
  },
  tanh: {
    id: 'tanh',
    label: 'tanh',
    latex: '\\sigma(z)=\\tanh z',
    f: (z) => Math.tanh(z),
    df: (z) => 1 - Math.tanh(z) ** 2,
    d2f: (z) => -2 * Math.tanh(z) * (1 - Math.tanh(z) ** 2),
    universality: 'K=0',
    gamma1: 1,
    a1: -2,
    critical: { Cw: 1, Cb: 0 },
    criticalityNote:
      'K = 0 universality class: C_W^crit = 1/gamma_1^2 = 1 with C_b = 0, and the kernel decays as a power law K^(l) ≈ 1/((-a_1)(l-1) + 1/K^(1)) with a_1 = -2 [eqs. (5.90)-(5.94)].',
    refs: ['§5.3.1', '§5.3.3', 'eqs. (5.90)-(5.92)'],
  },
  sin: {
    id: 'sin',
    label: 'sin',
    latex: '\\sigma(z)=\\sin z',
    f: (z) => Math.sin(z),
    df: (z) => Math.cos(z),
    d2f: (z) => -Math.sin(z),
    universality: 'K=0',
    gamma1: 1,
    a1: -1,
    critical: { Cw: 1, Cb: 0 },
    criticalityNote:
      'Another K = 0 class member (sin(0) = 0, sin\'(0) = 1) with a_1 = -1. Universal exponent p = 1 but a different coefficient: K^(l) ≈ 1/((l-1) + 1/K^(1)).',
    refs: ['§5.3.3', 'eq. (5.92)'],
  },
  quadratic: {
    id: 'quadratic',
    label: 'Quadratic',
    latex: '\\sigma(z)=z^2',
    f: (z) => z * z,
    df: (z) => 2 * z,
    d2f: () => 2,
    universality: 'none',
    critical: null,
    criticalityNote:
      'Nonlinear monomials cannot be tuned to criticality: for sigma(z) = z^p, condition (5.73) reduces to p/(2p-1) = 1, which is met only at p = 1 — the linear case [eq. (5.78)]. The scanner computes the ratio as 2/3 for this activation, and it does not depend on K, so there is no root to find. The vanishing slope sigma\'(0) = 0 also puts it outside the K = 0 class, which needs an activation that vanishes at the origin with a nonzero slope [eq. (5.89)].',
    refs: ['§5.3.2', 'eqs. (5.77)-(5.78)', 'eq. (5.89)'],
  },
  sigmoid: {
    id: 'sigmoid',
    label: 'Sigmoid',
    latex: '\\sigma(z)=1/(1+e^{-z})',
    f: sigmoid,
    df: (z) => {
      const s = sigmoid(z);
      return s * (1 - s);
    },
    d2f: (z) => {
      const s = sigmoid(z);
      return s * (1 - s) * (1 - 2 * s);
    },
    universality: 'none',
    critical: null,
    criticalityNote:
      'Equation (5.73) holds only at K* = 0, where eq. (5.72) gives C_b = -sigma(0)^2/sigma\'(0)^2 < 0: an unphysical (negative) bias variance. The scanner finds that one root and computes C_b = -4 for it, from sigma(0) = 1/2 and sigma\'(0) = 1/4. The sigmoid cannot be tuned to criticality [§5.3.2].',
    refs: ['§5.3.2', 'Figure 5.2'],
  },
  softplus: {
    id: 'softplus',
    label: 'Softplus',
    latex: '\\sigma(z)=\\log(1+e^{z})',
    f: softplus,
    df: sigmoid,
    d2f: (z) => {
      const s = sigmoid(z);
      return s * (1 - s);
    },
    universality: 'none',
    critical: null,
    criticalityNote:
      'The perpendicular criticality condition (5.73) is never satisfied for K* >= 0, so no nontrivial fixed point exists — unlike its sharp cousin the ReLU [§5.3.2]. The scanner finds no root at all: the ratio is computed as 0.59 at K = 0 and 0.76 at K = 6, rising toward unity and reaching it nowhere in between.',
    refs: ['§5.3.2', 'eq. (5.75)', 'Figure 5.2'],
  },
  gelu: {
    id: 'gelu',
    label: 'GELU',
    latex: '\\sigma(z)=z\\,\\Phi(z)',
    f: (z) => 0.5 * z * (1 + erf(z / Math.SQRT2)),
    df: (z) => 0.5 * (1 + erf(z / Math.SQRT2)) + (z * Math.exp(-0.5 * z * z)) / Math.sqrt(2 * Math.PI),
    d2f: (z) => {
      const phi = Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
      return 2 * phi - z * z * phi;
    },
    universality: 'half-stable',
    critical: null,
    criticalityNote:
      'Half-stable class: a nontrivial fixed point exists but the kernel is repelled from K* = 0. Use the criticality scanner to find (C_b, C_W) numerically [§5.3.4].',
    refs: ['§5.3.4'],
  },
  swish: {
    id: 'swish',
    label: 'SiLU / SWISH',
    latex: '\\sigma(z)=z/(1+e^{-z})',
    f: (z) => z * sigmoid(z),
    df: (z) => {
      const s = sigmoid(z);
      return s + z * s * (1 - s);
    },
    d2f: (z) => {
      const s = sigmoid(z);
      return 2 * s * (1 - s) + z * s * (1 - s) * (1 - 2 * s);
    },
    universality: 'half-stable',
    critical: null,
    criticalityNote:
      'Half-stable class, like GELU: the criticality conditions are satisfied at a nonzero K*, but the K* = 0 fixed point is unstable [§5.3.4].',
    refs: ['§5.3.4'],
  },
};

/** Abramowitz & Stegun 7.1.26 erf approximation (|error| < 1.5e-7). */
export function erf(x: number): number {
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return sign * y;
}

export function getActivation(id: ActivationId): ActivationSpec {
  const a = ACTIVATIONS[id];
  if (!a) throw new Error(`unknown activation "${id}"`);
  return a;
}

export const ACTIVATION_IDS = Object.keys(ACTIVATIONS) as ActivationId[];

/** Numerical gamma_1 = sigma'(0) and a_1 coefficient of the K = 0 expansion. */
export function taylorCoefficients(a: ActivationSpec): { gamma1: number; gamma2: number; gamma3: number } {
  const h = 1e-4;
  const gamma1 = a.df(0);
  const gamma2 = a.d2f(0);
  // sigma'''(0) by central difference of the second derivative
  const gamma3 = (a.d2f(h) - a.d2f(-h)) / (2 * h);
  return { gamma1, gamma2, gamma3 };
}

export { SQRT_2_OVER_PI };
