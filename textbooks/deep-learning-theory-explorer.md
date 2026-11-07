# Deep Learning Theory Explorer


**Source:** The Principles of Deep Learning Theory — Daniel A. Roberts, Sho Yaida, Boris Hanin (2022)

**Licence:** Copyrighted by the authors and Cambridge University Press. Cited by reference; the text and figures are not redistributed.

**Why this course exists:** The mathematical layer: initialisation and criticality, signal propagation, the kernel recursion, finite-width fluctuations, the NTK, and representation learning.

**Source:** Mathematics for Machine Learning — Marc Peter Deisenroth, A. Aldo Faisal, Cheng Soon Ong (2020)

**Licence:** Freely available to read online. The machine-check could not be completed from this environment (the GitHub repository name was not resolvable through the API); verify the licence terms on the site before redistributing.

**Why this course exists:** The prerequisite mathematics for the theory course, which currently ships a self-check instead of a reference.

---

## Contents

- [Lesson 1. Gaussians, Wick contraction and why the Gaussian world is not enough](#lesson-1-gaussians-wick-contraction-and-why-the-gaussian-world-is-not-enough) *(foundation, Chapters 0-1)*
- [Lesson 2. Neural networks as random functions: activation functions and ensembles](#lesson-2-neural-networks-as-random-functions-activation-functions-and-ensembles) *(foundation, Chapter 2)*
- [Lesson 3. Deep linear networks: exact criticality and the exploding/vanishing problem](#lesson-3-deep-linear-networks-exact-criticality-and-the-explodingvanishing-problem) *(core, Chapter 3)*
- [Lesson 4. Finite width: fluctuations and the depth-to-width ratio](#lesson-4-finite-width-fluctuations-and-the-depth-to-width-ratio) *(core, Chapter 3.3, 5.4)*
- [Lesson 5. Representation group flow: how the preactivation distribution evolves](#lesson-5-representation-group-flow-how-the-preactivation-distribution-evolves) *(advanced, Chapter 4)*
- [Lesson 6. Criticality for general activations: two conditions and the Kaiming initialization](#lesson-6-criticality-for-general-activations-two-conditions-and-the-kaiming-initialization) *(core, Chapter 5.1-5.2)*
- [Lesson 7. Universality classes: tanh, sin, sigmoid and friends](#lesson-7-universality-classes-tanh-sin-sigmoid-and-friends) *(advanced, Chapter 5.3, 5.5)*
- [Lesson 8. Bayesian learning: what infinite width can and cannot do](#lesson-8-bayesian-learning-what-infinite-width-can-and-cannot-do) *(advanced, Chapter 6)*
- [Lesson 9. Gradient descent and the neural tangent kernel](#lesson-9-gradient-descent-and-the-neural-tangent-kernel) *(advanced, Chapters 7-9)*
- [Lesson 10. Representation learning at finite width](#lesson-10-representation-learning-at-finite-width) *(advanced, Chapters 10-11)*
- [Appendix A — Equation reference](#appendix-a-equation-reference)
- [Appendix B — Notation](#appendix-b-notation)

### Lesson 1. Gaussians, Wick contraction and why the Gaussian world is not enough

*Deep learning theory starts with Gaussian integrals because a wide network behaves like a Gaussian process. The interesting physics lives in the deviations from Gaussianity, and those deviations are measured by connected correlators.*

*Estimated study time:* 40 minutes · tier: foundation · built on: Chapters 0-1

**What you will learn**

- Evaluate Gaussian expectations with Wick contraction
- Distinguish a nearly-Gaussian distribution from an exactly Gaussian one
- Explain why the connected four-point correlator measures interactions between neurons

#### Why Gaussian integrals first

A neural network at initialization is an ensemble of functions: draw the weights from a probability distribution and you get a random function. When the hidden layers are very wide, that ensemble becomes a Gaussian process, whose entire behaviour is fixed by one object — the two-point correlation, or [[kernel]]. Gaussian integrals are therefore the native language of the theory.

$$\int_{-\infty}^{\infty} \frac{dz}{\sqrt{2\pi K}}\, e^{-\frac{z^2}{2K}} = 1 , \qquad \mathbb{E}[z^2] = K$$
*The normal density and its second moment; K is the variance and plays the role of the kernel.*

For a centred Gaussian vector, every higher moment factorises into products of second moments. The pattern of the factorisation is called Wick contraction: pair up the fields in all possible ways and multiply the corresponding covariances.

$$\mathbb{E}[z_1 z_2 z_3 z_4] = \mathbb{E}[z_1z_2]\,\mathbb{E}[z_3z_4] + \mathbb{E}[z_1z_3]\,\mathbb{E}[z_2z_4] + \mathbb{E}[z_1z_4]\,\mathbb{E}[z_2z_3]$$
*Wick contraction: three ways to pair four fields.*

#### Nearly-Gaussian distributions

Real networks have finite width, so the preactivation distribution is only approximately Gaussian. The clean way to quantify the deviation is a cumulant: subtract from the four-point function all of the Wick pairings, and what remains is a genuine measurement of interaction.

> **Figure:** non-gaussianity

$$G^{(4)} - \big(G^{(2)}\big)^2 = 2\,(\ell-1)\frac{\big(G^{(2)}\big)^2}{n} + O\!\left(\frac{1}{n^2}\right)$$
*For a deep linear network with zero bias, the leading non-Gaussianity grows linearly with depth ℓ and falls off as 1/n: the depth-to-width ratio is the small parameter of the whole theory.*

> **The single most repeated theme** (insight)
>
> Finite-width corrections at criticality grow like [[aspect-ratio]]. A short, fat network is nearly Gaussian and nearly infinite-width; a tall, skinny network is dominated by interactions. Every fluctuation panel in this app is a measurement of that statement.

#### Experiment

Use Laboratory C to measure the seed-to-seed variance of the layer-wise kernel as you change depth and width. The measured variance should grow roughly linearly in depth and fall off as 1/width, while the mean profile stays flat at criticality.

#### Practice

**Q. For $z \sim \mathcal{N}(0, K)$, what is $\mathbb{E}[z^4]$? *(warmup)***

- - $K^2$
- ✓ **$3K^2$**
- - $K^4$
- - $\sqrt{3}K$

> **Why:** Wick contraction gives three pairings, each contributing K², so E[z⁴] = 3K².

**Q. A deep linear network has depth ℓ = 21 and width n = 100. Using the leading finite-width result, what is $G^{(4)} - (G^{(2)})^2$ in units of $(G^{(2)})^2$? *(core)***

- - 0.2
- ✓ **0.4**
- - 0.02
- - 2.0

> **Why:** 2(ℓ−1)/n = 2·20/100 = 0.4. The depth-to-width ratio sets the size of the deviation from Gaussianity.

#### Exercises

**For z ~ N(0, 2), compute E[z⁴] using Wick contraction.** *(numerical)*

*Hint:* There are three ways to pair four fields.

> **Answer:** E[z⁴] = 3K² = 3·4 = 12. (Three pairings, each contributing K² = 4.)

**Why does the connected four-point correlator vanish for a Gaussian distribution?** *(conceptual)*

> **Answer:** For a Gaussian, every moment factorises into Wick pairings, so the connected part (the cumulant) is identically zero. A nonzero connected four-point function therefore certifies non-Gaussianity, which is the signature of neuron-neuron interactions.

> **Laboratory:** Measure the L/n growth of finite-width fluctuations. (route: `/labs/width-depth`)

> Also: Watch the signal propagate through a wide network, and see how far from Gaussian the preactivations are. (route: `/labs/physics`)

> Also: Have the Wick contractions and quadrature arithmetic of this lesson graded against the app’s own computation. (route: `/labs/drills`)

**Citations**

- §1.1 — Gaussian integrals and Wick contraction
- §1.3 — nearly-Gaussian distributions and connected correlators
- eq. (3.28) — leading non-Gaussianity of a deep linear network

### Lesson 2. Neural networks as random functions: activation functions and ensembles

*Choosing an initialization distribution is choosing a probability distribution over functions. The activation function decides which function class you can represent, and the ensemble decides how the training data interacts with it.*

*Estimated study time:* 45 minutes · tier: foundation · built on: Chapter 2

**What you will learn**

- State the initialization distribution used throughout the book
- Explain why a deterministic zero initialization is a bad idea
- Classify activations by smoothness and scale invariance

*Read first:* Gaussians, Wick contraction and why the Gaussian world is not enough

#### The ensemble of functions

The route from architecture to a distribution over functions runs through the preactivation recursion. Drop the biases and both endpoints are linear maps composed layer by layer.

$$z^{(\ell)} = W^{(\ell)} h^{(\ell-1)} + b^{(\ell)} , \qquad h^{(\ell)} = \sigma\!\left(z^{(\ell)}\right)$$
*The layer recursion. Everything in the first half of the book is a statistical statement about this iteration.*

$$W^{(\ell)}_{ij} \sim \mathcal{N}\!\left(0, \frac{C_W}{n_{\ell-1}}\right) , \qquad b^{(\ell)}_i \sim \mathcal{N}(0, C_b)$$
*The 1/n rescaling of the weight variance is exactly what makes the infinite-width limit non-trivial: without it every observable collapses.*

> **Why not initialize at zero?** (warning)
>
> A zero initialization keeps every neuron in a layer identical forever: no symmetry breaking. More formally, both susceptibilities are proportional to [[cw]], so C_W = 0 can never satisfy the criticality conditions and the kernel decays exponentially to a trivial fixed point.

> **Figure:** helper-function

#### Activation classes that matter later

- Scale-invariant: σ(λz) = λσ(z), i.e. σ(z) = a₊z (z ≥ 0), a₋z (z < 0). Includes the linear activation and the ReLU.
- Smooth with σ(0) = 0 and σ′(0) ≠ 0: the K = 0 universality class, containing tanh and sin.
- Smooth but σ(0) ≠ 0: sigmoid and softplus. Their criticality conditions clash with the physical requirement C_b ≥ 0.
- Nonlinear monomials z^p, p ≥ 2: the criticality ratio is p/(2p−1), which equals one only for p = 1.
- Half-stable: SWISH-like and GELU-like activations whose nontrivial fixed point is repulsive from one side.

#### Practice

**Q. Which initialization variance makes a deep linear network preserve its covariance exactly? *(warmup)***

- - $C_W = 0$
- ✓ **$C_W = 1$**
- - $C_W = 2$
- - $C_W = 1/2$

> **Why:** For σ(z) = z, g(K) = K, so the recursion is G^(ℓ+1) = C_W G^(ℓ) and only C_W = 1 has a nontrivial fixed point.

**Q. What is the critical rescaled weight variance for the ReLU activation? *(core)***

- - $1$
- - $\sqrt{2}$
- ✓ **$2$**
- - $4$

> **Why:** A² = (a₊² + a₋²)/2 = (1 + 0)/2 = 1/2, hence C_W^crit = 1/A² = 2 (Kaiming/He initialization).

#### Exercises

**For a scale-invariant activation with a₊ = 1, a₋ = 0.1, compute A² and the critical weight variance.** *(numerical)*

*Hint:* A² = (a₊² + a₋²)/2 and C_W = 1/A².

> **Answer:** A² = (1² + 0.1²)/2 = 0.505, so C_W^crit = 1/A² ≈ 1.980.

**Why does the weight variance carry a factor 1/n_{ℓ−1}?** *(conceptual)*

> **Answer:** The preactivation is a sum of n_{ℓ−1} terms. Without the 1/n rescaling the variance of the sum would grow with width, and any infinite-width limit (as well as the "correlation functions are O(1)" property the theory relies on) would be lost.

> **Laboratory:** Compare activations at and away from criticality. (route: `/labs/initialization`)

**Citations**

- §2.2 — activation functions
- §2.3 — ensembles, permutation symmetry
- eq. (4.2) — initialization distribution

### Lesson 3. Deep linear networks: exact criticality and the exploding/vanishing problem

*With a linear activation the whole theory becomes exact. The covariance is multiplied by C_W at every layer, so C_W = 1 is the unique nontrivial fixed point and every other choice either explodes or decays exponentially.*

*Estimated study time:* 45 minutes · tier: core · built on: Chapter 3

**What you will learn**

- Derive the covariance recursion of a deep linear network
- Identify trivial versus nontrivial fixed points
- Explain why C_W = 1 is required for signal preservation

*Read first:* Neural networks as random functions: activation functions and ensembles

#### From layer to layer

Define the covariance of preactivations for two inputs x₁, x₂ as the width-averaged inner product. For a linear network the recursion is multiplication by a constant, which is why this is the only case with a closed-form solution.

> **Figure:** linear-profile

$$G^{(\ell+1)}_{12} = C_W\, G^{(\ell)}_{12} \quad\Longrightarrow\quad G^{(\ell)}_{12} = C_W^{\ell} G^{(0)}_{12}$$
*The exact solution. The factor of n in the weight variance cancels, confirming the choice of rescaling.*

> **Three regimes** (insight)
>
> [[cw]] > 1: all structure is pushed to a trivial fixed point at infinity (numerical blow-up). [[cw]] < 1: correlations decay to zero and the data dependence is erased. C_W = 1: the covariance is preserved exactly — the first example of criticality.

$$\chi_\parallel = C_W \, \frac{d g}{dK} = C_W , \qquad K^{(\ell)} \xrightarrow{C_W = 1} K^{(1)}$$
*For the linear activation g(K) = K, so the parallel susceptibility equals C_W and the critical value is C_W = 1.*

#### Experiment: verify the recursion yourself

Laboratory A lets you set C_W = 1, C_W = 0.8 and C_W = 1.2 on a deep linear network and watch the measured kernel trajectory. The displayed theoretical curve is the exact solution above; the scatter is the finite-width measurement, and the spread across seeds is a preview of the fluctuation analysis.

#### Practice

**Q. A deep linear network has $C_W = 0.95$ and depth 100. Roughly what happens to the kernel? *(core)***

- - It stays constant
- ✓ **It decays roughly as $0.95^{\ell}$ — exponential death of the signal**
- - It grows linearly with depth
- - It oscillates

> **Why:** Below C_W = 1 the covariance is multiplied by C_W each layer, so after 100 layers it has fallen by 0.95⁹⁹ ≈ 0.006. This is the vanishing-signal problem in its simplest form.

**Q. Why does the 1/n factor in the weight variance cancel in the linear-network covariance recursion? *(warmup)***

- - Because the activation is odd
- ✓ **Because the sum over the n input neurons exactly compensates the 1/n in each variance**
- - Because the biases vanish
- - It does not cancel; the covariance scales with n

> **Why:** Each of the n terms contributes (C_W/n)·G, so the sum is n·(C_W/n)G = C_W G. This is the whole reason the rescaling is the right one.

#### Exercises

**A linear network with C_W = 0.9 and G⁽¹⁾ = 1.5 is 40 layers deep. What is G⁽⁴⁰⁾?** *(numerical)*

> **Answer:** G⁽⁴⁰⁾ = 0.9³⁹ · 1.5 ≈ 0.0246. The factor 39 counts the layers after the first: G⁽ℓ⁾ = C_W^(ℓ−1) G⁽¹⁾.

**Run the linear network at C_W = 1 with 6 seeds and check that the mean of (1/n)Σz² matches ‖x‖²/n₀ at every layer.** *(code)*

> **Answer:** The ensemble mean matches to a few per cent at width 32; the per-seed curve scatters by O(1/√n) because each seed is one draw of the weight matrices.

> **Laboratory:** Linear network at and off criticality. (route: `/labs/initialization`)

**Citations**

- §3.2 — criticality of deep linear networks
- eqs. (3.14)-(3.15) — the covariance recursion and its solution

### Lesson 4. Finite width: fluctuations and the depth-to-width ratio

*At criticality the mean of the kernel is preserved exactly, but individual networks still differ from the mean. The variance of that difference grows linearly with depth and shrinks with width, making L/n the emergent scale of the theory.*

*Estimated study time:* 40 minutes · tier: core · built on: Chapter 3.3, 5.4

**What you will learn**

- State the leading finite-width correction to the four-point correlator
- Predict how the variance of the layer kernel scales with depth and width
- Explain why L/n is the cutoff of the effective theory

*Read first:* Deep linear networks: exact criticality and the exploding/vanishing problem

#### Fluctuating observables

Define the observable O^(ℓ) = (1/n)Σ_j z_j^(ℓ) z_j^(ℓ), the layer-wise mean square preactivation measured on a single network. Its expectation over the ensemble is the [[kernel]]; its variance over the ensemble measures how strongly a single network deviates from the Gaussian, infinite-width picture.

> **Figure:** fluctuation

$$\mathrm{Var}\Big[\tfrac{1}{n}\textstyle\sum_j (z_j^{(\ell)})^2\Big] = \frac{2\ell\,(G^{(2)})^2}{n} + O\!\left(\frac{1}{n^2}\right)$$
*For a deep linear network at criticality with a single input. The variance is suppressed by 1/n yet grows linearly with depth ℓ: the combination ℓ/n is what matters.*

> **What this does and does not say** (limitation)
>
> This is a statement about the ensemble variance of a simple observable in a deep linear network, verified numerically in the app at the stated precision. It is not a claim that these simulations reproduce the book's complete effective theory, which involves a full effective action with all-order couplings.

#### Why deep networks are useful anyway

Depth brings two opposing effects: deeper networks can develop nontrivial correlations and features, but their observables fluctuate more from instantiation to instantiation. Since practical networks have L ≳ 2, some finite-width effect is always present — which is exactly the regime where the perturbative expansion in 1/n is trustworthy.

#### Practice

**Q. Depth 50, width 512, critical linear network with $G^{(2)} = 1$. Estimate the standard deviation of the layer observable $O^{(50)}$ across seeds. *(hard)***

- - ≈ 0.014
- - ≈ 0.14
- ✓ **≈ 0.44**
- - ≈ 1.0

> **Why:** Var = 2ℓ/n = 2·50/512 ≈ 0.195, so the standard deviation is √0.195 ≈ 0.44. A 44% deviation from the mean of the layer observable is not unusual for L/n ≈ 0.1.

**Q. What makes the perturbative effective theory accurate? *(core)***

- - Large depth
- ✓ **Small depth-to-width ratio $L/n$**
- - Zero bias variance
- - A linear activation

> **Why:** All leading finite-width corrections scale with L/n, so the expansion is controlled when the network is short and fat.

#### Exercises

**Depth 20, width 256, critical linear network with G⁽²⁾ = 1. Predict the standard deviation of O⁽²⁰⁾ across instantiations.** *(numerical)*

> **Answer:** Var = 2·20/256 = 0.15625, so sd ≈ 0.395 — a 40% deviation from the mean of 1. This is why skinny, deep networks show wildly different behaviour across seeds.

> **Laboratory:** Measure the L/n growth directly. (route: `/labs/width-depth`)

**Citations**

- eq. (3.28) — leading four-point correction
- eq. (3.33) — variance of the layer observable
- §5.4 — fluctuations for general activations, with grading by L/n

### Lesson 5. Representation group flow: how the preactivation distribution evolves

*Marginalizing one layer at a time turns the network into a flow of distributions. At infinite width the flow is Gaussian and described by the kernel recursion; away from infinite width, non-Gaussianities accumulate layer by layer.*

*Estimated study time:* 50 minutes · tier: advanced · built on: Chapter 4

**What you will learn**

- Explain the marginalization step that defines the flow
- Write the kernel recursion for a general activation
- Interpret non-Gaussian couplings as running with depth

*Read first:* Finite width: fluctuations and the depth-to-width ratio

#### The intuition: coarse-graining a network

A network is a stack of random linear maps. If you ask "what is the distribution of the output when the weights are random?", the honest answer is an integral over every weight in the network — hopeless. The trick is to integrate one layer at a time, from the outside in.

Integrating out the last layer leaves a distribution over the penultimate layer's activations. Integrating out the layer before that leaves a distribution over the layer before it. Each integration step therefore produces a *new* distribution — a flow of distributions, one per layer. The question the theory answers is: what does this flow do as the layer index increases?

> **Why this is a flow and not a recursion** (insight)
>
> The map from one layer's distribution to the next is the same at every step. That is the renormalization-group structure: the same operation applied repeatedly. In the physics analogy of the book, this is the same coarse-graining that turns microscopic dynamics into macroscopic thermodynamics.

#### Marginalize the last layer first

The output distribution is an integral over all weights. Grouping the weights layer by layer, each step replaces a layer of neurons by a Gaussian with the kernel computed from the previous layer — as long as the layer is wide enough that correlations between neurons can be neglected.

$$K^{(\ell+1)}_{12} = C_b + C_W \, \mathbb{E}_{(u,v)\sim\mathcal{N}(0,\,K^{(\ell)})}\big[\sigma(u)\,\sigma(v)\big]$$
*The kernel recursion (mixing two inputs). For a single input both copies coincide and the expectation reduces to E[σ(z)²] = g(K).*

Non-Gaussianities enter through a quartic coupling V^(ℓ), whose flow is fed by the difference G⁽⁴⁾ − (G⁽²⁾)². The coupling grows with depth, so the layer at which you look matters: the distribution runs, which is why the book calls this representation group flow.

> **Scope of the app** (limitation)
>
> The laboratories in this app compute the Gaussian part of the flow exactly (via quadrature) and measure the leading non-Gaussianity empirically. The full effective action with its quartic and higher couplings is described here in prose and citations, not simulated.

#### Experiment

Open Laboratory A and switch the activation between the scale-invariant class (ReLU) and the K = 0 class (tanh). The measured kernel profile is the flow of the kernel under the recursion; the theory curve is the same recursion evaluated by Gauss-Hermite quadrature. Where the two agree, the Gaussian part of the flow is doing the work. Where they separate at large depth, you are seeing the leading finite-width correction the Gaussian flow does not capture.

Then open Laboratory C and look at the depth-to-width ratio panel: it is the quantity that decides whether the Gaussian description of the flow is still accurate at the depth you are running.

#### Practice

**Q. For $\sigma(z) = z^2$, which relationship does the two-input kernel recursion satisfy? *(core)***

- - $K^{(\ell+1)}_{12} = C_b + C_W K^{(\ell)}_{12}$
- ✓ **$K^{(\ell+1)}_{12} = C_b + C_W (K_{11}K_{22} + 2K_{12}^2)$**
- - $K^{(\ell+1)}_{12} = C_b + C_W (K_{11} + K_{22})$
- - The recursion closes on the diagonal only

> **Why:** E[z²z′²] = E[z²]E[z′²] + 2E[zz′]² for jointly Gaussian variables, which mixes diagonal and off-diagonal kernel entries. Nonlinear activations always do this; the linear one does not.

**Q. What is the "representation group flow"? *(warmup)***

- - Backpropagation through time
- ✓ **The layer-by-layer evolution of the preactivation distribution as the network is coarsened**
- - A group-theoretic symmetry of the loss
- - The flow of gradients between layers

> **Why:** Marginalizing one layer at a time defines a flow of distributions (and of their couplings) along depth — a renormalization-group flow for the representations.

#### Exercises

**For a quadratic activation σ(z) = z², use Wick contraction to write K⁽ℓ⁺¹⁾ in terms of the kernel matrix entries, and evaluate the bracket for K₁₁ = 2, K₂₂ = 3, K₁₂ = 0.5.** *(numerical)*

*Hint:* E[z²z′²] = E[z²]E[z′²] + 2E[zz′]² for jointly Gaussian (z, z′).

> **Answer:** K⁽ℓ⁺¹⁾₁₂ = C_b + C_W (K₁₁K₂₂ + 2K₁₂²) = C_b + C_W (6 + 0.5) = C_b + 6.5·C_W. This is why nonlinear activations mix diagonal and off-diagonal entries, whereas the linear case does not.

**Why does the flow become exactly Gaussian in the infinite-width limit, and what breaks that at finite width?** *(conceptual)*

> **Answer:** At infinite width the correlations between neurons in a layer vanish (the principle of sparsity: the input of any one neuron is a sum of so many weakly correlated signals that the law of large numbers applies), so the marginalization is exact and the layer distribution is Gaussian. At finite width those intra-layer correlations are non-zero, and they are exactly what the connected four-point correlator G⁽⁴⁾ − (G⁽²⁾)² measures. The correction grows like L/n, so it is negligible for short, fat networks and dominant for tall, skinny ones.

> **Laboratory:** Compare the measured kernel profile with the recursion. (route: `/labs/initialization`)

**Citations**

- §4.1-4.3 — layer-by-layer marginalization
- §4.5 — subleading corrections
- eqs. (5.1), (5.44) — the two-input kernel recursion

### Lesson 6. Criticality for general activations: two conditions and the Kaiming initialization

*Criticality requires two susceptibilities to equal one: one controls magnitude perturbations, the other controls angular ones. For scale-invariant activations both conditions are solved exactly and reproduce He/Kaiming initialization.*

*Estimated study time:* 55 minutes · tier: core · built on: Chapter 5.1-5.2

**What you will learn**

- Define the parallel and perpendicular susceptibilities
- Apply the criticality conditions to the linear and ReLU activations
- Explain the line-of-fixed-points and semi-critical cases

*Read first:* Representation group flow: how the preactivation distribution evolves

#### Two ways to perturb a kernel

Perturbing around a fixed point of the kernel recursion, there are two independent ways to move: change the magnitude of an input ([[chi-parallel]]) or change its direction at fixed magnitude ([[chi-perp]])perpendicular). Each perturbation is multiplied by its own susceptibility per layer.

$$\chi_\parallel(K) = C_W\, g'(K), \qquad \chi_\perp(K) = C_W \, \mathbb{E}_{z\sim\mathcal{N}(0,K)}\big[\sigma'(z)^2\big]$$
*The two susceptibilities. Criticality is the statement χ∥(K*) = 1 and χ⊥(K*) = 1 at the fixed point K* = C_b + C_W g(K*).*

Beware a common trap: [[chi-perp]] is not the variance of the activation derivative. It is the expectation of the square of σ′. Both coincidences that make the analysis easy for scale-invariant activations fail for the K = 0 class.

#### Scale-invariant activations

For σ(z) = a₊z on the positive half-line and a₋z on the negative half-line, g(K) = A²K exactly with [[a2]] = (a₊² + a₋²)/2, so both susceptibilities are the kernel-independent constant A²C_W.

> **Figure:** criticality

$$(C_b, C_W)^{\text{critical}} = \left(0,\; \frac{1}{A^2}\right), \qquad A^2 = \frac{a_+^2 + a_-^2}{2}$$
*The critical hyperparameters. For the ReLU A² = 1/2 and C_W = 2: Kaiming/He initialization is a criticality condition, not a heuristic.*

- C_W > 1/A²: everything explodes exponentially towards the trivial fixed point at infinity.
- C_W < 1/A²: the kernel collapses to K* = C_b/(1 − A²C_W) and perturbations vanish exponentially.
- C_W = 1/A², C_b = 0: every K is a fixed point — a line of nontrivial fixed points, exactly as in a scale-invariant field theory.
- C_W = 1/A², C_b > 0: semi-critical. Perturbations stay constant at linear order while the kernel grows linearly with depth; still no exponential behaviour.

> **Order-one numbers from a principle** (insight)
>
> The theory predicts C_W = 1, 2, 1.98 for linear, ReLU and leaky-ReLU(0.1). None of these numbers was fitted: they follow from demanding that the depth direction neither blows up nor dies out.

#### Practice

**Q. What does the perpendicular susceptibility $\chi_\perp$ control? *(core)***

- - The growth of the input magnitude
- ✓ **The growth of angular perturbations — differences between inputs at equal magnitude**
- - The effective learning rate
- - The bias variance

> **Why:** Perpendicular perturbations are same-norm differences between two inputs, measured by D^(ℓ). If χ⊥ ≠ 1, the network either loses its ability to distinguish inputs or amplifies noise without bound.

**Q. Which activation has $\chi_\parallel = \chi_\perp$ for all $K$? *(hard)***

- - tanh
- - sigmoid
- ✓ **A scale-invariant activation**
- - GELU

> **Why:** Scale-invariant activations have g(K) = A²K, giving both susceptibilities equal to the K-independent constant A²C_W. For the K = 0 class equality holds only at K* = 0.

**Q. A leaky ReLU has negative slope 0.25. What is its critical weight variance? *(core)***

- ✓ **$1.88$**
- - $2.00$
- - $1.60$
- - $2.13$

> **Why:** A² = (1 + 0.25²)/2 = (1 + 0.0625)/2 = 0.53125, so C_W^crit = 1/0.53125 ≈ 1.882.

#### Exercises

**Compute the critical C_W for a scale-invariant activation with a₊ = 1, a₋ = 0 (ReLU) and for a₋ = a₊ = 1 (linear).** *(numerical)*

*Hint:* C_W^crit = 1/A² with A² = (a₊² + a₋²)/2 (book eq. (5.67)).

> **Answer:** ReLU: A² = (1 + 0)/2 = 0.5, C_W = 2. Linear: A² = (1 + 1)/2 = 1, C_W = 1.

**Why does the sigmoid fail the criticality test even though its activation is perfectly smooth? Compute the unphysical C_b it would need.** *(conceptual)*

> **Answer:** The condition χ⊥/χ∥ = 1 is met only at K* = 0, where the fixed-point relation forces C_b = −σ(0)²/σ′(0)² = −(1/2)²/(1/4) = −4 < 0. A negative bias variance is unphysical, so no critical initialization exists. Shifting the activation so that σ(0) = 0 turns the sigmoid into a scaled tanh, which is critical.

> **Laboratory:** Compare measured signal propagation with the C_W = 1/A² prediction. (route: `/labs/initialization`)

**Citations**

- §5.1 — criticality analysis of the kernel
- §5.2 — scale-invariant activations, eq. (5.67)
- §5.3.2 — activations without criticality

### Lesson 7. Universality classes: tanh, sin, sigmoid and friends

*Numerically solving the second criticality condition sorts activations into classes with distinct deep behaviour: exact preservation, power-law decay, exponential failure, or a repulsive fixed point.*

*Estimated study time:* 55 minutes · tier: advanced · built on: Chapter 5.3, 5.5

**What you will learn**

- Implement the criticality scan of §5.3.1 conceptually
- Distinguish the K = 0 class from the no-criticality and half-stable cases
- State the universal exponent and its coefficient for the K = 0 class

*Read first:* Criticality for general activations: two conditions and the Kaiming initialization

#### The numerical criticality algorithm

For a candidate fixed-point value [[kstar]], set C_W = 1/g′(K*) and C_b = K* − C_W g(K*). That satisfies the fixed-point equation and [[chi-parallel]] = 1 identically. The remaining condition [[chi-perp]] = 1 becomes a single dimensionless equation

$$\frac{2 K_*^2 \, \mathbb{E}[\sigma'(z)^2]_{K_*}}{\mathbb{E}[\sigma(z)^2 (z^2 - K_*)]_{K_*}} = 1$$
*Condition (5.73). Scan K* ≥ 0 for a root, then read off (C_b, C_W) and check that C_b ≥ 0.*

This is exactly what the app computes in the criticality scanner: the ratio above is evaluated with Gauss-Hermite quadrature for any activation in the registry, including GELU and SWISH, and every root is reported together with its physicality and stability.

> **Figure:** susceptibility

#### The K = 0 universality class

If σ(0) = 0 and σ′(0) ≠ 0, the fixed point sits at [[kstar]] = 0 and the approach to it is a power law rather than an exponential, governed by [[a1]]. The exponent is universal, the coefficient is not.

> **Figure:** power-law

$$K^{(\ell)} = \frac{1}{(-a_1)\,\ell} + \cdots , \qquad a_1 = \gamma_1\gamma_3 + \tfrac{3}{4}\gamma_2^2$$
*Power-law decay of the kernel at criticality. For tanh a₁ = −2 and for sin a₁ = −1, so both decay as 1/ℓ with different coefficients, exactly as the app measures.*

> **Why this is good news** (insight)
>
> tanh at C_W = 1 keeps a slowly decaying but non-vanishing signal: [[kernel]] ~ 1/ℓ over hundreds of layers. Exponential decay would leave nothing to train on; a power law leaves order-one signal for any finite depth.

#### The other classes

- No criticality: sigmoid (unphysical C_b), softplus (no root at all), nonlinear monomials (the ratio p/(2p−1) equals one only for p = 1).
- Half-stable: GELU and SWISH satisfy the conditions at a nonzero K*, but the K* = 0 fixed point is repulsive because a₁ > 0.
- Non-smooth activations such as the ReLU need the finite-angle analysis of §5.5, where the perpendicular mode develops a slow power-law decay rather than staying exactly constant.

> **A caveat stated in the source itself** (warning)
>
> For nonlinear scale-invariant activations the constancy of the perpendicular component holds only at the level of infinitesimal perturbations. A finite-angle analysis shows a crossover to a slow power-law decay, which is benign compared to exponential behaviour but is not exact constancy.

#### Practice

**Q. At criticality, how does the kernel of a tanh network behave with depth? *(hard)***

- - It is exactly constant
- - It decays exponentially
- ✓ **It decays as a power law, $K^{(\ell)} \sim 1/((-a_1)\ell)$ with $a_1 = -2$**
- - It grows logarithmically

> **Why:** tanh belongs to the K = 0 class with a₁ = −2, so the kernel follows a benign 1/ℓ power law. The exponent 1 is universal; the coefficient depends on the activation.

**Q. Why does the softplus activation fail to be critical? *(core)***

- - Its derivative vanishes at the origin
- ✓ **The criticality ratio never reaches one for K* ≥ 0**
- - It is not differentiable
- - Its C_W would be zero

> **Why:** The ratio 2K*²E[σ′²]/E[σ²(z²−K*)] stays below one for all K* ≥ 0, so there is no nontrivial fixed point at all.

#### Exercises

**tanh at criticality with K⁽¹⁾ = 1: use the power law to estimate K at layer 200, then compare with the exact recursion from the app.** *(numerical)*

> **Answer:** Power law: K ≈ 1/(2·200) = 0.0025. The continuous version of the recursion, 1/((−a₁)(ℓ−1) + 1/K⁽¹⁾), gives 0.002506, and the exact quadrature recursion gives 0.002534 — the exact curve is larger because the asymptotic form drops the O(K³) terms. The app shows both curves and their difference.

**Why can the softplus not be rescued by subtracting log 2 so that σ(0) = 0?** *(conceptual)*

> **Answer:** With that shift the coefficient a₁ changes sign, so the K* = 0 fixed point becomes repulsive; away from K = 0 the parallel susceptibility exceeds one, and the kernel diverges exponentially. The fix must remove the offset while keeping a₁ negative.

> **Laboratory:** Run tanh, sin, sigmoid and GELU and classify them by measured behaviour. (route: `/labs/initialization`)

**Citations**

- §5.3.1 — the criticality algorithm
- §5.3.3 — K = 0 universality class, power law
- §5.3.4 — half-stable classes
- §5.5 — finite-angle analysis for non-smooth activations

### Lesson 8. Bayesian learning: what infinite width can and cannot do

*Treated Bayesianly, an infinite-width network is exactly a Gaussian process whose predictions depend on the data only through the kernel. Its posterior cannot move the kernel, which is a precise statement of the absence of representation learning at infinite width.*

*Estimated study time:* 50 minutes · tier: advanced · built on: Chapter 6

**What you will learn**

- State the Gaussian-process description of an infinite-width network
- Explain why the evidence prefers criticality
- Explain why feature learning is impossible at infinite width but appears at finite width

*Read first:* Universality classes: tanh, sin, sigmoid and friends

#### Predictions from a Gaussian process

Bayesian model fitting starts from a prior over functions and conditions on the data. For an infinite-width network the prior is Gaussian with covariance K, so the posterior is Gaussian too and the mean prediction is a kernel regression formula.

> **Figure:** gp-posterior

> **What this figure is, and is not** (limitation)
>
> This is the posterior of the *infinite-width* Gaussian process, computed in closed form by inverting the kernel matrix. It is not a finite-width Bayesian posterior: the finite-width corrections of Chapter 6, which generate the Hebbian wiring and the moving kernel, are not implemented here. The figure makes the limit concrete; Laboratory E measures what a finite-width network does instead.

$$\mu_*(x) = K_*(x)^T \left(K + \sigma_\epsilon^2 I\right)^{-1} y$$
*Gaussian-process posterior mean: linear in the training labels, with no dependence on anything but the kernel.*

> **The evidence argument for criticality** (insight)
>
> The marginal likelihood (evidence) rewards priors that can fit data without being too flexible. Evaluating the evidence for a Gaussian-process network shows a preference for order-one, critical hyperparameters — a second, independent route to the same tuning that the signal-propagation analysis produced.

#### No wiring, no representation learning

Two structural facts follow. Correlation functions are delta-correlated across neurons at infinite width, so the network does not "wire together" features inside a layer. And the posterior depends on the data only through the kernel, which is fixed by the architecture and initialization: the representation cannot change. Introducing 1/n corrections generates both effects — Hebbian-style wiring and a moving kernel.

> **Where the app stands** (limitation)
>
> Laboratory E measures the finite-width drift of hidden features and of the empirical kernel; it does not implement Bayesian inference. The Bayesian results above are stated with citations, not simulated, and the app says so where they appear.

#### Practice

**Q. In the infinite-width Bayesian picture, why can the network not learn a new representation? *(core)***

- - The learning rate is too small
- ✓ **The posterior depends on the data only through a kernel fixed at initialization**
- - The loss is convex
- - The biases are frozen

> **Why:** The Gaussian-process posterior is a kernel regression: the covariance does not change with the data. Feature learning is a 1/n effect.

#### Exercises

**Why is "the kernel is frozen" equivalent to "no representation learning"?** *(conceptual)*

> **Answer:** The kernel is the collection of gradient inner products that controls how the network changes when trained. If it is fixed by initialization, training only changes the read-out in an already-fixed feature space; no hidden-layer feature can be re-shaped, so the representation is static.

> **Laboratory:** Measure feature drift as a function of width. (route: `/labs/representation`)

**Citations**

- §6.2 — Bayesian model fitting and comparison
- §6.3 — infinite-width Bayesian inference, evidence for criticality
- §6.4 — finite-width Bayesian inference, Hebbian learning

### Lesson 9. Gradient descent and the neural tangent kernel

*Gradient descent changes any observable through the NTK. At infinite width the NTK is deterministic and frozen, which turns training into kernel learning with closed-form dynamics; at finite width it fluctuates and defrosts.*

*Estimated study time:* 60 minutes · tier: advanced · built on: Chapters 7-9

**What you will learn**

- Define the NTK and derive the update equation for an observable
- State the frozen-NTK recursion for a deep network
- Explain why the learning-rate tensor is scaled by 1/n per layer

*Read first:* Bayesian learning: what infinite width can and cannot do

#### The NTK controls learning

A gradient step changes the parameters; the induced change of any observable is a sum over parameter gradients weighted by the loss gradient. All of the model-dependent information is collected in one kernel.

> **Figure:** ntk-closed-form

$$\Theta_{i_1 i_2; 1 2} = \sum_{\theta} \frac{\partial z_{i_1}(x_1)}{\partial \theta} \frac{\partial z_{i_2}(x_2)}{\partial \theta} , \qquad \Delta z_i(x) = -\eta \sum_{j, \tilde x} \Theta_{ij; x \tilde x}\, \epsilon_{j;\tilde x}$$
*The NTK and the resulting change of the network output. The off-diagonal entries in the sample index are exactly the mechanism by which learning one example affects another.*

$$\Theta^{(\ell+1)} = K^{(\ell+1)} + \chi_\perp^{(\ell+1)}\,\Theta^{(\ell)} , \qquad \Theta^{(1)} = K^{(1)}$$
*The frozen-NTK recursion of the effective theory (9.5)-(9.7). Because χ⊥ is the same susceptibility that appears in the criticality analysis, criticality of the kernel and criticality of the NTK are one story.*

#### Parameterization matters

The raw sum over parameters in the NTK definition grows with the fan-in of each layer: a hidden layer contributes θ(1) to [[theta]] and the read-out another θ(1), so the total is θ(width). The book absorbs this by scaling the learning rate of a weight by 1/n_{ℓ−1}, so that the weight contribution to the effective kernel is O(1) and the large-width expansion is meaningful.

$$\upsilon^{(W)}_{\ell} = \frac{\eta\, \lambda^{(W)}_{\ell}}{n_{\ell-1}} , \qquad \upsilon^{(b)}_{\ell} = \eta\, \lambda^{(b)}_{\ell}$$
*The learning-rate tensor of eqs. (8.6). Laboratory D measures the width-linear growth of the raw NTK that motivates this scaling.*

> **What the app computes** (insight)
>
> Laboratory D assembles the raw empirical NTK from exact Jacobians, checks symmetry and positive semidefiniteness, compares it against a closed-form two-layer ensemble prediction that the test suite validates, and measures its width scaling. The frozen recursion is displayed alongside, with the normalization convention stated explicitly.

#### Practice

**Q. The NTK is $\Theta(x,x') = \sum_\theta \partial f(x)/\partial\theta \cdot \partial f(x')/\partial\theta$. For a single-layer linear network $f = w\cdot x + b$, what is $\Theta(x,x')$? *(core)***

- - $x\cdot x'$
- ✓ **$x\cdot x' + 1$**
- - $3$
- - $\|x\|\|x'\|$

> **Why:** The weight gradients give Σ_k x_k x′_k and the bias gradient contributes 1·1. The bias contribution is easy to forget and shows up in the app's test suite.

**Q. How does the raw empirical NTK of a two-layer network scale with hidden width $n_1$? *(hard)***

- - independent of $n_1$
- ✓ **linearly**
- - as $1/n_1$
- - as $\sqrt{n_1}$

> **Why:** The read-out term accumulates n₁ independent contributions of O(1), so the trace grows linearly with width. This is why the book scales weight learning rates by 1/n per layer (eqs. (8.6)-(8.7)).

#### Exercises

**A two-layer tanh network, widths (4, 128, 1), C_W = 1, C_b = 0. Predict by what factor the empirical NTK trace changes when you quadruple the hidden width to 512.** *(numerical)*

> **Answer:** The read-out term n₁·g(K⁽¹⁾) dominates and grows linearly with n₁, so the trace grows by close to a factor of four — the closed form gives 3.82, not exactly four, because the first-layer term C_W·K̇·(x·x′ + 1) is width-independent and the read-out bias contributes a constant. Laboratory D reports the measured ratio and the closed-form prediction side by side.

**Why is the NTK called frozen at infinite width, and what thaws it?** *(conceptual)*

> **Answer:** At infinite width the parameter gradients are determined by the initialization and do not change as training proceeds, so Θ is constant in time. At finite width the 1/n corrections make the gradient directions drift as the weights move, which the book quantifies with the differential of the NTK (dNTK).

> **Laboratory:** Assemble the NTK from Jacobians and watch it defrost during training. (route: `/labs/ntk`)

> Also: Go down the loss itself: a read-out slice that is exactly quadratic, a hidden slice that is not, and the stability threshold read off the curvature. (route: `/labs/landscape`)

> Also: The eigenvalue, kernel and Gaussian-process arithmetic this lesson assumes, as graded drills. (route: `/labs/drills`)

**Citations**

- §7.2 — gradient descent and function approximation
- §8.0 — learning-rate tensor and the forward equation for the NTK
- §9.1-9.3 — effective theory of the frozen NTK at initialization
- §10.2 — kernel learning dynamics

### Lesson 10. Representation learning at finite width

*The difference between a kernel method and a neural network is the movement of the kernel. Measuring that movement — feature drift, kernel drift, class separation — shows it is a finite-width effect whose size shrinks as the network widens.*

*Estimated study time:* 55 minutes · tier: advanced · built on: Chapters 10-11

**What you will learn**

- Define the differential of the NTK and interpret it
- Measure feature drift and class separation in a trained network
- Explain the kernel/large-width limit as a controlled approximation

*Read first:* Gradient descent and the neural tangent kernel

#### The kernel moves

Take the derivative of the NTK with respect to training time. What you get, the differential of the NTK (dNTK), is nonzero only because the parameter gradients themselves depend on the parameters — a purely finite-width phenomenon. Its flow is governed by the same four-point vertices that control non-Gaussianities.

$$\frac{d\Theta}{dt} = \frac{\partial \Theta}{\partial \theta}\cdot \dot\theta \;\sim\; \frac{1}{n}\,\big(\text{four-point vertices}\big)$$
*Sketch of the dNTK flow: the book’s statement is that it is nonzero at finite width and vanishes as 1/n. The application measures that the kernel moves, and it measures the movement; the 1/n scaling is the leading order of the flow, which a single training step does not by itself establish.*

The practical question is empirical: how much does the representation actually move in a small network trained on a real task? Laboratory E trains a two-dimensional classifier, snapshots hidden activations, and reports feature drift, kernel drift and a Fisher separation ratio, all computed from real forward passes, with the PCA limitation stated next to the projection.

> **Figure:** feature-drift

#### Kernel methods, nonlinear models and the interpolation between them

A kernel method has no representation learning; a network has it. The infinite-width limit is therefore the boundary case that makes the network analytically tractable, and the 1/n expansion describes the departure from it. Generalization analyses that inherit the kernel picture should be read in that light.

> **Honest scope note** (limitation)
>
> This app measures the width dependence of feature drift in a small MLP on synthetic data. That is evidence for the qualitative finite-width picture, not a reproduction of the book's quantitative scaling laws for the dNTK.

#### Practice

**Q. The differential of the NTK (dNTK) is *(core)***

- - always zero, since the NTK is frozen in time
- ✓ **nonzero in general and proportional to finite-width corrections**
- - a second-order derivative of the loss
- - the Hessian of the network output

> **Why:** The dNTK measures how the NTK changes under training. It vanishes at infinite width, and its size tracks 1/n corrections — the quantitative signature of representation learning.

**Q. You train the same network at widths 8, 64 and 512 for a fixed number of steps. What should happen to the measured feature drift? *(hard)***

- - It increases with width
- - It stays the same
- ✓ **It decreases with width, approaching the frozen-kernel limit**
- - It is random and unrelated to width

> **Why:** Feature drift is a 1/n effect: wider networks behave more like kernel machines on the same training budget, so the representation moves less.

#### Exercises

**Train the same two-moons network at widths 8, 32 and 128 for the same number of steps and compare the feature drift.** *(code)*

> **Answer:** Drift decreases with width in the app's measurement — 0.24, 0.10 and 0.04 at widths 8, 32 and 128 at the small step size the figure uses — and the class separation is best in the middle rather than at either end (Fisher 0.61, 0.67, 0.64), so moving further is not the same as separating better. The trend is a property of the regime, not of the width alone: raise the learning rate and the wide network overshoots, moving further than the narrow one, and the ordering reverses. The app reports the numbers rather than a fitted law.

> **Laboratory:** Train, snapshot, measure drift and separation. (route: `/labs/representation`)

**Citations**

- §10.4 — linear models, kernel methods and infinite-width networks
- §11.1-11.3 — dNTK and representation learning

## Appendix A — Equation reference

**Gaussian second and fourth moments** (warmup-gaussian)

$$\mathbb{E}[z^2] = K, \qquad \mathbb{E}[z^4] = 3K^2, \qquad z \sim \mathcal{N}(0, K)$$

*The two moments that make every first-layer calculation possible.* — from §1.1

Symbols:

- `z` — a centred Gaussian random variable (a preactivation, typically)
- `K` — its variance — in network language, the kernel value K = q or K₁₁

**Assumptions:**

- z is exactly Gaussian
- z is centred; a nonzero mean shifts the odd moments

**Derivation:**

1. Start from the Gaussian integral ∫ dz e^{−z²/(2K)} = √(2πK).
2. Differentiate once with respect to K: ∫ dz z² e^{−z²/(2K)} = K·√(2πK) after normalization gives E[z²] = K.
3. Differentiate again: E[z⁴] = 3K², the value used in every Wick contraction of four fields.

**Worked example.** K = 2, E[z²] = K = 2, E[z⁴] = 3K² = 12 → **12**

**MLP forward recursion** (forward-recursion)

$$z^{(\ell)} = W^{(\ell)} h^{(\ell-1)} + b^{(\ell)}, \qquad h^{(\ell)} = \sigma\!\left(z^{(\ell)}\right)$$

*The object whose statistics the theory computes.* — from eq. (4.1)

Symbols:

- `W^{(\ell)}` — weight matrix of layer ℓ, shape n_ℓ × n_{ℓ−1}
- `b^{(\ell)}` — bias vector of layer ℓ
- `\sigma` — elementwise activation function
- `n_\ell` — width of layer ℓ; n₀ is the input dimension

**Assumptions:**

- the activation acts elementwise
- the read-out is linear unless stated otherwise

**Derivation:**

1. Apply the affine map W^(ℓ)h^(ℓ−1) + b^(ℓ).
2. Insert the result into σ elementwise to obtain h^(ℓ).
3. Iterate from h^(0) = x to the output layer.

**Worked example.** x = [0.5, −1.25], W^(1) = 2×2 matrix, entries ~ N(0, 1/n₀), σ = tanh → **z^(1) = W^(1)x + b^(1), h^(1) = tanh(z^(1)) — evaluated exactly in Laboratory A**

**Critical-scaled initialization** (init-variance)

$$W^{(\ell)}_{ij} \sim \mathcal{N}\!\left(0, \frac{C_W}{n_{\ell-1}}\right), \qquad b^{(\ell)}_i \sim \mathcal{N}(0, C_b)$$

*The distribution that makes the infinite-width limit well defined.* — from eq. (4.2)

Symbols:

- `C_W` — rescaled weight variance (dimensionless, O(1))
- `C_b` — bias variance
- `n_{\ell-1}` — fan-in of layer ℓ

**Assumptions:**

- weights are independent across layers and neurons
- C_W and C_b are layer independent in the analysis

**Derivation:**

1. A preactivation is a sum of n_{ℓ−1} terms each of size W·h.
2. For the sum to have O(1) variance regardless of width, each weight variance must be O(1/n_{ℓ−1}).
3. Criticality then fixes the O(1) constant C_W.

**Worked example.** n_{ℓ−1} = 64, C_W = 2 (ReLU critical), Var(W) = 2/64 = 0.03125 → **sd(W) ≈ 0.177** (Verified empirically in the test suite by measuring the sample variance of the initialized weights.)

**Deep linear covariance** (linear-covariance)

$$G^{(\ell)}_{12} = C_W^{\ell} G^{(0)}_{12}$$

*The exactly solvable case, and the origin of the word criticality.* — from eqs. (3.14)-(3.15)

Symbols:

- `G^{(\ell)}_{12}` — width-averaged preactivation inner product for inputs x₁, x₂
- `G^{(0)}_{12}` — input inner product x₁·x₂

**Assumptions:**

- linear activation
- zero bias
- weights drawn as in eq. (4.2)

**Derivation:**

1. Write z^(ℓ+1) = W^(ℓ+1)z^(ℓ) and take the expectation of the inner product of two copies.
2. The weights are independent of the preactivations, so Wick-contract them: E[W_iℓ W_jℓ] = (C_W/n_ℓ)δ_ij.
3. The sum over the n_ℓ neurons cancels the 1/n_ℓ, leaving G^(ℓ+1) = C_W G^(ℓ), hence G^(ℓ) = C_W^ℓ G^(0).

**Worked example.** C_W = 1, G^(0) = ‖x‖²/n₀ = 1.5, ℓ = 40 → **G^(40) = 1.5 — exactly preserved, layer after layer** (At C_W = 0.9 the same quantity would be 1.5·0.9³⁹ ≈ 0.025.)

**Parallel susceptibility** (chi-parallel)

$$\chi_\parallel(K) = C_W\, g'(K) = \frac{C_W}{2K^2}\,\mathbb{E}\big[\sigma(z)^2(z^2 - K)\big]_K$$

*Per-layer growth factor of a perturbation that changes the magnitude of an input.* — from eq. (5.50)

Symbols:

- `g(K)` — E[σ(z)²] for z ~ N(0,K)
- `\chi_\parallel` — growth factor of the parallel mode; equals one at criticality

**Assumptions:**

- infinite width (the kernel recursion is exact only in that limit)
- Gaussian preactivations at each layer

**Derivation:**

1. The single-input recursion is K^(ℓ+1) = C_b + C_W g(K^(ℓ)).
2. Linearize around a fixed point K*: K^(ℓ) = K* + δ^(ℓ) gives δ^(ℓ+1) = C_W g′(K*) δ^(ℓ) + O(δ²).
3. The stated integral form of g′(K) follows from differentiating under the Gaussian integral (identity (5.53)).

**Worked example.** Activation = tanh, C_W = 1, K* = 0 → **χ∥ = C_W·g′(0) = 1·(γ₁² + γ₀γ₂) = 1 — criticality** (γ₁ = 1 and γ₀ = 0 for tanh, so the value is exactly 1.)

**Perpendicular susceptibility** (chi-perp)

$$\chi_\perp(K) = C_W\, \mathbb{E}_{z\sim\mathcal{N}(0,K)}\big[\sigma'(z)^2\big]$$

*Per-layer growth factor of a perturbation that changes the direction of an input at fixed magnitude.* — from eq. (5.51)

Symbols:

- `\sigma'` — derivative of the activation
- `\chi_\perp` — growth factor of the angular mode

**Assumptions:**

- same as χ∥: infinite width, Gaussian preactivations

**Derivation:**

1. Rotate the two-input kernel into the basis K^{[0]}, K^{[1]}, K^{[2]} of eq. (5.15).
2. The [2] component measures D = E[(z₊ − z₋)²], the squared difference of two same-magnitude inputs.
3. Its linearized recursion is K^{[2](ℓ+1)} = χ⊥(K*)K^{[2](ℓ)} + h(K*)K^{[1](ℓ)}, so χ⊥ governs the angular mode.

**Worked example.** Activation = ReLU, C_W = 2, K = any → **χ⊥ = 2·E[σ′(z)²] = 2·(1/2) = 1 for every K — scale invariance makes criticality exact**

**The two criticality conditions** (criticality-conditions)

$$\chi_\parallel(K_*) = 1, \qquad \chi_\perp(K_*) = 1, \qquad K_* = C_b + C_W g(K_*)$$

*The definition of a well-behaved deep initialization.* — from eqs. (5.55)-(5.56)

Symbols:

- `K_*` — the nontrivial fixed point of the kernel recursion
- `C_b, C_W` — the two initialization hyperparameters to be determined

**Assumptions:**

- the fixed point exists and is nontrivial
- C_b ≥ 0 is required physically

**Derivation:**

1. Require that perturbations of both kinds neither explode nor vanish: both susceptibilities equal one.
2. Together with the fixed-point equation this gives three conditions for three unknowns (C_b, C_W, K*).
3. For scale-invariant activations the susceptibilities are K independent, so the equations decouple and (C_b,C_W) = (0, 1/A²).

**Worked example.** Activation = tanh, Solution = K* = 0, C_b = 0, C_W = 1/γ₁² = 1 → **(C_b, C_W) = (0, 1) — the canonical K = 0 class point**

**Scale-invariant criticality and Kaiming initialization** (scale-invariant-critical)

$$(C_b, C_W)^{\text{crit}} = \left(0, \frac{1}{A^2}\right), \qquad A^2 = \frac{a_+^2 + a_-^2}{2}$$

*He/Kaiming initialization derived from a principle rather than tuned empirically.* — from eqs. (5.60)-(5.67)

Symbols:

- `a_+` — slope for positive preactivations
- `a_-` — slope for negative preactivations
- `A^2` — the resulting constant, (a₊² + a₋²)/2

**Assumptions:**

- the activation is exactly scale invariant
- C_b = 0 for a line of nontrivial fixed points

**Derivation:**

1. For σ(z) = a_±z, compute g(K) = A²K by two Gaussian integrals on half-lines.
2. Both susceptibilities collapse to the constant A²C_W.
3. Setting them equal to one gives C_W = 1/A²; the ReLU (A² = 1/2) reproduces the familiar factor of two.

**Worked example.** ReLU = a₊ = 1, a₋ = 0 → A² = 0.5, Leaky ReLU(0.25) = a₋ = 0.25 → A² = 0.53125 → **C_W = 2.000 and C_W = 1.882 respectively** (Both values are reproduced by the app's criticality scanner using numerical quadrature.)

**The numerical criticality condition** (second-condition)

$$\frac{2K_*^2\,\mathbb{E}[\sigma'(z)^2]_{K_*}}{\mathbb{E}[\sigma(z)^2(z^2 - K_*)]_{K_*}} = 1$$

*A single dimensionless equation to scan for the fixed-point value K*.* — from eq. (5.73)

Symbols:

- `K_*` — candidate fixed-point kernel value
- `\mathbb{E}[\cdot]_{K_*}` — expectation under z ~ N(0, K*)

**Assumptions:**

- C_W and C_b are then fixed by eqs. (5.71)-(5.72) and must satisfy C_b ≥ 0

**Derivation:**

1. Fix a candidate K*. Set C_W = 1/g′(K*) so that χ∥ = 1 automatically.
2. Set C_b = K* − C_W g(K*) so that K* is a fixed point.
3. The remaining condition χ⊥ = 1 becomes the ratio above, independent of the hyperparameters.

**Worked example.** sigmoid at K* → 0 = ratio → γ₁²/(γ₁² + γ₀γ₂) = 1, implied C_b = −σ(0)²/σ′(0)² = −4 < 0 → unphysical → **no critical initialization for the sigmoid** (The app's scanner plots this ratio for every activation in the registry.)

**K = 0 class: power-law kernel decay** (kzero-power-law)

$$K^{(\ell)} = \frac{1}{(-a_1)\,\ell} + \cdots, \qquad a_1 = \gamma_1\gamma_3 + \tfrac{3}{4}\gamma_2^2$$

*Why tanh and sin survive at criticality while decaying gently.* — from eqs. (5.90)-(5.92)

Symbols:

- `\gamma_p` — Taylor coefficients of σ: σ(z) = Σ γ_p z^p/p!
- `a_1` — coefficient of K² in g(K); negative for tanh and sin
- `\ell` — layer index

**Assumptions:**

- σ(0) = 0 and σ′(0) ≠ 0
- C_W = 1/γ₁², C_b = 0
- large ℓ (asymptotic statement)

**Derivation:**

1. Expand g(K) = γ₁²K + a₁K² + … using the Taylor expansion of σ and Gaussian moments.
2. The recursion becomes K^(ℓ+1) = K^(ℓ) + a₁(K^(ℓ))², i.e. dK/dℓ = a₁K² in the continuum.
3. Integrating gives K^(ℓ) ≈ 1/((−a₁)ℓ): a universal exponent 1 with an activation-dependent coefficient.

**Worked example.** tanh = γ₁ = 1, γ₃ = −2 → a₁ = −2, sin = γ₁ = 1, γ₃ = −1 → a₁ = −1, ℓ = 200 → **K^(200) ≈ 0.0025 (tanh) versus ≈ 0.005 (sin)** (The exact recursion (quadrature) gives slightly larger values due to the O(1) offset and K³ corrections; the app displays both.)

**Finite-width fluctuation law** (fluctuation-law)

$$\mathrm{Var}\Big[\tfrac{1}{n}\textstyle\sum_j (z_j^{(\ell)})^2\Big] = \frac{2\ell\,(G^{(2)})^2}{n} + O\!\left(\frac{1}{n^2}\right)$$

*How strongly one instantiation deviates from the ensemble average, and how that grows with depth.* — from eqs. (3.28), (3.33)

Symbols:

- `G^{(2)}` — the kernel K^(ℓ), constant in ℓ at criticality
- `n` — hidden width
- `\ell` — layer index

**Assumptions:**

- deep linear network
- critical initialization C_W = 1
- single input
- leading order in 1/n

**Derivation:**

1. Compute the connected four-point correlator of a deep linear network: G⁽⁴⁾ − (G⁽²⁾)² = 2(ℓ−1)(G⁽²⁾)²/n.
2. The variance of the layer observable picks up this connected piece plus a 2G⁽⁴⁾/n term.
3. Combining them gives Var = 2ℓ(G⁽²⁾)²/n to leading order — linear in depth, suppressed by width.

**Worked example.** ℓ = 10, n = 64, G^(2) = 1 → **Var ≈ 20/64 = 0.3125, sd ≈ 0.56 — verified in the app against 400 seeded networks**

**Neural tangent kernel** (ntk-definition)

$$\Theta_{i_1i_2;12} = \sum_\theta \frac{\partial z_{i_1}(x_1)}{\partial \theta}\cdot\frac{\partial z_{i_2}(x_2)}{\partial \theta}$$

*The kernel that governs how outputs change under gradient descent.* — from eq. (7.17)

Symbols:

- `\theta` — all trainable parameters, weights and biases
- `z_{i}(x)` — output component i of the network on input x
- `\Theta` — the NTK; a Gram matrix of parameter gradients

**Assumptions:**

- differentiable model
- independent of the loss function used for training

**Derivation:**

1. A gradient step changes parameters by Δθ = −η g.
2. Expand an observable to first order in Δθ and collect the parameter gradients.
3. The term multiplying the loss gradient is the NTK; its off-diagonal sample entries transfer learning between examples.

**Worked example.** Model = f(x) = w·x + b (single linear layer), Gradient pieces = ∂f/∂w_k = x_k, ∂f/∂b = 1 → **Θ(x,x′) = x·x′ + 1 — checked exactly in the test suite**

**Frozen NTK recursion** (ntk-recursion)

$$\Theta^{(\ell+1)} = K^{(\ell+1)} + \chi_\perp^{(\ell+1)}\,\Theta^{(\ell)}, \qquad \Theta^{(1)} = K^{(1)}$$

*How the kernel of the frozen NTK builds up with depth.* — from eqs. (9.5)-(9.7)

Symbols:

- `\Theta^{(\ell)}` — the ℓ-th-layer NTK, in the normalization of eqs. (8.6)-(8.7)
- `\chi_\perp` — the same perpendicular susceptibility as in the criticality analysis

**Assumptions:**

- infinite width (the mean NTK)
- weight learning rates rescaled by 1/n_{ℓ−1}, as in eq. (8.6)
- single-input (diagonal) evaluation of χ⊥

**Derivation:**

1. Split the parameter sum of the (ℓ+1)-th-layer NTK into its own layer plus all earlier layers.
2. The own-layer piece is the kernel K^(ℓ+1); the earlier layers propagate through the derivative kernel E[σ′σ′] = χ⊥/C_W.
3. Iterating gives Θ^(ℓ+1) = K^(ℓ+1) + χ⊥Θ^(ℓ) with the first-layer initial condition Θ^(1) = K^(1).

**Worked example.** Linear net, C_W = 1, C_b = 0 = K^(ℓ) = K^(1), χ⊥ = 1, Depth = L → **Θ^(L) = L·K^(1) — each layer contributes the input kernel once** (For the raw (un-normalized) NTK the read-out term instead grows linearly with the hidden width; the app measures both.)

**Kernel-learning dynamics** (kernel-learning)

$$z(x; t+1) - z(x; t) = -\eta \sum_{\tilde x \in \mathcal{A}} \Theta_{x\tilde x}\, \frac{\partial L_{\mathcal{A}}}{\partial z(\tilde x)}$$

*Training as linear evolution in function space when the NTK is frozen.* — from eqs. (7.19)-(7.20)

Symbols:

- `\mathcal{A}` — the training set
- `\eta` — learning rate
- `L_{\mathcal{A}}` — training loss

**Assumptions:**

- small learning rate (first-order expansion)
- frozen NTK — exact only at infinite width

**Derivation:**

1. Take the first-order Taylor expansion of an observable in the parameter change.
2. Substitute the gradient-descent update Δθ = −η∂L/∂θ.
3. Identify the NTK as the coefficient of the loss gradient; for MSE the loss gradient is the prediction error.

**Worked example.** Training set = one example, Loss = MSE, Θ = constant in time → **error decays geometrically: ε(t) = (1 − ηΘ)^t ε(0) — the loss curve of the app's optimization lab in the linear regime**

**Gradient-descent stability for a quadratic loss** (gradient-descent-stability)

$$\theta_{t+1} = \theta_t - \eta\, H\, \theta_t \quad\text{converges} \iff \eta < \frac{2}{\lambda_{\max}(H)}$$

*Why too large a learning rate makes the loss explode, and where the threshold sits.* — from §7.2, §10.2

Symbols:

- `H` — Hessian of the loss; for a linear read-out H = (2/M)ΦᵀΦ
- `\lambda_{\max}` — largest eigenvalue of H — the curvature of the stiffest direction

**Assumptions:**

- quadratic (linear-model) loss
- full-batch gradient descent
- fixed learning rate

**Derivation:**

1. Diagonalize H; in the eigenbasis each mode evolves independently as (1 − ηλ_i)^t.
2. A mode converges iff |1 − ηλ_i| < 1, i.e. η < 2/λ_i.
3. The binding constraint is the largest eigenvalue, giving the stated threshold.

**Worked example.** Read-out features = computed from the frozen hidden layer, λ_max(H) = measured from the feature Gram matrix → **the app displays λ_max, the predicted threshold 2/λ_max and the measured loss curves on both sides of it**

**Differential of the NTK** (dntk)

$$\frac{d\Theta}{dt} = \left(\frac{\partial \Theta}{\partial \theta}\right)\cdot\dot\theta \;\propto\; \frac{1}{n}$$

*The quantitative measure of representation learning.* — from §11.1-11.2

Symbols:

- `d\Theta/dt` — time derivative of the NTK along the training trajectory
- `n` — hidden width

**Assumptions:**

- finite width, since the object vanishes identically at infinite width

**Derivation:**

1. Differentiate the NTK definition with respect to training time.
2. The derivative is nonzero only because the parameter gradients depend on the parameters themselves.
3. That dependence is mediated by four-point (interaction) vertices, whose size is suppressed by 1/n.

**Worked example.** Measured quantity = ‖Θ(t) − Θ(0)‖_F / ‖Θ(0)‖_F in Laboratory E → **decreases with width in the app's measurements; the exact rate depends on the task and hyperparameters**

## Appendix B — Notation

| Symbol | Name | Meaning |
| --- | --- | --- |
| n_l | layer width | number of neurons in layer l (n₀ is the input dimension) |
| L | depth | number of layers, including the output layer |
| C_W | rescaled weight variance | Var(W_ij^(l)) = C_W / n_{l-1} |
| C_b | bias variance | Var(b_i^(l)) = C_b |
| z^(l) | preactivation | the vector before the activation in layer l |
| K^(l) | kernel | infinite-width mean of the preactivation inner product; the two-point correlator G^(l) |
| g(K) | single-input expectation | E[σ(z)²] for z ~ N(0,K) |
| χ∥ | parallel susceptibility | C_W g′(K): growth of magnitude perturbations |
| χ⊥ | perpendicular susceptibility | C_W E[σ′(z)²]_K: growth of angular perturbations |
| a₁ | quartic coupling | O(K²) coefficient of g(K); controls the K = 0 fixed-point stability |
| Θ | neural tangent kernel | sum of parameter-gradient inner products, governing GD dynamics |
| η | learning rate | step size of the gradient update |
| ℓ | layer index | used interchangeably with l for the layer position |
