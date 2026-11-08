# Evaluation Lab


**Source:** Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena — Lianmin Zheng, Wei-Lin Chiang, Ying Sheng, Siyuan Zhuang, Zhanghao Wu, Yonghao Zhuang, Zi Lin, Zhuohan Li, Dacheng Li, Eric P. Xing, Hao Zhang, Joseph E. Gonzalez, Ion Stoica (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Evaluation appears as a single lesson in the foundations course. Judging a model with a model is now a primary evaluation method and its biases are measurable.

**Source:** Holistic Evaluation of Language Models — Percy Liang, Rishi Bommasani, Tony Lee, Dimitris Tsipras, Dilara Soylu, Michihiro Yasunaga, Yian Zhang, Deepak Narayanan, Yuhuai Wu, Ananya Kumar, Benjamin Newman, Binhang Yuan, Bobby Yan, Ce Zhang, Christian Cosgrove, Christopher D. Manning, Christopher Ré, Diana Acosta-Navas, Drew A. Hudson, Eric Zelikman, Esin Durmus, Faisal Ladhak, Frieda Rong, Hongyu Ren, Huaxiu Yao, Jue Wang, Keshav Santhanam, Laurel Orr, Lucia Zheng, Mert Yuksekgonul, Mirac Suzgun, Nathan Kim, Neel Guha, Niladri Chatterji, Omar Khattab, Peter Henderson, Qian Huang, Ryan Chi, Sang Michael Xie, Shibani Santurkar, Surya Ganguli, Tatsunori Hashimoto, Thomas Icard, Tianyi Zhang, Vishrav Chaudhary, William Wang, Xuechen Li, Yifan Mai, Yuhui Zhang, Yuta Koreeda (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** A single score hides the trade-offs; the holistic framing is the counter-argument.

**Source:** Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference — Wei-Lin Chiang, Lianmin Zheng, Ying Sheng, Anastasios Nikolas Angelopoulos, Tianle Li, Dacheng Li, Hao Zhang, Banghua Zhu, Michael Jordan, Joseph E. Gonzalez, Ion Stoica (2024)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Where real human preference votes come from, and the confidence interval a leaderboard should print.

**Source:** The Leaderboard Illusion — Shivalika Singh, Yiyang Nan, Alex Wang, Daniel D'Souza, Sayash Kapoor, Ahmet Üstün, Sanmi Koyejo, Yuntian Deng, Shayne Longpre, Noah A. Smith, Beyza Ermis, Marzieh Fadaee, Sara Hooker (2025)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The newest and sharpest criticism of the evaluation ecosystem, and it is reproducible at small scale.

**Source:** Lessons from the Trenches on Reproducible Evaluation of Language Models — Stella Biderman, Hailey Schoelkopf, Lintang Sutawika, Leo Gao, Jonathan Tow, Baber Abbasi, Alham Fikri Aji, Pawan Sasanka Ammanamanchi, Sidney Black, Jordan Clive, Anthony DiPofi, Julen Etxaniz, Benjamin Fattori, Jessica Zosa Forde, Charles Foster, Jeffrey Hsu, Mimansa Jaiswal, Wilson Y. Lee, Haonan Li, Charles Lovering, Niklas Muennighoff, Ellie Pavlick, Jason Phang, Aviya Skowron, Samson Tan, Xiangru Tang, Kevin A. Wang, Genta Indra Winata, François Yvon, Andy Zou (2024)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The practical failure modes of evaluation harnesses: seeds, decoders, prompts, chat templates.

---

## Contents

- [1. Judging with a Model](#1-judging-with-a-model)
  - [Lesson 1. What a judge is asked to do](#lesson-1-what-a-judge-is-asked-to-do)
  - [Lesson 2. Agreement and consistency](#lesson-2-agreement-and-consistency)
- [2. The Biases of a Judge](#2-the-biases-of-a-judge)
  - [Lesson 3. Position bias](#lesson-3-position-bias)
  - [Lesson 4. Verbosity and self-enhancement](#lesson-4-verbosity-and-self-enhancement)
- [3. Human Agreement](#3-human-agreement)
  - [Lesson 5. What an agreement rate means](#lesson-5-what-an-agreement-rate-means)
- [4. Arena Rankings](#4-arena-rankings)
  - [Lesson 6. From votes to a ranking](#lesson-6-from-votes-to-a-ranking)
  - [Lesson 7. The interval and the cost](#lesson-7-the-interval-and-the-cost)
- [5. Benchmark Design](#5-benchmark-design)
  - [Lesson 8. Contamination](#lesson-8-contamination)
  - [Lesson 9. What a benchmark is for](#lesson-9-what-a-benchmark-is-for)
- [6. Measurement](#6-measurement)
  - [Lesson 10. The standard error](#lesson-10-the-standard-error)
  - [Lesson 11. How many questions](#lesson-11-how-many-questions)
  - [Lesson 12. What to publish](#lesson-12-what-to-publish)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — The laboratories](#appendix-b-the-laboratories)
- [Appendix C — Sources](#appendix-c-sources)

## 1. Judging with a Model

*A strong model asked to pick the better of two answers*

The central idea of model-based evaluation: instead of writing a reference answer, show a judge model two candidate answers and ask which is better. This module sets out the method, the measurement of how often it agrees with a human, and the consistency check that most people do not run.

**Learning outcomes**

- State what an LLM-as-a-judge is asked to do, and what it is not asked to do
- Measure agreement with a human and explain what the number means
- Measure consistency under a permutation, and say why it is the harder test
- Explain why the agreement number is a property of the question set as well as of the judge

### Lesson 1. What a judge is asked to do

*Two answers, one question, one preference*

*Estimated study time:* 20 minutes

**What you will learn**

- State the task the judge is given and the shape of its output
- Explain why pairwise comparison is easier for a model than scoring
- Say what the judge is not being asked to do

**The ideas**

- The judge sees two answers to the same question and names the better one.
- Pairwise comparison avoids writing a reference answer, which is where most benchmarks go wrong.
- The judge is a model, so its preferences are the model’s preferences.

#### Practice

**Q. What is an LLM-as-a-judge asked to do? — multiple-choice *(warmup)***

- Score an answer against a reference answer
- ✓ **Choose between two candidate answers**
- Rewrite the answer to improve it
- Check the answer against the ground truth

> Correct.

> **Why:** The judge sees a question and two answers and names the better one. The advantage over scoring against a reference is that no single phrasing has to be declared correct.

**Q. The judge’s preferences are the judge model’s preferences. — boolean *(core)***

> **Answer:** True

> **Why:** Yes. A judge is a model, and whatever it has come to prefer — position, length, its own family’s style — comes through into every judgement it makes.

#### Go and do it

Measure how often a judge agrees with the human, and how often it agrees with itself. Open **The judge against the human** in the evaluation-lab application.

**Where this came from**

- §2 MT-Bench and the judge · p. 4 — The judging prompt, the pairwise format, and the agreement measurement against human preference.
- §1 Introduction · p. 1 — The claim that a strong model can substitute for human annotation, and the cost of that substitution.

**The words this lesson uses**

- **LLM-as-a-judge** — Using a strong model to score or rank the outputs of other models.
- **Pairwise comparison** — Choosing between two answers rather than scoring one.
- **Judge** — The model that makes the comparison.
- **Agreement rate** — How often the judge’s choice matches the human’s.

### Lesson 2. Agreement and consistency

*Two different numbers, and the second one is the harder test*

*Estimated study time:* 22 minutes

**What you will learn**

- Define agreement with a human and consistency under a permutation
- Explain what a consistency failure tells you that a low agreement does not
- Design the swap test

**The ideas**

- Agreement is measured against a human; consistency is measured against the judge itself.
- Swapping the two answers must not change the preference — and if it does, the judge is answering a different question.
- A judge can be consistent and still be systematically wrong.

#### Practice

**Q. What does the position-swap test measure? — multiple-choice *(core)***

- How often the judge agrees with a human
- ✓ **How often the judge gives the same answer when the order is changed**
- How good the judge is at explaining itself
- How expensive the judge is to run

> Correct.

> **Why:** Consistency is measured against the judge itself: the same pair, presented in both orders, should produce the same preference. A failure to do so means the judge answered a different question.

**Q. What does a consistency failure tell you that a low agreement with humans does not? — multiple-choice *(core)***

- That the judge is weak compared with humans
- ✓ **That the judge is not even a function of the answers — its verdict flips when the order is swapped**
- That the question set is too small
- That humans disagree with each other

> Correct — the swap test measures the judge against itself.

> **Why:** Agreement is measured against a human; consistency is measured against the judge itself — the swap test reorders the two answers and asks again. A consistency failure means the verdicts are not a function of the answers alone, which no amount of agreement can repair.

#### Go and do it

Judge the same pair twice, with the positions swapped, and count the flips. Open **The swap test** in the evaluation-lab application.

**Where this came from**

- §2 MT-Bench and the judge · p. 5 — The position-swap experiment and the consistency figures reported alongside the agreement rate.

**The words this lesson uses**

- **Consistency** — How often the judge gives the same answer when the order is changed.
- **Position bias** — A preference for the answer presented first.

*Read first:* What a judge is asked to do

## 2. The Biases of a Judge

*Position, verbosity, and liking your own answers*

A judge is a model, and models have preferences that have nothing to do with quality. This module takes the three biases the primary source measures, isolates each one, and measures it rather than describing it.

**Learning outcomes**

- Define position bias, verbosity bias and self-enhancement bias
- Design an experiment that isolates one bias
- Read a consistency number and connect it to position bias
- Say which of the three biases a pairwise protocol can fix for free

### Lesson 3. Position bias

*The answer in front of it*

*Estimated study time:* 20 minutes

**What you will learn**

- Define position bias and describe the swap test that detects it
- Compute the rate at which a judge prefers the first position
- Explain why a pairwise protocol can fix position bias for free

**The ideas**

- A judge asked the same question twice, with the answers swapped, should answer differently.
- A fair protocol presents each pair in both orders and takes the majority.
- The cost is double the votes, which is why arenas that skip it look cheap.

#### Practice

**Q. How is position bias usually fixed? — multiple-choice *(core)***

- ✓ **By presenting each pair in both orders and taking the majority**
- By making the judge stronger
- By using a longer prompt
- By scoring against a reference answer instead

> Correct, at the cost of double the votes.

> **Why:** Presenting both orders and taking the majority cancels a first-position preference exactly, because the bias then favours each answer equally often. It doubles the cost, which is why it is often skipped.

**Q. A judge prefers the first position in 62% of 1000 comparisons where the two answers are equally good. What is the excess preference, in percentage points? — numeric *(hard)***

> **Answer:** 12 percentage points

> **Why:** Exactly 12 percentage points above the 50% that a fair judge would show. That excess is the position bias, and it is what the swap test is for.

#### Go and do it

Count how often the judge prefers the answer in the first position. Open **Measure the position preference** in the evaluation-lab application.

**Where this came from**

- §4 Limitations · p. 9 — The position bias measurement and the mitigation the paper proposes.

**The words this lesson uses**

- **Position bias** — A preference for the answer presented first.
- **Consistency** — How often the judge gives the same answer when the order is changed.

*Read first:* Agreement and consistency

### Lesson 4. Verbosity and self-enhancement

*Longer answers, and answers like mine*

*Estimated study time:* 22 minutes

**What you will learn**

- Define verbosity bias and self-enhancement bias
- Isolate each bias in an experiment
- Say which of the two a protocol can fix and which it cannot

**The ideas**

- A judge prefers the longer answer even when the shorter one is better.
- A judge prefers answers from models similar to itself.
- Neither bias is fixed by swapping positions; both have to be measured.

#### Practice

**Q. Which of these does the position-swap protocol NOT fix? — multiple-choice *(hard)***

- Position bias
- ✓ **Verbosity bias**
- The order effect on the wording
- A first-answer recency effect

> Correct — swapping positions does nothing about a preference for length.

> **Why:** The swap cancels anything that depends on *position*. A preference for longer answers does not depend on position, so it survives the swap intact and has to be measured separately.

**Q. Making the judge model stronger removes its verbosity bias. — boolean *(hard)***

> **Answer:** False

> **Why:** No. The primary source reports that a stronger judge does not remove the bias. Scaling the judge does not scale away its preferences.

#### Go and do it

Hold the quality fixed, vary the length, and count the preference. Open **Isolate the verbosity bias** in the evaluation-lab application.

**Where this came from**

- §4 Limitations · p. 9 — The verbosity bias and the self-enhancement bias, and the finding that a stronger judge does not remove them.

**The words this lesson uses**

- **Verbosity bias** — A preference for the longer answer.
- **Self-enhancement bias** — A preference for answers like the judge’s own.

*Read first:* Position bias

## 3. Human Agreement

*What the agreement number actually tells you*

An agreement rate of 80% sounds good and is often quoted without context. This module treats the number as what it is — a measurement with a denominator, a question set and a protocol — and asks what happens when the denominator changes.

**Learning outcomes**

- Compute an agreement rate and identify its denominator
- Explain why agreement and consistency are different numbers
- Predict how a harder question set changes the agreement rate
- Argue for reporting the judge against a human baseline rather than against 100%

### Lesson 5. What an agreement rate means

*The denominator is doing most of the work*

*Estimated study time:* 20 minutes

**What you will learn**

- Compute an agreement rate and state its denominator
- Explain why the same judge can score 65% or 85% on two question sets
- Argue for a human baseline

**The ideas**

- An agreement rate is a measurement with a denominator, and the denominator is a design decision.
- On a question set where the answers are close, the judge will disagree with the human a lot — correctly.
- The number to compare against is the agreement of two humans, not 100%.

#### Practice

**Q. Why does an agreement rate fall when the question set gets harder? — multiple-choice *(core)***

- The judge becomes less accurate
- ✓ **The answers get closer, so both the judge and the human are near a coin flip**
- Harder questions are longer, which activates the verbosity bias
- Human annotators get tired

> Correct.

> **Why:** When the two answers are close in quality, the true preference is genuinely ambiguous, so a correct judge will often differ from a correct human. A low agreement on a hard set can mean the judge is right.

**Q. What is the right number to compare a judge’s agreement rate against? — multiple-choice *(core)***

- 100%
- ✓ **The agreement of two humans on the same question set**
- 50%
- The judge’s score on a different benchmark

> Correct.

> **Why:** The inter-annotator agreement is the ceiling. A judge at 80% where humans agree with each other 85% is close to the best available measurement, not three-quarters of the way to perfect.

#### Go and do it

See how the agreement rate falls as the questions get harder. Open **Agreement against difficulty** in the evaluation-lab application.

**Where this came from**

- §2 MT-Bench and the judge · p. 6 — The agreement rate of 80.9% against human preference, and the comparison with the inter-annotator agreement.
- §1 Introduction · p. 2 — The claim that a judge can reach agreement with experts, and the conditions under which it holds.

**The words this lesson uses**

- **Agreement rate** — How often the judge’s choice matches the human’s.
- **Human baseline** — How often two humans agree with each other.

*Read first:* What a judge is asked to do

## 4. Arena Rankings

*Turning pairwise votes into a leaderboard*

An arena collects votes and produces a ranking. This module covers the Bradley–Terry model that Chatbot Arena uses, the confidence interval that should accompany it, and the cost of a vote — which is what limits how precise a leaderboard can be.

**Learning outcomes**

- Fit a Bradley–Terry model to pairwise votes and read the strengths
- Compute a bootstrap confidence interval on a ranking
- Explain why an Elo rating is not a confidence interval
- Estimate how many votes it takes to separate two models

### Lesson 6. From votes to a ranking

*The Bradley–Terry model*

*Estimated study time:* 26 minutes

**What you will learn**

- Write the Bradley–Terry model and its likelihood
- Explain why the strengths are only identified up to a constant
- Read a fitted ranking and say what the strengths mean

**The ideas**

- Pr(i beats j) = σ(θ_i − θ_j): one number per model, one difference per comparison.
- The likelihood is a sum of logarithms, and it can be maximised directly.
- The model is fitted by maximum likelihood, not by an update rule.

#### Practice

**Q. In the Bradley–Terry model, what does the strength θ_i represent? — multiple-choice *(core)***

- The number of votes model i received
- ✓ **A number such that the chance of i beating j depends on θ_i − θ_j**
- The accuracy of model i on the benchmark
- The cost of one vote for model i

> Correct.

> **Why:** Pr(i beats j) = σ(θ_i − θ_j). The strength is not a count of votes; it is the parameter of the difference, and the model says a pair of votes for i and one for j is worth more than a tie.

**Q. In a Bradley–Terry model with strengths θ_A = 1 and θ_B = 0, what is the probability that A beats B? — numeric *(hard)***

> **Answer:** 0.7310586 ± 0.0001

> **Why:** σ(1 − 0) = 1/(1 + e⁻¹) ≈ 0.731. Note that it is not 0.5: a strength difference of one already gives a clear favourite.

#### Go and do it

Collect the votes and fit a Bradley–Terry model to them. Open **Fit a ranking to the votes** in the evaluation-lab application.

**Where this came from**

- §3 Chatbot Arena · p. 7 — The Bradley–Terry model behind the arena ranking, and the bootstrap confidence intervals reported with it.
- §3 Chatbot Arena · p. 8 — The cost of the votes, and the observation that the number of votes per model varies widely.

**The words this lesson uses**

- **Bradley–Terry model** — A model in which each item has a strength, and the chance of i beating j is a function of the difference.
- **Elo** — An online rating update for pairwise comparisons.
- **Arena** — A platform where users compare two models and vote.

*Read first:* What a judge is asked to do

### Lesson 7. The interval and the cost

*How precise is a leaderboard, and what does precision cost?*

*Estimated study time:* 22 minutes

**What you will learn**

- Compute a bootstrap interval on a fitted ranking
- Explain why an Elo rating is not an interval
- Estimate the number of votes needed to separate two models

**The ideas**

- Resampling the votes and refitting gives an interval on the ranking.
- Elo is an online update rule, so its result depends on the order the votes arrived in.
- Votes are not free, and the price of precision is the thing that limits a leaderboard.

#### Practice

**Q. Why is an Elo rating not a confidence interval? — multiple-choice *(hard)***

- Elo ratings are not computed from votes
- ✓ **Elo is an online update, so its result depends on the order the votes arrived in**
- Elo assumes the models are equally good to start
- Elo cannot handle draws

> Correct.

> **Why:** A bootstrap interval resamples the votes and refits, and it means the same thing whatever order they arrived in. An online rating carries the path with it.

**Q. Why is an Elo rating alone not an interval? — multiple-choice *(core)***

- Because Elo is only defined for chess
- ✓ **Because the rating is a point estimate from one fit — resampling the votes and refitting is what produces the interval**
- Because Elo cannot be computed from pairwise votes
- Because the interval would be too wide to publish

> Correct — the bootstrap is what turns the ranking into a measurement with width.

> **Why:** Resampling the votes and refitting gives an interval on the ranking — which is what separates two models whose ratings differ. And the number of votes needed to separate them grows with how close they are, which is the cost half of the lesson.

#### Go and do it

Watch the confidence interval on the top two models shrink as the votes accumulate. Open **How many votes to tell them apart** in the evaluation-lab application.

**Where this came from**

- §3 Chatbot Arena · p. 8 — The bootstrap procedure and the reported intervals on the arena ranking.
- §3 Chatbot Arena · p. 8 — The cost of the votes: how many are needed before the ranking stabilises.

**The words this lesson uses**

- **Bootstrap** — Resampling the data with replacement, many times, to get an interval.
- **Confidence interval** — A range that a measurement plausibly lies in.
- **Elo** — An online rating update for pairwise comparisons.

*Read first:* From votes to a ranking

## 5. Benchmark Design

*What you put in the question set decides what comes out*

A benchmark is a measurement instrument, and instruments have design decisions. This module covers contamination — what happens when the test set is in the training set — and the way contamination moves a ranking more than it moves a score.

**Learning outcomes**

- Compute the score inflation a contamination fraction produces
- Explain why differential contamination moves rankings more than scores
- Say what a benchmark author should do about it
- Distinguish contamination from saturation and from overfitting

### Lesson 8. Contamination

*When the test set is in the training set*

*Estimated study time:* 22 minutes

**What you will learn**

- Compute the score inflation a contamination fraction produces
- Explain why differential contamination moves rankings more than scores
- Distinguish contamination from saturation and from overfitting

**The ideas**

- A contaminated question is answered from memory rather than from capability.
- The score inflation is proportional to the contaminated fraction.
- When only some models are contaminated, the ranking moves more than any single score.

#### Practice

**Q. A benchmark has 200 questions and a model scores 60% on them. 10% of the questions are contaminated and on those the model scores 90% instead of 60%. What is the reported score? — numeric *(hard)***

> **Answer:** 63 percent

> **Why:** Exactly 63%. Twenty contaminated questions at 90% contribute 18 successes where 12 were expected, and 180 clean ones at 60% contribute 108: (18 + 108) / 200 = 0.63. The inflation is 3 percentage points.

**Q. Why can contamination move a ranking more than it moves any single score? — multiple-choice *(hard)***

- Because contamination inflates every model equally
- ✓ **Because contamination is usually differential: one model has seen the benchmark and the others have not**
- Because the error bars shrink under contamination
- Because rankings are computed from fewer votes

> Correct.

> **Why:** A common shift changes every model’s score by the same amount and leaves the order alone. A differential shift — one model contaminated, the others not — is precisely a change in the order.

#### Go and do it

Sweep the contaminated fraction and watch the reported score drift. Open **What contamination does to a score** in the evaluation-lab application.

**Where this came from**

- §6 Conclusion · p. 12 — The paper’s statement of what the method does not address, including the contamination question.

**Further reading**

- [The Leaderboard Illusion, arXiv:2504.20879](https://arxiv.org/abs/2504.20879) — The newest and sharpest criticism of the evaluation ecosystem.

**The words this lesson uses**

- **Contamination** — Test questions that appear in the training data.
- **Benchmark** — A fixed question set with a scoring procedure.
- **Saturation** — A benchmark every strong model solves.

### Lesson 9. What a benchmark is for

*Two things it has to do at once*

*Estimated study time:* 20 minutes

**What you will learn**

- State the two things a benchmark has to do at once
- Explain the tension between breadth and depth in a question set
- Say what the holistic framing adds to a single score

**The ideas**

- A benchmark has to be hard enough to separate models and easy enough to run.
- A single number hides the trade-offs; a set of numbers shows them.
- The question set is a claim about what matters, and it should be argued for.

#### Practice

**Q. Which of these are design decisions a benchmark author makes? — multi-select *(core)***

- ✓ **Which questions to ask**
- ✓ **How the answers are scored**
- What the score is called
- ✓ **Which models are evaluated**

> **Why:** The question set, the scoring procedure and the set of models under test are all choices. Each one is a claim about what matters, and each one can be argued for.

**Q. What two things does a benchmark have to do at once? — multiple-choice *(warmup)***

- Be cheap to run and easy to cite
- ✓ **Be hard enough to separate models and easy enough to run**
- Be fully automatic and fully adversarial
- Cover every capability and reject every bad model

> Correct — the tension between breadth and depth lives between them.

> **Why:** A benchmark has to be hard enough to separate models and easy enough to run. The question set lives in that tension: breadth buys coverage, depth buys discrimination, and the holistic framing is what a single score adds to the pair.

#### Go and do it

See how the difficulty mix of a question set changes what the score measures. Open **Build a question set** in the evaluation-lab application.

**Further reading**

- [HELM, arXiv:2211.09110](https://arxiv.org/abs/2211.09110) — The multi-metric, multi-scenario alternative to a single score.

**The words this lesson uses**

- **Benchmark** — A fixed question set with a scoring procedure.
- **Holistic evaluation** — Measuring many scenarios on many metrics instead of one number.

*Read first:* Contamination

## 6. Measurement

*The number on the leaderboard has an error bar*

A score from N questions is a proportion, and a proportion has a standard error. This module computes it, shows how the interval narrows, and asks how many questions you need to tell two models apart — a question that is usually not asked.

**Learning outcomes**

- Compute the standard error of a benchmark score
- Explain why the interval narrows as one over the square root of N
- Compute the number of questions needed to detect a given difference
- Argue for publishing an interval next to every score

### Lesson 10. The standard error

*The number that should be next to the score*

*Estimated study time:* 20 minutes

**What you will learn**

- Compute the standard error of a benchmark score
- Explain the one-over-the-square-root-of-N rule
- Argue for publishing the interval with the score

**The ideas**

- A score from N binary outcomes is a proportion, with variance p(1−p)/N.
- To halve the interval you need four times as many questions.
- A difference smaller than the interval is not a difference.

#### Practice

**Q. A model scores 50% on a benchmark of 400 questions. What is the standard error of that score? — numeric *(hard)***

> **Answer:** 0.0125 ± 0.0001

> **Why:** √(0.5 × 0.5 / 400) = √(0.000625) = 0.0125. The 95% interval is therefore roughly 50% ± 2.5 percentage points.

**Q. To halve the width of a confidence interval, how many times more questions are needed? — multiple-choice *(core)***

- Twice as many
- ✓ **Four times as many**
- Ten times as many
- Half as many

> Correct.

> **Why:** The width goes as 1/√N, so halving it needs N to grow by a factor of four. This is the arithmetic behind why large benchmarks are expensive.

#### Go and do it

Plot the width of the confidence interval against the number of questions. Open **How the interval narrows** in the evaluation-lab application.

**Where this came from**

- §5 Related work · p. 11 — Where the paper situates itself among the measurement-based approaches to evaluation.

**Further reading**

- [Lessons from the Trenches, arXiv:2405.14782](https://arxiv.org/abs/2405.14782) — The practical failure modes: seeds, decoders, chat templates, and how much each one moves a score.

**The words this lesson uses**

- **Standard error** — How much a measurement of this kind wobbles around its true value.
- **Confidence interval** — A range that a measurement plausibly lies in.

### Lesson 11. How many questions

*The question nobody asks before the benchmark is released*

*Estimated study time:* 22 minutes

**What you will learn**

- Compute the number of questions needed to detect a given difference
- Explain the power of a comparison
- Say what happens when the difference you care about is smaller than the noise

**The ideas**

- The number of questions needed grows as the square of the inverse of the difference.
- A benchmark that cannot detect the difference you care about is not measuring it.
- Halving the effect size quadruples the cost.

#### Practice

**Q. A benchmark with very low power will report real differences as ties. — boolean *(core)***

> **Answer:** True

> **Why:** Yes. If the test cannot detect the difference, the difference does not appear — and a leaderboard that reports a tie there is reporting an artefact of the question count.

**Q. The number of questions needed grows as the square of the inverse of the difference. If the difference you care about doubles, by what factor does the required question count fall? — numeric *(core)***

> **Answer:** 0.25 ± 0.001

> **Why:** The count scales as 1/difference², so doubling the difference divides the required count by four. And when the difference you care about is smaller than the noise, no affordable question count answers it — which is the finding, not a failure to produce one.

#### Go and do it

Compute how many questions a given difference needs, and watch the curve. Open **The cost of detecting a small difference** in the evaluation-lab application.

**The words this lesson uses**

- **Power** — The probability of detecting a real difference if there is one.
- **Standard error** — How much a measurement of this kind wobbles around its true value.

*Read first:* The standard error

### Lesson 12. What to publish

*The minimum a leaderboard should print*

*Estimated study time:* 18 minutes

**What you will learn**

- List what a leaderboard should print next to every score
- Explain why the question count belongs there
- Argue for reporting the judge against a human baseline

**The ideas**

- A score without an interval is a claim, not a measurement.
- A score without a question count cannot be compared with anything.
- A score without the protocol cannot be reproduced.

#### Practice

**Q. What should a leaderboard print next to every score? — multi-select *(hard)***

- ✓ **A confidence interval**
- ✓ **The number of questions used**
- ✓ **The provider of the model**
- The logo of the organisation that ran it

> **Why:** An interval, the question count, and enough about the protocol to reproduce it. The newest criticism of the field is that the last of these is often missing, and that the leaderboard has become the thing being optimised.

**Q. Which of these should a leaderboard print next to every score? — multi-select *(core)***

- ✓ **The interval on the score**
- ✓ **The number of questions the score was computed on**
- ✓ **The judge’s agreement with a human baseline**
- The judge’s own self-evaluation score

> **Why:** A score without an interval is a claim, not a measurement; the question count is where the width comes from; and the judge’s agreement with a human baseline is the number that says what the whole instrument is worth.

#### Go and do it

The same score, with and without its interval, and what a reader can conclude from each. Open **What the interval looks like** in the evaluation-lab application.

**The words this lesson uses**

- **Confidence interval** — A range that a measurement plausibly lies in.
- **Human baseline** — How often two humans agree with each other.

*Read first:* How many questions

## Appendix A — Glossary

**LLM-as-a-judge** — Using a strong model to score or rank the outputs of other models.

The method: give a strong model the question and one or more candidate answers, and ask it which is better. It replaces most of the human annotation a benchmark would otherwise need, and it inherits the judge’s own preferences along with its judgement.

*Zheng et al. (2023)*

**Judge** — The model that makes the comparison.

In this course the judge is a synthetic model with known, injected biases, because that is how a bias can be *measured* rather than merely suspected. The protocol is identical to the one used with a real judge.

*Course term*

**Pairwise comparison** — Choosing between two answers rather than scoring one.

The pairwise protocol is much easier for a model than open-ended scoring, because there is no scale to calibrate: the judge only has to express a preference between two things it can read side by side.

*Zheng et al. (2023)*

**Agreement rate** — How often the judge’s choice matches the human’s.

A proportion, and like every proportion it has a denominator that is a design decision. The same judge on the same answers can score 65% or 85% depending on how close the answers were.

*Example:* What does an 80% agreement rate mean? → That on the questions used, the judge and the human picked the same answer four times out of five — and it says nothing about the other fifteen percent, or about any other question set.

*Zheng et al. (2023)*

**Consistency** — How often the judge gives the same answer when the order is changed.

Consistency is measured by judging the same pair twice with the positions swapped and checking whether the same *answer* was preferred. A judge can be perfectly consistent and still systematically prefer the longer answer.

*Zheng et al. (2023)*

**Position bias** — A preference for the answer presented first.

The most cited of the judge’s biases. It is detected by the swap test, and it is fixed for free by presenting every pair in both orders and taking the majority — which doubles the cost of the evaluation.

*Zheng et al. (2023)*

**Verbosity bias** — A preference for the longer answer.

A judge that prefers length will prefer whichever model writes more, whatever the quality. It is not fixed by swapping positions, and it does not go away when the judge is made stronger.

*Zheng et al. (2023)*

**Self-enhancement bias** — A preference for answers like the judge’s own.

A judge tends to prefer the outputs of models in its own family. The effect is asymmetric: an own-family answer gets the benefit of the doubt and the other one does not.

*Zheng et al. (2023)*

**Human baseline** — How often two humans agree with each other.

The number a judge’s agreement rate should be compared against. Human annotators disagree with each other too, so 100% is the wrong target and a judge at 80% may be close to the ceiling.

*Course term*

**Arena** — A platform where users compare two models and vote.

An arena produces pairwise votes at scale, from real users, on prompts nobody wrote. The votes are then turned into a ranking. What the arena measures is what people prefer, which is not the same as what is correct.

*Chiang et al. (2024)*

**Bradley–Terry model** — A model in which each item has a strength, and the chance of i beating j is a function of the difference.

Pr(i beats j) = σ(θ_i − θ_j). One number per model, one difference per comparison. It is fitted by maximum likelihood, and its strengths are only identified up to an additive constant.

*Example:* Why must the strengths sum to zero? → Because adding a constant to every strength leaves every difference — and therefore every probability — unchanged. The offset is arbitrary.

*Chiang et al. (2024)*

**Elo** — An online rating update for pairwise comparisons.

Each comparison updates two ratings by an amount proportional to how far the result was from what the ratings predicted. Because it is an online rule, the final ratings depend on the order the votes arrived in, and Elo ratings are not confidence intervals.

*Chiang et al. (2024)*

**Bootstrap** — Resampling the data with replacement, many times, to get an interval.

Resample the votes, refit the model, and look at the spread of the answers. It makes no assumption about the distribution of the estimates, which is why it is the method the arena uses.

*Chiang et al. (2024)*

**Confidence interval** — A range that a measurement plausibly lies in.

For a benchmark score it is the score plus and minus about 1.96 standard errors. A leaderboard that prints a score without an interval is printing a point estimate as if it were a fact.

*Course term*

**Standard error** — How much a measurement of this kind wobbles around its true value.

A score from N binary outcomes with a true pass rate p has standard error √(p(1−p)/N). It falls as one over the square root of N, which is the single most useful fact about benchmark design.

*Example:* A score of 70% on 100 questions: what is the standard error? → √(0.7 × 0.3 / 100) ≈ 0.046, so roughly ±9% at 95%.

*Course term*

**Power** — The probability of detecting a real difference if there is one.

A benchmark with low power will miss real differences, and will report them as ties. Power rises with the number of questions and falls with the square of the effect size.

*Course term*

**Benchmark** — A fixed question set with a scoring procedure.

Two design decisions in one artefact: what to ask, and how to score the answer. Both are claims about what matters, and a benchmark that does not argue for them is not a measurement so much as a preference.

*Liang et al. (2023)*

**Contamination** — Test questions that appear in the training data.

A contaminated question is answered from memory rather than from capability. The score inflation is proportional to the contaminated fraction, and it is invisible unless you know that fraction.

*Course term*

**Saturation** — A benchmark every strong model solves.

Once the scores cluster at the ceiling, the benchmark stops separating models and the remaining differences become noise. Saturation is a design failure, not a success.

*Course term*

**Holistic evaluation** — Measuring many scenarios on many metrics instead of one number.

The alternative to a single leaderboard score. It is more informative and much more work, and the argument it makes is that the trade-offs between scenarios are the interesting part.

*Liang et al. (2023)*

**Leaderboard** — A published table of models and their scores.

A leaderboard is a measurement instrument that publishes its readings without its error bars. The newest criticism of the field is that the leaderboards themselves have become the thing being optimised.

*Singh et al. (2025)*

**Reference answer** — The gold standard an answer is scored against.

A benchmark that scores against a reference answer is measuring similarity to one particular phrasing. Pairwise comparison avoids that, at the cost of needing something to compare against.

*Course term*

**Reproducibility** — Whether the same code, seed and prompt give the same score.

A benchmark whose score moves when the decoding seed changes, or when the chat template changes, is not measuring the model. The trench-level detail is unglamorous and it is most of the problem.

*Reuel et al. (2024)*

**Difficulty** — How hard a question is, and therefore how close the answers are.

The single best predictor of a judge’s agreement rate. When the answers are close, the human and the judge are both near a coin flip, and the agreement rate falls.

*Course term*

**Question set** — The prompts a benchmark asks.

Its composition — how many are easy, how many are hard, which domains they cover — determines what the score means. A score is a statement about the question set at least as much as about the model.

*Course term*

**Model family** — A group of models trained in the same way, which look alike.

Judges are biased towards their own family, so a leaderboard that mixes families and a judge that only knows one of them will produce a ranking that reflects the judge’s taste.

*Course term*

**Inter-annotator agreement** — How much two people agree.

The ceiling for any automated evaluation of the same data. It is the honest target for a judge, and it is usually well below 100%, because the task is genuinely ambiguous.

*Course term*

**Permutation** — A reordering of the two answers in a pairwise comparison.

Presenting the same pair in both orders and checking whether the judge’s choice follows the answer or the position is the standard test for position bias, and the standard mitigation.

*Course term*

**Vote** — One pairwise comparison, cast by one voter.

The unit of an arena. Votes are not free — they cost the platform money per model queried — and that cost is what bounds how precise a leaderboard can be.

*Chiang et al. (2024)*

**Contamination fraction** — The proportion of a benchmark that appears in the training data.

The score inflation it produces is the fraction times the per-question inflation. Nobody knows this number, which is exactly why a contaminated score cannot be trusted.

*Course term*

## Appendix B — The laboratories

Every laboratory the course ships. Each one runs in the application and computes everything it shows in the browser; this appendix is the catalogue of what exists and what it is for.

### A · The judge and the human

*Agreement with a human, the swap test, and how the question set decides both.*

**Delivers:**

- Judge against human agreement
- Consistency under permutation

### B · The biases of a judge

*One bias at a time: position, verbosity, self-enhancement.*

**Delivers:**

- Position bias
- Verbosity bias
- Self-enhancement bias

### C · The arena

*Votes in, a Bradley–Terry ranking out, an interval on it, and a check on the question set.*

**Delivers:**

- Bradley–Terry from pairwise votes
- Bootstrap confidence intervals on rankings
- The cost of a good arena sample
- Rating bias from a fixed evaluation set

### D · Benchmark design

*Contamination, the difficulty mix, multi-metric surfaces, and selecting on a public set.*

**Delivers:**

- Multi-metric trade-off surfaces
- Standardisation and coverage
- Private testing versus public testing

### E · Measurement

*The error bar, the power, the cost, and the decoder that moves the score.*

**Delivers:**

- How much a decoding change moves a score

## Appendix C — Sources

- **Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena** — Lianmin Zheng, Wei-Lin Chiang, Ying Sheng, Siyuan Zhuang, Zhanghao Wu, Yonghao Zhuang, Zi Lin, Zhuohan Li, Dacheng Li, Eric P. Xing, Hao Zhang, Joseph E. Gonzalez, Ion Stoica (2023), arXiv:2306.05685 [cs.CL] / NeurIPS 2023 Datasets and Benchmarks. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Evaluation appears as a single lesson in the foundations course. Judging a model with a model is now a primary evaluation method and its biases are measurable.
- **Holistic Evaluation of Language Models** — Percy Liang, Rishi Bommasani, Tony Lee, Dimitris Tsipras, Dilara Soylu, Michihiro Yasunaga, Yian Zhang, Deepak Narayanan, Yuhuai Wu, Ananya Kumar, Benjamin Newman, Binhang Yuan, Bobby Yan, Ce Zhang, Christian Cosgrove, Christopher D. Manning, Christopher Ré, Diana Acosta-Navas, Drew A. Hudson, Eric Zelikman, Esin Durmus, Faisal Ladhak, Frieda Rong, Hongyu Ren, Huaxiu Yao, Jue Wang, Keshav Santhanam, Laurel Orr, Lucia Zheng, Mert Yuksekgonul, Mirac Suzgun, Nathan Kim, Neel Guha, Niladri Chatterji, Omar Khattab, Peter Henderson, Qian Huang, Ryan Chi, Sang Michael Xie, Shibani Santurkar, Surya Ganguli, Tatsunori Hashimoto, Thomas Icard, Tianyi Zhang, Vishrav Chaudhary, William Wang, Xuechen Li, Yifan Mai, Yuhui Zhang, Yuta Koreeda (2022), arXiv:2211.09110 [cs.CL] / TMLR 2023. The paper is known as HELM. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  A single score hides the trade-offs; the holistic framing is the counter-argument.
- **Chatbot Arena: An Open Platform for Evaluating LLMs by Human Preference** — Wei-Lin Chiang, Lianmin Zheng, Ying Sheng, Anastasios Nikolas Angelopoulos, Tianle Li, Dacheng Li, Hao Zhang, Banghua Zhu, Michael Jordan, Joseph E. Gonzalez, Ion Stoica (2024), arXiv:2403.04132 [cs.CL] / ICML 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Where real human preference votes come from, and the confidence interval a leaderboard should print.
- **The Leaderboard Illusion** — Shivalika Singh, Yiyang Nan, Alex Wang, Daniel D'Souza, Sayash Kapoor, Ahmet Üstün, Sanmi Koyejo, Yuntian Deng, Shayne Longpre, Noah A. Smith, Beyza Ermis, Marzieh Fadaee, Sara Hooker (2025), arXiv:2504.20879 [cs.LG]. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The newest and sharpest criticism of the evaluation ecosystem, and it is reproducible at small scale.
- **Lessons from the Trenches on Reproducible Evaluation of Language Models** — Stella Biderman, Hailey Schoelkopf, Lintang Sutawika, Leo Gao, Jonathan Tow, Baber Abbasi, Alham Fikri Aji, Pawan Sasanka Ammanamanchi, Sidney Black, Jordan Clive, Anthony DiPofi, Julen Etxaniz, Benjamin Fattori, Jessica Zosa Forde, Charles Foster, Jeffrey Hsu, Mimansa Jaiswal, Wilson Y. Lee, Haonan Li, Charles Lovering, Niklas Muennighoff, Ellie Pavlick, Jason Phang, Aviya Skowron, Samson Tan, Xiangru Tang, Kevin A. Wang, Genta Indra Winata, François Yvon, Andy Zou (2024), arXiv:2405.14782 [cs.LG]. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The practical failure modes of evaluation harnesses: seeds, decoders, prompts, chat templates.
