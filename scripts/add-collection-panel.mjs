import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Add the collection panel to a course's overview page.
 *
 * Every course ends its overview with a panel that links to the rest of the
 * collection and says what to read next. The panel comes from the shared
 * catalogue package, so it is the same on every course and it cannot drift.
 *
 *   node scripts/add-collection-panel.mjs <app-directory> [...]
 */

const directories = process.argv.slice(2)
if (directories.length === 0) {
  console.error('usage: node scripts/add-collection-panel.mjs <app-directory> [...]')
  process.exit(1)
}

for (const directory of directories) {
  const path = join(process.cwd(), directory, 'src', 'pages', 'LandingPage.tsx')
  let source = await readFile(path, 'utf8')

  if (source.includes('CollectionLinks')) {
    console.log(`${directory}: already has the collection panel`)
    continue
  }

  // The import.
  const importAnchor = "import { Callout, Panel } from '@llm-materials/course-ui'"
  if (!source.includes(importAnchor)) {
    console.error(`${directory}: the expected import anchor is missing`)
    process.exitCode = 1
    continue
  }
  source = source.replace(
    importAnchor,
    `${importAnchor}\nimport { CATALOGUE, CollectionLinks } from '@llm-materials/course-catalogue'`,
  )

  // The panel, before the page's closing div.
  const closing = `    </div>\n  )\n}`
  if (!source.includes(closing)) {
    console.error(`${directory}: the expected closing anchor is missing`)
    process.exitCode = 1
    continue
  }
  const panel = `
      <Panel title="The rest of the collection" subtitle="The other courses, and what to read next" accent="indigo">
        <CollectionLinks manifest={CATALOGUE} currentAppId="${directory}" />
      </Panel>
`
  source = source.replace(closing, `${panel}${closing}`)

  await writeFile(path, source, 'utf8')
  console.log(`${directory}: the collection panel added`)
}
