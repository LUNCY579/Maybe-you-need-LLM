import { describe, expect, it } from 'vitest'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DELIVERED_ITEMS, LABS, PLAYGROUND_LAB_IDS, labByTab } from './labs'
import { LESSONS } from './curriculum'

/**
 * The laboratory registry, checked against the rest of the repository.
 *
 * `src/content/labs.ts` is the list the playground's tabs are built from and the
 * list the collection's coverage audit reads `delivers` out of. Both uses fail
 * silently: a renamed screen leaves a declaration pointing at nothing, and a new
 * arm added to the page but not to the registry is invisible to the audit that
 * says this course is complete. These checks turn both into a failing test.
 */

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const MANIFEST = join(ROOT, '..', 'references', 'manifest.json')
const APP = 'llm-foundations-lab'

/** The declared laboratory items of this application, straight from the manifest. */
function declaredItems(): string[] {
  expect(existsSync(MANIFEST), `no manifest at ${MANIFEST}`).toBe(true)
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8')) as {
    sources: Array<{ app?: string; labs?: string[] }>
  }
  return manifest.sources.filter((source) => source.app === APP).flatMap((source) => source.labs ?? [])
}

/**
 * The screen names the coverage audit will answer an `id` to: a file in
 * `src/components/lab`, with a `Lab` suffix dropped and the rest lowercased. The
 * rule lives in `scripts/check-lab-coverage.mjs`; it is repeated here so that a
 * rename breaks a test rather than quietly weakening the audit.
 */
function screenNames(): Set<string> {
  const directory = join(ROOT, 'src', 'components', 'lab')
  return new Set(
    readdirSync(directory)
      .filter((file) => file.endsWith('.tsx') && !file.includes('.test.'))
      .map((file) => file.replace(/\.tsx$/, '').replace(/lab$/i, '').toLowerCase()),
  )
}

describe('the laboratory registry', () => {
  it('has a unique id and tab, and something to say about every arm', () => {
    expect(new Set(LABS.map((lab) => lab.id)).size).toBe(LABS.length)
    expect(new Set(PLAYGROUND_LAB_IDS).size).toBe(LABS.length)
    for (const lab of LABS) {
      expect(lab.id, 'an empty id').toBeTruthy()
      expect(lab.title.length, lab.id).toBeGreaterThan(6)
      expect(lab.blurb.length, lab.id).toBeGreaterThan(20)
      expect(lab.blurb.length, lab.id).toBeLessThan(120)
      expect(lab.delivers.length, `${lab.id} declares nothing`).toBeGreaterThan(0)
    }
  })

  it('names a screen that exists, exactly as the audit matches it', () => {
    const screens = screenNames()
    for (const lab of LABS) {
      expect(screens.has(lab.id.toLowerCase()), `${lab.id} answers to no screen in src/components/lab`).toBe(true)
    }
  })

  it('claims each declared item once, and claims nothing the manifest does not list', () => {
    expect(new Set(DELIVERED_ITEMS).size, 'an item claimed by two arms').toBe(DELIVERED_ITEMS.length)
    const declared = declaredItems()
    for (const item of DELIVERED_ITEMS) {
      expect(declared, `"${item}" is not a declared item of ${APP}`).toContain(item)
    }
    for (const item of declared) {
      expect(DELIVERED_ITEMS, `"${item}" is declared by the manifest and delivered by nothing`).toContain(item)
    }
  })

  it('is the list the application renders', () => {
    const page = readFileSync(join(ROOT, 'src', 'pages', 'PlaygroundPage.tsx'), 'utf8')
    const landing = readFileSync(join(ROOT, 'src', 'pages', 'Landing.tsx'), 'utf8')
    expect(page).toContain("'../content/labs'")
    expect(page).toContain('LABS.map')
    expect(page).toContain('labByTab')
    // the tabs and the landing list must come from the registry, not from a
    // second hand-written list that can forget an arm
    expect(page).not.toMatch(/^const LABS/m)
    expect(landing).toContain('LABS.map')
    expect(landing).not.toMatch(/Seven laboratories/)
  })

  it('resolves through the lookup it publishes', () => {
    for (const lab of LABS) expect(labByTab(lab.tab)).toBe(lab)
    expect(labByTab('no-such-lab')).toBeUndefined()
    expect(labByTab(null)).toBeUndefined()
  })

  it('keeps the laboratory count every page states honest', () => {
    // `routes.ts` deliberately imports nothing, so it writes the number in words.
    // This is the tie-back: add an arm to the registry and the page that says
    // how many there are starts failing here instead of lying to the reader.
    const words = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten']
    const word = words[LABS.length]
    expect(word, `${LABS.length} laboratories has no spelled-out form in this file`).toBeTruthy()
    const routes = readFileSync(join(ROOT, 'src', 'content', 'routes.ts'), 'utf8')
    expect(routes).toContain(`All ${word} laboratories`)
    expect(routes).toContain(`The ${word} laboratories`)
  })

  it('gives every arm a lesson that reaches it', () => {
    const linked = LESSONS.map((lesson) => lesson.interactive.lab)
    for (const tab of PLAYGROUND_LAB_IDS) {
      expect(linked, `${tab} is offered by no lesson`).toContain(tab)
    }
  })
})
