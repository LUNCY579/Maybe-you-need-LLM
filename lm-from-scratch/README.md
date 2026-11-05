# Language Model from Scratch

An interactive course on **building a language model and paying for it**, built around
the Stanford course

> CS336: Language Modeling from Scratch
> <https://cs336.stanford.edu/>

The site is a real learning environment: a source-mapped curriculum, six laboratories
that run real algorithms, a glossary whose dependencies are a checked directed acyclic
graph, an equation reference with derivations and worked examples, and a graded
assessment bank.

> **Everything here is a teaching instrument.** The tokeniser and the transformer are
> built, initialised and trained in your browser, from scratch, every time you press the
> button. There is no checkpoint anywhere in this project, no dataset to download, and
> no network call at runtime.

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
| `npm test` | Vitest unit and content tests (44 tests) |
| `npm run test:e2e` | Playwright browser tests, including the accessibility audit |
| `npm run lint` | Oxlint |

The production build is a static bundle: `dist/` can be served by any static host.

---

## What is in the course

### The curriculum (6 modules, 11 lessons)

| Module | Lessons | Source |
| --- | --- | --- |
| **Tokenisation** | The tokeniser · The vocabulary economy | CS336 lecture 1 |
| **The Architecture** | The decoder block · The parameter budget | CS336 lecture 3 |
| **Resource Accounting** | The FLOPs · The memory hierarchy | CS336 lectures 2 and 5 |
| **Systems and Parallelism** | Parallelism | CS336 lecture 7 |
| **Data** | The data pipeline | CS336 lectures 13 and 14 |
| **Training and Evaluation** | The training loop · The perplexity · Projecting the next run | CS336 lectures 10, 11, 12 |

Every lesson names the lecture or the paper section it was written from, and the test
suite refuses a lesson that cites a lecture which is not in the source map.

### The six laboratories

| Lab | What you can change | What you can measure |
| --- | --- | --- |
| **A · The tokeniser** | The vocabulary size, the corpus, the model width | The merges it learns, the bytes per token, and the size of the embedding matrix |
| **B · The architecture** | The width, the depth, the vocabulary, the feed-forward size, the tying | Every parameter, broken into the six things it is made of |
| **C · Resource accounting** | The shape, the batch, the machine | The FLOPs of a step, the four memory components, and the position on the roofline |
| **D · The data pipeline** | The quality threshold, the duplicate rate, the balance | What each stage removes, and the mixture that comes out |
| **E · The training loop** | Everything about the run | A real loss curve, a validation loss, and a perplexity |
| **F · The scaling frontier** | The compute budget, the two exponents | The IsoFLOP lines, the frontier, and the optimal allocation |

### The rest of the course

- **Practice** — 20 questions with per-option feedback, worked explanations and source
  citations.
- **Glossary** — 33 terms with a plain-language definition and the terms that should be
  understood first. The dependency graph is checked for cycles.
- **Equations** — 14 results with the source, the plain-language meaning, every symbol,
  the assumptions, a derivation and a worked example.
- **Sources** — every work cited, with the licence it was verified under, and the
  lecture map of the primary source.

---

## The rule this course follows

**Every number is computed, and every gradient is checked.**

The algorithms live in `src/core/` as pure functions with no DOM and no framework. They
are unit-tested in Node, without a browser, and the interface renders what those
functions return.

### The gradient check, and what it caught

The course includes a small reverse-mode automatic differentiation engine and a real
transformer built on it. The test suite compares the analytic gradient against a central
finite difference on **every parameter**, for every layer.

That check earned its place. When it was first written it failed, and it found three
separate bugs in the backward pass:

1. the tanh derivative was taken from the pre-activation rather than the activation, so
   `1 − pre²` was used where `1 − tanh(pre)²` was required;
2. the derivative of the output layer was never applied at all, because the code
   treated it as if it had an activation;
3. the back-propagated delta had the dimension of the previous layer's *columns* rather
   than its *rows*, which silently zeroed the gradient of every unit in the widest
   hidden layer.

And one more, found later by the same check: the RMSNorm backward pass was missing the
`1/d` that comes from the mean inside the root-mean-square. That one is subtle — the
gradient was *nearly* right, and it compounded through the network into an error of six
orders of magnitude by the embedding. A model trained with it would have looked like it
was learning.

Any one of those would have shipped a model that trained, lost weight, and generated
plausible-looking nonsense.

---

## Project layout

```
src/
  core/            the algorithms — pure functions, no React, no DOM
    autodiff.ts       a small reverse-mode automatic differentiation engine
    mlp.ts            (in the diffusion course) the perceptron with analytic gradients
    tokenizer.ts      byte-pair encoding, trained from scratch
    architecture.ts   parameter counts, FLOPs, memory, the roofline
    transformer.ts    the decoder-only transformer, and the training loop
    data.ts           the data pipeline, simulated
    scaling.ts        the scaling law and the compute-optimal frontier
  content/         the course: curriculum, glossary, quiz, equations, sources
  components/lab/  the six laboratories
  pages/           one file per route
  test/            test setup
e2e/               Playwright specs, including the axe-core audit
docs/              architecture, sources and licensing
```

The shared interface layer lives in `@llm-materials/course-ui` and the numerical core in
`@llm-materials/course-core`. The rule is unchanged: **numbers are computed in
`src/core`, never in a component.**

---

## Accessibility

- An **axe-core audit** runs over fifteen pages in the browser suite, in both the light
  and the dark theme, and fails the build on any `wcag2a`, `wcag2aa`, `wcag21a` or
  `wcag21aa` violation.
- Every tab strip implements the WAI-ARIA tab pattern; charts carry a name, a caption
  and a data-table alternative; the theme is applied before the first paint.
- `/` opens the course search and `Escape` closes it.

---

## Licence

The course code is original work and is released under the **MIT licence**. The course
content is released under the same terms.

The source materials are **cited and linked, never redistributed**. No figure, table,
image, dataset, checkpoint or third-party code from any cited work appears in this
repository. Every figure is an original plot of a computation made in the browser.

See [`docs/SOURCES_AND_LICENSING.md`](docs/SOURCES_AND_LICENSING.md) for the full
statement.
