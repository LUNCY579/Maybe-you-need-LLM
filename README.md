# LLM Materials

A collection of interactive, source-mapped learning applications for large
language models and deep learning — plus the shared course core they are built
on and the catalogue of sources they teach from.

Every application in this collection follows the same discipline:

- **One canonical source.** A textbook or a primary paper. Every lesson,
  equation and laboratory cites the chapter, section and page it came from.
- **Every number is computed.** Nothing is pre-baked. The algorithms live in
  pure functions with no DOM and no framework, they are unit-tested without a
  browser, and the interface renders what those functions return.
- **Nothing is faked.** Where a laboratory operates on a toy model, a
  synthetic input or an analytic estimate, the interface says so, in the same
  place the number appears.
- **Licences are audited, not assumed.** No application redistributes a
  textbook PDF, a figure, a dataset or third-party code. Sources are cited and
  linked; the licence of every one is recorded and, where possible, verified.

---

## The courses

| Course | Source | Licence | Status |
| --- | --- | --- | --- |
| [LLM Foundations Lab](llm-foundations-lab/) | *Foundations of Large Language Models* (Xiao & Zhu), arXiv:2501.09223v4 | CC BY-NC 4.0 | built |
| [Agentic AI Academy](agentic-ai-academy/) | *Agentic Large Language Models* (van Duijn et al.), arXiv:2610.13455v1 | CC0 1.0 | built |
| [Deep Learning Theory Explorer](deep-learning-theory-explorer/) | *The Principles of Deep Learning Theory* (Roberts, Yaida & Hanin), arXiv:2106.10165v2 | CUP — cited only | built |
| [Diffusion Lab](diffusion-lab/) | *Denoising Diffusion Probabilistic Models* (Ho, Jain & Abbeel), arXiv:2006.11239 | MIT (course) / arXiv (source) | built |
| [Evaluation Lab](evaluation-lab/) | *Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena* (Zheng et al.), arXiv:2306.05685 | MIT (course) / arXiv (source) | built |
| [RLHF Lab](rlhf-lab/) | *The N+ Implementation Details of RLHF with PPO* (Huang et al.), arXiv:2403.17031 | MIT (course) / CC BY 4.0 (source) | built |
| [Language Model from Scratch](lm-from-scratch/) | *CS336: Language Modeling from Scratch* (Stanford) | MIT (course) / MIT (materials) | built |
| [Mechanistic Interpretability Lab](mech-interp-lab/) | *Sparse Autoencoders Find Highly Interpretable Features in Language Models* (Cunningham et al.), arXiv:2309.08600 | MIT (course) / arXiv (source) | built |
| [Data Lab](data-lab/) | *DataComp* (Muennighoff et al.), arXiv:2304.14108 | MIT (course) / arXiv (source) | built |
| [Scaling Lab](scaling-lab/) | *Scaling Laws for Neural Language Models* (Kaplan et al.), arXiv:2001.08361 | MIT (course) / arXiv (source) | built |
| [Systems Lab](systems-lab/) | *FlashAttention* (Dao et al.), arXiv:2205.14135 | MIT (course) / arXiv (source) | built |
| [Reinforcement Learning Foundations](rl-foundations/) | *Reinforcement Learning: An Introduction* (Sutton & Barto), MIT Press 2018 | MIT (course) / free author PDF | built |
| [Retrieval Lab](retrieval-lab/) | *Retrieval-Augmented Generation* (Lewis et al.), arXiv:2005.11401 | MIT (course) / arXiv (source) | built |
| [Agent Benchmark Lab](agent-bench-lab/) | *SWE-bench* (Jimenez et al.), arXiv:2310.06770 | MIT (course) / arXiv (source) | built |
| [Safety and Alignment Lab](safety-lab/) | *Constitutional AI* (Bai et al.), arXiv:2212.08073 | MIT (course) / arXiv (source) | built |
| [Multimodal Lab](multimodal-lab/) | *CLIP* (Radford et al.), arXiv:2103.00020 | MIT (course) / arXiv (source) | built |

The full catalogue — every source with its licence, the curriculum gap each
one closes and the laboratory work it makes possible — is in
[`references/INDEX.md`](references/INDEX.md), generated from
[`references/manifest.json`](references/manifest.json); that page carries the
live counts, so nothing here has to be kept in step with them. The title *and
the author list* of every arXiv source are read from the live record, by
`npm run validate:sources:live`; the courses' own citations are checked against
that catalogue by `npm run check:citations`.

Those same records name 200 laboratory ideas the sources invite, and an idea
invited on paper is not a laboratory that runs: `npm run check:coverage` scans
each application for a unit behind every idea and reports the strongest
evidence it finds — `tested` (a unit is the item and a check runs it), `mapped`
(the application's own registry claims it, unchecked), `built` (a unit's own
words are the item), `taught` (only the course text names it) or `gap`
(nothing does).
The last two are the work list, and a course is closed when `--strict` finds
none of them. All sixteen courses are closed now, so `verify` prints the report
and then asserts over the whole collection, and
`scripts/check-lab-coverage.test.mjs` asserts the stronger claim item by item:
every one of the 200 is `tested`. What the audit trusts most is an application's
own registry — the `src/content/labs.ts` convention, which names the screen that
computes each promised item, and names it by `screen:` where the entry's route
id is not the file's name. All 200 are declared that way, and every declaration
resolves to a component that exists: `declares` and `paired` in the report are
those two counts, and a registry line that points at no file is printed by
`--gaps` rather than passing quietly. The last promise to find its unit was
`agentic-ai-academy`'s learned prompt compression. Its context-window demo now
fits a compressor on the other windows, ranks the one it is given out of sample,
and prints the caveat the chapter attaches to the idea: on the report window the
trained scorer keeps the right document, shortens it, and loses the headline
number — which is a measurement, and a less flattering one than a demo that
claimed the compression always works.

The collection has a front door: [`hub/`](hub/) is one page that lists every
course, every source with its licence, the learning path between the courses,
the ideas more than one course teaches, and your own progress across the
collection. It reads the same manifest the courses cite, through the shared
catalogue package, so it cannot drift from the collection it describes — and
every course's own search box indexes the whole collection, not just its own
lessons.

Each site is a static bundle with its own sitemap, robots file and web app
manifest, all generated from the same manifest by
`npm run sync:metadata` and checked in CI by `npm run check:metadata`.

---

## Layout

```
LLM Materials/
  hub/                   the front door: every course, every source, the
                         learning path and the concept index, on one page
  packages/
    course-core/          the shared spine: numerics, statistics, persistence,
                          progress, assessment, search, curriculum schemas
    course-ui/            the shared interface layer: primitives, charts, shell
    course-catalogue/     the collection-wide catalogue: the manifest, the
                          cross-course search, the learning path, the concepts
  references/
    manifest.json         the master source catalogue (machine readable)
    INDEX.md              the generated human-readable index
  scripts/
    validate-sources.mjs  structural and live arXiv checks, of title and author list
    sync-authors.mjs      writes the live author lists into the catalogue
    check-course-citations.mjs  fails if a course cites the catalogue differently
    sync-course-citations.mjs   writes the catalogue's author lists into a course
    generate-index.mjs    regenerates INDEX.md from the manifest
    sync-catalogue.mjs    copies the manifest where the site needs it
    repair-utf8.mjs       reverses a Windows PowerShell UTF-8 round trip
  llm-foundations-lab/    (its own git repository)
  agentic-ai-academy/     (its own git repository)
  deep-learning-theory-explorer/
  diffusion-lab/          the first course on the shared workspace
  evaluation-lab/         the second
  rlhf-lab/               the third
  lm-from-scratch/        the fourth
  mech-interp-lab/        the fifth
  data-lab/               the sixth
  scaling-lab/            the seventh
  systems-lab/            the eighth
  rl-foundations/         the ninth
  retrieval-lab/          the tenth
  agent-bench-lab/        the eleventh
  safety-lab/             the twelfth
  multimodal-lab/         the thirteenth
  .research/              extracted source text, one file per source
  *.pdf                   the source documents
```

The three courses that predate the workspace are independent git repositories and
install on their own. The shared core, the shared interface layer and the newer courses
are managed as an npm workspace at this level, so they share one dependency tree and one
test runner.

## The shared packages

| Package | What it holds |
| --- | --- |
| `packages/course-core` | The numerical and statistical core: matrices, seeded randomness, linear algebra, estimators, the Bradley–Terry model, the versioned progress store, the assessment engine, search, and the curriculum and glossary schemas. Framework-free, so it can be tested exhaustively in Node. |
| `packages/course-ui` | The interface layer: the primitives, the KaTeX renderer, the chart wrappers, the error boundary, the shell and the progress provider. The shell and the provider are props-driven, so a new course supplies its own navigation, search corpus and lesson map. |
| `packages/course-catalogue` | The collection-wide catalogue: the manifest's schema and parser, one search index over every course, source and concept, the learning path between the courses, and the components that show them. The hub and every course read the same copy. |

A new course therefore contains only what is specific to it: the algorithms in its own
`src/core`, the content in its own `src/content`, and its own laboratories.

---

## Commands

```bash
npm install          # install the workspace and build the shared core
npm run typecheck    # type-check every workspace
npm test             # run every unit test
npm run build        # build every workspace that produces a bundle
npm run lint         # lint every workspace
npm run verify       # the catalogue and the metadata, then typecheck, lint, test and build
npm run verify:standalone  # the same four gates for the courses outside the workspaces

npm run validate:sources        # check the catalogue structure
npm run validate:sources:live   # also re-check every arXiv title and author list live
npm run sync:authors            # write the live arXiv author lists back into the catalogue
npm run sync:citations          # write the catalogue's author lists into the courses' citations
npm run check:citations         # fail if a course cites a source the catalogue disagrees with
npm run check:coverage          # count which declared laboratory ideas have a unit behind them
npm run check:coverage:strict   # fail if any of the 200 declared ideas has lost its unit
npm run generate:index          # regenerate references/INDEX.md
npm run sync:catalogue          # copy the manifest where the site needs it
npm run sync:metadata          # write the sitemaps, robots files and manifests
npm run check:metadata         # fail if the deployment metadata is stale
npm run test:e2e                # every browser suite, one after another
```

Each course also has its own scripts (`npm run dev`, `npm run test:e2e`,
`npm run preview`) documented in its README, and the hub has the same. Every
browser suite has its own port, so they can also be run in parallel — and
`npm run test:e2e` frees those ports before each one, because a server left over
from an earlier run makes a suite fail for a reason that has nothing to do with
the code. The runner includes the three older courses as well, so it starts each
one from that course's own installed dependencies.

Those same three courses — `llm-foundations-lab`, `agentic-ai-academy` and
`deep-learning-theory-explorer`, which keep their own lockfiles — are outside the
root `workspaces` array, so a `--workspaces` fan-out cannot reach them and their
typecheck, lint, unit and build gates used to be run by hand. `npm run
verify:standalone` runs those four gates in each of them, and `npm run verify`
ends with it. The list is read from the directory rather than written down, so a
course added outside the workspaces is gated the moment it appears;
`scripts/verify-standalone.test.mjs` holds that invariant, and it is where the
laboratory units those three courses declare are counted.

---

## The shared core

`packages/course-core` holds everything that more than one course needs, and
nothing that only one course needs. It is framework-free TypeScript so it can
be tested in Node without a DOM.

| Module | What it provides |
| --- | --- |
| `math` | vectors, matrices, seeded RNG, distributions, softmax, losses, the normal CDF and its inverse |
| `linalg` | Jacobi eigendecomposition, power iteration, Cholesky, linear solve, inverse |
| `stats` | OLS, power-law fits, bootstrap intervals, permutation tests, effect sizes, multiple-comparison corrections, power analysis |
| `preference` | Bradley–Terry maximum likelihood, Elo, preference probabilities |
| `storage` | versioned localStorage with migration and a graceful in-memory fallback |
| `progress` | the progress record, summaries, JSON import and export |
| `quiz` | the assessment model and grading for every question kind |
| `search` | deterministic, explainable course search |
| `curriculum` / `glossary` | the schemas, selectors and cycle detection |

The numerical core was written to be *auditable*, not merely functional: the
error function is accurate to machine precision rather than the usual 1e-7
polynomial, the OLS solver is a real pivoted Gauss–Jordan, and every
statistic states the assumption it rests on.

---

## Adding a course

1. Put the source PDF at the repository root and record it in
   `references/manifest.json` with its licence, the gap it closes and the
   laboratory work it makes possible.
2. Run `node scripts/validate-sources.mjs --verify` to check the identifier
   against the live source.
3. Run `node scripts/generate-index.mjs` to refresh the index.
4. Add the course to the workspace list in `package.json`.
5. Build the course on `@llm-materials/course-core` for the numerics, the
   persistence and the assessment engine; keep the domain algorithms in the
   course's own `src/core`.

Two scripts shorten the mechanical part of step 5:

```bash
node scripts/scaffold-course.mjs <app-id>      # the shell, the config, the boilerplate
node scripts/copy-generic-pages.mjs <app-id>   # the nine subject-independent pages
```

Both copy from `diffusion-lab`; neither writes content, so the curriculum,
the laboratories and the section map are always written by hand and always
checked by the course's own content tests.

---

## Licence

The course *code* in this repository is original work. The course *content* of
each application is released under the licence of the textbook it teaches from
where that licence requires it, and under MIT otherwise. No application
redistributes a copyrighted source document, figure, dataset or third-party
code. See [`references/INDEX.md`](references/INDEX.md) for the full policy and
each course's own sources page for the audit of that course.
