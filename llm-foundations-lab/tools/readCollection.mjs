import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Reads the collection this course belongs to, and writes down what a
 * reader here needs from it.
 *
 * The course is one of the collection's built courses. A reader who finishes
 * a module here has somewhere to go next, and the collection knows where:
 * its learning path says which course builds on this one and why, and its
 * concept index says which ideas are taught in more than one place.
 *
 * That knowledge lives in the collection, not here. Copying it by hand would
 * be a copy that goes out of date the moment a course is added, so this
 * script reads it from the collection and writes it into this repository,
 * and the build runs it. Where the collection is not present — a clone of
 * this repository on its own — the copy that is already in the repository is
 * used, and it is still correct, because it was written by this script.
 *
 *   node tools/readCollection.mjs
 */

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const collectionRoot = resolve(projectRoot, '..')

const CATALOGUE_SOURCE = resolve(collectionRoot, 'packages', 'course-catalogue', 'src')
const MANIFEST_FILE = resolve(CATALOGUE_SOURCE, 'manifest.data.json')
const PATHS_FILE = resolve(CATALOGUE_SOURCE, 'paths.ts')
const CONCEPTS_FILE = resolve(CATALOGUE_SOURCE, 'concepts.ts')

const TARGET = resolve(projectRoot, 'src', 'content', 'collection.generated.ts')

const THIS_COURSE = 'llm-foundations-lab'

/**
 * Pull a data literal out of a TypeScript source file.
 *
 * The collection's files are `export const NAME: Type = <literal>`, and the
 * literal is plain data. This finds the literal and hands it to the
 * JavaScript engine, which fails loudly if the file ever stops being plain
 * data — which is the right thing: a silently empty panel is worse than a
 * build that stops.
 */
function literalFrom(source, name) {
  const marker = `export const ${name}`
  const start = source.indexOf(marker)
  if (start === -1) throw new Error(`${name} is not in the file`)

  const equals = source.indexOf('=', start)
  if (equals === -1) throw new Error(`${name} has no value`)

  /*
    The literal begins after the assignment, not before it. The type
    annotation between the name and the `=` can itself contain brackets —
    `Concept[]` — so looking for the opening bracket from the name would
    find the annotation rather than the data.
  */
  let open = -1
  for (let index = equals + 1; index < source.length; index += 1) {
    const character = source[index]
    if (character === '{' || character === '[') {
      open = index
      break
    }
    if (!/\s/.test(character)) throw new Error(`${name} has no literal after its value`)
  }
  if (open === -1) throw new Error(`${name} has no literal`)

  let depth = 0
  let inString = false
  let quote = ''
  for (let index = open; index < source.length; index += 1) {
    const character = source[index]
    if (inString) {
      if (character === '\\') {
        index += 1
        continue
      }
      if (character === quote) inString = false
      continue
    }
    if (character === '"' || character === "'" || character === '`') {
      inString = true
      quote = character
      continue
    }
    if (character === '{' || character === '[') depth += 1
    else if (character === '}' || character === ']') {
      depth -= 1
      if (depth === 0) {
        const literal = source.slice(open, index + 1)
        return new Function(`return (${literal})`)()
      }
    }
  }
  throw new Error(`${name} is not closed`)
}

/** A string that has been mangled somewhere along the way. */
const REPLACEMENT = '\uFFFD'

function assertClean(what, value) {
  if (typeof value === 'string') {
    if (value.includes(REPLACEMENT)) {
      throw new Error(`${what} contains a replacement character: ${JSON.stringify(value)}`)
    }
    return
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertClean(`${what}[${index}]`, item))
    return
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertClean(`${what}.${key}`, item)
  }
}

function readCollection() {
  if (!existsSync(MANIFEST_FILE)) {
    throw new Error(`the collection is not at ${collectionRoot}`)
  }

  const manifest = JSON.parse(readFileSync(MANIFEST_FILE, 'utf8'))
  const path = literalFrom(readFileSync(PATHS_FILE, 'utf8'), 'LEARNING_PATH')
  const concepts = literalFrom(readFileSync(CONCEPTS_FILE, 'utf8'), 'CONCEPTS')

  assertClean('the manifest', manifest)
  assertClean('the learning path', path)
  assertClean('the concept index', concepts)

  const built = manifest.apps.filter((app) => app.status === 'built')
  const builtIds = new Set(built.map((app) => app.id))

  const courses = built.map((app) => ({
    id: app.id,
    title: app.title,
    modules: app.modules,
    summary: path.courses.find((course) => course.id === app.id)?.summary ?? '',
  }))

  const next = path.edges
    .filter((edge) => edge.from === THIS_COURSE && builtIds.has(edge.to))
    .map((edge) => {
      const course = path.courses.find((item) => item.id === edge.to)
      const app = manifest.apps.find((item) => item.id === edge.to)
      return course
        ? {
            id: course.id,
            title: course.title,
            modules: app?.modules ?? [],
            summary: course.summary,
            reason: edge.reason,
          }
        : null
    })
    .filter(Boolean)

  const shared = concepts
    .filter((concept) => concept.courses.includes(THIS_COURSE))
    .map((concept) => ({
      id: concept.id,
      term: concept.term,
      summary: concept.summary,
      // Only courses a reader can actually open. The path and the concept index
      // may name a course that is catalogued but not built yet, and a link to
      // a course that does not exist is worse than no link.
      alsoIn: concept.courses.filter((id) => id !== THIS_COURSE && builtIds.has(id)),
    }))

  return { courses, next, shared }
}

function write(data) {
  const body = `/**
 * What this course shares with the rest of the collection.
 *
 * This file is generated. \`tools/readCollection.mjs\` writes it from the
 * collection's own catalogue, and the build runs that script, so it cannot
 * fall behind the collection it describes.
 *
 * Do not edit it by hand. Edit the collection's catalogue and run:
 *
 *   node tools/readCollection.mjs
 */

/** A course in the collection. */
export interface CollectionCourse {
  id: string
  title: string
  /** The modules the course is made of. */
  modules: string[]
  /** One line: what the course is about. */
  summary: string
}

/** A course that builds on this one, and why. */
export interface CollectionSuccessor extends CollectionCourse {
  /** Why this course comes after this one. */
  reason: string
}

/** An idea the collection teaches in more than one place. */
export interface CollectionConcept {
  id: string
  term: string
  summary: string
  /** The other courses that teach it. */
  alsoIn: string[]
}

export const COLLECTION_COURSES: CollectionCourse[] = ${JSON.stringify(data.courses, null, 2)}

export const COLLECTION_NEXT: CollectionSuccessor[] = ${JSON.stringify(data.next, null, 2)}

export const COLLECTION_SHARED_CONCEPTS: CollectionConcept[] = ${JSON.stringify(data.shared, null, 2)}
`
  writeFileSync(TARGET, body, 'utf8')
}

try {
  const data = readCollection()
  write(data)
  console.log(
    `wrote ${data.courses.length} courses, ${data.next.length} to read next and ${data.shared.length} shared ideas`,
  )
} catch (error) {
  console.error(`the collection could not be read: ${error.message}`)
  console.error('the copy already in the repository is used instead.')
  process.exitCode = 1
}
