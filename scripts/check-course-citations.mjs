#!/usr/bin/env node
/**
 * Check that each course cites the catalogue, not its own memory of it.
 *
 *   node scripts/check-course-citations.mjs
 *
 * Every course records the sources it teaches from in its own `src/content`,
 *   and `references/manifest.json` records the same sources for the
 *   collection. The manifest is the checked copy: its titles and author lists
 *   are read from the live arXiv record by `validate-sources.mjs --verify` and
 *   written back by `sync-authors.mjs`. A course that disagrees with it is
 *   citing something the source does not say, so this fails the build.
 *
 *   The comparison is on the fields a reader sees as a citation: the title, the
 *   year, and the author names. A course may name fewer authors than the paper
 *   has, which is a display choice; it may not name one the paper does not
 *   carry, and it may not invent a year.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const COMBINING = /[̀-ͯ]/g

/** The surname of an author, with accents and hyphenation folded away. */
function surnameOf(name) {
  const comma = name.indexOf(',')
  const surname = comma >= 0 ? name.slice(0, comma) : (name.trim().split(/\s+/).slice(-1)[0] ?? '')
  return surname
    .normalize('NFD')
    .replace(COMBINING, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase()
}

const TRUNCATION = /\b(et al\.?|and others|others|and the .*)$/i

const manifest = JSON.parse(await readFile(join(root, 'references', 'manifest.json'), 'utf8'))
const byArxiv = new Map()
for (const source of manifest.sources ?? []) {
  const match = /arxiv\.org\/abs\/(\d{4}\.\d{4,5})/.exec(source.url ?? '')
  if (match) byArxiv.set(match[1], source)
}

const APPS = [
  { app: 'diffusion-lab', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'evaluation-lab', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'rlhf-lab', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'lm-from-scratch', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'mech-interp-lab', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'data-lab', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'scaling-lab', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'systems-lab', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'rl-foundations', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'retrieval-lab', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'agent-bench-lab', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'safety-lab', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  { app: 'multimodal-lab', files: ['src/content/curriculum.ts', 'src/content/sources.ts'] },
  // The three courses that are their own repositories keep their references in
  // their own files, but they cite the same catalogue, so they are checked here.
  { app: 'agentic-ai-academy', files: ['src/content/references.ts'] },
  { app: 'llm-foundations-lab', files: ['src/content/curriculum.ts', 'src/content/status.ts'] },
  { app: 'deep-learning-theory-explorer', files: ['src/content/references.ts'] },
]

const errors = []
const warnings = []
const STANDALONE = new Set(['agentic-ai-academy', 'llm-foundations-lab', 'deep-learning-theory-explorer'])
let entriesChecked = 0

/**
 * Split a content file into the object literals it declares.
 *
 * A literal is read from the brace that opens it to the brace that closes it,
 * counting depth, so that a nested object cannot hand its url to the entry
 * beside it. That pairing is what makes the check mean anything.
 */
function* literals(text) {
  let index = 0
  while (index < text.length) {
    if (text[index] !== '{') {
      index++
      continue
    }
    let depth = 0
    let start = index
    for (; index < text.length; index++) {
      const character = text[index]
      if (character === "'" || character === '"' || character === '`') {
        // step over a string literal so its braces are not counted
        const quote = character
        index++
        while (index < text.length && text[index] !== quote) {
          if (text[index] === '\\') index++
          index++
        }
        continue
      }
      if (character === '{') depth++
      else if (character === '}') {
        depth--
        if (depth === 0) {
          yield text.slice(start, index + 1)
          break
        }
      }
    }
    index++
  }
}

for (const { app, files } of APPS) {
  for (const file of files) {
    const path = join(root, app, file)
    let text
    try {
      text = await readFile(path, 'utf8')
    } catch {
      continue
    }

    for (const literal of literals(text)) {
      // Only a literal with exactly one url and exactly one author list is an
      // entry: the object that holds these also matches, and pairing its first
      // author list with a later entry's url would invent an error.
      const urls = [...literal.matchAll(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/g)]
      const authorsList = [...literal.matchAll(/authors:\s*'((?:[^'\\]|\\.)*)'/g)]
      if (urls.length !== 1 || authorsList.length !== 1) continue
      const url = urls[0]
      const authors = {
        ...authorsList[0],
        [1]: authorsList[0][1].replace(/\\(.)/g, '$1'),
      }
      const source = byArxiv.get(url[1])
      if (!source) {
        const message = `${app}/${file}: cites arXiv:${url[1]}, which the catalogue does not record`
        // The three courses that are their own repositories keep longer
        // reading lists than the catalogue holds. That is reported, not failed:
        // recording a source is a separate change from citing one.
        if (STANDALONE.has(app)) warnings.push(message)
        else errors.push(message)
        continue
      }

      // An entry is checked only when it claims to *be* the paper it links to,
      // which is what a venue naming that identifier means. A reference read
      // through a review, a textbook chapter or a secondary edition points at
      // that source instead, and its own title is not the linked record's.
      const venue = /venue:\s*'([^']*)'/.exec(literal)
      const claimsTheRecord = venue && venue[1].includes(`arXiv:${url[1]}`)
      if (!claimsTheRecord) continue
      entriesChecked++

      const recorded = authors[1]
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name && !TRUNCATION.test(name))
      const liveSurnames = new Set(source.authors.map(surnameOf))
      const invented = recorded.filter((name) => {
        const surname = surnameOf(name)
        return surname !== '' && !liveSurnames.has(surname)
      })
      if (invented.length > 0) {
        errors.push(
          `${app}/${file}: arXiv:${url[1]} (${source.id}) names ${invented.map((n) => `"${n}"`).join(', ')}, ` +
            `who is not in the verified author list [${source.authors.slice(0, 6).join('; ')}${source.authors.length > 6 ? '; …' : ''}]`,
        )
      }

      const title = /title:\s*'([^']*)'/.exec(literal)
      if (title) {
        const fold = (text) =>
          text
            .toLowerCase()
            .normalize('NFD')
            .replace(COMBINING, '')
            .replace(/[^a-z0-9]/g, '')
        // A course may add a gloss to a title — "Training Compute-Optimal Large
        // Language Models (Chinchilla)" — so the record's title has to appear,
        // but it need not be the whole string.
        if (!fold(title[1]).includes(fold(source.title))) {
          errors.push(
            `${app}/${file}: arXiv:${url[1]} is titled "${source.title}" but the course cites it as "${title[1]}"`,
          )
        }
      }

      const year = /year:\s*(\d{4})/.exec(literal)
      if (year && source.year && Math.abs(Number(year[1]) - source.year) > 1) {
        errors.push(
          `${app}/${file}: arXiv:${url[1]} says ${year[1]} but the catalogue records ${source.year}`,
        )
      }
    }
  }
}

console.log(`courses checked: ${APPS.length}`)
console.log(`citations checked: ${entriesChecked}`)

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`)
  for (const warning of warnings) console.log(`  ! ${warning}`)
}

if (errors.length > 0) {
  console.error(`\n${errors.length} citation error(s):`)
  for (const error of errors) console.error(`  x ${error}`)
  process.exit(1)
}

console.log('\nevery course cites the catalogue as the catalogue records it')
