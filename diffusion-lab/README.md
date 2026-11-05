# Diffusion Lab

An interactive course on **diffusion probabilistic models**, built around

> Jonathan Ho, Ajay Jain and Pieter Abbeel,
> *Denoising Diffusion Probabilistic Models*,
> arXiv:2006.11239 [cs.LG] / NeurIPS 2020.

The site is a real learning environment. It contains a source-mapped curriculum, six
laboratories that run real algorithms, a glossary whose dependencies are a checked
directed acyclic graph, an equation reference with derivations and worked examples, and
a graded assessment bank.

> **Everything here is a teaching instrument.** The simulations are deterministic and
> seeded. No pre-trained model is downloaded or redistributed; the denoising network in
> Laboratory B is trained in your browser, from scratch, every time you press the button.
> The course never presents a toy sample as if it were a published result.

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
| `npm test` | Vitest unit and content tests (70 tests) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright browser tests, including the accessibility audit |
| `npm run lint` | Oxlint |

The production build is a static bundle: `dist/` can be served by any static host.
There is no backend, no API key and no network call at runtime.

---

## What is in the course

### The curriculum (6 modules, 12 lessons)

| Module | Lessons | Source |
| --- | --- | --- |
| **The Forward Process** | What a diffusion model is · The closed form · The posterior | DDPM §1, §2 |
| **The Reverse Process** | The training objective · Three parameterisations · Sampling | DDPM §3.2, §3.4 |
| **Noise Schedules** | Choosing a schedule · The weighting | DDPM §3.1, §3.4, §4 |
| **Latent Diffusion** | The latent space | Rombach et al. |
| **Guidance** | Classifier-free guidance · The price of guidance | Ho & Salimans |
| **The Design Space** | The design space | Karras et al., DDIM |

Every lesson names the section and equation of the paper it was written from, and the
test suite refuses a lesson that cites a section which is not in the source map.

### The six laboratories

| Lab | What you can change | What you can measure |
| --- | --- | --- |
| **A · The forward process** | The timestep, the seed, the view | The chain, the closed form against the Markov chain, the posterior’s weights, the noise swap |
| **B · The reverse process** | The seed, the sampler, the parameterisation | A real denoiser trained in the browser, its loss curve, its samples, and the conversions between ε, x₀ and v |
| **C · Noise schedules** | The schedule, the number of steps | ᾱ_t, the signal-to-noise ratio, the terminal KL divergence, the effective diffusion length |
| **D · Latent diffusion** | The latent dimension, the seed | The reconstruction error, the variance retained, the unit-variance scale, the saving in elements and in attention |
| **E · Guidance** | The guidance weight, the condition | The exact guided score, the fidelity–diversity trade-off, the class posterior, and the tilted distribution |
| **F · The variational bound** | The view | The weight of the true bound, the per-step KL terms, and the cost of a sample |

### The rest of the course

- **Practice** — 25 questions with per-option feedback, worked explanations and source
  citations. The numeric questions have tolerances tight enough that a plausible guess
  fails.
- **Glossary** — 32 terms, each with a plain-language definition and the terms that
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

Where a number could be mistaken for a published result, the interface says what it
actually is:

| The number | What it is |
| --- | --- |
| The forward process, the posterior, the KL divergence | Exact. Closed forms, evaluated. |
| The guided score | Exact. The score of a Gaussian mixture is known in closed form. |
| The compression saving | Exact arithmetic on the shapes involved. |
| The reconstruction error | Measured, on a linear autoencoder fitted to a generated dataset. |
| The denoiser’s samples | From a two-layer perceptron trained here, on a generated ring of eight modes. |

The last one is the important honesty: **Laboratory B is a toy model.** It is a real
diffusion model with a real gradient, a real sampler and a real loss curve — and it is
not a model of images, and it produces none of the sample-quality numbers the paper
reports.

---

## Project layout

```
src/
  core/            the algorithms — pure functions, no React, no DOM
    schedules.ts     β schedules, ᾱ, the signal-to-noise ratio, the terminal KL
    forward.ts       the closed form, the Markov chain, the posterior, the noise swap
    reverse.ts       the three parameterisations, the ancestral and DDIM samplers
    mlp.ts           a small perceptron with analytic gradients, and Adam
    denoiser.ts      the diffusion model that is trained in the browser
    guidance.ts      the exact score of a Gaussian mixture, and guided Langevin
    variational.ts   the KL between Gaussians, the bound, and its weights
    latent.ts        a principal-component autoencoder and the compression arithmetic
  content/         the course itself: curriculum, glossary, quiz, equations, sources
  components/
    lab/             the six laboratories
    layout/          the shell and the error boundary
    ui/              the shared primitives and the mathematics renderer
    viz/             the chart wrappers
  pages/           one file per route
  state/           the progress record, on top of @llm-materials/course-core
  test/            test setup
e2e/               Playwright specs, including the axe-core audit
docs/              architecture, sources and licensing, test report
```

The rule the project follows: **numbers are computed in `src/core`, never in a
component.** A laboratory component wires controls to core functions and renders what
they return. That is what makes the algorithms testable without a DOM, and it is why the
test suite can assert on the mathematics rather than on the DOM.

---

## The shared core

The course builds on `@llm-materials/course-core`, the package shared by every course
in this collection. It provides the seeded random number generator, the linear algebra,
the statistics, the Bradley–Terry model, the versioned progress store, the assessment
engine and the search.

```ts
import { createRng, fitBradleyTerry, search } from '@llm-materials/course-core'
```

It is framework-free by design, so it can be tested exhaustively in Node.

---

## Accessibility

Accessibility is enforced, not asserted:

- An **axe-core audit** runs over fourteen pages in the browser suite, in both the light
  and the dark theme, and fails the build on any `wcag2a`, `wcag2aa`, `wcag21a` or
  `wcag21aa` violation. It currently passes clean — and when it was first added it
  found real contrast violations in the colour palette, which were fixed rather than
  suppressed.
- Every tab strip implements the WAI-ARIA tab pattern; radio groups support arrow keys;
  charts carry a name, a caption and a data-table alternative.
- The theme is applied before the first paint, so the page never flashes the wrong
  surface.
- `/` opens the course search and `Escape` closes it.

---

## Licence

The course code is original work and is released under the **MIT licence**. The course
content is released under the same terms.

The source papers are **cited and linked, never redistributed**. No figure, table,
image, dataset or third-party code from any cited work appears in this repository.
Every figure in the course is an original plot of a computation made in the browser.

See [`docs/SOURCES_AND_LICENSING.md`](docs/SOURCES_AND_LICENSING.md) for the full
statement.
