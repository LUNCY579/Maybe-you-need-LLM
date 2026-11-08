# Scaling Lab

An interactive course on **how the loss falls, and what follows from it**, built around

> Jared Kaplan, Sam McCandlish, Tom Henighan and others,
> *Scaling Laws for Neural Language Models*, arXiv:2001.08361 [cs.CL],

the compute-optimal allocation of

> Jordan Hoffmann, Sebastian Borgeaud, Arthur Mensch and others,
> *Training Compute-Optimal Large Language Models*, arXiv:2203.15556 [cs.CL];

the data-constrained regime of

> Niklas Muennighoff, Alexander M. Rush, Boaz Barak and others,
> *Scaling Data-Constrained Language Models*, arXiv:2305.16264 [cs.CL];

the argument about emergent abilities by

> Rylan Schaeffer, Brando Miranda, Sanmi Koyejo,
> *Are Emergent Abilities of Large Language Models a Mirage?*, arXiv:2304.15004 [cs.CL];

the data-pruning argument of

> Ben Sorscher, Robert Geirhos, Shashank Shekhar, Surya Ganguli, Ari S. Morcos,
> *Beyond neural scaling laws: beating power law scaling via data pruning*, arXiv:2206.14486 [cs.LG];

and the hardware trend of

> Jaime Sevilla, Lennart Heim, Anson Ho, Tamay Besiroglu, Marius Hobbhahn, Pablo Villalobos,
> *Compute Trends Across Three Eras of Machine Learning*, arXiv:2202.05924 [cs.LG].

The site is a real learning environment: a source-mapped curriculum of twenty-three lessons in seven modules,
**eight laboratories that run real training runs**, a glossary whose dependencies are a checked directed acyclic
graph, an equation reference with derivations and worked examples, and a graded assessment bank.

> **Everything here is a teaching instrument.** The models are ridge estimators on a synthetic task with a decaying
> spectrum. It is not a transformer, and its exponents are not a transformer's exponents. No model, dataset or
> checkpoint is downloaded, and no data leaves the browser.

---

## Quick start

```bash
npm install          # from the workspace root, or in this directory
npm run dev          # http://localhost:5173
npm run lab          # the same eight laboratories, in the terminal
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reloading |
| `npm run build` | Type-check (`tsc -b`) then produce a static bundle in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |
| `npm test` | Vitest: the core functions, the rendered screens, the content and the terminal sweep (308 tests) |
| `npm run test:e2e` | Playwright browser tests, including the accessibility audit |
| `npm run lint` | Oxlint |
| `npm run lab -- <id>` | Run one laboratory from the terminal — see [the terminal runner](#the-terminal-runner) |

The production build is a static bundle: `dist/` can be served by any static host.
There is no backend, no API key and no network call at runtime.

---

## What is in the course

### The curriculum (7 modules, 23 lessons)

| Module | Lessons | Source |
| --- | --- | --- |
| **Power Laws** | 2 | Kaplan et al. §1, §1.1, §2.1, §3 |
| **Compute Optimality** | 3 | Hoffmann et al. §1, §3, §3.1; Kaplan et al. §2 |
| **The Frontier** | 3 | Hoffmann et al. §3, §3.1, §4; Muennighoff et al. §4 |
| **Data Constraints** | 6 | Muennighoff et al. §1, §3, §5 |
| **Pruning and Percolation** | 3 | Sorscher et al. §1, §2, §3, §5, §7 |
| **Emergence** | 3 | Schaeffer et al. §1, §3, §4 |
| **Compute Through Time** | 3 | Sevilla et al. §1, §3, §4 |

Every lesson names the section of the paper it was written from, and the test suite refuses a lesson that cites a
section which is not in the source map. Every lesson also deep-links one tab of one laboratory, and the counts are
checked: twenty-three lessons, twenty-three views, each linked exactly once.

### The eight laboratories

| Lab | What you can change | What you can measure |
| --- | --- | --- |
| **A · The power law** | The spectrum's decay, the noise, the capacity, the seed | The loss of a model trained on more and more data, the power law fitted to it, the factor a doubling buys, and the exponent that changes when the fitting range moves |
| **B · The compute optimum** | The budget, the task, the two sizes, the seed | The loss along a fixed budget, the two-variable surface fitted to a grid of runs, the allocation that minimises it, and the crossover between the two sizes |
| **C · The frontier** | The budget, the nest of budgets, the points per curve, the corpus, the seed | The IsoFLOP curves and the frontier through their minima, the allocation exponents measured against the ones the fitted surface predicts, and the budget at which the pool runs out |
| **D · Percolation** | The metric, the rare share of the pool, how visible the noise is, the metric's own error, the keep fraction, the seed | The keep fraction at which a pruned pool stops carrying a direction, the four metrics ranked on one pool, and the threshold predicted from the composition before the curve is drawn |
| **E · The epoch curve** | The epochs, the unique rows, the batch, the learning rate, the restarts, the seed | Two runs of the same tokens, one fresh and one repeated, the three phases of the repeated run, and the epoch at which repetition dominates |
| **F · The price of repetition** | The pool, the repetition constant, the unique rows, the capacity, the ridge, the repeats, the seed | The effective-data law, the extra tokens a repeated run is really worth, the allocation the law implies, and the measured gap between a repeated run and a fresh one |
| **G · The cliff** | The length of the task, the metric's threshold, the amplitude and exponent of the capability, the reporting floor | The whole-sequence score and the continuous metric over one capability, the artefact of averaging, and where the cliff moves when the metric moves |
| **H · Compute through time** | The era, the landmark runs listed, the break year and slope, the target loss, the wall-clock, the bridge to FLOPs, the noise | The reported trend of each era, a break in it and what claiming one costs, the loss a year's compute buys, and the year a target became buyable |

Every model in every laboratory is trained **in the browser, from scratch**, every time a setting changes.

### The rest of the course

- **Practice** — 52 questions with per-option feedback, worked explanations and source citations.
- **Glossary** — 27 terms, each with a plain-language definition and the terms that should be understood first. The
  dependency graph is checked for cycles.
- **Equations** — 17 results with the source, the plain-language meaning, every symbol, the assumptions, a derivation
  and a worked example.
- **Sources** — the six papers above plus the shared core, each with the licence it was verified under and the section
  map the lessons cite from.

---

## The rule this course follows

**Every number is computed, and nothing is faked.**

The algorithms live in `src/core/` as pure functions with no DOM and no framework. They are unit-tested in Node,
without a browser, and the interface renders what those functions return.

### The training runs are real

Every point on every chart is the held-out loss of a model that was fitted on freshly drawn data and measured on data
it had never seen. The power law is fitted to those points; the two-variable surface is fitted to a grid of them; the
compute optimum is read off the fitted surface; the emergence curves are computed from the metric's own formula.

Two measurements are made the careful way, because both were wrong in a way that looked plausible:

- **The held-out set is a fixed 512 rows, not a fraction of the training set.** The grid is swept along the sample
  axis, and the error of a loss estimate falls with the rows it is measured on, so a proportional hold-out makes the
  *noise of the ruler* a function of the axis the fit is reading.
- **The surface is fitted by non-negative least squares.** Ordinary least squares will happily price the irreducible
  loss, the capacity penalty and the data penalty below zero, and a negative floor makes the compute optimum a loss
  that no run can have. The fit enumerates the eight faces of the positive octant, and a floor that binds at zero is
  printed as bound rather than as a measurement.

### What is quoted and what is computed

The paper's headline ratio of tokens to parameters, its fitted repetition constant, its era statistics and its
reported growth rates are **quoted**, with their sources, and not computed here — they are measurements of
transformer runs, not of this laboratory's spectral task. Every screen distinguishes the two, and the laboratory
computes the same quantity for *this* surface beside it.

### The terminal runner

```bash
npm run lab                  # all eight, as printed text
npm run lab -- isoflop       # one laboratory
npm run lab -- all --json    # one object per laboratory
npm run --silent lab -- all --csv > scaling-lab.csv
npm run lab -- all --extremes   # every slider at both ends, and both corners
npm run lab -- epochs --seed 3
```

`tools/run-lab.mjs` reads the scenario the sliders start at from `src/content/labDefaults.ts`, walks the slider
endpoints listed in `src/content/labDomains.ts`, and calls the same core functions in the same order as the screens.
Nothing is re-implemented there: a disagreement between the terminal and the page is a bug in one of them, not a
difference of opinion between two implementations. `--extremes` is the test that a reader who drags a slider to its
end still gets a number rather than `NaN`, and it fails with a non-zero exit when any scenario prints one.

---

## Project layout

```
src/
  core/            the algorithms — pure functions, no React, no DOM
    spectral.ts     the scaling task, the ridge estimator, the training runs
    surface.ts      the power-law fit, the loss-surface fit, the compute optimum
    isoflop.ts      the IsoFLOP curves, the frontier, the crossover, the finite pool
    epochs.ts       the three phases of a repeated run, and what an epoch buys
    repeats.ts      the effective-data law and the repetition comparison
    percolation.ts  the pruning pool, the four metrics, the threshold and the cliff
    emergence.ts    the capability curves and the metric that makes the cliff
    hardware.ts     the three eras, the break in the trend, and what a year buys
  content/         the course: curriculum, labs, glossary, quiz, equations, sources
    labDefaults.ts  the scenario each screen starts at, read by the screens and the runner
    labDomains.ts   the range each slider can reach, read by the sweep and the screens
    labs.ts         the registry: id, name, blurb, the items it delivers
  components/lab/  the eight screens, their views, and the shared training-surface hook
  pages/           one file per route
  test/            test setup
tools/
  run-lab.mjs      the terminal runner, and the extreme-slider sweep
  extremes.test.mjs  the sweep as a test, with the check that it cannot miss a slider
  ts-resolver.mjs  lets Node import the TypeScript core directly
e2e/               Playwright specs, including the axe-core audit
docs/              sources and licensing
```

The shared interface layer lives in `@llm-materials/course-ui`, the numerical core in `@llm-materials/course-core`, and
the collection-wide catalogue in `@llm-materials/course-catalogue`. The rule is unchanged: **numbers are computed in
`src/core`, never in a component.**

---

## Accessibility

- An **axe-core audit** runs over eighteen pages in the browser suite — the index, a module, a lesson, the laboratory
  index and all eight laboratories from the registry, the practice bank, the glossary, the equations, the sources and
  the dashboard — in both the light and the dark theme, and fails the build on any `wcag2a`, `wcag2aa`, `wcag21a` or
  `wcag21aa` violation.
- Every laboratory is also opened in the browser twice: once on its first view, and once at the URL its last tab put
  there, so a deep link is checked against the state it claims.
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
