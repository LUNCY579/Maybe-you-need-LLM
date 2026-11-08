# Data Lab


**Source:** DataComp: In search of the next generation of multimodal datasets — Samir Yitzhak Gadre, Gabriel Ilharco, Alex Fang, Jonathan Hayase, Georgios Smyrnis, Thao Nguyen, Ryan Marten, Mitchell Wortsman, Dhruba Ghosh, Jieyu Zhang, Eyal Orgad, Rahim Entezari, Giannis Daras, Sarah Pratt, Vivek Ramanujan, Yonatan Bitton, Kalyani Marathe, Stephen Mussmann, Richard Vencu, Mehdi Cherti, Ranjay Krishna, Pang Wei Koh, Olga Saukh, Alexander Ratner, Shuran Song, Hannaneh Hajishirzi, Ali Farhadi, Romain Beaumont, Sewoong Oh, Alex Dimakis, Jenia Jitsev, Yair Carmon, Vaishaal Shankar, Ludwig Schmidt (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Data is half the story of modern training and is entirely absent from the collection. This paper is also a full curriculum for data curation.

**Source:** DataComp-LM: In search of the next generation of training sets for language models — Jeffrey Li, Alex Fang, Georgios Smyrnis, Maor Ivgi, Matt Jordan, Samir Gadre, Hritik Bansal, Etash Guha, Sedrick Keh, Kushal Arora, Saurabh Garg, Rui Xin, Niklas Muennighoff, Reinhard Heckel, Jean Mercat, Mayee Chen, Suchin Gururangan, Mitchell Wortsman, Alon Albalak, Yonatan Bitton, Marianna Nezhurina, Amro Abbas, Cheng-Yu Hsieh, Dhruba Ghosh, Josh Gardner, Maciej Kilian, Hanlin Zhang, Rulin Shao, Sarah Pratt, Sunny Sanyal, Gabriel Ilharco, Giannis Daras, Kalyani Marathe, Aaron Gokaslan, Jieyu Zhang, Khyathi Chandu, Thao Nguyen, Igor Vasiljevic, Sham Kakade, Shuran Song, Sujay Sanghavi, Fartash Faghri, Sewoong Oh, Luke Zettlemoyer, Kyle Lo, Alaaeldin El-Nouby, Hadi Pouransari, Alexander Toshev, Stephanie Wang, Dirk Groeneveld, Luca Soldaini, Pang Wei Koh, Jenia Jitsev, Thomas Kollar, Alexandros G. Dimakis, Yair Carmon, Achal Dave, Ludwig Schmidt, Vaishaal Shankar (2024)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The language-model counterpart, with the data-quality trade-off measured against compute.

**Source:** The RefinedWeb Dataset for Falcon LLM: Outperforming Curated Corpora with Web Data, and Web Data Only — Guilherme Penedo, Quentin Malartic, Daniel Hesslow, Ruxandra Cojocaru, Alessandro Cappelli, Hamza Alobeidli, Baptiste Pannier, Ebtesam Almazrouei, Julien Launay (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The complete Midas-style pipeline with ablations for every filtering stage.

**Source:** DoReMi: Optimizing Data Mixtures Speeds Up Language Model Pretraining — Sang Michael Xie, Hieu Pham, Xuanyi Dong, Nan Du, Hanxiao Liu, Yifeng Lu, Percy Liang, Quoc V. Le, Tengyu Ma, Adams Wei Yu (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The mixture is a policy over domains, and it can be optimised against a small proxy model.

**Source:** Dolma: an Open Corpus of Three Trillion Tokens for Language Model Pretraining Research — Luca Soldaini, Rodney Kinney, Akshita Bhagia, Dustin Schwenk, David Atkinson, Russell Authur, Ben Bogin, Khyathi Chandu, Jennifer Dumas, Yanai Elazar, Valentin Hofmann, Ananya Harsh Jha, Sachin Kumar, Li Lucy, Xinxi Lyu, Nathan Lambert, Ian Magnusson, Jacob Morrison, Niklas Muennighoff, Aakanksha Naik, Crystal Nam, Matthew E. Peters, Abhilasha Ravichander, Kyle Richardson, Zejiang Shen, Emma Strubell, Nishant Subramani, Oyvind Tafjord, Pete Walsh, Luke Zettlemoyer, Noah A. Smith, Hannaneh Hajishirzi, Iz Beltagy, Dirk Groeneveld, Jesse Dodge, Kyle Lo (2024)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** What a fully open corpus looks like, and the decontamination procedure it needs.

**Source:** The Pile: An 800GB Dataset of Diverse Text for Language Modeling — Leo Gao, Stella Biderman, Sid Black, Laurence Golding, Travis Hoppe, Charles Foster, Jason Phang, Horace He, Anish Thite, Noa Nabeshima, Shawn Presser, Connor Leahy (2020)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The component-dataset view of a corpus, and the basis for mixture experiments.

**Source:** The Curse of Recursion: Training on Generated Data Makes Models Forget — Ilia Shumailov, Zakhar Shumaylov, Yiren Zhao, Yarin Gal, Nicolas Papernot, Ross Anderson (2024)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The model-collapse chapter of the agentic course has no experiment behind it. This one does, and it is small enough to reproduce.

---

## Contents

- [1. Sources](#1-sources)
  - [Lesson 1. What a crawl gives you](#lesson-1-what-a-crawl-gives-you)
  - [Lesson 2. The quality–quantity frontier](#lesson-2-the-qualityquantity-frontier)
- [2. Filtering](#2-filtering)
  - [Lesson 3. The filtering pipeline](#lesson-3-the-filtering-pipeline)
  - [Lesson 4. The reference model](#lesson-4-the-reference-model)
- [3. Deduplication](#3-deduplication)
  - [Lesson 5. Exact and fuzzy](#lesson-5-exact-and-fuzzy)
  - [Lesson 6. Decontamination](#lesson-6-decontamination)
- [4. Mixtures](#4-mixtures)
  - [Lesson 7. A mixture is a policy](#lesson-7-a-mixture-is-a-policy)
  - [Lesson 8. Optimising the mixture](#lesson-8-optimising-the-mixture)
- [5. Collapse](#5-collapse)
  - [Lesson 9. Recursive training](#lesson-9-recursive-training)
  - [Lesson 10. The refinement loop](#lesson-10-the-refinement-loop)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — The laboratories](#appendix-b-the-laboratories)
- [Appendix C — Sources](#appendix-c-sources)

## 1. Sources

*What a crawl gives you, and what it costs*

A web crawl is a large, noisy, duplicated and partly hostile collection of text. This module is about the shape of that collection, and about the frontier between how much data you have and how good it is.

**Learning outcomes**

- Say what a corpus is worth, and how that is measured
- Read an ablation table as a set of measurements

### Lesson 1. What a crawl gives you

*The shape of the raw material*

*Estimated study time:* 22 minutes

**What you will learn**

- Describe the four properties of a web crawl that make it hard to train on
- Explain why a corpus is measured by the model it produces rather than by its size
- Read the ablation table of a filtering pipeline as a set of measurements

**The ideas**

- A crawl is large, noisy, duplicated and partly adversarial.
- The score of a filter is the model trained on what survives it, not the number of documents it removed.
- Filtering is a benchmark: the same rules, the same budget, the same metric.

#### Practice

**Q. What is the honest score of a filtering rule? — multiple-choice *(core)***

- ✓ **The accuracy of the model trained on the documents that survive it**
- The number of documents it removes
- How fast it runs
- How many rules it replaces

> Correct.

> **Why:** A filter earns its place by making the model better. The ablation table is the scoreboard, and the score is the model, not the count.

**Q. Why is a crawl hard to train on? — multiple-choice *(core)***

- ✓ **It is large, noisy, duplicated and partly adversarial**
- It is too small
- It is all one language
- It is already tokenised

> Correct.

> **Why:** Those four properties are the reason the whole pipeline exists: noise needs filtering, duplicates need deduplicating, and the adversarial part needs both.

#### Go and do it

Take a raw corpus through the filters and watch what each stage removes. Open **Run the pipeline** in the data-lab application.

**Where this came from**

- §datacomp:1 Introduction — The framing of the benchmark: a common dataset, a common metric and a common set of rules, so that filtering recipes can be compared.
- §refinedweb:1 Introduction — The claim the whole pipeline is built to test — that well-filtered web data beats a curated corpus.

**Further reading**

- [Dolma: an Open Corpus of Three Trillion Tokens](https://arxiv.org/abs/2402.00159) — What a fully open corpus looks like, and the decontamination procedure it needs.

**The words this lesson uses**

- **Corpus** — The collection of documents a model is trained on.
- **Ablation** — What happens to the result when one component is removed.
- **Data licence** — The terms under which a dataset may be used, studied or redistributed.

### Lesson 2. The quality–quantity frontier

*What a fixed compute budget buys*

*Estimated study time:* 20 minutes

**What you will learn**

- State the trade-off a fixed compute budget forces between data quantity and data quality
- Explain why a smaller, cleaner dataset can beat a larger, noisier one
- Compute the effective number of tokens a filtering budget actually buys

**The ideas**

- At a fixed compute budget, the tokens you can afford are the ones that matter.
- Filtering is a trade: you spend compute on selection to buy back the compute you spend on training.
- A corpus of a hundred billion tokens is not a hundred billion tokens of training.

#### Practice

**Q. A corpus holds 10 billion tokens, and deduplication shows that 40% of the documents are near-duplicates of another document. How many tokens of distinct text are there? — numeric *(hard)***

> **Answer:** 6

> **Why:** Ten billion tokens, of which 40% are duplicates: 10 × (1 − 0.4) = 6 billion tokens of distinct text.

**Q. A fixed filtering budget is spent on a corpus. What trade does it force, and when does the smaller side win? — multiple-choice *(core)***

- Tokens against parameters; more tokens always win
- ✓ **Quantity against quality: filtering discards tokens, and a smaller, cleaner set beats a larger, noisier one once the noise dominates**
- Language coverage against code coverage
- There is no trade; filtering only ever helps

> Correct — the effective tokens are what the budget actually buys.

> **Why:** A fixed compute budget buys a fixed number of effective tokens. Filtering trades raw quantity for quality: compute the effective number of tokens a budget actually buys, and the smaller cleaner dataset wins exactly when the removed noise was costing more than the removed signal.

#### Go and do it

Five rows trained under the same token and compute budget — the raw corpus, the filtered one at full and at half budget, the control with the same documents and the same steps, and an oracle nobody can run. Open **Spend one budget five ways** in the data-lab application.

**Where this came from**

- §datacomp:4 Benchmarking — The fixed compute budget and the fixed metric that make two filtering recipes comparable.
- §datacomp:5 Results — The measured trade between how much data survives and how good the model trained on it is.

**The words this lesson uses**

- **Compute budget** — The total training compute available, which is what the data is bought with.
- **Ablation** — What happens to the result when one component is removed.

*Read first:* What a crawl gives you

## 2. Filtering

*Removing what the model should not have seen*

The filtering pipeline: the structural rules, the reference model, the perplexity filter, and the ablation table that says what each stage is worth.

**Learning outcomes**

- List the stages of a filtering pipeline and explain the order
- Compute a document’s perplexity, and say why the reference model has to be an n-gram model

### Lesson 3. The filtering pipeline

*The order of the filters is part of the method*

*Estimated study time:* 26 minutes

**What you will learn**

- List the stages of a filtering pipeline in the order they are applied and say why
- Explain why cheap structural filters run before expensive model-based ones
- Read a stage-by-stage count and say what it implies about the corpus

**The ideas**

- Structural filters first, model-based filters second, deduplication last.
- Every filter that runs late has to look at more documents.
- A filter that removes a document the model would have learned from is a bug, not a filter.

#### Practice

**Q. Why do the cheap structural filters run before the model-based ones? — multiple-choice *(core)***

- ✓ **A filter that runs late only has to look at the documents that are left**
- The order does not matter
- Because the model-based filters are more accurate
- Because structural filters are easier to write

> Correct.

> **Why:** Every stage only sees what the previous stage left. Running the cheap rules first means the expensive ones run on a small fraction of the crawl.

**Q. A filter that removes a document the model would have learned from is a bug rather than a filter. — boolean *(core)***

> **Answer:** True

> **Why:** Yes. The ablation table catches it: remove the filter and the model gets better, which means the filter was removing signal.

#### Go and do it

The pipeline reports what each stage removed; the laboratory recomputes it from the corpus. Open **Read the stage counts** in the data-lab application.

**Where this came from**

- §refinedweb:2 Data filtering — The pipeline and the argument that the order of the stages is part of the method, not an implementation detail.
- §datacomp:3.1 Basic filtering — The cheap structural rules, and the compute budget that makes them necessary.

**The words this lesson uses**

- **Filtering pipeline** — The ordered set of rules that turns a raw crawl into a training set.
- **Reference model** — The model that decides what counts as normal text.

*Read first:* What a crawl gives you

### Lesson 4. The reference model

*Perplexity, and why the model has to be an n-gram model*

*Estimated study time:* 28 minutes

**What you will learn**

- Define the perplexity of a document under a language model
- Explain why a unigram model fails to remove boilerplate and an n-gram model succeeds
- Compute a document’s perplexity with stupid backoff

**The ideas**

- Perplexity is the exponential of the mean negative log-likelihood per token.
- Stupid backoff discounts the probability once for every level of context that is missing.
- Boilerplate has common words in an unusual arrangement, and only the arrangement gives it away.

#### Practice

**Q. A document has 100 tokens and the model assigns it a total log-likelihood of −460. What is its perplexity? — numeric *(hard)***

> **Answer:** 99.484 ± 0.01

> **Why:** The mean negative log-likelihood per token is 460/100 = 4.6, and the perplexity is exp(4.6) ≈ 99.48.

**Q. Why does the reference model have to be an n-gram model rather than a unigram one, for filtering boilerplate? — multiple-choice *(core)***

- Because unigram models cannot count words
- ✓ **Because boilerplate is ordinary in its word frequencies but unusual in its sequences, and only an n-gram model sees the order**
- Because n-gram models are smaller to store
- Because a unigram model cannot be evaluated in perplexity

> Correct — stupid backoff scores the sequence, not the bag.

> **Why:** Perplexity under the reference model is the filter’s score. A unigram model finds boilerplate perfectly probable — its words are all common. An n-gram model with stupid backoff notices that the sequences never vary, and prices the page accordingly.

#### Go and do it

The same corpus scored under references fitted on different pools — the crawl, one domain, another — and the two rules that use them: the near-duplicate clusters MIDAS keeps, and the perplexity cut taken at a quantile. Open **Cut at a quantile of the reference model** in the data-lab application.

**Where this came from**

- §refinedweb:2.2 Perplexity filtering — Fitting a language model on a sample of the crawl, and removing the documents it finds unlikely.
- §refinedweb:2.1 Midas — The reference model and the rules derived from it.

**The words this lesson uses**

- **Perplexity** — How surprised a language model is by a text, averaged over its tokens.
- **Reference model** — The model that decides what counts as normal text.
- **Boilerplate** — Repetitive text that carries no information: cookie banners, navigation, footers.

*Read first:* The filtering pipeline

## 3. Deduplication

*The same document twice is not twice the data*

Exact hashing, fuzzy matching by shingle overlap, the sub-quadratic search that makes it affordable, and the separate problem of decontamination.

**Learning outcomes**

- Estimate a similarity with MinHash, and find the pairs with an LSH index
- Apply a decontamination test, and say how it can fail

### Lesson 5. Exact and fuzzy

*Shingles, Jaccard, and a search that is not quadratic*

*Estimated study time:* 25 minutes

**What you will learn**

- Define the Jaccard similarity of two shingle sets
- Explain how a MinHash signature estimates it and what its error is
- Describe how Locality-Sensitive Hashing makes the search sub-quadratic

**The ideas**

- A document is a set of its token n-grams, and two documents are duplicates when those sets overlap.
- A MinHash signature estimates the Jaccard similarity in k hash functions instead of |A ∩ B| comparisons.
- The band structure of the LSH index decides which pairs are compared for real.

#### Practice

**Q. What is the Jaccard similarity of two documents that share 30 shingles and have 70 shingles between them? — multiple-choice *(core)***

- ✓ **30/70**
- 30/100
- 70/30
- 30

> Correct: the intersection is 30 and the union is 70.

> **Why:** The Jaccard similarity divides the size of the intersection by the size of the union: 30/70 ≈ 0.43.

**Q. A MinHash signature has 128 entries. Two documents share 90 of them. What is the estimated Jaccard similarity? — numeric *(hard)***

> **Answer:** 0.703125 ± 0.001

> **Why:** The estimate is the fraction of positions that agree: 90/128 = 0.703125.

#### Go and do it

The corpus is deduplicated here, with the candidate pairs the index proposed shown alongside the pairs it verified. Open **Find the near-duplicates** in the data-lab application.

**Where this came from**

- §refinedweb:2.3 Deduplication — The three kinds of deduplication and the compute each one costs.

**The words this lesson uses**

- **Shingle** — A contiguous run of tokens, used as the unit of overlap.
- **Jaccard similarity** — The size of the intersection of two sets, over the size of their union.
- **MinHash** — An estimate of the Jaccard similarity from a small signature.
- **Locality-Sensitive Hashing** — An index that only compares the pairs that are likely to be similar.

*Read first:* What a crawl gives you

### Lesson 6. Decontamination

*A benchmark the model has seen is not a measurement*

*Estimated study time:* 20 minutes

**What you will learn**

- Explain what decontamination is for and how it differs from deduplication
- Apply an n-gram overlap test between a corpus and a benchmark
- State the two ways a decontamination procedure can be wrong

**The ideas**

- Deduplication removes copies of each other; decontamination removes copies of the test set.
- The overlap test is an n-gram test, and the n has to be long enough to be unmistakable.
- A decontamination procedure that is too aggressive removes real data; one that is too lax leaves the leak in.

#### Practice

**Q. What is the difference between deduplication and decontamination? — multiple-choice *(core)***

- ✓ **Deduplication removes copies of each other; decontamination removes copies of the evaluation set**
- They are two names for the same procedure
- Deduplication is exact and decontamination is fuzzy
- Decontamination is applied before deduplication

> Correct.

> **Why:** Deduplication is about wasting compute; decontamination is about whether the score means anything.

**Q. A decontamination procedure can be wrong in two directions. Which are they? — multi-select *(hard)***

- ✓ **It misses contaminated documents, and the benchmark keeps measuring memory**
- ✓ **It removes innocent documents that merely resemble the benchmark, and the training corpus loses good data**
- It deduplicates exact copies, which is the same thing as decontamination
- It cannot be wrong in more than one direction

> **Why:** The n-gram overlap test between a corpus and a benchmark has two failure modes: leave contamination in and the benchmark measures memory; strip too broadly and the corpus loses legitimate text. A benchmark the model has seen is not a measurement.

#### Go and do it

Documents are copied into the corpus and the filter has to find them. Open **Contaminate the benchmark** in the data-lab application.

**Where this came from**

- §refinedweb:2.3 Deduplication — Deduplication against the evaluation sets, which is where decontamination enters the pipeline.

**Further reading**

- [Dolma: an Open Corpus of Three Trillion Tokens](https://arxiv.org/abs/2402.00159) — The decontamination procedure of a fully open corpus, in detail.

**The words this lesson uses**

- **Decontamination** — Removing training documents that overlap the evaluation set.
- **Benchmark contamination** — The evaluation set, or part of it, being in the training set.

*Read first:* Exact and fuzzy

## 4. Mixtures

*A mixture is a policy over domains*

How the proportions of a training set are chosen: the worst-domain objective, the linear model of each domain’s loss, and the closed-form solution.

**Learning outcomes**

- Describe a mixture as a policy over domains
- Optimise it for the worst domain, and solve the mixture in closed form

### Lesson 7. A mixture is a policy

*Proportions, domains, and what they cost*

*Estimated study time:* 22 minutes

**What you will learn**

- Describe a data mixture as a probability distribution over domains
- Explain why a mixture is a decision about which capability to buy
- Measure the per-domain loss of a model trained under a given mixture

**The ideas**

- The mixture decides how much of the model’s capacity goes to each kind of text.
- A domain that is under-represented is a domain the model will be weak in.
- The average loss is not the loss that matters when the use is specialised.

#### Practice

**Q. What does a data mixture decide? — multiple-choice *(core)***

- ✓ **The proportion of training tokens each domain receives**
- Which documents are duplicates
- The learning rate schedule
- The tokeniser

> Correct.

> **Why:** The mixture is a distribution over domains, and it is a decision about which capability the model buys with its compute.

**Q. What does choosing a data mixture decide? — multiple-choice *(core)***

- Only the average loss across all domains
- ✓ **Which capability the training buys: the mixture is a distribution over domains, and each domain is a purchase**
- The speed of the training run
- Nothing; models learn everything from any mixture

> Correct — the per-domain losses show what was bought and what was traded.

> **Why:** A mixture is a probability distribution over domains, and a decision about which capability to buy. Measure the per-domain loss of a model trained under a mixture and the trade is visible: the domains you fed are the ones the model got good at.

#### Go and do it

The mixture the corpus proposes, and the per-domain loss of the model trained on it. Open **See the natural mixture** in the data-lab application.

**Where this came from**

- §doremi:1 Introduction — The mixture as a policy over domains, and the claim that it can be optimised rather than guessed.

**The words this lesson uses**

- **Data mixture** — The proportions in which different kinds of data appear in training.
- **Domain** — A group of documents of the same kind, used as a unit of accounting.
- **Group DRO** — Optimising the worst group rather than the average.

*Read first:* The filtering pipeline

### Lesson 8. Optimising the mixture

*The worst domain, and a closed-form answer*

*Estimated study time:* 34 minutes

**What you will learn**

- Explain the group distributionally robust objective and the update it produces
- Fit a linear model of a domain’s loss as a function of its weight
- Solve the mixture problem in closed form and check the solution
- Name the two steps of the method, and what has to hold for the proxy’s weights to travel to a bigger model

**The ideas**

- Group DRO raises the weight of whichever group is doing worst, and trains on the reweighted sample.
- If each domain’s loss is linear in its weight, the optimal mixture equalises the active domains.
- The optimal mixture is found by a one-dimensional search for the level at which the weights sum to one.
- The weights are learned on a proxy and extrapolated for the target, so the proxy’s ranking has to agree with the target’s — where it does not, the handed-over weights are the weights of a different run.

#### Practice

**Q. What does group DRO optimise? — multiple-choice *(core)***

- ✓ **The loss of the worst-performing group**
- The average loss over all the groups
- The size of the training set
- The number of groups

> Correct.

> **Why:** Group DRO raises the weight of whichever group is doing worst and trains on the reweighted sample, so the model is not left behind in one domain.

**Q. Two domains have losses L₁(w₁) = 2w₁ + 1 and L₂(w₂) = 3w₂ + 0.5, with w₁ + w₂ = 1. What weight minimises the worse of the two? — numeric *(hard)***

> **Answer:** 0.555556 ± 0.001

> **Why:** At the optimum the two losses are equal: 2w₁ + 1 = 3(1 − w₁) + 0.5, so 2w₁ + 1 = 3.5 − 3w₁, giving 5w₁ = 2.5 and w₁ = 0.5556. The common loss is 2.111.

#### Go and do it

The extrapolation arithmetic that rescales the proxy’s weights around a pinned domain, and the ranking the method depends on, tested against the run it came from. Open **Hand the weights to a bigger run** in the data-lab application.

**Where this came from**

- §doremi:3 Method — The two steps: a mixture learned on a small proxy under a fixed budget, then transferred to a larger model.
- §doremi:3.1 Group distributionally robust optimisation — The worst-group objective and the group weights it produces.
- §doremi:3.2 The mixture optimisation — The linear model of each domain’s loss, and the closed-form solution for the mixture.

**The words this lesson uses**

- **Group DRO** — Optimising the worst group rather than the average.
- **Excess loss** — How much worse a domain is than the best domain.

*Read first:* A mixture is a policy

## 5. Collapse

*Training on what a model wrote*

The recursive training loop at toy scale: why the tail of a distribution is the first thing to disappear, what real data in the mixture does about it, and what the same argument says about a filter retrained on its own survivors.

**Learning outcomes**

- Run the recursive training loop at toy scale
- Explain why the tail goes first, and what real data does about it
- Tell the two recursions apart: the model that writes the data, and the filter refitted on what it left behind

### Lesson 9. Recursive training

*What a model writes, and what a model trained on it keeps*

*Estimated study time:* 26 minutes

**What you will learn**

- Describe the recursive training loop and the model it produces at each generation
- Explain why the tail of a distribution is the first thing to disappear
- Compare a bounded model with an unbounded one, and the two failures

**The ideas**

- Train on data, generate from the model, train on that, and the distribution moves away from the original.
- A bounded model loses the tail completely; an unbounded model floors it.
- Real data in the mixture is what keeps the tail alive.

#### Practice

**Q. Which part of a distribution is lost first under recursive training? — multiple-choice *(core)***

- ✓ **The tail — the rare symbols**
- The head — the common symbols
- Both equally
- The mean

> Correct.

> **Why:** The rare symbols lose their probability first, generation after generation, and the distribution becomes narrower than the one it started from.

**Q. A model that can represent any symbol, with a floor under each one, still loses its tail completely under recursive training. — boolean *(hard)***

> **Answer:** False

> **Why:** No. The floor is the point: an unbounded model floors the tail rather than losing it. It is the bounded model — the one that cannot represent the rare outputs — whose tail disappears entirely.

#### Go and do it

The loop, run here, with the tail’s mass measured at every generation. Open **Run the recursion** in the data-lab application.

**Where this came from**

- §recursion:3 The curse of recursion — The result: the tail of the distribution is lost, generation after generation.
- §recursion:2 The models — The bounded and unbounded models, and the different fates of their tails.

**The words this lesson uses**

- **Model collapse** — A model trained on generated data drifting away from the original distribution.
- **The tail of a distribution** — The least likely outcomes, and the mass they hold.
- **A bounded model** — A model that can only put probability on a fixed set of outputs.

*Read first:* The filtering pipeline

### Lesson 10. The refinement loop

*Retraining the filter on what it left behind*

*Estimated study time:* 24 minutes

**What you will learn**

- Describe the loop that refits the reference model on the survivors and filters again
- Explain why a purer corpus can be a worse training set for the model it produces
- Compare several passes at a given total removal with one pass that removes the same amount at once

**The ideas**

- Refit the reference on the survivors, cut again at the same quantile, and every pass leaves a corpus of higher measured quality.
- The measured quality of the corpus and the loss on it are two different things: here the first rises while the second does too.
- Four gentle passes and one hard one can remove exactly the same total, because the removals compose — and only the loop refits the reference on what each earlier pass left behind.

#### Practice

**Q. A refinement loop removes 25% of the corpus in total, spread over four passes. What fraction of the documents standing at the start of a pass does each pass remove, in percent? — numeric *(hard)***

> **Answer:** 6.94 ± 0.06

> **Why:** The removals compose, so each pass keeps the fourth root of what the whole loop keeps: (1 − 0.25)^(1/4) = 0.9306, and 1 − 0.9306 = 0.0694 — 6.94% of what is standing when the pass begins. Four passes of 25% each would remove 68%, not 25%.

**Q. In the loop on this course’s toy corpus, each pass leaves a corpus of higher measured quality, and the model trained on it reaches a lower held-out loss. — boolean *(core)***

> **Answer:** False

> **Why:** Only the first half. The corpus does get purer at every pass, and the held-out loss on it rises rather than falls — the filter’s score of a document and the model’s loss on it are not the same quantity, and a purer corpus is a harder one to predict.

#### Go and do it

The reference retrained on each pass’s survivors, with the corpus quality and the held-out loss plotted on the same axes — and one pass against four at the same total removal. Open **Run the loop pass after pass** in the data-lab application.

**Where this came from**

- §recursion:4 Discussion — What the recursion result does and does not say about a real training run — and about a filter trained on its own output.
- §recursion:1 Introduction — The question the loop is a version of: what happens to a model trained on data a model produced.

**The words this lesson uses**

- **Reference model** — The model that decides what counts as normal text.
- **Perplexity** — How surprised a language model is by a text, averaged over its tokens.
- **Model collapse** — A model trained on generated data drifting away from the original distribution.

*Read first:* Recursive training

## Appendix A — Glossary

**Corpus** — The collection of documents a model is trained on.

A corpus is the text, the images or the audio that a model sees during training. Its size is usually measured in tokens, but its size is not the same as its value: a corpus of a hundred billion tokens of which half are duplicates of the other half is not worth as much as a corpus of ten billion distinct tokens.

**Token** — The unit a model reads: a piece of text, usually a word or a word fragment.

A token is the unit the model is given at a time. A tokenizer decides what the units are, and the choice matters for the bill: the same text can be a hundred thousand tokens or a million depending on the tokenizer. Every "how many tokens was this corpus" question is really a question about the tokenizer too.

**Ablation** — What happens to the result when one component is removed.

An ablation is a measurement of a component’s worth: run the whole method, then run it again with one piece removed, and compare. In a filtering pipeline the ablation table is the honest scoreboard, because a filter that removes a million documents has not earned anything — the model trained on what remains has to be better.

**Filtering pipeline** — The ordered set of rules that turns a raw crawl into a training set.

A filtering pipeline is a sequence of stages, each of which removes some documents. The order is part of the method: cheap structural rules go first, because a model-based filter that runs early has to be run on every document in the crawl, and a filter that runs late only has to look at what is left.

**Reference model** — The model that decides what counts as normal text.

A reference model is fitted on a sample of the corpus and then used to judge every other document. It is a measurement instrument, not a teacher: the corpus is not changed to suit the model, the model is used to describe the corpus.

**Perplexity** — How surprised a language model is by a text, averaged over its tokens.

The perplexity of a document under a language model is the exponential of the mean negative log-likelihood per token. A perplexity of 1 means the model assigned the text probability one; a perplexity of 100 means it was, on average, as surprised as if it had been choosing among a hundred equally likely continuations.

**Boilerplate** — Repetitive text that carries no information: cookie banners, navigation, footers.

Boilerplate is the part of a page that is the same on every page of a site. It is the hardest kind of junk to remove, because its words are ordinary words: a unigram model rates boilerplate as good text. Only the arrangement gives it away, which is why the reference model has to be an n-gram model.

**Shingle** — A contiguous run of tokens, used as the unit of overlap.

A shingle of size n is a run of n consecutive tokens. Two documents are similar when they share many shingles. The size n is a choice: small shingles catch documents that share a phrase, large shingles only catch documents that share a long passage, and the usual choice is somewhere between five and thirteen.

**Jaccard similarity** — The size of the intersection of two sets, over the size of their union.

The Jaccard similarity of two shingle sets is |A ∩ B| / |A ∪ B|. It is zero when the documents share nothing and one when they are identical, and unlike raw overlap it does not grow with the size of the documents.

**MinHash** — An estimate of the Jaccard similarity from a small signature.

A MinHash signature is a list of k numbers, one per hash function. The signature of two sets is compared position by position, and the fraction of positions that agree estimates their Jaccard similarity with an error of order √((1−J)/k). It turns a quadratic search into a linear one.

**Locality-Sensitive Hashing** — An index that only compares the pairs that are likely to be similar.

An LSH index cuts a MinHash signature into bands and hashes each band. Two documents become candidates when they agree on a whole band. The probability of catching a pair with similarity J is 1 − (1 − J^r)^b for a band size r and b bands, which is why the band structure is a tuning knob rather than an implementation detail.

**Decontamination** — Removing training documents that overlap the evaluation set.

Decontamination removes documents from the training set that share content with the benchmark. It is not the same job as deduplication: deduplication removes copies of each other, decontamination removes copies of the test. A benchmark the model has already read is not a measurement of anything.

**Benchmark contamination** — The evaluation set, or part of it, being in the training set.

Contamination is what decontamination exists to prevent. It matters because a score is only a measurement if the model could not have seen the answer. A benchmark that leaked into the training set measures the leakage.

**Data mixture** — The proportions in which different kinds of data appear in training.

A mixture is a probability distribution over domains: how many tokens from the news, how many from the books, how many from the code. It is a decision about which capability to buy with the compute, and it is made long before the training run, usually by guessing.

**Domain** — A group of documents of the same kind, used as a unit of accounting.

A domain is a category of text — news, books, code, forums, reference — and the granularity is a choice. Domains are the groups the mixture allocates between, and the units the worst-domain objective protects.

**Group DRO** — Optimising the worst group rather than the average.

Group distributionally robust optimisation keeps a weight on each group and raises the weight of whichever group is currently doing worst, then trains on the reweighted sample. The result is a model that is not merely good on average but is not left behind anywhere.

**Excess loss** — How much worse a domain is than the best domain.

The excess loss of a domain is its loss minus the smallest loss among the domains. The mixture problem is usually written in terms of excess loss, because the part of the loss that every domain shares is not what the mixture can decide.

**Compute budget** — The total training compute available, which is what the data is bought with.

A compute budget is the number of training steps, times the size of the model, times the length of the sequences. It is the constraint that makes data quality worth paying for: at a fixed budget, the question is not how much data you can get but how much of it the model will actually read.

**Model collapse** — A model trained on generated data drifting away from the original distribution.

Model collapse is the degradation that appears when a model is trained on data that a model produced. The first thing to go is not the head of the distribution but its tail: the rare outputs lose their probability first, generation after generation, and the distribution becomes narrower than the one it started from.

**The tail of a distribution** — The least likely outcomes, and the mass they hold.

The tail is the set of least likely symbols and the mass they hold. It is the part of a distribution that carries the rare knowledge, and the part that a model with a fixed output vocabulary cannot represent at all.

**A bounded model** — A model that can only put probability on a fixed set of outputs.

A bounded model has a limited output vocabulary. Because it cannot represent the rare outputs, a model trained on its own samples loses them, and its support shrinks at every generation. An unbounded model, with a floor under every symbol, floors the tail instead of losing it.

**Data licence** — The terms under which a dataset may be used, studied or redistributed.

A dataset’s licence decides what a project may do with it: train on it, publish statistics about it, or redistribute it. The licences differ, and a course that cites a dataset must record the one it checked, because the terms are attached to a specific version and can change.

## Appendix B — The laboratories

Every laboratory the course ships. Each one runs in the application and computes everything it shows in the browser; this appendix is the catalogue of what exists and what it is for.

### A · The pipeline

*Five filters in order, what each stage leaves, and the model trained on the survivors — ablated one filter at a time.*

*Route:* `/labs/pipeline`

**Delivers:**

- A full filtering pipeline as a benchmark
- Per-filter ablation curves
- Per-stage filtering ablations

### F · The budget

*Five ways to spend one compute budget, with a control row that has the same documents and the same steps as the filtered one.*

*Route:* `/labs/budget`

**Delivers:**

- Quality versus quantity under a fixed compute budget

### E · MIDAS and the reference model

*Near-duplicates kept as clusters rather than collapsed, a perplexity cut taken at a quantile, and a two-view score against a one-view score.*

*Route:* `/labs/midas`

**Delivers:**

- Midas and perplexity filtering
- Why CLIP filtering works

### B · Deduplication

*MinHash and LSH against the exact shingle sets, and the same machinery turned on a benchmark to find what leaked into the corpus.*

*Route:* `/labs/dedup`

**Delivers:**

- Deduplication with exact, fuzzy and MinHash methods
- Decontamination against a benchmark

### C · The mixture

*Domain weights raised by group DRO, the worst domain rescued at a cost to the mean, and a closed-form solver that is degenerate on purpose.*

*Route:* `/labs/mixture`

**Delivers:**

- Group-DRO as a data-mixture objective
- Per-component mixture ablations

### H · The proxy step

*The extrapolation arithmetic that hands proxy weights to a bigger run, and the ranking transfer it depends on, tested against the run it came from.*

*Route:* `/labs/proxy`

**Delivers:**

- The proxy-model extrapolation step

### G · The loop

*The perplexity reference retrained on the survivors, pass after pass, against one hard pass at the same total removal.*

*Route:* `/labs/refinement`

**Delivers:**

- The recursive training loop at toy scale

### D · Collapse

*The tail of a distribution measured directly: the mass that leaves, the symbols it leaves from, and the total variation against the original.*

*Route:* `/labs/collapse`

**Delivers:**

- The tail-mass argument, computed

## Appendix C — Sources

- **DataComp: In search of the next generation of multimodal datasets** — Samir Yitzhak Gadre, Gabriel Ilharco, Alex Fang, Jonathan Hayase, Georgios Smyrnis, Thao Nguyen, Ryan Marten, Mitchell Wortsman, Dhruba Ghosh, Jieyu Zhang, Eyal Orgad, Rahim Entezari, Giannis Daras, Sarah Pratt, Vivek Ramanujan, Yonatan Bitton, Kalyani Marathe, Stephen Mussmann, Richard Vencu, Mehdi Cherti, Ranjay Krishna, Pang Wei Koh, Olga Saukh, Alexander Ratner, Shuran Song, Hannaneh Hajishirzi, Ali Farhadi, Romain Beaumont, Sewoong Oh, Alex Dimakis, Jenia Jitsev, Yair Carmon, Vaishaal Shankar, Ludwig Schmidt (2023), arXiv:2304.14108 [cs.CV] / NeurIPS 2023 Datasets and Benchmarks. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Data is half the story of modern training and is entirely absent from the collection. This paper is also a full curriculum for data curation.
- **DataComp-LM: In search of the next generation of training sets for language models** — Jeffrey Li, Alex Fang, Georgios Smyrnis, Maor Ivgi, Matt Jordan, Samir Gadre, Hritik Bansal, Etash Guha, Sedrick Keh, Kushal Arora, Saurabh Garg, Rui Xin, Niklas Muennighoff, Reinhard Heckel, Jean Mercat, Mayee Chen, Suchin Gururangan, Mitchell Wortsman, Alon Albalak, Yonatan Bitton, Marianna Nezhurina, Amro Abbas, Cheng-Yu Hsieh, Dhruba Ghosh, Josh Gardner, Maciej Kilian, Hanlin Zhang, Rulin Shao, Sarah Pratt, Sunny Sanyal, Gabriel Ilharco, Giannis Daras, Kalyani Marathe, Aaron Gokaslan, Jieyu Zhang, Khyathi Chandu, Thao Nguyen, Igor Vasiljevic, Sham Kakade, Shuran Song, Sujay Sanghavi, Fartash Faghri, Sewoong Oh, Luke Zettlemoyer, Kyle Lo, Alaaeldin El-Nouby, Hadi Pouransari, Alexander Toshev, Stephanie Wang, Dirk Groeneveld, Luca Soldaini, Pang Wei Koh, Jenia Jitsev, Thomas Kollar, Alexandros G. Dimakis, Yair Carmon, Achal Dave, Ludwig Schmidt, Vaishaal Shankar (2024), arXiv:2406.11794 [cs.CL] / NeurIPS 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The language-model counterpart, with the data-quality trade-off measured against compute.
- **The RefinedWeb Dataset for Falcon LLM: Outperforming Curated Corpora with Web Data, and Web Data Only** — Guilherme Penedo, Quentin Malartic, Daniel Hesslow, Ruxandra Cojocaru, Alessandro Cappelli, Hamza Alobeidli, Baptiste Pannier, Ebtesam Almazrouei, Julien Launay (2023), arXiv:2306.01116 [cs.CL]. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The complete Midas-style pipeline with ablations for every filtering stage.
- **DoReMi: Optimizing Data Mixtures Speeds Up Language Model Pretraining** — Sang Michael Xie, Hieu Pham, Xuanyi Dong, Nan Du, Hanxiao Liu, Yifeng Lu, Percy Liang, Quoc V. Le, Tengyu Ma, Adams Wei Yu (2023), arXiv:2305.10429 [cs.LG] / NeurIPS 2023. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The mixture is a policy over domains, and it can be optimised against a small proxy model.
- **Dolma: an Open Corpus of Three Trillion Tokens for Language Model Pretraining Research** — Luca Soldaini, Rodney Kinney, Akshita Bhagia, Dustin Schwenk, David Atkinson, Russell Authur, Ben Bogin, Khyathi Chandu, Jennifer Dumas, Yanai Elazar, Valentin Hofmann, Ananya Harsh Jha, Sachin Kumar, Li Lucy, Xinxi Lyu, Nathan Lambert, Ian Magnusson, Jacob Morrison, Niklas Muennighoff, Aakanksha Naik, Crystal Nam, Matthew E. Peters, Abhilasha Ravichander, Kyle Richardson, Zejiang Shen, Emma Strubell, Nishant Subramani, Oyvind Tafjord, Pete Walsh, Luke Zettlemoyer, Noah A. Smith, Hannaneh Hajishirzi, Iz Beltagy, Dirk Groeneveld, Jesse Dodge, Kyle Lo (2024), arXiv:2402.00159 [cs.CL]. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  What a fully open corpus looks like, and the decontamination procedure it needs.
- **The Pile: An 800GB Dataset of Diverse Text for Language Modeling** — Leo Gao, Stella Biderman, Sid Black, Laurence Golding, Travis Hoppe, Charles Foster, Jason Phang, Horace He, Anish Thite, Noa Nabeshima, Shawn Presser, Connor Leahy (2020), arXiv:2101.00027 [cs.CL]. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The component-dataset view of a corpus, and the basis for mixture experiments.
- **The Curse of Recursion: Training on Generated Data Makes Models Forget** — Ilia Shumailov, Zakhar Shumaylov, Yiren Zhao, Yarin Gal, Nicolas Papernot, Ross Anderson (2024), arXiv:2305.17493 [cs.LG] / Nature 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The model-collapse chapter of the agentic course has no experiment behind it. This one does, and it is small enough to reproduce.
