# Systems Lab

An interactive course on **where the time and the memory actually go**, built around

> Tri Dao, Daniel Y. Fu, Fangcheng Chiang and Quoc V. Le,
> *FlashAttention: Fast and Memory-Efficient Exact Attention with IO-Awareness*,
> arXiv:2205.14135 [cs.LG] / NeurIPS 2022,

together with the paged allocator of

> Woosuk Kwon and others,
> *Efficient Memory Management for Large Language Model Serving with PagedAttention*,
> arXiv:2309.06180 [cs.DC] / SOSP 2023;

the sparse layers of

> William Shen and others,
> *GShard: Scaling Giant Models with Conditional Computation and Automatic Sharding*,
> arXiv:1701.06538 [cs.LG];

and the verification of

> Charlie Chen and others,
> *SpecInfer: Accelerating Generative Large Language Model Serving with Tree-based Speculative Inference and Verification*,
> arXiv:2305.09781 [cs.DC].

The site is a real learning environment: a source-mapped curriculum, four laboratories that run real algorithms, a
glossary whose dependencies are a checked directed acyclic graph, an equation reference with derivations and worked
examples, and a graded assessment bank.

> **Everything here is a teaching instrument.** The laboratories use a *model shape* — layers, heads, a width, a
> parameter count — and account for what a program of that shape would cost. They do not run a transformer. No model,
> dataset or checkpoint is downloaded, and no data leaves the browser.

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
| `npm test` | Vitest unit and content tests (188 tests) |
| `npm run test:e2e` | Playwright browser tests, including the accessibility audit |
| `npm run lint` | Oxlint |

The production build is a static bundle: `dist/` can be served by any static host.
There is no backend, no API key and no network call at runtime.

---

## What is in the course

### The curriculum (4 modules, 8 lessons)

| Module | Lessons | Source |
| --- | --- | --- |
| **Attention Memory** | The matrix you never build · The running softmax | Dao et al. §1, §3, §3.1, §3.2, §4 |
| **The KV Cache** | Decoding is memory-bound · The page table | Kwon et al. §1, §3, §3.1 |
| **Sparse Capacity** | The router · The auxiliary loss | Shen et al. §1, §2, §3 |
| **Speculation** | Proposing and checking · When speculation pays | Chen et al. §1, §3, §4 |

Every lesson names the section of the paper it was written from, and the test suite refuses a lesson that cites a
section which is not in the source map.

### The four laboratories

| Lab | What you can change | What you can measure |
| --- | --- | --- |
| **A · Attention memory** | The sequence length, the head width, the block size | The peak memory and the traffic of the naive and the tiled attention, the difference between their answers, the number of passes over the keys, and the memory a training run needs |
| **B · The KV cache** | The context, the batch, the layers, the heads, the block size | The arithmetic intensity of a decode step and how it saturates, the cache's size, the batch at which the step becomes compute-bound, and the waste of a padded allocation against a paged one |
| **C · Sparse capacity** | The experts, the top-k, the router's bias, the capacity factor | The load of every expert, the auxiliary loss, the overflow the capacity allows, and the arithmetic the sparsity saves |
| **D · Speculation** | The distance between the draft and the target, the draft length, the draft's cost | The acceptance rate measured by running the rule and compared with the closed form, the output distribution the procedure produces against the target's, and the speed-up |

Every algorithm in every laboratory runs **in the browser, from scratch**, every time a setting changes.

### The rest of the course

- **Practice** — 16 questions with per-option feedback, worked explanations and source citations.
- **Glossary** — 20 terms, each with a plain-language definition and the terms that should be understood first. The
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

### The answers are checked, not asserted

Two claims in this course are easy to make and easy to get wrong, so both are checked in the test suite:

- **The tiled attention is exact.** The test compares it against the naive attention, component by component, and
  fails if the two differ by more than a rounding error.
- **The speculative procedure preserves the distribution.** The test runs the procedure — draw from the draft, accept
  or correct — counts what came out, and fails if the measured distribution is not the target's.

---

## Project layout

```
src/
  core/            the algorithms — pure functions, no React, no DOM
    attention.ts    the naive and the tiled attention, and the accounting
    kvcache.ts      the cache, the arithmetic intensity, the paged allocator
    moe.ts          the router, the auxiliary loss, the capacity
    speculative.ts  the acceptance rule, the verification, the speed-up
  content/         the course: curriculum, glossary, quiz, equations, sources
  components/lab/  the four laboratories
  pages/           one file per route
  test/            test setup
e2e/               Playwright specs, including the axe-core audit
docs/              sources and licensing
```

The shared interface layer lives in `@llm-materials/course-ui`, the numerical core in `@llm-materials/course-core`, and
the collection-wide catalogue in `@llm-materials/course-catalogue`. The rule is unchanged: **numbers are computed in
`src/core`, never in a component.**

---

## Accessibility

- An **axe-core audit** runs over fourteen pages in the browser suite, in both the light and the dark theme, and fails
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
