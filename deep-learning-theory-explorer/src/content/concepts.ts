/**
 * The Theory Atlas.
 *
 * A systematic compilation of the ideas the monograph is built from, organised by
 * the principles the authors themselves name in their overview of the work
 * (Roberts & Yaida, "Effective Theory of Deep Neural Networks", IPI 2021):
 *
 *   - the Principle of Sparsity, for *wide* networks;
 *   - the Principle of Criticality, for *deep* networks;
 *   - the Principle of (Layer) Equivalence;
 *   - the Principle of Typicality;
 *   - the Principle of Universality.
 *
 * Every entry says what the idea is, where the book states it, what this
 * application does about it, and — honestly — whether that is a computation or
 * only an explanation. The status field is the point: a reader should never have
 * to guess which claims on this site were measured.
 */

export type PrincipleId = 'sparsity' | 'criticality' | 'equivalence' | 'typicality' | 'universality' | 'beyond';

export interface Principle {
  id: PrincipleId;
  name: string;
  /** what the principle is about */
  scope: string;
  /** one sentence */
  statement: string;
  /** the book sections that develop it */
  ref: string;
}

export const PRINCIPLES: Principle[] = [
  {
    id: 'sparsity',
    name: 'The Principle of Sparsity',
    scope: 'wide networks',
    statement:
      'At infinite width the many neurons of a layer are effectively independent, so the layer statistics are Gaussian and the training dynamics are linear.',
    ref: '§§0.2, 4, 6.3, 10.4',
  },
  {
    id: 'criticality',
    name: 'The Principle of Criticality',
    scope: 'deep networks',
    statement:
      'The initialization hyperparameters must be tuned so that the signal neither explodes nor vanishes with depth; the tuning is what makes the network trainable.',
    ref: '§§3.2, 5, 9.1, 9.4',
  },
  {
    id: 'equivalence',
    name: 'The Principle of (Layer) Equivalence',
    scope: 'the method',
    statement:
      'The way to study a network is to analyse its statistics layer by layer and ask what happens typically, rather than tracking a single realisation.',
    ref: '§§0.2, 3, 5',
  },
  {
    id: 'typicality',
    name: 'The Principle of Typicality',
    scope: 'finite width',
    statement:
      'The trained-network distribution is described by its typical behaviour, with finite-width corrections organised as an expansion in 1/n.',
    ref: '§§0.2, 3.3, 5.4',
  },
  {
    id: 'universality',
    name: 'The Principle of Universality',
    scope: 'across activations',
    statement:
      'Activations that share a universality class behave the same way in the deep limit, so a handful of classes replace a catalogue of functions.',
    ref: '§§5.2, 5.3, 11.4',
  },
  {
    id: 'beyond',
    name: 'Beyond the monograph',
    scope: 'the current literature',
    statement:
      'What the monograph established is the starting point, not the end: the lazy regime, the parameterisations and the feature-learning picture have all moved since.',
    ref: 'see the individual entries',
  },
];

export type ConceptStatus = 'computed' | 'cited';

export type ConceptKind =
  | 'recursion'
  | 'condition'
  | 'scaling'
  | 'phenomenon'
  | 'tool'
  | 'limit'
  | 'object'
  | 'principle';

export interface Concept {
  id: string;
  name: string;
  /** the claim, in one sentence, in the reader's terms */
  statement: string;
  /** the defining equation, when there is a single one */
  tex?: string;
  /** the book reference */
  ref: string;
  /** a link, when the reference points at something outside the monograph */
  url?: string;
  principle: PrincipleId;
  kind: ConceptKind;
  /**
   * `computed` — this application measures or derives it, and the reader can
   * see the number. `cited` — it is explained with a reference, and the
   * application does not simulate it.
   */
  status: ConceptStatus;
  /** what this application does about it */
  implemented: string;
  /** where to see it */
  see: Array<{ label: string; to: string }>;
}

const LESSON = (id: string, label: string): { label: string; to: string } => ({ label, to: `/lessons/${id}` });
const FIG = (id: string, label: string): { label: string; to: string } => ({ label, to: `/lessons/${id}` });
const LAB = (id: string, label: string): { label: string; to: string } => ({ label, to: `/labs/${id}` });
const EQ = (id: string, label: string): { label: string; to: string } => ({ label, to: `/equations?eq=${id}` });

export const CONCEPTS: Concept[] = [
  /* ---------------------------------------------------------------- */
  /* The Principle of Sparsity                                          */
  /* ---------------------------------------------------------------- */
  {
    id: 'infinite-width',
    name: 'The infinite-width limit',
    statement:
      'As the width grows, a network becomes a Gaussian process over functions: every finite collection of outputs is jointly Gaussian, and the whole description collapses to the kernel.',
    tex: 'K^{(\\ell)}_{12} = C_W^{\\ell} G^{(0)}_{12}',
    ref: '§§0.2, 6.3, 10.4.3',
    principle: 'sparsity',
    kind: 'limit',
    status: 'computed',
    implemented:
      'The deep-linear recursion is evaluated exactly, and the Gaussian-process posterior of the infinite-width limit is computed in closed form.',
    see: [FIG('linear-criticality', 'the deep linear recursion'), LAB('ntk', 'the NTK laboratory'), LESSON('bayesian', 'the Gaussian process')],
  },
  {
    id: 'sparsity',
    name: 'The Principle of Sparsity',
    statement:
      'Inside a layer, the neurons become uncorrelated as the width grows, because each neuron sees a sum of many weakly correlated signals. That is why the layer statistics are tractable at all.',
    ref: '§§0.2, 4',
    principle: 'sparsity',
    kind: 'principle',
    status: 'cited',
    implemented:
      'The principle is used throughout the theory modules but is not itself simulated: the laboratory measures the *failure* of it, which is the interesting observable.',
    see: [LESSON('random-functions', 'why the rescaling is the right one'), LAB('width-depth', 'the finite-width corrections')],
  },
  {
    id: 'preactivation-recursion',
    name: 'The preactivation recursion',
    statement: 'The network is a stack of affine maps interleaved with the activation, and everything else is a statement about the statistics of that iteration.',
    tex: 'z^{(\\ell)} = W^{(\\ell)} h^{(\\ell-1)} + b^{(\\ell)}, \\qquad h^{(\\ell)} = \\sigma(z^{(\\ell)})',
    ref: 'eq. (4.1)',
    principle: 'sparsity',
    kind: 'recursion',
    status: 'computed',
    implemented: 'Every laboratory in the application is an instance of this recursion, run on real weights.',
    see: [LAB('physics', 'the physics laboratory'), FIG('random-functions', 'the helper function g(K)')],
  },
  {
    id: 'initialization',
    name: 'The initialization distribution',
    statement:
      'The weights are drawn from a Gaussian with variance C_W divided by the fan-in, and the biases from a Gaussian of variance C_b. The 1/n is what makes the width limit meaningful.',
    tex: 'W^{(\\ell)}_{ij} \\sim \\mathcal{N}\\!\\left(0, \\frac{C_W}{n_{\\ell-1}}\\right)',
    ref: 'eq. (4.2)',
    principle: 'sparsity',
    kind: 'object',
    status: 'computed',
    implemented:
      'The seeded Gaussian and the matched-variance uniform alternative are both implemented, and the alternative exists so that the reader can check that the results depend on the variance, not on Gaussianity.',
    see: [LAB('physics', 'the shared setup'), LAB('initialization', 'Laboratory A')],
  },
  {
    id: 'kernel-recursion',
    name: 'The kernel recursion',
    statement:
      'The mean squared preactivation obeys a recursion that depends on the activation only through one scalar function, g(K).',
    tex: 'K^{(\\ell+1)} = C_b + C_W\\, g\\!\\left(K^{(\\ell)}\\right), \\qquad g(K) = \\mathbb{E}[\\sigma(z)^2]_{z\\sim\\mathcal{N}(0,K)}',
    ref: 'eqs. (5.1), (5.49)',
    principle: 'sparsity',
    kind: 'recursion',
    status: 'computed',
    implemented:
      'The recursion is evaluated by Gauss-Hermite quadrature and is the reference curve against which every measurement in the application is compared.',
    see: [FIG('criticality', 'the kernel profile'), LAB('physics', 'the physics laboratory'), EQ('linear-covariance', 'the recursion')],
  },
  {
    id: 'nearly-gaussian',
    name: 'Nearly-Gaussian distributions',
    statement:
      'At finite width the preactivation distribution is only approximately Gaussian, and the deviation is measured by a cumulant rather than by a picture.',
    ref: '§1.3',
    principle: 'sparsity',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'The connected four-point correlator is measured as a function of depth and width, and the law it follows is checked.',
    see: [FIG('non-gaussianity', 'the connected four-point correlator'), LESSON('non-gaussianity', 'lesson 1')],
  },
  {
    id: 'four-point',
    name: 'The connected four-point correlator',
    statement:
      'The excess of the fourth moment over the Gaussian prediction measures interaction between neurons: it is the cumulant that the whole finite-width expansion is built on.',
    tex: 'G^{(4)} - \\big(G^{(2)}\\big)^2 = \\frac{2(\\ell-1)}{n}\\big(G^{(2)}\\big)^2 + O\\!\\left(\\frac{1}{n^2}\\right)',
    ref: 'eq. (3.28)',
    principle: 'typicality',
    kind: 'object',
    status: 'computed',
    implemented:
      'Measured over 400 seeded linear networks at several depths and compared with the analytic line, to a few per cent.',
    see: [FIG('non-gaussianity', 'the connected four-point correlator'), LAB('width-depth', 'Laboratory C')],
  },
  {
    id: 'intra-layer',
    name: 'Intra-layer correlations',
    statement:
      'At finite width the neurons of a layer are correlated, and the strength of that correlation grows with depth. It is the same object as the connected four-point correlator, read differently.',
    ref: '§3.3',
    principle: 'typicality',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'Not measured directly: the laboratory measures the variance of the layer observable, which the book shows is the same information.',
    see: [LESSON('fluctuations', 'lesson 4')],
  },
  {
    id: 'non-gaussianity-accumulation',
    name: 'Accumulation of non-Gaussianity',
    statement:
      'Each layer adds a little non-Gaussianity, so the distribution at layer ℓ is the result of ℓ small departures from Gaussianity — which is why the depth matters.',
    ref: '§§4.2, 4.3',
    principle: 'sparsity',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'The magnitude of the departure is measured through the four-point correlator; the accumulation itself is described rather than simulated.',
    see: [FIG('non-gaussianity', 'the connected four-point correlator')],
  },
  {
    id: 'dntk',
    name: 'The differential of the NTK',
    statement:
      'How fast the kernel moves during training. At infinite width it is zero, and the representation cannot change; at finite width it is not, and the representation does change.',
    tex: '\\frac{d\\Theta}{dt} \\neq 0',
    ref: '§11.1',
    principle: 'typicality',
    kind: 'object',
    status: 'computed',
    implemented:
      'The drift of the empirical NTK is measured during a real training run, at three widths, and compared with the movement of the hidden features.',
    see: [LAB('ntk', 'the defrosting panel'), FIG('representation-learning', 'the feature drift'), LESSON('representation-learning', 'lesson 10')],
  },
  {
    id: 'hebbian',
    name: 'Hebbian learning at finite width',
    statement:
      'At finite width the neurons of a layer wire themselves together during training: the correlations that were absent at initialization grow.',
    ref: '§6.4.1',
    principle: 'typicality',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'Not simulated: it needs the 1/n corrections of the whole effective theory. The application measures the *consequence* — the features move — and says so.',
    see: [LESSON('bayesian', 'the finite-width story'), FIG('representation-learning', 'the feature drift')],
  },

  /* ---------------------------------------------------------------- */
  /* The Principle of Criticality                                        */
  /* ---------------------------------------------------------------- */
  {
    id: 'criticality',
    name: 'Criticality',
    statement:
      'There is one value of the weight variance at which the signal neither grows nor dies with depth. Finding it is not a heuristic: it is forced by the theory.',
    tex: 'C_W^{\\mathrm{crit}} = \\frac{1}{A^2} \\quad\\text{(scale-invariant)}, \\qquad C_W^{\\mathrm{crit}} = \\frac{1}{\\gamma_1^2} \\quad\\text{(}K=0\\text{)}',
    ref: '§§3.2, 5.2, 5.3',
    principle: 'criticality',
    kind: 'condition',
    status: 'computed',
    implemented:
      'The criticality scanner solves the two susceptibility conditions numerically for every activation in the registry, and the closed form and the scanner are checked against each other.',
    see: [LAB('initialization', 'the criticality scanner'), FIG('criticality', 'the kernel profile')],
  },
  {
    id: 'exploding-vanishing',
    name: 'The exploding and vanishing problem',
    statement:
      'Off criticality the kernel grows or decays exponentially with depth, and with it the gradients. This is the single most practical obstruction to training deep networks.',
    ref: '§§3.2, 5.1, 9.4',
    principle: 'criticality',
    kind: 'phenomenon',
    status: 'computed',
    implemented:
      'The measured layer kernel and the backpropagated gradient are both plotted on log axes, so the exponential behaviour is a straight line and the critical case is a flat one.',
    see: [LAB('physics', 'the physics laboratory'), FIG('criticality', 'the kernel profile')],
  },
  {
    id: 'chi-parallel',
    name: 'The parallel susceptibility',
    statement:
      'How fast a change in the *magnitude* of a layer’s preactivations grows with depth. It is the stability multiplier of the kernel recursion.',
    tex: '\\chi_{\\parallel}(K) = C_W g\'(K)',
    ref: 'eq. (5.50)',
    principle: 'criticality',
    kind: 'object',
    status: 'computed',
    implemented:
      'Evaluated by quadrature for any activation and any K, and plotted against K in the lesson figure.',
    see: [FIG('universality', 'the two susceptibilities'), EQ('chi-parallel', 'the derivation')],
  },
  {
    id: 'chi-perp',
    name: 'The perpendicular susceptibility',
    statement:
      'How fast a change in the *direction* of a layer’s preactivations grows with depth. It is the susceptibility behind the vanishing-gradient problem.',
    tex: '\\chi_{\\perp}(K) = C_W\\, \\mathbb{E}[\\sigma\'(z)^2]_K',
    ref: 'eq. (5.51)',
    principle: 'criticality',
    kind: 'object',
    status: 'computed',
    implemented:
      'Evaluated by quadrature and plotted against K; the lesson makes the point that it is the expectation of the square of the derivative, not its variance.',
    see: [FIG('universality', 'the two susceptibilities'), EQ('chi-perp', 'the derivation')],
  },
  {
    id: 'criticality-conditions',
    name: 'The two criticality conditions',
    statement:
      'A network is critical when both susceptibilities are exactly one at the fixed point. They are two conditions because a perturbation can be in size or in direction.',
    tex: '\\chi_{\\parallel}(K_\\infty) = 1, \\qquad \\chi_{\\perp}(K_\\infty) = 1',
    ref: 'eq. (5.55)',
    principle: 'criticality',
    kind: 'condition',
    status: 'computed',
    implemented:
      'The conditions are solved numerically; the figure shows the two curves and the line χ = 1 that a critical activation must cross at the same K.',
    see: [FIG('universality', 'the two susceptibilities'), LAB('initialization', 'the criticality scanner')],
  },
  {
    id: 'scale-invariant',
    name: 'The scale-invariant universality class',
    statement:
      'Activations that are piecewise linear through the origin — ReLU and its relatives — share one number, A², and therefore one critical weight variance.',
    tex: '\\sigma(z) = a_+ z \\ (z\\ge 0), \\quad a_- z \\ (z<0), \\qquad A^2 = \\frac{a_+^2 + a_-^2}{2}',
    ref: '§5.2, eqs. (5.60)–(5.67)',
    principle: 'universality',
    kind: 'phenomenon',
    status: 'computed',
    implemented:
      'The constant A² is computed for each activation in the registry, and the critical C_W = 1/A² follows — which is how Kaiming initialisation is derived rather than quoted.',
    see: [FIG('criticality', 'the kernel profile'), LAB('initialization', 'Laboratory A')],
  },
  {
    id: 'kzero-class',
    name: 'The K = 0 universality class',
    statement:
      'Smooth activations that vanish at the origin with a nonzero first derivative — tanh, sin — have a critical point at K = 0, and the kernel decays there by a power law rather than an exponential.',
    tex: 'K^{(\\ell)} \\sim \\frac{1}{(-a_1)(\\ell-1) + 1/K^{(1)}}, \\qquad a_1 = \\tfrac{3}{4}\\gamma_2^2 + \\gamma_1\\gamma_3',
    ref: '§5.3.3, eqs. (5.86), (5.90)–(5.92)',
    principle: 'universality',
    kind: 'phenomenon',
    status: 'computed',
    implemented:
      'The coefficient a₁ is computed from the activation’s Taylor coefficients, and the exact recursion is plotted against the asymptotic law.',
    see: [FIG('universality', 'the power law'), LAB('initialization', 'Laboratory A')],
  },
  {
    id: 'no-criticality',
    name: 'Activations that cannot be critical',
    statement:
      'Sigmoid, softplus and the nonlinear monomials have no critical initialization at all: for the sigmoid the conditions are met only where the bias variance would have to be negative, and for the softplus and the monomials they are never met at all.',
    tex: 'C_b = -\\frac{\\sigma(0)^2}{\\sigma\'(0)^2} < 0',
    ref: '§5.3.2',
    principle: 'universality',
    kind: 'phenomenon',
    status: 'computed',
    implemented:
      'The scanner reports what it finds for each activation: the sigmoid’s one root, flagged unphysical, with C_b = −4 computed rather than asserted; the softplus’s absence of any root; and the monomial obstruction, whose ratio p/(2p−1) equals one only for p = 1.',
    see: [LAB('initialization', 'the criticality scanner'), LESSON('universality', 'lesson 7')],
  },
  {
    id: 'half-stable',
    name: 'The half-stable class',
    statement:
      'GELU and SWISH have a nontrivial fixed point that is repelling from one side, so the kernel is driven towards it from one direction and away from it from the other.',
    ref: '§5.3.4',
    principle: 'universality',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'The scanner finds the nonzero root and reports its stability; the runaway behaviour is visible in the laboratory but is not characterised.',
    see: [LAB('initialization', 'the criticality scanner'), LESSON('universality', 'lesson 7')],
  },
  {
    id: 'universal-exponent',
    name: 'The universal exponent',
    statement:
      'Every activation in the K = 0 class decays with the same power of depth, p = 1. The exponent is universal; the coefficient is not.',
    tex: 'K^{(\\ell)} \\sim \\ell^{-p}, \\qquad p = 1',
    ref: '§5.3.3, eq. (5.92)',
    principle: 'universality',
    kind: 'phenomenon',
    status: 'computed',
    implemented:
      'tanh and sin are plotted together: the slopes agree and the offsets do not, which is exactly the statement.',
    see: [FIG('universality', 'the power law')],
  },
  {
    id: 'aspect-ratio',
    name: 'The depth-to-width ratio',
    statement:
      'The finite-width corrections grow linearly with depth and shrink inversely with width, so the only combination that matters is r = L/n. It is the small parameter of the whole theory.',
    tex: 'r \\equiv \\frac{L}{n}',
    ref: 'eq. (0.19), §5.4',
    principle: 'typicality',
    kind: 'scaling',
    status: 'computed',
    implemented:
      'The laboratory measures the variance at many (L, n) and the points collapse when plotted against L/n.',
    see: [LAB('width-depth', 'Laboratory C'), FIG('fluctuations', 'the fluctuation law')],
  },
  {
    id: 'ntk-criticality',
    name: 'Criticality for the NTK',
    statement:
      'The kernel that governs gradient descent has its own stability conditions, and they are not the same as the ones for the preactivations: the NTK is polynomial where the kernel is exponential.',
    ref: '§§9.1, 9.4',
    principle: 'criticality',
    kind: 'condition',
    status: 'cited',
    implemented:
      'The NTK’s spectrum is displayed and checked for positivity; the analysis of the depth axis is explained but not derived.',
    see: [LAB('ntk', 'Laboratory D'), LESSON('ntk', 'lesson 9')],
  },
  {
    id: 'lr-rescaling',
    name: 'Learning-rate rescaling by 1/n',
    statement:
      'The raw NTK sums one term per parameter, so it grows with the width unless the learning rate of each layer’s weights is scaled by 1/n. Every group of parameters then contributes equally.',
    tex: '\\eta^{(\\ell)} \\propto \\frac{1}{n_{\\ell-1}}',
    ref: '§§8.3, 9.4',
    principle: 'criticality',
    kind: 'tool',
    status: 'cited',
    implemented:
      'The width scaling of the measured NTK is plotted, and the laboratory shows the per-layer gradient norms that motivate the rescaling.',
    see: [LAB('ntk', 'the width scaling panel'), LESSON('ntk', 'lesson 9')],
  },
  {
    id: 'algorithm-independence',
    name: 'Algorithm independence',
    statement:
      'At infinite width, with the kernel held fixed, the trained function barely depends on which learning algorithm was used. The dependence enters only through the finite-width corrections.',
    ref: '§§10.2.2, 11.4',
    principle: 'typicality',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'Not simulated. The application runs three optimizers on the same objective so that the reader can see the *finite-width* differences, and labels them as such.',
    see: [LAB('landscape', 'the optimizer comparison'), LAB('representation', 'the optimizer choice')],
  },

  /* ---------------------------------------------------------------- */
  /* The Principle of (Layer) Equivalence and of Typicality            */
  /* ---------------------------------------------------------------- */
  {
    id: 'layer-equivalence',
    name: 'The Principle of (Layer) Equivalence',
    statement:
      'The network is analysed one layer at a time: each layer is a map whose statistics are determined by the statistics of the layer before it.',
    ref: '§§0.2, 3, 5',
    principle: 'equivalence',
    kind: 'principle',
    status: 'cited',
    implemented:
      'It is the structure of the application itself: the laboratories are organised around the recursion, not around architectures.',
    see: [LESSON('random-functions', 'the ensemble of functions')],
  },
  {
    id: 'typicality',
    name: 'The Principle of Typicality',
    statement:
      'What matters is not the fate of one realisation but the typical behaviour of the ensemble, with the corrections organised as an expansion in 1/n.',
    ref: '§§0.2, 3.3, 5.4',
    principle: 'typicality',
    kind: 'principle',
    status: 'cited',
    implemented:
      'Every measurement in the application is an ensemble measurement: the spread across seeds is reported, not hidden.',
    see: [LAB('physics', 'the seed spread'), LESSON('fluctuations', 'lesson 4')],
  },
  {
    id: 'one-over-n',
    name: 'The 1/n expansion',
    statement:
      'The trained-network distribution is described by the infinite-width result plus a series in 1/n. The first correction is enough to capture the qualitative phenomena.',
    tex: 'p(f^\\star) = p^{(0)}(f^\\star) + \\frac{p^{(1)}(f^\\star)}{n} + O\\!\\left(\\frac{1}{n^2}\\right)',
    ref: 'eq. (0.15), §0.2',
    principle: 'typicality',
    kind: 'scaling',
    status: 'cited',
    implemented:
      'The application measures the leading correction directly — the L/n scaling of the fluctuations — rather than deriving the full expansion.',
    see: [LAB('width-depth', 'Laboratory C'), LESSON('fluctuations', 'lesson 4')],
  },
  {
    id: 'chaos',
    name: 'Chaos in deep linear networks',
    statement:
      'A deep linear network is not chaotic for finite width, but the ratio of two consecutive layers fluctuates with a variance that grows with depth, until the width runs out.',
    ref: '§3.4',
    principle: 'typicality',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'Not simulated. The laboratory covers the two regimes the book distinguishes: the well-behaved one and the chaotic one.',
    see: [LAB('initialization', 'Laboratory A'), LESSON('linear-criticality', 'lesson 3')],
  },

  /* ---------------------------------------------------------------- */
  /* The Principle of Universality                                      */
  /* ---------------------------------------------------------------- */
  {
    id: 'rg-flow',
    name: 'The representation group flow',
    statement:
      'Marginalising one layer at a time turns the network into a flow of distributions. The same operation is applied at every layer, and that is the renormalization-group structure.',
    tex: 'K^{(\\ell+1)} = \\mathcal{R}\\!\\left[K^{(\\ell)}\\right]',
    ref: '§4, §4.6',
    principle: 'universality',
    kind: 'recursion',
    status: 'computed',
    implemented:
      'The recursion is iterated numerically and compared with the measurement; the non-Gaussian part of the flow is described rather than simulated.',
    see: [LESSON('rg-flow', 'lesson 5'), FIG('rg-flow', 'the recursion')],
  },
  {
    id: 'rg-flow-ntk',
    name: 'The RG flow of the NTK',
    statement:
      'The kernel that governs training has its own flow, with its own fluctuations, and it is the fluctuations of the kernel that carry the effect of training.',
    ref: '§8, §8.3',
    principle: 'universality',
    kind: 'recursion',
    status: 'cited',
    implemented:
      'The frozen recursion is implemented and displayed with its normalisation convention; the fluctuation analysis is explained, not derived.',
    see: [LAB('ntk', 'Laboratory D'), LESSON('ntk', 'lesson 9')],
  },
  {
    id: 'nearly-kernel',
    name: 'Nearly-kernel methods',
    statement:
      'A finite-width network is a kernel method whose kernel is allowed to move. That is the sense in which it is “nearly” a kernel method — and it is what buys the representation learning.',
    ref: '§11.4',
    principle: 'universality',
    kind: 'phenomenon',
    status: 'computed',
    implemented:
      'The movement of the empirical kernel and the movement of the features are both measured on the same training run.',
    see: [LAB('ntk', 'the defrosting panel'), FIG('representation-learning', 'the feature drift')],
  },
  {
    id: 'quadratic-model',
    name: 'The quadratic model',
    statement:
      'A two-layer network with a quadratic activation is the minimal model in which features can move. Its training dynamics are cubic rather than linear, and it is where representation learning first appears.',
    ref: '§§0.2, 2.2, 11.4.1',
    principle: 'universality',
    kind: 'object',
    status: 'cited',
    implemented:
      'The quadratic activation is in the registry and is exercised in the laboratories, but the cubic-dynamics analysis is not reproduced.',
    see: [LAB('initialization', 'the activation registry'), LESSON('rg-flow', 'lesson 5')],
  },
  {
    id: 'frozen-ntk',
    name: 'The frozen NTK',
    statement:
      'At infinite width the NTK does not depend on the data, the algorithm, or the training time. That is the freezing, and it is why there is no representation learning at infinite width.',
    ref: '§§10.1, 10.1.2',
    principle: 'sparsity',
    kind: 'phenomenon',
    status: 'computed',
    implemented:
      'The closed-form two-layer kernel is compared with the measured one, and the drift of the measured kernel during training is displayed beside it.',
    see: [FIG('ntk', 'the closed form against the measurement'), LAB('ntk', 'the defrosting panel')],
  },

  /* ---------------------------------------------------------------- */
  /* The remaining chapters                                            */
  /* ---------------------------------------------------------------- */
  {
    id: 'bayesian-fitting',
    name: 'Bayesian model fitting',
    statement:
      'Treating the weights as random and conditioning on the data turns the network into a posterior over functions, and the evidence — the marginal likelihood — becomes a criterion for the hyperparameters.',
    ref: '§§6.1, 6.2',
    principle: 'sparsity',
    kind: 'tool',
    status: 'cited',
    implemented:
      'The infinite-width posterior is computed in closed form; the finite-width evidence of §6.3.1 is cited, not computed.',
    see: [FIG('bayesian', 'the Gaussian process'), LESSON('bayesian', 'lesson 8')],
  },
  {
    id: 'no-rep-learning',
    name: 'No representation learning at infinite width',
    statement:
      'At infinite width the posterior depends on the data only through the kernel, which the architecture and the initialization fix. The representation cannot learn anything, and this is a theorem rather than an empirical observation.',
    ref: '§§6.3.3, 10.1.2',
    principle: 'sparsity',
    kind: 'phenomenon',
    status: 'computed',
    implemented:
      'The absence of feature movement at infinite width is contrasted with the measured movement at finite width, on the same task.',
    see: [FIG('representation-learning', 'the feature drift'), LESSON('bayesian', 'lesson 8')],
  },
  {
    id: 'generalization',
    name: 'Generalization: interpolation and extrapolation',
    statement:
      'At criticality the bias-variance tradeoff is settled in a particular way, and the question of whether a network interpolates or extrapolates is decided by the same hyperparameters that fix the signal.',
    ref: '§§10.3, 10.3.2',
    principle: 'typicality',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'The generalization analysis of §10.3 is not reproduced; the application does not train on real benchmarks.',
    see: [LESSON('ntk', 'lesson 9')],
  },
  {
    id: 'optimal-aspect-ratio',
    name: 'The optimal aspect ratio',
    statement:
      'An information-theoretic argument estimates the depth-to-width ratio at which the model complexity of the trained ensemble is best matched to the data.',
    ref: '§13, §A.2, §A.3',
    principle: 'typicality',
    kind: 'scaling',
    status: 'cited',
    implemented:
      'The laboratory measures the fluctuations the argument bounds, and the information-theoretic bound itself is not computed.',
    see: [LAB('width-depth', 'Laboratory C'), LESSON('universality', 'lesson 7')],
  },
  {
    id: 'residual',
    name: 'Residual learning',
    statement:
      'Residual connections shift the effective depth of a network, which pushes the optimal aspect ratio to larger values and makes very deep networks trainable.',
    ref: '§B',
    principle: 'criticality',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'Not implemented. The application studies plain multilayer perceptrons throughout, and says so where the subject comes up.',
    see: [LESSON('universality', 'lesson 7'), LAB('width-depth', 'Laboratory C')],
  },
  {
    id: 'model-complexity',
    name: 'Model complexity',
    statement:
      'The depth-to-width ratio governs the effective model complexity of the ensemble of trained networks, which is the epilogue’s single claim.',
    ref: '§13',
    principle: 'typicality',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'The ratio is exposed as a live quantity in the laboratories; the complexity claim itself is cited.',
    see: [LAB('width-depth', 'the depth-to-width panel')],
  },
  {
    id: 'mutual-information',
    name: 'Mutual information and the information bottleneck',
    statement:
      'The same information-theoretic tool that estimates the optimal aspect ratio also gives a bound on how much information the trained ensemble carries about its input.',
    ref: '§A.1, §A.2',
    principle: 'typicality',
    kind: 'tool',
    status: 'cited',
    implemented:
      'Not implemented. The information-theoretic bound is stated and cited, and the laboratory measures the fluctuations it would constrain.',
    see: [LESSON('universality', 'lesson 7')],
  },
  {
    id: 'giant-leap',
    name: 'A small step and a giant leap',
    statement:
      'One gradient step from the initialisation, and the kernel that governs training, are enough to characterise the infinite-width dynamics — the leap being taken by the kernel rather than by the features.',
    ref: '§§10.1, 10.2',
    principle: 'sparsity',
    kind: 'tool',
    status: 'cited',
    implemented:
      'The learning-rate rescaling that makes the leap well defined is explained; the analysis is not reproduced.',
    see: [LAB('ntk', 'Laboratory D')],
  },
  {
    id: 'newton',
    name: "Newton's method and the quadratic model",
    statement:
      'A second-order method reaches the infinite-width solution in a single step, and the comparison with gradient descent isolates exactly what the kernel does and does not determine.',
    ref: '§10.2.1',
    principle: 'sparsity',
    kind: 'tool',
    status: 'cited',
    implemented:
      'The laboratory implements gradient descent and heavy-ball momentum; a Newton step on the read-out slice is not implemented.',
    see: [LAB('landscape', 'the optimizer comparison')],
  },
  {
    id: 'cross-entropy',
    name: 'Cross-entropy loss',
    statement:
      'The loss function is a modelling choice that does not change the kernel: the dynamics are the same, because the kernel is what enters the update.',
    ref: '§10.2.3',
    principle: 'sparsity',
    kind: 'tool',
    status: 'cited',
    implemented:
      'The laboratories use the mean-squared error of eq. (7.2); the insensitivity to the loss is explained, not demonstrated.',
    see: [LESSON('ntk', 'lesson 9')],
  },
  {
    id: 'four-point-vertex',
    name: 'The four-point vertex',
    statement:
      'The quartic coupling that measures the non-Gaussianity of a layer is the object the RG flow of the distribution actually tracks.',
    ref: '§§4.3, 4.5, 5.4',
    principle: 'sparsity',
    kind: 'object',
    status: 'cited',
    implemented:
      'Not implemented as a flow. Its leading effect is measured through the connected four-point correlator.',
    see: [FIG('non-gaussianity', 'the connected four-point correlator'), LESSON('rg-flow', 'lesson 5')],
  },
  {
    id: 'finite-angle',
    name: 'The finite-angle analysis',
    statement:
      'The perturbation analysis of the kernel is only valid for nearby inputs; for inputs at a finite angle the exact recursion gives a power-law decay of the perpendicular component.',
    ref: '§5.5',
    principle: 'criticality',
    kind: 'object',
    status: 'cited',
    implemented:
      'Not implemented. The lesson states the limitation of the simpler analysis rather than hiding it.',
    see: [LESSON('criticality', 'lesson 6')],
  },
  {
    id: 'subleading-corrections',
    name: 'Subleading corrections',
    statement:
      'The corrections to the infinite-width description come in orders of 1/n, and each one has to be tracked separately as the network is made deeper.',
    ref: '§§4.5, 5.4',
    principle: 'typicality',
    kind: 'scaling',
    status: 'cited',
    implemented:
      'The leading correction is measured; the subleading ones are described.',
    see: [LAB('width-depth', 'Laboratory C')],
  },
  {
    id: 'generalised-depth',
    name: 'The generalised depth of a residual network',
    statement:
      'A residual network has an effective depth that is not its number of layers, and it is the effective depth that the aspect ratio should be measured against.',
    ref: '§§B.1, B.4',
    principle: 'criticality',
    kind: 'object',
    status: 'cited',
    implemented:
      'Not implemented. The generalised depth of a residual network is explained with a citation, and the application studies plain multilayer perceptrons throughout.',
    see: [LESSON('universality', 'lesson 7')],
  },

  /* ---------------------------------------------------------------- */
  /* Beyond the monograph: what moved since                             */
  /* ---------------------------------------------------------------- */
  {
    id: 'lazy-vs-rich',
    name: 'The lazy regime and the rich regime',
    statement:
      'The infinite-width limit is usually called “lazy”, because individual neurons barely move. Recent work shows the aggregate effect of many such small movements is not negligible, so the lazy/rich distinction is less sharp than it looked.',
    ref: 'external: arXiv:2511.07272 (2025)',
    url: 'https://arxiv.org/abs/2511.07272',
    principle: 'beyond',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'The application measures the movement of the *aggregate* representation — the feature drift — rather than of individual neurons, and reports both the drift and the Fisher separation.',
    see: [FIG('representation-learning', 'the feature drift'), LAB('representation', 'Laboratory E')],
  },
  {
    id: 'mup',
    name: 'μP and the standard parametrization',
    statement:
      'The choice of how the variance is scaled with width is a modelling decision, not a detail: under μP the infinite-width limit does feature learning, under the NTK parametrization it does not.',
    ref: 'external: Yang & Hu (2021); Chen et al. (ICML 2025)',
    url: 'https://arxiv.org/abs/2206.11965',
    principle: 'beyond',
    kind: 'object',
    status: 'cited',
    implemented:
      'The application uses the book’s parametrization, Var(W) = C_W/n, and says so wherever the NTK is discussed, because the contrast is what makes the book’s results meaningful.',
    see: [LAB('ntk', 'Laboratory D'), LESSON('ntk', 'lesson 9')],
  },
  {
    id: 'feature-quality',
    name: 'Feature quality versus feature strength',
    statement:
      'How much a representation moves and how good that representation is are different quantities: in high-capacity networks feature learning can be decoupled from generalization, so movement in the representation is not a proxy for quality.',
    ref: 'external: arXiv:2507.19680 (2025)',
    url: 'https://arxiv.org/abs/2507.19680',
    principle: 'beyond',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'The laboratory reports the drift (strength) and the Fisher separation (a quality proxy) side by side, and the panel is titled so that the distinction is visible.',
    see: [FIG('representation-learning', 'the feature drift'), LAB('representation', 'Laboratory E')],
  },
  {
    id: 'adaptive-kernels',
    name: 'Adaptive kernels',
    statement:
      'In the rich infinite-width limit the trained network is still described by a kernel machine — but with a data-dependent kernel, which is a different object from the frozen one.',
    ref: 'external: Lauditi, Bordelon & Pehlevan (ICML 2025)',
    url: 'https://proceedings.mlr.press/v267/lauditi25a.html',
    principle: 'beyond',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'Not implemented. The application measures the drift of the kernel, which is the finite-width shadow of this idea.',
    see: [LAB('ntk', 'the defrosting panel')],
  },
  {
    id: 'ntk-depth',
    name: 'The NTK on the depth axis',
    statement:
      'Recent work shows that the infinite-width NTK loses its ability to distinguish data points as the depth grows, and that a careful scaling of depth and stopping time rescues a non-trivial solution.',
    ref: 'external: arXiv:2511.07272 (2025)',
    url: 'https://arxiv.org/abs/2511.07272',
    principle: 'beyond',
    kind: 'phenomenon',
    status: 'cited',
    implemented:
      'Not implemented. The laboratory’s depth is deliberately small, and the NTK figure states its own limitation.',
    see: [FIG('ntk', 'the closed form against the measurement'), LAB('ntk', 'Laboratory D')],
  },
  {
    id: 'multiscale',
    name: 'Multi-scale adaptive feature learning',
    statement:
      'A statistical-mechanical treatment interpolates between the mean-field and standard scaling regimes and finds that feature learning is a change in the *direction* of the kernel, not only in its scale.',
    ref: 'external: arXiv:2502.03210 (2025)',
    url: 'https://arxiv.org/abs/2502.03210',
    principle: 'beyond',
    kind: 'scaling',
    status: 'cited',
    implemented:
      'Not implemented. The application measures the kernel drift itself, which is the observable this theory is about.',
    see: [LAB('ntk', 'the defrosting panel')],
  },
];

export const CONCEPT_BY_ID: Record<string, Concept> = Object.fromEntries(CONCEPTS.map((c) => [c.id, c]));

export function conceptsByPrinciple(principle: PrincipleId): Concept[] {
  return CONCEPTS.filter((c) => c.principle === principle);
}

export const CONCEPT_KINDS: ConceptKind[] = ['recursion', 'condition', 'scaling', 'phenomenon', 'tool', 'limit', 'object', 'principle'];
