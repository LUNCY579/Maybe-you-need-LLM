import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Copy the catalogue into the places that need it.
 *
 * The manifest is the collection's single source of truth, and the hub reads
 * it at build time. Rather than reaching outside the hub's own directory, the
 * manifest is copied in — and the copy is checked, so it cannot drift.
 *
 *   node scripts/sync-catalogue.mjs          # write the copies
 *   node scripts/sync-catalogue.mjs --check  # fail if the copies are stale
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const source = join(root, 'references', 'manifest.json')
const targets = [
  join(root, 'hub', 'src', 'manifest.json'),
  join(root, 'packages', 'course-catalogue', 'src', 'manifest.data.json'),
]

// The lessons are collected from the courses by a separate script, because
// they live in the courses rather than in the manifest.
const lessonSource = join(root, 'references', 'lessons.json')
const lessonTargets = [join(root, 'packages', 'course-catalogue', 'src', 'lessons.data.json')]

const check = process.argv.includes('--check')

const raw = await readFile(source, 'utf8')
// The copy is parsed as JSON, so it must not carry a comment.
const parsed = JSON.parse(raw)
const body = `${JSON.stringify(parsed, null, 2)}\n`

let stale = 0
for (const target of targets) {
  let existing = null
  try {
    existing = await readFile(target, 'utf8')
  } catch {
    existing = null
  }
  if (existing === body) continue
  stale++
  if (check) {
    console.error(`stale: ${target.replace(root + '\\', '')}`)
  } else {
    await writeFile(target, body, 'utf8')
    console.log(`wrote ${target.replace(root + '\\', '')}`)
  }
}

if (check && stale > 0) {
  console.error('the catalogue copy is stale; run: node scripts/sync-catalogue.mjs')
  process.exit(1)
}

// The lessons.
try {
  const lessonsRaw = await readFile(lessonSource, 'utf8')
  const lessonsBody = `${JSON.stringify(JSON.parse(lessonsRaw), null, 2)}\n`
  for (const target of lessonTargets) {
    let existing = null
    try {
      existing = await readFile(target, 'utf8')
    } catch {
      existing = null
    }
    if (existing === lessonsBody) continue
    stale++
    if (check) {
      console.error(`stale: ${target.replace(root + '\\', '')}`)
    } else {
      await writeFile(target, lessonsBody, 'utf8')
      console.log(`wrote ${target.replace(root + '\\', '')}`)
    }
  }
  if (check && stale > 0) {
    console.error('the lesson copy is stale; run: node scripts/collect-lessons.mjs && node scripts/sync-catalogue.mjs')
    process.exit(1)
  }
} catch (error) {
  console.error(`the lessons could not be read: ${error instanceof Error ? error.message : error}`)
  console.error('run: node scripts/collect-lessons.mjs')
  process.exit(1)
}

if (!check) console.log(`the catalogue is in sync (${parsed.sources.length} sources, ${parsed.apps.length} courses)`)
