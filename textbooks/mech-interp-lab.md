# Mechanistic Interpretability Lab


**Source:** Toy Models of Superposition — Noah Elhage, Shan Carter, Chris Olah, Dan Hendrycks (2023)

**Licence:** Publicly readable web publication. The machine-check could not be completed from this environment (the site blocks automated clients); verify the terms on the page itself before reusing any text or figure.

**Why this course exists:** Mechanistic interpretability is only summarised in one chapter of the agentic course, and it is the fastest-moving area in the field.

**Source:** A Mathematical Framework for Transformer Circuits — Noah Elhage, Tristan Hume, Shan Carter, Scott Ostheim, Scott Linderman, Gabe, Dianne Hudon, Chris Olah (2021)

**Licence:** Publicly readable web publication. The machine-check could not be completed from this environment (the site blocks automated clients); verify the terms before reuse.

**Why this course exists:** The vocabulary of weights, activations, pathways and nodes that the rest of the interpretability literature assumes.

**Source:** Towards Automated Circuit Discovery for Mechanistic Interpretability — Arthur Conmy, Augustine N. Mavor-Parker, Aengus Lynch, Stefan Heimersheim, Adrià Garriga-Alonso (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** The activation-patching algorithm, which is the causal test that distinguishes an explanation from a correlation.

**Source:** Sparse Autoencoders Find Highly Interpretable Features in Language Models — Hoagy Cunningham, Aidan Ewart, Logan Riggs, Robert Huben, Lee Sharkey (2023)

**Licence:** arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.

**Why this course exists:** How superposition is resolved in practice: a sparse dictionary over activations.

**Source:** In-context Learning and Induction Heads — Catherine Olsson, Nelson Elhage, Neel Nanda, Nicholas Joseph, Nova DasSarma, Tom Henighan, Ben Mann, Amanda Askell, Yuntao Bai, Anna Chen, Tom Conerly, Dawn Drain, Deep Ganguli, Zac Hatfield-Dodds, Danny Hernandez, Scott Johnston, Andy Jones, Jackson Kernion, Liane Lovitt, Kamal Ndousse, Dario Amodei, Tom Brown, Jack Clark, Jared Kaplan, Sam McCandlish, Chris Olah (2022)

**Licence:** CC BY 4.0 (as stated on the arXiv record).

**Why this course exists:** The residual-stream framework was described but the composition of two heads into a circuit was never built.

**Source:** Interpretability in the Wild: a Circuit for Indirect Object Identification in GPT-2 small — Kevin Wang, Alexandre Variengien, Arthur Conmy, Buck Shlegeris, Jacob Steinhardt (2022)

**Licence:** CC BY 4.0 (as stated on the arXiv record).

**Why this course exists:** Patching was taught on a toy graph; the name-mover circuit is the published case the procedure generalises to.

---

## Contents

- [1. Superposition](#1-superposition)
  - [Lesson 1. The toy model](#lesson-1-the-toy-model)
  - [Lesson 2. The importance threshold](#lesson-2-the-importance-threshold)
- [2. Features, Not Neurons](#2-features-not-neurons)
  - [Lesson 3. Polysemanticity](#lesson-3-polysemanticity)
  - [Lesson 4. The sparse autoencoder](#lesson-4-the-sparse-autoencoder)
- [3. Patching](#3-patching)
  - [Lesson 5. Activation patching](#lesson-5-activation-patching)
- [4. Circuits](#4-circuits)
  - [Lesson 6. The workflow](#lesson-6-the-workflow)
  - [Lesson 9. The QK and OV circuits](#lesson-9-the-qk-and-ov-circuits)
  - [Lesson 10. Automating the search](#lesson-10-automating-the-search)
- [5. Composition](#5-composition)
  - [Lesson 7. Induction heads](#lesson-7-induction-heads)
  - [Lesson 8. The IOI circuit](#lesson-8-the-ioi-circuit)
- [Appendix A — Glossary](#appendix-a-glossary)
- [Appendix B — Sources](#appendix-b-sources)

## 1. Superposition

*Why a dimension has to hold more than one thing*

When a model has fewer dimensions than the features it wants to represent, something has to give. This module builds the toy model in which that something is computable, and measures the interference that follows.

**Learning outcomes**

- State the linear toy model and the loss it optimises
- Compute the interference between two features that share a direction
- Explain what the importance threshold is and why it exists

### Lesson 1. The toy model

*A model with fewer dimensions than features*

*Estimated study time:* 24 minutes

**What you will learn**

- Write the linear toy model and the loss it minimises
- Derive the expected squared error of one feature
- Explain what the interference term is

**The ideas**

- The loss of one feature is 1 − 2‖w_k‖² + Σ_m (w_k·w_m)².
- When the columns are orthonormal, what is left is pure interference.
- Interference is the price of putting two features in one direction.

#### Practice

**Q. What does superposition force a model to do? — multiple-choice *(core)***

- ✓ **Pack several features into one direction**
- - Drop the features it cannot represent
- - Make the features more important
- - Use more dimensions

> Correct.

> **Why:** With fewer dimensions than features, the columns cannot all be orthogonal, so some features share a direction and interfere with each other.

**Q. Two features share a direction, and the squared projection of one onto the other is 0.25. What is the interference term in the loss? — numeric *(core)***

> **Why:** The cross term is (w_i·w_j)², so the interference is the square of the projection: 0.25.

#### Go and do it

Fit the toy model at a given number of dimensions and read the interference. Open **Fit the model** in the mech-interp-lab application.

**Where this came from**

- §sae:2 Taking Features out of Superposition with Sparse Dictionary Learning · p. 2 — The toy model of superposition that the sparse-autoencoder paper is built on, and the interference it costs.

**Further reading**

- [A Mathematical Framework for Transformer Circuits](https://transformer-circuits.pub/2021/framework.html) — The vocabulary of the residual stream, nodes, edges and paths.

**The words this lesson uses**

- **Superposition** — Several features packed into one direction of the model’s activation.
- **Interference** — The cost two features pay for sharing a direction.
- **Importance** — How much a feature matters to the loss.

### Lesson 2. The importance threshold

*When a feature is not worth representing*

*Estimated study time:* 20 minutes

**What you will learn**

- Explain why the model drops some features and keeps others
- Measure the threshold at which a feature starts to be represented
- Say what happens to the interference as the tail is dropped

**The ideas**

- Hosting a feature costs the host; dropping it costs the feature itself.
- The threshold is where those two prices cross.
- A power law of importances produces a sharp threshold.

#### Practice

**Q. Why does a model drop some features? — multiple-choice *(hard)***

- ✓ **Because hosting them would cost the host more than dropping them costs them**
- - Because they do not fit
- - Because they are noisy
- - It never does

> Correct.

> **Why:** Hosting a feature costs the host the interference; dropping it costs the feature its own importance. The threshold is where those cross.

#### Go and do it

Sweep a feature’s importance and watch the model decide whether to keep it. Open **Find the threshold** in the mech-interp-lab application.

**Where this came from**

- §sae:2 Taking Features out of Superposition with Sparse Dictionary Learning · p. 3 — The importance threshold, and the argument that the tail of the importance distribution is not worth representing.

**The words this lesson uses**

- **Importance** — How much a feature matters to the loss.
- **Interference** — The cost two features pay for sharing a direction.
- **Polysemanticity** — A neuron that responds to several unrelated things.

*Read first:* The toy model

## 2. Features, Not Neurons

*A neuron is a mixture; a feature is not*

The central observation of mechanistic interpretability: individual neurons are polysemantic, and the features a model represents do not line up with the neurons it uses to represent them. This module unpacks that, and builds the tool that fixes it.

**Learning outcomes**

- Explain polysemanticity and why it is a problem
- Write the sparse autoencoder and its objective
- Measure the sparsity, the reconstruction and the interpretability of a dictionary

### Lesson 3. Polysemanticity

*Why a neuron is not a feature*

*Estimated study time:* 20 minutes

**What you will learn**

- Define polysemanticity
- Explain why superposition makes it unavoidable
- Say what a monosemantic feature would look like

**The ideas**

- A neuron that responds to several things is polysemantic.
- Superposition makes polysemantic neurons the cheap option.
- A feature is a thing the model represents, not a neuron it represents it with.

#### Practice

**Q. A neuron in a superposed model is usually polysemantic. — boolean *(core)***

> **Why:** Yes. Superposition is what makes it cheap for one neuron to respond to several things, so polysemantic neurons are the cheap option rather than a failure.

#### Go and do it

Count how many features each direction is carrying. Open **How many features per direction** in the mech-interp-lab application.

**Where this came from**

- §sae:1 Introduction · p. 1 — The problem: a neuron responds to several things, and the features a model represents are not the neurons it uses.

**The words this lesson uses**

- **Polysemanticity** — A neuron that responds to several unrelated things.
- **Monosemanticity** — A direction that responds to one thing and nothing else.
- **Feature** — A thing the model represents, as distinct from the neuron it uses.

*Read first:* The importance threshold

### Lesson 4. The sparse autoencoder

*Asking for a sparse code*

*Estimated study time:* 24 minutes

**What you will learn**

- Write the encoder, the decoder and the objective of a sparse autoencoder
- Explain what the sparsity penalty is for
- Measure the reconstruction, the sparsity and the explained variance

**The ideas**

- The autoencoder asks for a code that is sparse and reconstructs.
- The L1 penalty is what makes the code sparse.
- A dictionary feature that activates for one thing is interpretable.

#### Practice

**Q. What is the L1 penalty in a sparse autoencoder for? — multiple-choice *(core)***

- ✓ **To make the code sparse**
- - To make the reconstruction better
- - To make the dictionary larger
- - To make the training faster

> Correct.

> **Why:** The L1 term penalises the number of active features, and the sparsity is what makes a dictionary feature correspond to one thing.

**Q. A sparse autoencoder reconstructs activations with a mean squared error of 0.1, and the activations have variance 0.8. What is the explained variance? — numeric *(hard)***

> **Why:** 1 − 0.1/0.8 = 0.875. The dictionary has kept most of the information.

#### Go and do it

Train a real sparse autoencoder on a real residual stream and watch it find features. Open **Train the autoencoder** in the mech-interp-lab application.

**Where this came from**

- §sae:2 Taking Features out of Superposition with Sparse Dictionary Learning · p. 4 — The encoder, the decoder, the sparsity penalty, and the objective.
- §sae:3 Interpreting Dictionary Features · p. 5 — How a dictionary feature is scored, and the comparison against the neurons it replaces.

**The words this lesson uses**

- **Sparse autoencoder** — An autoencoder trained to reconstruct with a sparse code.
- **Dictionary feature** — A feature found by a sparse autoencoder.
- **L0** — The number of features that are active.
- **Explained variance** — How much of the activation the reconstruction accounts for.

*Read first:* Polysemanticity

## 3. Patching

*From what a neuron responds to, to what it does*

A correlational claim about a neuron is cheap; a causal one is not. This module covers the intervention that distinguishes them, and the measurement that comes with it.

**Learning outcomes**

- Describe activation patching and what it establishes
- Compute the effect of patching a node, and the normalised effect
- Define the faithfulness of a proposed circuit

### Lesson 5. Activation patching

*The intervention that makes a claim causal*

*Estimated study time:* 24 minutes

**What you will learn**

- Describe activation patching and what it establishes
- Compute the effect of patching a node and the normalised effect
- Explain why a self-consistent model is not an explanation

**The ideas**

- Run the model twice, and replace one activation in one of the runs.
- If the output moves, that node was causally responsible for the move.
- Correlational evidence survives the patch; causal evidence does not.

#### Practice

**Q. What does activation patching establish? — multiple-choice *(core)***

- ✓ **That a node is causally responsible for a change in the output**
- - That a node responds to a particular input
- - That the model has understood the input
- - That a node is important

> Correct.

> **Why:** You run the model twice, replace one activation in one of the runs, and look at what moves. If the output changes, the node was responsible for it.

**Q. A model with a perfect self-consistency score can still be wrong about what it is doing. — boolean *(hard)***

> **Why:** Yes. Self-consistency is a correlational property; a model can be perfectly self-consistent and implement a mechanism that does not explain the behaviour.

#### Go and do it

Patch each node in turn and read the effect on the output. Open **Patch a node** in the mech-interp-lab application.

**Where this came from**

- §circuits:2.3 Step 3: Patch model activations to isolate the relevant subgraph · p. 3 — The intervention, and what it rules out.
- §sae:4 Identifying Causally-Important Dictionary Features · p. 8 — Adapting the patching procedure to dictionary features.

**The words this lesson uses**

- **Activation patching** — Run the model twice, and replace one activation in one of the runs.
- **Causal** — A claim that survives an intervention.
- **Attribution** — How much a component is responsible for the output.

*Read first:* Polysemanticity

## 4. Circuits

*An explanation that accounts for the behaviour*

The workflow the circuit-discovery paper lays out: choose a behaviour, divide the model into components, find the ones that matter, and explain them. This module puts the pieces in order and says what each one buys.

**Learning outcomes**

- State the four steps of the mechanistic-interpretability workflow
- Explain what a node, an edge and a path are in a transformer
- Argue for a behavioural explanation over a correlational one
- Split one head’s QK and OV circuits, and one pathway into the terms that make it up
- Say what an automated circuit search is scored against, and what it can get wrong

### Lesson 6. The workflow

*Four steps, and what each one is for*

*Estimated study time:* 20 minutes

**What you will learn**

- State the four steps of the mechanistic-interpretability workflow
- Say what a node, an edge and a path are in a transformer
- Argue for a behavioural explanation over a correlational one

**The ideas**

- Choose a behaviour, divide the model into a graph, patch, and explain.
- A node is a component that does one thing; an edge is a causal influence.
- A finished explanation accounts for the behaviour, not for a correlation.

#### Practice

**Q. What are the four steps of the mechanistic-interpretability workflow? — multiple-choice *(core)***

- ✓ **Select a behaviour, divide the model into a graph, patch to isolate the subgraph, and explain the components**
- - Collect data, train a probe, read the probe, write it up
- - Find the neurons, find the features, find the data, find the answer
- - Prune, retrain, compare, publish

> Correct.

> **Why:** The order matters: a behaviour first, so that the explanation is of something the model actually does.

**Q. In a transformer, what is the natural unit of a circuit node? — multiple-choice *(hard)***

- ✓ **An attention head or a feed-forward block, reading from and writing to the residual stream**
- - A single weight
- - A whole layer
- - A training example

> Correct.

> **Why:** The natural decomposition is the one the architecture gives you: the components that write to the residual stream, and the causal influences between them.

#### Go and do it

The graph of nodes and edges, with the attribution on each. Open **The circuit** in the mech-interp-lab application.

**Where this came from**

- §circuits:2 The Mechanistic Interpretability Workflow · p. 2 — The four steps, in order, and why each one is needed.
- §circuits:2.2 Step 2: Divide the neural network into a graph of smaller units · p. 3 — The graph, and the vocabulary of components.
- §circuits:2.4 Explaining the circuit components · p. 4 — What a finished explanation has to contain.
- §circuits:4 Evaluating Subgraph Recovery Algorithms · p. 9 — How a discovery method is scored against a hand-built circuit.

**Further reading**

- [A Mathematical Framework for Transformer Circuits](https://transformer-circuits.pub/2021/framework.html) — The residual stream, the nodes, the edges and the paths.

**The words this lesson uses**

- **Circuit** — A graph of components that accounts for a behaviour.
- **Node** — A component of the graph that does one thing.
- **Path** — A chain of causal influences from an input to the output.
- **Faithfulness** — How much of the effect a proposed subgraph accounts for.

*Read first:* Activation patching

### Lesson 9. The QK and OV circuits

*One head, two matrices, and an exact split of what it contributes*

*Estimated study time:* 24 minutes

**What you will learn**

- Factor one attention head into the circuit that chooses a position and the circuit that writes from it
- State the pathway decomposition of a last-layer head and why it is an identity rather than an approximation
- Explain why a head in an earlier layer has no such split, and what can be measured instead
- Describe what path patching asks that component patching cannot

**The ideas**

- A head is four matrices and two products: W_QᵀW_K decides where it looks, W_OW_V decides what it writes when it gets there.
- A last-layer head’s effect on a logit difference is exactly the sum over source positions of attention times the write that position is worth — so the decomposition can be checked against an ablation to machine precision.
- A composed head’s QK circuit is a property of the path into it, which is why the induction circuit cannot be read off either head alone.

#### Practice

**Q. What does a head’s QK circuit decide, and what does its OV circuit decide? — multiple-choice *(core)***

- ✓ **QK decides which positions the head looks at; OV decides what it writes once it has looked**
- - QK decides the layer, OV decides the head
- - QK decides what is written, OV decides what is attended to
- - Both describe the attention pattern, in different bases

> Correct.

> **Why:** W_Qᵀ W_K and W_O W_V are two separate d_model × d_model products that factor out of the head, and that factorisation is what lets you patch a head through one circuit input of another head instead of through the head as a whole.

**Q. Splitting a last-layer head’s effect on the metric into per-position terms is an approximation that leaves a few percent unexplained. — boolean *(hard)***

> **Why:** No. The head’s output is a sum over source positions and the readout is linear, so the split is an identity: in the laboratory the sum of the terms equals the ablation’s effect and the discrepancy column is driven below 1e-12 by a test. A head in an *earlier* layer has no such split, because its effect runs through the softmax of the layer above.

#### Go and do it

Pick a head and a position, and read the head’s whole contribution as one term per source position, next to the ablation that has to equal it. Open **Decompose a pathway** in the mech-interp-lab application.

**Where this came from**

- §framework:1 The Residual Stream · p. 1 — The computational graph a transformer induces, and the factorisation of a head into a QK and an OV circuit.
- §induction:reverse-engineering Summary of Reverse Engineering Induction Heads · p. 26 — The composed circuit those two circuits are read in, on a model whose wiring is known.

**Further reading**

- [A Mathematical Framework for Transformer Circuits](https://transformer-circuits.pub/2021/framework.html) — The QK/OV vocabulary, the path expansion, and the composition of heads.

**The words this lesson uses**

- **Residual stream** — The vector every component reads from and writes to.
- **QK circuit** — The product W_Qᵀ W_K, which decides which positions a head attends to.
- **OV circuit** — The product W_O W_V, which decides what a head writes for the positions it attends to.
- **Path** — A chain of causal influences from an input to the output.
- **Path patching** — Patching one head’s output into a single circuit input of another head.

*Read first:* The workflow, Induction heads

### Lesson 10. Automating the search

*Edge attribution, pruning, and what a discovered circuit is graded against*

*Estimated study time:* 22 minutes

**What you will learn**

- Define the attribution score of an edge and say why it is marginal rather than intrinsic
- Describe the prune-and-rescore loop and the threshold it stops at
- State faithfulness and completeness as two different failures
- Explain why a hand-wired circuit is the only honest ground truth for a discovery algorithm

**The ideas**

- An edge’s score is what the current graph loses when that edge is deleted, so an edge can look essential only because its partner is in the graph — which is why the search re-scores everything at every step.
- A graph can be faithful without being complete, or complete without being faithful: one names a route that carries the behaviour on its own, the other names everything the behaviour cannot do without.
- On a random model the strongest available claim is that the numbers are self-consistent. On a model wired by hand the search’s answer is a test.

#### Practice

**Q. Why does an ACDC-style search re-score every remaining edge at every step? — multiple-choice *(core)***

- ✓ **Because an edge’s score is its contribution to the graph it is currently in, so deleting one edge changes what the others are worth**
- - Because the metric is stochastic and needs averaging
- - Because the model is retrained between steps
- - Because scores have to increase monotonically

> Correct.

> **Why:** A key path and the query path that reads it only work together: each looks essential while both are present, and one becomes free the moment the other goes. A single ranking would delete the wrong edge first.

**Q. A pruned graph that is faithful but not complete names every component the behaviour depends on. — boolean *(hard)***

> **Why:** No. Faithfulness says the graph reproduces the behaviour on its own; completeness says nothing outside it is needed. A faithful-but-incomplete graph is an explanation that still leans on a component it has never named — which is why the two criteria are reported as a pair.

#### Go and do it

Score every edge, delete the weakest, and watch faithfulness and completeness fall — then compare what the search reports against the four edges the wiring needs, from two different corruptions. Open **Prune a graph down to a circuit** in the mech-interp-lab application.

**Where this came from**

- §circuits:3 Automating circuit discovery (Step 3) · p. 3 — The attribution-patching loop, its cost, and the threshold it stops at.
- §circuits:4 Evaluating Subgraph Recovery Algorithms · p. 9 — How a discovery method is scored — against a hand-built circuit, on tasks where the answer is known.

**Further reading**

- [Towards Automated Circuit Discovery for Mechanistic Interpretability](https://arxiv.org/abs/2304.14997) — ACDC, and the two criteria the pruned graphs are graded on.

**The words this lesson uses**

- **Circuit** — A graph of components that accounts for a behaviour.
- **Node** — A component of the graph that does one thing.
- **Edge attribution** — One edge’s marginal contribution to the graph that currently contains it.
- **Faithfulness** — How much of the effect a proposed subgraph accounts for.
- **ACDC** — The search that deletes the least-scored component until the graph stops being faithful.
- **Completeness** — How much of a behaviour the circuit reproduces.

*Read first:* The workflow, The QK and OV circuits

## 5. Composition

*One head shifts the keys; another completes the pattern*

A single attention head can only match what is written at a position. Most of what a transformer does happens because one head’s output becomes another head’s input. This module builds the clearest example — the induction circuit — and then the largest hand-built circuit in the literature, where the same logic is followed through a whole model.

**Learning outcomes**

- Describe the two-head induction circuit and what each head contributes
- Measure the accuracy of the composed circuit, and the effect of removing its first head
- Explain completeness and minimality as tests of a circuit, not of a story

### Lesson 7. Induction heads

*The smallest circuit that is more than one head*

*Estimated study time:* 26 minutes

**What you will learn**

- Describe the induction algorithm: [A][B] … [A] predicts [B]
- Explain what the previous-token head contributes to the second head
- Measure the accuracy of the composed circuit, and of the ablation

**The ideas**

- An induction head matches the current token against the token that came before each earlier position, then copies the token after the match.
- The previous-token head is what shifts the keys: without it, the second head can only find the current token itself.
- The paper’s causal test is an ablation, and in the laboratory the ablation takes the accuracy to zero while the fixed circuit is exact.

#### Practice

**Q. What does the previous-token head contribute to the induction circuit? — multiple-choice *(core)***

- ✓ **It shifts the keys, so the second head can match the current token against what came before each position**
- - It copies the answer token into the output
- - It suppresses the wrong answer
- - It decides when to stop attending

> Correct.

> **Why:** The first head writes each token’s predecessor into the position’s key. The induction head then matches the current token against that shifted content; without the shift, it can only find the current token itself.

**Q. An induction head with no previous-token head can still find the token that followed the previous occurrence. — boolean *(hard)***

> **Why:** Without the shift, its keys are the tokens themselves, so it matches the earlier occurrence of the current token and copies that token — not the one that followed it. The laboratory’s ablation measures exactly this collapse.

#### Go and do it

A hand-wired two-head circuit on a repeated sequence, with both attention patterns and the ablation. Open **Complete the pattern** in the mech-interp-lab application.

**Where this came from**

- §induction:key-concepts Key Concepts: In-context Learning and Induction Heads · p. 4 — The [A][B] … [A] definition, and the two heads that implement it.
- §induction:reverse-engineering Summary of Reverse Engineering Induction Heads · p. 26 — The mechanism stated as a circuit: shifted keys, matched queries, copied values.
- §induction:phase-change Looking at the Phase Change More Closely · p. 13 — Induction heads forming at the same moment in-context learning appears.

**Further reading**

- [In-context Learning and Induction Heads](https://arxiv.org/abs/2209.11895) — The six lines of evidence, of which the ablation is the causal one.
- [A Mathematical Framework for Transformer Circuits](https://transformer-circuits.pub/2021/framework.html) — The composition of heads that makes the circuit possible.

**The words this lesson uses**

- **Induction head** — A head that completes a pattern it has already seen.
- **Previous-token head** — A head whose attention is on the position before it.
- **Composition** — One head’s output used as another head’s input.
- **In-context learning** — Learning a pattern from the context, without changing a weight.

*Read first:* The workflow

### Lesson 8. The IOI circuit

*A whole behaviour, reverse-engineered*

*Estimated study time:* 26 minutes

**What you will learn**

- Explain how the name-mover heads and the S-inhibition heads divide the work
- Say what completeness and minimality measure, and why both are needed
- Describe what the circuit leaves unexplained

**The ideas**

- The circuit has 26 attention heads in seven classes: some move the name, and some decide which name is moved.
- Completeness asks how much of the behaviour the circuit accounts for; minimality asks whether every part of it is needed.
- The paper’s own evaluation finds the explanation supported and incomplete at the same time — which is what an honest circuit looks like.

#### Practice

**Q. What does minimality measure about a proposed circuit? — multiple-choice *(core)***

- ✓ **Whether every component in it is needed for the behaviour**
- - Whether it explains the whole behaviour
- - Whether it is smaller than a baseline circuit
- - Whether its components are attention heads

> Correct.

> **Why:** Minimality removes components and checks the behaviour survives. Completeness asks how much is explained; minimality asks whether each part is doing work.

**Q. A circuit that passes completeness and minimality is therefore a complete account of how the model does the task. — boolean *(hard)***

> **Why:** No. The paper reports its explanation as supported by both criteria and still incomplete: the criteria constrain the circuit, they do not prove that nothing else is involved.

#### Go and do it

The paper’s own procedure — direct effects, then path patches into the movers’ circuits, then one layer down, then the two criteria — run on a hand-wired circuit with four heads, on the paper’s prompt and on the mirrored one. Open **Run the four steps** in the mech-interp-lab application.

**Where this came from**

- §ioi:3.1 Which heads directly affect the output? (Name Mover Heads) · p. 5 — The heads that write the answer, found by ablating heads one at a time.
- §ioi:3.2 Which heads affect the Name Mover Heads’ attention? (S-Inhibition Heads) · p. 6 — The upstream heads that decide which name is copied.
- §ioi:4.1 Completeness · p. 9 — How much of the behaviour the circuit reproduces.
- §ioi:4.2 Minimality · p. 10 — Whether every component in the circuit is doing necessary work.

**Further reading**

- [Interpretability in the Wild](https://arxiv.org/abs/2211.00593) — The 26-head circuit, and the three criteria it is evaluated by.
- [Towards Automated Circuit Discovery](https://arxiv.org/abs/2304.14997) — The automated procedure that this circuit was a target for.

**The words this lesson uses**

- **Name-mover head** — The head that writes the answer name into the output.
- **S-inhibition head** — The head that suppresses the wrong name.
- **Completeness** — How much of a behaviour the circuit reproduces.
- **Minimality** — Whether every part of a circuit is needed.

*Read first:* Induction heads

## Appendix A — Glossary

**Superposition** — Several features packed into one direction of the model’s activation.

When a model has fewer dimensions than the features it represents, it cannot give each feature a direction of its own. It packs them together instead, and the features interfere.

*Cunningham et al. (2023)*

**Interference** — The cost two features pay for sharing a direction.

The cross term in the loss, (w_i·w_j)², weighted by the importance of the feature that pays it. It is zero for orthogonal directions and grows quadratically as they align.

*Course term*

**Importance** — How much a feature matters to the loss.

A weight on each feature’s squared error. The toy model assumes the importances follow a power law: a few features matter and a long tail does not.

*Cunningham et al. (2023)*

**Polysemanticity** — A neuron that responds to several unrelated things.

It is the direct consequence of superposition, and it is why you cannot read a model’s computation off its neurons.

*Cunningham et al. (2023)*

**Monosemanticity** — A direction that responds to one thing and nothing else.

The property a good dictionary feature has, and the one the interpretability scoring measures.

*Cunningham et al. (2023)*

**Feature** — A thing the model represents, as distinct from the neuron it uses.

A feature is a direction in activation space that corresponds to something the model can talk about. It need not be a neuron, and in a superposed model it usually is not.

*Cunningham et al. (2023)*

**Dictionary feature** — A feature found by a sparse autoencoder.

One element of the overcomplete dictionary the autoencoder learns. It is a candidate answer to "what is this model representing?".

*Cunningham et al. (2023)*

**Sparse autoencoder** — An autoencoder trained to reconstruct with a sparse code.

f = ReLU(W_enc(x − b_pre) + b_enc), x̂ = W_dec f + b_pre, with the loss ‖x − x̂‖² + λ‖f‖₁. The L1 term is what makes the code sparse, and the sparsity is what makes the features interpretable.

*Cunningham et al. (2023)*

**L0** — The number of features that are active.

The count of non-zero entries in the code. It is the sparsity the penalty buys, and the smaller it is the more interpretable the dictionary tends to be.

*Course term*

**Explained variance** — How much of the activation the reconstruction accounts for.

One minus the reconstruction error, divided by the variance of the activations. A dictionary that explains the variance has not thrown the information away.

*Course term*

**Activation patching** — Run the model twice, and replace one activation in one of the runs.

If the output changes, the node that was patched was causally responsible for the change. It is the difference between "responds to" and "does".

*Conmy et al. (2023)*

**Causal** — A claim that survives an intervention.

A correlational claim holds over the data you have; a causal claim holds over the data you would have had if you had intervened.

*Course term*

**Attribution** — How much a component is responsible for the output.

The effect of patching it, measured against the largest effect any component could have had.

*Conmy et al. (2023)*

**Circuit** — A graph of components that accounts for a behaviour.

Not a list of the features a model uses, but a small set of components and the causal paths between them that together explain what the model did.

*Conmy et al. (2023)*

**Node** — A component of the graph that does one thing.

In a transformer the natural nodes are the attention heads and the feed-forward blocks, and the natural edges are the causal influences between them.

*Elhage et al. (2021)*

**Path** — A chain of causal influences from an input to the output.

What an explanation is made of: a small number of paths, each of which carries the signal that mattered.

*Elhage et al. (2021)*

**Faithfulness** — How much of the effect a proposed subgraph accounts for.

If a graph of nodes reproduces the output change when patched, it is faithful; the score is the fraction of the effect it explains.

*Conmy et al. (2023)*

**Residual stream** — The vector every component reads from and writes to.

The computational graph a transformer induces is a set of components reading from and writing to this one vector, and it is the graph that a circuit is a subgraph of.

*Elhage et al. (2021)*

**Induction head** — A head that completes a pattern it has already seen.

It matches the current token against the token that preceded each earlier position, attends to the position after the match, and copies that token. [A][B] … [A] becomes [A][B] … [A][B].

*Olsson et al. (2022)*

**Previous-token head** — A head whose attention is on the position before it.

It moves each token one position forward in the residual stream. The induction head reads that shifted content as its keys, which is the whole of the first head’s contribution.

*Olsson et al. (2022)*

**Composition** — One head’s output used as another head’s input.

Heads write to the residual stream, and a later head reads from it. A behaviour that neither head can produce alone can be produced by the two in composition — which is why an explanation has to talk about paths and not just heads.

*Olsson et al. (2022)*

**In-context learning** — Learning a pattern from the context, without changing a weight.

Loss on tokens later in a sequence is lower than loss on tokens earlier in it, because the model can use what it has already read. The induction-head paper argues that much of this is pattern completion by circuits like the one in the laboratory.

*Olsson et al. (2022)*

**Name-mover head** — The head that writes the answer name into the output.

In the IOI circuit, the name movers attend to the two names in the sentence and copy one of them to the final position. Which one they copy is decided upstream.

*Wang et al. (2022)*

**S-inhibition head** — The head that suppresses the wrong name.

It writes a signal that keeps the name movers from copying the subject, so the indirect object wins. It does not write the answer; it decides which of two candidates does.

*Wang et al. (2022)*

**Completeness** — How much of a behaviour the circuit reproduces.

Patch every node in the proposed circuit and measure how much of the behaviour comes back. A complete circuit accounts for the behaviour; an incomplete one leaves a residue it does not explain.

*Wang et al. (2022)*

**Minimality** — Whether every part of a circuit is needed.

Remove components one at a time and see whether the behaviour survives. A circuit can be complete and still contain components that are doing nothing for this behaviour.

*Wang et al. (2022)*

**QK circuit** — The product W_Qᵀ W_K, which decides which positions a head attends to.

One head reads the residual stream through two independent matrices, and this is the one that scores pairs of positions. It is the whole of the head’s where, and because it factorises out of the head it can be measured on its own — which is what makes a composed head’s influence patchable through its key input rather than through the head.

*Elhage et al. (2021)*

**OV circuit** — The product W_O W_V, which decides what a head writes for the positions it attends to.

Attention chooses the sources; W_O W_V chooses what is taken from each of them and written back into the stream. Because the head’s output is a sum over sources, its contribution to a logit splits into one term per position — the attention weight times the OV write projected on the readout — and that split is exact.

*Elhage et al. (2021)*

**Path patching** — Patching one head’s output into a single circuit input of another head.

Activation patching asks whether a component matters. Path patching asks which of its influences mattered: substitute the ablated head’s write into the query, key or value input of the later head, and the difference is that edge’s contribution. It is the tool that turns the framework’s paths into measurements.

*Elhage et al. (2021)*

**Edge attribution** — One edge’s marginal contribution to the graph that currently contains it.

Score an edge by what deleting it costs the graph, with all the other kept edges still in place. The score is a property of the edge *and its neighbours*, not of the edge alone: two edges that only work together each look essential while both are present. That is why a pruning search re-scores every remaining edge at every step.

*Conmy et al. (2023)*

**ACDC** — The search that deletes the least-scored component until the graph stops being faithful.

Given a metric and a behavioural gap: score every remaining node and edge by its marginal contribution, delete the smallest, repeat, and take as the answer the smallest graph that still cleared the threshold. Nothing is trained and no human chooses the components — which is why the method has to be graded on a model whose wiring is already known.

*Conmy et al. (2023)*

## Appendix B — Sources

- **Toy Models of Superposition** — Noah Elhage, Shan Carter, Chris Olah, Dan Hendrycks (2023), Transformer Circuits publication. Licence: Publicly readable web publication. The machine-check could not be completed from this environment (the site blocks automated clients); verify the terms on the page itself before reusing any text or figure..
  Mechanistic interpretability is only summarised in one chapter of the agentic course, and it is the fastest-moving area in the field.
- **A Mathematical Framework for Transformer Circuits** — Noah Elhage, Tristan Hume, Shan Carter, Scott Ostheim, Scott Linderman, Gabe, Dianne Hudon, Chris Olah (2021), Transformer Circuits publication. Licence: Publicly readable web publication. The machine-check could not be completed from this environment (the site blocks automated clients); verify the terms before reuse..
  The vocabulary of weights, activations, pathways and nodes that the rest of the interpretability literature assumes.
- **Towards Automated Circuit Discovery for Mechanistic Interpretability** — Arthur Conmy, Augustine N. Mavor-Parker, Aengus Lynch, Stefan Heimersheim, Adrià Garriga-Alonso (2023), arXiv:2304.14997 [cs.LG]. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  The activation-patching algorithm, which is the causal test that distinguishes an explanation from a correlation.
- **Sparse Autoencoders Find Highly Interpretable Features in Language Models** — Hoagy Cunningham, Aidan Ewart, Logan Riggs, Robert Huben, Lee Sharkey (2023), arXiv:2309.08600 [cs.LG] / ICLR 2024. Licence: arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing..
  How superposition is resolved in practice: a sparse dictionary over activations.
- **In-context Learning and Induction Heads** — Catherine Olsson, Nelson Elhage, Neel Nanda, Nicholas Joseph, Nova DasSarma, Tom Henighan, Ben Mann, Amanda Askell, Yuntao Bai, Anna Chen, Tom Conerly, Dawn Drain, Deep Ganguli, Zac Hatfield-Dodds, Danny Hernandez, Scott Johnston, Andy Jones, Jackson Kernion, Liane Lovitt, Kamal Ndousse, Dario Amodei, Tom Brown, Jack Clark, Jared Kaplan, Sam McCandlish, Chris Olah (2022), arXiv:2209.11895 [cs.LG]. Licence: CC BY 4.0 (as stated on the arXiv record)..
  The residual-stream framework was described but the composition of two heads into a circuit was never built.
- **Interpretability in the Wild: a Circuit for Indirect Object Identification in GPT-2 small** — Kevin Wang, Alexandre Variengien, Arthur Conmy, Buck Shlegeris, Jacob Steinhardt (2022), arXiv:2211.00593 [cs.LG] / ICLR 2023. Licence: CC BY 4.0 (as stated on the arXiv record)..
  Patching was taught on a toy graph; the name-mover circuit is the published case the procedure generalises to.
