/**
 * Capture the documentation screenshots.
 *
 * The screenshots in `docs/screenshots/` are referenced from the README and
 * the architecture notes, and they used to be taken by hand — which meant
 * they went stale silently, and a reader would see a picture of a course
 * that no longer existed. This script makes them reproducible: one command
 * captures every page in the state the course is actually in.
 *
 *     npm run screenshots
 *
 * It builds the site, serves the build, and drives it with Playwright. The
 * server is started and stopped by the script, so there is nothing to clean
 * up by hand.
 */
import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { chromium } from '@playwright/test'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'docs', 'screenshots')
const PORT = 4319
const BASE = `http://127.0.0.1:${PORT}`

const DESKTOP = { width: 1440, height: 1000 }
const MOBILE = { width: 414, height: 896 }

/**
 * Every shot: where to go, what to do first, and what to call the file.
 *
 * `act` runs after the page has settled; `shot` names the region to capture,
 * or leaves it out for the whole page.
 */
const SHOTS = [
  { name: 'landing', route: '/', act: null },
  { name: 'dashboard', route: '/dashboard', act: null },
  { name: 'curriculum', route: '/curriculum', act: null },
  { name: 'source-map', route: '/curriculum', act: async (page) => page.getByRole('tab', { name: /source map/i }).click() },
  { name: 'builder', route: '/builder', act: null },
  { name: 'builder-trace', route: '/builder', act: async (page) => page.getByRole('tab', { name: /^Trace/i }).click() },
  { name: 'lab-planning', route: '/labs/planning', act: null },
  { name: 'lab-memory', route: '/labs/memory', act: null },
  { name: 'lab-world-model', route: '/labs/world-model', act: null },
  { name: 'lab-multi-agent', route: '/labs/multi-agent', act: null },
  { name: 'assessments', route: '/assessments', act: null },
  { name: 'review', route: '/assessments', act: async (page) => page.getByRole('tab', { name: /review weak spots/i }).click() },
  { name: 'project', route: '/project', act: null },
  { name: 'glossary', route: '/glossary', act: null },
  { name: 'concept-map', route: '/glossary', act: async (page) => page.getByRole('tab', { name: /concept map/i }).click() },
  { name: 'lesson', route: '/lesson/what-agentic-llms-are', act: null },
  { name: 'predict', route: '/lesson/what-agentic-llms-are', act: async (page) => page.getByText('Predict first', { exact: true }).scrollIntoViewIfNeeded() },
  {
    name: 'lesson-glossary',
    route: '/lesson/what-agentic-llms-are',
    act: async (page) => {
      // The first glossary term in the prose, opened in place.
      const link = page.locator('button[title$="click for the definition"]').first()
      await link.scrollIntoViewIfNeeded()
      await link.click()
      await page.waitForTimeout(500)
    },
  },
  { name: 'lesson-tools', route: '/lesson/tools-and-context', act: null },
  {
    name: 'lesson-further-reading',
    route: '/lesson/interaction-styles-and-memory',
    act: async (page) => page.getByRole('tab', { name: /sources & provenance/i }).click(),
  },
  {
    name: 'lesson-synthesis',
    route: '/lesson/future-directions',
    act: async (page) => page.locator('#section-synthesis').scrollIntoViewIfNeeded(),
    shot: '#section-synthesis',
  },
  { name: 'demo-planning', route: '/lesson/multi-step-reasoning', act: null, shot: '#demo-planning' },
  { name: 'demo-memory', route: '/lesson/interaction-styles-and-memory', act: null, shot: '#demo-memory' },
  { name: 'context-window-demo', route: '/lesson/interaction-styles-and-memory', act: null, shot: '#demo-context-window' },
  { name: 'retrieval-demo', route: '/lesson/search-and-retrieval', act: null, shot: '#demo-retrieval' },
  { name: 'curation-demo', route: '/lesson/training-pipeline', act: null, shot: '#demo-curation' },
  { name: 'attention-demo', route: '/lesson/foundations-of-language-modeling', act: null, shot: '#demo-attention' },
  {
    name: 'patching-demo',
    route: '/lesson/advanced-architectures-and-interpretability',
    act: null,
    shot: '#demo-patching',
  },
  { name: 'escalation-demo', route: '/lesson/tools-and-context', act: null, shot: '#demo-escalation' },
  { name: 'valence-demo', route: '/lesson/behavior-strategy-multi-agent', act: null, shot: '#demo-valence' },
  {
    name: 'context-window-demo-compress',
    route: '/lesson/interaction-styles-and-memory',
    act: async (page) => {
      const demo = page.locator('#demo-context-window')
      await demo.getByRole('radio', { name: /compress everything/i }).check()
      await page.waitForTimeout(400)
    },
    shot: '#demo-context-window',
  },
  { name: 'demo-tool', route: '/lesson/tools-and-context', act: null, shot: '#demo-tool-selection' },
  { name: 'demo-dilemma', route: '/lesson/behavior-strategy-multi-agent', act: null, shot: '#demo-dilemma' },
  { name: 'references', route: '/references', act: null },
  { name: 'shortcuts', route: '/', act: async (page) => page.getByRole('button', { name: /shortcuts/i }).first().click() },
  { name: 'mobile-landing', route: '/', act: null, viewport: MOBILE },
  { name: 'mobile-builder', route: '/builder', act: null, viewport: MOBILE },
]

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

async function main() {
  await mkdir(outDir, { recursive: true })

  // The Vite CLI is resolved directly rather than through `npx`, so the script
  // does not depend on a shell and works the same on every platform.
  const vite = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js')
  const server = spawn(process.execPath, [vite, 'preview', '--port', String(PORT), '--strictPort', '--host', '127.0.0.1'], {
    cwd: root,
    stdio: 'ignore',
  })

  const browser = await chromium.launch()
  try {
    await waitForServer(BASE)

    for (const shot of SHOTS) {
      const context = await browser.newContext({ viewport: shot.viewport ?? DESKTOP, colorScheme: 'dark' })
      const page = await context.newPage()
      await page.goto(`${BASE}/#${shot.route}`)
      await page.waitForTimeout(900)
      if (shot.act) {
        try {
          await shot.act(page)
          await page.waitForTimeout(700)
        } catch (error) {
          console.error(`  ! ${shot.name}: ${error instanceof Error ? error.message.split('\n')[0] : error}`)
        }
      }
      const target = shot.shot ? page.locator(shot.shot) : page
      await target.screenshot({ path: path.join(outDir, `${shot.name}.png`) })
      console.log(`  captured ${shot.name}.png`)
      await context.close()
    }
  } finally {
    await browser.close()
    server.kill()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
