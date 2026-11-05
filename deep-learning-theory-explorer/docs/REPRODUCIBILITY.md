# Reproducibility

Every experiment in this application is a pure function of a configuration and a
seed. This document records the seeding scheme exactly, and gives a recipe for each
of the eleven gallery presets so that any result can be re-derived by hand.

---

## 1. The random number generator

`src/lib/numerics/rng.ts` implements a single generator used everywhere:

- **Algorithm**: `mulberry32`, a 32-bit counter-based generator.
- **State**: the seed, `seed >>> 0`. A seed of `0` is remapped to `0x9e3779b9`
  (the golden-ratio constant) so that "no seed" is not a fixed point.
- **Uniforms**: `next()` returns a float in `[0, 1)`.
- **Normals**: the Marsaglia polar method, which keeps one spare draw. Normals are
  therefore *not* a simple function of the uniform stream index; they consume a
  variable number of uniforms.
- **String seeds**: `seedFromString(s)` is a 32-bit FNV-1a hash, so a string such
  as `"critical-tanh"` maps to a stable numeric seed.

Consequences worth knowing:

- The stream is fully determined by the seed. Two runs with the same seed and the
  same sequence of calls produce bit-identical numbers.
- The generator is *not* cryptographically secure and is not a statistical
  reference implementation. It is a small, fast, well-tested-in-practice PRNG with
  a hard reproducibility guarantee, which is what an educational laboratory needs.
- Normal samples are generated with the polar method, so the *number* of uniforms
  consumed depends on the values drawn. If you re-implement the stream, reproduce
  the polar method exactly, including the spare.

### Scaled-uniform alternative

The application also offers a uniform initialization with matched variance:
`U = √3 · U(−1, 1) · scale`, which has variance `scale²`. This exists so that a
student can check that the criticality results are a property of the *variance* and
not of the Gaussianity of the initialization. The book's theory assumes the
Gaussian choice, and the app says so.

---

## 2. How a seed propagates

Each runner derives its sub-seeds deterministically from the single "master seed"
that the user types in. The derivations are fixed constants, not hash functions, so
they can be reproduced by hand.

| Runner | Sub-seeds |
| --- | --- |
| `runInitialization` (Lab A, Physics lab) | inputs: `seed·977 + 13`; networks: `seed·131 + i`, `i = 0 … seeds−1` |
| `runPhysicsLab` | as above, plus the trained network: `seed·131` |
| `runWidthDepthSweep` (Lab C) | inputs: `seed·613 + 7`; sweep networks: `seed·7717 + s`; histogram networks: `seed·91 + 3` |
| `runNtkAnalysis`, `runNtkWidthScaling` (Lab D) | inputs: `seed·31 + 5`; networks: `seed·977 + s` |
| `runRepresentation` (Lab E) | dataset and network both: `seed` directly |
| `buildObjective` (Lab B) | the feature network: `seed` directly; the read-out slice is deterministic given it |

The physics lab's *training* network is deliberately distinct from the ensemble
networks: the ensemble is used for the layer statistics, and a separate
instantiation is trained for the loss trajectory, so that training never
contaminates the measured initialization statistics.

---

## 3. The eleven gallery presets

Open the **Experiment gallery** (`/#/gallery`) in the app for the same
information, with links into the relevant laboratory. The settings below are the
`settings` field of each preset in `src/content/experiments.ts`. Clicking a preset
in the gallery loads those settings into the laboratory, so the list below is a
recipe you can either follow by hand or run with one click.

### 1. `critical-linear` — Critical deep linear network *(Lab A, seed 1)*

```
activation = linear   C_W = 1   C_b = 0
depth = 12   width = 128   input samples = 64   networks = 8
```

**Expect.** The measured kernel profile is flat to within a few per cent across
depth. The theory curve for `C_W = 1.1` rises by `1.1¹¹ ≈ 2.9`; for `C_W = 0.9` it
falls by `0.9¹¹ ≈ 0.31`. The theory is *exact* for the linear activation at
infinite width: `G^(ℓ) = C_W^ℓ G^(0)`, eq. (3.15).

### 2. `relu-kaiming` — ReLU at the Kaiming point *(Lab A, seed 2)*

```
activation = relu   C_W = 2   C_b = 0
depth = 16   width = 128   input samples = 64   networks = 8
```

**Expect.** Flat kernel profile at `C_W = 2`. At `C_W = 1.5` the factor is
`≈ 0.75¹⁵ ≈ 0.013` (collapse); at `C_W = 2.5` it is `≈ 1.25¹⁵ ≈ 28` (growth).
This is exact for the scale-invariant class, where `χ∥ = χ⊥ = A²C_W` with
`A² = 1/2` for the ReLU, so `C_W = 1/A² = 2`, eq. (5.67).

### 3. `tanh-power-law` — the `K = 0` power law *(Lab A, seed 3)*

```
activation = tanh   C_W = 1   C_b = 0
depth = 200   width = 256   input samples = 32   networks = 4
```

**Expect.** `K^(ℓ) ≈ 1/(2ℓ)` in the deep layers. At `ℓ = 200` the asymptotic law
gives `0.0025`, while the exact recursion gives a slightly larger value because
the asymptotic form drops an `O(1)` offset. The coefficient `a₁ = −2` is the one
computed in eq. (5.86) for `tanh`.

### 4. `sigmoid-no-criticality` — Sigmoid cannot be critical *(Lab A, seed 4)*

```
activation = sigmoid   C_W = 16   C_b = 0
depth = 12   width = 128   input samples = 64   networks = 8
```

**Expect.** The criticality scanner lists one root for the sigmoid, flagged
unphysical because `C_b = −σ(0)²/σ′(0)² = −4 < 0`. The softplus has no root at
all. Running the forward pass at `C_W = 16` shows an exploding kernel, because
`χ∥ = C_W γ₁² = 1` only at `K* = 0`.

### 5. `linear-fluctuations` — fluctuations grow with depth at criticality *(Lab C, seed 5)*

```
activation = linear   C_W = 1   C_b = 0
depth = 12   width = 64   networks per point = 200   input samples = 32
```

The laboratory sweeps both directions, whatever the preset sets the fixed
value to:

```
depth sweep: 2,3,4,6,8,12,16,24,32 at the preset's width
width sweep: 16,32,64,128,256,512 at the preset's depth
```

**Expect.** The measured variance of `O^(ℓ) = (1/n) Σ_j (z_j^(ℓ))²` across
instantiations grows linearly in `ℓ` at fixed `n` and falls as `1/n` at fixed `ℓ`,
so a constant depth-to-width ratio leaves the fluctuation size unchanged. The
analytic reference attached to the chart is `2ℓ(G⁽²⁾)²/n` for the deep linear
network, eq. (3.33).

### 6. `landscape-convex` — the convex read-out landscape *(Lab B, seed 11)*

```
slice = readout   learning rate = 0.4   steps = 60   hidden units = 8
```

**Expect.** Below the measured threshold `2/λ_max(H)` the loss tracks the
closed-form mode-by-mode prediction `L(t) = L* + Σ_k (λ_k/2)(u_k·δ)²(1 − ηλ_k)^{2t}`;
above it the loss grows without bound after a few steps.

### 7. `landscape-nonconvex` — a non-convex slice of a real network *(Lab B, seed 12)*

```
slice = hidden   learning rate = 0.05   steps = 80   hidden units = 8
```

**Expect.** The numerically differentiated Hessian changes sign across the
surface — there are regions of positive and negative determinant — and the
trajectory can stall on flat regions or slide along valleys depending on the
starting point.

### 8. `ntk-two-layer` — empirical NTK versus the closed form *(Lab D, seed 21)*

```
activation = tanh   C_W = 1   C_b = 0
depth = 2   width = 128   inputs = 5   networks = 24
```

**Expect.** The relative Frobenius error between the ensemble-averaged empirical
NTK and the closed form `C_W·K̇·(x·x′ + 1) + n₁·g + 1` is roughly 24 % at width
32, 14 % at width 128 and 7 % at width 512. The app prints the measured numbers
for the widths you choose; these are the reference values, and
`tests/gallery.test.ts` recomputes them with the same code the laboratory runs.

### 9. `ntk-defrosting` — the NTK defrosts during training *(Lab D, seed 22)*

```
activation = tanh   C_W = 1   C_b = 0
depth = 3   width = 32   inputs = 5   steps = 200   learning rate = 0.05
```

**Expect.** `‖Θ(t) − Θ(0)‖_F / ‖Θ(0)‖_F` decreases as the width grows at a fixed
step count. The app prints the measured drift for each width rather than fitting a
law to it.

### 10. `representation-drift` — how far the representation moves *(Lab E, seed 31)*

```
dataset = two-moons   activation = tanh   C_W = 1
width = 32   steps = 300   learning rate = 0.01   samples = 120
```

**Expect.** At this step size the feature drift falls as the width grows — `0.24`,
`0.10` and `0.04` at widths 8, 32 and 128 — while the class separation is best
in the middle rather than at either end (Fisher `0.61`, `0.67`, `0.64`): moving
further is not the same as separating better.

The step size is part of the claim. Raise it to `0.1` and the wide network
overshoots instead, moving further than the narrow one, and the drift ordering
reverses. The prediction belongs to the small-drift regime.

### 11. `physics-critical-sweep` — the criticality sweep *(Physics lab, seed 41)*

```
activation = tanh   C_W = 1   C_b = 0
depth = 16   width = 128
```

**Expect.** The endpoint kernel is an increasing function of `C_W` that flattens
near the critical value found by the scanner, and the seed-to-seed spread is
smallest near criticality at the same depth.

---

## 4. Reproducing a run by hand

1. Open the **Experiment gallery** (`/#/gallery`) and click a preset. The link
   carries the preset in the URL (`/#/labs/initialization?preset=relu-kaiming`), the
   laboratory applies its settings, and the laboratory shows a banner with the
   hypothesis, the expected outcome and the seed. Every control in the laboratory
   now holds the preset's value, so you can see the recipe and change it.
2. Press **run again**. The same seed and the same settings give bit-identical
   numbers: the runner derives its sub-seeds from the master seed by the
   constants in §2, and the RNG is fully deterministic.
3. To check the seeding yourself, open the **Sources & licensing** screen and the
   laboratory's own notes panel: both state the number of seeds, the number of
   input samples and the seed that produced the numbers on screen.
4. To verify a claim against the theory, use the laboratory's analytic curve
   (drawn in a different colour and named in the legend) and the equation
   explorer, which lists the exact reference and the assumptions.

---

## 5. What is and is not reproducible

**Exactly reproducible** (bit-identical across browsers and machines):

- Weight initializations, given a seed.
- All forward-pass statistics, gradients, Jacobians and kernels.
- All loss trajectories and optimizer histories.
- The loss surfaces, which are evaluations of a deterministic function.
- The derived statistics: variances, Fisher ratios, PCA projections, drift
  measures, spectra, critical points.

**Deterministic but dependent on the quadrature node count**: the analytic curves
(`g(K)`, the susceptibilities, the criticality scanner). They are computed with
Gauss–Hermite quadrature with a fixed node count, so they are reproducible, but
they are *approximations* whose accuracy is set by the node count, not exact
values. The node counts are constants in the source and the test suite checks the
quadrature against an independent rule.

**Not reproducible, and not claimed to be**: the wall-clock timings shown in the
laboratories. They are measured with `performance.now()` and depend on the
machine. They are reported as measured, never as a specification.
