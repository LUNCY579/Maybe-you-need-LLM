# Systems Lab


**Source:** FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness — Tri Dao, Daniel Y. Fu, Stefano Ermon, Atri Rudra, Christopher Ré (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The efficiency course covers a KV-cache laboratory but not where the arithmetic actually goes.

**Source:** Efficient Memory Management for Large Language Model Serving with PagedAttention — Woosuk Kwon, Zhuohan Li, Siyuan Zhuang, Ying Sheng, Lianmin Zheng, Cody Hao Yu, Joseph E. Gonzalez, Hao Zhang, Ion Stoica (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Serving is a memory-allocation problem, and the page-table trick is the standard answer.

**Source:** Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer — Noam Shazeer, Azalia Mirhoseini, Krzysztof Maziarz, Andy Davis, Quoc Le, Geoffrey Hinton, Jeff Dean (2017)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Sparse capacity is the main reason parameter counts stopped predicting quality.

**Source:** GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding — Dmitry Lepikhin, HyoukJoong Lee, Yuanzhong Xu, Dehao Chen, Orhan Firat, Yanping Huang, Maxim Krikun, Noam Shazeer, Zhifeng Chen (2020)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Sparse capacity: the top-k router, the capacity factor that bounds it, the tokens that overflow it, and the auxiliary loss that keeps the experts evenly used.

**Source:** Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity — William Fedus, Barret Zoph, Noam Shazeer (2021)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The simplification of MoE routing that made it trainable at scale.

**Source:** SmoothQuant: Accurate and Efficient Post-Training Quantization for Large Language Models — Guangxuan Xiao, Ji Lin, Mickael Seznec, Hao Wu, Julien Demouth, Song Han (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Quantisation is the standard memory saving and the reason activations, not weights, are the hard part.

**Source:** SpecInfer: Accelerating Generative Large Language Model Serving with Tree-based Speculative Inference and Verification — Xupeng Miao, Gabriele Oliaro, Zhihao Zhang, Xinhao Cheng, Zeyu Wang, Zhengxin Zhang, Rae Ying Yee Wong, Alan Zhu, Lijie Yang, Xiaoxiang Shi, Chunan Shi, Zhuoming Chen, Daiyaan Arfeen, Reyna Abhyankar, Zhihao Jia (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Speculative decoding turns a memory-bound decode loop into a batched verification, and the acceptance rate is a computable quantity.

**Source:** Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads — Tianle Cai, Yuhong Li, Zhengyang Geng, Hongwu Peng, Jason D. Lee, Deming Chen, Tri Dao (2024)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Draft-model-free speculation: the acceptance test is a set of heads, not a second model.

**Source:** LoRA: Low-Rank Adaptation of Large Language Models — Edward J. Hu, Yelong Shen, Phillip Wallis, Zeyuan Allen-Zhu, Yuanzhi Li, Shean Wang, Lu Wang, Weizhu Chen (2021)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The adaptation method every fine-tuning course now teaches.

**Source:** QLoRA: Efficient Finetuning of Quantized LLMs — Tim Dettmers, Artidoro Pagnoni, Ari Holtzman, Luke Zettlemoyer (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Combining quantisation with low-rank adaptation, which is how a single GPU fine-tunes a large model.

---

## Contents

- [1. Attention Memory](#1-attention-memory)
  - [Lesson 1. The matrix you never build](#lesson-1-the-matrix-you-never-build)
  - [Lesson 2. The running softmax](#lesson-2-the-running-softmax)
- [2. The KV Cache](#2-the-kv-cache)
  - [Lesson 3. Decoding is memory-bound](#lesson-3-decoding-is-memory-bound)
  - [Lesson 4. The page table](#lesson-4-the-page-table)
- [3. Sparse Capacity](#3-sparse-capacity)
  - [Lesson 5. The router](#lesson-5-the-router)
  - [Lesson 6. The auxiliary loss](#lesson-6-the-auxiliary-loss)
- [4. Speculation](#4-speculation)
  - [Lesson 7. Proposing and checking](#lesson-7-proposing-and-checking)
  - [Lesson 8. When speculation pays](#lesson-8-when-speculation-pays)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — Sources](#appendix-b-sources)

## 1. Attention Memory

*The matrix you never have to build*

The naive attention builds an N×N matrix that it needs once. This module is about what that costs, and about the algorithm that does not build it — and is still exact.

**Learning outcomes**

- Say where the memory goes in a long-context attention, and how much of it is the score matrix
- Explain the running softmax, and why the tiled algorithm gives the same answer
- Account for the traffic the two algorithms move through the memory hierarchy

### Lesson 1. The matrix you never build

*Where the memory goes in a long context*

*Estimated study time:* 24 minutes

**What you will learn**

- Write the naive attention and say what it materialises
- Compute the size of the score matrix and the traffic it causes
- Distinguish the memory a training run needs from the memory a forward pass needs

**The ideas**

- The score matrix is N by N, and it dwarfs everything else at a long context.
- It is written once and read once, and then it is thrown away.
- The training run is worse than the forward pass, because the backward pass needs the matrix kept.

#### Practice

**Q. Why is the score matrix the problem in a long context? — multiple-choice *(core)***

- ✓ **It has N squared entries, so it grows faster than anything else in the program**
- - It is the largest matrix the model can represent
- - It is hard to compute
- - It is not differentiable

> Correct.

> **Why:** The table has one entry per pair of positions, so it grows with the square of the context while everything else grows with the context itself.

**Q. A context of 8192 tokens produces a score matrix in four-byte floats. How many bytes is it? — numeric *(core)***

> **Why:** 8192 squared is 67,108,864 entries, and four bytes each is 268,435,456 bytes — two hundred and fifty-six megabytes for one layer, one head.

#### Go and do it

The naive attention, run here, with the memory and the traffic it uses. Open **Build the matrix** in the systems-lab application.

**Where this came from**

- §flash:1 Introduction — The observation that the bottleneck is the memory traffic, not the arithmetic.
- §flash:4 The backward pass — The recomputation, and the arithmetic it buys with memory.

**The words this lesson uses**

- **Attention** — The operation that mixes a sequence with itself, weighted by similarity.
- **The score matrix** — The N by N table of similarities that the naive attention builds.
- **Arithmetic intensity** — The number of operations a step does for each byte it moves.

### Lesson 2. The running softmax

*An exact answer, computed without the matrix*

*Estimated study time:* 28 minutes

**What you will learn**

- Describe the tiling: which block is resident, and which is streamed past
- Derive the running maximum, the running sum and the rescaling between them
- Check that the tiled algorithm and the naive one agree

**The ideas**

- The softmax of a row can be accumulated as a running maximum and a running sum.
- When the maximum moves, the accumulator is rescaled — and that rescaling is what keeps it exact.
- The answer is identical; only the memory and the traffic differ.

#### Practice

**Q. What makes the tiled attention exact rather than an approximation? — multiple-choice *(hard)***

- ✓ **The running maximum and sum are rescaled whenever the maximum moves**
- - The blocks are small enough to be exact in floating point
- - The computation is done in a higher precision
- - The last block is computed again

> Correct.

> **Why:** When a larger value arrives, everything accumulated so far is divided by the factor by which the maximum grew. The rescaling is what keeps the sum exact, and it is why the tiled answer equals the naive one.

#### Go and do it

The same attention, tiled, and the difference in the memory it uses. Open **Stream the blocks** in the systems-lab application.

**Where this came from**

- §flash:3 The algorithm — The tiling, the running softmax, and the exactness of the result.
- §flash:3.1 Tiling and the online softmax — How the softmax is accumulated without the whole matrix ever existing.
- §flash:3.2 Exact attention — The claim that the answer is the same, and why that claim is not a small one.

**The words this lesson uses**

- **Tiling** — Computing a large operation in blocks, so that the blocks fit in fast memory.
- **The online softmax** — Computing a softmax by accumulating a running maximum and a running sum.
- **Recomputation** — Computing something twice instead of storing it.

*Read first:* The matrix you never build

## 2. The KV Cache

*Why decoding is a memory problem*

Decoding reads a model and grows a cache. This module is about the arithmetic intensity of that step, about the batch size that changes its regime, and about the page table that makes the memory usable.

**Learning outcomes**

- Compute the bytes the key and value cache holds, and the intensity of a decode step
- Explain why the intensity rises with the batch size and then stops rising
- Compare a padded allocation with a paged one

### Lesson 3. Decoding is memory-bound

*The arithmetic intensity of one token*

*Estimated study time:* 24 minutes

**What you will learn**

- Compute the bytes the key and value cache holds for a given context
- Compute the arithmetic intensity of a decode step
- Explain why the intensity rises with the batch size and then stops

**The ideas**

- A decode step is a matrix-vector product: two operations per byte of weights.
- The weights are read once for the batch; the cache is read once per sequence.
- So the batch amortises the weights and nothing else — and the intensity saturates.

#### Practice

**Q. Why is a decode step memory-bound? — multiple-choice *(core)***

- ✓ **It is a matrix-vector product: two operations for every byte of weight read**
- - The arithmetic is too difficult
- - The cache is too large
- - The model has too many layers

> Correct.

> **Why:** At two operations per byte, the arithmetic intensity of a matrix-vector product is about one, and a machine whose balance point is tens of operations per byte is waiting for memory.

**Q. The arithmetic intensity of a decode step rises without limit as the batch size grows. — boolean *(hard)***

> **Why:** No. The weights are read once for the whole batch, so that part of the intensity rises with the batch; but the cache is read once per sequence, and its intensity is fixed. So the total rises and then saturates.

#### Go and do it

The arithmetic intensity of a decode step, as the batch size and the context grow. Open **Measure the intensity** in the systems-lab application.

**Where this came from**

- §vllm:1 Introduction — The serving problem: many sequences of different lengths, and one memory budget.

**The words this lesson uses**

- **The key and value cache** — The stored keys and values of the tokens already generated.
- **Arithmetic intensity** — The number of operations a step does for each byte it moves.
- **A decode step** — The work of producing one token.

*Read first:* The matrix you never build

### Lesson 4. The page table

*Memory you can actually hand out*

*Estimated study time:* 22 minutes

**What you will learn**

- Explain why a contiguous allocation wastes memory on the padding
- Describe the paged allocation and what it wastes instead
- Compute the waste of both for a set of sequence lengths

**The ideas**

- A straightforward implementation gives every sequence a buffer as long as the longest one.
- Paging replaces the buffer with fixed-size blocks that can live anywhere.
- The waste becomes a fraction of a block per sequence rather than a fraction of the batch.

#### Practice

**Q. What does the paged allocation waste? — multiple-choice *(core)***

- ✓ **The tail of the last block of each sequence**
- - Nothing at all
- - The difference between the longest and the shortest sequence, for every sequence
- - A whole block for every sequence

> Correct.

> **Why:** Paging replaces a per-sequence buffer as long as the longest sequence with whole blocks, so the waste is a fraction of a block per sequence rather than a fraction of the whole batch.

#### Go and do it

A batch of sequences, and the memory each allocation scheme wastes. Open **Fill the memory** in the systems-lab application.

**Where this came from**

- §vllm:3 The memory allocator — The page table, the block size, and the fragmentation that the paging removes.
- §vllm:3.1 PagedAttention — The copy of the blocks the attention kernel needs, and the bookkeeping that makes it cheap.

**The words this lesson uses**

- **Paging** — Storing a variable-length thing in fixed-size blocks that can live anywhere.
- **Fragmentation** — Memory that is allocated and not used.
- **Block size** — How many tokens one unit of the paged memory holds.

*Read first:* Decoding is memory-bound

## 3. Sparse Capacity

*More parameters, the same arithmetic*

A mixture of experts keeps many experts and activates few. This module is about the router, the imbalance it creates, the auxiliary loss that corrects it, and the tokens that fall off the end.

**Learning outcomes**

- Describe the router and the load balance it is supposed to maintain
- Compute the auxiliary loss, and see it grow when the router is biased
- Measure the overflow when a capacity factor is set

### Lesson 5. The router

*Which experts see this token*

*Estimated study time:* 24 minutes

**What you will learn**

- Describe the top-k router and the probabilities it assigns
- Define the load of an expert and the probability mass it receives
- Explain what happens when the two disagree

**The ideas**

- The router sends each token to the few experts with the highest scores.
- The load is what the experts actually got; the probability is what the router wanted.
- When they disagree, some experts are trained more than others — and the ones trained less are worse.

#### Practice

**Q. Why does an unbalanced router hurt the model? — multiple-choice *(core)***

- ✓ **The experts that get fewer tokens are trained on less, and stay worse**
- - The router itself becomes the bottleneck
- - The tokens are dropped
- - The model loses capacity

> Correct.

> **Why:** An expert that sees a tenth of the tokens sees a tenth of the updates, so it stays closer to its initialisation than its neighbours do, and the model is carrying experts that are worse than useless.

#### Go and do it

A router here, on embeddings here, with the load it produces. Open **Route the tokens** in the systems-lab application.

**Where this came from**

- §gshard:1 Introduction — Conditional computation: more parameters, the same arithmetic.
- §gshard:2 Sparse layers — The top-k router, the capacity factor, and the tokens that fall off the end.

**The words this lesson uses**

- **The router** — The part of a sparse model that decides which experts see a token.
- **Load balance** — How evenly the tokens are spread across the experts.
- **The capacity factor** — How many tokens an expert may take, as a multiple of its fair share.

### Lesson 6. The auxiliary loss

*Paying a little to keep the experts equal*

*Estimated study time:* 24 minutes

**What you will learn**

- Compute the auxiliary loss from the load and the probability
- Show that it grows when the router is biased
- Measure the overflow that a capacity factor allows

**The ideas**

- The auxiliary loss is the number of tokens times the sum of the products of the two fractions.
- It is smallest when the load and the probability agree, and it pushes the router there.
- The capacity factor is the other half of the bargain: a hard limit, and the tokens it drops.

#### Practice

**Q. A router sends every token to one of two experts. The load fractions are 0.75 and 0.25, and the probability fractions are 0.5 and 0.5. What is the auxiliary loss for 100 tokens? — numeric *(hard)***

> **Why:** The auxiliary loss is N times the sum of the products: 100 × (0.75 × 0.5 + 0.25 × 0.5) = 100 × 0.5 = 50.

#### Go and do it

A biased router, the auxiliary loss it produces, and the tokens that overflow. Open **Break the balance** in the systems-lab application.

**Where this came from**

- §gshard:3 Training — The auxiliary loss, and the balance it maintains.

**The words this lesson uses**

- **The auxiliary loss** — A small extra loss that keeps the experts evenly used.
- **Load balance** — How evenly the tokens are spread across the experts.
- **The capacity factor** — How many tokens an expert may take, as a multiple of its fair share.

*Read first:* The router

## 4. Speculation

*A small model proposes; a large one checks*

Speculative decoding trades a cheap model for a few steps of an expensive one. This module is about the acceptance rate, about the exactness of the result, and about when the trade is worth making.

**Learning outcomes**

- State the acceptance rule and compute the acceptance rate it implies
- Show that the procedure produces the target model’s own distribution
- Compute the speed-up, and say what it depends on

### Lesson 7. Proposing and checking

*The rule, and what it guarantees*

*Estimated study time:* 26 minutes

**What you will learn**

- State the acceptance rule and compute the rate it implies
- Show that the procedure produces the target model’s own distribution
- Explain why the corrected token is drawn from the excess

**The ideas**

- A drafted token is accepted with probability min(1, p(x)/q(x)).
- The expected acceptance is one minus the total variation between the two distributions.
- The two terms of the output distribution — the accepted and the corrected — add up to the target’s.

#### Practice

**Q. What is the acceptance rule? — multiple-choice *(core)***

- ✓ **A drafted token x is accepted with probability min(1, p(x)/q(x))**
- - A drafted token is accepted when the target’s most likely token is the same
- - A drafted token is accepted at random
- - A drafted token is accepted when it is more likely than the target’s

> Correct.

> **Why:** The rule compares the two distributions at the drafted token, and the correction on rejection is what makes the output come out as the target’s own distribution.

**Q. The draft model’s distribution and the target’s differ by a total variation distance of 0.15. What is the expected acceptance rate? — numeric *(hard)***

> **Why:** The expected acceptance is one minus the total variation: 1 − 0.15 = 0.85. The fraction of the draft’s mass the target agrees with.

#### Go and do it

The acceptance rate, measured by running the rule. Open **Measure the acceptance** in the systems-lab application.

**Where this came from**

- §specinfer:1 Introduction — The idea of a small model proposing and a large model checking.
- §specinfer:3 Speculative inference — The verification, the acceptance, and the exactness of the result.

**The words this lesson uses**

- **Speculation** — Proposing a token cheaply and checking it expensively.
- **The acceptance rate** — The fraction of the proposed tokens that are kept.
- **Total variation** — The largest difference between two distributions, and half the sum of the differences.

### Lesson 8. When speculation pays

*The trade, and its terms*

*Estimated study time:* 22 minutes

**What you will learn**

- Compute the tokens produced per target step from the acceptance rate
- Compute the speed-up, and say what it depends on
- Explain why a closer draft model is worth more than a longer one

**The ideas**

- The speed-up is the tokens per step, divided by the cost of the drafting.
- A draft that is close to the target is worth more than a long run of a bad one.
- The output is unchanged: the method buys time, not a different answer.

#### Practice

**Q. What does speculative decoding change about the model’s output? — multiple-choice *(core)***

- ✓ **Nothing: the output distribution is the target model’s own**
- - It makes the output more likely
- - It makes the output less diverse
- - It truncates the output to what the draft proposed

> Correct.

> **Why:** The accepted and the corrected tokens together give exactly the target’s distribution. The method buys time and nothing else, which is why it is safe to use.

#### Go and do it

The speed-up, as the acceptance rate and the relative cost of the two models move. Open **Price the speculation** in the systems-lab application.

**Where this came from**

- §specinfer:4 Tree-based speculation — Several drafts at once, and the cost of checking them.

**The words this lesson uses**

- **Speculation** — Proposing a token cheaply and checking it expensively.
- **The acceptance rate** — The fraction of the proposed tokens that are kept.
- **The draft model** — The small model that makes the proposals.

*Read first:* Proposing and checking

## Appendix A — Glossary

**Attention** — The operation that mixes a sequence with itself, weighted by similarity.

Attention computes, for every position, a weighted sum of the values at every other position, where the weights come from the similarity of the queries to the keys. The result is exact in the mathematics; the question this course is about is what it costs to compute.

**The score matrix** — The N by N table of similarities that the naive attention builds.

Every query against every key is one entry, so the table is N squared entries. At a context of 32 thousand tokens and four bytes each, it is four gigabytes — larger than the model that is producing it, and larger than the accelerator it is being computed on.

**Arithmetic intensity** — The number of operations a step does for each byte it moves.

Arithmetic intensity is the ratio that decides whether a step is limited by the arithmetic or by the memory bandwidth. A machine has a balance point — the intensity at which the two are equally slow — and a step above it is compute-bound, and a step below it is memory-bound.

**Tiling** — Computing a large operation in blocks, so that the blocks fit in fast memory.

Tiling splits the work into blocks small enough to hold in the on-chip memory, and streams the rest past. It is the standard answer to a memory problem, and the block size is the knob that trades arithmetic against traffic.

**The online softmax** — Computing a softmax by accumulating a running maximum and a running sum.

The softmax of a row can be built without seeing the whole row at once, if you keep the largest value you have seen and the sum of the exponentials relative to it. When a larger value arrives, everything accumulated so far is rescaled — and the rescaling is what makes the result exact.

**Recomputation** — Computing something twice instead of storing it.

The tiled attention does not keep the matrix of probabilities, so the backward pass computes the blocks again. That is extra arithmetic spent deliberately, and it is the trade the paper makes: memory for arithmetic, in the regime where memory is the scarce thing.

**The key and value cache** — The stored keys and values of the tokens already generated.

Generating a token means attending over everything generated so far. The keys and values of those tokens are the same every time, so they are kept: that is the cache. It grows with the context, and at a long context it is the largest thing in memory.

**A decode step** — The work of producing one token.

A decode step runs the whole model on a single token. Its cost is dominated by reading the weights and the cache, and its arithmetic is a matrix-vector product: two operations for every byte of weight. That is the definition of a memory-bound step.

**Paging** — Storing a variable-length thing in fixed-size blocks that can live anywhere.

A page table maps the logical blocks of a sequence to the physical blocks they occupy. Nothing has to be contiguous, nothing has to be reserved in advance, and the memory that is freed is freed exactly.

**Fragmentation** — Memory that is allocated and not used.

The waste comes in two kinds. Internal fragmentation is the space inside an allocation that the allocation does not need. External fragmentation is the gaps between allocations. Padding a batch to its longest sequence is the first kind at its worst.

**Block size** — How many tokens one unit of the paged memory holds.

The block size is a compromise: a large block wastes more on the tail of each sequence, and a small block means more blocks to look up and more copies to make. The waste falls as the block gets smaller, and the bookkeeping rises.

**The router** — The part of a sparse model that decides which experts see a token.

The router scores the experts for a token and sends the token to the best few. It is a small network on the front of a very large one, and it is the part that has to be right for the sparsity to pay.

**Load balance** — How evenly the tokens are spread across the experts.

A router that sends everything to two experts leaves the other six untrained, and an untrained expert is worse than no expert, because it is still in the model and still gets looked at. The balance is therefore not a nicety; it is the condition for the sparsity to help.

**The capacity factor** — How many tokens an expert may take, as a multiple of its fair share.

The capacity factor is a hard limit on what an expert can accept. When the router sends more than that, the extra tokens are dropped, and they are exactly the tokens that made the routing uneven. The factor is a choice between dropping tokens and overloading the experts.

**The auxiliary loss** — A small extra loss that keeps the experts evenly used.

The auxiliary loss is the number of tokens times the sum, over the experts, of the product of the load fraction and the probability fraction. It is smallest when the two agree, so adding it to the training loss pushes the router towards sending tokens where it said it would.

**Speculation** — Proposing a token cheaply and checking it expensively.

Speculative decoding runs a small model to propose several tokens, then runs the large model once to check all of them. The check is exact, so the output is unchanged; what changes is how many times the expensive model has to run.

**The draft model** — The small model that makes the proposals.

The draft model has to be cheap enough that drafting is worth it, and close enough to the target that its proposals are accepted. The second condition is the binding one: an acceptance rate of zero makes the method slower than doing nothing.

**The acceptance rate** — The fraction of the proposed tokens that are kept.

A drafted token is accepted with probability min(1, p(x)/q(x)), where p is the target’s distribution and q the draft’s. The expected acceptance is one minus the total variation between them: the fraction of the draft’s mass that the target agrees with.

**Total variation** — The largest difference between two distributions, and half the sum of the differences.

Between two discrete distributions, the total variation distance is half the sum of the absolute differences of their probabilities. It is between zero and one, and it is exactly the fraction of the draft’s mass that the target would not have produced.

## Appendix B — Sources

- **FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness** — Tri Dao, Daniel Y. Fu, Stefano Ermon, Atri Rudra, Christopher Ré (2022), arXiv:2205.14135 [cs.LG] / NeurIPS 2022. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The efficiency course covers a KV-cache laboratory but not where the arithmetic actually goes.
- **Efficient Memory Management for Large Language Model Serving with PagedAttention** — Woosuk Kwon, Zhuohan Li, Siyuan Zhuang, Ying Sheng, Lianmin Zheng, Cody Hao Yu, Joseph E. Gonzalez, Hao Zhang, Ion Stoica (2023), arXiv:2309.06180 [cs.DC] / SOSP 2023. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Serving is a memory-allocation problem, and the page-table trick is the standard answer.
- **Outrageously Large Neural Networks: The Sparsely-Gated Mixture-of-Experts Layer** — Noam Shazeer, Azalia Mirhoseini, Krzysztof Maziarz, Andy Davis, Quoc Le, Geoffrey Hinton, Jeff Dean (2017), arXiv:1701.06538 [cs.LG] / ICLR 2017. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Sparse capacity is the main reason parameter counts stopped predicting quality.
- **GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding** — Dmitry Lepikhin, HyoukJoong Lee, Yuanzhong Xu, Dehao Chen, Orhan Firat, Yanping Huang, Maxim Krikun, Noam Shazeer, Zhifeng Chen (2020), arXiv:2006.16668 [cs.LG] / ICLR 2021. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Sparse capacity: the top-k router, the capacity factor that bounds it, the tokens that overflow it, and the auxiliary loss that keeps the experts evenly used.
- **Switch Transformers: Scaling to Trillion Parameter Models with Simple and Efficient Sparsity** — William Fedus, Barret Zoph, Noam Shazeer (2021), arXiv:2101.03961 [cs.LG] / JMLR 2022. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The simplification of MoE routing that made it trainable at scale.
- **SmoothQuant: Accurate and Efficient Post-Training Quantization for Large Language Models** — Guangxuan Xiao, Ji Lin, Mickael Seznec, Hao Wu, Julien Demouth, Song Han (2023), arXiv:2211.10438 [cs.LG] / ICML 2023. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Quantisation is the standard memory saving and the reason activations, not weights, are the hard part.
- **SpecInfer: Accelerating Generative Large Language Model Serving with Tree-based Speculative Inference and Verification** — Xupeng Miao, Gabriele Oliaro, Zhihao Zhang, Xinhao Cheng, Zeyu Wang, Zhengxin Zhang, Rae Ying Yee Wong, Alan Zhu, Lijie Yang, Xiaoxiang Shi, Chunan Shi, Zhuoming Chen, Daiyaan Arfeen, Reyna Abhyankar, Zhihao Jia (2023), arXiv:2305.09781 [cs.DC] / ICASSP 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Speculative decoding turns a memory-bound decode loop into a batched verification, and the acceptance rate is a computable quantity.
- **Medusa: Simple LLM Inference Acceleration Framework with Multiple Decoding Heads** — Tianle Cai, Yuhong Li, Zhengyang Geng, Hongwu Peng, Jason D. Lee, Deming Chen, Tri Dao (2024), arXiv:2401.10774 [cs.CL] / ICML 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Draft-model-free speculation: the acceptance test is a set of heads, not a second model.
- **LoRA: Low-Rank Adaptation of Large Language Models** — Edward J. Hu, Yelong Shen, Phillip Wallis, Zeyuan Allen-Zhu, Yuanzhi Li, Shean Wang, Lu Wang, Weizhu Chen (2021), arXiv:2106.09685 [cs.CL] / ICLR 2022. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The adaptation method every fine-tuning course now teaches.
- **QLoRA: Efficient Finetuning of Quantized LLMs** — Tim Dettmers, Artidoro Pagnoni, Ari Holtzman, Luke Zettlemoyer (2023), arXiv:2305.14314 [cs.CL] / NeurIPS 2023. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Combining quantisation with low-rank adaptation, which is how a single GPU fine-tunes a large model.
