import { expect, test, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { auditedRoutes } from '../src/content/routes.ts'
import { COLLECTION_COURSES, COLLECTION_NEXT, COLLECTION_SHARED_CONCEPTS } from '../src/content/collection.generated.ts'

/**
 * End-to-end coverage of the learning loop:
 * landing → lesson + explorer → laboratory → practice → saved progress.
 *
 * Each test starts from a clean browser context, so localStorage is empty and the
 * assertions describe a first-time visitor.
 */

async function openCourse(page: Page) {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
}

/**
 * Collects anything the browser complains about while a test runs.
 *
 * React reports an unbounded render loop as a console error ("Maximum update
 * depth exceeded"), and the loop still leaves every assertion in this file
 * green, so the error has to be collected explicitly.
 */
function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => {
    errors.push(`pageerror: ${error.message}`)
  })
  return errors
}

test('no page logs an error while it is being used', async ({ page }) => {
  // Nine routes are opened in turn. The default timeout is not enough for
  // that on a machine that is busy with something else.
  test.setTimeout(90_000)
  const errors = collectConsoleErrors(page)

  for (const route of [
    '/#/',
    '/#/lessons/pretraining-why',
    '/#/lessons/generative-transformer',
    '/#/lessons/alignment-dpo',
    '/#/lessons/reasoning-training',
    '/#/practice',
    '/#/playground?lab=tokenizer',
    '/#/dashboard',
    '/#/glossary',
    '/#/math',
    '/#/sources',
  ]) {
    await page.goto(route)
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    // Give the page a moment to settle so that any render loop has a chance to fire.
    await page.waitForTimeout(250)
  }

  expect(errors, `console errors:\n${errors.join('\n')}`).toEqual([])
})

test('landing page introduces the course and links the six modules', async ({ page }) => {
  await openCourse(page)
  const text = page.locator('main')
  for (const module of ['Pre-training', 'Generative Models', 'Prompting', 'Alignment', 'Inference', 'Reasoning']) {
    await expect(text.getByText(module, { exact: false }).first()).toBeVisible()
  }
  // Every module must be reachable from the landing page.
  await expect(page.locator('a[href*="#/modules/"]').first()).toBeVisible()
})

/*
  The collection panel is generated from the collection's own catalogue by
  tools/readCollection.mjs, so the assertions below read that same generated
  file and check that the page renders all of it and renders it as written.
  A panel that quietly showed three of the seven successors, or showed a
  directory name where a title belongs, would otherwise look fine.
*/
test('the landing page points at the rest of the collection', async ({ page }) => {
  await openCourse(page)
  await expect(page.getByRole('heading', { name: 'The rest of the collection' })).toBeVisible()

  const successors = page
    .locator('h3', { hasText: 'What to read next' })
    .locator('xpath=following-sibling::ul[1]')
    .locator('li')
  await expect(successors).toHaveCount(COLLECTION_NEXT.length)

  for (const course of COLLECTION_NEXT) {
    const link = page.locator(`a[href="../${course.id}/"]`).first()
    await expect(link).toBeVisible()
    await expect(link).toContainText(course.title)
    // The reason is the point of the panel; a bare list of links says nothing.
    await expect(page.getByText(course.reason, { exact: true }).first()).toBeVisible()
  }

  const ideasTaughtElsewhere = COLLECTION_SHARED_CONCEPTS.filter((concept) => concept.alsoIn.length > 0)
  for (const concept of ideasTaughtElsewhere) {
    for (const id of concept.alsoIn) {
      const title = COLLECTION_COURSES.find((course) => course.id === id)?.title
      expect(title, `${id} is in the concept index but not in the course list`).toBeTruthy()
      await expect(page.locator(`a[href="../${id}/"]`).first()).toContainText(title as string)
    }
  }

  // The count on screen is the size of the catalogue, not a rounded claim.
  await expect(
    page.getByText(`the first of ${COLLECTION_COURSES.length} interactive courses`, { exact: false }).first(),
  ).toBeVisible()
})

test('transformer explorer recomputes a forward pass from user input', async ({ page }) => {
  await page.goto('/#/lessons/generative-transformer')
  const input = page.getByTestId('explorer-input')
  await expect(input).toBeVisible()

  await input.fill('attention is all you need')
  const chips = page.getByTestId('token-chips').first()
  await expect(chips).toBeVisible()
  const wordTokens = await page.getByTestId('token-chip').count()
  expect(wordTokens).toBeGreaterThanOrEqual(4)

  // Character mode must produce strictly more units than word mode for this sentence.
  await page.getByRole('radio', { name: 'character', exact: true }).click()
  await expect
    .poll(async () => page.getByTestId('token-chip').count())
    .toBeGreaterThan(wordTokens)

  // Back to word mode, then inspect the masked score matrix.
  await page.getByRole('radio', { name: 'word', exact: true }).click()
  await page.getByTestId('stage-scores').click()
  await expect(page.getByText(/scaled dot-product|score matrix|QK/i).first()).toBeVisible()
})

test('causal mask toggle explains future-token leakage', async ({ page }) => {
  await page.goto('/#/lessons/generative-transformer')
  await page.getByTestId('stage-mask').click()

  await expect(page.getByText('Zeros above the diagonal are proof the mask was applied.')).toBeVisible()
  const mask = page.getByRole('switch', { name: 'Apply the causal mask' })
  await expect(mask).toHaveAttribute('aria-checked', 'true')
  await mask.click()
  await expect(mask).toHaveAttribute('aria-checked', 'false')
  await expect(page.getByText('Masking is OFF: attention can see the future.')).toBeVisible()

  // Reset restores the documented default state.
  await page.getByRole('button', { name: 'Reset explorer' }).click()
  await expect(mask).toHaveAttribute('aria-checked', 'true')
})

test('softmax walkthrough reports a normalised weight inside one row', async ({ page }) => {
  await page.goto('/#/lessons/generative-transformer')
  await page.getByTestId('stage-softmax').click()

  const walkthrough = page.getByTestId('softmax-walkthrough')
  await expect(walkthrough).toContainText('denominator')

  // Step 4 is the weight itself; KaTeX renders "A_{0,0} = 1.0000" for the first cell
  // of the first row (a position can only attend to itself under a causal mask).
  const stepFour = walkthrough.locator('li').nth(3)
  await expect(stepFour).toContainText('weight')
  const tex = await walkthrough.evaluate((node) => node.textContent ?? '')
  expect(tex).toMatch(/= 1\.0000|= 0\.\d{3,4}/)
})

test('sampling laboratory is deterministic for a fixed seed and reacts to temperature', async ({ page }) => {
  await page.goto('/#/playground?lab=sampling')
  await expect(page.getByRole('heading', { name: /Text generation and sampling/i }).first()).toBeVisible()

  const entropyStat = page.getByText(/Entropy of final distribution/i).locator('..')
  const before = await entropyStat.textContent()

  // Hashing is deterministic: run it twice and the numeric seed must not move.
  const seedHint = page.getByText(/numeric seed \d+/)
  await page.getByRole('button', { name: 'Hash text' }).click()
  const seedAfterFirst = await seedHint.textContent()
  await page.getByRole('button', { name: 'Hash text' }).click()
  await expect(seedHint).toHaveText(seedAfterFirst ?? '')

  // Temperature is a real input: lowering it removes entropy from the distribution.
  const temperature = page.getByRole('slider', { name: /Temperature/i })
  await temperature.fill('0.1')
  await expect(temperature).toHaveValue('0.1')
  await expect
    .poll(async () => (await entropyStat.textContent()) ?? '')
    .not.toBe(before)
})

test('the explorer can split attention across heads', async ({ page }) => {
  await page.goto('/#/playground?lab=transformer')
  await expect(page.getByText('Heads × head dim')).toBeVisible()
  await expect(page.getByText('1 × 8')).toBeVisible()

  // Switching to four heads changes the head dimension, and the figures
  // become per-head.
  await page.getByRole('radio', { name: '4' }).click()
  await expect(page.getByText('4 × 2')).toBeVisible()
  await page.getByTestId('stage-scores').click()
  await expect(page.getByText('Head 0 — raw dot products Q Kᵀ')).toBeVisible()
  await expect(page.getByText('Head 3 — raw dot products Q Kᵀ')).toBeVisible()
  await expect(page.getByText(/Each head scores in its own subspace/)).toBeVisible()
})

test('the explorer shows the whole block, not only the attention part', async ({ page }) => {
  await page.goto('/#/playground?lab=transformer')
  await page.getByTestId('stage-block').click()
  await expect(page.getByText('Residual connection and layer norm')).toBeVisible()
  await expect(page.getByText('Feed-forward network', { exact: true })).toBeVisible()
  await expect(page.getByTestId('block-heatmap')).toBeVisible()
  // The feed-forward hidden layer is wider than the model dimension.
  await expect(page.getByText(/hidden layer is 32 wide/)).toBeVisible()
})

test('the tokenizer prediction exercise is checked against the tokenizer', async ({ page }) => {
  await page.goto('/#/playground?lab=tokenizer')
  // The laboratory's view switcher is a radio group.
  const predictTab = page.getByRole('radio', { name: 'Predict the segmentation' })
  await expect(predictTab).toBeVisible()
  await predictTab.click()

  await expect(page.getByText(/How many units will the/).first()).toBeVisible()

  // Answering reveals the real segmentation and a verdict.
  const options = page.getByRole('button', { name: /^\d+ units?$/ })
  await expect(options.first()).toBeVisible()
  await options.first().click()
  await expect(page.getByText(/^Correct\.$|^Not quite/).first()).toBeVisible()
  await expect(page.getByText(/The tokenizer produces \d+ units?/).first()).toBeVisible()
})

/**
 * Run an automated accessibility audit over the page.
 *
 * Only WCAG A and AA rules are checked, and the two "best practice" rules that
 * routinely fire on a canvas-free application without indicating a real
 * barrier are left out. Everything else must be clean.
 */
async function auditAccessibility(page: Page): Promise<string[]> {
  // The pages fade in over a third of a second. A contrast check taken while
  // an element is still at low opacity measures the blend with the background
  // rather than the colour the reader actually sees, so wait for the entrance
  // animations to finish first.
  //
  // Only time-based animations are waited for. The reading-progress bar is
  // driven by a scroll timeline, so it is always "running" and never settles;
  // waiting for it would wait forever.
  await page.evaluate(async () => {
    const running = document
      .getAnimations()
      .filter(
        (animation) =>
          animation.playState === 'running' &&
          animation.timeline instanceof (window as unknown as { DocumentTimeline: new () => unknown })
            .DocumentTimeline,
      )
    await Promise.allSettled(running.map((animation) => animation.finished))
  })
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return results.violations.map(
    (violation) =>
      `${violation.id} (${violation.impact ?? 'unknown'}): ${violation.help} — ${violation.nodes
        .slice(0, 3)
        .map((node) => node.target.join(' '))
        .join('; ')}`,
  )
}

/**
 * Audits a set of routes in one theme.
 *
 * The routes come from the course's own declaration of its pages, so a page
 * that is added to the course is audited. The audit used to keep its own
 * list, and the pages added last were never added to it: a contrast failure
 * on the dashboard went unnoticed for as long as the audit had existed.
 *
 * The themes are audited by two separate tests rather than one. Each audit
 * loads a page, waits for the entrance animations, and walks the
 * accessibility tree, and doing twenty-four of them in one test means one
 * slow machine can push the whole thing past its timeout — and a test that
 * is regularly killed by a timeout is a test that is regularly skipped.
 */
async function auditRoutesInTheme(page: Page, theme: 'dark' | 'light'): Promise<string[]> {
  const problems: string[] = []

  // The theme is persisted in localStorage and re-applied by the application
  // on every mount, so it has to be set there rather than toggled on the DOM
  // element — otherwise the next navigation would undo the toggle.
  await page.goto('/#/')
  await page.evaluate((value) => {
    window.localStorage.setItem('llm-foundations-lab:theme', value)
  }, theme)

  for (const route of auditedRoutes()) {
    await page.goto(`/#${route.url}`)
    // Navigating between hash routes does not reload the document, so the
    // pre-paint bootstrap would not run again. Reload to make the stored
    // theme the one that is actually applied.
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    // The application must have applied the requested theme.
    await expect
      .poll(async () => page.evaluate(() => document.documentElement.classList.contains('light')))
      .toBe(theme === 'light')
    const violations = await auditAccessibility(page)
    for (const violation of violations) problems.push(`${theme} ${route.name} → ${violation}`)
  }
  return problems
}

test('the pages meet the WCAG A and AA criteria in the dark theme', async ({ page }) => {
  // Twelve page audits; the default timeout is not enough.
  test.setTimeout(300_000)
  const problems = await auditRoutesInTheme(page, 'dark')
  expect(problems, `accessibility violations:\n${problems.join('\n')}`).toEqual([])
})

test('the pages meet the WCAG A and AA criteria in the light theme', async ({ page }) => {
  // Twelve page audits; the default timeout is not enough.
  test.setTimeout(300_000)
  const problems = await auditRoutesInTheme(page, 'light')
  expect(problems, `accessibility violations:\n${problems.join('\n')}`).toEqual([])
})

test('the states of the course meet the WCAG criteria as well', async ({ page }) => {
  /*
   * Auditing a page in the state a reader first meets it is not enough. Most
   * of the course is in a different state most of the time: a question that
   * has been answered, a dialog that is open, a figure with some of it
   * dimmed. Those states are where the defects are, because they are the
   * states that are written later and looked at less.
   */
  test.setTimeout(180_000)
  const problems: string[] = []

  /*
    The page has to be *there* before it can be audited, and on a machine
    that is busy with something else a page load can take a while. The
    default ten seconds is not enough for that, and a test that fails
    because the machine was busy reports a defect in the course that is not
    in the course.
  */
  const PATIENT = { timeout: 30_000 }

  const audit = async (label: string) => {
    const found = await auditAccessibility(page)
    for (const problem of found) problems.push(`${label} → ${problem}`)
  }

  // A practice question that has been answered. The options that are neither
  // right nor chosen are dimmed, and dimming is done with opacity, which
  // lowers the contrast of the text inside.
  await page.goto('/#/practice')
  await expect(page.getByTestId('question-options').first()).toBeVisible(PATIENT)
  await page.getByTestId('question-options').first().getByRole('button').first().click()
  await page.waitForTimeout(400)
  await audit('a practice question that has been answered')

  // The command palette, with results in it.
  await page.goto('/#')
  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  await expect(palette).toBeVisible(PATIENT)
  // The input is looked up inside the dialog. There is another combobox on
  // the page — the course search in the header — and typing into that one
  // would leave the focus in a text field, which is where the "?" shortcut
  // is deliberately ignored.
  await palette.getByRole('combobox').fill('attention')
  await page.waitForTimeout(400)
  await audit('the command palette with results in it')

  // The list of keyboard shortcuts.
  await page.keyboard.press('Escape')
  // The focus is taken out of the text field. The "?" shortcut is
  // deliberately ignored while a reader is typing, so a focus left in a
  // field would make this test pass for the wrong reason — or fail.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await page.goto('/#')
  /*
    The route change unmounts the shell and mounts the new page in its place,
    and there is a frame between the two in which nothing is listening for a
    key. A press that lands in that frame opens nothing, and on a busy machine
    the frame is long enough to lose the race every time. Wait for the page
    the audit is about, as the transformer step below already does.
  */
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible(PATIENT)
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog')).toBeVisible(PATIENT)
  await page.waitForTimeout(300)
  await audit('the keyboard shortcuts')

  // The Transformer Explorer, whose attention matrix dims the positions that
  // are masked out.
  await page.keyboard.press('Escape')
  await page.goto('/#/lessons/generative-transformer')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible(PATIENT)
  await page.waitForTimeout(600)
  await audit('the transformer explorer')

  // The definition panel that opens under a technical term.
  const term = page.locator('[data-concept]').first()
  if (await term.count()) {
    await term.click()
    await page.waitForTimeout(400)
    await audit('the definition panel')
  }

  expect(problems, `accessibility violations:\n${problems.join('\n')}`).toEqual([])
})

test('the colour scheme survives a reload', async ({ page }) => {
  await page.goto('/#/')
  const isLight = () =>
    page.evaluate(() => document.documentElement.classList.contains('light'))

  const before = await isLight()
  await page.getByRole('button', { name: 'Toggle colour scheme' }).click()
  await expect.poll(isLight).toBe(!before)

  // The choice is stored, so a reload must not undo it.
  await page.reload()
  await expect.poll(isLight).toBe(!before)
  await expect
    .poll(async () =>
      page.evaluate(() => window.localStorage.getItem('llm-foundations-lab:theme')),
    )
    .toBe(before ? 'dark' : 'light')
})

test('a technical term in the prose opens its definition', async ({ page }) => {
  await page.goto('/#/lessons/generative-transformer')
  const term = page.getByRole('button', { name: 'causal mask', exact: true }).first()
  await expect(term).toBeVisible()
  await term.click()

  const panel = page.getByRole('dialog', { name: /Causal mask/ })
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('additive')
  await expect(panel).toContainText('§2.1.1')
  await expect(panel.getByRole('link', { name: /Read the lesson/ })).toBeVisible()

  // Escape closes it and returns the focus to the term.
  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()
  await expect(term).toBeFocused()
})

test('the dashboard shows a learning path with a reason', async ({ page }) => {
  await page.goto('/#/dashboard')
  await expect(page.getByText('Your path')).toBeVisible()
  await expect(page.getByText('Study next')).toBeVisible()
  // The first lesson has no prerequisites, so that is the recommendation.
  await expect(page.getByRole('link', { name: 'Self-supervised pre-training' }).first()).toBeVisible()
  await expect(page.getByText(/no prerequisites/i).first()).toBeVisible()
})

test('the course search reaches the objectives of a lesson', async ({ page }) => {
  await openCourse(page)
  const search = page.getByPlaceholder(/Search the course/i)
  await search.fill('partition function')
  // This phrase appears in a lesson objective, not in any title.
  await expect(page.getByRole('option').first()).toBeVisible()
  await expect(page.getByText(/partition function/i).first()).toBeVisible()
})

test('the sampling laboratory asks the reader to predict', async ({ page }) => {
  await page.goto('/#/playground?lab=sampling')
  const panel = page.getByText('Predict the decoding')
  await expect(panel).toBeVisible()
  await panel.scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'learns', exact: true }).first().click()
  await expect(page.getByText('Correct.')).toBeVisible()
})

test('the alignment laboratory asks the reader to predict', async ({ page }) => {
  await page.goto('/#/playground?lab=alignment')
  const panel = page.getByText('Predict the alignment behaviour')
  await expect(panel).toBeVisible()
  await panel.scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: 'a1', exact: true }).first().click()
  await expect(page.getByText(/^Correct\.$/)).toBeVisible()
})

test('the learning laboratory asks the reader to predict', async ({ page }) => {
  await page.goto('/#/playground?lab=learning')
  const panel = page.getByText('Predict the optimisation')
  await expect(panel).toBeVisible()
  await panel.scrollIntoViewIfNeeded()
  // The first question asks which token the trained bigram ranks first.
  await page.getByRole('button', { name: /^model$/ }).first().click()
  await expect(page.getByText(/^Correct\.$|^Not quite/)).toBeVisible()
})

test('the inference laboratory asks the reader to predict', async ({ page }) => {
  await page.goto('/#/playground?lab=inference')
  const panel = page.getByText('Predict the serving cost')
  await expect(panel).toBeVisible()
  await panel.scrollIntoViewIfNeeded()
  await page.getByRole('button', { name: /^It doubles$/ }).first().click()
  await expect(page.getByText(/^Correct\.$|^Not quite/)).toBeVisible()
})

test('the speculative decoding view computes the acceptance, not a stored table', async ({ page }) => {
  await page.goto('/#/playground?lab=inference')
  await page.getByRole('radio', { name: 'Speculative decoding' }).click()
  await expect(page.getByRole('heading', { name: 'Draft, verify, and keep what passes' })).toBeVisible()

  // With the noise at zero and the draft re-tempered to the target, the two
  // distributions coincide: α = 1 exactly, and every pass emits k+1 tokens.
  const temp = page.getByRole('slider', { name: /^Draft temperature/ })
  const noise = page.getByRole('slider', { name: /^Draft noise/ })
  await temp.fill('1')
  await noise.fill('0')
  await expect(page.getByText('1.0000').first()).toBeVisible()
  await expect(page.getByText('5.000', { exact: true })).toBeVisible()

  // Hand the draft some noise again and the output is no longer degenerate.
  await noise.fill('0.9')
  await expect(page.getByText('Draft, verify, and keep what passes')).toBeVisible()
  // Exactly one row of the draft-length table is marked the optimum.
  await expect(page.getByText('best', { exact: true })).toHaveCount(1)
})

test('the in-page outline links to real anchors and tracks the reader', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1000 })
  await page.goto('/#/lessons/generative-transformer')
  await page.waitForTimeout(700)

  const outline = page.getByRole('navigation', { name: 'On this page' })
  await expect(outline).toBeVisible()

  // Every outline link must point at an element that exists on the page.
  const hrefs = await outline.locator('a').evaluateAll((links) =>
    links.map((link) => (link as HTMLAnchorElement).getAttribute('href') ?? ''),
  )
  expect(hrefs.length).toBeGreaterThan(4)
  for (const href of hrefs) {
    const id = href.replace('#', '')
    const count = await page.locator(`#${id}`).count()
    expect(count, `anchor ${href} does not exist on the page`).toBeGreaterThan(0)
  }

  // The section currently in view is marked.
  await expect(outline.locator('a[aria-current="true"]')).toHaveCount(1)

  // Following an anchor moves the highlight with it.
  await outline.getByRole('link', { name: 'Knowledge check' }).click()
  await page.waitForTimeout(700)
  await expect(outline.locator('a[aria-current="true"]')).toHaveText('Knowledge check')
})

test('the skip link moves the focus without leaving the lesson', async ({ page }) => {
  await page.goto('/#/lessons/generative-transformer')
  await page.waitForTimeout(400)

  const skip = page.getByRole('link', { name: 'Skip to content' })
  await skip.focus()
  await skip.press('Enter')
  await page.waitForTimeout(300)

  // The focus moved to the main region...
  await expect(page.locator('#main')).toBeFocused()
  // ...and the route was not disturbed.
  expect(page.url()).toContain('#/lessons/generative-transformer')
})

test('no page scrolls sideways on a phone', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const routes = [
    '/#/',
    '/#/lessons/generative-transformer',
    '/#/lessons/alignment-dpo',
    '/#/lessons/reasoning-training',
    '/#/playground?lab=transformer',
    '/#/playground?lab=learning',
    '/#/playground?lab=inference',
    '/#/practice',
    '/#/dashboard',
    '/#/glossary',
    '/#/math',
    '/#/sources',
    '/#/modules/generative-models',
  ]
  const problems: string[] = []
  for (const route of routes) {
    await page.goto(route)
    await page.waitForTimeout(350)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    if (overflow > 1) problems.push(`${route} overflows by ${overflow}px`)
  }
  expect(problems, `horizontal overflow:\n${problems.join('\n')}`).toEqual([])
})

test('the keyboard shortcuts panel opens and closes', async ({ page }) => {
  await page.goto('/#/')
  await page.waitForTimeout(300)

  await page.keyboard.press('?')
  const panel = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(panel).toBeVisible()
  await expect(panel).toContainText('Open the course search')

  await page.keyboard.press('Escape')
  await expect(panel).toBeHidden()

  // It can be reopened.
  await page.keyboard.press('?')
  await expect(panel).toBeVisible()
})

test('the module page points at the next ready lesson', async ({ page }) => {
  await page.goto('/#/modules/generative-models')
  const start = page.getByRole('link', { name: /Start lesson|Continue with lesson|Review lesson/ })
  await expect(start).toBeVisible()
  // Lesson 4 has no prerequisites, so it is the starting point.
  await expect(start).toContainText('lesson 4')
})

test('the landing page names the next lesson for a returning reader', async ({ page }) => {
  // Visiting a lesson records it in the progress file.
  await page.goto('/#/lessons/pretraining-why')
  // The lesson page is loaded on demand, so wait for the visit to be persisted
  // rather than guessing at a delay.
  await page.waitForFunction(
    () => {
      const raw = window.localStorage.getItem('llm-foundations-lab:progress')
      return typeof raw === 'string' && raw.includes('pretraining-why')
    },
    undefined,
    { timeout: 15_000 },
  )

  await page.goto('/#/')
  await expect(page.getByText(/Welcome back/)).toBeVisible()
  await expect(page.getByText(/Next up:/)).toBeVisible()
  // The named lesson is the first one with no prerequisites.
  await expect(page.getByText('Self-supervised pre-training').first()).toBeVisible()
})

test('the search results can be reached with the arrow keys', async ({ page }) => {
  await openCourse(page)
  const search = page.getByPlaceholder(/Search the course/i)
  await search.click()
  await search.fill('attention')
  await expect(page.getByRole('option').first()).toBeVisible()

  // The first result starts selected.
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'true')

  // Arrow down moves the selection.
  await search.press('ArrowDown')
  await expect(page.getByRole('option').nth(1)).toHaveAttribute('aria-selected', 'true')
  await expect(page.getByRole('option').first()).toHaveAttribute('aria-selected', 'false')

  // Enter follows the selected result — the second one, not the first.
  await search.press('Enter')
  await page.waitForTimeout(300)
  expect(page.url()).toContain('scaled-dot-product-attention')
})

test('a lesson prints to a clean document', async ({ page, browserName }) => {
  // PDF generation is Chromium-only in Playwright.
  test.skip(browserName !== 'chromium', 'PDF generation is Chromium-only')
  await page.goto('/#/lessons/generative-transformer')
  await page.waitForTimeout(800)

  const pdf = await page.pdf({ format: 'A4', printBackground: true })
  expect(pdf.byteLength).toBeGreaterThan(10_000)
  // A PDF always starts with its header.
  expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-')
})

test('a printed page keeps its content and loses its chrome', async ({ page }) => {
  /*
    Printing is a way of taking the course away, and what a reader takes
    away should be the course. The stylesheet used to hide every aside
    element to remove the in-page outline, and that also removed the source
    references of a lesson, the definitions on the glossary and the
    explanations on the mathematical reference. A printed lesson with no
    source references looks complete and is not.
  */
  await page.goto('/#/lessons/generative-transformer')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await page.emulateMedia({ media: 'print' })

  // The content is still there...
  await expect(page.getByRole('heading', { name: 'Source sections' })).toBeVisible()
  // ...and the chrome is not.
  await expect(page.getByRole('navigation', { name: 'On this page' })).toBeHidden()
  await expect(page.getByRole('banner')).toBeHidden()

})

test('a printed glossary keeps the definition of the term being read', async ({ page }) => {
  // The definitions live in an aside, and the stylesheet used to hide every
  // aside to remove the in-page outline. A printed glossary with a list of
  // terms and no definitions looks like a glossary and is not one.
  await page.goto('/#/glossary')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // The entry is chosen, which fills the panel beside the list with the
  // term, its source and the lesson it is used in.
  await page.goto('/#/glossary?term=scaled-dot-product-attention')
  await expect(page.getByText(/^Source: §/).first()).toBeVisible()

  // The panel beside the list is an aside, and the stylesheet used to hide
  // every aside to remove the in-page outline. A printed glossary with a list
  // of terms and no definitions looks like a glossary and is not one.
  await page.emulateMedia({ media: 'print' })
  await expect(page.getByText(/^Source: §/).first()).toBeVisible()
})

test('a saved configuration is restored into the laboratory', async ({ page }) => {
  await page.goto('/#/playground?lab=sampling')

  // Change the temperature, then save the configuration.
  const temperature = page.getByRole('slider', { name: /Temperature/i })
  await temperature.fill('0.4')
  await expect(temperature).toHaveValue('0.4')
  await page.getByRole('button', { name: 'Save this configuration' }).click()
  await expect(page.getByText('Configuration saved')).toBeVisible()

  // Move away and come back through the saved configuration.
  await page.goto('/#/playground?lab=transformer')
  await page.goto('/#/dashboard')
  await expect(page.getByText(/configuration 1/i).first()).toBeVisible()
  await page.getByRole('button', { name: 'Open' }).first().click()

  // The laboratory comes back with the stored value, not its default.
  await expect(page.getByRole('slider', { name: /Temperature/i })).toHaveValue('0.4')
  await expect(page.getByText('Saved configuration loaded')).toBeVisible()
})

test('a saved configuration restores the inference laboratory', async ({ page }) => {
  await page.goto('/#/playground?lab=inference')
  await page.getByRole('radio', { name: 'KV cache and context' }).click()
  const layers = page.getByRole('slider', { name: /^Layers L/ })
  await layers.fill('64')
  await expect(layers).toHaveValue('64')
  await page.getByRole('button', { name: 'Save this configuration' }).click()
  await expect(page.getByText('Configuration saved')).toBeVisible()

  await page.goto('/#/dashboard')
  await page.getByRole('button', { name: 'Open' }).first().click()

  // The cache view is restored along with the layer count.
  await expect(page.getByRole('radio', { name: 'KV cache and context' })).toBeChecked()
  await expect(page.getByRole('slider', { name: /^Layers L/ })).toHaveValue('64')
})

test('the course home does not download the laboratories', async ({ page }) => {
  // The laboratories, the charting library and the mathematics typesetting are
  // most of the bundle. A reader who lands on the home page has no use for
  // them yet, so the routes are split and the heavy chunk is fetched on demand.
  const requested: string[] = []
  page.on('request', (request) => {
    const url = request.url()
    if (/\/src\/components\/lab\/|SamplingLab|AlignmentLab|InferenceLab/.test(url)) {
      requested.push(url.split('/').pop() ?? url)
    }
  })

  await page.goto('/#/')
  await page.waitForTimeout(1200)
  expect(requested, `the home page pulled in ${requested.join(', ')}`).toEqual([])
})

test('the dashboard counts the concepts covered, not only the lessons', async ({ page }) => {
  await page.goto('/#/lessons/pretraining-why')
  await page.waitForFunction(
    () => {
      const raw = window.localStorage.getItem('llm-foundations-lab:progress')
      return typeof raw === 'string' && raw.includes('pretraining-why')
    },
    undefined,
    { timeout: 15_000 },
  )
  await page.goto('/#/dashboard')
  await expect(page.getByText('Concepts covered')).toBeVisible()
  await expect(page.getByText(/terms$/)).toBeVisible()
  // The glossary marks the terms whose lesson is done.
  await page.goto('/#/glossary')
  await expect(page.getByText('met').first()).toBeVisible()
})

test('the module page names the misreadings readers bring to it', async ({ page }) => {
  await page.goto('/#/modules/alignment')
  await expect(page.getByText('Three misreadings worth unlearning')).toBeVisible()
  await expect(page.getByText('The tempting story').first()).toBeVisible()
  await expect(page.getByText('What is actually true').first()).toBeVisible()
  // The claim and its correction both appear.
  await expect(page.getByText(/SFT and DPO are two names/).first()).toBeVisible()
  await expect(page.getByText(/maximises the likelihood of the demonstrated response/).first()).toBeVisible()
})

test('the search results highlight the words that were searched for', async ({ page }) => {
  await openCourse(page)
  const search = page.getByPlaceholder(/Search the course/i)
  await search.fill('reward model')
  const mark = page.getByRole('option').first().locator('mark')
  await expect(mark).toBeVisible()
  await expect(mark).toHaveText(/reward model/i)
})

test('the concept map shows a module and the terms it depends on', async ({ page }) => {
  await page.goto('/#/glossary')
  const map = page.getByRole('group', { name: /Concept map/ })
  await expect(map).toBeVisible()

  // The first module introduces foundational terms, so it has no earlier ones.
  await expect(map).toContainText('Pre-training')

  // A later module draws the terms it rests on beneath its own.
  await page.getByRole('button', { name: '4. Alignment' }).first().click()
  await expect(map).toContainText('Bradley')
  await expect(map).toContainText('Fine-tuning')

  // Selecting a node opens that term.
  await map.locator('g[role="button"]').first().click()
  await expect(page.getByRole('heading', { name: 'Prerequisites' })).toBeVisible()
})

test('the practice set can be narrowed to a single lesson', async ({ page }) => {
  await page.goto('/#/lessons/generative-transformer')
  // The lesson states how many questions it carries, so the count is read
  // from the page rather than imported from the app's own source.
  const heading = await page
    .getByText(/questions\s*[—–-]\s*answers are graded locally/)
    .first()
    .textContent()
  const expected = Number(/(\d+) question/.exec(heading ?? '')?.[1] ?? 0)
  expect(expected).toBeGreaterThan(0)

  await page.getByRole('link', { name: /Open every question from it/ }).click()
  await expect(page).toHaveURL(/practice\?lesson=/)

  // Only that lesson's questions are in view.
  const filter = page.getByTestId('lesson-filter')
  await expect(filter).toHaveValue('generative-transformer')
  await expect(page.getByText('Questions in view')).toBeVisible()
  const map = page.getByRole('button', { name: /^\d+$/ })
  await expect(map).toHaveCount(expected)
})

test('the practice page links each question to the lesson that teaches it', async ({ page }) => {
  await page.goto('/#/practice')
  const link = page.getByRole('link', { name: /taught in / }).first()
  await expect(link).toBeVisible()
  await link.click()
  await expect(page).toHaveURL(/#\/lessons\//)
})

test('the practice page offers the weakest module once something has been answered', async ({ page }) => {
  await page.goto('/#/practice')
  // With nothing answered there is no weakest module yet.
  await expect(page.getByRole('button', { name: 'Practise my weakest module' })).toHaveCount(0)

  await page.getByRole('button', { name: /^A[A-Z]/ }).first().click()
  const button = page.getByRole('button', { name: 'Practise my weakest module' })
  await expect(button).toBeVisible()
  await expect(page.getByText(/Your weakest module is/).first()).toBeVisible()

  // Using it filters the question list down to that module.
  await button.click()
  await expect(page.getByText(/Your weakest module is/).first()).toBeVisible()
})

test('the playground follows the address bar and the browser history', async ({ page }) => {
  await page.goto('/#/playground')
  const selectedTab = async () =>
    (await page.locator('[role="tab"][aria-selected="true"]').first().textContent())?.trim()

  await expect(page.getByRole('tab', { name: 'Transformer' })).toBeVisible()
  expect(await selectedTab()).toBe('Transformer')

  // Switching laboratories writes the choice into the address bar.
  await page.getByRole('tab', { name: 'Sampling' }).click()
  await expect.poll(selectedTab).toBe('Sampling')
  expect(page.url()).toContain('lab=sampling')

  // Going back must return to the previous laboratory, not leave the panel
  // showing a laboratory the address bar no longer names.
  await page.goBack()
  await expect.poll(selectedTab).toBe('Transformer')
  await page.goForward()
  await expect.poll(selectedTab).toBe('Sampling')
})

test('the playground opens a laboratory named directly in the address', async ({ page }) => {
  await page.goto('/#/playground?lab=alignment')
  await expect
    .poll(async () =>
      (await page.locator('[role="tab"][aria-selected="true"]').first().textContent())?.trim(),
    )
    .toBe('Alignment')
})

test('practice grades an answer, explains it and survives a reload', async ({ page }) => {
  await page.goto('/#/practice')
  await expect(page.getByRole('heading', { name: 'Practice' })).toBeVisible()

  // Pick option A of the first question.
  await page.getByRole('button', { name: /^A[A-Z]/ }).first().click()

  // Any answer produces a graded result with the explanation and a per-option diagnosis.
  await expect(page.getByText(/^(Correct|Incorrect)\./)).toBeVisible()
  await expect(page.getByText('Your option:')).toBeVisible()

  await page.reload()
  await expect(page.getByText(/Answered overall/i)).toBeVisible()
  const stored = await page.evaluate(() => window.localStorage.getItem('llm-foundations-lab:progress'))
  expect(stored).toBeTruthy()
  expect(JSON.parse(stored as string).quizzes.length).toBeGreaterThan(0)
})

test('completing a lesson updates progress and the dashboard export', async ({ page }) => {
  await page.goto('/#/lessons/pretraining-why')
  await page.getByRole('button', { name: 'Mark lesson complete' }).click()
  await expect(page.getByText('1 / 18 lessons').first()).toBeVisible()

  await page.goto('/#/dashboard')
  await expect(page.getByText(/1 completed|1 \/ 18/i).first()).toBeVisible()

  const downloadPromise = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download progress JSON' }).click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/llm-foundations-progress.*\.json/)
})

test('course search is keyboard reachable and finds a lesson', async ({ page }) => {
  await openCourse(page)
  await page.keyboard.press('/')
  const search = page.getByPlaceholder(/Search the course/i)
  await expect(search).toBeFocused()
  await search.fill('attention')
  const results = page.getByRole('listbox').or(page.locator('#course-search-results'))
  await expect(results.first()).toBeVisible()
  await expect(page.getByText(/attention/i).first()).toBeVisible()
})

test('the review page schedules every question and reschedules it after an answer', async ({ page }) => {
  await page.goto('/#/review')
  await expect(page.getByRole('heading', { level: 1, name: 'Review' })).toBeVisible()

  // Before anything has been reviewed, every question is new rather than
  // due: a question that has never been asked is not at risk of being
  // forgotten.
  await expect(page.getByText('Not seen yet', { exact: true })).toBeVisible()
  const unseen = await page
    .getByText('Not seen yet', { exact: true })
    .locator('..')
    .getByText(/^\d+$/)
    .textContent()
  expect(Number(unseen)).toBeGreaterThan(0)

  await page.getByTestId('start-review').click()
  await expect(page.getByTestId('review-prompt')).toBeVisible()

  // Answer the question and read the verdict the scheduler produced.
  await page.getByTestId('question-options').getByRole('button').first().click()
  const verdict = page.getByTestId('schedule-verdict')
  await expect(verdict).toBeVisible()
  await expect(verdict).toContainText(/Rescheduled|Back tomorrow/)

  // The schedule is written to the local progress file.
  const stored = await page.evaluate(() => window.localStorage.getItem('llm-foundations-lab:progress'))
  expect(stored).toBeTruthy()
  const reviews = JSON.parse(stored as string).reviews
  expect(Object.keys(reviews).length).toBe(1)
  expect(Object.values(reviews)[0]).toMatchObject({ intervalDays: 1, easeFactor: expect.any(Number) })
})

test('the dashboard offers the review queue once a question has been scheduled', async ({ page }) => {
  await page.goto('/#/review')
  await page.getByTestId('start-review').click()
  await page.getByTestId('question-options').getByRole('button').first().click()
  await expect(page.getByTestId('schedule-verdict')).toBeVisible()

  await page.goto('/#/dashboard')
  // The question has been answered once, so it is scheduled for tomorrow
  // rather than due; what is left is the questions never seen.
  await expect(page.getByText(/question.*you have not seen yet/i)).toBeVisible()
  await page.getByRole('link', { name: 'Start a review session' }).click()
  await expect(page).toHaveURL(/#\/review/)
})

test('the practice page can be narrowed to the questions that are due', async ({ page }) => {
  await page.goto('/#/practice')
  const due = page.getByRole('radio', { name: 'Due for review' })
  await expect(due).toBeVisible()
  await due.click()
  await expect(page).toHaveURL(/practice\?filter=due/)

  // Every question in the bank starts due, so the filter shows all of them.
  const map = page.getByRole('button', { name: /^\d+$/ })
  const total = await map.count()
  expect(total).toBeGreaterThan(0)
})

test('the command palette opens, searches and navigates', async ({ page }) => {
  await openCourse(page)

  // The palette opens on the shortcut for the platform.
  await page.keyboard.press('Control+k')
  const palette = page.getByRole('dialog', { name: 'Command palette' })
  await expect(palette).toBeVisible()

  // It finds a lesson by a fragment of its title. The query has two words
  // and both of them have to match, so "long sequences" finds the lesson
  // rather than every title that happens to contain an "s".
  const input = page.getByRole('combobox', { name: 'Look for a lesson, a term, or a command' })
  await input.fill('long sequences')
  const options = page.getByRole('option')
  await expect(options.first()).toContainText('Long sequences')
  await options.first().click()

  // Choosing an entry navigates to it and closes the palette.
  await expect(page).toHaveURL(/#\/lessons\//)
  await expect(palette).toBeHidden()
})

test('the command palette runs a command', async ({ page }) => {
  await openCourse(page)
  const before = await page.locator('html').getAttribute('class')

  await page.keyboard.press('Control+k')
  const input = page.getByRole('combobox', { name: 'Look for a lesson, a term, or a command' })
  await input.fill('colour scheme')

  // The command names the scheme it switches to, and it is the only command
  // that matches "colour scheme".
  const option = page.getByRole('option').first()
  await expect(option).toContainText('theme')
  await option.click()

  // The colour scheme changed, and the palette closed.
  await expect(page.locator('html')).not.toHaveClass(before ?? '')
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeHidden()
})

test('the command palette closes on Escape without navigating', async ({ page }) => {
  await openCourse(page)
  await page.keyboard.press('Control+k')
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeVisible()
  const before = page.url()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Command palette' })).toBeHidden()
  expect(page.url()).toBe(before)
})

test('a link changes the page through a view transition', async ({ page }) => {
  await openCourse(page)

  // A browser without the View Transitions API changes the page in the
  // ordinary way, and the rest of this test does not apply.
  const supported = await page.evaluate(() => typeof document.startViewTransition === 'function')
  test.skip(!supported, 'this browser has no View Transitions API')

  // Count the transitions that start.
  await page.evaluate(() => {
    const windowWithCounter = window as unknown as { transitions: number }
    windowWithCounter.transitions = 0
    const original = document.startViewTransition.bind(document)
    document.startViewTransition = ((callback: () => void | Promise<void>) => {
      windowWithCounter.transitions += 1
      return original(callback as () => void)
    }) as typeof document.startViewTransition
  })

  // The page that is opened is a lazy route, so this also checks that the
  // transition waits for the route rather than animating a loading screen.
  await page.getByRole('link', { name: 'Practice' }).first().click()
  await expect(page).toHaveURL(/practice/)
  await expect(page.getByRole('heading', { level: 1, name: 'Practice' })).toBeVisible()

  const transitions = await page.evaluate(
    () => (window as unknown as { transitions: number }).transitions,
  )
  expect(transitions).toBeGreaterThan(0)
})

test('every lesson asks the reader to explain it back', async ({ page }) => {
  await page.goto('/#/lessons/pretraining-why')
  const explain = page.getByTestId('explain-back')
  await expect(explain).toBeVisible()
  await expect(explain.getByRole('heading', { name: 'Explain it back' })).toBeVisible()

  // The answer is hidden until the reader has had a go at it.
  await expect(page.getByTestId('explanation-answer')).toHaveCount(0)
  await explain.getByTestId('reveal-answer').click()
  await expect(page.getByTestId('explanation-answer')).toBeVisible()
  await expect(explain.getByText('A good answer')).toBeVisible()
})

test('the reader keeps their own explanation', async ({ page }) => {
  await page.goto('/#/lessons/pretraining-why')
  const explain = page.getByTestId('explain-back')
  const box = explain.getByLabel('Your explanation')
  await box.fill('Predicting the next word forces the model to use the structure of what came before.')
  await explain.getByTestId('reveal-answer').click()
  await explain.getByRole('button', { name: 'Not yet' }).click()

  // It is still there after a reload, and the rating is still recorded.
  await page.reload()
  const again = page.getByTestId('explain-back')
  await expect(again.getByLabel('Your explanation')).toHaveValue(
    'Predicting the next word forces the model to use the structure of what came before.',
  )
  await expect(again.getByRole('button', { name: 'Not yet' })).toHaveAttribute('aria-pressed', 'true')
})

test('the dashboard offers a plan that fits the time the reader has', async ({ page }) => {
  await page.goto('/#/dashboard')
  const panel = page.getByRole('heading', { name: 'What to do now' })
  await expect(panel).toBeVisible()

  // A reader who has just started is told to read, not to review: a
  // question that has never been asked is not at risk of being forgotten.
  await expect(page.getByRole('link', { name: /^Read “/ })).toBeVisible()

  // The budget changes what fits.
  const tenMinutes = page.getByRole('button', { name: '10 min' })
  await tenMinutes.click()
  await expect(tenMinutes).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText(/step.* fit in the time you have/)).toBeVisible()
})

test('the dashboard says what is due for review, and what is simply new', async ({ page }) => {
  await page.goto('/#/dashboard')
  // Nothing has been answered, so nothing is at risk of being forgotten.
  await expect(page.getByText('Due for review').first()).toBeVisible()
  await expect(page.getByText('0').first()).toBeVisible()
})

test('the course says what is settled and what is moving', async ({ page }) => {
  await page.goto('/#/status')
  await expect(page.getByRole('heading', { level: 1, name: 'How settled is this?' })).toBeVisible()

  // Every module says what holds and what is moving, and points at a source.
  for (const chapter of ['Pre-training', 'Generative Models', 'Prompting', 'Alignment', 'Inference', 'Reasoning']) {
    const module = page.getByRole('heading', { level: 2, name: new RegExp(chapter) })
    await expect(module).toBeVisible()
  }
  await expect(page.getByText('What holds').first()).toBeVisible()
  await expect(page.getByText('What is moving').first()).toBeVisible()

  // The page says when its sources were last checked, so a reader can judge
  // how current it is rather than being asked to take it on trust.
  await expect(page.getByText(/Every source below was checked on/)).toBeVisible()

  // The sources are real links, not placeholders.
  const sources = page.locator('main a[target="_blank"]')
  const count = await sources.count()
  expect(count).toBeGreaterThan(15)
  const hrefs = await sources.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute('href') ?? ''),
  )
  for (const href of hrefs) {
    expect(href, 'a source is not a real address').toMatch(/^https:\/\//)
  }
})

test('a page that fails shows the course error page, not a blank screen', async ({ page }) => {
  // The diagnostics route always throws. It exists only in a development
  // build, so the test is skipped against a published one.
  await page.goto('/#/diagnostics/fail')
  const notice = page.getByRole('heading', { name: 'Something failed while drawing this view' })
  await expect(notice).toBeVisible()
  await expect(page.getByText(/asked to fail/)).toBeVisible()

  // And there is a way back.
  await page.getByRole('link', { name: 'Back to course home' }).click()
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
})

test('the practice set interleaves the lessons', async ({ page }) => {
  await page.goto('/#/practice')
  await expect(page.getByText('Questions in view')).toBeVisible()

  // Two questions of the same lesson are never next to each other, so the
  // reader has to work out which rule applies before the answer. The map
  // carries the lesson of each question so that the order can be checked.
  const lessons = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-lesson]')).map(
      (element) => element.getAttribute('data-lesson') ?? '',
    ),
  )
  expect(lessons.length).toBeGreaterThan(4)
  for (let index = 1; index < lessons.length; index++) {
    expect(
      lessons[index],
      `question ${index} and ${index - 1} are both from ${lessons[index]}`,
    ).not.toBe(lessons[index - 1])
  }

  // The page says so, because interleaved practice feels harder and a reader
  // who does not know that will think the course is badly designed.
  await expect(page.getByText(/interleaved/i).first()).toBeVisible()
})

test('a link to a section of a page keeps the reader on the course', async ({ page }) => {
  // A hash router puts the route in the fragment of the address, so a plain
  // "href=\"#section\"\" would replace the route rather than add to it, and
  // the reader would be taken to the page that says the address is not part
  // of the course. This is the bug that was there.
  await page.goto('/#/status')
  await expect(page.getByRole('heading', { level: 1, name: 'How settled is this?' })).toBeVisible()

  const link = page.locator('nav[aria-label="The modules"] a').first()
  await link.click()
  await page.waitForTimeout(600)

  // The reader is still on the course.
  await expect(page.getByRole('heading', { level: 1, name: 'How settled is this?' })).toBeVisible()
  expect(page.url()).toContain('/#/status')
  expect(page.url()).not.toContain('not part of the course')

  // And the address is one that can be reloaded or shared: the route is
  // still there, with the section appended to it.
  const url = new URL(page.url())
  expect(url.hash.startsWith('#/status')).toBe(true)
  expect(url.hash).toContain('#pre-training')
})

test('a link to a section of a lesson leaves an address that can be reloaded', async ({ page }) => {
  await page.goto('/#/lessons/pretraining-bert')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const link = page.locator('nav[aria-label="On this page"] a').first()
  const sectionId = (await link.getAttribute('href'))?.replace('#', '') ?? ''
  await link.click()
  await page.waitForTimeout(600)

  // The address still names the lesson, and names the section as well.
  const url = new URL(page.url())
  expect(url.hash).toContain('#/lessons/pretraining-bert')
  expect(url.hash).toContain(`#${sectionId}`)

  // And reloading it lands on the same lesson rather than on a page saying
  // the address is not part of the course.
  await page.reload()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  expect(page.url()).toContain('/#/lessons/pretraining-bert')
})

test('the focus follows the page when the route changes', async ({ page }) => {
  await page.goto('/#/')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // On the first page the focus is left where the reader had it.
  const before = await page.evaluate(() => document.activeElement?.tagName)

  await page.locator('a[href*="/lessons/pretraining-why"]').first().click()
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // After a route change the focus is on the new page's heading, so a screen
  // reader announces it. Without this the focus stays on the link that was
  // followed and nothing is said.
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const active = document.activeElement
        return active?.tagName === 'H1' ? active.textContent : null
      }),
    )
    .toContain('Self-supervised pre-training')

  expect(await page.evaluate(() => document.activeElement?.tagName)).not.toBe(before)
})

test('the course can be reached from the navigation', async ({ page }) => {
  await page.goto('/#/')
  await page.getByRole('link', { name: 'How settled is this?' }).first().click()
  await expect(page.getByRole('heading', { level: 1, name: 'How settled is this?' })).toBeVisible()
})

test('a lesson says how settled its module is, and links to the sources', async ({ page }) => {
  await page.goto('/#/lessons/alignment-dpo')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // A lesson says what is taught. The panel next to it says how much weight
  // to put on that, which is a different question.
  const panel = page.getByRole('heading', { name: 'How settled is this?' })
  await expect(panel).toBeVisible()
  await expect(page.getByText('Settling').first()).toBeVisible()

  const link = page.getByRole('link', { name: /Read the sources for module/ })
  await link.click()
  await page.waitForTimeout(800)

  // The reader lands on the status page, at the module they came from, and
  // the address is one that can be reloaded.
  await expect(page.getByRole('heading', { level: 1, name: 'How settled is this?' })).toBeVisible()
  const url = new URL(page.url())
  expect(url.hash).toContain('#/status')
  expect(url.hash).toContain('#alignment')
  expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0)
})

test('the search finds what has moved in a module', async ({ page }) => {
  await page.goto('/#')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // A phrase that is named on the status page and nowhere else in the
  // course. Before the status page was indexed, a reader who half-remembered
  // it found nothing at all.
  const search = page.getByLabel('Search lessons, terms and formulas')
  await search.fill('brevity bias')
  await page.waitForTimeout(400)

  const results = page.getByRole('listbox', { name: 'Search results' })
  await expect(results).toBeVisible()
  const option = results.getByRole('option').first()
  await expect(option).toContainText('how settled is this?')

  await option.click()
  await page.waitForTimeout(800)

  // The reader lands on the status page, at the module the phrase is in.
  await expect(page.getByRole('heading', { level: 1, name: 'How settled is this?' })).toBeVisible()
  expect(page.url()).toContain('/#/status#')
})

test('a link to a particular term or formula opens it', async ({ page }) => {
  /*
    The glossary and the mathematical reference both keep the thing being
    read in the address, so that a link to a particular term or formula can
    be shared. They used to keep it in state, initialised from the address
    once, which meant arriving at such a link showed the list with nothing
    selected.
  */
  await page.goto('/#/glossary?term=scaled-dot-product-attention')
  await expect(page.getByText(/^Source: §/).first()).toBeVisible()

  await page.goto('/#/math?formula=mlm-loss')
  await expect(page.getByText(/^Source: §/).first()).toBeVisible()
})

test('changing one filter on the practice page keeps the other', async ({ page }) => {
  await page.goto('/#/practice')
  await expect(page.getByText('Questions in view')).toBeVisible()

  // Narrow to a lesson...
  const lesson = page.getByRole('combobox', { name: 'Lesson', exact: true })
  await lesson.selectOption('pretraining-bert')
  await expect(lesson).toHaveValue('pretraining-bert')
  await page.waitForTimeout(300)
  expect(page.url()).toContain('lesson=pretraining-bert')

  // ...and then change the question set. The lesson must survive: the two
  // filters are two questions, and answering one of them does not answer
  // the other.
  await page.getByRole('radio', { name: 'Unanswered' }).click()
  await page.waitForTimeout(300)
  expect(page.url()).toContain('lesson=pretraining-bert')
  expect(page.url()).toContain('filter=unanswered')
})
