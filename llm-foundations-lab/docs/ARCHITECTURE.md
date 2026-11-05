# Architecture notes

This document explains how the code is organised, why it is organised that way,
and where the boundaries are. It is written for someone who wants to change the
course rather than just use it.

## The central rule

**Numerical algorithms live in `src/core`. Components never compute.**

A laboratory component receives inputs from its controls, calls one or more
functions from `src/core`, and renders the returned values. Nothing in a
component performs a matrix multiplication, a softmax, a gradient step or a
random draw.

This buys three things:

1. **Testability without a DOM.** `src/core/*.test.ts` runs in plain Node. The
   mathematics can be asserted directly — "the masked attention weight is
   exactly zero", "the loss reported by the step equals the loss evaluated on
   the same batch" — instead of being inferred from rendered text.
2. **One source of truth per number.** The lesson prose and the figures read
   from the same computed values, so a worked example cannot drift away from
   the laboratory it describes. The reasoning lesson literally reads
   `outcome.failedPathCreditSpread` out of the core and prints it.
3. **Honesty by construction.** Because a component cannot invent a number, the
   only way to show a value is to actually compute it. Where a value is
   synthetic, the input that produces it is synthetic too, and it is labelled
   at the point of use.

## Layers

```
                    pages/            route-level screens, no algorithms
                      │
        components/   │           laboratories, figures, shared UI
                      │
          state/      │         progress context, localStorage persistence
                      │
             core/    │      pure algorithms, no React, no DOM
```

Dependencies point downward only. `core` imports nothing from the rest of the
project; `components` may import `core` and `content`; `pages` may import all
three. There is no import from `components` into `core` and none from `core`
into `components`.

### `src/core` — the educational algorithms

| Module | What it implements | Grounded in |
| --- | --- | --- |
| `math.ts` | Matrices, softmax (numerically stable), entropy, sigmoid, softplus, cross-entropy, a seeded PRNG | — |
| `attention.ts` | Scaled dot-product attention, the causal mask, head merging | §2.1.1 Eq. 2.6; §5.1.1 Eq. 5.7, §5.1.2 Eq. 5.13 |
| `embeddings.ts` | Toy token embeddings, sinusoidal positional encoding, seeded projections, the unembedding | §2.1.1 |
| `tokenizer.ts` | Word / character / greedy-subword segmentation, an explicit vocabulary, OOV handling | Ch. 1 tokenization discussion |
| `transformer.ts` | The full Explorer forward pass and the multi-head split | §2.1.1 Eq. 2.6–2.11 |
| `sampling.ts` | Temperature, top-k, top-p, seeded sampling, sequence generation | §5.1.3 Eq. 5.24–5.29 |
| `training.ts` | A bigram model with analytic gradients, minibatch SGD, L2, train/validation split | Ch. 1, Ch. 2.2 |
| `alignment.ts` | Bradley–Terry, reward modelling, SFT, DPO, finite-difference gradients | §4.3.2 Eq. 4.35–4.36; §4.4.2 Eq. 4.80–4.82 |
| `inference.ts` | A toy autoregressive LM, KV-cache sizing, best-of-n, beam search | §2.3.3–2.3.4; §5.1.2; §5.3.2 |
| `reasoning.ts` | Outcome versus process supervision, step scoring, evaluation protocols | §6.4.2; §6.5.1 |
| `retrieval.ts` | A toy keyword retriever with lexical expansion, prompt-budget accounting | §3.2.5 |
| `fuzzy.ts` | The fuzzy matcher behind the command palette: subsequence matching with a score that says how good a match is | — |
| `interleave.ts` | The interleaving order of the practice set: no two questions of the same lesson next to each other | Rohrer et al. (2020) |
| `mastery.ts` | The mastery of a lesson: the run of correct recalls, how well they are sticking, and how long ago they were seen | — |
| `studyPlan.ts` | The plan for the session: what to review, read, explain and practise, and how long each takes | — |
| `../content/transfer.ts` | The transfer question of every lesson: a novel scenario the lesson never mentions | — |
| `path.ts` | The learning path: which lessons are done, ready or blocked, which to study next, and the mastery of each | — |
| `spacedRepetition.ts` | The SM-2 scheduler: intervals, ease factor, due dates, and the order of the review queue | SuperMemo 2; Anki's SM-2 implementation |
| `progress.ts` | The progress model, serialisation, sanitisation, merging, summarising | — |

Every module header states the book sections and equation numbers it
implements. Those references were checked against the v4 PDF; the audit that
produced the current state corrected three of them (see the test report).

### `src/components` — presentation

- `lab/` — one component per laboratory, plus the Transformer Explorer. These
  own the control state and render what `core` returns.
- `viz/` — reusable figures: the heatmap, the matrix table, the line chart
  panel, the token distribution chart.
- `ui/` — the primitive component set (buttons, sliders, toggles, panels,
  callouts) and the KaTeX wrappers.
- `lesson/` — the chrome around a lesson body: sections, prose, exercises,
  worked examples, the knowledge check, the source list.
- `practice/` — the question card, shared by the practice page and the review
  session: the option list and the answer verdict.
- `layout/` — the application shell, navigation, course search and the
  command palette.

### `src/content` — the curriculum

`curriculum.ts` is the single description of the course: six modules, eighteen
lessons, and for every lesson its objectives, key ideas, the interactive it
uses, its prerequisites, the glossary terms it introduces, the quiz questions
that test it, and the source references with the chapter, section number,
section title and printed page in the v4 PDF.

`concepts.ts` holds the curated list of terms that are linked automatically in
lesson prose, together with the surface form to look for. The curation matters:
the glossary holds 71 terms, but linking every one of them would put a dotted
underline under every occurrence of *token* and *softmax*. The terms that are
too common are left out of the automatic list and remain reachable through the
glossary page and the course search.

`lessons/` holds the lesson bodies. Each module file exports its components
only; `lessons/registry.ts` is the single place where a lesson id is bound to
the component that renders it. The content test asserts that this mapping is
complete in both directions.

`quiz.ts` holds the fifty-two questions that test what a lesson taught, and
`transfer.ts` holds the eighteen that test whether the lesson's *mechanism*
carries over to a situation it never mentions. `glossary.ts` holds 71 terms
and 23 formulas.

`routes.ts` declares the pages of the course, once. It used to be declared in
four places — the router, the navigation, the search and the accessibility
audit — and the four drifted apart: the pages added last were never added to
the audit, and a contrast failure on the dashboard went unnoticed for as long
as the audit had existed. The status page was missing from the search for a
while as well.

So the list is in one file, and the other four read it. The router is built
from it, the navigation and the search and the command palette take their
entries from it, and the end-to-end audit visits the pages it names. A page
added to the course is audited, findable and reachable, because being added
to the course means being added to that file. `routeLoaders.ts` holds the
dynamic import for each page, and a test asserts that the two agree exactly
in both directions — a route with no page behind it, and a page that
nothing leads to, are both failures.

### `src/state` — progress

`context.ts` holds the context object, `hooks.ts` holds `useProgress` and
`useTheme`, and `ProgressContext.tsx` holds the provider. The split exists so
that no module has to export a non-component value from a file that also
renders components, which keeps Fast Refresh working during development.

The progress state is persisted to `localStorage` under a single key, and can
be exported to or imported from JSON. `core/progress.ts` owns the schema, the
sanitisation of untrusted imported documents, and the merge semantics.

`useNow.ts` holds one hook: a clock that ticks once a minute. The
spaced-repetition schedule is expressed in whole days, but a question that
becomes due while the page is open should join the queue without a reload, and
reading the clock during render is an impure operation, so the time lives in
state.

## How settled is this?

The course is adapted from the fourth revision of *Foundations of Large
Language Models*, dated 8 October 2026. A book that recent cannot have
been overtaken by the literature, but the literature moves faster than any
book.

So `content/status.ts` says, for each of the six modules, what the book
establishes and why it holds, what is still moving, and where the next
version of it is being written. The sources are primary papers rather than
summaries, so that a reader can check the claim rather than take it on
trust.

The confidence of a module is one of four: **settled**, **settling**,
**moving** or **open**. The distinction between the middle two is the
useful one: a *settling* module teaches a mechanism that is not in doubt
but whose best practice is changing, so the advice about which variant to
use may age; a *moving* module teaches the current best understanding of
something the field is actively rewriting.

The content test checks that every module is described, that every module
says something about both what holds and what is moving, that every source
is a real address with a note, that every source names a venue or a year,
and that no source is cited twice.

`tools/checkLinks.mjs` goes further, because a citation that has quietly
stopped resolving is the worst possible rot on a page whose whole purpose is
currency. It asks each address whether it still resolves, and whether a
pinned arXiv link has been superseded by a newer revision of the same paper —
a pinned link keeps working after the paper has moved on, so the reader is
sent to an old draft and believes it is the current one. The first run found
two such links. The check is a command rather than a test, because a test
suite that fails when the network is down is a test suite that gets ignored.

The page carries the date its sources were last checked, and the check writes
that date into `src/content/status.ts` rather than a person typing it. The
date therefore cannot claim a currency the check did not find, and a date
that nobody maintains is worse than no date at all.

`tools/updateTestReport.mjs` does the same for the test report: it runs the
tests, reads their JSON reports, and rewrites the two tables in
`docs/TEST_REPORT.md`. Those tables were written by hand for a long time, and
by the time they were audited they were missing two files, had six wrong
counts, and had a duplicated row.

## What is loaded, and when

The course is a static site and everything in it is computed in the browser,
so what the reader downloads is the whole difference between a course that
opens on a train and one that does not.

| What | When it is fetched | Size |
| --- | --- | --- |
| The application shell, the curriculum and the glossary | Once, on the first page | 623 kB (190 kB compressed) |
| The question bank | With the practice set, the review session or the dashboard | 68 kB |
| The prose of a lesson | With that lesson, one module at a time | 12–17 kB per module |
| The laboratories and the chart library | With the playground | 436 kB |
| The KaTeX typesetting | With the first formula | 85 kB |

Two decisions are worth explaining.

**The lesson bodies are loaded one module at a time.** A reader who works
through the pre-training module downloads that module's three lessons and no
more. Before the split, opening any one lesson downloaded the prose of all
eighteen, and the lesson page was 106 kB. It is now 29 kB.

**The question bank is not in the first download.** The shell needs to know
how many questions are due for review, and it gets that from the ids in the
curriculum rather than from the bank. That keeps a hundred kilobytes of
prose out of the download that every page pays for.

The lesson bodies are bound to their lesson ids in one place,
`content/lessons/registry.ts`, which holds the loaders rather than the
components. The content test awaits those same loaders, so it renders the
very component the application renders rather than a copy of it.

## The study plan

A course that can be studied in an hour and a course that can only be
studied in three hours are not the same course. Most people learn in short
sessions, and a list of eighteen lessons does not help somebody who has
twenty minutes and a train to catch.

The plan is computed from the learner's state, not scripted:

1. **Review first.** A question that is about to be forgotten is worth more
   than a question that has never been asked, because the forgetting is what
   the schedule is trying to prevent.
2. **Then read.** New material is learned best while the older material is
   still warm.
3. **Then explain.** Writing an explanation of what was just read is what
   makes it stick, and it is short.
4. **Then practise.** New questions, on the part of the course where the
   reader is weakest.

The reader says how long they have, and the plan is marked against it.
Everything is still shown: an item that does not fit is marked as being for
later rather than hidden, because a reader who is short of time should be
able to see what they are missing and choose to do it anyway.

**"Due" is not the same as "not seen yet".** A question that has been
learned and is now at its scheduled time is *due for review*: it is at risk
of being forgotten. A question that has never been asked is *new*. The two
are counted separately, because a plan that told a reader who had not
opened a page to "review fifty-two questions" would be nonsense rather than
advice.

## The course, offline

Everything in this course is computed in the browser: the laboratories run in
the page, the progress file is in local storage, and there is no server to
ask. That makes it worth being able to open the course on a train, on a
plane, or on a machine that has never been online.

`public/sw.js` is the service worker. It is registered only in a published
build, because in development it would cache the source files that are about
to change.

Two rules, and the reason for each:

- The page itself is fetched from the network first, and the cached copy is
  the fallback, so a new release reaches the reader on their next visit
  rather than whenever the cache happens to expire.
- The built assets are fetched from the cache first, because their names
  contain a hash of their contents, so a given name always means the same
  file and a cached one can never be out of date.

The whole build is precached rather than only the files a reader happens to
have visited. The build writes a manifest of everything it produced
(`build.manifest` in `vite.config.ts`) and the worker reads it at install
time. Without that, the course would be available offline only for the
lessons you had already seen, which is not the same thing.

One detail is worth recording, because it cost an afternoon: the server
sends `Vary: Origin`, and a module script is fetched with the
`crossorigin` attribute, so the request that asks for a file carries an
`Origin` header that the one that cached it did not. A cache match that
honours `Vary` misses every asset and the course fails to start with no
network. The match ignores `Vary`, which is correct here because the file
names say what they contain.

## Forced colours

Windows has a high-contrast mode, and a reader can turn it on for the whole
system. The browser replaces the palette with the system's own, and every
colour in this stylesheet stops being one of the colours the reader sees.

The interface holds its shape. What does not survive is anything that
carried its meaning in a *background* colour, because the background is
replaced along with everything else: the selected state of a segmented
control and the on state of a switch were both carried by a fill.

The fix is to carry those states in something the system palette keeps — a
border, drawn in `Highlight`, the system selection colour. It is the only
part of the stylesheet that names a system colour.

## How the course teaches

The course uses the techniques that the learning sciences support, and the
support is recorded here so that a later change does not quietly remove it.

| Technique | Where it is | The evidence |
| --- | --- | --- |
| Retrieval practice | The knowledge check at the end of every lesson, and the review session | A meta-analysis of 44 studies found retrieval practice better than restudy, with an overall advantage of g = 0.14 (Gonçalves, Muniz and Jaeger, *Educational Psychology Review* 37(4), article 100, 2025) |
| Spaced practice | The SM-2 schedule behind the review session | Cepeda et al. (2006) |
| Interleaving | The practice set, which never puts two questions of the same lesson next to each other | Rohrer, Dedrick and Hartwig (2015) and Rohrer et al. (2020) found interleaved practice beat blocked practice on a delayed test; Faria and Yan (2022) found the same in secondary-school science, 63% against 54% |
| Self-explanation | "Explain it back", the question at the end of every lesson | Chi et al. (1989) found that generating an explanation beat both reading the material and elaborating by asking "why" questions |
| Elaborative interrogation | The same "how" and "why" questions | Dunlosky et al. (2013); Pashler et al. (2007) |

**Feedback is what makes the difference.** The same 2025 meta-analysis found
that the advantage of retrieval over elaboration was *conditional on
feedback*: with feedback the gap was g = 0.50, and without it the elaborative
tasks won. So every "Explain it back" prompt in the course carries a model
answer, and the reader is asked to try before the answer is shown. A prompt
without a model answer would not be a weaker exercise — it would be a
counterproductive one, and the content test refuses to let one ship.

**Elaboration needs something to connect to.** It works by linking new
material to what the reader already knows, so it works for readers who have
something to link it to. The prompt sits at the end of the lesson, after the
material it asks about, and the model answer explains the mechanism rather
than restating the section: an answer that repeated the prose would add
nothing to the recall the reader has just made.

**Interleaved practice feels harder, and the course says so.** The practice
page says plainly that the questions are interleaved and why. A reader who
does not know that the difficulty is the point will read it as a badly
designed course.

**The reader's own judgement is used.** The self-explanation exercise asks
the reader how it went, and a lesson they rated "not yet" comes first in the
learning path. It is the one signal in the record that the reader has
volunteered, and a course that ignores it is not listening.

## The review schedule

The course does not only record whether a question was answered correctly. It
schedules it.

`core/spacedRepetition.ts` implements SM-2, the algorithm behind SuperMemo
and the default in Anki. Each question carries three numbers: how many times
in a row it has been recalled, how easy it is, and how long to wait before the
next review. A correct answer moves the question to 1 day, then 6 days, then
multiplies the interval by the ease factor. A wrong answer resets the interval
to 1 day.

Two details are worth stating because they are where implementations differ:

- **The ease factor has a floor of 1.3.** SuperMemo chose that floor so that
  an item cannot be squeezed into an interval so short that it is re-learned
  from scratch every session.
- **A lapse does not reduce the ease factor.** This is Anki's refinement of
  the original description. Without it, a hard item falls into "low interval
  hell" and returns every few minutes for weeks.

A question is reviewed **once a day**. Answering it again in the same sitting
tests nothing new, and letting it count would push the next review further out
each time until the schedule no longer described what the reader actually
knows. The guard lives in the provider, so it applies to every route that can
record a review: the review session, the practice page and the knowledge check
at the end of a lesson.

The newer **FSRS** scheduler fits a two-parameter memory model to the whole
review history instead of summarising it in one number. It is a better
algorithm, and it needs far more review data than a reader of one course will
generate, so the course uses SM-2.

## The router, and why it is a data router

The application uses `createHashRouter` and `RouterProvider` rather than
the declarative `<HashRouter>` and `<Routes>`. The reason is the view
transition.

React Router's view transition support lives in the data router. It is
there because the problem it solves is a lazy route: a page that has to be
fetched before it can be shown. The transition has to animate from the old
page to the *new* page, and the new page does not exist yet when the reader
clicks. The data router keeps the old page on screen while the new one is
fetched, and only then starts the transition and swaps. A transition that
animated to a loading screen and then to the page would be worse than no
transition at all.

The declarative router has no such machinery, and a hand-rolled transition
around it would have had to reimplement the same thing — badly, and against
the lazy-loading behaviour rather than with it.

The cost of the move is that the shell is a layout route and the page
arrives through an `<Outlet/>`, and that a redirect is a loader that
throws one. Both are small.

**Every link asks for the transition.** The router's own `Link` takes a
`viewTransition` option, and it is per navigation rather than global, so
the course's links are wrapped: `components/layout/CourseLink.tsx` exports
a `Link` and a `NavLink` that always pass it, and
`components/layout/useCourseNavigate.ts` does the same for the navigations
made in code. A component cannot forget to ask for the transition, and
cannot ask for it in one place and not another.

### Fragments, which are the route here

A hash router puts the route in the fragment of the address: the address of a
lesson is `/#/lessons/pretraining-bert`, and everything after the first `#`
is the path. That has a consequence that is easy to get wrong, and was got
wrong twice here.

A plain `<a href="#section">` does not *add* a fragment to the current page.
It **replaces** the route with the word "section", and the reader is taken to
the page that says the address is not part of the course. A reader who
clicks a heading to jump down a page and is thrown out of the course has
found a bug in the course's own navigation.

The fix is that a fragment is appended to the route rather than replacing it,
so the address of a section is `/#/lessons/pretraining-bert#attention`.
React Router splits that back into a path and a fragment, because it takes
everything after the first `#` as the route and then splits *that* on the
second `#`.

`core/fragments.ts` holds the two pure functions that do the joining, and
`components/layout/scrollToSection.ts` does the part that needs a browser:
scroll the section into view, and write the address with
`history.replaceState` so that the section is not a separate entry in the
history — the reader's back button still goes back to the page they were on,
not to the last heading they looked at.

### The focus follows the page

A single-page application changes its page without the browser doing anything
about the focus. The element the reader clicked is either gone or still in
the navigation, and a screen reader has no reason to say anything — so a
reader who follows a link with the keyboard is left with silence, and no way
to tell whether the link worked.

`components/layout/usePageFocus.ts` puts the focus on the new page's heading
after a route change, which is what the browser does on a real page load.
Two details make it work:

- The pages are loaded on demand, so at the moment the route changes what is
  on the screen is a placeholder and the heading does not exist yet. The
  focus waits for the heading to arrive, and the main region takes it if the
  page never does.
- The first page is left alone. A reader who has just opened the course has
  their focus wherever they had it, and taking it would be taking it from
  them.

The same hook also puts the reader in the right *place* on the new page. The
browser does not scroll for a single-page application either, so the page is
scrolled explicitly: to the top, or to the fragment the address names if it
names one. The focus is given without scrolling, so that the two do not fight
over where the reader ends up. The fragment is read from the router's own
`location.hash`, which is the fragment on its own, and `core/fragments.ts`
reads both that form and the browser's — the one that still has the route on
the front. Reading only one of them is how a link that names a section ends
up at the top of the page.

A browser without the View Transitions API ignores the request and changes
the page in the ordinary way. Support: Chrome 111, Edge 111, Firefox 144,
Safari 18.

## The command palette

The header search finds things. The command palette finds the same things
*and* runs commands, so it searches two lists: the index of the course, and
the list of actions.

The search index lives in `src/content/searchIndex.ts` and is shared by
both, so a term that is reachable from the search box is reachable from the
palette. The palette is a modal dialog built on the platform's `<dialog>`
element rather than on a hand-rolled overlay, so the browser does the things
a modal dialog has to do: it traps the focus, it closes on Escape, it puts
the panel in the top layer so nothing can overlap it, and it marks the rest
of the page as inert for assistive technology.

The matching is in `src/core/fuzzy.ts`. A query is matched as a
*subsequence* of the text — every character appears, in order, not
necessarily next to each other — and the score says how good a match it is.
The rules are the ones a reader would state out loud: a match at the start
beats one in the middle, a match that starts a word beats one that starts
inside a word, consecutive characters beat scattered ones, and a shorter
text beats a longer one. Every word of a multi-word query has to match; the
alternative puts "Sinusoidal positional encoding" above "Switch to the light
theme" for the query "light theme".

## The modern CSS layer

The stylesheet carries a section of modern CSS that is used deliberately and
with the support data written down next to it. Every rule in it is
progressive enhancement: a browser that does not support the feature either
ignores the rule or falls back to something that already worked.

| Feature | What it does here | Support |
| --- | --- | --- |
| `text-wrap: balance` | Evens out the lines of a heading | Chrome 114, Edge 114, Firefox 121, Safari 17.5 |
| `text-wrap: pretty` | Keeps a word from being stranded at the end of a paragraph | Chrome 117, Edge 117, Safari 26, Firefox 158 |
| Container queries | A laboratory and the lesson column lay themselves out by their own width, not by the width of the window | Chrome 106, Edge 106, Firefox 110, Safari 16 |
| `:has()` | A panel shows where the focus is; a list of options knows it has been answered | Chrome 105, Edge 105, Firefox 121, Safari 15.4 |
| Anchor positioning | The definition panel that opens under a technical term is placed by the browser, and turned over when there is no room | Chrome 125, Edge 125, Firefox 147, Safari 26 |
| Scroll-driven animations | The reading-progress bar is tied to the scroll position by the browser, with no JavaScript on the scroll path | Chrome 115, Edge 115, Safari 26, Firefox 156 |
| View transitions | The page cross-fades when the route changes | Chrome 111, Edge 111, Firefox 144, Safari 18 |

**The definition panel is anchored to its term.** Clicking a technical term
in the prose opens a panel with its definition. The panel belongs to the
term, so the browser places it: the term is the anchor, the panel is
anchored to it, and the browser moves the panel — and turns it over — when
there is not enough room. That replaced a measurement in JavaScript that
watched the window for resizes. A browser without anchor positioning still
measures the term and places the panel the old way, so the two paths look
the same.

The panel also has to state its own width, because the area it is placed in
is as wide as the word it explains, and a panel squeezed into that width
would be a column of one word.

**Container queries replaced viewport queries in the laboratories.** A
laboratory is a self-contained unit that is rendered inside the playground
page, and its width is not the width of the window: the playground is
capped, and the lesson body is narrow because the in-page outline sits
beside it. A viewport query gets all of those wrong. The thresholds in the
container queries are the widths at which the content stops being readable,
not the widths at which the window is usually that wide.

**One modern technique was measured and one was declined.**

Scroll-state container queries — `@container scroll-state(stuck: top)`, which
lets a sticky element restyle itself when it becomes stuck — are in Chrome
and Edge from 133 and, as of this writing, in neither Firefox nor Safari.
There is nothing in the course for them to replace: the in-page outline
tracks the reader with an `IntersectionObserver` rather than a scroll
listener, and the reading-progress bar is driven by a scroll timeline. The
one thing they would be used for here is a shadow on the outline when it
sticks, and a shadow that appears in one browser and not in the other two
is decoration rather than a feature. It is recorded here so that the next
person does not add it and call it an improvement.

**One technique was measured and rejected.** `content-visibility: auto` is
the right tool for a long page whose blocks are all about the same height:
the browser skips the layout of the blocks that are off screen. The blocks of
a lesson are not the same height — they run from about 240 pixels to more
than 700 — so the browser's guess is wrong for most of them, and the page
moves under the reader when a block is finally rendered. Measured across the
three browsers the suite runs:

- the Transformer lesson changed height by 404 pixels in WebKit while it was
  being read;
- the text under the reader moved by up to 58 pixels in Chromium and Firefox;
- in Firefox the in-page outline stopped tracking the reader, because the
  sections above it had been re-laid out.

The property is well supported — Chrome 85, Edge 85, Firefox 125, Safari 18
— and it is used in plenty of places that are not this one. It is not used
here, and `e2e/layout.spec.ts` measures the height of every lesson before
and after a full scroll so that it cannot be reintroduced by accident.

## Decisions worth explaining

**The teaching models are tiny, and their limits are stated in the interface.**
A Transformer with dimension 8 and a 248-token vocabulary is not a language
model. Rather than hide that, each figure that could be mistaken for a real
result says what it is. The alternative — dressing up a random matrix as a
trained model — would teach the wrong lesson.

**Synthetic inputs are separated from synthetic outputs.** Where a laboratory
uses a hand-written table (a bigram transition table, a preference dataset, a
reasoning tree), that table is the *input*, and the computation applied to it
is real. The one place where a stand-in was needed — the Explorer's output
projection — was replaced by the model's own unembedding matrix, with the
static frequency prior reported as a separate term so the two can be told
apart.

**Section references are data, not prose.** A lesson's source references are
structured fields, so the course can print them, link to them, and be checked
for completeness by a test rather than by proofreading.

**Rendering is decoupled from computing.** A figure such as the attention
heatmap receives a `number[][]` and knows nothing about where it came from.
The Explorer returns the raw dot products, the scaled scores, the mask, the
softmax weights and the output as five separate matrices, so a learner can
see each stage rather than a single blended number.

**The routes are split.** The seven laboratories, the charting library and the
mathematics typesetting are most of the bundle, and a reader who lands on the
course home has no use for them yet. `App.tsx` loads each route with
`React.lazy`, so the home page ships the shell and the prose and the heavy
chunk arrives when a laboratory is first opened. The end-to-end suite asserts
that the home page does not request a laboratory module.

**One head is a special case of many.** The Explorer's head control does not
switch to a second implementation: `multiHeadTrace` partitions the hidden
dimension, runs attention inside each slice, and concatenates the results
(Eq. 2.7–2.11). With one head it reproduces the single-head path exactly, and
a test asserts that the scores, weights and output agree with the
single-head computation to nine decimal places. The per-head figures are
therefore a generalisation of the same code, not a parallel model.

**The Explorer shows a whole block, not just its attention half.** A decoder
block is `LayerNorm(H + Attention(H))` followed by `LayerNorm(H' + FFN(H'))`.
The core implements all of it, and the vocabulary projection reads the *block's*
output, so the next-token distribution comes from the same place a real model's
does. The Explorer exposes each intermediate — the residual add, the
normalised result, the feed-forward hidden activation and the block output —
as its own stage, and a test asserts that the block's output differs from the
attention output, so the distinction cannot quietly collapse.

**Concepts are linked where they are introduced, not in a separate glossary
only.** The `Prose` component walks its own children and decorates the first
mention of each curated term with a `ConceptTerm` button. The walk leaves
`code`, `pre`, `kbd` and `samp` alone, because there a term is a literal
token rather than a concept under discussion, and it links each term once per
section rather than once per mention.

**The learning path is derived, not stored.** `core/path.ts` turns the
curriculum and the learner's progress into a path with three states per lesson
and a recommendation with a stated reason. The dashboard panel, the sidebar
badges and the "practise my weakest module" shortcut all read from it, so they
cannot disagree about what to study next.

**A prediction exercise is checked against the algorithm, not against a key.**
The `PredictPanel` component takes questions whose correct option is computed
by the same core function the laboratory uses. Writing a stored answer key
would be simpler, and would eventually disagree with the laboratory.

**React state is adjusted during render, not in effects, where state is derived
from props.** Four components previously reset state in a `useEffect`; that
pattern costs an extra render pass and can produce a stale frame. The render
phase adjustment pattern is React's documented alternative.

**Context actions are stable.** The progress context's mutating actions are
`useCallback`s with empty dependency lists, because they all update state
through the functional form of `setProgress`. This is not cosmetic: the lesson
page records a visit in an effect that depends on `visit`, and a visit writes a
new timestamp. If `visit` changed identity on every progress update, the
effect would re-fire and start an unbounded render loop. That bug existed, and
`e2e/course.spec.ts` now fails on any console error to keep it fixed.

## Testing strategy

Four layers, each with a different job:

- **`src/core/*.test.ts`** — the mathematics. Asserted against closed-form
  results, invariants, and finite differences.
- **`src/core/property.test.ts`** — invariants over randomised inputs, checked
  against deliberately slow reference implementations that share no code with
  the modules under test.
- **`src/content/*.test.tsx`** — the content. Asserts that the curriculum and
  the lesson registry agree, that every formula renders, and that no LaTeX
  backslash is silently consumed by a JavaScript template literal.
- **`e2e/course.spec.ts`** — the learning loop. Asserts that a learner can
  change an input, see the output change, answer a question, keep their
  progress, and that every page meets the accessibility criteria.

The division matters: a failure in `core` means the mathematics is wrong; a
failure in `content` means the course is inconsistent; a failure in `e2e` means
the learner cannot do something they are supposed to be able to do.

The accessibility audit is worth a note of its own, because it is a *list*,
and a list falls behind. It names twelve routes and five states, and the
routes it was extended to are the ones that had been added last: the
dashboard, the review session, the status page and a module page. Before it
was extended, a contrast failure on the dashboard was invisible to an audit
that had been passing for a long time. The states are the ones a reader
meets more often than the default state of a page — a question that has been
answered, the command palette with results in it, the list of shortcuts, the
transformer explorer, the definition panel — and the dimming in the study
plan was found in one of them.

Two further checks sit outside the test suites:

- **`tools/contrast.mjs`** computes the WCAG contrast ratio for every
  foreground and background pair the design tokens can produce. It runs 112
  checks across both themes and exits non-zero on a failure, so it can gate a
  colour change. The palette was designed with it, rather than by eye and
  then checked afterwards.
- **`tools/checkLinks.mjs`** asks every source cited on the status page
  whether it still resolves, and whether a pinned arXiv link has been
  superseded by a newer revision of the same paper. It is a command rather
  than a test, because a test suite that fails when the network is down is a
  test suite that gets ignored.
- **`tools/updateTestReport.mjs`** runs the tests, reads their JSON reports,
  and rewrites the two tables in `docs/TEST_REPORT.md`. Those tables were
  written by hand for a long time and had drifted; now they cannot.
- **`e2e/visual.spec.ts`** compares ten pages against committed baselines with
  a two per cent tolerance, and **`e2e/capture.spec.ts`** records a
  screenshot of each major page for human review.

### The service worker

The published build carries a service worker that caches the whole course,
so it opens and works with no network at all. Two rules govern it: the page
is fetched from the network first and the cached copy is the fallback, so a
new release reaches the reader on their next visit; and the built assets are
fetched from the cache first, because their names contain a hash of their
contents and a given name therefore always means the same file.

The cache is **named after the build**. The build writes a hash of its
manifest into the worker, so the cache name changes exactly when the course
does. Two things depend on that:

- The old cache is deleted when the new worker takes over. Without it, every
  release would add its files to a cache that was never emptied, and the
  reader's storage would fill up with courses they had already read.
- The worker file itself changes with the build, so the browser notices that
  there is a new one and installs it. A worker that never changes is never
  reinstalled.

And the worker only ever empties caches with **this course's prefix**. The
cache store belongs to the origin rather than to the course, and the
collection serves several courses from one origin, each with a worker of its
own — so a worker that emptied every cache but its own would empty the other
courses' caches as well. For the same reason, a cached file is only ever
looked for in this course's own cache.

### The deployment metadata



`public/robots.txt` and `public/sitemap.xml` are generated by the
collection's own script, `scripts/generate-site-metadata.mjs`, which writes
them for every site in the collection and checks them in. They are not
edited here.

`public/manifest.webmanifest` is the exception, and it is this site's own.
The collection's script says so: *"A site that already has one keeps it: the
older courses ship their own, with their own names and themes, and the point
of this script is to fill the gaps rather than to impose a house style."* So
the theme colour here is this site's own surface colour rather than the
collection's, the description describes this course rather than the
collection's catalogue entry, and the icons include the scalable and
maskable ones that this site's own drawing produces.

The script's rule is that an existing manifest is kept, so this file is safe
from being overwritten — but it was overwritten once, and the manifest was
restored from the repository afterwards. If the theme colour in the manifest
and the theme colour in `index.html` ever differ, the manifest is the one
that is wrong.


## The colour system

The palette has two layers, and the distinction matters for accessibility:

- `--line` and `--line-soft` are **decorative** hairlines. They separate
  cards and set the tone of the interface, and they are deliberately subtle.
- `--control` is the **boundary of an interactive control**. WCAG 1.4.11 asks
  for 3:1 between a control's edge and the surface it sits on, which a purely
  decorative hairline cannot provide. Inputs, textareas, selects and radio
  groups use it; decorative separators do not.

Text colours are chosen so that every pairing reaches 4.5:1 on every surface
it can appear on, including the translucent accent tints. The accent colours
used as button fills carry white text, which is why `--indigo-strong` and
`--teal-strong` are darker than the accent they are named after.

The theme is decided in exactly one place — the pre-paint script in
`index.html` — which reads the stored choice and falls back to the operating
system's preference. The application reads the result back out of the
document element. An earlier version had a second copy of that logic in
`src/main.tsx`; the two could disagree, and only the second one honoured the
operating system.

## Extension guide

**To add a lesson.** Add the metadata to `curriculum.ts`, write the body in the
matching `lessons/*.tsx` file, export the component, and bind it in
`lessons/registry.ts`. Add quiz questions to `quiz.ts` and reference their ids
in the lesson metadata. The content test will tell you if you missed a step.

**To add a laboratory.** Write the algorithm in `src/core`, unit-test it there,
then write a component in `components/lab` that calls it. If the numbers would
not survive being read by a screen reader, they do not belong in the figure.

**To change a model shape.** The Explorer's dimension, tokenisation mode and
mask are all inputs. Changing the default in `embeddings.ts` changes every
figure consistently, because every figure is computed from the same run.

## Known limitations

- The transformer is single-block. Multi-head attention is implemented and
  tested, but the Explorer presents the single-head path because it is the one
  that can be checked by hand.
- The alignment laboratory uses a linear policy over three features, not a
  network. The objectives are the book's; the model is a stand-in.
- The reasoning laboratory's step features are synthetic. The mechanism — two
  label sets producing two different credit allocations — is faithful to
  §6.4.2; the scale is not.
- There is no server, so progress is per browser and per device. The JSON
  export exists to move it. A browser that refuses to give access to storage
  loses the progress file, and says so, rather than the course refusing to
  start.
- The review schedule is SM-2, not FSRS. FSRS fits a two-parameter memory
  model to the whole review history and is the better algorithm, but it needs
  far more review data than a reader of one course will generate.
- The modern CSS in the stylesheet is used where it earns its place, and two
  of the techniques that were considered were left out: `content-visibility:
  auto`, because the page moved under the reader, and scroll-state container
  queries, because they are in Chromium only and there was nothing here for
  them to replace. Both are written up above with the measurements.
