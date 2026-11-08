# The source-mapped curriculum

Every lesson, equation, laboratory and assessment item in this application is
tied to a specific place in

> D. A. Roberts, S. Yaida & B. Hanin, *The Principles of Deep Learning Theory:
> An Effective Theory Approach to Understanding Neural Networks*,
> Cambridge University Press, 2022. arXiv:2106.10165v2.

Equation numbers below refer to **arXiv:2106.10165v2** (24 August 2021), the
version this project was written against. The page numbers in brackets are the
printed page numbers of the monograph.

---

## Chapter map

| Book chapter | Printed pages | Lessons | Equation-explorer entries | Laboratory |
| --- | --- | --- | --- | --- |
| 0 — Initialization | 1–12 | 1 (partly) | — | Physics lab, Overview |
| 1 — Pretraining: Gaussian integrals, statistics, nearly-Gaussian distributions | 13–36 | 1, 2 | `warmup-gaussian` | — |
| 2 — Neural networks: function approximation, activations, ensembles | 37–52 | 2 | `forward-recursion`, `init-variance` | Physics lab, Lab A |
| 3 — Effective theory of deep linear networks: criticality, fluctuations, chaos | 53–70 | 3, 4 | `linear-covariance`, `fluctuation-law` | Lab A, Lab C |
| 4 — RG flow of preactivations | 71–108 | 5 | — | Lab C |
| 5 — Effective theory of preactivations: criticality, universality | 109–152 | 6, 7 | `chi-parallel`, `chi-perp`, `criticality-conditions`, `scale-invariant-critical`, `second-condition`, `kzero-power-law` | Lab A, Physics lab |
| 6 — Bayesian learning | 153–190 | 8 | `gp-posterior` | the infinite-width limit is computed; the finite-width posterior is cited |
| 7 — Gradient-based learning | 191–198 | 9 | `ntk-definition`, `gradient-descent-stability` | Lab B, Lab D |
| 8 — RG flow of the neural tangent kernel | 199–226 | 9 | `ntk-recursion` | Lab D |
| 9 — Effective theory of the NTK at initialization | 227–246 | 9 | `ntk-recursion` | Lab D |
| 10 — Kernel learning | 247–290 | 9 | `kernel-learning` | Lab D, Lab B |
| 11 — Representation learning | 291–334 | 10 | `dntk` | Lab E |
| 12 — The end of training | 335–390 | 9, 10 | — | Lab B, Lab D, Lab E |
| 13 — Epilogue: model complexity | 391–400 | 7 | — | Lab C |
| A — Information in deep learning | 401–424 | 7 | — | Lab C (fluctuations only) |
| B — Residual learning | 425–438 | 7 | — | *cited, not simulated* |

---

## The eleven lessons

Each lesson follows the same shape: **intuition → formal definition → experiment →
verification exercise**. The `prerequisites` field is a real DAG (checked by the
test suite for cycles); `objectives`, `sections`, `exercises` and `citations` are
all required and checked.

### The lessons carry their own experiments

Ten of the eleven lessons contain a **live figure**: a computation next to the sentence
that makes the claim, not an illustration. Each figure is produced by the same
quadrature and recursion code the laboratories use, so the picture and the
numbers in the laboratory can never disagree.

| Lesson | Figure | What it shows |
| --- | --- | --- |
| 1 | The connected four-point correlator | The size of the non-Gaussianity, 2(ℓ−1)(G²)²/n, compared across widths |
| 2 | The helper function g(K) | E[σ(z)²] against K, next to the statement that everything the recursion knows about the activation is in g |
| 3 | The deep linear recursion | G^(ℓ) = C_W^ℓ G^(0) for any width, with the critical case flat |
| 4 | The fluctuation law | Var[O^(ℓ)] = 2ℓ(G²)²/n against depth, with the depth-to-width ratio reported |
| 6 | The kernel profile at a chosen C_W | The recursion's output against the critical point, with the susceptibilities computed live |
| 7 | The two susceptibilities | χ∥ and χ⊥ against K, with the criticality line χ = 1 |
| 7 | The K = 0 class decays by a power law | The exact recursion against the asymptotic law 1/((−a₁)(ℓ−1) + 1/K^(1)) |
| 9 | The two-layer NTK: closed form against measurement | The derived formula Θ = C_W·K̇·(x·x′ + 1) + n₁·g + 1, plotted against the kernel assembled from exact Jacobians |
| 10 | Feature drift shrinks with width | Three real trainings on the same data, differing only in width |
| 8 | The infinite-width limit is a Gaussian process | The closed-form GP posterior of §10.4, with the band ±2 posterior standard deviations — explicitly labelled as the *limit*, not a finite-width posterior |

### The exercises are computed, not quoted

There are 21 exercises across the eleven lessons. Twelve of them are *guided
numerical* exercises: the value the learner is asked to reproduce is computed at
run time by the same numerical code the laboratories use
(`src/lib/exercises.ts`), and the learner's own answer is checked against that
live computation, with the method and the tolerance shown. The remaining eight
are conceptual or code exercises with written derivations.

| Exercise | Lesson | Computed by |
| --- | --- | --- |
| `E[z⁴]` for `z ~ N(0,2)` | 1 | Wick contraction |
| `A²` for `a₊ = 1, a₋ = 0.1` | 2 | eq. (5.61) |
| `G^(40)` for a 40-layer linear network | 3 | eq. (3.15) |
| `sd[O^(20)]` at width 256 | 4 | eq. (3.33) |
| `c₄(8)` | 5 | eq. (3.46) |
| `e^{2r} − 1` at r = 1/2 | 5 | eq. (3.56) |
| `e^{6r} − 3e^{2r} + 2` at r = 1/4 | 5 | eq. (3.57) |
| `K₁₁K₂₂ + 2K₁₂²` for a quadratic activation | 5 | Wick contraction |
| The ReLU critical `C_W` | 6 | eq. (5.67), cross-checked against the §5.3.1 scanner |
| The unphysical sigmoid `C_b` | 6 | §5.3.2 |
| `K^(200)` for tanh at criticality | 7 | eq. (5.92) and the exact recursion |
| The NTK trace ratio when the width is quadrupled | 9 | the closed form of eq. (7.17) |

The test suite asserts that each prose answer quotes the computed value to within
one per cent, so the two cannot drift apart.

### How to work through it

The dashboard derives your next step from what you have read, worked, answered
and run, and states why it is that action. A lesson whose prerequisites are
unread is marked locked. The plan prefers the exercises of a lesson you have
just read, because that is the rhythm the course is built on: intuition, formal
definition, experiment, verification exercise. Every lesson has a notes box, and
the whole record can be exported and imported.

| # | id | Title | Book source | Tier | Min | Lab to open |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `non-gaussianity` | Gaussians, Wick contraction and why the Gaussian world is not enough | Ch. 0–1, eq. (3.28) | foundation | 40 | Lab C |
| 2 | `random-functions` | Neural networks as random functions: activation functions and ensembles | Ch. 2, eqs. (4.1)–(4.2) | foundation | 45 | Physics lab, Lab A |
| 3 | `linear-criticality` | Deep linear networks: the kernel recursion and criticality | Ch. 3.1–3.2, eq. (3.15) | core | 40 | Lab A |
| 4 | `fluctuations` | Finite width: fluctuations and the depth-to-width ratio | Ch. 3.3, eqs. (3.28), (3.33) | core | 40 | Lab C |
| 5 | `rg-flow` | Representation group flow: how the preactivation distribution evolves | Ch. 4, eqs. (5.1), (5.44) | advanced | 50 | Lab A |
| 6 | `criticality` | Two ways to perturb a kernel, and what criticality costs | Ch. 5.1–5.2, eq. (5.55) | core | 50 | Lab A, Physics lab |
| 7 | `universality` | Universality classes: which activations can be tuned, and which cannot | Ch. 5.3, eqs. (5.73), (5.78), (5.90) | advanced | 55 | Lab A |
| 8 | `bayesian` | Bayesian learning: predictions without wiring, and without representations | Ch. 6 | advanced | 45 | *none — cited only* |
| 9 | `ntk` | The neural tangent kernel: the Hamiltonian of gradient descent | Ch. 7–10, eqs. (7.17), (9.5)–(9.7) | core | 60 | Lab B, Lab D |
| 10 | `representation-learning` | Representation learning: the kernel moves | Ch. 11, §11.1 | advanced | 50 | Lab E |

Prerequisite chain:

```
non-gaussianity → random-functions → linear-criticality → fluctuations → rg-flow
                                                                    ↓
                                        universality ← criticality ←─┘
                                                     ↓
                                    bayesian      ntk → representation-learning
```

---

## The sixteen equation-explorer entries

Each entry carries: a rendered equation, a reference to the book, a plain-language
meaning, a glossary of every symbol, a list of assumptions, a stepwise derivation,
and a worked example with the substituted numbers.

### The worked examples are computed, not quoted

Every one of the sixteen entries has a worked example that is **evaluated in the
reader's browser**, with the same code the laboratories use: the same
quadrature, the same networks, the same backpropagation. The example changes
when the reader changes the activation, and a test asserts that every entry
answers for every activation.

Three of them are worth singling out, because the number they produce is the
number the equation claims:

| Entry | What is computed | What it shows |
| --- | --- | --- |
| `ntk-definition` | the empirical kernel of a real network, and the inner product of two parameter-gradient rows | the two agree to ten digits — that *is* eq. (7.17) |
| `kernel-learning` | the first-order prediction of one gradient step from the frozen kernel, and the step itself | they agree to a part in a hundred, which is the expansion of eqs. (7.19)–(7.20) |
| `init-variance` | the measured variance of a real weight matrix, against `C_W/n` | they agree to the sampling error — the rescaling of eq. (4.2) does what it says |

The `dntk` entry shows that the kernel *moves* during training, and says only
that: the book's `1/n` suppression is a statement about the leading order of the
flow, which a single step does not by itself establish.

| id | Result | Book reference |
| --- | --- | --- |
| `warmup-gaussian` | The Gaussian integral and Wick contraction | §1.1 |
| `forward-recursion` | The MLP layer iteration | eq. (4.1) |
| `init-variance` | The Gaussian initialization distribution | eq. (4.2) |
| `linear-covariance` | The deep linear kernel recursion | eqs. (3.14)–(3.15) |
| `chi-parallel` | The parallel susceptibility | eq. (5.50) |
| `chi-perp` | The perpendicular susceptibility | eq. (5.51) |
| `criticality-conditions` | The two criticality conditions | eq. (5.55) |
| `scale-invariant-critical` | Kaiming initialization from criticality | eqs. (5.60)–(5.67) |
| `second-condition` | The numerical criticality condition | eq. (5.73) |
| `kzero-power-law` | The `K = 0` class and its power-law decay | eqs. (5.86), (5.90)–(5.92) |
| `fluctuation-law` | The leading finite-width correction | eqs. (3.28), (3.33) |
| `ntk-definition` | The neural tangent kernel | eq. (7.17) |
| `ntk-recursion` | The frozen NTK recursion and its normalization | eqs. (9.5)–(9.7) |
| `kernel-learning` | Gradient descent as kernel regression | §10.2 |
| `gradient-descent-stability` | The learning-rate stability window | eqs. (7.8)–(7.9) |
| `dntk` | The differential of the NTK | §11.1 |

---

## The eleven gallery presets

| id | Laboratory | Hypothesis | Seed |
| --- | --- | --- | --- |
| `critical-linear` | Lab A | At `C_W = 1` the deep linear kernel is preserved exactly | 1 |
| `relu-kaiming` | Lab A | `C_W = 2 = 1/A²` keeps the ReLU kernel constant | 2 |
| `tanh-power-law` | Lab A | At `C_W = 1` the tanh kernel decays as `1/(2ℓ)` | 3 |
| `sigmoid-no-criticality` | Lab A | The sigmoid satisfies the ratio condition only at an unphysical `C_b` | 4 |
| `linear-fluctuations` | Lab C | `Var[O^(ℓ)] = 2ℓ(G⁽²⁾)²/n` at criticality | 5 |
| `landscape-convex` | Lab B | Gradient descent converges iff `η < 2/λ_max` | 11 |
| `landscape-nonconvex` | Lab B | Training two hidden weights gives a non-convex landscape | 12 |
| `ntk-two-layer` | Lab D | The ensemble NTK equals the derived closed form | 21 |
| `ntk-defrosting` | Lab D | The kernel drifts during training, more at smaller width | 22 |
| `representation-drift` | Lab E | Hidden features move less as the network widens | 31 |
| `physics-critical-sweep` | Physics lab | The kernel profile is flat only near the critical `C_W` | 41 |

Each preset states its hypothesis, its exact settings, and the numeric outcome to
expect. The recipes are in [`REPRODUCIBILITY.md`](REPRODUCIBILITY.md).

---

## The twenty-four assessment questions

| # | id | Difficulty | Lesson | Kind |
| --- | --- | --- | --- | --- |
| 1 | `q01` | warmup | `non-gaussianity` | numeric (exact) |
| 2 | `q02` | warmup | `random-functions` | numeric |
| 3 | `q03` | core | `linear-criticality` | numeric (exact) |
| 4 | `q04` | core | `fluctuations` | numeric |
| 5 | `q05` | core | `criticality` | numeric |
| 6–20 | `q06`–`q20` | warmup → hard | all ten lessons | multiple choice, with explanations and citations |

Every question is written for this project, is answerable from the lessons, and
carries an explanation plus source citations. Numeric questions state their
tolerance, and the tolerances are tight enough to distinguish a correct
derivation from a plausible guess: the exact integers (`2` for the ReLU critical
`C_W`, `1` for the tanh one) accept no tolerance at all.

The suite of questions covers every lesson — the test suite asserts this, so a new
lesson cannot be added without also being assessed.

---

## Things the book contains that this curriculum deliberately does not reproduce

| Book material | Why not | What the app does instead |
| --- | --- | --- |
| The full effective action of §5 with all couplings | Would require a full RG implementation and is not reproducible at toy width | The Gaussian part of the flow is computed exactly by quadrature; the leading non-Gaussianity is measured |
| The complete RG flow of §4 | Same reason | The recursion is iterated numerically and compared with measurement; the lesson says which part is prose |
| Bayesian inference at finite width (§6) | The finite-width posterior needs the 1/n corrections of the whole effective theory, which is out of reach for an in-browser toy | Lesson 8 computes the *infinite-width* limit — the Gaussian-process posterior of §10.4, in closed form, with a figure — and says plainly that the finite-width posterior is not implemented |
| The end-of-training analysis of Ch. 12 in full | Requires the full effective theory | The NTK defrosting and the movement of hidden features are *measured* |
| Residual networks (App. B) | Not implemented | Lesson 7 records the claim and labels it cited-only |
| The optimal aspect ratio `r*` of App. A | The information-theoretic bound is not computed here | Lab C measures the fluctuations the bound constrains |
| The book's own verification plots | The preface explicitly keeps them private; reproducing them from the PDF would be copying protected figures | Independent measurements at stated seeds and sample counts |