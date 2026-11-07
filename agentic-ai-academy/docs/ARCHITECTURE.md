# Architecture

This document explains how Agentic AI Academy is put together and, more importantly, *why* it is
put together that way.

---

## 1. Design constraints

Four constraints shaped every decision.

**Local-first, always.** There is no account, no backend and no hosted database. All student state
lives in `localStorage` under versioned keys. This removes an entire class of failure (auth, API
keys, quotas) and makes the project deployable as a static bundle.

**No inference at runtime.** The course must work with no API key and no network. Every
"agent" in the course is a *deterministic simulator*: a scripted computation with a seeded PRNG
where randomness is needed. The site says so explicitly in the footer, in the labs' own copy, and
in the references page, because a student must never mistake a simulation for a deployed model.

**Determinism.** A deterministic simulator can be *asserted on*. The unit tests say things like
"with capacity 4 and relevance weight 0.8, the decisive memory item is retrieved" — that is a real
claim about a real artifact. A stochastic demo could only be described, never tested. This is the
same discipline the textbook demands of agent evaluation in Ch. 15 and Ch. 23, applied to the
teaching instruments themselves.

**No arbitrary code execution.** Nothing in the app evaluates user-supplied code. The workflow
builder's "tool call" node dispatches to a fixed catalogue of scripted tools declared by the
scenario; it does not shell out.

---

## 2. Layers

```
┌──────────────────────────────────────────────────────────────┐
│  pages/         Route-level composition                       │
│  ui/            Presentational primitives and components      │
├──────────────────────────────────────────────────────────────┤
│  content/       The course: book map, lessons, tracks,        │
│                 glossary, references, project, search index   │
├──────────────────────────────────────────────────────────────┤
│  engine/        Pure simulators. No React, no DOM, no clock.  │
├──────────────────────────────────────────────────────────────┤
│  store/         React context + reducer over localStorage    │
├──────────────────────────────────────────────────────────────┤
│  app/           Hash router                                  │
└──────────────────────────────────────────────────────────────┘
```

The rule that keeps this honest: **the engine layer never imports from `ui/` or `pages/`, and the
content layer never imports from the engine.** The dependency arrow points one way, from the screen
down to the computation.

### What the reader downloads

A student opening a lesson should not pay for the graph editor or the formula library. Two
libraries that used to be in the initial bundle are now fetched when they are needed:

- **KaTeX** (~260 kB) is loaded by the first formula that appears, together with its stylesheet.
  Nineteen formulas in the course use it, and the space a display formula occupies is reserved
  while it loads, so the prose does not jump.
- **React Flow** (~170 kB) is loaded when the concept map is opened. It draws the graph on one tab
  of one page, and no reading page needs it.
- **The pages themselves.** The glossary alone is a quarter of a megabyte — 120
  definitions, their relations and the concept graph — and a student who opens the landing page
  does not need it. Every page is now loaded on demand, behind one Suspense boundary so that the
  fallback is the same wherever the student clicked.
- **The search index.** It covers every lesson, section, glossary term, question, laboratory and
  reference, and building it means reading all of it. That is worth doing when someone searches
  and not worth doing for a student who opens the course and starts reading, so the module is
  fetched the first time the dialog opens. Its labels live in their own module, because a static
  import of them would have pulled the whole index back in and quietly defeated the point.

The initial bundle went from 1,159 kB to 445 kB — 354 kB to 134 kB gzipped — which is the
difference between a course that appears and a course that waits. The build's chunk-size warning
is a rough guide rather than a target, but a reader on a slow connection is the real target.

Loading a page on demand has one consequence worth naming: a deep link can name an element that
does not exist yet, because the route is parsed before the page's chunk arrives. The deep-link
handler therefore **watches for the element** rather than looking once and giving up, which is the
difference between a link that works and one that works only on a fast machine.

### `content/` — the course is data

Curriculum content is typed data, not markup embedded in components. `types/curriculum.ts` defines
`LessonContent`, `LessonSection`, `LessonBlock`, `QuizQuestion`, `SourceRef` and `GlossaryTerm`.

`LessonBlock` is a discriminated union of `prose | list | formula | diagram | code | callout |
table | example | checkpoint | lab-link`. The lesson reader switches on `kind`; adding a new kind of
material is a type change plus one renderer, not a change to twelve lesson files.

The `diagram` block names a diagram by id (`DiagramId`). The diagrams in `ui/diagrams.tsx` are
original inline SVG written for this course — none are traced from the textbook's PDF.

One content file is generated rather than written here. `src/content/collection.generated.ts` is
written by `tools/readCollection.mjs` from the collection's own catalogue: which course builds on
this one and why, and which ideas this course shares with another course. `npm run build` runs the
script before bundling, so the landing page's collection panel cannot describe a collection that
has changed since it was last copied by hand. Without the collection on disk the script warns and
the committed copy is used, so a standalone clone still builds.

### `engine/` — pure simulation

| Module | Responsibility |
| --- | --- |
| `engine/workflow.ts` | The builder's execution engine: graph validation, node executors, stepping, branching, scoring, halting |
| `engine/scenarios.ts` | The four builder scenarios: goals, plans, reasoning scripts, tool catalogues, observations, success criteria |
| `engine/labs/planning.ts` | Grid world and the four planners |
| `engine/labs/memory.ts` | Memory store, write/evict/retrieve policies, scratchpad |
| `engine/labs/worldModel.ts` | Q-learning, learned transition model, value iteration, divergence measurement |
| `engine/labs/multiAgent.ts` | Role-based team simulation with handoffs and coordination failures |
| `engine/prng.ts` | Seeded PRNG (mulberry32) so a run is reproducible from its seed |

Every engine function is `(inputs) => outputs`. The builder's step function is
`(state, graph, scenario) => state`, with immutability enforced by copying the context before
mutation.

### `store/` — state and persistence

`store/progressState.ts` is the progress **schema**: the types, the reducer, the migrations and the
defensive loader. It is pure — no React, no context — because the schema is the part of the course
most likely to change and the part a student would least like to lose. `store/progress.tsx` is the
React binding: a context that mirrors the state to `localStorage` and exposes the actions.

That split is not tidiness for its own sake. It means the migrations that carry an old payload
forward can be reasoned about and tested without a component tree, and it keeps the provider file
exporting nothing but components.

**The schema version travels in the payload, not in the storage key.** The key used to be
`agentic-ai-academy/progress/v1`, which meant that any change to the schema would have orphaned a
student's progress: the new key would be empty and the old one ignored. The key is now stable, the
version is a field in the payload, and `migrateProgress` upgrades a payload from any earlier
version. The one key written by the earlier release is still read — once, when the current key is
empty — and then written forward.

`parseProgress` is deliberately defensive: it validates every field and drops anything
unrecognised, including quiz attempts for questions that no longer exist and difficulty overrides
naming a lesson or a track that does not exist. A corrupt or future-versioned payload degrades to a
clean state instead of crashing the app. A payload from a *newer* version is normalised field by
field rather than rejected, because losing a student's history because they opened an older build
would be worse than ignoring a field.

`store/project.ts` does the same for the final-project workspace, and adds `deriveReadiness` — a
pure function that reports which rubric criteria the student's *own recorded activity* already
evidences. It awards no points of its own; the student self-assesses, and the report only tells
them what the course can already show.

### `app/router.tsx` — a dependency-free hash router

Hash routing keeps the build deployable to any static host without server rewrites, and it makes
navigation testable in jsdom by setting `window.location.hash` directly.

The router parses three things out of a hash: the path, the query string, and an in-page anchor.
The anchor has to be split off *before* the path is parsed, otherwise `#/lesson/foo#section`
would be read as a lesson slug of `foo#section`. `Route.anchor` is used by the lesson reader to
scroll to and highlight a section, and by course search to deep-link into a specific section.

The anchor is the *element's own id* — `section-memory`, `demo-tool-selection` — because that is
the id the browser, the lesson outline and the search index all use. The lesson reader accepts
either spelling, because the two have existed in the wild and a deep link that silently does
nothing is worse than one that costs an extra lookup. It also retries while the lesson body is
still rendering, and it takes the scroll position into its own hands: the browser restores the
scroll position on load, and it does that *after* the application has scrolled, which is why a
link to a section used to work in Chromium and do nothing in Firefox.

---

## 3. The workflow engine

This is the flagship, so it is worth describing precisely.

### State

```ts
ExecutionState {
  status: 'idle' | 'running' | 'paused' | 'done' | 'halted' | 'error'
  stepIndex: number
  currentNodeId: string | null
  context: ExecutionContext   // goal, plan, reasoning, observations, memory,
                               // toolCalls, retrieval, critiques, retries, errors,
                               // finalAnswer, decision, successScore, nodeVisits
  trace: StepRecord[]
  haltReason: string | null
}
```

### Execution

`stepOnce(state, graph, scenario)` executes exactly one node and returns the next state. It is
pure and deterministic: identical inputs always produce an identical trace and an identical score.

1. Look up the current node. If it is missing, halt with a reason.
2. If the step budget is exhausted and the node is not the final response, halt.
3. Copy the context, run the node's executor against the *old* state, apply the mutation to the
   copy, and record the visit count.
4. Record a `StepRecord` with a status (`ok` / `warn` / `error`), a summary, a detail string and,
   for branch nodes, the branch taken.
5. If the node halted, return an error state with a reason.
6. If the node is the final response, the run is done.
7. Otherwise, pick the outgoing edge matching the branch label (falling back to an unlabelled
   edge), and advance to its target.

### Branching

Decision and evaluator nodes compute a metric (`success-score`, `error-count`, `step-count`) and
emit a branch (`yes`/`no`, `pass`/`fail`). Edges carry a `branch` label; `pickEdge` prefers an
exact label match and falls back to an unlabelled edge, so a partially-labelled graph still runs
instead of dead-ending.

### Scoring

`scoreRun` counts how many of the scenario's success criteria are satisfied, minus a penalty for
recorded errors and for exceeding the step budget. Criteria are declarative: "tool `search` must
succeed", "an observation from channel `env` must exist", "the final answer must contain
`Amsterdam`". The response node scores itself with the prospective answer in place, so a criterion
that inspects the final answer is evaluated after the answer exists.

### Error states

Errors are typed and visible, never silent. The engine halts with a reason for: an empty or
invalid graph, a missing node, an exhausted step budget, an unknown tool, a broken tool, a dead
end, a branch with no matching edge, an exhausted reflection budget, and the safety guard that
catches a non-terminating workflow.

The *broken pipeline* scenario exists specifically so students can see all of these.

---

## 4. The eight laboratories

Each lab is a pure engine module plus a thin page that renders the engine's output. The pages hold
only the parameter state; every number on screen comes from the engine.

| Lab | Engine contract |
| --- | --- |
| Planning | `runPlanning(strategy, world)` → steps, failures, replans, goal reached. The world is fixed; the *strategy* is the variable. |
| Memory | `runMemory(config)` → store contents, eviction log, retrieval with per-item scores, scratchpad, decision correctness. |
| World Model | `runWorldModel(config)` → model-free reward, model-based reward, learning curve, per-state prediction/actual divergence. |
| Multi-Agent | `runMultiAgent(config)` → transcript, handoff table, message log, subtask statuses, coordination failures. |
| Robot Policies | `runPriorTransferLab(config)` and `runSelfGeneratedLoop(config)` (`engine/labs/policyPriors.ts`) → interactions to threshold per transfer family; per-generation model error and coverage scored against a fixed probe of the real dynamics. |
| Memory Durability | `runLongevityLab(config)`, `compareDurabilityLayers(config)`, `sweepRehearsalIntervals(config)` and `runWritePolicyLab(config)` (`engine/labs/memoryLongevity.ts`) → retention per tick, required facts held, cause of each loss, and a tabular REINFORCE write policy scored against the hand-written rule. |
| Reasoning Depth | `runDepthBattery(config)` over `engine/demos/reasoningDepth.ts` → per-family accuracy and tokens at each chain length, the crossover, and the three interaction styles. `runFrontierAudit(config)` over `engine/demos/frontierAccount.ts` → a rule-based stand-in scored against this course's own question bank, beside a reported column that refuses any cell containing a digit. |
| Agentic Retrieval | `runAdaptiveRetrieval(config)`, `runQuestionDecomposition(config)` and `comparePipelines(config)` over `engine/demos/agenticRetrieval.ts` → both retrieval policies over the same six critique cases, per-hop queries with margins and propagation, and the four pipeline shapes over one case set and one budget model. It shares its corpus and its attention curve with the retrieval demonstration through `engine/demos/retrieval.ts`, so the lesson and the laboratory cannot disagree. |

The memory lab is the clearest illustration of the design rule: capacity, top-k, relevance weight
and retrieval strategy are all knobs, and the *interaction* between them is the lesson. The
optimum is interior — more capacity keeps more noise — which is the memory analogue of the
compute-optimal frontier in Ch. 4.

The world-model lab reproduces the three regimes the textbook describes: accurate model → planning
wins on sample efficiency; inaccurate model → planning can lose; badly wrong model → planning is
actively unsafe, because the planner is optimal with respect to a model that is not the world.

---

## 5. The learning loop

Six mechanisms support the loop the course is built around: *read → try it → check yourself → find
out what you got wrong → come back to it*. They share one design rule: **they are derived from the
student's own activity, not stored separately.** Nothing needs to be kept in sync, because nothing is
duplicated.

### 5.1 Interactive demonstrations in the lessons

A lesson is where a concept is introduced; a laboratory is where it is compared against
alternatives. Both are needed, and the risk is that they drift apart — the lesson shows one
behaviour and the laboratory another.

The demos avoid that by being **projections of the same engine** the laboratory uses:

| Demonstration | Engine |
| --- | --- |
| Memory | `engine/labs/memory.ts` — the same `runMemoryLab` as Lab B |
| Planning | `engine/labs/planning.ts` — the same `runPlanning` as Lab A |
| Tool selection | `engine/demos/toolSelection.ts` — its own engine |
| Social dilemma | `engine/demos/dilemma.ts` — its own engine |
| Context window | `engine/demos/contextWindow.ts` — its own engine |
| Retrieval | `engine/demos/retrieval.ts` — its own engine |
| Curation | `engine/demos/curation.ts` — its own engine |
| Attention | `engine/demos/attention.ts` — its own engine |
| Patching | `engine/demos/patching.ts` — its own engine |
| Escalation | `engine/demos/escalation.ts` — its own engine |
| Valence | `engine/demos/valence.ts` — its own engine |

The nine new engines exist because nine of the book's concepts had no simulation at all, and a
concept with no simulation is a concept the student can only read about:

- **Tool selection** (Ch. 11) is a *decision*, and the chapter's three claims — discriminability,
  arity clarity, failure signalling — are all things the student can get wrong. The catalogue
  deliberately contains pairs of near-identical tools (`book_seat` / `book_seat_legacy`,
  `is_prime` / `is_prime_approx`), because choosing between them is not a matter of remembering
  which is which; it is a matter of reading the descriptions, which is the point.
- **The social dilemma** (Ch. 15) is used in the book precisely because its equilibrium is known,
  so behaviour can be scored against a formal prediction. The engine computes that line by backward
  induction, which also makes the finite-horizon effect explicit: *always cooperate* is not optimal
  in a game that ends, because in the final round there is no future left to protect.
- **The context window** (§6.2.2, §9.3.2.2–9.3.2.3) is a *budget*, and the interesting question is
  not whether it is finite — the book says so outright — but what each way of spending it costs.
  The engine implements the four policies the book names: truncating the history, retrieving what is
  relevant, compressing the prompt, and paging the overflow out to an external store. It models the
  lossy case explicitly: a compressed form records whether the decisive detail survived, so the
  demonstration can show a prompt that looks complete and answers wrongly because the number is not
  in the summary any more. That is the failure that is hardest to notice in production, and it
  cannot be noticed at all without a simulation.
  The fifth policy is the one §9.3.2.2 gestures at when it names compression as the remedy: let a
  trained scorer decide what the material is worth. That scorer is actually trained here — a
  logistic regression over five signals a harness could compute at run time (goal vocabulary,
  question terms, recency, token share, whether the item has a short form), fitted by full-batch
  gradient descent on the *other* windows and then asked to rank the one it is shown, so the answer
  key of the window being compressed never enters its weights. The weights, the recorded loss
  curve and the ranking agreement are all printed, and the item that decides this window's answer is
  not among the inputs. What the fit learns is "older material matters", which is the opposite of
  the truncation rule; it earns the demo its result on the first two windows and loses the third —
  the headline figure is ranked third, shortened, and the number goes out of the abstract. The
  caveat the paper states for itself, reproduced by a learner rather than written into a script.
- **Retrieval** (Ch. 12, §12.2–12.4) is the other half of the window's budget. The chapter measures
  Recall@k and MRR, which are computed over the *retrieved* set; the window then decides whether the
  model uses what was retrieved. The engine makes the two separable: a passage can be missed
  altogether, or retrieved and placed where the model attends least, and the second case is the one
  a retrieval metric cannot see. It draws on Liu et al.'s measured U-shaped curve, and it shows
  that the three ways of choosing passages — similarity, a cross-encoder reranker, and a
  diversity-first selection — each fail differently.
- **Curation** (Ch. 3, §3.2.1) is a list of filters, and the interesting part is that the two
  requirements pull against each other. De-duplication is "essential to prevent the model from
  memorizing redundant information", and the same section warns that filters "can inadvertently
  flag and suppress legitimate data written in specific dialects". The engine models a two-knob
  filter over a small corpus and shows both failure modes: a permissive duplicate threshold leaves
  near-identical documents for the model to memorise, and a strict quality threshold removes
  legitimate writing because it scores low. It also reports the source mix before and after, because
  a corpus that has been filtered hard is a corpus that has been made narrower, and the model
  inherits that narrowing as though it were the world.
- **Attention** (Ch. 2, §2.3.4) is the mechanism the retrieval demonstration abstracts over, so it is
  the one that should come first. The engine computes the two steps the chapter describes — a dot
  product against every input, then a softmax so the weights sum to one — and the weighted sum that
  gives the context vector. It is a toy: one head, four dimensions, hand-written vectors. What it is
  faithful to is the *mechanism*, and with it the two failure modes that matter downstream: a query
  that names the subject rather than the answer, and a distribution too flat to be a lookup at all.
  A flat softmax over six passages is not "the model considered all six"; it is a context vector that
  is their average, with the right answer contributing a minority share.
- **Patching** (Ch. 21, §21.4–21.7) is the difference between knowing and doing, made
  computational. The chapter distinguishes three kinds of evidence, and the engine puts them side
  by side on a toy network: a **probe** finds a weak correlation with the prompt at *every* layer, a
  **logit lens** shows the decision forming from one layer onwards, and **activation patching**
  transfers the behaviour from the decision layer onwards — and from nowhere earlier. The last point
  is the one that surprises people: localisation is to the *earliest* layer that carries the
  information, not to one exclusive layer, because the information is still there later.

  The demonstration makes the classic mistake available to make. Set the probe threshold low and
  the concept appears to be encoded everywhere; that is what a correlational result looks like, and
  it does not localise anything.
- **Escalation** (Ch. 13, §13.1–13.9) is the difference between a tool and an assistant, and the
  chapter's advice is unusually concrete: defer to humans under uncertainty, and design for
  graceful degradation, because "an agent asking for clarification or abstaining is preferable to
  confident error". The engine scores three policies over the same requests in three domains, and
  the result is that the right policy is not a property of the agent but of the domain: acting on
  everything is merely reckless in a shop and dangerous in a clinic, while a policy that asks about
  everything is safe *and useless*.

  The engine reports safety and usefulness as two separate axes for that reason. A single cost
  number ranks a policy that refuses everything as the best, which is exactly the mistake the
  demonstration is about — and it is a mistake the first version of the engine made too, until the
  costs were replaced by the two counts.
- **Valence** (Ch. 18, §18.2–18.3) is the case study that turns a design claim into an
  experiment. The Generative Agents memory system is *valence-blind* — a criticism and a compliment
  are encoded and retrieved with equal weight — and Chapter 18 runs the same scenario with a
  valence-sensitive variant in which negative memories count for more. The engine models the
  retrieval function faithfully: the same day of events, scored under two architectures, and the
  agent concludes different things about it.

  The demonstration is deliberately small — one decisive memory, two architectures — because the
  point is not the psychology. It is that **nobody chose the conclusion**. The architecture
  chose it, and the chapter's warning is that agent personas are fragile in the same way: a single
  word in a personality description can change how an agent acts, plans and reflects.

The dilemma engine also corrected a mistake worth recording. The first implementation represented
the payoffs as two vectors, one per player, which cannot express that the payoffs depend on *both*
moves — and without that, defection is not dominant and the chapter's central claim does not hold.
The engine now uses a full payoff matrix, and a test asserts that defection dominates.

### 5.2 The concept map (`content/conceptGraph.ts`, `ui/glossary/ConceptMap.tsx`)
The glossary is a list, but the textbook is about *relations*: a harness enables a ReAct loop; a
ReAct loop needs memory; a world model is what makes a model-based planner possible. Those
relations are already recorded in the glossary's `related` arrays, but a list cannot show them.

The concept map turns them into a graph:

- nodes are glossary terms, coloured by the part of the book they belong to (inferred from the
  lessons that use them);
- edges are the `related` relations, made symmetric and deduplicated;
- the layout is a **deterministic** force-directed relaxation — repulsion, attraction along the
  relations, and a pull towards the centre, with a cooling schedule. It is computed rather than
  random, so the map is identical on every visit and the layout can be asserted on in tests.

Rendering it in React Flow took three attempts, and the reasons are worth recording because they
are not obvious from the symptom (the edges simply did not appear):

1. **The node needs handles.** React Flow only draws an edge whose two ends attach to handles that
   exist. A node with no `<Handle>` renders its relations nowhere. Each node therefore gets one
   handle per neighbour, placed on its rim at the angle towards that neighbour, so the relations
   radiate outwards instead of all leaving from one point.
2. **The handle's type has to match its role.** A handle typed `source` cannot receive an edge. The
   handles are named `s-<neighbour>` and `t-<neighbour>` precisely so the type can be derived from
   the id.
3. **The edge geometry is delivered through `onEdgesChange`.** React Flow recomputes an edge's
   geometry once the nodes have been measured and delivers that through the change handler; with
   no handler, the updates are discarded. The map therefore uses `useNodesState` and
   `useEdgesState` rather than plain `useMemo` arrays.

### 5.3 Prediction exercises (`ui/lesson/PredictBlock.tsx`)

Every lesson ends with a question the student must commit to before the explanation appears.

The learning reason is specific: retrieving a fact is easy, and recognising that you did not know it
is what makes the fact retrievable later. A question that a student is sure they would have got
wrong does not teach them anything; a question they *commit* to and then find they were wrong about
does.

The block is deliberately not a quiz. Three things differ:

- The explanation is **not in the DOM** until the student commits, so it cannot be read by accident
  or by a screen reader running ahead.
- The options are a `radiogroup`, so the arrow keys work and the group is announced as one.
- A wrong prediction is recorded as an ordinary attempt against an ordinary question id, so it
  flows into the review queue with no special-casing. The prediction questions are therefore
  registered in `ALL_QUESTIONS` alongside the quiz questions, and they carry the same page
  reference derived from the chapter table.

Implementing this surfaced a bug worth recording. Navigating between lessons is a *hash change*, so
React reconciled the new lesson onto the previous lesson's component instances: a prediction the
student had already committed to, and the quiz answers they had already selected, followed them to
the next lesson. The fix is to key the lesson page by its slug, so switching lessons remounts it.

### 5.4 Inline definitions (`content/glossaryIndex.ts`, `ui/glossary/GlossaryLink.tsx`)

The glossary is indexed once, at module load, into a map from *spelling* to *term*. Spellings are
not just the term itself:

- "Retrieval-augmented generation (RAG)" also registers "Retrieval-augmented generation" and "RAG".
- A parenthetical is only treated as an abbreviation when it really looks like one — `/^[A-Z][A-Za-z0-9-]*$/`
  — so "Environment (in RL)" does not silently become the bare word "environment".
- "Superposition / polysemanticity" registers both halves.

Matching is on whole words, case-insensitively, and a term's internal spaces also match hyphens, so
"chain-of-thought" links to the same entry as "chain of thought". Both sides of the lookup are
normalised the same way; the first version normalised only the pattern, and hyphenated mentions
silently failed to resolve.

The renderer links the **first occurrence of each term per paragraph**. Linking every mention would
turn a paragraph into a rash of underlines; linking none would make the glossary unreachable from the
text that needs it.

The definition itself is a **native popover**, rendered in a **portal** at the end of the document.
Both choices were forced by real bugs:

- **The portal.** The definition appears inside a paragraph of the lesson prose. A panel that stays
  in that paragraph is part of the paragraph's text, so copying a passage copies the definition into
  the middle of the sentence, and anything that reads text — a test, a reader, a DOM search — sees
  the definition spliced into the prose. It was also clipped by any ancestor with `overflow`, which
  matters because the lesson tables scroll horizontally. In the top layer it is none of those things.
- **The popover.** It gives light dismiss, a correct focus order, and `position-area` with
  `position-try-fallbacks`, so the browser places the panel beside the term and flips it when it
  would overflow — with no JavaScript measuring involved. Browsers without the API fall back to a
  fixed panel positioned from the term's bounding box.
- **The explicit hidden state.** WebKit implements the popover *API* but left a closed panel
  visible, which injected the definition into the surrounding sentence. Relying on the user-agent
  sheet to hide a closed popover is not safe, so the hidden state is stated in the site's own CSS.

### 5.5 The review queue (`content/review.ts`, `content/spacing.ts`)

A question is *due* when the student's most recent attempt at it was wrong. It leaves the queue when
they answer it correctly. Within the queue, the longest-missed question comes first.

That is the whole rule, and it is stated to the student in the UI, because a queue that feels
arbitrary is worse than no queue. Because the rule is derived from the attempt log, the queue
updates itself as the student works: answering a question correctly during practice visibly empties
it.

`buildReviewQueue(state, now)` takes the clock as a parameter so the ordering can be asserted in
tests without depending on the wall clock.

### 5.6 Spacing (`content/spacing.ts`)

The rule above gives *retrieval practice* but not *spacing*, and the learning literature is clear
that the two are separate effects: reviewing material just before it is forgotten is far less
effective than reviewing it at expanding intervals, because each successful retrieval has to be
re-consolidated (Ebbinghaus 1885; Cepeda et al. 2006; Carpenter, Pan & Butler 2022, *Nature Reviews
Psychology*). The same work reports that learners systematically under-use both strategies, because
scheduling feels like an optimisation to be done later rather than part of learning itself — which
is the reason the schedule is stated on the page rather than hidden behind a button.

So the queue uses the **Leitner system** (Leitner 1970). Every item sits in a box, and the box
determines how long it waits:

| Box | Interval | Meaning |
| --- | --- | --- |
| 0 | due immediately | the last answer was wrong |
| 1 | 1 day | answered correctly once |
| 2 | 3 days | answered correctly twice |
| 3 | 7 days | |
| 4 | 14 days | |
| 5 | 30 days | well known |

A wrong answer drops the item to box 0, so it comes back now. A correct answer promotes it a box,
so it waits longer. The interface also shows the questions that are *scheduled* to come back, so
the spacing is visible rather than mysterious.

The intervals are a heuristic, not an optimum — optimal schedules are known (Reddy et al. 2016;
Tabibian et al. 2019) but need a per-learner memory model and a great deal of interaction history,
which this course does not have. What matters for the student is the shape: material that is well
known comes back rarely, and material that is not comes back soon.

### 5.7 Lesson mastery (`content/review.ts`)

A lesson is mastered when every learning objective is ticked **and** every *core* question has been
answered correctly at least once. The advanced-track questions are deliberately not required: they
are optional deepening, and requiring them would make mastery depend on a choice the student never
had to make.

### 5.8 Retention (`content/retention.ts`)

The review queue answers *"what do I need to do now?"*. The retention summary answers a different
and more motivating question: *"how much of this have I actually learned?"* — and the Leitner boxes
are the most direct evidence the schedule produces, because they show a concept climbing out of
the "needs work" box over successive reviews.

A question is **retained** when it has been answered correctly and is not yet due. It is **due** when
its box says so. It is **fragile** when it was answered correctly once and is already due again.
That last category is the useful one: it is the material the student got right once and has not
revisited since, and most systems hide it. Questions never attempted are excluded from the rate,
because they are not evidence of forgetting.

### 5.9 Next actions (`content/guidance.ts`)

The dashboard turns the activity into an ordered list of concrete next actions. The rules are few
and ordered by how much they unblock:

1. Something is due for review — review it now.
2. A lesson is half-done — finish it.
3. A lesson is complete but its objectives are unticked — tick them.
4. A lesson is complete but never assessed — take its questions.
5. A lab that has never been run is available.
6. Otherwise — the next unread lesson.

At most two entries of each kind are kept. Without that cap a student with twelve unread lessons
sees twelve identical "read the next lesson" entries and never learns that there are laboratories
to run.

---

### 5.10 The lesson outline (`ui/lesson/LessonOutline.tsx`)

A lesson is five or six sections long, and without an outline there is no way to jump between them
except by scrolling. The outline lists the sections, marks the one currently in view, and doubles
as a reading-progress indicator.

The section in view is tracked with an `IntersectionObserver` rather than a scroll handler, so it
costs nothing per frame, and the component degrades to a plain list where the observer is not
available. The observer is also stubbed in the jsdom test setup, so the component is exercised in
the unit tests rather than skipped.

The reason for building it is the book's own subject. Chapter 15 keeps returning to the
knowing-doing gap, and one part of that gap is not knowing what you do not know: an outline makes
the shape of a lesson visible before the student starts it.

### 5.11 Further reading

The textbook is a survey, and a survey points at the papers it is summarising. Every lesson now
names them, in a **Further reading** panel on the lesson's *Sources & provenance* tab, with a link
and a sentence on why that particular paper is worth the reader's time. A student who wants to go
past the course has a route rather than a dead end.

Two things make it trustworthy rather than decorative. The references are the ones already on the
References page — nothing is linked that has not already been audited for its licence — and the
reference is *resolved* rather than copied, so a link and its licence note cannot disagree. The
panel is generated from a `furtherReading` field on the lesson, and the build fails if an entry
names a reference that does not exist or gives no reason for being there.

Every arXiv identifier in those lists was checked against the arXiv record during October 2026,
and each is the identifier the textbook's own bibliography prints for that paper.

### 5.12 The course on one page
The closing lesson had the book's status, an evaluation discipline and a list of responsibilities,
but no synthesis — a student who finished it had seen twelve lessons and had no way to hold them
together. The lesson now carries the book's own three pillars (reasoning, acting, interacting),
the cycle that connects them, the limit that shows up in each, and the eight ideas that recur
across the book with a route back to the chapter that states each one.

Two questions were added to make it assessable rather than decorative: one on the cycle, and one
asking why "the model was not good enough" is not a diagnosis. The second is the one worth the
trouble — it is the sentence a team says when it has not finished attributing the failure, and the
whole course is a list of the places that attribution usually lands.

### 5.13 The study plan (`content/studyPlan.ts`)

The course is nine hours of reading, eight laboratories and a builder. That is a fact about the
content, and it is not a plan: a student with three hours a week and a student with nine hours a
week need different evenings, and both need to know what to do *in* one.

The plan is **derived** rather than written, from three things the content already knows: the order
of the lessons, which already respects the prerequisites; the estimated minutes of each; and the
laboratories, paired with the lesson whose mechanism they exercise. It is a pure function of the
content and the hours available, so it cannot drift away from the curriculum and it can be asserted
in tests rather than trusted.

Two details are worth recording because the first version got them wrong:

- The **week's outcome** follows the *content*, not the week number. A fast plan has fewer weeks,
  and its last week covers very different lessons; an outcome keyed to the week number would have
  described the wrong material. Each lesson has its own outcome, and a week ends with whatever its
  last lesson achieves.
- A week may **overflow** its budget when it holds a single lesson longer than the week itself.
  Splitting a lesson across weeks would be worse than a long one, so the plan allows it, and a test
  asserts that this is the only way it can happen.

The plan is a third tab on the curriculum page, and the tab is deep-linkable, so the dashboard's
"see the whole course as a plan" action can open it directly.

## 6. Search

`content/searchIndex.ts` builds a static index over every lesson, lesson section (core *and*
advanced), glossary term, assessment question, lab and reference. `searchCourse(query, limit)` is a
pure function that scores entries and returns them ranked.

Matching is on **whole tokens**, not raw substrings. An earlier implementation used `includes`,
which matched "language" inside "vision-language-action" and put a VLA question above the language
modelling lesson for the query *"Foundations of Language Modeling"*. Tokenised matching fixed the
ranking; the regression is now covered by a unit test.

The index is built once at module load and reused. There is no fuzzy-matching library, no
embedding service and no network call.

### The interaction audit

`npm run audit` asks a different question from the browser suite. The suite asks whether controls
exist and pages render; the audit asks whether the *promises the interface makes are kept*. It
drives the built site through 33 student journeys and asserts the outcome rather than the
presence of a control.

The distinction is not academic. The deep-link bug had a button, a URL and an element in the
document; every structural check passed, and only the page failing to move gave it away. The audit
is written so that a promise is stated as a promise — *a bookmark is saved* means the bookmark is
there after a reload, *a wrong answer comes back for review* means it is in the review queue — and
checked by looking for the thing a student would look for.

It found six real defects - the deep link, the unnamed action buttons, the next actions
that landed on the wrong tab, a WebKit crash on leaving a short page, and an import that wiped
the progress - and confirmed the rest of the journeys the course claims to support.

---

## 7. Accessibility

Accessibility is treated as a correctness requirement, not a polish layer. It is enforced by an
**axe-core audit** that runs over every page the browser suite declares, plus manual and browser
checks for the things axe cannot see.

- **Tabs** implement the WAI-ARIA tab pattern: roving `tabindex`, `aria-selected`, arrow / Home /
  End keys, and `TabPanel` pairs `role="tabpanel"` with `id`/`aria-labelledby` back to the tab.
- **Radio groups** in the quiz implement arrow-key selection with roving `tabindex`.
- **Charts** are SVG with no semantics, so every chart is wrapped in `ChartFigure`, which supplies
  a `role="img"` name, a visible caption, and a disclosure containing the underlying numbers as a
  real table.
- **Live regions** announce state changes (theme, imports, project edits, builder run status).
- **The skip link** is a button that moves focus to `<main tabIndex={-1}>`. It was originally an
  `href="#main-content"`, which the hash router intercepted and turned into a 404 page — a real
  bug, caught by the audit and now covered by a browser test.
- **Destructive actions** use an inline `ConfirmButton` rather than `window.confirm`, which blocks
  the page, cannot be themed, and is awkward for assistive technology.
- **Scrollable regions** are focusable and named, so their content can be scrolled with the
  keyboard (WCAG 2.1.1).
- **Focus is visible** everywhere via a shared `.focus-ring` utility, and reduced-motion
  preferences are honoured.

### What the axe audit found

The audit was added *after* the manual review, and it immediately found four violations that the
manual review had missed. All four were real:

| Violation | Cause | Fix |
| --- | --- | --- |
| `color-contrast` (serious) | The `Ctrl K` hint used `opacity-70`, dropping the ratio to 4.41:1 against a required 4.5:1 | `kbd` now has an explicit colour, background and border; the opacity is gone |
| `label-content-name-mismatch` (serious) | The search button's `aria-label` did not contain its visible text "Search Ctrl K" | The hint moved outside the button, and the icon became an SVG (an SVG is not *text*, so it does not take part in the check) |
| `label-content-name-mismatch` (serious) | The theme button was named "Switch to light theme" while showing "☾ Dark" | The name now begins with the visible word, and the glyph is an SVG |
| `label-content-name-mismatch` (serious) | The lesson difficulty button was named "Toggle lesson difficulty…" while showing "Switch to advanced track" | The name now contains the visible text |

### The icon set

`src/ui/Icon.tsx` holds a small set of inline SVG icons. This is not decoration: replacing a
unicode glyph with an SVG is what makes the WCAG 2.5.3 "Label in Name" rule satisfiable, because a
glyph is *text* (and therefore has to appear in the accessible name) while an SVG is not.

### Keyboard access to the builder

The builder canvas is a React Flow surface, and clicking a node was the only way to open it. The
inspector now has a **"Select a node"** control listing every node in the graph; choosing one opens
the inspector for it and moves the browser's focus onto the node on the canvas. Adding a node was
already keyboard-reachable (the add-node buttons are ordinary buttons), and the node is selected
automatically afterwards.

### Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd`/`Ctrl` + `K` | Open course search |
| `/` | Open course search (not reserved by any browser) |
| `Escape` | Close the search dialog |
| `↑` / `↓` | Move through search results, or through a tab strip |
| `Enter` | Activate the focused result or tab |
| `Delete` / `Backspace` | Remove the selected node in the builder |
| `Home` / `End` | Jump to the first or last tab |

`Cmd`/`Ctrl`+`K` alone is not enough: browsers reserve it (Chrome focuses the omnibox, Firefox
focuses its search bar), which the Firefox run of the browser suite exposed. `/` is the fallback
that every browser leaves alone, and it is guarded so that it does not fire while the user is
typing in a field.

### WCAG 2.2 criteria that needed work

The course was reviewed against WCAG 2.2, whose new criteria include several that a design-and-
contrast audit does not cover.

| Criterion | What it asks | How it is met here |
| --- | --- | --- |
| 2.4.11 Focus Not Obscured (AA) | A focused control must not be entirely hidden by author content | The header is sticky, so `html` has `scroll-padding-top: 5.5rem` and a focused control is scrolled clear of it |
| 2.5.7 Dragging Movements (AA) | Anything that uses dragging needs a single-pointer alternative | The builder can connect two nodes with two clicks, via the **Connect two nodes** button; dragging a handle is still supported but is no longer the only way |
| 2.5.8 Target Size (AA) | Targets must be at least 24 × 24 CSS pixels | `Button` sets `min-h-6` explicitly, and small chip-shaped controls carry a `.tap-target` utility that enforces the minimum |
| 2.5.3 Label in Name (A) | The accessible name must contain the visible text | See the icon set below |

### Keyboard access to the builder

The builder canvas is a React Flow surface, and clicking a node was the only way to open it. The
inspector now has a **"Select a node"** control listing every node in the graph; choosing one opens
the inspector for it and moves the browser's focus onto the node on the canvas. Adding a node was
already keyboard-reachable (the add-node buttons are ordinary buttons), and the node is selected
automatically afterwards.

### Shortcuts

| Shortcut | Action |
| --- | --- |
| `Cmd`/`Ctrl` + `K` | Open course search |
| `/` | Open course search (not reserved by any browser) |
| `?` | Open the shortcut sheet |
| `Escape` | Close the search dialog, the shortcut sheet, or an inline definition |
| `↑` / `↓` | Move through search results, or through a tab strip |
| `Enter` | Activate the focused result or tab |
| `Delete` / `Backspace` | Remove the selected node in the builder |
| `Home` / `End` | Jump to the first or last tab |

`Cmd`/`Ctrl`+`K` alone is not enough: browsers reserve it (Chrome focuses the omnibox, Firefox
focuses its search bar), which the Firefox run of the browser suite exposed. `/` is the fallback
that every browser leaves alone, and it is guarded so that it does not fire while the user is
typing in a field.

### What axe cannot check

An automated audit is a floor, not a ceiling. It does not judge whether alternative text is
*meaningful*, whether the reading order makes sense, whether the prose is comprehensible, or
whether focus is always visible. Those remain a manual-review responsibility, and the
`prefers-reduced-motion` handling, the focus-ring utility and the meaningful SVG `title` elements
are the parts that are checked by reading the code rather than by a tool.

### The View Transition API, and a WebKit crash

The route change is animated with the View Transition API where the browser supports it, and
happens immediately where it does not. The transition is a progressive enhancement: the course reads
the same either way, and `?no-vt` turns it off everywhere for debugging.

**WebKit crashes when it has to snapshot a page that does not scroll.** The renderer dies on every
navigation away from a page shorter than the window — which, in this course, is the assessment
centre's review tab and attempt history, the two shortest pages there are. It is not a canvas
problem: the pages have no canvas at all. The cause is the snapshot itself.

The fix is a layout rule rather than a workaround: the main area is at least a screen tall, so the
page always has something to scroll. That is better layout anyway — a short page should not have
its footer floating in the middle of the window — and it removes the crash. The browser suite has a
test that leaves a short page and checks the renderer is still alive.

There is a second, separate WebKit crash: the renderer dies when it has to snapshot a canvas-heavy
page while the previous canvas-heavy page is still in the top layer. That one is handled by skipping
the transition for the canvas routes (`isHeavyRoute`), which is a narrower and more conventional
problem.

Route changes cross-fade with the View Transition API, which is Baseline 2025 and available in all
three engines the suite runs. It had to be made safe, and there are two separate ways it was not.

**WebKit's renderer crashes** when it is asked to snapshot a canvas-heavy page while the previous
canvas-heavy page is still in the top layer — which is exactly what happens when moving from one
laboratory to another. The transition is therefore skipped when the destination route renders a
canvas (the builder or a laboratory), and a browser test asserts that the renderer survives that
navigation.

**WebKit's renderer also crashes** when it is asked to snapshot a page that does not scroll, which
is every page shorter than the window — the assessment centre's review tab and attempt history
among them. Those pages have no canvas at all, so the first fix does not cover them. The second fix
is a layout rule: the main area is at least a screen tall, so there is always something to scroll.
A browser test leaves a short page and checks the renderer is still alive.

`?no-vt` in the query string turns the transition off everywhere, which is useful when debugging.

The lesson here is the same one the course teaches: a progressive enhancement that can take down
the renderer is not a progressive enhancement.

---

## 8. Extending the course

The curriculum is data. Adding a lesson means writing the lesson, not hunting through the rendering
layer — but that only holds if the build *tells you* when the content is inconsistent.

`scripts/validate-content.ts` runs as part of `npm run build` and fails the build on a broken
course. It checks the things that are easy to get wrong when extending:

- duplicate or missing ids, for lessons and for questions;
- questions with an out-of-range answer, a repeated option, or no explanation;
- sources that point at a chapter the book does not have, or that lack a page;
- diagrams, laboratories or demonstrations that a lesson refers to but that do not exist;
- glossary relations that point at nothing, and glossary terms attached to a lesson that does not
  exist;
- concept-to-demonstration routes that lead to a demonstration no lesson contains, which would be a
  dead link for the student — the route is the promise that the concept can be *tried*;
- laboratory diagnostic questions that do not name the control that tests them, which would make
  them guessable rather than checkable;
- chapters of the book that no lesson covers;
- chapters a lesson *claims* in its provenance but does not cite in its own sources, and sources a
  lesson cites but never names in its prose.

The last pair exists because of a real gap. The validator counted a chapter as covered when a
lesson claimed it in its provenance, and Chapter 13 — "From Tools to Assistants" — was claimed by
the conclusion lesson and covered by two parenthetical mentions. Every other chapter was taught;
that one was merely listed. The check now requires a claimed chapter to be cited *and* to be named
in the prose, and it warns when a claimed chapter is named fewer than three times. It found two
more thin claims the moment it was switched on, and every chapter of the book is now named at
least three times.

It also prints a report, so the build output says something about the course:

```
Course content
  lessons            12
  sections           73
  study time         9 h
  lesson questions   64
  predictions        12
  lab questions      18
  total questions    94
  glossary terms     120
  laboratories       9
  references         32
  chapters covered   23 of 23

Content is consistent.
```

The validator earned its place immediately. On its first run it found two real errors that had
slipped in — a glossary relation pointing at `Planner-Caller-Summarizer` when the term is spelled
`Planner–Caller–Summarizer`, and another at `Knowing–doing gap` — and it flagged seventeen
laboratory concepts that were not glossary terms at all, so their badges could not link. Fifteen of
those turned out to be genuine vocabulary of the book and are now defined: *planning, backtracking,
replanning, short-term memory, episodic memory, eviction, retrieval, verification, handoff,
coordination failure, model error, sample efficiency, branching, error recovery* and the *decision
node*. Two more were added with the context-window demonstration: *prompt compression* and
*truncation*. The glossary went from 82 terms to 98, and no term is left without a relation.

The four deep-dive laboratories then added twenty more badges, and the same check caught all twenty.
Eighteen are now defined — *adaptive retrieval, query critique, abstention, question decomposition,
multi-hop retrieval, transfer, negative transfer, self-generated data, compounding model error,
forgetting curve, hierarchical memory, consolidation, write policy, policy gradient, decomposable
work, overthinking, external verification, provenance* — each cited to the section whose mechanism
it names. Two of the twenty were the registry's mistake rather than the glossary's, and were
re-pointed at terms that already existed: the *Vision-language-action model (VLA)* and *Agentic
RAG*. Two of the eighteen are labelled course terms with no book citation, because the book does not
use those words — *negative transfer*, which the textbook names only by its success case, and
*policy gradient*, which its memory section calls only "trained using reinforcement learning".
A definition that says which half is the book's and which half is the course's is the point: the
glossary went to 120 terms and nothing on a laboratory page links to a term the course cannot define.

### 8.1 The demonstration registry
The diagram identifiers were made a data module (`content/diagramIds.ts`) that the `DiagramId` type
is derived from, so a diagram cannot be added to the renderer without the validator knowing about
it, and a lesson cannot reference a diagram that does not exist. The same was done for the
demonstrations (`content/demos.ts`): the `DemoId` type is derived from the registry, the renderer
switches exhaustively over it, and the validator fails the build if a demonstration is registered
but no lesson contains it — or if a concept claims a demonstration that no lesson holds.

That last check exists because of a near-miss. The demonstrations were listed in the glossary's
routing map, and the map was correct, but nothing checked that the demonstration on the other end
of the route was still in a lesson. A concept could promise the student a hands-on route and
deliver a 404, and the build would have been green. The same class of bug was in the test suite:
`demoLinks.test.ts` kept its own list of demonstrations, and the list fell behind the content
without the test noticing. It now reads the registry, so a demonstration cannot be added without
the test covering it.

---

## 9. Deliberate limitations

- **No visual-regression tests.** The visual design is not asserted automatically; only structure
  and behaviour are. The screenshots in `docs/screenshots/` are captured by
  `npm run screenshots`, which drives the built site with Playwright — reproducible, but not
  compared against anything, so a change to the design is not a failure.
- **The bundle is not measured in the tests.** The split described above was made by hand and
  checked by reading the build output. Nothing fails if a future change puts React Flow back in the
  initial bundle, and nothing measures how long the course takes to become readable on a slow
  connection.
- **The audit cannot judge meaning.** axe checks rules, not comprehension. It cannot tell whether
  an alternative text is *useful*, whether the reading order makes sense, or whether the prose is
  clear. Those remain a manual-review responsibility.
- **The prediction exercises are not validated for difficulty.** Each one is authored against the
  point its lesson makes, and the distractors are plausible, but nothing measures whether a student
  actually finds them hard. That would need real student data.
- **The Leitner schedule is a heuristic.** Optimal schedules are known, but they need a per-learner
  memory model and a great deal of interaction history, which this course does not have. The
  schedule is a fixed ladder — 0, 1, 3, 7, 14 and 30 days — and the box a question sits in is
  decided by whether the last answer was right. It does not model forgetting, difficulty or
  interference between similar questions.
- **The search ranking is lexical, not semantic.** That is a deliberate trade: a deterministic,
  testable ranking with no embedding dependency beats a better ranking that needs a network call.
- **The advanced track is authored for all twelve lessons, but only the core track is graded.** The
  assessment centre lets a student practise with the advanced question set included, and mastery is
  computed from the core track.
- **The review queue is a Leitner queue, not a full spaced-repetition system.** It surfaces the
  questions whose box says they are due, most-overdue first, and it withholds a question that was
  answered correctly until its interval has passed. It does not expand the interval for questions
  that are hard but always answered right, and it does not interleave similar items to test
  discrimination. The rule is visible and predictable, which matters more than a better algorithm.
- **Inline definitions cover the glossary only.** A term the textbook uses that the glossary does
  not list is not linked. The glossary is the curated list of terms worth defining in place; growing
  it is a content task, not a code one.
- **The labs teach mechanisms, not agent frameworks.** Nothing here wires up LangChain or an
  inference provider. The book describes those architectures; the course simulates the *control
  flow* so that a student can see why they work.
- **The builder's node graph can be connected without dragging, including with a branch label.** The
  **Connect two nodes** control takes a source, a target and a branch — `default`, `yes`, `no`,
  `pass` or `fail` — which satisfies WCAG 2.5.7 for single-pointer use and covers the
  branch-labelled edges that used to be reachable only by dragging. What it still cannot do is
  connect to a *named handle* on a specific side of a node: the two branches of a decision node are
  chosen from a list, not from a handle, so the branch is a property of the edge rather than of the
  port.
- **The world-model lab's "predicted vs. actual" comparison is a per-state aggregate**, not a
  trajectory replay. It shows which states the model gets wrong, not a side-by-side animation of
  the two runs.
