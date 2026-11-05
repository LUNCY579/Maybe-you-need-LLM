#!/usr/bin/env node
/**
 * Validate the master source catalogue.
 *
 *   node scripts/validate-sources.mjs            structural checks only (offline)
 *   node scripts/validate-sources.mjs --verify   also re-check every arXiv title and author list online
 *
 * The offline pass is the one that runs in CI. The online pass is deliberately
 * opt-in: arXiv rate-limits aggressively, and a build must not fail because a
 * third-party server is slow.
 */

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const manifestPath = join(here, '..', 'references', 'manifest.json')

const errors = []
const warnings = []

function fail(message) {
  errors.push(message)
}

function warn(message) {
  warnings.push(message)
}

/**
 * The comparable form of a name.
 *
 * arXiv writes `citation_author` as "Last, First" while the manifest records
 * the names as they appear on the paper, so a name has to be compared in both
 * orders. Accents and punctuation are folded away because the same name is
 * spelled two ways across the two sources. Whole names are compared rather
 * than surnames: a surname is not a single token ("van Duijn", "von Arx"), so
 * taking the last word would reject correct records.
 */
function foldName(name) {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z]/g, '')
    .toLowerCase()
}

function nameForms(name) {
  const folded = foldName(name)
  const comma = name.indexOf(',')
  if (comma < 0) return [folded]
  const last = name.slice(0, comma).trim()
  const rest = name.slice(comma + 1).trim()
  return [folded, foldName(`${rest} ${last}`)]
}

/**
 * The comparable form of a title.
 *
 * arXiv keeps the LaTeX of the paper ("Mem-{\alpha}", "$\pi_0$") while the
 * manifest records the same title as it is read ("Mem-α", "π0"). Greek names,
 * markup and subscript markers are folded so the comparison is about the words,
 * not about which notation the two records happen to use.
 */
const GREEK = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', λ: 'lambda', μ: 'mu', π: 'pi', σ: 'sigma', τ: 'tau', φ: 'phi', ω: 'omega' }

function comparableTitle(title) {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[αβγδλμπστφω]/g, (letter) => GREEK[letter])
    .replace(/\\[a-zA-Z]+/g, (command) => command.slice(1))
    .replace(/[${}_^\\]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const manifest = JSON.parse(await readFile(manifestPath, 'utf8'))

const REQUIRED_SOURCE_FIELDS = [
  'id',
  'title',
  'authors',
  'year',
  'kind',
  'venue',
  'url',
  'license',
  'app',
  'role',
  'gapClosed',
  'labs',
  'verification',
]

const VALID_KINDS = new Set(['paper', 'book', 'course', 'repository', 'web', 'specification'])
const VALID_ROLES = new Set(['primary', 'supporting'])
const VALID_METHODS = new Set(Object.keys(manifest.verificationMethods ?? {}))

/* ------------------------------------------------------------------- apps */

const appIds = new Set()
for (const app of manifest.apps ?? []) {
  for (const field of ['id', 'title', 'status', 'primarySource']) {
    if (!app[field]) fail(`app "${app.id ?? '?'}": missing ${field}`)
  }
  if (appIds.has(app.id)) fail(`duplicate app id "${app.id}"`)
  appIds.add(app.id)
}

/* ---------------------------------------------------------------- sources */

const sourceIds = new Set()
const arxivIds = new Map()

for (const source of manifest.sources ?? []) {
  const label = source.id ?? source.title ?? '<unnamed>'
  for (const field of REQUIRED_SOURCE_FIELDS) {
    const value = source[field]
    if (value === undefined || value === null || value === '') {
      fail(`source "${label}": missing ${field}`)
    }
  }
  if (sourceIds.has(source.id)) fail(`duplicate source id "${source.id}"`)
  sourceIds.add(source.id)

  if (source.kind && !VALID_KINDS.has(source.kind)) {
    fail(`source "${label}": unknown kind "${source.kind}"`)
  }
  if (source.role && !VALID_ROLES.has(source.role)) {
    fail(`source "${label}": unknown role "${source.role}"`)
  }
  if (!Array.isArray(source.authors) || source.authors.length === 0) {
    fail(`source "${label}": authors must be a non-empty array`)
  }
  if (!Array.isArray(source.labs) || source.labs.length === 0) {
    fail(`source "${label}": labs must be a non-empty array`)
  }
  if (source.app && !appIds.has(source.app)) {
    fail(`source "${label}": app "${source.app}" is not declared in the apps list`)
  }
  if (source.verification && !VALID_METHODS.has(source.verification.method)) {
    fail(`source "${label}": unknown verification method "${source.verification.method}"`)
  }
  if (source.year && (source.year < 1900 || source.year > 2100)) {
    fail(`source "${label}": implausible year ${source.year}`)
  }
  if (source.url && !/^https?:\/\//.test(source.url)) {
    fail(`source "${label}": url is not absolute`)
  }

  const arxivMatch = /arxiv\.org\/abs\/(\d{4}\.\d{4,5})(v\d+)?/.exec(source.url ?? '')
  if (arxivMatch) {
    const id = arxivMatch[1]
    if (arxivIds.has(id)) {
      fail(`arXiv:${id} is used by both "${arxivIds.get(id)}" and "${label}"`)
    }
    arxivIds.set(id, label)
    if (!/arXiv:\d{4}\.\d{4,5}/.test(source.venue ?? '')) {
      fail(`source "${label}": venue does not mention the arXiv id ${id}`)
    }
  }
}

/* ------------------------------------------------------ app ↔ source links */

for (const app of manifest.apps ?? []) {
  const primary = (manifest.sources ?? []).find((s) => s.id === app.primarySource)
  if (!primary) {
    fail(`app "${app.id}": primarySource "${app.primarySource}" is not in the sources list`)
  } else if (primary.app !== app.id) {
    fail(`app "${app.id}": primarySource "${app.primarySource}" points at app "${primary.app}"`)
  }
  const attached = (manifest.sources ?? []).filter((s) => s.app === app.id)
  if (attached.length === 0) {
    fail(`app "${app.id}": no sources are attached to it`)
  }
}

/* ------------------------------------------------------- optional online */

const shouldVerify = process.argv.includes('--verify')

async function verifyArxiv(id, label) {
  const url = `https://arxiv.org/abs/${id}`
  const response = await fetch(url, { headers: { 'User-Agent': 'llm-materials/1.0 (source manifest check)' } })
  if (!response.ok) {
    warn(`arXiv:${id} (${label}) returned HTTP ${response.status}; title and authors not re-checked`)
    return
  }
  const html = await response.text()
  const match = /name="citation_title"\s+content="([^"]+)"/.exec(html)
  const source = manifest.sources.find((s) => (s.url ?? '').includes(`arxiv.org/abs/${id}`))
  if (!match) {
    warn(`arXiv:${id} (${label}) has no citation_title meta tag; title not re-checked`)
  } else {
    const live = match[1].replace(/\s+/g, ' ').trim()
    const recorded = (source?.title ?? '').replace(/\s+/g, ' ').trim()
    if (comparableTitle(live) !== comparableTitle(recorded)) {
      fail(`arXiv:${id} (${label}): live title is "${live}" but the manifest records "${recorded}"`)
    }
  }

  // The author list is checked the same way the title is. A record that names
  // an author the source does not carry is a citation error, and a non-empty
  // array is not enough to catch one.
  const liveAuthors = [...html.matchAll(/name="citation_author"\s+content="([^"]+)"/g)].map((m) => m[1])
  if (liveAuthors.length === 0) {
    warn(`arXiv:${id} (${label}) has no citation_author meta tags; authors not re-checked`)
    return
  }
  const liveNames = new Set(liveAuthors.flatMap(nameForms))
  const recordedAuthors = source?.authors ?? []
  const unexpected = recordedAuthors
    .filter((name) => !/^(.*\b)?(et al\.?|and others|others)\b/i.test(name))
    .filter((name) => foldName(name) !== '' && !nameForms(name).some((form) => liveNames.has(form)))
  if (unexpected.length > 0) {
    fail(
      `arXiv:${id} (${label}): recorded author(s) ${unexpected.map((n) => `"${n}"`).join(', ')} do not appear in the live author list [${liveAuthors.join('; ')}]`,
    )
  }
}

if (shouldVerify) {
  for (const [id, label] of arxivIds) {
    await verifyArxiv(id, label)
    await new Promise((resolve) => setTimeout(resolve, 1200))
  }
}

/* ----------------------------------------------------------------- report */

console.log(`sources: ${manifest.sources?.length ?? 0}`)
console.log(`apps:    ${manifest.apps?.length ?? 0}`)
console.log(`arXiv identifiers: ${arxivIds.size}`)

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s):`)
  for (const warning of warnings) console.log(`  ! ${warning}`)
}

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s):`)
  for (const error of errors) console.error(`  x ${error}`)
  process.exit(1)
}

console.log('\nmanifest OK')
