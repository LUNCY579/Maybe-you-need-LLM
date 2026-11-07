# Multimodal Lab


**Source:** Learning Transferable Visual Models From Natural Language Supervision — Alec Radford, Jong Wook Kim, Chris Hallacy, Aditya Ramesh, Gabriel Goh, Sandhini Agarwal, Girish Sastry, Amanda Askell, Pamela Mishkin, Jack Clark, Gretchen Krueger, Ilya Sutskever (2021)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Nothing in the collection handles a second modality at all.

**Source:** Flamingo: a Visual Language Model for Few-Shot Learning — Jean-Baptiste Alayrac, Jeff Donahue, Pauline Luc, Antoine Miech, Iain Barr, Yana Hasson, Karel Lenc, Arthur Mensch, Katie Millican, Malcolm Reynolds, Roman Ring, Eliza Rutherford, Serkan Cabi, Tengda Han, Zhitao Gong, Sina Samangooei, Marianne Monteiro, Jacob Menick, Sebastian Borgeaud, Andrew Brock, Aida Nematzadeh, Sahand Sharifzadeh, Mikolaj Binkowski, Ricardo Barreira, Oriol Vinyals, Andrew Zisserman, Karen Simonyan (2022)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Few-shot learning with interleaved images and text, and the Perceiver resampler that makes it cheap.

**Source:** Visual Instruction Tuning — Haotian Liu, Chunyuan Li, Qingyang Wu, Yong Jae Lee (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The recipe that turned a vision encoder plus a language model into a chat model, with almost no new parameters.

**Source:** Sigmoid Loss for Language Image Pre-Training — Xiaohua Zhai, Basil Mustafa, Alexander Kolesnikov, Lucas Beyer (2023)

**Licence:** CC BY 4.0 (as stated on the arXiv record).

**Why this course exists:** The contrastive loss normalised over the batch; the pairwise sigmoid loss is the later alternative, and the coupling experiment measures the difference.

**Source:** BLIP-2: Bootstrapping Language-Image Pre-training with Frozen Image Encoders and Large Language Models — Junnan Li, Dongxu Li, Silvio Savarese, Steven Hoi (2023)

**Licence:** CC BY 4.0 (as stated on the arXiv record).

**Why this course exists:** Nothing in the collection showed a frozen-encoder bridge, or priced what is trained against what is held still.

**Source:** An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale — Alexey Dosovitskiy, Lucas Beyer, Alexander Kolesnikov, Dirk Weissenborn, Xiaohua Zhai, Thomas Unterthiner, Mostafa Dehghani, Matthias Minderer, Georg Heigold, Sylvain Gelly, Jakob Uszkoreit, Neil Houlsby (2020)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The patch embedding that turns an image into tokens was assumed, never shown.

---

## Contents

- [1. Contrastive Pretraining](#1-contrastive-pretraining)
  - [Lesson 1. The contrastive objective](#lesson-1-the-contrastive-objective)
  - [Lesson 2. The data and the batch](#lesson-2-the-data-and-the-batch)
- [2. The Modality Gap](#2-the-modality-gap)
  - [Lesson 3. The modality gap](#lesson-3-the-modality-gap)
  - [Lesson 4. Zero-shot](#lesson-4-zero-shot)
- [3. Instruction Tuning](#3-instruction-tuning)
  - [Lesson 5. The instruction recipe](#lesson-5-the-instruction-recipe)
  - [Lesson 6. The alignment tax](#lesson-6-the-alignment-tax)
- [4. The Loss and the Bridge](#4-the-loss-and-the-bridge)
  - [Lesson 7. The sigmoid loss](#lesson-7-the-sigmoid-loss)
  - [Lesson 8. The frozen bridge](#lesson-8-the-frozen-bridge)
  - [Lesson 9. The resampler](#lesson-9-the-resampler)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — The laboratories](#appendix-b-the-laboratories)
- [Appendix C — Sources](#appendix-c-sources)

## 1. Contrastive Pretraining

*Two encoders, one space, and no labels at all*

The loss that says a pair should be closer than the other pairs in the batch, the temperature that decides how sharp it is, and the data that pays for it.

**Learning outcomes**

- State the contrastive objective and say what the in-batch negatives are for
- Explain what the temperature does, and why it is a decision rather than a constant
- Measure how the retrieval improves with the batch size and with the data

### Lesson 1. The contrastive objective

*What the loss says, and who provides the negatives*

*Estimated study time:* 28 minutes

**What you will learn**

- State the objective in words and write the loss
- Explain where the negatives come from and what they cost
- Say what the temperature does to the loss

**The ideas**

- The loss asks for the paired image and caption to be closer than the other pairs in the batch.
- The negatives are the other pairs in the batch, and they are free.
- The temperature decides how sharp the distribution over the batch is.

#### Practice

**Q. What does the contrastive loss ask for? — multiple-choice *(core)***

- ✓ **The paired image and caption to score higher than every other pair in the batch**
- The image to be classified as the caption’s class
- The two encoders to be identical
- The batch to contain one pair of each class

> Correct.

> **Why:** It is a cross-entropy over the batch, with the true pairing on the diagonal. Nothing in it needs a label.

**Q. The in-batch negatives are free: they are the other pairs the batch already contains. — boolean *(core)***

> **Answer:** True

> **Why:** Yes. A batch of B pairs gives B² pairs of which B are correct, and the rest cost nothing — which is why the method scales with the size of the batch.

#### Go and do it

The loss, the gradient, and the retrieval, with the temperature and the batch size exposed. Open **Train the contrastive model** in the multimodal-lab application.

**Where this came from**

- §clip:2.1 The contrastive objective — The loss, the in-batch negatives, and the temperature.

**The words this lesson uses**

- **The contrastive loss** — The paired image and caption should be closer than the other pairs in the batch.
- **The in-batch negatives** — The other pairs in the batch, used as things not to match.
- **The temperature** — How sharp the distribution over the batch is.

### Lesson 2. The data and the batch

*What the scale of the pretraining buys*

*Estimated study time:* 24 minutes

**What you will learn**

- Say what the number of pairs does to the retrieval
- Explain why a larger batch gives more negatives and a better estimate
- Describe the precomputation that makes the index affordable

**The ideas**

- More pairs is more supervision, and the retrieval improves with it.
- A larger batch is more negatives for the same cost, and a better estimate.
- The document vectors never change, so the index is a matrix and the search is a matrix product.

#### Practice

**Q. Why can the document vectors be computed once and stored? — multiple-choice *(core)***

- ✓ **Because a document’s embedding does not depend on what is being retrieved**
- Because the encoder is small
- Because the training has finished
- Because the index is approximate

> Correct.

> **Why:** So the index is a matrix and the search is a matrix product — which is what makes a corpus of billions affordable.

#### Go and do it

The retrieval against the batch size and against the number of pairs. Open **Scale the batch and the data** in the multimodal-lab application.

**Where this came from**

- §clip:3 Results — The zero-shot transfer, and the size of the pretraining dataset.

**The words this lesson uses**

- **The in-batch negatives** — The other pairs in the batch, used as things not to match.
- **Retrieval** — Finding the caption that belongs with an image, among all of them.

*Read first:* The contrastive objective

## 2. The Modality Gap

*Two spaces that are close, and not the same space*

The images and the captions end up in one space, and the space is not quite symmetric. The gap, and the zero-shot classifier that works anyway.

**Learning outcomes**

- Define the modality gap and say how it is measured
- Describe the zero-shot classifier, and the part the prompt plays in it
- Explain why the classifier works at all, given the gap

### Lesson 3. The modality gap

*One space, and a seam down the middle of it*

*Estimated study time:* 24 minutes

**What you will learn**

- Define the gap and say how it is measured
- Explain what it means for a retrieval that works
- Say what closing it would cost

**The ideas**

- The images and the captions end up in one space, but the two halves are further apart than either half is from itself.
- A retrieval works anyway, because the *pairs* are close even though the *spaces* are not.
- So the gap is a property of the representation, not a failure of the method.

#### Practice

**Q. What is the modality gap? — multiple-choice *(core)***

- ✓ **The two modalities are further apart in the shared space than either is from itself**
- The two encoders have different numbers of parameters
- The training data has more images than captions
- The retrieval is inaccurate

> Correct.

> **Why:** A retrieval works anyway, because the *pairs* are close even though the two *spaces* are not.

#### Go and do it

The within-modal and the between-modal similarities, and the gap between them. Open **Measure the gap** in the multimodal-lab application.

**Where this came from**

- §clip:2 Method — The encoders, and the precomputation that makes the index affordable.

**The words this lesson uses**

- **The modality gap** — The two modalities are further apart than either is from itself.
- **The embedding space** — The space the encoders put things in.

*Read first:* The contrastive objective

### Lesson 4. Zero-shot

*Classifying with the class names and nothing else*

*Estimated study time:* 26 minutes

**What you will learn**

- Describe the zero-shot classifier and why it works at all
- Say what part the prompt plays, and measure what it is worth
- Explain the connection to the retrieval the model was trained for

**The ideas**

- The class names are embedded with the text encoder, and the image is assigned to the closest of them.
- The model was never trained to classify; it was trained to match a caption, and the class names are captions.
- The prompt is part of the method, and a different template gives a different score.

#### Practice

**Q. Why does the zero-shot classifier work at all? — multiple-choice *(core)***

- ✓ **Because a class name is a caption, and the model was trained to match captions to images**
- Because the model was trained to classify
- Because the embeddings are normalised
- Because the batch contained the classes

> Correct.

> **Why:** The classifier is a retrieval against a set of captions that happen to be the class names.

#### Go and do it

The zero-shot accuracy, and what each prompt template is worth. Open **Classify with the names** in the multimodal-lab application.

**Where this came from**

- §clip:3 Results — The zero-shot transfer, and the prompts it is measured with.

**The words this lesson uses**

- **Zero-shot** — Doing the task with no examples of it.
- **The prompt template** — The sentence the class name is put into.

*Read first:* The modality gap

## 3. Instruction Tuning

*Getting better at instructions, and what it costs*

The recipe that turns a model into an assistant, and the tax it pays on everything it was good at before.

**Learning outcomes**

- Describe the three stages of the recipe
- Measure the alignment tax, and say what it is a tax on
- Explain why the tax is a fact about training rather than a defect of the method

### Lesson 5. The instruction recipe

*Three stages, and what each one is for*

*Estimated study time:* 24 minutes

**What you will learn**

- Describe the three stages of the recipe
- Say what the visual instruction tuning adds to it
- Explain why the stages are in that order
- Say what the projection changes about a visual token, and what it costs

**The ideas**

- The stages are: align the model to instructions, then teach it to read images, then tune it on visual instructions.
- Each stage is a different kind of data, and the order is what makes the last one work.
- The projection is a learned linear map from the vision width to the language width; it changes the width of a token, not its count.
- The model that comes out is a different model from the one that went in.

#### Practice

**Q. What does instruction tuning do? — multiple-choice *(core)***

- ✓ **Tunes the model on instructions and their answers, so that it follows instructions**
- Trains the model from scratch on instructions
- Changes the tokenizer
- Makes the model multimodal

> Correct.

> **Why:** And the model that comes out is a different model from the one that went in — which is the next lesson.

**Q. A 1024-wide vision token is projected to 4096 dimensions by a linear layer with a bias. How many parameters does the layer have? — numeric *(hard)***

> **Answer:** 4198400

> **Why:** 1024 × 4096 = 4,194,304 entries in the matrix, plus 4096 bias terms, is 4,198,400. The number of tokens does not appear: the same matrix projects 576 tokens or four.

#### Go and do it

The gain on the instructions and the tax on everything else, as the tuning is strengthened. Open **Run the recipe** in the multimodal-lab application.

**Where this came from**

- §llava:2 The method — Instruction tuning on visual data, and the three stages of the recipe.

**The words this lesson uses**

- **Instruction tuning** — Tuning a model on instructions and the answers to them.
- **The alignment tax** — What the instruction tuning gives up on the tasks it was good at.

*Read first:* Zero-shot

### Lesson 6. The alignment tax

*What the tuning takes away*

*Estimated study time:* 24 minutes

**What you will learn**

- Define the alignment tax and say what it is measured on
- Measure the gain and the tax, and the ratio between them
- Explain why the tax is a fact about training and not a defect of the method

**The ideas**

- Tuning on instructions makes the model better at instructions and slightly worse at what it was good at.
- The tax is a measurement on the original task, before and after — not a claim.
- And it is a consequence of the training, which means it is something the training can be made to avoid.

#### Practice

**Q. What is the alignment tax? — multiple-choice *(core)***

- ✓ **The accuracy the model gives up on its original task, measured before and after the tuning**
- The cost of running the tuning
- The size of the instruction dataset
- A failure of the method

> Correct.

> **Why:** It is a measurement on the original task, and the ratio between the gain and the tax is the number a practitioner is shopping for.

#### Go and do it

The gain, the tax, and the ratio between them. Open **Pay the tax** in the multimodal-lab application.

**Where this came from**

- §llava:3 The results — The benchmarks, and the effect of the data mixtures on what the model keeps.
- §flamingo:2 The method — The interleaved sequence, and the few-shot learning it buys.

**The words this lesson uses**

- **The alignment tax** — What the instruction tuning gives up on the tasks it was good at.
- **Instruction tuning** — Tuning a model on instructions and the answers to them.

*Read first:* The instruction recipe

## 4. The Loss and the Bridge

*What the objective normalises, and what the method holds still*

Two later answers to the same recipe: a loss that decides each pair on its own, an architecture that freezes both towers and trains only the small part between them, and a resampler that bounds the visual token count.

**Learning outcomes**

- Say what the softmax normalises, and show that the sigmoid loss does not normalise it
- Measure the coupling between a pair and the rest of its batch
- Say what is trained in a frozen-encoder bridge, and read its parameter bill
- Explain how a fixed set of latents bounds the number of visual tokens

### Lesson 7. The sigmoid loss

*One decision per pair, and no denominator*

*Estimated study time:* 26 minutes

**What you will learn**

- Say what the softmax normalises and what that couples together
- Read the same row of a batch under both losses
- Explain what the bias balances, and why its value depends on the batch

**The ideas**

- The softmax turns each row of the batch into a distribution, so one pair’s loss depends on every other pair.
- The sigmoid loss is a sum of independent pair decisions, and a pair’s loss is a function of that pair alone.
- The bias is the count of negatives, written as a probability; it is learned, but its starting point is a fact about the batch.

#### Practice

**Q. What does the sigmoid loss remove from the contrastive objective? — multiple-choice *(core)***

- ✓ **The normalisation over the batch**
- The image encoder
- The negatives
- The temperature

> Correct.

> **Why:** Each pair is a logistic decision of its own, so the loss of one pair no longer contains a term from every other pair in the batch.

**Q. Appending an unrelated pair to the batch leaves the sigmoid loss of an existing pair exactly unchanged. — boolean *(core)***

> **Answer:** True

> **Why:** Yes. The pair’s loss is a function of its own similarity, its label and the two learned constants. The softmax loss of its row, by contrast, changes, because the denominator has grown.

**Q. With a scale of 10, a bias of 0 and a similarity of 0, what is the sigmoid loss of one pair? (Three decimal places.) — numeric *(hard)***

> **Answer:** 0.693 ± 0.001

> **Why:** The logit is 0, and −log σ(0) = log 2 ≈ 0.693. The label does not matter at zero: a positive and a negative pair are equally undecided.

#### Go and do it

Append unrelated pairs to the batch and watch one loss move while the other does not. Open **Break the coupling** in the multimodal-lab application.

**Where this came from**

- §siglip:3.1 The sigmoid loss — The pairwise logistic loss, and the removal of the normalisation over the batch.
- §siglip:4.8 The negative-to-positive ratio — What the loss does as the unmatched pairs come to outnumber the matched ones.
- §siglip:4.9 The bias term — The learned bias, and the initialisation that matches it to the size of the batch.

**Further reading**

- [Zhai et al., “Sigmoid Loss for Language Image Pre-Training”](https://arxiv.org/abs/2303.15343) — the paper this lesson is built on; the loss and the batch experiments are in §3 and §4.

**The words this lesson uses**

- **The sigmoid loss** — Every pair is a yes-or-no question, decided on its own.
- **Coupling** — The dependence of one pair’s loss on the rest of the batch.
- **The bias of the loss** — The learned offset b that decides how likely a match is at zero similarity.

*Read first:* The contrastive objective

### Lesson 8. The frozen bridge

*Patches, queries, and the towers that do not move*

*Estimated study time:* 28 minutes

**What you will learn**

- Say what the image encoder, the queries and the language model each do
- Explain why the patch tokens exist, and what a learned query reads from them
- Read the parameter bill of the bridge, and the share of it that is trained

**The ideas**

- A vision transformer cuts the image into patches and treats each patch as a token, which is what lets an image encoder be a transformer at all.
- BLIP-2 keeps both towers frozen and trains a small set of queries to read the patch tokens and present them to the language model.
- Freezing means the towers contribute most of the parameters and none of the gradient; the trainable share is the number the method is selling.

#### Practice

**Q. In BLIP-2, which parts of the system are trained? — multiple-choice *(core)***

- ✓ **The learned queries and the bridge around them**
- The image encoder
- The language model
- All of it, end to end

> Correct.

> **Why:** Both towers are frozen, and only the Q-Former and the projection are trained — which is what makes the bridge cheap next to the towers.

**Q. Widening the bridge leaves the number of frozen parameters unchanged. — boolean *(hard)***

> **Answer:** True

> **Why:** Yes. The frozen towers are what they are; the bridge’s width changes only the trainable side, which is the whole point of the accounting in the laboratory.

#### Go and do it

A learned query over the patch tokens, and the parameter bill of the bridge that carries it. Open **Read the patches** in the multimodal-lab application.

**Where this came from**

- §blip2:3.1 The model architecture — The frozen encoder, the Q-Former’s learned queries, and the frozen language model.
- §blip2:3.2 Learning with the frozen image encoder — The queries are trained to read the encoder’s tokens, and the encoder is not trained at all.
- §vit:3.1 The vision transformer — The image is cut into patches, and the patches are the tokens.

**Further reading**

- [Li et al., “BLIP-2”](https://arxiv.org/abs/2301.12597) — the Q-Former, the two pre-training stages, and the frozen towers.
- [Dosovitskiy et al., “An Image is Worth 16x16 Words”](https://arxiv.org/abs/2010.11929) — the patch embedding that every vision transformer in this course is built on.

**The words this lesson uses**

- **A patch token** — A small square of the image, embedded like a word.
- **A frozen encoder** — A network whose weights are held fixed while everything else trains.
- **The Q-Former** — The small learned bridge that reads the image tokens with its own queries.

*Read first:* The contrastive objective

### Lesson 9. The resampler

*A fixed number of vectors for a variable number of tokens*

*Estimated study time:* 24 minutes

**What you will learn**

- Say what the resampler’s latents read, and what the output length is
- Explain why the output length is bounded by the latents and not by the image
- Compare the cost of cross-attention on the latents with attention over every token

**The ideas**

- A resampler is a fixed set of learned latents attending to a variable number of visual tokens; one vector comes out per latent.
- The output length is therefore the number of latents, whatever the resolution or the number of images: the bound is structural, not a truncation.
- The cross-attention costs latents × tokens work, where attention over the raw tokens would cost tokens squared.

#### Practice

**Q. After a resampler, what sets the number of visual tokens the language model reads? — multiple-choice *(core)***

- ✓ **The number of latents in the resampler**
- The resolution of the image
- The patch size of the vision encoder
- The number of images in the interleaved sequence

> Correct.

> **Why:** The resampler has one output vector per latent, so the output length is fixed by the latents and does not grow with the image or with the number of images.

**Q. How many visual tokens does a 448-pixel square image produce with 14-pixel patches? — numeric *(core)***

> **Answer:** 1024

> **Why:** The grid is 448 / 14 = 32 patches per side, and 32 squared is 1,024 tokens going into the resampler — of which a fixed number will come out.

#### Go and do it

The visual token count at four resolutions, and the fixed number of vectors that come out. Open **Bound the tokens** in the multimodal-lab application.

**Where this came from**

- §flamingo:2 The method — The visual encoder, the Perceiver Resampler, and the fixed number of latents it presents to the language model.

**Further reading**

- [Alayrac et al., “Flamingo”](https://arxiv.org/abs/2204.14198) — the resampler, the interleaved sequence, and the few-shot learning it buys.

**The words this lesson uses**

- **The resampler** — A fixed set of latents that reads any number of visual tokens.
- **A patch token** — A small square of the image, embedded like a word.
- **A frozen encoder** — A network whose weights are held fixed while everything else trains.

*Read first:* The frozen bridge

## Appendix A — Glossary

**The contrastive loss** — The paired image and caption should be closer than the other pairs in the batch.

The loss is a cross-entropy over the batch: for each image, the caption it was paired with should score higher than every other caption in the batch. Nothing in it needs a label, which is what makes the scale possible.

**The in-batch negatives** — The other pairs in the batch, used as things not to match.

A batch of B pairs gives B² question–answer pairs, of which B are correct. The other B²−B are negatives, and they cost nothing to obtain, which is the reason the method scales the way it does.

**The temperature** — How sharp the distribution over the batch is.

The similarities are divided by the temperature before the softmax. A small temperature makes the loss care about the single best match; a large one makes it care about the whole distribution. It is a decision, and the laboratory measures what it is worth.

**Retrieval** — Finding the caption that belongs with an image, among all of them.

The score of the pretraining is a retrieval score: given the image, is the right caption the closest one? It is the task the method is trained on, and it is the task the downstream use depends on.

**The embedding space** — The space the encoders put things in.

One space, shared by the two modalities, and the place where "close" means "about the same thing". Its geometry is learned, and the geometry is what the rest of the method exploits.

**The modality gap** — The two modalities are further apart than either is from itself.

Images and captions occupy two distinguishable regions of the shared space. The gap is a fact about the representation, and it is measured rather than assumed.

**Zero-shot** — Doing the task with no examples of it.

The classifier writes the class names out, embeds them, and assigns each image to the closest name. The model was never trained to classify; it was trained to match a caption, and a class name is a caption.

**The prompt template** — The sentence the class name is put into.

The template is part of the method, and a different one gives a different score. It is a small thing that is not optional, and the laboratory measures what each one is worth.

**Instruction tuning** — Tuning a model on instructions and the answers to them.

The stage that turns a model of text into something that follows instructions. It is cheap, it is effective, and it changes the model in ways that have to be measured.

**The alignment tax** — What the instruction tuning gives up on the tasks it was good at.

The tax is measured, not asserted: the accuracy the model had on its original task, before the tuning and after. It is the number that says what the tuning cost.

**Few-shot** — Doing the task from a handful of examples in the prompt.

The examples are in the context rather than in the weights, which is a different mechanism from fine-tuning and a different bill.

**The sigmoid loss** — Every pair is a yes-or-no question, decided on its own.

The loss of a pair is −log σ(y(t·s + b)), with y = +1 for a matched pair and −1 for an unmatched one. There is no distribution over the batch, so the loss of one pair is not changed by any other pair.

**Coupling** — The dependence of one pair’s loss on the rest of the batch.

In the softmax loss the denominator contains every caption in the batch, so a pair’s loss moves when the batch changes, even if the pair does not. The laboratory measures the coupling directly: append an unrelated pair and compare the two losses.

**The bias of the loss** — The learned offset b that decides how likely a match is at zero similarity.

The bias shifts the sigmoid, and it is learned. Its initial value is chosen to match the batch: b = −log(B − 1) makes a zero-similarity pair as likely as a random pair in the batch, which keeps the many negatives from dominating the first steps.

**A patch token** — A small square of the image, embedded like a word.

A vision transformer cuts the image into a grid of patches, embeds each patch as a vector, and feeds the sequence to a transformer. The patch is the unit the encoder reasons over, and the token the bridge reads.

**A frozen encoder** — A network whose weights are held fixed while everything else trains.

No gradient flows through a frozen tower. It contributes its parameters to the bill and none of its parameters to the training, which is what makes a small bridge between two large models affordable.

**The Q-Former** — The small learned bridge that reads the image tokens with its own queries.

A fixed set of learned query vectors attends to the frozen image encoder’s patch tokens, and the result is presented to the language model. Only the queries and the bridge around them are trained.

**The projection layer** — A learned linear map from the vision width to the language width.

A matrix with one row per vision coordinate and one column per language coordinate, applied to every visual token. It changes the width of a token and not its count, so its parameter count depends on the two widths and on nothing else.

**The resampler** — A fixed set of latents that reads any number of visual tokens.

Each latent attends to every visual token and returns one vector, so the language model receives as many vectors as there are latents — whatever the resolution or the number of images. The token count is bounded by the latents, by construction rather than by truncation.

## Appendix B — The laboratories

Every laboratory the course ships. Each one runs in the application and computes everything it shows in the browser; this appendix is the catalogue of what exists and what it is for.

### A · The contrastive model

*Two encoders, one space, the temperature and the loss.*

**Delivers:**

- The contrastive loss and its temperature
- Zero-shot classification as a text-embedding lookup

### B · The instruction tax

*What the tuning gives up, the projection, and the data.*

**Delivers:**

- The projection matrix and its dimension
- Generating instruction data from captions

### C · The sigmoid loss

*No normalisation, no coupling.*

**Delivers:**

- The softmax and the sigmoid loss side by side
- The coupling experiment: an appended pair moves one loss and not the other
- The bias that matches a batch

### D · The frozen bridge

*What is trained, and what is held still.*

**Delivers:**

- Learned queries over patch tokens
- The trainable share of a frozen bridge
- The patch token as the input to the frozen bridge

### E · The resampler

*A fixed number of latents, and a bounded token count.*

**Delivers:**

- The resampler and why it bounds the visual token count

## Appendix C — Sources

- **Learning Transferable Visual Models From Natural Language Supervision** — Alec Radford, Jong Wook Kim, Chris Hallacy, Aditya Ramesh, Gabriel Goh, Sandhini Agarwal, Girish Sastry, Amanda Askell, Pamela Mishkin, Jack Clark, Gretchen Krueger, Ilya Sutskever (2021), arXiv:2103.00020 [cs.CV] / ICML 2021. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Nothing in the collection handles a second modality at all.
- **Flamingo: a Visual Language Model for Few-Shot Learning** — Jean-Baptiste Alayrac, Jeff Donahue, Pauline Luc, Antoine Miech, Iain Barr, Yana Hasson, Karel Lenc, Arthur Mensch, Katie Millican, Malcolm Reynolds, Roman Ring, Eliza Rutherford, Serkan Cabi, Tengda Han, Zhitao Gong, Sina Samangooei, Marianne Monteiro, Jacob Menick, Sebastian Borgeaud, Andrew Brock, Aida Nematzadeh, Sahand Sharifzadeh, Mikolaj Binkowski, Ricardo Barreira, Oriol Vinyals, Andrew Zisserman, Karen Simonyan (2022), arXiv:2204.14198 [cs.CV] / NeurIPS 2022. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Few-shot learning with interleaved images and text, and the Perceiver resampler that makes it cheap.
- **Visual Instruction Tuning** — Haotian Liu, Chunyuan Li, Qingyang Wu, Yong Jae Lee (2023), arXiv:2304.08485 [cs.CV] / NeurIPS 2023. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The recipe that turned a vision encoder plus a language model into a chat model, with almost no new parameters.
- **Sigmoid Loss for Language Image Pre-Training** — Xiaohua Zhai, Basil Mustafa, Alexander Kolesnikov, Lucas Beyer (2023), arXiv:2303.15343 [cs.CV] / ICCV 2023. Licence: CC BY 4.0 (as stated on the arXiv record)..
  The contrastive loss normalised over the batch; the pairwise sigmoid loss is the later alternative, and the coupling experiment measures the difference.
- **BLIP-2: Bootstrapping Language-Image Pre-training with Frozen Image Encoders and Large Language Models** — Junnan Li, Dongxu Li, Silvio Savarese, Steven Hoi (2023), arXiv:2301.12597 [cs.CV] / ICML 2023. Licence: CC BY 4.0 (as stated on the arXiv record)..
  Nothing in the collection showed a frozen-encoder bridge, or priced what is trained against what is held still.
- **An Image is Worth 16x16 Words: Transformers for Image Recognition at Scale** — Alexey Dosovitskiy, Lucas Beyer, Alexander Kolesnikov, Dirk Weissenborn, Xiaohua Zhai, Thomas Unterthiner, Mostafa Dehghani, Matthias Minderer, Georg Heigold, Sylvain Gelly, Jakob Uszkoreit, Neil Houlsby (2020), arXiv:2010.11929 [cs.CV] / ICLR 2021. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The patch embedding that turns an image into tokens was assumed, never shown.
