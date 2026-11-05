#!/usr/bin/env node
/**
 * Generate `references/INDEX.md` from `references/manifest.json`.
 *
 * The index is derived, never hand-maintained: a source that is in the
 * manifest is in the index, and one that is not, is not. Run this after
 * changing the manifest.
 *
 *   node scripts/generate-index.mjs
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const manifest = JSON.parse(await readFile(join(root, 'references', 'manifest.json'), 'utf8'))

const escape = (text) => String(text).replace(/\|/g, '\\|')

/**
 * The authors as the index shows them.
 *
 * The manifest carries the whole author list, because a citation that names
 * some of the authors and hides the rest is not auditable. A paper with 114
 * authors makes an unreadable line, so the index names the first few and says
 * how many it left out rather than pretending the list ends there.
 */
const DISPLAY_AUTHORS = 8
const authorsForIndex = (authors = []) =>
  authors.length <= DISPLAY_AUTHORS
    ? authors.join(', ')
    : `${authors.slice(0, DISPLAY_AUTHORS).join(', ')} and ${authors.length - DISPLAY_AUTHORS} others`

const lines = []
lines.push('<!--')
lines.push('  GENERATED FILE — do not edit by hand.')
lines.push('  Run `node scripts/generate-index.mjs` after changing references/manifest.json.')
lines.push('-->')
lines.push('')
lines.push('# Source index')
lines.push('')
lines.push(
  `Generated from \`references/manifest.json\` (schema version ${manifest.version}, last verified ${manifest.lastVerified}). ` +
    `${manifest.sources.length} sources across ${manifest.apps.length} courses.`,
)
lines.push('')
lines.push('## The courses')
lines.push('')
lines.push('| Course | Status | Primary source | Modules |')
lines.push('| --- | --- | --- | --- |')
for (const app of manifest.apps) {
  const primary = manifest.sources.find((s) => s.id === app.primarySource)
  lines.push(
    `| **${escape(app.title)}** | ${app.status} | ${primary ? escape(primary.title) : '—'} | ${(app.modules ?? []).join(', ')} |`,
  )
}
lines.push('')

for (const app of manifest.apps) {
  const sources = manifest.sources.filter((s) => s.app === app.id)
  if (sources.length === 0) continue
  lines.push(`### ${app.title}`)
  lines.push('')
  lines.push(`*Status: ${app.status}.*`)
  lines.push('')
  for (const source of sources) {
    lines.push(
      `- **${escape(source.title)}**${source.authors?.length ? ` — ${escape(authorsForIndex(source.authors))}` : ''} (${source.year}). ${escape(source.venue)}.`,
    )
    lines.push(`  - Licence: ${escape(source.license)}`)
    lines.push(`  - Role: ${source.role}. Gap closed: ${escape(source.gapClosed)}`)
    lines.push(`  - Laboratory work: ${source.labs.map(escape).join('; ')}.`)
  }
  lines.push('')
}

lines.push('## Licence policy')
lines.push('')
lines.push(escape(manifest.policy.redistribution))
lines.push('')
lines.push(escape(manifest.policy.perVersion))
lines.push('')
lines.push(escape(manifest.policy.attribution))
lines.push('')
lines.push('## Verification')
lines.push('')
lines.push('Every entry records how its identifier was checked and when:')
lines.push('')
for (const [method, description] of Object.entries(manifest.verificationMethods)) {
  lines.push(`- \`${method}\` — ${description}`)
}
lines.push('')
lines.push('Re-run the check at any time:')
lines.push('')
lines.push('```bash')
lines.push('node scripts/validate-sources.mjs            # structural checks')
lines.push('node scripts/validate-sources.mjs --verify   # also re-check every arXiv title live')
lines.push('```')
lines.push('')

await writeFile(join(root, 'references', 'INDEX.md'), lines.join('\n'), 'utf8')
console.log(`wrote references/INDEX.md (${manifest.sources.length} sources, ${manifest.apps.length} courses)`)
