import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Copy the pages that do not depend on the course's subject from one course to
 * another.
 *
 * After the interface layer was extracted into `@llm-materials/course-ui`,
 * most of a course's pages are identical: the dashboard, the module reader,
 * the lesson reader, the practice bank, the glossary, the equations and the
 * not-found page. Only the landing page, the laboratory index and the
 * application shell carry course-specific content.
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const [fromName, toName] = process.argv.slice(2)
if (!fromName || !toName) {
  console.error('usage: node scripts/copy-generic-pages.mjs <from> <to>')
  process.exit(1)
}

const GENERIC = [
  'DashboardPage.tsx',
  'ModulePage.tsx',
  'LessonPage.tsx',
  'LessonsPage.tsx',
  'PracticePage.tsx',
  'GlossaryPage.tsx',
  'EquationsPage.tsx',
  'NotFoundPage.tsx',
]

const from = join(root, fromName, 'src', 'pages')
const to = join(root, toName, 'src', 'pages')
await mkdir(to, { recursive: true })

for (const file of GENERIC) {
  await copyFile(join(from, file), join(to, file))
}

// The sources page names the licence summary from the content module, which
// has the same shape in every course, so it copies too.
await copyFile(join(from, 'SourcesPage.tsx'), join(to, 'SourcesPage.tsx'))

// The pages import the shared interface layer, which they now do by package
// name rather than by relative path.
for (const file of GENERIC.concat('SourcesPage.tsx')) {
  const path = join(to, file)
  const original = await readFile(path, 'utf8')
  const updated = original
    .split("from '../components/ui/primitives'")
    .join("from '@llm-materials/course-ui'")
    .split("from '../components/ui/Math'")
    .join("from '@llm-materials/course-ui'")
  await writeFile(path, updated, 'utf8')
}

console.log(`copied ${GENERIC.length + 1} generic page(s) from ${fromName} to ${toName}`)
