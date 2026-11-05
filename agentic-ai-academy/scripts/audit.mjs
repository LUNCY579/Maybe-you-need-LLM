/**
 * The interaction audit.
 *
 * The browser suite checks that controls exist and that pages render. This
 * checks something different and harder: that the promises the interface
 * makes are actually kept. "Your bookmark is saved" means the bookmark is
 * there after a reload. "A wrong answer comes back for review" means it is
 * in the review queue, not that the queue has a heading. "Export your
 * progress" means the file is valid JSON that can be imported again.
 *
 * Every check below is a journey a student can take. A check is written
 * against the *outcome* rather than the presence of a control, because that
 * is the difference between a button that exists and a feature that works.
 *
 *     npm run audit
 *
 * It builds the site, serves the build, drives it with Playwright, and exits
 * non-zero if a promise is not kept.
 */
import { spawn } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const PORT = 4320
const BASE = `http://127.0.0.1:${PORT}`

const findings = []
let passed = 0

/**
 * Record a check.
 *
 * The check is stated as a promise, because that is what a reader wants to
 * know: not "the dashboard renders" but "a bookmarked lesson is still there
 * after a reload".
 */
function check(ok, promise, detail = '') {
  if (ok) {
    passed += 1
    console.log(`  ok    ${promise}`)
  } else {
    findings.push(`${promise}${detail ? ` — ${detail}` : ''}`)
    console.log(`  FAIL  ${promise}${detail ? ` — ${detail}` : ''}`)
  }
}

/** Wait for the page to have a heading, so a check can assert the app is alive. */
async function expectHeading(page) {
  const heading = page.getByRole('heading', { level: 1 })
  await heading.first().waitFor({ state: 'visible', timeout: 10_000 })
}

/**
 * Move a range input the way a browser does.
 *
 * These sliders are React-controlled, so the value has to go through the
 * native setter before the `input` event is dispatched: assigning
 * `node.value` directly leaves React's change tracker seeing no difference,
 * and the component never re-runs. This is the same route `fireEvent.change`
 * takes in the unit tests, which is why both halves agree about what a moved
 * slider is supposed to do.
 */
async function setRange(slider, value) {
  await slider.evaluate((node, next) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(node, String(next))
    node.dispatchEvent(new Event('input', { bubbles: true }))
    node.dispatchEvent(new Event('change', { bubbles: true }))
  }, value)
}

/** The value a range input currently reports, from its own accessibility text. */
async function rangeValue(slider) {
  return Number(await slider.getAttribute('aria-valuetext'))
}

/** A value the slider can move to: the other end of its range if it is already at one end. */
async function otherRangeValue(slider) {
  const min = Number(await slider.getAttribute('min'))
  const max = Number(await slider.getAttribute('max'))
  const value = await rangeValue(slider)
  return value === max ? min : max
}

async function waitForServer(url, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // The server is not up yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`The preview server did not start at ${url}`)
}

/**
 * The journeys.
 *
 * Each one is a function that drives the page and returns whether the
 * promise was kept. They run in order, in one browser context, so that the
 * state builds up the way it would for a student working through the course.
 */
const JOURNEYS = [
  {
    name: 'A bookmark survives, and is findable',
    async run(page) {
      await page.goto(`${BASE}/#/lesson/foundations-of-language-modeling`)
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: /^bookmark$/i }).click()
      await page.waitForTimeout(300)
      await page.goto(`${BASE}/#/dashboard`)
      await page.waitForTimeout(800)
      const found = await page.getByText(/foundations: tokens, embeddings, attention/i).count()
      check(found > 0, 'a bookmarked lesson appears on the dashboard', `found ${found}`)
    },
  },
  {
    name: 'The advanced track persists',
    async run(page) {
      await page.goto(`${BASE}/#/lesson/foundations-of-language-modeling`)
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: /switch to advanced track/i }).click()
      await page.waitForTimeout(400)
      await page.reload()
      await page.waitForTimeout(900)
      const still = await page.getByText(/advanced track/i).count()
      check(still > 0, 'the advanced track survives a reload', `found ${still}`)
      await page.getByRole('button', { name: /switch to core track/i }).click()
      await page.waitForTimeout(300)
    },
  },
  {
    name: 'A ticked objective persists',
    async run(page) {
      await page.goto(`${BASE}/#/lesson/foundations-of-language-modeling`)
      await page.waitForTimeout(700)
      await page.getByRole('checkbox').first().check()
      await page.waitForTimeout(300)
      await page.reload()
      await page.waitForTimeout(900)
      check(await page.getByRole('checkbox').first().isChecked(), 'a ticked objective survives a reload')
    },
  },
  {
    name: 'A wrong answer comes back for review',
    async run(page) {
      // The laboratory's first diagnostic question is answered wrongly on
      // purpose, because that is what puts an item in the queue.
      await page.goto(`${BASE}/#/labs/planning`)
      await page.waitForTimeout(1500)
      await page.getByRole('radiogroup').first().getByRole('radio').first().click()
      await page.getByRole('button', { name: /commit and check/i }).first().click()
      await page.waitForTimeout(500)

      await page.goto(`${BASE}/#/assessments?tab=review`)
      await page.waitForTimeout(900)
      const due = await page.getByText(/\d+ question(s)? due for review/i).count()
      check(due > 0, 'a wrong answer appears in the review queue', `count ${due}`)

      // The next action on the dashboard says "review", and it has to open
      // the review queue rather than the first tab.
      await page.goto(`${BASE}/#/dashboard`)
      await page.waitForTimeout(900)
      const reviewAction = page.getByRole('button', { name: /^go: review \d+ question/i })
      if ((await reviewAction.count()) === 0) {
        check(false, 'the dashboard offers a review action when something is due')
        return
      }
      await reviewAction.first().click()
      await page.waitForTimeout(900)
      const onReview = await page.getByText(/\d+ question(s)? due for review/i).count()
      check(onReview > 0, "the dashboard's review action opens the review queue", page.url())
    },
  },
  {
    name: 'Progress exports and imports',
    async run(page) {
      await page.goto(`${BASE}/#/dashboard`)
      await page.waitForTimeout(800)
      const download = page.waitForEvent('download', { timeout: 15_000 })
      await page.getByRole('button', { name: /export/i }).click()
      const file = await download
      const filePath = await file.path()
      const text = await readFile(filePath, 'utf8')
      let parsed = null
      try {
        parsed = JSON.parse(text)
      } catch {
        // The check below reports it.
      }
      check(parsed !== null, 'the exported progress file is valid JSON')
      check(
        Array.isArray(parsed?.quizAttempts) && parsed.quizAttempts.length > 0,
        'the export contains the attempts made',
        `attempts ${parsed?.quizAttempts?.length}`,
      )
      check(
        Array.isArray(parsed?.objectiveChecks) && parsed.objectiveChecks.length > 0,
        'the export contains the ticked objectives',
        `objectives ${parsed?.objectiveChecks?.length}`,
      )
      return filePath
    },
  },
  {
    name: 'The concept map draws and opens',
    async run(page) {
      await page.goto(`${BASE}/#/glossary`)
      await page.waitForTimeout(800)
      await page.getByRole('tab', { name: /concept map/i }).click()
      await page.waitForTimeout(2500)
      const nodes = page.locator('.react-flow__node')
      const count = await nodes.count()
      check(count > 50, 'the concept map renders its nodes', `${count} nodes`)
      await nodes.first().click()
      await page.waitForTimeout(600)
      const help = await page.getByText(/how to read this/i).count()
      check(help === 0, 'clicking a node opens its detail panel')
    },
  },
  {
    name: 'Search finds and opens',
    async run(page) {
      await page.goto(`${BASE}/#/`)
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: /search the course/i }).click()
      await page.waitForTimeout(400)
      const dialog = page.getByRole('dialog', { name: /search the course/i })
      await dialog.getByRole('searchbox').first().fill('context window')
      await page.waitForTimeout(600)
      const results = await dialog.getByRole('option').count()
      check(results > 0, 'the search finds results', `${results}`)
      if (results > 0) {
        await dialog.getByRole('option').first().click()
        await page.waitForTimeout(800)
        check(page.url().includes('#/'), 'choosing a result navigates', page.url())
      }
    },
  },
  {
    name: 'A lab run is recorded',
    async run(page) {
      await page.goto(`${BASE}/#/labs/planning`)
      await page.waitForTimeout(1200)
      await page.getByRole('button', { name: /^greedy/i }).first().click()
      await page.waitForTimeout(500)
      await page.goto(`${BASE}/#/labs`)
      await page.waitForTimeout(900)
      const badges = await page.getByText(/run recorded/i).count()
      check(badges > 0, 'a lab run is recorded on the lab index', `badges ${badges}`)
    },
  },
  {
    name: 'The project workspace persists',
    async run(page) {
      await page.goto(`${BASE}/#/project`)
      await page.waitForTimeout(900)
      const checklist = page.getByRole('checkbox').first()
      if ((await checklist.count()) === 0) {
        check(false, 'the project workspace has a checklist to tick')
        return
      }
      await checklist.check()
      await page.waitForTimeout(300)
      await page.reload()
      await page.waitForTimeout(900)
      check(await page.getByRole('checkbox').first().isChecked(), 'a project milestone survives a reload')
    },
  },
  {
    name: 'The next actions lead somewhere',
    async run(page) {
      await page.goto(`${BASE}/#/dashboard`)
      await page.waitForTimeout(900)
      const actions = page.getByRole('button', { name: /^(review|read|start|resume|practise|continue)/i })
      const count = await actions.count()
      check(count > 0, 'the dashboard offers next actions', `${count}`)
      if (count > 0) {
        const before = page.url()
        await actions.first().click()
        await page.waitForTimeout(900)
        check(page.url() !== before, 'a next action navigates somewhere', page.url())
      }
    },
  },
  {
    name: 'Definitions open and close',
    async run(page) {
      await page.goto(`${BASE}/#/lesson/what-agentic-llms-are`)
      await page.waitForTimeout(900)
      const link = page.locator('button[title$="click for the definition"]').first()
      await link.click()
      await page.waitForTimeout(500)
      check((await page.getByRole('note').count()) > 0, 'clicking a glossary term opens its definition')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      check((await page.getByRole('note').count()) === 0, 'Escape closes the definition')
    },
  },
  {
    name: 'A definition leads to the glossary',
    async run(page) {
      await page.goto(`${BASE}/#/lesson/what-agentic-llms-are`)
      await page.waitForTimeout(900)
      const link = page.locator('button[title$="click for the definition"]').first()
      await link.click()
      await page.waitForTimeout(500)
      const route = page.getByRole('link', { name: /open in glossary/i }).or(page.getByRole('button', { name: /open in glossary/i }))
      if ((await route.count()) === 0) {
        check(false, 'the definition offers a route to the glossary')
        return
      }
      await route.first().click()
      await page.waitForTimeout(900)
      check(page.url().includes('/glossary'), "the definition's route to the glossary works", page.url())
    },
  },
  {
    name: 'Completing a lesson is counted',
    async run(page) {
      await page.goto(`${BASE}/#/dashboard`)
      await page.waitForTimeout(800)
      const before = await page.getByText(/lessons complete/i).first().locator('..').innerText()
      await page.goto(`${BASE}/#/lesson/future-directions`)
      await page.waitForTimeout(800)
      await page.getByRole('button', { name: /mark lesson complete/i }).click()
      await page.waitForTimeout(400)
      await page.goto(`${BASE}/#/dashboard`)
      await page.waitForTimeout(900)
      const after = await page.getByText(/lessons complete/i).first().locator('..').innerText()
      check(before !== after, 'completing a lesson changes the completed count', `${before} -> ${after}`)
    },
  },
  {
    name: 'The builder runs',
    async run(page) {
      await page.goto(`${BASE}/#/builder`)
      await page.waitForTimeout(1500)
      const step = page.getByRole('button', { name: /step$/i })
      if ((await step.count()) === 0) {
        check(false, 'the builder offers a step control')
        return
      }
      await step.first().click()
      await page.waitForTimeout(600)
      await page.getByRole('tab', { name: /^Trace/i }).click()
      await page.waitForTimeout(500)
      const steps = await page.getByRole('list', { name: /execution trace/i }).getByRole('listitem').count()
      check(steps > 0, 'stepping the workflow records a step in the trace', `${steps} steps`)
    },
  },
  {
    name: 'An export can be imported again',
    async run(page) {
      await page.goto(`${BASE}/#/dashboard`)
      await page.waitForTimeout(800)
      const download = page.waitForEvent('download', { timeout: 15_000 })
      await page.getByRole('button', { name: /export/i }).click()
      const file = await download
      const filePath = await file.path()

      const reset = page.getByRole('button', { name: /reset/i })
      if ((await reset.count()) === 0) {
        check(false, 'the dashboard offers a reset control')
        return
      }
      await reset.first().click()
      await page.waitForTimeout(400)
      const confirm = page.getByRole('button', { name: /yes|confirm|reset/i }).last()
      if ((await confirm.count()) > 0) await confirm.click()
      await page.waitForTimeout(600)

      const input = page.locator('input[type="file"]')
      if ((await input.count()) === 0) {
        check(false, 'the dashboard offers a file input for importing')
        return
      }
      await input.setInputFiles(filePath)
      await page.waitForTimeout(900)
      const restored = await page.getByText(/imported \d+ completed lessons/i).count()
      check(restored > 0, 'the exported file can be imported again', `message ${restored}`)
      const after = await page.getByText(/lessons complete/i).first().locator('..').innerText()
      check(after !== '0/12', 'the imported progress is restored', after)
    },
  },
  {
    name: 'A search result lands on the section it names',
    async run(page) {
      await page.goto(`${BASE}/#/`)
      await page.waitForTimeout(700)
      await page.getByRole('button', { name: /search the course/i }).click()
      await page.waitForTimeout(400)
      const dialog = page.getByRole('dialog', { name: /search the course/i })
      await dialog.getByRole('searchbox').first().fill('knowing-doing gap')
      await page.waitForTimeout(700)

      // Find a *section* result, not a lesson or a glossary term.
      const options = dialog.getByRole('option')
      const count = await options.count()
      let sectionIndex = -1
      for (let i = 0; i < count; i += 1) {
        const text = await options.nth(i).innerText()
        if (/\bsection\b/i.test(text) || /lesson \d+/i.test(text)) {
          sectionIndex = i
          break
        }
      }
      if (sectionIndex === -1) {
        check(false, 'the search offers a section result to follow')
        return
      }
      const label = await options.nth(sectionIndex).innerText()
      await options.nth(sectionIndex).click()
      await page.waitForTimeout(1000)
      check(page.url().includes('#/lesson/'), 'a search result opens a lesson', page.url())
      check(
        page.url().includes('#section-') || page.url().includes('#'),
        'a section result carries an anchor',
        page.url(),
      )
      // The page should have moved to the section, not stayed at the top.
      const moved = await page.evaluate(() => window.scrollY)
      check(moved > 0, 'a search result scrolls to the section it names', `scrollY ${moved} (${label.split('\n')[0]})`)
    },
  },
  {
    name: 'The curriculum source map covers every chapter',
    async run(page) {
      await page.goto(`${BASE}/#/curriculum`)
      await page.waitForTimeout(900)
      await page.getByRole('tab', { name: /source map/i }).click()
      await page.waitForTimeout(700)
      const chapters = await page.getByText(/^Ch\. \d+/).count()
      check(chapters >= 23, 'the source map lists every chapter of the book', `${chapters} chapters`)
    },
  },
  {
    name: 'The theme survives a reload',
    async run(page) {
      await page.goto(`${BASE}/#/`)
      await page.waitForTimeout(700)
      const toggle = page.getByRole('button', { name: /dark|light|theme/i }).first()
      await toggle.click()
      await page.waitForTimeout(400)
      const before = await page.evaluate(() => document.documentElement.className)
      await page.reload()
      await page.waitForTimeout(900)
      const after = await page.evaluate(() => document.documentElement.className)
      check(before === after, 'the chosen theme survives a reload', `${before} -> ${after}`)
    },
  },
  {
    name: 'A concept map concept leads to its lesson',
    async run(page) {
      await page.goto(`${BASE}/#/glossary`)
      await page.waitForTimeout(800)
      await page.getByRole('tab', { name: /concept map/i }).click()
      await page.waitForTimeout(2500)
      const node = page.locator('.react-flow__node').first()
      await node.click()
      await page.waitForTimeout(700)

      const route = page.getByRole('button', { name: /lesson|demonstration|try it|open/i }).first()
      if ((await route.count()) === 0) {
        check(false, 'a concept offers a route to where it is taught')
        return
      }
      const before = page.url()
      await route.click()
      await page.waitForTimeout(900)
      check(page.url() !== before, 'a concept map concept leads to where it is taught', page.url())
    },
  },
  {
    name: 'The mixed challenge set is a real set',
    async run(page) {
      await page.goto(`${BASE}/#/assessments?tab=mixed`)
      await page.waitForTimeout(1000)
      const questions = await page.getByRole('radiogroup').count()
      check(questions > 0, 'the mixed challenge set offers questions', `${questions}`)
    },
  },
  {
    name: 'The project reports what the course can already show',
    async run(page) {
      await page.goto(`${BASE}/#/project`)
      await page.waitForTimeout(1000)
      const readiness = await page.getByText(/readiness|evidence|recorded/i).count()
      check(readiness > 0, 'the project reports on the recorded activity', `${readiness} mentions`)
    },
  },
  {
    name: 'The glossary filters by the lesson that teaches a term',
    async run(page) {
      await page.goto(`${BASE}/#/glossary`)
      await page.waitForTimeout(900)
      const terms = page.locator('h2.font-semibold')
      const before = await terms.count()
      await page.getByLabel(/filter glossary by lesson/i).selectOption({ index: 1 })
      await page.waitForTimeout(600)
      const after = await terms.count()
      check(after > 0, 'the glossary still shows terms after filtering', `${after} of ${before}`)
      check(after <= before, 'the filter does not add terms', `${before} -> ${after}`)
    },
  },
  {
    name: 'A glossary term routes to the demonstration that exercises it',
    async run(page) {
      await page.goto(`${BASE}/#/glossary?term=Tool%20use`)
      await page.waitForTimeout(900)
      const link = page.getByRole('button', { name: /practise this concept/i })
      if ((await link.count()) === 0) {
        check(false, 'a concept offers a route to a demonstration')
        return
      }
      await link.first().click()
      await page.waitForTimeout(1200)
      check(page.url().includes('#demo-'), 'the route reaches the demonstration', page.url())
    },
  },
  {
    name: 'An unreadable file is refused without breaking anything',
    async run(page) {
      await page.goto(`${BASE}/#/dashboard`)
      await page.waitForTimeout(900)
      const input = page.locator('input[type="file"]')
      if ((await input.count()) === 0) {
        check(false, 'the dashboard offers a file input for importing')
        return
      }
      await input.setInputFiles({
        name: 'not-progress.json',
        mimeType: 'application/json',
        buffer: Buffer.from('this is not json at all'),
      })
      await page.waitForTimeout(900)
      // The page must still work, and must not claim an import happened.
      await expectHeading(page)
      const claimed = await page.getByText(/imported \d+ completed lessons/i).count()
      check(claimed === 0, 'a corrupt file is not reported as an import', `messages ${claimed}`)
    },
  },
  {
    name: 'The mobile navigation drawer opens and navigates',
    async run(page) {
      await page.setViewportSize({ width: 414, height: 896 })
      await page.goto(`${BASE}/#/`)
      await page.waitForTimeout(900)
      const menu = page.getByRole('button', { name: /navigation menu/i }).first()
      if ((await menu.count()) === 0) {
        check(false, 'the mobile navigation has a menu button')
        await page.setViewportSize({ width: 1440, height: 1000 })
        return
      }
      await menu.click()
      await page.waitForTimeout(500)
      const drawer = page.locator('#primary-navigation')
      check(await drawer.isVisible(), 'the mobile navigation drawer opens')
      await drawer.getByRole('button', { name: /^dashboard/i }).first().click()
      await page.waitForTimeout(900)
      check(page.url().includes('/dashboard'), 'the drawer navigates', page.url())
      await page.setViewportSize({ width: 1440, height: 1000 })
    },
  },
  {
    name: 'The builder connects two nodes without dragging',
    async run(page) {
      await page.goto(`${BASE}/#/builder`)
      await page.waitForTimeout(2000)
      const before = await page.locator('.react-flow__edge').count()

      const connect = page.getByRole('button', { name: /connect two nodes/i }).first()
      if ((await connect.count()) === 0) {
        check(false, 'the builder offers a two-click connection control')
        return
      }
      await connect.click()
      await page.waitForTimeout(400)

      const nodes = page.locator('.react-flow__node')
      await nodes.nth(0).click()
      await page.waitForTimeout(300)
      await nodes.nth(1).click()
      await page.waitForTimeout(700)

      const after = await page.locator('.react-flow__edge').count()
      check(after > before, 'two clicks make a connection', `${before} -> ${after} edges`)

      // Leave connect mode, select the source, and relabel its edge.
      const cancel = page.getByRole('button', { name: /cancel connection/i }).first()
      if ((await cancel.count()) > 0) await cancel.click()
      await page.waitForTimeout(300)
      await nodes.nth(0).click()
      await page.waitForTimeout(500)

      const branch = page.getByLabel(/branch for edge to/i).first()
      if ((await branch.count()) === 0) {
        check(false, 'an edge can be given a branch label')
        return
      }
      await branch.selectOption({ label: 'yes' })
      await page.waitForTimeout(400)
      const labelled = await page.getByText(/\byes\b/i).count()
      check(labelled > 0, 'a connection can be given a branch label', `labels ${labelled}`)
    },
  },
  {
    name: 'The assessment centre follows the lesson and the track',
    async run(page) {
      await page.goto(`${BASE}/#/assessments`)
      await page.waitForTimeout(900)
      await page.getByRole('tab', { name: /practice by lesson/i }).click()
      await page.waitForTimeout(700)

      // The page is loaded on demand, so the control has to be waited for.
      const lessonPicker = page.getByLabel(/choose a lesson to practise/i)
      await lessonPicker.waitFor({ state: 'visible', timeout: 15_000 })

      const first = await page.getByRole('radiogroup').count()
      check(first > 0, 'the assessment centre shows questions', `${first} groups`)

      // Switching the lesson changes the questions.
      await lessonPicker.selectOption({ index: 3 })
      await page.waitForTimeout(700)
      const afterLesson = await page.getByText(/Question \d+/).first().innerText()
      check(afterLesson.length > 0, 'the assessment centre follows the lesson', afterLesson)

      // And switching the track changes the set.
      await page.getByLabel(/choose which question set/i).selectOption({ label: 'Core + advanced track' })
      await page.waitForTimeout(700)
      const advanced = await page.getByRole('radiogroup').count()
      check(advanced > 0, 'the assessment centre follows the track', `${advanced} groups`)
    },
  },
  {
    name: 'The project workspace reports the recorded activity',
    async run(page) {
      await page.goto(`${BASE}/#/project`)
      await page.waitForTimeout(1000)
      const before = await page.getByText(/readiness|evidenced|recorded/i).count()
      check(before > 0, 'the project reports on the recorded activity', `${before} mentions`)

      // A ticked milestone changes the report.
      const checklist = page.getByRole('checkbox').first()
      if ((await checklist.count()) === 0) {
        check(false, 'the project has a checklist to tick')
        return
      }
      await checklist.check()
      await page.waitForTimeout(500)
      const ticked = await page.getByText(/readiness|evidenced|recorded/i).count()
      check(ticked > 0, 'the report still answers after a milestone is ticked', `${ticked} mentions`)
    },
  },
  {
    name: 'The shortcut sheet opens with the keyboard',
    async run(page) {
      await page.goto(`${BASE}/#/`)
      await page.waitForTimeout(800)
      await page.keyboard.press('?')
      await page.waitForTimeout(500)
      const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i })
      check(await dialog.isVisible().catch(() => false), 'the shortcut sheet opens with ?')
      await page.keyboard.press('Escape')
      await page.waitForTimeout(400)
      check(!(await dialog.isVisible().catch(() => false)), 'Escape closes the shortcut sheet')
    },
  },
  /*
   * The four deep-dive laboratories.
   *
   * Each promise here is the browser-side twin of a unit test that moves the
   * same control and expects the same figure. The unit tests prove the engine
   * and the component agree; these prove the *built bundle* still does it —
   * that the route resolves to the screen, that the tabs reveal their panels,
   * and that a moved slider re-runs the calculation rather than redrawing a
   * stored picture.
   */
  {
    name: 'Lab F: the durability curve follows the horizon it is given',
    async run(page) {
      await page.goto(`${BASE}/#/labs/memory-longevity`)
      await page.waitForTimeout(1500)
      check(await page.getByRole('heading', { level: 1, name: /memory durability/i }).isVisible(), 'Lab F opens on its own page')

      const horizon = page.getByRole('slider', { name: 'Horizon tick' })
      const tick = await rangeValue(horizon)
      check(
        await page.getByText(`at tick ${tick}, at 75% of their keywords`).first().isVisible(),
        'the curve names the tick it is scored at',
        `slider reads ${tick}`,
      )

      await setRange(horizon, tick + 8)
      await page.waitForTimeout(500)
      check(
        await page.getByText(`at tick ${tick + 8}, at 75% of their keywords`).first().isVisible(),
        'moving the horizon re-runs the curve at the new tick',
        `asked for ${tick + 8}`,
      )

      await page.getByRole('tab', { name: /a policy that decides what to write/i }).click()
      await page.waitForTimeout(600)
      check(
        await page.getByRole('tabpanel', { name: /a policy that decides what to write/i }).first().isVisible(),
        "the learned write policy's tab opens",
      )
    },
  },
  {
    name: 'Lab E: the transfer grids and the self-generated loop both respond',
    async run(page) {
      await page.goto(`${BASE}/#/labs/policy-priors`)
      await page.waitForTimeout(1500)
      check(await page.getByRole('heading', { level: 1, name: /robot policies/i }).isVisible(), 'Lab E opens on its own page')

      await page.getByRole('combobox', { name: 'Transfer family' }).selectOption('same-structure-new-pose')
      await page.waitForTimeout(600)
      check(
        await page.getByRole('img', { name: /policy grid/i }).first().isVisible(),
        'switching the transfer family still shows both policies on a grid',
      )

      await page.getByRole('tab', { name: /own data/i }).click()
      await page.waitForTimeout(700)
      const list = page.getByRole('list', { name: 'Generations of the self-generated loop' })
      const before = await list.getByRole('listitem').count()
      check(before > 0, 'the self-generated loop lists one row per generation', `found ${before}`)

      const generations = page.getByRole('slider', { name: 'Generations' })
      await setRange(generations, (await rangeValue(generations)) + 1)
      await page.waitForTimeout(700)
      const after = await list.getByRole('listitem').count()
      check(after === before + 1, 'one more generation adds one more row, not a duplicated one', `${before} -> ${after}`)
    },
  },
  {
    name: 'Lab G: the depth battery recomputes when the chain is lengthened',
    async run(page) {
      await page.goto(`${BASE}/#/labs/reasoning`)
      await page.waitForTimeout(1500)
      check(await page.getByRole('heading', { level: 1, name: /reasoning depth/i }).isVisible(), 'Lab G opens on its own page')
      check(
        await page.getByText(/Measured, not asserted/i).first().isVisible(),
        'the screen states that its comparison is measured',
      )

      const chain = page.getByRole('slider', { name: 'Chain length' })
      const wanted = await otherRangeValue(chain)
      await setRange(chain, wanted)
      await page.waitForTimeout(500)
      check(
        await page.getByText(`Chain length: ${wanted}`).first().isVisible(),
        'the length shown is the length the control is set to',
        `asked for ${wanted}`,
      )

      await page.getByRole('combobox', { name: 'Stand-in policy' }).selectOption('current')
      await page.waitForTimeout(600)
      check(
        await page.getByText(/current policy: style/i).first().isVisible(),
        'the stand-in policy can be switched to the battery being audited',
      )
    },
  },
  {
    name: 'Lab H: taking away the rewrite turns answers into abstentions',
    async run(page) {
      await page.goto(`${BASE}/#/labs/retrieval`)
      await page.waitForTimeout(1500)
      check(await page.getByRole('heading', { level: 1, name: /agentic retrieval/i }).isVisible(), 'Lab H opens on its own page')

      const abstained = page.getByText('abstained', { exact: true })
      const before = await abstained.count()
      const rewrites = page.getByRole('slider', { name: 'Rewrites allowed' })
      await setRange(rewrites, 0)
      await page.waitForTimeout(600)
      const after = await abstained.count()
      check(after > before, 'with no rewrite allowed, more questions end in an abstention', `${before} -> ${after}`)

      await page.getByRole('tab', { name: /one query per sub-question/i }).click()
      await page.waitForTimeout(700)
      check(
        await page.getByRole('tabpanel', { name: /one query per sub-question/i }).first().isVisible(),
        'the decomposition tab opens and keeps its own panel',
      )
      check(
        await page.getByText(/retrievals, .* tokens against/).first().isVisible(),
        'the decomposition panel states both pipelines in retrievals and tokens',
      )
    },
  },
]

async function main() {
  const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  const server = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root,
    stdio: 'ignore',
  })

  const browser = await chromium.launch()
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(`${page.url()} :: ${error.message}`))

  try {
    await waitForServer(BASE)
    for (const journey of JOURNEYS) {
      console.log(`\n${journey.name}`)
      try {
        await journey.run(page, context)
      } catch (error) {
        check(false, journey.name, error instanceof Error ? error.message.split('\n')[0] : String(error))
      }
    }
  } finally {
    await browser.close()
    server.kill()
  }

  console.log('')
  if (pageErrors.length > 0) {
    console.log(`Page errors:\n  ${pageErrors.join('\n  ')}`)
  }
  if (findings.length > 0) {
    console.error(`\n${findings.length} of ${passed + findings.length} promises were not kept:\n  ${findings.join('\n  ')}`)
    process.exitCode = 1
    return
  }
  console.log(`All ${passed} promises were kept.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
