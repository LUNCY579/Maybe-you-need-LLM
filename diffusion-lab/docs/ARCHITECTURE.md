# Architecture

## The shape of the project

Diffusion Lab is a browser-only application. It has no backend, no API key and no
network call at runtime. The production build is a static bundle that can be served
from any static host, or opened from the file system.

```
src/
  core/            the algorithms — pure functions, no React, no DOM
  content/         the course: curriculum, glossary, quiz, equations, sources
  components/      the laboratories, the primitives, the charts, the shell
  pages/           one file per route
  state/           the progress record
```

The rule the project follows is the one the other courses in this collection follow:

> **Numbers are computed in `src/core`, never in a component.**

A laboratory component wires controls to core functions and renders what those
functions return. Nothing is stored, pre-baked or hard-coded.

---

## The core

Seven modules, each a pure TypeScript file with no imports from React and no access
to the DOM.

| Module | What it owns |
| --- | --- |
| `schedules.ts` | β schedules (linear and cosine), ᾱ, the signal-to-noise ratio, the terminal KL divergence, the effective diffusion length |
| `forward.ts` | The one-step transition, the closed form, the Markov chain, the posterior, the noise swap |
| `reverse.ts` | The three parameterisations, the reverse mean, the ancestral step, the DDIM step, the samplers |
| `mlp.ts` | A perceptron with analytic gradients, and Adam |
| `denoiser.ts` | The diffusion model that is trained in the browser, and the sample-quality measurements |
| `guidance.ts` | The exact score of a Gaussian mixture, the guided score, guided Langevin dynamics, the fidelity–diversity measurement |
| `variational.ts` | The KL between Gaussians, the per-step bound terms, the weight of the true bound, the decomposition |
| `latent.ts` | A principal-component autoencoder, the reconstruction error, the latent variance, the compression arithmetic |

Everything is deterministic. Randomness comes from a seeded `mulberry32` stream, so the
same settings always produce the same figures — on any machine, in any browser.

### Why the gradients are checked against finite differences

`mlp.ts` has an explicit backpropagation, written out rather than delegated. That is
only defensible if it is verified, and it is: `core.test.ts` checks the analytic
gradient against a central finite difference on **every parameter**, for every
parameter in the network.

That test earned its place. When it was first written it failed, and it found three
separate bugs in the backward pass:

1. the activation derivative was taken from the pre-activation rather than the
   activation, so `1 − pre²` was used where `1 − tanh(pre)²` was required;
2. the derivative of the output layer was never applied at all, because the output
   layer has no activation and the code treated it as if it did;
3. the back-propagated delta had the dimension of the previous layer's *columns*
   rather than its *rows*, which silently zeroed the gradient of every unit in the
   widest hidden layer.

Any one of those would have produced a model that trained, lost weight, and generated
plausible-looking noise.

### The trainable model

`denoiser.ts` implements the simplified objective of equation 14 exactly:

```
L_simple(θ) = E_{t, x_0, ε} [ ‖ε − ε_θ(√ᾱ_t x_0 + √(1−ᾱ_t) ε, t)‖² ]
```

with the timestep drawn uniformly and the noise drawn fresh. The training loop draws
data, draws a timestep, draws noise, forms x_t through the closed form, and takes a
gradient step on the squared error — one network evaluation per example, with no
unrolling of the chain, which is the property the paper's efficiency argument rests
on.

---

## The content

`src/content/` holds the course itself, and it is the part the test suite polices
hardest, because the source-mapping is the promise the course makes.

| File | What it holds |
| --- | --- |
| `curriculum.ts` | Six modules, twelve lessons, the source references, and the section map of the primary source |
| `glossary.ts` | Thirty-two terms with their dependencies |
| `quiz.ts` | Twenty-five questions with explanations and citations |
| `formulas.ts` | Fifteen equations with derivations and worked examples |
| `sources.ts` | The references and the licence audit |

### What the content tests enforce

- Every lesson belongs to a module that exists.
- Every lesson has objectives, key ideas, a laboratory and a positive reading time.
- Every lesson points at a laboratory that exists.
- **Every source reference names a section that is in the section map.** A lesson
  cannot cite a section that does not exist.
- Every source reference has a note and a chapter.
- The prerequisite graph is acyclic, and every prerequisite names a lesson that comes
  earlier.
- Every glossary term a lesson names exists, and the glossary's dependency graph is
  acyclic.
- Every quiz id a lesson names exists.
- Every multiple-choice question has exactly one correct option, and it is one of the
  options offered.
- Every numeric question has a number and a tolerance, and **every integer answer has
  a tolerance of zero** — a plausible guess must not be accepted.
- Every formula has a derivation, at least one assumption, at least one symbol and a
  worked example, and its LaTeX braces balance.
- Every reference has a licence note and an https URL.

---

## The interface

### Theme and rendering

The theme is decided before the first paint by a small script in `index.html`, so the
page never flashes the wrong surface. The application reads the result back out of
the document element; there is no second decision anywhere.

Colours come entirely from custom properties, so both themes are defined in one place
and can be checked against each other. The accessibility audit found real contrast
violations in the first version of the palette — the secondary text colour was at
4.1:1 against the panel surface, where 4.5:1 is required — and the palette was fixed
rather than the rule relaxed.

### Mathematics

`components/ui/Math.tsx` renders LaTeX with KaTeX. Every expression is also exposed as
text to assistive technology, so a screen reader is offered the same information the
sighted reader gets from the typeset equation.

### Figures

`components/viz/Charts.tsx` wraps Recharts. Every figure has:

- a title,
- a caption that says **what is measured and what is analytic**,
- a text description for assistive technology,
- and, wherever it matters, a table of the same numbers.

The rule is that a chart is never the only way to see a number.

### Progress

`state/ProgressContext.tsx` wraps the shared store from `@llm-materials/course-core`:
a versioned localStorage record holding which lessons are complete, which questions
were answered correctly, how long was spent, and what was bookmarked. It exports to
JSON and imports back with validation, so a corrupted file cannot break the
application.

---

## The shared core

The course depends on `@llm-materials/course-core` for the parts that more than one
course needs:

| Module | What it provides |
| --- | --- |
| `math` | Vectors, matrices, the seeded RNG, distributions, softmax, losses, the normal CDF and its inverse |
| `linalg` | Jacobi eigendecomposition, power iteration, Cholesky, linear solve, inverse |
| `stats` | OLS, power-law fits, bootstrap intervals, permutation tests, effect sizes, multiple-comparison corrections |
| `preference` | Bradley–Terry maximum likelihood, Elo |
| `storage` | Versioned localStorage with migration and an in-memory fallback |
| `progress` | The progress record, summaries, JSON import and export |
| `quiz` | The assessment model and grading for every question kind |
| `search` | Deterministic, explainable course search |
| `curriculum`, `glossary` | The schemas, selectors and cycle detection |

The core is framework-free on purpose: it can be tested exhaustively in Node, without a
DOM, and it is where the parts of the course that must be right — the gradients, the
Gaussian KL, the linear algebra — are checked.

---

## Testing

Four layers, each proving something the others cannot.

| Layer | Tool | What it proves |
| --- | --- | --- |
| Core | Vitest, Node | The mathematics in `src/core/`. 56 tests, including a finite-difference check of every gradient and the preconditioned sampler |
| Content | Vitest, Node | The source mapping in `src/content/`. 28 tests, enforcing every rule listed above |
| Screen and figures | Vitest, jsdom | The laboratory on screen, in `src/components/lab/labs.test.tsx`, and every number a laboratory prints, recomputed with the settings its controls hold, in `src/components/lab/labFigures.test.tsx`. 35 tests — and the caption claims the figures make are measured rather than trusted |
| Landing | Vitest, jsdom | The counts and the training budget the front page states, against the registry and the curriculum, in `src/pages/LandingPage.test.tsx`. 3 tests |
| Browser | Playwright, Chromium | The student journey, and an axe-core audit of fourteen pages in both themes |

The browser suite runs against the **production build**, because that is what a learner
opens.
