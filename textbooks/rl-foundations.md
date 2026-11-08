# Reinforcement Learning Foundations


**Source:** Reinforcement Learning: An Introduction (second edition) — Richard S. Sutton, Andrew G. Barto (2018)

**Licence:** The book is distributed free of charge by the authors for personal use. The machine-check could not be completed from this environment (TLS trust failure on the host); the canonical page is incompleteideas.net/book/the-book-2nd.html.

**Why this course exists:** The agentic course uses reinforcement learning loosely. Nothing in the collection defines an MDP, a value function or a policy gradient.

**Source:** Spinning Up in Deep RL — OpenAI (2019)

**Licence:** MIT (verified via the GitHub API for openai/spinningup, 2026-10-19)

**Why this course exists:** A derivation-first path from the policy gradient theorem to the algorithms in use, with runnable reference code.

**Source:** Asymptotic Confidence Bounds for the Monte Carlo Estimation of the Value Function: A Bootstrap Approach — Gert Williams, Christopher J. C. Burges (1990)

**Licence:** Springer article. Bibliographic reference only; the text is not redistributed. The λ-return estimator it generalises is implemented from the published definition in the course.

**Why this course exists:** The variance–bias trade-off in the advantage estimate.

---

## Contents

- [1. The MDP](#1-the-mdp)
  - [Lesson 1. States and returns](#lesson-1-states-and-returns)
- [2. Value functions](#2-value-functions)
  - [Lesson 2. The value function](#lesson-2-the-value-function)
  - [Lesson 8. The optimal policy](#lesson-8-the-optimal-policy)
- [3. Policy gradients](#3-policy-gradients)
  - [Lesson 3. The likelihood-ratio trick](#lesson-3-the-likelihood-ratio-trick)
- [4. Actor–critic](#4-actorcritic)
  - [Lesson 4. The baseline](#lesson-4-the-baseline)
  - [Lesson 5. The n-step return](#lesson-5-the-n-step-return)
  - [Lesson 6. The λ-return](#lesson-6-the--return)
  - [Lesson 7. The actor–critic loop](#lesson-7-the-actorcritic-loop)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — The laboratories](#appendix-b-the-laboratories)
- [Appendix C — Sources](#appendix-c-sources)

## 1. The MDP

*The problem, written down exactly*

States, actions, rewards, transitions and returns. The Markov property, the discount, and the two things the discount is for.

**Learning outcomes**

- Write down a Markov decision process and say what the Markov property rules out
- Compute a return, and say what the discount is for
- Say what a policy is, and what a stochastic policy buys

### Lesson 1. States and returns

*The problem, written down exactly*

*Estimated study time:* 24 minutes

**What you will learn**

- Write down a Markov decision process
- Compute the return of a trajectory, with and without a discount
- Say what the Markov property rules out and what it buys

**The ideas**

- A Markov decision process is a tuple: states, actions, a reward function and a transition kernel.
- The Markov property says the next state depends only on the present one — not on the whole history.
- The discount is not a preference; it is what makes the infinite sum converge and what makes the problem finite.

#### Practice

**Q. What does the Markov property say? — multiple-choice *(core)***

- ✓ **The next state depends only on the present state**
- The states arrive in a random order
- The reward depends only on the state
- The process never revisits a state

> Correct.

> **Why:** The whole history is irrelevant to the future. That is what makes the value function a function of the state alone, and the problem finite.

**Q. A trajectory collects rewards 2, 1, 1 with a discount of 0.5. What is the return from the first step? — numeric *(core)***

> **Answer:** 2.75 ± 0.001

> **Why:** 2 + 0.5×1 + 0.25×1 = 2.75. Each reward is weighted by a power of the discount.

**Q. What does the Markov property actually require of an environment? — multiple-choice *(warmup)***

- That nothing in the environment is random
- ✓ **That the next state and reward depend only on the present state**
- That rewards arrive immediately after each action
- That every episode is short

> Correct — and a state that carries the needed history inside itself keeps the property intact.

> **Why:** The Markov property is a statement about the state definition, not about the absence of memory: the next state depends only on the present one. An environment whose past matters is still an MDP if the state is defined to carry that past.

**Q. The discount factor exists because agents prefer immediate rewards to later ones. — boolean *(warmup)***

> **Answer:** False

> **Why:** The course is explicit: the discount is not a preference. It is what makes the infinite sum of future rewards converge, and what makes the problem finite enough to write a value function for.

#### Go and do it

The gridworld, its transition kernel, and the return of a trajectory. Open **Walk the grid** in the rl-foundations application.

**Where this came from**

- §sutton:3 The Markov Decision Process — The formalisation, and the returns.
- §spinningup:2 The reinforcement learning problem — The return, the discount, and the vocabulary.

**The words this lesson uses**

- **A Markov decision process** — States, actions, a reward function and a transition kernel, with the Markov property.
- **The return** — The total reward a trajectory collects, with the future discounted.
- **The discount** — The factor by which the future is weighted less than the present.
- **Policy** — What the agent does in each state.

## 2. Value functions

*What a state is worth, and how to find out*

The value of a state under a policy, the value of the best policy, and the two sweeps that compute them exactly.

**Learning outcomes**

- State the Bellman equation and say what each term is
- Compute a value function by policy evaluation, and check that it satisfies the equation
- Compute the optimal value function and read the optimal policy off it

### Lesson 2. The value function

*What a state is worth*

*Estimated study time:* 26 minutes

**What you will learn**

- Define the value of a state under a policy
- State the Bellman equation and say what each term is
- Explain why the value is a fixed point, and what that means

**The ideas**

- The value of a state is the expected return from it, under a policy.
- The Bellman equation says the value is the reward plus the discounted value of the next state.
- Iterating the equation converges to the value: it is a contraction, and the iteration is a fixed-point method.

#### Practice

**Q. What does the Bellman equation say? — multiple-choice *(core)***

- ✓ **The value of a state is the reward plus the discounted value of the next state**
- The value of a state is the average reward from it
- The value of a state is the value of the best action
- The value of a state is the reward of the best action

> Correct.

> **Why:** It is a fixed point: the value function is the one that satisfies it, and iterating it converges to that function.

**Q. The Bellman equation writes the value of a state in terms of what? — multiple-choice *(core)***

- The sum of all rewards the episode will ever pay
- ✓ **The reward now plus the discounted value of the next state**
- The maximum reward obtainable from the state
- The average reward of the whole episode

> Correct — one step of reward, then the recursion takes over.

> **Why:** The value of a state is the expected return from it, and the Bellman equation decomposes that return one step at a time: the reward now, plus the discounted value of wherever the state goes next. Iterating the equation converges because it is a contraction.

#### Go and do it

The value iteration, sweep by sweep, and the policy it produces. Open **Sweep the values** in the rl-foundations application.

**Where this came from**

- §sutton:4 The value function — What a value function is, and the two ways of writing it.
- §sutton:6 Policy evaluation — Finding the value of a policy by iteration.

**The words this lesson uses**

- **The value function** — The expected return from a state, under a policy.
- **The Bellman equation** — The value is the reward now plus the discounted value of what comes next.

*Read first:* States and returns

### Lesson 8. The optimal policy

*And the answer every laboratory is checked against*

*Estimated study time:* 22 minutes

**What you will learn**

- Compute the optimal value function by value iteration
- Read the greedy policy off the optimal value function
- Say what a policy gradient is trying to find, in these terms

**The ideas**

- The optimal value function is the largest value any policy achieves, and it satisfies its own Bellman equation.
- The greedy policy with respect to the optimal value function is optimal.
- A policy gradient is a stochastic way of finding the same thing, without ever writing the equation down.

#### Practice

**Q. Value iteration finds the optimal policy without ever evaluating a policy. — boolean *(core)***

> **Answer:** True

> **Why:** Yes. One sweep of the optimality operator gives the greedy policy with respect to the current values, and repeating the sweep converges to the optimal pair. A policy evaluation is not needed anywhere in it.

#### Go and do it

The optimal policy and the value of reaching the goal, computed exactly. Open **See the optimum** in the rl-foundations application.

**Where this came from**

- §sutton:9 Value iteration — The Bellman optimality equation, and the sweep that solves it.

**The words this lesson uses**

- **The optimal policy** — The policy that reaches the largest value in every state.
- **Value iteration** — Solving the Bellman optimality equation by sweeping it.

*Read first:* The value function

## 3. Policy gradients

*The gradient, and how to estimate it while acting*

The likelihood-ratio trick, the policy gradient theorem, and the estimator that follows from it — checked here against the exact gradient of the exact expected return.

**Learning outcomes**

- Derive the likelihood-ratio trick from the definition of the gradient
- State the policy gradient theorem and say what it is the gradient of
- Estimate the gradient while acting, and check the estimate against the exact answer

### Lesson 3. The likelihood-ratio trick

*How the gradient is turned into something you can measure while acting*

*Estimated study time:* 28 minutes

**What you will learn**

- Derive the likelihood-ratio trick from the definition of the gradient
- Explain what the trick does to the terms that do not depend on the parameters
- Write the estimator that follows from it
- Check the derivation on a problem small enough to compute it exactly

**The ideas**

- The gradient of a log-probability is the score function.
- Multiplying by the likelihood turns an expectation under one distribution into an expectation under another.
- Everything that does not depend on the parameters drops out, and what is left can be sampled.
- With one state the expectation is a finite sum, so the three forms of the gradient can be printed side by side and their difference is arithmetic error rather than luck.

#### Practice

**Q. What does the likelihood-ratio trick do? — multiple-choice *(core)***

- ✓ **It turns an expectation under one distribution into one under another**
- It makes the estimator unbiased
- It reduces the variance of the estimate
- It removes the discount

> Correct.

> **Why:** Multiplying by the ratio of the two densities does it, and the ratio does not depend on the parameters being differentiated — which is what lets the terms that do not depend on them drop out.

**Q. A policy gives an action probability of 0.25 in a state. What is the gradient of its log-probability with respect to a logit that only that action has? — numeric *(hard)***

> **Answer:** 0.75 ± 0.001

> **Why:** The derivative of log p with respect to its own logit is 1 − p, so it is 1 − 0.25 = 0.75.

#### Go and do it

One state, so every line of the derivation is computable: the gradient three ways, the exact moments of the sampled estimate, and the sixty uphill steps the derivative predicts. The next two views run the same estimator on the gridworld against a finite difference, with and without a baseline. Open **Derive it, and check it** in the rl-foundations application.

**Where this came from**

- §sutton:13 Policy gradients — The likelihood-ratio trick, the policy gradient theorem, and the estimate.
- §spinningup:3 Deriving the policy gradient — The derivation and the estimators that follow from it.

**The words this lesson uses**

- **The score function** — The gradient of the log-probability of an action.
- **The log-probability** — The logarithm of the probability of an action, and the thing the gradient is taken of.
- **The likelihood-ratio trick** — Turning an expectation under one distribution into one under another.
- **A bandit** — One state, one action each round, and no consequences.
- **REINFORCE** — The policy gradient estimated from whole episodes.

*Read first:* States and returns

## 4. Actor–critic

*A smaller signal, and what it costs*

The baseline that removes the variance, the λ-return and the general advantage estimate, and the loop that puts them together.

**Learning outcomes**

- Say what a baseline does to the expectation and to the variance
- Compare the n-step and the λ-return as estimators of the advantage
- Run an actor–critic loop and read its learning curves

### Lesson 4. The baseline

*A smaller signal that means the same thing*

*Estimated study time:* 24 minutes

**What you will learn**

- Show that a baseline does not change the expectation of the gradient
- Explain why a good baseline reduces the variance so much
- Say what the advantage is, and what it is worth
- Say which rewards a step may be weighted by, and why the choice is free in expectation

**The ideas**

- Subtracting any function of the state leaves the expected gradient unchanged.
- The reason is that the baseline does not depend on the action, so its expectation is zero.
- A good baseline removes the part of the return that was going to happen anyway, and that part is most of the noise.
- The same argument covers the weighting: the rewards a step arrived with cannot be influenced by it, so dropping them changes the spread and not the mean.

#### Practice

**Q. Why does subtracting a baseline leave the expected gradient unchanged? — multiple-choice *(hard)***

- ✓ **The baseline does not depend on the action, so its expectation is zero**
- The baseline is a constant
- The gradient of the baseline is zero
- The baseline is unbiased

> Correct.

> **Why:** The term is the score function times the baseline, and the score function has mean zero over the action distribution. So the baseline drops out of the expectation.

**Q. Subtracting any baseline that depends only on the state changes the expected policy gradient by how much? — numeric *(core)***

> **Answer:** 0

> **Why:** Exactly zero. The baseline does not depend on the action, so its expected contribution to the gradient is zero — while in practice it removes most of the variance, because the part of the return that was going to happen anyway is most of the noise.

#### Go and do it

One estimator, two weights: the rewards still to come, and the whole episode’s return. The two means agree to the sampling noise of the batches, and the two spreads do not. Laboratory B holds the other half of the saving — the same comparison with the value of the state subtracted. Open **Reward-to-go, and the spread it leaves** in the rl-foundations application.

**Where this came from**

- §sutton:13 Policy gradients — The baseline, and what it does to the variance of the estimate.

**The words this lesson uses**

- **The baseline** — A function of the state subtracted from the return.
- **The advantage** — How much better an action is than the policy’s average in that state.
- **The reward-to-go** — The rewards still to come, rather than the whole episode’s return.

*Read first:* The likelihood-ratio trick

### Lesson 5. The n-step return

*Trading the bias of the bootstrap against the noise of the sample*

*Estimated study time:* 26 minutes

**What you will learn**

- Compute the n-step return
- Say what makes it biased, and what makes it noisy
- Explain why the two ends of the range are bad in different ways

**The ideas**

- The n-step return bootstraps after n steps, and the bootstrap is biased while the sample is noisy.
- The one-step return is the least noisy and the most biased; the Monte Carlo return is the reverse.
- The λ-return is a mixture, and λ is the knob between them.

#### Practice

**Q. Which end of the n-step range is biased? — multiple-choice *(core)***

- ✓ **Both, in opposite ways: the one-step return is biased and the Monte Carlo return is noisy**
- Neither
- Only the one-step return
- Only the Monte Carlo return

> Correct.

> **Why:** The bootstrap is what biases an estimate, and the Monte Carlo return has no bootstrap. The sample is what makes an estimate noisy, and the one-step return has almost no sample in it.

#### Go and do it

The n-step returns of a real trajectory, and the truth they are aiming at. Open **Count the steps** in the rl-foundations application.

**Where this came from**

- §sutton:5 One-step prediction methods — The temporal-difference error, and the update it produces.
- §gae:1 The bootstrap estimator — The λ-return and the trade-off it makes.

**The words this lesson uses**

- **The n-step return** — The reward for n steps, and then a bootstrapped value.
- **Bootstrapping** — Using an estimate of the future value in place of the future value.
- **The λ-return** — A weighted mixture of the n-step returns.

*Read first:* The baseline

### Lesson 6. The λ-return

*A whole family of estimators, and the one knob*

*Estimated study time:* 24 minutes

**What you will learn**

- Compute the λ-return and the general advantage estimate
- Measure the bias and the variance of an estimator, rather than assuming them
- Say where the best λ is, and why it depends on the horizon

**The ideas**

- The λ-return is a weighted mixture of the n-step returns, with weights (1−λ)λ^(n−1).
- The general advantage estimate is the same thing, written in terms of the temporal-difference errors.
- The best λ is the one that matches the estimator to the horizon you actually have.

#### Practice

**Q. The best λ for an advantage estimate depends on how long the episodes are. — boolean *(hard)***

> **Answer:** True

> **Why:** Yes. The bias comes from the truncation of the episode, so a short horizon wants a small λ and a long one can afford a large λ. The right λ is a function of the horizon you actually have.

**Q. With λ = 0.5, what weight does the λ-return place on the 2-step return? — numeric *(core)***

> **Answer:** 0.25 ± 0.001

> **Why:** The λ-return weights the n-step return by (1 − λ)λ^(n−1): for n = 2 that is 0.5 × 0.5 = 0.25. λ = 0 is the one-step estimate, λ = 1 the Monte Carlo return, and everything between is the mixture.

#### Go and do it

The bias and the variance of the estimator, measured, as λ moves. Open **Sweep λ** in the rl-foundations application.

**Where this came from**

- §gae:1 The bootstrap estimator — The λ-return, the variance–bias trade-off, and the general advantage estimate.

**The words this lesson uses**

- **The λ-return** — A weighted mixture of the n-step returns.
- **The general advantage estimate** — The λ-return, written in terms of the temporal-difference errors.

*Read first:* The n-step return

### Lesson 7. The actor–critic loop

*The two halves, and how they are put together*

*Estimated study time:* 26 minutes

**What you will learn**

- Say what the actor does and what the critic does
- Describe the temporal-difference update the critic makes
- Run the loop and read the learning curve it produces

**The ideas**

- The critic estimates the value; the actor follows the advantage the critic makes available.
- The critic is a bootstrapping estimator, so it is biased and it is noisy, and it learns fast.
- The two halves have different learning rates, and the difference matters.

#### Practice

**Q. What does the critic contribute to the actor–critic loop? — multiple-choice *(core)***

- ✓ **An estimate of the value, and through it the advantage the actor follows**
- The parameters the actor starts from
- The reward function
- The discount

> Correct.

> **Why:** The critic turns the return into the advantage, which is a smaller and less noisy signal, and the actor follows the advantage rather than the return.

#### Go and do it

The actor–critic loop, run here, with its learning curves. Open **Run the loop** in the rl-foundations application.

**Where this came from**

- §spinningup:4 Beyond policy gradients — The actor–critic family and what it adds.

**The words this lesson uses**

- **Actor–critic** — A policy and a value function, learning together.
- **The temporal-difference error** — The reward plus the discounted next value, minus the current value.
- **The advantage** — How much better an action is than the policy’s average in that state.

*Read first:* The λ-return

## Appendix A — Glossary

**A Markov decision process** — States, actions, a reward function and a transition kernel, with the Markov property.

An MDP is a tuple of five things: the states, the actions, the probability of each immediate reward, the probability of each next state, and the discount. The Markov property says the next state depends only on the present state — so the history is not needed, and the problem is finite.

**The return** — The total reward a trajectory collects, with the future discounted.

The return from a time is the sum of the rewards from then on, each weighted by a power of the discount. It is the quantity an agent is trying to maximise, and the quantity every estimator in this course is trying to estimate.

**The discount** — The factor by which the future is weighted less than the present.

The discount is usually between zero and one. It makes an infinite sum converge, which is what makes the problem finite; and it encodes a preference for the near future, which is what makes an infinite-horizon problem well posed.

**Policy** — What the agent does in each state.

A policy is a distribution over actions for each state. A deterministic policy takes one action; a stochastic one takes an action at random. The stochastic kind is what a policy gradient needs, and what the exact expected return of a parameterised policy has to be computed for.

**The value function** — The expected return from a state, under a policy.

The value of a state is what the agent expects to collect from it, on average, if it follows the policy from then on. It is a function of the state and of the policy, and it is the object every dynamic-programming method computes.

**The Bellman equation** — The value is the reward now plus the discounted value of what comes next.

The equation is a fixed point: the value function is the one that satisfies it. Iterating it converges to that fixed point, because the operator is a contraction — and the difference between the iteration and the answer is the residual, which the course measures.

**Value iteration** — Solving the Bellman optimality equation by sweeping it.

One sweep replaces every value with the value of the best action, and repeating the sweep converges to the optimal value function. The greedy policy with respect to the result is the optimal policy, and it costs no more than a policy evaluation to find.

**The optimal policy** — The policy that reaches the largest value in every state.

The optimal policy is the answer the dynamic-programming methods compute exactly. It is also the answer a policy gradient is looking for, by a much more expensive route — and comparing the two is the sharpest check there is.

**The score function** — The gradient of the log-probability of an action.

The score of a state and action is the gradient of the log of the probability of taking that action. It is the direction in which the log-probability rises, and it is what the likelihood-ratio trick turns the gradient of the return into.

**The log-probability** — The logarithm of the probability of an action, and the thing the gradient is taken of.

The log is what makes the gradient of a probability well behaved: the derivative of log p with respect to the parameters is the score, and the score is what an estimator can be built from. The log is also what turns a product of probabilities into a sum.

**The likelihood-ratio trick** — Turning an expectation under one distribution into one under another.

Multiplying by p/q inside an expectation under q turns it into an expectation under p, and the factor does not depend on the parameters being differentiated. That is the whole of the trick, and it is what lets a policy gradient be estimated from samples.

**A bandit** — One state, one action each round, and no consequences.

A multi-armed bandit is the smallest problem on which a policy gradient can be written down: there is one state, so the expectation over trajectories becomes a finite sum over the actions. That is what makes it the place to check a derivation — every line of it, including the variance of the estimator, is arithmetic rather than a report of one run.

**REINFORCE** — The policy gradient estimated from whole episodes.

REINFORCE draws trajectories from the policy, multiplies the score of each step by a return, and averages. The average is an unbiased estimate of the gradient of the expected return — unbiased in the sense that its expectation is exactly that vector, which is what the finite-difference check in the laboratory measures.

**The reward-to-go** — The rewards still to come, rather than the whole episode’s return.

A step can be weighted by the total return of the episode or by the rewards that came after it. The rewards already collected are fixed before the action is drawn, so their contribution has mean zero and only adds noise. Dropping them is free in expectation and expensive to skip in variance — and the laboratory measures the difference rather than asserting it.

**The baseline** — A function of the state subtracted from the return.

Subtracting a baseline from the return leaves the expected gradient unchanged, because the baseline does not depend on the action and its expectation is therefore zero. What it does change is the spread of the estimator — and the spread is what decides how many samples a practitioner needs.

**The advantage** — How much better an action is than the policy’s average in that state.

The advantage of a state and action is the value of taking it minus the value of the state: Q(s,a) − V(s). It is the part of the return that the agent’s own choices made, and it is what a policy gradient actually follows.

**The n-step return** — The reward for n steps, and then a bootstrapped value.

The n-step return looks n steps ahead and then adds the discounted value of the state it arrives at. Small n means a small bootstrap and a noisy sample; large n means a large bootstrap and a quiet one. The Monte Carlo return is the limit, and the one-step return is the other end.

**Bootstrapping** — Using an estimate of the future value in place of the future value.

Bootstrapping is what makes an infinite-horizon problem solvable in finite time, and it is also what makes the estimate biased: the value that is added is an estimate, and the error in it comes back. A method that does not bootstrap is unbiased, and needs the whole episode.

**The λ-return** — A weighted mixture of the n-step returns.

The λ-return weights the n-step return by (1−λ)λ^(n−1) and takes the remaining weight on the longest one. At λ = 0 it is the one-step return; at λ = 1 it is the Monte Carlo return. Everything between is a different trade between bias and noise.

**The general advantage estimate** — The λ-return, written in terms of the temporal-difference errors.

The advantage estimate is the sum of the temporal-difference errors, each weighted by (γλ) to the power of how far ahead it is. It is the same estimator as the λ-return, and it is the one the modern algorithms use, because the errors can be computed on the fly.

**The temporal-difference error** — The reward plus the discounted next value, minus the current value.

The error is what the critic is trying to predict and the actor is trying to exploit. In expectation, and with the true value function, the one-step error is exactly the advantage — which is why the one-step estimate is unbiased and noisy, and why λ trades the noise away for a bias.

**Actor–critic** — A policy and a value function, learning together.

The actor is the policy and the critic is the value estimate. The critic supplies the advantage, which is a smaller and less noisy signal than the return, and the actor follows it. The two halves have separate learning rates, and the difference between them is a real parameter.

## Appendix B — The laboratories

Every laboratory the course ships. Each one runs in the application and computes everything it shows in the browser; this appendix is the catalogue of what exists and what it is for.

### A · The gridworld

*The problem, and the exact answers.*

**Delivers:**

- A tabular gridworld with exact value iteration

### B · The policy gradient

*The derivation, the estimator, and the exact gradient.*

**Delivers:**

- Deriving the simplest policy gradient
- Policy gradients checked against finite differences

### C · The returns

*Bias against noise, and reward-to-go against the whole return.*

**Delivers:**

- Reward-to-go and the variance it removes
- The bias and variance of the λ-return as a function of λ

### D · The actor–critic loop

*Two halves, learning together.*

**Delivers:**

- The actor-critic loop

## Appendix C — Sources

- **Reinforcement Learning: An Introduction (second edition)** — Richard S. Sutton, Andrew G. Barto (2018), MIT Press; the authors publish the complete PDF free. Licence: The book is distributed free of charge by the authors for personal use. The machine-check could not be completed from this environment (TLS trust failure on the host); the canonical page is incompleteideas.net/book/the-book-2nd.html..
  The agentic course uses reinforcement learning loosely. Nothing in the collection defines an MDP, a value function or a policy gradient.
- **Spinning Up in Deep RL** — OpenAI (2019), Online course and reference implementations. Licence: MIT (verified via the GitHub API for openai/spinningup, 2026-10-19).
  A derivation-first path from the policy gradient theorem to the algorithms in use, with runnable reference code.
- **Asymptotic Confidence Bounds for the Monte Carlo Estimation of the Value Function: A Bootstrap Approach** — Gert Williams, Christopher J. C. Burges (1990), Machine Learning 8, 375–389. Licence: Springer article. Bibliographic reference only; the text is not redistributed. The λ-return estimator it generalises is implemented from the published definition in the course..
  The variance–bias trade-off in the advantage estimate.
