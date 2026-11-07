# Agent Benchmark Lab


**Source:** SWE-bench: Can Language Models Resolve Real-World GitHub Issues? — Carlos E. Jimenez, John Yang, Alexander Wettig, Shunyu Yao, Kexin Pei, Ofir Press, Karthik Narasimhan (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The agentic course has a case study but no benchmark-design lesson, and benchmark design is where most agent claims are won or lost.

**Source:** GAIA: a benchmark for General AI Assistants — Grégoire Mialon, Clémentine Fourrier, Craig Swift, Thomas Wolf, Yann LeCun, Thomas Scialom (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** A benchmark designed around the question: can a general assistant do the easy part of a task and the hard part with the right tools?

**Source:** AgentBench: Evaluating LLMs as Agents — Xiao Liu, Hao Yu, Hanchen Zhang, Yifan Xu, Xuanyu Lei, Hanyu Lai, Yu Gu, Hangliang Ding, Kaiwen Men, Kejuan Yang, Shudan Zhang, Xiang Deng, Aohan Zeng, Zhengxiao Du, Chenhui Zhang, Sheng Shen, Tianjun Zhang, Yu Su, Huan Sun, Minlie Huang, Yuxiao Dong, Jie Tang (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Eight environments, and the finding that a score is only meaningful relative to a matched model size.

**Source:** WebArena: A Realistic Web Environment for Building Autonomous Agents — Shuyan Zhou, Frank F. Xu, Hao Zhu, Xuhui Zhou, Robert Lo, Abishek Sridhar, Xianyi Cheng, Tianyue Ou, Yonatan Bisk, Daniel Fried, Uri Alon, Graham Neubig (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Self-hosted reproducible environments, which is what makes an agent benchmark trustworthy.

**Source:** $\tau$-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains — Shunyu Yao, Noah Shinn, Pedram Razavi, Karthik Narasimhan (2024)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** A user simulator in the loop, which changes what the benchmark is actually measuring.

---

## Contents

- [1. Task Design](#1-task-design)
  - [Lesson 1. What a task is](#lesson-1-what-a-task-is)
  - [Lesson 2. The score and its uncertainty](#lesson-2-the-score-and-its-uncertainty)
- [2. Verification](#2-verification)
  - [Lesson 3. The evaluation criterion](#lesson-3-the-evaluation-criterion)
  - [Lesson 4. The cheat](#lesson-4-the-cheat)
- [3. The Baselines](#3-the-baselines)
  - [Lesson 5. The agentless baseline](#lesson-5-the-agentless-baseline)
  - [Lesson 6. The price of trying again](#lesson-6-the-price-of-trying-again)
- [4. Variance and Contamination](#4-variance-and-contamination)
  - [Lesson 7. One run or many](#lesson-7-one-run-or-many)
  - [Lesson 8. Has the model seen it?](#lesson-8-has-the-model-seen-it)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — The laboratories](#appendix-b-the-laboratories)
- [Appendix C — Sources](#appendix-c-sources)

## 1. Task Design

*What a benchmark is made of*

The tasks, the difficulty mix, and the number of them. What a score on a task set means, and what it does not.

**Learning outcomes**

- Say what makes a task a task, and what makes it a good one
- Compute the uncertainty on a score, and the number of tasks a difference needs
- Explain why a task set is a sample and the score is an estimate

### Lesson 1. What a task is

*And what makes a good one*

*Estimated study time:* 24 minutes

**What you will learn**

- Say what a benchmark task is: an environment, a goal and a verdict
- Explain the three properties a good task set has
- Describe what a difficulty mix does to a score

**The ideas**

- A task is a starting state, a goal, and something that decides whether the goal was reached.
- A good task set is diverse, verified, and hard enough that the trivial strategies fail.
- The difficulty mix is a choice, and it decides what the score means.

#### Practice

**Q. What is a benchmark, exactly? — multiple-choice *(core)***

- ✓ **A set of tasks and a rule that decides whether each was solved**
- A dataset of problems with reference answers
- A metric
- A leaderboard

> Correct.

> **Why:** The tasks and the verdict. Everything else — the score, the interval, the comparison — follows from the two.

**Q. What does the difficulty mix of a task set decide? — multiple-choice *(core)***

- ✓ **What the score means: a set of easy tasks and a set of hard ones measure different things**
- How long the benchmark takes to run
- Whether the tasks are verified
- The interval on the score

> Correct.

> **Why:** Moving the mix moves the score, with nothing about the solver changing — which is why two benchmarks with different mixes are not comparable.

#### Go and do it

The task set, its difficulty mix, and the interval on its score. Open **Look at the tasks** in the agent-bench-lab application.

**Where this came from**

- §swebench:3 The benchmark — The tasks, the repositories, and the criterion that decides whether a task is solved.
- §gaia:3 The questions — The three levels, and the design of the questions at each.

**The words this lesson uses**

- **A benchmark** — A set of tasks, and a rule that decides whether each was solved.
- **A task** — A starting state, a goal, and a way of telling whether the goal was reached.
- **The difficulty mix** — The proportion of the tasks that are easy, and the proportion that are hard.

### Lesson 2. The score and its uncertainty

*What a number on a task set means*

*Estimated study time:* 26 minutes

**What you will learn**

- Explain why a score on a task set is an estimate rather than a fact
- Compute the interval on a score, and say why the usual one is wrong near zero
- Compute how many tasks a given difference needs

**The ideas**

- The tasks are a sample, and the score estimates the rate on the population.
- The interval on a proportion is not symmetric, and near zero the normal approximation is nonsense.
- A difference between two systems has to be bigger than the noise before it means anything.

#### Practice

**Q. A solver solves 12 of 200 tasks. Using the Wilson interval, is the score of 6% more likely to be near 6% or near 0%? — numeric *(hard)***

> **Answer:** 0

> **Why:** The answer is zero for the normal approximation being useless: with twelve successes the interval is asymmetric, and the normal approximation would give a lower bound below zero. The Wilson interval keeps it inside the unit interval.

#### Go and do it

The interval on a score, and the number of tasks a difference needs. Open **Size the uncertainty** in the agent-bench-lab application.

**Where this came from**

- §swebench:5 Discussion — The variance, and what a score on a task set means.

**The words this lesson uses**

- **The interval on a score** — The range the true rate plausibly lies in.
- **The task set is a sample** — The tasks are drawn from a population of tasks, and the score estimates the rate on it.
- **Power** — The chance of noticing a difference that is really there.

*Read first:* What a task is

## 2. Verification

*The criterion that decides the task*

The two conditions a solution must satisfy, the failure mode a criterion has to catch, and what a verifier costs.

**Learning outcomes**

- State the two conditions and say what each is for
- Describe the failure a verifier has to catch, and how it is caught
- Explain why a verifier is the part of the benchmark that is hardest to get right

### Lesson 3. The evaluation criterion

*The two conditions*

*Estimated study time:* 26 minutes

**What you will learn**

- State the two conditions a solution must satisfy
- Say what each condition is for, and what fails without it
- Explain why the criterion is the hardest part of a benchmark to get right

**The ideas**

- The failing test must start failing and end passing, and the passing tests must keep passing.
- The first condition alone is satisfied by a solver that changes the test.
- The second condition is what makes the first one mean something.

#### Practice

**Q. What are the two conditions a solution must satisfy? — multiple-choice *(core)***

- ✓ **The failing test must start failing and end passing, and the passing tests must keep passing**
- The failing test must pass, and the patch must be small
- The tests must pass, and the agent must have finished
- The failing test must pass, and no test file may be changed

> Correct.

> **Why:** The first condition makes it a task; the second is what makes the first condition mean something.

**Q. A patch that changes the failing test satisfies the first condition and nothing else. — boolean *(core)***

> **Answer:** True

> **Why:** Yes. The failing test now passes, so the transition holds — and the task is no harder than it was, which is why the second condition and the distrust of patches that touch tests are both needed.

#### Go and do it

The four kinds of patch, and the verdict each one gets. Open **Check the criterion** in the agent-bench-lab application.

**Where this came from**

- §swebench:3.1 The evaluation criterion — The two conditions: the failing test must pass, and the passing tests must keep passing.

**The words this lesson uses**

- **The verifier** — The thing that decides whether a task was solved.
- **The failing test must start failing and end passing** — The first of the two conditions.
- **The passing tests must keep passing** — The second of the two conditions.

*Read first:* What a task is

### Lesson 4. The cheat

*What a criterion has to catch*

*Estimated study time:* 22 minutes

**What you will learn**

- Describe the failure mode a solver that changes the test exploits
- Explain how the criterion catches it
- Say what a score means when the criterion is weak

**The ideas**

- A solver that can change the test does not have to solve the task.
- The criterion catches it by requiring the other tests to keep passing, and by distrusting a patch that touches a test.
- A benchmark whose criterion is weak measures something else, and does not say what.

#### Practice

**Q. What does a benchmark with a weak verifier measure? — multiple-choice *(hard)***

- ✓ **The solver’s ability to satisfy the verifier, which may not be the ability the benchmark claims to measure**
- Nothing at all
- The verifier’s quality
- The task set

> Correct.

> **Why:** Gaming is not a moral failure: it is the correct response to a reward that is not the thing you wanted.

#### Go and do it

A solver that changes the test, and the score it would have got. Open **Watch the cheat** in the agent-bench-lab application.

**Where this came from**

- §swebench:3.1 The evaluation criterion — The criterion, and the failure it has to catch.

**The words this lesson uses**

- **The verifier** — The thing that decides whether a task was solved.
- **Gaming the benchmark** — Solving the verifier rather than the task.

*Read first:* The evaluation criterion

## 3. The Baselines

*What a score has to beat*

The agentless baseline, the agent that tries several times, and the arithmetic of what the second one costs.

**Learning outcomes**

- Describe the agentless baseline and why it is the number to beat
- Compare an agent with the baseline on the same tasks
- Measure the cost of the agent in attempts, and say what it buys

### Lesson 5. The agentless baseline

*What a score has to beat*

*Estimated study time:* 24 minutes

**What you will learn**

- Describe the agentless baseline and what it does
- Explain why it is the number every agent has to beat
- Compare it with an agent on the same tasks

**The ideas**

- The baseline retrieves the relevant file and makes one obvious change.
- Most of what an agent adds is the ability to try again, and that has a price.
- The comparison has to be on the same tasks, with the same verifier.

#### Practice

**Q. Why is the agentless baseline the number to beat? — multiple-choice *(core)***

- ✓ **Because it is cheap, and an agent that cannot beat a cheap baseline is not earning its cost**
- Because it is stronger
- Because it is the state of the art
- Because it does not use a model

> Correct.

> **Why:** It does the obvious thing once. An agent that adds a loop and a search has to beat that with the loop’s cost.

#### Go and do it

The agentless baseline, its score, and the interval on it. Open **Run the baseline** in the agent-bench-lab application.

**Where this came from**

- §swebench:4 The results — The agentless baseline, and the argument that the agent is not the bottleneck.

**The words this lesson uses**

- **The agentless baseline** — Retrieve the file, make the obvious change, and stop.
- **A solver** — The thing that attempts the tasks.

*Read first:* The evaluation criterion

### Lesson 6. The price of trying again

*What the agent spends*

*Estimated study time:* 22 minutes

**What you will learn**

- Measure the number of attempts an agent makes
- Compare the agent with the baseline on the same tasks
- Say what the extra attempts buy and what they cost

**The ideas**

- An agent that tries several times solves more tasks and makes more attempts.
- The attempts are the cost, and they are paid in model calls.
- So the comparison is not between the two scores but between the two scores per attempt.

#### Practice

**Q. What does an agent spend that the baseline does not? — multiple-choice *(core)***

- ✓ **Attempts, which are model calls**
- Nothing
- Only the score
- The verifier

> Correct.

> **Why:** So the comparison is not between the two scores but between the two scores per attempt.

#### Go and do it

The agent, the attempts it makes, and the tasks it solves. Open **Run the agent** in the agent-bench-lab application.

**Where this came from**

- §swebench:4 The results — The comparison of the agent with the baseline.

**The words this lesson uses**

- **A solver** — The thing that attempts the tasks.
- **pass@k** — The chance that at least one of k attempts succeeds.

*Read first:* The agentless baseline

## 4. Variance and Contamination

*The two ways a benchmark lies to you*

The variance of a score, the difference between one run and many, and the overlap test that finds a task the model has already seen.

**Learning outcomes**

- Compute the variance of a score, and the interval that goes with it
- Explain the unbiased estimate of pass@k, and why a single run overstates it
- Measure contamination with an n-gram overlap, and say what the length of the n-gram decides

### Lesson 7. One run or many

*The variance, and the pass@k estimator*

*Estimated study time:* 26 minutes

**What you will learn**

- Compute the variance of a score across runs
- Explain why a single run overstates pass@k, and what the unbiased estimate is
- Say how many samples a comparison needs

**The ideas**

- A solver is stochastic, so one run is one sample of a distribution.
- The naive estimate of pass@k is biased upwards, and the correction is what makes two sample budgets comparable.
- The paired comparison is more sensitive than comparing two independent scores.

#### Practice

**Q. A single run of a stochastic solver is one sample of a distribution, not a measurement of it. — boolean *(core)***

> **Answer:** True

> **Why:** Yes. The spread across runs is the noise in every comparison made from single runs, and it is what a reported score leaves out.

**Q. Why is the naive estimate of pass@k biased upwards? — multiple-choice *(hard)***

- ✓ **Because the samples that succeeded are more likely to be the ones counted, so the estimate overstates the chance of at least one success**
- Because the tasks are hard
- Because k is usually too small
- It is not biased

> Correct.

> **Why:** The unbiased estimator corrects for it, and the correction is what makes two different sample budgets comparable.

#### Go and do it

The score across repeated runs, and the interval it implies. Open **Measure the variance** in the agent-bench-lab application.

**Where this came from**

- §swebench:5 Discussion — The variance of a score across runs.
- §agentbench:3 The environments — The eight environments, and what each one measures.

**The words this lesson uses**

- **The variance of a score** — How much the score moves when the solver is run again.
- **pass@k** — The chance that at least one of k attempts succeeds.
- **A paired comparison** — Comparing two systems on the same tasks.

*Read first:* The score and its uncertainty

### Lesson 8. Has the model seen it?

*Contamination, and the overlap that finds it*

*Estimated study time:* 26 minutes

**What you will learn**

- Describe what benchmark contamination is and why it invalidates a score
- Measure it with an n-gram overlap, and report the two rates it gives
- Say what the length of the n-gram decides, and what the threshold decides

**The ideas**

- A task the model has already seen is not a measurement of anything.
- The detection is an overlap test, and it has two failure modes: too short a match catches ordinary text, too long a match misses an edited copy.
- So the length and the threshold are decisions, and the rates they give are the report.

#### Practice

**Q. What does contamination do to a benchmark? — multiple-choice *(core)***

- ✓ **It flatters the systems that were trained on the leaked data, and makes the score meaningless for them**
- It lowers every score equally
- It makes the benchmark harder
- Nothing, if the tasks are verified

> Correct.

> **Why:** A task the model has already seen measures the training data rather than the solver, and the error is not evenly spread over the systems.

**Q. What does the length of the n-gram decide in the overlap test? — multiple-choice *(hard)***

- ✓ **Whether an edited copy is caught: a short n-gram survives the edit, a long one does not**
- How fast the test runs
- Whether the tasks are contaminated
- The score

> Correct.

> **Why:** And a short n-gram also catches ordinary text, so the length trades a false-positive rate against a true-positive rate — which is why both are reported.

#### Go and do it

The overlap of every task’s solution with a training corpus, and the rates the test gives. Open **Look for the leak** in the agent-bench-lab application.

**Where this came from**

- §swebench:5 Discussion — The contamination, and what it does to a score.
- §webarena:4 Evaluation — The evaluation functions, and the difference between them and a string match.

**The words this lesson uses**

- **Contamination** — The model has already seen the task, or its answer.
- **The overlap test** — Comparing a task’s solution with the training corpus, n-grams at a time.

*Read first:* One run or many

## Appendix A — Glossary

**A benchmark** — A set of tasks, and a rule that decides whether each was solved.

A benchmark is two things: the tasks and the verdict. Everything else — the score, the interval on it, the comparison between two systems — follows from those, and a benchmark with a weak verdict measures something other than what it claims.

**A task** — A starting state, a goal, and a way of telling whether the goal was reached.

A task gives the solver an environment and an instruction, and it ends with a verdict. The verdict is the part that has to be objective: a human reading the output is a different kind of benchmark, and a noisier one.

**The difficulty mix** — The proportion of the tasks that are easy, and the proportion that are hard.

The mix decides what a score means. A set of easy tasks measures whether the solver can do the easy thing, and a set of hard ones measures whether it can do the hard thing. Moving the mix moves the score, without anything about the solver changing.

**The task set is a sample** — The tasks are drawn from a population of tasks, and the score estimates the rate on it.

This is the reason a score needs an interval. The hundred tasks in the benchmark are a sample of the tasks that could have been in it, and the score is an estimate of the rate on all of them.

**The interval on a score** — The range the true rate plausibly lies in.

For a proportion, the interval is not symmetric and the usual normal approximation is wrong near zero and near one — which is exactly where a benchmark’s score often is.

**Power** — The chance of noticing a difference that is really there.

A benchmark with too few tasks has little power: a real difference of two points is invisible. The number of tasks a comparison needs follows from the size of the difference and from the noise, and both are computable.

**The verifier** — The thing that decides whether a task was solved.

The verifier is the part of the benchmark that is hardest to get right, because it is the part a solver is trying to fool. A benchmark with a weak verifier measures the solver’s ability to fool it.

**The failing test must start failing and end passing** — The first of the two conditions.

A task comes with a test that fails before the fix and passes after it. Requiring that transition is what makes the task a task — and it is also the condition a solver can satisfy by changing the test.

**The passing tests must keep passing** — The second of the two conditions.

A solution that fixes the task by breaking something else is not a solution. This condition is what makes the first one mean something, and it is what a cheat usually violates.

**Gaming the benchmark** — Solving the verifier rather than the task.

A benchmark measures what its verifier measures. A solver that finds the difference between the two is not cheating in a moral sense; it is optimising the objective, which is what a reward is for.

**A solver** — The thing that attempts the tasks.

A solver may be a program, a model, or a loop around a model. What the benchmark measures is the pair of the solver and the verifier, and a score quoted without the verifier is a quote without a meaning.

**The agentless baseline** — Retrieve the file, make the obvious change, and stop.

One attempt per task, with no loop and no search. It is the number every agent has to beat, and a surprising number of agents do not.

**pass@k** — The chance that at least one of k attempts succeeds.

It is the natural metric for a solver that may be tried several times. The estimate from k samples is biased upwards, and the unbiased correction is what makes two different sample budgets comparable.

**The variance of a score** — How much the score moves when the solver is run again.

A solver is stochastic, so one run is one sample. The spread across runs is the noise in the comparison, and it is what a single-run score leaves out.

**A paired comparison** — Comparing two systems on the same tasks.

The same tasks remove the task-difficulty variation from the comparison, and with it most of the noise. It is more sensitive than comparing two independent scores, and it is the comparison a benchmark should report.

**Contamination** — The model has already seen the task, or its answer.

A task whose solution is in the training data is not a measurement of the solver; it is a measurement of the training data. And the score of the benchmark goes up, which is the problem: the contamination flatters the system it is supposed to be testing.

**The overlap test** — Comparing a task’s solution with the training corpus, n-grams at a time.

A passage that shares a long run of n-grams with the corpus is probably in it. The length of the n-gram is a decision: short n-grams catch ordinary text as well as copies, and long ones miss a copy that was lightly edited.

## Appendix B — The laboratories

Every laboratory the course ships. Each one runs in the application and computes everything it shows in the browser; this appendix is the catalogue of what exists and what it is for.

### A · The task set

*What a score on a task set means, how large a task is, and what GAIA’s levels ask for.*

**Delivers:**

- Resolution rate as a function of file size
- The three question levels
- Question difficulty versus tool count

### B · The verifier

*The criterion and the cheat, and what each half of the harness decides.*

**Delivers:**

- The test-based verification harness

### C · The baselines

*What a score has to beat, what the beating costs, and whether it repeats.*

**Delivers:**

- The agentless baseline
- Pass^k: reliability across repeated trials rather than a single pass rate

### D · Contamination

*Whether the model has seen it.*

### E · The environments

*Eight worlds, one average, and whether the world can be replayed.*

**Delivers:**

- Cross-environment score profiles
- Why a single average hides the failure modes
- Reproducibility as a benchmark property

## Appendix C — Sources

- **SWE-bench: Can Language Models Resolve Real-World GitHub Issues?** — Carlos E. Jimenez, John Yang, Alexander Wettig, Shunyu Yao, Kexin Pei, Ofir Press, Karthik Narasimhan (2023), arXiv:2310.06770 [cs.SE] / ICLR 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The agentic course has a case study but no benchmark-design lesson, and benchmark design is where most agent claims are won or lost.
- **GAIA: a benchmark for General AI Assistants** — Grégoire Mialon, Clémentine Fourrier, Craig Swift, Thomas Wolf, Yann LeCun, Thomas Scialom (2023), arXiv:2311.12983 [cs.AI] / ICLR 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  A benchmark designed around the question: can a general assistant do the easy part of a task and the hard part with the right tools?
- **AgentBench: Evaluating LLMs as Agents** — Xiao Liu, Hao Yu, Hanchen Zhang, Yifan Xu, Xuanyu Lei, Hanyu Lai, Yu Gu, Hangliang Ding, Kaiwen Men, Kejuan Yang, Shudan Zhang, Xiang Deng, Aohan Zeng, Zhengxiao Du, Chenhui Zhang, Sheng Shen, Tianjun Zhang, Yu Su, Huan Sun, Minlie Huang, Yuxiao Dong, Jie Tang (2023), arXiv:2308.03688 [cs.AI] / ICLR 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Eight environments, and the finding that a score is only meaningful relative to a matched model size.
- **WebArena: A Realistic Web Environment for Building Autonomous Agents** — Shuyan Zhou, Frank F. Xu, Hao Zhu, Xuhui Zhou, Robert Lo, Abishek Sridhar, Xianyi Cheng, Tianyue Ou, Yonatan Bisk, Daniel Fried, Uri Alon, Graham Neubig (2023), arXiv:2307.13854 [cs.AI] / ICLR 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Self-hosted reproducible environments, which is what makes an agent benchmark trustworthy.
- **$\tau$-bench: A Benchmark for Tool-Agent-User Interaction in Real-World Domains** — Shunyu Yao, Noah Shinn, Pedram Razavi, Karthik Narasimhan (2024), arXiv:2406.12045 [cs.CL] / ICLR 2025. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  A user simulator in the loop, which changes what the benchmark is actually measuring.
