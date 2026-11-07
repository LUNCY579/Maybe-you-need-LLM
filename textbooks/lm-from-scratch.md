# Language Model from Scratch


**Source:** CS336: Language Modeling from Scratch — Stanford CS336 staff (2026)

**Licence:** Course materials are published for study. The lecture repository (stanford-cs336/spring2025-lectures) and the assignment repository (stanford-cs336/assignment1-basics) are both MIT licensed. Course slides and assignment handouts are cited, not redistributed.

**Why this course exists:** No course in the collection trains a real model, touches a real corpus, or accounts for real hardware cost. Every number in the collection comes from a toy-scale model.

**Source:** nanoGPT — Andrej Karpathy (2023)

**Licence:** MIT (verified via the GitHub API, 2026-10-19)

**Why this course exists:** The smallest honest implementation of a modern decoder-only language model.

**Source:** CS336 spring 2025 lecture materials — Stanford CS336 staff (2025)

**Licence:** MIT (verified via the GitHub API, 2026-10-19)

**Why this course exists:** The lecture sequence itself: tokenisation, PyTorch and resource accounting, architectures, mixture of experts, GPUs, kernels, parallelism, scaling laws, inference, evaluation, data, and post-training.

**Source:** CS336 assignment handouts and code — Stanford CS336 staff (2025)

**Licence:** MIT (verified via the GitHub API, 2026-10-19)

**Why this course exists:** The five assignments map one-to-one onto the planned modules.

**Source:** Neural Networks: Zero to Hero — Andrej Karpathy (2023)

**Licence:** MIT (verified via the GitHub API, 2026-10-19)

**Why this course exists:** The build-up from a single neuron to a GPT, which is the pedagogical spine the other courses assume.

**Source:** Hugging Face LLM Course — Hugging Face (2025)

**Licence:** Published under CC BY-NC 4.0. Cited and linked; not redistributed.

**Why this course exists:** The practical library layer: tokenisers, datasets, generation, and the huggingface pipeline API.

**Source:** Transformers — Hugging Face (2025)

**Licence:** Apache-2.0 (verified via the GitHub API, 2026-10-19)

**Why this course exists:** The library every applied course in this field assumes.

---

## Contents

- [1. Tokenisation](#1-tokenisation)
  - [Lesson 1. The tokeniser](#lesson-1-the-tokeniser)
  - [Lesson 2. The vocabulary economy](#lesson-2-the-vocabulary-economy)
- [2. The Architecture](#2-the-architecture)
  - [Lesson 3. The decoder block](#lesson-3-the-decoder-block)
  - [Lesson 4. The parameter budget](#lesson-4-the-parameter-budget)
- [3. Resource Accounting](#3-resource-accounting)
  - [Lesson 5. The FLOPs](#lesson-5-the-flops)
  - [Lesson 6. The memory hierarchy](#lesson-6-the-memory-hierarchy)
- [4. Systems and Parallelism](#4-systems-and-parallelism)
  - [Lesson 7. Parallelism](#lesson-7-parallelism)
- [5. Data](#5-data)
  - [Lesson 8. The data pipeline](#lesson-8-the-data-pipeline)
- [6. Training and Evaluation](#6-training-and-evaluation)
  - [Lesson 9. The training loop](#lesson-9-the-training-loop)
  - [Lesson 10. The perplexity, and the number behind it](#lesson-10-the-perplexity-and-the-number-behind-it)
  - [Lesson 11. Projecting the next run](#lesson-11-projecting-the-next-run)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — Sources](#appendix-b-sources)

## 1. Tokenisation

*The first decision, and the one everything else is priced against*

A tokeniser decides what a token is, and therefore how long your corpus is, how big your embedding table is, and how many tokens of compute your training run costs. This module builds a byte-pair encoding from scratch and measures the trade-off it sets up.

**Learning outcomes**

- Train a byte-pair encoding and explain the merge rule
- Compute the bytes-per-token ratio and say what it decides
- Explain why the vocabulary size and the sequence length trade against each other

### Lesson 1. The tokeniser

*Learning to merge bytes into words*

*Estimated study time:* 24 minutes

**What you will learn**

- State the byte-pair encoding rule and run it by hand on a short example
- Explain why the encoding starts from bytes rather than characters
- Compute the bytes-per-token ratio of a corpus

**The ideas**

- The tokeniser is trained, not designed: the merges are whatever the corpus supports.
- Starting from bytes means the vocabulary can represent any text, at the price of a long sequence.
- The bytes-per-token ratio is the number that decides your training bill.

#### Practice

**Q. What does a byte-pair encoding start from? — multiple-choice *(core)***

- ✓ **The 256 bytes of the text**
- - A fixed list of words
- - The most frequent words in the corpus
- - Unicode code points

> Correct, which is why it can represent any text.

> **Why:** Starting from the bytes means the tokeniser can represent any text at all, and the merges it learns are whatever the corpus supports.

**Q. A corpus is 8,000,000 bytes of text and the tokeniser produces 2,000,000 tokens. How many bytes per token is that? — numeric *(core)***

> **Why:** Exactly 4 bytes per token. The ratio is the number that decides the training bill: a corpus of B bytes becomes B ÷ 4 tokens, and the compute follows the token count.

#### Go and do it

Train a byte-pair encoding on a generated corpus and watch the merges accumulate. Open **Watch the merges happen** in the lm-from-scratch application.

**Where this came from**

- §1 Overview and tokenization · p. 1 — The tokenisation approach the assignment builds on, and the reason the vocabulary size and the sequence length trade against each other.
- §assignment1 Assignment 1 — Basics · p. 1 — The tokeniser, the model and the optimiser the assignment asks you to build.

**The words this lesson uses**

- **Tokeniser** — The program that turns text into a sequence of integers.
- **Byte-pair encoding** — A tokeniser learned by repeatedly merging the most frequent adjacent pair.
- **Vocabulary** — The set of tokens the tokeniser can produce.
- **Bytes per token** — How many characters of text one token stands for.

### Lesson 2. The vocabulary economy

*Every token you save is a parameter you do not have*

*Estimated study time:* 18 minutes

**What you will learn**

- Explain the trade between the vocabulary size and the sequence length
- Compute the embedding parameters a vocabulary implies
- Argue for a particular vocabulary size on cost grounds

**The ideas**

- A larger vocabulary means a longer sequence for the same text, and more parameters in the embedding.
- The cost of a vocabulary is paid twice: in parameters, and in tokens.
- The optimum depends on the model width, which is why the two cannot be chosen separately.

#### Practice

**Q. Why does a larger vocabulary not simply make training cheaper? — multiple-choice *(hard)***

- ✓ **Because the embedding and output matrices get larger**
- - Because the sequences get longer, so the attention cost grows
- - Because the optimiser has more states to carry
- - It does make training cheaper

> Correct — that is half of it.

> **Why:** A larger vocabulary shortens the sequence but enlarges the two vocabulary-sized matrices. The two effects pull in opposite directions, which is why the vocabulary and the width have to be chosen together.

#### Go and do it

Watch the embedding parameters and the corpus length move against each other. Open **The cost of a vocabulary** in the lm-from-scratch application.

**Where this came from**

- §1 Overview and tokenization · p. 1 — The argument that the vocabulary size and the model dimensions have to be chosen together.

**The words this lesson uses**

- **Vocabulary** — The set of tokens the tokeniser can produce.
- **Embedding** — The matrix that maps a token id to a vector.
- **Context length** — The maximum number of tokens the model attends over at once.

*Read first:* The tokeniser

## 2. The Architecture

*A stack of matrices, and the shapes that go with them*

The decoder-only transformer is a small number of matrices. This module writes them down, counts their parameters, and shows which of them dominate the bill.

**Learning outcomes**

- Write the decoder block: the attention, the feed-forward, and the residual connections
- Count the parameters of a model and say which part dominates
- Explain what tying the output projection to the embedding does

### Lesson 3. The decoder block

*Attention, a feed-forward layer, and two residual connections*

*Estimated study time:* 26 minutes

**What you will learn**

- Write the decoder block and name every tensor in it
- Explain the pre-norm ordering and what it buys
- Explain why the feed-forward block is usually wider than the residual stream

**The ideas**

- A block is a residual connection around an attention, and another around a feed-forward.
- The feed-forward block is where most of the parameters live.
- The pre-norm ordering keeps the residual stream clean, which is what makes deep stacks trainable.

#### Practice

**Q. Which part of a decoder block usually holds the most parameters? — multiple-choice *(core)***

- ✓ **The feed-forward block**
- - The attention projections
- - The layer norms
- - The residual connections

> Correct: two matrices of width × dFf each.

> **Why:** The feed-forward block has a width × dFf matrix and a dFf × width matrix, and with dFf usually several times the width it dominates the block.

**Q. A pre-norm block normalises its input before the sub-layer rather than after it. — boolean *(core)***

> **Why:** Yes. Normalising first keeps the residual stream unscaled, which is what makes a deep stack of blocks trainable without careful initialisation.

#### Go and do it

Count every parameter of a model and see which part of it dominates. Open **Count the parameters** in the lm-from-scratch application.

**Where this came from**

- §3 Architectures and hyperparameters · p. 1 — The architecture the assignment builds, and the hyperparameter choices it makes.

**The words this lesson uses**

- **Transformer** — The stack of attention and feed-forward blocks that makes a language model.
- **Attention** — The part of the block that lets each position look at the others.
- **Feed-forward block** — A two-layer network applied to each position independently.
- **Residual connection** — Adding a block’s input to its output.
- **RMSNorm** — Normalising a vector by its root-mean-square, then scaling it.

*Read first:* The vocabulary economy

### Lesson 4. The parameter budget

*Which matrices are large, and why*

*Estimated study time:* 18 minutes

**What you will learn**

- Break a model’s parameters into their components
- Explain when the embedding dominates the parameter count
- Explain what tying the output projection does

**The ideas**

- The embedding and the output projection are the only vocabulary-sized matrices.
- Tying them halves the largest single block of parameters, at the cost of some capability.
- Everything else scales with the width and the depth, not the vocabulary.

#### Practice

**Q. A model has a vocabulary of 32,000, a width of 768 and 12 layers, and it ties its output projection to the embedding. How many parameters does the embedding account for, in millions? — numeric *(hard)***

> **Why:** 32,000 × 768 = 24,576,000, which is 24.576 million. With the output tied, the vocabulary-sized parameters are paid for once instead of twice.

#### Go and do it

The parameter breakdown as the width, the depth and the vocabulary move. Open **The budget** in the lm-from-scratch application.

**Where this came from**

- §3 Architectures and hyperparameters · p. 1 — The model dimensions and how they are chosen.

**The words this lesson uses**

- **Parameter count** — How many numbers the model has.
- **Weight tying** — Using the token embedding as the output projection.

*Read first:* The decoder block

## 3. Resource Accounting

*How much arithmetic, and how much memory, and which one binds*

Before you train anything, you can work out what it will cost. This module counts the floating-point operations of a training step, the memory it needs, and the arithmetic intensity that decides whether the arithmetic units or the memory bandwidth is the bottleneck.

**Learning outcomes**

- Count the FLOPs of a forward pass and of a training step
- Compute the memory a training step needs, in all four of its components
- Compute the arithmetic intensity and place it against the machine’s balance point
- Explain why the attention kernel is memory bound even when the step is not

### Lesson 5. The FLOPs

*What a training step costs before you run it*

*Estimated study time:* 24 minutes

**What you will learn**

- Count the FLOPs of a forward pass from the matrix shapes alone
- Explain why a training step is about three forward passes
- Predict how the cost changes with the width, the depth and the sequence length

**The ideas**

- A matrix–matrix multiply of an m × k by a k × n costs 2mnk floating-point operations.
- The backward pass costs about twice the forward pass, so a step is about three forwards.
- The cost of a run is the cost of a step times the number of steps, and nothing is a surprise.

#### Practice

**Q. A matrix–matrix multiply of an m × k by a k × n matrix costs how many floating-point operations? — numeric *(core)***

> **Why:** Exactly 2mnk. There are mn outputs, each needing k multiplications and k additions, and the additions are counted as a second operation.

**Q. Why is a training step about three forward passes? — multiple-choice *(core)***

- ✓ **The backward pass costs about twice the forward pass**
- - The optimiser needs a second pass to check the update
- - The activations are recomputed
- - The data is loaded twice

> Correct.

> **Why:** The backward pass computes the gradient with respect to the inputs and the gradient with respect to the weights, and the second of those costs about as much as the forward pass itself.

#### Go and do it

Break a training step into its terms and watch them move with the shape. Open **Count the arithmetic** in the lm-from-scratch application.

**Where this came from**

- §2 PyTorch and resource accounting · p. 1 — The FLOP accounting, and the rule that a matrix–matrix multiply costs 2mnk.

**The words this lesson uses**

- **FLOPs** — Floating-point operations.
- **Training step** — One batch, one forward pass, one backward pass, one update.
- **Arithmetic intensity** — Floating-point operations per byte of memory traffic.

*Read first:* The decoder block

### Lesson 6. The memory hierarchy

*The wall your arithmetic runs into*

*Estimated study time:* 26 minutes

**What you will learn**

- Compute the memory a training step needs, in all four of its components
- Compute the arithmetic intensity and compare it with the machine’s balance point
- Explain why the attention kernel is memory bound even when the whole step is not

**The ideas**

- Four things have to fit: the parameters, the gradients, the optimiser state and the activations.
- Arithmetic intensity is the number of operations per byte, and it decides what the bottleneck is.
- The attention kernel’s intensity is fixed by the head dimension, which is why it has to be tiled.

#### Practice

**Q. What is the arithmetic intensity of a kernel? — multiple-choice *(core)***

- ✓ **Floating-point operations per byte of memory traffic**
- - Bytes of memory per floating-point operation
- - The fraction of the peak rate the kernel reaches
- - The number of arithmetic units the kernel uses

> Correct.

> **Why:** Intensity is operations per byte. Compare it with the machine’s balance point — the intensity at which the two ceilings meet — and you know which of them binds.

**Q. Why is the attention kernel memory bound even when the whole training step is not? — multiple-choice *(hard)***

- ✓ **Its intensity is fixed by the head dimension, which is small**
- - It runs on a slower processor
- - It reads more data than the other kernels
- - It uses more arithmetic units

> Correct.

> **Why:** The attention kernel does about dModel of arithmetic per byte it moves, which is below the balance point of a modern accelerator. That is why it has to be tiled, and why FlashAttention is a memory-layout problem as much as an arithmetic one.

#### Go and do it

Place the workload on the roofline and see which constraint binds. Open **The roofline** in the lm-from-scratch application.

**Where this came from**

- §2 PyTorch and resource accounting · p. 2 — The memory hierarchy, the arithmetic intensity, and the roofline.
- §5 GPUs, TPUs and the memory hierarchy · p. 1 — The hardware the arithmetic has to fit into, and the balance point of a real accelerator.

**The words this lesson uses**

- **Arithmetic intensity** — Floating-point operations per byte of memory traffic.
- **Roofline** — The ceiling on a kernel’s attainable rate.
- **Balance point** — The intensity at which a machine’s two ceilings meet.
- **Activation memory** — The intermediate values kept so the backward pass can use them.

*Read first:* The FLOPs

## 4. Systems and Parallelism

*What it costs to spread a model across machines*

A model that does not fit on one device has to be split. This module covers the three kinds of parallelism and, for each of them, the communication that has to happen and the arithmetic it buys.

**Learning outcomes**

- Name the three kinds of parallelism and what each one splits
- Compute the communication a data-parallel step needs
- Compute the ratio of communication to computation, and say when it stops paying

### Lesson 7. Parallelism

*Three ways to split a model, and what each one costs*

*Estimated study time:* 24 minutes

**What you will learn**

- Name data, tensor and pipeline parallelism and what each splits
- Compute the communication a data-parallel step needs
- Compute the ratio of communication to computation, and say when it stops paying

**The ideas**

- Data parallelism splits the batch and adds a gradient all-reduce per step.
- Tensor parallelism splits a single matrix and adds an all-reduce per layer.
- Pipeline parallelism splits the layers and adds a point-to-point send per stage.
- The split is worth it when the communication is smaller than the arithmetic it saves.

#### Practice

**Q. What does data parallelism split? — multiple-choice *(core)***

- ✓ **The batch**
- - The layers
- - The individual matrices
- - The vocabulary

> Correct.

> **Why:** Data parallelism gives every device the same model and a different slice of the batch, then all-reduces the gradients before the update.

**Q. Data parallelism is worth it when the gradient all-reduce costs less than the arithmetic it saves. — boolean *(hard)***

> **Why:** Yes. The all-reduce touches every parameter, and the saving from a larger batch is the difference in the number of steps. Past some size the communication wins.

#### Go and do it

The communication a data-parallel step needs, against the arithmetic it buys. Open **What the split costs** in the lm-from-scratch application.

**Where this came from**

- §7 Parallelism · p. 1 — The three kinds of parallelism, and the communication each one requires.
- §assignment2 Assignment 2 — Systems · p. 1 — The systems assignment: profiling, a memory-efficient kernel, and a distributed run.

**The words this lesson uses**

- **Data parallelism** — Splitting the batch across devices and averaging the gradients.
- **Tensor parallelism** — Splitting a single matrix across devices.
- **Pipeline parallelism** — Splitting the layers across devices and moving the activations along.
- **All-reduce** — Summing a tensor across every device and giving the result to all of them.

*Read first:* The memory hierarchy

## 5. Data

*The part of the pipeline that decides what the model knows*

The tokens are the training set, and how they are chosen is a research decision in its own right. This module covers the sources, the filtering, the deduplication, and what each stage is for.

**Learning outcomes**

- Say what each stage of a data pipeline is for
- Explain why deduplication changes the token count
- Argue for the mixture being a decision rather than a default

### Lesson 8. The data pipeline

*From a crawl to a training set*

*Estimated study time:* 22 minutes

**What you will learn**

- Name the stages of a language-modeling data pipeline and what each is for
- Explain why deduplication changes the token count
- Argue that the mixture is a decision rather than a default

**The ideas**

- Every filtering stage removes tokens, and the stages are not independent.
- Deduplication is not a tidy-up; it changes what the model learns.
- The mixture over sources is a research decision, and it should be argued for.

#### Practice

**Q. What is the mixture in a data pipeline? — multiple-choice *(core)***

- ✓ **The proportions in which the sources are combined**
- - The list of filters applied to the corpus
- - The order the documents are shuffled in
- - The tokeniser’s merge list

> Correct.

> **Why:** The mixture is a decision about what the model should know, and it deserves the same argument as any other hyperparameter.

**Q. Deduplication only tidies the corpus up; it does not change what the model learns. — boolean *(hard)***

> **Why:** No. Repeated text is a signal — the model learns differently when a document appears ten times — and removing it changes both the token count and the distribution.

#### Go and do it

Run a corpus through the stages and watch the token count fall. Open **The pipeline** in the lm-from-scratch application.

**Where this came from**

- §13 Data — sources and datasets · p. 1 — The sources, and the question of what a token is worth.
- §14 Data — filtering, deduplication and mixing · p. 1 — The filtering, the deduplication and the mixing.
- §assignment4 Assignment 4 — Data · p. 1 — The data assignment: build the pipeline and measure what the filtering did.

**The words this lesson uses**

- **Corpus** — The pile of text a model is trained on.
- **Deduplication** — Removing text that appears more than once.
- **Filtering** — Removing the documents a pipeline decides are not worth training on.
- **Mixture** — The proportions in which the sources of a corpus are combined.

*Read first:* The vocabulary economy

## 6. Training and Evaluation

*The loop, the loss, and what the number means*

A training run is a loop over batches, and a language model is trained to predict the next token. This module runs a real one, in the browser, and reports what the loss and the perplexity actually measure.

**Learning outcomes**

- Run a training loop and read the loss curve
- Explain what the cross-entropy loss is measuring, token by token
- Convert a loss into a perplexity and say what the conversion assumes
- Say why a validation loss is a different measurement from a training loss

### Lesson 9. The training loop

*Batches, gradients, and the loss that falls*

*Estimated study time:* 26 minutes

**What you will learn**

- Describe the training loop and say what each step does
- Explain the cross-entropy loss as a sum over tokens
- Explain what the loss curve does and does not tell you

**The ideas**

- A step is a batch, a forward pass, a backward pass and an update.
- The loss is the average negative log-probability of the tokens that came next.
- A falling loss is evidence the model is fitting; it is not evidence it generalises.

#### Practice

**Q. What does the cross-entropy loss measure for a language model? — multiple-choice *(core)***

- ✓ **The negative log-probability the model assigned to the token that actually came next**
- - The error in the predicted token
- - The distance between the prediction and the label
- - The perplexity

> Correct.

> **Why:** Averaged over the tokens, the cross-entropy is the negative log-likelihood of the corpus under the model, which is exactly what the model is trying to minimise.

**Q. A model reaches a cross-entropy of 2.3026. What is its perplexity? — numeric *(core)***

> **Why:** e^2.3026 = 10, so exactly 10. A perplexity of 10 means the model was as uncertain about each token as a ten-way choice.

#### Go and do it

Train a real transformer in the browser and watch the loss fall. Open **Run a training loop** in the lm-from-scratch application.

**Where this came from**

- §assignment1 Assignment 1 — Basics · p. 1 — The training loop, the optimiser, and a run that has to converge.

**The words this lesson uses**

- **Cross-entropy** — The average negative log-probability of the tokens that actually came next.
- **Batch** — The set of sequences one step processes.
- **Gradient accumulation** — Splitting a large batch into several small ones and adding the gradients.
- **Perplexity** — The loss, exponentiated.

*Read first:* The decoder block, The FLOPs

### Lesson 10. The perplexity, and the number behind it

*What the loss means when you exponentiate it*

*Estimated study time:* 18 minutes

**What you will learn**

- Convert a cross-entropy loss into a perplexity
- State what the perplexity assumes about the distribution
- Explain why the validation loss is a different measurement

**The ideas**

- The perplexity is the loss, exponentiated: it is a number of effective choices.
- It assumes the model is being scored against one fixed distribution.
- A validation loss is a measurement; a training loss is a diagnostic.

#### Practice

**Q. Why is the validation loss a different measurement from the training loss? — multiple-choice *(core)***

- ✓ **It is computed on data the model never trained on**
- - It is computed with a different tokeniser
- - It is the training loss, averaged
- - It uses a different loss function

> Correct.

> **Why:** The training loss is a diagnostic of the optimiser; the validation loss is a measurement of the model. The gap between them is the overfitting.

#### Go and do it

Read the perplexity alongside the loss and the validation number. Open **The number and what is behind it** in the lm-from-scratch application.

**Where this came from**

- §10 Evaluation · p. 1 — What a benchmark measures, and the protocol that has to be reported with it.
- §12 Evaluation, continued · p. 1 — The evaluation harness and the reproducibility of a number.

**The words this lesson uses**

- **Perplexity** — The loss, exponentiated.
- **Validation loss** — The loss on data the model never trained on.
- **Overfitting** — The model learning the training data instead of the process behind it.

*Read first:* The training loop

### Lesson 11. Projecting the next run

*What a power law lets you say before you spend the money*

*Estimated study time:* 20 minutes

**What you will learn**

- State the shape of the scaling laws and what they predict
- Explain the compute-optimal allocation and the rule of thumb it gives
- Say what a scaling law cannot tell you

**The ideas**

- The loss falls as a power law in the compute, the data and the parameters.
- For a fixed compute, there is an optimal size, and Chinchilla found where.
- A scaling law is an extrapolation, and its uncertainty grows with the distance.

#### Practice

**Q. What does the IsoFLOP method find? — multiple-choice *(hard)***

- ✓ **The model size that minimises the loss for a fixed compute budget**
- - The largest model the hardware can hold
- - The number of epochs before overfitting
- - The learning rate schedule

> Correct.

> **Why:** For each model size, find the data that uses the same compute, and read the best point off the curve. Chinchilla used it to find the compute-optimal allocation.

#### Go and do it

Trace the compute-optimal frontier and read the optimal allocation off it. Open **The IsoFLOP picture** in the lm-from-scratch application.

**Where this came from**

- §8 Scaling laws · p. 1 — The power laws and the IsoFLOP methodology.
- §11 Scaling laws, continued · p. 1 — Fitting the laws to your own runs and projecting from them.

**Further reading**

- [Hoffmann et al., arXiv:2203.15556](https://arxiv.org/abs/2203.15556) — The compute-optimal allocation and the rule of thumb it gives.
- [Kaplan et al., arXiv:2001.08361](https://arxiv.org/abs/2001.08361) — The power laws themselves.

**The words this lesson uses**

- **Scaling law** — A power law relating the loss to a resource.
- **IsoFLOP** — Holding the compute fixed and sweeping the model size.
- **Compute-optimal** — The allocation of parameters and data that minimises the loss for a fixed compute.

*Read first:* The FLOPs

## Appendix A — Glossary

**Tokeniser** — The program that turns text into a sequence of integers.

It defines what a token is. Everything downstream — the sequence length, the embedding size, the compute — is priced against it.

*CS336: Language Modeling from Scratch*

**Byte-pair encoding** — A tokeniser learned by repeatedly merging the most frequent adjacent pair.

It starts from the 256 bytes, so it can represent any text, and it learns its merges from the corpus. The merges are the model, not a design decision.

*CS336: Language Modeling from Scratch*

**Vocabulary** — The set of tokens the tokeniser can produce.

Its size sets the width of the embedding matrix and of the output projection, and it trades against how long the sequences become.

*CS336: Language Modeling from Scratch*

**Bytes per token** — How many characters of text one token stands for.

The ratio that decides your bill: a corpus of B bytes becomes B ÷ (bytes per token) tokens, and the training cost follows the token count.

*Example:* A corpus of 10 GB with 4 bytes per token — how many tokens? → About 2.5 billion tokens.

*CS336: Language Modeling from Scratch*

**Embedding** — The matrix that maps a token id to a vector.

Its shape is vocabulary × width, which makes it one of the two largest matrices in the model.

*CS336: Language Modeling from Scratch*

**Context length** — The maximum number of tokens the model attends over at once.

It sets the size of the positional embedding and, quadratically, the cost of the attention scores.

*CS336: Language Modeling from Scratch*

**Transformer** — The stack of attention and feed-forward blocks that makes a language model.

A decoder-only transformer is a residual stream with an attention block and a feed-forward block wrapped around each step.

*CS336: Language Modeling from Scratch*

**Attention** — The part of the block that lets each position look at the others.

Each position forms a query, compares it with every key, and mixes the values in proportion to the resulting scores.

*CS336: Language Modeling from Scratch*

**Feed-forward block** — A two-layer network applied to each position independently.

It holds most of the model’s parameters, which is why widening it is the usual way to add capacity.

*CS336: Language Modeling from Scratch*

**Residual connection** — Adding a block’s input to its output.

It gives the gradient a direct path, which is what makes a deep stack of blocks trainable at all.

*CS336: Language Modeling from Scratch*

**RMSNorm** — Normalising a vector by its root-mean-square, then scaling it.

A simplification of LayerNorm with no mean subtraction and no bias. The gradient has a term from the mean that is easy to forget.

*CS336: Language Modeling from Scratch*

**Parameter count** — How many numbers the model has.

It decides the memory for the parameters, the gradients and the optimiser state — four bytes per parameter for the last two and two for the first.

*CS336: Language Modeling from Scratch*

**Weight tying** — Using the token embedding as the output projection.

It removes one vocabulary-sized matrix, which is often a large fraction of the parameters, at the cost of some expressiveness.

*Course term*

**FLOPs** — Floating-point operations.

A matrix–matrix multiply of an m × k by a k × n matrix costs 2mnk of them. That single rule is enough to cost a whole training run.

*CS336: Language Modeling from Scratch*

**Training step** — One batch, one forward pass, one backward pass, one update.

The backward pass costs about twice the forward, so a step is about three forwards.

*CS336: Language Modeling from Scratch*

**Arithmetic intensity** — Floating-point operations per byte of memory traffic.

It decides whether a kernel is limited by the arithmetic units or by the memory bandwidth, and it is the number the roofline is built on.

*CS336: Language Modeling from Scratch*

**Balance point** — The intensity at which a machine’s two ceilings meet.

A kernel above it is limited by memory; below it, by arithmetic. On a modern accelerator it is of order a hundred.

*CS336: Language Modeling from Scratch*

**Roofline** — The ceiling on a kernel’s attainable rate.

The smaller of the machine’s peak arithmetic rate and its bandwidth divided by the intensity. A kernel cannot beat the roof, and knowing which arm it is under tells you what to optimise.

*CS336: Language Modeling from Scratch*

**Activation memory** — The intermediate values kept so the backward pass can use them.

It scales with the sequence length and with the width, and it is usually the largest single term in the memory of a training step.

*CS336: Language Modeling from Scratch*

**Data parallelism** — Splitting the batch across devices and averaging the gradients.

Each device computes the same model on a different slice of the data, and the gradients are all-reduced before the update.

*CS336: Language Modeling from Scratch*

**Tensor parallelism** — Splitting a single matrix across devices.

It needs an all-reduce inside every layer, which is why it is usually confined to the fast interconnect inside a node.

*CS336: Language Modeling from Scratch*

**Pipeline parallelism** — Splitting the layers across devices and moving the activations along.

It needs a point-to-point send per stage, and it leaves the devices idle at the boundaries unless there are enough microbatches to fill the pipe.

*CS336: Language Modeling from Scratch*

**All-reduce** — Summing a tensor across every device and giving the result to all of them.

Its cost is what decides whether data parallelism is worth it, and it is why the parameters have to be kept in a form the reduction can be applied to efficiently.

*CS336: Language Modeling from Scratch*

**Corpus** — The pile of text a model is trained on.

Its size in tokens is the training budget, and which text is in it is a research decision.

*CS336: Language Modeling from Scratch*

**Deduplication** — Removing text that appears more than once.

It is not a tidy-up. Repeated text is a signal, and removing it changes both the token count and what the model learns.

*CS336: Language Modeling from Scratch*

**Filtering** — Removing the documents a pipeline decides are not worth training on.

Each stage removes tokens, and the stages are not independent, so the order and the thresholds are decisions with consequences.

*CS336: Language Modeling from Scratch*

**Mixture** — The proportions in which the sources of a corpus are combined.

It is a decision about what the model should know, and it deserves the same argument as any other hyperparameter.

*CS336: Language Modeling from Scratch*

**Cross-entropy** — The average negative log-probability of the tokens that actually came next.

It is the objective of almost every language model, and it is the negative log-likelihood the model is trying to minimise.

*Course term*

**Batch** — The set of sequences one step processes.

It trades memory against the quality of the gradient: a bigger batch is a better estimate of the gradient and a larger activation footprint.

*CS336: Language Modeling from Scratch*

**Gradient accumulation** — Splitting a large batch into several small ones and adding the gradients.

It gives you the gradient of the large batch at the memory cost of the small one, at the cost of the activations of the small ones being alive at once.

*CS336: Language Modeling from Scratch*

**Perplexity** — The loss, exponentiated.

It is a number of effective choices: a perplexity of 10 means the model is as uncertain as a ten-way choice. It is only meaningful against a fixed tokenisation.

*Example:* A cross-entropy of 2.3 — what is the perplexity? → e^2.3 ≈ 10, so about ten effective choices per token.

*Course term*

**Validation loss** — The loss on data the model never trained on.

It is a measurement; the training loss is a diagnostic. The gap between them is the overfitting.

*CS336: Language Modeling from Scratch*

**Overfitting** — The model learning the training data instead of the process behind it.

It shows up as a training loss that keeps falling while the validation loss does not.

*Course term*

**Scaling law** — A power law relating the loss to a resource.

The loss falls as a power law in the compute, the data and the parameters, with the exponent slowly improving.

*Kaplan et al. (2020)*

**IsoFLOP** — Holding the compute fixed and sweeping the model size.

The method that finds the compute-optimal allocation: for each model size, find the data that uses the same compute, and read the best point off the curve.

*Hoffmann et al. (2022)*

**Compute-optimal** — The allocation of parameters and data that minimises the loss for a fixed compute.

Chinchilla found that the parameters and the tokens should grow together, roughly twenty tokens per parameter — a rule of thumb, not a law.

*Hoffmann et al. (2022)*

## Appendix B — Sources

- **CS336: Language Modeling from Scratch** — Stanford CS336 staff (2026), stanford-cs336.github.io — Spring 2025 and Spring 2026 offerings. Licence: Course materials are published for study. The lecture repository (stanford-cs336/spring2025-lectures) and the assignment repository (stanford-cs336/assignment1-basics) are both MIT licensed. Course slides and assignment handouts are cited, not redistributed..
  No course in the collection trains a real model, touches a real corpus, or accounts for real hardware cost. Every number in the collection comes from a toy-scale model.
- **nanoGPT** — Andrej Karpathy (2023), GitHub repository. Licence: MIT (verified via the GitHub API, 2026-10-19).
  The smallest honest implementation of a modern decoder-only language model.
- **CS336 spring 2025 lecture materials** — Stanford CS336 staff (2025), GitHub repository. Licence: MIT (verified via the GitHub API, 2026-10-19).
  The lecture sequence itself: tokenisation, PyTorch and resource accounting, architectures, mixture of experts, GPUs, kernels, parallelism, scaling laws, inference, evaluation, data, and post-training.
- **CS336 assignment handouts and code** — Stanford CS336 staff (2025), GitHub repository. Licence: MIT (verified via the GitHub API, 2026-10-19).
  The five assignments map one-to-one onto the planned modules.
- **Neural Networks: Zero to Hero** — Andrej Karpathy (2023), Video series and companion notes. Licence: MIT (verified via the GitHub API, 2026-10-19).
  The build-up from a single neuron to a GPT, which is the pedagogical spine the other courses assume.
- **Hugging Face LLM Course** — Hugging Face (2025), Online course. Licence: Published under CC BY-NC 4.0. Cited and linked; not redistributed..
  The practical library layer: tokenisers, datasets, generation, and the huggingface pipeline API.
- **Transformers** — Hugging Face (2025), GitHub repository and Python package. Licence: Apache-2.0 (verified via the GitHub API, 2026-10-19).
  The library every applied course in this field assumes.
