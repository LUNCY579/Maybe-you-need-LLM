# The Hub

The front door of the collection.

One page that knows everything: every course, every source with the licence it
was checked under, the learning path between the courses, and the ideas more
than one course teaches.

```bash
npm install          # from the workspace root
npm run dev          # http://localhost:5180
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Vite dev server with hot reloading |
| `npm run build` | Type-check (`tsc -b`) then produce a static bundle in `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run typecheck` | Type-check only |
| `npm test` | Vitest tests (4) |
| `npm run test:e2e` | Playwright browser tests, including the accessibility audit |
| `npm run lint` | Oxlint |

## What it reads

The hub reads `references/manifest.json` through the shared catalogue package.
The manifest is copied into `src/manifest.json` by `scripts/sync-catalogue.mjs`,
and the script refuses to leave a stale copy behind:

```bash
node scripts/sync-catalogue.mjs          # write the copies
node scripts/sync-catalogue.mjs --check  # fail if the copies are stale
```

The hub therefore cannot describe a collection that does not exist. The same
manifest is what the courses cite, what the validator checks, and what the
index is generated from.

## What it shows

- **Where to start** — one panel that answers the next question. If a course
  has been begun in this browser it offers to continue it; otherwise it offers
  the path's starting course. Both come from the learning path, not from a
  hand-written list.
- **The courses** — every one, with its modules, the source it is built on,
  its level on the path and what this browser has finished in it; filterable
  by level, and the ones still planned.
- **The learning path** — the order in which the material is cheapest to
  learn, in levels, with the reasons for the edges.
- **The concepts** — the ideas more than one course teaches, which is what
  turns a set of courses into a curriculum.
- **The sources** — every work the collection cites, with the licence it was
  checked under.
- **The search** — one index over all of the above, using the search in
  `@llm-materials/course-core`, so the ranking is the same everywhere in the
  collection, with the shared concepts as suggested queries.

## Accessibility

The hub is audited with axe-core against the WCAG 2.1 A and AA criteria, in
both the light and the dark theme, by the same browser suite shape the courses
use. The theme is applied before the first paint, so the page never flashes.

## Licence

The code is original work and is released under the MIT licence. The source
papers are cited and linked, never redistributed.
