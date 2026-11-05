/**
 * Run the gates of the courses that npm's workspace fan-out cannot reach.
 *
 * `npm run verify` fans out with `--workspaces --if-present`, so it only ever
 * visits the directories listed in the root `workspaces` array. Three courses
 * are not in that array: `llm-foundations-lab`, `agentic-ai-academy` and
 * `deep-learning-theory-explorer`. Each installs its own dependencies and keeps
 * its own lockfile, and between them they hold 44 of the 200 laboratory units
 * the collection declares. Before this script existed, their type, lint, unit
 * and build gates had to be run by hand, one directory at a time, and a red
 * suite in any of them could ride through a green `npm run verify`.
 *
 * The list is derived, not remembered: anything with a `package.json` that is
 * not a workspace and is not a shared package is checked here, so a new course
 * cannot be added to the collection and silently skipped by the aggregate gate.
 * `verify-standalone.test.mjs` asserts that derivation against the real
 * directory.
 *
 *   node scripts/verify-standalone.mjs              # every unreachable course
 *   node scripts/verify-standalone.mjs data-lab     # only these
 *   node scripts/verify-standalone.mjs --list       # print the plan, run nothing
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * The gate order for one course.
 *
 * `typecheck` before `test`, because a type error is cheaper to read than the
 * vitest transform failure it otherwise turns into, and `build` last, because
 * it is the only stage that proves the bundle the student actually loads still
 * compiles. A stage is skipped when the course has no script of that name, so
 * a course is never asked to lint itself with a tool it does not use.
 */
const STAGES = ['typecheck', 'lint', 'test', 'build']

/** Directories that are part of the collection's wiring rather than a course. */
const NOT_COURSES = ['node_modules', 'packages', 'scripts', 'references']

function isWorkspaceMember(name) {
  const root = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
  return (root.workspaces ?? []).some((pattern) => {
    if (pattern.endsWith('/*')) return name.startsWith(pattern.slice(0, -1))
    return pattern === name
  })
}

/**
 * Every directory with its own manifest that the workspace fan-out misses.
 *
 * A course whose name in `package.json` differs from its directory name is
 * found by directory, because that is what `--workspaces` resolves too.
 */
function coursesOutsideWorkspaces() {
  const found = []
  for (const entry of readdirSync(ROOT, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    if (NOT_COURSES.includes(entry.name)) continue
    if (entry.name.startsWith('.')) continue
    const manifestPath = join(ROOT, entry.name, 'package.json')
    if (!existsSync(manifestPath)) continue
    if (isWorkspaceMember(entry.name)) continue
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const scripts = manifest.scripts ?? {}
    found.push({
      directory: entry.name,
      stages: STAGES.filter((stage) => typeof scripts[stage] === 'string'),
      // A course with no test script has nothing to gate; it is reported, not silently dropped.
      hasTests: typeof scripts.test === 'string',
    })
  }
  return found
}

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    })
    child.on('error', (error) => {
      console.error(`  ${error.message}`)
      resolve(1)
    })
    child.on('close', (code) => resolve(code ?? 1))
  })
}

async function main() {
  const argv = process.argv.slice(2)
  const all = coursesOutsideWorkspaces()
  const selected = argv.length > 0 && argv[0] !== '--list' ? all.filter((course) => argv.includes(course.directory)) : all

  if (argv[0] === '--list') {
    for (const course of all) console.log(`${course.directory.padEnd(30)} ${course.stages.join(', ') || '(no gates declared)'}`)
    return 0
  }

  const missing = argv.filter((name) => !all.some((course) => course.directory === name))
  if (missing.length > 0) {
    console.error(`These are not outside the workspace fan-out: ${missing.join(', ')}.`)
    console.error('Either they are a workspace, in which case `npm run verify` already runs them, or the directory does not exist.')
    return 2
  }

  const failures = []
  for (const course of selected) {
    console.log(`\n=== the course outside the workspaces: ${course.directory} ===`)
    if (course.stages.length === 0) {
      console.log('no typecheck, lint, test or build script to run')
      continue
    }
    for (const stage of course.stages) {
      const code = await run('npm', ['run', stage], { cwd: join(ROOT, course.directory) })
      if (code !== 0) {
        failures.push(`${course.directory} ${stage}`)
        console.error(`${course.directory}: the ${stage} gate failed`)
      }
    }
  }

  const checked = selected.reduce((total, course) => total + course.stages.length, 0)
  if (failures.length > 0) {
    console.error(`\n${failures.length} of ${checked} gates failed: ${failures.join(', ')}`)
    return 1
  }
  console.log(`\n${checked} gates passed across ${selected.length} course(s) outside the workspaces.`)
  return 0
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().then((code) => {
    process.exitCode = code
  })
}

export { STAGES, coursesOutsideWorkspaces, isWorkspaceMember }
