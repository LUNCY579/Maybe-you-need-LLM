import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Add a dependency to a workspace package, tidily.
 *
 * The PowerShell JSON round trip reformats the whole file, which makes the
 * diff unreadable. This does the same job without touching the layout.
 *
 *   node scripts/add-dependency.mjs <package-directory> <name> <range>
 */

const [directory, name, range] = process.argv.slice(2)
if (!directory || !name || !range) {
  console.error('usage: node scripts/add-dependency.mjs <package-directory> <name> <range>')
  process.exit(1)
}

const path = join(process.cwd(), directory, 'package.json')
const raw = await readFile(path, 'utf8')
// A byte-order mark left by a PowerShell round trip would break the parse.
const manifest = JSON.parse(raw.replace(/^﻿/, ''))

if (!manifest.dependencies) manifest.dependencies = {}
const unchanged = manifest.dependencies[name] === range
manifest.dependencies[name] = range

// Keep the dependencies in the order they were in, with the new one last.
const ordered = {}
for (const [key, value] of Object.entries(manifest.dependencies)) {
  if (key !== name) ordered[key] = value
}
ordered[name] = range
manifest.dependencies = ordered

await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8')
console.log(`${directory}: ${name} → ${range}`)
