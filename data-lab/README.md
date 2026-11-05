# Data Lab

An interactive course on **how training data is chosen, and what that choice does**, built around

> Florian Muennighoff, Alexander M. Rush, Boaz Barak, Tianyi Zhang and Ethan Caballero,
> *DataComp: In search of the next generation of multimodal datasets*,
> arXiv:2304.14108 [cs.CV] / NeurIPS 2023 Datasets and Benchmarks,

together with the Midas filtering pipeline of

> Guillaume Penedo, Qinglu Xiao and others,
> *The RefinedWeb Dataset for Falcon LLM*,
> arXiv:2306.01116 [cs.CL];

the mixture optimisation of

> Saining Xie and others,
> *DoReMi: Optimizing Data Mixtures Speeds Up Language Model Pretraining*,
> arXiv:2305.10429 [cs.LG] / NeurIPS 2023;

and the recursion result of

> Ilia Gerstgrasser and others,
> *The Curse of Recursion: Training on Generated Data Makes Models Forget*,
> arXiv:2305.17493 [cs.LG] / Nature 2024.

The site is a real learning environment: a source-mapped curriculum, eight laboratories that run real algorithms, a
glossary whose dependencies are a checked directed acyclic graph, an equation reference with derivations and worked
examples, and a graded assessment bank.

> **Everything here is a teaching instrument.** The corpus is *synthetic*: a Markov chain over a small vocabulary,
> with boilerplate, foreign text and near-duplicates mixed in at known rates, so that every property the filters act
> on is known in advance. No dataset is downloaded, no corpus is used, and no data leaves the browser.

---

## Quick start

```bash
npm install          # from the workspace root, or in this directory
npm run dev          # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reloading |
| `npm run build` | Type-check (`tsc -b`) then produce a static bundle in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |
| `npm test` | Vitest unit, screen and content tests (183 tests) |
| `npm run test:e2e` | Playwright browser tests, including the accessibility audit |
| `npm run lint` | Oxlint |

The production build is a static bundle: `dist/` can be served by any static host.
There is no backend, no API key and no network call at runtime.

---

## What is in the course

### The curriculum (5 modules, 10 lessons)

| Module | Lessons | Source |
| --- | --- | --- |
| **Sources** | What a crawl gives you · The quality–quantity frontier | Muennighoff et al. §1, §4, §5; Penedo et al. §1 |
| **Filtering** | The filtering pipeline · The reference model | Penedo et al. §2, §2.1, §2.2; Muennighoff et al. §3.1 |
| **Deduplication** | Exact and fuzzy · Decontamination | Penedo et al. §2.3 |
| **Mixtures** | A mixture is a policy · Optimising the mixture | Xie et al. §1, §3, §3.1, §3.2 |
| **Collapse** | Recursive training · The refinement loop | Gerstgrasser et al. §1, §2, §3, §4 |

Every lesson names the section of the paper it was written from, and the test suite refuses a lesson that cites a
section which is not in the source map. Every laboratory is linked by at least one lesson, and the test suite refuses
a screen no lesson reaches.

### The eight laboratories

Each screen declares, in `src/content/labs.ts`, which item of `references/manifest.json` it is the implementation of;
the collection-wide audit in `scripts/check-lab-coverage.mjs` compares the two strings and reports the tier of every
declared idea.

| Lab | What you can change | What you can measure |
| --- | --- | --- |
| **A · The pipeline** | The corpus size and seed, the perplexity threshold, the minimum length, the duplicate threshold, deduplication on or off | What each stage removed, the histogram of perplexities, the unigram model against the n-gram model, the ablation table of the model trained on what survives each filter, and how far each ablation curve can be pushed before the held-out set is emptied |
| **B · Deduplication** | The shingle size, the number of permutations, the band count, the thresholds | The MinHash estimate against the exact Jaccard similarity, the pairs the LSH index proposed, the probability the index catches a pair, and the documents the decontamination test found |
| **C · The mixture** | The corpus, the group-DRO step size η, the number of rounds, the family of ablations and the domain in focus | Four mixtures trained and measured on the same held-out set, the group weights over the rounds, the fitted linear model of each domain's loss, the closed-form solution, and what every domain costs when one is removed, kept alone, or given more of the data |
| **D · Collapse** | Bounded or unbounded, the batch size, the support, the fraction of real data, the number of generations | The mass left on the original's tail at every generation, the support the model can still represent, the effective number of symbols, the distance from the original, and the floor under the tail |
| **E · MIDAS and the reference model** | The similarity that makes a cluster, how many of a cluster survive, the shingle size, the permutations, the bands, the kept fraction, the cut order and the reference pool | The clusters MIDAS keeps rather than collapses, the removals and what an exact signature would have said, the same cut taken under three reference models, and the two rules scored against each other by what each throws away |
| **F · The budget** | The corpus, the token budget, the compute budget, what the filter throws away, the cheap rows' share and the seed | Five rows trained under one budget — raw, filtered at full and at half, the matched control and an oracle — the three gains the paper quotes, which of them survives matching the steps, and how a row is drawn token by token until the budget closes |
| **G · The loop** | The corpus, the number of passes, the total removed, the steps per scoring model and the seed | The reference retrained on each pass's survivors, the corpus quality and the model's held-out loss on the same axes, what each pass removed and what it cost, and one hard pass against four gentle ones at the same final size |
| **H · The proxy step** | The corpus, the proxy's seed, the reweighting strength, the domain pinned, the weight it is pinned at, the proxy's steps and the big arm's steps | The rescaling that hands the proxy's weights to a bigger run, the four mixtures trained on the proxy arm and on the big arm, the ranks that have to travel for the method to work, and the seed at which they stop travelling |

The classifier is trained **in the browser, from scratch, every time a setting changes**. There is no checkpoint to
download and nothing is fetched.

### The rest of the course

- **Practice** — 16 questions with per-option feedback, worked explanations and source citations. The numeric
  questions have tolerances tight enough that a plausible guess fails.
- **Glossary** — 22 terms, each with a plain-language definition and the terms that should be understood first. The
  dependency graph is checked for cycles.
- **Equations** — 8 results with the source, the plain-language meaning, every symbol, the assumptions, a derivation
  and a worked example.
- **Sources** — every work cited, with the licence it was verified under, and the section map of each source.

---

## The rule this course follows

**Every number is computed, and nothing is faked.**

The algorithms live in `src/core/` as pure functions with no DOM and no framework. They are unit-tested in Node,
without a browser, and the interface renders what those functions return. There are no stored result arrays anywhere
in the repository.

### The gradient is checked, not asserted

The classifier's loss is differentiable and its analytic gradient is derived by hand in `src/core/model.ts`. The test
suite compares that gradient against a central finite difference, component by component, and fails if the two
disagree.

### The corpus is a measuring instrument, and the interface says so

This is the honest part of the course. The corpus is **synthetic**: a Markov chain over a small vocabulary, with
boilerplate, foreign text and near-duplicates mixed in at known rates. The chain has preferred successors, so the
corpus has genuine pair structure and a unigram model and an n-gram model genuinely disagree about it.

That is what makes the filters *measurable* rather than merely displayed. The laboratory's checks are that the
perplexity filter removes the boilerplate that a unigram model rates as good text, that the MinHash estimate lands
within its error of the exact similarity, that the ablation table says which filter is worth its place, and that the
recursion loses the tail before it loses anything else.

The reversals are part of the teaching, not a footnote to it. The budget laboratory shows a quality gain that is
almost entirely the filter's power to choose *when* to stop, not *what* to keep: put a control row in the table with
the same documents and the same number of steps as the filtered row and the headline gain all but disappears, and it
changes sign across seeds. The proxy laboratory prints a rank correlation of 1.000 on one seed and 0.200 on another,
and the extrapolated mixture is the worst of the four candidates on the big arm at both. The refinement loop's held-out
loss rises, generation after generation, while the corpus's measured quality rises with it.

What this is **not**: a crawl, a dataset, or a reproduction of any number in any paper. The numbers here are
measurements of a controlled synthetic corpus, and every screen that shows one says so. It is not a reproduction of a
whole result either: Laboratory E reproduces the *robust* half of the CLIP-filtering argument — two views of the same
documents score above either view alone — and prints the null result of one that does not transfer, naming both numbers.

---

## Project layout

```
src/
  core/            the algorithms — pure functions, no React, no DOM
    corpus.ts        the synthetic corpus: the chain, the junk, the duplicates
    filters.ts       the n-gram reference model, the pipeline, the evaluation, the ablation
    dedup.ts         the shingle sets, MinHash, LSH, deduplication, decontamination
    model.ts         the classifier, with a gradient-checked analytic gradient
    mixture.ts       the group-DRO objective, the fitted domain models, the solution
    proxy.ts         the extrapolation from proxy weights, and the ranking transfer it rests on
    budget.ts        one compute budget, five ways of spending it, and the matched control
    midas.ts         the near-duplicate clusters MIDAS keeps, and the adaptive perplexity cut
    agreement.ts     two filters over the same documents, and the two-view score that compares them
    recursion.ts     the reference retrained on its own survivors, pass after pass
    collapse.ts      the recursive loop, bounded and unbounded
  content/         the course: curriculum, glossary, quiz, equations, sources
    labs.ts          the laboratory registry: which declared item of which paper each screen answers
  components/lab/  the eight laboratories, the screen map and the screen test
  pages/           one file per route
  test/            test setup
e2e/               Playwright specs, including the axe-core audit
docs/              sources and licensing
```

The shared interface layer — the primitives, the mathematics renderer, the charts, the shell and the progress
provider — lives in `@llm-materials/course-ui`, and the numerical and statistical core in
`@llm-materials/course-core`. The rule is unchanged: **numbers are computed in `src/core`, never in a component.**

---

## Accessibility

- An **axe-core audit** runs over eighteen pages in the browser suite, in both the light and the dark theme, and fails
  the build on any `wcag2a`, `wcag2aa`, `wcag21a` or `wcag21aa` violation.
- Every tab strip implements the WAI-ARIA tab pattern; charts carry a name, a caption and a data-table alternative;
  the theme is applied before the first paint.
- `/` opens the course search and `Escape` closes it.

---

## Licence

The course code is original work and is released under the **MIT licence**. The course content is released under the
same terms.

The source papers are **cited and linked, never redistributed**. No figure, table, image, dataset or third-party code
from any cited work appears in this repository. Every figure is an original plot of a computation made in the browser.

See [`docs/SOURCES_AND_LICENSING.md`](docs/SOURCES_AND_LICENSING.md) for the full statement.
