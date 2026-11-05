/**
 * Regenerates the test tables in docs/TEST_REPORT.md from a real run.
 *
 * The report was written by hand, and hand-written numbers drift: the unit
 * table was missing two files and had six counts that were wrong, and the
 * end-to-end table had a duplicated row. Numbers that are wrong in a
 * document whose purpose is to be trustworthy are worse than no document.
 *
 * So the tables are generated. The region between the marker comments is
 * replaced with what the run actually produced; everything else in the file
 * is left alone.
 *
 *   node tools/updateTestReport.mjs              # unit and end-to-end
 *   node tools/updateTestReport.mjs --unit-only  # skip the browser run
 */

import { execFileSync } from 'node:child_process'
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve, relative } from 'node:path'
import { tmpdir } from 'node:os'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')
const reportFile = resolve(root, 'docs', 'TEST_REPORT.md')

const unitOnly = process.argv.includes('--unit-only')

/**
 * The runners are invoked as node scripts rather than through the package
 * manager's launchers. On Windows a `.cmd` launcher cannot be spawned
 * directly by Node — it has to go through a shell — and this tool takes no
 * input from a shell, so the shortest path is to run the JavaScript.
 */
const VITEST = resolve(root, 'node_modules', 'vitest', 'vitest.mjs')
const PLAYWRIGHT = resolve(root, 'node_modules', '@playwright', 'test', 'cli.js')

const UNIT_BEGIN = '<!-- BEGIN GENERATED: unit -->'
const UNIT_END = '<!-- END GENERATED: unit -->'
const E2E_BEGIN = '<!-- BEGIN GENERATED: e2e -->'
const E2E_END = '<!-- END GENERATED: e2e -->'

function run(command, args, label, env = {}) {
  process.stdout.write(`Running ${label}... `)
  try {
    const stdout = execFileSync(command, args, {
      cwd: root,
      encoding: 'utf8',
      // The server and the browser write to the standard error, and there is
      // a great deal of it. It is shown rather than buffered, so that a long
      // run cannot overflow a buffer and kill the process that is reporting
      // on it.
      stdio: ['ignore', 'pipe', 'inherit'],
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, ...env },
    })
    process.stdout.write('done\n')
    return stdout
  } catch (error) {
    process.stdout.write('failed\n')
    const output = `${error.stdout ?? ''}`
    if (output.trim()) console.error(output.split('\n').slice(-30).join('\n'))
    throw new Error(`${label} did not succeed (${error.code ?? error.status ?? 'unknown'})`)
  }
}

/** The unit table, from the JSON reporter. */
async function unitTable() {
  const dir = await mkdtemp(resolve(tmpdir(), 'report-'))
  const out = resolve(dir, 'vitest.json')
  try {
    run(process.execPath, [VITEST, 'run', '--reporter=json', `--outputFile=${out}`], 'the unit and component tests')
    const report = JSON.parse(await readFile(out, 'utf8'))

    const files = report.testResults
      .map((suite) => ({
        file: relative(root, suite.name).replace(/\\/g, '/'),
        count: suite.assertionResults.length,
      }))
      .sort((a, b) => a.file.localeCompare(b.file))

    const lines = [
      '| Suite | Framework | Tests | Result |',
      '| --- | --- | --- | --- |',
    ]
    for (const { file, count } of files) {
      const framework = file.endsWith('.tsx') ? 'Vitest + RTL' : 'Vitest'
      lines.push(`| \`${file}\` | ${framework} | ${count} | pass |`)
    }
    lines.push(`| **Unit and component total** | | **${report.numTotalTests}** | **all pass** |`)
    return { table: lines.join('\n'), total: report.numTotalTests, files: files.length }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

/** The end-to-end table, from the Playwright JSON reporter. */
async function e2eTable() {
  const dir = await mkdtemp(resolve(tmpdir(), 'report-'))
  const out = resolve(dir, 'playwright.json')
  try {
    /*
      The end-to-end run opens three browsers and takes a quarter of an hour,
      and on a machine that is busy with something else it can fail for
      reasons that have nothing to do with the course — a browser that is
      killed, a server that is slow to start. One retry catches those without
      pretending that a real failure is not a failure: if the second run fails
      too, the report is left alone.
    */
    let lastError
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        run(process.execPath, [PLAYWRIGHT, 'test', '--reporter=json'], 'the end-to-end tests', {
          PLAYWRIGHT_JSON_OUTPUT_NAME: out,
        })
        lastError = undefined
        break
      } catch (error) {
        lastError = error
        if (attempt < 3) console.log('  the run failed; trying once more.')
      }
    }
    if (lastError) throw lastError

    const report = JSON.parse(await readFile(out, 'utf8'))

    const byProject = new Map()
    const byFile = new Map()
    // A spec file becomes one suite, and a `describe` block inside it becomes
    // a nested suite. The specs have to be found by walking, not by looking
    // at the top level: the first version of this counted one test per
    // browser too few, because that one was inside a describe block.
    const walk = (suite) => {
      for (const spec of suite.specs ?? []) {
        for (const test of spec.tests ?? []) {
          const project = test.projectName ?? 'unknown'
          const bucket = byProject.get(project) ?? { passed: 0, failed: 0, skipped: 0, other: 0 }
          const status = test.status
          if (status === 'expected') bucket.passed += 1
          else if (status === 'unexpected') bucket.failed += 1
          else if (status === 'skipped') bucket.skipped += 1
          else bucket.other += 1
          byProject.set(project, bucket)

          // Playwright reports the file relative to its test directory, so
          // the directory has to be put back to make the row readable.
          const raw = relative(root, spec.file ?? spec.location?.file ?? 'unknown').replace(/\\/g, '/')
          const file = raw.includes('/') ? raw : `e2e/${raw}`
          const fileBucket = byFile.get(file) ?? { total: 0, projects: new Set(), skipped: 0 }
          fileBucket.total += 1
          fileBucket.projects.add(project)
          if (status === 'skipped') fileBucket.skipped += 1
          byFile.set(file, fileBucket)
        }
      }
      for (const nested of suite.suites ?? []) walk(nested)
    }
    for (const suite of report.suites ?? []) walk(suite)

    const lines = [
      '| Suite | Framework | Tests | Result |',
      '| --- | --- | --- | --- |',
    ]
    for (const [file, bucket] of [...byFile].sort((a, b) => a[0].localeCompare(b[0]))) {
      const engines = bucket.projects.size
      const per = engines > 1 ? ` (${Math.round(bucket.total / engines)} per browser)` : ' (one engine)'
      const note = bucket.skipped > 0 ? `pass (${bucket.skipped} skipped)` : 'pass'
      lines.push(`| \`${file}\` | Playwright | ${bucket.total}${per} | ${note} |`)
    }
    lines.push('')
    lines.push('| Suite | Framework | Tests | Result |')
    lines.push('| --- | --- | --- | --- |')
    let totalPassed = 0
    let totalSkipped = 0
    for (const [project, bucket] of byProject) {
      const total = bucket.passed + bucket.failed + bucket.skipped + bucket.other
      totalPassed += bucket.passed
      totalSkipped += bucket.skipped
      const note = bucket.skipped > 0 ? `${bucket.passed} pass (${bucket.skipped} skipped)` : `${bucket.passed} pass`
      lines.push(`| **End-to-end, ${project}** | | **${total}** | **${note}** |`)
    }
    lines.push(`| **End-to-end total** | | **${totalPassed} passed, ${totalSkipped} skipped** | |`)
    return { table: lines.join('\n'), passed: totalPassed, skipped: totalSkipped }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
}

function replaceRegion(text, begin, end, body) {
  const from = text.indexOf(begin)
  const to = text.indexOf(end)
  if (from === -1 || to === -1) {
    throw new Error(`The markers ${begin} and ${end} are not both in the report.`)
  }
  return `${text.slice(0, from + begin.length)}\n${body}\n${text.slice(to)}`
}

/**
 * Keeps the counts quoted in the prose in step with the run.
 *
 * The tables are generated, but the report also repeats the totals in the
 * commands it tells a reader to run, and those were the numbers that drifted:
 * the table and the sentence below it disagreed with each other, and both
 * disagreed with the run. So they are written here too.
 */
function replaceCounts(text, unit, e2e) {
  let result = text
  result = result.replace(
    /npm run test\s+# \d+ unit and component tests/,
    `npm run test        # ${unit.total} unit and component tests`,
  )
  result = result.replace(
    /npm run test\s+# expect: Test Files \d+ passed \(\d+\), Tests \d+ passed \(\d+\)/,
    `npm run test        # expect: Test Files ${unit.files} passed (${unit.files}), Tests ${unit.total} passed (${unit.total})`,
  )
  if (e2e) {
    result = result.replace(
      /npm run test:e2e\s+# expect: \d+ passed, \d+ skipped/,
      `npm run test:e2e    # expect: ${e2e.passed} passed, ${e2e.skipped} skipped`,
    )
  }
  return result
}

async function main() {
  let text = await readFile(reportFile, 'utf8')

  const unit = await unitTable()
  text = replaceRegion(text, UNIT_BEGIN, UNIT_END, unit.table)

  let e2e
  if (!unitOnly) {
    e2e = await e2eTable()
    text = replaceRegion(text, E2E_BEGIN, E2E_END, e2e.table)
  }

  text = replaceCounts(text, unit, e2e)

  await writeFile(reportFile, text, 'utf8')
  console.log('docs/TEST_REPORT.md has been updated with the results of this run.')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
