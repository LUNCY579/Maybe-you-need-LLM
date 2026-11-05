# Testing

Everything below was run against the code in this repository. The commands are reproducible from a
clean checkout with `npm install`.

```bash
npm run typecheck   # tsc -b --force
npm run lint        # oxlint
npm test            # vitest run  (jsdom)
npm run build       # tsc -b && vite build
npm run e2e         # playwright test (against the production build)
```

`npm run verify` runs all five in sequence.

---

## 1. Results

| Check | Command | Result |
| --- | --- | --- |
| Content validation | `npm run check:content` | **pass** — 0 errors, 0 warnings; 12 lessons, 73 sections, 94 questions, 120 glossary terms, 9 registered laboratories, 23/23 chapters covered |
| Type check | `npm run typecheck` | **pass** — 0 errors (strict TypeScript, `noUnusedLocals`, `noUnusedParameters`) |
| Lint | `npm run lint` | **pass** — 0 errors, 3 warnings (see §6) |
| Unit + component tests | `npm test` | **pass** — 42 files, **484 tests**, 0 failures |
| Production build | `npm run build` | **pass** — `dist/` produced, no bundler errors |
| Browser tests (Chromium) | `npm run e2e` | **pass** — **95 tests**, 0 failures — in the run recorded in §3, which predates the four newest laboratories |
| Browser tests (all engines) | `npx playwright test` | **pass** — **235 passed**, 50 skipped (the audit runs on Chromium only), 0 failures — same run, same caveat |

The content validation is part of `npm run build`, so a course with a broken reference cannot be
shipped. It was checked by deliberately breaking a glossary relation: the build failed with exit
code 1 and named the offending term.

The two browser rows are honest about their age. Since that run, `e2e/smoke.spec.ts` and
`e2e/accessibility.spec.ts` have gained routes for Lab E, Lab F, Lab G and Lab H; the additions
typecheck, and they have not been executed here, because this machine has no Playwright browser
download (`npx playwright install` fetches one). What the new screens claim is nevertheless verified
twice without a browser: each screen test recomputes the figure it prints from the engine, and the
engine test checks the mechanism the figure comes from. The browser rows cover layout, interaction
and accessibility — see §4 for what that means for the four newest routes.

Environment: Windows 11, Node v24.18.0, npm 11.16.0, Playwright 1.64.1 on Chromium 141, Firefox
and WebKit 27.2.

---

## 2. Unit and component tests (484)

Forty-two files, 484 tests, all green in one `vitest run`. Every file in the suite is listed here, and
every count below is the number of tests that run reported for that file, so the section is a
statement about the suite rather than a sample of it.

### `src/engine/workflow.test.ts` — the flagship execution engine (17)

The heart of the course, so it is tested hardest.

- **Graph validation**: the four reference scenarios validate; a missing response node is an error;
  unreachable nodes and single-branch branch points are warnings; invalid memory configuration
  (capacity < 1, relevance weight outside [0, 1]) is rejected.
- **Tool-use scenario**: runs to completion with a perfect score; is byte-identical across repeated
  runs; executes exactly one node per `stepOnce` and tracks `currentNodeId`; pauses and resumes
  without losing position; reports an error state for an invalid graph.
- **Reflection scenario**: fails once, records a critique, reflects, and succeeds on the retry;
  halts explicitly with a reason when the reflection budget is exhausted.
- **Memory scenario**: retrieves relevant items and writes a summary; ranks the window-seat
  preference above unrelated memories; evicts the lowest-salience item when the store exceeds
  capacity.
- **Broken-pipeline scenario**: ends in an explicit error state with a full trace; gives partial
  credit for observed failures rather than crashing.
- **Step budget**: halts when a cyclic graph exceeds the budget.

### `src/engine/labs.test.ts` — the four laboratories (29)

- **Lab A · planning**: search-based planning reaches the goal; greedy gets stuck because it never
  fetches the key; the fixed plan fails at the locked door; reflective planning recovers and
  solves the task; the run is deterministic; with slip enabled it is still deterministic for a fixed
  seed, differs across seeds, never slips at probability 0, records slips in the trace, gives every
  strategy the same slip pattern at the same step indices, and never leaves the world bounds.
- **Lab B · memory**: keeps the store within capacity; makes the correct decision with the
  recommended configuration; fails when the store is too small and retrieval favours recency; fails
  when retrieval never returns the decisive fact; reports a score for every stored item and lists
  the omitted ones; rolls the scratchpad over as the budget shrinks.
- **Lab C · world model**: value iteration produces a policy for every non-terminal cell; the
  model-free agent improves above the worst possible reward; the model-based agent is more
  sample-efficient with an accurate model; divergence is smaller with a faithful model than a naive
  one; both agents converge given enough episodes; model error is exposed through divergence; the
  run is deterministic for a fixed seed; model transitions are normalised.
- **Lab D · multi-agent**: a reliable team scores above a lossy one; more defects reach the answer
  without verification; handoffs, messages and per-agent statistics are reported; the run is
  deterministic for a fixed configuration.

### `src/content/content.test.ts` — curriculum integrity (19)

Guards against content drift, which is the main way a course like this rots.

- Ships at least ten authored lessons (12) and at least twenty assessment questions (62).
- Covers every part of the book; ids, slugs and orders are unique; every prerequisite resolves to
  a real lesson; chapter references are real and page numbers are plausible; quiz answers are in
  range and every explanation is non-empty; every lesson has objectives, keywords and a provenance
  note; every diagram used by a lesson is registered; every lab block points at a registered lab;
  lesson order agrees with the navigation helpers; parts map back to chapters.
- Glossary: terms link to real lessons, course terms are marked, no duplicate terms.
- References: every entry records a licence note and a use; the textbook is the primary reference.
- Lab registry: routes are unique and every lab states its runtime basis.

### `src/content/formulas.test.ts` — the KaTeX surface (4)

Every `formula` block in the course — 19 of them, across the core sections and the advanced track —
is rendered with the *same* options the reader uses (`displayMode: true`, `throwOnError: true`,
`strict: 'ignore'`).

That match matters. `Formula` in `src/ui/Markdown.tsx` calls KaTeX with `throwOnError: true` inside a
try/catch, so an expression that does not parse degrades to a readable "Formula error: …" line rather
than crashing the page. Good for a student; bad for a build, because the mistake stays invisible until
someone opens that lesson. This file takes the same options and lets the throw happen, so a broken
expression fails here instead.

- The suite has formulas at all (a course whose mathematics had quietly disappeared would otherwise
  pass every other test).
- Every block holds a non-empty expression and no `$` delimiters — those belong to the authoring
  format, and KaTeX would render them as literal dollars.
- Every expression parses; failures are collected and compared as a list, so one run names every
  broken formula rather than stopping at the first.
- Every expression renders to `katex-display` markup, which is what distinguishes display mode from
  inline in the output — proof that the test really used the reader's mode.

The check came out of a live question, and the answer here is measured rather than assumed. A newline
in a display-mode expression does *not* throw: the `newLineInDisplayMode` strict check is
reported-only in the installed KaTeX (`katex/src/functions/cr.ts` passes `report: false` to it), so a
literal newline, `\\` and `\newline` all render without an error. What does throw under the reader's
options is a genuine parse error — `\frac{1}{` raises `ParseError: Unexpected end of input in a macro
argument, expected '}'` — and that is the defect an author can actually introduce, the one the reader
would otherwise hide as an error box. All 19 authored blocks parse.

### `src/content/docsClaims.test.ts` — the documentation that counts things (6)

Three files quote the size of the browser suites, and every one of those numbers was typed by hand.
Typed numbers rot silently: `docs/TESTING.md` had said "forty-six journeys" for an audit that held
twenty-nine, and nothing failed anywhere. This test takes each claim out of the prose with a regex and
compares it with a count taken from the files that define the suite.

- The journey count in `scripts/audit.mjs` is the number README, `docs/TESTING.md` and
  `docs/ARCHITECTURE.md` all state — and no journey name is duplicated or blank.
- The Chromium figure in §3 is the sum of the tests declared in `smoke.spec.ts`, the pages declared in
  `e2e/accessibility.spec.ts` and `collection.spec.ts`, with each part quoted correctly.
- The accessibility heading still separates *pages run* from *pages declared*, and the declared half
  is the real length of the page list.
- Every route in the laboratory registry is audited by axe-core, and every laboratory with its own
  route is visited by the smoke suite — the registry cannot gain a screen the browser suites never
  open.

It proves that the documents describe the repository. It cannot prove that the browser suites pass,
because the Playwright browsers are not downloaded here, and §3 says so.

### `src/engine/demos/toolSelection.test.ts` — tool selection (14)

A well-formed call validates cleanly; a missing required argument is reported; an argument outside
the schema is reported; a value outside an enumeration is reported; a wrong type is reported; an
empty string counts as missing; optional arguments are not required.

Evaluation: the right tool with the right arguments succeeds and returns the observation; an
invalid call is rejected before the tool runs; a distractor tool is rejected with the reason
explained; an unknown tool is rejected; a call with the right tool but the wrong arguments succeeds
but is flagged. Every case has a correct tool and a written reason for each distractor. The
evaluation is deterministic.

### `src/engine/demos/dilemma.test.ts` — social dilemmas (16)

Each opponent policy behaves as advertised: always-cooperate never defects, always-defect always
defects, tit-for-tat cooperates first and then copies, grim trigger punishes one defection
permanently.

The game itself: defection is a dominant strategy; unilateral defection is rewarded in the one-shot
game; defect–defect is the best one-shot outcome; a defector is punished against a cooperator over
the horizon; cooperation is sustained against tit-for-tat and against grim trigger; the optimal
total is computed by backward induction, which means cooperating for every round *except the last*;
the best achievable total is found by brute force over all action sequences; one round is recorded
per horizon step; the rounds sum to the totals; and the run is deterministic.

### `src/content/conceptGraph.test.ts` — the concept map (14)

One node per glossary term; relations only reference terms that exist; every relation is symmetric
and unique; each relation is counted on both of its endpoints; every node has a part and at least
one chapter; the layout stays inside the canvas; two different nodes get two different positions;
the layout is deterministic; laying out a graph does not mutate it; the chapter title is derived
correctly; no term is left without a relation; every term links to at least one other term; and an
empty graph is handled.

### `src/content/studyPlan.test.ts` — the study plan (13)

Every lesson appears exactly once, in course order, at every pace. A week never holds more than the
available time unless it holds a single lesson longer than a week. More time means fewer weeks.
Every minute of reading is accounted for, and every laboratory is scheduled exactly once. Each week
ends with what its *last lesson* achieves — not with what the week number implies, which would be
the wrong material at a faster pace. A plan that is far too fast gives every lesson its own week;
a plan that is far too slow gives one week to everything.

### `src/engine/demos/valence.test.ts` — the memory architectures (7)

A memory is scored by recency, relevance and importance. The valence-sensitive policy boosts a
negative memory and leaves a positive one alone. The decisive claim: the *same day* is concluded
differently under the two architectures, and the tie between a criticism and a compliment is broken
by the architecture rather than by the events. The engine never retrieves more than the episode
asks for, and every episode has a positive and a negative twin that are equally weighted — or the
experiment would not be a controlled one.

### `src/engine/demos/escalation.test.ts` — the escalation policies (16)

Acting on everything acts on everything; asking about everything asks about everything. The policy
the chapter recommends acts on the clear and harmless requests and never takes a wrong action in a
high-stakes domain. A mistake costs more where the stakes are higher. It abstains on a request that
is not the assistant's to handle, but still asks for a missing detail even in a clinic — asking and
declining are different things. The always-asking policy completes nothing, and the only policy
that is both safe and useful in every domain is the one that defers under uncertainty.

### `src/engine/demos/patching.test.ts` — the activation-patching demonstration (12)

No signal is carried before the decision is made, and what is carried decays as it travels forward.
The logit lens is undecided before the decision and committed after it. The probe finds a weak
correlation with the prompt at *every* layer, and detects nothing at a strict threshold — the trap.
Patching the decision layer transfers the behaviour; patching any layer before it changes nothing,
because the answer had not been decided there. Patching a layer into itself changes nothing. The
second scenario behaves the same way.

### `src/engine/demos/attention.test.ts` — the attention demonstration (12)

The dot product, and a softmax that sums to one and is stable for large scores. A scale of zero
spreads the weight evenly; a high scale concentrates it. A precise query asked sharply finds the
passage that answers the question; the same query asked softly does not, because the context is close
to an average of everything. A vague query and a query that only repeats the keyword both prefer
the decoy, at every scale. The context vector ends up closer to the winner than to the average.

### `src/engine/demos/curation.test.ts` — the curation demonstration (11)

A filter that is off keeps everything. A strict enough duplicate threshold removes the
near-duplicates and leaves the near-copy that falls below it. The safety filter removes the unsafe
documents, and reports them as such. A high quality threshold filters out the dialect variety and
names the documents it removed for no good reason; a low one keeps them. The corpus never grows, the
source mix is reported before and after, every dropped document has a reason the pipeline named, and
the engine is deterministic.

### `src/engine/demos/retrieval.test.ts` — the retrieval demonstration (10)

The U-shaped curve of attention over a context: the ends are attended to most and the middle least.
One passage taken by similarity misses the decisive one; a reranker finds it. A decisive passage
that *is* retrieved can still fail, by landing in the middle of the window. Selecting for diversity
can crowd the decisive passage out. The window never holds more than was asked for, the engine is
deterministic, and the answer is never right without the decisive passage.

### `src/engine/demos/contextWindow.test.ts` — the context window (16)

Everything fits when the window is large enough; the prompt never exceeds the budget under any
policy at any size; the instruction and the task are protected from truncation; a window too small
for them is reported as an overflow rather than silently truncated; truncation drops the decisive
fact; retrieval keeps it; compression keeps the item but loses the detail inside it; paging out
moves the overflow to a store rather than destroying it, and can recall the wrong item; the
policies disagree, so there is something for the student to discover; and the engine is
deterministic.

### `src/ui/builder/JsonObjectEditor.test.tsx` — the JSON argument field (6)

The field shows the current value when it opens; a half-typed object stays on screen and says why
it was not applied; a complete object is applied and clears the error; the text the student typed
survives the value being applied; the text keeps the formatting the student chose when their own
edit adds a key — the case that tells the editor's own change from a change that came from outside;
and the text is replaced when the value changes from outside. The behaviour is also asserted in a
real browser, keystroke by keystroke, in `e2e/smoke.spec.ts`.

### `src/hooks/useScrollIntoViewWhenAvailable.test.tsx` — deep links (13)

A link that names a section has to land on it, and the page is not finished laying itself out when
it lands. The tests cover: the element already present; the element that arrives later, when the
route's chunk finishes loading; the backstop for a link that names nothing at all; a late arrival
being watched as well as an early one; the target being pulled back into place after something
above it grows; a one-pixel rounding difference being ignored; the highlight not firing twice; a
student who scrolls away not being dragged back; a wheel or a touch ending the watching; the
settling window closing on time; and an unmount leaving no watcher behind.

### `src/content/retention.test.ts` — the retention summary (7)

A new student has attempted nothing; a correctly answered question counts as retained; a wrongly
answered question counts as due and not yet learned; a question answered correctly once but due
again is *fragile*; untouched questions are excluded from the rate; the questions are distributed
across the review boxes; and a concept counts as mastered only once it has climbed far enough.

### `src/content/labQuestions.test.ts` — the laboratory diagnostic questions (4)

Every laboratory has at least one diagnostic question; every question id is unique; every question
has a usable structure (a prompt, at least three distinct options, an in-range answer, a
substantial explanation and a sourced reference); and the ids cannot collide with the lesson
questions.

### `src/content/spacing.test.ts` — the Leitner scheduler (13)

The classic interval schedule is used; a wrongly answered question lands in box zero and is due
immediately; a correct answer promotes the question; the first correct answer waits a day; the
interval grows with the streak; the box is capped so the interval cannot grow without bound; a
broken streak drops the question back to box zero; a question becomes due again once the interval has
elapsed and is not due before it; a question that has never been attempted has no schedule;
attempts group by question in order; a box can be described in words; and an attempt with an
unparseable timestamp is ignored.

### `src/content/lessons/predictions.test.ts` — the prediction exercises (5)

Every lesson that has a checkpoint also has a prediction; the predictions are registered as
ordinary questions so their attempts reach the review queue; every question id in the course is
unique; every prediction has a usable structure (a prompt, at least three options, an in-range
correct index, a substantial explanation, a source and a page); and no prediction repeats an option
verbatim.

### `src/content/demoLinks.test.ts` — concept-to-demonstration routes (7)

Each demonstration appears in exactly one lesson; the route into a demonstration points at the
lesson that holds it and anchors on the demonstration; a term resolves to the demonstration that
exercises it; a term with no demonstration resolves to nothing; the map only names terms that
exist in the glossary; and every demonstration is reachable from at least one term.

The seventh asserts that every route anchors on an element the lesson actually contains — a route
that names an element the lesson does not have is a link that goes nowhere, and nothing else in the
suite would have noticed.

### `src/content/review.test.ts` — the review queue and mastery (13)

The queue is empty for a new student; a question whose latest attempt was wrong is due; the same
question leaves the queue when answered correctly; answering it wrongly again puts it back, with the
miss count preserved; the most overdue question is first; the number of affected lessons is
reported; attempts at questions that no longer exist are ignored; the order is deterministic.

Mastery: a fresh student has mastered nothing; mastery requires both the objectives and the
questions; the optional advanced questions are not required; ticked objectives are counted; an
unknown lesson is handled gracefully.

### `src/content/glossaryIndex.test.ts` — inline definitions (15)

Every relation points at a term that exists (compared after normalisation, because the book mixes
hyphens and en dashes); every term has a definition, a source and at least one lesson; an
abbreviation and its base phrase are registered; a qualifier such as "(in RL)" is not treated as an
abbreviation; slash-separated alternatives are split; every alias maps to a real term; a term is
found in ordinary prose; a hyphenated spelling matches; an abbreviation matches; a term does not
match inside a longer word ("reagents" is not "agent"); matching is case-insensitive; the longest
match wins; matches are ordered and non-overlapping; text with no terms yields nothing; very short
terms are not linked.

### `src/content/guidance.test.ts` — next actions (10)

A new student is told to read the first lesson; a due review is put first; a lesson that has been
assessed but not completed is offered as "finish"; a completed but not mastered lesson is offered as
"tick the objectives"; a completed but never assessed lesson is offered as "take the questions";
labs that have never been run are offered; labs that have been run are not; the limit is respected;
a fully finished course produces a completion message; the order is deterministic.

### `src/content/searchIndex.test.ts` — course-wide search (14)

Indexes every lesson, section, glossary term, question, lab and reference; every entry has a
navigable route; the tokeniser drops stop words; an empty or stop-word-only query returns nothing;
a lesson is found by its title; a glossary term is found by its exact name; a title match outranks a
body match; lesson *body* text is searchable; question text is searchable; the ranking is
deterministic; the limit is respected; every result has a positive score and at least one matched
term; no duplicate ids.

The fourteenth asserts that every in-page link names an element the lesson really contains. This
is the test that would have caught the deep-link bug: the routes were well formed, the elements
were in the document, and the link still went nowhere.

> This suite caught a real defect: an earlier ranking used raw substring matching, so the query
> *"Foundations of Language Modeling"* ranked a vision-language-action question above the language
> modelling lesson, because "language" matched inside "vision-language-action". The matcher now
> compares whole tokens.

### `src/content/tracks.test.ts` — difficulty tracks (11)

Every lesson has an advanced section and advanced questions; advanced question ids are unique across
the course; every advanced question has a source reference, a non-trivial explanation, at least three
options and an in-range correct index; every question in the course cites a page; the core track never
contains an advanced question; the advanced track is always strictly larger; advanced sections are
appended after the shared ones; the core track is never empty; the total question count includes the
advanced set.

### `src/content/sourceMap.test.ts` — source mapping (8)

One row per book chapter; every chapter of the book is covered; every chapter links to a lesson and
to the textbook sections it draws on; page numbers are present; every chapter belongs to a part that
exists; every lesson declares valid `secondaryParts`; the book's four case studies and four
advanced chapters are flagged correctly.

### `src/store/progress.test.tsx` — progress and persistence (21)

The reducer completes a lesson once and ignores duplicates; toggles bookmarks; records attempts and
lab activity with timestamps; caps lab activity so storage stays bounded; resets to a clean state.
Parsing returns a clean state for missing or corrupt payloads, drops attempts for questions that no
longer exist and keeps known ones, and round-trips through serialization. The provider counts
completions, accuracy and last visit, and persists to `localStorage`. Achievements unlock from
activity.

Three of the twenty-one are the browser saying no. A store that **refuses the write** (quota) leaves
the session working — the completion is counted, the accuracy is counted, and nothing is half-written
under the progress key. A store that **cannot be read at all** (private mode, cookies disabled) must
not take the application down. It used to: `readInitialTheme` in `src/store/theme.tsx` called
`localStorage.getItem` outside a try/catch, while the write side of the same file was guarded and the
progress read was guarded too. The unreadable-store test fails against that version, which is how the
defect was confirmed rather than assumed — the fix is the try/catch, with the default theme as the
honest fallback.

### `src/store/project.test.ts` — project workspace (10)

Parsing returns the initial state for empty or corrupt payloads; state round-trips through
serialize/parse; out-of-range rubric scores are clamped; non-boolean checklist entries and
non-string notes are dropped. The readiness report says *not started* for an empty project,
*in progress* once there is activity, marks criteria as evidenced from real course activity, reaches
*submitted* only when every milestone is done **and** points are awarded, **awards no points of its
own**, and covers every rubric criterion exactly once.

### `src/App.test.tsx` — component and workflow (19)

The landing page renders with course statistics; the curriculum shows lesson cards for every part;
the workflow builder renders with validation and controls; every lab page renders — the four
original laboratories and the four deep-dive ones, each reached at its own hash route; unknown
routes produce a helpful page. The lesson reader shows objectives, sources and the assessment tab,
marks a lesson complete and persists it, and records a quiz attempt and reveals the explanation. The
quiz centre offers practice, mixed sets and history. The glossary filters terms; the references page
documents licence notes. The dashboard renders stats and data controls.

The ten files that follow are the deep-dive laboratories and the two registries that keep them
honest. The four screen tests share one method: none of them stores an expected string. Each calls
the same pure engine the screen calls, with the same configuration, and asserts that the figure on
the page *is* the figure computed — so a screen cannot keep displaying a number its engine stopped
producing.

### `src/content/declaredLabs.test.ts` — the registry against the collection manifest (7)

Every item `LABS[].delivers` promises is an item the collection manifest declared for this course,
quoted byte for byte; every declared item is attributed to a manifest source that lists it and is
owned by exactly one laboratory; a laboratory that declares anything names a source. The remaining
assertions walk the declared items one at a time, so an item that stops being delivered fails by
name rather than as a count.

### `src/content/collection.test.ts` — the course's place in the collection (12)

The generated collection describes this course the same way in both of its lists, names every course
it lists, gives each a distinct identifier, and points "read next" only at courses that exist — once
each, with a reason for the order, and never at itself. Shared ideas name themselves and link only
courses a reader can open. The address of another course is relative, so the links do not depend on
where the collection is served from.

### `src/engine/labs/policyPriors.test.ts` — Lab E's transfer and own-data measurements (19)

- **Transfer arm**: the prior is only an initialisation — at strength 0 it is indistinguishable from
  learning from scratch; the transferred table changes the starting policy and helps only where its
  structure carries over; negative transfer is measured and survives both a shorter and a longer
  budget; every real-environment interaction is counted exactly once, including the probe; a
  threshold crossing is never reported that did not happen, and one that did is never hidden; both
  arms are probed with the same evaluation, so the difference is the policy; deterministic per seed,
  and it moves when the seed moves.
- **Own-data loop**: each generation is retrained on the previous generation's rollouts, transition
  for transition; an empty demonstration pool makes the two arms literally the same arm; the
  self-generated share is measured rather than assumed; a bigger pool fits the bootstrapped
  generation better; the fitted model normalises every pair it has seen and the empty model is all
  fallback; the error metric reads a naive belief as wrong and a true model as nearly flat; planning
  happens only inside the model provided, so a worse model can misplace an action; the divergent
  pairs behind the mean are exposed and labelled by whether they were ever modelled; the loop runs in
  a world harsher than Lab C's, where model error costs whole episodes.

### `src/engine/demos/reasoningDepth.test.ts` — the reasoning depth battery (11)

Measures the warning that extra thinking is not always better where the work does not split, and
locates a crossover inside a family that does: the battery splits the operations of a decomposable
task and re-renders the whole state for an indivisible one. A step is made harder in proportion to
what it carries, and never past certainty; a tool is given an observation to return only where there
is something to check. It is deterministic, moves with its inputs instead of restating a constant,
labels its hand-authored battery by family, and reports a measured split verdict rather than a
headline.

### `src/engine/demos/frontierAccount.test.ts` — the frontier audit (6)

Keeps every reported cell number-free, and says so when one is not. The measured column is taken
from the depth policy, so it cannot be a stored figure; the rule-based stand-in answers the course's
own questions by echoing its own text and abstains otherwise; the corpus is built from the teaching
text and never from the answer key; the audit is the same on every run.

### `src/engine/demos/agenticRetrieval.test.ts` — Lab H's three engines (16)

- **Adaptive retrieval with critique**: the gate closes on the questions the corpus has no words for;
  the answer comes from the passage the model's own critic believed, never from the key; the case
  where the critic is wrong is recorded and said out loud; abstention starts only above the threshold
  in force; the errors are inherited from the cross-encoder figures the engine is given.
- **Question decomposition**: a wrong intermediate answer is paid for on the next hop, the
  propagation is reported both ways as numbers, and a hop never reads ahead of the answer it has.
- **Four pipeline shapes**: each shape gets its own wins and losses on one shared case set, every
  aggregate is the sum of the runs beneath it, and the engine states which number it is not claiming.
- All three are deterministic because nothing in them is sampled: the same question twice returns the
  same trace twice.

### `src/pages/labs/PolicyPriorsLabPage.test.tsx` — the Lab E screen (5)

Opens on the transfer measurement and states the pretraining cost on the page; carries both declared
items from Chapter 7 and Chapter 23; re-runs the loop when the generation count is moved; switches
the policy grids with the family picker.

### `src/pages/labs/MemoryLongevityLabPage.test.tsx` — the Lab F screen (5)

States the curve it is running — the stability and threshold it used, not a paraphrase of a result;
carries both declared §9.3.2.3 items; re-runs the curve when the horizon moves; schedules a rehearsal
from the panel and shows the store change with it.

### `src/pages/labs/ReasoningLabPage.test.tsx` — the Lab G screen (5)

Reports the depth verdict family by family, with the measured split deciding the headline; at a
per-step error rate of zero the sweep is flat everywhere, which is the check that the crossover is
measured rather than drawn; carries the declared Chapter 23 frontier item; re-runs the battery when a
slider moves and switches which policy the measured column runs; the same settings give the same
sweep, family by family.

### `src/pages/labs/AgenticRetrievalLabPage.test.tsx` — the Lab H screen (6)

Turns the rewrite budget off and shows the rescued answers become abstentions; moves the hop margin
and shows the hop coverage move with it; renders the three Chapter 12 items each under its own tab;
and is deterministic — the same settings give the same figures on a second render.

---

## 3. Browser tests

Run against the **production build** (`vite preview`), so what is verified is what a static host
would serve. The suite runs on Chromium, Firefox and WebKit.

Two figures matter here and they are not the same number. The last run executed on a machine with
browser downloads produced **95 tests on Chromium** and **235 passed across three engines**, 50
skipped; the tables below describe that run. The suite as it stands now declares **104 tests on
Chromium** — 69 in `smoke.spec.ts`, 33 pages in the accessibility audit, 2 in `collection.spec.ts` —
because the four deep-dive laboratories added a smoke test and eight audit pages since. Those
additions typecheck and have not been executed: this environment has no Playwright browser download,
and the 246/66 arithmetic that follows from the new counts is a statement about the files, not a
result. Run `npx playwright install chromium` and then `npm run e2e` to replace the figures.

| Group | Test | What it proves |
| --- | --- | --- |
| Student journey | landing page renders the course and navigation | The h1, primary navigation and skip link are present, and the first paint produces no page errors. |
| | lesson can be read, completed and survives a reload | Tabs work; the provenance panel shows the cited section; completion persists across a reload. |
| | quiz answers are graded with explanations | A radio option is selected, "Check answer" grades it, and the explanation is shown. |
| | workflow builder executes a scenario and reports a trace | A scenario validates, runs to completion, and produces a numbered trace; switching to the broken pipeline produces an explicit halt reason, both visibly and in the live region. |
| | labs run their deterministic simulations | All four labs render and their tabbed views produce results. |
| | dashboard exports progress and glossary is searchable | The export downloads `agentic-ai-academy-progress.json`; glossary search filters. |
| | theme toggle switches the document theme | The default is dark, the toggle removes the `dark` class, and the button's name flips. |
| Collection | the landing page points at the courses in the collection | The panel states the catalogue's size, links each shared idea to every course that teaches it, draws each course the catalogue puts after this one with its title and reason (and says so when there is none), and every link it draws is a collection address rather than an in-app route. |
| Search | search opens with the keyboard and navigates to a result | `/` opens the dialog; a result can be selected with the keyboard and navigates to a real route. |
| | search opens from the header button | The always-visible button is a working route to the dialog. |
| | the shortcut does not fire while typing in a field | Real key events in a text field do not open the dialog. |
| | search indexes lesson body text, not only titles | Searching for "Chinchilla" — a term that appears in lesson prose, not in a title — returns a result. |
| | escape closes the search dialog | The dialog is dismissible with `Escape`. |
| Difficulty tracks | switching to the advanced track adds sections and questions | The advanced section is absent on the core track and present after the toggle; the assessment grows from 3 to 5 questions. |
| | the advanced track choice persists across a reload | The per-lesson track choice is stored. |
| Accessibility | the skip link moves focus to the main region instead of routing to 404 | **Regression test.** The skip link used to be `href="#main-content"`, which the hash router turned into a 404 page. |
| | tabs are wired to their panels and respond to arrow keys | Exactly one `tabpanel` is present; `ArrowRight` moves and activates the next tab. |
| | resetting progress asks for confirmation inline | The destructive action arms a confirm/cancel pair instead of calling `window.confirm`. |
| | a node can be selected and edited without touching the canvas | **Regression test for the keyboard gap.** Every node is reachable through the "Select a node" control, and the inspector opens for it. |
| | a node can be added with the keyboard and is then selected | The add-node button works with the keyboard, the graph grows, and the new node is selected. |
| | two nodes can be connected without dragging | **WCAG 2.5.7.** A connection is made with two clicks and no press-and-hold, and the edge appears. |
| | invalid JSON in the argument editor is reported, not silently discarded | **Regression test.** The field keeps the typed text, marks itself invalid and states the parser's message; fixing the JSON applies it. |
| Project | project state is editable and persisted | The task name and a milestone checkbox persist across a reload. |
| Source map | maps every book chapter to the lessons that cover it | The source-map view renders and names the last chapter of the book. |
| | the curriculum chapter inventory reports full coverage | No chapter is left marked "roadmap". |
| Learning features | glossary terms in the prose reveal their definition in place | A term in the lesson text opens a popover with the definition and its chapter reference; Escape closes it. |
| | learning objectives can be ticked and persist | The objective checkboxes work and survive a reload. |
| | a wrong answer lands in the review queue and clears when answered correctly | The full loop: answering wrong puts the question in the queue, answering it right empties it. |
| | the dashboard suggests concrete next actions | The "What to do next" panel is populated and actionable. |
| | the keyboard shortcut list can be opened and closed | The `?` sheet opens from the header and closes with Escape. |
| Inline demonstrations | a lesson embeds a working demonstration of its concept | Choosing the right tool and filling in the right arguments succeeds and returns the observation; empty arguments are rejected with the reason shown. |
| | the memory demonstration responds to the capacity control | At full capacity nothing is evicted; shrinking the store produces an eviction. |
| | the planning demonstration steps through the greedy failure | The greedy planner does not reach the goal and can be stepped through; the search planner does reach it. |
| | the dilemma demonstration scores the round against the optimal line | Playing a round updates the count and the optimal-play figure is shown. |
| | the context window demonstration shows a policy losing the decisive fact | Truncation drops the delivery date and the agent answers wrongly; retrieval keeps it and the answer is right; compression keeps the item but the badge reports that the fact was lost. |
| | the retrieval demonstration shows a passage failing to be used | Taking one passage by similarity misses the decisive one; the cross-encoder reranker finds it, and the badge says the model used it. |
| | the curation demonstration shows a filter losing the variety | Filtering a forum archive hard removes the dialect threads along with the bad ones; lowering the threshold keeps them. |
| | the attention demonstration shows a soft lookup failing | A precise query asked sharply finds the passage that answers; a vague one finds the passage that is about the subject, and sharpening does not repair it. |
| | the study plan adapts to the time a student has | Two hours a week needs more weeks than nine, and every lesson appears exactly once at either pace. |
| | the patching demonstration shows the three methods disagreeing | The probe finds the concept everywhere, the logit lens is undecided early on, patching the decision layer transfers the behaviour, and patching the first layer does not. |
| | the escalation demonstration shows the stakes changing the answer | Acting on everything takes three wrong actions in a shop and five in a clinic, and the policy the chapter recommends takes none. |
| | the valence demonstration shows an architecture changing the conclusion | The original memory system remembers the praise and concludes the day went well; the valence-sensitive one remembers the criticism and concludes it went badly. |
| The concept map | draws the relations between the glossary terms | The rendered node and edge counts are compared against the data, so a rendering regression fails but extending the glossary does not. |
| | the concept map can be filtered down to part of the graph | Filtering keeps some concepts legible and dims the rest, so the part of the map about a term is shown in context. |
| | the dashboard reports what has been retained | The retention panel is present and names the retained count. |
| | a lesson points at the primary literature behind it | The *Further reading* panel names the papers, each link points at the arXiv record, and the links carry `rel="noreferrer noopener"`. |
| | the landing page links to the one-page summary | The link reaches the summary and the section is scrolled into view, not merely present in the document. |
| | a deep link into a demonstration scrolls to it | The anchor a glossary term carries brings the demonstration into view, on every engine. |
| | a glossary deep link lands on the term it names | Ninety-eight entries is a long list, so the term is scrolled into view and highlighted, not merely marked somewhere below the fold. |
| | the references can be filtered down to the paper behind a chapter | Filtering narrows the list, and it matches on the role a reference plays as well as on its title, so "Ch. 9" finds the papers behind the memory lesson. |
| | a reference reached from the search dialog lands on the reference | The entry is scrolled into view and marked, rather than leaving the reader at the top of a list that is now thirty-two entries long. |
| | a laboratory question points at the control that tests it | Each diagnostic names the control to change, so the answer can be checked rather than guessed. |
| | clicking a concept shows its definition and the lessons that teach it | The detail panel replaces the "how to read this" help and offers a route into the glossary. |
| | the glossary list links related terms to each other | A related term is a control rather than plain text. |
| | a concept can be taken straight to the demonstration that exercises it | The link navigates to the lesson with the demonstration anchored, and the demonstration is on screen. |
| | the laboratory index links its concepts to the glossary | A concept badge on a laboratory card opens that term in the glossary. |
| Prediction exercises | the explanation stays hidden until the student commits | The explanation region is absent from the page before the commitment, and appears with a verdict and the reasoning afterwards. |
| | a wrong prediction joins the review queue | After a wrong commitment, the review tab shows a count of one. |
| | moving to another lesson clears the previous prediction | **Regression test.** Switching lessons is a hash change, and React used to carry the committed state onto the next lesson. |
| Route transitions | navigating between pages works with the view transition enabled | A navigation lands on the new page with the transition enabled. |
| | moving between two canvas pages does not crash the renderer | **Regression test.** WebKit's renderer crashes when it snapshots a canvas-heavy page while the previous one is still in the top layer, so the transition is skipped for those destinations. |

### 3a. Accessibility audit (axe-core; 25 pages run, 33 declared)

`e2e/accessibility.spec.ts` runs axe-core over every page of the course, tagged
`wcag2a`, `wcag2aa`, `wcag21a` and `wcag21aa`, and fails the build on any violation.

| Page | Result |
| --- | --- |
| Landing | pass |
| Curriculum navigator | pass |
| Source map | pass |
| Study plan | pass |
| Lesson reader | pass |
| Lesson assessment | pass |
| Workflow builder | pass |
| Builder trace | pass |
| Lab A · planning | pass |
| Lab B · memory | pass |
| Lab C · world model | pass |
| Lab D · multi-agent | pass |
| Laboratories index | pass |
| Quiz centre | pass |
| Final project | pass |
| Glossary | pass |
| References | pass |
| Dashboard | pass |
| Demo · attention | pass |
| Demo · curation | pass |
| Demo · context window | pass |
| Demo · tools and escalation | pass |
| Demo · retrieval | pass |
| Demo · behaviour and valence | pass |
| Demo · patching | pass |

Eight pages have been added to that list since the run above, and they are declared rather than
passed: Lab E, Lab E's own-data tab, Lab F, Lab F's write-policy tab, Lab G, Lab H, Lab H's
decomposition tab and Lab H's pipeline tab. Each is audited by the same rule and the same tags; none
has been executed on this machine, so none is claimed as a pass here. They are the pages most worth
auditing, for the reason the demonstrations were: a laboratory screen is a wall of sliders, radio
groups, selects, tabs and live regions, and the four newest ones are the densest in the course.

The audit runs on Chromium only: the rules axe checks are engine-independent, so running it three
times would add minutes without adding signal. The *behavioural* tests above do run on all three
engines.

The demonstration pages were added to the audit when the demonstrations were, because they are the
most interactive content in the course: sliders, radio groups, selects and live regions. It found
two violations the moment they were covered — a scrollable list of rounds in the dilemma
demonstration that could not be scrolled with the keyboard, and ten-point muted text dimmed to 60%
opacity in the context-window demonstration, which fails the contrast requirement. Both are fixed;
the second was fixed by carrying the de-emphasis on the border rather than on the text, since a row
the reader cannot read is worse than a row that is plainly marked as gone.

### What the audit found

The audit was added after a manual review that had declared the site accessible. It immediately
found four violations, all of which were real and are now fixed — see
`docs/ARCHITECTURE.md` §6 for the detail. Two were contrast and label-in-name problems on the
header controls, one was a label-in-name problem on the lesson difficulty toggle, and the
`scrollable-region-focusable` rule caught two scrollable panels that could not be scrolled with the
keyboard.

---

## 4. Known gaps

Honest accounting of what is **not** covered:

- **No visual-regression tests.** The visual design is not asserted; only structure and behaviour
  are. The screenshots in `docs/screenshots/` are captured by `npm run screenshots`, which builds the
  site, serves it and drives it with Playwright — so they are reproducible and cannot silently go
  stale, but they are not compared against anything, so a change to the design is not a failure.
- **The audit cannot judge meaning.** axe checks rules, not comprehension. It cannot tell whether
  an alternative text is *useful*, whether the reading order makes sense, or whether the prose is
  clear. Those remain a manual-review responsibility.
- **The prediction exercises are not validated for difficulty.** Each one is authored against the
  point its lesson makes, and the distractors are plausible, but nothing measures whether a student
  actually finds them hard. That would need real student data.
- **The builder's node-graph editing gestures** (dragging handles to create edges) are not
  covered by browser tests; the engine behaviour they produce is covered by unit tests. The
  two-click **Connect two nodes** path — the alternative that satisfies WCAG 2.5.7 — *is* covered.
- **Storage failure is simulated, not real.** The refused write and the unreadable store are mocks in
  jsdom (§2), so the *handling* is exercised but a browser at its actual quota is not. What the tests
  do prove is that no code path lets a storage exception reach the student — including the theme read,
  which was unguarded until those tests were written.
- **The four deep-dive laboratories are in the interaction audit, but those journeys have never been
  run here.** Lab E, F, G and H now each have a journey (§5), which closes the gap this bullet used
  to describe: the audit used to drive the original pages plus `/#/labs` and `/#/labs/planning` only.
  What remains unproven is the browser execution, which is the next bullet. The *count* of journeys is
  checked by `src/content/docsClaims.test.ts`, so this section cannot quietly fall out of step with
  `scripts/audit.mjs`.
- **The browser suite as it stands has not been executed on this machine.** The additions typecheck;
  Playwright's browsers are not downloaded here, so §1's browser rows are the previous run and §3's
  eight extra audit pages are declared, not passed.

### Flakiness that was found and fixed

Nine sources of flakiness were found and removed rather than papered over:

- **A single test rendered all four lab pages.** Each lab is code-split and draws charts, so on a
  loaded machine the combined test could exceed the default 5-second timeout. The labs are now four
  separate tests (`it.each`), each with its own budget, so a slow render cannot time out the others
  and a failure points at one lab rather than four. The global timeout was also raised, and the
  lazy-import wait in the test was raised to 30 seconds — the assertions are unchanged.
- **jsdom's `scrollTo` throws.** jsdom defines the property but raises "Not implemented" when it is
  called, which the lesson reader does on navigation. The test setup now always replaces it with a
  no-op instead of only doing so when the property is missing, which removed the stray
  `Not implemented: Window's scrollTo() method` output.
- **Two tests sampled state before the app had mounted.** The theme test read the `dark` class
  before React had applied it, and the search test pressed a key before the shortcut listener was
  registered. Both now wait for a visible control first, and the theme test polls rather than
  sampling once. The search helper presses the key more than once, because the shortcut opens
  rather than toggles and a lost keystroke is harmless.
- **A state leak between lessons.** Navigating between lessons is a hash change, so React reconciled
  the new lesson onto the old lesson's component instances and a committed prediction — or the quiz
  answers the student had selected — followed them to the next lesson. The lesson page is now keyed
  by its slug, and there is a browser test for it.
- **A deep link never scrolled.** The handler looked for `section-<anchor>` and `demo-<anchor>`,
  but the anchors in the links are the elements' own ids, which already carry that prefix — so it
  searched for `section-section-synthesis` and `demo-demo-memory` and found nothing. The link
  still changed the URL and the target was still in the document, so the browser test that checked
  it passed: it never checked that the page had *moved*. Chromium masked it, because the browser
  scrolls to a fragment natively; Firefox did not, so the bug only showed up there. The handler now
  accepts either spelling, retries while the lesson body is still rendering, and the browser tests
  assert the position on screen rather than the presence in the DOM.
- **The glossary and the references highlighted a deep-linked entry without scrolling to it.** The
  same shape of bug in two more places: a link that says "here is the term" and leaves the reader
  at the top of a list of ninety-eight. Both now scroll the entry into view, and both have a
  browser test that measures the position on screen.
- **WebKit's renderer crashed on every navigation away from a short page.** A page shorter than the
  window has nothing to scroll, and WebKit dies when a View Transition has to snapshot one. The
  assessment centre's review tab and attempt history are the two shortest pages in the course, so
  leaving either one killed the renderer. The fix is a layout rule — the main area is at least a
  screen tall — and there is a browser test that leaves a short page and checks the renderer is
  still alive. It took a bisection of the route matrix to find: the pages that crashed had no
  canvas in them at all, which ruled out the known canvas-to-canvas cause.
- **The dashboard's action buttons were all named "Go".** Five buttons with the same accessible
  name tell a screen-reader user nothing about where any of them lead. Each now carries the action
  it performs, which is what the audit was looking for when it found it.
- **Importing a file that was not a progress export wiped the student's progress and reported
  success.** The loader is deliberately forgiving — a corrupt payload falls back to a clean state —
  but the importer was using that forgiving loader to *overwrite* the state, and then said "Imported
  0 completed lessons". A file that cannot be read is now recognised as such and refused, and the
  refusal is reported. The difference between "this file holds no progress" and "this file is not a
  progress export" is the difference between restoring an empty course and losing a course.
- **The JSON argument field threw away what the student typed.** The field used
  to derive its text from the parsed configuration, so a half-typed object was
  discarded and the field snapped back to the last valid value. The editor now
  keeps the raw text as the source of truth, reports the parser's message
  instead of swallowing the edit, and remembers the value it last emitted so it
  can tell its own change from a change that came from outside.
- **…and the flake blamed on React was the page taking focus back.** An earlier
  entry here recorded "about one run in four in Firefox the field snapped back
  while the student was typing", and the fix written down was an imperative
  write of the text to the DOM node from a layout effect. That diagnosis was
  wrong, and the code has now been removed. What actually happens: selecting a
  node from the inspector hands focus to the canvas from a
  `requestAnimationFrame`, so on a busy machine it lands *after* the field is
  focused, and the keystrokes that followed went to the canvas. The evidence is
  the failure itself — the field was left **empty**, not stale, so no keystroke
  ever reached it — and the browser test now waits for the canvas to hold the
  focus before typing, after which the run is stable on all three engines.
  Nothing in the unit suite, and nothing in the browser suite, distinguishes
  the imperative write from its absence: React's own controlled-field handling
  keeps the node and the state in step, so the extra effect was guarding a
  scenario that does not occur.
- **The guard that *is* load-bearing had no test.** The `emitted` value — what
  tells the editor's own change from a change that came from outside — survived
  every test written before it was removed and re-added: the existing cases
  never make the incoming value change *and* leave the text alone. Adding a key
  does, and the field must keep the formatting the student typed rather than a
  re-serialisation of the same object. That case is now tested, and it is the
  one test that fails when the guard is taken out.
- **The lint record was wrong, and being wrong hid the one warning that
  mattered.** §6 used to say that every warning was the fast-refresh rule; four
  of them were not. Two were `react(refs)` on the glossary popover, which read
  its CSS anchor name out of a `useRef` during render — and the ref it read was
  initialised from a module-level counter, so every render of every term burned
  a number and a discarded render burned one more. The anchor name now comes
  from the same `useId` that names the panel, which is React's own answer to
  "unique per instance, stable across renders" and is safe to read while
  rendering. One was a character class whose `\-` escape was unnecessary, and
  one was `if (!x || true)` in the test setup — a condition that can only be
  true, in front of a jsdom method that always exists. All four were fixed; the
  setup line was deleted rather than reworded, because the method is always
  replaced in jsdom anyway.

The numbers in §1 are from the runs recorded here: 42 unit files and 484 unit tests, all green in
one `vitest run`; 95 browser tests per engine, 235 passing across Chromium, Firefox and WebKit, with
the accessibility checks running on Chromium only. The browser suite has since grown by one smoke
test and eight audit pages for the four deep-dive laboratories, the interaction audit has grown by a
journey for each of them, and those are counted in §3 and §5 as declared rather than run. The argument-field test is the one place where a flake had been written off
as a product bug; since the page's focus hand-off is waited for rather than retried, it has passed on
all three engines in every run of the suite.

---

## 5. The interaction audit

`npm run audit` is a separate suite with a different question. The browser suite asks *does this
control exist and does this page render*; the audit asks *is the promise this interface makes
actually kept*.

It drives the built site through 33 student journeys and asserts the outcome rather than
the presence of a control. The distinction matters: the deep-link bug that the audit was written to
chase had a button, a URL and an element in the document, and every structural check passed. The
only thing wrong was that the page never moved.

| Promise | Checked by |
| --- | --- |
| A bookmark survives and is findable | Bookmark a lesson, reload the dashboard, look for it |
| The advanced track persists | Switch the track, reload, look for it |
| A ticked objective persists | Tick one, reload, look for it |
| A wrong answer comes back for review | Answer wrongly, open the review queue, count the items due |
| Progress exports and imports | Export, read the file, check the attempts and objectives are in it; then reset and import it again |
| The concept map draws and opens | Count the nodes, click one, check the detail panel replaced the help |
| Search finds and opens | Search, count the results, open one |
| A lab run is recorded | Run a planner, check the badge on the lab index |
| The project workspace persists | Tick a milestone, reload, look for it |
| The next actions lead somewhere | Count them, follow one, check the URL changed |
| The glossary filters by lesson | Filtering leaves terms and never adds any |
| A glossary term routes to its demonstration | Following the route reaches an anchor on the demonstration |
| A corrupt file is refused | The dashboard says the file could not be read, and the progress that was there is still there |
| The mobile drawer opens and navigates | At a phone's width the drawer opens and a route in it works |
| The builder connects two nodes | Two clicks make an edge, and the edge can be given a branch label |
| Definitions open and close | Open one, check it appeared; press Escape, check it went |
| A definition leads to the glossary | Follow the route out of a definition |
| Completing a lesson is counted | Complete one, check the dashboard's count moved |
| The builder runs | Step the workflow, check the trace has an item in it |
| A search result lands on the section it names | Search for a concept, follow a section result, check the page moved to it |
| The source map covers every chapter | Switch to the source map and count the chapters |
| The theme survives a reload | Change the theme, reload, compare the class on the root element |
| A concept map concept leads to its lesson | Open a concept and follow its route |
| The mixed challenge set is a real set | Open it and count the question groups |
| The project reports what the course can show | Open the project and look for the readiness report |
| Lab F's curve follows its horizon | Open Lab F, read the tick the curve is scored at, move the horizon slider, look for the new tick |
| Lab E's loop has one row per generation | Switch the transfer family, open the own-data tab, add a generation, count the rows |
| Lab G recomputes its depth battery | Open Lab G, move the chain-length slider, check the length shown and the policy it names |
| Lab H turns answers into abstentions | Open Lab H, set the rewrite budget to zero, count the abstentions before and after, then open the decomposition tab |

The audit is not part of `npm run verify`, because it needs a build and a browser. It is one
command, it prints the promises as it checks them, and it exits non-zero when one is not kept.

The last four rows are new. Their selectors are the ones the screen tests already use, so the
accessible names they rely on are proved to exist in the rendered DOM; the journeys themselves have
not been executed here, for the same reason as the rest of the browser suite — no Playwright download
in this environment. `src/content/docsClaims.test.ts` is what keeps the two counts in this section
from drifting away from `scripts/audit.mjs`.

---

## 6. Lint output

```
Found 3 warnings and 0 errors.
```

All three are `react(only-export-components)`, which fires on the three files that export a
component *and* something that is not a component: `cn` in `src/ui/primitives.tsx`, `useTheme`
alongside `ThemeProvider` in `src/store/theme.tsx`, and `useProgress` alongside `ProgressProvider`
in `src/store/progress.tsx`. It affects hot-module-replacement ergonomics in
development, not correctness. The progress store was split in
two to reduce them: the schema — the types, the reducer, the migrations and the defensive loader —
now lives in `src/store/progressState.ts`, which is pure and can be tested without a component tree,
and `src/store/progress.tsx` holds only the React binding.

The list used to say "all eight are `react(only-export-components)`", which was not true and hid
three warnings that were: two `react(refs)` ("cannot access refs during render") on the glossary
popover's anchor name, one `eslint(no-useless-escape)` in the glossary matcher, and one
`eslint(no-constant-condition)` behind an `|| true` that made the condition meaningless. All four
are fixed rather than suppressed — see §4 — and the remaining three are the fast-refresh warning
above, which is a development-convenience rule.

The rules that were escalated to errors during this work, because they caught real problems:

- `react/purity` — caught `Date.now()` in the builder's node-id generator, which made node ids
  non-reproducible. Replaced with a monotonic counter.
- `react/set-state-in-effect` — caught the deep-link handler and the mobile menu, both of which
  pushed state during the commit phase. Both now derive their state during render.
- `react-hooks/exhaustive-deps` — caught the `slipSeed` hack in the planning lab, which existed
  only to force a re-render of a fully deterministic simulation. Replaced with a real slip
  probability and seed.

---

## 7. Reproducing

```bash
git clone <repo>
cd agentic-ai-academy
npm install
npx playwright install chromium firefox webkit   # once, for the browser tests
npm run verify
```

`npm run e2e` starts `vite preview` on port 4318 itself (bound explicitly to `127.0.0.1`, because on
Windows `localhost` resolves to IPv6 first and an IPv4-only client cannot reach a server bound to
`localhost`). If a server is already running on that port, Playwright reuses it.

`npm run audit` and `npm run screenshots` build the site and serve it on their own ports, and
start and stop the server themselves.

To run a single engine:

```bash
npx playwright test --project=chromium
npx playwright test --project=firefox
npx playwright test --project=webkit
```
