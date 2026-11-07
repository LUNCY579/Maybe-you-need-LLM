/**
 * Tests for the collection-wide coverage audit.
 *
 * The audit turns 200 sentences in `references/manifest.json` into a scoreboard, and a
 * scoreboard nobody can question is worse than no scoreboard. So the two decisions it
 * rests on are asserted here: which words of a declared item have to appear in a file, and
 * which tier a file’s evidence puts the item in. Each had a bug while it was being written,
 * and each bug is pinned below — a string extractor that paired a closing quote with a
 * distant opening one and ate the registry, a fixed-length stem that split `head` from
 * `heads`, and a filler-word requirement that put implemented laboratories in the gap
 * column.
 *
 * The last block reads the real repository. It is the part that earns the number: the one
 * closed course must stay closed, and its own registry must keep naming the manifest’s
 * sentences verbatim.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  evidenceOf,
  hasWord,
  indexOf,
  inflections,
  judge,
  makeScan,
  matches,
  normalise,
  overlap,
  prefixFloor,
  registryOf,
  requirements,
  scanApp,
  termsOf,
  testTitlesOf,
  trace,
} from './check-lab-coverage.mjs'

const ROOT = process.cwd()

/* ------------------------------------------------------------------ fixtures */

/** A screen, module or content file, as the scan sees it. */
const file = (path, source) => ({
  path,
  ...evidenceOf(path.split('/').pop().replace(/\.[^.]+$/, ''), source),
})

/** A test file, which contributes its titles rather than its text. */
const checked = (path, source) => ({ path, ...testTitlesOf(path.split('/').pop(), source) })

/** Filler files, so a fixture’s word frequencies look like a real application’s. */
const filler = (n) => Array.from({ length: n }, (_, index) => file(`src/core/other${index}.ts`, 'export const unrelated = true'))

const REGISTRY = `export const LABS = [
  {
    id: 'superposition',
    name: 'A · Superposition',
    delivers: ['Superposition in a tiny model'],
  },
]`

const SCREEN = `export function SuperpositionLab() {
  return <Panel title="A · Superposition">{'The interference of a tiny model of superposition.'}</Panel>
}`

const RENDER_TEST = `import { LABS } from '../../content/labs'
import { LAB_SCREENS } from './index'
describe.each(LABS)('every registered laboratory', () => {
  it('renders the screen', () => renderLab('superposition'))
})`

/* ------------------------------------------------------------------ which words matter */

describe('the words a declared item is made of', () => {
  it('keeps words whole, because truncating them is not stemming', () => {
    expect(termsOf('attention heads the modelling')).toEqual(new Set(['attention', 'heads', 'modelling']))
  })

  it('drops connectives and words too short to identify anything', () => {
    expect(termsOf('the and for of ab is versus')).toEqual(new Set([]))
  })

  it('treats a parenthetical as another spelling of the same idea', () => {
    const alternatives = requirements('Alignment (SFT / DPO)', new Map(), 1)
    expect(alternatives).toContainEqual({ anchor: 'alignment', rest: ['sft'], quota: 0 })
    expect(alternatives).toContainEqual({ anchor: 'dpo', rest: [], quota: 0 })
  })

  it('splits on the separators that mean or and namely', () => {
    expect(requirements('Patching; ablation — intervention', new Map(), 1)).toEqual([
      { anchor: 'patching', rest: [], quota: 0 },
      { anchor: 'ablation', rest: [], quota: 0 },
      { anchor: 'intervention', rest: [], quota: 0 },
    ])
  })

  it('makes the rarest word the mandatory one', () => {
    // `model` and `attention` are background in a twelve-file application, so they say
    // nothing about which unit to look for; `knockout` is in two files, so it is the unit.
    const df = new Map([
      ['model', 12],
      ['attention', 9],
      ['knockout', 2],
    ])
    expect(requirements('Attention knockout in the model', df, 12)).toEqual([{ anchor: 'knockout', rest: [], quota: 0 }])
  })

  it('asks half of the remaining discriminating words, ordered by rarity', () => {
    const df = new Map([
      ['sparse', 1],
      ['dictionary', 2],
      ['feature', 3],
      ['autoencoder', 4],
    ])
    expect(requirements('Sparse autoencoder feature dictionary', df, 12)).toEqual([
      { anchor: 'sparse', rest: ['dictionary', 'feature', 'autoencoder'], quota: 1 },
    ])
  })

  it('demands nothing from a line made only of filler', () => {
    const df = new Map([
      ['alpha', 12],
      ['beta', 12],
      ['gamma', 12],
    ])
    expect(requirements('The alpha beta gamma', df, 12)).toEqual([])
  })
})

describe('the inflections a file is allowed to answer to', () => {
  it('matches a plural, a participle and a camelCase identifier', () => {
    const index = indexOf(termsOf('attention heads allocateBlocks modelling the loss'))
    expect(hasWord(index, 'head')).toBe(true)
    expect(hasWord(index, 'modelling')).toBe(true)
    expect(hasWord(index, 'model')).toBe(true)
    expect(hasWord(index, 'allocat')).toBe(true)
  })

  it('does not let a short word stand for a long one', () => {
    const index = indexOf(termsOf('bias'))
    expect(hasWord(index, 'bia')).toBe(false)
    expect(hasWord(index, 'bias')).toBe(true)
  })

  it('keeps an acronym exact', () => {
    const index = indexOf(termsOf('the ioi task'))
    expect(hasWord(index, 'ioi')).toBe(true)
    expect(hasWord(index, 'io')).toBe(false)
  })

  it('takes a participle to its verb, which is how an item names a laboratory', () => {
    // The item says "training on the agent's own interaction data"; the screen and its test
    // say the policy was `trained` on it. Eight characters apart and the same idea.
    const index = indexOf(termsOf('a policy trained on its own rollouts'))
    expect(hasWord(index, 'training')).toBe(true)
    expect(hasWord(index, 'trained')).toBe(true)
    expect(inflections('training')).toContain('train')
  })

  it('refuses a prefix that agrees by accident, which is the collision this rule was built for', () => {
    // `interpolation` and `interface` share exactly five characters — the old floor — and no
    // idea. The item "Position interpolation and the effective context length" was credited
    // to a screen whose only matching word was `interface`, so the row said `tested` when
    // nothing in the application interpolated anything.
    const index = indexOf(termsOf('an interface for the decoder'))
    expect(hasWord(index, 'interpolation')).toBe(false)
    expect(hasWord(index, 'interface')).toBe(true)
    // The same prefix against a word that really is the same word still counts.
    expect(hasWord(indexOf(termsOf('interpolate the positions')), 'interpolation')).toBe(true)
    expect(prefixFloor('interpolation'.length, 'interface'.length)).toBe(7)
    expect(prefixFloor('interpolation'.length, 'interpolate'.length)).toBe(9)
  })

  it('never lets a prefix stand for a word shorter than the floor', () => {
    expect(hasWord(indexOf(termsOf('mode')), 'model')).toBe(false)
    expect(hasWord(indexOf(termsOf('modelling')), 'model')).toBe(true)
  })
})

describe('matching a file against an item', () => {
  it('needs the anchor and its share of the rest', () => {
    const alternatives = [{ anchor: 'faithfulness', rest: ['score', 'patching'], quota: 1 }]
    expect(matches(alternatives, indexOf(termsOf('the faithfulness of a score')))).toBe(true)
    expect(matches(alternatives, indexOf(termsOf('faithfulness alone')))).toBe(false)
    expect(matches(alternatives, indexOf(termsOf('only the score')))).toBe(false)
  })

  it('is satisfied by any one alternative', () => {
    const alternatives = [{ anchor: 'alignment', rest: [], quota: 0 }, { anchor: 'dpo', rest: [], quota: 0 }]
    expect(matches(alternatives, indexOf(termsOf('the dpo objective')))).toBe(true)
  })

  it('matches nothing when the item named nothing', () => {
    expect(matches([], indexOf(termsOf('absolutely anything at all here')))).toBe(false)
  })

  it('reports which words a file was missing, which is what --find prints', () => {
    const requirement = { anchor: 'patching', rest: ['faithfulness', 'score'], quota: 1 }
    const { hit, miss, satisfied } = overlap(requirement, indexOf(termsOf('activation patching')))
    expect(hit).toEqual(['patching'])
    expect(miss).toEqual(['faithfulness', 'score'])
    expect(satisfied).toBe(false)
  })
})

/* ------------------------------------------------------------------ what a file says */

describe('the evidence a file offers', () => {
  it('reads its own name as a word, which its identifiers may not say', () => {
    const { index } = evidenceOf('PagingLab', 'export function allocateBlocks() {}')
    expect(hasWord(index, 'paging')).toBe(true)
    expect(hasWord(index, 'allocate')).toBe(true)
  })

  it('reads a sentence the file puts in its own interface', () => {
    const { index } = evidenceOf('RepeatsLab', "return <p>{'How many epochs before repetition dominates.'}</p>")
    expect(hasWord(index, 'epoch')).toBe(true)
    expect(hasWord(index, 'dominates')).toBe(true)
  })

  it('counts the cases a test file asserts, not the groups it draws', () => {
    const entry = testTitlesOf(
      'core.test.ts',
      `describe('patching', () => {
  it('measures the effect', () => {})
  it.skip('is slow', () => {})
})
test.each(rows)('sweeps the curve', () => {})`
    )
    expect(entry.strings).toEqual(['patching', 'measures the effect', 'is slow', 'sweeps the curve'])
    expect(entry.cases).toBe(3)
  })

  it('sees no title in a describe that is given a variable', () => {
    // `describe(lab.id, …)` iterates a registry, so it asserts every screen without naming
    // one. The title scan cannot know that — which is why the registry itself is evidence.
    expect(testTitlesOf('lab.test.tsx', 'describe(lab.id, () => it("renders the screen", () => {}))').strings).toEqual([
      'renders the screen',
    ])
  })
})

describe('an application’s own registry', () => {
  const files = [file('src/content/labs.ts', REGISTRY)]

  it('maps a declared item, verbatim, to the lab that computes it', () => {
    expect(registryOf(files).get(normalise('Superposition in a tiny model'))).toMatchObject({ lab: 'superposition' })
  })

  it('names the file the claim came from', () => {
    expect(registryOf(files).get(normalise('Superposition in a tiny model')).file).toBe('src/content/labs.ts')
  })

  it('does not read a type declaration as a claim', () => {
    const registry = registryOf([
      file(
        'src/content/labs.ts',
        `export interface LabDefinition {
  id: string
  delivers: string[]
}`
      ),
    ])
    expect(registry.size).toBe(0)
  })

  it('reads every string of a wrapped list, apostrophes and all', () => {
    // This is the one place the audit needs whole strings rather than their words, and the
    // historical way to get it wrong: pairing quotes by scanning left to right lets the
    // closing quote of one literal open the next match and swallow the literal after it.
    const registry = registryOf([
      file(
        'src/content/labs.ts',
        `export const LABS = [
  { id: 'attention', delivers: [
    'Pathway decomposition of a single head',
    'A head’s effect, split over its source positions',
  ] },
]`
      ),
    ])
    expect(registry.size).toBe(2)
    expect(registry.get(normalise('A head’s effect, split over its source positions')).lab).toBe('attention')
  })

  it('assigns each list to the nearest id above it', () => {
    const registry = registryOf([
      file(
        'src/content/labs.ts',
        `export const LABS = [
  { id: 'first', delivers: ['One idea here'] },
  { id: 'second', delivers: ['Another idea here'] },
]`
      ),
    ])
    expect(registry.get(normalise('One idea here')).lab).toBe('first')
    expect(registry.get(normalise('Another idea here')).lab).toBe('second')
  })

  it('reads a double-quoted item that contains an apostrophe', () => {
    // The bug this pins was silent and cost two of the collection’s declarations: pairing
    // quotes by scanning left to right treats the apostrophe in `user's` as the end of a
    // single-quoted literal, so the item is never seen and the application is reported as
    // not having claimed it.
    const registry = registryOf([
      file(
        'src/content/labs.ts',
        `export const LABS = [
  { id: 'memory-longevity', delivers: [
    "Hierarchical summaries of a user's interactions, forgotten and reinforced on a curve",
  ] },
]`
      ),
    ])
    expect(registry.size).toBe(1)
    expect(registry.get(normalise("Hierarchical summaries of a user's interactions, forgotten and reinforced on a curve")).lab).toBe(
      'memory-longevity',
    )
  })

  it('reads an escaped apostrophe inside a single-quoted item', () => {
    const registry = registryOf([
      file(
        'src/content/labs.ts',
        `export const LABS = [
  { id: 'reasoning', delivers: ['The measurement behind the chapter\\'s warning that more thinking is not always better'] },
]`
      ),
    ])
    expect([...registry.keys()]).toEqual([normalise("The measurement behind the chapter's warning that more thinking is not always better")])
  })

  it('keeps a screen declaration with the entry that wrote it', () => {
    const registry = registryOf([
      file(
        'src/content/labs.ts',
        `export const LABS = [
  { id: 'first', screen: 'FirstLabPage', delivers: ['One idea here'] },
  { id: 'second', delivers: ['Another idea here'] },
]`
      ),
    ])
    expect(registry.get(normalise('One idea here')).screen).toBe('FirstLabPage')
    expect(registry.get(normalise('Another idea here')).screen).toBeUndefined()
  })
})

/* ------------------------------------------------------------------ the tiers */

describe('the tier a declared item lands in', () => {
  const registry = [file('src/content/labs.ts', REGISTRY)]
  const screen = [file('src/components/lab/SuperpositionLab.tsx', SCREEN)]
  const rendering = [checked('src/components/lab/lab.test.tsx', RENDER_TEST)]

  it('calls an item tested when its registry screen is rendered by a test', () => {
    const scan = makeScan({ screens: screen, content: registry, tests: rendering })
    expect(judge('Superposition in a tiny model', scan).status).toBe('tested')
  })

  it('calls it mapped when the registry claims it but nothing checks it', () => {
    const scan = makeScan({ screens: screen, content: registry })
    expect(judge('Superposition in a tiny model', scan).status).toBe('mapped')
  })

  it('calls it mapped when no screen file answers the registry id', () => {
    const scan = makeScan({ content: registry, tests: rendering })
    expect(judge('Superposition in a tiny model', scan).status).toBe('mapped')
  })

  it('pairs a declaration by the screen it names, when its id names no file', () => {
    // An application whose route ids are kebab-case and whose pages are `…LabPage.tsx` has
    // no way to reach the id-and-filename convention. `screen:` is how it states the pairing
    // anyway, and the audit resolves the name against every component in the application —
    // including ones in directories it does not treat as laboratory surfaces.
    const named = makeScan({
      screens: [file('src/pages/labs/WorldModelLabPage.tsx', 'export function WorldModelLabPage() { return null }')],
      content: [
        file(
          'src/content/labs.ts',
          `export const LABS = [
  { id: 'world-model', screen: 'WorldModelLabPage', delivers: ['Model-free versus model-based planning'] },
]`,
        ),
      ],
    })
    expect(judge('Model-free versus model-based planning', named).unit).toBe('src/pages/labs/WorldModelLabPage.tsx')

    const outside = makeScan({
      surfaces: [file('src/ui/demos/ContextWindowDemo.tsx', 'export function ContextWindowDemo() { return null }')],
      content: [
        file(
          'src/content/labs.ts',
          `export const LABS = [
  { id: 'memory', screen: 'ContextWindowDemo', delivers: ['Which facts survive a smaller window'] },
]`,
        ),
      ],
    })
    expect(judge('Which facts survive a smaller window', outside).unit).toBe('src/ui/demos/ContextWindowDemo.tsx')
  })

  it('says so when a declaration names a screen that is not there', () => {
    const scan = makeScan({
      content: [
        file(
          'src/content/labs.ts',
          `export const LABS = [
  { id: 'gone', screen: 'NoSuchLabPage', delivers: ['An idea whose component was deleted'] },
]`,
        ),
      ],
    })
    expect(judge('An idea whose component was deleted', scan).unit).toBe('unpaired')
  })

  it('calls an unregistered item tested when a screen and a test both name it', () => {
    const scan = makeScan({
      screens: screen,
      modules: filler(7),
      tests: [checked('src/core/core.test.ts', `it('computes the interference in a tiny model of superposition', () => {})`)],
    })
    expect(judge('Superposition in a tiny model', scan).status).toBe('tested')
  })

  it('calls it built when only a unit’s own words name it', () => {
    const scan = makeScan({ screens: [file('src/components/lab/RepeatsLab.tsx', 'const epochs = 2 // how many epochs before repetition dominates')] })
    expect(judge('How many epochs before repetition dominates', scan).status).toBe('built')
  })

  it('calls it taught when only the course text names it', () => {
    const scan = makeScan({ content: [file('src/content/curriculum.ts', "title: 'IsoFLOP curves and the crossover'")] })
    expect(judge('IsoFLOP curves', scan).status).toBe('taught')
  })

  it('calls it a gap when nothing in the application names it', () => {
    const scan = makeScan({ screens: screen, content: registry, tests: rendering })
    expect(judge('A completely unrelated notion', scan).status).toBe('gap')
  })

  it('points at the unit it matched, not at the whole application', () => {
    const scan = makeScan({ screens: screen, content: registry, tests: rendering })
    expect(judge('Superposition in a tiny model', scan).where).toEqual(['src/content/labs.ts', 'src/components/lab/SuperpositionLab.tsx'])
  })

  it('never lets a line of filler claim a unit', () => {
    const scan = makeScan({ screens: screen, content: registry, tests: rendering })
    for (const item of ['The model', 'A new idea about it', 'this and that']) {
      expect({ item, status: judge(item, scan).status }).toEqual({ item, status: 'gap' })
    }
  })
})

/* ------------------------------------------------------------------ the trace */

describe('the hand check behind a gap row', () => {
  it('shows the nearest file of every tier and the word that stopped it', () => {
    const scan = makeScan({ screens: [file('src/components/lab/AttentionLab.tsx', 'export const heads = 1 // pathway of one attention head')] })
    const tiers = trace('Pathway decomposition of a single attention head', scan)
    expect(tiers.map((tier) => tier.kind)).toEqual(['screen', 'module', 'test', 'taught'])
    const nearest = tiers[0].nearest[0]
    expect(nearest.path).toBe('src/components/lab/AttentionLab.tsx')
    expect(nearest.hit).toContain('attention')
  })

  it('says so plainly when no file shares a word with the item', () => {
    const scan = makeScan({ screens: [file('src/components/lab/AttentionLab.tsx', 'export const heads = 1')] })
    expect(trace('Quantising the key cache', scan)[0].nearest).toEqual([])
  })
})

/* ------------------------------------------------------------------ the real repository */

describe('the closed course', () => {
  const scan = scanApp('mech-interp-lab')
  const manifest = JSON.parse(readFileSync(join(ROOT, 'references', 'manifest.json'), 'utf8'))
  const items = manifest.sources
    .filter((source) => source.app === 'mech-interp-lab')
    .flatMap((source) => source.labs ?? [])

  it('declares every item its sources promise, in the application’s own words', () => {
    for (const item of items) expect(scan.registry.has(normalise(item))).toBe(true)
  })

  it('reports no item below tested, which is what --strict asserts', () => {
    for (const item of items) {
      expect({ item, status: judge(item, scan).status }).toEqual({ item, status: 'tested' })
    }
  })

  it('finds a screen for every registered laboratory', () => {
    const labs = new Set([...scan.registry.values()].map((entry) => entry.lab))
    for (const lab of labs) {
      expect(scan.screens.some((screen) => screen.name.replace(/lab$/i, '').toLowerCase() === lab)).toBe(true)
    }
  })

  it('audits every declared item of every application exactly once', () => {
    const declared = manifest.sources.reduce((sum, source) => sum + (source.app ? (source.labs?.length ?? 0) : 0), 0)
    const apps = new Set(manifest.sources.filter((source) => source.app).map((source) => source.app))
    expect(declared).toBe(200)
    expect(apps.size).toBe(16)
  })

  /** Every application with the items its sources promise. */
  function itemsByApp() {
    const byApp = new Map()
    for (const source of manifest.sources) {
      if (!source.app) continue
      if (!byApp.has(source.app)) byApp.set(source.app, [])
      for (const item of source.labs ?? []) byApp.get(source.app).push(item)
    }
    return byApp
  }

  it('holds every application of the collection at tested, not merely the three first closed', () => {
    // `--strict` used to be run over the three courses that had adopted it, because the
    // other thirteen were still being worked through. They are not any more, so the
    // assertion is the whole collection: an item that loses its unit — a screen deleted,
    // a test renamed, a matcher loosened — fails here rather than turning `verify` green
    // with a smaller number in a column nobody reads.
    const weak = []
    for (const [app, items] of itemsByApp()) {
      const scan = scanApp(app)
      for (const item of items) {
        const status = judge(item, scan).status
        if (status !== 'tested') weak.push(`${app} :: ${item} -> ${status}`)
      }
    }
    expect(weak).toEqual([])
  })

  it('reports which registries still leave items to the word matcher', () => {
    // A registry entry is the application saying which screen computes which item; the
    // word matcher is the audit guessing. The count is pinned so that dropping a
    // `delivers` line is a decision, not an accident. The list is now empty: every item the
    // collection declares is claimed by a unit that names its screen, including the Gist
    // promise, which the context-window demo took on by fitting a compressor on the other
    // windows instead of writing its summaries by hand.
    const partial = []
    for (const [app, items] of itemsByApp()) {
      const scan = scanApp(app)
      const declared = items.filter((item) => scan.registry.has(normalise(item))).length
      if (declared < items.length) partial.push(`${app} ${declared}/${items.length}`)
    }
    expect(partial).toEqual([])
  })

  it('pairs every registry declaration with a component that exists', () => {
    // `declares` says an application wrote the item down; `paired` says the audit found the
    // screen it points at. A declaration that resolves to nothing is a promise with no
    // address, and it used to be invisible: an application whose route ids are kebab-case
    // and whose files are `…LabPage.tsx` paired with none of its own screens, so all of its
    // rows rested on the word matcher while looking like they rested on a registry.
    const unpaired = []
    for (const [app, items] of itemsByApp()) {
      const scan = scanApp(app)
      for (const item of items) {
        const verdict = judge(item, scan)
        if (verdict.unit === 'unpaired') unpaired.push(`${app} :: ${verdict.lab} -> ${item}`)
      }
    }
    expect(unpaired).toEqual([])
  })
})
