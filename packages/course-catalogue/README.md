# The Catalogue

The collection-wide catalogue: the manifest's schema and parser, one search
index over every course, source and concept, the learning path between the
courses, and the components that show them.

```bash
npm install          # from the workspace root
npm run build        # tsc -b
npm test             # 23 tests
```

## What it holds

| Module | What it provides |
| --- | --- |
| `manifest` | The schema of `references/manifest.json` and a strict parser. The parser checks every field the site relies on, and the referential integrity: an app's primary source must exist, and a source must belong to an app. |
| `catalogue` | The manifest, parsed and bundled, so that every application reads the same copy. |
| `search` | One index over the courses, the sources, the concepts and the edges of the path, searched with the ranking in `@llm-materials/course-core`. |
| `paths` | The learning path: the edges between the courses, the roots, the next course to take, the depth of each course, the layers, and a cycle check. |
| `concepts` | The concept index: the ideas more than one course teaches, and the overlap between any two courses. |
| `components` | The collection's own React components: the course list, the learning path, the concept index, the source list, the search results, and the "the rest of the collection" panel every course shows. |

## Why it is strict

A catalogue that can hold anything is a catalogue nobody can rely on, and the
failure of a field to validate should break the build rather than the page.
`parseManifest` throws a `ManifestError` with the path of the offending field,
and the tests check that it does.

## The path and the concepts

Both are claims about *teaching order*, not about the mathematics. A course
may be taken on its own; the path says which order makes the material
cheapest to learn, and the concept index says which ideas a reader will meet
again.

The path is checked for cycles, the concepts name only courses that exist,
and the search is checked to find a course by its title and a source by its
author.
