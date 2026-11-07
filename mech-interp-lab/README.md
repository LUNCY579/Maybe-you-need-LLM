# Mechanistic Interpretability Lab

An interactive course on **how you would find out what a model computes**, built around

> Hoagy Cunningham, Aidan Ewart, Logan Riggs, Robert Huben and Lee Sharkey,
> *Sparse Autoencoders Find Highly Interpretable Features in Language Models*,
> arXiv:2309.08600 [cs.LG] / ICLR 2024.
>
> together with
>
> Jacob Conmyer, Nora Belrose, Stein Smith and Buck Shlegeris, *Towards Automated Circuit
> Discovery for Mechanistic Interpretability*, arXiv:2304.14997 [cs.LG]; and
>
> Elhage et al., *A Mathematical Framework for Transformer Circuits*,
> transformer-circuits.pub.

The site is a real learning environment: a source-mapped curriculum, seven laboratories
that run real algorithms in the browser *and* from the terminal, a glossary whose
dependencies are a checked directed acyclic graph, an equation reference with derivations
and worked examples, and a graded assessment bank.

> **Everything here is a teaching instrument.** The model is the *toy model of
> superposition* — linear, with independent features, a known loss and a closed-form
> answer. It is a measuring instrument for the phenomenon, not a transformer. No model is
> downloaded, no dataset is used, and no data leaves the browser.

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
| `npm test` | Vitest unit, content and screen tests (273 tests) |
| `npm run lab -- <id\|all>` | The same laboratory, from the terminal — see below |
| `npm run test:e2e` | Playwright browser tests, including the accessibility audit |
| `npm run lint` | Oxlint |

The production build is a static bundle: `dist/` can be served by any static host.
There is no backend, no API key and no network call at runtime.

### The laboratories without a browser

```bash
npm run --silent lab -- all            # every laboratory, at the default scenario
npm run --silent lab -- circuit        # one of them
npm run --silent lab -- circuit --csv > circuit.csv
npm run --silent lab -- superposition --seed 11 --json
npm run --silent lab -- --list
```

`tools/run-lab.mjs` imports the functions in `src/core` and the scenario in
`src/content/labDefaults.ts` — the same file every screen reads its starting slider
values from — so the terminal prints the numbers the page shows rather than a second
opinion about them. `--csv` emits `lab,kind,metric,value,note` rows; `--json` one object
per laboratory.

---

## What is in the course

### The curriculum (5 modules, 10 lessons)

| Module | Lessons | Source |
| --- | --- | --- |
| **Superposition** | The toy model · The importance threshold | Cunningham et al. §2 |
| **Features, Not Neurons** | Polysemanticity · The sparse autoencoder | Cunningham et al. §2, §3 |
| **Patching** | Activation patching | Conmyer et al. §2.3; Cunningham et al. §4 |
| **Circuits** | The workflow · The QK and OV circuits · Automating the search | Conmyer et al. §2, §4; Elhage et al. §1 |
| **Composition** | Induction heads · The IOI circuit | Olsson et al.; Elhage et al.; Wang et al. |

Every lesson names the section of the paper it was written from, and the test suite
refuses a lesson that cites a section which is not in the source map. Each one also
deep-links into the laboratory view that shows its numbers, and the link is checked from
both ends: the content tests refuse a lesson that asks for a view a screen does not
have, and the screen tests mount every view at its own URL.

### The seven laboratories

| Lab | What you can change | What you can measure |
| --- | --- | --- |
| **A · Superposition** | The number of features, the dimensions, the importance exponent, the seed | The loss, the total interference, the features per direction, the importance threshold measured by sweeping it, and the interference against the dimension count |
| **B · The sparse autoencoder** | The activation width, the dictionary size, λ, the steps and learning rate, the seed, the angle and weight of an overlapping pair, the sweep's run count | The reconstruction error, the L0, the explained variance, the training curve, the monosemanticity of every dictionary row, and how often splitting appears across seeds |
| **C · Patching** | The input, and the node to intervene on | The effect of patching each node, the normalised effect, the causal edge weights, the attribution ranking, and the faithfulness of the graph |
| **D · One head, two circuits** | The head, and which logit pair the measure reads | The QK and OV circuits as shapes and numbers, the attention pattern, and a head's effect split over its source positions next to the ablation it has to equal — with the discrepancy reported |
| **E · Composition and induction** | The block width, the repeats, the temperature, the variant, the seed, the position | The attention pattern, the positions it matched, the next-token prediction, and accuracy against the number of repeats with and without the previous-token head |
| **F · Automated circuit discovery** | The behaviour, where the corruption lands and what it becomes, the threshold, the number of deletions | The attribution score of every edge, the pruning curve, the circuit the search reports, and that answer graded edge by edge against the wiring — under each of two corruptions |
| **G · The four-step workflow** | The prompt | The paper's procedure in order: which heads act directly, which choose where they look, one layer further down, and the minimality and criteria check that closes it |

The autoencoder is trained **in the browser, from scratch, every time you press the
button**. There is no checkpoint to download and nothing is fetched.

Laboratory F is the one worth reading carefully: its model was wired by hand, so the
search's answer has something to be wrong against. It is. Each corruption makes only half
of the induction circuit detectable, and the screen prints both answers and their union —
which is the honest statement of what an automated discovery method reports.

### The rest of the course

- **Practice** — 19 questions with per-option feedback, worked explanations and source
  citations. The numeric questions have tolerances tight enough that a plausible guess
  fails.
- **Glossary** — 31 terms, each with a plain-language definition and the terms that
  should be understood first. The dependency graph is checked for cycles.
- **Equations** — 9 results with the source, the plain-language meaning, every symbol,
  the assumptions, a derivation and a worked example.
- **Sources** — every work cited, with the licence it was verified under, and the
  section map of each source.

---

## The rule this course follows

**Every number is computed, and nothing is faked.**

The algorithms live in `src/core/` as pure functions with no DOM and no framework.
They are unit-tested in Node, without a browser, and the interface renders what those
functions return. There are no stored result arrays anywhere in the repository.

Three things beyond that are checked rather than asserted:

- **Every screen renders, at every view it declares** (`src/components/lab/lab.test.tsx`),
  including the URL a lesson links to, and no view is allowed to print `NaN`,
  `undefined`, `Infinity` or `[object …]`.
- **The registry cannot drift** (`src/content/content.test.ts`): a lesson that names a
  laboratory or a view that does not exist fails, and so does a screen whose option list
  no longer matches the one the registry advertises.
- **The prose is a test case.** Where a screen claims a number — that a pathway split
  equals an ablation, that a circuit is faithful and complete, that a decomposition has
  no residual — the claim is asserted in `src/core/*.test.ts` at the tolerance the screen
  prints. That is how the circuit in laboratory F turned out to need a fourth edge: the
  claim was written down, so the test could disagree with it.

### The gradient is checked, not asserted

The toy model's loss is differentiable and its analytic gradient is derived by hand in
`src/core/superposition.ts`. The test suite compares that gradient against a central
finite difference, component by component, and fails if the two disagree. The sparse
autoencoder is trained with the autodiff engine in `@llm-materials/course-core`, so its
gradients are the same kind of checked quantity.

### The model is a measuring instrument, and the interface says so

This is the honest part of the course. The model is **the toy model of superposition**:
a linear map whose columns are constrained to the unit ball, fitted to a set of
independent features with known importances, minimising a loss whose value is known in
closed form. The features, their importances and the activations are all generated here.

That is what makes the phenomenon *measurable* rather than merely suspected. The
laboratory's checks are that the fitted interference matches the loss the paper predicts,
that the importance threshold is where it should be, and that the patching result
recovers the node that the synthetic circuit actually uses.

What this is **not**: a transformer, a claim about any real network's interference, or a
reproduction of any number in any paper. The numbers here are measurements of a
controlled toy model, and every screen that shows one says so.

---

## Project layout

```
src/
  core/            the algorithms — pure functions, no React, no DOM
    superposition.ts  the toy model, its loss, its analytic gradient, the threshold
    sae.ts            the sparse autoencoder, its training, its evaluation
    splitting.ts      feature splitting, merging and absorption against a known pair
    patching.ts       the synthetic circuit, patching, attribution, faithfulness
    attention.ts      the residual stream, a head's QK and OV circuits, path patching,
                      ablation, and the exact pathway decomposition
    induction.ts      the induction head as an attention pattern, on a repeated block
    inductionModel.ts the same circuit wired as a two-layer model, and its ground truth
    circuitDiscovery.ts  the computational graph, edge attribution, ACDC pruning
    ioi.ts            the IOI model, its heads, and the four-step workflow
  content/         the course: curriculum, labs, glossary, quiz, equations, sources
    labDefaults.ts  the scenario each screen starts on, read by the browser and the runner
  components/lab/  the seven laboratories, one file each, plus the screen tests
  pages/           one file per route
  test/            test setup
tools/
  run-lab.mjs      the same laboratories, from the terminal
  ts-resolver.mjs  lets Node import the TypeScript core directly
e2e/               Playwright specs, including the axe-core audit
docs/              architecture, sources and licensing
```

The shared interface layer — the primitives, the mathematics renderer, the charts, the
shell and the progress provider — lives in `@llm-materials/course-ui`, and the numerical
and statistical core in `@llm-materials/course-core`. The rule is unchanged: **numbers
are computed in `src/core`, never in a component.**

---

## Accessibility

- An **axe-core audit** runs over thirteen pages in the browser suite, in both the light
  and the dark theme, and fails the build on any `wcag2a`, `wcag2aa`, `wcag21a` or
  `wcag21aa` violation.
- Every tab strip implements the WAI-ARIA tab pattern; charts carry a name, a caption
  and a data-table alternative; the theme is applied before the first paint.
- `/` opens the course search and `Escape` closes it.

---

## Licence

The course code is original work and is released under the **MIT licence**. The course
content is released under the same terms.

The source papers are **cited and linked, never redistributed**. No figure, table,
image, dataset or third-party code from any cited work appears in this repository.
Every figure is an original plot of a computation made in the browser.

See [`docs/SOURCES_AND_LICENSING.md`](docs/SOURCES_AND_LICENSING.md) for the full
statement.
