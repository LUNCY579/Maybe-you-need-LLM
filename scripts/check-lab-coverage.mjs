#!/usr/bin/env node
/**
 * Which declared laboratory ideas actually exist?
 *
 * `references/manifest.json` records, for every source in the collection, the labs its
 * authors said the material invites: 200 items across 16 applications. That list is a
 * promise, and a promise in a file is worth nothing until something checks it. This
 * script checks it as far as a file scan honestly can, and prints the rest.
 *
 * For each declared item it looks inside the owning application for evidence, and reports
 * the strongest kind it finds:
 *
 *   tested  a unit is the item and something checks it — either the application’s own
 *           registry maps the item to a screen that a test renders, or a screen’s and a
 *           test’s words both name it
 *   mapped  the registry claims the item for a screen, but no test was found that names
 *           either of them
 *   built   a screen or a core module’s own words are the item, undeclared and unchecked
 *   taught  only the course text — a lesson, a glossary term — names it. The idea is in
 *           the course; nothing here says anything runs
 *   gap     nothing in the application names it
 *
 * The first tier is what a closed course looks like, and the last two are what the work
 * list is. `taught` is deliberately separated from `built`: "the page mentions it" is not
 * "the laboratory runs it", and conflating the two is the failure this audit exists to
 * catch. Two things make a row trustworthy rather than plausible — an application that
 * declares its own mappings (see `src/content/labs.ts` in mech-interp-lab), and the missing
 * word printed beside every `gap` row, which `--find` expands into every tier.
 *
 * A declaration and a pairing are not the same thing, and the report keeps them in separate
 * columns. `declares` counts the items an application’s registry claims; `paired` counts the
 * ones whose screen the audit could actually find — either the file named by the entry’s
 * `screen:` field, or the one whose name is the entry’s `id` without its `Lab` suffix. An
 * item that is declared but not paired is still carried by the word matcher, which is worth
 * knowing before it is worth calling green, so `--gaps` prints those rows too and `--json`
 * reports the resolved path under `unit`.
 *
 * Matching is deliberately conservative: an item is only claimed by a file that says its
 * rarest word, plus half of its other discriminating words (`requirements` explains why
 * those are the right two halves). When the bar is missed the row stays a `gap` even if a
 * file obviously circles the idea, because a false `built` hides work that has to be
 * written, while a false `gap` costs one read of the file the row names.
 *
 *   node scripts/check-lab-coverage.mjs
 *   node scripts/check-lab-coverage.mjs --gaps            # the work list, by app
 *   node scripts/check-lab-coverage.mjs --app mech-interp-lab --strict
 *   node scripts/check-lab-coverage.mjs --find "circuit" --app mech-interp-lab
 *   node scripts/check-lab-coverage.mjs --json
 *
 * `--strict` is non-zero unless every declared item has a unit behind it, which is how a
 * course is closed. All sixteen of them are closed, so `verify` prints the report and then
 * asserts over the whole collection. Without `--strict` the script only reports and exits
 * 0, which is what a run in the middle of building an arm needs to be.
 */

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..')
const MANIFEST = join(ROOT, 'references', 'manifest.json')

/* ------------------------------------------------------------------ text matching */

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'from', 'into', 'that', 'this', 'what', 'how', 'why',
  'are', 'was', 'were', 'its', 'their', 'them', 'then', 'than', 'over', 'under', 'out',
  'about', 'after', 'before', 'between', 'does', 'done', 'one', 'two', 'use', 'using',
  'also', 'just', 'only', 'very', 'more', 'most', 'less', 'least', 'both', 'each',
  'per', 'all', 'any', 'same', 'other', 'new', 'old', 'well', 'near', 'off',
  'versus', 'against', 'which', 'where', 'while', 'there', 'here', 'they', 'every',
  'own', 'via', 'upon', 'being', 'become', 'makes', 'make', 'gets', 'get', 'gives',
  'give', 'shows', 'show', 'tells', 'tell', 'need', 'needs', 'want', 'wants',
])

/**
 * The words worth matching on.
 *
 * A declared item and a source file rarely use the same inflection of the same word —
 * "attention head" against `heads`, "the ablation" against `ablate`. Truncating both to a
 * fixed length does not fix that (`heads` and `head` stay apart, and `ablation` and
 * `ablate` are pulled further apart), so words are kept whole and compared by shared
 * prefix instead, below.
 */
function termsOf(text) {
  const found = new Set()
  for (const word of text.toLowerCase().split(/[^a-z0-9]+/)) {
    if (word.length > 2 && !STOPWORDS.has(word)) found.add(word)
  }
  return found
}

/** A word and the forms of it that should answer to the same idea. */
function inflections(word) {
  const forms = [word]
  // `heads` to `head`, `losses` to `loss`, `biases` to `bias`. The length floors are what
  // keep this from being a licence: `mode` must not answer to `model`, and `ss` is not a
  // plural, and a three-letter remainder is a fragment rather than a word.
  if (word.length >= 5 && word.endsWith('s') && !word.endsWith('ss')) forms.push(word.slice(0, -1))
  if (word.length >= 6 && word.endsWith('es')) forms.push(word.slice(0, -2))
  // `training` to `train`, `sampled` to `sampl`. A declared item names what a laboratory
  // does and a screen or a test says what it did, so without these two the same idea sits
  // eight characters apart: the item "training on the agent's own interaction data" against
  // a test that titles itself `trained`. A stem taken this way is a whole word more often
  // than a shared prefix of the same length is, which is why it is exact-matched.
  if (word.length >= 7 && word.endsWith('ing')) forms.push(word.slice(0, -3))
  if (word.length >= 7 && word.endsWith('ings')) forms.push(word.slice(0, -4))
  if (word.length >= 7 && word.endsWith('ed')) forms.push(word.slice(0, -2))
  return forms
}

/**
 * A file’s words, with everything a declared item may answer to.
 *
 * Two rules, both needed. A word is first reduced to its inflections — `heads` to `head`,
 * `training` to `train` — and a shared prefix then covers the derivations an inflection list
 * cannot, taking `modelling` to `model` while leaving `mode` and `model` distinct. An exact
 * hit always counts, so the acronyms — `ioi`, `sae`, `dpo` — need neither rule.
 *
 * A prefix alone is not enough, and this is the rule a real collision taught. Every file
 * that says `interface` also says its first five letters, so a five-character floor let the
 * item "Position interpolation and the effective context length" be credited to a screen that
 * never interpolates anything: `interpolation` and `interface` agree on exactly five
 * characters and share no idea. So a prefix counts only when it also covers three quarters
 * of the shorter of the two words. `interpolation` (13) against `interface` (9) needs seven
 * characters and gets five, so it is refused; against `interpolate` (11) it needs nine and
 * shares ten, so it is accepted. When several words in one file begin with the same
 * prefix the longest is kept, which is the strictest reading, and the audit is built to fail
 * towards understating evidence: "a false `built` hides work that has to be written, while a
 * false `gap` costs one read of the file the row names."
 */
const SHARED_PREFIX = 5
const PREFIX_COVERAGE = 3 / 4

/** How many characters this pair of words has to agree on before it is the same word. */
function prefixFloor(itemLength, fileLength) {
  return Math.max(SHARED_PREFIX, Math.ceil(PREFIX_COVERAGE * Math.min(itemLength, fileLength)))
}

function indexOf(terms) {
  /** Each word, and each prefix of it, mapped to the longest word that produced it. */
  const index = new Map()
  const remember = (key, length) => {
    if ((index.get(key) ?? 0) < length) index.set(key, length)
  }
  for (const word of terms) {
    for (const form of inflections(word)) {
      remember(form, form.length)
      for (let length = SHARED_PREFIX; length < form.length; length++) remember(form.slice(0, length), form.length)
    }
  }
  return index
}

/** Does this file’s index carry this word, in any inflection of it? */
function hasWord(index, word) {
  for (const form of inflections(word)) {
    if (index.has(form)) return true
    for (let length = SHARED_PREFIX; length < form.length; length++) {
      const fileLength = index.get(form.slice(0, length))
      if (fileLength === undefined) continue
      if (length >= prefixFloor(form.length, fileLength)) return true
    }
  }
  return false
}

/** How many of an application's files mention each word. */
function documentFrequency(entries) {
  const counts = new Map()
  for (const entry of entries) {
    for (const token of entry.terms) counts.set(token, (counts.get(token) ?? 0) + 1)
  }
  return counts
}

/**
 * A declared item as a set of alternative requirements.
 *
 * "Alignment (SFT / Bradley–Terry / DPO)" is one idea with several spellings; a screen
 * called `SftLab` should match it. Splitting on the separators that mean "or" and "namely"
 * turns a hard AND into a small disjunction of short requirements, which is what these
 * titles are.
 *
 * Each requirement has one mandatory word — its rarest — and asks half of the remaining
 * discriminating words. The rarest is mandatory because it is the word that identifies the
 * unit: a file that cannot say "knockout" is not the knockout laboratory. The rest are
 * counted rather than demanded because a manifest line is prose, and prose carries filler
 * that no source file repeats — "a tiny model", "a single head". Requiring every word would
 * put implemented laboratories in the gap column; requiring nothing but the anchor would let
 * any file that mentions "loss" claim a unit.
 *
 * A word in more than half of the application's files is background, not identification. If
 * even the rarest word is background the requirement names nothing a scan can resolve, and
 * the item is left as a gap for `--find` to explain rather than matched to whichever file
 * happens to repeat the filler.
 */
function requirements(item, df, fileCount) {
  const alternatives = item
    .replace(/[（(]([^）)]*)[）)]/g, ' $1 ')
    .split(/\s*[/;·,]\s*|\s+—\s+|\s+-\s+(?=[a-z])/)
    .map((part) => [...termsOf(part)])
    .filter((part) => part.length > 0)
  if (alternatives.length === 0) return []

  const ceiling = Math.max(1, Math.floor(fileCount / 2))
  const rank = (token) => df.get(token) ?? 0

  return alternatives
    .map((part) => part.sort((a, b) => rank(a) - rank(b) || b.length - a.length))
    .filter((part) => rank(part[0]) <= ceiling)
    .map(([anchor, ...part]) => {
      const rest = part.filter((token) => rank(token) <= ceiling)
      return { anchor, rest, quota: Math.floor(rest.length / 2) }
    })
}

/** How much of one requirement a file supplies, and what it was missing. */
function overlap(requirement, index) {
  const tokens = [requirement.anchor, ...requirement.rest]
  const hit = tokens.filter((token) => hasWord(index, token))
  return {
    hit,
    miss: tokens.filter((token) => !hit.includes(token)),
    satisfied: hit.includes(requirement.anchor) && hit.length - 1 >= requirement.quota,
  }
}

/** Does this file satisfy any alternative of the item? */
function matches(alternatives, index) {
  return alternatives.some((alternative) => overlap(alternative, index).satisfied)
}

/* ------------------------------------------------------------------ app scanning */

const SCREEN_DIRS = [
  ['src/components/lab', 'screen'],
  ['src/components/demos', 'screen'],
  ['src/engine/labs', 'screen'],
  ['src/engine/demos', 'screen'],
  ['src/pages/labs', 'screen'],
]
const MODULE_DIRS = ['src/core', 'src/engine', 'src/lib', 'src/math']
const CONTENT_DIR = 'src/content'

function walk(directory) {
  const found = []
  for (const entry of readdirSync(directory)) {
    const path = join(directory, entry)
    if (statSync(path).isDirectory()) found.push(...walk(path))
    else found.push(path)
  }
  return found
}

function filesIn(appDirectory, relativeDirectory, extension) {
  const directory = join(appDirectory, relativeDirectory)
  if (!existsSync(directory)) return []
  return walk(directory).filter((path) => path.endsWith(extension))
}

/** Every test file in the application, wherever its authors put it. */
function testFilesIn(appDirectory) {
  return ['src', 'tests', 'test', 'e2e'].flatMap((child) => {
    const directory = join(appDirectory, child)
    return existsSync(directory) ? walk(directory).filter((path) => /\.test\.tsx?$/.test(path)) : []
  })
}

/** A path as this audit prints it: relative to the application, forward slashes. */
function show(appDirectory, path) {
  return relative(appDirectory, path).split(sep).join('/')
}

/** A file’s own name, without its extension. */
function baseName(path) {
  return path.split(sep).pop().replace(/\.(test\.)?(ts|tsx|js|jsx|mjs)$/, '')
}

/**
 * The words a file offers as evidence: its own name, and its own text.
 *
 * The name matters because `PagingLab.tsx` says what it is even when every identifier
 * inside it is `blocks`. The whole source is included rather than a curated subset because
 * a screen’s prose — its titles, its slider hints, the sentence under the figure — is the
 * file describing itself, and it is where a laboratory’s idea actually appears. An earlier
 * version pulled the quoted strings out first, and pairing them by scanning left to right
 * let the *closing* quote of one literal open the next match, swallowing the literal after
 * it. The registry is the one place that needs the strings themselves rather than their
 * words; `registryOf` reads those from inside a `delivers: [...]` block, where the pairing
 * is unambiguous.
 */
function evidenceOf(name, source) {
  const terms = termsOf([name, source].join(' '))
  return { name, source, terms, index: indexOf(terms) }
}

function fileText(path) {
  return evidenceOf(baseName(path), readFileSync(path, 'utf8'))
}

/** The titles a test file asserts, which is the evidence that a claim is checked. */
function testTitlesOf(name, source) {
  const titles = [...source.matchAll(/\b(?:it|test|describe)(?:\.\w+(?:\([^)]*\))?)?\s*\(\s*(['"`])([^'"`\n]{3,160})\1/g)].map((m) => m[2])
  const cases = [...source.matchAll(/\b(?:it|test)(?:\.\w+(?:\([^)]*\))?)?\s*\(\s*['"`]/g)].length
  const terms = termsOf(titles.join(' '))
  return { name, cases, strings: titles, source, terms, index: indexOf(terms) }
}

function testTitles(paths, appDirectory) {
  return paths
    .map((path) => ({ path: show(appDirectory, path), ...testTitlesOf(baseName(path), readFileSync(path, 'utf8')) }))
    .filter((entry) => entry.strings.length > 0)
}

/**
 * The application's own account of which screen computes which declared item.
 *
 * A registry entry of the shape `{ id: 'superposition', delivers: ['…', '…'] }` is the
 * strongest evidence this audit can find: it is the application, not a word matcher,
 * saying that a particular unit answers a particular promise. Apps that have not adopted
 * the convention return an empty map and fall back to the text scan below, which is why
 * the tiers are reported separately rather than collapsed into one number.
 *
 * The strings are read whole, and reading them whole is the one place in this file that
 * cannot be done with words. A literal is taken from its opening quote to the matching
 * one, so an apostrophe inside a double-quoted item — `summaries of a user's
 * interactions` — is text rather than a delimiter. Pairing quotes by scanning left to
 * right is what this function used to do, and it cost two of the collection's 200
 * declarations: the audit simply could not see an item that had been written down
 * correctly, and reported it as a row the application had not claimed.
 *
 * An entry may name its screen explicitly with `screen: 'PlanningLabPage'`. Without it
 * the screen is the file whose name is the entry's `id` with the `Lab` suffix dropped, and
 * that convention does not reach an application whose pages are `…LabPage.tsx` and whose
 * ids are kebab-case routes. The field exists so that such an application can still state
 * the pairing instead of leaving it to a name rule.
 */
function registryOf(files) {
  const map = new Map()
  const LITERAL = /(['"`])((?:\\.|(?!\1)[^\\\n]){4,200})\1/g
  for (const entry of files) {
    for (const match of entry.source.matchAll(/\bdelivers\s*:\s*\[([\s\S]*?)\]/g)) {
      const declaration = nearestDeclaration(entry.source.slice(0, match.index))
      if (declaration === undefined) continue
      for (const literal of match[1].matchAll(LITERAL)) {
        map.set(normalise(unquote(literal[2])), { ...declaration, file: entry.path })
      }
    }
  }
  return map
}

/**
 * The `id` and the optional `screen` that belong to a `delivers` block.
 *
 * Both are taken from the text above the block, and `screen` only counts when it sits
 * between this `id` and the block: a registry that names its screens for two entries out
 * of nine must not have the seventh one's items pair with the second one's page.
 */
function nearestDeclaration(before) {
  const FIELD = /\b(id|screen)\s*:\s*(['"`])((?:\\.|(?!\2)[^\\\n])*)\2/g
  let lab
  let screen
  for (const field of before.matchAll(FIELD)) {
    if (field[1] === 'id') {
      lab = unquote(field[3])
      screen = undefined
    } else if (lab !== undefined) {
      screen = unquote(field[3])
    }
  }
  return lab === undefined ? undefined : { lab, screen }
}

/** The text a source literal stands for: a backslash before a quote is punctuation. */
function unquote(text) {
  return text.replace(/\\(['"`\\])/g, '$1')
}

/** Two strings name the same idea when the only differences are spaces and punctuation. */
function normalise(text) {
  return text.toLowerCase().replace(/\s+/g, ' ').trim()
}

function scanApp(app) {
  const directory = join(ROOT, app)
  return makeScan({
    screens: SCREEN_DIRS.flatMap(([relativeDirectory]) =>
      filesIn(directory, relativeDirectory, '.tsx')
        .filter((path) => !path.includes('.test.'))
        .map((path) => ({ path: show(directory, path), ...fileText(path) })),
    ),
    // Every component in the application, whatever directory its authors chose. This is
    // not word evidence — it is the address book a `screen:` declaration is looked up in,
    // so that an application whose surfaces live in `src/ui/demos` or `src/pages/builder`
    // can still point a declaration at the file that computes the item.
    surfaces: filesIn(directory, 'src', '.tsx')
      .filter((path) => !path.includes('.test.'))
      .map((path) => ({ path: show(directory, path), ...fileText(path) })),
    modules: MODULE_DIRS.flatMap((relativeDirectory) =>
      filesIn(directory, relativeDirectory, '.ts')
        .filter((path) => !path.includes('.test.'))
        .map((path) => ({ path: show(directory, path), ...fileText(path) })),
    ),
    tests: testTitles(testFilesIn(directory), directory),
    content: filesIn(directory, CONTENT_DIR, '.ts')
      .filter((path) => !path.includes('.test.'))
      .map((path) => ({ path: show(directory, path), ...fileText(path) })),
  })
}

/**
 * Everything `judge` needs to know about an application, from its files.
 *
 * Split out because the interesting decisions — which tier an item lands in, what a
 * registry is worth — are testable against a fixture, and a fixture is a handful of
 * objects rather than a directory tree.
 */
function makeScan({ screens = [], surfaces = [], modules = [], tests = [], content = [] }) {
  const registry = registryOf([...content, ...modules])
  // A word's document frequency is measured over every file, so that a word's meaning does
  // not depend on which tier the evidence happens to sit in.
  const all = [...screens, ...modules, ...tests, ...content]
  return {
    screens,
    surfaces,
    modules,
    tests,
    content,
    registry,
    df: documentFrequency(all),
    fileCount: all.length,
    counts: {
      screens: screens.length,
      modules: modules.length,
      tests: tests.length,
      registry: registry.size,
      testCases: tests.reduce((sum, entry) => sum + entry.cases, 0),
    },
  }
}

/** The screen a registry entry points at, by name if it gave one and by convention if not. */
function findScreen(scan, mapping) {
  if (mapping.screen !== undefined) {
    return (
      scan.screens.find((entry) => entry.name === mapping.screen) ??
      (scan.surfaces ?? []).find((entry) => entry.name === mapping.screen)
    )
  }
  return scan.screens.find((entry) => entry.name.replace(/lab$/i, '').toLowerCase() === mapping.lab.toLowerCase())
}

/** The strongest kind of evidence a declared item has, and where it came from. */
function judge(item, scan) {
  const needed = requirements(item, scan.df, scan.fileCount)
  const hits = (entries) => entries.filter((entry) => matches(needed, entry.index))
  const screenHits = hits(scan.screens)
  const moduleHits = hits(scan.modules)
  const testHits = hits(scan.tests)
  const taughtHits = hits(scan.content)

  const mapping = scan.registry.get(normalise(item))
  const declared = mapping !== undefined
  // The registry says which screen computes the item, either by naming the file outright
  // with `screen:` or by the convention that the entry’s `id` is that file’s name without
  // its `Lab` suffix. Which of the two worked is reported, because a declaration whose
  // screen cannot be found is a claim the audit is still carrying on the word matcher’s
  // behalf.
  const screen = declared ? findScreen(scan, mapping) : undefined
  // A screen is checked either by a test that names it, or by a test that renders the
  // registry the item was declared in — `for (const lab of LABS) render(LAB_SCREENS[lab.id])`
  // exercises every screen, including ones no test mentions by name.
  const declaredModule = mapping ? mapping.file.replace(/^src\//, '').replace(/\.tsx?$/, '') : ''
  const checked =
    screen !== undefined &&
    scan.tests.some(
      (entry) =>
        entry.source.includes(screen.name) ||
        (declaredModule.length > 0 && entry.source.includes(declaredModule) && /\brender\w*\s*\(/.test(entry.source)),
    )

  const evidence = {
    declared,
    screen: screenHits.length > 0,
    module: moduleHits.length > 0,
    test: testHits.length > 0,
    taught: taughtHits.length > 0,
  }
  const runnable = evidence.screen || evidence.module
  const status = declared
    ? checked || evidence.test
      ? 'tested'
      : 'mapped'
    : runnable && evidence.test
      ? 'tested'
      : runnable
        ? 'built'
        : evidence.taught
          ? 'taught'
          : 'gap'

  return {
    status,
    evidence,
    lab: mapping?.lab,
    unit: declared && screen ? screen.path : declared ? 'unpaired' : undefined,
    where: declared && screen ? [mapping.file, screen.path] : [...screenHits, ...moduleHits].slice(0, 2).map((entry) => entry.path),
    tests: (declared && checked ? [screen] : testHits.slice(0, 1)).map((entry) => entry.path),
    taughtIn: taughtHits.slice(0, 2).map((entry) => entry.path),
  }
}

/* ------------------------------------------------------------------------ running */

/**
 * The closest files to an item, tier by tier, with the words each one was missing.
 *
 * A `gap` row is a claim about a name scan, not about the application, and the two are
 * not always the same thing. This is how you tell them apart without guessing: it shows
 * the file that came nearest and the token that stopped it, which is either "the unit
 * exists under another name" or "nothing here is that unit" — and the fix is different.
 */
function trace(item, scan) {
  const alternatives = requirements(item, scan.df, scan.fileCount)
  const kinds = [
    ['screen', scan.screens],
    ['module', scan.modules],
    ['test', scan.tests],
    ['taught', scan.content],
  ]
  return kinds.map(([kind, entries]) => ({
    kind,
    nearest: entries
      .map((entry) => {
        const scored = alternatives
          .map((alternative) => overlap(alternative, entry.index))
          .sort((a, b) => a.miss.length - b.miss.length || b.hit.length - a.hit.length)[0]
        return scored ? { path: entry.path, ...scored } : null
      })
      .filter((entry) => entry !== null && entry.hit.length > 0)
      .sort((a, b) => b.hit.length - a.hit.length || a.miss.length - b.miss.length)
      .slice(0, 3),
  }))
}

function parseArgs(argv) {
  const options = { apps: [], json: false, gaps: false, strict: false, find: [], help: false }
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index]
    if (argument === '--json') options.json = true
    else if (argument === '--gaps') options.gaps = true
    else if (argument === '--strict') options.strict = true
    else if (argument === '--app') options.apps.push(String(argv[++index]))
    else if (argument === '--find') options.find.push(String(argv[++index]).toLowerCase())
    else if (argument === '--help' || argument === '-h') options.help = true
    else throw new Error(`unknown option ${argument}`)
  }
  return options
}

function main() {
  const options = parseArgs(process.argv.slice(2))
  if (options.help) {
    console.log(
      [
        'usage: node scripts/check-lab-coverage.mjs [--app <id>] [--gaps] [--json] [--strict]',
        '',
        '  --app     restrict the audit to one application (repeatable)',
        '  --gaps    list the items with no unit behind them, the items whose unit is',
        '            not named by a test, and the registry declarations that name no screen',
        '  --find    for items whose text contains this, show the nearest file and the',
        '            word that stopped it — how a gap row is checked by hand',
        '  --json    the whole audit as one document',
        '  --strict  exit non-zero unless every declared item has a unit behind it',
      ].join('\n'),
    )
    return
  }

  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'))
  const declared = new Map()
  for (const source of manifest.sources) {
    if (!source.app) continue
    if (!declared.has(source.app)) declared.set(source.app, [])
    for (const lab of source.labs ?? []) declared.get(source.app).push({ item: lab, source: source.id })
  }

  if (options.find.length > 0) {
    let printed = 0
    for (const [app, items] of [...declared].sort((a, b) => a[0].localeCompare(b[0]))) {
      if (options.apps.length > 0 && !options.apps.includes(app)) continue
      const wanted = items.filter((entry) => options.find.some((needle) => entry.item.toLowerCase().includes(needle)))
      if (wanted.length === 0) continue
      if (!existsSync(join(ROOT, app))) {
        console.log(`${app} — no such directory, so nothing to trace.`)
        continue
      }
      const scan = scanApp(app)
      for (const entry of wanted) {
        const verdict = judge(entry.item, scan)
        console.log(`${app} · ${entry.item}  [${verdict.status}${verdict.lab ? ` · registry: ${verdict.lab}` : ''}]`)
        for (const tier of trace(entry.item, scan)) {
          if (tier.nearest.length === 0) {
            console.log(`  ${tier.kind.padEnd(6)} no file in the application shares a word with it`)
            continue
          }
          for (const file of tier.nearest) {
            const verdict = file.miss.length === 0 ? 'every word' : `missing ${file.miss.join(', ')}`
            console.log(`  ${tier.kind.padEnd(6)} ${file.path}  has ${file.hit.join(', ')} — ${verdict}`)
          }
        }
        console.log('')
        printed++
      }
    }
    if (printed === 0) console.log('No declared item matches that text.')
    return
  }

  const rows = []
  for (const [app, items] of [...declared].sort((a, b) => a[0].localeCompare(b[0]))) {
    if (options.apps.length > 0 && !options.apps.includes(app)) continue
    if (!existsSync(join(ROOT, app))) {
      rows.push({ app, missing: true, declared: items.length, results: [] })
      continue
    }
    const scan = scanApp(app)
    rows.push({
      app,
      declared: items.length,
      counts: scan.counts,
      scan,
      results: items.map((entry) => ({ ...entry, ...judge(entry.item, scan) })),
    })
  }

  const tally = (key) => rows.reduce((sum, row) => sum + (row.results ?? []).filter((result) => result.status === key).length, 0)
  const totals = {
    declared: rows.reduce((sum, row) => sum + row.declared, 0),
    tested: tally('tested'),
    mapped: tally('mapped'),
    built: tally('built'),
    taught: tally('taught'),
    gap: tally('gap'),
    paired: rows.reduce((sum, row) => sum + pairedCount(row), 0),
  }

  if (options.json) {
    console.log(
      JSON.stringify({ manifest: { version: manifest.version, lastVerified: manifest.lastVerified }, totals, apps: rows.map(({ scan, ...row }) => row) }, null, 2),
    )
  } else {
    console.log(`Declared laboratory ideas: ${totals.declared} across ${rows.length} applications (manifest ${manifest.version}, verified ${manifest.lastVerified}).`)
    console.log('')
    const header = ['application', 'declared', 'tested', 'mapped', 'built', 'taught', 'gap', 'screens', 'modules', 'declares', 'paired', 'checks']
    const widths = header.map((name) => Math.max(name.length, ...rows.map((row) => String(cell(row, name)).length)))
    const line = (cells) => cells.map((value, index) => String(value).padEnd(widths[index])).join('  ')
    console.log(line(header))
    for (const row of rows) {
      if (row.missing) {
        console.log(line([row.app, row.declared, 'no', 'such', 'directory', '', '', '', '', '', '', '', '']))
        continue
      }
      console.log(
        line([
          row.app,
          row.declared,
          count(row, 'tested'),
          count(row, 'mapped'),
          count(row, 'built'),
          count(row, 'taught'),
          count(row, 'gap'),
          row.counts.screens,
          row.counts.modules,
          row.counts.registry,
          cell(row, 'paired'),
          row.counts.testCases,
        ]),
      )
    }
    console.log(line(['total', totals.declared, totals.tested, totals.mapped, totals.built, totals.taught, totals.gap, '', '', '', totals.paired, '']))
    console.log('')
    console.log('tested  a unit is the item and something checks it · mapped  a registry names the unit, no test found')
    console.log('built   a unit’s own words are the item · taught  only the course text names it · gap  nothing does')
    console.log('declares  items the application’s registry claims · paired  of those, the ones whose screen was found')

    if (options.gaps) {
      for (const row of rows) {
        const results = row.results ?? []
        const unbacked = results.filter((result) => result.status === 'gap' || result.status === 'taught')
        const unchecked = results.filter((result) => result.status === 'built' || result.status === 'mapped')
        const unpaired = results.filter((result) => result.unit === 'unpaired')
        if (unbacked.length === 0 && unchecked.length === 0 && unpaired.length === 0) continue
        console.log('')
        console.log(
          `${row.app} — ${unbacked.length} with no unit behind them, ${unchecked.length} reaching a unit but not checked, ${unpaired.length} declared by a registry that names no screen`,
        )
        for (const result of unbacked) {
          let evidence
          if (result.status === 'taught') {
            evidence = `named only in ${result.taughtIn.join(', ') || 'the course text'}`
          } else {
            // A gap row is a claim about a name scan, so it says which name it wanted and
            // which file came nearest — "the unit exists under another word" and "nothing
            // here is that unit" look alike until the missing word is printed.
            const nearest = trace(result.item, row.scan).find((tier) => tier.nearest.length > 0)
            evidence = nearest
              ? `nearest ${nearest.kind} ${nearest.nearest[0].path} has ${nearest.nearest[0].hit.join(', ')} — missing ${nearest.nearest[0].miss.join(', ')}`
              : 'nothing in the application shares a word with it'
          }
          console.log(`  [${result.status.padEnd(6)}] ${result.item}  (${result.source}) — ${evidence}`)
        }
        for (const result of unchecked) {
          console.log(`  [${result.status.padEnd(6)}] ${result.item}  (${result.source}) — ${result.where.join(', ')}`)
        }
        for (const result of unpaired) {
          // A declaration that names a screen no file answers to is the registry pointing
          // at nothing. The item still counts as tested if a test happens to share its
          // words, which is exactly why the pairing is printed rather than folded in.
          console.log(`  [unpaired] ${result.item}  (${result.source}) — registry entry “${result.lab}” has no screen; add screen: '…' or rename the file`)
        }
      }
    }
  }

  // A course is closed when every item it declares has a unit behind it, which is the
  // one thing `--strict` is asked to decide.
  if (options.strict && totals.gap + totals.taught > 0) process.exitCode = 1
}

function count(row, status) {
  return (row.results ?? []).filter((result) => result.status === status).length
}

/** How many of an application’s declared items name a screen the audit could find. */
function pairedCount(row) {
  return (row.results ?? []).filter((result) => result.unit && result.unit !== 'unpaired').length
}

function cell(row, name) {
  if (name === 'application') return row.app
  if (name === 'declared') return row.declared
  if (name === 'paired') return pairedCount(row)
  if (name === 'screens') return row.counts?.screens ?? 0
  if (name === 'modules') return row.counts?.modules ?? 0
  if (name === 'declares') return row.counts?.registry ?? 0
  if (name === 'checks') return row.counts?.testCases ?? 0
  return row[name] ?? 0
}

// Imported by `check-lab-coverage.test.mjs` for the parts worth asserting; run directly to
// print the audit.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()

export {
  STOPWORDS,
  termsOf,
  inflections,
  prefixFloor,
  indexOf,
  hasWord,
  requirements,
  overlap,
  matches,
  normalise,
  evidenceOf,
  testTitlesOf,
  registryOf,
  makeScan,
  scanApp,
  judge,
  trace,
  count,
}
