import { expect, test } from '@playwright/test'
import { LESSONS } from '../src/content/curriculum.ts'

/**
 * The lessons must not move while they are being read.
 *
 * The lessons used to use `content-visibility: auto` so that the browser
 * could skip the layout of the sections that are off screen. The catch was
 * that a skipped section is given a guessed height, and when the section is
 * finally rendered its real height replaces the guess — so the page grew
 * under the reader. In WebKit the Transformer lesson changed height by 404
 * pixels, and in Firefox the in-page outline stopped tracking the reader.
 *
 * The property is not used any more, and this test is what keeps it that
 * way: it scrolls every lesson from the top to the bottom, which forces
 * every section to be rendered, and compares the height of the page before
 * and after. Any difference is a layout shift that a reader would feel.
 *
 * The list of lessons comes from the course itself rather than being written
 * out here. It used to be written out here, and a lesson added to the course
 * would not have been checked — the same drift as the accessibility audit,
 * in the same week.
 */

test('no lesson changes its height while it is being read', async ({ page }) => {
  // Every lesson is opened, scrolled to the end and measured again. That is
  // eighteen page loads and a great deal of scrolling, and the default
  // timeout is not enough for it on a machine that is doing something else
  // at the same time.
  test.setTimeout(240_000)
  const shifts: string[] = []

  for (const lesson of LESSONS) {
    await page.goto(`/#/lessons/${lesson.id}`)
    // Wait for the lesson to be laid out before measuring it. The body of a
    // lesson is loaded on demand, so the heading arrives before the prose
    // does, and measuring before the prose is there would compare a skeleton
    // with a lesson.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    /*
      The body of a lesson is loaded on demand, so the page has to finish
      fetching before it can be measured. Waiting for the network to be idle
      is not enough — the request for the module starts after the first
      paint — and waiting for the text of the exercise is not enough either,
      because the outline names it too and it is in the sidebar from the
      start.
    */
    await expect(page.getByTestId('lesson-body')).toBeVisible()
    /*
      The web fonts change the height of the text when they arrive, so the
      measurement has to wait for them as well.
    */
    await page.evaluate(async () => {
      await document.fonts.ready
    })
    await page.waitForTimeout(150)

    const before = await page.evaluate(() => document.documentElement.scrollHeight)

    // Scroll the whole lesson, a half screen at a time, so that every
    // section is rendered.
    await page.evaluate(async () => {
      const step = Math.max(200, Math.floor(window.innerHeight / 2))
      for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y)
        await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      }
    })
    await page.waitForTimeout(150)

    const after = await page.evaluate(() => document.documentElement.scrollHeight)
    if (before !== after) {
      shifts.push(`${lesson}: ${before}px became ${after}px (${after - before >= 0 ? '+' : ''}${after - before}px)`)
    }
  }

  expect(shifts, `lessons that moved while being read:\n${shifts.join('\n')}`).toEqual([])
})

test('a heading is wrapped in balance and a paragraph in pretty', async ({ page }) => {
  await page.goto('/#/lessons/pretraining-why')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // `text-wrap: balance` on a heading evens out the line lengths, and
  // `text-wrap: pretty` on a paragraph keeps a word from being stranded.
  const wrapping = await page.evaluate(() => {
    const heading = document.querySelector('h1')
    const paragraph = document.querySelector('article p')
    return {
      heading: heading ? getComputedStyle(heading).textWrap : null,
      paragraph: paragraph ? getComputedStyle(paragraph).textWrap : null,
      supportsBalance: CSS.supports('text-wrap: balance'),
      supportsPretty: CSS.supports('text-wrap: pretty'),
    }
  })

  expect(wrapping.supportsBalance).toBe(true)
  expect(wrapping.heading).toBe('balance')

  // `pretty` is newer than `balance` and is not in every browser yet. Where
  // it is missing, the declaration is dropped and the paragraph wraps the
  // ordinary way — which is exactly what should happen.
  if (wrapping.supportsPretty) {
    expect(wrapping.paragraph).toBe('pretty')
  } else {
    expect(wrapping.paragraph).toBe('wrap')
  }
})

test('a laboratory lays itself out by its own width, not by the width of the window', async ({ page }) => {
  await page.goto('/#/playground?lab=sampling')
  await expect(page.getByRole('heading', { name: /Text generation and sampling/i })).toBeVisible()

  const columns = async () =>
    page.evaluate(() => {
      const split = document.querySelector('.split-side')
      if (!split) return null
      const style = getComputedStyle(split)
      return style.gridTemplateColumns.split(' ').filter(Boolean).length
    })

  // A wide window gives the laboratory room for its side column.
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.waitForTimeout(150)
  const wide = await columns()

  // A narrow one does not, even though the window is still the same size in
  // every other respect.
  await page.setViewportSize({ width: 700, height: 900 })
  await page.waitForTimeout(150)
  const narrow = await columns()

  expect(wide).toBe(2)
  expect(narrow).toBe(1)
})

test('the reading progress bar is drawn on a lesson', async ({ page }) => {
  await page.goto('/#/lessons/generative-transformer')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  const bar = page.getByTestId('reading-progress')
  await expect(bar).toBeAttached()

  // The bar is driven by a scroll timeline where the browser has one, and it
  // is hidden from assistive technology either way: the in-page outline
  // already says which section the reader is in.
  const state = await bar.evaluate((element) => {
    const fill = element.querySelector('.reading-progress__fill')
    if (!fill) return null
    const style = getComputedStyle(fill)
    const animation = fill.getAnimations()[0]
    return {
      hidden: element.getAttribute('aria-hidden'),
      timeline: style.animationTimeline,
      duration: style.animationDuration,
      driven: animation ? animation.timeline?.constructor.name : null,
    }
  })

  expect(state).not.toBeNull()
  expect(state?.hidden).toBe('true')
  // Either the scroll timeline is in use, or the browser does not support it
  // and the bar simply stays empty. Firefox 157 does not support
  // scroll-driven animations at all, and reports no `animation-timeline` at
  // all, so the property is absent rather than set to its initial value.
  if (state?.driven === 'ScrollTimeline') {
    expect(state?.timeline.startsWith('scroll(')).toBe(true)
    expect(state?.duration).toBe('auto')
  } else {
    expect(state?.timeline === 'auto' || state?.timeline === undefined).toBe(true)
  }
})

test('a panel shows where the focus is', async ({ page }) => {
  await page.goto('/#/playground?lab=tokenizer')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  // The panel that holds the focused control is outlined, so the reader can
  // see which part of a long interface the focus is in.
  const outline = await page.evaluate(() => {
    const panel = document.querySelector('.panel')
    const control = panel?.querySelector('input, select, button') as HTMLElement | null
    if (!control) return null
    control.focus()
    return getComputedStyle(panel as Element).outlineStyle
  })

  expect(outline).toBe('solid')
})

test('a definition panel is placed under the term it belongs to', async ({ page }) => {
  await page.goto('/#/lessons/generative-transformer')
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(page.getByTestId('lesson-body')).toBeVisible()

  const term = page.getByRole('button', { name: 'autoregressive' }).first()
  await term.scrollIntoViewIfNeeded()
  await term.click()

  const panel = page.getByRole('dialog', { name: /definition/i }).first()
  await expect(panel).toBeVisible()

  const termBox = await term.boundingBox()
  const panelBox = await panel.boundingBox()
  expect(termBox).not.toBeNull()
  expect(panelBox).not.toBeNull()

  // The panel sits below the term and is lined up with it.
  expect(panelBox!.y).toBeGreaterThanOrEqual(termBox!.y + termBox!.height - 1)
  expect(Math.abs(panelBox!.x - termBox!.x)).toBeLessThan(2)

  // And it is inside the window, whichever way the browser had to place it.
  const width = page.viewportSize()?.width ?? 1280
  expect(panelBox!.x).toBeGreaterThanOrEqual(-1)
  expect(panelBox!.x + panelBox!.width).toBeLessThanOrEqual(width + 1)
})
