# Evaluation Lab

An interactive course on **how language models are evaluated**, built around

> Lianmin Zheng, Wei-Lin Chiang, Hao Zhang, Joseph E. Gonzalez and Ion Stoica,
> *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena*,
> arXiv:2306.05685 [cs.CL] / NeurIPS 2023 Datasets and Benchmarks.

The site is a real learning environment: a source-mapped curriculum, five
laboratories that run real algorithms, a glossary whose dependencies are a checked
directed acyclic graph, an equation reference with derivations and worked examples,
and a graded assessment bank.

> **Everything here is a teaching instrument.** The simulations are deterministic and
> seeded. The judge in the laboratory is a *synthetic* model with known, injected
> biases — it is a measuring instrument for bias, not a model, and it is not any
> published judge. No model is downloaded, no dataset is used, and no data leaves the
> browser.

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
| `npm test` | Vitest unit and content tests (105 tests) |
| `npm run test:e2e` | Playwright browser tests, including the accessibility audit |
| `npm run lint` | Oxlint |

The production build is a static bundle: `dist/` can be served by any static host.
There is no backend, no API key and no network call at runtime.

---

## What is in the course

### The curriculum (6 modules, 12 lessons)

| Module | Lessons | Source |
| --- | --- | --- |
| **Judging with a Model** | What a judge is asked to do · Agreement and consistency | Zheng et al. §1, §2 |
| **The Biases of a Judge** | Position bias · Verbosity and self-enhancement | Zheng et al. §4 |
| **Human Agreement** | What an agreement rate means | Zheng et al. §1, §2 |
| **Arena Rankings** | From votes to a ranking · The interval and the cost | Chiang et al. §3 |
| **Benchmark Design** | Contamination · What a benchmark is for | Zheng et al. §6; HELM |
| **Measurement** | The standard error · How many questions · What to publish | Reuel et al. |

Every lesson names the section of the paper it was written from, and the test suite
refuses a lesson that cites a section which is not in the source map.

### The five laboratories

| Lab | What you can change | What you can measure |
| --- | --- | --- |
| **A · The judge and the human** | The question count, the judge's noise and position bias, the seed | The agreement rate with its standard error, the consistency under a swap, and how agreement falls with question difficulty |
| **B · The biases of a judge** | Each of the three biases, independently | The first-position rate, the longer-answer rate, and the self-preference gap — each recovered from the bias that was put in |
| **C · The arena** | The votes per pair, the question count, the seed | The Bradley–Terry ranking, the bootstrap interval on it, the Elo season, and how many votes it takes to separate two models |
| **D · Benchmark design** | The score, the question count, the contaminated fraction, the inflation | The reported score under contamination, the movement of a ranking under differential contamination, and the effect of the difficulty mix |
| **E · Measurement** | The score, the question count, the difference to detect | The interval and its width, the power of the comparison, and the number of questions a given difference needs |

### The rest of the course

- **Practice** — 24 questions with per-option feedback, worked explanations and source
  citations. The numeric questions have tolerances tight enough that a plausible guess
  fails.
- **Glossary** — 28 terms, each with a plain-language definition and the terms that
  should be understood first. The dependency graph is checked for cycles.
- **Equations** — 15 results with the source, the plain-language meaning, every symbol,
  the assumptions, a derivation and a worked example.
- **Sources** — every work cited, with the licence it was verified under, and the
  section map of the primary source.

---

## The rule this course follows

**Every number is computed, and nothing is faked.**

The algorithms live in `src/core/` as pure functions with no DOM and no framework.
They are unit-tested in Node, without a browser, and the interface renders what those
functions return. There are no stored result arrays anywhere in the repository.

### The judge is a measuring instrument, and the interface says so

This is the honest part of the course. The judge is **synthetic**: its score is an
answer's true usefulness, plus a position bias, plus a verbosity bias, plus a
self-preference term, plus noise. The true usefulness is known, because the answers are
generated.

That is what makes the biases *measurable* rather than merely suspected. The
laboratory's check is that the measured excess preference tracks the injected bias —
and it does, because the experiment was designed to isolate exactly that.

What this is **not**: a measurement of any published judge, a claim about any real
model's judgement, or a reproduction of any number in any paper. The numbers here are
measurements of a controlled simulation.

---

## Project layout

```
src/
  core/            the algorithms — pure functions, no React, no DOM
    setting.ts      the synthetic models, questions, answers, the judge and the human
    arena.ts        votes, the Bradley–Terry fit, the bootstrap, Elo, the cost of a vote
    measurement.ts  standard errors, intervals, power, contamination
  content/         the course: curriculum, glossary, quiz, equations, sources
  components/lab/  the five laboratories
  pages/           one file per route
  test/            test setup
e2e/               Playwright specs, including the axe-core audit
docs/              architecture, sources and licensing
```

The shared interface layer — the primitives, the mathematics renderer, the charts, the
shell and the progress provider — lives in `@llm-materials/course-ui`, and the numerical
and statistical core in `@llm-materials/course-core`. The rule is unchanged: **numbers
are computed in `src/core`, never in a component.**

---

## Accessibility

- An **axe-core audit** runs over fourteen pages in the browser suite, in both the light
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
