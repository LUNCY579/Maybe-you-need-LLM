#!/usr/bin/env node
/**
 * Rewrite each course's citation of a source from the checked catalogue.
 *
 *   node scripts/sync-course-citations.mjs            write
 *   node scripts/sync-course-citations.mjs --dry-run  report only
 *
 * The manifest is the copy that `validate-sources.mjs --verify` reads from the
 * live arXiv record, and `sync-authors.mjs` writes back. A course keeps its own
 * short citation for the screen, and that copy was never checked against
 * anything: here it named authors the paper does not carry. This makes the
 * course say what the catalogue says, showing the first few authors and naming
 * the rest as others rather than leaving them out silently.
 *
 * It changes the author list and nothing else. The title, the url and the year
 * are the course's claim about which paper it teaches from, and are checked,
 * not rewritten — run `scripts/check-course-citations.mjs` for that.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const dryRun = process.argv.includes('--dry-run')
const SHOW_AUTHORS = 6

const manifest = JSON.parse(await readFile(join(root, 'references', 'manifest.json'), 'utf8'))
const byArxiv = new Map()
for (const source of manifest.sources ?? []) {
  const match = /arxiv\.org\/abs\/(\d{4}\.\d{4,5})/.exec(source.url ?? '')
  if (match) byArxiv.set(match[1], source)
}

const APPS = [
  'diffusion-lab',
  'evaluation-lab',
  'rlhf-lab',
  'lm-from-scratch',
  'mech-interp-lab',
  'data-lab',
  'scaling-lab',
  'systems-lab',
  'rl-foundations',
  'retrieval-lab',
  'agent-bench-lab',
  'safety-lab',
  'multimodal-lab',
]

/**
 * The innermost object literals of a TypeScript file, with their offsets.
 *
 * An entry is the smallest brace pair that holds the fields, so its url cannot
 * be read as another entry's url. Nested braces are counted but not yielded.
 */
function innermostLiterals(text) {
  const found = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{') continue
    if (text[i - 1] === '$') continue // a template placeholder, not an object
    let depth = 0
    let index = i
    let nested = false
    for (; index < text.length; index++) {
      const character = text[index]
      if (character === "'" || character === '"' || character === '`') {
        const quote = character
        index++
        while (index < text.length && text[index] !== quote) {
          if (text[index] === '\\') index++
          index++
        }
        continue
      }
      if (character === '{') {
        if (index > i) nested = true
        depth++
      } else if (character === '}') {
        depth--
        if (depth === 0) break
      }
    }
    if (depth !== 0 || nested) continue
    found.push({ start: i, end: index, body: text.slice(i, index + 1) })
  }
  return found
}

/** A name as it sits inside a single-quoted TypeScript string. */
const quote = (name) => name.replace(/\\/g, '\\\\').replace(/'/g, "\\'")

const changes = []

for (const app of APPS) {
  for (const file of ['src/content/curriculum.ts', 'src/content/sources.ts']) {
    const path = join(root, app, file)
    let text
    try {
      text = await readFile(path, 'utf8')
    } catch {
      continue
    }

    const rewrites = []
    for (const literal of innermostLiterals(text)) {
      const urls = [...literal.body.matchAll(/arxiv\.org\/abs\/(\d{4}\.\d{4,5})/g)]
      const authors = /authors:\s*'((?:[^'\\]|\\.)*)'/.exec(literal.body)
      if (urls.length !== 1 || !authors) continue
      const source = byArxiv.get(urls[0][1])
      if (!source) continue

      const names = source.authors ?? []
      const shown = names.slice(0, SHOW_AUTHORS)
      const display =
        names.length > shown.length ? `${shown.join(', ')} and others` : shown.join(', ')
      // compare unescaped text, or a name like D'Souza reads as a change forever
      if (display === authors[1].replace(/\\(.)/g, '$1')) continue

      const at = literal.start + authors.index + authors[0].indexOf(authors[1])
      rewrites.push({ at, length: authors[1].length, next: display, before: authors[1], arxiv: urls[0][1], id: source.id })
    }

    if (rewrites.length === 0) continue
    // Apply from the end so an earlier replacement cannot move a later offset.
    let updated = text
    for (const rewrite of rewrites.sort((a, b) => b.at - a.at)) {
      updated = `${updated.slice(0, rewrite.at)}${quote(rewrite.next)}${updated.slice(rewrite.at + rewrite.length)}`
    }
    if (!dryRun) await writeFile(path, updated, 'utf8')
    for (const rewrite of rewrites) {
      changes.push({ app, file, ...rewrite })
    }
  }
}

for (const change of changes) {
  console.log(`${change.app}/${change.file.split('/').pop()} arXiv:${change.arxiv} (${change.id})`)
  console.log(`  was  ${change.before}`)
  console.log(`  now  ${change.next}`)
}

console.log(`\n${changes.length} citation(s) ${dryRun ? 'would change' : 'rewritten'}`)
if (dryRun) console.log('nothing written: this was a dry run')
