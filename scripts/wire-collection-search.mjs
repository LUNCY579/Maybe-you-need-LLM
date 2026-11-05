import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Wire the collection-wide search into a course.
 *
 * The course's own lessons stay the most specific results, and the rest of
 * the collection — the other courses, the sources, the concepts and the edges
 * of the learning path — is appended, so a learner in one course can find
 * the course that teaches something they have just read about.
 */

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

const root = process.cwd()

for (const app of APPS) {
  const path = join(root, app, 'src', 'App.tsx')
  let source = await readFile(path, 'utf8')
  if (source.includes('collectionDocuments')) {
    console.log(`${app}: already wired`)
    continue
  }

  // The import.
  const importAnchor = "import { moduleLessonIds } from '@llm-materials/course-core'"
  if (!source.includes(importAnchor)) {
    console.error(`${app}: the import anchor is missing`)
    process.exitCode = 1
    continue
  }
  source = source.replace(
    importAnchor,
    `${importAnchor}\nimport { CATALOGUE, collectionDocuments } from '@llm-materials/course-catalogue'`,
  )

  // The documents.
  const documentsAnchor = '          searchDocuments={searchDocuments}'
  if (!source.includes(documentsAnchor)) {
    console.error(`${app}: the search anchor is missing`)
    process.exitCode = 1
    continue
  }
  source = source.replace(
    documentsAnchor,
    '          searchDocuments={[...searchDocuments(), ...collectionDocuments(CATALOGUE, \'' + app + '\')]}',
  )

  // The function becomes a function of nothing.
  source = source.replace('function searchDocuments() {', 'function searchDocuments() {')

  await writeFile(path, source, 'utf8')
  console.log(`${app}: the collection search is wired`)
}
