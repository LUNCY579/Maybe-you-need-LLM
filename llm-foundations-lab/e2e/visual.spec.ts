import { expect, test } from '@playwright/test'
import { existsSync, readdirSync } from 'node:fs'

/**
 * Visual regression.
 *
 * The other end-to-end tests check that the course *works*. This one checks
 * that it still *looks* the way it did: a change that accidentally reflows a
 * figure, moves a heading or drops a border is a change the reader would
 * notice and nobody would notice in a unit test.
 *
 * The comparison is a pixel count with a tolerance, not an exact match.
 * Fonts are hinted differently on different machines and a rounding
 * difference in a shadow should not fail a build, so a small number of
 * differing pixels is allowed and anything more is not.
 *
 * The baselines live in `screenshots/baseline` and are meant to be
 * committed, so that a reviewer can see what changed in the pictures along
 * with the code. They are produced by running this file with
 * `--update-snapshots`.
 */

const BASELINE_DIRECTORY = 'screenshots/baseline'

/** The pages worth watching. */
const PAGES = [
  ['landing', '/#/'],
  ['dashboard', '/#/dashboard'],
  ['lesson-transformer', '/#/lessons/generative-transformer'],
  ['lesson-alignment', '/#/lessons/alignment-dpo'],
  ['playground-transformer', '/#/playground?lab=transformer'],
  ['playground-sampling', '/#/playground?lab=sampling'],
  ['practice', '/#/practice'],
  ['glossary', '/#/glossary'],
  ['math', '/#/math'],
  ['sources', '/#/sources'],
] as const

test.describe('the course still looks the way it did', () => {
  test('the pages match their baselines', async ({ page, browserName }) => {
    test.skip(
      browserName !== 'chromium',
      'the pictures are compared in one engine, so that a difference in font rendering is not a failure',
    )

    const baselines = existsSync(BASELINE_DIRECTORY)
      ? new Set(readdirSync(BASELINE_DIRECTORY).filter((name) => name.endsWith('.png')))
      : new Set<string>()

    /*
      The baselines are committed, so there is normally something to compare
      against. When there is not, Playwright writes what it finds and says so,
      which is the right thing to do the first time the file is run — and
      `--update-snapshots` is how they are refreshed on purpose.
    */
    void baselines

    for (const [name, path] of PAGES) {
      await page.goto(path)
      await page.waitForTimeout(700)
      /*
        The entrance animation has to finish before the picture is taken, or
        every page would differ from its baseline. The reading-progress bar is
        a scroll-driven animation and never finishes, so it is excluded by
        looking for the animations that run on the clock.
      */
      await page.evaluate(async () => {
        const running = document.getAnimations().filter((animation) => {
          if (animation.playState !== 'running') return false
          const timeline = animation.timeline as { constructor?: { name?: string } } | null
          return timeline?.constructor?.name !== 'ScrollTimeline'
        })
        await Promise.allSettled(running.map((animation) => animation.finished))
      })
      await page.waitForTimeout(150)

      await expect(page).toHaveScreenshot(`${name}.png`, {
        maxDiffPixelRatio: 0.02,
        animations: 'disabled',
        fullPage: false,
      })
    }
  })
})
