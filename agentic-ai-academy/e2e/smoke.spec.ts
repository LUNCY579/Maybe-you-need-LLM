import { expect, test } from '@playwright/test'
import { conceptGraph } from '../src/content/conceptGraph'

/**
 * End-to-end student journey: open the site, read a lesson, run a simulation,
 * answer a quiz and confirm progress survives a reload.
 */

test.describe('agentic ai academy', () => {
  test('landing page renders the course and navigation', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/language models become agents/i)
    await expect(page.getByRole('navigation', { name: /primary/i })).toBeVisible()
    await expect(page.getByRole('link', { name: /skip to content/i })).toBeAttached()
    // No console errors during first paint.
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.waitForTimeout(300)
    expect(errors).toEqual([])
  })

  test('lesson can be read, completed and survives a reload', async ({ page }) => {
    await page.goto('/#/lesson/what-agentic-llms-are')
    await expect(page.getByRole('heading', { level: 1, name: /agentic llms: models, harnesses, loops/i })).toBeVisible()

    await page.getByRole('tab', { name: /sources & provenance/i }).click()
    await expect(page.getByText(/Ch\. 1, §1\.2\.2 Agentic Harness/)).toBeVisible()

    await page.getByRole('tab', { name: /^Lesson$/ }).click()
    await page.getByRole('button', { name: /mark lesson complete/i }).click()
    await expect(page.getByText('Completed')).toBeVisible()

    await page.reload()
    await expect(page.getByText('Completed')).toBeVisible()
  })

  test('quiz answers are graded with explanations', async ({ page }) => {
    await page.goto('/#/lesson/what-agentic-llms-are')
    await page.getByRole('tab', { name: /assessment/i }).click()
    const quiz = page.getByRole('radiogroup', { name: /Options for question 1/i })
    await quiz.getByRole('radio').nth(1).click()
    await page.getByRole('button', { name: /check answer/i }).first().click()
    await expect(page.getByText(/act → observe → adapt loop/i)).toBeVisible()
  })

  test('workflow builder executes a scenario and reports a trace', async ({ page }) => {
    await page.goto('/#/builder')
    await expect(page.getByRole('heading', { level: 1, name: /visual agent workflow builder/i })).toBeVisible()
    await expect(page.getByText(/graph valid/i)).toBeVisible()

    await page.getByRole('button', { name: /run to completion/i }).click()
    await page.getByRole('tab', { name: /trace/i }).click()
    await expect(page.getByText(/#1/).first()).toBeVisible()

    // Switch to the broken pipeline scenario and confirm an explicit halt reason.
    await page.getByLabel(/choose a learning scenario/i).selectOption('broken-pipeline')
    await page.getByRole('button', { name: /run to completion/i }).click()
    await expect(page.getByText('Halted:', { exact: true })).toBeVisible()
    // The same halt is announced in the live region for screen readers.
    await expect(page.getByRole('status').filter({ hasText: /Run status/ })).toContainText(/Halted:/)
  })

  test('labs run their deterministic simulations', async ({ page }) => {
    await page.goto('/#/labs/planning')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/agent planning/i)
    await page.getByRole('tab', { name: /strategy comparison/i }).click()
    await expect(page.getByText(/Detailed results/i)).toBeVisible()

    await page.goto('/#/labs/memory')
    await expect(page.getByText(/^Decision$/)).toBeVisible()

    await page.goto('/#/labs/world-model')
    await page.getByRole('tab', { name: /predicted vs actual/i }).click()
    await expect(page.getByText(/divergence/i).first()).toBeVisible()

    await page.goto('/#/labs/multi-agent')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/multi-agent collaboration/i)
    await page.getByRole('tab', { name: /handoffs & messages/i }).click()
    await expect(page.getByText(/Handoff summary/i)).toBeVisible()
  })

  test('the three deep-dive laboratories compute their figures on screen', async ({ page }) => {
    await page.goto('/#/labs/policy-priors')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/robot policies/i)
    await expect(page.getByRole('heading', { name: 'Transfer families' })).toBeVisible()
    await page.getByRole('tab', { name: /training on the policy.*own data/i }).click()
    await expect(page.getByText(/Model error grows as coverage falls/i)).toBeVisible()

    await page.goto('/#/labs/memory-longevity')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/memory durability/i)
    await expect(page.getByRole('heading', { name: 'Forgetting curve' })).toBeVisible()
    await page.getByRole('tab', { name: /a policy that decides what to write/i }).click()
    await expect(page.getByRole('heading', { name: 'Write policy training' })).toBeVisible()

    await page.goto('/#/labs/reasoning')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/reasoning depth/i)
    await expect(page.getByText(/Measured, not asserted:/i)).toBeVisible()
    // A slider moves a number rather than a caption.
    const chain = page.getByRole('slider', { name: 'Chain length' })
    await expect(chain).toBeVisible()

    await page.goto('/#/labs/retrieval')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/agentic retrieval/i)
    await expect(page.getByRole('heading', { name: 'The two pipelines' })).toBeVisible()
    await page.getByRole('tab', { name: /one query per sub-question/i }).click()
    await expect(page.getByText(/Propagation fired at hop/i).first()).toBeVisible()
    await page.getByRole('tab', { name: /four shapes, one case set/i }).click()
    await expect(page.getByText(/answers where the store had none/i)).toBeVisible()
  })

  test('dashboard exports progress and glossary is searchable', async ({ page }) => {
    await page.goto('/#/dashboard')
    const downloadPromise = page.waitForEvent('download')
    await page.getByRole('button', { name: /export progress json/i }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toBe('agentic-ai-academy-progress.json')

    await page.goto('/#/glossary')
    await page.getByLabel(/search the glossary/i).fill('harness')
    // The term heading, not the related-term buttons that now carry the name.
    await expect(page.getByRole('heading', { name: 'Harness' })).toBeVisible()
  })

  test('theme toggle switches the document theme', async ({ page }) => {
    await page.goto('/')
    const toggle = page.getByRole('button', { name: /switch to (light|dark)/i })
    // Wait for the shell to mount before sampling: the theme class is applied
    // by an effect, so an early sample would read a not-yet-themed document.
    await expect(toggle).toBeVisible()
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true)

    await toggle.click()

    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(false)
    await expect(toggle).toHaveAttribute('aria-label', /Light theme/i)
  })
})

test.describe('course-wide search', () => {
  /**
   * Wait until the shell has mounted before pressing a key.
   *
   * The shortcut listener is registered in an effect, so a key pressed
   * before React has mounted is simply lost. Waiting for a header control
   * makes the test deterministic on slower engines.
   */
  async function openSearchWithKeyboard(page: import('@playwright/test').Page) {
    await expect(page.getByRole('button', { name: /search the course/i })).toBeVisible()
    const dialog = page.getByRole('dialog', { name: /search the course/i })
    // The listener is attached in an effect, which can land a moment after
    // the control is painted. The shortcut opens rather than toggles, so
    // pressing it again is harmless.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await page.keyboard.press('/')
      if (await dialog.count()) break
      await page.waitForTimeout(200)
    }
    await expect(dialog).toBeVisible()
    return dialog
  }

  test('search opens with the keyboard and navigates to a result', async ({ page }) => {
    await page.goto('/')
    // "/" is used rather than Ctrl+K, which browsers reserve for their own
    // address/search bar.
    const dialog = await openSearchWithKeyboard(page)

    await page.getByLabel(/search lessons, glossary/i).fill('memory architecture')
    const options = dialog.getByRole('option')
    await expect(options.first()).toBeVisible()

    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')
    await expect(dialog).toBeHidden()
    await expect(page).toHaveURL(/#\/(lesson|glossary|assessments|labs|references)/)
  })

  test('search opens from the header button', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /search the course/i }).click()
    await expect(page.getByRole('dialog', { name: /search the course/i })).toBeVisible()
  })

  test('the shortcut does not fire while typing in a field', async ({ page }) => {
    await page.goto('/#/glossary')
    const glossarySearch = page.getByLabel(/search the glossary/i)
    await expect(glossarySearch).toBeVisible()
    // The field is focused explicitly, and the focus is asserted, because the
    // shortcut this test is about is triggered by a keypress that did *not*
    // reach the field. A click would do, but it races with the page that is
    // still being mounted.
    await glossarySearch.focus()
    await expect(glossarySearch).toBeFocused()
    // Real key events, so the guard is genuinely exercised.
    await page.keyboard.type('a/b')
    await expect(glossarySearch).toHaveValue('a/b')
    await expect(page.getByRole('dialog', { name: /search the course/i })).toHaveCount(0)
  })

  test('search indexes lesson body text, not only titles', async ({ page }) => {
    await page.goto('/')
    const dialog = await openSearchWithKeyboard(page)
    await page.getByLabel(/search lessons, glossary/i).fill('Chinchilla')
    await expect(dialog.getByRole('option').first()).toBeVisible()
    await expect(dialog.getByText(/chinchilla/i).first()).toBeVisible()
  })

  test('escape closes the search dialog', async ({ page }) => {
    await page.goto('/')
    await openSearchWithKeyboard(page)
    await page.keyboard.press('Escape')
    await expect(page.getByRole('dialog', { name: /search the course/i })).toBeHidden()
  })
})

test.describe('difficulty tracks', () => {
  test('switching to the advanced track adds sections and questions', async ({ page }) => {
    await page.goto('/#/lesson/what-agentic-llms-are')
    // Wait for the lesson to render before asserting on it, so the "not
    // present yet" check is meaningful rather than trivially true.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await expect(page.getByRole('heading', { name: /advanced: the harness as a state machine/i })).toHaveCount(0)

    await page.getByRole('button', { name: /switch to (core|advanced) track/i }).click()
    await expect(page.getByRole('heading', { name: /advanced: the harness as a state machine/i })).toBeVisible()

    await page.getByRole('tab', { name: /assessment/i }).click()
    const radios = page.getByRole('radiogroup')
    // Lesson 1 ships 3 core questions plus 2 advanced ones.
    await expect(radios).toHaveCount(5)
  })

  test('the advanced track choice persists across a reload', async ({ page }) => {
    await page.goto('/#/lesson/what-agentic-llms-are')
    await page.getByRole('button', { name: /switch to (core|advanced) track/i }).click()
    await expect(page.getByRole('heading', { name: /advanced: the harness as a state machine/i })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: /advanced: the harness as a state machine/i })).toBeVisible()
  })
})

test.describe('accessibility affordances', () => {
  test('the skip link moves focus to the main region instead of routing to 404', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: /skip to content/i })
    await skip.focus()
    await skip.press('Enter')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText(/not found/i)).toHaveCount(0)
  })

  test('tabs are wired to their panels and respond to arrow keys', async ({ page }) => {
    await page.goto('/#/lesson/what-agentic-llms-are')
    const lessonTab = page.getByRole('tab', { name: /^Lesson$/ })
    const panel = page.getByRole('tabpanel')
    await expect(panel).toHaveCount(1)

    await lessonTab.focus()
    await page.keyboard.press('ArrowRight')
    await expect(page.getByRole('tab', { name: /assessment/i })).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('tabpanel')).toHaveCount(1)
  })

  test('resetting progress asks for confirmation inline', async ({ page }) => {
    await page.goto('/#/dashboard')
    await page.getByRole('button', { name: /^reset progress$/i }).click()
    await expect(page.getByRole('button', { name: /yes, reset everything/i })).toBeVisible()
    await page.getByRole('button', { name: /^cancel$/i }).click()
    await expect(page.getByRole('button', { name: /^reset progress$/i })).toBeVisible()
  })

  test('a node can be selected and edited without touching the canvas', async ({ page }) => {
    await page.goto('/#/builder')
    const selector = page.getByLabel(/select a node to inspect/i)
    await expect(selector).toBeVisible()

    // The list offers every node in the reference graph.
    const options = await selector.locator('option').allTextContents()
    expect(options.length).toBeGreaterThan(3)

    // Selecting one opens the inspector for it, without a canvas click.
    await selector.selectOption({ index: 2 })
    await expect(page.getByRole('heading', { name: /node inspector/i })).toBeVisible()
    await expect(page.getByLabel(/^label$/i)).toBeVisible()
  })

  test('a node can be added with the keyboard and is then selected', async ({ page }) => {
    await page.goto('/#/builder')
    // The builder is code-split, so wait for it to render before counting.
    const selector = page.getByLabel(/select a node to inspect/i)
    await expect(selector).toBeVisible()
    const before = await selector.locator('option').count()

    await page.getByRole('button', { name: /^Tool call\s*\+/ }).focus()
    await page.keyboard.press('Enter')

    await expect(selector.locator('option')).toHaveCount(before + 1)
    await expect(page.getByRole('heading', { name: /node inspector/i })).toBeVisible()
  })

  test('invalid JSON in the argument editor is reported, not silently discarded', async ({ page }) => {
    await page.goto('/#/builder')
    const selector = page.getByLabel(/select a node to inspect/i)
    await expect(selector).toBeVisible()

    // Select the tool node, which has a JSON arguments field.
    const options = await selector.locator('option').allTextContents()
    const toolIndex = options.findIndex((text) => /tool call/i.test(text))
    expect(toolIndex).toBeGreaterThan(0)
    await selector.selectOption({ index: toolIndex })

    const args = page.getByLabel(/arguments \(json\)/i)
    await expect(args).toBeVisible()
    const original = await args.inputValue()

    // Selecting a node moves focus to the canvas, from a requestAnimationFrame,
    // so on a busy machine that happens after the selection has been applied.
    // Waiting until the canvas holds the focus — and then clicking the field —
    // means the keystrokes below cannot land on the canvas instead.
    await expect
      .poll(() => page.evaluate(() => document.activeElement?.classList.contains('react-flow__node') ?? false))
      .toBe(true)
    await args.click()
    await expect(args).toBeFocused()

    // Type an incomplete object key by key: the field must keep the text and
    // say why. The earlier version derived the text from the parsed config, so
    // every keystroke that did not parse was thrown away.
    await args.fill('')
    await expect(args).toBeFocused()
    await page.keyboard.type('{"number": ', { delay: 25 })
    await expect(args).toHaveValue('{"number": ')
    const alert = page.getByRole('alert')
    await expect(alert).toBeVisible()
    await expect(alert).toContainText(/previous valid arguments are still in use/i)
    await expect(args).toHaveAttribute('aria-invalid', 'true')

    // Running the graph re-renders the whole inspector while the text in the
    // field is still invalid, and must not disturb what was typed.
    await page.getByRole('button', { name: /run to completion/i }).click()
    await expect(page.getByRole('status').filter({ hasText: /Run status/ })).toBeVisible()
    await expect(args).toHaveValue('{"number": ')

    // Fixing the JSON applies it and clears the error.
    await args.fill('{"number": "8191"}')
    await expect(page.getByRole('alert')).toHaveCount(0)
    await expect(args).toHaveValue('{"number": "8191"}')
    expect(original).not.toBe('{"number": "8191"}')
  })

  test('two nodes can be connected without dragging', async ({ page }) => {
    // WCAG 2.5.7 (Dragging Movements, AA) requires a single-pointer
    // alternative to dragging.
    await page.goto('/#/builder')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Wait for the reference graph to be on the canvas before counting.
    const nodes = page.locator('.react-flow__node')
    await expect(nodes.first()).toBeVisible()
    const before = await page.locator('.react-flow__edge').count()
    expect(before).toBeGreaterThan(0)

    await page.getByRole('button', { name: /connect two nodes/i }).click()
    // The instruction appears in the toolbar and again in the live region.
    await expect(page.getByText(/click the node the connection starts from/i).first()).toBeVisible()

    // Click the source node, then the target node. The first and last nodes
    // of the reference graph are not already connected to each other.
    const nodeCount = await nodes.count()
    await nodes.nth(0).click()
    await expect(page.getByText(/now click the node it goes to/i).first()).toBeVisible()
    await nodes.nth(nodeCount - 1).click()

    await expect(page.locator('.react-flow__edge')).toHaveCount(before + 1)
  })

  test('a laboratory ends with diagnostic questions that feed the review queue', async ({ page }) => {
    await page.goto('/#/labs/planning')
    const panel = page.getByRole('heading', { name: /check your reading/i })
    await expect(panel).toBeVisible()

    // The explanation is hidden until the student commits.
    const explanation = page.getByLabel(/why this is the answer/i)
    await expect(explanation).toHaveCount(0)

    await page.getByRole('radiogroup').first().getByRole('radio').nth(0).click()
    await page.getByRole('button', { name: /commit and check/i }).first().click()
    await expect(explanation.first()).toBeVisible()

    await page.goto('/#/assessments')
    await expect(page.getByRole('tab', { name: /review weak spots/i })).toContainText('(1)')
  })

  test('the landing page links to the one-page summary', async ({ page }) => {
    await page.goto('/')
    await page.getByRole('button', { name: /go to the one-page summary/i }).click()
    await expect(page).toHaveURL(/#\/lesson\/future-directions#section-synthesis/)
    // The section is on screen, not merely in the DOM.
    const section = page.locator('#section-synthesis')
    await expect(section).toBeVisible()
    await expect.poll(async () => section.evaluate((node) => Math.round(node.getBoundingClientRect().top))).toBeLessThan(400)
  })

  test('a deep link into a demonstration scrolls to it', async ({ page }) => {
    // The link a concept in the glossary gives: an anchor naming the
    // demonstration, and the demonstration has to come into view.
    await page.goto('/#/lesson/interaction-styles-and-memory#demo-memory')
    await expect(page.locator('#demo-memory')).toBeVisible()
    await expect
      .poll(async () => page.locator('#demo-memory').evaluate((node) => Math.round(node.getBoundingClientRect().top)))
      .toBeLessThan(400)
  })

  test('a glossary deep link lands on the term it names', async ({ page }) => {
    await page.goto('/#/glossary?term=Retrieval-augmented%20generation%20(RAG)')
    const entry = page.locator('[id^="glossary-retrieval-augmented-generation-rag"]')
    await expect(entry).toBeVisible()
    await expect
      .poll(async () => entry.evaluate((node) => Math.round(node.getBoundingClientRect().top)))
      .toBeLessThan(900)
  })

  test('the references can be filtered down to the paper behind a chapter', async ({ page }) => {
    await page.goto('/#/references')
    const items = page.locator('#reference-filter')
    await expect(items).toBeVisible()

    const before = await page.locator('[id^="reference-"]').count()
    expect(before).toBeGreaterThan(10)

    await items.fill('memory')
    await expect(page.getByText(/\d+ of \d+/)).toBeVisible()
    const after = await page.locator('[id^="reference-"]').count()
    expect(after).toBeGreaterThan(0)
    expect(after).toBeLessThan(before)

    // The filter matches on the role the reference plays, not just the title.
    await items.fill('Ch. 9')
    expect(await page.locator('[id^="reference-"]').count()).toBeGreaterThan(0)
  })

  test('a reference reached from the search dialog lands on the reference', async ({ page }) => {
    // The list is long, so a deep link has to scroll to the entry rather
    // than leaving the reader at the top of the page.
    await page.goto('/#/references?ref=packer-2023-memgpt')
    await page.waitForTimeout(700)
    const entry = page.locator('#reference-packer-2023-memgpt')
    await expect(entry).toBeVisible()
    await expect(entry.getByText(/from search/i)).toBeVisible()

    const inView = await entry.evaluate((node) => {
      const box = node.getBoundingClientRect()
      return box.top >= 0 && box.bottom <= window.innerHeight
    })
    expect(inView).toBe(true)
  })

  test('a lesson points at the primary literature behind it', async ({ page }) => {
    await page.goto('/#/lesson/interaction-styles-and-memory')
    await page.getByRole('tab', { name: /sources & provenance/i }).click()

    const panel = page.getByRole('heading', { name: /further reading/i })
    await expect(panel).toBeVisible()

    // The reference is linked, and the link is a real one.
    const lostInTheMiddle = page.getByRole('link', { name: /lost in the middle/i })
    await expect(lostInTheMiddle).toBeVisible()
    await expect(lostInTheMiddle).toHaveAttribute('href', 'https://arxiv.org/abs/2307.03172')
    await expect(lostInTheMiddle).toHaveAttribute('rel', /noopener/)
  })

  test('the attempt history says why an answer was right', async ({ page }) => {
    await page.goto('/#/labs/planning')
    await page.getByRole('radiogroup').first().getByRole('radio').nth(0).click()
    await page.getByRole('button', { name: /commit and check/i }).first().click()

    await page.goto('/#/assessments')
    await page.getByRole('tab', { name: /attempt history/i }).click()

    // The history counts the attempts, and the explanation is one click away.
    await expect(page.getByText(/1 attempt\(s\)/)).toBeVisible()
    const entry = page.locator('details').filter({ hasText: /why this is the answer/i }).first()
    await expect(entry).toBeVisible()
    await expect(entry.locator('p')).toBeHidden()
    await entry.locator('summary').click()
    await expect(entry.locator('p')).toBeVisible()
  })

  test('a link lands on the tab it names', async ({ page }) => {
    // "Review the questions you got wrong" has to open the review queue,
    // and "take the questions" has to open the questions.
    await page.goto('/#/assessments?tab=review')
    await expect(page.getByText(/\d+ question(s)? due for review|nothing to review/i)).toBeVisible()

    await page.goto('/#/lesson/what-agentic-llms-are?tab=quiz')
    await expect(page.getByRole('tab', { name: /assessment/i })).toHaveAttribute('aria-selected', 'true')
  })

  test('a formula renders, even though the library is loaded on demand', async ({ page }) => {
    // KaTeX is a large library and only nineteen formulas use it, so it is
    // fetched when a formula appears rather than carried by every page. A
    // failure to fetch would leave the formula blank rather than broken, so
    // this checks that it actually arrives.
    await page.goto('/#/lesson/scaling-laws-and-efficiency')
    await expect(page.locator('.katex').first()).toBeVisible({ timeout: 15_000 })
    await expect(page.getByText(/Formula error/)).toHaveCount(0)
  })

  test('the concept map can be filtered down to part of the graph', async ({ page }) => {
    await page.goto('/#/glossary')
    await page.getByRole('tab', { name: /concept map/i }).click()
    await expect(page.locator('.react-flow__node')).toHaveCount(conceptGraph().nodes.length)

    // Filtering keeps the matches and their neighbours legible and dims the rest.
    await page.getByLabel(/filter the concept map/i).fill('memory')
    await page.waitForTimeout(600)
    const opacities = await page.evaluate(() =>
      [...document.querySelectorAll('.react-flow__node')].map((node) => {
        const label = node.querySelector('span')
        return label ? Number(getComputedStyle(label).opacity) : 1
      }),
    )
    expect(opacities.filter((opacity) => opacity < 0.5).length).toBeGreaterThan(0)
    expect(opacities.filter((opacity) => opacity >= 0.5).length).toBeGreaterThan(0)
  })

  test('the dashboard reports what has been retained', async ({ page }) => {
    await page.goto('/#/dashboard')
    await expect(page.getByRole('heading', { name: /what you have retained/i })).toBeVisible()
    await expect(page.getByText(/retained/i).first()).toBeVisible()
  })

  test('a laboratory question points at the control that tests it', async ({ page }) => {
    await page.goto('/#/labs/planning')
    const tryIt = page.getByText(/^Try it$/).first()
    await expect(tryIt).toBeVisible()
    await expect(tryIt.locator('xpath=..')).toContainText(/slip probability|Strategy comparison|capacity/i)
  })

  test('a labelled branch can be added without dragging', async ({ page }) => {
    // WCAG 2.5.7 (Dragging Movements, AA) requires a single-pointer
    // alternative to dragging, and a branch label can only be set on a named
    // handle — so the connection control has to be able to set it.
    await page.goto('/#/builder')
    const selector = page.getByLabel(/select a node to inspect/i)
    await expect(selector).toBeVisible()
    await expect(page.locator('.react-flow__node').first()).toBeVisible()

    // Pick a node, then a target and a branch label.
    // The picker names each node with its kind, which is what lets these
    // tests reach a node without dragging on the canvas.
    const options = await selector.locator('option').allTextContents()
    expect(options.some((text) => text.trim().endsWith('(Tool call)'))).toBe(true)
    await selector.selectOption({ index: 1 })

    const before = await page.locator('.react-flow__edge').count()
    await page.getByLabel(/connect to node/i).selectOption({ index: 1 })
    await page.getByLabel(/branch label for the new connection/i).selectOption('yes')
    await page.getByRole('button', { name: /add connection/i }).click()

    await expect(page.locator('.react-flow__edge')).toHaveCount(before + 1)
    // The new edge carries the branch label that was chosen.
    await expect(page.getByRole('combobox', { name: /connect to node/i })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /branch label for the new connection/i })).toHaveValue('yes')
  })
})

test.describe('final project workspace', () => {
  test('project state is editable and persisted', async ({ page }) => {
    await page.goto('/#/project')
    await page.getByLabel(/name of the project task/i).fill('A retrieval-backed assistant')
    await page.getByLabel(/1 · Choose a task with a verifiable outcome/i).check()
    await expect(page.getByText(/1\/5 milestones marked complete/)).toBeVisible()

    await page.reload()
    await expect(page.getByLabel(/name of the project task/i)).toHaveValue('A retrieval-backed assistant')
    await expect(page.getByText(/1\/5 milestones marked complete/)).toBeVisible()
  })
})

test.describe('source map', () => {
  test('maps every book chapter to the lessons that cover it', async ({ page }) => {
    await page.goto('/#/curriculum')
    await page.getByRole('tab', { name: /source map/i }).click()
    await expect(page.getByText(/Ch\. 23/i).first()).toBeVisible()
    await expect(page.getByText(/every one of the 23 chapters/i)).toBeVisible()
  })

  test('the curriculum chapter inventory reports full coverage', async ({ page }) => {
    await page.goto('/#/curriculum')
    const inventory = page.getByRole('heading', { name: /full chapter inventory/i })
    await expect(inventory).toBeVisible()
    // Every chapter badge reads "covered" — no chapter is left as roadmap.
    await expect(page.getByText('roadmap', { exact: true })).toHaveCount(0)
  })
})

test.describe('learning features', () => {
  test('glossary terms in the prose reveal their definition in place', async ({ page }) => {
    await page.goto('/#/lesson/multi-step-reasoning')
    const term = page.locator('button[title$="click for the definition"]').first()
    await expect(term).toBeVisible()

    await term.click()
    const popover = page.getByRole('note')
    await expect(popover).toBeVisible()
    await expect(popover).toContainText(/Ch\. 6/)

    // Escape closes it and returns focus to the term.
    await page.keyboard.press('Escape')
    await expect(popover).toHaveCount(0)
  })

  test('learning objectives can be ticked and persist', async ({ page }) => {
    await page.goto('/#/lesson/what-agentic-llms-are')
    const boxes = page.locator('input[type=checkbox][aria-label^="Mark objective"]')
    // The lesson is loaded on demand, so the count has to wait for it.
    await expect(boxes.first()).toBeVisible()
    const count = await boxes.count()
    expect(count).toBeGreaterThan(3)

    await boxes.first().check()
    await expect(boxes.first()).toBeChecked()
    await expect(page.getByText(/1 of \d+ objectives marked/)).toBeVisible()

    await page.reload()
    await expect(page.locator('input[type=checkbox][aria-label^="Mark objective"]').first()).toBeChecked()
  })

  test('a wrong answer lands in the review queue and clears when answered correctly', async ({ page }) => {
    await page.goto('/#/lesson/what-agentic-llms-are')
    await page.getByRole('tab', { name: /assessment/i }).click()
    const quiz = page.getByRole('radiogroup').first()
    // Option 2 is not the answer to the first question; option 1 is.
    await quiz.getByRole('radio').nth(2).click()
    await page.getByRole('button', { name: /check answer/i }).first().click()
    await expect(page.getByText('Not quite')).toBeVisible()

    await page.goto('/#/assessments')
    const reviewTab = page.getByRole('tab', { name: /review weak spots/i })
    await expect(reviewTab).toContainText('(1)')
    await reviewTab.click()
    await expect(page.getByRole('heading', { name: /1 question due for review/i })).toBeVisible()

    // Answering it correctly clears it from the queue: the queue is derived
    // from the latest attempt, not stored separately.
    await page.goto('/#/lesson/what-agentic-llms-are')
    await page.getByRole('tab', { name: /assessment/i }).click()
    await page.getByRole('radiogroup').first().getByRole('radio').nth(1).click()
    await page.getByRole('button', { name: /check answer/i }).first().click()
    await expect(page.getByText('Correct', { exact: true }).first()).toBeVisible()

    await page.goto('/#/assessments')
    const after = page.getByRole('tab', { name: /review weak spots/i })
    await expect(after).not.toContainText('(1)')
    await after.click()
    await expect(page.getByRole('heading', { name: /nothing to review/i })).toBeVisible()
  })

  test('a lesson has an outline that tracks the section in view', async ({ page }) => {
    await page.goto('/#/lesson/what-agentic-llms-are')
    const outline = page.getByRole('navigation', { name: /sections in this lesson/i })
    await expect(outline).toBeVisible()

    const items = outline.getByRole('button')
    const count = await items.count()
    expect(count).toBeGreaterThan(3)

    // Choosing a section moves the reading position.
    await items.nth(2).click()
    await expect(page.getByRole('progressbar', { name: /progress through this lesson/i })).toHaveAttribute(
      'aria-valuenow',
      /[1-9]\d*/,
    )
  })

  test('the dashboard suggests concrete next actions', async ({ page }) => {
    await page.goto('/#/dashboard')
    await expect(page.getByRole('heading', { name: /what to do next/i })).toBeVisible()
    const actions = page.locator('button', { hasText: /^Go$/ })
    expect(await actions.count()).toBeGreaterThan(0)
  })

  test('the keyboard shortcut list can be opened and closed', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('button', { name: /show the keyboard shortcuts/i })).toBeVisible()
    await page.getByRole('button', { name: /show the keyboard shortcuts/i }).click()

    const dialog = page.getByRole('dialog', { name: /keyboard shortcuts/i })
    await expect(dialog).toBeVisible()
    await expect(dialog.getByText(/Search the whole course/i).first()).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(dialog).toHaveCount(0)
  })
})

test.describe('inline lesson demonstrations', () => {
  test('a lesson embeds a working demonstration of its concept', async ({ page }) => {
    await page.goto('/#/lesson/tools-and-context')
    // The lesson holds two demonstrations now, so the selector is scoped.
    const demo = page.locator('#demo-tool-selection')
    await expect(demo.getByText('Interactive', { exact: true })).toBeVisible()

    // Pick the right tool and fill in the right arguments: the call succeeds.
    await demo.getByRole('radio', { name: /^book_seat\b/ }).first().check()
    await demo.getByRole('button', { name: /fill in the correct arguments/i }).click()
    await expect(demo.getByText('right tool', { exact: true })).toBeVisible()
    await expect(demo.getByText(/Seat 14A booked/)).toBeVisible()

    // Empty arguments are rejected before the tool runs, and the reason is shown.
    await demo.getByRole('button', { name: /use the right tool, with no arguments/i }).click()
    await expect(demo.getByText('invalid arguments', { exact: true })).toBeVisible()
    await expect(demo.getByText(/Missing required argument/).first()).toBeVisible()
  })

  test('the memory demonstration responds to the capacity control', async ({ page }) => {
    await page.goto('/#/lesson/interaction-styles-and-memory')
    const demo = page.locator('#demo-memory')
    await expect(demo.getByText('Interactive', { exact: true })).toBeVisible()

    const capacity = demo.getByLabel(/store capacity/i)
    await expect(capacity).toBeVisible()
    // At the default capacity the store does not evict.
    await expect(demo.getByText(/nothing was evicted/i)).toBeVisible()

    // Shrink it and the eviction log appears.
    await capacity.fill('1')
    await expect(demo.getByText(/evicted:/i).first()).toBeVisible()
  })

  test('the planning demonstration steps through the greedy failure', async ({ page }) => {
    await page.goto('/#/lesson/multi-step-reasoning')
    await expect(page.getByText('Interactive', { exact: true })).toBeVisible()

    await expect(page.getByText(/goal not reached/i)).toBeVisible()
    await page.getByRole('button', { name: /^Step$/ }).click()
    await page.getByRole('button', { name: /^Step$/ }).click()
    await expect(page.getByText(/2\/\d+ steps/)).toBeVisible()

    // The search planner does find the goal.
    await page.getByRole('button', { name: /^Search$/ }).click()
    await expect(page.getByText(/goal reached/i)).toBeVisible()
  })

  test('the dilemma demonstration scores the round against the optimal line', async ({ page }) => {
    await page.goto('/#/lesson/behavior-strategy-multi-agent')
    // The lesson holds two demonstrations now, so the selector is scoped.
    const demo = page.locator('#demo-dilemma')
    await expect(demo.getByText('Interactive', { exact: true })).toBeVisible()

    await demo.getByRole('button', { name: /^Cooperate$/ }).click()
    await expect(demo.getByText(/1\/\d+ rounds played/)).toBeVisible()
    await expect(demo.getByText(/optimal play/).first()).toBeVisible()
  })

  test('a corrupt file is refused rather than wiping the progress', async ({ page }) => {
    // Record some progress, so there is something to lose.
    await page.goto('/#/lesson/what-agentic-llms-are')
    await page.waitForTimeout(900)
    await page.getByRole('button', { name: /mark lesson complete/i }).click()
    await page.waitForTimeout(300)

    await page.goto('/#/dashboard')
    await page.waitForTimeout(900)
    const before = await page.getByText(/lessons complete/i).first().locator('..').innerText()

    // Now import a file that is not a progress export at all.
    await page.locator('input[type="file"]').setInputFiles({
      name: 'not-progress.json',
      mimeType: 'application/json',
      buffer: Buffer.from('this is not json at all'),
    })
    await page.waitForTimeout(900)

    await expect(page.getByText(/could not be read as a progress export/i).first()).toBeVisible()
    const after = await page.getByText(/lessons complete/i).first().locator('..').innerText()
    expect(after, 'the progress was wiped by a file that could not be read').toBe(before)
  })

  test('the patching demonstration shows the three methods disagreeing', async ({ page }) => {
    await page.goto('/#/lesson/advanced-architectures-and-interpretability')
    const demo = page.locator('#demo-patching')
    await expect(demo.getByText('Interactive', { exact: true })).toBeVisible()

    // The probe finds the concept at every layer, weakly.
    await expect(demo.getByText(/detected \(/)).not.toHaveCount(0)

    // The logit lens is undecided at the start of the network.
    await expect(demo.getByText(/undecided/).first()).toBeVisible()

    // Patching the decision layer transfers the behaviour.
    await demo.getByRole('button', { name: /patch the decision layer/i }).click()
    await expect(demo.getByText(/the behaviour transferred/i)).toBeVisible()

    // Patching the first layer does not, because nothing was decided there.
    await demo.getByRole('button', { name: /patch the first layer/i }).click()
    await expect(demo.getByText(/nothing happened/i)).toBeVisible()
  })

  test('the escalation demonstration shows the stakes changing the answer', async ({ page }) => {
    await page.goto('/#/lesson/tools-and-context')
    const demo = page.locator('#demo-escalation')
    await expect(demo.getByText('Interactive', { exact: true })).toBeVisible()

    // Acting on everything is fine in a shop...
    await demo.getByLabel(/choose a domain/i).selectOption('shopping')
    await demo.getByRole('button', { name: /act on everything/i }).click()
    await expect(demo.getByText(/3 action\(s\) it should not have taken/)).toBeVisible()

    // ...and reckless in a clinic.
    await demo.getByLabel(/choose a domain/i).selectOption('medical')
    await expect(demo.getByText(/5 action\(s\) it should not have taken/)).toBeVisible()

    // The policy the chapter recommends takes no wrong action at all.
    await demo.getByRole('button', { name: /defer under uncertainty/i }).click()
    await expect(demo.getByText(/0 action\(s\) it should not have taken/)).toBeVisible()
  })

  test('the valence demonstration shows an architecture changing the conclusion', async ({ page }) => {
    await page.goto('/#/lesson/behavior-strategy-multi-agent')
    const demo = page.locator('#demo-valence')
    await expect(demo.getByText('Interactive', { exact: true })).toBeVisible()

    // The original, valence-blind memory system remembers the praise.
    await demo.getByLabel(/choose the memory architecture/i).selectOption('valence-blind')
    await expect(demo.getByText(/it went well/i)).toBeVisible()

    // The same day, under the valence-sensitive architecture, ends badly.
    await demo.getByLabel(/choose the memory architecture/i).selectOption('valence-sensitive')
    await expect(demo.getByText(/it went badly/i)).toBeVisible()
  })

  test('the study plan adapts to the time a student has', async ({ page }) => {
    await page.goto('/#/curriculum')
    await page.getByRole('tab', { name: /study plan/i }).click()

    const week = page.getByText(/^Week \d+ ·/).first()
    await expect(week).toBeVisible()

    // Two hours a week needs more weeks than nine hours a week.
    await page.getByRole('button', { name: /9 h \/ week/i }).click()
    const nine = await page.getByText(/^Week \d+ ·/).count()
    await page.getByRole('button', { name: /2 h \/ week/i }).click()
    const two = await page.getByText(/^Week \d+ ·/).count()
    expect(two).toBeGreaterThan(nine)

    // Every lesson appears exactly once, whichever pace is chosen.
    for (const lesson of ['Agentic LLMs: Models, Harnesses, Loops', 'Future Directions and Responsible Agent Engineering']) {
      await expect(page.getByRole('button', { name: new RegExp(lesson) })).toHaveCount(1)
    }
  })

  test('the attention demonstration shows a soft lookup failing', async ({ page }) => {
    await page.goto('/#/lesson/foundations-of-language-modeling')
    const demo = page.locator('#demo-attention')
    await expect(demo.getByText('Interactive', { exact: true })).toBeVisible()

    // A precise query, asked sharply, finds the passage that answers it.
    await demo.getByRole('button', { name: /ask precisely/i }).click()
    await demo.getByLabel(/scale/i).fill('6')
    await expect(demo.getByText(/the answer is in the context/i)).toBeVisible()

    // A vague query finds the passage that is about the subject instead, and
    // no amount of sharpening repairs it.
    await demo.getByRole('button', { name: /ask vaguely/i }).click()
    await demo.getByLabel(/scale/i).fill('10')
    await expect(demo.getByText(/the answer is not in the context/i)).toBeVisible()
  })

  test('the curation demonstration shows a filter losing the variety', async ({ page }) => {
    await page.goto('/#/lesson/training-pipeline')
    const demo = page.locator('#demo-curation')
    await expect(demo.getByText('Interactive', { exact: true })).toBeVisible()

    // A forum archive, filtered hard: the dialect threads are removed with
    // the genuinely bad ones.
    await demo.getByLabel(/choose a corpus/i).selectOption('forum-archive')
    await demo.getByRole('button', { name: /filter hard/i }).click()
    await expect(demo.getByText(/the variety was filtered out/i)).toBeVisible()

    // Lowering the threshold keeps them.
    await demo.getByRole('button', { name: /keep the variety/i }).click()
    await expect(demo.getByText(/the variety survived/i)).toBeVisible()
  })

  test('the retrieval demonstration shows a passage failing to be used', async ({ page }) => {
    await page.goto('/#/lesson/search-and-retrieval')
    const demo = page.locator('#demo-retrieval')
    await expect(demo.getByText('Interactive', { exact: true })).toBeVisible()

    // With one passage taken by similarity, the decisive passage is missed.
    await demo.getByLabel(/passages retrieved/i).fill('1')
    await expect(demo.getByText('the decisive passage was missed', { exact: true })).toBeVisible()

    // The reranker reads the passage with the question, and finds it.
    await demo.getByRole('radio', { name: /rerank with a cross-encoder/i }).check()
    await expect(demo.getByText('the decisive passage was retrieved', { exact: true })).toBeVisible()
    await expect(demo.getByText('and the model used it', { exact: true })).toBeVisible()
  })

  test('the context window demonstration shows a policy losing the decisive fact', async ({ page }) => {
    await page.goto('/#/lesson/interaction-styles-and-memory')
    const demo = page.locator('#demo-context-window')
    await expect(demo.getByText('Interactive', { exact: true })).toBeVisible()

    // Truncation drops the delivery date, and the agent gets the refund wrong.
    await expect(demo.getByText('the answer is wrong', { exact: true })).toBeVisible()
    await expect(demo.getByText(/Order 4471 is within the 30-day refund window/)).toBeVisible()

    // Retrieval keeps it, and the answer is right.
    await demo.getByRole('radio', { name: /keep what is relevant/i }).check()
    await expect(demo.getByText('the answer survives', { exact: true })).toBeVisible()
    await expect(demo.getByText(/delivered on 12 March/)).toBeVisible()

    // Compression keeps the item but loses the detail inside it.
    await demo.getByRole('radio', { name: /compress everything/i }).check()
    await expect(demo.getByText('the answer is wrong', { exact: true })).toBeVisible()
    await expect(demo.getByText(/compressed, fact lost/)).toBeVisible()
  })
})

test.describe('predict-first exercises', () => {
  test('the explanation stays hidden until the student commits', async ({ page }) => {
    await page.goto('/#/lesson/what-agentic-llms-are')
    await expect(page.getByText('Predict first', { exact: true })).toBeVisible()

    // Nothing is revealed before the commitment.
    const explanation = page.getByLabel(/why this is the answer/i)
    await expect(explanation).toHaveCount(0)

    const options = page.getByRole('radiogroup')
    await options.getByRole('radio').nth(1).click()
    await page.getByRole('button', { name: /commit and check/i }).click()

    await expect(explanation).toBeVisible()
    await expect(explanation).toContainText(/harness owns the loop/)
    await expect(page.getByText(/you were right|not quite/i)).toBeVisible()
  })

  test('a wrong prediction joins the review queue', async ({ page }) => {
    await page.goto('/#/lesson/scaling-laws-and-efficiency')
    const options = page.getByRole('radiogroup')
    await options.getByRole('radio').nth(0).click()
    await page.getByRole('button', { name: /commit and check/i }).click()
    await expect(page.getByText(/not quite/i)).toBeVisible()

    await page.goto('/#/assessments')
    await expect(page.getByRole('tab', { name: /review weak spots/i })).toContainText('(1)')
  })

  test('moving to another lesson clears the previous prediction', async ({ page }) => {
    await page.goto('/#/lesson/what-agentic-llms-are')
    await page.getByRole('radiogroup').getByRole('radio').nth(1).click()
    await page.getByRole('button', { name: /commit and check/i }).click()
    await expect(page.getByText(/The harness owns the loop and the context/)).toBeVisible()

    // Navigating to another lesson must not carry the committed state over.
    await page.goto('/#/lesson/scaling-laws-and-efficiency')
    await expect(page.getByText(/The harness owns the loop and the context/)).toHaveCount(0)
    await expect(page.getByRole('button', { name: /commit and check/i })).toBeVisible()
  })
})

test.describe('route transitions', () => {
  test('navigating between pages works with the view transition enabled', async ({ page }) => {
    await page.goto('/#/')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    await page.goto('/#/references')
    await expect(page.getByRole('heading', { level: 1, name: /references, citations and licences/i })).toBeVisible()
  })

  test('leaving a page shorter than the window does not crash the renderer', async ({ page }) => {
    // WebKit's renderer crashes when a View Transition has to snapshot a page
    // that does not scroll, and the assessment centre's review tab is the
    // shortest page in the course. The main area is at least a screen tall
    // so that the snapshot always has something to scroll.
    let crashed = false
    page.on('crash', () => {
      crashed = true
    })

    await page.goto('/#/assessments?tab=review')
    await expect(page.getByText(/nothing to review|due for review/i)).toBeVisible()
    await page.goto('/#/dashboard')
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    expect(crashed, 'the renderer crashed leaving a short page').toBe(false)
  })

  test('moving between two canvas pages does not crash the renderer', async ({ page }) => {    // WebKit's renderer crashes when it has to snapshot a canvas-heavy page
    // while the previous canvas-heavy page is still in the top layer, so the
    // transition is skipped for those destinations.
    let crashed = false
    page.on('crash', () => {
      crashed = true
    })

    await page.goto('/#/labs/planning')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/agent planning/i)

    await page.goto('/#/labs/memory')
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/agent memory/i)
    expect(crashed).toBe(false)
  })
})

test.describe('the concept map', () => {
  test('draws the relations between the glossary terms', async ({ page }) => {
    await page.goto('/#/glossary')
    await page.getByRole('tab', { name: /concept map/i }).click()

    // The counts are compared against the data rather than hard-coded, so
    // that extending the glossary does not break the test but a rendering
    // regression does.
    const graph = conceptGraph()
    await expect(page.locator('.react-flow__node')).toHaveCount(graph.nodes.length)
    await expect(page.locator('.react-flow__edge')).toHaveCount(graph.edges.length)
  })

  test('clicking a concept shows its definition and the lessons that teach it', async ({ page }) => {
    await page.goto('/#/glossary')
    await page.getByRole('tab', { name: /concept map/i }).click()
    await expect(page.locator('.react-flow__node')).toHaveCount(conceptGraph().nodes.length)

    await page.locator('.react-flow__node').first().click()
    await expect(page.getByText(/relation\(s\)/)).toBeVisible()
    await expect(page.getByRole('button', { name: /open in the glossary/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /how to read this/i })).toHaveCount(0)
  })

  test('the glossary list links related terms to each other', async ({ page }) => {
    await page.goto('/#/glossary')
    const related = page.locator('button', { hasText: 'Harness' }).first()
    await expect(related).toBeVisible()
  })

  test('a concept can be taken straight to the demonstration that exercises it', async ({ page }) => {
    await page.goto('/#/glossary')
    const practise = page.getByRole('button', { name: /practise this concept/i })
    await expect(practise.first()).toBeVisible()

    await practise.first().click()
    await expect(page).toHaveURL(/#demo-/)
    // The demonstration is on screen, not merely in the DOM. The scope is the
    // anchor in the URL, because a lesson can hold more than one.
    const anchor = page.url().split('#demo-')[1]
    const demo = page.locator(`#demo-${anchor}`)
    await expect(demo.getByText('Interactive', { exact: true })).toBeVisible()
  })

  test('the laboratory index links its concepts to the glossary', async ({ page }) => {
    await page.goto('/#/labs')
    const concept = page.getByRole('button', { name: /^Harness$/ }).first()
    await expect(concept).toBeVisible()
    await concept.click()
    await expect(page).toHaveURL(/glossary\?term=/)
  })
})
