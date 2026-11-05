# Contributing

Everything here is original work, and every source is cited. A contribution that breaks either of those is not a
contribution.

## The rules

1. **Every number is computed.** A course's numbers come from its own `src/core/`, as pure functions with no DOM and
   no framework, and are unit-tested in Node. Do not store a result, and do not compute one in a component.
2. **Nothing is faked.** If a laboratory uses a synthetic corpus, a toy model or a planted bias, the screen says so
   in the same words the paper would need. If a number is quoted from a paper, it is marked as quoted and carries its
   source.
3. **Nothing is redistributed.** No figure, table, image, dataset or third-party code from any cited work may appear
   in the repository. Every figure is an original plot of a computation made in the browser.
4. **Every source is recorded.** A new paper goes into `references/manifest.json` with its licence, the curriculum gap
   it closes and the laboratory work it makes possible — and with the way its identifier was checked.
5. **Every lesson cites a section that exists.** The section map lives in the course's `curriculum.ts`, and the
   content test refuses a lesson that names a section outside it.

## Adding a course

```bash
node scripts/scaffold-course.mjs <app-id> "<Title>" "<the source>"
node scripts/copy-generic-pages.mjs <existing-app-id> <app-id>
```

The first copies the build configuration, the test setup, the Playwright configuration and the HTML shell. The second
copies the nine pages that do not depend on the subject. Neither writes content: the curriculum, the laboratories and
the section map are always written by hand and always checked by the course's own content tests.

Then:

1. Add the source to `references/manifest.json` and run `node scripts/validate-sources.mjs --verify`.
2. Add the course to the workspace list in the root `package.json`, and run `npm install`.
3. Write `src/core/`, `src/content/`, `src/components/lab/` and `src/pages/`.
4. Copy the content test from an existing course and adapt it; it is the contract, and it is the same contract for
   every course.
5. Copy the browser suite and adapt the page list.
6. Run `npm run verify` from the root.
7. Add the course to the root `README.md` and to the learning path in
   `packages/course-catalogue/src/paths.ts`.

## The checks

```bash
npm run verify            # everything, in order
npm run typecheck
npm run lint
npm test
npm run build
npm run sync:catalogue    # copy the manifest where it is needed
npm run sync:authors      # write the live arXiv author lists back into the manifest
npm run sync:citations    # write the manifest's author lists into each course's citation
npm run check:citations   # fail if a course cites a source the manifest disagrees with
npm run check:coverage    # count the declared laboratory ideas that have a unit behind them
npm run check:coverage:strict  # fail if a closed course has lost one
npm run sync:metadata    # write the sitemaps, robots files and web manifests
npm run check:metadata   # fail if the deployment metadata is stale
npm run validate:sources  # check the catalogue's structure
npm run generate:index    # regenerate references/INDEX.md
```

The browser suites are run per course, or all at once from the root:

```bash
cd <app-id> && npx playwright test   # one course
npm run test:e2e                      # every course, one after another
```

Each suite has its own port, so they can also be run in parallel. The runner
frees the port before each one, because a server left over from an earlier run
makes a suite fail for a reason that has nothing to do with the code. They
audit every page with axe-core against the WCAG 2.1 A and AA criteria, in both
themes, and they fail the build on any violation. A new page is not finished
until it is in that list.

A course is closed when `check:coverage` finds no `taught` and no `gap` row for it, which
is what `--strict` asserts. The audit reads two kinds of evidence. A course that lists its
own mappings — `delivers: ['<the manifest line, verbatim>']` beside each laboratory in
`src/content/labs.ts`, as mech-interp-lab does — is graded on its own claim: a declared item
is `tested` when the screen it names is rendered by a test, and `mapped` when nothing checks
it. A course without that list is graded on words, and its `built` rows are a unit's own text
answering a manifest line; `--gaps` prints the nearest file beside every row that failed, so
the difference between "it exists under another name" and "it does not exist" is one read
away. Adopting the list is the first step of closing a course, because it is the only
evidence the audit cannot get wrong.

## Style

- The interface layer's conventions are the collection's conventions: panels, figures with a caption and a
  data-table alternative, callouts for definitions and warnings, statistics for the headline numbers, and a chart
  that carries a name.
- The prose is in plain English, and it does not hedge and does not oversell. A measurement says what it measured, on
  what, and with what uncertainty.
- Comments explain *why*, not *what*. The code already says what it does.

## Licence

The course code is original work and is released under the MIT licence. The source papers are cited and linked, never
redistributed.
