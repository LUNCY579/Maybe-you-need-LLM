import type { EquationEntry } from './types';

/**
 * The formula explorer: each entry carries the statement, every symbol it uses,
 * the assumptions under which it holds, a stepwise derivation sketch, a worked
 * numeric substitution, and a link to the laboratory that computes the same
 * quantity numerically.
 */

export const EQUATIONS: EquationEntry[] = [
  {
    id: 'warmup-gaussian',
    title: 'Gaussian second and fourth moments',
    tex: '\\mathbb{E}[z^2] = K, \\qquad \\mathbb{E}[z^4] = 3K^2, \\qquad z \\sim \\mathcal{N}(0, K)',
    ref: '§1.1',
    meaning: 'The two moments that make every first-layer calculation possible.',
    symbols: [
      { symbol: 'z', meaning: 'a centred Gaussian random variable (a preactivation, typically)' },
      { symbol: 'K', meaning: 'its variance — in network language, the kernel value K = q or K₁₁' },
    ],
    assumptions: ['z is exactly Gaussian', 'z is centred; a nonzero mean shifts the odd moments'],
    derivation: [
      'Start from the Gaussian integral ∫ dz e^{−z²/(2K)} = √(2πK).',
      'Differentiate once with respect to K: ∫ dz z² e^{−z²/(2K)} = K·√(2πK) after normalization gives E[z²] = K.',
      'Differentiate again: E[z⁴] = 3K², the value used in every Wick contraction of four fields.',
    ],
    example: {
      inputs: [
        { name: 'K', value: '2' },
        { name: 'E[z²]', value: 'K = 2' },
        { name: 'E[z⁴]', value: '3K² = 12' },
      ],
      result: '12',
    },
  },
  {
    id: 'forward-recursion',
    title: 'MLP forward recursion',
    tex: 'z^{(\\ell)} = W^{(\\ell)} h^{(\\ell-1)} + b^{(\\ell)}, \\qquad h^{(\\ell)} = \\sigma\\!\\left(z^{(\\ell)}\\right)',
    ref: 'eq. (4.1)',
    meaning: 'The object whose statistics the theory computes.',
    symbols: [
      { symbol: 'W^{(\\ell)}', meaning: 'weight matrix of layer ℓ, shape n_ℓ × n_{ℓ−1}' },
      { symbol: 'b^{(\\ell)}', meaning: 'bias vector of layer ℓ' },
      { symbol: '\\sigma', meaning: 'elementwise activation function' },
      { symbol: 'n_\\ell', meaning: 'width of layer ℓ; n₀ is the input dimension' },
    ],
    assumptions: ['the activation acts elementwise', 'the read-out is linear unless stated otherwise'],
    derivation: [
      'Apply the affine map W^(ℓ)h^(ℓ−1) + b^(ℓ).',
      'Insert the result into σ elementwise to obtain h^(ℓ).',
      'Iterate from h^(0) = x to the output layer.',
    ],
    example: {
      inputs: [
        { name: 'x', value: '[0.5, −1.25]' },
        { name: 'W^(1)', value: '2×2 matrix, entries ~ N(0, 1/n₀)' },
        { name: 'σ', value: 'tanh' },
      ],
      result: 'z^(1) = W^(1)x + b^(1), h^(1) = tanh(z^(1)) — evaluated exactly in Laboratory A',
    },
    relatedLab: '/labs/initialization',
  },
  {
    id: 'init-variance',
    title: 'Critical-scaled initialization',
    tex: 'W^{(\\ell)}_{ij} \\sim \\mathcal{N}\\!\\left(0, \\frac{C_W}{n_{\\ell-1}}\\right), \\qquad b^{(\\ell)}_i \\sim \\mathcal{N}(0, C_b)',
    ref: 'eq. (4.2)',
    meaning: 'The distribution that makes the infinite-width limit well defined.',
    symbols: [
      { symbol: 'C_W', meaning: 'rescaled weight variance (dimensionless, O(1))' },
      { symbol: 'C_b', meaning: 'bias variance' },
      { symbol: 'n_{\\ell-1}', meaning: 'fan-in of layer ℓ' },
    ],
    assumptions: ['weights are independent across layers and neurons', 'C_W and C_b are layer independent in the analysis'],
    derivation: [
      'A preactivation is a sum of n_{ℓ−1} terms each of size W·h.',
      'For the sum to have O(1) variance regardless of width, each weight variance must be O(1/n_{ℓ−1}).',
      'Criticality then fixes the O(1) constant C_W.',
    ],
    example: {
      inputs: [
        { name: 'n_{ℓ−1}', value: '64' },
        { name: 'C_W', value: '2 (ReLU critical)' },
        { name: 'Var(W)', value: '2/64 = 0.03125' },
      ],
      result: 'sd(W) ≈ 0.177',
      note: 'Verified empirically in the test suite by measuring the sample variance of the initialized weights.',
    },
  },
  {
    id: 'linear-covariance',
    title: 'Deep linear covariance',
    tex: 'G^{(\\ell)}_{12} = C_W^{\\ell} G^{(0)}_{12}',
    ref: 'eqs. (3.14)-(3.15)',
    meaning: 'The exactly solvable case, and the origin of the word criticality.',
    symbols: [
      { symbol: 'G^{(\\ell)}_{12}', meaning: 'width-averaged preactivation inner product for inputs x₁, x₂' },
      { symbol: 'G^{(0)}_{12}', meaning: 'input inner product x₁·x₂' },
    ],
    assumptions: ['linear activation', 'zero bias', 'weights drawn as in eq. (4.2)'],
    derivation: [
      'Write z^(ℓ+1) = W^(ℓ+1)z^(ℓ) and take the expectation of the inner product of two copies.',
      'The weights are independent of the preactivations, so Wick-contract them: E[W_iℓ W_jℓ] = (C_W/n_ℓ)δ_ij.',
      'The sum over the n_ℓ neurons cancels the 1/n_ℓ, leaving G^(ℓ+1) = C_W G^(ℓ), hence G^(ℓ) = C_W^ℓ G^(0).',
    ],
    example: {
      inputs: [
        { name: 'C_W', value: '1' },
        { name: 'G^(0)', value: '‖x‖²/n₀ = 1.5' },
        { name: 'ℓ', value: '40' },
      ],
      result: 'G^(40) = 1.5 — exactly preserved, layer after layer',
      note: 'At C_W = 0.9 the same quantity would be 1.5·0.9³⁹ ≈ 0.025.',
    },
    relatedLab: '/labs/initialization',
  },
  {
    id: 'chi-parallel',
    title: 'Parallel susceptibility',
    tex: '\\chi_\\parallel(K) = C_W\\, g\'(K) = \\frac{C_W}{2K^2}\\,\\mathbb{E}\\big[\\sigma(z)^2(z^2 - K)\\big]_K',
    ref: 'eq. (5.50)',
    meaning: 'Per-layer growth factor of a perturbation that changes the magnitude of an input.',
    symbols: [
      { symbol: 'g(K)', meaning: 'E[σ(z)²] for z ~ N(0,K)' },
      { symbol: '\\chi_\\parallel', meaning: 'growth factor of the parallel mode; equals one at criticality' },
    ],
    assumptions: ['infinite width (the kernel recursion is exact only in that limit)', 'Gaussian preactivations at each layer'],
    derivation: [
      'The single-input recursion is K^(ℓ+1) = C_b + C_W g(K^(ℓ)).',
      'Linearize around a fixed point K*: K^(ℓ) = K* + δ^(ℓ) gives δ^(ℓ+1) = C_W g′(K*) δ^(ℓ) + O(δ²).',
      'The stated integral form of g′(K) follows from differentiating under the Gaussian integral (identity (5.53)).',
    ],
    example: {
      inputs: [
        { name: 'Activation', value: 'tanh' },
        { name: 'C_W', value: '1' },
        { name: 'K*', value: '0' },
      ],
      result: 'χ∥ = C_W·g′(0) = 1·(γ₁² + γ₀γ₂) = 1 — criticality',
      note: 'γ₁ = 1 and γ₀ = 0 for tanh, so the value is exactly 1.',
    },
    relatedLab: '/labs/initialization',
  },
  {
    id: 'chi-perp',
    title: 'Perpendicular susceptibility',
    tex: '\\chi_\\perp(K) = C_W\\, \\mathbb{E}_{z\\sim\\mathcal{N}(0,K)}\\big[\\sigma\'(z)^2\\big]',
    ref: 'eq. (5.51)',
    meaning: 'Per-layer growth factor of a perturbation that changes the direction of an input at fixed magnitude.',
    symbols: [
      { symbol: '\\sigma\'', meaning: 'derivative of the activation' },
      { symbol: '\\chi_\\perp', meaning: 'growth factor of the angular mode' },
    ],
    assumptions: ['same as χ∥: infinite width, Gaussian preactivations'],
    derivation: [
      'Rotate the two-input kernel into the basis K^{[0]}, K^{[1]}, K^{[2]} of eq. (5.15).',
      'The [2] component measures D = E[(z₊ − z₋)²], the squared difference of two same-magnitude inputs.',
      'Its linearized recursion is K^{[2](ℓ+1)} = χ⊥(K*)K^{[2](ℓ)} + h(K*)K^{[1](ℓ)}, so χ⊥ governs the angular mode.',
    ],
    example: {
      inputs: [
        { name: 'Activation', value: 'ReLU' },
        { name: 'C_W', value: '2' },
        { name: 'K', value: 'any' },
      ],
      result: 'χ⊥ = 2·E[σ′(z)²] = 2·(1/2) = 1 for every K — scale invariance makes criticality exact',
    },
    relatedLab: '/labs/initialization',
  },
  {
    id: 'criticality-conditions',
    title: 'The two criticality conditions',
    tex: '\\chi_\\parallel(K_*) = 1, \\qquad \\chi_\\perp(K_*) = 1, \\qquad K_* = C_b + C_W g(K_*)',
    ref: 'eqs. (5.55)-(5.56)',
    meaning: 'The definition of a well-behaved deep initialization.',
    symbols: [
      { symbol: 'K_*', meaning: 'the nontrivial fixed point of the kernel recursion' },
      { symbol: 'C_b, C_W', meaning: 'the two initialization hyperparameters to be determined' },
    ],
    assumptions: ['the fixed point exists and is nontrivial', 'C_b ≥ 0 is required physically'],
    derivation: [
      'Require that perturbations of both kinds neither explode nor vanish: both susceptibilities equal one.',
      'Together with the fixed-point equation this gives three conditions for three unknowns (C_b, C_W, K*).',
      'For scale-invariant activations the susceptibilities are K independent, so the equations decouple and (C_b,C_W) = (0, 1/A²).',
    ],
    example: {
      inputs: [
        { name: 'Activation', value: 'tanh' },
        { name: 'Solution', value: 'K* = 0, C_b = 0, C_W = 1/γ₁² = 1' },
      ],
      result: '(C_b, C_W) = (0, 1) — the canonical K = 0 class point',
    },
    relatedLab: '/labs/initialization',
  },
  {
    id: 'scale-invariant-critical',
    title: 'Scale-invariant criticality and Kaiming initialization',
    tex: '(C_b, C_W)^{\\text{crit}} = \\left(0, \\frac{1}{A^2}\\right), \\qquad A^2 = \\frac{a_+^2 + a_-^2}{2}',
    ref: 'eqs. (5.60)-(5.67)',
    meaning: 'He/Kaiming initialization derived from a principle rather than tuned empirically.',
    symbols: [
      { symbol: 'a_+', meaning: 'slope for positive preactivations' },
      { symbol: 'a_-', meaning: 'slope for negative preactivations' },
      { symbol: 'A^2', meaning: 'the resulting constant, (a₊² + a₋²)/2' },
    ],
    assumptions: ['the activation is exactly scale invariant', 'C_b = 0 for a line of nontrivial fixed points'],
    derivation: [
      'For σ(z) = a_±z, compute g(K) = A²K by two Gaussian integrals on half-lines.',
      'Both susceptibilities collapse to the constant A²C_W.',
      'Setting them equal to one gives C_W = 1/A²; the ReLU (A² = 1/2) reproduces the familiar factor of two.',
    ],
    example: {
      inputs: [
        { name: 'ReLU', value: 'a₊ = 1, a₋ = 0 → A² = 0.5' },
        { name: 'Leaky ReLU(0.25)', value: 'a₋ = 0.25 → A² = 0.53125' },
      ],
      result: 'C_W = 2.000 and C_W = 1.882 respectively',
      note: 'Both values are reproduced by the app\'s criticality scanner using numerical quadrature.',
    },
    relatedLab: '/labs/initialization',
  },
  {
    id: 'second-condition',
    title: 'The numerical criticality condition',
    tex: '\\frac{2K_*^2\\,\\mathbb{E}[\\sigma\'(z)^2]_{K_*}}{\\mathbb{E}[\\sigma(z)^2(z^2 - K_*)]_{K_*}} = 1',
    ref: 'eq. (5.73)',
    meaning: 'A single dimensionless equation to scan for the fixed-point value K*.',
    symbols: [
      { symbol: 'K_*', meaning: 'candidate fixed-point kernel value' },
      { symbol: '\\mathbb{E}[\\cdot]_{K_*}', meaning: 'expectation under z ~ N(0, K*)' },
    ],
    assumptions: ['C_W and C_b are then fixed by eqs. (5.71)-(5.72) and must satisfy C_b ≥ 0'],
    derivation: [
      'Fix a candidate K*. Set C_W = 1/g′(K*) so that χ∥ = 1 automatically.',
      'Set C_b = K* − C_W g(K*) so that K* is a fixed point.',
      'The remaining condition χ⊥ = 1 becomes the ratio above, independent of the hyperparameters.',
    ],
    example: {
      inputs: [
        { name: 'sigmoid at K* → 0', value: 'ratio → γ₁²/(γ₁² + γ₀γ₂) = 1' },
        { name: 'implied C_b', value: '−σ(0)²/σ′(0)² = −4 < 0 → unphysical' },
      ],
      result: 'no critical initialization for the sigmoid',
      note: 'The app\'s scanner plots this ratio for every activation in the registry.',
    },
    relatedLab: '/labs/initialization',
  },
  {
    id: 'kzero-power-law',
    title: 'K = 0 class: power-law kernel decay',
    tex: 'K^{(\\ell)} = \\frac{1}{(-a_1)\\,\\ell} + \\cdots, \\qquad a_1 = \\gamma_1\\gamma_3 + \\tfrac{3}{4}\\gamma_2^2',
    ref: 'eqs. (5.90)-(5.92)',
    meaning: 'Why tanh and sin survive at criticality while decaying gently.',
    symbols: [
      { symbol: '\\gamma_p', meaning: 'Taylor coefficients of σ: σ(z) = Σ γ_p z^p/p!' },
      { symbol: 'a_1', meaning: 'coefficient of K² in g(K); negative for tanh and sin' },
      { symbol: '\\ell', meaning: 'layer index' },
    ],
    assumptions: ['σ(0) = 0 and σ′(0) ≠ 0', 'C_W = 1/γ₁², C_b = 0', 'large ℓ (asymptotic statement)'],
    derivation: [
      'Expand g(K) = γ₁²K + a₁K² + … using the Taylor expansion of σ and Gaussian moments.',
      'The recursion becomes K^(ℓ+1) = K^(ℓ) + a₁(K^(ℓ))², i.e. dK/dℓ = a₁K² in the continuum.',
      'Integrating gives K^(ℓ) ≈ 1/((−a₁)ℓ): a universal exponent 1 with an activation-dependent coefficient.',
    ],
    example: {
      inputs: [
        { name: 'tanh', value: 'γ₁ = 1, γ₃ = −2 → a₁ = −2' },
        { name: 'sin', value: 'γ₁ = 1, γ₃ = −1 → a₁ = −1' },
        { name: 'ℓ', value: '200' },
      ],
      result: 'K^(200) ≈ 0.0025 (tanh) versus ≈ 0.005 (sin)',
      note: 'The exact recursion (quadrature) gives slightly larger values due to the O(1) offset and K³ corrections; the app displays both.',
    },
    relatedLab: '/labs/initialization',
  },
  {
    id: 'fluctuation-law',
    title: 'Finite-width fluctuation law',
    tex: '\\mathrm{Var}\\Big[\\tfrac{1}{n}\\textstyle\\sum_j (z_j^{(\\ell)})^2\\Big] = \\frac{2\\ell\\,(G^{(2)})^2}{n} + O\\!\\left(\\frac{1}{n^2}\\right)',
    ref: 'eqs. (3.28), (3.33)',
    meaning: 'How strongly one instantiation deviates from the ensemble average, and how that grows with depth.',
    symbols: [
      { symbol: 'G^{(2)}', meaning: 'the kernel K^(ℓ), constant in ℓ at criticality' },
      { symbol: 'n', meaning: 'hidden width' },
      { symbol: '\\ell', meaning: 'layer index' },
    ],
    assumptions: ['deep linear network', 'critical initialization C_W = 1', 'single input', 'leading order in 1/n'],
    derivation: [
      'Compute the connected four-point correlator of a deep linear network: G⁽⁴⁾ − (G⁽²⁾)² = 2(ℓ−1)(G⁽²⁾)²/n.',
      'The variance of the layer observable picks up this connected piece plus a 2G⁽⁴⁾/n term.',
      'Combining them gives Var = 2ℓ(G⁽²⁾)²/n to leading order — linear in depth, suppressed by width.',
    ],
    example: {
      inputs: [
        { name: 'ℓ', value: '10' },
        { name: 'n', value: '64' },
        { name: 'G^(2)', value: '1' },
      ],
      result: 'Var ≈ 20/64 = 0.3125, sd ≈ 0.56 — verified in the app against 400 seeded networks',
    },
    relatedLab: '/labs/width-depth',
  },
  {
    id: 'ntk-definition',
    title: 'Neural tangent kernel',
    tex: '\\Theta_{i_1i_2;12} = \\sum_\\theta \\frac{\\partial z_{i_1}(x_1)}{\\partial \\theta}\\cdot\\frac{\\partial z_{i_2}(x_2)}{\\partial \\theta}',
    ref: 'eq. (7.17)',
    meaning: 'The kernel that governs how outputs change under gradient descent.',
    symbols: [
      { symbol: '\\theta', meaning: 'all trainable parameters, weights and biases' },
      { symbol: 'z_{i}(x)', meaning: 'output component i of the network on input x' },
      { symbol: '\\Theta', meaning: 'the NTK; a Gram matrix of parameter gradients' },
    ],
    assumptions: ['differentiable model', 'independent of the loss function used for training'],
    derivation: [
      'A gradient step changes parameters by Δθ = −η g.',
      'Expand an observable to first order in Δθ and collect the parameter gradients.',
      'The term multiplying the loss gradient is the NTK; its off-diagonal sample entries transfer learning between examples.',
    ],
    example: {
      inputs: [
        { name: 'Model', value: 'f(x) = w·x + b (single linear layer)' },
        { name: 'Gradient pieces', value: '∂f/∂w_k = x_k, ∂f/∂b = 1' },
      ],
      result: 'Θ(x,x′) = x·x′ + 1 — checked exactly in the test suite',
    },
    relatedLab: '/labs/ntk',
  },
  {
    id: 'ntk-recursion',
    title: 'Frozen NTK recursion',
    tex: '\\Theta^{(\\ell+1)} = K^{(\\ell+1)} + \\chi_\\perp^{(\\ell+1)}\\,\\Theta^{(\\ell)}, \\qquad \\Theta^{(1)} = K^{(1)}',
    ref: 'eqs. (9.5)-(9.7)',
    meaning: 'How the kernel of the frozen NTK builds up with depth.',
    symbols: [
      { symbol: '\\Theta^{(\\ell)}', meaning: 'the ℓ-th-layer NTK, in the normalization of eqs. (8.6)-(8.7)' },
      { symbol: '\\chi_\\perp', meaning: 'the same perpendicular susceptibility as in the criticality analysis' },
    ],
    assumptions: [
      'infinite width (the mean NTK)',
      'weight learning rates rescaled by 1/n_{ℓ−1}, as in eq. (8.6)',
      'single-input (diagonal) evaluation of χ⊥',
    ],
    derivation: [
      'Split the parameter sum of the (ℓ+1)-th-layer NTK into its own layer plus all earlier layers.',
      'The own-layer piece is the kernel K^(ℓ+1); the earlier layers propagate through the derivative kernel E[σ′σ′] = χ⊥/C_W.',
      'Iterating gives Θ^(ℓ+1) = K^(ℓ+1) + χ⊥Θ^(ℓ) with the first-layer initial condition Θ^(1) = K^(1).',
    ],
    example: {
      inputs: [
        { name: 'Linear net, C_W = 1, C_b = 0', value: 'K^(ℓ) = K^(1), χ⊥ = 1' },
        { name: 'Depth', value: 'L' },
      ],
      result: 'Θ^(L) = L·K^(1) — each layer contributes the input kernel once',
      note: 'For the raw (un-normalized) NTK the read-out term instead grows linearly with the hidden width; the app measures both.',
    },
    relatedLab: '/labs/ntk',
  },
  {
    id: 'kernel-learning',
    title: 'Kernel-learning dynamics',
    tex: 'z(x; t+1) - z(x; t) = -\\eta \\sum_{\\tilde x \\in \\mathcal{A}} \\Theta_{x\\tilde x}\\, \\frac{\\partial L_{\\mathcal{A}}}{\\partial z(\\tilde x)}',
    ref: 'eqs. (7.19)-(7.20)',
    meaning: 'Training as linear evolution in function space when the NTK is frozen.',
    symbols: [
      { symbol: '\\mathcal{A}', meaning: 'the training set' },
      { symbol: '\\eta', meaning: 'learning rate' },
      { symbol: 'L_{\\mathcal{A}}', meaning: 'training loss' },
    ],
    assumptions: ['small learning rate (first-order expansion)', 'frozen NTK — exact only at infinite width'],
    derivation: [
      'Take the first-order Taylor expansion of an observable in the parameter change.',
      'Substitute the gradient-descent update Δθ = −η∂L/∂θ.',
      'Identify the NTK as the coefficient of the loss gradient; for MSE the loss gradient is the prediction error.',
    ],
    example: {
      inputs: [
        { name: 'Training set', value: 'one example' },
        { name: 'Loss', value: 'MSE' },
        { name: 'Θ', value: 'constant in time' },
      ],
      result: 'error decays geometrically: ε(t) = (1 − ηΘ)^t ε(0) — the loss curve of the app\'s optimization lab in the linear regime',
    },
    relatedLab: '/labs/landscape',
  },
  {
    id: 'gradient-descent-stability',
    title: 'Gradient-descent stability for a quadratic loss',
    tex: '\\theta_{t+1} = \\theta_t - \\eta\\, H\\, \\theta_t \\quad\\text{converges} \\iff \\eta < \\frac{2}{\\lambda_{\\max}(H)}',
    ref: '§7.2, §10.2',
    meaning: 'Why too large a learning rate makes the loss explode, and where the threshold sits.',
    symbols: [
      { symbol: 'H', meaning: 'Hessian of the loss; for a linear read-out H = (2/M)ΦᵀΦ' },
      { symbol: '\\lambda_{\\max}', meaning: 'largest eigenvalue of H — the curvature of the stiffest direction' },
    ],
    assumptions: ['quadratic (linear-model) loss', 'full-batch gradient descent', 'fixed learning rate'],
    derivation: [
      'Diagonalize H; in the eigenbasis each mode evolves independently as (1 − ηλ_i)^t.',
      'A mode converges iff |1 − ηλ_i| < 1, i.e. η < 2/λ_i.',
      'The binding constraint is the largest eigenvalue, giving the stated threshold.',
    ],
    example: {
      inputs: [
        { name: 'Read-out features', value: 'computed from the frozen hidden layer' },
        { name: 'λ_max(H)', value: 'measured from the feature Gram matrix' },
      ],
      result: 'the app displays λ_max, the predicted threshold 2/λ_max and the measured loss curves on both sides of it',
    },
    relatedLab: '/labs/landscape',
  },
  {
    id: 'dntk',
    title: 'Differential of the NTK',
    tex: '\\frac{d\\Theta}{dt} = \\left(\\frac{\\partial \\Theta}{\\partial \\theta}\\right)\\cdot\\dot\\theta \\;\\propto\\; \\frac{1}{n}',
    ref: '§11.1-11.2',
    meaning: 'The quantitative measure of representation learning.',
    symbols: [
      { symbol: 'd\\Theta/dt', meaning: 'time derivative of the NTK along the training trajectory' },
      { symbol: 'n', meaning: 'hidden width' },
    ],
    assumptions: ['finite width, since the object vanishes identically at infinite width'],
    derivation: [
      'Differentiate the NTK definition with respect to training time.',
      'The derivative is nonzero only because the parameter gradients depend on the parameters themselves.',
      'That dependence is mediated by four-point (interaction) vertices, whose size is suppressed by 1/n.',
    ],
    example: {
      inputs: [
        { name: 'Measured quantity', value: '‖Θ(t) − Θ(0)‖_F / ‖Θ(0)‖_F in Laboratory E' },
      ],
      result: 'decreases with width in the app\'s measurements; the exact rate depends on the task and hyperparameters',
    },
    relatedLab: '/labs/representation',
  },
];

export const EQUATION_BY_ID: Record<string, EquationEntry> = Object.fromEntries(EQUATIONS.map((e) => [e.id, e]));
