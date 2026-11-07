# RLHF Lab


**Source:** The N+ Implementation Details of RLHF with PPO: A Case Study on TL;DR Summarization — Shengyi Huang, Michael Noukhovitch, Arian Hosseini, Kashif Rasul, Weixun Wang, Lewis Tunstall (2024)

**Licence:** CC BY 4.0 on the OpenReview record (https://openreview.net/forum?id=kHO2ZTa8e3). arXiv carries the perpetual non-exclusive distribution licence.

**Why this course exists:** The alignment course covers Bradley–Terry reward models and DPO but never the policy optimisation that the method is named after.

**Source:** Proximal Policy Optimization Algorithms — John Schulman, Filip Wolski, Prafulla Dhariwal, Alec Radford, Oleg Klimov (2017)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The clipped objective that makes RLHF stable in practice.

**Source:** Trust Region Policy Optimization — John Schulman, Sergey Levine, Philipp Moritz, Michael I. Jordan, Pieter Abbeel (2015)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The theory PPO approximates: the KL constraint and the conjugate gradient step.

**Source:** Scaling Laws for Reward Model Overoptimization — Leo Gao, John Schulman, Jacob Hilton (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The Goodhart effect, measured. Both functional forms are plottable at toy scale.

**Source:** The N+ implementation details: code and checkpoints — Shengyi Huang, Michael Noukhovitch (2024)

**Licence:** MIT (verified via the GitHub API, 2026-10-19)

**Why this course exists:** A complete, small-scale RLHF pipeline to read alongside the paper.

---

## Contents

- [1. Policy Gradients](#1-policy-gradients)
  - [Lesson 1. The objective](#lesson-1-the-objective)
  - [Lesson 2. The estimator](#lesson-2-the-estimator)
- [2. Trust Regions](#2-trust-regions)
  - [Lesson 3. The trust region](#lesson-3-the-trust-region)
- [3. Proximal Policy Optimization](#3-proximal-policy-optimization)
  - [Lesson 5. The clipped objective](#lesson-5-the-clipped-objective)
  - [Lesson 6. Advantages and GAE](#lesson-6-advantages-and-gae)
- [4. The KL Penalty](#4-the-kl-penalty)
  - [Lesson 4. The KL penalty](#lesson-4-the-kl-penalty)
- [5. The N+ Details](#5-the-n-details)
  - [Lesson 7. The three stages](#lesson-7-the-three-stages)
  - [Lesson 8. The checklist](#lesson-8-the-checklist)
- [6. Reward Overoptimisation](#6-reward-overoptimisation)
  - [Lesson 9. The overoptimisation result](#lesson-9-the-overoptimisation-result)
  - [Lesson 10. The functional forms](#lesson-10-the-functional-forms)
  - [Lesson 11. The operational lesson](#lesson-11-the-operational-lesson)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — Sources](#appendix-b-sources)

## 1. Policy Gradients

*Optimising a distribution by moving its log-probabilities*

RLHF optimises a policy, not a function. This module introduces the objective — the expected reward of the policy — and the estimator that makes it tractable: the score-function trick, which replaces a derivative through the model with a weighted log-probability.

**Learning outcomes**

- State the objective RLHF maximises and why it is an expectation over a distribution
- Write the score-function estimator and explain what replaced the derivative
- Verify a policy gradient against a finite difference on a problem where the answer is known

### Lesson 1. The objective

*Maximising an expectation over a distribution you are also changing*

*Estimated study time:* 22 minutes

**What you will learn**

- Write the objective an RLHF pipeline maximises
- Explain why the gradient of an expectation is not the expectation of the gradient
- Compute the expected reward of a policy on a finite problem exactly

**The ideas**

- The objective is E_{a~π}[r(a)] — a number that depends on the whole distribution.
- Moving the policy changes which actions are sampled, so the derivative has to account for that.
- On a finite problem the expectation is a finite sum, and its gradient is available exactly.

#### Practice

**Q. What does an RLHF policy stage maximise? — multiple-choice *(core)***

- ✓ **The expected reward under the policy, minus a KL penalty**
- - The reward of the single best response
- - The likelihood of the reference responses
- - The log-probability of the policy’s samples

> Correct.

> **Why:** The objective is an expectation over the actions the policy samples, minus a penalty for moving away from the reference. The penalty is part of the objective, not a regulariser bolted on afterwards.

**Q. The gradient of an expectation is the expectation of the gradient. — boolean *(core)***

> **Why:** No — and this is the whole reason the score-function estimator exists. The distribution is being moved, so the derivative has to account for that. The score-function estimator is the identity that makes it possible without differentiating through the model.

#### Go and do it

Compute the expected reward of a policy and check its gradient against a finite difference. Open **The expected reward and its gradient** in the rlhf-lab application.

**Where this came from**

- §2 Background: PPO and the RLHF pipeline · p. 3 — The three stages of the pipeline and the objective the policy stage optimises.

**The words this lesson uses**

- **Policy** — A distribution over actions, given a state.
- **Policy gradient** — The gradient of the expected reward with respect to the policy’s parameters.
- **Objective** — The quantity the training maximises.
- **Expectation** — The average of a random variable over its distribution.

### Lesson 2. The estimator

*The derivative you do not have to take*

*Estimated study time:* 24 minutes

**What you will learn**

- Write the score-function estimator
- Explain what it costs to be unbiased instead of low-variance
- State the conditions the estimator needs

**The ideas**

- ∇E_π[r] = E_π[r · ∇log π] — the model’s own log-probability replaces its derivative.
- The trick needs the support of π to be unchanged as the parameters move.
- The estimator is unbiased but high-variance, which is what the value function is for.

#### Practice

**Q. What does the score-function estimator replace? — multiple-choice *(core)***

- ✓ **The derivative of the model, with its own log-probability**
- - The reward, with the value function
- - The expectation, with a sample
- - The KL penalty, with a constraint

> Correct.

> **Why:** ∇E_π[r] = E_π[r · ∇log π]. The model’s own log-probability stands in for the model’s derivative, which is what makes the estimator possible for a language model whose output layer is enormous.

#### Go and do it

Compare the score-function estimator with the exact gradient of a finite problem. Open **The estimator against the exact gradient** in the rlhf-lab application.

**Further reading**

- [Sutton & Barto, Reinforcement Learning: An Introduction](http://incompleteideas.net/book/RLbook2020.pdf) — The policy gradient theorem, from first principles.

**The words this lesson uses**

- **Score-function estimator** — ∇E_π[r] = E_π[r · ∇log π] — the derivative without the derivative.
- **Baseline** — A constant subtracted from the reward without changing the gradient.
- **Variance** — How much an estimator’s answer moves between runs.

*Read first:* The objective

## 2. Trust Regions

*Bounding how far one update may move the policy*

Taking a large step in the space of policies destroys the policy: the samples that justified the old estimate no longer represent the new one. This module covers the constraint that prevents it, and the algorithm that made it practical.

**Learning outcomes**

- Write the trust-region constraint and say what it is for
- Explain why a KL penalty and a KL constraint are not the same thing
- Describe the natural gradient and the conjugate-gradient step that replaces it

### Lesson 3. The trust region

*Bounding the step, not the reward*

*Estimated study time:* 24 minutes

**What you will learn**

- Write the trust-region constraint
- Explain what a large step does to the samples that justified the old estimate
- Distinguish a KL penalty from a KL constraint

**The ideas**

- The constraint is on the KL between the old and new policies, not on the objective.
- A KL *penalty* is a soft nudge; a KL *constraint* is a hard boundary that the optimiser respects.
- The bound is what makes the importance ratio a usable estimate of the new policy.

#### Practice

**Q. What is the purpose of the trust-region constraint? — multiple-choice *(core)***

- ✓ **To keep the samples that justified the old estimate valid**
- - To stop the policy from producing low-probability text
- - To make the reward model more accurate
- - To keep the loss from diverging

> Correct.

> **Why:** The importance ratio is only a usable correction while the two policies are close. A large step makes the collected samples a poor description of the new policy, and the estimate silently becomes wrong.

**Q. How is a KL penalty different from a KL constraint? — multiple-choice *(hard)***

- ✓ **A penalty is a soft term in the objective; a constraint is a boundary the optimiser respects**
- - They are the same thing with different names
- - A penalty is computed exactly and a constraint is estimated
- - A constraint is a regulariser and a penalty is a hyperparameter

> Correct.

> **Why:** A penalty trades reward against distance at whatever ratio the coefficient sets. A constraint says the distance may not exceed δ, and the optimiser adjusts the step to respect it.

#### Go and do it

Watch the KL between the old and new policies as the step size grows. Open **How far a step moves the policy** in the rlhf-lab application.

**Further reading**

- [Schulman et al., arXiv:1502.05477](https://arxiv.org/abs/1502.05477) — TRPO: the constraint, the natural gradient, and the conjugate-gradient step.

**The words this lesson uses**

- **Trust region** — A constraint on how far the new policy may be from the old one.
- **Importance ratio** — The ratio of the new policy’s probability to the old one’s.
- **Natural gradient** — The gradient measured in the geometry of the distribution.

*Read first:* The estimator

## 3. Proximal Policy Optimization

*The clipped surrogate, and what the clip actually does*

PPO replaces the hard constraint with a clip: once the importance ratio passes a bound, the objective stops rewarding movement in that direction. This module derives the objective, shows exactly when the clip bites, and covers the advantage estimate that goes with it.

**Learning outcomes**

- Write the clipped surrogate and identify the region where the gradient vanishes
- Compute the clip fraction and say what it measures
- Explain why a step that is clipped has zero gradient rather than a smaller one
- Derive generalised advantage estimation from the one-step residual

### Lesson 5. The clipped objective

*Where the gradient goes to zero*

*Estimated study time:* 26 minutes

**What you will learn**

- Write the clipped surrogate and find the region where the clip is active
- Explain why a clipped step has zero gradient rather than a smaller one
- Compute the clip fraction and say what it is for

**The ideas**

- The objective takes the minimum of the clipped and unclipped terms.
- When the clip is active the objective is flat, so its gradient is exactly zero.
- The clip fraction is the diagnostic: it should fall as training goes well.

#### Practice

**Q. What happens to the gradient of the clipped objective when the clip is active? — multiple-choice *(core)***

- ✓ **It becomes exactly zero**
- - It becomes smaller but stays non-zero
- - It is clipped to a small value
- - It is rescaled by the clip factor

> Correct.

> **Why:** Where the clip is active the objective is min(clipped, unclipped) and the clipped branch is the smaller one — and it is a constant. The gradient is therefore exactly zero, not merely small. That is the mechanism: the step is discarded, not shrunk.

**Q. With ε = 0.2, what is the clipped objective when the importance ratio is 2.0 and the advantage is 1? — numeric *(core)***

> **Why:** Exactly 1.2. The ratio is clipped to 1 + ε = 1.2, and the minimum of the two branches is the clipped one, because the advantage is positive.

#### Go and do it

Sweep the importance ratio and watch the objective and its gradient change. Open **Where the clip bites** in the rlhf-lab application.

**Where this came from**

- §2 Background: PPO and the RLHF pipeline · p. 4 — The PPO objective the pipeline is built on.

**Further reading**

- [Schulman et al., arXiv:1707.06347](https://arxiv.org/abs/1707.06347) — The clipped surrogate objective, and the reason for the clip.

**The words this lesson uses**

- **Clipped surrogate objective** — The PPO objective: the minimum of the clipped and unclipped terms.
- **Clip fraction** — The fraction of steps where the clip was active.
- **Importance ratio** — The ratio of the new policy’s probability to the old one’s.

*Read first:* The estimator

### Lesson 6. Advantages and GAE

*The credit assignment, and its one hyperparameter*

*Estimated study time:* 24 minutes

**What you will learn**

- Write the one-step temporal-difference residual
- Derive generalised advantage estimation from it
- Explain the bias–variance trade-off that λ controls

**The ideas**

- δ_t = r_t + γV(s_{t+1}) − V(s_t) is the one-step surprise.
- GAE sums the residuals with a geometric discount, and λ sets how far it looks.
- λ = 0 is the one-step estimate; λ = 1 is the Monte Carlo return.

#### Practice

**Q. What does λ = 1 in generalised advantage estimation give? — multiple-choice *(core)***

- ✓ **The Monte Carlo return, minus the baseline**
- - The one-step temporal-difference residual
- - The importance ratio
- - Zero

> Correct: unbiased, high variance.

> **Why:** λ = 1 makes the geometric sum telescope into the discounted return. It is unbiased and noisy; λ = 0 is the one-step residual, which is tight and biased.

#### Go and do it

Move λ and watch the advantage estimate move from the one-step residual to the Monte Carlo return. Open **The bias–variance trade-off in λ** in the rlhf-lab application.

**Where this came from**

- §4 Implementation details · p. 8 — The advantage estimator and the discount among the enumerated details.

**The words this lesson uses**

- **Advantage** — How much better an action was than the average action in that state.
- **Generalised advantage estimation** — A geometric sum of the one-step residuals, with λ setting how far it looks.
- **Value function** — The expected return from a state, under the current policy.

*Read first:* The clipped objective

## 4. The KL Penalty

*What keeps the aligned model recognisably itself*

The penalty term is the KL divergence from the supervised reference policy, and it has to be *estimated* from samples. This module compares the three estimators in common use, shows which of them is unbiased for what, and explains why the right choice depends on whether the KL is a penalty or a report.

**Learning outcomes**

- State why the penalty is measured from the reference policy
- Compare the three KL estimators and say what each is unbiased for
- Explain why a penalty has to be non-negative and a reported number does not

### Lesson 4. The KL penalty

*A number that has to be estimated from samples*

*Estimated study time:* 26 minutes

**What you will learn**

- State what the penalty measures and against what
- Write the three estimators and say what each is unbiased for
- Explain why a penalty must be non-negative

**The ideas**

- The penalty is the KL from the reference policy, and it is a *sample* estimate.
- The naive estimator is unbiased but can be negative; the squared one is positive but biased.
- The third estimator is positive, and its expectation is the chi-square divergence minus the KL — a detail most write-ups leave out.

#### Practice

**Q. Which of the three KL estimators is unbiased for the KL divergence? — multiple-choice *(hard)***

- ✓ **The log-ratio, k1**
- - The squared log-ratio, k2
- - r − 1 − log r, k3
- - None of them

> Correct — but it can be negative, which is why it is not used as a penalty.

> **Why:** E_π[log(π/π_ref)] is exactly the KL. The other two are used for different reasons: k2 because it is positive, k3 because it is positive and has lower variance — not because it is unbiased for the KL.

**Q. A policy puts probability 0.5 on an action and the reference puts 0.25 on it. What is the log-ratio, in nats? — numeric *(core)***

> **Why:** log(0.5/0.25) = log 2 ≈ 0.693 nats. The k3 estimator on the same sample would be 2 − 1 − log 2 ≈ 0.307.

#### Go and do it

Estimate the KL three ways and compare each against the quantity it is actually unbiased for. Open **The three estimators, measured** in the rlhf-lab application.

**Where this came from**

- §4 Implementation details · p. 8 — The KL estimator and the coefficient, among the enumerated details that decide whether training works.

**The words this lesson uses**

- **KL penalty** — A term subtracted from the reward to keep the policy near the reference.
- **Reference policy** — The policy the KL is measured against — normally the supervised model.
- **The k3 estimator** — r − 1 − log r, which is always non-negative.

*Read first:* The trust region

## 5. The N+ Details

*What had to be true for the pipeline to train at all*

The primary source’s contribution is an enumeration: twenty implementation details, each of which was found to matter, and a reproduction that only worked with most of them in place. This module treats that list as a checklist of the failure modes of RLHF training.

**Learning outcomes**

- Name the stages of an RLHF pipeline and the failure mode of each
- Explain why the scale of the reward model’s error decides how far the policy can be pushed
- Argue for the checklist as a way of reporting a training result

### Lesson 7. The three stages

*Supervised, then ranked, then optimised*

*Estimated study time:* 22 minutes

**What you will learn**

- Name the three stages of an RLHF pipeline and what each produces
- Say what each stage can fail at
- Explain why the reference policy comes from the first stage

**The ideas**

- The supervised stage produces the reference policy that the penalty is measured against.
- The reward stage produces a *ranking* of responses, which is what the third stage consumes.
- The third stage optimises a policy against a proxy, and that is where the danger is.

#### Practice

**Q. Which stage of the RLHF pipeline produces the reference policy? — multiple-choice *(core)***

- ✓ **Supervised fine-tuning**
- - Reward modelling
- - Policy optimisation
- - Evaluation

> Correct.

> **Why:** The reference policy is the supervised model. The KL penalty is measured against it, so the reference decides both the direction and the size of the movement the third stage is allowed.

**Q. What does the reward model produce? — multiple-choice *(core)***

- ✓ **A scalar score for a response**
- - A new policy
- - A preference between two responses
- - A dataset

> Correct, and the score is wrong in a way that matters.

> **Why:** A scalar per response, trained from pairwise preferences. The third stage then maximises the expected score — and the error in that score is what makes overoptimisation possible.

#### Go and do it

Walk the three stages and see what each one contributes to the final behaviour. Open **The pipeline and its failure modes** in the rlhf-lab application.

**Where this came from**

- §2 Background: PPO and the RLHF pipeline · p. 3 — The three stages and the data that flows between them.

**The words this lesson uses**

- **The RLHF pipeline** — Supervised fine-tuning, reward modelling, then policy optimisation.
- **Reward model** — A model trained to rank responses by preference.
- **Reference policy** — The policy the KL is measured against — normally the supervised model.
- **Supervised fine-tuning** — Training on demonstrations of the behaviour you want.

*Read first:* The KL penalty

### Lesson 8. The checklist

*Twenty details, and the argument for listing them*

*Estimated study time:* 20 minutes

**What you will learn**

- Explain why a training result without its details is not reproducible
- Give two examples of a detail that silently decides whether training works
- Argue for publishing the checklist alongside the result

**The ideas**

- The primary source’s contribution is an enumeration, not a new algorithm.
- Most of the details are about scale: the reward model’s noise, the learning rate, the number of epochs.
- A result that omits them cannot be reproduced, and cannot be believed.

#### Practice

**Q. The primary source’s main contribution is a new algorithm. — boolean *(hard)***

> **Why:** No. Its contribution is an enumeration and a reproduction: twenty implementation details that the reported behaviour depended on, and a demonstration that most of them had to be in place for the pipeline to train at all.

#### Go and do it

The failure modes of each stage, and which detail guards against each one. Open **The checklist** in the rlhf-lab application.

**Where this came from**

- §4 Implementation details · p. 8 — The enumerated implementation details, and the argument that reproducing the reported behaviour required most of them.
- §5 Results · p. 10 — The ablation over the details, and the scaling behaviours that were reproduced.

**The words this lesson uses**

- **Reproducibility** — Whether the same code and settings give the same result.
- **Reward model** — A model trained to rank responses by preference.

*Read first:* The three stages

## 6. Reward Overoptimisation

*The point where optimising harder makes things worse*

A reward model is a proxy, and a proxy that is optimised past its accuracy stops being informative. This module builds the phenomenon exactly rather than describing it, and fits the two functional forms the overoptimisation paper reports.

**Learning outcomes**

- State the overoptimisation result and why a fixed-size proxy error is enough to cause it
- Compare reinforcement learning and best-of-n against the same proxy
- Fit and read the two functional forms the paper reports
- Explain what the turning point of the curve means operationally

### Lesson 9. The overoptimisation result

*Goodhart, with a curve*

*Estimated study time:* 24 minutes

**What you will learn**

- State the result: optimising a proxy harder eventually makes the true reward worse
- Explain why a fixed-size proxy error is enough to cause it
- Read the turning point of the curve operationally

**The ideas**

- The proxy error does not grow as you push harder, so the gap between the proxy and the truth opens up.
- The true reward is maximised at a finite distance from the reference, not at infinity.
- Past that point, every unit of proxy reward costs more true reward than it gains.

#### Practice

**Q. What is the overoptimisation result? — multiple-choice *(core)***

- ✓ **Optimising a proxy reward harder eventually makes the true reward worse**
- - A bigger reward model always gives a better policy
- - Reward models cannot be trained at all
- - The KL penalty should be removed

> Correct.

> **Why:** The true reward is maximised at a finite distance from the reference. Past that point every unit of proxy reward costs more true reward than it gains — which is Goodhart’s law with a curve attached.

**Q. Why is a fixed-size reward-model error enough to cause overoptimisation? — multiple-choice *(hard)***

- ✓ **Because the error does not grow as the policy is pushed, so the gap between proxy and truth opens up**
- - Because the error is random and noise is always harmful
- - Because a fixed error makes the reward model worse over time
- - Because the KL penalty grows with the error

> Correct.

> **Why:** The proxy’s error is a fixed landscape. Pushing the policy further finds the high spots in that landscape, and the further you go the more the proxy is rewarding its own noise rather than the truth.

#### Go and do it

Push the policy further and watch the proxy rise while the true reward turns over. Open **The curve** in the rlhf-lab application.

**Where this came from**

- §5 Results · p. 10 — The reproduced overoptimisation behaviour and the two functional forms fitted to it.

**Further reading**

- [Gao, Schulman & Hilton, arXiv:2210.10760](https://arxiv.org/abs/2210.10760) — The measurement of overoptimisation, and the scaling laws for it.

**The words this lesson uses**

- **Overoptimisation** — The point past which optimising a proxy makes the true objective worse.
- **Goodhart’s law** — When a measure becomes a target, it stops being a good measure.
- **Proxy reward** — The reward model’s score, standing in for the thing you actually care about.

*Read first:* The three stages

### Lesson 10. The functional forms

*Two curves, fitted to a curve*

*Estimated study time:* 22 minutes

**What you will learn**

- Write the two functional forms the overoptimisation paper reports
- Fit them to a controlled setting and read the fit
- Compare reinforcement learning against best-of-n on the same proxy

**The ideas**

- For best-of-n: R(d) = d(α − β d), a downward parabola through the origin.
- For reinforcement learning: R(d) = d(α − β log d), which turns over more slowly.
- Best-of-n optimises the *sample*; reinforcement learning optimises the *policy*, and the two behave differently.

#### Practice

**Q. Which functional form does the overoptimisation paper fit for best-of-n? — multiple-choice *(hard)***

- ✓ **R(d) = d(α − β d)**
- - R(d) = d(α − β log d)
- - R(d) = α e^(−β d)
- - R(d) = α d² + β

> Correct.

> **Why:** Best-of-n: a downward parabola through the origin, R(d) = d(α − βd). Reinforcement learning: R(d) = d(α − β log d), which turns over more slowly because the policy moves rather than the sample.

#### Go and do it

Fit both functional forms to the measured curve and compare the two methods. Open **Fitting the forms** in the rlhf-lab application.

**Where this came from**

- §5 Results · p. 10 — The functional forms fitted to the gold reward as a function of the KL distance.

**The words this lesson uses**

- **Overoptimisation** — The point past which optimising a proxy makes the true objective worse.
- **Best-of-n sampling** — Draw n responses and keep the one the reward model likes best.
- **Functional form** — The shape the overoptimisation paper fits to its measurements.

*Read first:* The overoptimisation result

### Lesson 11. The operational lesson

*Where to stop*

*Estimated study time:* 18 minutes

**What you will learn**

- Say what the turning point tells an practitioner
- Explain the role of the KL coefficient as the thing that sets the stopping point
- Argue for reporting the distance travelled alongside the score

**The ideas**

- The KL coefficient is the dial that decides how far the policy is allowed to travel.
- The turning point is where the marginal proxy reward equals the marginal true reward.
- A report that gives a score without the distance travelled cannot be compared with another one.

#### Practice

**Q. What does the turning point of the overoptimisation curve tell an practitioner? — multiple-choice *(hard)***

- ✓ **The distance at which the marginal proxy reward equals the marginal true reward**
- - The point at which the reward model stops working
- - The number of training steps to stop at
- - That the KL penalty should be removed

> Correct.

> **Why:** It is the optimal stopping point for a fixed budget, and it is what the KL coefficient is set to reach. Past it, the run is spending compute to make the true outcome worse.

#### Go and do it

Read the turning point off the curve and the KL coefficient that reaches it. Open **Where to stop** in the rlhf-lab application.

**The words this lesson uses**

- **KL coefficient** — The weight on the penalty term, and therefore the dial on how far the policy may travel.
- **Overoptimisation** — The point past which optimising a proxy makes the true objective worse.

*Read first:* The functional forms

## Appendix A — Glossary

**Policy** — A distribution over actions, given a state.

In RLHF the policy is a language model with a head that produces a distribution over the next token. Everything the algorithm does is move that distribution.

*Course term*

**Objective** — The quantity the training maximises.

For RLHF it is the expected reward under the policy, minus a KL penalty against the reference. The penalty is not an implementation detail; it is part of the objective.

*Huang et al. (2024)*

**Expectation** — The average of a random variable over its distribution.

The objective is an expectation over the actions the policy samples. On a finite problem it is a finite sum, which is what makes the laboratory exact.

*Course term*

**Policy gradient** — The gradient of the expected reward with respect to the policy’s parameters.

Not the gradient of the reward with respect to the parameters — the reward does not depend on them directly. The gradient comes entirely from the fact that changing the policy changes which actions are sampled.

*Course term*

**Score-function estimator** — ∇E_π[r] = E_π[r · ∇log π] — the derivative without the derivative.

Also called the REINFORCE estimator. It replaces the derivative of the model with its own log-probability, and it is unbiased. Its weakness is variance, which grows with the size of the rewards.

*Course term*

**Baseline** — A constant subtracted from the reward without changing the gradient.

Because E_π[∇log π] = 0, subtracting any constant that does not depend on the action leaves the estimator unbiased. Subtracting the value function is the standard choice, because the value function is the best such baseline.

*Course term*

**Variance** — How much an estimator’s answer moves between runs.

The score-function estimator is unbiased and noisy. Almost every practical technique in this area — the value function, the advantage estimate, the clipping — is a variance reduction.

*Course term*

**Importance ratio** — The ratio of the new policy’s probability to the old one’s.

r_t = π_θ(a_t|s_t) / π_old(a_t|s_t). It is the correction that lets samples collected under one policy estimate the objective of another — and it is exactly what the clip acts on.

*Schulman et al. (2017)*

**Trust region** — A constraint on how far the new policy may be from the old one.

Usually a bound on the KL divergence. The point is not to improve the objective but to keep the samples valid: a large step makes the collected samples a poor estimate of the new policy.

*Schulman et al. (2015)*

**Natural gradient** — The gradient measured in the geometry of the distribution.

The ordinary gradient treats every parameter direction as equally meaningful, which is false for a softmax over logits. The natural gradient uses the Fisher information, and it is what a trust-region update follows.

*Schulman et al. (2015)*

**Clipped surrogate objective** — The PPO objective: the minimum of the clipped and unclipped terms.

L^CLIP = E[min(r_t A_t, clip(r_t, 1−ε, 1+ε) A_t)]. The clip removes the incentive to move a ratio that is already far from one — and where the clip is active, the objective is flat, so the gradient is exactly zero.

*Schulman et al. (2017)*

**Clip fraction** — The fraction of steps where the clip was active.

The diagnostic that says whether the policy is moving too far. A clip fraction that climbs towards one means the updates are being thrown away; a clip fraction near zero means the trust region is not doing any work.

*Schulman et al. (2017)*

**Advantage** — How much better an action was than the average action in that state.

A_t = Q(s_t, a_t) − V(s_t). It is the signal the policy gradient is weighted by, and it is the reason a large positive reward on a bad action does not simply push the policy there.

*Course term*

**Value function** — The expected return from a state, under the current policy.

V(s) is what the state is worth on average. It is used twice: as the baseline in the policy gradient, and as the regression target for the critic.

*Course term*

**Generalised advantage estimation** — A geometric sum of the one-step residuals, with λ setting how far it looks.

A_t^GAE = Σ (γλ)^l δ_{t+l}. λ = 0 is the one-step estimate: low variance, high bias. λ = 1 is the Monte Carlo return: unbiased, high variance. Everything in between is the trade-off.

*Course term*

**KL penalty** — A term subtracted from the reward to keep the policy near the reference.

The penalty is what makes the aligned model recognisably the model it started from, and it is the only thing standing between the third stage and a policy that exploits the reward model.

*Huang et al. (2024)*

**Reference policy** — The policy the KL is measured against — normally the supervised model.

It is the anchor of the whole procedure. The penalty is the KL from the current policy to this one, so the reference decides both the direction and the size of the allowed movement.

*Huang et al. (2024)*

**The k3 estimator** — r − 1 − log r, which is always non-negative.

The practical choice for a penalty, because a penalty that can be negative will be. Its expectation is the chi-square divergence minus the KL — not the KL — which is a detail most write-ups of this estimator leave out.

*Example:* Why is the third estimator preferred for a penalty? → Because a penalty term must not be able to go negative. The first estimator can, and the second is always positive but biased upwards.

*Course term*

**The RLHF pipeline** — Supervised fine-tuning, reward modelling, then policy optimisation.

Three stages, in that order. The first produces the reference policy, the second produces a ranking of responses, and the third optimises a policy against that ranking. Each stage has its own failure mode.

*Huang et al. (2024)*

**Supervised fine-tuning** — Training on demonstrations of the behaviour you want.

The first stage of the pipeline, and the source of the reference policy. It is also the only stage whose objective nobody argues about.

*Huang et al. (2024)*

**Reward model** — A model trained to rank responses by preference.

It outputs a scalar, and it is *wrong* — its errors are the thing that makes the third stage dangerous. The scale of its error, not the quality of its ranking, is what decides how far the policy can be pushed.

*Huang et al. (2024)*

**Proxy reward** — The reward model’s score, standing in for the thing you actually care about.

Every reward in modern RLHF is a proxy. The overoptimisation result is what happens when the optimisation notices that the proxy and the truth have come apart.

*Gao, Schulman & Hilton (2022)*

**Overoptimisation** — The point past which optimising a proxy makes the true objective worse.

The result is a curve, not a cliff: the true reward rises, turns over, and falls, while the proxy reward keeps rising. The turning point is where the marginal proxy reward equals the marginal true reward.

*Gao, Schulman & Hilton (2022)*

**Goodhart’s law** — When a measure becomes a target, it stops being a good measure.

The reason the overoptimisation result is expected rather than surprising. The reward model was a measure of preference; the policy optimisation made it a target.

*Course term*

**Best-of-n sampling** — Draw n responses and keep the one the reward model likes best.

An alternative to policy optimisation that needs no training at all — and it fails differently. It optimises the *sample* rather than the *policy*, and the selection bias it introduces is what degrades the true reward.

*Gao, Schulman & Hilton (2022)*

**Functional form** — The shape the overoptimisation paper fits to its measurements.

R_boN(d) = d(α − β d) for best-of-n, and R_RL(d) = d(α − β log d) for reinforcement learning, where d is the KL distance travelled. The forms say that the true reward turns over at a finite distance.

*Gao, Schulman & Hilton (2022)*

**KL coefficient** — The weight on the penalty term, and therefore the dial on how far the policy may travel.

It is the hyperparameter that decides where on the overoptimisation curve the run stops. A larger coefficient means a smaller distance travelled, and a smaller risk.

*Huang et al. (2024)*

**Reproducibility** — Whether the same code and settings give the same result.

The primary source’s whole argument. A training result reported without its details is a claim, not a measurement, and the details are most of the work.

*Huang et al. (2024)*

**Importance sampling** — Estimating one distribution’s expectation using samples from another.

The correction factor is the importance ratio, and its validity is exactly what the trust region and the clip are there to protect.

*Course term*

**Gradient clipping** — Rescaling a gradient that is too large to be useful.

Distinct from the objective clip: this one bounds the size of a step, not the size of the policy’s movement.

*Course term*

**Advantage normalisation** — Rescaling the advantages by their running standard deviation.

A variance reduction that is applied almost universally and is not in the PPO paper’s objective at all. It is one of the details that decides whether training works.

*Huang et al. (2024)*

**Whitening** — Rescaling the returns so that they have mean zero and unit variance.

Another variance reduction, applied to the value targets rather than the advantages. It makes the critic’s job better conditioned, and the learning rate more transferable.

*Course term*

## Appendix B — Sources

- **The N+ Implementation Details of RLHF with PPO: A Case Study on TL;DR Summarization** — Shengyi Huang, Michael Noukhovitch, Arian Hosseini, Kashif Rasul, Weixun Wang, Lewis Tunstall (2024), arXiv:2403.17031 [cs.LG] / COLM 2024. Licence: CC BY 4.0 on the OpenReview record (https://openreview.net/forum?id=kHO2ZTa8e3). arXiv carries the perpetual non-exclusive distribution licence..
  The alignment course covers Bradley–Terry reward models and DPO but never the policy optimisation that the method is named after.
- **Proximal Policy Optimization Algorithms** — John Schulman, Filip Wolski, Prafulla Dhariwal, Alec Radford, Oleg Klimov (2017), arXiv:1707.06347 [cs.LG]. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The clipped objective that makes RLHF stable in practice.
- **Trust Region Policy Optimization** — John Schulman, Sergey Levine, Philipp Moritz, Michael I. Jordan, Pieter Abbeel (2015), arXiv:1502.05477 [cs.LG] / ICML 2015. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The theory PPO approximates: the KL constraint and the conjugate gradient step.
- **Scaling Laws for Reward Model Overoptimization** — Leo Gao, John Schulman, Jacob Hilton (2022), arXiv:2210.10760 [cs.LG] / ICLR 2023. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The Goodhart effect, measured. Both functional forms are plottable at toy scale.
- **The N+ implementation details: code and checkpoints** — Shengyi Huang, Michael Noukhovitch (2024), GitHub repository. Licence: MIT (verified via the GitHub API, 2026-10-19).
  A complete, small-scale RLHF pipeline to read alongside the paper.
