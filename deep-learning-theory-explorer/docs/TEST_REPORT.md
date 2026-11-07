# Test report

This is the honest record of what is tested in this repository, what the tests
actually check, and what remains untested.

Recorded on the branch `feature/deep-learning-theory-explorer`.

---

## 1. How to run the suites

```bash
npm test          # Vitest: 40 files, 387 tests (386 pass; one needs the network)
npm run test:e2e  # Playwright: 33 files, 166 tests (Chromium)
npm run build     # tsc -b + vite build
```

`npm run test:all` runs all three in order. `npm run typecheck` is the same
`tsc -b` the build starts with; it is a separate command because the build stops
at the first error, so a type error is quicker to read on its own. It used to
pass `--noEmit false --emitDeclarationOnly false`, which contradicts
`allowImportingTsExtensions` — the command exits with TS5096 — and compiled
`.js` copies of the sources sat beside them in the tree, left behind by an
emit. It is now the plain build, and the copies are gone.

---

## 2. Unit, numerical and component suite (Vitest) — 387 tests, 386 passing






| File | Tests | What it covers |
| --- | --- | --- |
| `tests/mlp.test.ts` | 24 | Forward propagation, initialization statistics, analytic gradients vs finite differences, the exact deep-linear kernel recursion, criticality of the ReLU, the linear-in-depth fluctuation law, the NTK as a Gram matrix, the two-layer NTK closed form, training |
| `tests/kernel-theory.test.ts` | 18 | Activation derivatives vs finite differences, `g(K)` against closed forms, the integration-by-parts identity, both susceptibilities, the critical points, the monomial obstruction — both from the algebra and from the scanner, for every `p` — which failure kind each activation that cannot be critical reports, the kernel flow, the `K = 0` power law, and that the number the page prints is the number the code computed |
| `tests/quadrature.test.ts` | 7 | Gauss–Hermite and bivariate quadrature against an independent rule; covariance validation |
| `tests/optimizers.test.ts` | 10 | The three update rules term by term, the monotonic-descent guarantee, divergence detection, reproducibility, option validation |
| `tests/objectives.test.ts` | 10 | The read-out loss and gradient vs finite differences, the least-squares solution, the `η < 2/λ_max` threshold, the closed-form loss prediction, the non-convexity of the hidden slice, the numerical Hessian, surface evaluation, argument validation |
| `tests/experiments.test.ts` | 28 | The six experiment runners: shapes, reproducibility, agreement with the theory, error handling, which kind of criticality failure the initialization runner reports with the number it computed, the Gram identity between the displayed Jacobian and the displayed kernel, the consistency of the displayed forward-pass matrix with the plotted kernel, and the equivalence of the pausable generator with the one-shot run |
| `tests/representation.test.ts` | 15 | The generated datasets, PCA against a rotated cloud, the Fisher ratio, feature and kernel drift, the effective rank, the eigensolver |
| `tests/persistence.test.ts` | 10 | Round-trip through `localStorage`, corrupt payloads, foreign payloads, a disabled store, the quiz score, and a browser that refuses to store the record |
| `tests/components.test.tsx` | 18 | React Testing Library: the guided exercise checks the learner's value against the computed one and reports correctly; the preset banner; KaTeX rendering, inline math inside prose, the fact that prose is escaped rather than injected; a clickable term opens its definition and closes on Escape; the shell components, and the dimming of a result that belongs to the previous settings |
| `tests/content.test.ts` | 27 | The curriculum inventory, cross-references, exercise answers, quiz validity, equation completeness, preset completeness, the source citation, the terminology registry and every `[[term]]` reference in the prose, every live lesson figure (and that no registered figure is left unused), and the activation registry against the criticality scanner |
| `tests/exercises.test.ts` | 15 | The computed exercise answers: every entry is finite, the closed form and the numerical scanner agree, the three tanh power-law estimates are ordered as the theory requires, the NTK trace ratio is recomputed independently, and every prose answer quotes its computed value |
| `tests/shared-setup.test.ts` | 12 | The shared setup encoding: an exact round trip of every field and of the defaults, a compact string, a decoder that treats a link as untrusted input — unknown activations, unknown distributions, malformed and out-of-range numbers are refused — the query-string and URL forms round-tripped through a real URL parser, and the range check that every path into the setup goes through: a link, a pasted record and a button alike |
| `tests/export.test.ts` | 5 | The CSV export: quoting of commas, quotes and newlines, empty fields, the numbers as written, and the provenance preamble |
| `tests/search.test.ts` | 15 | The global search: a lesson is found by title, terms and equations and questions and experiments are found by body, a title match outranks a body match, a short or non-matching query returns nothing, the words of a query are matched one by one so that a reader who remembers them in a different order still finds the page, and every word of the query has to be present |
| `tests/quiz-answers.test.ts` | 7 | The assessment's numbers: every quoted number is recomputed from first principles, the option the answer key points at must state the same number, and the explanation must mention it |
| `tests/gp.test.ts` | 11 | The Gaussian-process limit: the linear solver (exactly, on a larger system, and refusing a singular one), the RBF kernel, and the posterior properties — it interpolates the data when the noise is small, its uncertainty collapses at the observations and the prior is recovered far away, and a short length scale follows the data more closely |
| `tests/atlas.test.ts` | 8 | The self-test and the theory atlas: every check passes, every concept has a reference that resolves, a concept marked 'computed' links somewhere live, and the concepts from outside the monograph carry an external reference |
| `tests/hooks.test.tsx` | 5 | The computation hook: the first computation runs on mount, a burst of dependency changes produces one computation rather than five, an error is reported rather than thrown, a manual re-run works, and nothing is computed until asked when auto is off |
| `tests/confirm-dialog.test.tsx` | 9 | The confirmation dialog for the one irreversible action: it states what will be lost, refuses to act until the destructive choice is made, treats Escape as "no", moves the focus into the dialog so the keyboard cannot wander behind it, and renders nothing when closed; and the small-screen section strip: the same links as the rail, the current section marked, the first link reachable by keyboard |
| `tests/plotly-bundle.test.ts` | 2 | The charting bundle: the traces the code draws and the traces the bundle registers are compared, so a trace that is drawn but not registered — which would simply not appear — fails the build rather than the reader's screen |
| `tests/worker.test.ts` | 10 | The Web Worker path: the worker and the main thread return identical results for every runner, a failing runner reports its error rather than hanging, the registry stays the single source of truth, a worker that dies mid-measurement still yields the number, and the two-layer NTK comparison the lesson figure draws gets better as the network widens |
| `tests/study-plan.test.ts` | 11 | The study plan: the next step is derived from the record rather than from a fixed list, a lesson whose prerequisites are unread is not recommended, a solved exercise is not recommended again, the plan suggests an experiment before the assessment, it labels every kind of step, it is deterministic for a given record, it reaches the end of the curriculum and then says what to review, the progress fraction counts each kind of work once, and the plan knows how long it is |
| `tests/palette.test.ts` | 5 | The two copies of the palette: the same tokens in both themes, the JavaScript mirror in step with the CSS including the signal colours, both themes exposed, and every token given a paper value so that nothing prints dark on white |
| `tests/claims.test.ts` | 8 | The claims the README makes, checked: every laboratory carries a limitation callout, records the seed of the run it logs, offers its numbers as a CSV, names the lessons it demonstrates, and does not compute on the main thread inside a render |
| `tests/order-one-numbers.test.ts` | 7 | The order-one numbers: the scanner finds 1, 2 and 1.98 for the linear, ReLU and leaky-ReLU activations, the lesson says exactly those numbers, the scanner reports distinct critical points rather than every wobble of the curve, the trivial fixed point is labelled as such, the sigmoid has one unphysical root and the softplus none |
| `tests/feature-drift.test.ts` | 7 | The feature-drift claim: the drift falls as the network widens at the step size the application uses, the numbers the lesson and the gallery quote are the ones measured, the class separation is best in the middle as the lesson says, the ordering reverses at a large step size — which is why the claim is stated with its caveat — and the trend is not an artefact of one seed |
| `tests/recipes.test.ts` | 3 | The reproducibility recipes and the presets they describe: every preset has a recipe, every recipe states the settings the application actually uses, and every setting the preset uses is stated |
| `tests/share-links.test.ts` | 4 | The two kinds of link the application has: the shared setup in the query before the hash, and the gallery preset in the router's query inside it |
| `tests/gallery.test.ts` | 4 | The gallery's numbers: the arithmetic of its expectations is checked, and the relative NTK error it quotes is recomputed with the same code the laboratory runs, so a preset cannot quote a number the application does not produce |
| `tests/live-examples.test.ts` | 5 | The live evaluations: every equation has one, for every activation the reader can choose, and the numbers agree with each other where the theory says they must — the NTK is the inner product of the parameter gradients to ten digits, the kernel prediction matches the real gradient step to a part in a hundred, and the weight variance is C_W/n |
| `tests/links.test.ts` | 4 | The links in the content: every atlas concept, every lesson, every term and every reading entry points at a lesson, a laboratory or an equation that exists |
| `tests/reading.test.ts` | 5 | The reading list as data: every entry has a unique id, a year, a group and a link — and names its authors rather than starting with the title — every group is covered, the monograph and the authors' overview are in it, the scaling-laws group keeps its three anchors, and every atlas concept that came from outside the monograph links to the paper it came from |
| `tests/readingAids.test.ts` | 9 | The reading page's aids: the filter by group, year and free text (the citation, the contribution and the place it is used are all searched), the year histogram keeps its empty years and adds up to the list, the sort order leaves the input untouched, and the curated paths resolve in the order they name and fail loudly on an entry that does not exist |
| `tests/collection.test.ts` | 12 | The collection data the overview panel draws: the course is in the collection, every course is named and has a distinct id, the successors exist and say why, the two lists describe a course the same way, the shared ideas point only at courses in the collection, and a link is a collection address rather than an in-app route |
| `tests/external-links.test.ts` | 2 | The external references: every one of them is checked against the network, so a reading list cannot rot — the check needs the network, so it runs with `NETWORK=1` rather than by default |
| `tests/contrast.test.ts` | 4 | The contrast audit of the tokens: every text colour clears the WCAG AA bar on the page background, the small uppercase labels clear it too, the signal colours are visible, and the panel borders are visible |
| `tests/chart-colours.test.ts` | 6 | The chart colours: every series colour is visible against the panel it is drawn on, no two series are the same line to a reader, and — with the colours as a deuteranope sees them — no two series are the same line to a reader with the most common colour vision deficiency |
| `tests/lab-registry.test.ts` | 7 | The laboratory registry: unique ids, names, routes and blurbs, a mounted screen for every entry, the lookup helpers it publishes, each declared item claimed once and nothing the manifest does not list, the list the shell really renders, the laboratories that mount the shared setup, and a lesson that reaches every laboratory |
| `tests/lab-screens.test.tsx` | 8 | The laboratory screens as the reader meets them: each is mounted the way the shell mounts it — at its own route, inside the theme and shared-setup providers — and is held to its heading and to the numbers it paints, so a screen that prints `NaN` fails here rather than on the page |
| `tests/drills.test.tsx` | 10 | The prerequisite drills: every tool the navigator lists has a drill, each one points at a screen the application serves, every drill is graded against a computation that exists and is finite, the tolerance is tight enough that the answer is not free, and the screen lists, accepts, explains on request and filters by tool |

### 2.1 The claims that are actually checked numerically

These are the statements the suite verifies, with the check that verifies them.






| Claim | Where it is checked | Tolerance / method |
| --- | --- | --- |
| The layer recursion `z^(ℓ) = W^(ℓ)h^(ℓ−1) + b^(ℓ)` | `mlp.test.ts` | compared against a hand computation to 12 digits |
| Weights are drawn with variance `C_W/n_in` | `mlp.test.ts` | within sampling error of the analytic variance |
| Analytic gradients equal central finite differences | `mlp.test.ts` | worst relative error `< 1e-6` over **every** parameter, for `tanh` and for `relu` |
| The exact deep-linear kernel `G^(ℓ) = C_W^ℓ G^(0)` | `mlp.test.ts` | ensemble mean within 15 % over 150 seeds; also checked at `C_W ≠ 1` |
| ReLU criticality at `C_W = 2` | `mlp.test.ts`, `kernel-theory.test.ts` | kernel ratio in `[0.75, 1.3]` at criticality; `< 0.2` at `C_W = 1.5`; `> 3` at `C_W = 2.5` |
| `Var[O^(ℓ)] = 2ℓ(G⁽²⁾)²/n` at criticality | `mlp.test.ts` | 400 seeded networks, three depths, within a factor `[0.7, 1.4]` of the analytic value |
| `g(K)` for the linear, ReLU, quadratic and `sin` activations | `kernel-theory.test.ts` | against closed forms and against an independent quadrature |
| `χ∥ = χ⊥ = A²C_W` for the scale-invariant class | `kernel-theory.test.ts` | equal to each other and to `A²C_W` |
| The critical points `(C_W, C_b) = (1,0)`, `(2,0)`, `(1,0)`, `(1,0)` | `kernel-theory.test.ts`, `content.test.ts` | found by the scanner to 3–6 digits |
| The sigmoid and the softplus cannot be tuned to criticality | `kernel-theory.test.ts`, `content.test.ts` | no physical critical point; the sigmoid's root has `C_b < 0` |
| The monomial obstruction `p/(2p−1) = 1` | `kernel-theory.test.ts` | reproduced from the algebra for `p = 2, 3, 4`, and measured with the application's own criticality ratio for `p = 2, 3, 4, 5`, where it is `p/(2p−1) < 1` at every `K` |
| `a₁ = −2` (tanh), `a₁ = −1` (sin) | `kernel-theory.test.ts`, `content.test.ts` | the Taylor coefficients are recovered from the second derivative |
| The `K = 0` kernel decays as `1/((−a₁)ℓ)` | `kernel-theory.test.ts` | the recursion follows the asymptotic law at large `ℓ` |
| The NTK is exactly the input Gram matrix plus one, for a single linear layer | `mlp.test.ts` | to 10 digits |
| The NTK is symmetric and positive semidefinite | `mlp.test.ts`, `experiments.test.ts` | asymmetry `< 1e-9`; the smallest eigenvalue is non-negative within tolerance |
| The two-layer NTK closed form | `mlp.test.ts`, `experiments.test.ts` | the relative Frobenius error falls as the width grows; `< 0.5` at width 256 |
| The Jacobian equals finite differences of the outputs | `mlp.test.ts` | worst relative error `< 1e-6` over every parameter and output |
| Gradient descent decreases the loss below the curvature bound | `mlp.test.ts`, `optimizers.test.ts` | the loss is non-increasing at every step |
| Gradient descent diverges above it | `mlp.test.ts`, `optimizers.test.ts` | the run is flagged and stops early |
| The `η < 2/λ_max` threshold | `objectives.test.ts` | equals `2/λ_max` of the measured read-out Hessian to 10 digits |
| The read-out gradient equals finite differences | `objectives.test.ts` | to 5 digits |
| The hidden slice is non-convex | `objectives.test.ts` | the Hessian determinant takes both signs over the slice |
| The `K = 0` class's criticality algorithm | `experiments.test.ts` | the scanner returns `C_W = 1` for `tanh` and `2` for the ReLU, and nothing for the sigmoid |
| The width/depth sweep reproduces the `2ℓ(G⁽²⁾)²/n` law | `experiments.test.ts` | the variance grows with depth and falls with width |
| The datasets are reproducible and well-formed | `representation.test.ts` | identical for identical seeds; one-hot labels consistent |
| PCA recovers the axes of a rotated cloud | `representation.test.ts` | the first component explains `> 90 %` of the variance; the projection is centred |
| The progress record round-trips and survives corruption | `persistence.test.ts` | corrupt and foreign payloads degrade to an empty record, never to a crash |
| The ReLU critical `C_W` from the closed form and from the numerical scanner agree | `exercises.test.ts` | the closed form gives 2; an independent scan of eq. (5.73) gives the same to 5 digits |
| The three tanh power-law estimates are ordered as the theory requires | `exercises.test.ts` | leading law < continuous approximation < exact recursion, all within 1 % of each other |
| Every exercise's prose answer quotes its computed value | `exercises.test.ts` | each answer contains a number within 1 % of the live computation |
| The displayed Jacobian is the one the kernel is the Gram matrix of | `experiments.test.ts` | `Θ = J Jᵀ` holds to 8 digits for every entry, using the same Jacobian the laboratory shows |

### 2.2 The curriculum is tested too

`exercises.test.ts` holds the numerical exercises to the standard of the
laboratory outputs: the answer to each guided exercise is not a string in the
content file but a *live computation* made by the same code the laboratories run
(`src/lib/exercises.ts`). The test asserts that every entry is finite, that the
closed form and the independent numerical scanner agree, that the prose answer
quotes the computed value, and that no exercise names a registry key that does
not exist.

`content.test.ts` treats the lesson and question banks as data with invariants:
ten lessons with a contiguous order and an acyclic prerequisite graph; every
exercise with a real answer and no placeholder text; every quiz question pointing
at a real lesson, with a valid answer index, distinct options and an explanation;
every lesson covered by at least one question; every equation with symbols,
assumptions, a derivation and a worked example; every cross-reference resolving to
a real route.

---

## 3. End-to-end suite (Playwright) — 166 tests: 155 passing, 11 skipped

Chromium only: the numerical core is plain TypeScript, so one engine is enough to
verify navigation, computation and persistence.

The eleven skips are tooling, not coverage: six screenshot captures, three more
in the print suite, and two service-worker checks. The captures run with
`CAPTURE=1`, and the service-worker checks with `PWA=1` against a production
build. Everything that runs by default passes.






| File | Tests | What it covers |
| --- | --- | --- |
| `e2e/navigation.spec.ts` | 16 | Every one of the fourteen routes mounts, renders its heading, reports no computation failure, and logs no console error; the navigation rail links correctly and the browser back button works; an unknown route falls back to the overview |
| `e2e/collection.spec.ts` | 2 | The collection panel on the overview: it draws every course the catalogue puts after this one, with its title and its reason, links each shared idea to the courses that teach it, states the catalogue's size, and every link it draws is a collection address rather than an in-app route |
| `e2e/labs.spec.ts` | 8 | Each laboratory actually computes something in the browser: the physics lab renders its layer-by-layer table and reports the scanner's critical `C_W`; changing a parameter changes the numbers; Lab A shows the ReLU critical point; Lab B renders the surface and the curvature panel; Lab C renders both sweeps and the aspect-ratio panel; Lab D renders the kernel, its spectrum and the symmetry defect; Lab E renders the representation panels; a recorded laboratory run appears in the dashboard experiment log |
| `e2e/assessment.spec.ts` | 8 | A multiple-choice answer is scored and the explanation revealed; revealing without answering does not score; a question that can be answered numerically is also answerable by choosing the option; a wrong option and a wrong number are both rejected; the score survives a reload; marking a lesson complete shows up on the dashboard and survives a reload; resetting the dashboard clears the stored progress, and a question answered wrongly is listed for review with its explanation |
| `e2e/explorer.spec.ts` | 3 | The term lookup finds symbols across the whole curriculum and opens the equation that defines them; the notation glossary is present and searchable; the live evaluation of a worked example recomputes when the activation changes |
| `e2e/presets.spec.ts` | 6 | A gallery preset loads into its laboratory: the banner appears with the hypothesis and the expected outcome, and the laboratory's own controls carry the preset's settings (the ReLU `C_W = 2`, the physics lab's depth and width, the representation lab's dataset, the optimization lab's objective slice); a link written by hand loads the same preset; and the setup the preset installs is shared with every other laboratory |
| `e2e/exercises.spec.ts` | 4 | A guided exercise accepts a correct value and records it; a wrong value is rejected with the computed value shown; the method used and the tolerance are stated; a solved exercise is counted on the dashboard |
| `e2e/interactive.spec.ts` | 3 | The representation run can be paused — the step counter does not advance while paused — and resumed; the run reaches the end and reports the width comparison; the NTK laboratory shows the parameter-gradient row and the per-layer gradient norms |
| `e2e/connective.spec.ts` | 7 | The connective tissue: a change in one laboratory is a change in every other; the shared setup survives a reload; a shared link reproduces the setup for a second reader in a clean browser; the dashboard shows the setup the laboratories are using; a term in the lesson prose opens its definition; the terminology is listed on the prerequisite navigator; the physics laboratory offers its numbers as CSV |
| `e2e/start-here.spec.ts` | 3 | The entry point: the overview offers a configured entry into the laboratory, an activation that cannot be critical says so, and the overview explains how the pieces connect |
| `e2e/shell.spec.ts` | 12 | The command palette opens with the keyboard and navigates with the arrows, searches the curriculum as well as the commands, closes on Escape, and keeps the focus inside itself while it is open; the shortcut list opens with `?`, closes on Escape, and stays out of the way while the reader is typing; the theme switches and is remembered; the development server is not served by a cache-first service worker; the theory atlas lists the concepts, filters them by principle, and separates the ones this application measures from the ones it only cites; and further reading lists the literature, filters it by group, and includes the concepts from outside the monograph |
| `e2e/reading.spec.ts` | 2 | The reading page's aids: the year histogram narrows the list to one year and clears again, and a chosen path lists its steps in the order it names and points back to the entry in the list |
| `e2e/search.spec.ts` | 7 | The global search finds a lesson and navigates to it, finds a term and opens the equation that derives it, finds a thing whose words the reader remembered in a different order, says so when nothing matches and suggests what to try, is opened with the keyboard and navigated with the arrow keys, finds the theory atlas concepts too, and does not flood the results for a one-character query |
| `e2e/dashboard.spec.ts` | 6 | The learner's own record: the erase action asks first, keeps the record when the answer is "no", erases it when the answer is "yes", treats Escape as "no", and keeps the focus inside the dialog; and the small-screen section strip: it shows the current section and can be scrolled to reach the sections off the right edge |
| `e2e/print.spec.ts` | 7 | The printed lesson: the page comes out as a document rather than a screenshot of the screen, the answers are on the paper even when they are folded away on screen, the navigation and the controls are not, the reader's notes are, and the chart is re-measured for the paper so it fills the page, and a laboratory prints as a lab sheet — the results and the settings, not the sliders |
| `e2e/privacy.spec.ts` | 2 | The privacy claim, tested against the network: every request the application makes goes to the origin it was served from, and nothing is ever sent by a method that could carry data |
| `e2e/keyboard.spec.ts` | 2 | The keyboard path: the first thing the keyboard reaches is a way past the navigation rail, and using it moves the focus to the content without disturbing the router |
| `e2e/pwa.spec.ts` | 2 | The service worker, against the production build: it registers, it caches the shell and the assets, the application still loads with the network off, and the assets of a superseded build are dropped when the shell changes |
| `e2e/performance.spec.ts` | 10 | The page never freezes: no lesson blocks the reader for more than 400 milliseconds of main-thread work, measured with a `PerformanceObserver` |
| `e2e/accessibility.spec.ts` | 23 | Every control on every route has an accessible name, computed the way a browser computes it — including the rule that a `<label>` binds to only the *first* control inside it, which left every slider unnamed; the headings do not skip a level; no page scrolls sideways on a phone; and the feedback that arrives after an action — an exercise verdict, an assessment explanation, the result of an import — is announced rather than appearing silently |
| `e2e/lab-lessons.spec.ts` | 4 | The connective tissue between a lesson and its experiment: a laboratory names the lessons it demonstrates, the link goes to the lesson it names, a lesson offers the further laboratories that make it concrete, and the physics laboratory names the lesson that points at it |
| `e2e/stale-results.spec.ts` | 2 | The numbers on screen while the next ones are computed: a laboratory says that the figures belong to the previous settings, and they are dimmed while they are stale |
| `e2e/curriculum-index.spec.ts` | 5 | The curriculum index as a map of the course: how far the reader is, which lesson comes next, that the next lesson moves on when one is read, which lessons are still locked behind a prerequisite, and the exercises worked |
| `e2e/experiment-log.spec.ts` | 2 | The experiment log: a recorded run keeps the settings it was made with, including the seed, and can put them back; and a pasted record cannot smuggle an impossible setting into the setup |
| `e2e/downloads.spec.ts` | 2 | Downloading the numbers: the self-test results and the assessment can both be downloaded, and the files carry the settings that produced them and the explanation of every answer |
| `e2e/self-test.spec.ts` | 3 | The self-test: it runs every check and reports what it measured, it checks the quadrature against an independent rule, and it says what a self-test is not |
| `e2e/capture*.spec.ts` | 6 | The screenshot tool, not a gate: one test per set of screens — the whole application, the dashboard, the lesson figures, the small-screen layout, the newly added screens, and both themes — plus three capture-only tests in `e2e/print.spec.ts`. Each is skipped unless `CAPTURE=1` is set, because regenerating pictures is a task, not a check |
| `e2e/figures.spec.ts` | 9 | The live lesson figures: a lesson renders its figure and the figure computes; a figure responds to its own controls; the power-law figure compares the exact recursion with the asymptotic law; the fluctuation figure reports the depth-to-width ratio; the non-Gaussianity figure compares widths; the NTK figure checks the closed form against the measurement; the feature-drift figure measures three real trainings; the Gaussian-process figure computes the infinite-width posterior; a figure does not leak into another lesson |

The end-to-end suite is what catches the class of bug that unit tests cannot: a
component that throws in the browser, a computation that never resolves, a control
that does not re-run the runner.

---

## 4. Bugs this test suite found

Recorded because it is the honest answer to "does the suite do anything?".






| Bug | How it was found | Fix |
| --- | --- | --- |
| `trainSync` recorded the loss *before* the update against the parameters *after* it, so the loss trajectory was off by one step | `optimizers.test.ts`: "the recorded parameters match the network and the loss is the real loss" | `optimizerStep` now returns `lossBefore` and `lossAfter`; the history stores the loss of the parameters it stores |
| `trainSync` accepted a negative or fractional step count and a non-positive learning rate, silently doing nothing | `optimizers.test.ts`: "rejects nonsense options" | `validateTrainOptions` rejects them with a message |
| `runPhysicsLab` accepted an undefined learning rate and produced NaN weights | `experiments.test.ts`: "produces weight and activation samples for the histograms" | the runner validates the learning rate and the step count |
| **Laboratory C measured the wrong layer.** The width/depth sweep took the kernel of the *output* layer — a single neuron — instead of the last hidden layer, so the "analytic `2ℓ(G²)²/n`" reference did not match the measurement and the width sweep showed no `1/n` suppression | a direct probe of the observable against the book's law, then `experiments.test.ts` | the runner now measures `O^(ℓ) = (1/n) Σ_j (z_j^(ℓ))²` for a single input at the last hidden layer, and attaches the matching prediction; the measured value now agrees with eq. (3.33) to a few per cent |
| The optimizer registry was never exercised by the application | a coverage review of `src/lib/numerics/optimizers.ts` | the physics lab and the representation lab now run through the shared, tested optimizer module, with a documented choice of GD, momentum or Adam |
| The `rg-flow` lesson had a single section, no experiment section and one exercise | `content.test.ts`: "gives every lesson objectives, prerequisites, sections, exercises and citations" | the lesson was rewritten with an intuition section, an experiment section and a second exercise |
| Two prose exercise answers were slightly off: the depth-40 linear covariance (0.0248 against the correct 0.0246) and the NTK trace ratio ("roughly four" against the computed 3.819) | `exercises.test.ts`: "quotes the computed value in the prose answer" | both were corrected, and the reason for the 3.819 was added to the lesson |
| The representation generator's final summary record reported the *requested* step count rather than the step actually reached, so a run that diverged early would have misreported its own progress | `experiments.test.ts`: "yields monotonically increasing steps" | the generator tracks the last trained step and reports it |
| The shared setup's `patch` returned a new object on every call, so an effect that wrote to the setup re-triggered itself forever — the laboratories hung | the end-to-end suite timed out on every laboratory; the cause was found by instrumenting the page and reading the console | `patch` now returns the *same* object when nothing changes, so the setup's identity is stable |
| A shared link could carry a negative depth, a zero width or an unknown activation | `shared-setup.test.ts`: "refuses out-of-range numbers" | the decoder validates every field against a range and against the activation registry, and refuses anything else |
| The shared-setup decoder silently dropped the two distribution fields, because they were checked *after* the numeric conversion | `shared-setup.test.ts`: "round-trips every field exactly" | the string fields are decoded before the numeric ones |
| A temporal-dead-zone error in Laboratory A (`MULTIPLIERS` used before its declaration) blanked the whole page | the end-to-end suite reported an empty page; a console probe showed the `ReferenceError` | the declaration order was corrected |
| The global search's result badges could not be clicked in the end-to-end suite, because "Lesson" also matched the "Lessons" navigation link | `e2e/search.spec.ts`: the click hit the navigation link instead of the result | each result now carries a `data-search-kind` attribute, so it can be addressed unambiguously |
| **The laboratories recomputed on every pixel of a slider drag.** Each control change launched a fresh computation of the whole experiment | `tests/hooks.test.tsx`: "waits for the dependencies to settle before computing" | the computation hook now debounces its dependencies, and every laboratory shows the same busy indicator |
| **A quiz question that offered both options and a numeric answer could only be answered by typing the number.** A learner who picked the correct option and pressed submit was marked wrong | `e2e/assessment.spec.ts`: "a question that can be answered numerically is also answerable by choosing the option" | either route now counts as correct, and the verdict says which one was used |
| **The printed lesson did not contain the reader's notes.** The print stylesheet hid every `aside`, and the notes live in one, while the notes panel claimed they were "printed with the lesson" | a PDF of the lesson, rasterised and read | the print stylesheet keeps the aside, flattens the tokens to ink on white, and the note box grows with the note |
| The print stylesheet left the panels dark on white paper, because the colour comes from the design tokens rather than from a print rule | the same PDF | the print block redefines every token, and a test checks that no token is left without a paper value |
| **A chart was printed at its on-screen width.** Plotly re-measures a chart when the *window* is resized, and entering the print layout is not a window resize | the printed PDF showed a 140-pixel chart in the middle of an A4 page | the chart's container is watched with a `ResizeObserver`, so it is re-measured for the paper |
| **The page opened a connection to a third-party CDN** for a stylesheet it did not use, which contradicts the claim that nothing is sent anywhere | `e2e/privacy.spec.ts`: "makes no request to another origin" | the preconnect is gone, and the claim is now a test that watches the network while the whole course is walked |
| **A worker that died with a request in flight lost the measurement.** The client said the caller could fall back, but the in-flight request was simply rejected | `tests/worker.test.ts`: "still produces the measurement, on this thread" | the fallback lives in the client, so it applies wherever a task is run |
| **The focus trap was disabled wherever there was no layout engine**, because it filtered the focusable elements by `offsetParent`, which is null for every element in such an environment | `tests/confirm-dialog.test.tsx`: "moves the focus into the dialog" | the filter is only applied when the document is actually laid out |
| **Two series on the same chart were the same colour to a deuteranope.** The simulation put the blue and the violet at `#00ff80` and `#00ff7e` | `tests/chart-colours.test.ts`: "no two series are the same line to a deuteranope" | the palette is chosen against the simulation, and a test keeps it that way |
| The page pre-connected to a CDN and the service worker cached every build's assets for ever | the privacy and service-worker tests above | both are fixed, and the service worker drops the assets of a superseded build when the shell changes |
| **The numbers on screen belonged to the previous settings.** A laboratory recomputes a sweep, and the panel kept showing the old numbers at full brightness next to a small "computing" badge | `e2e/stale-results.spec.ts`: "the laboratory says the numbers are from the previous settings" | stale results are dimmed, and they say what they are |
| **The search found nothing unless the query was the exact phrase.** "critical weight variance" and "width depth ratio" both returned nothing, because the book words them differently | `tests/search.test.ts`: "finds a thing whose words are in a different order" | the query is split into words, every word has to be present, and words that sit close together outrank words that are scattered |
| **Every slider in the application was unnamed.** A `<label>` binds to the first control inside it, and the slider's number box came first, so a screen reader announced "slider" and nothing else | `e2e/accessibility.spec.ts`: "every control on /#/labs/physics is named" | both controls are named explicitly, and the name contains the visible label |
| **Opening the representation lesson froze the page for two seconds.** The feature-drift figure trained three networks in the middle of the render, on the main thread | a `PerformanceObserver` on the lesson, which reported a 1,898 ms long task | the figure's measurement moved to the worker, like the laboratories' |
| **Every lesson froze the page for half a second.** The charting library was the full 4.7-megabyte distribution of every trace there is, and evaluating it is half a second of main thread | the same observer, and the size of the built chunk | only the six traces this application draws are bundled: 1.8 megabytes, and the long task fell to 124 ms |
| **The README said every laboratory carried a limitation callout, and two of them could not be downloaded as CSV.** Laboratory A had no callout at all, and the tables of Laboratories A and B could not be taken away | `tests/claims.test.ts`: "every laboratory carries a limitation callout" | both laboratories have a callout and a CSV, and the properties the README claims are asserted by a test |
| **Six of the sixteen worked examples were quoted numbers on a page that said they were computed ones** | `tests/live-examples.test.ts`: "every equation has one" | all sixteen are evaluated in the browser, and three of them produce the number the equation claims |
| **The test report's tables did not render as tables.** The file had picked up 694 lone carriage returns, so a blank line sat between every row | reading the file | the line endings are normalised, and the rows are back together |
| **The feedback that arrived after an action was silent.** An exercise verdict, an assessment explanation and the result of an import all appeared where a screen reader never mentions | `e2e/accessibility.spec.ts`: "the answer to an exercise is announced when it arrives" | all three are live regions now |
| **The application contradicted its own measurement in three places.** The lesson, the gallery preset and the figure all said the representation moves less as the network widens — and at the step size they used, the app measured the opposite: the wide network overshoots and moves *further*. The lesson also claimed the drift was "∝ 1/√n" and that the Fisher ratio "still improves in every case"; neither held | `tests/feature-drift.test.ts`: "falls as the network widens, at the step size the application uses" | the claim is stated with the regime it belongs to, the step size became a control, and the numbers the prose quotes are the ones measured |
| **The criticality scanner listed the same root a hundred and fifty-eight times.** The ratio is computed by quadrature and it oscillates numerically at large K, so every wobble across the line was reported as a root — and the ReLU's "158 physical roots" were all the same critical point | `tests/order-one-numbers.test.ts`: "the scanner reports distinct critical points, not every wobble of the curve" | the scanner reports distinct critical points, and the laboratory reads the nontrivial one rather than the last one it happens to find |
| **The scanner's note about the trivial fixed point was wrong for the leaky ReLU**, whose a₁ is 0 and not positive: it said the K* = 0 root was "repelled (a₁ > 0)" | `tests/order-one-numbers.test.ts`: "the trivial fixed point is labelled as such" | the three cases are distinguished — the K = 0 class, the trivial root, and the repelled root |

---

## 5. What is **not** tested

Stated plainly, because a test report that only lists successes is not a test
report.

- **The charts themselves.** The end-to-end tests assert that the numeric tables
  and panels render, not that a Plotly trace has the right pixels. The underlying
  numbers are tested; the rendering is trusted to Plotly. What *is* tested about
  the charts is the colour: that every series is visible against the panel and
  that two lines on one chart are still two lines to a reader with a colour
  vision deficiency, and that a chart re-measures itself for the paper.
- **The print layout, beyond the checks named.** The printed lesson and the
  printed laboratory are checked by a PDF that is rasterised and read by eye.
  What is automated is that the answers are on the paper, that the navigation
  and the controls are not, that the notes are, and that a chart fills the
  page. The pagination itself is not asserted against a golden image.
- **Cross-browser behaviour.** Only Chromium is exercised. The numerical core is
  engine-independent, but the CSS and the Plotly configuration are not verified on
  Firefox or WebKit.
- **Performance under sustained use.** There is no load test. The size limits in
  the code (depth ≤ 60, width ≤ 512 in the physics lab; ≤ 12 inputs in the NTK lab)
  are enforced by validation and covered by the input-validation tests, and the
  computation hook is debounced so that a slider drag produces one measurement.
  What *is* measured is that no lesson blocks the reader for more than 400
  milliseconds of main-thread work; the responsiveness of the heaviest
  configuration on a slow machine is not.
- **The external references, by default.** Every link in the reading list and the
  atlas is checked against the network — but the check needs the network, so it
  runs with `NETWORK=1` rather than as part of the ordinary suite.
- **The `1/n` suppression of the NTK drift.** The equation explorer shows that
  the kernel moves during training, and that the movement is not zero at finite
  width. The book's `1/n` scaling is a statement about the leading order of the
  flow, which a single step does not establish, and the application does not
  claim it does.
- **Memory behaviour over a long session.** The progress record is capped at 100
  runs; the cap is not exercised by a test.
- **The prose itself.** The content tests check structure, not English. The
  *numbers* quoted in the lessons and the assessment are checked against the code
  (`tests/exercises.test.ts`, `tests/quiz-answers.test.ts`), and the live figures
  are the code itself rather than pictures of it — but a sentence that merely
  *describes* a result is still checked by hand.
- **The finite-width Bayesian posterior of Chapter 6, and the residual network
  model of Appendix B.** The infinite-width limit is implemented (the Gaussian
  process of §10.4, with a figure and a test suite), but the finite-width
  corrections that generate the Hebbian wiring and the moving kernel are not, and
  neither are residual networks. Both are cited and marked as such.
- **The effective action.** The application's theory modules implement the Gaussian
  part of the flow exactly and measure the leading non-Gaussian correction
  empirically. The full effective action of Chapter 5 is not implemented and not
  claimed.

---

## 6. Environment used for the recorded run

```
Node            v24.18.0
npm             11.16.0
TypeScript      5.9.3
Vite            5.4.x
Vitest          2.1.x
Playwright      1.64.x
Platform        win32 (Windows), Chromium
```

Unit suite: 386 passed / 387, 40 files, 37.2 s.
End-to-end suite: 155 passed / 166, 11 skipped (the screenshot captures, which
need `CAPTURE=1`, and the service-worker checks, which need `PWA=1` against a
production build), 33 files, 5.8 min.
Production build: `tsc -b` clean, `vite build` clean.

Because the entire numerical stack is plain TypeScript with a seeded PRNG, the
numbers do not depend on the platform, the browser or the machine: only the
wall-clock timings do, and those are reported as measured rather than specified.
