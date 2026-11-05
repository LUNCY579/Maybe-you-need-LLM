# Agentic AI Academy

An interactive, local-first university course on **agentic large language models**, built around
*Agentic Large Language Models* by Max van Duijn, Michiel van der Meer, Aske Plaat and Niki van Stein
([arXiv:2610.13455](https://arxiv.org/abs/2610.13455)).

The site is a real learning environment, not a summary page. It contains a source-mapped curriculum, a
node-based agent workflow editor with a deterministic execution engine, eight parameterised
laboratories, eleven interactive demonstrations inside the lessons, a concept map of the vocabulary,
a graded assessment centre with spaced review, a final project workspace, and progress that
survives a reload.

> **Everything here is a teaching instrument.** The simulations are deterministic, scripted
> computations. No language model is called, no account is required, and no data leaves the browser.
> The course never presents a simulated agent as a deployed AI system.

---

## Quick start

```bash
npm install
npm run dev        # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check (`tsc -b`) then production build to `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run screenshots` | Build the site and capture every screenshot in `docs/screenshots/` |
| `npm run audit` | Drive the built site and check that every promise the interface makes is kept |
| `npm test` | Vitest unit + component tests (jsdom) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run coverage` | Vitest with V8 coverage |
| `npm run lint` | Oxlint |
| `npm run typecheck` | `tsc -b --force`, no emit |
| `npm run e2e` | Playwright browser tests against the production build |
| `npm run verify` | typecheck → lint → unit → build → e2e |

The production build is a static bundle: `dist/` can be served by any static host. There is no
backend, no database and no server-side rendering.

The browser suite runs on **Chromium, Firefox and WebKit**. Install the engines once with
`npx playwright install chromium firefox webkit`.

---

## What is in the course

### Curriculum (12 lessons, 72 sections, 86 assessment questions)

The lesson order, chapter mapping and sub-topics are derived from the book's own table of contents
— all seven parts and all 23 chapters are covered. The **Curriculum → Source map** view states, for
every chapter, which lessons cover it, which sections of the book those lessons draw on, and which
parts of the material were written for this course.

| Part | Lessons | Book chapters |
| --- | --- | --- |
| I · Language Modeling | 1–4 | 1–5 |
| II · Reasoning | 5–6 | 6, 7, 8, 10 |
| III · Agents | 7 | 8, 9, 10 |
| IV · Tools and Assistants | 8–9 | 11, 12, 13, 14 |
| V · Behavior and Cognition | 10 | 14–18 |
| VI · Advanced Topics | 11 | 19–22 |
| VII · Conclusion | 12 | 23 |

### Two real difficulty tracks

Every lesson ships a **core** treatment (the complete essential material) and an **advanced**
treatment that adds a deeper section — derivations, counterexamples, design trade-offs, the open
problems the book flags — plus two harder assessment questions. The track toggle on a lesson
switches the content; the choice is stored per lesson and persists.

### The Visual Agent Workflow Builder (flagship)

A node editor with ten node kinds — user input, planner, reasoning step, tool call, memory
retrieval, environment observation, decision, evaluator, reflection, final response — on top of a
**deterministic execution engine**.

- Step, pause, resume and reset a run; inspect every step in the trace.
- Inspect the full harness state: goal, plan, observations, tool calls with their input and output,
  memory contents, the last retrieval with per-item scores, critiques, errors, final answer.
- Branch visualisation: decision and evaluator nodes expose labelled `yes`/`no` and `pass`/`fail`
  branches, and the trace records which branch was taken.
- Success scoring against scenario-defined criteria, with a live validation panel.
- Explicit error states: dead ends, unknown tools, broken tools, exhausted step budgets and
  exhausted reflection budgets all halt with a reason instead of looping.
- Four learning scenarios: ReAct tool use, reflective retry, memory-augmented assistant, and a
  deliberately broken pipeline.

### Eight laboratories

| Lab | What you can change | What you can compare |
| --- | --- | --- |
| **A · Planning** | planner strategy | greedy vs. fixed plan vs. search vs. reflective, over step counts, failures and goal completion |
| **B · Memory** | capacity, top-k, relevance weight, scratchpad budget, retrieval strategy | what is kept, retrieved, omitted, and how the decision changes |
| **C · World Model** | slip probability, learned-model accuracy, training/evaluation episodes, seed | model-free vs. model-based reward, and predicted vs. actual transitions |
| **D · Multi-Agent** | channel reliability, per-role quality, revision rounds, verification, critic | the transcript, handoffs, coordination failures and outcomes |
| **E · Robot Policies** | prior strength, success threshold, step cap, external share, generations, naive prior mass, slip | what a pretrained table saves in each of three transfer families, and how model error and coverage move once a policy trains on its own rollouts |
| **F · Memory Durability** | base stability, rehearsal gain, consolidation threshold, topics and events per summary, horizon, rehearsal spacing, store capacity, write penalties | which required facts the forgetting curve takes and which the summary budget takes, and a learned write policy against the hand-written rule |
| **G · Reasoning Depth** | interaction style, chain length, per-step error rate, samples per task, seed, which policy the measured column runs | where each of five task families peaks in accuracy and in tokens, and what this course can measure for itself beside a reported, citation-only column |
| **H · Agentic Retrieval** | passages per retrieval, critic threshold, words needed to open the gate, rewrites allowed, facts in the window, hop trust margin | always-retrieve against gated critique on the same six questions, one flat query against hop-by-hop decomposition, and the four pipeline shapes over one case set and one budget model |

### Interactive demonstrations inside the lessons

The laboratories are comparison tools; the lessons are where a concept is introduced. Both need to
exist, and they must not disagree. So each demonstration in a lesson is a **projection of the same
tested engine** the corresponding laboratory uses — if the lesson shows the nut allergy surviving
eviction, the laboratory shows it too.

| Demonstration | Lesson | What the student does |
| --- | --- | --- |
| Attention as a soft lookup | 2 · Foundations | Chooses what to ask for and how sharply, and watches the weight move across the passages: a vague query finds the passage that is about the subject, and a flat softmax averages everything |
| What a filter throws away | 3 · The training pipeline | Sets the quality and de-duplication thresholds for a corpus, and watches the two ways curation fails: duplicates left in for the model to memorise, and legitimate writing removed because it looks unusual |
| Why a greedy planner gets stuck | 5 · Multi-step reasoning | Steps through the greedy planner's failure on the grid, then switches to the search planner and compares |
| What the agent remembers, and what it forgets | 7 · Interaction styles and memory | Shrinks the store until a fact is evicted, and changes the retrieval strategy |
| The context window, and what it does to the answer | 7 · Interaction styles and memory | Shrinks the window until the material no longer fits, then compares the four policies the textbook names — truncation, retrieval, compression and paging out — and watches the decisive fact survive or not |
| When should an assistant act, and when should it ask? | 8 · Tools and context | Runs three escalation policies over the same requests in a shop, a clinic and a flight desk, and shows that the right policy depends on what a mistake costs |
| Bad is stronger than good | 10 · Behaviour and strategy | Scores the same day of events under two memory architectures - the original, which is valence-blind, and the one that weighs a criticism more than a compliment - and watches the agent conclude different things about an identical day |
| Where was the decision made? | 11 · Advanced architectures | Runs two prompts through the same model and compares three ways of looking inside: a probe that finds the concept everywhere, a logit lens that shows the decision forming, and a patch that says where the behaviour was actually caused |
| Getting the right passage into the window | 9 · Search and retrieval | Chooses how many passages to retrieve and how they are chosen, and watches the decisive one fail twice: missed altogether, and retrieved but placed where the model will not look |
| Choosing a tool and filling in its arguments | 8 · Tools and context | Picks a tool from a catalogue of near-duplicates, fills in its arguments, and reads the errors the harness raises before the tool runs |
| Playing a social dilemma | 10 · Behaviour and strategy | Plays the Prisoner's Dilemma against a fixed opponent over a stated horizon and compares the result with optimal play |

The tool, dilemma, context-window, retrieval, curation, attention, patching, escalation and
valence demonstrations are backed by their own engines (`engine/demos/toolSelection.ts`, `engine/demos/dilemma.ts`,
`engine/demos/contextWindow.ts`, `engine/demos/retrieval.ts`, `engine/demos/curation.ts`,
`engine/demos/attention.ts`, `engine/demos/patching.ts`), all covered by unit tests.

Each laboratory also ends with a **"Check your reading"** panel: two questions about the mechanism
the student just used, each naming the control that tests it. A question the student cannot test is
a question they can only guess at — these read as experiments instead.

### The lesson outline

A lesson is five or six sections long. The reader now has an outline that lists them, marks the
one currently in view, and doubles as a reading-progress indicator — so the student can see the
shape of the lesson and where they are in it. The scroll-spy uses an `IntersectionObserver`, so it
costs nothing per frame.

### The concept map

The glossary lists 120 concepts; the book is about how they relate. The **Concept map** view draws
those 283 relations as a graph, coloured by the part of the textbook each concept belongs to.
Clicking a concept shows its definition, the chapter it is sourced from, its related terms and the
lessons that teach it. The layout comes from a deterministic force simulation, so the map is
identical every time you open it.

A graph this size needs help, so it can be **filtered**: the matching concepts and
their neighbours stay legible while everything else recedes, which shows the part of the map that
is about a term *in context* rather than in isolation.

### Extending the course

The curriculum is data, and `npm run build` validates it. A build-time script checks for
duplicate ids, questions with no valid answer or explanation, sources pointing at chapters the book
does not have, diagrams and laboratories that do not exist, glossary relations that point at
nothing, and chapters that no lesson covers. It fails the build on any of those, and prints a
report on the course otherwise. Adding a lesson is therefore a matter of writing the lesson, and
the build tells you if you broke something.

Three things are worth knowing before you add content:

- **Diagram ids come from the data.** `src/content/diagramIds.ts` is the source of truth and the
  `DiagramId` type is derived from it, so a diagram cannot be added to the renderer without the
  validator knowing about it.
- **The counts in the prose are read from the content.** The landing page, the achievements and the
  laboratory hints derive their numbers rather than writing them out, so a new lesson or question
  cannot leave the interface claiming something that is no longer true.
- **A demonstration needs an engine.** Every demonstration in a lesson is a projection of a tested
  engine, and the glossary routes concepts to it through `src/content/demoLinks.ts`. A concept with
  no simulation is a concept the student can only read about.

### Student experience

- Progress, quiz attempt history, bookmarks, per-lesson difficulty, ticked learning objectives and
  the project workspace are stored in `localStorage`. The schema version travels *inside* the
  payload rather than in the key, so a future change to the shape of the data can be migrated
  forward instead of orphaning it; the key written by the earlier release is still read, once, and
  then written forward.
- **Export / import** progress as JSON (progress *and* project workspace in one file).
- Course-wide search (`/` or `Cmd`/`Ctrl`+`K`) across lessons, lesson body text, glossary terms,
  assessment questions, labs and references.
- Derived achievement milestones, a searchable glossary with source badges, and a references page
  with per-entry licence notes.
- **Further reading on every lesson.** The textbook is a survey, and a survey points at the papers it
  is summarising. Each lesson's *Sources & provenance* tab names them, with a link and a sentence on
  why that particular paper is worth the reader's time — so a student who wants to go past the
  course has a route rather than a dead end.
- **What to read next, from the collection.** The landing page names the courses in the LLM Materials
  collection, links every idea this course shares with another course, and states what the catalogue
  puts after this one. The data is generated from the collection's catalogue at build time, so it
  cannot quietly fall out of date.
- Light and dark themes, a mobile navigation drawer, a `?` keyboard-shortcut sheet, and full
  keyboard operation of the tabs, radio groups, dialog, workflow builder and every scrollable
  panel.

### Learning features

The course is built around a short loop: *read → try it → check yourself → find out what you got
wrong → come back to it*. Six mechanisms support it, and all six are derived from the student's
own activity rather than stored separately.

| Feature | What it does |
| --- | --- |
| **Predict first** | Every lesson ends with a question the student must **commit to an answer for** before the explanation appears. Retrieving a fact is easy; recognising that you did not know it is what makes the fact stick. A wrong prediction is recorded as an attempt, so it returns in the review queue like any other mistake. Each laboratory ends with the same kind of question about the mechanism the student just used. |
| **Spaced review** | The review queue is not just a list of mistakes. It uses a **Leitner schedule**: a wrong answer drops a question into the first box, where it is due immediately; a correct answer promotes it a box, so it waits one, three, seven, fourteen or thirty days before returning. The interface also shows what is scheduled to come back, so the spacing is visible rather than mysterious. |
| **Inline definitions** | Glossary terms in the lesson prose are links. Clicking one reveals the definition, its chapter reference and a route to the full glossary entry — in place, in the top layer, without losing your position. Abbreviations (`RAG`, `MCP`, `ICRL`) and hyphenated spellings (`chain-of-thought`) are matched too. |
| **Practise this concept** | Concepts carry a route straight into the demonstration that exercises them, anchored on the lesson that holds it — so a reader of "Tool use" is one click from choosing a tool. |
| **Tracked objectives** | Each lesson's learning objectives are checkboxes. A lesson counts as *mastered* when every objective is ticked **and** every core question has been answered correctly at least once — reading alone is not mastery, and neither is quizzing without engaging with the stated objectives. |
| **Retention** | The dashboard reports what you have actually *retained*, not just what you have attempted: a question counts as retained when it was answered correctly and is not yet due for review. The box distribution is drawn, and the questions that were answered correctly once and are due again are called out — those are the real gaps. |

The dashboard also turns your activity into a short, ordered list of concrete next actions, capped
at two of each kind so the list stays varied rather than twelve copies of "read the next lesson".

### The course on one page

The closing lesson carries the book's own three pillars — reasoning, acting, interacting — the
cycle that connects them, the limit that shows up in each, and the eight ideas that recur across
the whole book, each with a route back to the chapter that states it. Two questions make it
assessable rather than decorative, and two chapters are named as the ones that repay a second
reading, because the book backs them with evidence rather than assertion.

### The interaction audit

The browser suite checks that controls exist and pages render. `npm run audit` checks something
harder: that the promises the interface makes are actually kept. It drives the built site through
33 student journeys and asserts the *outcome* rather than the presence of a control —
because that is the difference between a button that exists and a feature that works.

> *Your bookmark is saved* means the bookmark is there after a reload.
> *A wrong answer comes back for review* means it is in the review queue, not that the queue has a
> heading.
> *Export your progress* means the file is valid JSON that can be imported again.

It found a real defect the unit and browser suites had both missed: a deep link into a lesson
changed the URL and left the target in the document, but never moved the page, so every "go to this
section" link in the course went nowhere. The browser had been masking it by scrolling to
fragments on its own.

### The study plan

The course is nine hours of reading, eight laboratories and a builder, and "read the course" is not a
plan. The **Curriculum → Study plan** tab packs the lessons into weeks for the time you actually
have — two, three, five or nine hours a week — and says what you should be able to *do* by the end
of each one. It is derived from the lessons themselves, so it cannot drift away from the curriculum.

### Accessibility

Accessibility is enforced, not asserted:

- An **axe-core audit** runs over every page the browser suite declares and fails the build on any
  `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` violation. It passed clean on the run recorded in
  [`docs/TESTING.md`](docs/TESTING.md) — and when it was
  first added it found four real violations that a manual review had missed.
- The course was also reviewed against **WCAG 2.2**'s newer criteria, which an audit does not
  cover: focus is no longer hidden under the sticky header (2.4.11), the builder can connect two
  nodes with two clicks rather than only by dragging (2.5.7), and small controls meet the 24-pixel
  minimum target size (2.5.8).
- Every tab strip implements the WAI-ARIA tab pattern; radio groups support arrow keys; charts
  carry a name, a caption and a data-table alternative; scrollable regions are focusable and named;
  state changes are announced in live regions; and the whole interface is operable from the
  keyboard.

### Built on the modern web platform

The site uses the platform rather than working around it: **View Transitions** for route changes
(with a documented skip where WebKit's renderer cannot take a canvas-to-canvas snapshot), the
**Popover API** with **CSS anchor positioning** for inline definitions, `text-wrap` and
`color-mix`, and a **hash router** that needs no server rewrite rules. Every one of these degrades:
the site works without them.

---

## Source integrity

The textbook is licensed under **CC0 1.0** on its arXiv record. This course:

- credits the four authors on the landing page, in the footer, in the references page and on every
  lesson's provenance panel;
- cites chapter and section references for every definition, mechanism and result it presents;
- labels course-authored material as such, and labels glossary terms that are *not* from the book as
  "course term";
- **redistributes no third-party code, datasets or figures.** Where third-party work is mentioned
  (nanochat, LangChain, BALROG, MCP, RAG literature) the course links to the canonical source and
  records the licence that was verified against the project's own LICENSE file;
- reproduces no figures from the PDF. Every diagram is an original inline SVG written for this
  course.

See [`docs/CITATIONS.md`](docs/CITATIONS.md) for the full licence audit.

---

## Project structure

```
src/
  app/          hash router (dependency-free, testable in jsdom)
  content/      the course itself: book map, lessons, tracks, glossary, references, search index
  engine/       deterministic simulators (workflow, planning, memory, world model, multi-agent)
  hooks/        localStorage helpers
  pages/        one file per route group
  store/        progress and project state (React context + reducer)
  types/        curriculum and workflow schemas
  ui/           primitives, layout, lesson reader, builder nodes, charts, search dialog
e2e/            Playwright browser smoke tests
scripts/        the content validator and the screenshot capture
docs/           architecture, citations, testing notes, screenshots
```

The **engines are pure functions** and contain no React, no DOM and no randomness that is not
seeded. That is what makes the labs testable and the builder reproducible: the same graph and the
same scenario always produce the same trace.

See [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for the design rationale.

---

## Testing

```bash
npm test        # 484 unit and component tests across 42 files
npm run e2e     # Playwright browser tests across Chromium, Firefox and WebKit
```

Unit tests cover the execution engine, every laboratory, the content schema, every lesson formula
against the renderer's own KaTeX options, the search ranking function, the difficulty-track
resolution, the glossary matcher, the review queue, the next-action engine, and the counts this
README and `docs/` quote about the suites themselves. Each laboratory screen is tested against its
engine rather than against stored strings: the figures asserted on the page are recomputed by the same
call the page makes, so a change to either half fails. Browser tests cover the student journey end to
end: reading a lesson, revealing a definition
inline, ticking an objective, switching tracks, running a simulation, grading a quiz, landing a
question in the review queue and clearing it, using search, resetting progress, and the project
workspace — plus an axe-core accessibility audit of every page.

See [`docs/TESTING.md`](docs/TESTING.md) for the latest run results, what each suite proves, and an
honest list of what is *not* covered.

---

## Screenshots

`docs/screenshots/` holds captures of every page in the dark theme, taken against the production
build by `npm run screenshots`:

| | |
| --- | --- |
| ![Landing](docs/screenshots/landing.png) | ![Lesson reader](docs/screenshots/lesson.png) |
| ![Predict first](docs/screenshots/predict.png) | ![Inline definition](docs/screenshots/lesson-glossary.png) |
| ![Tool demo](docs/screenshots/demo-tool.png) | ![Memory demo](docs/screenshots/demo-memory.png) |
| ![Dilemma demo](docs/screenshots/demo-dilemma.png) | ![Context window demo](docs/screenshots/context-window-demo.png) |
| ![Compression loses the fact](docs/screenshots/context-window-demo-compress.png) | ![Concept map](docs/screenshots/concept-map.png) |
| ![Further reading](docs/screenshots/lesson-further-reading.png) | ![Course on one page](docs/screenshots/lesson-synthesis.png) |
| ![Curriculum](docs/screenshots/curriculum.png) | ![Source map](docs/screenshots/source-map.png) |
| ![Review queue](docs/screenshots/review.png) | ![Shortcuts](docs/screenshots/shortcuts.png) |
| ![Workflow builder](docs/screenshots/builder.png) | ![Labs](docs/screenshots/lab-planning.png) |
| ![Dashboard](docs/screenshots/dashboard.png) | ![References](docs/screenshots/references.png) |

---

## Licensing

Course code: MIT. Course content: authored for this project and released under the same terms,
with the textbook's authors credited as the source of the material it teaches. The textbook itself
is not redistributed; see [`docs/CITATIONS.md`](docs/CITATIONS.md).
