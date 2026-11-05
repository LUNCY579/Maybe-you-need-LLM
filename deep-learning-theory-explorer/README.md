# Deep Learning Theory Explorer

An interactive mathematical laboratory for the theory of neural networks, built around

> Daniel A. Roberts, Sho Yaida and Boris Hanin,
> *The Principles of Deep Learning Theory: An Effective Theory Approach to Understanding Neural Networks*,
> Cambridge University Press, 2022. Preprint: [arXiv:2106.10165](https://arxiv.org/abs/2106.10165).

This is **not** a machine-learning tutorial. It is a place to *experiment* with the
mathematics of that monograph: initialization and criticality, signal propagation,
the kernel recursion, finite-width fluctuations, the neural tangent kernel, and
representation learning. Every number the site displays is computed in your browser
from the definitions — Gaussian integrals by quadrature, network statistics by real
forward passes with seeded weights, gradients by exact backpropagation checked
against finite differences, kernels assembled from exact Jacobians. Nothing is
mocked, nothing is pretrained, and nothing is stored except your own progress.

Beyond the book, the **Further reading** screen keeps a linked map of the literature
around it — the scaling laws, grokking and adaptive-kernel work included — with a
year timeline and curated reading paths through the list.

The book is used as a **cited scholarly reference**. All prose, figures, code,
datasets and assessments here were written for this project; the mathematics is
cited by chapter, section and equation number. See
[`docs/LICENSING.md`](docs/LICENSING.md) and the in-app **Sources & licensing**
screen for the full attribution chain.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5178
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server |
| `npm run build` | Type-check (`tsc -b`) and produce a production build in `dist/` |
| `npm run typecheck` | Type-check only |
| `npm test` | Vitest unit, numerical and component suite (355 tests; the one that checks every external link needs the network and skips without it) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run test:e2e` | Playwright end-to-end suite (166 tests, Chromium) |
| `npm run test:all` | unit tests → production build → end-to-end tests |
| `npm run scan:claims` | list the prose that states a measurement, for auditing against `tests/` |

No server, no GPU, no API key, no network access is required at runtime. The
application is a static bundle; it can be opened from `dist/` on any static host.

To regenerate a set of screenshots of every screen:

```bash
# POSIX shells
CAPTURE=1 npx playwright test --grep "capture all screens"

# Windows PowerShell
$env:CAPTURE="1"; npx playwright test --grep "capture all screens"
```

The service worker is only registered in a production build, so its tests run
against the built bundle rather than the development server:

```bash
npm run build
npx vite preview --port 5179 --strictPort   # in another terminal
PWA=1 npx playwright test e2e/pwa.spec.ts
```

Requirements: Node 20+ and npm 10+. Playwright's Chromium is needed only for the
end-to-end suite (`npx playwright install chromium`).

---

## The screens

| Route | Screen | What it is for |
| --- | --- | --- |
| `/#/` | Course overview | What the app computes, what it verifies, where it stops, a live panel that opens a configured experiment in two clicks, and where to read next in the collection |
| `/#/prerequisites` | Prerequisite navigator | The mathematical toolkit, the notation the course uses, and self-checks |
| `/#/lessons` | Lesson reader | Ten lessons mapped to the source chapters, with guided numerical exercises whose answers are computed live |
| `/#/gallery` | Experiment gallery | Eleven preset experiments with a hypothesis, a seed and a stated expectation |
| `/#/equations` | Equation explorer | Sixteen results with symbol glossaries, assumptions, derivations, and a worked example computed live for every one of them |
| `/#/quiz` | Assessment | Twenty original questions with explanations and numeric tolerances |
| `/#/dashboard` | Learning dashboard | Lesson progress, quiz score, and a log of the experiments you ran |
| `/#/sources` | Sources & licensing | Attribution, originality, the scientific-integrity policy, library licences |
| `/#/atlas` | Theory atlas | Every concept of the monograph, organised by the authors' own principles, each tagged measured or cited |
| `/#/diagnostics` | Self-test | Re-checks the load-bearing claims in your own browser |
| `/#/labs/physics` | Neural network physics lab | Build a network, choose its initialization, watch every signal |
| `/#/labs/initialization` | Laboratory A | Initialization, criticality and signal propagation |
| `/#/labs/landscape` | Laboratory B | Gradient descent on real loss landscapes |
| `/#/labs/width-depth` | Laboratory C | Width, depth and the depth-to-width ratio |
| `/#/labs/ntk` | Laboratory D | Neural tangent kernels, assembled and audited |
| `/#/labs/representation` | Laboratory E | What training does to hidden representations |
| `/#/labs/drills` | Laboratory F | The prerequisite drills, with answers computed live |

Routing uses the URL hash, so the build works on any static host with no rewrite
rules.

---

## The seven laboratories

Each laboratory is a thin React layer over a **pure runner** in
`src/lib/experiments/`. The runners take a configuration and return measured
numbers; the components only render them. The same runners are called by the
unit-test suite, so what a student sees is what the tests check.

The screens, their routes and the manifest items they deliver are declared once,
in `src/content/labs.ts`; the navigation rail, the router and the tests all read
that registry, so a laboratory cannot be added to the screen list and forgotten
by the coverage audit.

### One shared setup

The laboratories are not separate toys. The activation, the
initialization hyperparameters, the depth, the width, the input distribution and
the seed live in a **shared setup** (`src/lib/sharedSetup.tsx`), persisted in
`localStorage` and shown at the top of every laboratory that measures. A change
made in one is a change in all of them, which is the book's central claim — that
one kernel recursion governs every architecture — made operational.

Laboratory F is the one screen that takes no setup: it grades a hand computation
against the same numerical core, so there is nothing for it to share. Each
registry entry records which kind it is (`sharesSetup`), and a test checks that
flag against the screen's own source, so the sentence above cannot quietly
become false.

The setup also has a **URL**: *copy link to this setup* produces a link that
reproduces the experiment for a second person, and the decoder treats that link
as untrusted input. Two kinds of link can be written by hand:

```
?s=act%3Drelu%2Ccw%3D2%2C...#/labs/initialization     the shared setup
/#/labs/initialization?preset=relu-kaiming            a gallery preset
```

The first carries the setup itself, in the query before the hash, because it
has to be readable by a reader who arrives from anywhere. The second is the
router's own query parameter, inside the hash, because it is a property of the
route.

### Laboratory A — initialization and signal propagation
Configurable depth, width, activation, initialization distribution, `C_W`, `C_b`,
input distribution, sample count and seed count. Reports, over an ensemble of
seeded networks: the measured layer kernel with its seed-to-seed spread, the
infinite-width recursion evaluated by Gauss–Hermite quadrature, the
asymptotic `1/((-a₁)ℓ)` law for the `K = 0` class, the RMS of the backpropagated
gradient, and a criticality scanner that solves the two susceptibility conditions
of eq. (5.55) numerically.

### Laboratory B — gradient descent and loss landscapes
Two genuine two-parameter slices of a real one-hidden-layer network trained on a
real dataset: the read-out slice (exactly quadratic — the kernel-regression problem
of Chapter 10) and the hidden-weight slice (genuinely non-convex). Shows the
surface, the trajectory, the optimizer comparison, and a Hessian obtained by central
finite differences of the *real* loss, with its eigenvalues and the `η < 2/λ_max`
stability threshold computed from the read-out Hessian.

### Laboratory C — width, depth and finite-width behaviour
Sweeps depth at fixed width and width at fixed depth, measuring the seed-to-seed
variance of the layer observable `O^(ℓ) = (1/n) Σ_j (z_j^(ℓ))²` for a single input
— exactly the quantity of eq. (3.33) — and comparing it with the analytic
`2ℓ(G⁽²⁾)²/n` law. Shows the depth-to-width ratio as the emergent scale.

### Laboratory D — the neural tangent kernel
Builds the empirical NTK from exact parameter Jacobians for a small differentiable
network, reports its symmetry defect and its eigenvalue spectrum, and (for a
two-layer network) compares it with the closed form
`C_W·K̇·(x·x′ + 1) + n₁·g + 1` derived in the app. Measures the width scaling of
the kernel and the *defrosting* of the kernel during training, with the
initialization-time and evolving kernels kept clearly separate.

### Laboratory E — representation learning
Trains a small classifier on a generated two-moons (or circles, or Gaussian
clusters) problem and measures the movement of the hidden features, the Fisher
class-separation ratio, and the drift of the kernel, before and after training and
across three widths. The 2-D view is a PCA projection and is labelled as such,
with its limitation stated next to the plot.

### Laboratory F — the prerequisite drills
Seventeen graded checks over the eight mathematical tools the prerequisite
navigator names — linear algebra, matrix calculus, probability, Gaussian
quadrature, the criticality recursion and the kernel limit. Every answer is the
value the application's own numerical core produces for the stated inputs, so a
drill has no stored key to fall out of date: `tests/exercises.test.ts` measures
each one against a closed form or a second rule. The working is revealed only
after the reader commits an answer, and each drill links to the screen where the
same quantity is measured rather than hand-computed.

### The physics lab
The flagship: every laboratory's machinery in one screen, with floating controls for
depth, width, activation, initialization distribution, weight scale, bias variance,
input distribution, learning rate, optimizer, training steps and the master seed.
It shows the forward-pass preactivation distribution, the weight distribution, the
layer-wise kernel profile, the gradient signal, and the loss trajectory, and it
reports the critical `C_W` that the scanner finds.

---

## Project layout

```
src/
  lib/
    numerics/        pure numerical core, no React
      activations.ts   activation registry with the book's universality classes
      mlp.ts            MLP construction, forward pass, analytic backpropagation
      gaussian.ts       g(K), susceptibilities, criticality scanner, kernel flow
      quadrature.ts     Gauss-Hermite and bivariate Gaussian quadrature
      ntk.ts            two-layer NTK closed form, frozen NTK recursion
      optimizers.ts     GD, heavy-ball momentum, Adam
      objectives.ts     the two-parameter loss-landscape objectives
      representation.ts PCA, Fisher ratio, feature and kernel drift
      linalg.ts         small dense linear algebra, Jacobi eigensolver
      rng.ts            seeded mulberry32 stream and statistics
      datasets.ts       generated toy problems
    experiments/     the runners the laboratories call (pure functions)
    persistence.ts   localStorage progress record
    hooks.ts          async-safe computation hook
    theme.ts          the shared dark palette and Plotly defaults
    plotly.ts         the small charting bundle: only the traces this app draws
  content/           lessons, equations, quizzes, experiment presets, references
  lib/terminology.ts  the nineteen symbols the course leans on, with their meanings
  lib/search.ts       one index over the whole curriculum, for the global search box
  components/        Math (KaTeX), Plot (Plotly), UI primitives, live lesson figures
  pages/             one file per screen
tools/               build-time scripts: claims-scan.mjs lists the prose that states a
                     measurement; readCollection.mjs reads the collection's catalogue
                     into src/content/collection.generated.ts
tests/               Vitest: 37 files, 355 tests
e2e/                 Playwright: 33 files, 166 tests
docs/                curriculum map, licensing, reproducibility, test report
```

The separation is deliberate: `src/lib/numerics` and `src/lib/experiments` contain
no React and no DOM access, so they can be tested exhaustively in Node. The
presentation layer is thin.

---

## The scientific method

The rules this project follows, and where you can see them enforced:

1. **No fabricated numbers.** Every plotted value is produced by an actual
   computation at render time. There are no stored result arrays anywhere in the
   repository.
2. **Exercise answers are computed, not typed.** The numerical exercises in the
   lessons are *guided*: the value the learner is asked to reproduce is produced
   at run time by the same numerical code the laboratories use
   (`src/lib/exercises.ts`), and the learner's own answer is checked against it.
   The test suite asserts that the prose answer and the computed answer agree.
3. **Measured and theoretical are always distinguished.** Charts draw measured
   curves and analytic curves with separate legends; captions state which is which
   and at what order.
4. **Sample counts and seeds are shown.** Panels state the number of seeds, the
   number of input samples and the seed value used.
5. **Gradients are verified independently.** Analytic backpropagation is checked
   against central finite differences on every parameter.
6. **Kernels are audited.** NTK matrices are tested for symmetry and positive
   semidefiniteness, offline and in the browser.
7. **Instability is shown, not hidden.** Diverging runs, overflow and non-finite
   values are reported, and the run is flagged.
8. **Approximations are named.** Gauss–Hermite quadrature, bivariate quadrature and
   PCA-based embeddings are labelled as approximations with their error
   characteristics stated — and the self-test measures the quadrature against
   an independent rule, in the reader's browser, because every theory curve
   in the application rests on it.
9. **Toy scale is never presented as the full theory.** Every laboratory
   carries a limitation callout saying what its measurements do not establish
   — the scale of the simulation, the conventions, the part of the argument it
   does not reach — and the overview's scope panel says exactly which parts of
   the book's effective theory are implemented here and which are only cited.
10. **Nothing is claimed as a research finding.** The app reports what the code
   computed under stated conditions.
11. **The data can be checked.** Every result table can be downloaded as CSV
    with a provenance header recording the settings that produced it — the
    self-test's results and the assessment's answers included, so the
    assessment can be downloaded as a study sheet. Every symbol in the prose
    is a link to its definition.
12. **The palette is audited, not chosen by eye.** A test measures the contrast
    ratios of every colour in both themes, another test parses the
    stylesheet and compares it with the palette the charts use, so the panels
    and the plots can never drift into different colours, and a third checks
    that two lines on the same chart are still two lines to a reader with a
    colour vision deficiency — about one man in twelve cannot separate a red
    line from a green one, and a pair that differs only in that way is one
    line to them.
13. **The interface never blocks.** The measurements run in a Web Worker — in
    the laboratories *and* in the lesson figures — and the computation is
    debounced, so a slider drag produces one measurement rather than dozens
    and the page stays alive while it runs. The charting library is bundled
    with only the traces this application draws, because evaluating the whole
    of it costs half a second of frozen page.
14. **The privacy claim is tested, not promised.** The application says it
    makes no server call, sends no telemetry and needs no account. A
    browser test watches the network while the whole course is walked, and
    fails if a single request goes to another origin or a single byte is
    sent by a method that could carry data.
15. **The promises in this list are checked.** A test reads the source of the
    seven laboratories and asserts the properties claimed here: that each one
    carries a limitation callout, records the seed of the run it logs, offers
    its numbers as a CSV, names the lessons it demonstrates, and does not
    compute on the main thread inside a render. A promise that is not
    checked is a promise that quietly stops being kept.
16. **A number in the prose is a number the test re-measures.** Where a lesson,
    a caption or a laboratory note says what the code found — how many roots
    the criticality scanner sees, the `C_b` it computed, the susceptibility
    ratio at a given `K` — a test parses that number off the rendered string
    and measures it again with the same code, so a sentence cannot drift away
    from the computation it reports. `npm run scan:claims` prints the list of
    prose that states a measurement, so an audit starts from an inventory
    rather than from memory.

---

## Working with the curriculum

The curriculum is a course, not a list.

- **Your next step.** The dashboard derives a single next action from what you
  have read, worked, answered and run — and states why it is that action.
- **Prerequisites are real.** A lesson whose prerequisites are unread is
  marked locked in the progress table.
- **Practise before you move on.** The plan prefers the exercises of a lesson
  you have just read, because that is the rhythm the course is built on:
  intuition, formal definition, experiment, verification exercise.
- **Notes.** Every lesson has a notes box, private to your browser, printed
  with the lesson if you print it.
- **Your record is yours.** Export it as JSON, import it on another machine.
  An imported record is validated before it is used: unknown fields are
  dropped, malformed entries are skipped, and a record from another version is
  refused rather than half-applied.
- **You are one course in a collection.** The overview names the courses to
  read next and why, and the ideas this course shares with them. The data is
  generated from the collection's own catalogue at build time, so it cannot
  quietly fall out of date.
- **The keyboard works.** `⌘K` (or `Ctrl-K`) opens the command palette, `/`
  focuses the search box, `?` lists every shortcut, and `Esc` closes
  whatever is open.
- **Nothing is lost by accident.** The progress record has no server copy, so
  erasing it asks first, states exactly what will be destroyed, and the
  destructive choice has to be made deliberately.
- **The small screen is a real screen.** Below the `lg` breakpoint the
  navigation rail becomes a horizontal strip that fades the edge with content
  behind it and scrolls the current section into view, so a phone is not a
  cut-down version of the desktop but a usable one.
- **The page prints as a document.** `Ctrl-P` gives ink on white, not a
  screenshot of a dark screen: the navigation and the controls are dropped,
  the exercise answers are unfolded, the charts are re-measured for the paper
  and re-coloured for it, and the reader's own notes come with the lesson.

### What is *not* simulated

These are stated in the lessons and on the relevant screens, so a student is never
misled:

- The full effective action of Chapter 5, with all of its couplings.
- The renormalization-group flow of Chapter 4 in its complete form.
- Bayesian inference at finite width (Chapter 6). The results are cited, not simulated.
- The end-of-training analysis of Chapter 12 in full; the defrosting of the NTK and
  the movement of features are measured, not derived.
- Residual networks (Appendix B) and the information-theoretic bound of Appendix A.
- The optimal aspect ratio `r*` of Appendix A: the app measures the fluctuations
  that the argument bounds, but does not compute the bound.

---

## Reproducing the experiments

Every experiment is a pure function of a configuration plus a seed. See
[`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md) for the recipe of each of the
eleven gallery presets, and for the seeding scheme.

In short: randomness is a seeded `mulberry32` stream, feeding either Gaussian or
scaled-uniform weights. Setting the seed and the settings reproduces a run
exactly, in any browser, on any machine.

---

## Documentation

| Document | Contents |
| --- | --- |
| [`docs/CURRICULUM.md`](docs/CURRICULUM.md) | The source-mapped curriculum: chapters → lessons → equations → laboratories |
| [`docs/REPRODUCIBILITY.md`](docs/REPRODUCIBILITY.md) | Seeding scheme and a recipe for every preset experiment |
| [`docs/LICENSING.md`](docs/LICENSING.md) | Attribution, originality, and the licences of every dependency |
| [`docs/TEST_REPORT.md`](docs/TEST_REPORT.md) | What is tested, what the tests found, and what is still untested |

---

## License

The code in this repository is original work created for this project; see
[`docs/LICENSING.md`](docs/LICENSING.md) for the full statement and for the licences
of the third-party packages it depends on. The textbook it teaches from is
copyrighted by its authors and its publisher and is **not** redistributed here.
