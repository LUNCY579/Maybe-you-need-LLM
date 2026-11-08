# RLHF Lab

An interactive course on **reinforcement learning from human feedback**, built around

> Shengyi Huang, Michael Noukhovitch, Arian Hosseini, Kashif Rasul, Weixun Wang and Lewis Tunstall,
> *The N+ Implementation Details of RLHF with PPO: A Case Study on TL;DR Summarization*,
> arXiv:2403.17031 [cs.LG] / COLM 2024.

The site is a real learning environment: a source-mapped curriculum, six laboratories
that run real algorithms, a glossary whose dependencies are a checked directed acyclic
graph, an equation reference with derivations and worked examples, and a graded
assessment bank.

> **Everything here is a teaching instrument.** The policy is a softmax over a handful of
> logits, the reward model is a generated function with a *known, injected* error, and no
> model is downloaded. The algorithms are the paper's; the setting is the course's, and the
> interface says which is which.

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
| `npm test` | Vitest unit and content tests (166 tests) |
| `npm run test:e2e` | Playwright browser tests, including the accessibility audit |
| `npm run lint` | Oxlint |

The production build is a static bundle: `dist/` can be served by any static host. There
is no backend, no API key and no network call at runtime.

---

## What is in the course

### The curriculum (6 modules, 11 lessons)

| Module | Lessons | Source |
| --- | --- | --- |
| **Policy Gradients** | The objective · The estimator | Huang et al. §2 |
| **Trust Regions** | The trust region | Schulman et al. 2015 |
| **Proximal Policy Optimization** | The clipped objective · Advantages and GAE | PPO; Huang et al. §2, §4 |
| **The KL Penalty** | The KL penalty | Huang et al. §4 |
| **The N+ Details** | The three stages · The checklist | Huang et al. §2, §4, §5 |
| **Reward Overoptimisation** | The result · The functional forms · The operational lesson | Gao et al.; Huang et al. §5 |

Every lesson names the section of the paper it was written from, and the test suite
refuses a lesson that cites a section which is not in the source map.

### The six laboratories

| Lab | What you can change | What you can measure |
| --- | --- | --- |
| **A · The policy gradient** | The contexts, the actions, the seed | The expected reward and its gradient, checked against a central finite difference on every logit; the score-function estimator; the KL a step produces |
| **B · The clipped objective** | The clip range, the seed | Where the clip bites, and that the gradient there is exactly zero rather than small; the clip fraction as the policy is pushed |
| **C · Advantages and GAE** | λ, γ, the seed | The estimate at every λ, the distance to the Monte Carlo answer, and the variance it trades against |
| **D · The KL penalty** | The separation, the sample count, the seed | The three estimators side by side, each against the quantity it is actually unbiased for |
| **E · The pipeline** | The view | The three stages, their failure modes, and the checklist of implementation details |
| **F · Reward overoptimisation** | The reward model's error, how far to push | The overoptimisation curve, computed exactly; the two functional forms, fitted; best-of-n against reinforcement learning |

### The rest of the course

- **Practice** — 22 questions with per-option feedback, worked explanations and source
  citations.
- **Glossary** — 29 terms with a plain-language definition and the terms that should be
  understood first. The dependency graph is checked for cycles.
- **Equations** — 14 results with the source, the plain-language meaning, every symbol,
  the assumptions, a derivation and a worked example.
- **Sources** — every work cited, with the licence it was verified under, and the section
  map of the primary source.

---

## The rule this course follows

**Every number is computed, and every gradient is checked.**

The algorithms live in `src/core/` as pure functions with no DOM and no framework. They
are unit-tested in Node, without a browser, and the interface renders what those
functions return.

Two of them deserve particular mention, because they are the checks that make the rest
trustworthy:

- **The policy gradient is verified against a central finite difference on every logit.**
  The laboratory reports the worst error, and it is of the order of the difference
  approximation's own precision.
- **The overoptimisation effect is computed, not illustrated.** The reward model's error
  is fixed and known, so the policy that maximises the proxy subject to a KL budget is
  available in closed form — the exponential tilt — and the curve can be traced exactly.
  The turning point is a real turning point of a real curve, not a picture of one.

### The setting is the course's, and it is labelled as such

The policy is a softmax over a few logits, the reward model is a generated quadratic
with an injected slope and wiggle, and the numbers that come out are measurements of a
controlled setting. **They are not measurements of any published RLHF system**, and the
interface never suggests that they are.

---

## Project layout

```
src/
  core/            the algorithms — pure functions, no React, no DOM
    policy.ts       the policy, its gradients, its entropy, its KL to a reference
    ppo.ts          the clipped surrogate, the advantages, GAE, the value loss
    kl.ts           the three KL estimators, the reverse KL, the chi-square divergence
    overoptimisation.ts  the reward setting, the exponential tilt, the fits
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

The source papers are **cited and linked, never redistributed**. No figure, table,
image, dataset or third-party code from any cited work appears in this repository. Every
figure is an original plot of a computation made in the browser.

See [`docs/SOURCES_AND_LICENSING.md`](docs/SOURCES_AND_LICENSING.md) for the full
statement.
