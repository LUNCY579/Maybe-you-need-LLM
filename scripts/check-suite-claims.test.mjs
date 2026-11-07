/**
 * Tests for the suite-size audit.
 *
 * The audit compares a number a human typed into a README with a count taken from the files
 * that make up the suite it describes, and the two are gathered by parsing — which is the part
 * that can be wrong while the table still looks trustworthy. Each rule below is asserted against
 * a throwaway tree, so the behaviour that was fixed by accident is now fixed on purpose: a
 * comma-grouped total used to parse as a file listing with no digits in it, and a line of prose
 * that merely contained the word `tests` used to be read as a claim.
 *
 * The last block reads the real repository. That is the part the gate is for: a document that
 * has fallen behind its own suite has to fail here, and every suite in the collection has to
 * state a size a reader can audit.
 */

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, describe, expect, it } from 'vitest'
import { ASSERTION, GENERATES, apps, claimsOf, collect, judge, rowClaims, subjectOf, suiteOf, testFilesOf } from './check-suite-claims.mjs'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')

let current // the throwaway tree of the test running now

/** A collection shaped like the real one, in a temporary directory. */
function tree(entries) {
  const root = mkdtempSync(join(tmpdir(), 'suite-claims-'))
  current = root
  for (const [path, contents] of Object.entries(entries)) {
    const full = join(root, path)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, contents)
  }
  return root
}

afterEach(() => {
  if (current) rmSync(current, { recursive: true, force: true })
  current = undefined
})

const manifest = JSON.stringify({ name: 'demo', scripts: { test: 'vitest run' } })

/** One course whose suite writes `count` assertions across `files` test files. */
function course({ count = 3, generates = false, says, files = 1 }) {
  const bodies = Array.from({ length: count }, (_, index) =>
    generates
      ? `it.each([[1], [2], [3]])('row ${index}', () => expect(true).toBe(true))`
      : `it('asserts ${index}', () => expect(true).toBe(true))`,
  )
  const readme = says === undefined ? '# demo\n' : `# demo\n\n| \`npm test\` | Vitest tests (${says}) |\n`
  // The padding files carry one assertion each, so a stated file count can be checked without
  // changing the stated total.
  const padding = Object.fromEntries(
    Array.from({ length: files - 1 }, (_, index) => [
      `demo-lab/src/extra${index}.test.ts`,
      `it('pads the file count', () => expect(true).toBe(true))\n`,
    ]),
  )
  return {
    'demo-lab/package.json': manifest,
    'demo-lab/README.md': readme,
    'demo-lab/src/one.test.ts': `describe('a suite', () => {\n${bodies.join('\n')}\n})\n`,
    ...padding,
  }
}

/* ------------------------------------------------------------------ the claims */

describe('the claim taken from a document', () => {
  it('reads the total on a line about running the suite', () => {
    const [claim] = claimsOf('| `npm test` | Vitest unit and content tests (94 tests) |')
    expect(claim.total).toBe(94)
    expect(claim.line).toBe(1)
  })

  it('reads a total written after the word, which is how the hub writes it', () => {
    expect(claimsOf('| `npm test` | Vitest tests (4) |').map((claim) => claim.total)).toEqual([4])
    // and does not read the same number twice when a line states it once
    expect(claimsOf('| `npm test` | Vitest unit, content and screen tests (266 tests) |')).toHaveLength(1)
  })

  it('reads a comma-grouped total as a number, not as a file count', () => {
    // `[\d,]+` matched the comma alone, so a table of two columns parsed as a suite of zero.
    const claims = claimsOf('| `npm test` | 40 files, 1,234 tests |')
    expect(claims.map((claim) => claim.total)).toEqual([1234])
    expect(claims[0].files).toBe(40)
  })

  it('takes the file count only when the line states exactly one', () => {
    expect(claimsOf('| `npm test` | 40 files, 355 tests |')[0].files).toBe(40)
    expect(claimsOf('| `npm test` | between 12 files and 20 files, 35 tests |')[0].files).toBeNull()
  })

  it('ignores prose that mentions tests without stating a size', () => {
    expect(claimsOf('The tests are slow because the encoder is trained in them.\n')).toEqual([])
    expect(claimsOf('`npm test` runs the suite.\n')).toEqual([])
  })

  it('finds every claim when a document states its suite more than once', () => {
    const claims = claimsOf('# demo\n\n`npm test` runs 94 tests\n\nlater: `npm test` still says 94 tests\n')
    expect(claims.map((claim) => [claim.line, claim.total])).toEqual([
      [3, 94],
      [5, 94],
    ])
  })
})

/* ------------------------------------------------------------------ the table rows */

describe('the rows of a table that tabulates the suite', () => {
  it('takes the count from whichever column holds it', () => {
    // Two courses document their suite file by file, and neither puts the number next to the name.
    expect(rowClaims('| `tests/mlp.test.ts` | 24 | what it covers |').map((claim) => [claim.file, claim.total])).toEqual([
      ['tests/mlp.test.ts', 24],
    ])
    expect(rowClaims('| `src/lab/lab.test.tsx` | Vitest + RTL | 6 | pass |').map((claim) => [claim.file, claim.total])).toEqual([
      ['src/lab/lab.test.tsx', 6],
    ])
  })

  it('reads the row as a claim about one file, on the line it sits', () => {
    const claims = rowClaims('# demo\n\n| file | tests |\n| --- | --- |\n| `a.test.ts` | 9 |\n| `b.test.tsx` | see the note below |\n')
    expect(claims).toHaveLength(1)
    expect(claims[0]).toMatchObject({ line: 5, file: 'a.test.ts', total: 9, command: false })
  })

  it('is found by claimsOf, so a tabulated suite is audited without a run total anywhere', () => {
    const document = '# demo\n\n`npm test` runs the suite file by file:\n\n| `tests/mlp.test.ts` | 24 | maths |\n'
    expect(claimsOf(document).map((claim) => [claim.line, claim.total, claim.file])).toEqual([[5, 24, 'tests/mlp.test.ts']])
  })

  it('reports a row that names a file the suite no longer has', () => {
    // A renamed laboratory leaves a row behind. Reading its number as a claim about the whole run
    // would let the document pass by being larger than the suite, which is the opposite of a check.
    const suite = { files: 1, written: 94, generates: false, parts: [{ file: 'src/one.test.ts', written: 94, tokens: ['one'] }] }
    expect(judge({ line: 1, file: 'src/gone.test.ts', total: 12, files: null }, suite)).toEqual([
      'names `src/gone.test.ts`; no such file is in the suite',
    ])
  })

  it('checks a row against the file it names rather than the run around it', () => {
    const suite = {
      files: 2,
      written: 30,
      generates: false,
      parts: [
        { file: 'src/core.test.ts', written: 24, generates: false, tokens: ['core'] },
        { file: 'src/screen.test.tsx', written: 6, generates: false, tokens: ['screen'] },
      ],
    }
    expect(judge({ line: 1, file: 'src/screen.test.tsx', total: 6, files: null }, suite)).toEqual([])
    expect(judge({ line: 1, file: 'src/screen.test.tsx', total: 24, files: null }, suite)).toEqual([
      'states 24 tests; `src/screen.test.tsx` writes 6 and none of it generates more',
    ])
  })
})

/* ------------------------------------------------------------------ the suite */

describe('the count taken from the files', () => {
  it('counts the assertions a file writes, including the qualified forms', () => {
    expect('it("a", () => {})\ntest("b", () => {})\nit.each([1])("c", () => {})\nit.only("d", () => {})'.match(ASSERTION)).toHaveLength(4)
    // A describe is not a test, or every suite would report one more than it runs.
    expect('describe("a suite", () => {\n  it("b", () => {})\n})'.match(ASSERTION)).toHaveLength(1)
  })

  it('counts an assertion written in the middle of a line', () => {
    // A course that opens its describe and its first `it` on the same line runs a test the
    // anchored scan missed, and a floor that under-counts fails an honest document.
    expect('describe("a suite", () => { it("b", () => {}) })'.match(ASSERTION)).toHaveLength(1)
  })

  it('does not mistake a regular expression for a test', () => {
    expect("expect(/x+/.test('x')).toBe(true)".match(ASSERTION)).toBeNull()
    expect("it('matches', () => expect(/x+/.test('x')).toBe(true))".match(ASSERTION)).toHaveLength(1)
  })

  it('sees a generated test as a way to beat the floor', () => {
    expect('for (const k of [1, 5]) { it(`at ${k}`, () => {}) }'.match(GENERATES)).not.toBeNull()
    expect('it("literal", () => {})'.match(GENERATES)).toBeNull()
  })

  it('walks wherever the course keeps its tests, and skips what it did not write', () => {
    // The collection has used `src/`, `tests/` and `test/`, so the scan takes the directory.
    const root = tree({
      ...course({}),
      'demo-lab/tests/screen.test.tsx': `it('renders', () => {})\n`,
      'demo-lab/test/older.test.ts': `it('also runs', () => {})\n`,
      'demo-lab/node_modules/evil.test.ts': `it('is not mine', () => {})\n`,
      'demo-lab/dist/bundled.test.js': `it('is not mine', () => {})\n`,
    })
    expect(testFilesOf('demo-lab', root)).toEqual(['src/one.test.ts', 'test/older.test.ts', 'tests/screen.test.tsx'])
  })

  it('finds every application with a manifest, and not the wiring around them', () => {
    const root = tree({
      'package.json': manifest,
      'demo-lab/package.json': manifest,
      'scripts/check.test.mjs': 'it("is a script", () => {})\n',
      'references/manifest.json': '{}',
      'node_modules/dep/package.json': manifest,
      '.cache/tmp/package.json': manifest,
      'packages/shared/package.json': manifest,
    })
    expect(apps(root)).toEqual(['demo-lab', 'packages/shared'])
  })
})

/* ------------------------------------------------------------------ the subject */

describe('the part of the suite a claim is about', () => {
  /** A course whose README states a run total and whose architecture doc states one number per layer. */
  const layered = {
    files: 3,
    written: 94,
    generates: false,
    parts: [
      { file: 'src/core/math.test.ts', written: 56, generates: false, tokens: ['math', 'core'] },
      { file: 'src/content/labs.test.ts', written: 28, generates: false, tokens: ['content', 'labs'] },
      { file: 'src/components/screen.test.tsx', written: 10, generates: false, tokens: ['screen', 'components'] },
    ],
  }

  it('reads a line that names the command as a claim about the whole run', () => {
    const subject = subjectOf({ command: true, text: '| `npm test` | Vitest unit, content and screen tests (94 tests) |' }, layered)
    expect(subject).toMatchObject({ files: 3, written: 94, label: 'the suite' })
  })

  it('reads a line that names one layer as a claim about that layer', () => {
    // The architecture table counts the mathematics and the source mapping separately; checked
    // against the run, an honest 56 would look like a suite that had lost 38 tests.
    const subject = subjectOf({ command: false, text: 'Core | Vitest, Node | The mathematics in `src/core/`. 56 tests' }, layered)
    expect(subject).toMatchObject({ written: 56, files: 1 })
    expect(subject.label).toBe('`src/core/math.test.ts`')
  })

  it('groups the files a line names, when it names more than one', () => {
    const subject = subjectOf({ command: false, text: 'The math and the content rules hold 84 tests' }, layered)
    expect(subject).toMatchObject({ written: 84, files: 2 })
  })

  it('falls back to the whole run when a line names nothing, or names everything', () => {
    expect(subjectOf({ command: false, text: 'The run covers the arithmetic, the dataset and the rendering' }, layered)).toMatchObject({ written: 94 })
    expect(subjectOf({ command: false, text: 'A run of core, math, content, labs, screen and components' }, layered)).toMatchObject({ written: 94 })
  })

  it('takes the whole run for a suite that never splits into parts', () => {
    expect(subjectOf({ command: true, text: '`npm test` runs 4 tests' }, { files: 1, written: 4, generates: false })).toMatchObject({ written: 4 })
  })
})

/* ------------------------------------------------------------------ the verdict */

describe('one claim against one suite', () => {
  const literal = { files: 4, written: 94, generates: false }

  it('passes when the document states what the files write', () => {
    expect(judge({ line: 1, total: 94, files: null }, literal)).toEqual([])
  })

  it('fails a document that has fallen behind its own suite', () => {
    const problems = judge({ line: 1, total: 70, files: null }, literal)
    expect(problems).toHaveLength(1)
    expect(problems[0]).toContain('states 70 tests; the suite writes 94')
  })

  it('allows a total above the floor only where a file genuinely generates', () => {
    expect(judge({ line: 1, total: 166, files: null }, { ...literal, generates: true })).toEqual([])
    expect(judge({ line: 1, total: 166, files: null }, literal)).toHaveLength(1)
  })

  it('checks a stated file count against the tree exactly', () => {
    expect(judge({ line: 1, total: 94, files: 37 }, { ...literal, generates: true })).toEqual([
      'states 37 files; the tree holds 4',
    ])
  })
})

describe('a whole collection', () => {
  it('reports a stale README and leaves an honest one alone', () => {
    const root = tree({
      'package.json': manifest,
      ...course({ count: 3, says: '3 tests' }),
      'other-lab/package.json': manifest,
      'other-lab/README.md': '# other\n\n`npm test` runs 900 tests\n',
      'other-lab/src/one.test.ts': `it('a', () => {})\n`,
    })
    const rows = collect(root)
    const stale = rows.filter((row) => row.problems.length > 0)
    expect(stale.map((row) => row.application)).toEqual(['other-lab'])
    expect(rows.map((row) => row.application)).toEqual(['demo-lab', 'other-lab'])
  })

  it('leaves an application with no suite out of the table', () => {
    const root = tree({ 'package.json': manifest, 'docs-only/package.json': manifest, 'docs-only/README.md': '# docs\n' })
    expect(() => collect(root)).toThrow(/no application with a test suite/)
  })
})

/* ------------------------------------------------------------------ the real one */

describe('the collection this repository actually holds', () => {
  const rows = collect(ROOT)

  it('audits every course that has a suite, including the three outside the workspace fan-out', () => {
    const named = rows.map((row) => row.application)
    for (const course of ['agentic-ai-academy', 'deep-learning-theory-explorer', 'llm-foundations-lab']) {
      expect(named, `${course} is outside the workspaces, so only a directory walk finds it`).toContain(course)
    }
    expect(named).toContain('packages/course-catalogue')
  })

  it('finds no README that has fallen behind the suite it describes', () => {
    const stale = rows
      .filter((row) => row.problems.length > 0)
      .map((row) => `${row.application}: ${row.problems.join('; ')}`)
    expect(stale).toEqual([])
  })

  it('finds no suite that states nothing about its own size', () => {
    // `--strict` turns this into a failure: a reader cannot audit a number that is not printed.
    const silent = rows.filter((row) => row.claims.length === 0).map((row) => row.application)
    expect(silent).toEqual([])
  })

  it('reads each stated total from the part of the suite it states', () => {
    // A smoke test against the drift the gate exists to catch, in the direction a document can
    // only fail: a README that tabulates its suite file by file states one file's size, and a run
    // total states the whole suite's, so each claim is measured against the subject it names.
    for (const row of rows) {
      for (const claim of row.claims) {
        const subject = subjectOf(claim, row.suite)
        expect(claim.total, `${row.application} line ${claim.line}`).toBeGreaterThanOrEqual(subject.written)
        if (claim.files !== null) expect(claim.files, `${row.application} line ${claim.line}`).toBe(row.suite.files)
      }
    }
  })
})
