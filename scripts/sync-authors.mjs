#!/usr/bin/env node
/**
 * Re-read the author list of every arXiv source from the live record.
 *
 *   node scripts/sync-authors.mjs           rewrite references/manifest.json
 *   node scripts/sync-authors.mjs --dry-run report only, write nothing
 *
 * The catalogue records the authors of each source, and the title of each
 * source has always been checked against arXiv. The author list was not, so a
 * record could name someone the paper does not. This tool makes the manifest
 * say what the source says, and `validate-sources.mjs --verify` is what keeps
 * it that way.
 *
 * arXiv writes `citation_author` as "Last, First"; the manifest records names
 * the way a reader expects to see them, so the pairs are inverted here.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const manifestPath = join(here, '..', 'references', 'manifest.json')
const dryRun = process.argv.includes('--dry-run')
const today = new Date().toISOString().slice(0, 10)

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

/**
 * The entities arXiv escapes in `citation_author` are few, and a name written
 * as `Daniel D&#39;Souza` in the catalogue is not a name.
 */
const ENTITIES = {
  '&#39;': "'",
  '&apos;': "'",
  '&quot;': '"',
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
}
function decodeEntities(text) {
  return text.replace(/&#39;|&apos;|&quot;|&lt;|&gt;|&amp;/g, (token) => ENTITIES[token] ?? token)
}

/** "Touvron, Hugo" -> "Hugo Touvron"; "von Arx, Sydney" -> "Sydney von Arx". */
function toDisplayName(citation) {
  const decoded = decodeEntities(citation)
  const comma = decoded.indexOf(',')
  if (comma < 0) return decoded.trim()
  const last = decoded.slice(0, comma).trim()
  const first = decoded.slice(comma + 1).trim()
  return first ? `${first} ${last}` : last
}

const changes = []
const skipped = []

for (const source of manifest.sources ?? []) {
  const match = /arxiv\.org\/abs\/(\d{4}\.\d{4,5})/.exec(source.url ?? '')
  if (!match) {
    skipped.push(source.id)
    continue
  }
  const id = match[1]
  const url = `https://arxiv.org/abs/${id}`
  const response = await fetch(url, { headers: { 'User-Agent': 'llm-materials/1.0 (source manifest sync)' } })
  if (!response.ok) {
    skipped.push(`${source.id} (arXiv:${id} returned ${response.status})`)
    continue
  }
  const html = await response.text()
  const citations = [...html.matchAll(/name="citation_author"\s+content="([^"]+)"/g)].map((m) =>
    toDisplayName(m[1]),
  )
  if (citations.length === 0) {
    skipped.push(`${source.id} (arXiv:${id} has no citation_author)`)
    continue
  }

  const before = source.authors ?? []
  const same = before.length === citations.length && before.every((name, i) => name === citations[i])
  if (same) continue

  source.authors = citations
  if (source.verification) source.verification.checkedAt = today
  changes.push({ id: source.id, arxiv: id, before, after: citations })

  // Give the next request room: arXiv rate-limits a burst.
  await new Promise((resolve) => setTimeout(resolve, 1200))
}

if (changes.length > 0 && !dryRun) {
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
}

for (const change of changes) {
  const missing = change.before.filter((name) => !change.after.includes(name))
  console.log(`arXiv:${change.arxiv} (${change.id})`)
  console.log(`  recorded ${change.before.length}, live ${change.after.length}`)
  if (missing.length > 0) console.log(`  not in the live record: ${missing.join(', ')}`)
}

console.log(`\n${changes.length} source(s) ${dryRun ? 'would change' : 'updated'}`)
if (skipped.length > 0) console.log(`not checked (no arXiv identifier, or no live record): ${skipped.join(', ')}`)
if (dryRun) console.log('nothing written: this was a dry run')
