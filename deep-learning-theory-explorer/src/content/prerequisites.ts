import type { ExerciseKind } from './types';

/**
 * The prerequisite tools, and the drills that check them.
 *
 * The navigator at `/prerequisites` and Laboratory F read the same table, so a
 * tool cannot appear on one screen and not the other. The drills are the part
 * that can be *graded*: each one names a key in `src/lib/exercises.ts`, whose
 * answer the application computes when the learner checks, with the same
 * numerical code the laboratories run.
 *
 * A drill's value is deliberately small enough to be reached by hand — this is
 * a check on the toolkit, not on the theory. What the app adds is the right to
 * disagree: when the numbers differ, the method string says which computation
 * produced the app's value.
 */

export interface PrerequisiteTool {
  id: string;
  name: string;
  tex: string;
  usedFor: string;
  where: string;
  route: string;
  level: 'essential' | 'helpful' | 'later';
  selfCheck: string;
}

export const PREREQUISITE_TOOLS: PrerequisiteTool[] = [
  {
    id: 'gaussian',
    name: 'Gaussian integrals and Wick contraction',
    tex: '\\mathbb{E}[z^4] = 3K^2',
    usedFor:
      'Every layer expectation in the theory is a Gaussian integral, because at infinite width the preactivations are Gaussian.',
    where: 'Lesson 1, Equation explorer, every laboratory (quadrature)',
    route: '/lessons/non-gaussianity',
    level: 'essential',
    selfCheck:
      'Can you evaluate E[z²z′²] for jointly Gaussian (z, z′) with covariance K₁₁, K₁₂, K₂₂? Answer: K₁₁K₂₂ + 2K₁₂².',
  },
  {
    id: 'linear-algebra',
    name: 'Matrix calculus and eigenvalues',
    tex: '\\theta_{t+1} = \\theta_t - \\eta H\\theta_t',
    usedFor: 'Backpropagation, the NTK as a Gram matrix, and the stability condition for gradient descent.',
    where: 'Labs B and D, Lesson 9',
    route: '/labs/landscape',
    level: 'essential',
    selfCheck: 'Can you explain why gradient descent diverges when η > 2/λmax(H)? Each eigenmode decays as (1 − ηλᵢ)ᵗ.',
  },
  {
    id: 'probability',
    name: 'Random variables, ensembles, cumulants',
    tex: 'G^{(4)} - (G^{(2)})^2',
    usedFor: 'The deviation from Gaussianity is a cumulant; finite-width effects are its consequences.',
    where: 'Lesson 4, Lab C',
    route: '/lessons/fluctuations',
    level: 'essential',
    selfCheck:
      'Can you say what a *connected* correlator measures? It measures interaction: how much the parts of a system are not independent.',
  },
  {
    id: 'fixed-points',
    name: 'Fixed points and linear stability',
    tex: '\\chi(K_*) = C_W g\'(K_*), \\quad \\chi(K_*) = 1',
    usedFor: 'Criticality is a fixed-point stability statement: the susceptibility is the stability multiplier.',
    where: 'Lessons 3, 6, 7 and Lab A',
    route: '/lessons/criticality',
    level: 'essential',
    selfCheck:
      'Given a map K ↦ C_W g(K), what is the condition for a fixed point to be neutral rather than attracting or repelling?',
  },
  {
    id: 'power-law',
    name: 'Asymptotics and power laws',
    tex: 'K^{(\\ell)} \\sim \\frac{1}{(-a_1)\\ell}',
    usedFor: 'The K = 0 class (tanh, sin) decays as a power law rather than exponentially at criticality.',
    where: 'Lesson 7, Lab A',
    route: '/lessons/universality',
    level: 'helpful',
    selfCheck:
      'From the recursion K^(ℓ+1) = K^(ℓ) + a₁(K^(ℓ))², derive the large-ℓ behaviour by treating layer index as continuous time.',
  },
  {
    id: 'kernels',
    name: 'Kernels and Gaussian processes',
    tex: '\\mu_*(x) = K_*(x)^T (K + \\sigma_\\epsilon^2 I)^{-1} y',
    usedFor: 'Infinite-width networks are Gaussian processes; training at infinite width is kernel regression.',
    where: 'Lessons 8 and 9, Labs D and E',
    route: '/labs/ntk',
    level: 'helpful',
    selfCheck:
      'Why does a Gaussian-process posterior depend on the data only through the kernel? The prior covariance is fixed, and conditioning only rescales it.',
  },
  {
    id: 'renormalization',
    name: 'Renormalization-group thinking',
    tex: 'K^{(\\ell+1)} = \\mathcal{R}[K^{(\\ell)}]',
    usedFor: 'Layer-by-layer marginalisation is an RG flow; universality classes describe its deep behaviour.',
    where: 'Lesson 5',
    route: '/lessons/rg-flow',
    level: 'later',
    selfCheck:
      'Why do different activations with the same a₁ produce the same power law exponent but different coefficients? Universal exponents, non-universal amplitudes.',
  },
  {
    id: 'numerics',
    name: 'Numerical integration and differentiation',
    tex: '\\int f(z) e^{-z^2/(2K)} dz \\approx \\sum_i w_i f(z_i)',
    usedFor:
      'The app computes kernel expectations by Gauss–Hermite quadrature and validates gradients by central differences.',
    where: 'Every laboratory, tests/quadrature.test.ts',
    route: '/labs/physics',
    level: 'helpful',
    selfCheck:
      'Why cross-check two numerical methods instead of trusting one? Because agreement makes a coding error far less likely than a plausible-looking single number.',
  },
];

/**
 * One graded drill.
 *
 * `computed` is the key of the live answer, so the number a learner is asked
 * for is the number the application produces; `working` is the hand derivation
 * the drill is checking, shown only when the learner asks for it.
 */
export interface PrerequisiteDrill {
  id: string;
  /** the tool this exercises, a `PrerequisiteTool` id */
  tool: string;
  kind: ExerciseKind;
  prompt: string;
  /** the numbers the learner is handed */
  given: string;
  /** the hand derivation, shown on request */
  working: string;
  /** key in `src/lib/exercises.ts` */
  computed: string;
  /** the screen that measures the same quantity in earnest */
  route: string;
  label: string;
}

export const PREREQUISITE_DRILLS: PrerequisiteDrill[] = [
  {
    id: 'fourth-moment',
    tool: 'gaussian',
    kind: 'numerical',
    prompt: 'Evaluate the fourth moment of a Gaussian by Wick contraction.',
    given: 'z ~ N(0, K) with K = 2',
    working:
      'E[z⁴] pairs the four factors three ways, each pair giving K: 3K² = 3·4 = 12. The app computes the same number from the closed form.',
    computed: 'gaussian-fourth-moment',
    route: '/labs/initialization',
    label: 'the quadrature the laboratories run on',
  },
  {
    id: 'wick-two-point',
    tool: 'gaussian',
    kind: 'numerical',
    prompt: 'Contract a four-factor expectation of two correlated Gaussians.',
    given: '(z, z′) jointly Gaussian, K₁₁ = 2, K₂₂ = 3, K₁₂ = 0.5; find E[z²z′²].',
    working:
      'Three pairings: K₁₁K₂₂ + K₁₂K₁₂ + K₁₂K₁₂ = 6 + 0.5 = 6.5. This is the contraction behind every four-point kernel in the theory.',
    computed: 'quadratic-wick-kernel',
    route: '/labs/width-depth',
    label: 'the four-point kernel of Laboratory C',
  },
  {
    id: 'stability-threshold',
    tool: 'linear-algebra',
    kind: 'numerical',
    prompt: 'Find the largest learning rate for which plain gradient descent stays bounded.',
    given: 'H = [[3, 1], [1, 3]], update θ ← θ − ηHθ',
    working:
      'The eigenvalues of a 2×2 with equal diagonal d and off-diagonal o are d + o and d − o, so 4 and 2. Each mode decays as (1 − ηλ)ᵗ, which stays bounded when ηλ < 2, giving η_max = 2/4 = 0.5.',
    computed: 'eigen-stability-threshold',
    route: '/labs/landscape',
    label: 'the threshold Laboratory B sweeps across',
  },
  {
    id: 'linear-covariance-depth',
    tool: 'linear-algebra',
    kind: 'numerical',
    prompt: 'Propagate a two-point covariance through a deep linear network.',
    given: 'C_W = 0.9, G⁽¹⁾ = 1.5, depth ℓ = 40',
    working: 'G^(ℓ) = C_W^(ℓ−1) G⁽¹⁾, so 0.9³⁹ × 1.5. The exponent is ℓ−1 because layer 1 already carries G⁽¹⁾.',
    computed: 'linear-covariance-depth-40',
    route: '/labs/physics',
    label: 'the signal decay the physics laboratory shows',
  },
  {
    id: 'connected-correlator',
    tool: 'probability',
    kind: 'numerical',
    prompt: 'Compute the connected four-point correlator of a rectified standard normal.',
    given: 'z ~ N(0, 1), u = max(z, 0); report G⁽⁴⁾ − 3(G⁽²⁾)² with G⁽ⁿ⁾ = E[uⁿ]',
    working:
      'Half the mass is clipped to zero and the rest is symmetric, so G⁽⁴⁾ = E[z⁴]/2 = 1.5 and G⁽²⁾ = E[z²]/2 = 0.5, giving 1.5 − 3(0.5)² = 0.75. The same quantity for the Gaussian itself is zero: a nonzero connected correlator is the signature of an interaction, and here the nonlinearity is the interaction.',
    computed: 'connected-fourth-cumulant',
    route: '/labs/width-depth',
    label: 'the fluctuation Laboratory C measures',
  },
  {
    id: 'fluctuation-variance',
    tool: 'probability',
    kind: 'numerical',
    prompt: 'Read off the seed-to-seed variance of a layer observable at criticality.',
    given: 'depth ℓ = 20, width n = 256, G⁽²⁾ = 1',
    working: 'Var[O^(ℓ)] = 2ℓ(G⁽²⁾)²/n = 40/256 = 0.15625.',
    computed: 'fluctuation-variance-depth-20-width-256',
    route: '/labs/width-depth',
    label: 'the quantity Laboratory C sweeps',
  },
  {
    id: 'fluctuation-sd',
    tool: 'probability',
    kind: 'numerical',
    prompt: 'The same setting, as a standard deviation rather than a variance.',
    given: 'depth ℓ = 20, width n = 256, G⁽²⁾ = 1',
    working: 'sd = √0.15625 ≈ 0.3953. Taking the root is the step that turns the 1/n law into the relative spread.',
    computed: 'fluctuation-sd-depth-20-width-256',
    route: '/labs/width-depth',
    label: 'the relative spread of Laboratory C',
  },
  {
    id: 'relu-criticality',
    tool: 'fixed-points',
    kind: 'numerical',
    prompt: 'Locate the critical weight variance of the ReLU.',
    given: 'a₊ = 1, a₋ = 0; C_W^crit = 1/A² with A² = (a₊² + a₋²)/2',
    working: 'A² = 1/2, so C_W^crit = 2. The ReLU is critical at the same variance as the linear network, for a different reason.',
    computed: 'relu-critical-cw',
    route: '/labs/initialization',
    label: 'the point Laboratory A searches for',
  },
  {
    id: 'leaky-criticality',
    tool: 'fixed-points',
    kind: 'numerical',
    prompt: 'The critical variance of a leaky ReLU with slope 0.1 on the negative side.',
    given: 'a₊ = 1, a₋ = 0.1',
    working: 'A² = (1 + 0.01)/2 = 0.505, so C_W^crit = 1/0.505 ≈ 1.9802. The leak moves the fixed point, slightly.',
    computed: 'leaky-critical-cw',
    route: '/labs/initialization',
    label: 'a second point on the same scan',
  },
  {
    id: 'sigmoid-unphysical',
    tool: 'fixed-points',
    kind: 'numerical',
    prompt: 'The bias variance that would put the sigmoid at a K = 0 fixed point.',
    given: 'σ(z) = 1/(1 + e⁻ᶻ) at z = 0: C_b = −σ(0)²/σ′(0)²',
    working: 'σ(0) = 1/2 and σ′(0) = 1/4, so C_b = −(1/4)/(1/16) = −4. A variance cannot be negative: the fixed point is unphysical.',
    computed: 'sigmoid-unphysical-cb',
    route: '/labs/initialization',
    label: 'the activation Laboratory A rules out',
  },
  {
    id: 'power-law-tanh',
    tool: 'power-law',
    kind: 'numerical',
    prompt: 'Predict the kernel at layer 200 for a critical tanh network from the asymptotic law alone.',
    given: 'a₁ = −2 for tanh, K^(ℓ) ≈ 1/((−a₁)ℓ), ℓ = 200',
    working: '1/(2 × 200) = 0.0025. The exponent is universal; the coefficient −a₁ is not.',
    computed: 'tanh-power-law-layer-200',
    route: '/labs/initialization',
    label: 'the decay Laboratory A measures layer by layer',
  },
  {
    id: 'exact-recursion-tanh',
    tool: 'power-law',
    kind: 'numerical',
    prompt: 'The same 200 layers, iterated exactly rather than predicted asymptotically.',
    given: 'tanh, C_W = 1, C_b = 0, K^(1) = 1, 200 layers',
    working:
      'The exact recursion lands near the asymptotic prediction but not on it: the difference is the leading correction to the power law, which the closed form drops.',
    computed: 'tanh-exact-recursion-layer-200',
    route: '/labs/physics',
    label: 'the kernel flow of the physics laboratory',
  },
  {
    id: 'continuous-rg',
    tool: 'renormalization',
    kind: 'numerical',
    prompt: 'Integrate the flow equation dK/dℓ = a₁K² from layer 1 to layer 200.',
    given: 'a₁ = −2 for tanh, K^(1) = 1',
    working:
      'dK/K² = a₁dℓ integrates to −1/K = a₁ℓ + const, giving K(ℓ) = 1/((−a₁)(ℓ − 1) + 1/K^(1)). Continuum layer index is the RG time.',
    computed: 'tanh-power-law-continuous-layer-200',
    route: '/labs/physics',
    label: 'the continuous approximation the flow is compared with',
  },
  {
    id: 'gp-posterior-mean',
    tool: 'kernels',
    kind: 'numerical',
    prompt: 'Condition a Gaussian process on one observation and predict at a new point.',
    given: 'RBF kernel ℓ = 0.5, σ_f² = 1, σ_n² = 0.05; data (0, 1); query x = 0.5',
    working:
      'With one training point, μ(x) = k(x, 0)/(k(0, 0) + σ_n²). k(0.5, 0) = exp(−0.25/0.5) = e^(−1/2) and k(0, 0) = 1, so μ = 0.6065/1.05 ≈ 0.5777.',
    computed: 'gp-single-observation-posterior-mean',
    route: '/labs/ntk',
    label: 'the kernel regression Laboratory D is the limit of',
  },
  {
    id: 'ntk-width-scaling',
    tool: 'kernels',
    kind: 'numerical',
    prompt: 'By what factor does the trace of the two-layer NTK grow when the hidden width goes from 128 to 512?',
    given: 'tanh, six inputs of dimension four, C_W = 1, C_b = 0',
    working:
      'The NTK is O(1) in width by construction — the rescaling C_W = 2/n is what buys that. The ratio is the finite-width residual, not the leading term.',
    computed: 'ntk-trace-ratio-quadrupled-width',
    route: '/labs/ntk',
    label: 'the width scaling Laboratory D measures',
  },
  {
    id: 'quadrature-versus-wick',
    tool: 'numerics',
    kind: 'numerical',
    prompt: 'Evaluate E[z⁴] for z ~ N(0, 2) with the 12-node Gauss–Hermite rule.',
    given: '12 quadrature nodes, K = 2',
    working:
      'Gauss–Hermite with n nodes is exact for polynomials of degree 2n − 1, and 4 ≤ 23, so the rule must return the Wick value 12 exactly. If it did not, the bug would be in the rule.',
    computed: 'gauss-hermite-fourth-moment-twelve-nodes',
    route: '/labs/initialization',
    label: 'the rule every kernel expectation in this app goes through',
  },
  {
    id: 'scanner-versus-closed-form',
    tool: 'numerics',
    kind: 'numerical',
    prompt: 'The ReLU critical variance found by scanning the numerical criticality condition instead of by the closed form.',
    given: 'chirp-free scan of χ(K) over K ∈ [0, 6] with 900 points',
    working:
      'The closed form says 2. The scanner should agree to within the resolution of its grid — the gap between the two is the numerical error, and it is the reason the laboratories quote both.',
    computed: 'relu-critical-cw-scanned',
    route: '/labs/initialization',
    label: 'the scan Laboratory A performs',
  },
];

/** The drills grouped by the tool they check, in the order the navigator lists them. */
export function drillsForTool(toolId: string): PrerequisiteDrill[] {
  return PREREQUISITE_DRILLS.filter((d) => d.tool === toolId);
}
