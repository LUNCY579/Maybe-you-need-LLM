import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createRequire } from 'node:module'

/**
 * Collect every course's curriculum into one file.
 *
 * The search across the collection is only useful if it reaches the
 * *lessons*, not just the courses. The lessons live in each course, so they
 * are read here, at build time, and written to `references/lessons.json`,
 * which the catalogue package bundles and the hub and every course search.
 *
 * The curricula are TypeScript, so they are transpiled with the compiler
 * that is already a dependency of the workspace. They import nothing at
 * runtime but types, so the transpiled module is self-contained.
 *
 *   node scripts/collect-lessons.mjs
 */

const root = join(process.cwd())
const require = createRequire(join(root, 'package.json'))
const ts = require('typescript')

/** The courses whose curriculum can be collected. */
const COURSES = [
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

const manifest = JSON.parse(await readFile(join(root, 'references', 'manifest.json'), 'utf8'))
const titles = new Map(manifest.apps.map((app) => [app.id, app.title]))

/** Import a TypeScript module by transpiling it. */
async function importTypeScript(path) {
  const source = await readFile(path, 'utf8')
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
      verbatimModuleSyntax: false,
    },
    fileName: path,
  })
  const url = `data:text/javascript;base64,${Buffer.from(transpiled.outputText, 'utf8').toString('base64')}`
  return import(url)
}

const courses = []

for (const course of COURSES) {
  const path = join(root, course, 'src', 'content', 'curriculum.ts')
  let module
  try {
    module = await importTypeScript(path)
  } catch (error) {
    console.error(`${course}: the curriculum could not be read — ${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
    continue
  }

  const modules = Array.isArray(module.MODULES) ? module.MODULES : []
  const lessons = Array.isArray(module.LESSONS) ? module.LESSONS : []
  if (lessons.length === 0) {
    console.warn(`${course}: the curriculum has no lessons`)
    continue
  }

  const moduleTitles = new Map(modules.map((entry) => [entry.id, entry.title]))
  courses.push({
    id: course,
    title: titles.get(course) ?? course,
    modules: modules.map((entry) => ({ id: entry.id, title: entry.title, tagline: entry.tagline ?? '' })),
    lessons: lessons.map((lesson) => ({
      id: lesson.id,
      title: lesson.title,
      subtitle: lesson.subtitle ?? '',
      module: lesson.moduleId,
      moduleTitle: moduleTitles.get(lesson.moduleId) ?? '',
      minutes: lesson.minutes ?? 0,
      body: [lesson.subtitle ?? '', ...(lesson.objectives ?? []), ...(lesson.keyIdeas ?? [])].join(' '),
    })),
  })
}

const output = {
  generatedFrom: 'the courses in references/manifest.json',
  courses: courses.sort((a, b) => a.title.localeCompare(b.title)),
}

await writeFile(
  join(root, 'references', 'lessons.json'),
  `${JSON.stringify(output, null, 2)}\n`,
  'utf8',
)

const total = courses.reduce((sum, course) => sum + course.lessons.length, 0)
console.log(`collected ${total} lessons from ${courses.length} courses`)
