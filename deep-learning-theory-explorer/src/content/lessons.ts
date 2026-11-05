import type { Lesson } from './types';

/**
 * Ten lessons, mapped onto the chapter structure of Roberts, Yaida & Hanin
 * (arXiv:2106.10165). Every lesson: intuition first, then definitions, then an
 * experiment that computes something real, then a verification exercise.
 *
 * The prose is original; the source is cited by section and equation number.
 */

export const LESSONS: Lesson[] = [
  {
    id: 'non-gaussianity',
    order: 1,
    title: 'Gaussians, Wick contraction and why the Gaussian world is not enough',
    chapter: 'Chapters 0-1',
    minutes: 40,
    tier: 'foundation',
    summary:
      'Deep learning theory starts with Gaussian integrals because a wide network behaves like a Gaussian process. The interesting physics lives in the deviations from Gaussianity, and those deviations are measured by connected correlators.',
    objectives: [
      'Evaluate Gaussian expectations with Wick contraction',
      'Distinguish a nearly-Gaussian distribution from an exactly Gaussian one',
      'Explain why the connected four-point correlator measures interactions between neurons',
    ],
    prerequisites: [],
    sections: [
      {
        heading: 'Why Gaussian integrals first',
        blocks: [
          {
            kind: 'p',
            text: 'A neural network at initialization is an ensemble of functions: draw the weights from a probability distribution and you get a random function. When the hidden layers are very wide, that ensemble becomes a Gaussian process, whose entire behaviour is fixed by one object — the two-point correlation, or [[kernel]]. Gaussian integrals are therefore the native language of the theory.',
          },
          {
            kind: 'eq',
            tex: '\\int_{-\\infty}^{\\infty} \\frac{dz}{\\sqrt{2\\pi K}}\\, e^{-\\frac{z^2}{2K}} = 1 , \\qquad \\mathbb{E}[z^2] = K',
            caption: 'The normal density and its second moment; K is the variance and plays the role of the kernel.',
            ref: '§1.1',
          },
          {
            kind: 'p',
            text: 'For a centred Gaussian vector, every higher moment factorises into products of second moments. The pattern of the factorisation is called Wick contraction: pair up the fields in all possible ways and multiply the corresponding covariances.',
          },
          {
            kind: 'eq',
            tex: '\\mathbb{E}[z_1 z_2 z_3 z_4] = \\mathbb{E}[z_1z_2]\\,\\mathbb{E}[z_3z_4] + \\mathbb{E}[z_1z_3]\\,\\mathbb{E}[z_2z_4] + \\mathbb{E}[z_1z_4]\\,\\mathbb{E}[z_2z_3]',
            caption: 'Wick contraction: three ways to pair four fields.',
            ref: '§1.1',
          },
        ],
      },
      {
        heading: 'Nearly-Gaussian distributions',
        blocks: [
          {
            kind: 'p',
            text: 'Real networks have finite width, so the preactivation distribution is only approximately Gaussian. The clean way to quantify the deviation is a cumulant: subtract from the four-point function all of the Wick pairings, and what remains is a genuine measurement of interaction.',
          },
          {
            kind: 'figure',
            figure: 'non-gaussianity',
          },
          {
            kind: 'eq',
            tex: 'G^{(4)} - \\big(G^{(2)}\\big)^2 = 2\\,(\\ell-1)\\frac{\\big(G^{(2)}\\big)^2}{n} + O\\!\\left(\\frac{1}{n^2}\\right)',
            caption:
              'For a deep linear network with zero bias, the leading non-Gaussianity grows linearly with depth ℓ and falls off as 1/n: the depth-to-width ratio is the small parameter of the whole theory.',
            ref: 'eq. (3.28)',
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'The single most repeated theme',
            text: 'Finite-width corrections at criticality grow like [[aspect-ratio]]. A short, fat network is nearly Gaussian and nearly infinite-width; a tall, skinny network is dominated by interactions. Every fluctuation panel in this app is a measurement of that statement.',
          },
        ],
      },
      {
        heading: 'Experiment',
        blocks: [
          {
            kind: 'p',
            text: 'Use Laboratory C to measure the seed-to-seed variance of the layer-wise kernel as you change depth and width. The measured variance should grow roughly linearly in depth and fall off as 1/width, while the mean profile stays flat at criticality.',
          },
        ],
      },
    ],
    experiment: { route: '/labs/width-depth', note: 'Measure the L/n growth of finite-width fluctuations.' },
    alsoExperiments: [
      {
        route: '/labs/physics',
        note: 'Watch the signal propagate through a wide network, and see how far from Gaussian the preactivations are.',
      },
      {
        route: '/labs/drills',
        note: 'Have the Wick contractions and quadrature arithmetic of this lesson graded against the app’s own computation.',
      },
    ],
    exercises: [
      {
        kind: 'numerical',
        prompt: 'For z ~ N(0, 2), compute E[z⁴] using Wick contraction.',
        answer: 'E[z⁴] = 3K² = 3·4 = 12. (Three pairings, each contributing K² = 4.)',
        hint: 'There are three ways to pair four fields.',
        computed: 'gaussian-fourth-moment',
      },
      {
        kind: 'conceptual',
        prompt: 'Why does the connected four-point correlator vanish for a Gaussian distribution?',
        answer:
          'For a Gaussian, every moment factorises into Wick pairings, so the connected part (the cumulant) is identically zero. A nonzero connected four-point function therefore certifies non-Gaussianity, which is the signature of neuron-neuron interactions.',
      },
    ],
    citations: [
      { label: '§1.1', note: 'Gaussian integrals and Wick contraction' },
      { label: '§1.3', note: 'nearly-Gaussian distributions and connected correlators' },
      { label: 'eq. (3.28)', note: 'leading non-Gaussianity of a deep linear network' },
    ],
  },
  {
    id: 'random-functions',
    order: 2,
    title: 'Neural networks as random functions: activation functions and ensembles',
    chapter: 'Chapter 2',
    minutes: 45,
    tier: 'foundation',
    summary:
      'Choosing an initialization distribution is choosing a probability distribution over functions. The activation function decides which function class you can represent, and the ensemble decides how the training data interacts with it.',
    objectives: [
      'State the initialization distribution used throughout the book',
      'Explain why a deterministic zero initialization is a bad idea',
      'Classify activations by smoothness and scale invariance',
    ],
    prerequisites: ['non-gaussianity'],
    sections: [
      {
        heading: 'The ensemble of functions',
        blocks: [
          {
            kind: 'p',
            text: 'The route from architecture to a distribution over functions runs through the preactivation recursion. Drop the biases and both endpoints are linear maps composed layer by layer.',
          },
          {
            kind: 'eq',
            tex: 'z^{(\\ell)} = W^{(\\ell)} h^{(\\ell-1)} + b^{(\\ell)} , \\qquad h^{(\\ell)} = \\sigma\\!\\left(z^{(\\ell)}\\right)',
            caption: 'The layer recursion. Everything in the first half of the book is a statistical statement about this iteration.',
            ref: 'eq. (4.1)',
          },
          {
            kind: 'eq',
            tex: 'W^{(\\ell)}_{ij} \\sim \\mathcal{N}\\!\\left(0, \\frac{C_W}{n_{\\ell-1}}\\right) , \\qquad b^{(\\ell)}_i \\sim \\mathcal{N}(0, C_b)',
            caption:
              'The 1/n rescaling of the weight variance is exactly what makes the infinite-width limit non-trivial: without it every observable collapses.',
            ref: 'eq. (4.2)',
          },
          {
            kind: 'callout',
            tone: 'warning',
            title: 'Why not initialize at zero?',
            text: 'A zero initialization keeps every neuron in a layer identical forever: no symmetry breaking. More formally, both susceptibilities are proportional to [[cw]], so C_W = 0 can never satisfy the criticality conditions and the kernel decays exponentially to a trivial fixed point.',
          },
          {
            kind: 'figure',
            figure: 'helper-function',
          },
        ],
      },
      {
        heading: 'Activation classes that matter later',
        blocks: [
          {
            kind: 'list',
            items: [
              'Scale-invariant: σ(λz) = λσ(z), i.e. σ(z) = a₊z (z ≥ 0), a₋z (z < 0). Includes the linear activation and the ReLU.',
              'Smooth with σ(0) = 0 and σ′(0) ≠ 0: the K = 0 universality class, containing tanh and sin.',
              'Smooth but σ(0) ≠ 0: sigmoid and softplus. Their criticality conditions clash with the physical requirement C_b ≥ 0.',
              'Nonlinear monomials z^p, p ≥ 2: the criticality ratio is p/(2p−1), which equals one only for p = 1.',
              'Half-stable: SWISH-like and GELU-like activations whose nontrivial fixed point is repulsive from one side.',
            ],
          },
        ],
      },
    ],
    experiment: { route: '/labs/initialization', note: 'Compare activations at and away from criticality.' },
    exercises: [
      {
        kind: 'numerical',
        prompt: 'For a scale-invariant activation with a₊ = 1, a₋ = 0.1, compute A² and the critical weight variance.',
        answer: 'A² = (1² + 0.1²)/2 = 0.505, so C_W^crit = 1/A² ≈ 1.980.',
        hint: 'A² = (a₊² + a₋²)/2 and C_W = 1/A².',
        computed: 'leaky-scale-invariant-a2',
        computedTolerance: 0.0005,
      },
      {
        kind: 'conceptual',
        prompt: 'Why does the weight variance carry a factor 1/n_{ℓ−1}?',
        answer:
          'The preactivation is a sum of n_{ℓ−1} terms. Without the 1/n rescaling the variance of the sum would grow with width, and any infinite-width limit (as well as the "correlation functions are O(1)" property the theory relies on) would be lost.',
      },
    ],
    citations: [
      { label: '§2.2', note: 'activation functions' },
      { label: '§2.3', note: 'ensembles, permutation symmetry' },
      { label: 'eq. (4.2)', note: 'initialization distribution' },
    ],
  },
  {
    id: 'linear-criticality',
    order: 3,
    title: 'Deep linear networks: exact criticality and the exploding/vanishing problem',
    chapter: 'Chapter 3',
    minutes: 45,
    tier: 'core',
    summary:
      'With a linear activation the whole theory becomes exact. The covariance is multiplied by C_W at every layer, so C_W = 1 is the unique nontrivial fixed point and every other choice either explodes or decays exponentially.',
    objectives: [
      'Derive the covariance recursion of a deep linear network',
      'Identify trivial versus nontrivial fixed points',
      'Explain why C_W = 1 is required for signal preservation',
    ],
    prerequisites: ['random-functions'],
    sections: [
      {
        heading: 'From layer to layer',
        blocks: [
          {
            kind: 'p',
            text: 'Define the covariance of preactivations for two inputs x₁, x₂ as the width-averaged inner product. For a linear network the recursion is multiplication by a constant, which is why this is the only case with a closed-form solution.',
          },
          {
            kind: 'figure',
            figure: 'linear-profile',
          },
          {
            kind: 'eq',
            tex: 'G^{(\\ell+1)}_{12} = C_W\\, G^{(\\ell)}_{12} \\quad\\Longrightarrow\\quad G^{(\\ell)}_{12} = C_W^{\\ell} G^{(0)}_{12}',
            caption: 'The exact solution. The factor of n in the weight variance cancels, confirming the choice of rescaling.',
            ref: 'eqs. (3.14)-(3.15)',
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'Three regimes',
            text: '[[cw]] > 1: all structure is pushed to a trivial fixed point at infinity (numerical blow-up). [[cw]] < 1: correlations decay to zero and the data dependence is erased. C_W = 1: the covariance is preserved exactly — the first example of criticality.',
          },
          {
            kind: 'eq',
            tex: '\\chi_\\parallel = C_W \\, \\frac{d g}{dK} = C_W , \\qquad K^{(\\ell)} \\xrightarrow{C_W = 1} K^{(1)}',
            caption: 'For the linear activation g(K) = K, so the parallel susceptibility equals C_W and the critical value is C_W = 1.',
            ref: 'eq. (5.50)',
          },
        ],
      },
      {
        heading: 'Experiment: verify the recursion yourself',
        blocks: [
          {
            kind: 'p',
            text: 'Laboratory A lets you set C_W = 1, C_W = 0.8 and C_W = 1.2 on a deep linear network and watch the measured kernel trajectory. The displayed theoretical curve is the exact solution above; the scatter is the finite-width measurement, and the spread across seeds is a preview of the fluctuation analysis.',
          },
        ],
      },
    ],
    experiment: { route: '/labs/initialization', note: 'Linear network at and off criticality.' },
    exercises: [
      {
        kind: 'numerical',
        prompt: 'A linear network with C_W = 0.9 and G⁽¹⁾ = 1.5 is 40 layers deep. What is G⁽⁴⁰⁾?',
        answer:
          'G⁽⁴⁰⁾ = 0.9³⁹ · 1.5 ≈ 0.0246. The factor 39 counts the layers after the first: G⁽ℓ⁾ = C_W^(ℓ−1) G⁽¹⁾.',
        computed: 'linear-covariance-depth-40',
      },
      {
        kind: 'code',
        prompt: 'Run the linear network at C_W = 1 with 6 seeds and check that the mean of (1/n)Σz² matches ‖x‖²/n₀ at every layer.',
        answer:
          'The ensemble mean matches to a few per cent at width 32; the per-seed curve scatters by O(1/√n) because each seed is one draw of the weight matrices.',
      },
    ],
    citations: [
      { label: '§3.2', note: 'criticality of deep linear networks' },
      { label: 'eqs. (3.14)-(3.15)', note: 'the covariance recursion and its solution' },
    ],
  },
  {
    id: 'fluctuations',
    order: 4,
    title: 'Finite width: fluctuations and the depth-to-width ratio',
    chapter: 'Chapter 3.3, 5.4',
    minutes: 40,
    tier: 'core',
    summary:
      'At criticality the mean of the kernel is preserved exactly, but individual networks still differ from the mean. The variance of that difference grows linearly with depth and shrinks with width, making L/n the emergent scale of the theory.',
    objectives: [
      'State the leading finite-width correction to the four-point correlator',
      'Predict how the variance of the layer kernel scales with depth and width',
      'Explain why L/n is the cutoff of the effective theory',
    ],
    prerequisites: ['linear-criticality'],
    sections: [
      {
        heading: 'Fluctuating observables',
        blocks: [
          {
            kind: 'p',
            text: 'Define the observable O^(ℓ) = (1/n)Σ_j z_j^(ℓ) z_j^(ℓ), the layer-wise mean square preactivation measured on a single network. Its expectation over the ensemble is the [[kernel]]; its variance over the ensemble measures how strongly a single network deviates from the Gaussian, infinite-width picture.',
          },
          {
            kind: 'figure',
            figure: 'fluctuation',
          },
          {
            kind: 'eq',
            tex: '\\mathrm{Var}\\Big[\\tfrac{1}{n}\\textstyle\\sum_j (z_j^{(\\ell)})^2\\Big] = \\frac{2\\ell\\,(G^{(2)})^2}{n} + O\\!\\left(\\frac{1}{n^2}\\right)',
            caption:
              'For a deep linear network at criticality with a single input. The variance is suppressed by 1/n yet grows linearly with depth ℓ: the combination ℓ/n is what matters.',
            ref: 'eqs. (3.28), (3.33)',
          },
          {
            kind: 'callout',
            tone: 'limitation',
            title: 'What this does and does not say',
            text: 'This is a statement about the ensemble variance of a simple observable in a deep linear network, verified numerically in the app at the stated precision. It is not a claim that these simulations reproduce the book\'s complete effective theory, which involves a full effective action with all-order couplings.',
          },
        ],
      },
      {
        heading: 'Why deep networks are useful anyway',
        blocks: [
          {
            kind: 'p',
            text: 'Depth brings two opposing effects: deeper networks can develop nontrivial correlations and features, but their observables fluctuate more from instantiation to instantiation. Since practical networks have L ≳ 2, some finite-width effect is always present — which is exactly the regime where the perturbative expansion in 1/n is trustworthy.',
          },
        ],
      },
    ],
    experiment: { route: '/labs/width-depth', note: 'Measure the L/n growth directly.' },
    exercises: [
      {
        kind: 'numerical',
        prompt: 'Depth 20, width 256, critical linear network with G⁽²⁾ = 1. Predict the standard deviation of O⁽²⁰⁾ across instantiations.',
        answer:
          'Var = 2·20/256 = 0.15625, so sd ≈ 0.395 — a 40% deviation from the mean of 1. This is why skinny, deep networks show wildly different behaviour across seeds.',
        computed: 'fluctuation-sd-depth-20-width-256',
      },
    ],
    citations: [
      { label: 'eq. (3.28)', note: 'leading four-point correction' },
      { label: 'eq. (3.33)', note: 'variance of the layer observable' },
      { label: '§5.4', note: 'fluctuations for general activations, with grading by L/n' },
    ],
  },
  {
    id: 'rg-flow',
    order: 5,
    title: 'Representation group flow: how the preactivation distribution evolves',
    chapter: 'Chapter 4',
    minutes: 50,
    tier: 'advanced',
    summary:
      'Marginalizing one layer at a time turns the network into a flow of distributions. At infinite width the flow is Gaussian and described by the kernel recursion; away from infinite width, non-Gaussianities accumulate layer by layer.',
    objectives: [
      'Explain the marginalization step that defines the flow',
      'Write the kernel recursion for a general activation',
      'Interpret non-Gaussian couplings as running with depth',
    ],
    prerequisites: ['fluctuations'],
    sections: [
      {
        heading: 'The intuition: coarse-graining a network',
        blocks: [
          {
            kind: 'p',
            text: 'A network is a stack of random linear maps. If you ask "what is the distribution of the output when the weights are random?", the honest answer is an integral over every weight in the network — hopeless. The trick is to integrate one layer at a time, from the outside in.',
          },
          {
            kind: 'p',
            text: 'Integrating out the last layer leaves a distribution over the penultimate layer\'s activations. Integrating out the layer before that leaves a distribution over the layer before it. Each integration step therefore produces a *new* distribution — a flow of distributions, one per layer. The question the theory answers is: what does this flow do as the layer index increases?',
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'Why this is a flow and not a recursion',
            text: 'The map from one layer\'s distribution to the next is the same at every step. That is the renormalization-group structure: the same operation applied repeatedly. In the physics analogy of the book, this is the same coarse-graining that turns microscopic dynamics into macroscopic thermodynamics.',
          },
        ],
      },
      {
        heading: 'Marginalize the last layer first',
        blocks: [
          {
            kind: 'p',
            text: 'The output distribution is an integral over all weights. Grouping the weights layer by layer, each step replaces a layer of neurons by a Gaussian with the kernel computed from the previous layer — as long as the layer is wide enough that correlations between neurons can be neglected.',
          },
          {
            kind: 'eq',
            tex: 'K^{(\\ell+1)}_{12} = C_b + C_W \\, \\mathbb{E}_{(u,v)\\sim\\mathcal{N}(0,\\,K^{(\\ell)})}\\big[\\sigma(u)\\,\\sigma(v)\\big]',
            caption:
              'The kernel recursion (mixing two inputs). For a single input both copies coincide and the expectation reduces to E[σ(z)²] = g(K).',
            ref: 'eqs. (5.1), (5.44)',
          },
          {
            kind: 'p',
            text: 'Non-Gaussianities enter through a quartic coupling V^(ℓ), whose flow is fed by the difference G⁽⁴⁾ − (G⁽²⁾)². The coupling grows with depth, so the layer at which you look matters: the distribution runs, which is why the book calls this representation group flow.',
          },
          {
            kind: 'callout',
            tone: 'limitation',
            title: 'Scope of the app',
            text: 'The laboratories in this app compute the Gaussian part of the flow exactly (via quadrature) and measure the leading non-Gaussianity empirically. The full effective action with its quartic and higher couplings is described here in prose and citations, not simulated.',
          },
        ],
      },
      {
        heading: 'Experiment',
        blocks: [
          {
            kind: 'p',
            text: 'Open Laboratory A and switch the activation between the scale-invariant class (ReLU) and the K = 0 class (tanh). The measured kernel profile is the flow of the kernel under the recursion; the theory curve is the same recursion evaluated by Gauss-Hermite quadrature. Where the two agree, the Gaussian part of the flow is doing the work. Where they separate at large depth, you are seeing the leading finite-width correction the Gaussian flow does not capture.',
          },
          {
            kind: 'p',
            text: 'Then open Laboratory C and look at the depth-to-width ratio panel: it is the quantity that decides whether the Gaussian description of the flow is still accurate at the depth you are running.',
          },
        ],
      },
    ],
    experiment: { route: '/labs/initialization', note: 'Compare the measured kernel profile with the recursion.' },
    exercises: [
      {
        kind: 'numerical',
        prompt:
          'For a quadratic activation σ(z) = z², use Wick contraction to write K⁽ℓ⁺¹⁾ in terms of the kernel matrix entries, and evaluate the bracket for K₁₁ = 2, K₂₂ = 3, K₁₂ = 0.5.',
        answer:
          'K⁽ℓ⁺¹⁾₁₂ = C_b + C_W (K₁₁K₂₂ + 2K₁₂²) = C_b + C_W (6 + 0.5) = C_b + 6.5·C_W. This is why nonlinear activations mix diagonal and off-diagonal entries, whereas the linear case does not.',
        hint: 'E[z²z′²] = E[z²]E[z′²] + 2E[zz′]² for jointly Gaussian (z, z′).',
        computed: 'quadratic-wick-kernel',
      },
      {
        kind: 'conceptual',
        prompt: 'Why does the flow become exactly Gaussian in the infinite-width limit, and what breaks that at finite width?',
        answer:
          'At infinite width the correlations between neurons in a layer vanish (the principle of sparsity: the input of any one neuron is a sum of so many weakly correlated signals that the law of large numbers applies), so the marginalization is exact and the layer distribution is Gaussian. At finite width those intra-layer correlations are non-zero, and they are exactly what the connected four-point correlator G⁽⁴⁾ − (G⁽²⁾)² measures. The correction grows like L/n, so it is negligible for short, fat networks and dominant for tall, skinny ones.',
      },
    ],
    citations: [
      { label: '§4.1-4.3', note: 'layer-by-layer marginalization' },
      { label: '§4.5', note: 'subleading corrections' },
      { label: 'eqs. (5.1), (5.44)', note: 'the two-input kernel recursion' },
    ],
  },
  {
    id: 'criticality',
    order: 6,
    title: 'Criticality for general activations: two conditions and the Kaiming initialization',
    chapter: 'Chapter 5.1-5.2',
    minutes: 55,
    tier: 'core',
    summary:
      'Criticality requires two susceptibilities to equal one: one controls magnitude perturbations, the other controls angular ones. For scale-invariant activations both conditions are solved exactly and reproduce He/Kaiming initialization.',
    objectives: [
      'Define the parallel and perpendicular susceptibilities',
      'Apply the criticality conditions to the linear and ReLU activations',
      'Explain the line-of-fixed-points and semi-critical cases',
    ],
    prerequisites: ['rg-flow'],
    sections: [
      {
        heading: 'Two ways to perturb a kernel',
        blocks: [
          {
            kind: 'p',
            text: 'Perturbing around a fixed point of the kernel recursion, there are two independent ways to move: change the magnitude of an input ([[chi-parallel]]) or change its direction at fixed magnitude ([[chi-perp]])perpendicular). Each perturbation is multiplied by its own susceptibility per layer.',
          },
          {
            kind: 'eq',
            tex: '\\chi_\\parallel(K) = C_W\\, g\'(K), \\qquad \\chi_\\perp(K) = C_W \\, \\mathbb{E}_{z\\sim\\mathcal{N}(0,K)}\\big[\\sigma\'(z)^2\\big]',
            caption: 'The two susceptibilities. Criticality is the statement χ∥(K*) = 1 and χ⊥(K*) = 1 at the fixed point K* = C_b + C_W g(K*).',
            ref: 'eqs. (5.50)-(5.55)',
          },
          {
            kind: 'p',
            text: 'Beware a common trap: [[chi-perp]] is not the variance of the activation derivative. It is the expectation of the square of σ′. Both coincidences that make the analysis easy for scale-invariant activations fail for the K = 0 class.',
          },
        ],
      },
      {
        heading: 'Scale-invariant activations',
        blocks: [
          {
            kind: 'p',
            text: 'For σ(z) = a₊z on the positive half-line and a₋z on the negative half-line, g(K) = A²K exactly with [[a2]] = (a₊² + a₋²)/2, so both susceptibilities are the kernel-independent constant A²C_W.',
          },
          {
            kind: 'figure',
            figure: 'criticality',
          },
          {
            kind: 'eq',
            tex: '(C_b, C_W)^{\\text{critical}} = \\left(0,\\; \\frac{1}{A^2}\\right), \\qquad A^2 = \\frac{a_+^2 + a_-^2}{2}',
            caption:
              'The critical hyperparameters. For the ReLU A² = 1/2 and C_W = 2: Kaiming/He initialization is a criticality condition, not a heuristic.',
            ref: 'eq. (5.67)',
          },
          {
            kind: 'list',
            items: [
              'C_W > 1/A²: everything explodes exponentially towards the trivial fixed point at infinity.',
              'C_W < 1/A²: the kernel collapses to K* = C_b/(1 − A²C_W) and perturbations vanish exponentially.',
              'C_W = 1/A², C_b = 0: every K is a fixed point — a line of nontrivial fixed points, exactly as in a scale-invariant field theory.',
              'C_W = 1/A², C_b > 0: semi-critical. Perturbations stay constant at linear order while the kernel grows linearly with depth; still no exponential behaviour.',
            ],
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'Order-one numbers from a principle',
            text: 'The theory predicts C_W = 1, 2, 1.98 for linear, ReLU and leaky-ReLU(0.1). None of these numbers was fitted: they follow from demanding that the depth direction neither blows up nor dies out.',
          },
        ],
      },
    ],
    experiment: { route: '/labs/initialization', note: 'Compare measured signal propagation with the C_W = 1/A² prediction.' },
    exercises: [
      {
        kind: 'numerical',
        prompt: 'Compute the critical C_W for a scale-invariant activation with a₊ = 1, a₋ = 0 (ReLU) and for a₋ = a₊ = 1 (linear).',
        answer: 'ReLU: A² = (1 + 0)/2 = 0.5, C_W = 2. Linear: A² = (1 + 1)/2 = 1, C_W = 1.',
        hint: 'C_W^crit = 1/A² with A² = (a₊² + a₋²)/2 (book eq. (5.67)).',
        computed: 'relu-critical-cw',
      },
      {
        kind: 'conceptual',
        prompt:
          'Why does the sigmoid fail the criticality test even though its activation is perfectly smooth? Compute the unphysical C_b it would need.',
        answer:
          'The condition χ⊥/χ∥ = 1 is met only at K* = 0, where the fixed-point relation forces C_b = −σ(0)²/σ′(0)² = −(1/2)²/(1/4) = −4 < 0. A negative bias variance is unphysical, so no critical initialization exists. Shifting the activation so that σ(0) = 0 turns the sigmoid into a scaled tanh, which is critical.',
        computed: 'sigmoid-unphysical-cb',
      },
    ],
    citations: [
      { label: '§5.1', note: 'criticality analysis of the kernel' },
      { label: '§5.2', note: 'scale-invariant activations, eq. (5.67)' },
      { label: '§5.3.2', note: 'activations without criticality' },
    ],
  },
  {
    id: 'universality',
    order: 7,
    title: 'Universality classes: tanh, sin, sigmoid and friends',
    chapter: 'Chapter 5.3, 5.5',
    minutes: 55,
    tier: 'advanced',
    summary:
      'Numerically solving the second criticality condition sorts activations into classes with distinct deep behaviour: exact preservation, power-law decay, exponential failure, or a repulsive fixed point.',
    objectives: [
      'Implement the criticality scan of §5.3.1 conceptually',
      'Distinguish the K = 0 class from the no-criticality and half-stable cases',
      'State the universal exponent and its coefficient for the K = 0 class',
    ],
    prerequisites: ['criticality'],
    sections: [
      {
        heading: 'The numerical criticality algorithm',
        blocks: [
          {
            kind: 'p',
            text: 'For a candidate fixed-point value [[kstar]], set C_W = 1/g′(K*) and C_b = K* − C_W g(K*). That satisfies the fixed-point equation and [[chi-parallel]] = 1 identically. The remaining condition [[chi-perp]] = 1 becomes a single dimensionless equation',
          },
          {
            kind: 'eq',
            tex: '\\frac{2 K_*^2 \\, \\mathbb{E}[\\sigma\'(z)^2]_{K_*}}{\\mathbb{E}[\\sigma(z)^2 (z^2 - K_*)]_{K_*}} = 1',
            caption: 'Condition (5.73). Scan K* ≥ 0 for a root, then read off (C_b, C_W) and check that C_b ≥ 0.',
            ref: 'eq. (5.73)',
          },
          {
            kind: 'p',
            text: 'This is exactly what the app computes in the criticality scanner: the ratio above is evaluated with Gauss-Hermite quadrature for any activation in the registry, including GELU and SWISH, and every root is reported together with its physicality and stability.',
          },
          {
            kind: 'figure',
            figure: 'susceptibility',
          },
        ],
      },
      {
        heading: 'The K = 0 universality class',
        blocks: [
          {
            kind: 'p',
            text: 'If σ(0) = 0 and σ′(0) ≠ 0, the fixed point sits at [[kstar]] = 0 and the approach to it is a power law rather than an exponential, governed by [[a1]]. The exponent is universal, the coefficient is not.',
          },
          {
            kind: 'figure',
            figure: 'power-law',
          },
          {
            kind: 'eq',
            tex: 'K^{(\\ell)} = \\frac{1}{(-a_1)\\,\\ell} + \\cdots , \\qquad a_1 = \\gamma_1\\gamma_3 + \\tfrac{3}{4}\\gamma_2^2',
            caption:
              'Power-law decay of the kernel at criticality. For tanh a₁ = −2 and for sin a₁ = −1, so both decay as 1/ℓ with different coefficients, exactly as the app measures.',
            ref: 'eqs. (5.91)-(5.92)',
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'Why this is good news',
            text: 'tanh at C_W = 1 keeps a slowly decaying but non-vanishing signal: [[kernel]] ~ 1/ℓ over hundreds of layers. Exponential decay would leave nothing to train on; a power law leaves order-one signal for any finite depth.',
          },
        ],
      },
      {
        heading: 'The other classes',
        blocks: [
          {
            kind: 'list',
            items: [
              'No criticality: sigmoid (unphysical C_b), softplus (no root at all), nonlinear monomials (the ratio p/(2p−1) equals one only for p = 1).',
              'Half-stable: GELU and SWISH satisfy the conditions at a nonzero K*, but the K* = 0 fixed point is repulsive because a₁ > 0.',
              'Non-smooth activations such as the ReLU need the finite-angle analysis of §5.5, where the perpendicular mode develops a slow power-law decay rather than staying exactly constant.',
            ],
          },
          {
            kind: 'callout',
            tone: 'warning',
            title: 'A caveat stated in the source itself',
            text: 'For nonlinear scale-invariant activations the constancy of the perpendicular component holds only at the level of infinitesimal perturbations. A finite-angle analysis shows a crossover to a slow power-law decay, which is benign compared to exponential behaviour but is not exact constancy.',
          },
        ],
      },
    ],
    experiment: { route: '/labs/initialization', note: 'Run tanh, sin, sigmoid and GELU and classify them by measured behaviour.' },
    exercises: [
      {
        kind: 'numerical',
        prompt: 'tanh at criticality with K⁽¹⁾ = 1: use the power law to estimate K at layer 200, then compare with the exact recursion from the app.',
        answer:
          'Power law: K ≈ 1/(2·200) = 0.0025. The continuous version of the recursion, 1/((−a₁)(ℓ−1) + 1/K⁽¹⁾), gives 0.002506, and the exact quadrature recursion gives 0.002534 — the exact curve is larger because the asymptotic form drops the O(K³) terms. The app shows both curves and their difference.',
        computed: 'tanh-power-law-layer-200',
      },
      {
        kind: 'conceptual',
        prompt: 'Why can the softplus not be rescued by subtracting log 2 so that σ(0) = 0?',
        answer:
          'With that shift the coefficient a₁ changes sign, so the K* = 0 fixed point becomes repulsive; away from K = 0 the parallel susceptibility exceeds one, and the kernel diverges exponentially. The fix must remove the offset while keeping a₁ negative.',
      },
    ],
    citations: [
      { label: '§5.3.1', note: 'the criticality algorithm' },
      { label: '§5.3.3', note: 'K = 0 universality class, power law' },
      { label: '§5.3.4', note: 'half-stable classes' },
      { label: '§5.5', note: 'finite-angle analysis for non-smooth activations' },
    ],
  },
  {
    id: 'bayesian',
    order: 8,
    title: 'Bayesian learning: what infinite width can and cannot do',
    chapter: 'Chapter 6',
    minutes: 50,
    tier: 'advanced',
    summary:
      'Treated Bayesianly, an infinite-width network is exactly a Gaussian process whose predictions depend on the data only through the kernel. Its posterior cannot move the kernel, which is a precise statement of the absence of representation learning at infinite width.',
    objectives: [
      'State the Gaussian-process description of an infinite-width network',
      'Explain why the evidence prefers criticality',
      'Explain why feature learning is impossible at infinite width but appears at finite width',
    ],
    prerequisites: ['universality'],
    sections: [
      {
        heading: 'Predictions from a Gaussian process',
        blocks: [
          {
            kind: 'p',
            text: 'Bayesian model fitting starts from a prior over functions and conditions on the data. For an infinite-width network the prior is Gaussian with covariance K, so the posterior is Gaussian too and the mean prediction is a kernel regression formula.',
          },
          {
            kind: 'figure',
            figure: 'gp-posterior',
          },
          {
            kind: 'callout',
            tone: 'limitation',
            title: 'What this figure is, and is not',
            text: 'This is the posterior of the *infinite-width* Gaussian process, computed in closed form by inverting the kernel matrix. It is not a finite-width Bayesian posterior: the finite-width corrections of Chapter 6, which generate the Hebbian wiring and the moving kernel, are not implemented here. The figure makes the limit concrete; Laboratory E measures what a finite-width network does instead.',
          },
          {
            kind: 'eq',
            tex: '\\mu_*(x) = K_*(x)^T \\left(K + \\sigma_\\epsilon^2 I\\right)^{-1} y',
            caption: 'Gaussian-process posterior mean: linear in the training labels, with no dependence on anything but the kernel.',
            ref: '§6.2.1',
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'The evidence argument for criticality',
            text: 'The marginal likelihood (evidence) rewards priors that can fit data without being too flexible. Evaluating the evidence for a Gaussian-process network shows a preference for order-one, critical hyperparameters — a second, independent route to the same tuning that the signal-propagation analysis produced.',
          },
        ],
      },
      {
        heading: 'No wiring, no representation learning',
        blocks: [
          {
            kind: 'p',
            text: 'Two structural facts follow. Correlation functions are delta-correlated across neurons at infinite width, so the network does not "wire together" features inside a layer. And the posterior depends on the data only through the kernel, which is fixed by the architecture and initialization: the representation cannot change. Introducing 1/n corrections generates both effects — Hebbian-style wiring and a moving kernel.',
          },
          {
            kind: 'callout',
            tone: 'limitation',
            title: 'Where the app stands',
            text: 'Laboratory E measures the finite-width drift of hidden features and of the empirical kernel; it does not implement Bayesian inference. The Bayesian results above are stated with citations, not simulated, and the app says so where they appear.',
          },
        ],
      },
    ],
    experiment: { route: '/labs/representation', note: 'Measure feature drift as a function of width.' },
    exercises: [
      {
        kind: 'conceptual',
        prompt: 'Why is "the kernel is frozen" equivalent to "no representation learning"?',
        answer:
          'The kernel is the collection of gradient inner products that controls how the network changes when trained. If it is fixed by initialization, training only changes the read-out in an already-fixed feature space; no hidden-layer feature can be re-shaped, so the representation is static.',
      },
    ],
    citations: [
      { label: '§6.2', note: 'Bayesian model fitting and comparison' },
      { label: '§6.3', note: 'infinite-width Bayesian inference, evidence for criticality' },
      { label: '§6.4', note: 'finite-width Bayesian inference, Hebbian learning' },
    ],
  },
  {
    id: 'ntk',
    order: 9,
    title: 'Gradient descent and the neural tangent kernel',
    chapter: 'Chapters 7-9',
    minutes: 60,
    tier: 'advanced',
    summary:
      'Gradient descent changes any observable through the NTK. At infinite width the NTK is deterministic and frozen, which turns training into kernel learning with closed-form dynamics; at finite width it fluctuates and defrosts.',
    objectives: [
      'Define the NTK and derive the update equation for an observable',
      'State the frozen-NTK recursion for a deep network',
      'Explain why the learning-rate tensor is scaled by 1/n per layer',
    ],
    prerequisites: ['bayesian'],
    sections: [
      {
        heading: 'The NTK controls learning',
        blocks: [
          {
            kind: 'p',
            text: 'A gradient step changes the parameters; the induced change of any observable is a sum over parameter gradients weighted by the loss gradient. All of the model-dependent information is collected in one kernel.',
          },
          {
            kind: 'figure',
            figure: 'ntk-closed-form',
          },
          {
            kind: 'eq',
            tex: '\\Theta_{i_1 i_2; 1 2} = \\sum_{\\theta} \\frac{\\partial z_{i_1}(x_1)}{\\partial \\theta} \\frac{\\partial z_{i_2}(x_2)}{\\partial \\theta} , \\qquad \\Delta z_i(x) = -\\eta \\sum_{j, \\tilde x} \\Theta_{ij; x \\tilde x}\\, \\epsilon_{j;\\tilde x}',
            caption:
              'The NTK and the resulting change of the network output. The off-diagonal entries in the sample index are exactly the mechanism by which learning one example affects another.',
            ref: 'eqs. (7.17)-(7.20)',
          },
          {
            kind: 'eq',
            tex: '\\Theta^{(\\ell+1)} = K^{(\\ell+1)} + \\chi_\\perp^{(\\ell+1)}\\,\\Theta^{(\\ell)} , \\qquad \\Theta^{(1)} = K^{(1)}',
            caption:
              'The frozen-NTK recursion of the effective theory (9.5)-(9.7). Because χ⊥ is the same susceptibility that appears in the criticality analysis, criticality of the kernel and criticality of the NTK are one story.',
            ref: 'eqs. (9.5)-(9.7)',
          },
        ],
      },
      {
        heading: 'Parameterization matters',
        blocks: [
          {
            kind: 'p',
            text: 'The raw sum over parameters in the NTK definition grows with the fan-in of each layer: a hidden layer contributes θ(1) to [[theta]] and the read-out another θ(1), so the total is θ(width). The book absorbs this by scaling the learning rate of a weight by 1/n_{ℓ−1}, so that the weight contribution to the effective kernel is O(1) and the large-width expansion is meaningful.',
          },
          {
            kind: 'eq',
            tex: '\\upsilon^{(W)}_{\\ell} = \\frac{\\eta\\, \\lambda^{(W)}_{\\ell}}{n_{\\ell-1}} , \\qquad \\upsilon^{(b)}_{\\ell} = \\eta\\, \\lambda^{(b)}_{\\ell}',
            caption: 'The learning-rate tensor of eqs. (8.6). Laboratory D measures the width-linear growth of the raw NTK that motivates this scaling.',
            ref: 'eqs. (8.6)-(8.7)',
          },
          {
            kind: 'callout',
            tone: 'insight',
            title: 'What the app computes',
            text: 'Laboratory D assembles the raw empirical NTK from exact Jacobians, checks symmetry and positive semidefiniteness, compares it against a closed-form two-layer ensemble prediction that the test suite validates, and measures its width scaling. The frozen recursion is displayed alongside, with the normalization convention stated explicitly.',
          },
        ],
      },
    ],
    experiment: { route: '/labs/ntk', note: 'Assemble the NTK from Jacobians and watch it defrost during training.' },
    alsoExperiments: [
      {
        route: '/labs/landscape',
        note: 'Go down the loss itself: a read-out slice that is exactly quadratic, a hidden slice that is not, and the stability threshold read off the curvature.',
      },
      {
        route: '/labs/drills',
        note: 'The eigenvalue, kernel and Gaussian-process arithmetic this lesson assumes, as graded drills.',
      },
    ],
    exercises: [
      {
        kind: 'numerical',
        prompt:
          'A two-layer tanh network, widths (4, 128, 1), C_W = 1, C_b = 0. Predict by what factor the empirical NTK trace changes when you quadruple the hidden width to 512.',
        answer:
          'The read-out term n₁·g(K⁽¹⁾) dominates and grows linearly with n₁, so the trace grows by close to a factor of four — the closed form gives 3.82, not exactly four, because the first-layer term C_W·K̇·(x·x′ + 1) is width-independent and the read-out bias contributes a constant. Laboratory D reports the measured ratio and the closed-form prediction side by side.',
        computed: 'ntk-trace-ratio-quadrupled-width',
        computedTolerance: 0.05,
      },
      {
        kind: 'conceptual',
        prompt: 'Why is the NTK called frozen at infinite width, and what thaws it?',
        answer:
          'At infinite width the parameter gradients are determined by the initialization and do not change as training proceeds, so Θ is constant in time. At finite width the 1/n corrections make the gradient directions drift as the weights move, which the book quantifies with the differential of the NTK (dNTK).',
      },
    ],
    citations: [
      { label: '§7.2', note: 'gradient descent and function approximation' },
      { label: '§8.0', note: 'learning-rate tensor and the forward equation for the NTK' },
      { label: '§9.1-9.3', note: 'effective theory of the frozen NTK at initialization' },
      { label: '§10.2', note: 'kernel learning dynamics' },
    ],
  },
  {
    id: 'representation-learning',
    order: 10,
    title: 'Representation learning at finite width',
    chapter: 'Chapters 10-11',
    minutes: 55,
    tier: 'advanced',
    summary:
      'The difference between a kernel method and a neural network is the movement of the kernel. Measuring that movement — feature drift, kernel drift, class separation — shows it is a finite-width effect whose size shrinks as the network widens.',
    objectives: [
      'Define the differential of the NTK and interpret it',
      'Measure feature drift and class separation in a trained network',
      'Explain the kernel/large-width limit as a controlled approximation',
    ],
    prerequisites: ['ntk'],
    sections: [
      {
        heading: 'The kernel moves',
        blocks: [
          {
            kind: 'p',
            text: 'Take the derivative of the NTK with respect to training time. What you get, the differential of the NTK (dNTK), is nonzero only because the parameter gradients themselves depend on the parameters — a purely finite-width phenomenon. Its flow is governed by the same four-point vertices that control non-Gaussianities.',
          },
          {
            kind: 'eq',
            tex: '\\frac{d\\Theta}{dt} = \\frac{\\partial \\Theta}{\\partial \\theta}\\cdot \\dot\\theta \\;\\sim\\; \\frac{1}{n}\\,\\big(\\text{four-point vertices}\\big)',
            caption:
              'Sketch of the dNTK flow: the book’s statement is that it is nonzero at finite width and vanishes as 1/n. The application measures that the kernel moves, and it measures the movement; the 1/n scaling is the leading order of the flow, which a single training step does not by itself establish.',
            ref: '§11.1-11.2',
          },
          {
            kind: 'p',
            text: 'The practical question is empirical: how much does the representation actually move in a small network trained on a real task? Laboratory E trains a two-dimensional classifier, snapshots hidden activations, and reports feature drift, kernel drift and a Fisher separation ratio, all computed from real forward passes, with the PCA limitation stated next to the projection.',
          },
          {
            kind: 'figure',
            figure: 'feature-drift',
          },
        ],
      },
      {
        heading: 'Kernel methods, nonlinear models and the interpolation between them',
        blocks: [
          {
            kind: 'p',
            text: 'A kernel method has no representation learning; a network has it. The infinite-width limit is therefore the boundary case that makes the network analytically tractable, and the 1/n expansion describes the departure from it. Generalization analyses that inherit the kernel picture should be read in that light.',
          },
          {
            kind: 'callout',
            tone: 'limitation',
            title: 'Honest scope note',
            text: 'This app measures the width dependence of feature drift in a small MLP on synthetic data. That is evidence for the qualitative finite-width picture, not a reproduction of the book\'s quantitative scaling laws for the dNTK.',
          },
        ],
      },
    ],
    experiment: { route: '/labs/representation', note: 'Train, snapshot, measure drift and separation.' },
    exercises: [
      {
        kind: 'code',
        prompt: 'Train the same two-moons network at widths 8, 32 and 128 for the same number of steps and compare the feature drift.',
        answer:
          'Drift decreases with width in the app\'s measurement — 0.24, 0.10 and 0.04 at widths 8, 32 and 128 at the small step size the figure uses — and the class separation is best in the middle rather than at either end (Fisher 0.61, 0.67, 0.64), so moving further is not the same as separating better. The trend is a property of the regime, not of the width alone: raise the learning rate and the wide network overshoots, moving further than the narrow one, and the ordering reverses. The app reports the numbers rather than a fitted law.',
      },
    ],
    citations: [
      { label: '§10.4', note: 'linear models, kernel methods and infinite-width networks' },
      { label: '§11.1-11.3', note: 'dNTK and representation learning' },
    ],
  },
];

export const LESSON_BY_ID: Record<string, Lesson> = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
