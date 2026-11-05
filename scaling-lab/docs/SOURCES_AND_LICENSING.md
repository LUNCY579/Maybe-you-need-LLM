# Sources and licensing

This course is written from six papers and one shared package. None of them is redistributed: they are cited by
section, linked to their canonical record, and every figure in the course is an original plot of a computation made in
the browser.

---

## The works cited

### 1. The primary source

**Scaling Laws for Neural Language Models**
Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B. Brown, Benjamin Chess and others
arXiv:2001.08361 [cs.CL]
<https://arxiv.org/abs/2001.08361>

Everything the course is *about* comes from here: the observation that the loss falls as a power law, the three
results, the measurement procedure, and the discussion of what a fitted exponent does and does not tell you.

- **Licence.** The arXiv perpetual, non-exclusive distribution licence. No Creative Commons licence is shown on the
  record.
- **What this course uses.** The definitions, the method of fitting, the structure of the argument, and the caveats.
- **What this course does not use.** The paper's figures, its tables of fitted exponents, and its text. No figure from
  the paper appears anywhere in the application.

### 2. The compute optimum

**Training Compute-Optimal Large Language Models**
Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch, Elena Buchatskaya, Trevor Cai and others
arXiv:2203.15556 [cs.CL] / NeurIPS 2022
<https://arxiv.org/abs/2203.15556>

- **Licence.** arXiv perpetual, non-exclusive distribution licence.
- **Used for.** The two-variable loss surface, the compute budget, the condition that balances the two terms at the
  optimum, and the tokens-per-parameter ratio that follows from it.
- **Not used.** Any figure, any table of fitted constants, or any code.

### 3. The data-constrained regime

**Scaling Data-Constrained Language Models**
Niklas Muennighoff, Alexander M. Rush, Boaz Barak, Teven Le Scao, Aleksandra Piktus and others
arXiv:2305.16264 [cs.CL] / NeurIPS 2023
<https://arxiv.org/abs/2305.16264>

- **Licence.** arXiv perpetual, non-exclusive distribution licence.
- **Used for.** The number of repeats, the effective amount of data, the loss as a function of the repeats, and the
  practical rules that follow.
- **Not used.** Any figure, any experimental result, or any code.

### 4. The emergence argument

**Are Emergent Abilities of Large Language Models a Mirage?**
Rylan Schaeffer, Brando Miranda, Sanmi Koyejo
arXiv:2304.15004 [cs.CL] / NeurIPS 2023
<https://arxiv.org/abs/2304.15004>

- **Licence.** arXiv perpetual, non-exclusive distribution licence.
- **Used for.** The argument that an apparent cliff is a property of the metric: how a discontinuous metric on a
  continuous capability creates an apparent discontinuity, and the experiments that show it.
- **Not used.** Any figure, any experimental result, or any code.

### 5. The data-pruning argument

**Beyond neural scaling laws: beating power law scaling via data pruning**
Ben Sorscher, Robert Geirhos, Shashank Shekhar, Surya Ganguli, Ari S. Morcos
arXiv:2206.14486 [cs.LG] / NeurIPS 2022 Outstanding Paper
<https://arxiv.org/abs/2206.14486>

- **Licence.** arXiv perpetual, non-exclusive distribution licence.
- **Used for.** The percolation threshold as a keep fraction, the claim that a curated subset can beat a larger random
  one, and the ranking of supervised pruning metrics against each other.
- **Not used.** The ImageNet experiments, the figures, or any code. The pruning laboratory runs on a synthetic pool
  built in this application, and the screen says so.

### 6. The hardware trend

**Compute Trends Across Three Eras of Machine Learning**
Jaime Sevilla, Lennart Heim, Anson Ho, Tamay Besiroglu, Marius Hobbhahn, Pablo Villalobos
arXiv:2202.05924 [cs.LG] / ICLR 2022 Workshop on ML for Systems
<https://arxiv.org/abs/2202.05924>

The catalogue key for this record is inherited from `references/manifest.json`, where the paper was filed under a
working name; the title, authors and venue above are the published ones.

- **Licence.** arXiv perpetual, non-exclusive distribution licence.
- **Used for.** The three eras, their reported growth rates in orders of magnitude a year, the doubling times, and the
  ranges the landmark runs span — all of them **quoted**, with the source named beside the number.
- **Not used.** The database of training runs the paper analyses, and any figure or table of its own.

### 7. The shared core

**`@llm-materials/course-core`**
Original work, part of this collection. MIT licence.

The ordinary least squares behind the power-law fits, the seeded random number generator, the linear algebra, and the
assessment engine. The loss-surface fit is not part of it: that is the non-negative least squares solved in this
application's `src/core/surface.ts`, because an unconstrained fit will price the floor of a loss below zero.

---

## What this course does not do

**It redistributes no source material.** No PDF, no figure, no table, no image, no dataset and no third-party code
from any cited work appears in this repository. Where the course needs to show something a paper showed, the result is
named, the source is cited, and the page says plainly that it is quoted rather than computed.

**It trains on no real data.** The runs in every laboratory use a synthetic task generated by this course's own code: a
spectrum with a decaying variance profile, a linear truth, and noise. The seed is shown on screen, so any figure can be
reproduced exactly.

**It evaluates no published model.** The model is a ridge estimator fitted in the browser, on the generated task, in
milliseconds. It is not a language model and it is not a benchmark result.

**It calls nothing.** There is no API key, no network request and no telemetry. The build is a static bundle that
works from the file system.

---

## Figures

Every figure in this course is an original plot of a computation made in the browser, drawn by the course's own chart
code from the numbers the course's own algorithms return. No figure from any cited work is reproduced, traced or
adapted.

The course distinguishes three kinds of number on screen, and says which is each:

| Kind | Example | Statement on screen |
| --- | --- | --- |
| Exact | The perplexity of a document, the balance condition at the optimum | "the condition", "the loss" |
| Measured | The fitted exponent, the fitted surface, the trained model's accuracy | "the measured loss", "the fit" |
| Quoted | The paper's tokens-per-parameter ratio, its fitted repetition constant, the era growth rates | The source is named next to the number |

---

## A note on versions

An arXiv licence is attached to a specific submission, and it can change between versions. This course was written
against the six records listed above as they stood on **2026-10-19**, the date the catalogue was last verified:
arXiv:2001.08361, arXiv:2203.15556, arXiv:2305.16264, arXiv:2304.15004, arXiv:2206.14486 and arXiv:2202.05924. If you
reuse anything from it, cite the version you used and check that version's licence.

The catalogue of every source across every course in this collection lives in the workspace at `references/manifest.json`,
and is validated by a script that re-reads every arXiv title live:

```bash
node scripts/validate-sources.mjs --verify
```
