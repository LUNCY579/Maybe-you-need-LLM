#!/usr/bin/env node
/**
 * Which courses state a suite size that their files cannot support?
 *
 * Every application in the collection prints how big its own test suite is — a line in its
 * README's script table, a row in a directory listing, a heading in its test report. Each of
 * those numbers was typed by hand, and typed numbers rot in one direction: the suite grows, the
 * document does not, and nothing fails. The flagship course caught itself doing exactly this —
 * `src/content/docsClaims.test.ts` was written after its audit section had claimed forty-six
 * journeys for an audit of twenty-nine — and has been honest since. The others had no such
 * check, and this script's first run, read against the documents as they stood, found the same
 * drift in eleven of the collection's nineteen suites: twenty-four of the ninety-five sizes they
 * stated were ones their own files could not support, and `packages/course-core` — the package
 * fourteen of the workspace's apps are built on — stated no size at all. Those documents now
 * match the trees they describe, and this script is what keeps them there.
 *
 * This script takes the claim out of each document and compares it with a count taken from the
 * files that make up the suite it describes. What it can prove and what it cannot are kept
 * apart on purpose:
 *
 *   the file count is read off the tree, so a stated figure has to match it exactly;
 *   the test count is the number of assertions the files *write*, which is a floor rather
 *     than a total — one `it.each` over seven routes is seven tests in a run and one in a
 *     file. A claim above the floor is therefore allowed, but only where some file genuinely
 *     generates; a padded number in a suite that writes everything literally still fails.
 *
 * So the check is one-sided by construction, which is the side that matters: it cannot tell a
 * document that has raced ahead of a converged run from one that simply invented a number, but
 * it always sees a document that has fallen behind.
 *
 *   node scripts/check-suite-claims.mjs            # the table
 *   node scripts/check-suite-claims.mjs --json     # the same, as data
 *   node scripts/check-suite-claims.mjs --strict   # fail on a suite that states nothing
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

/** Directories that are part of the collection's wiring rather than a course. */
const NOT_APPS = ['node_modules', 'scripts', 'references']

/**
 * One `it(`, `test(`, or any `it.only` / `it.each` style call.
 *
 * The scan is not anchored to the start of a line, because a course that writes
 * `describe('x', () => { it('y', …) })` on one line runs a test the anchored scan would miss,
 * and a floor that under-counts is a floor that fails an honest document. The lookbehind keeps
 * `RegExp.prototype.test` out of the tally, and the cost is that a comment mentioning `it(`
 * counts — which errs on the side of the floor being too high only in files that write about
 * their own tests.
 */
const ASSERTION = /(?<![\w.])(?:it|test)(?:\.\w+)?\(/g

/** A file that expands one call into many tests, which is the only way to beat the floor. */
const GENERATES = /for \(|\.(map|forEach|each)\(/

/** A test file, in either of the two languages the collection writes them in. */
const TEST_FILE = /\.test\.(tsx?|mjs)$/

/** Directories that hold no source a course wrote itself. */
const NOT_SOURCE = ['node_modules', 'dist', 'build', 'coverage']

/** Path segments every file shares, and so name no layer of the suite in particular. */
const GENERIC = new Set(['src', 'test', 'tests', 'e2e', 'app'])

/** Every top-level application and package with a manifest of its own. */
function apps(root = ROOT) {
  const found = []
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || NOT_APPS.includes(entry.name) || entry.name.startsWith('.')) continue
    if (existsSync(join(root, entry.name, 'package.json'))) found.push(entry.name)
  }
  const packages = join(root, 'packages')
  if (existsSync(packages)) {
    for (const entry of readdirSync(packages, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      if (existsSync(join(packages, entry.name, 'package.json'))) found.push(`packages/${entry.name}`)
    }
  }
  return found.sort()
}

/**
 * The test files of one application, as paths relative to it.
 *
 * The whole directory is walked rather than a list of likely folders, because the collection
 * has used at least three of them: `src/` in a course, `tests/` in two, and `test/` in
 * `course-core`. A list of names is a second place to forget.
 */
function testFilesOf(application, root = ROOT) {
  const files = []
  const walk = (directory, prefix) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      if (NOT_SOURCE.includes(entry.name) || entry.name.startsWith('.')) continue
      const path = join(directory, entry.name)
      const shown = prefix === '' ? entry.name : `${prefix}/${entry.name}`
      if (entry.isDirectory()) walk(path, shown)
      else if (TEST_FILE.test(entry.name)) files.push(shown)
    }
  }
  walk(join(root, application), '')
  return files.sort()
}

/**
 * What the files of one application actually write, in total and one file at a time.
 *
 * The per-file view is what lets a document be checked against the part of the suite it
 * describes: `docs/ARCHITECTURE.md` in one course has a table with a row for the mathematics
 * and a row for the source mapping, and the two numbers there are not the size of the run.
 */
function suiteOf(application, files, root = ROOT) {
  const parts = files.map((file) => {
    const source = readFileSync(join(root, application, file), 'utf8')
    const segments = file.split('/')
    const [stem] = segments.pop().replace(/\.test\.tsx?$/, '').split('.')
    return {
      file,
      // A document that counts one layer names it however it likes — `src/core/`, the file, or
      // the directory it sits in — so every part of its path is a way to refer to it.
      tokens: [stem, ...segments].map((segment) => segment.toLowerCase()).filter((token) => !GENERIC.has(token)),
      written: (source.match(ASSERTION) ?? []).length,
      generates: GENERATES.test(source),
    }
  })
  return {
    parts,
    files: parts.length,
    written: parts.reduce((sum, part) => sum + part.written, 0),
    generates: parts.some((part) => part.generates),
  }
}

/** A line that names the command states how big the run is; a line that only names the tool may state one layer. */
const COMMAND = /npm (?:run )?test\b|\bvitest run\b/i

/** The part of the suite one claim is about, and what it takes to check it. */
function subjectOf(claim, suite) {
  const whole = { files: suite.files, written: suite.written, generates: suite.generates, label: 'the suite' }
  const parts = suite.parts ?? []
  if (claim.file) {
    const part = parts.find((candidate) => candidate.file === claim.file)
    // A table row can name a file the suite no longer has; that is reported, not quietly
    // reinterpreted as a claim about the whole run.
    return part
      ? { files: 1, written: part.written, generates: part.generates, label: `\`${part.file}\`` }
      : { missing: claim.file }
  }
  if (claim.command === false && claim.text) {
    const named = parts.filter((part) =>
      part.tokens.some((token) => new RegExp(`\\b${token}\\b`, 'i').test(claim.text)),
    )
    if (named.length > 0 && named.length < parts.length) {
      return {
        files: named.length,
        written: named.reduce((sum, part) => sum + part.written, 0),
        generates: named.some((part) => part.generates),
        label: named.map((part) => `\`${part.file}\``).join(' and '),
      }
    }
  }
  return whole
}

/**
 * The claims in a document: the sizes it states for a test run — `94 tests`, `tests (4)` — on a
 * line about running them, with the file count beside it when the line states one, and every
 * table row that names one test file and states how many tests it holds.
 *
 * A line about another runner is skipped: a course documents its Playwright suite in the same
 * table, and its counts belong to that suite, not this one.
 */
const OTHER_RUNNER = /playwright|e2e|browser/i

/**
 * A markdown table row that names one test file and states how many tests it holds.
 *
 * Two courses document their suite this way, and neither puts the count in the same column:
 * one writes `| \`tests/mlp.test.ts\` | 24 | what it covers |`, the other
 * `| \`src/…/lab.test.tsx\` | Vitest + RTL | 6 | pass |`. The rule is therefore the first bare
 * integer after the cell that names the file, which is what both of them mean.
 */
function rowClaims(document) {
  const claims = []
  document.split(/\r?\n/).forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) return
    const cells = trimmed.split('|').slice(1, -1).map((cell) => cell.trim())
    const named = cells.findIndex((cell) => /^`?[^`]+\.test\.(tsx?|mjs)`?$/.test(cell))
    if (named === -1) return
    const file = cells[named].replace(/^`|`$/g, '')
    const count = cells.slice(named + 1).find((cell) => /^\d[\d,]*$/.test(cell))
    if (count === undefined) return
    claims.push({ line: index + 1, text: '', file, total: Number(count.replace(/,/g, '')), files: null, command: false })
  })
  return claims
}

function claimsOf(document) {
  const claims = []
  document.split(/\r?\n/).forEach((line, index) => {
    if (!/(npm test|vitest)/i.test(line) || OTHER_RUNNER.test(line)) return
    const totals = [
      ...[...line.matchAll(/(\d[\d,]*)(?:\s+\w+)*?\s+tests\b/g)].map((match) => Number(match[1].replace(/,/g, ''))),
      ...[...line.matchAll(/\btests\s*\((\d[\d,]*)\)/g)].map((match) => Number(match[1].replace(/,/g, ''))),
    ]
    const files = [...line.matchAll(/(\d[\d,]*)\s+files\b/g)].map((match) => Number(match[1].replace(/,/g, '')))
    const command = COMMAND.test(line)
    for (const total of totals)
      claims.push({ line: index + 1, text: line, total, files: files.length === 1 ? files[0] : null, command })
  })
  return [...claims, ...rowClaims(document)].sort((first, second) => first.line - second.line)
}

/** The documents a course ships that a reader would trust about its own suite. */
function documentsOf(application, root = ROOT) {
  const found = []
  const directory = join(root, application)
  if (existsSync(join(directory, 'README.md'))) found.push('README.md')
  const docs = join(directory, 'docs')
  if (existsSync(docs)) {
    for (const entry of readdirSync(docs, { withFileTypes: true })) {
      if (entry.isFile() && entry.name.endsWith('.md')) found.push(`docs/${entry.name}`)
    }
  }
  return found
}

/** One claim against one suite: what the document says, and whether the files can back it. */
function judge(claim, suite) {
  const subject = subjectOf(claim, suite)
  if (subject.missing) return [`names \`${subject.missing}\`; no such file is in the suite`]
  const problems = []
  if (claim.total < subject.written) {
    problems.push(`states ${claim.total} tests; ${subject.label} writes ${subject.written}`)
  } else if (claim.total > subject.written && !subject.generates) {
    problems.push(`states ${claim.total} tests; ${subject.label} writes ${subject.written} and none of it generates more`)
  }
  if (claim.files !== null && claim.files !== suite.files) {
    problems.push(`states ${claim.files} files; the tree holds ${suite.files}`)
  }
  return problems
}

function collect(root = ROOT) {
  const rows = []
  for (const application of apps(root)) {
    const files = testFilesOf(application, root)
    if (files.length === 0) continue
    const suite = suiteOf(application, files, root)
    const claims = documentsOf(application, root).flatMap((document) =>
      claimsOf(readFileSync(join(root, application, document), 'utf8')).map((claim) => ({ ...claim, document })),
    )
    rows.push({
      application,
      suite,
      claims,
      problems: claims.flatMap((claim) =>
        judge(claim, suite).map((problem) => `${claim.document} line ${claim.line}: ${problem}`),
      ),
    })
  }
  if (rows.length === 0) throw new Error(`no application with a test suite was found under ${root}`)
  return rows
}

function report(rows, strict) {
  const pad = (value, width) => String(value).padEnd(width)
  console.log('Every test suite that states its own size, checked against the files that make it up.\n')
  console.log(pad('application', 30) + pad('files', 8) + pad('written', 9) + pad('claims', 26) + 'verdict')
  let stale = 0
  for (const row of rows) {
    const totals = row.claims.map((claim) => claim.total)
    // A document that tabulates its suite file by file states one size per file, so the column
    // counts them instead of spilling the list across the table.
    const claims =
      totals.length === 0
        ? '—'
        : totals.length <= 4
          ? totals.join(', ')
          : `${totals.slice(0, 3).join(', ')} (+${totals.length - 3})`
    const silent = row.claims.length === 0
    const verdict = row.problems.length > 0 ? 'STALE' : silent && strict ? 'unstated' : 'ok'
    if (row.problems.length > 0) stale += 1
    console.log(
      pad(row.application, 30) +
        pad(row.suite.files, 8) +
        pad(row.suite.written, 9) +
        pad(claims, 26) +
        verdict,
    )
    for (const problem of row.problems) console.log(pad('', 30) + `  ${problem}`)
    if (silent) console.log(pad('', 30) + `  the suite writes ${row.suite.written} assertions and no document states its size`)
  }
  console.log(`\nwritten  assertions the files write literally — a floor, because a generated test is invisible to a file scan`)
  console.log(`claims   the totals each course's README and docs print for \`npm test\`; a claim above the floor is allowed only where a file generates`)
  if (strict && rows.some((row) => row.claims.length === 0)) {
    console.log('\n--strict: a suite that states nothing about its own size is a suite nobody can audit.')
  }
  return stale
}

function main() {
  const argv = process.argv.slice(2)
  const strict = argv.includes('--strict')
  const json = argv.includes('--json')
  const rows = collect()
  if (json) {
    console.log(JSON.stringify(rows, null, 2))
  } else {
    const stale = report(rows, strict)
    const silent = rows.filter((row) => row.claims.length === 0)
    if (stale > 0 || (strict && silent.length > 0)) {
      console.error(`\n${stale} application(s) state a suite size their files do not support${strict ? `, ${silent.length} state none` : ''}.`)
      process.exitCode = 1
    }
    return
  }
  if (strict && rows.some((row) => row.claims.length === 0)) process.exitCode = 1
}

export {
  ASSERTION,
  GENERATES,
  apps,
  claimsOf,
  collect,
  documentsOf,
  judge,
  rowClaims,
  subjectOf,
  suiteOf,
  testFilesOf,
}

// Imported by `check-suite-claims.test.mjs` for the parts worth asserting; run directly to
// audit the collection.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
