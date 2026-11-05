# References

This directory holds the master catalogue of learning materials for the
collection: every textbook, paper, course and repository that a course in this
workspace teaches from, with the licence it was verified under, the curriculum
gap it closes, and the laboratory work it makes possible.

| File | What it is |
| --- | --- |
| `manifest.json` | The catalogue. Machine readable, and the only file to edit. |
| `INDEX.md` | Generated from the manifest. Do not edit by hand. |
| `2501.09223v4.bibliography.txt` | The bibliography pages of *Foundations of Large Language Models* (arXiv:2501.09223v4), extracted from the PDF, so a citation in a lesson can be checked against the printed list rather than against memory. |

## Why a catalogue

Every course in this collection makes a promise: *this lesson came from that
section of that source*. A promise like that is only worth something if the
provenance is recorded somewhere that can be checked, and if the licences are
audited rather than assumed.

The manifest is that record. It is a single file, in a documented shape, that
can be validated mechanically:

```bash
node scripts/validate-sources.mjs            # structure, references, licence fields
node scripts/validate-sources.mjs --verify   # additionally re-read every arXiv title live
```

The live check reads the `citation_title` meta tag from each arXiv abstract
page and compares it with the title recorded here. It caught four real
mismatches while this catalogue was being assembled, and it will catch the
next one.

## The shape of an entry

```jsonc
{
  "id": "ho-2020",
  "title": "Denoising Diffusion Probabilistic Models",
  "authors": ["Jonathan Ho", "Ajay Jain", "Pieter Abbeel"],
  "year": 2020,
  "kind": "paper",                      // paper | book | course | repository | web | specification
  "venue": "arXiv:2006.11239 [cs.LG] / NeurIPS 2020",
  "url": "https://arxiv.org/abs/2006.11239",
  "license": "arXiv perpetual, non-exclusive distribution licence. ...",
  "app": "diffusion-lab",               // the course it feeds
  "role": "primary",                    // primary | supporting
  "gapClosed": "There is no generative or multimodal application anywhere in the collection.",
  "labs": ["Forward process with a closed form for x_t", "..."],
  "verification": { "method": "arxiv-abs", "checkedAt": "2026-10-19" }
}
```

The validator enforces every one of these fields. An entry without a licence
statement, without a named curriculum gap, or without at least one piece of
laboratory work is an error, because an entry that does not say what it
enables is not yet a learning material.

## Verification methods

| Method | What it means |
| --- | --- |
| `arxiv-abs` | The `citation_title` meta tag was read from `arxiv.org/abs/<id>` and compared with the recorded title. |
| `github-api` | The SPDX licence identifier was read from the GitHub repository API. |
| `http-head` | The URL was requested and the status code recorded. |
| `manual` | The source is well known but could not be machine-checked from this environment, because the host blocks automated clients or uses a certificate this environment does not trust. These entries say so in their licence note. |

## Licence policy

- **No redistribution.** No course in this collection redistributes a textbook
  PDF, a paper PDF, a figure, a dataset or third-party code. Courses cite the
  source and link to it.
- **Per version.** An arXiv licence is attached to a specific submission. Cite
  a version, check that version, and re-check before publishing.
- **Attribution everywhere.** Each course credits the authors on its landing
  page, in its footer, on its sources page and on every lesson that draws on
  the work.
- **Licence follows the source.** A course that teaches from a CC BY-NC
  textbook is itself released under CC BY-NC, so that the derivative course
  cannot be used more permissively than the material it teaches. A course that
  teaches from a CC0 textbook may use MIT.

## Adding a source

1. Add the entry to `manifest.json`, with every required field.
2. Run `node scripts/validate-sources.mjs --verify`.
3. Run `node scripts/generate-index.mjs`.
4. If the source starts a new course, add the course to the `apps` list and
   list the entry as its `primarySource`.
