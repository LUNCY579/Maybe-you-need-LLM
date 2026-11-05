import type { ExperimentPreset } from './types';

/**
 * The experiment gallery. Each preset is a complete, reproducible configuration:
 * the seed is part of the preset, and the "expected" field states what the app
 * should show. These are hypotheses with stated outcomes, not illustrations.
 */

export const EXPERIMENTS: ExperimentPreset[] = [
  {
    id: 'critical-linear',
    name: 'Critical deep linear network',
    lab: 'initialization',
    hypothesis: 'With C_W = 1 the kernel is preserved exactly at every layer, in the ensemble mean.',
    description:
      'A 12-layer linear network, width 128, zero bias, C_W = 1. The kernel profile should be flat (up to finite-width scatter). Compare with C_W = 0.9 and C_W = 1.1 to see exponential decay and explosion.',
    settings: { activation: 'linear', Cw: 1, Cb: 0, depth: 12, width: 128, samples: 64, seeds: 8 },
    expected:
      'Measured mean kernel K^(ℓ) constant to within a few per cent across depth; theory curve for C_W = 1.1 rises by 1.1^11 ≈ 2.9 and for C_W = 0.9 falls by 0.9^11 ≈ 0.31.',
    seed: 1,
  },
  {
    id: 'relu-kaiming',
    name: 'ReLU at the Kaiming point',
    lab: 'initialization',
    hypothesis: 'C_W = 2 = 1/A² keeps the ReLU kernel constant, confirming Kaiming initialization from criticality.',
    description:
      '16-layer ReLU network, width 128, zero bias, C_W = 2. Then re-run at C_W = 1.5 and C_W = 2.5 to see collapse and blow-up.',
    settings: { activation: 'relu', Cw: 2, Cb: 0, depth: 16, width: 128, samples: 64, seeds: 8 },
    expected:
      'Flat kernel profile at C_W = 2; a factor ≈ 0.75^15 ≈ 0.013 collapse at C_W = 1.5 and a ≈ 1.25^15 ≈ 28-fold growth at C_W = 2.5 (theory is exact for the scale-invariant class).',
    seed: 2,
  },
  {
    id: 'tanh-power-law',
    name: 'tanh: the K = 0 power law',
    lab: 'initialization',
    hypothesis: 'At C_W = 1 the tanh kernel decays as 1/(2ℓ) rather than exponentially.',
    description:
      'A 200-layer tanh network, width 256, zero bias, C_W = 1. The measured profile is compared with the exact quadrature recursion and with the asymptotic law 1/(2(ℓ−1) + 1/K^(1)).',
    settings: { activation: 'tanh', Cw: 1, Cb: 0, depth: 200, width: 256, samples: 32, seeds: 4 },
    expected:
      'K^(ℓ) ≈ 1/(2ℓ) in the deep layers: at ℓ = 200 the asymptotic law gives 0.0025 while the exact recursion gives a slightly larger value because of the O(1) offset.',
    seed: 3,
  },
  {
    id: 'sigmoid-no-criticality',
    name: 'Sigmoid cannot be critical',
    lab: 'initialization',
    hypothesis: 'The sigmoid satisfies the ratio condition only at K* = 0, where C_b would be negative.',
    description:
      'Open the criticality scanner for the sigmoid. The scanner reports the root at K* = 0 with C_b = −σ(0)²/σ′(0)² = −4, flagged unphysical. Compare with softplus, where no root exists at all.',
    settings: { activation: 'sigmoid', Cw: 16, Cb: 0, depth: 12, width: 128, samples: 64, seeds: 8 },
    expected:
      'The scanner lists one root for sigmoid (unphysical, C_b < 0) and none for softplus. Running the forward pass at C_W = 16 shows an exploding kernel because χ∥ = C_Wγ₁² = 1 only at K* = 0.',
    seed: 4,
  },
  {
    id: 'linear-fluctuations',
    name: 'Fluctuations grow with depth at criticality',
    lab: 'width-depth',
    hypothesis: 'Var[O^(ℓ)] = 2ℓ(G⁽²⁾)²/n for a critical deep linear network.',
    description:
      'Sweep depth at fixed width (and width at fixed depth) and record the seed-to-seed variance of the layer observable. The measured variance is compared with the analytic 2ℓ/n law.',
    settings: { activation: 'linear', Cw: 1, Cb: 0, depth: 12, width: 64, seeds: 200 },
    expected:
      'Variance grows linearly with ℓ at fixed n and falls as 1/n at fixed ℓ, so a constant depth-to-width ratio leaves the fluctuation size unchanged.',
    seed: 5,
  },
  {
    id: 'landscape-convex',
    name: 'Convex read-out landscape and the stability threshold',
    lab: 'landscape',
    hypothesis: 'For a quadratic read-out loss, gradient descent converges iff η < 2/λ_max.',
    description:
      'Freeze a tanh hidden layer, train only the read-out, and step the learning rate across the measured threshold 2/λ_max(H). The loss history is compared with the closed-form prediction L(t) = L* + Σ_k (λ_k/2)(u_k·δ)²(1 − ηλ_k)^{2t}.',
    settings: { sliceKind: 'readout', learningRate: 0.4, steps: 60, hidden: 8 },
    expected:
      'Below the threshold the measured loss tracks the analytic curve mode by mode; above it the loss grows without bound after a few steps.',
    seed: 11,
  },
  {
    id: 'landscape-nonconvex',
    name: 'Non-convex slice of a real network',
    lab: 'landscape',
    hypothesis: 'Training two hidden weights gives a genuinely non-convex landscape with saddle-like structure.',
    description:
      'Switch the objective to the hidden-parameter slice: two first-layer weights move while everything else is frozen. The surface, gradient arrows and trajectory all come from real forward/backward passes.',
    settings: { sliceKind: 'hidden', learningRate: 0.05, steps: 80, hidden: 8 },
    expected:
      'Local curvature (the numerically differentiated Hessian, reported with its eigenvalues) changes sign across the surface, and the trajectory can stall on flat regions or slide along valleys depending on the starting point.',
    seed: 12,
  },
  {
    id: 'ntk-two-layer',
    name: 'Empirical NTK versus the closed form',
    lab: 'ntk',
    hypothesis:
      'For a 2-layer network the ensemble-averaged NTK equals C_W·K̇·(x·x′ + 1) + n₁·g + 1, and the discrepancy shrinks as the width grows.',
    description:
      'Assemble the NTK from exact Jacobians for several widths, average over seeds, and compare with the closed form derived from the definition of the NTK.',
    settings: { activation: 'tanh', Cw: 1, Cb: 0, depth: 2, width: 128, samples: 5, seeds: 24 },
    expected:
      'Relative Frobenius error ≈ 24% at width 32, ≈ 14% at width 128 and ≈ 7% at width 512 — the app reports the measured numbers for the widths you choose.',
    /**
     * The numbers the expected outcome states, so that a test can check them
     * against a fresh measurement. A gallery that quotes a number the
     * application does not produce is a gallery that cannot be trusted.
     */
    measured: [
      { width: 32, relativeError: 0.236, tolerance: 0.03 },
      { width: 128, relativeError: 0.136, tolerance: 0.02 },
      { width: 512, relativeError: 0.07, tolerance: 0.015 },
    ],
    seed: 21,
  },
  {
    id: 'ntk-defrosting',
    name: 'The NTK defrosts during training',
    lab: 'ntk',
    hypothesis: 'At finite width the empirical NTK drifts during training, and the drift is larger for narrower networks.',
    description:
      'Train a small network and track ‖Θ(t) − Θ(0)‖_F/‖Θ(0)‖_F at widths 8, 32 and 128 for the same number of steps.',
    settings: { activation: 'tanh', Cw: 1, Cb: 0, depth: 3, width: 32, samples: 5, steps: 200, learningRate: 0.05 },
    expected:
      'Kernel drift decreases with width; the app prints the measured drift for each width rather than a fitted law.',
    seed: 22,
  },
  {
    id: 'representation-drift',
    name: 'Feature drift shrinks with width',
    lab: 'representation',
    hypothesis: 'Hidden features move less during training as the network widens — the finite-width route to representation learning.',
    description:
      'Train the same two-moons classifier at widths 8, 32 and 128 and compare feature drift, Fisher class separation and training loss reduction.',
    settings: { dataset: 'two-moons', activation: 'tanh', Cw: 1, width: 32, steps: 300, learningRate: 0.01 },
    expected:
      'At this step size the feature drift falls as the width grows — 0.24, 0.10 and 0.04 at widths 8, 32 and 128 — while the class separation is best in the middle rather than at either end (Fisher 0.61, 0.67, 0.64): moving further is not the same as separating better. Raise the learning rate and the wide network overshoots instead, and the drift ordering reverses: the prediction belongs to the small-drift regime.',
    seed: 31,
  },
  {
    id: 'physics-critical-sweep',
    name: 'Physics lab: the criticality sweep',
    lab: 'physics',
    hypothesis: 'Signal propagation is flat only near the critical C_W predicted by the scanner.',
    description:
      'Use the physics laboratory to sweep C_W from 0.5 to 3 at fixed depth and activation, recording the endpoint kernel, the gradient norm and the fluctuation size.',
    settings: { activation: 'tanh', Cw: 1, Cb: 0, depth: 16, width: 128 },
    expected:
      'The endpoint kernel is an increasing function of C_W crossing flatness near the critical value; the seed-to-seed spread is smallest near criticality for the same depth.',
    seed: 41,
  },
];

export const EXPERIMENT_BY_ID: Record<string, ExperimentPreset> = Object.fromEntries(EXPERIMENTS.map((e) => [e.id, e]));
