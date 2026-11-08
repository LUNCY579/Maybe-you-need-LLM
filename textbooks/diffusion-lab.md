# Diffusion Lab


**Source:** Denoising Diffusion Probabilistic Models — Jonathan Ho, Ajay Jain, Pieter Abbeel (2020)

**Licence:** arXiv perpetual, non-exclusive distribution licence. No Creative Commons licence is shown on the record; re-check per version before redistributing.

**Why this course exists:** There is no generative or multimodal application anywhere in the collection.

**Source:** High-Resolution Image Synthesis with Latent Diffusion Models — Robin Rombach, Andreas Blattmann, Dominik Lorenz, Patrick Esser, Björn Ommer (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Diffusion is what made high-resolution generation practical; the latent step is the missing half of the story.

**Source:** Elucidating the Design Space of Diffusion-Based Generative Models — Tero Karras, Miika Aittala, Timo Aila, Samuli Laine (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The pre-conditioning and σ parametrisation that later samplers use; without it, the schedule choice looks arbitrary.

**Source:** Classifier-Free Diffusion Guidance — Jonathan Ho, Tim Salimans (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Guidance is how a text-conditioned model is steered, and it is a single interpolation in the score.

**Source:** Diffusion Models Beat GANs on Image Synthesis — Prafulla Dhariwal, Alex Nichol (2021)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The classifier-guidance recipe that made diffusion competitive, for comparison with classifier-free guidance.

**Source:** Denoising Diffusion Implicit Models — Jiaming Song, Chenlin Meng, Stefano Ermon (2020)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The deterministic sampler, and therefore the reason a diffusion model can be sampled in a few dozen steps instead of a thousand.

**Source:** Improved Denoising Diffusion Probabilistic Models — Alex Nichol, Prafulla Dhariwal (2021)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The cosine schedule and the learned variances, which is what the schedules module compares against the original linear schedule.

---

## Contents

- [1. The Forward Process](#1-the-forward-process)
  - [Lesson 1. What a diffusion model is](#lesson-1-what-a-diffusion-model-is)
  - [Lesson 2. The closed form](#lesson-2-the-closed-form)
  - [Lesson 3. The posterior](#lesson-3-the-posterior)
- [2. The Reverse Process](#2-the-reverse-process)
  - [Lesson 4. The training objective](#lesson-4-the-training-objective)
  - [Lesson 5. Three parameterisations](#lesson-5-three-parameterisations)
  - [Lesson 6. Sampling](#lesson-6-sampling)
- [3. Noise Schedules](#3-noise-schedules)
  - [Lesson 7. Choosing a schedule](#lesson-7-choosing-a-schedule)
  - [Lesson 8. The weighting](#lesson-8-the-weighting)
- [4. Latent Diffusion](#4-latent-diffusion)
  - [Lesson 9. The latent space](#lesson-9-the-latent-space)
- [5. Guidance](#5-guidance)
  - [Lesson 10. Classifier-free guidance](#lesson-10-classifier-free-guidance)
  - [Lesson 11. The price of guidance](#lesson-11-the-price-of-guidance)
- [6. The Design Space](#6-the-design-space)
  - [Lesson 12. The design space](#lesson-12-the-design-space)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — The laboratories](#appendix-b-the-laboratories)
- [Appendix C — Sources](#appendix-c-sources)

## 1. The Forward Process

*How a fixed chain turns data into noise*

A diffusion model corrupts its data with a fixed Markov chain and then learns to undo the corruption. This module builds the chain: the one-step transition, the closed form that makes training cheap, the posterior the reverse process is matched against, and the signal-to-noise ratio that measures how far the corruption has gone.

**Learning outcomes**

- Write the forward transition and the closed form for q(x_t | x_0)
- Derive the posterior q(x_{t−1} | x_t, x_0) and explain why it is tractable
- Compute the signal-to-noise ratio at any step and say what it means
- Explain why the closed form and the Markov chain agree

### Lesson 1. What a diffusion model is

*A fixed corruption, and a learned undoing of it*

*Estimated study time:* 18 minutes

**What you will learn**

- State the two processes that make up a diffusion model
- Say what the "diffusion" is named after
- Explain why the forward process has no learnable parameters

**The ideas**

- A diffusion model is a latent variable model whose approximate posterior is fixed.
- The forward process adds Gaussian noise on a schedule; the reverse process learns to undo it.
- The prior at the end of the chain is the standard normal, so sampling starts from noise.

#### Practice

**Q. Which part of a diffusion model has learnable parameters? — multiple-choice *(warmup)***

- The forward process
- ✓ **The reverse process**
- The variance schedule
- The prior

> Correct — the reverse process mean is produced by the network.

> **Why:** The forward process and the schedule are fixed by hand. Everything the model learns lives in the reverse process, whose mean is a function of the noisy state and the timestep.

**Q. The forward process gradually destroys the information in the data. — boolean *(warmup)***

> **Answer:** True

> **Why:** Yes. The signal-to-noise ratio falls monotonically, and by the last step the state is essentially the prior, carrying almost no information about the data.

#### Go and do it

Step a data point through the forward chain and watch the signal disappear. Open **Watch the chain run** in the diffusion-lab application.

**Where this came from**

- §2 Background · p. 3 — The reverse process of equation 1, the forward process of equation 2, and the variational bound of equation 3.
- §1 Introduction · p. 1 — The description of the model as a parameterised Markov chain trained with variational inference.

**Further reading**

- [Ho, Jain & Abbeel, arXiv:2006.11239](https://arxiv.org/abs/2006.11239) — The primary source.

**The words this lesson uses**

- **Diffusion model** — A generative model that learns to reverse a fixed noise-addition process.
- **Forward process** — The fixed chain that adds noise to the data.
- **Reverse process** — The learned chain that removes noise.
- **Variance schedule** — The sequence β_1 … β_T that sets how much noise each step adds.

### Lesson 2. The closed form

*Sampling any timestep in one step*

*Estimated study time:* 22 minutes

**What you will learn**

- State q(x_t | x_0) and derive it from the one-step transition
- Explain why the closed form is what makes diffusion training affordable
- Verify that the closed form and the Markov chain describe the same distribution

**The ideas**

- x_t = √ᾱ_t · x_0 + √(1 − ᾱ_t) · ε, with ε ~ N(0, I).
- The state is a scaled copy of the data plus a scaled copy of a noise vector.
- Training never unrolls the chain: one timestep, one noise draw, one network evaluation.

#### Practice

**Q. The closed form q(x_t | x_0) has the form x_t = √ᾱ_t · x_0 + √(1 − ᾱ_t) · ε. What is ε? — multiple-choice *(warmup)***

- ✓ **A standard normal vector**
- The previous state x_{t−1}
- A learnable parameter
- The posterior mean

> Correct: ε ~ N(0, I), drawn fresh at every training step.

> **Why:** ε is a standard normal draw, and it is the same vector that the network is trained to predict. That is the whole trick: the target of the training objective is a random vector the model never has to see.

**Q. With the paper’s linear schedule, β goes from 10⁻⁴ to 0.02 over 1000 steps. What is β at the first step? — numeric *(core)***

> **Answer:** 0.0001 β_1

> **Why:** β_1 = 10⁻⁴ exactly. The schedule is linear in the step index, so the first and last values are the endpoints of the range.

**Q. At some step t the cumulative product is ᾱ_t = 0.64. Given x_0, what is the standard deviation of the noise term in x_t? — numeric *(core)***

> **Answer:** 0.6

> **Why:** The closed form writes x_t = √ᾱ_t · x_0 + √(1 − ᾱ_t) · ε with ε ~ N(0, I), so the noise term is a standard normal scaled by √(1 − ᾱ_t) = √0.36 = 0.6.

#### Go and do it

Compare the two ways of reaching the same timestep. Open **Check the closed form against the chain** in the diffusion-lab application.

**Where this came from**

- §2 Background · p. 4 — Equation 4, the closed form q(x_t | x_0), and the statement that efficient training follows from it.

**The words this lesson uses**

- **ᾱ (alpha bar)** — The cumulative product of the α_t, so ᾱ_t = ∏ α_s.
- **Signal-to-noise ratio** — ᾱ_t divided by 1 − ᾱ_t: how much signal survives against how much noise.
- **Marginal** — The distribution of one timestep, with the intermediate steps summed out.

*Read first:* What a diffusion model is

### Lesson 3. The posterior

*The one quantity that has to be tractable*

*Estimated study time:* 20 minutes

**What you will learn**

- Write the posterior q(x_{t−1} | x_t, x_0)
- Explain why a tractable posterior is what makes the variational bound usable
- Compute the posterior mean and variance for a given step

**The ideas**

- q(x_{t−1} | x_t, x_0) is Gaussian, and so is the reverse process it is compared against.
- Every KL term in the bound therefore has a closed form instead of a Monte Carlo estimate.
- The posterior leans on x_0 at small t and on x_t at large t.

#### Practice

**Q. Why does the paper need q(x_{t−1} | x_t, x_0) to have a closed form? — multiple-choice *(core)***

- ✓ **So every KL term in the bound can be computed between two Gaussians**
- So the sampling can be done in one step
- So the model does not need a network
- So the data can be scaled to [−1, 1]

> Correct.

> **Why:** The variational bound is a sum of KL divergences between the true posterior and the model’s reverse transition. If both are Gaussian, each term has a closed form instead of a high-variance Monte Carlo estimate.

**Q. The mean of the posterior q(x_{t−1} | x_t, x_0) weighs x_t against x_0, and the weights are fixed by the schedule alone. — boolean *(core)***

> **Answer:** True

> **Why:** The posterior coefficients are functions of ᾱ_t, β_t and ᾱ_{t−1} — quantities the schedule fixes before training begins. Nothing learned decides where the weight sits; the network only has to reach the mean the posterior names.

#### Go and do it

See the posterior shift its weight from x_0 to x_t as the noise grows. Open **Move the posterior weight** in the diffusion-lab application.

**Where this came from**

- §2 Background · p. 4 — Equations 6 and 7: the posterior mean and the posterior variance β̃_t.
- §2 Background · p. 3 — Equation 5: the decomposition of the bound into per-step KL terms.

**The words this lesson uses**

- **Posterior** — q(x_{t−1} | x_t, x_0): where the chain would have been, given the data.
- **Variational bound** — An upper bound on the negative log likelihood, decomposed into per-step KL terms.
- **KL divergence** — A measure of how far one distribution is from another.

*Read first:* The closed form

## 2. The Reverse Process

*Learning to walk the corruption backwards*

The reverse process is a Markov chain of learned Gaussians. This module derives the ε-prediction parameterisation, the two other standard parameterisations, the ancestral sampler, and the deterministic sampler that makes diffusion models fast.

**Learning outcomes**

- Derive the ε-prediction parameterisation from the variational bound
- Convert between ε-prediction, x₀-prediction and v-prediction
- Run the ancestral sampler and the deterministic sampler
- State what the training objective actually optimises, and what it gives up

### Lesson 4. The training objective

*Why predicting the noise is the same as predicting the score*

*Estimated study time:* 26 minutes

**What you will learn**

- Derive the ε-prediction parameterisation from the bound
- State the simplified objective and what it gives up
- Explain the connection to denoising score matching

**The ideas**

- The reverse mean can be written in terms of a network that predicts ε.
- With that parameterisation the bound becomes a weighted squared error on ε.
- Dropping the weight gives the objective the paper actually uses.

#### Practice

**Q. With the ε-prediction parameterisation, the network is trained to predict… — multiple-choice *(core)***

- the clean sample x_0
- ✓ **the noise ε that was added**
- the posterior mean μ̃_t
- the reverse variance σ_t

> Correct.

> **Why:** Predicting ε makes the bound resemble denoising score matching and makes the sampler resemble Langevin dynamics. Both facts are the paper’s stated reasons for preferring it.

**Q. In the simplified objective the weight on the loss is exactly what value at every timestep? — numeric *(core)***

> **Answer:** 1

> **Why:** Exactly 1. The true bound weights the loss by β_t² / (2 σ_t² α_t (1 − ᾱ_t)); the simplified objective replaces that whole factor with 1, which is why it down-weights small t so dramatically.

#### Go and do it

Compare the weight of the true bound with the flat weight of the simplified objective. Open **See the weight the simplification drops** in the diffusion-lab application.

**Where this came from**

- §3.2 Reverse process and L_{1:T−1} · p. 7 — Equations 8 to 12: from the KL term to the ε-prediction parameterisation of equation 11 and the weighted loss of equation 12.
- §3.4 Simplified training objective · p. 10 — Equation 14, the simplified objective, and the reason the small-t terms are down-weighted.

**The words this lesson uses**

- **ε-prediction** — Parameterising the reverse mean through a network that predicts the added noise.
- **Score** — The gradient of the log density with respect to the input.
- **Denoising score matching** — Training a score network by asking it to predict the noise that was added.
- **Simplified objective** — The unweighted squared error on ε that the paper actually trains with.

*Read first:* The posterior

### Lesson 5. Three parameterisations

*ε, x₀, and v*

*Estimated study time:* 18 minutes

**What you will learn**

- Convert a prediction in one parameterisation into another
- State which parameterisation the paper found best and why
- Predict what changes when the network predicts x₀ instead of ε

**The ideas**

- The three parameterisations describe the same reverse process; only the network target changes.
- Predicting x₀ is unstable at large t, where the estimate of x₀ is dominated by noise.
- The v-prediction is the reparameterisation that interpolates between them.

#### Practice

**Q. Which statement about the three parameterisations is true? — multiple-choice *(core)***

- They define three different reverse processes
- ✓ **They describe the same reverse process but train the network on different targets**
- Only ε-prediction is mathematically valid
- x₀-prediction is always better

> Correct.

> **Why:** The three parameterisations are algebraically equivalent views of p_θ(x_{t−1}|x_t). What changes is the regression target, and therefore how stable training is and how the loss is weighted.

#### Go and do it

Take one network output and read it as ε, as x₀, and as v. Open **Convert a prediction** in the diffusion-lab application.

**Where this came from**

- §3.2 Reverse process and L_{1:T−1} · p. 8 — The remark that predicting x_0 led to worse sample quality early on, and the summary of the two parameterisations.
- §4.2 Reverse process parameterization and training objective ablation · p. 12 — Table 2: the measured comparison of the two parameterisations under both objectives.

**The words this lesson uses**

- **v-prediction** — Predicting the velocity √ᾱ_t ε − √(1−ᾱ_t) x_0.
- **x₀-prediction** — Parameterising the reverse mean through a network that predicts the clean sample.

*Read first:* The training objective

### Lesson 6. Sampling

*From noise to a sample, and back again*

*Estimated study time:* 24 minutes

**What you will learn**

- Run the ancestral sampler and account for the noise it adds
- Explain what a deterministic sampler does differently
- Describe the cost of sampling in network evaluations

**The ideas**

- The ancestral sampler adds σ_t · z at every step.
- A deterministic sampler reuses the same noise and can be run in fewer steps.
- Sampling is the expensive half: T network evaluations per sample.

#### Practice

**Q. Sampling with T = 1000 steps needs one network evaluation per step. How many network evaluations does a single sample cost? — numeric *(warmup)***

> **Answer:** 1000

> **Why:** Exactly 1000. This is the cost the paper notes it shares with earlier work, and it is the reason every later improvement in this area is about taking fewer steps.

**Q. What does a deterministic sampler change? — multiple-choice *(core)***

- ✓ **It removes the fresh noise, so the same start gives the same sample**
- It removes the network from the loop
- It replaces the variance schedule with a learned one
- It trains the model with a different objective

> Correct.

> **Why:** DDIM removes the fresh noise at each step, turning the reverse chain into a probability-flow ODE. The same latent then always gives the same sample, which is what allows the number of steps to be cut without collapsing diversity.

**Q. One ancestral sample is being drawn. Which of these does the procedure never touch? — multiple-choice *(core)***

- The trained reverse-process network
- The variance schedule β_t
- A fresh random noise vector
- ✓ **The training data**

> Correct — sampling starts from pure noise and never consults the dataset.

> **Why:** Ancestral sampling starts from the standard normal prior and iterates the learned reverse step under the fixed schedule, drawing fresh noise as it goes. The training data was needed to train the network, not to sample from it.

#### Go and do it

Sample from a trained model and watch the trajectory back to the data. Open **Run the reverse chain** in the diffusion-lab application.

**Where this came from**

- §3.2 Reverse process and L_{1:T−1} · p. 8 — Algorithm 2, the sampling procedure, and the remark that it resembles Langevin dynamics.
- §3.4 Simplified training objective · p. 10 — Algorithm 1, the training procedure.

**Further reading**

- [Song, Meng & Ermon, arXiv:2010.02502](https://arxiv.org/abs/2010.02502) — DDIM: the deterministic sampler.

**The words this lesson uses**

- **Ancestral sampling** — The sampler that adds fresh noise at every reverse step.
- **DDIM** — A deterministic sampler for the same trained model.
- **Deterministic sampler** — A sampler that adds no fresh noise, so the same starting point gives the same sample.

*Read first:* Three parameterisations

## 3. Noise Schedules

*Choosing how fast the signal disappears*

The schedule is the one set of choices in the model that is not learned. This module compares the linear schedule of the original paper with the cosine schedule that followed, and shows what the schedule does to the training signal.

**Learning outcomes**

- Compare the linear and cosine schedules on the same number of steps
- Explain the effect of a schedule on the terminal KL divergence
- Compute the weight the true variational bound puts on each timestep
- Argue for a schedule choice from the signal-to-noise ratio alone

### Lesson 7. Choosing a schedule

*Linear, cosine, and what they do to the signal*

*Estimated study time:* 20 minutes

**What you will learn**

- Write the linear schedule of the original paper
- Explain what the schedule controls
- Compute the terminal KL divergence for a given schedule

**The ideas**

- The paper fixes β to grow linearly from 1e-4 to 0.02 over T = 1000 steps.
- The schedule is the only part of the model that is not learned.
- A good schedule spends its steps where the denoising task is informative.

#### Practice

**Q. What does the variance schedule control? — multiple-choice *(core)***

- ✓ **How much noise each step adds, and therefore the whole signal-to-noise trajectory**
- The size of the network
- The learning rate
- The resolution of the images

> Correct.

> **Why:** The schedule determines ᾱ_t at every step, and therefore the signal-to-noise ratio, the terminal KL divergence, and the weighting of the training objective.

**Q. The paper quotes a terminal KL divergence of about 10⁻⁵ bits per dimension for its linear schedule. Roughly how many bits per dimension is that, in scientific notation? — numeric *(hard)***

> **Answer:** 0.00001 ± 1e-7

> **Why:** 10⁻⁵ bits per dimension. The point of the number is that x_T is, for every practical purpose, indistinguishable from the prior — which is what lets the sampler start from pure noise.

#### Go and do it

Put the linear and cosine schedules side by side and read the signal-to-noise ratio off each. Open **Compare two schedules** in the diffusion-lab application.

**Where this came from**

- §4 Experiments · p. 11 — T = 1000, β linear from 1e-4 to 0.02, and the quoted terminal KL of roughly 1e-5 bits per dimension.
- §3.1 Forward process and L_T · p. 6 — The reason the forward variances are fixed rather than learned: the terminal term is then a constant.

**Further reading**

- [Nichol & Dhariwal, arXiv:2102.09672](https://arxiv.org/abs/2102.09672) — The cosine schedule and learned variances.

**The words this lesson uses**

- **Variance schedule** — The sequence β_1 … β_T that sets how much noise each step adds.
- **Terminal KL** — How far the final noisy state is from the standard normal prior.

*Read first:* The closed form

### Lesson 8. The weighting

*Why the simplified objective is not the same objective*

*Estimated study time:* 18 minutes

**What you will learn**

- Write the weight of the true variational bound at each timestep
- Explain the consequence of dropping the weight
- Say what the paper gives up when it uses the simplified objective

**The ideas**

- The true bound weights the loss by β_t² / (2 σ_t² α_t (1 − ᾱ_t)).
- That weight is enormous at small t and tiny at large t.
- The simplified objective flattens it, so small t is effectively ignored.

#### Practice

**Q. Dropping the weight from the true variational bound has which effect? — multiple-choice *(hard)***

- ✓ **Small t are effectively ignored, because the true weight there is enormous**
- Large t are ignored
- The objective becomes a different likelihood bound
- Nothing changes, because the weight is constant

> Correct.

> **Why:** The true weight β_t²/(2σ_t²α_t(1−ᾱ_t)) is very large at small t and very small at large t. Flattening it to 1 therefore removes most of the gradient signal from the easy, small-t end of the chain — which the paper reports improves sample quality.

#### Go and do it

Break the bound into its per-step KL terms and see where the cost sits. Open **Decompose the bound** in the diffusion-lab application.

**Where this came from**

- §3.4 Simplified training objective · p. 10 — The statement that the simplified objective down-weights the loss terms corresponding to small t.
- §4.1 Sample quality · p. 11 — Table 1: the true bound gives better codelengths, the simplified objective gives better samples.

**The words this lesson uses**

- **Variational bound** — An upper bound on the negative log likelihood, decomposed into per-step KL terms.
- **Simplified objective** — The unweighted squared error on ε that the paper actually trains with.

*Read first:* The training objective, Choosing a schedule

## 4. Latent Diffusion

*Why the diffusion happens in someone else’s space*

Rombach et al. did not improve the diffusion model; they moved it into an autoencoder’s latent space. This module measures the compression, the reconstruction error it costs, and the scaling factor that makes the latents behave like the data the schedule assumes.

**Learning outcomes**

- Compute the saving a latent diffusion model buys, in elements and in attention
- Measure the reconstruction error a compression buys
- Explain why the latents have to be rescaled
- Trace what happens to the signal-to-noise ratio in the latent space

### Lesson 9. The latent space

*Moving the diffusion into an autoencoder*

*Estimated study time:* 20 minutes

**What you will learn**

- Compute the reduction in elements and in attention a compression buys
- Measure the reconstruction error a compression costs
- Explain the role of the scaling factor

**The ideas**

- A diffusion model in pixel space wastes most of its capacity on high frequencies.
- An autoencoder moves the problem into a lower dimensional space, and the saving is roughly quadratic.
- The latents have to be rescaled, because the schedule assumes unit-variance data.

#### Practice

**Q. Why does latent diffusion use an autoencoder at all? — multiple-choice *(core)***

- ✓ **The diffusion runs on far fewer elements, so it is much cheaper**
- The autoencoder makes the images sharper
- It removes the need for a variance schedule
- It allows the model to be trained on text

> Correct.

> **Why:** Compressing by a factor f reduces the number of elements by roughly 1/f² and the attention cost by roughly 1/f⁴, because attention is quadratic in the number of tokens.

**Q. An autoencoder compresses a 256×256 image with 3 channels by a factor of 8, to 4 latent channels. By what factor is the number of elements the diffusion model works on reduced? — numeric *(hard)***

> **Answer:** 48

> **Why:** The image has 256×256×3 = 196,608 elements; the latent has 32×32×4 = 4,096. The reduction factor is 48. The attention saving is larger still, because it is quadratic in the token count.

**Q. Why does latent diffusion run the diffusion process in an autoencoder’s latent space? — multiple-choice *(core)***

- To make the noise schedule linear
- ✓ **Because perceptual detail compresses away, so the diffusion spends its capacity on semantics**
- Because pixels cannot be noised
- To avoid the variational bound

> Correct — the autoencoder removes what the eye cannot resolve before the diffusion begins.

> **Why:** Most of a natural image’s bits describe detail the eye cannot resolve. The autoencoder discards that detail up front, so the expensive diffusion process operates on the semantic content rather than on high-frequency pixels.

#### Go and do it

Train a real autoencoder and watch the reconstruction error against the compression ratio. Open **Measure the compression** in the diffusion-lab application.

**Where this came from**

- §2 Background · p. 3 — The argument that the top-level latent x_T has nearly zero mutual information with the data.

**Further reading**

- [Rombach et al., arXiv:2112.10752](https://arxiv.org/abs/2112.10752) — Latent diffusion, and the scaling factor of 0.18215.

**The words this lesson uses**

- **Latent diffusion** — Running the diffusion in an autoencoder’s latent space instead of in pixel space.
- **Autoencoder** — A learned encoder and decoder pair that compresses data and reconstructs it.
- **Scaling factor** — The constant that rescales the latents so they have roughly unit variance.

*Read first:* The closed form

## 5. Guidance

*Steering a generative model with a condition*

Guidance is how a diffusion model is made to obey a prompt. This module derives classifier-free guidance from the score, and measures the trade-off it buys: sharper samples, less diversity, and a model that is no longer sampling the distribution it was trained on.

**Learning outcomes**

- Write the guided score and explain each term
- Predict what a guidance weight does to fidelity and to diversity
- Derive the classifier-guided update and compare it with the classifier-free one
- Say precisely what a guided model is sampling

### Lesson 10. Classifier-free guidance

*Guiding without a classifier*

*Estimated study time:* 24 minutes

**What you will learn**

- Write the guided score
- Derive it from the conditional and unconditional scores
- Explain why the guided model is not sampling the training distribution

**The ideas**

- s_guided = s_uncond + w · (s_cond − s_uncond).
- The guided distribution is the training distribution tilted by p(c | x)^w.
- Raising w sharpens the samples and reduces their diversity.

#### Practice

**Q. The classifier-free guided score is s_uncond + w · (s_cond − s_uncond). What does w = 0 give? — multiple-choice *(core)***

- ✓ **The unconditional score**
- The conditional score
- A score of zero
- The posterior mean

> Correct.

> **Why:** At w = 0 the guidance term vanishes and the sampler is unconditional. At w = 1 the guided score is exactly the conditional score.

**Q. What does a large guidance weight do to the samples? — multiple-choice *(core)***

- ✓ **They cluster more tightly on the mode that matches the condition**
- They spread out to cover the tail of the distribution
- They become noisier
- They become independent of the condition

> Correct: sharper, but less diverse.

> **Why:** Guidance tilts the distribution by p(c|x)^w, which sharpens the conditional but suppresses everything else. The result is better prompt adherence and worse coverage — the classic fidelity–diversity trade-off.

**Q. With guidance weight w = 3, how many network forward passes does one guided step cost, counting the conditional and unconditional evaluations separately? — numeric *(core)***

> **Answer:** 2

> **Why:** The guided score is s_uncond + w·(s_cond − s_uncond). Both scores are needed at the same input, and the unconditional term is shared between them — so two evaluations, not three, however they are batched.

#### Go and do it

Measure fidelity and diversity against the guidance weight, with an exact score. Open **Sweep the guidance weight** in the diffusion-lab application.

**Further reading**

- [Ho & Salimans, arXiv:2207.12598](https://arxiv.org/abs/2207.12598) — The classifier-free guidance derivation.

**The words this lesson uses**

- **Guidance** — Steering a generative model towards a condition by interpolating its scores.
- **Classifier-free guidance** — Guidance that needs no classifier, because the condition is dropped out during training.
- **Score** — The gradient of the log density with respect to the input.
- **Mode collapse** — A generator that produces only a subset of the data distribution.

*Read first:* The training objective

### Lesson 11. The price of guidance

*What the extra fidelity costs*

*Estimated study time:* 18 minutes

**What you will learn**

- Quantify the trade-off between fidelity and diversity
- Explain the relationship between guidance weight and the effective temperature
- Predict what a very large guidance weight does

**The ideas**

- Guidance narrows the distribution: the samples move to the mode and stop spreading.
- A large guidance weight behaves like a low temperature, but not exactly.
- The guided model has higher likelihood on some inputs and much lower on others.

#### Practice

**Q. A guided model samples from a distribution proportional to p(x) · p(c | x)^w. For what value of w is this distribution exactly p(x | c)? — numeric *(hard)***

> **Answer:** 1

> **Why:** w = 1. Since p(x)·p(c|x) = p(x|c)·p(c), and p(c) is a constant, the tilted distribution is proportional to the true conditional. Any w above 1 over-shoots it.

#### Go and do it

Put fidelity against diversity and mark where the sweet spot is. Open **Plot the trade-off** in the diffusion-lab application.

**The words this lesson uses**

- **Mode collapse** — A generator that produces only a subset of the data distribution.
- **Guidance** — Steering a generative model towards a condition by interpolating its scores.

*Read first:* Classifier-free guidance

## 6. The Design Space

*The choices that survived*

The original paper fixed a dozen choices for convenience. Later work showed which of them mattered. This module covers the σ parametrisation, the preconditioning functions, the deterministic samplers, and the arithmetic of how many network evaluations a sample costs.

**Learning outcomes**

- Compare the timestep and σ parametrisations
- Explain what a preconditioning function is for
- Count the network evaluations a given number of steps costs
- Describe the difference between a stochastic and a deterministic sampler

### Lesson 12. The design space

*The choices that turned out to matter*

*Estimated study time:* 22 minutes

**What you will learn**

- Compare the timestep parametrisation with the σ parametrisation
- Explain what a preconditioning function does
- Count the network evaluations a sampler costs

**The ideas**

- The original paper fixed many choices for convenience; later work separated the ones that matter.
- Preconditioning decides how the loss at one noise level is weighted against the others.
- The number of steps is the only number that matters for sampling cost.

#### Practice

**Q. What is preconditioning for? — multiple-choice *(hard)***

- ✓ **Deciding how the loss at one noise level counts against the others**
- Choosing the number of sampling steps
- Rescaling the data to [−1, 1]
- Making the network smaller

> Correct.

> **Why:** Different noise levels have different intrinsic difficulty and different signal-to-noise ratios, so a single unweighted loss trains them badly. Preconditioning is the per-level weight that fixes this.

**Q. A sampler takes 50 steps out of a chain of length 1000. How many network evaluations does one sample cost? — numeric *(core)***

> **Answer:** 50

> **Why:** Exactly 50. The number of steps is the only thing that matters for sampling cost, which is why deterministic samplers that can be run in few steps matter so much.

**Q. Which of these are choices the original paper leaves fixed rather than learned? — multi-select *(hard)***

- ✓ **The variance schedule β**
- ✓ **The reverse process variance σ_t**
- The reverse process mean
- ✓ **The number of steps T**

> **Why:** Only the reverse mean is learned. The paper fixes the schedule, the reverse variance and the chain length, and its ablation shows that learning the variance makes training unstable and samples worse.

#### Go and do it

Add up what a sample costs, in network evaluations and in memory. Open **Count the cost** in the diffusion-lab application.

**Further reading**

- [Karras et al., arXiv:2206.00364](https://arxiv.org/abs/2206.00364) — The σ parametrisation, the preconditioning functions and the design-space analysis.

**The words this lesson uses**

- **Preconditioning** — A weighting that decides how the loss at one noise level counts against the others.
- **σ parametrisation** — Indexing the noise levels by the standard deviation of the data noise.

*Read first:* Sampling, Choosing a schedule

## Appendix A — Glossary

**Diffusion model** — A generative model that learns to reverse a fixed noise-addition process.

A diffusion model is a latent variable model with two parts: a forward process that gradually adds Gaussian noise to the data, and a reverse process, learned, that removes it. Because the forward process is fixed, the model has few enough degrees of freedom to train well and the resulting samples are competitive with GANs.

*Ho, Jain & Abbeel (2020)*

**Forward process** — The fixed chain that adds noise to the data.

Also called the diffusion process. It is a Markov chain q(x_1:T | x_0) = ∏ q(x_t | x_{t−1}) in which each step multiplies the state by √α_t and adds Gaussian noise of scale √β_t. It has no learnable parameters at all.

*Ho, Jain & Abbeel (2020)*

**Reverse process** — The learned chain that removes noise.

A Markov chain p_θ(x_{0:T}) = p(x_T) ∏ p_θ(x_{t−1} | x_t) whose transitions are Gaussians with learned means and fixed variances. The means are produced by a network that takes the noisy state and the timestep.

*Ho, Jain & Abbeel (2020)*

**Variance schedule** — The sequence β_1 … β_T that sets how much noise each step adds.

The only unlearned choice in the model. The original paper fixes it to grow linearly from 1e-4 to 0.02 over 1000 steps. Later work found a cosine schedule to be better, and even allows the schedule itself to be learned.

*Example:* What are β_1 and β_T in the paper’s setup? → 10⁻⁴ and 0.02 respectively, with T = 1000 steps.

*Ho, Jain & Abbeel (2020)*

**ᾱ (alpha bar)** — The cumulative product of the α_t, so ᾱ_t = ∏ α_s.

ᾱ_t is the fraction of the original signal still present in x_t. It is the single most useful number in the whole model: it appears in the closed form for x_t, in the posterior, and in the weighting of the training objective.

*Ho, Jain & Abbeel (2020)*

**Marginal** — The distribution of one timestep, with the intermediate steps summed out.

q(x_t | x_0) is the marginal of the forward chain at step t, with x_1 … x_{t−1} integrated out. Because the chain is Gaussian, that marginal is itself Gaussian, and it has a closed form.

*Ho, Jain & Abbeel (2020)*

**Signal-to-noise ratio** — ᾱ_t divided by 1 − ᾱ_t: how much signal survives against how much noise.

The SNR of the forward process at step t. It is one above 1 while the data is still mostly intact and falls below 1 as the state becomes mostly noise. The schedule determines the whole trajectory of the SNR, and therefore which steps are worth training on.

*Example:* At what step does the SNR cross one? → Where ᾱ_t = 0.5. For the paper’s linear schedule over 1000 steps that is around t = 500.

*Course term*

**Posterior** — q(x_{t−1} | x_t, x_0): where the chain would have been, given the data.

The approximate posterior of the latent variable model. It is Gaussian, with a mean that is a fixed linear combination of x_0 and x_t, and a variance β̃_t. It is the target the reverse process is compared against, and its tractability is what makes the variational bound computable.

*Ho, Jain & Abbeel (2020)*

**Variational bound** — An upper bound on the negative log likelihood, decomposed into per-step KL terms.

L = D_KL(q(x_T|x_0) ‖ p(x_T)) + Σ D_KL(q(x_{t−1}|x_t,x_0) ‖ p_θ(x_{t−1}|x_t)) − log p_θ(x_0|x_1). Every term compares two Gaussians, so every term has a closed form rather than needing a Monte Carlo estimate.

*Ho, Jain & Abbeel (2020)*

**KL divergence** — A measure of how far one distribution is from another.

D_KL(P ‖ Q) = ∫ P log(P/Q). Between two univariate Gaussians it has a closed form, which is why the diffusion bound is cheap to compute.

*Course term*

**ε-prediction** — Parameterising the reverse mean through a network that predicts the added noise.

μ_θ(x_t, t) = (1/√α_t)(x_t − (β_t/√(1−ᾱ_t)) ε_θ(x_t, t)). The paper argues for this parameterisation because it makes the bound look like denoising score matching and makes sampling look like Langevin dynamics.

*Ho, Jain & Abbeel (2020)*

**x₀-prediction** — Parameterising the reverse mean through a network that predicts the clean sample.

An alternative target for the same reverse process. The paper reports that it works only with the full variational bound, and that it leads to worse sample quality early in training.

*Ho, Jain & Abbeel (2020)*

**v-prediction** — Predicting the velocity √ᾱ_t ε − √(1−ᾱ_t) x_0.

A reparameterisation that interpolates between ε-prediction and x₀-prediction. It is numerically better behaved at high noise levels, and is used in several later systems.

*Course term*

**Score** — The gradient of the log density with respect to the input.

∇_x log p(x). A network that predicts the score of the noisy distribution at every noise level is a denoising score model, and sampling from it is annealed Langevin dynamics.

*Ho, Jain & Abbeel (2020)*

**Denoising score matching** — Training a score network by asking it to predict the noise that was added.

The equivalence the paper leans on: optimising a weighted variational bound on a diffusion model is equivalent to training a score-based model with denoising score matching over multiple noise levels.

*Ho, Jain & Abbeel (2020)*

**Simplified objective** — The unweighted squared error on ε that the paper actually trains with.

L_simple = E ‖ε − ε_θ(√ᾱ_t x_0 + √(1−ᾱ_t) ε, t)‖². It drops the weight of the true bound, which down-weights small t. The paper reports better codelengths from the true bound and better samples from the simplified one.

*Ho, Jain & Abbeel (2020)*

**Ancestral sampling** — The sampler that adds fresh noise at every reverse step.

Algorithm 2 of the paper: x_{t−1} = (1/√α_t)(x_t − (β_t/√(1−ᾱ_t)) ε_θ) + σ_t z, with z ~ N(0, I) and z = 0 at the last step.

*Ho, Jain & Abbeel (2020)*

**DDIM** — A deterministic sampler for the same trained model.

Denoising diffusion implicit models rewrite the reverse chain so that the marginals are deterministic given x_0, turning sampling into an ODE that can be jumped over. η = 0 gives a fully deterministic sampler; η = 1 recovers the ancestral one.

*Song, Meng & Ermon (2021)*

**Deterministic sampler** — A sampler that adds no fresh noise, so the same starting point gives the same sample.

The same latent always produces the same output, which makes the samplers comparable and lets the number of steps be reduced without the loss of diversity that stochasticity would cause.

*Song, Meng & Ermon (2021)*

**Terminal KL** — How far the final noisy state is from the standard normal prior.

D_KL(q(x_T|x_0) ‖ N(0, I)). The paper quotes roughly 10⁻⁵ bits per dimension for its linear schedule, which is the statement that x_T carries essentially no information about the data.

*Ho, Jain & Abbeel (2020)*

**Latent diffusion** — Running the diffusion in an autoencoder’s latent space instead of in pixel space.

The technique behind Stable Diffusion. The saving is roughly quadratic in the compression factor, because both the number of spatial positions and the number of channels shrink.

*Rombach et al. (2022)*

**Autoencoder** — A learned encoder and decoder pair that compresses data and reconstructs it.

In latent diffusion the autoencoder is usually a convolutional one trained separately. Its reconstruction error is the price paid for the compression.

*Rombach et al. (2022)*

**Scaling factor** — The constant that rescales the latents so they have roughly unit variance.

The forward process assumes data with unit-ish variance. Rombach et al. multiply their latents by 0.18215 to achieve that, and the choice matters: without it the schedule is mismatched to the data.

*Rombach et al. (2022)*

**Guidance** — Steering a generative model towards a condition by interpolating its scores.

The guided score is a linear combination of the unconditional and the conditional score, with a weight that decides how far to go. Guidance is what makes a text-to-image model obey its prompt.

*Ho & Salimans (2022)*

**Classifier-free guidance** — Guidance that needs no classifier, because the condition is dropped out during training.

s_guided = s_uncond + w(s_cond − s_uncond). The model is trained both with and without the condition, so the two scores come from the same network. It is simpler than classifier guidance and works better in practice.

*Ho & Salimans (2022)*

**Mode collapse** — A generator that produces only a subset of the data distribution.

Guidance causes a specific kind of it: the samples concentrate on the mode that matches the condition and stop covering the rest of the distribution.

*Course term*

**Preconditioning** — A weighting that decides how the loss at one noise level counts against the others.

Different noise levels have different intrinsic difficulty, so the loss has to be scaled per level for the network to be trained well. The design-space paper treats this as a function of σ and t rather than of the raw loss.

*Karras et al. (2022)*

**σ parametrisation** — Indexing the noise levels by the standard deviation of the data noise.

An alternative to indexing by timestep, in which the model is written in terms of σ, the noise level itself. It makes the design space easier to reason about and is the basis of several later samplers.

*Karras et al. (2022)*

**Rate–distortion** — A view of the generative model as a lossy compressor.

The bound’s KL terms are the rate; the reconstruction error is the distortion. The paper reports that more than half of a diffusion model’s lossless codelength describes imperceptible detail.

*Ho, Jain & Abbeel (2020)*

**Progressive generation** — Large-scale structure appears first and fine detail last.

Predicting x̂_0 from a noisy x_t at each step of the reverse chain gives a sequence of ever sharper estimates. Large features are decided early, details late.

*Ho, Jain & Abbeel (2020)*

**Noise swap** — Replacing the noise in a noisy sample to see what the model kept.

Taking x_t from one data point and rebuilding it with the noise from another isolates structure from texture, with no model involved at all.

*Course term*

**Signal** — The part of x_t that comes from the data rather than from the noise.

In x_t = √ᾱ_t x_0 + √(1−ᾱ_t) ε, the first term is the signal and the second is the noise. Their ratio is the signal-to-noise ratio, and it is the single number that describes how corrupted the state is.

*Course term*

## Appendix B — The laboratories

Every laboratory the course ships. Each one runs in the application and computes everything it shows in the browser; this appendix is the catalogue of what exists and what it is for.

### A · The forward process

*The chain, the closed form for x_t, and the posterior.*

**Delivers:**

- Forward process with a closed form for x_t

### B · The reverse process

*A real denoiser, trained in your browser, and two samplers.*

**Delivers:**

- Reverse process and the learned denoiser
- Sampling and the ancestral chain
- Deterministic samplers
- The deterministic step
- The same model, sampled without noise

### C · Noise schedules

*Linear against cosine, and what they do to the chain.*

**Delivers:**

- Beta and noise schedules
- The cosine schedule
- The effective diffusion length

### D · Latent diffusion

*The autoencoder round trip, and the compression measured.*

**Delivers:**

- Autoencoder round trip and the reconstruction error
- Latent space scaling factor
- Where the compute moves

### E · Guidance

*The fidelity–diversity trade-off, from an exact score.*

**Delivers:**

- Unconditional versus conditional score
- The guidance scale sweep
- Why guidance reduces diversity
- Classifier guidance and its gradient term

### F · The variational bound

*The weights, and the decomposition of the bound.*

**Delivers:**

- Variational bound and the KL term

### G · Preconditioning

*The σ parametrisation, the four coefficients, and a sampler.*

**Delivers:**

- Preconditioning functions
- σ parametrisation versus the timestep parametrisation

## Appendix C — Sources

- **Denoising Diffusion Probabilistic Models** — Jonathan Ho, Ajay Jain, Pieter Abbeel (2020), arXiv:2006.11239 [cs.LG] / NeurIPS 2020. Licence: arXiv perpetual, non-exclusive distribution licence. No Creative Commons licence is shown on the record; re-check per version before redistributing..
  There is no generative or multimodal application anywhere in the collection.
- **High-Resolution Image Synthesis with Latent Diffusion Models** — Robin Rombach, Andreas Blattmann, Dominik Lorenz, Patrick Esser, Björn Ommer (2022), arXiv:2112.10752 [cs.CV] / CVPR 2022. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Diffusion is what made high-resolution generation practical; the latent step is the missing half of the story.
- **Elucidating the Design Space of Diffusion-Based Generative Models** — Tero Karras, Miika Aittala, Timo Aila, Samuli Laine (2022), arXiv:2206.00364 [cs.CV] / NeurIPS 2022. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The pre-conditioning and σ parametrisation that later samplers use; without it, the schedule choice looks arbitrary.
- **Classifier-Free Diffusion Guidance** — Jonathan Ho, Tim Salimans (2022), arXiv:2207.12598 [cs.LG]. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Guidance is how a text-conditioned model is steered, and it is a single interpolation in the score.
- **Diffusion Models Beat GANs on Image Synthesis** — Prafulla Dhariwal, Alex Nichol (2021), arXiv:2105.05233 [cs.CV] / NeurIPS 2021. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The classifier-guidance recipe that made diffusion competitive, for comparison with classifier-free guidance.
- **Denoising Diffusion Implicit Models** — Jiaming Song, Chenlin Meng, Stefano Ermon (2020), arXiv:2010.02502 [cs.LG] / ICLR 2021. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The deterministic sampler, and therefore the reason a diffusion model can be sampled in a few dozen steps instead of a thousand.
- **Improved Denoising Diffusion Probabilistic Models** — Alex Nichol, Prafulla Dhariwal (2021), arXiv:2102.09672 [cs.LG] / ICML 2021. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The cosine schedule and the learned variances, which is what the schedules module compares against the original linear schedule.
