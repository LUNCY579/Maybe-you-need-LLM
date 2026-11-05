# LLM Foundations Lab

An interactive course on the algorithms inside large language models, built as a
browser-only application. Every number the site shows is computed in front of
you: change an input, watch the matrices, scores, distributions and loss
curves change with it.

The course is built around a specific revision of a textbook:

> **Foundations of Large Language Models**
> Tong Xiao and Jingbo Zhu
> arXiv:2501.09223v4 [cs.CL], 8 October 2026 (book dated 9 October 2026)
> <https://arxiv.org/abs/2501.09223> — CC BY-NC 4.0

The book's six chapters map one-to-one onto the six modules of this course, and
every lesson links back to the section and page it was written from. All
explanatory text here is original; nothing is copied from the book.

---

## What it does

| Page | Purpose |
| --- | --- |
| **Landing** | What the course covers, how the six modules fit together, **what to read next in the collection and why**, and the honesty statement about the models used. |
| **Dashboard** | Progress, a **learning path** that says which lesson to study next and why, a **concepts-covered** count alongside the lesson count, per-module completion, quiz accuracy, study time, bookmarks, and JSON export/import. |
| **Six modules** | Pre-training, Generative Models, Prompting, Alignment, Inference, Reasoning — 18 lessons in total. Each module opens with the **misreadings readers commonly bring to it** and the correction. |
| **Transformer Explorer** | The flagship: type a sentence and follow it through tokenisation, embeddings, positional information, Q/K/V, scaled scores, the causal mask, the softmax, the attention output, the residual connection and feed-forward network, and a next-token distribution. |
| **Interactive playground** | The seven laboratories, each with real computation behind the figures. |
| **Practice** | 70 questions with per-option diagnostics, worked feedback, a link to the lesson that teaches each question, a filter down to a single lesson, a shortcut to your weakest module, and an **interleaved** order that never puts two questions of the same lesson next to each other. Eighteen of the questions are **transfer** questions: a novel situation the lesson never mentions, where the answer is what the lesson's *mechanism* says rather than what it says. |
| **Command palette** | Press **⌘K** (or **Ctrl K**) to search the whole course or run a command: switch the theme, start a review session, jump to the next lesson. The matching is fuzzy, so `kv` finds the KV cache and `attn` finds the attention lesson. |
| **Review** | A spaced-repetition session that schedules every question with **SM-2**, the algorithm behind SuperMemo and Anki. Each question comes back just before you would forget it; the schedule is stored in your local progress file. |
| **Glossary & math reference** | 71 terms with prerequisites, a **visual concept map** of what each module depends on, and 23 formulas with plain-language explanations. |
| **How settled is this?** | For each module: what the book establishes and why it holds, what is still moving, and the primary sources. A book cannot be as current as the field it describes, and a course that does not say which claims are durable is asking the reader to guess. |
| **Sources** | Attribution, licensing, and the section-by-section source map. |

Configurations saved in a laboratory can be reopened from the dashboard: the
controls come back with the stored values, not their defaults.

### How the course teaches

The course uses the techniques the learning sciences support, and the support
is written down so that a later change does not quietly remove it.

- **Retrieval practice** — a knowledge check at the end of every lesson, and
  a review session that brings back what is about to be forgotten.
- **Spaced practice** — the SM-2 schedule behind that review session.
- **Interleaving** — the practice set never puts two questions of the same
  lesson next to each other, so you have to work out which rule applies
  before you can work out the answer. The evidence is unusually clean:
  interleaved practice beat blocked practice by 63% to 54% on a delayed
  test of secondary-school science (Faria and Yan, 2022), and the same
  result holds for mathematics (Rohrer et al., 2020).
- **Self-explanation** — every lesson ends with one question you answer in
  your own words before the model answer is shown. Generating the
  explanation is what does the work (Chi et al., 1989).
- **Elaborative interrogation** — the same "how" and "why" questions, which
  connect new material to what you already know.

Two details make the difference, and both are deliberate:

**Every question comes with an answer.** A 2025 meta-analysis of 44 studies
found that the advantage of retrieval practice over elaborative encoding was
conditional on feedback — with feedback the gap was g = 0.50, and *without*
it the elaborative tasks won. So a self-explanation prompt with no model
answer is not a weaker exercise, it is a counterproductive one.

**The practice page says that it interleaves.** Interleaved practice feels
harder, because the cue really has been taken away. A reader who does not
know that the difficulty is the point will read it as a badly designed
course.

### The pages change with a view transition

A page that has to be fetched before it can be shown is the hard case for a
view transition: the new page does not exist when the reader clicks. The
router keeps the old page on screen while the new one is fetched, and only
then starts the transition and swaps, so the reader sees one page fade into
the next rather than a spinner and then a page.

A browser without the View Transitions API ignores the request and changes
the page in the ordinary way.

### A plan that fits the time you have

The dashboard has a **"What to do now"** panel. It says what to review,
what to read, what to answer in your own words, and what to practise — and
why each one is there. You say how long you have (ten minutes, twenty,
forty-five, or as long as you like) and the plan is marked against it:
everything is still shown, but what does not fit is marked as being for
later rather than hidden.

The order follows the evidence: a question that is about to be forgotten is
worth more than one you have never seen, and new material is learned best
while the older material is still warm.

### It loads only what you need

The course is a static site and everything in it is computed in the browser,
so what the reader downloads is the whole difference between a course that
opens on a train and one that does not.

The lesson prose is loaded **one module at a time** — a reader who works
through the pre-training module downloads that module's three lessons and no
more, rather than the prose of all eighteen. The question bank is fetched
with the pages that need it, and the laboratories only with the playground.

### The course says how settled it is

The course is adapted from the fourth revision of *Foundations of Large
Language Models*, dated 8 October 2026. That is a recent book, but the
literature moves faster than any book.

So every module says what holds, what is moving, and where the next version
of it is being written — with the primary sources, so a reader can check it
rather than take it on trust. A few examples of what has moved since the
revision the course is based on:

- The scaling law the book uses was calibrated for abundant data and a
  single epoch over it. When data must be repeated instead, the advice
  inverts: a smaller model trained for more epochs.
- The gap between reinforcement learning from human feedback and direct
  preference optimisation has been settled: under exact optimisation they
  are equal, and the difference in practice is coverage — the offline
  method needs the data to cover the policy globally.
- A reasoning model's own hidden states turn out to carry a usable
  correctness signal, so a verifier can be built without training one.
- "Prompt engineering" has been superseded by "context engineering", and
  two new failure modes — brevity bias and context collapse — have been
  named.

Nothing on that page retracts a lesson. It says how much weight to put on
each one.

And every lesson carries that answer with it. A lesson says what is taught;
the panel beside it says how settled the module it belongs to is, what has
moved since, and takes the reader straight to the sources for that module.
The question of how much weight to put on a lesson is a different question
from the question of what the lesson says, and a reader should not have to
go looking for the answer to the second one. The module overview carries it
too.

And the citations are checked. `npm run check:links` asks every source on that
page whether it still resolves, and whether a pinned arXiv link has been
superseded by a newer revision of the same paper. The first run found two
that had: a scaling paper cited at its second revision when the fifth was
current, and a survey cited at its third revision — published in *TPAMI* in
the meantime — when the fourth was current. Both now point at the current
revision.

The page also says when the sources were last checked, and the check writes
that date rather than a person typing it. So the date cannot claim a
currency the check did not find.

### The course works with no network at all

Everything here is computed in the browser: the laboratories run in the page
and your progress lives in local storage. There is no server to ask, so the
published build carries a service worker that caches the whole course —
every lesson, every laboratory — and the course opens and works with the
network switched off.

A published build only; in development the worker would cache the files you
are about to change.

### It survives the reader's own settings

- **High contrast.** Windows has a high-contrast mode, and a reader can turn
  it on for the whole system. The browser replaces the palette, so anything
  that carried its meaning in a background colour would be lost. The
  selected state of a control is carried in the system selection colour
  instead, and the end-to-end suite emulates the mode to check it.
- **Reduced motion.** The entrance animations and the view transitions are
  turned off, and the reading-progress bar — which is a position indicator
  rather than decoration — keeps working.
- **No JavaScript storage.** A browser that refuses to give access to
  storage loses the progress file and says so, rather than refusing to
  start.
- **More contrast.** Windows and macOS both have a setting for asking for
  more contrast without the full high-contrast palette. The quieter greys are
  widened for it.

And the pictures are checked: ten pages are compared against committed
baselines on every test run, so a change that quietly reflows a figure or
drops a border is caught rather than shipped. The baselines are refreshed on
purpose with `npm run screenshots`.

### Mastery, not just accuracy

"Correct" is not the same as "mastered". A question answered correctly once,
in passing, a week ago is not knowledge; one recalled correctly four times
over a month, the last time after a lapse, is.

The course estimates the mastery of each lesson from three things the
schedule already tracks: the run of correct recalls, the ease factor, and how
long ago the question was last seen. It is shown on the dashboard and beside
each lesson on the learning path, and a lesson you have said you did not
understand comes first.

### The command palette

**⌘K** (or **Ctrl K** on Windows and Linux) opens the palette. It finds
everything the course holds — six modules, eighteen lessons, seventy-one
terms, twenty-three formulas and every page — and it runs commands as well:
switching the colour scheme, starting a review session, opening the keyboard
shortcuts, jumping to the next lesson.

The matching is fuzzy. A command palette is typed into, and people type the
beginnings of words they half remember, so the query is matched as a
*subsequence*: `kv` finds the KV cache, `attn` finds the attention
lesson, `dlg` finds the dialog. Every word of a multi-word query has to
match, because a reader who types two words means both of them.

The palette is a modal dialog built on the platform's own `<dialog>`
element, so the browser traps the focus, closes it on Escape and marks the
rest of the page inert. It fades and scales in with `@starting-style`, which
describes how an element looks before it is displayed — the entrance needs no
JavaScript at all.

The search reaches the course's own words, not only its titles. A reader who
half-remembers a phrase — *brevity bias*, say, or *context collapse* — finds
the module it belongs to, and the search can take them to the part of the
page that discusses it.

### A modern interface, verified rather than assumed

The interface uses the current CSS and DOM features where they earn their
place, and the support data for each one is written down next to it:

- **Container queries** decide how a laboratory lays itself out, from the
  width of the laboratory rather than the width of the window. A laboratory
  is a self-contained unit, and its width is not the window's width.
- **`text-wrap: balance`** evens out the lines of a heading, and
  **`text-wrap: pretty`** keeps a word from being stranded at the end of a
  paragraph.
- **Scroll-driven animations** drive the reading-progress bar. There is no
  JavaScript on the scroll path: the browser ties the animation to the
  scroll position itself.
- **`:has()`** lets a panel show where the focus is, so the reader can see
  which part of a long interface they are in.
- **Anchor positioning** places the definition panel that opens under a
  technical term. The browser moves it, and turns it over, when there is not
  enough room — so the panel needs no measuring in JavaScript.
- **View transitions** cross-fade the page when the route changes. The
  router waits for the new page to arrive before the old one is taken away,
  so the transition animates from one real page to another rather than from
  a page to a loading screen.

One technique was measured and rejected. `content-visibility: auto` is the
right tool for a long page whose blocks are all about the same height, and
the blocks of a lesson are not: they run from about 240 pixels to more than
700. The browser's guess was wrong often enough that the page moved under
the reader — by 404 pixels in WebKit — and the in-page outline stopped
tracking the reader in Firefox. The end-to-end suite measures the height of
every lesson before and after a full scroll, so the property cannot be
reintroduced by accident.

### The review schedule

Answering a question anywhere in the course — in a lesson's knowledge check, in
the practice page, or in a review session — moves that question's place in a
spaced-repetition schedule.

The schedule is SM-2, the algorithm behind SuperMemo and the default in Anki.
Each question carries three numbers: how many times in a row it has been
recalled, how easy it is, and how long to wait before the next review. A
correct answer moves the question to 1 day, then 6 days, then multiplies the
interval by the ease factor. A wrong answer resets it to 1 day, and leaves the
ease factor alone — the rule that keeps a hard question out of a short,
never-ending cycle.

A question is reviewed once a day: answering it again in the same sitting
tests nothing new, so it does not push the next review further out.

The **Review** page shows what is due, runs a session of at most twenty
questions, and tells you after each answer what the scheduler decided and
when the question returns. The dashboard counts the queue, and the practice
page can be filtered down to exactly the questions that are due.

Nothing leaves the browser. The schedule lives in the same local progress file
as your lessons, bookmarks and notes, and travels with the JSON export.

### Inline definitions

Technical terms in the lesson prose are linked at their first mention. Clicking
one opens a panel with the course's own definition, the terms a reader should
know first, the section of the textbook that introduces the idea, and a link to
the lesson that explains it. A term is linked once per section, the way a
textbook defines a term the first time it appears — and the terms that are too
common to be worth decorating (`token`, `softmax`, `logits`, `prompt`,
`reasoning`, `temperature`) are deliberately left alone.

### Prediction exercises

All five laboratories ask the reader to predict an outcome before showing it:
how many units a tokenizer will produce, which token a decoder favours at a
given temperature, what SFT and DPO do to responses they were never compared
against, how a learning rate changes the shape of a training run, and what the
KV cache costs. Every answer is computed by the same code the laboratory itself
uses, so an exercise can never disagree with the figures it teaches from — and
a test asserts that every question has exactly one correct option.

### Navigation

The in-page outline on a lesson tracks the reader: the section currently in
view is highlighted, and every entry links to a real anchor. `/` opens course
search and the arrow keys move through its results, `?` opens a panel of
keyboard shortcuts, `Escape` closes whatever is open, and a skip link moves the
focus straight to the content.

The landing page, the module pages and the dashboard all name the *next*
lesson to study and say why, rather than always pointing at the first one.

The glossary draws the course as a dependency structure: for the module you
are looking at, its own terms sit on top and the earlier terms they rest on
sit beneath, joined by arrows.

## The interactive laboratories

Every laboratory runs an actual algorithm on a small, fully visible example.
The teaching models are deliberately tiny and the site says so wherever their
numbers appear — a handcrafted tokenizer is not GPT's tokenizer, and a seeded
weight matrix is not a trained model.

- **Transformer Explorer** — a single-block decoder over a toy vocabulary, with
  every intermediate matrix returned for inspection. The output projection uses
  the model's own (seeded, untrained) unembedding matrix, and the static
  frequency prior is reported separately so the two contributions never blur.
  An **attention heads** control splits the hidden dimension across 1, 2 or 4
  heads, and the score, softmax and output figures become per-head — including
  the fact that each head scales its own scores by `1/√d_head`.
- **Laboratory A · Tokenization and embeddings** — word, character and greedy
  subword segmentation over an explicit vocabulary, with OOV behaviour, sequence
  length, and a masking view that shows how a pre-training target is built.
- **Laboratory B · Text generation and sampling** — temperature, top-k, top-p
  and a seeded PRNG, with the base distribution, the filtered candidate pool, the
  renormalised result and a Monte-Carlo check that the sampler is unbiased.
- **Laboratory C · Learning and optimization** — a real training loop with
  analytic gradients, learning rate, batch size, L2 regularisation, train/validation
  split, and divergence detection.
- **Laboratory D · Alignment and preference learning** — SFT, a Bradley–Terry
  reward model and DPO on the same preference pairs, with analytic gradients
  checked against central finite differences, plus a process-supervision view.
- **Laboratory E · Inference and reasoning** — prefill versus decode, KV-cache
  sizing, best-of-n and beam search over a toy tree, and the evaluation
  protocols that decide what a benchmark number even means.
- **Prompting laboratory** — prompt-budget accounting and a toy retriever with
  an explicit lexical-expansion step.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
```

Other scripts:

```bash
npm run build      # type-check, then produce a static bundle in dist/
npm run preview    # serve the production build locally
npm run test       # unit and component tests (Vitest)
npm run test:e2e   # end-to-end tests (Playwright: Chromium, Firefox and WebKit,
                   # plus the offline tests against a published build)
npm run lint       # Oxlint
npm run typecheck  # tsc -b
npm run contrast   # WCAG contrast check over the design tokens
npm run check:links # ask every cited source whether it still resolves
npm run report     # rewrite the test tables in docs/TEST_REPORT.md from a run
npm run screenshots # refresh the committed visual baselines
```

The end-to-end suite needs browsers once:

```bash
npx playwright install chromium firefox webkit
```

The site is a static bundle: `npm run build` emits plain files that can be
served from any static host. There is no backend, no API key and no network
call at runtime.

## Technology

- React 19 + TypeScript + Vite
- Tailwind CSS 4
- KaTeX for the mathematics
- Recharts plus hand-written SVG/Canvas figures
- Vitest + React Testing Library for unit and component tests
- Playwright for end-to-end tests
- A service worker and a web app manifest, so the published build installs
  and opens with no network

## Project layout

```
src/
  core/        educational algorithms — pure functions, no React
  components/  laboratories, visualisations, layout, shared UI
  content/     curriculum, lessons, quiz bank, glossary, formulas
  pages/       route-level screens
  state/       progress persistence (localStorage), the progress context, the clock
  test/        test setup
e2e/           Playwright specs
docs/          architecture, sources and licensing, test report
```

The rule the project follows: **numbers are computed in `src/core`, never in a
component.** A laboratory component wires controls to core functions and
renders what they return. That is what makes the algorithms testable without a
DOM, and it is why the test suite can assert on the mathematics rather than on
the DOM.

## Honesty statement

This is a teaching application. It does not run a language model.

- The tokenizer is a hand-written demonstration over an explicit vocabulary. It
  does not reproduce the segmentation of GPT, Llama, BERT or any other model.
- The Transformer Explorer uses a seeded, untrained weight matrix. Its
  next-token distribution is a genuine computation, but it is not a prediction
  from a trained model.
- The sampling laboratory operates on an explicit toy logit vector, not on the
  output of a network.
- The learning laboratory trains a bigram model with real gradient descent. It
  is a real optimiser on a real (tiny) objective.
- The alignment laboratory optimises a linear policy over three hand-written
  response features. The objectives are the book's; the model is not a
  language model.
- The inference laboratory's latency figures are analytic model output, not
  measurements of a production deployment, and the site never presents them as
  benchmarks.

Where a figure could be mistaken for a benchmark result, the interface labels
it as a toy model, a synthetic input, or an analytical estimate.

## Accessibility and interaction

- Full keyboard navigation; `/` opens course search and `Escape` closes it.
- **The focus follows the page.** When the route changes, the focus moves to
  the new page's heading, so a screen reader announces what the reader has
  arrived at. A single-page application changes its page without the browser
  doing anything about the focus, and without this the reader hears nothing
  at all.
- Every control is labelled, every figure has a text description, and the
  colour ramps are paired with numbers in the cells.
- Reset buttons on every laboratory, so a learner can always get back to a
  known state.
- The pages are audited against the WCAG 2.1 A and AA criteria with axe-core,
  in both the light and the dark theme, as part of the end-to-end suite.
  Twelve routes are audited, and so are the five states a reader meets more
  often than the default state of a page: a question that has been answered,
  the command palette with results in it, the list of shortcuts, the
  transformer explorer, and the definition panel. Extending the audit to the
  pages that had been added last is what found a contrast failure on the
  dashboard, and adding the states found the dimming in the study plan.
- The design tokens are checked against the required contrast ratios by
  `npm run contrast`, so a colour change cannot quietly break legibility.
- The layout is verified at phone width: no page scrolls sideways at 390
  pixels, and that is asserted in the end-to-end suite.
- **The pages of the course are declared once.** The router, the navigation,
  the search, the command palette and the accessibility audit all read the
  same list, in `src/content/routes.ts`. A page added to the course is
  audited, findable and reachable, because being added to the course means
  being added to that file. The list used to be written down in four places
  and the four drifted apart — the pages added last were never audited, and
  a contrast failure on the dashboard went unnoticed for as long as the
  audit had existed.
- **A printed page keeps its content and loses its interface.** Printing is
  how a reader takes the course away, so what they take should be the
  course: the source references of a lesson, the definitions on the
  glossary, the explanations on the mathematical reference. Only the
  navigation and the header are dropped.
- **The address is where a filter belongs.** The glossary, the mathematical
  reference and the practice page all keep what you are looking at in the
  address, so a link to a particular term, formula or question set can be
  shared and reloaded, and the back button does what a reader expects.
- **A link to a section of a page keeps the reader on the course.** The
  course uses a hash router, so the fragment of the address *is* the route,
  and a plain `#section` would replace the route rather than add to it. The
  address of a section is `/#/lessons/pretraining-bert#attention` — still a
  course address, still reloadable, still shareable.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — how the code is organised and why
- [docs/SOURCES_AND_LICENSING.md](docs/SOURCES_AND_LICENSING.md) — attribution and terms
- [docs/TEST_REPORT.md](docs/TEST_REPORT.md) — what is tested and how to run it

## Licence

The course material in this repository is released under **CC BY-NC 4.0**, the
licence of the textbook it is derived from. See
[docs/SOURCES_AND_LICENSING.md](docs/SOURCES_AND_LICENSING.md) for the full
statement, including the third-party dependencies and the adaptations made.
