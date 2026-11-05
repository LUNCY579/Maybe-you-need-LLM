# Sources and licensing

This course is written from the Stanford lecture materials and two papers. None of
them is redistributed: they are cited by lecture and by section, linked to their
canonical record, and every figure in the course is an original plot of a computation
made in the browser.

---

## The works cited

### 1. The primary source

**CS336: Language Modeling from Scratch**
Stanford CS336 staff
<https://cs336.stanford.edu/>

Everything the course is *about* comes from here: the lecture sequence — tokenisation,
resource accounting, architectures, parallelism, scaling laws, evaluation, data and
post-training — and the five assignments that structure the work.

- **Licence.** The lecture materials are published by the course staff for study. The
  lecture repository (`stanford-cs336/spring2025-lectures`) and the assignment
  repositories are MIT licensed, verified via the GitHub API on 2026-10-19. The slides
  and assignment handouts are cited and linked; nothing from them is redistributed here.
- **What this course uses.** The definitions, the order of the lectures, the
  decomposition of the subject, and the shape of the assignments.
- **What this course does not use.** The slides' figures, the assignment handouts' text,
  and any code in the assignment repositories. No figure from the source appears
  anywhere in the application.

### 2. The compute-optimal allocation

**Training Compute-Optimal Large Language Models**
Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch, Elena Buchatskaya, Trevor Cai,
Elizabeth Walters, Alison Stott, John Chalmers
arXiv:2203.15556 [cs.CL] / NeurIPS 2022
<https://arxiv.org/abs/2203.15556>

- **Licence.** arXiv perpetual, non-exclusive distribution licence. Re-check the
  version-specific terms before redistributing.
- **Used for.** The compute-optimal allocation, the IsoFLOP methodology, and the rule of
  thumb of about twenty tokens per parameter.
- **Not used.** Any figure, any table, or any experimental result.

### 3. The power laws

**Scaling Laws for Neural Language Models**
Jared Kaplan, Sam McCandlish, Tom Henighan, Tom B. Brown, Benjamin Mann, Alec Radford,
Ilya Sutskever
arXiv:2001.08361 [cs.CL]
<https://arxiv.org/abs/2001.08361>

- **Licence.** arXiv perpetual, non-exclusive distribution licence. Re-check the
  version-specific terms before redistributing.
- **Used for.** The shape of the loss as a function of the parameters and the data.
- **Not used.** Any figure or any experimental result.

### 4. The shared core

**`@llm-materials/course-core`**
Original work, part of this collection. MIT licence.

The seeded random number generator, the normal quantiles, the bootstrap and the power
calculations behind every number in this course.

---

## What this course does not do

**It redistributes no source material.** No PDF, no figure, no table, no image, no
dataset, no checkpoint and no third-party code from any cited work appears in this
repository.

**It trains no language model for you.** The transformer in Laboratory E has a few
thousand parameters and is trained, from scratch, in your browser, every time you press
the button. The tokeniser is trained the same way, on a corpus the course's own code
generates.

**It uses no dataset.** The corpus is generated, with a structure — a small repeated
vocabulary, some noise, some duplicates — chosen so that the pipeline's stages have
something to act on.

**It calls nothing.** There is no API key, no network request and no telemetry. The
build is a static bundle that works from the file system.

---

## Figures

Every figure in this course is an original plot of a computation made in the browser,
drawn by the course's own chart code from the numbers the course's own algorithms
return. No figure from any cited work is reproduced, traced or adapted.

The course distinguishes three kinds of number on screen, and says which is which:

| Kind | Example | Statement on screen |
| --- | --- | --- |
| Exact | The parameter count, the FLOPs, the memory, the posterior mean | "This is exact" |
| Measured | The bytes per token, the training loss, the perplexity | "Measured, on …" |
| Modelled | The scaling law's loss at a given allocation | "Modelled from the fitted law" |

The third kind is the one to be careful with. The loss surface of the scaling law is a
*model* of a power law, fitted over a range of real runs, and it is labelled as such
wherever it appears.

---

## A note on versions

An arXiv licence is attached to a specific submission, and it can change between
versions. This course was written against **arXiv:2203.15556** and
**arXiv:2001.08361**, and against the CS336 materials as published for the Spring 2025
and Spring 2026 offerings. If you reuse anything from it, cite the version you used and
check that version's licence.

The catalogue of every source across every course in this collection lives in the
workspace at `references/manifest.json`, and is validated by a script that re-reads
every arXiv title live:

```bash
node scripts/validate-sources.mjs --verify
```
