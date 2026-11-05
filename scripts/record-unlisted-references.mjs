#!/usr/bin/env node
/**
 * Record the sources a course cites that the catalogue does not hold.
 *
 *   node scripts/record-unlisted-references.mjs            write
 *   node scripts/record-unlisted-references.mjs --dry-run  report only
 *
 * A rule of the collection is that every source is recorded in
 * `references/manifest.json` with its licence, the gap it closes and the
 * laboratory work it makes possible. The three courses that are their own
 * repositories keep longer reading lists than the catalogue holds, so their
 * extra references are recorded here from the citation the course already
 * carries. The author list is written from the course and then re-read from the
 * live arXiv record by `sync-authors.mjs`, which is also what shows whether the
 * identifier points at the paper the course thinks it cites.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const dryRun = process.argv.includes('--dry-run')
const today = new Date().toISOString().slice(0, 10)

const COURSES = [
  { app: 'agentic-ai-academy', files: ['src/content/references.ts'] },
  { app: 'llm-foundations-lab', files: ['src/content/curriculum.ts', 'src/content/status.ts'] },
  { app: 'deep-learning-theory-explorer', files: ['src/content/references.ts'] },
]

const manifest = JSON.parse(await readFile(join(root, 'references', 'manifest.json'), 'utf8'))
const knownIds = new Set(manifest.sources.map((source) => source.id))
const arxivIds = new Map()
for (const source of manifest.sources) {
  const match = /arxiv\.org\/abs\/(\d{4}\.\d{4,5})/.exec(source.url ?? '')
  if (match) arxivIds.set(match[1], source.id)
}

const field = (literal, name) => {
  const match = new RegExp(`${name}:\\s*'((?:[^'\\\\]|\\\\.)*)'`).exec(literal)
  return match ? match[1].replace(/\\(.)/g, '$1') : ''
}

/** The year a citation carries, quoted (`year: '2022'`) or bare (`year: 2022`). */
function yearOf(literal, arxivId) {
  const quoted = /year:\s*'?(\d{4})/.exec(literal)
  // arXiv ids begin with the year of submission, so the identifier is a
  // fallback that cannot silently drift to "this year"
  return quoted ? Number(quoted[1]) : Number(`20${arxivId.slice(0, 2)}`)
}

/** The innermost object literals of a file: an entry, not the object holding it. */
function entries(text) {
  const found = []
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== '{' || text[i - 1] === '$') continue
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
    if (depth === 0 && !nested) found.push(text.slice(i, index + 1))
  }
  return found
}

/** The laboratory work a citation makes possible, without the pointer to the chapter. */
function toTopic(usedFor) {
  return usedFor
    .replace(/^(Ch|§|Lesson|Module)[^.]*?:\s*/i, '')
    .replace(/\s*—\s*the textbook.*$/i, '')
    .trim()
}

const added = []

for (const { app, files } of COURSES) {
  for (const file of files) {
    let text
    try {
      text = await readFile(join(root, app, file), 'utf8')
    } catch {
      continue
    }
    for (const literal of entries(text)) {
      const url = field(literal, 'url')
      const match = /arxiv\.org\/abs\/(\d{4}\.\d{4,5})/.exec(url)
      const id = field(literal, 'id')
      const title = field(literal, 'title')
      if (!match || !id || !title) continue
      if (arxivIds.has(match[1]) || knownIds.has(id)) continue

      const authors = field(literal, 'authors')
        .split(',')
        .map((name) => name.trim())
        .filter((name) => name && !/^(et al\.?|and others|others)$/i.test(name))
      const usedFor = field(literal, 'usedFor')
      const topic = toTopic(usedFor) || title
      const license = field(literal, 'licenseNote') || field(literal, 'license')

      const source = {
        id,
        title,
        authors,
        year: yearOf(literal, match[1]),
        kind: 'paper',
        venue: field(literal, 'venue'),
        url,
        license: license || 'arXiv perpetual, non-exclusive distribution licence. Re-check per version before redistributing.',
        app,
        role: 'supporting',
        gapClosed: topic ? `The reading behind ${app}'s treatment of ${topic.charAt(0).toLowerCase()}${topic.slice(1)}.` : topic,
        labs: [topic],
        verification: { method: 'arxiv-abs', checkedAt: today },
      }
      manifest.sources.push(source)
      knownIds.add(id)
      arxivIds.set(match[1], id)
      added.push({ app, id, arxiv: match[1], authors: authors.length })
    }
  }
}

if (added.length > 0 && !dryRun) {
  await writeFile(join(root, 'references', 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

for (const entry of added) {
  console.log(`${entry.app}: ${entry.id} (arXiv:${entry.arxiv}, ${entry.authors} recorded author(s))`)
}
console.log(`\n${added.length} source(s) ${dryRun ? 'would be recorded' : 'recorded'}`)
if (dryRun) console.log('nothing written: this was a dry run')
