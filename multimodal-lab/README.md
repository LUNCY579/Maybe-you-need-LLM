# Multimodal Lab

An interactive course on **two modalities, one space, and what the method buys**, built around

> Alec Radford, Jong Wook Kim, Chris Hallacy, Aditya Ramesh and others,
> *Learning Transferable Visual Models From Natural Language Supervision*,
> arXiv:2103.00020 [cs.CV] / ICML 2021,

together with the visual instruction tuning recipe of

> Haotian Liu, Chunyuan Li, Qingyang Wu and Yong Jae Lee,
> *Visual Instruction Tuning*, arXiv:2304.08485 [cs.CV] / NeurIPS 2023,

and the few-shot method of

> Jean-Baptiste Alayrac and others,
> *Flamingo: a Visual Language Model for Few-Shot Learning*,
> arXiv:2204.14198 [cs.CV] / NeurIPS 2022.

The last module adds the sigmoid loss of

> Xiaohua Zhai, Basil Mustafa, Alexander Kolesnikov, Lucas Beyer,
> *Sigmoid Loss for Language Image Pre-Training*, arXiv:2303.15343 [cs.CV] / ICCV 2023,

the frozen bridge of

> Junnan Li, Dongxu Li, Silvio Savarese, Steven Hoi,
> *BLIP-2*, arXiv:2301.12597 [cs.CV] / ICML 2023,

and the patch embedding of

> Alexey Dosovitskiy and others,
> *An Image is Worth 16x16 Words*, arXiv:2010.11929 [cs.CV] / ICLR 2021.

The site is a real learning environment: a source-mapped curriculum, five laboratories that compute a model in front of
you, a glossary whose dependencies are a checked directed acyclic graph, an equation reference with derivations and
worked examples, and a graded assessment bank. Every lesson names the mistake readers usually make, asks one question
that has to be answered in the learner’s own words, and ends with that lesson’s own questions answered in place.

> **Everything here is a teaching instrument.** The encoders are linear maps over one-hot inputs and the images are
> vectors of pixels rather than pictures. The sigmoid laboratory's logits and the frozen bridge's attention are
> synthetic, and both say so on screen. The method is the paper's; the scale is not. No model, dataset, image or
> example is downloaded, and no data leaves the browser.

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
| `npm test` | Vitest unit and content tests (138 tests) |
| `npm run test:e2e` | Playwright browser tests, including the accessibility audit |
| `npm run lint` | Oxlint |

The production build is a static bundle: `dist/` can be served by any static host.
There is no backend, no API key and no network call at runtime.

---

## What is in the course

### The curriculum (4 modules, 9 lessons)

| Module | Lessons | Source |
| --- | --- | --- |
| **Contrastive Pretraining** | The contrastive objective · The data and the batch | Radford et al. §2, §2.1, §3 |
| **The Modality Gap** | The modality gap · Zero-shot | Radford et al. §2, §3 |
| **Instruction Tuning** | The instruction recipe · The alignment tax | Liu et al. §2, §3; Alayrac et al. §2 |
| **The Loss and the Bridge** | The sigmoid loss · The frozen bridge | Zhai et al. §3.1, §4.8, §4.9; Li et al. §3.1–3.2; Dosovitskiy et al. §3.1 |

Every lesson names the section of the paper it was written from, and the test suite refuses a lesson that cites a
section which is not in the source map.

### The five laboratories

| Lab | What you can change | What you can measure |
| --- | --- | --- |
| **A · The contrastive model** | The number of pairs, the batch size, the temperature, the steps, the dimension | The contrastive loss, the retrieval, the modality gap, the zero-shot accuracy under each prompt template, and the retrieval against the batch size and the amount of data |
| **B · The instruction tax** | The number of instructions, the strength of the tuning | The gain on the instructions, the tax on the original task, and the ratio between them |
| **C · The sigmoid loss** | The batch, the similarity margin, the temperature, the sigmoid's scale and bias | The same row of a batch read as a distribution and as independent decisions, the shift in a pair's loss as unrelated pairs are appended, and the bias that matches a batch |
| **D · The frozen bridge** | The queries, the patch tokens, the bridge width, the attention temperature | Which patches a learned query reads, the trainable and frozen parameter counts, and the share of the whole that is trained |
| **E · The resampler** | The resolution, the patch size, the number of latents | The visual tokens going in, the fixed number of vectors coming out, and the attention cost of each |

Labs A and B train **in the browser, from scratch**, every time a setting changes. Labs C, D and E are hand-wired toys
and label themselves as such: their numbers are computed exactly from stated rules, not measured on a trained model.

### The rest of the course

- **Practice** — 21 questions with per-option feedback, worked explanations and source citations.
- **Checkpoints** — each lesson asks its own questions where the idea was taught, graded by the same engine as the
  practice bank, with the explanation after the attempt and a second attempt always allowed.
- **Glossary** — 19 terms, each with a plain-language definition and the terms that should be understood first. The
  dependency graph is checked for cycles.
- **Equations** — 7 results with the source, the plain-language meaning, every symbol, the assumptions, a derivation
  and a worked example.
- **Sources** — every work cited, with the licence it was verified under, and the section map of each source.

---

## The rule this course follows

**Every number is computed, and nothing is faked.**

The algorithms live in `src/core/` as pure functions with no DOM and no framework. They are unit-tested in Node,
without a browser, and the interface renders what those functions return.

### The gradient is checked, not asserted

The gradient of the contrastive loss is derived by hand in `src/core/clip.ts` — the softmax probability of each
pairing, minus the indicator of the true one, weighted by the caption it was compared with — and the test suite
compares it against a central finite difference, component by component.

### The coupling is measured, not asserted

The sigmoid laboratory's central claim is that one pair's loss stops depending on the rest of the batch. The test
suite appends an unrelated pair and requires the sigmoid loss of pair (0, 0) to be **exactly** unchanged while the
softmax loss of its row **strictly increases**; it also requires the flat line across a six-pair sweep, and the
softmax row's probabilities to stay a distribution while the sigmoid row's do not. The frozen bridge's claim — that
widening the bridge leaves the frozen towers alone — is checked the same way, against the parameter accounting.

---

## Project layout

```
src/
  core/            the algorithms — pure functions, no React, no DOM
    clip.ts         the pairs, the loss, the gradient, the retrieval, the gap
    instruction.ts  the instruction tuning and the tax
    siglip.ts       the sigmoid loss, the coupling experiment, the bias
    blip2.ts        the learned queries, the bridge attention, the parameter bill
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

- An **axe-core audit** runs over twelve pages in the browser suite, in both the light and the dark theme, and fails the
  build on any `wcag2a`, `wcag2aa`, `wcag21a` or `wcag21aa` violation.
- Every tab strip implements the WAI-ARIA tab pattern; charts carry a name, a caption and a data-table alternative;
  the theme is applied before the first paint.
- `/` opens the course search and `Escape` closes it.

---

## Licence

The course code is original work and is released under the **MIT licence**. The course content is released under the
same terms.

The source papers are **cited and linked, never redistributed**. No model, dataset, image, example, figure or
third-party code from any cited work appears in this repository. Every figure is an original plot of a computation made
in the browser.

See [`docs/SOURCES_AND_LICENSING.md`](docs/SOURCES_AND_LICENSING.md) for the full statement.
