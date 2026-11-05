# Architecture

The collection is a set of static web applications and three shared packages. There is no server, no database and no
network call at runtime: every application is a static bundle that works from the file system.

```
LLM Materials/
  hub/                        the front door: the whole collection on one page
  packages/
    course-core/              the numerical and assessment core (framework-free)
    course-ui/                the interface layer: primitives, charts, the shell
    course-catalogue/         the collection-wide catalogue: manifest, path, concepts
  diffusion-lab/              a course on diffusion models
  evaluation-lab/             a course on evaluating language models
  rlhf-lab/                   a course on RLHF with PPO
  lm-from-scratch/            a course on building a language model from nothing
  mech-interp-lab/            a course on mechanistic interpretability
  data-lab/                   a course on training data
  scaling-lab/                a course on scaling laws
  systems-lab/                a course on attention and the memory hierarchy
  rl-foundations/             a course on reinforcement learning
  retrieval-lab/              a course on retrieval-augmented generation
  agent-bench-lab/            a course on coding-agent benchmarks
  safety-lab/                 a course on alignment and safety
  multimodal-lab/             a course on vision-language models
  llm-foundations-lab/        a course on the foundations, from its own git repository
  agentic-ai-academy/         a course on agentic capabilities, from its own git repository
  deep-learning-theory-explorer/  a course on the effective theory of deep learning
  references/
    manifest.json             the master source catalogue (machine readable)
    INDEX.md                  the generated human-readable index
  scripts/                    the toolchain
```

## The layers

| Layer | What it is | What it must not do |
| --- | --- | --- |
| `course-core` | Numbers, statistics, persistence, the assessment engine, the schemas. Pure TypeScript, no framework. | Know anything about a particular course, or touch the DOM. |
| `course-ui` | The primitives, the mathematics renderer, the charts, the shell, the progress provider. Props-driven. | Compute a number that a course's own algorithm should compute. |
| `course-catalogue` | The manifest's schema and parser, the cross-course search, the learning path, the concept index, the collection's own components. | Know anything about a particular course's content. |
| a course | Its own algorithms in `src/core`, its own content in `src/content`, its own laboratories in `src/components/lab`. | Depend on another course, or reimplement a shared primitive. |

The dependency arrows point one way: `course-core` → `course-ui` → `course-catalogue` → the courses → the hub.

## The rule

**Every number is computed, and nothing is faked.**

The algorithms live in a course's `src/core/` as pure functions with no DOM and no framework. They are unit-tested in
Node, without a browser, and the interface renders what those functions return. There are no stored result arrays
anywhere in the repository.

Three corollaries, and the test suites enforce all three:

1. **A gradient is checked, not asserted.** Any analytic gradient is compared against a central finite difference,
   component by component, by that course's own test suite.
2. **A lesson may only cite a section that exists.** The section map is in the course's `curriculum.ts`, and the
   content test refuses a lesson that names a section outside it.
3. **A course is honest about what it is.** A laboratory that uses a synthetic corpus says so, on the screen, in the
   same words the paper would need. A number taken from a paper is marked as quoted, with its source, and is never
   presented as a computation.

## The catalogue

`references/manifest.json` is the single source of truth for the collection: which courses exist, which sources they
are built on, the licence of each source, the curriculum gap it closes, and the laboratory work it makes possible.

What keeps it honest:

- `scripts/validate-sources.mjs` checks its structure, and with `--verify` re-reads every arXiv identifier's title
  **and author list** from the live record and compares them with what is recorded here. A title alone is not a
  citation: a record can name the right paper and the wrong people, and until the author list was checked the
  validator could not see that.
- `scripts/sync-authors.mjs` writes the live author lists back into the manifest, and
  `scripts/sync-course-citations.mjs` writes the manifest's lists into each course's own short citation. Both are
  one-directional: the catalogue is written from the source, and the course from the catalogue.
- `scripts/check-course-citations.mjs` compares every course's citation with the catalogue — the title, the author
  names and the year — and fails if they disagree. It is what caught a course labelling the sparse-MoE paper as
  GShard, and running its link into the landing page.
- `scripts/generate-index.mjs` regenerates `references/INDEX.md` from it, so the human-readable index cannot drift.
- `scripts/sync-catalogue.mjs` copies it into the places that need it — the hub and the catalogue package — and
  `--check` fails if either copy is stale.

## One search across the collection

Every course's search box indexes its own lessons *and* the collection: the other courses, the sources, the concepts
and the edges of the learning path. A learner in `rl-foundations` who types "Bradley-Terry" finds the course that
teaches it, and the paper it comes from.

The mechanism is `collectionDocuments` in the catalogue package. The lessons of the other courses are not in the
index — they live in the other courses — so the other courses appear as cards. That is a deliberate trade: one
index to maintain, no build-time aggregation, and no way for a course's lessons to drift out of the catalogue.

## The learning path

`packages/course-catalogue/src/paths.ts` holds the edges between the courses, and `concepts.ts` the ideas more than
one course teaches. Both are claims about *teaching order*, not about the mathematics: any course can be taken on
its own, and the path says which order makes the material cheapest to learn.

The concept index is the part that makes the collection a curriculum rather than a pile. A reader who has met the
*token* in the foundations course meets it again in the scaling and data courses, and the index says so.

The hub reads each course's progress record from the browser and recommends the next course from the path, so the
learner's position in the collection is visible in one place. Nothing leaves the browser.

## The deployment metadata

Every site is a static bundle, and a static bundle needs its metadata to be
findable and installable. `scripts/generate-site-metadata.mjs` writes, for each
of the seventeen sites:

- `public/sitemap.xml`, listing the site and the hub's sections;
- `public/robots.txt`, pointing at that sitemap;
- `public/manifest.webmanifest`, making the site installable — with the icons
  the site actually has, and **never** overwriting a manifest that is already
  there, because the three older courses ship their own with their own names
  and themes.

The files are generated from the manifest, so they cannot drift, and
`npm run check:metadata` fails if any of them is stale. CI runs it.

## The build

Every course is a Vite application with the same shape, built from the same template:

```
npm run dev        # the development server
npm run build      # tsc -b, then a static bundle in dist/
npm test           # the unit and content tests
npm run test:e2e   # the browser suite, with the axe-core audit
npm run lint       # oxlint
```

The browser suite runs against the production build, because that is what a learner opens, and audits every page
against the WCAG 2.1 A and AA criteria in both the light and the dark theme.
