import { existsSync, readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
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
