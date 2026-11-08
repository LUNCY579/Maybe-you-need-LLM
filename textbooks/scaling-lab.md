# Scaling Lab


**Source:** Scaling Laws for Neural Language Models — Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B. Brown, Benjamin Chess, Rewon Child, Scott Gray, Alec Radford, Jeffrey Wu, Dario Amodei (2020)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Scaling laws are one lesson in two courses. They are the quantitative spine of the field and deserve their own application.

**Source:** Training Compute-Optimal Large Language Models — Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch, Elena Buchatskaya, Trevor Cai, Eliza Rutherford, Diego de Las Casas, Lisa Anne Hendricks, Johannes Welbl, Aidan Clark, Tom Hennigan, Eric Noland, Katie Millican, George van den Driessche, Bogdan Damoc, Aurelia Guy, Simon Osindero, Karen Simonyan, Erich Elsen, Jack W. Rae, Oriol Vinyals, Laurent Sifre (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The compute-optimal result and the IsoFLOP methodology that produced it.

**Source:** Beyond neural scaling laws: beating power law scaling via data pruning — Ben Sorscher, Robert Geirhos, Shashank Shekhar, Surya Ganguli, Ari S. Morcos (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The result that breaks the power law, with a theory that can be checked on real data.

**Source:** Scaling Data-Constrained Language Models — Niklas Muennighoff, Alexander M. Rush, Boaz Barak, Teven Le Scao, Aleksandra Piktus, Nouamane Tazi, Sampo Pyysalo, Thomas Wolf, Colin Raffel (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The regime the field is actually in: repeated epochs over a fixed corpus.

**Source:** Are Emergent Abilities of Large Language Models a Mirage? — Rylan Schaeffer, Brando Miranda, Sanmi Koyejo (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Whether abilities appear discontinuously is a measurement question, and this shows it is often an artefact of the metric.

**Source:** Compute Trends Across Three Eras of Machine Learning — Jaime Sevilla, Lennart Heim, Anson Ho, Tamay Besiroglu, Marius Hobbhahn, Pablo Villalobos (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The hardware trend that makes the compute curves mean something.

---

## Contents

- [1. Power Laws](#1-power-laws)
  - [Lesson 1. What a power law says](#lesson-1-what-a-power-law-says)
  - [Lesson 2. How the exponent is measured](#lesson-2-how-the-exponent-is-measured)
- [2. Compute Optimality](#2-compute-optimality)
  - [Lesson 3. The compute budget](#lesson-3-the-compute-budget)
  - [Lesson 4. The compute-optimal allocation](#lesson-4-the-compute-optimal-allocation)
  - [Lesson 5. The crossover between size and data](#lesson-5-the-crossover-between-size-and-data)
- [3. The Frontier](#3-the-frontier)
  - [Lesson 6. The IsoFLOP curves and the frontier](#lesson-6-the-isoflop-curves-and-the-frontier)
  - [Lesson 7. The twenty-tokens rule, rederived](#lesson-7-the-twenty-tokens-rule-rederived)
  - [Lesson 8. When the pool binds](#lesson-8-when-the-pool-binds)
- [4. Data Constraints](#4-data-constraints)
  - [Lesson 9. The three phases of a repeated run](#lesson-9-the-three-phases-of-a-repeated-run)
  - [Lesson 10. How many epochs before repetition dominates](#lesson-10-how-many-epochs-before-repetition-dominates)
  - [Lesson 11. The turn upward, and the early-stopping epoch](#lesson-11-the-turn-upward-and-the-early-stopping-epoch)
  - [Lesson 12. When the data runs out](#lesson-12-when-the-data-runs-out)
  - [Lesson 13. The price of repetition](#lesson-13-the-price-of-repetition)
  - [Lesson 14. The effective-data law](#lesson-14-the-effective-data-law)
- [5. Pruning and Percolation](#5-pruning-and-percolation)
  - [Lesson 15. The percolation threshold](#lesson-15-the-percolation-threshold)
  - [Lesson 16. Four metrics on one pool](#lesson-16-four-metrics-on-one-pool)
  - [Lesson 17. Predicting the cliff before it happens](#lesson-17-predicting-the-cliff-before-it-happens)
- [6. Emergence](#6-emergence)
  - [Lesson 18. What emergence looks like](#lesson-18-what-emergence-looks-like)
  - [Lesson 19. Reproducing the artefact](#lesson-19-reproducing-the-artefact)
  - [Lesson 20. What causes the cliff](#lesson-20-what-causes-the-cliff)
- [7. Compute Through Time](#7-compute-through-time)
  - [Lesson 21. Three eras and one straight line](#lesson-21-three-eras-and-one-straight-line)
  - [Lesson 22. A break in the trend, and what it costs to claim one](#lesson-22-a-break-in-the-trend-and-what-it-costs-to-claim-one)
  - [Lesson 23. What a trend buys, and the year it became buyable](#lesson-23-what-a-trend-buys-and-the-year-it-became-buyable)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — The laboratories](#appendix-b-the-laboratories)
- [Appendix C — Sources](#appendix-c-sources)

## 1. Power Laws

*The shape of the loss, and how its exponent is measured*

A scaling law is a statement that the loss falls as a power of something. This module is about the shape, about how the exponent is measured, and about the things a fitted exponent does not tell you.

**Learning outcomes**

- State what a power law says, and what its exponent means in practice
- Fit a power law by least squares in log–log space and read the R²
- Explain why the exponent of a fit depends on the range it was fitted over

### Lesson 1. What a power law says

*And why the exponent is the number everyone quotes*

*Estimated study time:* 24 minutes

**What you will learn**

- State the form of a scaling law and the three quantities in it
- Convert an exponent into the factor a doubling of the data buys
- Distinguish a power law in the loss from a power law in the error

**The ideas**

- A power law says that the loss falls as L ∝ N^(−α) — a constant factor for every doubling.
- The exponent is the whole of the practical content: a doubling buys a factor 2^(−α).
- The error, not the loss, is the quantity that scales cleanly near the floor.

#### The mathematics

**A scaling law**

$$L(N) = \left(\frac{N_{\mathrm{c}}}{N}\right)^{\alpha}$$

*The loss falls as a power of the quantity being scaled. The coefficient is written as a critical size, so that the law reads as a ratio.*

Symbols:

- `N` — the quantity being scaled (The number of tokens, the number of parameters, or the compute.)
- `N_{\mathrm{c}}` — the critical size (The size at which the loss is one unit.)
- `\alpha` — the exponent (How fast the loss falls. Its practical content is the factor a doubling buys.)

**Assumptions:**

- The measurement is in a region where the law holds, which is established by the fit and not by the form.
- The floor of the loss is far enough below that it does not bend the curve.

**Derivation:**

1. Empirically, the log of the loss falls linearly with the log of the quantity being scaled.
2. Exponentiating gives the power law.
3. Writing the coefficient as N_c^(−α) fixes the units of the loss at one.

**Worked example.** A law with α = 0.2 and a loss of 2 at 1000 tokens. → **At 2000 tokens the loss is 2 × 2^(−0.2) = 1.741.** (A doubling buys about 13%.)

**The factor a doubling buys**

$$\frac{L(2N)}{L(N)} = 2^{-\alpha}$$

*The multiplicative improvement that a doubling of the scaled quantity buys. It is the form in which a scaling law is worth quoting.*

Symbols:

- `\alpha` — the exponent (The same exponent as in the law itself.)

**Assumptions:**

- The doubling stays inside the region where the law holds.

**Derivation:**

1. Substitute 2N for N in the law.
2. The factor is 2^(−α) because (2N)^(−α) = N^(−α)·2^(−α).

**Worked example.** An exponent of 0.5. → **The factor is 2^(−0.5) = 0.707, so a doubling improves the loss by about 29%.** (Which is the difference between a law worth obeying and one worth ignoring.)

#### Practice

**Q. A scaling law says the loss falls as L ∝ N^(−α). What does α say? — multiple-choice *(core)***

- ✓ **How much a doubling of N improves the loss**
- How many tokens the model has read
- The size of the model
- The floor of the loss

> Correct — the factor is 2^(−α).

> **Why:** Because the law is multiplicative, the natural unit of improvement is a doubling: 2^(−α). An exponent of 0.1 means a doubling improves the loss by about 7%.

**Q. A loss falls as a power law with exponent 0.2. By what factor is the loss multiplied when the data doubles? — numeric *(core)***

> **Answer:** 0.870551 ± 0.0001

> **Why:** The factor is 2^(−0.2) = 0.8706, so the loss falls by about 13%.

**Q. A loss follows L(N) = (N_c / N)^α with α = 0.34. When the parameter count grows by a factor of 10, what fraction of its previous value does the loss reach? — numeric *(core)***

> **Answer:** 0.46 ± 0.03

> **Why:** Scaling N by 10 multiplies the loss by 10^(−α) = 10^(−0.34) ≈ 0.457. The exponent is the answer to “how much does ten times more buy” — which is why the fitted exponent, and the range it was fitted over, are the whole story.

#### Go and do it

Training runs here, a power law fitted to them here, and the factor a doubling buys. Open **Fit the law** in the scaling-lab application.

**Where this came from**

- §kaplan:1 Introduction — The observation that the loss falls as a power law, and that the loss of the best model at a given compute is itself a power law.
- §kaplan:1.1 Summary of the scaling results — The three results, and the parameter-count and dataset-size exponents.

**The words this lesson uses**

- **Scaling law** — A statement that a quantity follows a power of another quantity.
- **Exponent** — The number in a power law that says how fast the quantity falls.
- **Compute budget** — The total training compute available, which is what the data is bought with.

### Lesson 2. How the exponent is measured

*Log–log space, and the range the fit depends on*

*Estimated study time:* 22 minutes

**What you will learn**

- Fit a power law by least squares in log–log space
- Read the R² of the fit and say what it does and does not certify
- Show that the fitted exponent changes with the range of the data

**The ideas**

- The fit is a straight line in log–log space, and ordinary least squares is the right tool for it.
- A high R² says the points are close to a line; it does not say the line will keep holding.
- A fitted exponent is an average over a range, and quoting it without the range is quoting half a result.

#### The mathematics

**Fitting a law by least squares**

$$\min_{a,b}\sum_i\left(a + b\log x_i - \log y_i\right)^2,\qquad \alpha = -b$$

*The estimator behind every exponent in this course. A power law is a straight line in logs, so the exponent is the negative of the fitted slope and the coefficient is the intercept.*

Symbols:

- `x_i` — the scaled quantity (Tokens, parameters, or the product the budget pins down.)
- `y_i` — the measured loss (The held-out loss of run i.)
- `b` — the fitted slope (The negative of the exponent.)

**Assumptions:**

- The errors are multiplicative, which is what taking logs assumes when the residuals are fitted in log space.
- Every point is in the region where one law describes the curve.

**Derivation:**

1. Write the law as log y = a − α log x.
2. Least squares in the two coefficients is ordinary linear regression on the logged columns.
3. The R² of that regression is the fraction of the log-loss variance the line explains — a number about the fit, not about the range.

**Worked example.** The laboratory’s 20 runs, fitted over capacities 4 to 64. → **The slope in log–log space is negative, and −b is the exponent the screen prints as α.** (The same runs fitted over half the range give a different α, which is the point of screen A’s second tab.)

**A scaling law**

$$L(N) = \left(\frac{N_{\mathrm{c}}}{N}\right)^{\alpha}$$

*The loss falls as a power of the quantity being scaled. The coefficient is written as a critical size, so that the law reads as a ratio.*

Symbols:

- `N` — the quantity being scaled (The number of tokens, the number of parameters, or the compute.)
- `N_{\mathrm{c}}` — the critical size (The size at which the loss is one unit.)
- `\alpha` — the exponent (How fast the loss falls. Its practical content is the factor a doubling buys.)

**Assumptions:**

- The measurement is in a region where the law holds, which is established by the fit and not by the form.
- The floor of the loss is far enough below that it does not bend the curve.

**Derivation:**

1. Empirically, the log of the loss falls linearly with the log of the quantity being scaled.
2. Exponentiating gives the power law.
3. Writing the coefficient as N_c^(−α) fixes the units of the loss at one.

**Worked example.** A law with α = 0.2 and a loss of 2 at 1000 tokens. → **At 2000 tokens the loss is 2 × 2^(−0.2) = 1.741.** (A doubling buys about 13%.)

#### Practice

**Q. A power law fitted with an R² of 0.999 over two orders of magnitude is guaranteed to hold for another order. — boolean *(hard)***

> **Answer:** False

> **Why:** No. R² says the points are close to a line over the range you fitted; it says nothing about a range you did not. That is why a fitted exponent is quoted together with the range it was fitted over.

#### Go and do it

The same runs, fitted over different ranges, and the exponent that comes out. Open **Change the range** in the scaling-lab application.

**Where this came from**

- §kaplan:2.1 Fitting scaling laws — The loss surface, the method of fitting, and the precautions against fitting noise.
- §kaplan:3 Discussion — The caveats: the range of the fit, the possibility of a break, and what the laws do not say.

**Further reading**

- [Beyond neural scaling laws: beating power law scaling via data pruning](https://arxiv.org/abs/2206.14486) — A data-pruning method that beats the power law, and a check on what a law is.

**The words this lesson uses**

- **Exponent** — The number in a power law that says how fast the quantity falls.
- **R²** — The fraction of the variation a fit explains.

*Read first:* What a power law says

## 2. Compute Optimality

*A budget, and where it should be spent*

The compute budget is the constraint, and under it the loss is minimised somewhere between "all parameters" and "all data". This module finds that somewhere, shows what it costs to miss it, and answers the older question of which model size a budget should buy.

**Learning outcomes**

- Write the loss surface in the model size and the dataset size
- Find the allocation that minimises the loss at a fixed compute budget
- Say what the tokens-per-parameter ratio at the optimum means, and what it does not
- Name the crossover at which a larger model starts to pay for itself

### Lesson 3. The compute budget

*The constraint that makes the question a question*

*Estimated study time:* 20 minutes

**What you will learn**

- Write the cost of a training run as a function of the parameters and the tokens
- Explain why a budget turns "how big" into "big in what way"
- Measure the loss along a fixed budget

**The ideas**

- The cost of a run is the number of parameters times the number of tokens, times a constant.
- Under a fixed budget, more parameters means fewer tokens, and the loss of each is measured against the other.
- A budget is a statement about what cannot be had, and it is the only reason the allocation is a decision.

#### The mathematics

**The cost of a training run**

$$C = 6 N D$$

*The arithmetic a training run costs, in floating-point operations, up to the constant that counts the arithmetic in the forward and backward passes.*

Symbols:

- `N` — the number of parameters (Every parameter is read once per token.)
- `D` — the number of training tokens (Every token causes a pass over the parameters.)
- `6` — the constant (A few operations per parameter per token, in the convention this course follows.)

**Assumptions:**

- The model is trained on every token once, with a constant amount of work per token.
- The constant does not depend on the architecture, which is an approximation.

**Derivation:**

1. The forward pass costs a constant number of operations per parameter per token.
2. The backward pass costs about twice the forward pass.
3. The constant absorbs all of that.

**Worked example.** A model with 70 billion parameters trained on 1.4 trillion tokens. → **The cost is 6 × 7e10 × 1.4e12 = 5.88e23 floating-point operations.** (Which is the number people quote when they say a run cost five hundred million dollars.)

**The two-variable loss surface**

$$L(N, D) = E + A N^{-\alpha} + B D^{-\beta}$$

*The loss as a function of the model size and the dataset size: a floor, a term that falls with the model, and a term that falls with the data.*

Symbols:

- `E` — the irreducible loss (The floor no model beats.)
- `A, B` — the coefficients of the two terms (They set the scale of each term.)
- `\alpha, \beta` — the two exponents (They set where the optimum sits.)

**Assumptions:**

- The three terms are additive, which the fit checks.
- The exponents are the same across the region being fitted.

**Derivation:**

1. Each of the two error sources — not enough capacity, not enough data — contributes a power law.
2. The floor is the part of the loss that is neither.
3. Adding them gives the surface.

**Worked example.** E = 0.2, A = 1, α = 0.5, B = 2, β = 0.5, N = 1000 and D = 1000. → **The loss is 0.2 + 0.0316 + 0.0632 = 0.295.** (The two terms are in the ratio 1 to 2 here, and that ratio is what the optimum fixes.)

#### Practice

**Q. Why is the compute budget the thing that makes the allocation a decision? — multiple-choice *(core)***

- ✓ **Because it fixes the product of the parameters and the tokens, so more of one means less of the other**
- Because it fixes the loss
- Because it fixes the model architecture
- Because it fixes the number of epochs

> Correct.

> **Why:** The cost is proportional to parameters times tokens. Under a fixed budget they trade against each other, and the question becomes where to put them.

#### Go and do it

The loss along a fixed compute budget, as the allocation slides from all data to all parameters. Open **Walk the budget** in the scaling-lab application.

**Where this came from**

- §chinchilla:1 Introduction — The claim: the compute-optimal model is not the biggest one, and the data has to grow with it.

**The words this lesson uses**

- **Compute budget** — The total training compute available, which is what the data is bought with.
- **Allocation** — How a fixed budget is split between the model and the data.

*Read first:* What a power law says

### Lesson 4. The compute-optimal allocation

*Where the two terms of the loss balance*

*Estimated study time:* 28 minutes

**What you will learn**

- Write the two-variable loss surface and fit it
- Derive the condition that balances the two terms at the optimum
- Compute the allocation and the tokens-per-parameter ratio at a given budget

**The ideas**

- The surface is E + A·N^(−α) + B·D^(−β): an irreducible term and two powers.
- At the optimum the two terms balance in a fixed ratio, and that fixes the allocation.
- The tokens-per-parameter ratio at the optimum is a consequence, not a setting.

#### The mathematics

**The condition at the compute optimum**

$$\alpha A N^{-\alpha} = \beta B D^{-\beta}$$

*At the allocation that minimises the loss under a fixed budget, the two terms of the surface balance in a fixed ratio.*

Symbols:

- `A N^{-\alpha}` — the capacity term (The part of the loss that more parameters would fix.)
- `B D^{-\beta}` — the data term (The part that more data would fix.)

**Assumptions:**

- The budget is fixed and the allocation is free.
- The surface is differentiable at the optimum, which it is away from the edges.

**Derivation:**

1. Write the budget as N·D = P and substitute D = P/N into the surface.
2. Differentiate with respect to N and set the result to zero.
3. The condition that falls out is that α times the capacity term equals β times the data term.

**Worked example.** A = 1, B = 2, α = β = 0.5 and a budget of N·D = 1e6. → **The condition gives N = D/4, so N = 500 and D = 2000.** (Four tokens per parameter at that budget.)

**The IsoFLOP curve**

$$L(N;C) = E + A\,N^{-\alpha} + B\left(\frac{C}{kN}\right)^{-\beta},\qquad N^{*} = \left(\frac{\alpha A}{\beta B}\right)^{\frac{1}{\alpha+\beta}} P^{\frac{\beta}{\alpha+\beta}}$$

*The loss along one fixed compute budget, as the allocation slides between parameters and data. It is a U: too small a model and the capacity term dominates, too big and the data term does. Its bottom is the compute-optimal allocation.*

Symbols:

- `C` — the budget (Fixed, so that every point on the curve costs the same.)
- `k` — the FLOPs per parameter per token (Six for a transformer’s forward and backward pass.)
- `P` — the product the budget pins down (P = C / k = N·D.)
- `N^{*}` — the optimal capacity (Where the two arms of the U balance.)

**Assumptions:**

- The surface is the two-power form with a constant floor, fitted inside the region it is used in.
- The budget is exactly the product k·N·D, so spending on one axis is taken off the other.

**Derivation:**

1. Put D = P/N into the surface, so the loss is a function of N alone at fixed P.
2. Differentiate: the capacity term contributes −αA·N^(−α−1) and the data term +βB·P^(−β)·N^(β−1).
3. Set the sum to zero and rearrange: N^(α+β) = αA/(βB) · P^β, which is the expression above.
4. The second derivative is positive there, so the stationary point is the bottom of the U rather than its top.

**Worked example.** A surface with α = β and A = B, at a product P of 10^6. → **N* = 10^3 and D* = 10^3: the budget splits evenly, and any other split is worse.** (The laboratory measures the arms of this U by running the allocations rather than by trusting the algebra.)

#### Practice

**Q. At the compute optimum, what is true of the two terms of the loss surface? — multiple-choice *(hard)***

- ✓ **They balance in a fixed ratio**
- They are equal
- The model term is zero
- The data term is zero

> Correct.

> **Why:** At the optimum the derivative along the budget vanishes, which gives a fixed ratio between the capacity term and the data term. The ratio depends on the exponents.

**Q. A loss surface is L = 0.2 + 1.0·N^(−0.5) + 2.0·D^(−0.5), and the budget allows N·D = 1e6. At the optimum the capacity term and the data term balance: 1.0·N^(−0.5) = 2.0·D^(−0.5). What is N? — numeric *(hard)***

> **Answer:** 500

> **Why:** The balance gives N^(−0.5) = 2·D^(−0.5), so N = D/4. With N·D = 1e6 that gives D² = 4e6, so D = 2000 and N = 500. The ratio of tokens to parameters at the optimum is 4.

**Q. In the compute-optimal allocation for a language model, roughly how many training tokens does the rule spend per parameter? — multiple-choice *(core)***

- About 2
- ✓ **About 20**
- About 200
- About 2000

> Correct — the rule the IsoFLOP study supports, once the older models’ underspending is corrected for.

> **Why:** Reading the loss off the IsoFLOP frontier at each compute budget gives roughly twenty tokens per parameter. The older models sat far from that rule, which is exactly what re-reading their curves with the right accounting shows.

#### Go and do it

The fitted surface, the budget, and the allocation that minimises the loss. Open **Find the optimum** in the scaling-lab application.

**Where this came from**

- §chinchilla:3 Compute-optimal training — The loss surface in two variables, and the optimisation of the allocation under a fixed budget.
- §chinchilla:3.1 The optimal allocation — The condition that balances the two terms of the loss, and the closed form it gives.

**The words this lesson uses**

- **Allocation** — How a fixed budget is split between the model and the data.
- **Loss surface** — The loss as a function of the model size and the dataset size.
- **Tokens per parameter** — The ratio of training tokens to model parameters.

*Read first:* The compute budget

### Lesson 5. The crossover between size and data

*Kaplan’s question: at what budget does the bigger model start to pay?*

*Estimated study time:* 21 minutes

**What you will learn**

- State what a crossover point is, and which two losses are being set equal
- Derive the product at which two given capacities are equally good
- Explain why the crossover moves when the pair of capacities gets wider

**The ideas**

- At a fixed budget the two candidates get D = P/N rows each, so the comparison is one equation in one unknown.
- Below the crossover the small model trained on more data wins; above it the large model trained on less wins.
- The crossover is a property of the fitted surface, and it is only as good as the grid of runs the surface was fitted on.

#### The mathematics

**The crossover between two model sizes**

$$P^{*\beta} = \frac{B\left(N_2^{\beta} - N_1^{\beta}\right)}{A\left(N_1^{-\alpha} - N_2^{-\alpha}\right)}$$

*The compute at which a larger model trained on less data becomes better than a smaller model trained on more. Below it the small model wins; above it the large one does. It is the point at which “scale up” stops being advice about the parameters and starts being advice about the corpus.*

Symbols:

- `N_1` — the smaller capacity (The model that is cheaper to fill.)
- `N_2` — the larger capacity (The model that needs the data.)
- `P^{*}` — the product at the crossover (The budget divided by k.)

**Assumptions:**

- Both models are trained at the same compute, so each gets D = P/N.
- The floor E is the same for both and cancels.

**Derivation:**

1. Write both losses on the surface with D = P/N.
2. Set them equal; the E terms cancel and the two powers rearrange to the expression above.
3. Solve for P by taking the 1/β power — the crossover exists because the two sides have opposite signs when N₂ > N₁.

**Worked example.** A surface with α = β = 0.5, A = B = 1, and the pair N₁ = 4, N₂ = 16. → **P* = (2 / 0.25)² = 64, so a budget of 384 at k = 6, and both models then sit at E + 0.75.** (The screen walks the whole table on the laboratory’s own surface, so the reader can see the crossover move as the pair gets wider.)

**The two-variable loss surface**

$$L(N, D) = E + A N^{-\alpha} + B D^{-\beta}$$

*The loss as a function of the model size and the dataset size: a floor, a term that falls with the model, and a term that falls with the data.*

Symbols:

- `E` — the irreducible loss (The floor no model beats.)
- `A, B` — the coefficients of the two terms (They set the scale of each term.)
- `\alpha, \beta` — the two exponents (They set where the optimum sits.)

**Assumptions:**

- The three terms are additive, which the fit checks.
- The exponents are the same across the region being fitted.

**Derivation:**

1. Each of the two error sources — not enough capacity, not enough data — contributes a power law.
2. The floor is the part of the loss that is neither.
3. Adding them gives the surface.

**Worked example.** E = 0.2, A = 1, α = 0.5, B = 2, β = 0.5, N = 1000 and D = 1000. → **The loss is 0.2 + 0.0316 + 0.0632 = 0.295.** (The two terms are in the ratio 1 to 2 here, and that ratio is what the optimum fixes.)

#### Practice

**Q. On a surface with α = β = 0.5 and A = B = 1, two models of size 4 and 16 are trained at the same compute. What product P = N·D makes them equally good? — numeric *(hard)***

> **Answer:** 64

> **Why:** P^β = B(16^β − 4^β) / A(4^(−α) − 16^(−α)) = (4−2)/(0.5−0.25) = 8, so P = 64. At that product the small model gets 16 rows and the large one 4, and both land at E + 0.75.

**Q. Below the crossover point, the larger model trained on less data is the better choice. — boolean *(core)***

> **Answer:** False

> **Why:** It is the other way round. Below the crossover the budget cannot fill the larger model, and the smaller one trained on more data wins.

#### Go and do it

Two capacities, one axis of budgets, and the point where the better choice changes sides. Open **Find the crossover** in the scaling-lab application.

**Where this came from**

- §kaplan:2 Main results — The measurement procedure behind the crossover idea: the loss surface measured on a grid of runs, and the comparison of model size against data at a fixed compute.
- §chinchilla:3 Compute-optimal training — The same comparison read the other way: the optimum is where the two terms balance, and the crossover is the pair of allocations around it.

**The words this lesson uses**

- **Crossover point** — The compute at which a larger model overtakes a smaller one.
- **Allocation** — How a fixed budget is split between the model and the data.
- **Loss surface** — The loss as a function of the model size and the dataset size.

*Read first:* The compute-optimal allocation

## 3. The Frontier

*Every allocation at every budget, and the law the best ones obey*

Slide the allocation at a fixed budget and the loss traces a U. Do it at ten budgets and the bottoms of the U’s form a power law of their own. That law is the one a training budget is actually on, and the ratio at its minima is where the twenty-tokens rule comes from — and where it stops being a rule.

**Learning outcomes**

- Draw an IsoFLOP curve and read its minimum off the arms around it
- Derive the exponent of the frontier from the two single-variable exponents
- Say when tokens per parameter is a constant and when it is a trend
- Name the budget at which a finite corpus starts to bind

### Lesson 6. The IsoFLOP curves and the frontier

*A U at each budget, and the power law its bottoms obey*

*Estimated study time:* 26 minutes

**What you will learn**

- Write the loss along a fixed budget and find its minimum in closed form
- State the exponent of the frontier and derive it from the two single-variable exponents
- Compare the analytic optimum with the one found by numeric search

**The ideas**

- Every point of an IsoFLOP curve costs the same, so the curve is a statement about choice rather than about spend.
- The bottom is where the two marginal losses balance, and that balance gives N* and D* without a search.
- The bottoms across budgets fall as C^(−αβ/(α+β)) — the frontier is a consequence of the surface, not a new measurement.

#### The mathematics

**The IsoFLOP curve**

$$L(N;C) = E + A\,N^{-\alpha} + B\left(\frac{C}{kN}\right)^{-\beta},\qquad N^{*} = \left(\frac{\alpha A}{\beta B}\right)^{\frac{1}{\alpha+\beta}} P^{\frac{\beta}{\alpha+\beta}}$$

*The loss along one fixed compute budget, as the allocation slides between parameters and data. It is a U: too small a model and the capacity term dominates, too big and the data term does. Its bottom is the compute-optimal allocation.*

Symbols:

- `C` — the budget (Fixed, so that every point on the curve costs the same.)
- `k` — the FLOPs per parameter per token (Six for a transformer’s forward and backward pass.)
- `P` — the product the budget pins down (P = C / k = N·D.)
- `N^{*}` — the optimal capacity (Where the two arms of the U balance.)

**Assumptions:**

- The surface is the two-power form with a constant floor, fitted inside the region it is used in.
- The budget is exactly the product k·N·D, so spending on one axis is taken off the other.

**Derivation:**

1. Put D = P/N into the surface, so the loss is a function of N alone at fixed P.
2. Differentiate: the capacity term contributes −αA·N^(−α−1) and the data term +βB·P^(−β)·N^(β−1).
3. Set the sum to zero and rearrange: N^(α+β) = αA/(βB) · P^β, which is the expression above.
4. The second derivative is positive there, so the stationary point is the bottom of the U rather than its top.

**Worked example.** A surface with α = β and A = B, at a product P of 10^6. → **N* = 10^3 and D* = 10^3: the budget splits evenly, and any other split is worse.** (The laboratory measures the arms of this U by running the allocations rather than by trusting the algebra.)

**The law the minima obey**

$$L^{*}(C) = E + K\,C^{-\gamma},\qquad \gamma = \frac{\alpha\beta}{\alpha+\beta}$$

*The bottom of each IsoFLOP curve, traced across budgets, is itself a power law. Its exponent is made of the two single-variable exponents and of nothing else, which is why the compute-optimal law can be predicted from the parameter and data laws.*

Symbols:

- `L^{*}(C)` — the best loss at budget C (The loss of the compute-optimal allocation.)
- `K` — the frontier’s coefficient (Fixed by A, B, α and β; the laboratory measures it at a unit budget.)
- `\gamma` — the frontier exponent (The harmonic half of the two exponents: always smaller than either.)

**Assumptions:**

- Both terms of the surface are powers with positive exponents over the whole range of budgets.
- The optimum is interior — no constraint on the pool and no hard floor on either axis.

**Derivation:**

1. At the optimum, N ∝ P^(β/(α+β)), so the capacity term falls as P^(−αβ/(α+β)).
2. D* = P/N* ∝ P^(α/(α+β)), so the data term falls as P^(−βα/(α+β)) — the same power.
3. Both terms therefore fall at γ = αβ/(α+β), and their sum is a constant times that same power.
4. Since P is proportional to C, the exponent in the budget is the exponent in the product.

**Worked example.** α = β = 0.5, so γ = 0.25. → **A budget ten times larger leaves the excess loss at 10^(−0.25) = 0.56 of what it was; a doubling leaves it at 0.84.** (A doubling buys about 16% at the frontier, which is the number a training budget is actually worth.)

#### Practice

**Q. What does the bottom of an IsoFLOP curve give? — multiple-choice *(core)***

- ✓ **The compute-optimal allocation at that budget**
- The largest model that fits in the budget
- The point where the loss stops falling with compute
- The tokens-per-parameter rule

> Correct — the curve is the budget and the bottom is its best split.

> **Why:** Every point on the curve costs the same. The bottom is the allocation the budget should have been spent on, and the arms are what the other choices pay.

**Q. A surface has exponents α = 0.4 and β = 0.6. What is the exponent of the frontier through the IsoFLOP minima? — numeric *(core)***

> **Answer:** 0.24 ± 0.0001

> **Why:** γ = αβ/(α+β) = 0.24/1.0 = 0.24. It is always smaller than either single-variable exponent, which is why the compute-optimal loss falls more slowly than the data alone.

**Q. The minima of a family of IsoFLOP curves are themselves a power law in the budget. — boolean *(core)***

> **Answer:** True

> **Why:** Both terms of the surface fall as C^(−αβ/(α+β)) at the optimum, so their sum does too. The laboratory measures that exponent on fitted runs rather than quoting it.

#### Go and do it

Three budgets, each with its own curve normalised by its own optimum, and the frontier through their minima. Open **Read the U’s** in the scaling-lab application.

**Where this came from**

- §chinchilla:3 Compute-optimal training — The family of models trained along each fixed budget — the measurement the IsoFLOP curve is named after.
- §chinchilla:3.1 The optimal allocation — The condition that balances the two terms at the minimum, and the frontier the minima trace.

**The words this lesson uses**

- **IsoFLOP curve** — The loss along one fixed compute budget, as the allocation slides.
- **The frontier** — The best loss at each budget, traced across budgets.
- **Loss surface** — The loss as a function of the model size and the dataset size.

*Read first:* The compute-optimal allocation

### Lesson 7. The twenty-tokens rule, rederived

*What the ratio at the optimum is, and what it is not*

*Estimated study time:* 23 minutes

**What you will learn**

- Derive the tokens-per-parameter ratio the optimum chooses for itself
- Measure the exponent of that ratio against the budget on a fitted surface
- Say which property of the surface makes the rule a constant, and which makes it a trend

**The ideas**

- The ratio is a consequence: D*/N* has an exponent (α−β)/(α+β) and is flat only when the two exponents agree.
- The predicted allocation exponents and the measured ones are two instruments on one fact, and the screen prints both.
- A rule quoted without the budget it was measured at is a number that will not travel.

#### The mathematics

**The tokens-per-parameter rule**

$$\frac{D^{*}}{N^{*}} = \left(\frac{\beta B}{\alpha A}\right)^{\frac{2}{\alpha+\beta}} P^{\frac{\alpha-\beta}{\alpha+\beta}}$$

*The ratio the optimum chooses for itself. It is a constant only when the two exponents are equal; otherwise it drifts with the budget as a power whose exponent is (α−β)/(α+β). That is the whole content of the rule quoted as “twenty tokens per parameter”.*

Symbols:

- `D^{*}/N^{*}` — tokens per parameter at the optimum (A consequence of the surface, not a setting.)
- `\alpha-\beta` — the difference of the exponents (When it is zero the ratio is a constant; when it is not, the rule is a trend.)

**Assumptions:**

- The same two-power surface as the IsoFLOP curve.
- The budget range is one in which neither term has saturated against the floor.

**Derivation:**

1. Divide D* = P/N* by N* from the IsoFLOP result.
2. The P powers combine as 1 − 2β/(α+β) = (α−β)/(α+β).
3. The constant is the reciprocal of N*’s constant, squared in the appropriate powers, which is (βB/αA)^(2/(α+β)).

**Worked example.** A surface whose fitted exponents are α = 0.44 and β = 0.61. → **The exponent of the ratio is (0.44−0.61)/1.05 = −0.16, so tokens per parameter falls as budgets rise.** (Quoting “20” without the budget it was measured at is quoting a number that is not constant.)

**The law the minima obey**

$$L^{*}(C) = E + K\,C^{-\gamma},\qquad \gamma = \frac{\alpha\beta}{\alpha+\beta}$$

*The bottom of each IsoFLOP curve, traced across budgets, is itself a power law. Its exponent is made of the two single-variable exponents and of nothing else, which is why the compute-optimal law can be predicted from the parameter and data laws.*

Symbols:

- `L^{*}(C)` — the best loss at budget C (The loss of the compute-optimal allocation.)
- `K` — the frontier’s coefficient (Fixed by A, B, α and β; the laboratory measures it at a unit budget.)
- `\gamma` — the frontier exponent (The harmonic half of the two exponents: always smaller than either.)

**Assumptions:**

- Both terms of the surface are powers with positive exponents over the whole range of budgets.
- The optimum is interior — no constraint on the pool and no hard floor on either axis.

**Derivation:**

1. At the optimum, N ∝ P^(β/(α+β)), so the capacity term falls as P^(−αβ/(α+β)).
2. D* = P/N* ∝ P^(α/(α+β)), so the data term falls as P^(−βα/(α+β)) — the same power.
3. Both terms therefore fall at γ = αβ/(α+β), and their sum is a constant times that same power.
4. Since P is proportional to C, the exponent in the budget is the exponent in the product.

**Worked example.** α = β = 0.5, so γ = 0.25. → **A budget ten times larger leaves the excess loss at 10^(−0.25) = 0.56 of what it was; a doubling leaves it at 0.84.** (A doubling buys about 16% at the frontier, which is the number a training budget is actually worth.)

#### Practice

**Q. On a surface with α = 0.44 and β = 0.61, what is the exponent of tokens-per-parameter against the budget? — numeric *(hard)***

> **Answer:** -0.161905 ± 0.001

> **Why:** (α−β)/(α+β) = −0.17/1.05 = −0.162. The ratio is constant only when the two exponents are equal, so “twenty tokens per parameter” is a rule with a budget attached to it.

**Q. When is the tokens-per-parameter ratio at the optimum a constant? — multiple-choice *(core)***

- ✓ **When the two exponents of the surface are equal**
- When the budget is large enough
- When the floor E is zero
- Always, for a transformer

> Correct — the exponent of the ratio is (α−β)/(α+β).

> **Why:** D*/N* is a power of the budget whose exponent is (α−β)/(α+β). Equal exponents make that power vanish; anything else makes the rule a trend.

#### Go and do it

The ratio at each budget, the exponent fitted through it, and the exponent the algebra predicts. Open **Measure the rule** in the scaling-lab application.

**Where this came from**

- §chinchilla:4 Results — The reported tokens-per-parameter ratio at the compute optimum, and the comparison of the optimal models with the state of the art.
- §chinchilla:3.1 The optimal allocation — Where the ratio comes from: the balance of the two terms, read as a number of tokens per parameter.

**The words this lesson uses**

- **Tokens per parameter** — The ratio of training tokens to model parameters.
- **The frontier** — The best loss at each budget, traced across budgets.
- **Exponent** — The number in a power law that says how fast the quantity falls.

*Read first:* The IsoFLOP curves and the frontier

### Lesson 8. When the pool binds

*The budget at which the data runs out, and what happens past it*

*Estimated study time:* 24 minutes

**What you will learn**

- Compute the budget at which the optimal allocation asks for the whole corpus
- Explain why the frontier and the achievable loss come apart past that budget
- Read the price of the constraint off the optimum at a binding budget

**The ideas**

- The frontier says how much data the optimum wants; a corpus is a finite number of rows, and that is where the two stories diverge.
- Beyond the binding budget, extra compute buys repeats rather than data, and the loss falls more slowly than the law says.
- The size of the pool is a variable, and the same budget is unconstrained in one corpus and bound in another.

#### The mathematics

**The IsoFLOP curve**

$$L(N;C) = E + A\,N^{-\alpha} + B\left(\frac{C}{kN}\right)^{-\beta},\qquad N^{*} = \left(\frac{\alpha A}{\beta B}\right)^{\frac{1}{\alpha+\beta}} P^{\frac{\beta}{\alpha+\beta}}$$

*The loss along one fixed compute budget, as the allocation slides between parameters and data. It is a U: too small a model and the capacity term dominates, too big and the data term does. Its bottom is the compute-optimal allocation.*

Symbols:

- `C` — the budget (Fixed, so that every point on the curve costs the same.)
- `k` — the FLOPs per parameter per token (Six for a transformer’s forward and backward pass.)
- `P` — the product the budget pins down (P = C / k = N·D.)
- `N^{*}` — the optimal capacity (Where the two arms of the U balance.)

**Assumptions:**

- The surface is the two-power form with a constant floor, fitted inside the region it is used in.
- The budget is exactly the product k·N·D, so spending on one axis is taken off the other.

**Derivation:**

1. Put D = P/N into the surface, so the loss is a function of N alone at fixed P.
2. Differentiate: the capacity term contributes −αA·N^(−α−1) and the data term +βB·P^(−β)·N^(β−1).
3. Set the sum to zero and rearrange: N^(α+β) = αA/(βB) · P^β, which is the expression above.
4. The second derivative is positive there, so the stationary point is the bottom of the U rather than its top.

**Worked example.** A surface with α = β and A = B, at a product P of 10^6. → **N* = 10^3 and D* = 10^3: the budget splits evenly, and any other split is worse.** (The laboratory measures the arms of this U by running the allocations rather than by trusting the algebra.)

**What a repeated corpus is worth**

$$D_{\mathrm{eff}} = U\left(1 + R^{\star}\left(1 - e^{-R/R^{\star}}\right)\right)$$

*The effective amount of unique data a run of R extra passes over a pool of U tokens is worth. It saturates: the pool can never be worth more than U·(1 + R★), however many times it is read.*

Symbols:

- `U` — the unique tokens (The size of the pool.)
- `R` — the extra passes (The epoch count minus one.)
- `R^{\star}` — the repetition constant (Fitted; the paper’s data-side value is 15.39.)

**Assumptions:**

- Every row is read the same number of times.
- The law is a fit over the regime 1 to 16 epochs, and is used inside it.

**Derivation:**

1. The marginal epoch of the expression is e^(−R/R★): the first repeat is worth almost a fresh one, the twentieth is worth nothing.
2. Summing that decay from zero to R gives R★(1 − e^(−R/R★)) fresh-equivalents.
3. Adding the pool itself gives the law.

**Worked example.** A pool read four times, so R = 3, at the paper’s R★ = 15.39. → **D_eff = U·(1 + 15.39·(1 − e^(−3/15.39))) = 3.73·U, so four epochs are worth 3.73 fresh passes.** (The screen prints the measured curve next to this closed form, and the two are different instruments.)

#### Practice

**Q. On a loss surface whose two exponents are equal, the compute-optimal number of rows grows as the square root of the budget. A pool of 1,000 rows is exactly exhausted at one budget. By what factor does the exhausting budget change for a pool of 250 rows? — numeric *(hard)***

> **Answer:** 0.0625

> **Why:** D* ∝ C^(α/(α+β)), which is C^(1/2) when the exponents agree. Inverting it, the budget that makes D* equal to a given pool grows as the square of the pool: 250/1000 is a quarter, and a quarter squared is 0.0625.

**Q. Past the budget at which a finite corpus stops covering the frontier’s demand, what does extra compute buy? — multiple-choice *(core)***

- ✓ **Passes over rows the model has already read, so the loss falls more slowly than the frontier says**
- Nothing: the loss is flat from there on
- More data, at the same price
- A bigger model, with the data unchanged

> Correct — and the screen prices the difference.

> **Why:** The frontier is a statement about an unbounded supply of rows. Beyond the binding budget the surplus is spent on repeats, and the effective-data law decides what they are worth — which is why the price grows with the budget rather than appearing all at once.

#### Go and do it

The budget where the demand for data meets the pool, and the price at each budget past it. Open **Run the pool out** in the scaling-lab application.

**Where this came from**

- §constrained:4 Model size and data constraints — How the optimal allocation changes when the unique data is exhausted before the compute is.
- §chinchilla:3 Compute-optimal training — The unconstrained optimum the constrained one is measured against.

**The words this lesson uses**

- **The finite pool** — The corpus: a fixed number of rows that cannot be increased.
- **Effective data** — The number of unique rows a run actually learned from.
- **IsoFLOP curve** — The loss along one fixed compute budget, as the allocation slides.

*Read first:* The IsoFLOP curves and the frontier

## 4. Data Constraints

*What to do when the data runs out*

The regime where the unique data is exhausted and the training run has to go round again. The algebra of repetition is simple, and the bill it produces is not: three phases in the measured curve, and a closed form that says how many epochs were ever worth having.

**Learning outcomes**

- Define the number of repeats and the effective number of unique tokens
- Prove that repetition does not change the model a well-specified learner finds
- Measure the price of repetition against the same number of fresh rows
- Tell warmup, plateau and decay apart in a measured epoch curve
- State how many epochs the paper’s own constant says are nearly free

### Lesson 9. The three phases of a repeated run

*Warmup, plateau, and the turn upward*

*Estimated study time:* 25 minutes

**What you will learn**

- Name the three phases and say what each one is a fact about
- Explain why the gap between the repeated and the fresh run is exactly zero at the first epoch
- Read the decay phase off a held-out curve rather than off a training curve

**The ideas**

- At one epoch the two runs have read the same rows, so they are the same run — the warmup is arithmetic, not behaviour.
- The plateau is the pool’s empirical optimum in sight and the fresh data still buying real improvements.
- The decay is the repeated run walking towards a fit to the noise in its own pool, and it shows on held-out data first.

#### The mathematics

**What a repeated corpus is worth**

$$D_{\mathrm{eff}} = U\left(1 + R^{\star}\left(1 - e^{-R/R^{\star}}\right)\right)$$

*The effective amount of unique data a run of R extra passes over a pool of U tokens is worth. It saturates: the pool can never be worth more than U·(1 + R★), however many times it is read.*

Symbols:

- `U` — the unique tokens (The size of the pool.)
- `R` — the extra passes (The epoch count minus one.)
- `R^{\star}` — the repetition constant (Fitted; the paper’s data-side value is 15.39.)

**Assumptions:**

- Every row is read the same number of times.
- The law is a fit over the regime 1 to 16 epochs, and is used inside it.

**Derivation:**

1. The marginal epoch of the expression is e^(−R/R★): the first repeat is worth almost a fresh one, the twentieth is worth nothing.
2. Summing that decay from zero to R gives R★(1 − e^(−R/R★)) fresh-equivalents.
3. Adding the pool itself gives the law.

**Worked example.** A pool read four times, so R = 3, at the paper’s R★ = 15.39. → **D_eff = U·(1 + 15.39·(1 − e^(−3/15.39))) = 3.73·U, so four epochs are worth 3.73 fresh passes.** (The screen prints the measured curve next to this closed form, and the two are different instruments.)

**The effective amount of data**

$$D_{\mathrm{eff}} = \frac{D_{\mathrm{total}}}{E} = \frac{D_{\mathrm{total}}^{2}}{D_{\mathrm{unique}}}$$

*The number of unique rows a run actually learned from, which is what the loss curve should be read against.*

Symbols:

- `D_{\mathrm{total}}` — the tokens read (The size of the training run.)
- `D_{\mathrm{unique}}` — the unique tokens (The size of the dataset before repetition.)
- `E` — the number of repeats (The ratio of the two.)

**Assumptions:**

- Every unique row is read the same number of times, which is what a standard training schedule does.

**Derivation:**

1. The number of repeats is the total read divided by the unique rows.
2. The effective data is the total read divided by the number of repeats.
3. The two together give the effective data as the total squared over the unique.

**Worked example.** A run of 400 billion tokens over a unique dataset of 100 billion tokens. → **The number of repeats is 4 and the effective data is 100 billion tokens.** (The loss curve of that run should be compared with a run of 100 billion fresh tokens, not with 400.)

#### Practice

**Q. With the paper’s repetition constant R★ = 15.39, how many fresh passes is a pool read four times worth? — numeric *(core)***

> **Answer:** 3.7257 ± 0.001

> **Why:** D_eff/U = 1 + R★(1 − e^(−R/R★)) with R = 3 extra passes, which is 1 + 15.39 × 0.1771 = 3.73. The fourth epoch is worth most of a fresh one; the twentieth is worth nothing.

**Q. Why is the gap between the repeated run and the fresh run exactly zero at the first epoch? — multiple-choice *(core)***

- ✓ **Because the two runs have read the same rows — at epoch one they are the same run**
- Because the loss has not started falling yet
- Because the learning rate is still warming up
- Because the held-out set is too small to tell them apart

> Correct.

> **Why:** The repeated run has nothing to repeat until it has seen the pool once. That is what makes the warmup phase arithmetic rather than an assertion about behaviour.

**Q. Over a fixed data pool, a repeated epoch keeps adding as much value as an epoch of fresh data would have. — boolean *(core)***

> **Answer:** False

> **Why:** The repeated runs fall into phases: for a while a repeat behaves like fresh data, then its value decays, and eventually the loss turns upward. The effective data the model sees grows more slowly than the epoch count — repetition is a discount, not a substitute.

#### Go and do it

Two SGD runs over the same tokens, one on repeats and one on fresh rows, epoch by epoch. Open **Watch the phases** in the scaling-lab application.

**Where this came from**

- §constrained:1 Introduction — The setting: what to do when the unique data runs out before the compute does, and the three-part shape of the answer.
- §constrained:3 Repeating data — The measured curves whose phases this lesson is about.

**The words this lesson uses**

- **Epoch** — One pass over the whole pool.
- **The finite pool** — The corpus: a fixed number of rows that cannot be increased.
- **Repeats** — The number of times the training set is read again.
- **Effective data** — The number of unique rows a run actually learned from.

*Read first:* The compute budget

### Lesson 10. How many epochs before repetition dominates

*The dominance epoch, and the fraction that defines it*

*Estimated study time:* 22 minutes

**What you will learn**

- Define the dominance epoch and say what it is measured against
- Show that the epoch you report depends on the fraction you chose
- Compare the measured dominance epoch with the one the paper’s constant predicts

**The ideas**

- Repetition dominates when the next epoch is worth so little that the compute would have been better spent on new rows.
- The criterion is a fraction of the fresh run’s gain, and the table of fractions is the honest version of a single number.
- The closed form says half a fresh epoch at R★·ln 2 passes; the measured curve is allowed to disagree, and the screen prints the disagreement.

#### The mathematics

**What a repeated corpus is worth**

$$D_{\mathrm{eff}} = U\left(1 + R^{\star}\left(1 - e^{-R/R^{\star}}\right)\right)$$

*The effective amount of unique data a run of R extra passes over a pool of U tokens is worth. It saturates: the pool can never be worth more than U·(1 + R★), however many times it is read.*

Symbols:

- `U` — the unique tokens (The size of the pool.)
- `R` — the extra passes (The epoch count minus one.)
- `R^{\star}` — the repetition constant (Fitted; the paper’s data-side value is 15.39.)

**Assumptions:**

- Every row is read the same number of times.
- The law is a fit over the regime 1 to 16 epochs, and is used inside it.

**Derivation:**

1. The marginal epoch of the expression is e^(−R/R★): the first repeat is worth almost a fresh one, the twentieth is worth nothing.
2. Summing that decay from zero to R gives R★(1 − e^(−R/R★)) fresh-equivalents.
3. Adding the pool itself gives the law.

**Worked example.** A pool read four times, so R = 3, at the paper’s R★ = 15.39. → **D_eff = U·(1 + 15.39·(1 − e^(−3/15.39))) = 3.73·U, so four epochs are worth 3.73 fresh passes.** (The screen prints the measured curve next to this closed form, and the two are different instruments.)

#### Practice

**Q. At R★ = 15.39, after how many extra passes is one more worth half a fresh epoch? — numeric *(core)***

> **Answer:** 10.666 ± 0.01

> **Why:** The marginal epoch is e^(−R/R★), so R = −R★·ln(0.5) = 10.67. It is the paper’s own constant answering the paper’s own question, and the measured dominance epoch on screen E is the independent check.

#### Go and do it

What one more epoch buys against what one more fresh epoch buys, and the dominance epoch at five different fractions. Open **Price the epochs** in the scaling-lab application.

**Where this came from**

- §constrained:3 Repeating data — The number of repeats, the loss as a function of it, and the point at which repeats stop paying.
- §constrained:5 Discussion — The practical rule: up to about four epochs is nearly free, and beyond that the value decays away.

**The words this lesson uses**

- **The dominance epoch** — The epoch at which a repeat stops being worth the compute it costs.
- **Epoch** — One pass over the whole pool.
- **Effective data** — The number of unique rows a run actually learned from.

*Read first:* The three phases of a repeated run

### Lesson 11. The turn upward, and the early-stopping epoch

*The pool gets easier while the model gets worse*

*Estimated study time:* 23 minutes

**What you will learn**

- Explain why the loss on the pool keeps falling after the held-out loss has turned upward
- Read the best epoch off a held-out curve, and say what the run loses by passing it
- State why a single restart is not a curve

**The ideas**

- The pool has its own optimum, which is a fit to the noise planted in the pool; past the shared optimum the two come apart.
- The third phase is not a change in the optimiser. It is the same descent aimed at a target that is not the task.
- The compute already spent is not a reason to keep going, and the loss that is visibly falling is not the loss being bought.

#### The mathematics

**What a repeated corpus is worth**

$$D_{\mathrm{eff}} = U\left(1 + R^{\star}\left(1 - e^{-R/R^{\star}}\right)\right)$$

*The effective amount of unique data a run of R extra passes over a pool of U tokens is worth. It saturates: the pool can never be worth more than U·(1 + R★), however many times it is read.*

Symbols:

- `U` — the unique tokens (The size of the pool.)
- `R` — the extra passes (The epoch count minus one.)
- `R^{\star}` — the repetition constant (Fitted; the paper’s data-side value is 15.39.)

**Assumptions:**

- Every row is read the same number of times.
- The law is a fit over the regime 1 to 16 epochs, and is used inside it.

**Derivation:**

1. The marginal epoch of the expression is e^(−R/R★): the first repeat is worth almost a fresh one, the twentieth is worth nothing.
2. Summing that decay from zero to R gives R★(1 − e^(−R/R★)) fresh-equivalents.
3. Adding the pool itself gives the law.

**Worked example.** A pool read four times, so R = 3, at the paper’s R★ = 15.39. → **D_eff = U·(1 + 15.39·(1 − e^(−3/15.39))) = 3.73·U, so four epochs are worth 3.73 fresh passes.** (The screen prints the measured curve next to this closed form, and the two are different instruments.)

**The effective amount of data**

$$D_{\mathrm{eff}} = \frac{D_{\mathrm{total}}}{E} = \frac{D_{\mathrm{total}}^{2}}{D_{\mathrm{unique}}}$$

*The number of unique rows a run actually learned from, which is what the loss curve should be read against.*

Symbols:

- `D_{\mathrm{total}}` — the tokens read (The size of the training run.)
- `D_{\mathrm{unique}}` — the unique tokens (The size of the dataset before repetition.)
- `E` — the number of repeats (The ratio of the two.)

**Assumptions:**

- Every unique row is read the same number of times, which is what a standard training schedule does.

**Derivation:**

1. The number of repeats is the total read divided by the unique rows.
2. The effective data is the total read divided by the number of repeats.
3. The two together give the effective data as the total squared over the unique.

**Worked example.** A run of 400 billion tokens over a unique dataset of 100 billion tokens. → **The number of repeats is 4 and the effective data is 100 billion tokens.** (The loss curve of that run should be compared with a run of 100 billion fresh tokens, not with 400.)

#### Practice

**Q. In the third phase, the loss on the pool keeps falling while the held-out loss rises. Why? — multiple-choice *(core)***

- ✓ **The pool has its own optimum — a fit to the noise in the pool — and the descent is still aimed at it**
- The learning rate has grown too large
- The held-out set is too small to be reliable
- The repeated run has fewer parameters

> Correct. Nothing changed in the optimiser; the target it is aiming at stopped being the task.

> **Why:** The training curve is a measurement of the fit to the pool, and a fit to the pool’s planted noise is still a better fit to the pool. Only the held-out set can tell you that the two have come apart, which is the content of early stopping.

#### Go and do it

The loss on the pool against the held-out loss, the turn, and the epoch the run should have stopped at. Open **Watch the two curves part** in the scaling-lab application.

**Where this came from**

- §constrained:3 Repeating data — The measured epoch curves, and the point past which the held-out loss rises while the training loss falls.
- §constrained:5 Discussion — The practical consequence: repetition is bounded, and the bound is found by early stopping rather than by arithmetic.

**The words this lesson uses**

- **Epoch** — One pass over the whole pool.
- **The dominance epoch** — The epoch at which a repeat stops being worth the compute it costs.
- **The finite pool** — The corpus: a fixed number of rows that cannot be increased.

*Read first:* The three phases of a repeated run, How many epochs before repetition dominates

### Lesson 12. When the data runs out

*Repeats, and what they are worth*

*Estimated study time:* 24 minutes

**What you will learn**

- Define the number of repeats and the effective number of unique tokens
- Write the loss of a learner trained on repeated data
- Show that repetition does not change the model a ridge estimator finds

**The ideas**

- E repeats of U unique rows is E·U rows of training and U rows of information.
- The ridge normal equations are homogeneous in the data, so the solution is unchanged by repetition.
- What repetition buys is the illusion of progress: the same model, at a higher price.

#### The mathematics

**The effect of repetition on a ridge solution**

$$X^{\top} X \to E\, X^{\top} X, \quad X^{\top} y \to E\, X^{\top} y \quad \Longrightarrow \quad w \text{ unchanged}$$

*Repeating every row of the training data E times multiplies both sides of the normal equations by E, so the solution does not change.*

Symbols:

- `X` — the design matrix (One row per training example.)
- `E` — the number of repeats (How many times the unique data is read.)
- `w` — the ridge solution (What the learner would find.)

**Assumptions:**

- The penalty is relative to the mean loss, so it is scaled with the number of rows.
- The learner is closed-form, so there is no optimisation noise to accumulate.

**Derivation:**

1. The normal equations are (XᵀX/N + λI)w = Xᵀy/N.
2. Repeating every row E times multiplies both XᵀX and Xᵀy by E, and the N in the denominator by E.
3. Every term is multiplied by the same factor, so the solution is identical.

**Worked example.** A dataset of 100 unique rows, read four times. → **The model is the same as the one trained on the 100 rows once.** (The only difference is the bill: four times the arithmetic for the same answer.)

**The effective amount of data**

$$D_{\mathrm{eff}} = \frac{D_{\mathrm{total}}}{E} = \frac{D_{\mathrm{total}}^{2}}{D_{\mathrm{unique}}}$$

*The number of unique rows a run actually learned from, which is what the loss curve should be read against.*

Symbols:

- `D_{\mathrm{total}}` — the tokens read (The size of the training run.)
- `D_{\mathrm{unique}}` — the unique tokens (The size of the dataset before repetition.)
- `E` — the number of repeats (The ratio of the two.)

**Assumptions:**

- Every unique row is read the same number of times, which is what a standard training schedule does.

**Derivation:**

1. The number of repeats is the total read divided by the unique rows.
2. The effective data is the total read divided by the number of repeats.
3. The two together give the effective data as the total squared over the unique.

**Worked example.** A run of 400 billion tokens over a unique dataset of 100 billion tokens. → **The number of repeats is 4 and the effective data is 100 billion tokens.** (The loss curve of that run should be compared with a run of 100 billion fresh tokens, not with 400.)

#### Practice

**Q. A ridge estimator is trained on a dataset in which every row is repeated four times. What happens to the solution? — multiple-choice *(core)***

- ✓ **Nothing: the normal equations are homogeneous in the data**
- It is regularised four times as strongly
- It overfits four times as much
- It is four times as large

> Correct.

> **Why:** XᵀX and Xᵀy are both multiplied by the number of repeats, so the solution is unchanged. Repeating the data buys the same model at four times the price.

**Q. A training run reads 400 billion tokens over a unique dataset of 100 billion tokens. How many repeats is that? — numeric *(core)***

> **Answer:** 4

> **Why:** The number of repeats is the tokens read divided by the unique tokens: 400/100 = 4.

#### Go and do it

The repeated run against a fresh run of the same length, and the bill. Open **Pay for the repeats** in the scaling-lab application.

**Where this came from**

- §constrained:1 Introduction — The setting: what to do when the unique data runs out before the compute does.
- §constrained:3 Repeating data — The number of repeats, the loss as a function of it, and the point at which repeats stop paying.

**The words this lesson uses**

- **Repeats** — The number of times the training set is read again.
- **Effective data** — The number of unique rows a run actually learned from.

*Read first:* The compute budget

### Lesson 13. The price of repetition

*Fresh rows against the same rows again*

*Estimated study time:* 22 minutes

**What you will learn**

- Compare a repeated run with a fresh run of the same length on the same held-out set
- Measure how the gap grows with the number of repeats
- State the practical rule the measurement supports

**The ideas**

- Fresh rows keep improving the estimate; repeated rows stop improving it immediately.
- The gap between the two is the price of repetition, and it is paid in compute.
- The rule that falls out is about *unique* tokens, not about tokens.

#### The mathematics

**The effective amount of data**

$$D_{\mathrm{eff}} = \frac{D_{\mathrm{total}}}{E} = \frac{D_{\mathrm{total}}^{2}}{D_{\mathrm{unique}}}$$

*The number of unique rows a run actually learned from, which is what the loss curve should be read against.*

Symbols:

- `D_{\mathrm{total}}` — the tokens read (The size of the training run.)
- `D_{\mathrm{unique}}` — the unique tokens (The size of the dataset before repetition.)
- `E` — the number of repeats (The ratio of the two.)

**Assumptions:**

- Every unique row is read the same number of times, which is what a standard training schedule does.

**Derivation:**

1. The number of repeats is the total read divided by the unique rows.
2. The effective data is the total read divided by the number of repeats.
3. The two together give the effective data as the total squared over the unique.

**Worked example.** A run of 400 billion tokens over a unique dataset of 100 billion tokens. → **The number of repeats is 4 and the effective data is 100 billion tokens.** (The loss curve of that run should be compared with a run of 100 billion fresh tokens, not with 400.)

**What a repeated corpus is worth**

$$D_{\mathrm{eff}} = U\left(1 + R^{\star}\left(1 - e^{-R/R^{\star}}\right)\right)$$

*The effective amount of unique data a run of R extra passes over a pool of U tokens is worth. It saturates: the pool can never be worth more than U·(1 + R★), however many times it is read.*

Symbols:

- `U` — the unique tokens (The size of the pool.)
- `R` — the extra passes (The epoch count minus one.)
- `R^{\star}` — the repetition constant (Fitted; the paper’s data-side value is 15.39.)

**Assumptions:**

- Every row is read the same number of times.
- The law is a fit over the regime 1 to 16 epochs, and is used inside it.

**Derivation:**

1. The marginal epoch of the expression is e^(−R/R★): the first repeat is worth almost a fresh one, the twentieth is worth nothing.
2. Summing that decay from zero to R gives R★(1 − e^(−R/R★)) fresh-equivalents.
3. Adding the pool itself gives the law.

**Worked example.** A pool read four times, so R = 3, at the paper’s R★ = 15.39. → **D_eff = U·(1 + 15.39·(1 − e^(−3/15.39))) = 3.73·U, so four epochs are worth 3.73 fresh passes.** (The screen prints the measured curve next to this closed form, and the two are different instruments.)

#### Practice

**Q. What does the comparison of a repeated run with a fresh run of the same length show? — multiple-choice *(core)***

- ✓ **Fresh rows keep improving the model and repeated rows do not, so the gap is the price of repetition**
- They are the same, so repetition is free
- The repeated run is better, because it sees the data more often
- Nothing can be compared without a different model

> Correct.

> **Why:** Every fresh row is new information; a repeated row is not. The gap between the two curves, measured on the same held-out set, is the price.

#### Go and do it

The two curves, and the gap between them, as the number of repeats grows. Open **Watch the gap open** in the scaling-lab application.

**Where this came from**

- §constrained:5 Discussion — The practical rules: how many repeats, and what to do when there is no more data.

**The words this lesson uses**

- **Effective data** — The number of unique rows a run actually learned from.
- **Repeats** — The number of times the training set is read again.

*Read first:* When the data runs out

### Lesson 14. The effective-data law

*D′ = U·(1 + R★·(1 − e^(−R/R★))), evaluated rather than quoted*

*Estimated study time:* 24 minutes

**What you will learn**

- Write the law and say what each of the three quantities in it is
- Compute the ceiling a pool is ever worth, and the epoch at which a pass is worth half a fresh one
- Name the thing the law has no term for, and say which screen measures it

**The ideas**

- The first pass is worth exactly itself; every later pass is worth e^(−R/R★) of a fresh epoch, which is a decay with no knee in it.
- R★ is the whole of the law’s content: it sets the ceiling U·(1 + R★) and the epoch at which the marginal pass halves.
- The law saturates and a real run turns upward, so the ceiling bounds the law’s optimism rather than the run’s achievement.

#### The mathematics

**What a repeated corpus is worth**

$$D_{\mathrm{eff}} = U\left(1 + R^{\star}\left(1 - e^{-R/R^{\star}}\right)\right)$$

*The effective amount of unique data a run of R extra passes over a pool of U tokens is worth. It saturates: the pool can never be worth more than U·(1 + R★), however many times it is read.*

Symbols:

- `U` — the unique tokens (The size of the pool.)
- `R` — the extra passes (The epoch count minus one.)
- `R^{\star}` — the repetition constant (Fitted; the paper’s data-side value is 15.39.)

**Assumptions:**

- Every row is read the same number of times.
- The law is a fit over the regime 1 to 16 epochs, and is used inside it.

**Derivation:**

1. The marginal epoch of the expression is e^(−R/R★): the first repeat is worth almost a fresh one, the twentieth is worth nothing.
2. Summing that decay from zero to R gives R★(1 − e^(−R/R★)) fresh-equivalents.
3. Adding the pool itself gives the law.

**Worked example.** A pool read four times, so R = 3, at the paper’s R★ = 15.39. → **D_eff = U·(1 + 15.39·(1 − e^(−3/15.39))) = 3.73·U, so four epochs are worth 3.73 fresh passes.** (The screen prints the measured curve next to this closed form, and the two are different instruments.)

**The effective amount of data**

$$D_{\mathrm{eff}} = \frac{D_{\mathrm{total}}}{E} = \frac{D_{\mathrm{total}}^{2}}{D_{\mathrm{unique}}}$$

*The number of unique rows a run actually learned from, which is what the loss curve should be read against.*

Symbols:

- `D_{\mathrm{total}}` — the tokens read (The size of the training run.)
- `D_{\mathrm{unique}}` — the unique tokens (The size of the dataset before repetition.)
- `E` — the number of repeats (The ratio of the two.)

**Assumptions:**

- Every unique row is read the same number of times, which is what a standard training schedule does.

**Derivation:**

1. The number of repeats is the total read divided by the unique rows.
2. The effective data is the total read divided by the number of repeats.
3. The two together give the effective data as the total squared over the unique.

**Worked example.** A run of 400 billion tokens over a unique dataset of 100 billion tokens. → **The number of repeats is 4 and the effective data is 100 billion tokens.** (The loss curve of that run should be compared with a run of 100 billion fresh tokens, not with 400.)

#### Practice

**Q. With the paper’s fitted constant R★ = 15.387756, a pool of 10 billion unique tokens is worth at most U·(1 + R★) effective tokens however many times it is read. What is that ceiling, in billions of tokens? — numeric *(core)***

> **Answer:** 163.87756 ± 0.01

> **Why:** 10 × (1 + 15.387756) = 163.87756 billion. The constant is a multiplier on the pool, and the ceiling is reached only in the limit of infinitely many passes.

#### Go and do it

The effective data and the marginal value of a pass over a pool, at the paper’s constant and at any other. Open **Evaluate the law** in the scaling-lab application.

**Where this came from**

- §constrained:3 Repeating data — The law itself: the effective number of unique tokens as a function of the repeats, and the constant fitted to the measured curves.
- §constrained:5 Discussion — The rule of thumb read off the same expression near its start — up to about four epochs is nearly free.

**The words this lesson uses**

- **Effective data** — The number of unique rows a run actually learned from.
- **Repeats** — The number of times the training set is read again.
- **The dominance epoch** — The epoch at which a repeat stops being worth the compute it costs.
- **The finite pool** — The corpus: a fixed number of rows that cannot be increased.

*Read first:* When the data runs out, The turn upward, and the early-stopping epoch

## 5. Pruning and Percolation

*What a corpus is worth when it is half as big*

Volume is not the only variable a corpus has. Rank the rows by what they are worth and the loss falls faster than any law of volume alone; keep ranking and there comes a fraction below which the rows going are the ones nothing else can replace. Where that fraction is depends on the metric.

**Learning outcomes**

- State the percolation argument for a threshold keep fraction
- Rank four pruning metrics on one pool, and price what each ranking costs
- Predict a threshold from the structure of the pool and compare it with the measured one
- Say what the metric’s own error does to a cliff

### Lesson 15. The percolation threshold

*When the rows going are the rows nothing else can replace*

*Estimated study time:* 25 minutes

**What you will learn**

- State the percolation argument for a threshold keep fraction
- Read a threshold, a best fraction and a cliff edge off one pruning curve
- Explain why the threshold is a property of the metric’s queue rather than of the pool alone

**The ideas**

- Volume laws say a smaller corpus is a worse corpus in a fixed way; percolation says that past some fraction the loss goes faster, because what is being removed stops being redundant.
- The rare rows carry the tail directions, and a direction covered by three rows stops existing when two of them are cut.
- Rank the same pool four ways and the same event happens at four different fractions, because each ranking loses the rare rows when its own queue reaches them.

#### The mathematics

**The percolation threshold of a pruned pool**

$$f^{\star} \approx \frac{m\,d_{\mathrm{tail}}}{N}\quad\text{with}\quad \mathbb{E}[\text{rare kept}] = \sum_{n\,\mathrm{rare}} \Phi\!\left(\frac{\ell_n - \tau(f)}{\sigma}\right)$$

*The keep fraction at which a pruned corpus stops working. Above it the bulk that goes is redundant and the loss barely moves; at it, the rare rows that carry the tail directions start going and the curve breaks.*

Symbols:

- `d_{\mathrm{tail}}` — the tail directions (The parts of the task only a handful of rows carry.)
- `m` — the rows needed per direction (Three in the laboratory, because one row fixes a direction but does not test it.)
- `N` — the size of the pool (All of it, rare and bulk together.)
- `\ell_n` — the log information of row n (‖x‖²/σ² for a linear-Gaussian row.)
- `\sigma` — the metric’s own error (Zero is a perfect metric; the threshold moves with it.)

**Assumptions:**

- The tail directions need a fixed number of rows each, and a direction with none is lost.
- The metric ranks rows by informativeness, so the cut is a threshold on ℓ rather than a random subsample.

**Derivation:**

1. The requirement is m·d_tail rare rows; with a perfect metric, keeping fraction f keeps the top f·N rows.
2. Setting the top fraction equal to the requirement gives f★ ≈ m·d_tail/N.
3. With a noisy metric the surviving count is the sum of the normal tails above the cut, and the cut τ(f) is found by bisection on the same mixture.
4. Because that sum falls as f falls, there is a smallest f at which it still reaches the requirement: the threshold.

**Worked example.** The laboratory’s pool: 400 rows, 24 dimensions of which the last 4 are tail directions, m = 3. → **The requirement is 12 rows, so the predicted threshold is 12/400 = 3% of the pool.** (The screen compares that with the threshold the training runs actually break at.)

**What one row is worth**

$$I_n = \frac{x_n x_n^{\mathsf T}}{\sigma_n^{2}},\qquad \operatorname{tr} I_n = \frac{\lVert x_n\rVert^{2}}{\sigma_n^{2}}$$

*The information a single labelled row carries about the fitted parameters, for a linear model with per-row noise. Its trace is the scalar a pruning metric is trying to rank by, and it is exactly computable here — which is what lets the laboratory define a best possible metric.*

Symbols:

- `x_n` — the row (Its amplitude is what a norm-based metric sees.)
- `\sigma_n` — the noise on that row’s label (Invisible to the inputs, decisive in the ratio.)
- `\operatorname{tr} I_n` — the scalar informativeness (Large when the row is far out and its label is clean.)

**Assumptions:**

- The model is linear in the features and the noise is independent per row.
- The metric may use the labels; a norm-only metric is estimating this quantity without σ.

**Derivation:**

1. For a Gaussian likelihood the Fisher information is the outer product of the gradient of the log-likelihood, which for a linear row is x xᵀ/σ².
2. A scalar ranking needs one number per row, so take the trace.
3. A residual-based score sees the small σ because it fits the row; a norm-based score sees only the large ‖x‖.

**Worked example.** A rare row with an ordinary norm and a label noise ten times smaller than the bulk’s. → **Its information is about two orders above a bulk row of the same size, and a norm ranks it in the middle of the pool.** (That single mismatch is why the two metrics have two different cliffs.)

#### Practice

**Q. A pool of 400 rows has 4 tail directions and needs 3 rare rows per direction. What keep fraction does the percolation argument predict? — numeric *(core)***

> **Answer:** 0.03 ± 0.001

> **Why:** 12 rows out of 400 is 3%. The prediction is a count of rows, not a property of the loss; the screen compares it with the fraction at which the trained runs actually break.

#### Go and do it

The loss as the pool shrinks, against a random subset of the same size, with the threshold and the cliff edge marked. Open **Break the curve** in the scaling-lab application.

**Where this came from**

- §sorscher:1 Introduction — The claim that breaks the law: a pruned corpus can scale better than a larger one, because the information in the data and not its volume is what the loss is a function of.
- §sorscher:3 An analytic theory of data pruning — The percolation argument: clusters, rarity, and the keep fraction below which the tail of the distribution starts going.

**The words this lesson uses**

- **Percolation threshold** — The keep fraction at which a pruned corpus stops working.
- **Rare rows** — The few rows that carry what nothing else in the pool carries.
- **Pruning metric** — The score that ranks the rows of a pool from most to least worth keeping.
- **The finite pool** — The corpus: a fixed number of rows that cannot be increased.

*Read first:* What a power law says, When the data runs out

### Lesson 16. Four metrics on one pool

*Oracle, strong, weak, random — and what each ranking costs*

*Estimated study time:* 27 minutes

**What you will learn**

- Rank four pruning metrics at matched volume and read each one’s own threshold
- Explain the difference between a comparison at matched volume and one at matched compute
- Say which of the four metrics a practitioner can actually compute, and what that costs

**The ideas**

- The oracle ranks rows by the information they truly carry and nobody has it; it is the ceiling the computable metrics are scored against rather than a fifth option.
- A strong metric has to be fitted over the whole pool before it can score a row, so its win on volume has to survive a baseline handed the same number of extra rows.
- The paper’s ordering — strong beats weak, weak beats random, each with its own cliff — is a claim, and the table is the test of it on this pool with this seed.

#### The mathematics

**What one row is worth**

$$I_n = \frac{x_n x_n^{\mathsf T}}{\sigma_n^{2}},\qquad \operatorname{tr} I_n = \frac{\lVert x_n\rVert^{2}}{\sigma_n^{2}}$$

*The information a single labelled row carries about the fitted parameters, for a linear model with per-row noise. Its trace is the scalar a pruning metric is trying to rank by, and it is exactly computable here — which is what lets the laboratory define a best possible metric.*

Symbols:

- `x_n` — the row (Its amplitude is what a norm-based metric sees.)
- `\sigma_n` — the noise on that row’s label (Invisible to the inputs, decisive in the ratio.)
- `\operatorname{tr} I_n` — the scalar informativeness (Large when the row is far out and its label is clean.)

**Assumptions:**

- The model is linear in the features and the noise is independent per row.
- The metric may use the labels; a norm-only metric is estimating this quantity without σ.

**Derivation:**

1. For a Gaussian likelihood the Fisher information is the outer product of the gradient of the log-likelihood, which for a linear row is x xᵀ/σ².
2. A scalar ranking needs one number per row, so take the trace.
3. A residual-based score sees the small σ because it fits the row; a norm-based score sees only the large ‖x‖.

**Worked example.** A rare row with an ordinary norm and a label noise ten times smaller than the bulk’s. → **Its information is about two orders above a bulk row of the same size, and a norm ranks it in the middle of the pool.** (That single mismatch is why the two metrics have two different cliffs.)

#### Practice

**Q. On one pool, four metrics give four different cliffs. What does that establish about the threshold? — multiple-choice *(hard)***

- ✓ **It is a property of the metric and the pool together**
- It is a property of the pool alone
- It is a measurement error
- It is set by the model’s capacity

> Correct — the ranking decides which rows go, so it decides where they stop going.

> **Why:** A threshold is where the rows a metric values run out. Two metrics that rank differently run out in different places, which is the paper’s point about curation being a property of the data and the tool.

**Q. A metric that ranks rows by their norm can be beaten by one that ranks them by what the labels support. — boolean *(core)***

> **Answer:** True

> **Why:** The information a row carries is ‖x‖²/σ²: the norm sees the amplitude and not the noise. A residual-based ranking sees both, keeps the rare rows, and has a lower threshold.

#### Go and do it

Each metric at the fraction where it is best, with its excess over random and its own cost in rows. Open **Rank the metrics** in the scaling-lab application.

**Where this came from**

- §sorscher:5 Benchmarking supervised pruning metrics on ImageNet — The ranking of the metrics at matched volume, and the finding that a metric’s own cost is part of the comparison.
- §sorscher:2 Background and related work — Where the volume laws come from, and why a similarity metric is expected to beat them.

**The words this lesson uses**

- **Pruning metric** — The score that ranks the rows of a pool from most to least worth keeping.
- **Metric** — The function that turns a model’s output into a score.
- **Rare rows** — The few rows that carry what nothing else in the pool carries.
- **Percolation threshold** — The keep fraction at which a pruned corpus stops working.

*Read first:* The percolation threshold

### Lesson 17. Predicting the cliff before it happens

*m rare rows per direction, and the survival of a queue with error in it*

*Estimated study time:* 26 minutes

**What you will learn**

- Compute the threshold the structure of a pool predicts, with no free parameter
- Compare the predicted fraction with the measured one on the same pool
- Say what the prediction does as the metric’s error grows past the information spread

**The ideas**

- The prediction is a survival calculation: how many rare rows are expected to outrank the cut at each keep fraction, against the number the tail directions need.
- At zero error the answer is the share of the pool that ranks above the rarest rare row — a property of the pool, not of the loss.
- Past the information spread a rare row survives a cut exactly as often as a bulk row does, the predicted threshold goes to one, and there is nothing left to prune.

#### The mathematics

**The percolation threshold of a pruned pool**

$$f^{\star} \approx \frac{m\,d_{\mathrm{tail}}}{N}\quad\text{with}\quad \mathbb{E}[\text{rare kept}] = \sum_{n\,\mathrm{rare}} \Phi\!\left(\frac{\ell_n - \tau(f)}{\sigma}\right)$$

*The keep fraction at which a pruned corpus stops working. Above it the bulk that goes is redundant and the loss barely moves; at it, the rare rows that carry the tail directions start going and the curve breaks.*

Symbols:

- `d_{\mathrm{tail}}` — the tail directions (The parts of the task only a handful of rows carry.)
- `m` — the rows needed per direction (Three in the laboratory, because one row fixes a direction but does not test it.)
- `N` — the size of the pool (All of it, rare and bulk together.)
- `\ell_n` — the log information of row n (‖x‖²/σ² for a linear-Gaussian row.)
- `\sigma` — the metric’s own error (Zero is a perfect metric; the threshold moves with it.)

**Assumptions:**

- The tail directions need a fixed number of rows each, and a direction with none is lost.
- The metric ranks rows by informativeness, so the cut is a threshold on ℓ rather than a random subsample.

**Derivation:**

1. The requirement is m·d_tail rare rows; with a perfect metric, keeping fraction f keeps the top f·N rows.
2. Setting the top fraction equal to the requirement gives f★ ≈ m·d_tail/N.
3. With a noisy metric the surviving count is the sum of the normal tails above the cut, and the cut τ(f) is found by bisection on the same mixture.
4. Because that sum falls as f falls, there is a smallest f at which it still reaches the requirement: the threshold.

**Worked example.** The laboratory’s pool: 400 rows, 24 dimensions of which the last 4 are tail directions, m = 3. → **The requirement is 12 rows, so the predicted threshold is 12/400 = 3% of the pool.** (The screen compares that with the threshold the training runs actually break at.)

**What one row is worth**

$$I_n = \frac{x_n x_n^{\mathsf T}}{\sigma_n^{2}},\qquad \operatorname{tr} I_n = \frac{\lVert x_n\rVert^{2}}{\sigma_n^{2}}$$

*The information a single labelled row carries about the fitted parameters, for a linear model with per-row noise. Its trace is the scalar a pruning metric is trying to rank by, and it is exactly computable here — which is what lets the laboratory define a best possible metric.*

Symbols:

- `x_n` — the row (Its amplitude is what a norm-based metric sees.)
- `\sigma_n` — the noise on that row’s label (Invisible to the inputs, decisive in the ratio.)
- `\operatorname{tr} I_n` — the scalar informativeness (Large when the row is far out and its label is clean.)

**Assumptions:**

- The model is linear in the features and the noise is independent per row.
- The metric may use the labels; a norm-only metric is estimating this quantity without σ.

**Derivation:**

1. For a Gaussian likelihood the Fisher information is the outer product of the gradient of the log-likelihood, which for a linear row is x xᵀ/σ².
2. A scalar ranking needs one number per row, so take the trace.
3. A residual-based score sees the small σ because it fits the row; a norm-based score sees only the large ‖x‖.

**Worked example.** A rare row with an ordinary norm and a label noise ten times smaller than the bulk’s. → **Its information is about two orders above a bulk row of the same size, and a norm ranks it in the middle of the pool.** (That single mismatch is why the two metrics have two different cliffs.)

#### Practice

**Q. As a pruning metric’s own error grows far past the spread of information in the pool, what does the predicted threshold approach? — multiple-choice *(hard)***

- ✓ **One: a rare row survives a cut exactly as often as a bulk row does, so there is nothing to prune**
- Zero: the metric gets braver as its error grows
- The share of the pool that is rare
- It does not move: the threshold is a property of the pool

> Correct — the ranking has become a shuffle.

> **Why:** The prediction is a survival calculation on the metric’s queue. Once the noise on the score exceeds the difference between the groups, the queue is random, the rare rows are lost at the same rate as everything else, and the honest answer is that no fraction is safe.

#### Go and do it

The rare rows surviving each cut, the requirement the tail needs, and the prediction against the measurement. Open **Make the prediction** in the scaling-lab application.

**Where this came from**

- §sorscher:3 An analytic theory of data pruning — The prediction: m rows per direction have to survive, and the keep fraction that does that is the threshold.
- §sorscher:7 Discussion — The limits of the theory: it is about a clustered corpus and a similarity metric, and the numbers are the ones the argument needs.

**The words this lesson uses**

- **Percolation threshold** — The keep fraction at which a pruned corpus stops working.
- **Rare rows** — The few rows that carry what nothing else in the pool carries.
- **Pruning metric** — The score that ranks the rows of a pool from most to least worth keeping.
- **A cliff** — A steep transition in a measured curve.

*Read first:* The percolation threshold, Four metrics on one pool

## 6. Emergence

*The cliff, and the metric that makes it*

Some abilities appear to arrive suddenly. The mechanism is a metric with a threshold in it, applied to a capability that rises smoothly. Both halves of that sentence are computable.

**Learning outcomes**

- Describe what an emergent curve looks like, and what an alternative metric shows
- Explain the mechanism by which a threshold in the metric creates a cliff
- Show that the point of the cliff moves when the metric’s threshold moves

### Lesson 18. What emergence looks like

*A score that is zero, and then is not*

*Estimated study time:* 22 minutes

**What you will learn**

- Describe the shape of an emergent curve and what makes it striking
- Read an emergent curve and say what it does not establish about the model
- Compute the same capability under a second, continuous metric

**The ideas**

- The curve is flat, then steep, and the steep part is where the attention goes.
- A flat region is not a model that cannot do the task; it is a metric that cannot see it.
- The same model, scored differently, can look smooth.

#### The mathematics

**The whole-sequence score**

$$S_{\mathrm{seq}} = q^{L}$$

*The score of a task scored only when every token is right, given a per-token accuracy. It is the mechanism by which a smooth capability produces an apparent cliff.*

Symbols:

- `q` — the per-token accuracy (The smooth, underlying quantity.)
- `L` — the length of the sequence (The number of tokens that must all be right.)
- `S_{\mathrm{seq}}` — the score (The probability that the whole sequence is right.)

**Assumptions:**

- The tokens are correct independently, which is a simplification and a generous one.
- The metric gives no partial credit, which is the usual case for exact match.

**Derivation:**

1. The probability that all L tokens are right is the product of L probabilities.
2. If each is q, the product is q^L.
3. A number below one, raised to a higher power, falls further and faster — so the transition sharpens as L grows.

**Worked example.** A per-token accuracy of 0.95 and a sequence of ten tokens. → **The score is 0.95^10 = 0.599.** (The model is right about 95% of the time and scores under 60%. Change the metric and the cliff moves.)

#### Practice

**Q. What does an emergent curve establish? — multiple-choice *(core)***

- ✓ **That the measured score is flat and then steep**
- That the model’s capability is flat and then steep
- That the task is impossible below a size
- That the training run failed

> Correct — and that is a statement about the score.

> **Why:** The curve is a fact about the metric applied to the model. Whether the model itself changed discontinuously is a separate question, and the answer depends on the metric.

#### Go and do it

One capability, two metrics, and the two curves they produce. Open **Look at the cliff** in the scaling-lab application.

**Where this came from**

- §mirage:1 Introduction — The claim under examination: that some abilities appear suddenly, and that the appearance is a property of the metric.

**The words this lesson uses**

- **Emergence** — An ability whose measured score appears suddenly rather than gradually.
- **Metric** — The function that turns a model’s output into a score.

*Read first:* What a power law says

### Lesson 19. Reproducing the artefact

*One sweep, two readings, and the gap between them*

*Estimated study time:* 24 minutes

**What you will learn**

- Define the reporting floor and read an onset off it
- Find the widest gap between the per-token accuracy and the whole-sequence score on one sweep
- Explain why the location of a cliff is a fact about the floor as much as about the model

**The ideas**

- The onset is the first point above a chosen floor, so the claimed discovery moves when the floor moves — and the floor is a defensible choice, which is not the same as a forced one.
- The gap is widest in the middle of the climb: that is where “the model cannot do this” and “the model gets most of the tokens right” are both true, and only one of them is about the metric.
- A cliff interval needs two onsets, and the underlying accuracy never has one because it never stops rising.

#### The mathematics

**The whole-sequence score**

$$S_{\mathrm{seq}} = q^{L}$$

*The score of a task scored only when every token is right, given a per-token accuracy. It is the mechanism by which a smooth capability produces an apparent cliff.*

Symbols:

- `q` — the per-token accuracy (The smooth, underlying quantity.)
- `L` — the length of the sequence (The number of tokens that must all be right.)
- `S_{\mathrm{seq}}` — the score (The probability that the whole sequence is right.)

**Assumptions:**

- The tokens are correct independently, which is a simplification and a generous one.
- The metric gives no partial credit, which is the usual case for exact match.

**Derivation:**

1. The probability that all L tokens are right is the product of L probabilities.
2. If each is q, the product is q^L.
3. A number below one, raised to a higher power, falls further and faster — so the transition sharpens as L grows.

**Worked example.** A per-token accuracy of 0.95 and a sequence of ten tokens. → **The score is 0.95^10 = 0.599.** (The model is right about 95% of the time and scores under 60%. Change the metric and the cliff moves.)

#### Practice

**Q. The onset of the cliff is reported as the first compute at which the score clears a chosen floor. What follows from that? — multiple-choice *(core)***

- ✓ **Move the floor and the claimed discovery moves, with nothing changed in the model**
- The floor is arbitrary, so the whole measurement is worthless
- The underlying accuracy moves with the floor too
- A lower floor makes the ability more real

> Correct — and the screen names the floor it made the choice at.

> **Why:** An onset read against a reporting floor is a property of the reporting rule as much as of the model. The gap column is widest mid-climb, where “the model cannot do this” and “the model gets most tokens right” are simultaneously true.

#### Go and do it

Forty points over three decades of compute: the accuracy, the score, the difference, and the floor that decides where the cliff began. Open **Measure the gap** in the scaling-lab application.

**Where this came from**

- §mirage:3 The metric — The argument that a nonlinear or thresholded metric on a smooth capability produces the appearance of a discontinuity.
- §mirage:4 Results — The re-readings: abilities that look emergent under one metric and smooth under another, on the same models.

**The words this lesson uses**

- **Per-token accuracy** — The fraction of the tokens a model gets right.
- **Metric** — The function that turns a model’s output into a score.
- **A cliff** — A steep transition in a measured curve.
- **Emergence** — An ability whose measured score appears suddenly rather than gradually.

*Read first:* What emergence looks like

### Lesson 20. What causes the cliff

*A threshold in the metric, on a smooth capability*

*Estimated study time:* 26 minutes

**What you will learn**

- Derive the whole-sequence score as a power of the per-token accuracy
- Show that the sharper the metric, the sharper the apparent transition
- Show that moving the metric’s threshold moves the cliff

**The ideas**

- A whole-sequence score is the per-token accuracy raised to the length of the sequence.
- The longer the sequence, the steeper the apparent transition — and nothing about the model changed.
- The cliff is in the metric; the capability underneath it is smooth all the way.

#### The mathematics

**The whole-sequence score**

$$S_{\mathrm{seq}} = q^{L}$$

*The score of a task scored only when every token is right, given a per-token accuracy. It is the mechanism by which a smooth capability produces an apparent cliff.*

Symbols:

- `q` — the per-token accuracy (The smooth, underlying quantity.)
- `L` — the length of the sequence (The number of tokens that must all be right.)
- `S_{\mathrm{seq}}` — the score (The probability that the whole sequence is right.)

**Assumptions:**

- The tokens are correct independently, which is a simplification and a generous one.
- The metric gives no partial credit, which is the usual case for exact match.

**Derivation:**

1. The probability that all L tokens are right is the product of L probabilities.
2. If each is q, the product is q^L.
3. A number below one, raised to a higher power, falls further and faster — so the transition sharpens as L grows.

**Worked example.** A per-token accuracy of 0.95 and a sequence of ten tokens. → **The score is 0.95^10 = 0.599.** (The model is right about 95% of the time and scores under 60%. Change the metric and the cliff moves.)

#### Practice

**Q. A model gets each token right with probability 0.95, and a task is scored only when the whole sequence of 10 tokens is right. What is the score? — numeric *(core)***

> **Answer:** 0.598737 ± 0.001

> **Why:** The whole-sequence score is 0.95^10 ≈ 0.5987. The model is right about 95% of tokens and scores under 60% on the task.

**Q. Why does a longer task make the transition look sharper? — multiple-choice *(hard)***

- ✓ **The whole-sequence score is the per-token accuracy raised to the length**
- Longer tasks are harder for every model
- The metric is noisier for long tasks
- The compute per token falls

> Correct.

> **Why:** Raising a number below one to a higher power pushes it down and makes the transition steeper. Nothing about the model changed; the length of the task did.

**Q. A benchmark shows a capability switching on abruptly between two scales. Before calling it emergent, what should be checked first? — multiple-choice *(core)***

- ✓ **Whether the metric itself hides smooth progress — exact match, for instance, scores nothing until a threshold**
- Whether the learning-rate schedule was tuned
- Whether the tokenizer changed between scales
- Whether the random seed was lucky

> Correct — the discontinuity can live in the measurement rather than in the model.

> **Why:** A nonlinear metric turns a smooth underlying curve into a step. Measured with a continuous metric, the same capability frequently replaces the cliff with a slope — which is the check the mirage result names.

#### Go and do it

The same capability, scored with a threshold that moves. Open **Move the metric** in the scaling-lab application.

**Where this came from**

- §mirage:3 The metric — How a discontinuous metric on a continuous capability creates an apparent cliff, and the nonlinearity argument.
- §mirage:4 Results — The experiments: emergent-looking abilities that are not emergent, and the metrics that reveal it.

**The words this lesson uses**

- **Emergence** — An ability whose measured score appears suddenly rather than gradually.
- **Metric** — The function that turns a model’s output into a score.
- **Per-token accuracy** — The fraction of the tokens a model gets right.

*Read first:* What emergence looks like

## 7. Compute Through Time

*The trend under the budgets*

A budget is a number until somebody buys the machine to spend it. The record of what has been spent grows log-linearly, with breaks in it that the analyst places rather than finds, and a scaling law turned into a rate is the only way to say what a loss cost in a given year.

**Learning outcomes**

- Convert a slope in orders of magnitude a year into a doubling time and back
- Tell a break in a trend from a straight line that has been split anyway
- Say what a target loss costs, and the year it became buyable
- Name the assumption every date on that chain rests on

### Lesson 21. Three eras and one straight line

*The reported slope, the reported doubling, and the reported range*

*Estimated study time:* 22 minutes

**What you will learn**

- Convert a slope in orders of magnitude a year into a doubling time, and back
- Say why the reported range of an era and the reported slope of it disagree
- Name which numbers on the screen are quoted from the paper rather than computed

**The ideas**

- A slope and a doubling time are one statement in two units, and the conversion is exact: twelve times log₁₀2 divided by the months.
- A range is an envelope — the two most extreme runs — and a slope is a trend through a scattered middle, so reading the first as the second is how a headline growth rate is made.
- The eras are placed by the analyst: one boundary is a date in the middle of a year rather than a bin, because the event it marks is a date.

#### The mathematics

**A trend in compute, and what it buys**

$$T_{\mathrm{double}} = \frac{12\log_{10} 2}{s}\ \text{months},\qquad \frac{L(t+1)}{L(t)} = 10^{-\gamma s}$$

*A log-linear trend in compute, stated in the two units it is quoted in — orders of magnitude a year and months per doubling — and turned into a capability by the frontier exponent. A hardware trend is only a capability once it is multiplied by a law.*

Symbols:

- `s` — orders of magnitude a year (The slope of the log-compute trend.)
- `T_{\mathrm{double}}` — months per doubling (The same slope in the other unit: 24 months is s = 0.15.)
- `\gamma` — the frontier exponent (From the law the minima obey, not from the hardware.)

**Assumptions:**

- The trend is log-linear over the window it is quoted for; a break makes a single slope meaningless.
- The money to spend the capability exists, and a run fits in the wall-clock assumed.

**Derivation:**

1. A doubling is log₁₀2 orders of magnitude, so the doubling time in years is log₁₀2/s; twelve times that is in months.
2. The frontier says the best loss at budget C falls as C^(−γ), so a year multiplying C by 10^s multiplies the excess loss by 10^(−γs).
3. Inverting the same law gives the budget a target loss costs, and so the year that target became buyable.

**Worked example.** The deep-learning era, reported as 0.6 orders of magnitude a year and a doubling every 5.7 months, against a frontier exponent of 0.25. → **The slope converts to 6.0 months a doubling — the paper’s two statistics disagree by half a month — and the loss factor is 10^(−0.15) = 0.71 a year.** (The era’s numbers are quoted from the paper; the conversion, the disagreement and the multiplication by γ are this course’s arithmetic, and screen H prints all three.)

**The factor a doubling buys**

$$\frac{L(2N)}{L(N)} = 2^{-\alpha}$$

*The multiplicative improvement that a doubling of the scaled quantity buys. It is the form in which a scaling law is worth quoting.*

Symbols:

- `\alpha` — the exponent (The same exponent as in the law itself.)

**Assumptions:**

- The doubling stays inside the region where the law holds.

**Derivation:**

1. Substitute 2N for N in the law.
2. The factor is 2^(−α) because (2N)^(−α) = N^(−α)·2^(−α).

**Worked example.** An exponent of 0.5. → **The factor is 2^(−0.5) = 0.707, so a doubling improves the loss by about 29%.** (Which is the difference between a law worth obeying and one worth ignoring.)

#### Practice

**Q. A compute trend rises by 0.6 orders of magnitude a year. How many months per doubling does that convert to? — numeric *(core)***

> **Answer:** 6.0206 ± 0.005

> **Why:** A doubling is log₁₀2 = 0.3010 orders, so 0.3010/0.6 = 0.5017 years = 6.02 months. The paper reports 5.7 for the same era, and screen H prints the disagreement rather than smoothing it.

**Q. Why can a trend’s slope and its reported range imply different doubling times? — multiple-choice *(hard)***

- ✓ **A fitted slope describes the middle of a scattered set; a range is the distance between two extremes**
- One of them must be a mistake
- The units differ by a factor of twelve
- The trend is not log-linear

> Correct.

> **Why:** Extremes are single runs; the slope is a least-squares line through dozens. In an era with a lot of scatter they disagree, and that is a fact about trend lines rather than about this course.

**Q. What distinguished the most recent era of the compute trend from the growth Moore’s law describes? — multiple-choice *(core)***

- ✓ **The growth came from spending more, not from hardware getting faster at the same price**
- The growth came from cheaper memory
- The growth came from better algorithms alone
- The growth came from longer training runs of the same-sized models

> Correct — the doubling time of compute spent is far shorter than the doubling time of FLOP/s per dollar.

> **Why:** The three eras separate by what drives the compute: before deep learning, the available hardware; in the deep-learning era, hardware at Moore’s-law pace; in the large-scale era, spending — compute doubling roughly every six months, against hardware’s few years.

#### Go and do it

Each era’s three readings of its own growth, and the rate the whole fixture’s trend gives back. Open **Read the eras** in the scaling-lab application.

**Where this came from**

- §sevilla:1 Introduction — The measurement: training compute has grown log-linearly, and the growth has breaks in it.
- §sevilla:3 Trends — The three eras and the statistics reported for each: the slope in orders of magnitude a year, the doubling time, and the range of the runs.

**The words this lesson uses**

- **Log-linear trend** — A straight line on a log scale: a constant multiplicative growth.
- **A doubling** — The unit in which a scaling law is usually quoted.
- **A break in a trend** — A change of slope, fitted rather than noticed.

*Read first:* How the exponent is measured

### Lesson 22. A break in the trend, and what it costs to claim one

*Every split, both sides fitted, and a penalty of two log n*

*Estimated study time:* 23 minutes

**What you will learn**

- Describe the split search and the penalty a detected break has to pay
- Explain why a series that is exactly straight must not report a change of slope
- Say why a break is a claim about the future rather than a description of the past

**The ideas**

- The search tries every split, fits both sides, and keeps the smallest residual sum of squares only once the split has paid for its two extra parameters.
- Requiring the two slopes to differ is what stops floating-point noise from being read as a discovery.
- One trend over a broken series is not wrong so much as averaged: it reports the middle of two rates and predicts neither.

#### The mathematics

**A trend in compute, and what it buys**

$$T_{\mathrm{double}} = \frac{12\log_{10} 2}{s}\ \text{months},\qquad \frac{L(t+1)}{L(t)} = 10^{-\gamma s}$$

*A log-linear trend in compute, stated in the two units it is quoted in — orders of magnitude a year and months per doubling — and turned into a capability by the frontier exponent. A hardware trend is only a capability once it is multiplied by a law.*

Symbols:

- `s` — orders of magnitude a year (The slope of the log-compute trend.)
- `T_{\mathrm{double}}` — months per doubling (The same slope in the other unit: 24 months is s = 0.15.)
- `\gamma` — the frontier exponent (From the law the minima obey, not from the hardware.)

**Assumptions:**

- The trend is log-linear over the window it is quoted for; a break makes a single slope meaningless.
- The money to spend the capability exists, and a run fits in the wall-clock assumed.

**Derivation:**

1. A doubling is log₁₀2 orders of magnitude, so the doubling time in years is log₁₀2/s; twelve times that is in months.
2. The frontier says the best loss at budget C falls as C^(−γ), so a year multiplying C by 10^s multiplies the excess loss by 10^(−γs).
3. Inverting the same law gives the budget a target loss costs, and so the year that target became buyable.

**Worked example.** The deep-learning era, reported as 0.6 orders of magnitude a year and a doubling every 5.7 months, against a frontier exponent of 0.25. → **The slope converts to 6.0 months a doubling — the paper’s two statistics disagree by half a month — and the loss factor is 10^(−0.15) = 0.71 a year.** (The era’s numbers are quoted from the paper; the conversion, the disagreement and the multiplication by γ are this course’s arithmetic, and screen H prints all three.)

**Fitting a law by least squares**

$$\min_{a,b}\sum_i\left(a + b\log x_i - \log y_i\right)^2,\qquad \alpha = -b$$

*The estimator behind every exponent in this course. A power law is a straight line in logs, so the exponent is the negative of the fitted slope and the coefficient is the intercept.*

Symbols:

- `x_i` — the scaled quantity (Tokens, parameters, or the product the budget pins down.)
- `y_i` — the measured loss (The held-out loss of run i.)
- `b` — the fitted slope (The negative of the exponent.)

**Assumptions:**

- The errors are multiplicative, which is what taking logs assumes when the residuals are fitted in log space.
- Every point is in the region where one law describes the curve.

**Derivation:**

1. Write the law as log y = a − α log x.
2. Least squares in the two coefficients is ordinary linear regression on the logged columns.
3. The R² of that regression is the fraction of the log-loss variance the line explains — a number about the fit, not about the range.

**Worked example.** The laboratory’s 20 runs, fitted over capacities 4 to 64. → **The slope in log–log space is negative, and −b is the exponent the screen prints as α.** (The same runs fitted over half the range give a different α, which is the point of screen A’s second tab.)

#### Practice

**Q. Run on a series that is exactly one straight line in log space, a break detector should report a change of slope. — boolean *(hard)***

> **Answer:** False

> **Why:** It should report nothing. A split always improves the fit slightly, so a break only counts when the two sides disagree by more than the noise — otherwise the answer is whichever year the rounding favours.

#### Go and do it

A planted change of slope, the split the detector finds, and the single fit it replaces. Open **Find the break** in the scaling-lab application.

**Where this came from**

- §sevilla:3 Trends — The piecewise fits: the eras are separate regressions, and the change between them is the result being reported.
- §sevilla:4 Conclusion — What the trend is and is not: a fit to landmark runs, with the eras placed by the analyst rather than given by the data.

**The words this lesson uses**

- **A break in a trend** — A change of slope, fitted rather than noticed.
- **Log-linear trend** — A straight line on a log scale: a constant multiplicative growth.
- **R²** — The fraction of the variation a fit explains.

*Read first:* Three eras and one straight line

### Lesson 23. What a trend buys, and the year it became buyable

*Inverting the frontier, dividing by a wall-clock, reading a series*

*Estimated study time:* 25 minutes

**What you will learn**

- Name the three steps from a loss target to a year, and what each one assumes
- Explain why the factor between the budget’s units and FLOP/s moves every date and no shape
- Read the flag that says whether an answer was interpolated inside the series or projected outside it

**The ideas**

- The frontier inverted gives the budget a loss costs, the budget over the run’s hours gives the rate, and the series read at the rate gives the year.
- The surface’s budget is in the units of its own runs, so the bridge to FLOP/s is an assumption; halving it changes every date by a predictable amount and changes nothing else.
- A target at or below the fitted floor cannot be bought at any price, and reporting that is the answer rather than a failure to produce one.

#### The mathematics

**A trend in compute, and what it buys**

$$T_{\mathrm{double}} = \frac{12\log_{10} 2}{s}\ \text{months},\qquad \frac{L(t+1)}{L(t)} = 10^{-\gamma s}$$

*A log-linear trend in compute, stated in the two units it is quoted in — orders of magnitude a year and months per doubling — and turned into a capability by the frontier exponent. A hardware trend is only a capability once it is multiplied by a law.*

Symbols:

- `s` — orders of magnitude a year (The slope of the log-compute trend.)
- `T_{\mathrm{double}}` — months per doubling (The same slope in the other unit: 24 months is s = 0.15.)
- `\gamma` — the frontier exponent (From the law the minima obey, not from the hardware.)

**Assumptions:**

- The trend is log-linear over the window it is quoted for; a break makes a single slope meaningless.
- The money to spend the capability exists, and a run fits in the wall-clock assumed.

**Derivation:**

1. A doubling is log₁₀2 orders of magnitude, so the doubling time in years is log₁₀2/s; twelve times that is in months.
2. The frontier says the best loss at budget C falls as C^(−γ), so a year multiplying C by 10^s multiplies the excess loss by 10^(−γs).
3. Inverting the same law gives the budget a target loss costs, and so the year that target became buyable.

**Worked example.** The deep-learning era, reported as 0.6 orders of magnitude a year and a doubling every 5.7 months, against a frontier exponent of 0.25. → **The slope converts to 6.0 months a doubling — the paper’s two statistics disagree by half a month — and the loss factor is 10^(−0.15) = 0.71 a year.** (The era’s numbers are quoted from the paper; the conversion, the disagreement and the multiplication by γ are this course’s arithmetic, and screen H prints all three.)

**The law the minima obey**

$$L^{*}(C) = E + K\,C^{-\gamma},\qquad \gamma = \frac{\alpha\beta}{\alpha+\beta}$$

*The bottom of each IsoFLOP curve, traced across budgets, is itself a power law. Its exponent is made of the two single-variable exponents and of nothing else, which is why the compute-optimal law can be predicted from the parameter and data laws.*

Symbols:

- `L^{*}(C)` — the best loss at budget C (The loss of the compute-optimal allocation.)
- `K` — the frontier’s coefficient (Fixed by A, B, α and β; the laboratory measures it at a unit budget.)
- `\gamma` — the frontier exponent (The harmonic half of the two exponents: always smaller than either.)

**Assumptions:**

- Both terms of the surface are powers with positive exponents over the whole range of budgets.
- The optimum is interior — no constraint on the pool and no hard floor on either axis.

**Derivation:**

1. At the optimum, N ∝ P^(β/(α+β)), so the capacity term falls as P^(−αβ/(α+β)).
2. D* = P/N* ∝ P^(α/(α+β)), so the data term falls as P^(−βα/(α+β)) — the same power.
3. Both terms therefore fall at γ = αβ/(α+β), and their sum is a constant times that same power.
4. Since P is proportional to C, the exponent in the budget is the exponent in the product.

**Worked example.** α = β = 0.5, so γ = 0.25. → **A budget ten times larger leaves the excess loss at 10^(−0.25) = 0.56 of what it was; a doubling leaves it at 0.84.** (A doubling buys about 16% at the frontier, which is the number a training budget is actually worth.)

#### Practice

**Q. A scaling law says a loss costs 10^23 FLOPs. What else is needed to say what year it became reachable? — multiple-choice *(core)***

- ✓ **A capability trend and the wall-clock a run is allowed**
- Nothing: the law gives a date
- The number of parameters
- The size of the corpus

> Correct — FLOPs per second times hours is what a run can actually spend.

> **Why:** The bridge from a law to a date is a rate: what the hardware of the year could do in the hours a run takes. The screen makes that bridge a slider, because it is the assumption the answer depends on most.

#### Go and do it

The whole chain in one table: the loss, its budget, the rate it needs, the year the series reaches it. Open **Price a loss in years** in the scaling-lab application.

**Where this came from**

- §sevilla:1 Introduction — The reason a trend matters: it is the quantity that says when a given training run stops being science fiction.
- §sevilla:4 Conclusion — The caution attached to any extrapolation of the fitted rates.

**The words this lesson uses**

- **Feasible compute** — The FLOPs the hardware of a year could do inside a run’s wall-clock.
- **Log-linear trend** — A straight line on a log scale: a constant multiplicative growth.
- **Irreducible loss** — The loss no model can beat, set by the noise in the data.
- **The frontier** — The best loss at each budget, traced across budgets.

*Read first:* The IsoFLOP curves and the frontier, Three eras and one straight line

## Appendix A — Glossary

**Scaling law** — A statement that a quantity follows a power of another quantity.

A scaling law says that as one quantity grows, another follows a power of it: the loss falls as the number of tokens raised to a negative power. The law is a description of a measured region, not a law of nature, and it is worth exactly as much as the range it was measured over.

**Exponent** — The number in a power law that says how fast the quantity falls.

If the loss falls as L ∝ N^(−α), then α is the exponent. Its practical content is the factor a doubling buys: 2^(−α). An exponent of 0.1 means a doubling of the data improves the loss by about 7%, and an exponent of 0.5 means it improves it by about 29%.

**A doubling** — The unit in which a scaling law is usually quoted.

Because a power law is multiplicative, the natural unit of improvement is a doubling of whatever is being scaled. Quoting the factor a doubling buys, rather than the exponent, is what makes two different scaling laws comparable.

**R²** — The fraction of the variation a fit explains.

R² is one minus the residual sum of squares divided by the total sum of squares. In log–log space it is the fraction of the variation in log-loss that the straight line explains. It is a statement about the fit, not about the future: a high R² over a narrow range is still a narrow range.

**Compute budget** — The total training compute available, which is what the data is bought with.

The cost of a training run is proportional to the number of parameters times the number of tokens processed. A compute budget fixes that product, and therefore forces a choice: the parameters and the tokens trade against each other. Without a budget there is nothing to optimise.

**Allocation** — How a fixed budget is split between the model and the data.

The allocation is the pair (parameters, tokens) that a budget is spent on. Its quality is the loss at that pair. The compute-optimal allocation is the pair that minimises the loss, and it is a consequence of the two exponents of the loss surface, not a free choice.

**Loss surface** — The loss as a function of the model size and the dataset size.

The two-variable surface is the object the compute-optimal allocation is read off. It is usually written as E + A·N^(−α) + B·D^(−β): an irreducible loss, a term that falls with the model size, and a term that falls with the amount of data. The two terms pull in opposite directions under a fixed budget.

**Irreducible loss** — The loss no model can beat, set by the noise in the data.

The irreducible loss is the floor: the part of the loss that comes from the noise in the labels rather than from the model’s ignorance. It matters for scaling because a power law in the *loss* must flatten as the model approaches the floor, and a fit that ignores that will over-predict how far the law will hold.

**Tokens per parameter** — The ratio of training tokens to model parameters.

The ratio is how much text the model reads for every weight it has. It is the quantity the compute-optimal allocation pins down, and it is a number with units only in the loosest sense: it depends on the task, the architecture and the budget, and quoting it without those is quoting half a result.

**Repeats** — The number of times the training set is read again.

If the unique dataset has U rows and the training run reads R rows in total, the number of repeats is R/U. It is the standard way of saying that the data ran out and the run went round again, and the number that matters for the model is the number of unique rows, not the number of rows read.

**Effective data** — The number of unique rows a run actually learned from.

The effective data is the number of unique rows, which is the total rows read divided by the number of repeats. A run that reads a hundred billion tokens four times over has twenty-five billion tokens of effective data, and the loss curve should be read against the effective number, not against the tokens.

**Emergence** — An ability whose measured score appears suddenly rather than gradually.

An emergent ability is one whose score is near zero for a range of model sizes and then rises sharply. The shape is striking and it is often taken as a fact about the model. It is at least as much a fact about the metric that produced the number.

**Metric** — The function that turns a model’s output into a score.

A metric decides what counts as a correct answer: the whole string or a token, a pass or a fail, a graded fraction. Different metrics applied to the same model can give curves of entirely different shapes, and any claim about a model’s abilities is a claim about the metric as much as about the model.

**Per-token accuracy** — The fraction of the tokens a model gets right.

Per-token accuracy is a continuous quantity with no threshold in it, and it is what the emergent curves are secretly made of. A whole-sequence score is the per-token accuracy raised to the length of the sequence, which is where the apparent discontinuity comes from.

**A cliff** — A steep transition in a measured curve.

A cliff is a region of a curve where the rate of change is much larger than anywhere else. Whether a cliff in a score means a cliff in the model is the question the emergence literature asks, and the answer depends on whether the metric has a threshold in it.

**IsoFLOP curve** — The loss along one fixed compute budget, as the allocation slides.

Hold the compute fixed and vary the split between parameters and data, and the loss traces a U. The bottom of the U is the compute-optimal allocation at that budget, and the two arms are what the naive choices pay: a big model starved of data, or a small model with more data than it can use. Hoffmann et al. trained a whole family of models to find each bottom, which is why the curves are named after the fixed-FLOPs constraint they are drawn on.

**The frontier** — The best loss at each budget, traced across budgets.

Take the minimum of every IsoFLOP curve and plot those minima against the budget, and the result is itself a power law, with an exponent made of the two single-variable exponents. The frontier is the only curve a training budget is actually on, which is why it is the object the hardware trend is compared with.

*Example:* With α = β = 0.5, what is the exponent of the frontier? → αβ/(α+β) = 0.25, so a tenfold budget multiplies the excess loss by 10^(−0.25) = 0.56.

**Crossover point** — The compute at which a larger model overtakes a smaller one.

At a fixed budget a bigger model has proportionally less data. Kaplan et al.’s observation is that the bigger model is the better choice only once the budget is large enough to fill it, and the budget at which the two losses are equal is computable from the surface. Below it, scale the data; above it, scale the model.

**The finite pool** — The corpus: a fixed number of rows that cannot be increased.

Every scaling law in this course assumes the data can be whatever size you ask for. A real corpus is a finite number of rows, and once they have all been read the only way to spend more compute is to read them again. The pool is the constraint that turns the optimum into a decision about repeats rather than about size.

**Epoch** — One pass over the whole pool.

An epoch is one complete pass over the training rows. The first epoch is the only one that sees every row for the first time; every epoch after it is a repeat, and the loss curve of a run that stays inside one epoch is a different object from the curve of a run that has gone round the pool four times at the same number of tokens.

**The dominance epoch** — The epoch at which a repeat stops being worth the compute it costs.

Muennighoff et al. define the point at which the repetition term dominates the fresh-data term in the loss: past it, the next epoch is worth so little that the compute would have been spent on new data. It is measured as the epoch at which a repeated run has fallen a given fraction of the way from the fresh run’s gain, and the number moves with the fraction chosen — which is why the laboratory prints the whole table rather than one epoch.

**Percolation threshold** — The keep fraction at which a pruned corpus stops working.

Above the threshold, the rows that go are redundant and the loss barely notices. At it, the rare rows that carry the parts of the task nothing else carries start going, and the curve breaks. Sorscher et al. borrowed the word from percolation physics, where it names the point at which a connected path spans a medium; here it names the point at which the corpus stops spanning the task.

**Pruning metric** — The score that ranks the rows of a pool from most to least worth keeping.

A metric can be a distance to a class prototype, a norm, a residual, or a seeded shuffle. The ranking decides which rows survive a keep fraction, so the threshold is a property of the metric as much as of the data: two metrics on one pool have two different cliffs, and the one that costs most to compute usually has the lowest.

**Rare rows** — The few rows that carry what nothing else in the pool carries.

In a clustered corpus most rows repeat information the pool already has, and a small number carry directions of the task that appear nowhere else. Those are the rows a pruned corpus cannot afford to lose, and they are the reason a ranking by volume and a ranking by information disagree.

**Log-linear trend** — A straight line on a log scale: a constant multiplicative growth.

A quantity growing by a fixed factor per unit time is a straight line when its logarithm is plotted against time. That is the shape of the compute record — training FLOPs, transistor density, and the loss frontier are all log-linear over the ranges they are measured on — and it is why a slope and a doubling time are two units for one number rather than two facts.

**A break in a trend** — A change of slope, fitted rather than noticed.

A break is a year at which the growth rate changes, and it is a claim about a fit: put a split in a log-linear trend where the two halves disagree, and choose the year that minimises the total squared error. The eras of the compute record are breaks of this kind, which means they are placed by the analyst, and a detection run on a series with a break planted in it can be checked against the planted year.

**Feasible compute** — The FLOPs the hardware of a year could do inside a run’s wall-clock.

A loss is not reachable because the law says it is; it is reachable because somebody could have bought the machine time to train at that budget. Multiplying the capability trend of a year by the hours a run is allowed gives the FLOPs actually available, and comparing that with the budget the frontier demands is what turns a scaling law into a date.

## Appendix B — The laboratories

Every laboratory the course ships. Each one runs in the application and computes everything it shows in the browser; this appendix is the catalogue of what exists and what it is for.

### A · The power law

*Training runs, the law fitted to them, and the exponent that moves with the range.*

**Delivers:**

- Fitting power laws to loss curves

### B · The compute optimum

*One budget, many allocations, and the size at which a bigger model starts to pay.*

**Delivers:**

- The compute-optimal allocation
- Crossover points between model size and data

### C · The IsoFLOP frontier

*The U at each budget, the line through its minima, and the day the corpus runs out.*

**Delivers:**

- IsoFLOP curves
- The 20 tokens-per-parameter rule, rederived
- What happens when the data runs out

### D · The percolation threshold

*Pruning a pool by four metrics, and the cliff each one breaks at.*

**Delivers:**

- The percolation prediction
- Pruning metric benchmarking

### E · Going round the pool

*Two runs, the same tokens, different data: warmup, plateau, and the turn upward.*

**Delivers:**

- The three-phase scaling curve
- How many epochs before repetition dominates

### F · The effective-data law

*What a repeated corpus is worth as a number of fresh rows, in closed form.*

### G · The cliff

*One capability, two metrics, and the difference between a sharp score and a sharp thing.*

**Delivers:**

- The metric-artefact effect, reproduced
- Discontinuous metric versus continuous underlying performance

### H · Hardware and the eras

*A trend in FLOPs, the break inside it, and the year a target loss became buyable.*

**Delivers:**

- Hardware capability over time

## Appendix C — Sources

- **Scaling Laws for Neural Language Models** — Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B. Brown, Benjamin Chess, Rewon Child, Scott Gray, Alec Radford, Jeffrey Wu, Dario Amodei (2020), arXiv:2001.08361 [cs.CL]. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Scaling laws are one lesson in two courses. They are the quantitative spine of the field and deserve their own application.
- **Training Compute-Optimal Large Language Models** — Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch, Elena Buchatskaya, Trevor Cai, Eliza Rutherford, Diego de Las Casas, Lisa Anne Hendricks, Johannes Welbl, Aidan Clark, Tom Hennigan, Eric Noland, Katie Millican, George van den Driessche, Bogdan Damoc, Aurelia Guy, Simon Osindero, Karen Simonyan, Erich Elsen, Jack W. Rae, Oriol Vinyals, Laurent Sifre (2022), arXiv:2203.15556 [cs.CL] / NeurIPS 2022. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The compute-optimal result and the IsoFLOP methodology that produced it.
- **Beyond neural scaling laws: beating power law scaling via data pruning** — Ben Sorscher, Robert Geirhos, Shashank Shekhar, Surya Ganguli, Ari S. Morcos (2022), arXiv:2206.14486 [cs.LG] / NeurIPS 2022 Outstanding Paper. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The result that breaks the power law, with a theory that can be checked on real data.
- **Scaling Data-Constrained Language Models** — Niklas Muennighoff, Alexander M. Rush, Boaz Barak, Teven Le Scao, Aleksandra Piktus, Nouamane Tazi, Sampo Pyysalo, Thomas Wolf, Colin Raffel (2023), arXiv:2305.16264 [cs.CL] / NeurIPS 2023. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The regime the field is actually in: repeated epochs over a fixed corpus.
- **Are Emergent Abilities of Large Language Models a Mirage?** — Rylan Schaeffer, Brando Miranda, Sanmi Koyejo (2023), arXiv:2304.15004 [cs.CL] / NeurIPS 2023. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Whether abilities appear discontinuously is a measurement question, and this shows it is often an artefact of the metric.
- **Compute Trends Across Three Eras of Machine Learning** — Jaime Sevilla, Lennart Heim, Anson Ho, Tamay Besiroglu, Marius Hobbhahn, Pablo Villalobos (2022), arXiv:2202.05924 [cs.LG] / ICLR 2022 Workshop on ML for Systems. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The hardware trend that makes the compute curves mean something.
