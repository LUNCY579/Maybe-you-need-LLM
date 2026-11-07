# Test report

This report records what is tested, how, and what the current results are. It
is written so that a reader can judge the claims rather than take them on
trust: every assertion below is reproducible with the commands in
[Running the tests](#running-the-tests).

## Summary

<!-- BEGIN GENERATED: unit -->
| Suite | Framework | Tests | Result |
| --- | --- | --- | --- |
| `src/components/lab/lab.test.tsx` | Vitest + RTL | 6 | pass |
| `src/components/lab/predictionExercises.test.ts` | Vitest | 25 | pass |
| `src/components/lab/PredictPanel.test.tsx` | Vitest + RTL | 5 | pass |
| `src/components/layout/CommandPalette.test.tsx` | Vitest + RTL | 8 | pass |
| `src/components/layout/ErrorBoundary.test.tsx` | Vitest + RTL | 7 | pass |
| `src/components/lesson/ExplainBack.test.tsx` | Vitest + RTL | 7 | pass |
| `src/content/collection.test.ts` | Vitest | 12 | pass |
| `src/content/concepts.test.tsx` | Vitest + RTL | 13 | pass |
| `src/content/content.test.tsx` | Vitest + RTL | 26 | pass |
| `src/content/labs.test.ts` | Vitest | 7 | pass |
| `src/content/latex-escapes.test.ts` | Vitest | 1 | pass |
| `src/content/routes.test.ts` | Vitest | 24 | pass |
| `src/content/status.test.ts` | Vitest | 9 | pass |
| `src/core/contextScaling.test.ts` | Vitest | 15 | pass |
| `src/core/core.test.ts` | Vitest | 101 | pass |
| `src/core/evaluation.test.ts` | Vitest | 7 | pass |
| `src/core/fragments.test.ts` | Vitest | 15 | pass |
| `src/core/fuzzy.test.ts` | Vitest | 17 | pass |
| `src/core/interleave.test.ts` | Vitest | 11 | pass |
| `src/core/mastery.test.ts` | Vitest | 16 | pass |
| `src/core/path.test.ts` | Vitest | 15 | pass |
| `src/core/progress.test.ts` | Vitest | 17 | pass |
| `src/core/progressStorage.test.ts` | Vitest | 10 | pass |
| `src/core/prompting.test.ts` | Vitest | 6 | pass |
| `src/core/property.test.ts` | Vitest | 20 | pass |
| `src/core/reasoning.test.ts` | Vitest | 19 | pass |
| `src/core/regressions.test.ts` | Vitest | 21 | pass |
| `src/core/retrieval.test.ts` | Vitest | 22 | pass |
| `src/core/scaling.test.ts` | Vitest | 5 | pass |
| `src/core/sequence.test.ts` | Vitest | 4 | pass |
| `src/core/spacedRepetition.test.ts` | Vitest | 37 | pass |
| `src/core/speculative.test.ts` | Vitest | 16 | pass |
| `src/core/studyPlan.test.ts` | Vitest | 17 | pass |
| `src/pages/ReviewPage.test.tsx` | Vitest + RTL | 9 | pass |
| `src/test/renderProbe.test.tsx` | Vitest + RTL | 1 | pass |
| **Unit and component total** | | **551** | **all pass** |
<!-- END GENERATED: unit -->

<!-- BEGIN GENERATED: e2e -->
| Suite | Framework | Tests | Result |
| --- | --- | --- | --- |
| `e2e/capture.spec.ts` | Playwright | 3 (1 per browser) | pass (2 skipped) |
| `e2e/course.spec.ts` | Playwright | 207 (69 per browser) | pass (2 skipped) |
| `e2e/forcedColors.spec.ts` | Playwright | 12 (4 per browser) | pass (4 skipped) |
| `e2e/layout.spec.ts` | Playwright | 18 (6 per browser) | pass |
| `e2e/offline.spec.ts` | Playwright | 4 (one engine) | pass |
| `e2e/visual.spec.ts` | Playwright | 3 (1 per browser) | pass (2 skipped) |

| Suite | Framework | Tests | Result |
| --- | --- | --- | --- |
| **End-to-end, chromium** | | **81** | **81 pass** |
| **End-to-end, firefox** | | **81** | **78 pass (3 skipped)** |
| **End-to-end, webkit** | | **81** | **74 pass (7 skipped)** |
| **End-to-end, offline** | | **4** | **4 pass** |
| **End-to-end total** | | **237 passed, 10 skipped** | |
<!-- END GENERATED: e2e -->

Also clean:

- `npx tsc -b` — no type errors
- `npx oxlint` — 0 warnings, 0 errors
- `npm run contrast` — 112 colour-pair checks, 0 failures
- `npx vite build` — production bundle builds without errors
- `npm run check:links` — every cited source resolves, and none is pinned to
  a superseded revision of its paper

The two tables above are generated, not written by hand. Run
`npm run report` to rebuild them from a real run:

```bash
npm run report             # unit and end-to-end
npm run report -- --unit-only   # skip the browser run
```

Hand-written counts drift. This table was written by hand for a long time,
and by the time it was audited it was missing two test files, had six
individual counts that were wrong, and had a duplicated row in the
end-to-end table. The numbers in it were not the numbers the tests
produced.

## Running the tests

```bash
npm install
npm run test        # 551 unit and component tests
npm run test:e2e    # end-to-end runs (Chromium, Firefox and WebKit)
npm run report      # rewrite the two tables above from a real run
npm run check:links # ask every cited source whether it still resolves
```

The end-to-end suite needs browsers once:

```bash
npx playwright install chromium firefox webkit
```

Playwright starts its own Vite dev server on port 5213, so it does not
interfere with a server you already have running.

## What is asserted, and why

### The mathematics (`src/core`)

These tests assert on values, not on rendering. Where a closed form exists, the
test compares against it; where a gradient is claimed, the test compares
against a central finite difference; where an invariant holds, the test
asserts the invariant.

**Linear algebra and probability** (`core.test.ts > math`)

- `matmul` produces the expected shape and rejects incompatible shapes with a
  message naming both shapes.
- `softmax` returns a distribution that sums to 1, is numerically stable for
  large logits, and rejects a non-positive temperature.
- A lower temperature sharpens the distribution; a higher one flattens it.
- `softmaxRows` normalises each attention row independently.
- `sigmoid` and `softplus` match known values.
- `entropy` and `crossEntropy` match hand-computed results.
- The PRNG is reproducible: the same seed gives the same stream, a different
  seed does not.

**Attention** (`core.test.ts > attention`)

- The causal mask is zero on and below the diagonal and −∞ above it, matching
  the convention printed in §2.1.1 Eq. 2.6.
- Scores are scaled by exactly `1/√d`.
- Attention weights are row-stochastic.
- **Masked positions receive a weight of exactly `0.0`** — not a small number.
  This is the property the causal mask exists to guarantee.
- With masking disabled the model attends to everything, and the first row can
  reach the future.
- The output equals `weights · V`.
- Head merging concatenates in the order `Merge` specifies.

**Embeddings** (`core.test.ts > embeddings`)

- The hash is stable across runs.
- The same token always gets the same embedding; different tokens get
  different ones.
- The sinusoidal encoding interleaves sin and cos in the right positions.
- Projection matrices are reproducible from their seed.

**The Explorer pipeline** (`core.test.ts > transformer explorer pipeline`)

- The next-token distribution is normalised and has the right length.
- The causal mask holds in all three tokenisation modes.
- The reported shapes match the matrices actually returned.
- The softmax denominator shown in the walkthrough matches the probabilities
  the model actually uses.
- Out-of-vocabulary text is observable rather than fatal.
- Multi-head attention merges back to the full model dimension.

**Tokenization** (`core.test.ts > tokenizer laboratory`)

- The three modes are labelled correctly and keep character offsets consistent
  with the original text.
- Word-level ids come from the explicit vocabulary.
- Character mode produces more units than word mode; subword mode fewer.
- Unknown words compose from subword pieces.
- Out-of-vocabulary words are marked and the OOV rate is correct.
- Tokenization is deterministic and vocabulary-consistent.
- Empty input produces zero statistics rather than a crash.

**Sampling** (`core.test.ts > sampling and decoding`)

- The base distribution is normalised.
- Top-k keeps at most *k* tokens; top-p keeps the smallest prefix reaching the
  threshold and always keeps the most likely token.
- A filtered-out token is never selected.
- Invalid temperature, top-k and top-p raise errors instead of producing NaN.
- The distribution approaches greedy decoding as temperature tends to zero and
  flattens as it grows.
- A given seed gives a given result; another seed gives another.
- Sampling draws only from the filtered support.
- Sampling from an all-zero distribution raises rather than returning
  nonsense.

**Training** (`core.test.ts > training laboratory`)

- A corpus encodes into bigram pairs.
- Training lowers the loss and raises accuracy.
- The transition matrix stays row-stochastic.
- **The analytic softmax gradient matches a central finite difference.**
- L2 regularisation shrinks the weight norm.
- A run is fully deterministic for a given seed.
- An oversized learning rate ends up worse than a small one — the divergence
  case is real, not simulated.
- A non-finite loss is reported rather than silently continued.
- A non-positive learning rate is rejected.

**Alignment** (`core.test.ts > alignment laboratory`)

- The policy distribution over candidates is normalised.
- Preference probabilities lie in `[0, 1]`.
- **The DPO log-odds match the explicit ratio formulation** of Eq. 4.81 —
  `β[(w − w_ref)·Δφ]` agrees with the log-ratio form to floating-point
  precision, which is the claim the module makes about the partition function
  cancelling.
- The Bradley–Terry form and the implied reward agree.
- **Analytic SFT and DPO gradients match central finite differences.**
- DPO training reduces the loss and raises the preference probability.
- SFT reduces the loss on the chosen responses.
- The reward model separates chosen from rejected.
- An invalid learning rate is rejected.

**Inference and search** (`core.test.ts > inference and reasoning laboratory`)

- The toy language model produces a valid next-token distribution.
- The context window visibly changes the distribution.
- Decoding is autoregressive and stops at `<eos>`.
- Decoding is deterministic for the same seed.
- **KV-cache bytes match the analytic formula** `2·L·n_kv·d_h·m·bytes·batch`,
  and scale linearly with batch size and layer count.
- The grouped-query memory ratio is correct.
- Prefill attention work is quadratic and decode attention work is linear.
- **Greedy search gets trapped on the toy tree where a wider beam finds the
  correct answer** — the search really runs.
- Best-of-n samples complete paths and reports its verifier budget.
- The full reasoning path to a node can be reconstructed.

**Progress** (`progress.test.ts`, and `core.test.ts > progress persistence`)

- Progress round-trips through JSON without losing fields.
- Malformed JSON is reported as an error rather than thrown.
- A parsed document cannot override the schema version.
- Hostile or malformed documents are sanitised field by field.
- Non-object input is ignored entirely.
- Completing a lesson twice keeps the first completion time.
- Visiting a lesson does not mark it complete.
- Resetting a lesson keeps quizzes, notes and bookmarks.
- Study time accumulates and nonsense durations are rejected.
- Bookmarks toggle idempotently.
- Saving a configuration with the same id replaces it.
- Quiz accuracy is scored from the latest attempt per question.
- Completion counts are clamped to the course size.
- Progress persists and reloads through a storage adapter.
- Merging an import is a union of activity and does not mutate either input.

**Retrieval** (`retrieval.test.ts`) — new in this revision

- The query vector has exactly one finite entry per axis for every query.
- An exact axis match scores 1; a prefix match scores lower.
- Neighbour expansion never exceeds the originally matched weight.
- The query vector is deterministic.
- Dot product, magnitude and cosine similarity match hand-computed values, and
  a zero vector gives 0 rather than NaN.
- The laboratory's own default query retrieves passages.
- All similarities are finite and in `[-1, 1]`.
- Results are ranked by non-increasing score with contiguous ranks.
- No more than *k* documents are returned, and raising the threshold never
  adds one.
- The prompt budget sums its parts, reports utilisation, detects overflow,
  reports the excess, counts only droppable parts, and survives a zero-sized
  context window.

**Reasoning** (`reasoning.test.ts`) — new in this revision

- Process supervision separates step validity better than outcome supervision.
- Process supervision predicts every step correctly.
- **Outcome supervision penalises the sound steps of a failed solution**
  (mean score below 0.5) while process supervision does not (above 0.9).
- **Process supervision concentrates credit on one step** inside a failed
  solution while outcome supervision spreads it across the path.
- The loss decreases over training and the history has one entry per step.
- The analytic logistic gradient matches a finite-difference estimate.
- The credit spread is the range of the step scores, and the reported mean,
  max and min agree with the predictions.
- The evaluation protocols are internally consistent, ordered correctly, and
  reproducible.

**Regressions** (`regressions.test.ts`) — new in this revision

Each of these corresponds to a defect found by an independent audit of the core
modules. They are kept together so the history stays legible.

| Test | Defect it pins down |
| --- | --- |
| query vector stays finite | a neighbour index outside the axis range wrote `NaN` into the vector, so every cosine similarity was `NaN` and the retriever returned nothing |
| `matmul` of an empty matrix | a 0-row left operand was mis-reported as `0×0` and threw, crashing the Explorer on empty input |
| `runExplorer` on empty input | the Explorer threw on an empty or whitespace-only sentence |
| unembedding projection | the model's own unembedding matrix was built and then discarded in favour of a hand-written rule; the test now checks the projection against `representation · Wo` |
| multi-head width | heads that did not divide the model dimension silently dropped coordinates |
| vocabulary uniqueness | the toy vocabulary contained six duplicate surfaces, so six ids were unreachable and two ids mapped to the same string |
| subword piece length | the default cap made eleven vocabulary entries impossible to produce, shattering them into near-character sequences |
| `trainStep` loss | the reported loss was the mean cross-entropy plus the L2 penalty divided by the batch size, so it did not equal `evaluate()` on the same batch |
| causal mask shape | the mask assumed a square score matrix and produced `NaN` for the cached single-query case |
| softmax stability | `softmax([1000, -1000])` must not overflow |

### The content (`src/content`)

- The curriculum covers the six chapters of the source revision, in order.
- There are at least twelve lessons, each attached to a real module.
- Lesson numbers are contiguous and unique.
- Every source reference is well formed: a chapter, a section number, a title
  and a page.
- Prerequisites exist and come earlier in the course.
- Every lesson declares a known interactive laboratory.
- The quiz bank has at least 24 questions across all six modules, a valid
  answer key everywhere, and per-option feedback for every option.
- Questions and lessons are linked in both directions.
- Glossary terms are unique, their prerequisites resolve, and every term is
  used by at least one lesson.
- Formulas point at real lessons and carry symbol tables.
- The lesson registry has a body for every lesson and nothing extra.
- **Every lesson body renders without an invalid formula** — this catches a
  KaTeX error in any of the eighteen lessons.
- Every lesson's knowledge check renders with its first question.
- **Every lesson has an objective, an interactive exercise and a worked
  example.** The course promises a consistent lesson shape, so the shape is
  asserted rather than assumed.

**LaTeX escape integrity** (`latex-escapes.test.ts`)

A JSX string attribute keeps its backslashes, so `tex="\beta"` reaches KaTeX
as `\beta`. A template literal does not: `tex={`\beta`}` reaches KaTeX as
`beta`, because `\b` is a backspace escape in JavaScript. Some of these are
silent (`\t`, `\n`, `\r`, `\b`, `\f`, `\v`) and some simply drop the
backslash. KaTeX does not complain — it renders the remaining letters as
ordinary math — so the formula is quietly wrong and the mistake is invisible
in review.

This test scans every `tex={` template literal in the content, component and
page sources and fails if any LaTeX backslash would be consumed by
JavaScript. It found one real instance in the course content during this
revision, and one in a file that was being reconstructed at the time.

### Property-based tests (`src/core/property.test.ts`) — new in this revision

The example-based suites check specific, hand-computed cases. These check
*invariants* over hundreds of randomised inputs, which is where shape handling,
off-by-one errors and numerical edge cases tend to hide. Every random draw
comes from the seeded generator, so a failure is exactly reproducible — the
seed and the trial number are printed in the assertion message.

- **`matmul` matches a deliberately slow reference implementation** on 300
  random shapes, and is associative on 100 random triples.
- **`attention` matches a reference implementation** on 250 random inputs,
  computed with explicit loops that share no code with the implementation.
- Attention weights are row-stochastic on random inputs, and **masked
  positions receive exactly `0`, not a small number**.
- **Attention without a mask is permutation equivariant**: reordering the keys
  and values together reorders the weights and leaves the output unchanged.
  This is the property that makes attention a weighted average rather than a
  position-dependent lookup.
- The non-square mask lets a single cached query attend to the whole cache.
- `softmax` always returns a distribution for any finite input, and its
  entropy always lies in `[0, log n]`.
- Tokenizer offsets always point back into the original text, and the OOV rate
  always lies in `[0, 1]`.
- **The sampling filter always renormalises to 1**, never returns more than
  *k* candidates, and never leaves mass on a token outside the retained pool.
- A sample is never drawn from a zero-probability token.
- Training reduces the loss across a range of learning rates, and never
  reports a non-finite loss for a sane configuration.
- **The DPO loss falls monotonically when the policy is moved by hand along
  the preference direction** — the sign of the DPO gradient is checked
  directly, rather than only through the optimiser.
- The DPO preference probability agrees with the log-odds, the loss agrees
  with the negative log-likelihood, and the log-odds scale linearly in β.
- The Explorer produces a normalised distribution and respects the causal mask
  in all three tokenisation modes, for any input.
### Concept linking (`src/content/concepts.test.tsx`) — new in this revision

- Every auto-linked surface points at a term that exists in the glossary.
- No surface is listed twice.
- The terms that are too common to be worth linking are excluded: `token`,
  `softmax`, `logits`, `prompt`, `reasoning` and `temperature` are never
  decorated, because a page of dotted underlines teaches nothing.
- A term is matched only on a word boundary, so `retokenisation` does not match
  `token`.
- Matching is case-insensitive.
- When two surfaces overlap, the longer one wins.
- A term is linked once, not once per mention.
- Matches come back in reading order.
- Annotating prose wraps the term in a button, leaves `code` elements alone,
  links a term only once across a block, and leaves the original wording
  intact.

### The learning path (`src/core/path.test.ts`) — new in this revision

- A lesson with no prerequisites is available; one whose prerequisites are unmet
  is blocked, and names what it is waiting on.
- A lesson becomes available once its prerequisites are done.
- A completed lesson is *done* even if a prerequisite is missing — the learner
  did it, and the path should not argue.
- The three states are counted, and they add up to the number of lessons.
- The path covers every lesson exactly once, and only ever names a
  prerequisite that exists.
- The recommendation is a lesson with no prerequisites when nothing has been
  done, and the first available lesson in course order otherwise.
- A blocked recommendation explains what it is waiting on.
- There is no recommendation once every lesson is done.
- The recommendation is never a lesson that is already complete, and its
  prerequisites are genuinely satisfied.

### The prediction panel (`src/components/lab/PredictPanel.test.tsx`) — new in this revision

- One question is shown at a time and the score is tracked.
- A wrong answer is marked and the explanation is shown.
- A question accepts one answer only: the buttons are disabled afterwards.
- Resetting clears the answers and returns to the first question.
- The closing note appears only once every question is right.

### The prediction exercises (`src/components/lab/predictionExercises.test.ts`) — new in this revision

Every exercise must have exactly one correct option. The correct option is
*computed* rather than stored, so a change in the algorithm could in principle
leave a question with no correct answer, or with two. This invariant is
asserted for all five laboratories: each has questions, every question has
exactly one correct option and at least two options, ids are unique, and every
question has a prompt and an explanation.

The invariant test earned its place immediately: it found two exercises whose
hard-coded answer lists no longer contained the computed answer — the bigram
model predicts `model` after `the`, not `learns`, and the DPO preference
probability is 0.887, not one of the options that had been written down. Both
are now derived from the computation.

### The review schedule (`src/core/spacedRepetition.test.ts`) — new in this revision

The scheduler is SM-2, so the tests assert SM-2's rules rather than the
implementation's own behaviour:

- A first correct answer schedules the question for 1 day, a second for 6 days,
  and every later one at the previous interval times the ease factor.
- A correct answer raises the ease factor; a slow but correct one lowers it.
- The ease factor never falls below 1.3, and the interval never exceeds two
  years.
- A wrong answer resets the repetition count and the interval to 1 day, and
  **does not** reduce the ease factor. This is the rule that keeps a hard item
  out of "low interval hell", and it is the point where the original SuperMemo
  description and Anki's implementation differ.
- The order of the queue is by how overdue each question is, then by whether it
  has ever been seen, then by how long ago it was last reviewed.
- A question is reviewed once a day: an item reviewed earlier the same day
  reports as already reviewed, one reviewed yesterday does not.
- A stored state that is malformed is discarded rather than repaired.

`src/pages/ReviewPage.test.tsx` then checks that the page really does use the
scheduler: that the whole bank is due before anything is reviewed, that a
correct answer produces the verdict "recalled, rescheduled" and a wrong one
produces "back tomorrow", that a question cannot be answered twice, and that
the schedule reaches the local progress file.

### What is settled, and what is moving

The course says, for each module, what the book establishes and what is
still moving, with the primary sources. The content test checks that every
module is described, that every module says something substantial about both
halves, that every source has a real address and a note, that every source
names a venue or a year, and that no source is cited twice. The end-to-end
test checks that the page renders, that each module is on it, and that the
sources are links to real addresses.

Writing it found a mistake: a description of latent attention had been
attached to the wrong paper. The test for duplicate sources is what exposed
it.

The sources are also checked against the network, by
`npm run check:links`. It asks each of the twenty-one addresses whether it
still resolves, and — for the ones pinned to a revision of an arXiv paper —
whether that revision is still the current one. A pinned link keeps working
after the paper has been revised, so the reader is sent to an old draft and
believes it is the current one; that is not a broken link, but it is a false
one, and the check reports it as stale.

The first run found two. A data-constrained scaling paper was cited at its
second revision when the fifth is current, and a survey of direct preference
optimisation was cited at its third revision — published in *TPAMI* in the
meantime — when the fourth is current. Both now point at the current
revision, and the survey's label now names its venue.

The check is not part of `npm test`, because a test suite that fails when the
network is down is a test suite that gets ignored. It is a command a person
runs when they touch the sources.

The page carries the date it was last checked, and the check writes that
date rather than a person typing it: `STATUS_CHECKED_ON` in
`src/content/status.ts` is rewritten only after every source has been found
to resolve and to be current. A date on a page about currency that nobody
maintains is worse than no date, so the date is tied to the check that
justifies it. A content test checks that the date is a real date and that
the label shown to the reader agrees with it, and the end-to-end test checks
that the page shows one.

### The transfer questions

Every lesson has one question that describes a situation the lesson never
mentions. The content test asserts that there is exactly one per lesson,
that the prompt is long enough to be a scenario, that it is a different
question from the others of its lesson, and that every wrong option carries
a feedback message long enough to be a diagnosis rather than a label.

The last one matters: a question whose wrong options are obviously wrong
teaches nothing, because the reader can reject them without thinking about
the mechanism.

### The pictures

Ten pages are compared against committed baselines with a two per cent
tolerance. The other end-to-end tests check that the course *works*; this one
checks that it still *looks* the way it did, so that a change which
accidentally reflows a figure, moves a heading or drops a border is caught.

The tolerance is not decoration: it was checked by breaking the landing
page on purpose. A heading that grew by a size step moved 60,066 pixels —
seven per cent of the image — and the test failed. A number that changed
from 52 to 53 moved a handful of pixels and did not, which is the right
answer for a number.

The baselines are refreshed on purpose with `npm run screenshots`.

### The study plan

The plan is computed, not scripted: which questions are at risk of being
forgotten, which lesson the learning path says to study next, and which
module the reader is weakest in. The unit tests check that the review
comes first, that a lesson is suggested, that an explanation is suggested
only when it has not been done, and that practice is suggested only when
nothing is due.

The time budget is checked too: that everything fits when there is no
limit, that the items which do not fit are marked rather than hidden, and
that a shorter item after a long one can still fit in the time that is
left.

### Due for review, and not seen yet

The two are counted separately, and the difference matters. A question
that has been learned and is now at its scheduled time is *due for
review*: it is at risk of being forgotten. A question that has never been
asked is *new*: it is worth answering, but it is not at risk of anything.
Calling it "due" would be a lie, and a plan that told a reader who had
not opened a page to "review fifty-two questions" would be nonsense
rather than advice.

### The course, offline

The course is computed in the browser and the progress file is in local
storage, so it can be read with no network at all. The service worker
precaches the whole build — the build writes a manifest of every file it
produced, and the worker reads it — so a lesson that has never been opened
is available too.

The test runs against the published build rather than the development
server, because the worker is registered only in a published build. It
checks three things: that the course opens with the network switched off,
that a lesson that was never opened is there, and that a laboratory still
computes.

The worker had to be written around one detail worth recording: the server
sends `Vary: Origin`, and a module script is fetched with the
`crossorigin` attribute, so the request that asks for a file carries an
`Origin` header that the one that cached it did not. A cache match that
honours `Vary` therefore misses every asset, and the course fails to start
with no network. The match ignores `Vary`, which is correct here because
the file names contain a hash of their contents.

### Forced colours

Windows has a high-contrast mode, and a reader can turn it on for the whole
system. The browser then replaces the palette with the system's own.

The interface holds its shape — the suite checks that nothing overflows and
that the layout has not collapsed — but anything that carried its meaning
in a *background* colour loses it. The selected state of a segmented
control and the on state of a switch were both carried by a fill.

The fix is to carry those states in something the system palette keeps: the
system selection colour. The suite emulates the mode and checks that a
selected tab, a switch that is on, and the focus ring are all still
visible. WebKit cannot emulate the mode, so the tests are skipped there.

### The error boundary

A data router catches an error in a route itself, before any boundary above
it sees it, so a route that throws would reach the router's own plain error
page rather than the course's. The router therefore has an error element of
its own, and the end-to-end suite visits a development-only route that always
throws to check that the reader gets the course's message — with a way back —
rather than a blank screen.

The component tests check the notice itself: that it says what happened, that
it says that nothing was sent anywhere, that it copes with something that is
not an error, that it offers to try again when it can, and that the
boundary catches a child that throws.

### The self-explanation exercise

Every lesson ends with one question the reader answers in their own words
before the model answer is shown. The component tests check that the answer
is hidden until the reader asks for it, that both the model answer and the
mistake to check against are shown, that what the reader wrote is kept, that
the rating is recorded in the progress file, and that the answer is still
there when the reader comes back.

The content test is the one that matters. It asserts that every lesson has
a prompt, that every prompt has a model answer of a reasonable length and a
common mistake to check against, and that every prompt asks for a mechanism
rather than a fact. A prompt without a model answer is not a weaker
exercise: a 2025 meta-analysis found that the advantage of retrieval
practice over elaborative encoding was conditional on feedback, and reversed
without it.

### The interleaving order

The practice set never puts two questions of the same lesson next to each
other. The unit tests check that every item survives the mixing, that the
order within a lesson is kept, that a large lesson is spread over several
passes, and that the result is deterministic. The end-to-end test reads the
lesson of every question in the map and checks that no two neighbours
match.

### The mastery estimate

A question that was answered correctly once, in passing, a week ago is not
mastered; one that has been recalled correctly four times over a month is.
The estimate combines the run of correct recalls, the ease factor, and how
long ago the question was last seen. The unit tests check that each of the
three moves the estimate in the right direction, that the half-life halves
the estimate over a month, and that the estimate never leaves the range from
zero to one.

### The view transition

The pages are loaded on demand, so a navigation has to wait for the new page
to arrive before the old one is taken away. The end-to-end suite checks that
the change of page goes through a view transition where the browser has the
View Transitions API, and that it does so for a page that has to be fetched
first — the transition must animate from one real page to another, not from a
page to a loading screen.

The test is skipped in a browser without the API, because there the page
changes in the ordinary way and there is nothing to check.

### The progress file

The progress file is a convenience, and the browser is allowed to refuse it.
Firefox throws `NS_ERROR_FAILURE` when the storage is disabled or full, and
a browser in private mode may refuse without a word. Neither may take the
course down with it, so a failed write is reported and the reader carries
on. This was found by the end-to-end suite rather than by reasoning: an
unguarded `setItem` in the progress provider brought the whole application
down in Firefox during a run.

### The command palette (`src/components/layout/CommandPalette.test.tsx`, `src/core/fuzzy.test.ts`)

The palette is a modal dialog built on the platform's own `<dialog>` element,
so the browser traps the focus, closes it on Escape, puts it in the top layer
and marks the rest of the page inert.

The matching is tested in `src/core/fuzzy.test.ts`, and the rules it
follows are the ones a reader would state out loud:

- A match at the start of the text beats one in the middle of it.
- A match that starts a word beats one that starts inside a word.
- Characters that follow each other beat characters that are scattered.
- A shorter text that matches beats a longer one.
- **Every word of a multi-word query has to match.** This one earned its
  place: without it, the query "light theme" put "Sinusoidal positional
  encoding" above "Switch to the light theme", because the letters of
  "light" happen to appear in order inside the first of those.

The component tests then check that the palette is a dialog, that it offers
its commands when nothing has been typed, that it finds a command by a word
in its title and by one of its keywords, that it finds a lesson by a fragment
of its title, that it says so when nothing matches, that choosing an entry
runs it, and that the arrow keys move the selection.

### The modern CSS layer (`e2e/layout.spec.ts`)

The stylesheet uses five modern CSS features, and the suite checks that each
one is actually in effect rather than merely present in the file:

- A heading is wrapped in `balance` and a paragraph in `pretty`. The
  assertion for `pretty` is conditional: it is newer than `balance` and
  Firefox 157 does not have it yet, so where the browser lacks it the
  declaration is dropped and the paragraph wraps the ordinary way.
- A laboratory lays itself out by its own width. The sampling laboratory has
  two columns at a 1440-pixel window and one at 700 pixels, and the test
  reads the number of grid tracks to check it.
- The reading progress bar is driven by a `ScrollTimeline` where the browser
  has scroll-driven animations, and is simply an empty track where it does
  not. The bar is `aria-hidden`, because the in-page outline already says
  which section the reader is in.
- A panel that holds the focused control is outlined, so the reader can see
  which part of a long interface the focus is in.

**No lesson changes its height while it is being read.** This is the test that
rejected `content-visibility: auto`. The property was applied to the lesson
sections, and the test found that the Transformer lesson changed height by
404 pixels in WebKit while it was being read, and that the in-page outline
stopped tracking the reader in Firefox. The property was removed and the
test kept, so it cannot be reintroduced by accident.

### Saving and restoring a configuration

The laboratories record their settings as a flat record of primitives, because
the record has to survive a round trip through JSON in the progress file. The
`components/lab/settings.ts` module reads that record back into typed state,
falling back to the laboratory's default when a key is missing or has the wrong
type, so an old or hand-edited configuration can never leave a laboratory in an
impossible state.

The playground passes the loaded settings to the laboratory and gives it a
`key` derived from the configuration, so the laboratory remounts and takes the
stored values as its initial state. Before this, a saved configuration was
*displayed* but not *restored* — the callout even said so. The end-to-end suite
now checks the whole round trip: change a temperature, save it, open it from
the dashboard, and the slider comes back with the saved value.

### The learning loop (`e2e/course.spec.ts`)

- **No page logs an error while it is being used.** Eleven routes are visited
  and any console error or uncaught exception fails the test. This is what
  caught the render loop described below.
- The landing page introduces the course and links the six modules.
- The Explorer recomputes a forward pass from user input; changing the
  tokenisation mode changes the number of units.
- The causal mask toggle explains future-token leakage and the reset button
  restores the documented default.
- The softmax walkthrough reports a normalised weight inside one row.
- The sampling laboratory is deterministic for a fixed seed and reacts to a
  change in temperature.
- **The tokenizer prediction exercise is checked against the tokenizer**: the
  learner commits to an answer, and the real segmentation is revealed.
- **The explorer can split attention across heads**: the head dimension changes,
  the figures become per-head, and the callout about the `1/√d_head` scaling
  appears.
- **The explorer shows the whole block, not only the attention part**: the
  residual connection, the normalisation, the feed-forward hidden activation
  and the block's output are all inspectable.
- **A technical term in the prose opens its definition**, and Escape closes the
  panel and returns the focus to the term.
- **The dashboard shows a learning path with a reason.**
- **The course search reaches the objectives of a lesson.**
- **The sampling, alignment, learning and inference laboratories ask the
  reader to predict.** All five laboratories now carry a prediction exercise.
- **The in-page outline links to real anchors and tracks the reader**: every
  outline link resolves to an element that exists, and the highlight follows
  the section in view.
- **The skip link moves the focus without leaving the lesson.**
- **No page scrolls sideways on a phone.** Thirteen routes are measured at a
  390-pixel viewport, and the document must not be wider than the viewport.
- **The keyboard shortcuts panel opens and closes.**
- **The search results can be reached with the arrow keys.**
- **The search results highlight the words that were searched for.**
- **The module page names the misreadings readers bring to it.**
- **The course home does not download the laboratories.** The routes are split, so
  the 561 kB chunk holding the laboratories, the charts and the mathematics
  typesetting is fetched only when a laboratory is opened.
- **The dashboard counts the concepts covered, not only the lessons.**
- **The concept map shows a module and the terms it depends on.**
- **A lesson prints to a clean document.** (Chromium only: PDF generation is
  Chromium-only in Playwright.)
- **A saved configuration is restored into the laboratory**: the controls come
  back with the stored values, not their defaults. A second case covers the
  inference laboratory, where the view *and* the layer count are restored.
- **The module page points at the next ready lesson.**
- **The landing page names the next lesson for a returning reader.**
- **The practice set can be narrowed to a single lesson.**
- **The practice page links each question to the lesson that teaches it.**
- **The practice page offers the weakest module once something has been
  answered.**
- **The pages meet the WCAG A and AA criteria, in both themes.** Eight routes
  are audited with axe-core in the light and the dark theme — sixteen audits
  per browser. The audit waits for the entrance animations to finish first,
  because a contrast check taken while an element is still fading measures
  the blend with the background rather than the colour the reader sees.
- **The colour scheme survives a reload.**
- **The playground follows the address bar and the browser history**: switching
  laboratories writes the choice into the URL, and Back and Forward move
  between laboratories.
- A laboratory named directly in the address opens on that laboratory.
- The practice page grades an answer, explains it, and survives a reload.
- Completing a lesson updates the progress and the dashboard export.
- Course search is keyboard reachable and finds a lesson.

The suite runs in **Chromium, Firefox and WebKit** — the three engines the
project is most likely to meet in the wild. The Firefox run found one timing
problem — the accessibility audit is slow enough to exceed the default per-test
timeout — which is now given an explicit budget. Two tests are Chromium-only:
the screenshot capture and the PDF generation, since Playwright only generates
PDFs in Chromium.

### Colour contrast (`tools/contrast.mjs`)

A separate checker computes the WCAG contrast ratio for every foreground and
background pair the interface can produce, including the translucent accent
tints (`text-teal` on `bg-teal/10` and friends) and the progress-bar fills
against their track. It runs 112 checks across both themes and exits non-zero
if any pair fails, so it can be used as a gate:

```
npm run contrast
```

This is the tool the palette was designed with. Picking colours by eye and
checking them afterwards produced a palette that failed; solving the ratios
directly and then confirming with axe-core produced one that passes both.

## Defects found and fixed during this revision

An independent audit of the core modules against the source PDF was run over
the whole of `src/core`. It reported 12 correctness issues, 3 wrong equation
references, a set of test coverage gaps and one place where a model component
was faked. The significant ones:

| Severity | Defect | Effect on a learner | Fix |
| --- | --- | --- | --- |
| Critical | A neighbour index outside the axis range wrote `NaN` into the retrieval query vector. | Every similarity became `NaN`, so the prompting laboratory retrieved **no passages at all** for its own default query, and the similarity heatmap showed `NaN`. | The adjacency table was rewritten to be symmetric and range-checked, the expansion now iterates to a fixed point, and every entry is guaranteed finite. |
| High | `matmul` treated a 0-row matrix as `0×0` and threw. | The flagship Explorer **crashed** on an empty input box. | `matmul` returns an empty product for an empty left operand, and the Explorer reports an empty state instead of failing. |
| Medium | `trainStep` reported a loss that was not the loss whose gradient it computed: the L2 penalty was divided by the batch size and evaluated after the update. | The learning laboratory showed a loss that could not be reconciled with the loss the curve was plotting. | The step loss is now evaluated on the pre-update weights with the same convention as `evaluate`, and a test asserts the two are equal. |
| Medium | Multi-head attention silently dropped hidden dimensions when the head count did not divide the model dimension. | Two of eight coordinates were never attended to, with no indication. | Heads now distribute the width as evenly as possible and the merge is asserted to restore the full width for every head count. |
| Medium | The toy vocabulary contained six duplicate surfaces. | Six token ids were unreachable, and the displayed vocabulary size was wrong. | The duplicates were removed and a test asserts one id per surface. |
| Medium | The default subword piece limit made eleven vocabulary entries impossible to produce. | Words like `embeddings` and `tokenizer` shattered into near-character sequences, which is not what greedy longest-match does. | The default cap is now large enough for the longest entry, and an explicit shorter cap is still respected and tested. |
| Medium | The Explorer's output projection ignored the model's own unembedding matrix and used a hand-written rule with a magic "first 48 entries" prior. | The next-token distribution was partly determined by an arbitrary constant, and the learned-looking matrix was unused. | The projection is now a real matrix product against `Wo`, with the static frequency prior reported as a separate term. |
| Low | The reasoning dataset did not demonstrate its own claim: outcome supervision reached the same 100% step accuracy as process supervision. | The lesson claimed a gap that the data did not contain. | The dataset was redesigned so the failing solutions read coherently and confidently, and the claim is now measured by two metrics that actually separate the regimes: the score of the *sound* steps in a failed solution, and the credit spread inside a failed solution. |
| Low | The SFT run reported a DPO-style preference probability. | The number on the screen was the wrong quantity for the objective being optimised. | SFT now reports `π(chosen)`, the quantity its objective maximises. |
| Low | The attention mask assumed a square score matrix. | The cached-decoding case would have produced `NaN`. | A separate mask builder handles the non-square case; a test covers it. |
| Low | `creditSpread` was documented as a mean-centred credit but computed a range. | The code did not do what its documentation said. | The documentation now describes the range, and the mean, max and min are reported too. |

Three equation references were wrong and have been corrected: Eq. 5.13 is in
§5.1.2 rather than §5.1.1; the Bradley–Terry sigmoid identity is Eq. 4.35
while Eq. 4.36 is the reward-model loss; and the KV-cache size bound is in
§2.3.4 while §2.3.3 introduces the concept. The full table is in
[SOURCES_AND_LICENSING.md](SOURCES_AND_LICENSING.md).

Two rendering defects were also fixed: an unbounded render loop in the
progress context (the lesson page recorded a visit in an effect that depended
on a context function whose identity changed on every progress update, and a
visit writes a new timestamp — the effect therefore re-fired forever), and a
silent LaTeX escape that was being eaten by a JavaScript template literal.

A third defect was found by reading the captured screenshots rather than by a
test: **the playground ignored the `?lab=` parameter except on the first
render.** The selected laboratory was read in a `useState` initialiser, so
pressing Back after switching laboratories left the previous laboratory on
screen while the address bar named the other one. The laboratory is now
derived from the URL, and two end-to-end tests cover both the direct-address
and the history case.

### Accessibility defects

An automated axe-core audit, run over eight routes in both themes, found five
distinct problems, all of which are now fixed:

| Problem | Effect | Fix |
| --- | --- | --- |
| Text colours failed WCAG AA contrast | 35–183 elements per page failed the 4.5:1 requirement — the secondary "faint" text, the accent-coloured labels, the accent text on its own 10% tint, and the rose and amber headings. | The palette was re-derived from the required ratios using `tools/contrast.mjs`, and the tokens now pass 112 programmatic checks as well as the automated audit. |
| Progress bars had no accessible name | `role="progressbar"` elements announced as an unnamed progress bar. | The bar takes an accessible name from its label, a new `ariaLabel` prop, or a tone-specific fallback, and exposes `aria-valuetext`. |
| KaTeX's display formula was a scrollable region that could not be reached from the keyboard | A wide formula could not be scrolled without a mouse. | The generated markup gives the scrollable span a tab stop and a name. |
| A link inside a paragraph of text was distinguished by colour alone | The arXiv link on the sources page was not identifiable as a link without relying on its colour. | The link is now underlined. |
| Interactive controls relied on a hairline border to be identified | An input's edge was only 1.4:1 against the panel, well under the 3:1 that WCAG 1.4.11 asks of the boundary of a control. | A dedicated `--control` token meets 3:1 against every surface, and is used for the borders of inputs, textareas, selects and radio groups. Decorative hairlines are unchanged. |

The audit also exposed a **duplicated theme bootstrap**: the pre-paint script
in `index.html` and the one in `src/main.tsx` could disagree, and only the
latter honoured the operating system's colour-scheme preference. The two have
been consolidated into the `index.html` script, which now decides the theme
once — stored choice first, then the operating system — and the application
reads the result back out of the document element.

Two navigation defects were found by writing the end-to-end tests for the
in-page outline, and both were pre-existing:

| Defect | Effect | Fix |
| --- | --- | --- |
| The outline linked to `#exercise` and `#worked-example`, but no element had those ids | Two of the six outline entries did nothing. | `InteractiveExercise` and `WorkedExample` take an optional `id`, and every lesson body gives its first exercise and worked example the anchor the outline expects. |
| The application uses a hash router, so a plain `href="#section"` replaces the whole fragment | **Clicking any outline entry navigated away from the lesson**, and the skip-to-content link did the same. | Both links now scroll the target into view and update the fragment with `history.replaceState`, which does not trigger a route change. The skip link moves the focus to the main region, which carries `tabIndex={-1}` so the focus can land there. |

A later audit of the same kind found that the *fix* above was only half right.
It stopped the outline from leaving the lesson, but it wrote the address as
`#section` — which is the route in a hash router, so the link it produced
could not be reloaded or shared. Clicking an outline entry and then reloading
the page took the reader to the page that says the address is not part of the
course.

The same mistake was still in the **"How settled is this?"** page, and there it
was worse: that page's own table of contents used bare `href="#module"`
anchors, so clicking one took the reader out of the course entirely, to the
error page. A reader who wanted to jump to a module was instead told the
address was not part of the course.

Both are fixed by the same idea, which is now a small module of its own
(`src/core/fragments.ts`, with thirteen tests): a fragment is *appended* to
the route rather than replacing it, so the address of a section is
`/#/lessons/pretraining-bert#attention` — still a course address, still
reloadable, still shareable. The end-to-end suite now checks both properties:
that a reader who clicks a section stays on the course, and that the address
it leaves behind can be reloaded.

Three more defects were found by looking at the parts of the course the
audits did not reach:

| Defect | Effect | Fix |
| --- | --- | --- |
| The accessibility audit covered eight routes, and none of them was the dashboard, the review session or the status page | A contrast failure on the dashboard was invisible to the audit for as long as the audit existed. | The audit now covers twelve routes in both themes, and the four pages that were added last are among them. |
| The study plan dimmed the items that did not fit the reader's time with `opacity-70` | Opacity is applied to the whole item, so it lowered the contrast of the text *inside* it below the threshold, and the audit found it. | The opacity is gone. The item is already distinguished by a dashed border, a "for later" badge, and a muted title, which is three signals where one was doing the work and failing. |
| The focus stayed on the link the reader had followed | A screen reader announced nothing, because a single-page application changed the page without the browser doing anything about the focus. | `usePageFocus` moves the focus to the new page's heading after a route change, waiting for the heading to arrive because the pages are loaded on demand. The first page is left alone, because taking the focus there would be taking it from the reader. |

The status page was also found to be unreachable from the navigation — it was
linked from the home page and from the search, but not from the sidebar that
a reader actually browses. It is in the sidebar now, and the command palette
can take them there too.

And in looking for that, a fourth copy of the list of pages turned up. The
set of pages was written down in four places — the router, the navigation,
the search and the accessibility audit — and the four had drifted apart.
The status page was missing from the search. The command palette's commands
were written out one at a time, so a new page would not have appeared in
them, and one of them had begun to lie about the number of questions in the
course. The layout suite kept its own hand-written list of the eighteen
lesson ids, so a lesson added to the course would not have been checked for
the layout shift it might have caused.

All four now read one list, in `src/content/routes.ts`. The router is built
from it, the navigation and the search and the palette take their entries
from it, and the audit visits the pages it names. A test asserts that the
list and the loaders agree in both directions, so a route with no page behind
it and a page that nothing leads to are both failures.

The Sources page now says what the status page's citations are. It is the
page about attribution, and it was not mentioning the twenty-one primary
papers the course cites for its currency, which is a gap in the one place a
reader would look for it. The count is taken from the data, so it is the
number of papers the course cites.

The status page's own words are in the search now. A reader who
half-remembers a phrase — "brevity bias", or "context collapse" — found
nothing at all, because the page that carried those phrases was not in the
index. It is now, module by module, and a test checks that a phrase named
only on that page can be found.

Printing was the next place the same care was needed, and it turned up two
more defects. The print stylesheet hid every `aside` element to remove the
in-page outline, and that also removed the source references of a lesson, the
definitions on the glossary and the explanations on the mathematical
reference. A printed lesson with no source references looks complete and is
not. What is chrome is now marked as chrome, with `data-print="hidden"`, and
a test asserts that a printed page keeps its content and loses its
interface.

The second defect was found by writing that test. The glossary and the
mathematical reference kept the thing being read in state, initialised from
the address once — so a reader who arrived at a link to a particular term or
formula saw the list with nothing selected, and the back button did nothing.
The practice page had the same pattern for its two filters, and a worse
version of it: changing one filter wrote the address out afresh and quietly
dropped the other, so narrowing to a lesson and then choosing a different
question set lost the lesson. All three now read the address rather than
holding a copy of it, which is what the playground had been doing all along,
with a comment saying why.

The lesson pages now carry the answer to "how settled is this?" with them.
A lesson says what is taught; the panel beside it says how much weight to
put on that, and takes the reader to the sources for the module. Writing
that link found a bug in the fragment handling: the reader landed at the top
of the status page instead of at the module, because the fragment was being
read in the browser's form — the one with the route still on the front —
and not the router's, which has the route already off it. Both forms are
read now, and both are tested.

A third defect was found by measuring the layout at phone width: **the lesson
and playground pages were 700 pixels wider than a 390-pixel phone.** The grids
in the laboratories declared their columns only at a breakpoint, so below it
they fell back to *auto* tracks, and an auto track is sized to the minimum
content width of its items. The Explorer's stage list is a non-wrapping flex
row, so its minimum content width was the sum of the nine stage buttons, and
that width was propagated up through every ancestor grid. Sixty-three grid
declarations across seventeen files now carry a base `grid-cols-1`, which is
`minmax(0, 1fr)` and lets the track shrink. Every route now measures zero
horizontal overflow at 390 pixels, and the end-to-end suite asserts it.

## Coverage and limitations

### What the tests do not cover

- **The visual comparison covers ten pages and one engine.** Ten pages are
  compared against committed baselines with a two per cent tolerance, in
  Chromium. A change to a figure that is not on one of those pages, or a
  difference that only appears in another engine, would not fail a test.
- **No screen-reader testing.** The automated audit checks the accessibility
  tree, not how a screen reader announces the course. A manual pass with
  VoiceOver and NVDA would be worth doing. The focus is now moved to the new
  page's heading after a route change, which is the behaviour a screen reader
  needs in order to say anything at all, but that the announcement itself
  sounds right is not something a test can check.
- **The accessibility audit covers the pages and the states it names.** Twelve
  routes in both themes, and five states that a reader meets more often than
  the default state of a page: a question that has been answered, the command
  palette with results in it, the list of shortcuts, the transformer explorer
  and the definition panel. A state that is not named is not audited, and the
  states are where the defects were — the contrast failure on the dashboard
  was in the default state of a page that had never been audited, and the
  dimming in the study plan was in a state that only appears once the reader
  has chosen a time budget.
- **The end-to-end suite covers Chromium, Firefox and WebKit.** The third
  engine was added because Safari is where a layout or CSS difference is most
  likely to matter. Some tests are Chromium-only: the screenshot capture and
  the PDF generation, since Playwright only generates PDFs in Chromium; the
  visual comparison, because a difference in font rendering would otherwise
  fail it everywhere; and the forced-colours tests, because WebKit cannot
  emulate that mode. A fourth project runs the offline tests against a
  published build, because the service worker is only registered in one.
- **The core is not exhaustively covered.** The property-based suite checks
  invariants over randomised inputs, but it is not exhaustive: it shows that
  the implementations agree with reference implementations and hold their
  invariants on the inputs tried. Coverage percentages are not enforced as a
  gate.

### Known gaps worth closing

- **Now closed.** Ten pages are compared against committed baselines with a
  two per cent tolerance, and the baselines are refreshed on purpose with
  `npm run screenshots`. The tolerance was checked by breaking the landing
  page on purpose: a heading that grew by a size step moved 60,066 pixels and
  the test failed.
- The alignment laboratory would benefit from a test that the DPO loss
  decreases monotonically when the policy is moved along the preference
  direction by hand, rather than only through the optimiser. **This is now
  covered** by the property-based suite, which moves the policy by hand and
  checks the loss at every step.
- A randomised cross-check of `matmul` and `attention` against reference
  implementations. **This is now covered** by the property-based suite.
- Full-text search over the lesson prose. The search already reaches lesson
  titles, subtitles, objectives, key ideas, glossary definitions and formula
  explanations, which together index every lesson well. Reaching the prose
  itself would mean rendering all eighteen lessons in the browser at start-up,
  which costs more than the recall is worth.
- **The accessibility audit is a list of pages, and the list can fall behind.**
  The pages added last were the ones missing from it, and the contrast failure
  that was found lived on one of them. A route that is added without being
  added to the list is a route that is not audited.
  **This is now closed.** The pages of the course are declared once, in
  `src/content/routes.ts`, and the router, the navigation, the search, the
  command palette and the audit all read that one list. A page added to the
  course is audited, findable and reachable, because being added to the
  course means being added to that file. The same drift was in three other
  places — the navigation, the search and the command palette each kept their
  own list of pages — and all four are now the same list.
  The layout suite had the same problem with the lessons: it kept a
  hand-written list of the eighteen lesson ids, so a lesson added to the
  course would not have been checked for the layout shift it might have
  caused. It reads the curriculum now.
- The study plan tells the reader what does not fit the time they have, but
  it does not reorder it for them: the items that fit come first and the
  others are marked as being for later. Whether the order should instead
  follow the plan's own priority is a question about how a reader uses the
  panel, and the answer is not known.

## Reproducing this report

```bash
git clone <this repository>
cd llm-foundations-lab
npm install
npx playwright install chromium firefox webkit

npm run typecheck   # expect: no output
npm run lint        # expect: Found 0 warnings and 0 errors
npm run contrast    # expect: 112 checks, 0 failures
npm run test        # expect: Test Files 35 passed (35), Tests 551 passed (551)
npm run test:e2e    # expect: 237 passed, 10 skipped
npm run build       # expect: built in ~2s
```
