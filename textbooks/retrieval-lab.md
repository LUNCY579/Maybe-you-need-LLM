# Retrieval Lab


**Source:** Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks — Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal, Heinrich Küttler, Mike Lewis, Wen-tau Yih, Tim Rocktäschel, Sebastian Riedel, Douwe Kiela (2020)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Retrieval is one laboratory in the agentic course. The retrieval stack has four distinct layers, each with its own failure mode.

**Source:** Dense Passage Retrieval for Open-Domain Question Answering — Vladimir Karpukhin, Barlas Oğuz, Sewon Min, Patrick Lewis, Ledell Wu, Sergey Edunov, Danqi Chen, Wen-tau Yih (2020)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Dense retrieval is the mechanism that replaced exact lexical matching, and its failure mode is different.

**Source:** ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT — Omar Khattab, Matei Zaharia (2020)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Late interaction is the third way to score a query against a document, and it sits between lexical and dense.

**Source:** Lost in the Middle: How Language Models Use Long Contexts — Nelson F. Liu, Kevin Lin, John Hewitt, Ashwin Paranjape, Michele Bevilacqua, Fabio Petroni, Percy Liang (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** Long context is treated as a capacity problem in the foundations course. It is also a position problem.

---

## Contents

- [1. Sparse Retrieval](#1-sparse-retrieval)
  - [Lesson 1. The lexical index](#lesson-1-the-lexical-index)
  - [Lesson 2. BM25](#lesson-2-bm25)
- [2. Dense Retrieval](#2-dense-retrieval)
  - [Lesson 3. The learned embedding](#lesson-3-the-learned-embedding)
  - [Lesson 4. The contrastive objective](#lesson-4-the-contrastive-objective)
- [3. Late Interaction](#3-late-interaction)
  - [Lesson 5. The MaxSim score](#lesson-5-the-maxsim-score)
- [4. The Long Context](#4-the-long-context)
  - [Lesson 6. The retrieval-augmented reader](#lesson-6-the-retrieval-augmented-reader)
  - [Lesson 7. Lost in the middle](#lesson-7-lost-in-the-middle)
  - [Lesson 8. What retrieval is for](#lesson-8-what-retrieval-is-for)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — The laboratories](#appendix-b-the-laboratories)
- [Appendix C — Sources](#appendix-c-sources)

## 1. Sparse Retrieval

*Matching the words, exactly*

The lexical index: what it stores, what it scores, and where it fails when the question and the answer use different words.

**Learning outcomes**

- Describe the inverted index and what it costs
- Write the BM25 score and say what each of its two terms does
- Measure the recall of a lexical retriever, and say when it fails

### Lesson 1. The lexical index

*What a lexical retriever stores*

*Estimated study time:* 22 minutes

**What you will learn**

- Describe the inverted index, and say what it costs
- Explain why the index can be precomputed and the query cannot
- Say what a lexical retriever is matching

**The ideas**

- The index maps each word to the documents that contain it.
- The size of the index is the number of postings, and that is what a lexical search really spends.
- A lexical retriever matches words, and it is blind to everything else.

#### Practice

**Q. What does an inverted index store? — multiple-choice *(core)***

- ✓ **For each word, the documents that contain it**
- For each document, its words
- A vector for each document
- The answer to every question

> Correct.

> **Why:** The postings are the whole of the index, and their number is what a lexical search really costs.

#### Go and do it

The postings of the corpus, and the size of the index. Open **Look at the index** in the retrieval-lab application.

**Where this came from**

- §rag:2 Retrieval — The retriever, the index, and the question of whether the retriever is the bottleneck.

**The words this lesson uses**

- **Retrieval** — Finding the documents that are worth reading.
- **The inverted index** — A map from each word to the documents that contain it.
- **A lexical match** — Matching the words, and nothing else.

### Lesson 2. BM25

*Two terms doing all the work*

*Estimated study time:* 26 minutes

**What you will learn**

- Write the BM25 score and say what the two parameters do
- Explain the inverse document frequency and the length normalisation
- Measure the recall, and see where the lexical retriever fails

**The ideas**

- The inverse document frequency says how rare a word is; the saturation says how much of a match is coincidence.
- The length normalisation says how much of a document had to be read to get the match.
- A lexical retriever cannot find an answer that uses different words — and most answers do.

#### Practice

**Q. What does the inverse document frequency do in BM25? — multiple-choice *(core)***

- ✓ **It says how rare the word is, so a common word does not dominate the score**
- It normalises for the length of the document
- It saturates the term frequency
- It counts the postings

> Correct.

> **Why:** A word in every document tells you nothing. The logarithm of the inverse of its document frequency is what stops it from dominating.

**Q. A lexical retriever can find an answer that uses different words from the question. — boolean *(core)***

> **Answer:** False

> **Why:** No. It matches words, and it is blind to everything else. That blind spot is the whole reason the dense retriever exists.

#### Go and do it

The BM25 score of every document, and the recall it achieves. Open **Score the documents** in the retrieval-lab application.

**Where this came from**

- §rag:2 Retrieval — The retrieval stage of the pipeline, and the index it needs.

**The words this lesson uses**

- **BM25** — The score that most lexical retrieval still uses.
- **The inverse document frequency** — How rare a word is in the collection.
- **Recall at k** — The fraction of the questions whose answer is in the first k results.

*Read first:* The lexical index

## 2. Dense Retrieval

*Matching the meaning, approximately*

The learned embedding: how a question and a document are put in the same space, how the space is learned, and what the contrastive objective rewards.

**Learning outcomes**

- Describe the dual encoder and why the document vectors can be precomputed
- State the contrastive objective and say what the in-batch negatives are for
- Measure a dense retriever’s recall against the lexical one’s

### Lesson 3. The learned embedding

*A question and a document in the same space*

*Estimated study time:* 26 minutes

**What you will learn**

- Describe the dual encoder and what it embeds
- Explain why the document vectors can be precomputed and the question’s cannot
- Say what a single vector loses, and what it buys

**The ideas**

- The retriever embeds the question and the document separately and compares the two vectors.
- The document vectors never change, so the index is a matrix and the search is a matrix product.
- One vector per document is cheap; one vector per token is not.

#### Practice

**Q. Why does the dual encoder let the document vectors be precomputed? — multiple-choice *(core)***

- ✓ **Because the document is embedded without the question**
- Because the embedding is low-dimensional
- Because the documents are shorter than the questions
- Because the index is stored on disk

> Correct.

> **Why:** The document’s vector does not depend on what is being asked, so it can be computed once, and the search becomes a matrix product.

#### Go and do it

The embedding of a question and of a document, and the score between them. Open **Embed and compare** in the retrieval-lab application.

**Where this came from**

- §dpr:3 The dense retriever — The encoder, the index, and the precomputation that makes it affordable.

**The words this lesson uses**

- **Dense retrieval** — Matching the meaning, by comparing two vectors.
- **The dual encoder** — Two encoders, one for the question and one for the document.
- **The embedding** — The vector a piece of text is turned into.

*Read first:* BM25

### Lesson 4. The contrastive objective

*What the embedding is trained to do*

*Estimated study time:* 28 minutes

**What you will learn**

- State the contrastive objective in words
- Say what the in-batch negatives are, and why they are nearly free
- Compare the trained retriever with the lexical one on the same questions

**The ideas**

- The objective is that a question should be closer to its own answer than to the other answers in the batch.
- The other answers in the batch are free negatives, and they are what makes the training cheap.
- The learned retriever beats the lexical one exactly where the lexical one is blind: the mismatch of words.

#### Practice

**Q. What are the in-batch negatives for? — multiple-choice *(core)***

- ✓ **They make one batch of questions into many training examples, almost for free**
- They make the loss unbiased
- They replace the positive examples
- They reduce the size of the index

> Correct.

> **Why:** A batch of B questions gives B×B pairs, of which B are correct. The other B²−B are negatives that cost nothing to obtain.

#### Go and do it

The training curve, and the recall of the trained retriever against the lexical one. Open **Train the retriever** in the retrieval-lab application.

**Where this came from**

- §dpr:4 The training objective — The question–passage pairs, the in-batch negatives, and the contrastive loss.

**The words this lesson uses**

- **The contrastive objective** — The question should be closer to its own answer than to the others.
- **A negative example** — Something the question is not about.
- **The in-batch negatives** — The other answers in the batch, used as negatives.

*Read first:* The learned embedding

## 3. Late Interaction

*Token by token, and the index it costs*

The MaxSim score: a question and a document compared word by word, the price of storing a vector per word, and the length bias that comes with it.

**Learning outcomes**

- Write the MaxSim score and say what it compares
- Explain why the index is far larger, and measure how much larger
- Measure the length bias of the score, and what the normalisation does to it

### Lesson 5. The MaxSim score

*Comparing a question and a document word by word*

*Estimated study time:* 26 minutes

**What you will learn**

- Write the MaxSim score and say what it compares
- Explain what the late interaction buys over a single vector
- Measure the length bias of the score

**The ideas**

- The score is the sum, over the question’s words, of the best-matching word of the document.
- The document’s vectors can still be precomputed, so the search is still cheap — but there are far more of them.
- The maximum is taken over more candidates in a longer document, and the score inherits that bias.

#### Practice

**Q. What does the MaxSim score compare? — multiple-choice *(core)***

- ✓ **Each word of the question with the best-matching word of the document**
- One vector of the question with one vector of the document
- The words of the question with the words of the document, in order
- The topics of the question and the document

> Correct.

> **Why:** The sum, over the question’s words, of the maximum similarity to any word of the document. It rewards a document for containing something that matches each part of the question.

**Q. The MaxSim score is larger for a longer document, all else equal. — boolean *(hard)***

> **Answer:** True

> **Why:** Yes. The maximum is taken over more candidates in a longer document, and the score inherits that. It is a real bias, it is measurable, and the laboratory measures it.

#### Go and do it

The MaxSim score of every document, and the length bias it carries. Open **Compare word by word** in the retrieval-lab application.

**Where this came from**

- §colbert:3 Late interaction — The MaxSim scoring function, and the index it implies.
- §colbert:4 Efficiency — The precomputation of the document vectors, and the cost of the index.

**The words this lesson uses**

- **Late interaction** — Comparing the two texts at the end, not at the beginning.
- **The MaxSim score** — For each word of the question, the best-matching word of the document.
- **The length bias** — A score that grows with the length of the document it scores.
- **A multi-hop question** — A question whose answer needs more than one document.

*Read first:* The learned embedding

## 4. The Long Context

*Where the evidence is put, and whether it is used*

The retrieval-augmented reader, the position effect, and the argument that a long context is not a substitute for a good retriever.

**Learning outcomes**

- Describe the retrieval-augmented reader and what it changes
- Measure how a reader’s use of a document depends on where the document is
- Compare a long-context reader with one that is given the evidence by retrieval

### Lesson 6. The retrieval-augmented reader

*What the retrieval is for*

*Estimated study time:* 24 minutes

**What you will learn**

- Describe the retrieval-augmented reader and what it changes about the model
- Explain the claim that parametric memory is a poor substitute for a retrieved document
- Say what the marginal utility of an extra passage is

**The ideas**

- The retriever supplies the facts and the reader supplies the reasoning.
- More passages help until the noise in them starts to cost more than the facts are worth.
- The evidence has to be used, not merely present.

#### Practice

**Q. What is the division of labour in a retrieval-augmented system? — multiple-choice *(core)***

- ✓ **The retriever supplies the facts and the reader does the reasoning**
- The retriever does the reasoning and the reader supplies the facts
- Both do both
- The retriever trains the reader

> Correct.

> **Why:** The facts come from the retriever, so that the parameters do not have to contain them, and the reader does what the parameters are good at.

#### Go and do it

The reader, with the evidence retrieved for it and with the evidence lost. Open **Read with the evidence** in the retrieval-lab application.

**Where this came from**

- §rag:1 Introduction — The claim: parametric memory is a poor substitute for a retrieved document.
- §rag:3 Generation — The reader, and the passages it is given.

**The words this lesson uses**

- **The reader** — The model that answers the question once the evidence is in front of it.
- **Retrieval-augmented generation** — A generator that is given documents it did not learn.
- **The marginal utility of a passage** — How much the next passage helps, and when it stops.
- **Parametric memory** — The knowledge a model keeps in its weights.
- **Non-parametric memory** — The knowledge a system keeps in an index instead of its weights.

*Read first:* The contrastive objective

### Lesson 7. Lost in the middle

*A context is not a place*

*Estimated study time:* 26 minutes

**What you will learn**

- Describe the position effect and what it measures
- Measure how a reader’s use of a document depends on where the document is
- Compare a long-context reader with one that is given the evidence by retrieval

**The ideas**

- The evidence near the beginning and near the end of a context is used well; the evidence in the middle is not.
- So a long context is not a substitute for retrieval: it is a place where retrieved evidence can be lost.
- Putting the evidence where the reader looks is a design decision, and it is measurable.

#### Practice

**Q. What does the position effect say? — multiple-choice *(core)***

- ✓ **The evidence in the middle of a long context is used worse than the evidence at the ends**
- A model can only read the first page of a context
- Long contexts are useless
- The middle of a context is corrupted

> Correct.

> **Why:** The effect is measurable with a needle in a haystack, and it is a property of how models attend rather than of the content.

**Q. Putting the retrieved passages at the start of the context is a meaningful design decision. — boolean *(core)***

> **Answer:** True

> **Why:** Yes. The reader looks at the beginning and the end, so where the retriever puts the evidence decides whether the evidence is used.

#### Go and do it

A document in a context, moved from the beginning to the end, and the attention it receives. Open **Move the needle** in the retrieval-lab application.

**Where this came from**

- §lost:1 Introduction — The claim: a model’s use of a long context is not uniform.
- §lost:3 The experiments — The key-value retrieval task, and the position effect it measures.
- §lost:4 The discussion — What the position effect means for the design of a retrieval-augmented system.

**The words this lesson uses**

- **The position effect** — Where a document sits in the context changes how much it is used.
- **A long context** — A window big enough to hold the documents — and what the model does with them.
- **The attention prior** — The position-dependent part of where a model looks.

*Read first:* The retrieval-augmented reader

### Lesson 8. What retrieval is for

*And what a long context is not*

*Estimated study time:* 22 minutes

**What you will learn**

- Put the two arguments together: the retriever finds the facts, and the reader has to use them
- Say what a long context changes and what it does not
- Measure the case: retrieval against a long context, on the same questions

**The ideas**

- A long context raises the ceiling on what can be answered and lowers the floor on what is answered well.
- Retrieval is what puts the evidence where the reader will look at it.
- The two are not alternatives: the retriever decides what is in the context, and the reader decides whether it is used.

#### Practice

**Q. Is a long context a substitute for a good retriever? — multiple-choice *(core)***

- ✓ **No: a long context raises the ceiling, and the position effect lowers the floor**
- Yes: put everything in and the model will find it
- Yes, for tasks with a single document
- No, because retrieval is always cheaper

> Correct.

> **Why:** Everything can be present in a long context and a good deal of it can still be ignored. Retrieval is what puts the evidence where the reader will look.

#### Go and do it

The long-context reader against the retrieval-augmented one, on the same questions. Open **Compare the two** in the retrieval-lab application.

**Where this came from**

- §rag:3.1 Marginal utility — How the reader’s use of the passages changes as more of them are added.

**The words this lesson uses**

- **Retrieval-augmented generation** — A generator that is given documents it did not learn.
- **The position effect** — Where a document sits in the context changes how much it is used.

*Read first:* Lost in the middle

## Appendix A — Glossary

**Retrieval** — Finding the documents that are worth reading.

Retrieval is the search that happens before the reading. It is the part of the system that decides which facts the model will have, and it is the part that decides the ceiling on what the model can answer.

**The inverted index** — A map from each word to the documents that contain it.

The inverted index is what a lexical search is built on: for each word, the postings that say which documents contain it and how often. Its size — the number of postings — is what a lexical search really costs.

**A lexical match** — Matching the words, and nothing else.

A lexical retriever compares the words of a question with the words of a document. It is fast, it is explainable, and it cannot find an answer that uses different words — which is most answers.

**BM25** — The score that most lexical retrieval still uses.

BM25 multiplies the inverse document frequency of a word by a term-frequency factor that saturates, and it divides by a length normalisation. The three parts say: how rare the word is, how much of a match is coincidence, and how much of the document had to be read to get it.

**The inverse document frequency** — How rare a word is in the collection.

A word in every document tells you nothing, and a word in one document tells you a great deal. The inverse document frequency is the logarithm of the inverse of the fraction of documents that contain the word, and it is the reason a common word does not dominate a lexical score.

**Recall at k** — The fraction of the questions whose answer is in the first k results.

Recall at k is the scoreboard of a retriever. It is measured against a known answer, and the random ranking gives the number to beat: a retriever that cannot do better than random has learned nothing.

**Dense retrieval** — Matching the meaning, by comparing two vectors.

A dense retriever embeds the question and the document separately and ranks by the similarity of the two vectors. Because the document vectors never change, the index is a matrix and the search is a matrix product.

**The dual encoder** — Two encoders, one for the question and one for the document.

The dual encoder embeds the question and the document independently, which is what makes the precomputation possible. The alternative — one encoder over the pair — is more expressive and cannot be precomputed, and the whole practical argument for dense retrieval is the precomputation.

**The embedding** — The vector a piece of text is turned into.

An embedding is a fixed-length vector that stands for a piece of text. The retriever learns it, and the learning is what makes it a *dense* representation: the words that belong together end up in the same direction.

**The contrastive objective** — The question should be closer to its own answer than to the others.

The objective is a classification problem: the answer is on the diagonal of a matrix of scores, and the loss is the cross-entropy of that. Everything the embedding learns comes from being wrong about the other answers.

**A negative example** — Something the question is not about.

A negative is what the model is told *not* to retrieve. In the contrastive setup the other answers in the batch serve as the negatives, which is what makes the training cheap: they are already there.

**The in-batch negatives** — The other answers in the batch, used as negatives.

Every batch of B questions gives B×B question–answer pairs, of which B are correct and the rest are negatives. It is a trick that turns one training example into B of them, and it is why the contrastive objective scales the way it does.

**Late interaction** — Comparing the two texts at the end, not at the beginning.

A late-interaction retriever embeds each text word by word, and only compares the two sets of vectors at scoring time. It is more expressive than a single vector, and the index it needs is far larger.

**The MaxSim score** — For each word of the question, the best-matching word of the document.

The score is the sum, over the question’s words, of the maximum similarity to any word of the document. It rewards a document for containing something that matches each part of the question, which a single vector cannot do.

**The length bias** — A score that grows with the length of the document it scores.

When a maximum is taken over more candidates, it is larger. So a score built out of maxima prefers the longer document, whether or not the longer document is more relevant. The bias is measurable, and so is what a correction does to it.

**The reader** — The model that answers the question once the evidence is in front of it.

The reader is the model that reads the retrieved passages and produces the answer. The division of labour is the point: the retriever supplies the facts, and the reader does the reasoning.

**Retrieval-augmented generation** — A generator that is given documents it did not learn.

The pipeline is a retriever and a reader, and the claim is that the facts should come from the retriever rather than from the parameters. The claim is about *where the knowledge lives*, and it is not a claim that the parameters are useless.

**Parametric memory** — The knowledge a model keeps in its weights.

Parametric memory is what a model knows because it was trained: the facts are distributed across the weights, with no address and no way to delete one. It is bought once, at training time, and it cannot be corrected without training again.

**Non-parametric memory** — The knowledge a system keeps in an index instead of its weights.

Non-parametric memory is the passages and their vectors. It is written and deleted one entry at a time, and it can be inspected and cited. The price is that it grows with the corpus, while the weights do not.

**A multi-hop question** — A question whose answer needs more than one document.

A multi-hop question needs two pieces of evidence at once, one for each of its aspects. A retriever that can match only one aspect, or that averages the aspects into a single vector, will find one document and miss the other.

**The marginal utility of a passage** — How much the next passage helps, and when it stops.

Each retrieved passage adds information and adds noise. The marginal utility is the difference: it is positive while the passage is more likely to contain the answer than to mislead, and negative after that.

**The position effect** — Where a document sits in the context changes how much it is used.

The evidence at the beginning and at the end of a long context is used well, and the evidence in the middle is used badly. The effect is a property of how models attend, and it is measurable with a needle in a haystack.

**The attention prior** — The position-dependent part of where a model looks.

Before a model looks at anything, it already has a preference: the beginning of the context, the most recent tokens, and the attention sinks at the very start. The prior is what the position effect rides on.

**A long context** — A window big enough to hold the documents — and what the model does with them.

A long context raises the ceiling on what can be answered, because everything can be present at once. It does not follow that everything is used: the position effect says a good deal of a long context is ignored.

## Appendix B — The laboratories

Every laboratory the course ships. Each one runs in the application and computes everything it shows in the browser; this appendix is the catalogue of what exists and what it is for.

### A · The sparse index

*Matching the words, exactly.*

### B · The dense retriever

*Matching the meaning, approximately.*

**Delivers:**

- A bi-encoder over a toy corpus
- The three query and document encoders
- Recall as a function of embedding dimension

### C · The late interaction

*Word by word, and the index it costs.*

**Delivers:**

- MaxSim scoring
- Why late interaction beats both endpoints on multi-hop questions

### D · The long context

*Where the evidence is put, and whether it is used.*

**Delivers:**

- Parametric versus non-parametric memory
- Accuracy as a function of the position of the evidence

## Appendix C — Sources

- **Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks** — Patrick Lewis, Ethan Perez, Aleksandra Piktus, Fabio Petroni, Vladimir Karpukhin, Naman Goyal, Heinrich Küttler, Mike Lewis, Wen-tau Yih, Tim Rocktäschel, Sebastian Riedel, Douwe Kiela (2020), arXiv:2005.11401 [cs.CL] / NeurIPS 2020. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Retrieval is one laboratory in the agentic course. The retrieval stack has four distinct layers, each with its own failure mode.
- **Dense Passage Retrieval for Open-Domain Question Answering** — Vladimir Karpukhin, Barlas Oğuz, Sewon Min, Patrick Lewis, Ledell Wu, Sergey Edunov, Danqi Chen, Wen-tau Yih (2020), arXiv:2004.04906 [cs.CL] / EMNLP 2020. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Dense retrieval is the mechanism that replaced exact lexical matching, and its failure mode is different.
- **ColBERT: Efficient and Effective Passage Search via Contextualized Late Interaction over BERT** — Omar Khattab, Matei Zaharia (2020), arXiv:2004.12832 [cs.IR] / SIGIR 2020. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Late interaction is the third way to score a query against a document, and it sits between lexical and dense.
- **Lost in the Middle: How Language Models Use Long Contexts** — Nelson F. Liu, Kevin Lin, John Hewitt, Ashwin Paranjape, Michele Bevilacqua, Fabio Petroni, Percy Liang (2023), arXiv:2307.03172 [cs.CL] / TACL 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  Long context is treated as a capacity problem in the foundations course. It is also a position problem.
