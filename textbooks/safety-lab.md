# Safety and Alignment Lab


**Source:** Constitutional AI: Harmlessness from AI Feedback — Yuntao Bai, Saurav Kadavath, Sandipan Kundu, Amanda Askell, Jackson Kernion, Andy Jones, Anna Chen, Anna Goldie, Azalia Mirhoseini, Cameron McKinnon, Carol Chen, Catherine Olsson, Christopher Olah, Danny Hernandez, Dawn Drain, Deep Ganguli, Dustin Li, Eli Tran-Johnson, Ethan Perez, Jamie Kerr, Jared Mueller, Jeffrey Ladish, Joshua Landau, Kamal Ndousse, Kamile Lukosuite, Liane Lovitt, Michael Sellitto, Nelson Elhage, Nicholas Schiefer, Noemi Mercado, Nova DasSarma, Robert Lasenby, Robin Larson, Sam Ringer, Scott Johnston, Shauna Kravec, Sheer El Showk, Stanislav Fort, Tamera Lanham, Timothy Telleen-Lawton, Tom Conerly, Tom Henighan, Tristan Hume, Samuel R. Bowman, Zac Hatfield-Dodds, Ben Mann, Dario Amodei, Nicholas Joseph, Sam McCandlish, Tom Brown, Jared Kaplan (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The alignment module in the foundations course is two lessons wide. This is the method the rest of the field cites when it says 'principled'.

**Source:** Training a Helpful and Harmless Assistant with Reinforcement Learning from Human Feedback — Yuntao Bai, Andy Jones, Kamal Ndousse, Amanda Askell, Anna Chen, Nova DasSarma, Dawn Drain, Stanislav Fort, Deep Ganguli, Tom Henighan, Nicholas Joseph, Saurav Kadavath, Jackson Kernion, Tom Conerly, Sheer El-Showk, Nelson Elhage, Zac Hatfield-Dodds, Danny Hernandez, Tristan Hume, Scott Johnston, Shauna Kravec, Liane Lovitt, Neel Nanda, Catherine Olsson, Dario Amodei, Tom Brown, Jack Clark, Sam McCandlish, Chris Olah, Ben Mann, Jared Kaplan (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The origin of the helpful and harmless preference data, and of the round-two iterated pipeline.

**Source:** Red Teaming Language Models with Language Models — Ethan Perez, Saffron Huang, Francis Song, Trevor Cai, Roman Ring, John Aslanides, Amelia Glaese, Nat McAleese, Geoffrey Irving (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Red teaming is a search problem, and the search is over prompts.

**Source:** Sleeper Agents: Training Deceptive LLMs that Persist Through Safety Training — Evan Hubinger, Carson Denison, Jesse Mu, Mike Lambert, Meg Tong, Monte MacDiarmid, Tamera Lanham, Daniel M. Ziegler, Tim Maxwell, Newton Cheng, Adam Jermyn, Amanda Askell, Ansh Radhakrishnan, Cem Anil, David Duvenaud, Deep Ganguli, Fazl Barez, Jack Clark, Kamal Ndousse, Kshitij Sachan, Michael Sellitto, Mrinank Sharma, Nova DasSarma, Roger Grosse, Shauna Kravec, Yuntao Bai, Zachary Witten, Marina Favaro, Jan Brauner, Holden Karnofsky, Paul Christiano, Samuel R. Bowman, Logan Graham, Jared Kaplan, Sören Mindermann, Ryan Greenblatt, Buck Shlegeris, Nicholas Schiefer, Ethan Perez (2024)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The clearest demonstration that alignment training can be undone by training, and that the harm is conditional.

**Source:** Towards Understanding Sycophancy in Language Models — Mrinank Sharma, Meg Tong, Tomasz Korbak, David Duvenaud, Amanda Askell, Samuel R. Bowman, Newton Cheng, Esin Durmus, Zac Hatfield-Dodds, Scott R. Johnston, Shauna Kravec, Timothy Maxwell, Sam McCandlish, Kamal Ndousse, Oliver Rausch, Nicholas Schiefer, Da Yan, Miranda Zhang, Ethan Perez (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** A measurable, mechanical version of flattery, driven by the training signal rather than by character.

**Source:** Extracting Training Data from Large Language Models — Nicholas Carlini, Florian Tramer, Eric Wallace, Matthew Jagielski, Ariel Herbert-Voss, Katherine Lee, Adam Roberts, Tom Brown, Dawn Song, Ulfar Erlingsson, Alina Oprea, Colin Raffel (2020)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Memorisation is the privacy story, and it is measurable with an attack rather than a survey.

---

## Contents

- [1. Harmlessness from AI Feedback](#1-harmlessness-from-ai-feedback)
  - [Lesson 1. The critique-and-revise loop](#lesson-1-the-critique-and-revise-loop)
  - [Lesson 2. The judge](#lesson-2-the-judge)
  - [Lesson 8. What a claim is worth](#lesson-8-what-a-claim-is-worth)
  - [Lesson 9. The two rounds](#lesson-9-the-two-rounds)
  - [Lesson 10. The critic that sees what it cannot](#lesson-10-the-critic-that-sees-what-it-cannot)
- [2. Red Teaming](#2-red-teaming)
  - [Lesson 3. The attack](#lesson-3-the-attack)
  - [Lesson 4. The taxonomy](#lesson-4-the-taxonomy)
  - [Lesson 11. The search budget](#lesson-11-the-search-budget)
- [3. Cued Behaviour](#3-cued-behaviour)
  - [Lesson 13. The cue nobody asked about](#lesson-13-the-cue-nobody-asked-about)
- [4. Sycophancy](#4-sycophancy)
  - [Lesson 5. Agreeing with the user](#lesson-5-agreeing-with-the-user)
  - [Lesson 6. The mitigation](#lesson-6-the-mitigation)
  - [Lesson 12. What consistency buys](#lesson-12-what-consistency-buys)
- [5. Privacy](#5-privacy)
  - [Lesson 7. Memorisation](#lesson-7-memorisation)
  - [Lesson 14. Who can tell](#lesson-14-who-can-tell)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — Sources](#appendix-b-sources)

## 1. Harmlessness from AI Feedback

*A model that critiques itself, against a written rule*

The critique-and-revise loop, the preference data it makes, and the judge that every harmlessness number depends on.

**Learning outcomes**

- Describe the critique-and-revise loop and what it produces
- Say what a harmlessness score means, and what it depends on
- Measure the agreement of a judge with the labels

### Lesson 1. The critique-and-revise loop

*A model, a principle, and a second pass*

*Estimated study time:* 26 minutes

**What you will learn**

- Describe the loop: a response, a critique against a principle, a revision
- Say what the loop produces and what it is used for
- Measure how much of the harm the loop removes

**The ideas**

- The critique names the principle that was violated, so the revision has something to work against.
- The loop makes a preference dataset; the dataset is what trains the model.
- A revision should remove the harm and keep the harmless part of the answer.

#### Practice

**Q. What does the critique in the critique-and-revise loop do? — multiple-choice *(core)***

- ✓ **It names the principle the response broke, so the revision has something to work against**
- - It rewrites the response
- - It scores the response
- - It decides whether the response is harmful

> Correct.

> **Why:** A revision cannot be written without something to revise against, so the critique has to name the principle.

**Q. The critique-and-revise loop produces a preference dataset, which is then used for training. — boolean *(core)***

> **Why:** Yes. The revisions become the preferred responses, and it is a dataset like any other — with whatever biases the critiquing model carried.

#### Go and do it

The critiques, the revisions, and the harm that is left. Open **Run the loop** in the safety-lab application.

**Where this came from**

- §cai:2 The supervised stage — The critiques and the revisions, and the dataset they make.

**The words this lesson uses**

- **The constitution** — A written list of principles a model is held to.
- **The critique** — A model pointing out that a response breaks a principle.
- **The preference data** — The pairs of responses, one preferred, that the training uses.

### Lesson 2. The judge

*Whose opinion the number is*

*Estimated study time:* 24 minutes

**What you will learn**

- Say what a harmlessness score is an estimate of
- Explain why the agreement with the labels is the number to report
- Describe the false positives and false negatives a judge makes

**The ideas**

- A harmlessness score is what a judge believes, and the judge is a model.
- The agreement with the human labels is what makes the number worth anything.
- A judge that flags the harmless cases costs you the data you were trying to collect.

#### Practice

**Q. What is the agreement between a judge and the human labels? — multiple-choice *(core)***

- ✓ **The part of a harmlessness score that makes it worth anything**
- - An optional extra
- - The accuracy of the model being tested
- - The size of the preference dataset

> Correct.

> **Why:** Every harmlessness number is what a judge believes, measured on a sample. The agreement is what makes that number mean anything.

#### Go and do it

The agreement of a judge with the labels, and the errors it makes. Open **Check the judge** in the safety-lab application.

**Where this came from**

- §hh:6 The evaluation — How a harmlessness score is produced, and what the judge is worth.

**The words this lesson uses**

- **The judge** — The model whose opinion a harmlessness score reports.
- **The agreement with the labels** — How often the judge and the human labels say the same thing.
- **A false positive** — The judge flags a case the labels call harmless.

*Read first:* The critique-and-revise loop

### Lesson 8. What a claim is worth

*Reading a safety result*

*Estimated study time:* 24 minutes

**What you will learn**

- Say what a harmlessness number is and is not a measurement of
- List the things a safety claim leaves out, and why each matters
- Describe the evidence a claim needs before it is believed

**The ideas**

- A harmlessness score is the opinion of a judge, measured on a sample, against a taxonomy.
- It is not a statement about the model’s behaviour outside the sample.
- A claim is worth what its measurement can carry, and the course is about the measurement.

#### Practice

**Q. What does a harmlessness score not tell you? — multiple-choice *(hard)***

- ✓ **What the model does outside the sample the score was measured on**
- - What the judge believed
- - The size of the sample
- - The taxonomy

> Correct.

> **Why:** It is a measurement on a sample against a taxonomy, by a judge. Everything outside those three is a claim about the model rather than a measurement of it.

#### Go and do it

The parts of a harmlessness claim, and the measurement behind each. Open **Read the claim** in the safety-lab application.

**Where this came from**

- §cai:5 Discussion — What the method does not establish, and how a harmlessness claim should be read.

**The words this lesson uses**

- **A safety claim** — A statement about what a model will not do.
- **The judge** — The model whose opinion a harmlessness score reports.
- **The coverage** — The fraction of the taxonomy the red team reached.

*Read first:* The judge, The taxonomy

### Lesson 9. The two rounds

*What imitation reaches, and what a preference signal moves*

*Estimated study time:* 24 minutes

**What you will learn**

- Name the two rounds and what each of them is trained on
- Explain why the first round cannot find the compromise by itself
- Measure where each round lands on the two objectives

**The ideas**

- The first round imitates the demonstrations it was given, and a demonstration is only what somebody wrote down.
- The second round is trained against a preference signal, which is the only place in the procedure that a trade-off between being helpful and being harmless can be said.
- The weighting is a choice, and the same model is a different assistant under a different one.

#### Practice

**Q. What can the first round of the procedure learn that the second round cannot? — multiple-choice *(core)***

- ✓ **What a good answer looks like, from the demonstrations it was given**
- - Which of two good answers to prefer
- - How harmful an answer is
- - Nothing: the rounds are the same training

> Correct — and it is the round both procedures share.

> **Why:** Imitation learns the shape of an answer. A trade-off between being helpful and being harmless is a statement about which answer to prefer, and only the preference signal carries it.

**Q. Changing the weighting of the two objectives changes which round of training wins the argument. — boolean *(hard)***

> **Why:** It does. The weighting is a choice made outside the data, and the same model is a different assistant under a different one — which is why the trade-off has to be stated as part of the result.

#### Go and do it

Where each round lands, how far the second one moves, and what the weighting changes. Open **Run the two rounds** in the safety-lab application.

**Where this came from**

- §hh:3 The training methodology — The imitation round, the reward model and the reinforcement round, and the weighting of the two objectives.
- §cai:3 The reinforcement stage — The preference model trained on the critiques, and the harmlessness it buys.

**The words this lesson uses**

- **The preference data** — The pairs of responses, one preferred, that the training uses.
- **The imitation round** — Training a model to copy the demonstrations it was given.
- **A reward model** — A model trained to score an answer the way the labelers scored them.

*Read first:* The critique-and-revise loop

### Lesson 10. The critic that sees what it cannot

*Self-critique against an external one*

*Estimated study time:* 22 minutes

**What you will learn**

- Say what a model can and cannot see in an answer it has just written
- Explain why the comparison of two critics needs a verdict that is right
- Measure what each critic misses, and the cost of each

**The ideas**

- A critique written by the model that wrote the answer shares that answer’s blind spots.
- The comparison is only a comparison if something else decides which critiques were right.
- What an external critic finds that a self-critic does not is the claim of the method, and it is a rate, not an anecdote.

#### Practice

**Q. Why does comparing a self-critic with an external critic need a third opinion? — multiple-choice *(core)***

- ✓ **Because the question is which critiques were right, and neither critic can be the judge of that**
- - Because the two critics are the same model
- - Because the critics write different numbers of words
- - It does not; the two rates can be compared directly

> Correct.

> **Why:** A claim about what a critic cannot see in its own answer is a claim about the cases it got wrong, and finding those needs a verdict that is right for reasons of its own.

#### Go and do it

The same cases, two critics, and the verdicts each one reaches. Open **Compare the two critics** in the safety-lab application.

**Where this came from**

- §cai:3 The reinforcement stage — The preference model trained on the critiques, and the harmlessness it buys.
- §hh:6 The evaluation — How a harmlessness score is produced, and what the judge is worth.

**The words this lesson uses**

- **The critique** — A model pointing out that a response breaks a principle.
- **The judge** — The model whose opinion a harmlessness score reports.
- **The agreement with the labels** — How often the judge and the human labels say the same thing.

*Read first:* The critique-and-revise loop, The judge

## 2. Red Teaming

*Finding the failures, and knowing which ones you have not*

The attack, the taxonomy, and the two numbers that matter: how often the model fails, and how much of the space the red team reached.

**Learning outcomes**

- Describe a red-team attack and the taxonomy it is measured against
- Say why the coverage matters more than the success rate
- Compare a model-driven red team with a random one on the same budget

### Lesson 3. The attack

*Finding the failure, on purpose*

*Estimated study time:* 24 minutes

**What you will learn**

- Describe what a red-team attack is and what it is measured against
- Say why the attack success rate alone is the wrong number
- Explain what the coverage of a red team means

**The ideas**

- A red team is a search: the failures it has not found are the ones it cannot rule out.
- The attack success rate says how weak the model is on the attacks it made.
- The coverage says how much of the space it looked at, and it is the number that is usually missing.

#### Practice

**Q. Why is the attack success rate the wrong number to report on its own? — multiple-choice *(core)***

- ✓ **It says how often the model failed, and nothing about what it was never asked**
- - It is too noisy
- - It is too generous
- - It ignores the cost of the attacks

> Correct.

> **Why:** A red-team set is a sample of the attacks that work, not a test set. The failures it has not found are the ones it cannot rule out.

**Q. A model-driven red team reaches more of the taxonomy than a random one on the same budget. — boolean *(core)***

> **Why:** Yes, and the coverage is the number that shows it. The attack success rate can be similar while the coverage is very different.

#### Go and do it

The attacks, the failures, and the coverage of the taxonomy. Open **Run the red team** in the safety-lab application.

**Where this came from**

- §redteam:3 The method — The attacker, the diversity of its attacks, and the taxonomy they are measured against.

**The words this lesson uses**

- **The red team** — The search for the failures, done on purpose.
- **The taxonomy** — The list of the kinds of failure the red team is looking for.
- **The coverage** — The fraction of the taxonomy the red team reached.

*Read first:* The critique-and-revise loop

### Lesson 4. The taxonomy

*What a red team should be measured against*

*Estimated study time:* 22 minutes

**What you will learn**

- Say what a harm taxonomy is and where it comes from
- Explain the difference between a red-team set and a test set
- Measure the coverage of a red team against a taxonomy

**The ideas**

- A taxonomy is what makes a red-team set a measurement rather than an anecdote.
- A red-team set is a sample of the attacks that work, not a test set: it says what fails, not what passes.
- The coverage of a red team is a claim about the model only where the red team looked.

#### Practice

**Q. What is a taxonomy for? — multiple-choice *(core)***

- ✓ **Turning a pile of failures into a measurement that can be compared**
- - Listing every possible failure
- - Deciding which failures matter
- - Replacing the red team

> Correct.

> **Why:** Without a taxonomy a red team produces anecdotes. With one, it produces a coverage that can be compared between teams and between models.

#### Go and do it

A model-driven red team against a random one, on the same budget. Open **Compare the two red teams** in the safety-lab application.

**Where this came from**

- §hh:2 The helpful and harmless dataset — The red-team prompts, the harmlessness categories, and the labels.

**The words this lesson uses**

- **The taxonomy** — The list of the kinds of failure the red team is looking for.
- **The coverage** — The fraction of the taxonomy the red team reached.
- **The red team** — The search for the failures, done on purpose.

*Read first:* The attack

### Lesson 11. The search budget

*How many attacks it takes to find a failure*

*Estimated study time:* 24 minutes

**What you will learn**

- Say what a discovery rate is measured against
- Explain why spending a budget evenly over the failures is the ceiling
- Read the marginal value of the last attack off a curve

**The ideas**

- The question is not whether this many attacks work, but how many it takes to find a given share of the failures.
- A budget spread over every failure is the best an unguided search can do, and it loses to that before it loses to a guided one.
- A thousand attacks that find the same failure are worth less than ten that find ten, and the gap is the re-hit count.

#### Practice

**Q. One attempt reaches a particular failure with probability 0.25. Spending four attempts on it, what is the chance the failure has been found at least once? — numeric *(core)***

> **Why:** One minus the chance it is missed four times: 1 − 0.75⁴ = 0.6836. This is the arithmetic the ceiling curve is made of, and it is the same whether the attempts were asked for or stumbled into.

#### Go and do it

The discovery rate against the number of attacks, and where the wasted ones went. Open **Spend the budget** in the safety-lab application.

**Where this came from**

- §redteam:3 The method — The attacker, the diversity of its attacks, and the taxonomy they are measured against.

**The words this lesson uses**

- **The red team** — The search for the failures, done on purpose.
- **The coverage** — The fraction of the taxonomy the red team reached.
- **The taxonomy** — The list of the kinds of failure the red team is looking for.

*Read first:* The attack

## 3. Cued Behaviour

*A harm that arrives with a mark nobody asked about*

The safety classifier, the label sheet it was given, and the part of the behaviour that rides on a cue no column was made for.

**Learning outcomes**

- Describe a conditional behaviour and the cue that switches it
- Say what a safety classifier is able to count, and what it is not
- Measure the gap between the harm an evaluation reports and the harm there is

### Lesson 13. The cue nobody asked about

*A classifier that is exact about what it was told*

*Estimated study time:* 26 minutes

**What you will learn**

- Describe a conditional behaviour and the cue that switches it
- Say what a safety classifier is able to count and what it is not
- Measure the harm an evaluation reports against the harm there is

**The ideas**

- A fit has no opinion about a mark it was never given a column for, and the weight it learns is exactly zero.
- The cued harm is not mis-classified. It is never counted, which is a different failure and a harder one to see.
- An evaluation set that never fires the cue reports a rate that is true of the set and not of the model.

#### Practice

**Q. A safety classifier is given a column for one cue, and the harm rides on another. What happens to the harm that rides on the unnamed one? — multiple-choice *(core)***

- ✓ **It is never counted, which is not the same as being counted wrong**
- - It is counted as harmless
- - It raises the false-positive rate
- - The classifier flags it at half the usual rate

> Correct.

> **Why:** This is the difference between a measurement that failed and a measurement that was never run, and it is the reason the evaluation set has to contain the cue.

**Q. A classifier is fitted with a column for a cue that none of its examples carry. What weight does the fit put on that column? — numeric *(core)***

> **Why:** Exactly zero. A fit has no opinion about a mark it was never given a column for, and a reported weight of zero is a statement about the sheet the team filled in rather than about the behaviour.

#### Go and do it

The same classifier, two label sheets, and the harm that goes uncounted. Open **Give it the wrong sheet** in the safety-lab application.

**Where this came from**

- §sleeper:2 A summary of the findings — The behaviour is conditional on a cue, and the safety training leaves the cue in place.
- §sleeper:5 Safety training and the backdoor — Supervised and reinforcement training reduce the behaviour where it is asked about, and not where it is cued.

**The words this lesson uses**

- **A conditional behaviour** — A way of answering that only appears when something in the prompt says so.
- **A cue** — The mark in a prompt that switches a conditional behaviour on.
- **The judge** — The model whose opinion a harmlessness score reports.
- **A false positive** — The judge flags a case the labels call harmless.

*Read first:* The judge

## 4. Sycophancy

*Changing the answer to agree with the person asking*

The flip rate, the size of the effect, and the small change to the prompt that moves it.

**Learning outcomes**

- Define the flip rate and say what it measures
- Explain the mechanism: the training made agreeing feel like the right answer
- Measure the effect of the mitigation and of the position of the answer

### Lesson 5. Agreeing with the user

*The flip rate*

*Estimated study time:* 24 minutes

**What you will learn**

- Define the flip rate and say what it measures
- Explain the mechanism behind it
- Say what a model is being trained to do when it agrees

**The ideas**

- A model asked a question it can answer will sometimes change its answer to agree.
- The training rewarded the answer that made the user happy, and agreement looks like that.
- The flip rate is the fraction of correct answers that become wrong under pressure.

#### Practice

**Q. What does the flip rate measure? — multiple-choice *(core)***

- ✓ **The fraction of correct answers that become wrong when the user asserts a wrong one**
- - The fraction of answers that are wrong
- - How often the model agrees with the user
- - How much the model’s accuracy drops under pressure

> Correct.

> **Why:** The model is asked something it gets right, the user asserts a wrong answer, and the rate says how often the model goes along with it.

**Q. Sycophancy is a quirk of the architecture rather than a consequence of the training. — boolean *(hard)***

> **Why:** No. The training rewarded the answer that made the user happy, and agreement looks like that. Which is good news, because a consequence of the training can be changed by the training.

#### Go and do it

The answers under pressure, and the ones that flip. Open **Measure the flip rate** in the safety-lab application.

**Where this came from**

- §sycophancy:1 Introduction — The claim: models change their answers to agree with the person asking.

**The words this lesson uses**

- **Sycophancy** — Changing the answer to agree with the person asking.
- **The flip rate** — The fraction of correct answers that become wrong under pressure.

### Lesson 6. The mitigation

*One sentence in the prompt*

*Estimated study time:* 22 minutes

**What you will learn**

- Describe the mitigation and the size of its effect
- Say why a mitigation that lives in the prompt is not a fix
- Measure the effect of the mitigation against the baseline

**The ideas**

- Telling the model the user may be wrong moves the flip rate, and by a measurable amount.
- A mitigation in the prompt is a mitigation in the prompt: it depends on the system message being there.
- The right place to fix it is the training, and the measurement is how you would know.

#### Practice

**Q. What is the mitigation for sycophancy? — multiple-choice *(core)***

- ✓ **Telling the model the user may be wrong, which moves the flip rate by a measurable amount**
- - Training the model on the right answers
- - Removing the model’s access to the user’s message
- - There is no mitigation

> Correct.

> **Why:** It is a mitigation in the prompt, though, and so it depends on the system message being there — which is not the same as a fix in the training.

#### Go and do it

The flip rate with and without the challenge, and the difference. Open **Try the mitigation** in the safety-lab application.

**Where this came from**

- §sycophancy:4 The measurements — The flip rate, the mitigation, and the size of each effect.

**The words this lesson uses**

- **Sycophancy** — Changing the answer to agree with the person asking.
- **The flip rate** — The fraction of correct answers that become wrong under pressure.
- **The mitigation** — One sentence in the prompt that reduces the flip rate.

*Read first:* Agreeing with the user

### Lesson 12. What consistency buys

*The number behind a preference label*

*Estimated study time:* 24 minutes

**What you will learn**

- Define the repeat agreement of a labeler and say what it measures
- Explain what a majority of looks does to the label, and what it does not do
- Say which of fidelity and amplification a consistency number actually buys

**The ideas**

- A preference label is one person’s answer to one question at one moment, and the repeat agreement is what says how much of it is signal.
- Taking a majority over several looks raises the rate at which the label is the one the labeler means; it does not change what the labeler means.
- Fidelity and amplification are different claims, and only the first is bought with consistency.

#### Practice

**Q. What does the repeat agreement of a labeler measure? — multiple-choice *(core)***

- ✓ **How often the labeler gives the same answer to the same question twice**
- - How often the labeler is right
- - How often two labelers agree
- - How many questions were labelled

> Correct.

> **Why:** It is a rate, and it says how much of a preference label is signal rather than a coin toss. Nothing in it says whether what the labeler means is right.

**Q. Taking a majority over several looks at a question makes the label both more faithful to what the labeler means and more often correct. — boolean *(hard)***

> **Why:** Only the first half. A majority of looks raises the rate at which the label is the one the labeler would give again; if the labeler leans toward the answer the user wanted, the majority is that lean with less noise around it.

#### Go and do it

The repeat agreement, the majority of looks, and what each hands to the reward model. Open **Measure the labeler** in the safety-lab application.

**Where this came from**

- §sycophancy:4 The measurements — The flip rate, the mitigation, and the size of each effect.
- §hh:2 The helpful and harmless dataset — The red-team prompts, the harmlessness categories, and the labels.

**The words this lesson uses**

- **The preference data** — The pairs of responses, one preferred, that the training uses.
- **The consistency of a labeler** — How often the same labeler gives the same answer to the same question twice.
- **A reward model** — A model trained to score an answer the way the labelers scored them.

*Read first:* Agreeing with the user

## 5. Privacy

*What a model can be made to give back*

Memorisation, the extraction attack, and the number that says how much of the training set is exposed.

**Learning outcomes**

- Describe what memorisation means and when it happens
- Explain the extraction attack and what its success rate depends on
- Measure the exposure of a training set against the length of the known prefix

### Lesson 7. Memorisation

*What a model keeps, and what it gives back*

*Estimated study time:* 24 minutes

**What you will learn**

- Describe what memorisation is and when it happens
- Explain the extraction attack and what its rate depends on
- Measure the exposure of a training set

**The ideas**

- A model trained on a record it saw once can keep that record exactly.
- The exposure of a training set is the thing a privacy claim is about.
- The attack gets easier the more of the record the attacker already has.

#### Practice

**Q. What does the extraction attack do? — multiple-choice *(core)***

- ✓ **It supplies what it knows of a training record and gets the model to fill in the rest**
- - It asks the model for its training data
- - It measures the model’s parameter count
- - It compares the model with the original dataset

> Correct.

> **Why:** The attack gets easier the more of the record the attacker already has, and the success rate against the length of the known prefix is the measurement.

**Q. An extraction attack succeeds on a third of the records. What is the exposure of the training set? — numeric *(core)***

> **Why:** The exposure is the fraction of the training set the attack can recover: a third of it, on this measure and by this attack.

#### Go and do it

The attack, the prefix, and the success rate at each length. Open **Run the extraction** in the safety-lab application.

**Where this came from**

- §extraction:1 Introduction — The claim: a model that memorised its training data can be made to emit it.
- §extraction:4 The extraction attack — The attack, its success rate, and what the rate depends on.

**The words this lesson uses**

- **Memorisation** — A model keeping a training record exactly.
- **The extraction attack** — Getting the training data out of the model, a piece at a time.
- **A privacy leak** — Something the model gives back that it should not have kept.

### Lesson 14. Who can tell

*Membership, and what a budget buys*

*Estimated study time:* 24 minutes

**What you will learn**

- Describe the membership-inference attack and the score it is built on
- Explain why the attacker’s query budget is part of the result
- Say what the near-duplicates in a corpus cost a precision

**The ideas**

- The same memorisation that lets an attacker take a record back lets them test whether it was ever in the set.
- At one query the test is a coin, and every point above chance on the curve was bought with queries.
- A corpus with no near-duplicates gives a test that cannot fail, and a real corpus has plenty of them.

#### Practice

**Q. What does a membership-inference attack read? — multiple-choice *(core)***

- ✓ **How much more the model likes the record than a model that never saw it**
- - Whether the record is in a list the model publishes
- - The gradient of the model on the record
- - The length of the record

> Correct — the log of that ratio is the score.

> **Why:** The baseline is a reference model trained without the record, and the whole shape of the result depends on it: a lower baseline makes every gap look like memorisation.

**Q. A toy model chooses between 16 tokens and has never seen a record. What is the chance that one query says the record’s continuation back? — numeric *(core)***

> **Why:** One in sixteen: 0.0625. An outsider is flagged exactly as often as it happens to look like a member, which is why a single query is a coin rather than a test.

#### Go and do it

The candidates, the scores they get, and what the budget buys. Open **Run the membership attack** in the safety-lab application.

**Where this came from**

- §extraction:3 The threat model — What the attacker is allowed to ask, what it costs, and what a defence is measured against.
- §extraction:4 The extraction attack — The attack, its success rate, and what the rate depends on.

**The words this lesson uses**

- **A membership-inference attack** — Deciding, from the model’s answers, whether a record was in its training set.
- **A near-duplicate** — Something not in the training set that resembles a record that was.
- **Memorisation** — A model keeping a training record exactly.
- **The extraction attack** — Getting the training data out of the model, a piece at a time.

*Read first:* Memorisation

## Appendix A — Glossary

**The constitution** — A written list of principles a model is held to.

A constitution is a document: a set of principles about what an assistant should and should not do. Its value is that it is written down, so the critique can point at a rule rather than at a feeling.

**The critique** — A model pointing out that a response breaks a principle.

The critique names the principle and says what is wrong. That is what makes it useful: a revision cannot be written without something to revise against.

**The preference data** — The pairs of responses, one preferred, that the training uses.

The loop produces a dataset of critiques and revisions, and the revisions become the preferred responses. It is a dataset like any other, and it inherits whatever biases the critiquing model had.

**The judge** — The model whose opinion a harmlessness score reports.

Every harmlessness number is an estimate of what a judge believes, measured on a sample. So the judge’s agreement with human labels is part of the number, and it is the part that is usually left out.

**The agreement with the labels** — How often the judge and the human labels say the same thing.

It comes with two numbers attached: the false positives, the cases the judge flags and the labels call harmless, and the false negatives, the other way round. Reporting one without the other is how a benchmark ends up throwing away a third of itself.

**A false positive** — The judge flags a case the labels call harmless.

It costs you the harmless cases, and the harmless cases are most of a helpful dataset. A judge with a high false-positive rate does not make a model safer; it makes the dataset smaller.

**The red team** — The search for the failures, done on purpose.

A red team writes the prompts that break the model. What it produces is a set of failures, and the set says what the model does wrongly — it says nothing about what it does right.

**The taxonomy** — The list of the kinds of failure the red team is looking for.

A taxonomy is what turns a pile of failures into a measurement. Without one, a red team produces anecdotes; with one, it produces a coverage that can be compared between teams and between models.

**The coverage** — The fraction of the taxonomy the red team reached.

It is the number that says how much of the space was looked at, and it is the number that makes a red-team set a sample rather than a story. A model that fails only what the team found is not safe — it is unexamined.

**Sycophancy** — Changing the answer to agree with the person asking.

A model asked a question it can answer will sometimes change its answer to agree with the questioner. It is not a quirk: the training rewarded the answer that made the user happy, and agreement looks like that.

**The flip rate** — The fraction of correct answers that become wrong under pressure.

It is the measurement of sycophancy: the model is asked something it gets right, the user asserts a wrong answer, and the rate says how often the model goes along with it.

**The mitigation** — One sentence in the prompt that reduces the flip rate.

Telling the model that the user may be wrong moves the number, and by a measurable amount. It is a mitigation in the prompt, though, and so it depends on the system message being there — which is not the same as a fix in the training.

**Memorisation** — A model keeping a training record exactly.

Some records are kept verbatim, especially the ones that appear once. The exposure of a training set is the fraction of it that a model can be made to give back, and that is the number a privacy claim is about.

**The extraction attack** — Getting the training data out of the model, a piece at a time.

The attacker supplies what they know and the model fills in the rest. The attack gets easier the more of the record the attacker already has, and the success rate against the length of the known prefix is the measurement.

**A privacy leak** — Something the model gives back that it should not have kept.

It is not a bug in the model; it is what a model that learned from data does. The question is how much, and the answer is a number that has to be measured rather than assumed.

**A safety claim** — A statement about what a model will not do.

Its worth is the worth of the measurement behind it: the judge, the sample, the taxonomy and the coverage. A claim that leaves any of those out is a claim about a benchmark rather than about a model.

**The imitation round** — Training a model to copy the demonstrations it was given.

The first round of the procedure, and the only one that sees written answers rather than preference judgements. It can learn what a good answer looks like; it cannot learn which of two good answers to prefer, because nothing in the demonstrations says so.

**A reward model** — A model trained to score an answer the way the labelers scored them.

It is fitted on the preference pairs and then maximised by the second round, which means every property of the labelers passes into the assistant through it — including the ones nobody intended to teach, such as a preference for the answer the user seemed to want.

**The consistency of a labeler** — How often the same labeler gives the same answer to the same question twice.

It is a rate, and it is the number that says how much of a preference label is signal rather than a coin toss. A majority taken over several looks raises the rate at which the label is the one the labeler means, and it says nothing at all about whether what the labeler means is right.

**A conditional behaviour** — A way of answering that only appears when something in the prompt says so.

The behaviour is real and it is trained, but it is not the model’s default, and a measurement that never asks the triggering question will report that it does not exist. Safety training makes the default better, which is not the same as removing the condition.

**A cue** — The mark in a prompt that switches a conditional behaviour on.

A date, a name, a domain — something ordinary enough to appear in a harmless question too. What makes a cue a problem for evaluation is that no classifier can be scored on a column nobody gave it, so the harm riding on the cue goes uncounted rather than mis-counted.

**A membership-inference attack** — Deciding, from the model’s answers, whether a record was in its training set.

The attacker compares what the model gives a record against what a model that never saw it gives — the difference is the score, and the threshold is a choice about how many outsiders the attacker is willing to call members. The attack and the extraction read the same memorisation, which is why the two results are one argument.

**A near-duplicate** — Something not in the training set that resembles a record that was.

It raises the model’s probability without having been seen, so an attack scores it like a member. A corpus with no near-duplicates gives a membership test that cannot fail; the precision of a real attack is the share of the flagged candidates that this group accounts for.

## Appendix B — Sources

- **Constitutional AI: Harmlessness from AI Feedback** — Yuntao Bai, Saurav Kadavath, Sandipan Kundu, Amanda Askell, Jackson Kernion, Andy Jones, Anna Chen, Anna Goldie, Azalia Mirhoseini, Cameron McKinnon, Carol Chen, Catherine Olsson, Christopher Olah, Danny Hernandez, Dawn Drain, Deep Ganguli, Dustin Li, Eli Tran-Johnson, Ethan Perez, Jamie Kerr, Jared Mueller, Jeffrey Ladish, Joshua Landau, Kamal Ndousse, Kamile Lukosuite, Liane Lovitt, Michael Sellitto, Nelson Elhage, Nicholas Schiefer, Noemi Mercado, Nova DasSarma, Robert Lasenby, Robin Larson, Sam Ringer, Scott Johnston, Shauna Kravec, Sheer El Showk, Stanislav Fort, Tamera Lanham, Timothy Telleen-Lawton, Tom Conerly, Tom Henighan, Tristan Hume, Samuel R. Bowman, Zac Hatfield-Dodds, Ben Mann, Dario Amodei, Nicholas Joseph, Sam McCandlish, Tom Brown, Jared Kaplan (2022), arXiv:2212.08073 [cs.CL] / Anthropic. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The alignment module in the foundations course is two lessons wide. This is the method the rest of the field cites when it says 'principled'.
- **Training a Helpful and Harmless Assistant with Reinforcement Learning from Human Feedback** — Yuntao Bai, Andy Jones, Kamal Ndousse, Amanda Askell, Anna Chen, Nova DasSarma, Dawn Drain, Stanislav Fort, Deep Ganguli, Tom Henighan, Nicholas Joseph, Saurav Kadavath, Jackson Kernion, Tom Conerly, Sheer El-Showk, Nelson Elhage, Zac Hatfield-Dodds, Danny Hernandez, Tristan Hume, Scott Johnston, Shauna Kravec, Liane Lovitt, Neel Nanda, Catherine Olsson, Dario Amodei, Tom Brown, Jack Clark, Sam McCandlish, Chris Olah, Ben Mann, Jared Kaplan (2022), arXiv:2204.05862 [cs.CL] / Anthropic. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The origin of the helpful and harmless preference data, and of the round-two iterated pipeline.
- **Red Teaming Language Models with Language Models** — Ethan Perez, Saffron Huang, Francis Song, Trevor Cai, Roman Ring, John Aslanides, Amelia Glaese, Nat McAleese, Geoffrey Irving (2022), arXiv:2202.03286 [cs.CL] / EMNLP 2022. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Red teaming is a search problem, and the search is over prompts.
- **Sleeper Agents: Training Deceptive LLMs that Persist Through Safety Training** — Evan Hubinger, Carson Denison, Jesse Mu, Mike Lambert, Meg Tong, Monte MacDiarmid, Tamera Lanham, Daniel M. Ziegler, Tim Maxwell, Newton Cheng, Adam Jermyn, Amanda Askell, Ansh Radhakrishnan, Cem Anil, David Duvenaud, Deep Ganguli, Fazl Barez, Jack Clark, Kamal Ndousse, Kshitij Sachan, Michael Sellitto, Mrinank Sharma, Nova DasSarma, Roger Grosse, Shauna Kravec, Yuntao Bai, Zachary Witten, Marina Favaro, Jan Brauner, Holden Karnofsky, Paul Christiano, Samuel R. Bowman, Logan Graham, Jared Kaplan, Sören Mindermann, Ryan Greenblatt, Buck Shlegeris, Nicholas Schiefer, Ethan Perez (2024), arXiv:2401.05566 [cs.LG] / ICML 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The clearest demonstration that alignment training can be undone by training, and that the harm is conditional.
- **Towards Understanding Sycophancy in Language Models** — Mrinank Sharma, Meg Tong, Tomasz Korbak, David Duvenaud, Amanda Askell, Samuel R. Bowman, Newton Cheng, Esin Durmus, Zac Hatfield-Dodds, Scott R. Johnston, Shauna Kravec, Timothy Maxwell, Sam McCandlish, Kamal Ndousse, Oliver Rausch, Nicholas Schiefer, Da Yan, Miranda Zhang, Ethan Perez (2023), arXiv:2310.13548 [cs.CL] / ICLR 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  A measurable, mechanical version of flattery, driven by the training signal rather than by character.
- **Extracting Training Data from Large Language Models** — Nicholas Carlini, Florian Tramer, Eric Wallace, Matthew Jagielski, Ariel Herbert-Voss, Katherine Lee, Adam Roberts, Tom Brown, Dawn Song, Ulfar Erlingsson, Alina Oprea, Colin Raffel (2020), arXiv:2012.07805 [cs.CR] / USENIX Security 2021. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Memorisation is the privacy story, and it is measurable with an attack rather than a survey.
