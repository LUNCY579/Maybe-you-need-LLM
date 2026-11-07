import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { LABS } from './labs'

/**
 * The documentation that counts things, counted from the things themselves.
 *
 * Three files quote the size of the browser suites — README.md,
 * docs/TESTING.md and docs/ARCHITECTURE.md — and every one of those numbers was
 * typed by hand at some point. Typed numbers go stale silently: the audit
 * section of `docs/TESTING.md` had said "forty-six journeys" while the script
 * held twenty-nine, and nothing failed. So each claim here is read out of the
 * prose with a regex and compared against a count taken from the files that
 * define the suite.
 *
 * What this proves is that the *documents describe the repository*. What it
 * cannot prove is that the browser suites pass, because the Playwright
 * browsers are not downloaded in every environment. The docs say which is
 * which, and this file makes sure they keep saying so honestly.
 */
function repoFile(relative: string): string {
  let directory = process.cwd()
  for (let hop = 0; hop < 6; hop += 1) {
    const candidate = resolve(directory, relative)
    if (existsSync(candidate)) return readFileSync(candidate, 'utf8')
    const parent = dirname(directory)
    if (parent === directory) break
    directory = parent
  }
  throw new Error(`${relative} is not reachable from this test`)
}

const AUDIT = repoFile('scripts/audit.mjs')
const SMOKE = repoFile('e2e/smoke.spec.ts')
const A11Y = repoFile('e2e/accessibility.spec.ts')
const COLLECTION_SPEC = repoFile('e2e/collection.spec.ts')
const TESTING = repoFile('docs/TESTING.md')
const README = repoFile('README.md')
const ARCHITECTURE = repoFile('docs/ARCHITECTURE.md')

/** One `name: '…'` entry per journey in the audit's JOURNEYS array. */
const JOURNEYS = (AUDIT.match(/^    name: '/gm) ?? []).length
/** One `test(` per declared test in a Playwright spec. */
const countTests = (source: string) => (source.match(/^\s+test\(/gm) ?? []).length
/** One `{ name: '…' }` per page in the axe-core audit. */
const AUDIT_PAGES = (A11Y.match(/^    \{ name: '/gm) ?? []).length
const SMOKE_TESTS = countTests(SMOKE)
const COLLECTION_TESTS = countTests(COLLECTION_SPEC)
const CHROMIUM_TOTAL = SMOKE_TESTS + AUDIT_PAGES + COLLECTION_TESTS

function claimedJourneyCount(source: string, where: string): number {
  const match = /through\s+(\d+)\s+student journeys/.exec(source)
  expect(match, `${where} does not state how many journeys the audit runs`).not.toBeNull()
  return Number(match![1])
}

describe('the documentation that counts the suites', () => {
  it('quotes the same journey count as the audit script', () => {
    expect(JOURNEYS).toBeGreaterThan(20)
    expect(claimedJourneyCount(TESTING, 'docs/TESTING.md')).toBe(JOURNEYS)
    expect(claimedJourneyCount(README, 'README.md')).toBe(JOURNEYS)
    expect(claimedJourneyCount(ARCHITECTURE, 'docs/ARCHITECTURE.md')).toBe(JOURNEYS)
  })

  it('names every journey it runs, and runs none of them twice', () => {
    const names = [...AUDIT.matchAll(/^    name: '(.+)',$/gm)].map((match) => match[1])
    expect(names).toHaveLength(JOURNEYS)
    expect(new Set(names).size).toBe(names.length)
    for (const name of names) expect(name.trim().length).toBeGreaterThan(10)
  })

  it('adds up to the Chromium figure the browser section declares', () => {
    const claim = /declares \*\*(\d+) tests on\s+Chromium\*\* — (\d+) in `smoke\.spec\.ts`, (\d+) pages in the accessibility audit, (\d+) in `collection\.spec\.ts`/.exec(
      TESTING,
    )
    expect(claim, 'docs/TESTING.md no longer states the Chromium declarations as a sum').not.toBeNull()
    const [, total, smoke, pages, collection] = claim!.map(Number)
    expect(smoke).toBe(SMOKE_TESTS)
    expect(pages).toBe(AUDIT_PAGES)
    expect(collection).toBe(COLLECTION_TESTS)
    expect(total).toBe(CHROMIUM_TOTAL)
  })

  it('labels the accessibility audit by the pages it actually declares', () => {
    const heading = /### 3a\. Accessibility audit \(axe-core; (\d+) pages run, (\d+) declared\)/.exec(TESTING)
    expect(heading, 'the accessibility section heading no longer separates run from declared').not.toBeNull()
    expect(Number(heading![2])).toBe(AUDIT_PAGES)
    // Declared may exceed run: the run predates the pages added since.
    expect(Number(heading![1])).toBeLessThanOrEqual(AUDIT_PAGES)
  })

  it('counts every file it counts, counted from the file', () => {
    // The figure in brackets on a section heading is how many assertions that file makes. It
    // drifts the same way the journey count did, and two of the forty-two had already drifted
    // when this check was written. A literal `it(` is a floor rather than an exact count: a
    // file may expand one call into many, which is why `src/App.test.tsx` claims more than it
    // writes — and the surplus is only allowed where the file really does generate, so a padded
    // figure still fails.
    const sections = [...TESTING.matchAll(/^### `([^`]+)`[^\n]*?\((\d+)\)/gm)]
    expect(sections.length).toBeGreaterThan(30)
    for (const [, file, claimedText] of sections) {
      const claimed = Number(claimedText)
      const path = resolve(process.cwd(), file)
      expect(existsSync(path), `${file} is documented but is not in the repository`).toBe(true)
      const source = readFileSync(path, 'utf8')
      const written = (source.match(/^\s*(?:it|test)(?:\.\w+)?\(/gm) ?? []).length
      expect(claimed, `${file} writes ${written} assertions; the document claims ${claimed}`).toBeGreaterThanOrEqual(written)
      if (claimed > written) {
        const generates = /for \(|\.(map|forEach|each)\(/.test(source)
        expect(generates, `${file} claims ${claimed} assertions from ${written} places and generates none`).toBe(true)
      }
    }
  })

  it('quotes the size of the unit suite from the files that make it up', () => {
    // Three places state how big the unit suite is: the results table and §2 of this
    // document, and the README's testing section. The file count is read off the tree, so it
    // is exact; the test count is the assertions every file writes, which is a floor rather
    // than a total because a generated test is invisible to a static read. A figure that has
    // fallen behind the suite it describes therefore fails, and one ahead of it is allowed
    // only where some file genuinely generates.
    const files: string[] = []
    const walk = (directory: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) walk(path)
        else if (/\.test\.tsx?$/.test(entry.name)) files.push(path)
      }
    }
    walk(resolve(process.cwd(), 'src'))
    const written = files.reduce(
      (sum, file) => sum + (readFileSync(file, 'utf8').match(/^\s*(?:it|test)(?:\.\w+)?\(/gm) ?? []).length,
      0,
    )
    const generates = files.some((file) => /for \(|\.(map|forEach|each)\(/.test(readFileSync(file, 'utf8')))

    const claims: { where: string; total: number; files: number | null }[] = []
    const readme = /# (\d+) unit and component tests across (\d+) files/.exec(README)
    expect(readme, 'README.md no longer states the size of the unit suite').not.toBeNull()
    claims.push({ where: 'README.md', total: Number(readme![1]), files: Number(readme![2]) })

    const results = /— (\d+) files, \*\*(\d+) tests\*\*/.exec(TESTING)
    expect(results, 'docs/TESTING.md §1 no longer states the size of the unit suite').not.toBeNull()
    claims.push({ where: 'docs/TESTING.md §1', total: Number(results![2]), files: Number(results![1]) })

    const section = /## 2\. Unit and component tests \((\d+)\)/.exec(TESTING)
    expect(section, 'docs/TESTING.md §2 no longer states the size of the unit suite').not.toBeNull()
    claims.push({ where: 'docs/TESTING.md §2', total: Number(section![1]), files: null })

    const appendix = /(\d+) unit files and (\d+) unit tests/.exec(TESTING)
    expect(appendix, 'docs/TESTING.md no longer states the size of the unit suite in its appendix').not.toBeNull()
    claims.push({ where: 'docs/TESTING.md §6', total: Number(appendix![2]), files: Number(appendix![1]) })

    for (const claim of claims) {
      if (claim.files !== null) {
        expect(claim.files, `${claim.where} names ${claim.files} files; the tree holds ${files.length}`).toBe(files.length)
      }
      expect(claim.total, `${claim.where} claims ${claim.total} tests; the files write ${written}`).toBeGreaterThanOrEqual(
        written,
      )
      if (claim.total > written) {
        expect(generates, `${claim.where} is ahead of the written count and no file generates tests`).toBe(true)
      }
    }
  })

  it('lists every file that makes up the unit suite', () => {
    // §2 states that every file in the suite is listed there, and the check above proves only
    // the other direction — that a listed file exists. A new test could therefore join the
    // suite and stay undocumented, which is what happened to the four deep-dive screens.
    const files: string[] = []
    const walk = (directory: string, prefix: string) => {
      for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const path = join(directory, entry.name)
        const shown = `${prefix}/${entry.name}`
        if (entry.isDirectory()) walk(path, shown)
        else if (/\.test\.tsx?$/.test(entry.name)) files.push(shown)
      }
    }
    walk(resolve(process.cwd(), 'src'), 'src')

    const listed = new Set(
      [...TESTING.matchAll(/^### `([^`]+)`/gm)].map((match) => match[1].replace(/\\/g, '/')),
    )
    for (const file of files) {
      expect(listed.has(file), `${file} is in the suite but not listed in docs/TESTING.md §2`).toBe(true)
    }
    expect(listed.size, 'docs/TESTING.md §2 lists a file the suite does not have').toBe(files.length)
  })
})

describe('the browser suites cover what the registry promises', () => {
  it('audits every registered laboratory route', () => {
    // A screen can be unit-tested and still never be seen by axe, because the
    // audit walks its own list of pages rather than the registry.
    const audited = new Set(
      [...A11Y.matchAll(/^    \{ name: '[^']+', hash: '([^']+)'/gm)].map((match) => match[1]),
    )
    for (const lab of LABS) {
      expect(audited.has('#' + lab.route), `${lab.route} is in the registry but not in the accessibility audit`).toBe(true)
    }
  })

  it('opens a browser page for every laboratory that has its own route', () => {
    const visited = new Set((SMOKE.match(/#\/[a-z-]+(?:\/[a-z-]+)?/g) ?? []).map((hash) => hash.replace('#', '')))
    for (const lab of LABS) {
      if (lab.route === '/builder') continue
      expect(visited.has(lab.route), `${lab.route} is never visited by the smoke suite`).toBe(true)
    }
  })
})
