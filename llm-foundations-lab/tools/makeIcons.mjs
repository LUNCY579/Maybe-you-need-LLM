import { chromium } from '@playwright/test'
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Rasterise the application icon.
 *
 * The icon is drawn once, as an SVG, and the PNGs the manifest asks for are
 * rendered from it. Writing the drawing twice — once as SVG and once as
 * three sets of PNG coordinates — would mean the two could drift apart, and
 * an install icon that does not match the site is worse than no install icon.
 *
 * The maskable icon is the same drawing on a larger field, because a
 * maskable icon is cropped to whatever shape the platform uses, and the
 * artwork has to survive that crop.
 */

const here = dirname(fileURLToPath(import.meta.url))
const publicDirectory = join(here, '..', 'public')
const svg = readFileSync(join(publicDirectory, 'icon.svg'), 'utf8')

/** Draw the icon on a field, scaled into the middle of it. */
function page(width, height, padding) {
  const inner = width - padding * 2
  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; }
  body { width: ${width}px; height: ${height}px; background: #070b14; display: flex; align-items: center; justify-content: center; }
  svg { width: ${inner}px; height: ${inner}px; }
</style></head><body>${svg}</body></html>`
}

const browser = await chromium.launch()

async function render(file, width, height, padding) {
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  const p = await context.newPage()
  await p.setContent(page(width, height, padding))
  await p.waitForTimeout(120)
  const buffer = await p.screenshot({ omitBackground: false })
  writeFileSync(join(publicDirectory, file), buffer)
  console.log('wrote', file, `${width}x${height}`)
  await context.close()
}

await render('icon-192.png', 192, 192, 0)
await render('icon-512.png', 512, 512, 0)
// A maskable icon must keep its artwork inside the safe zone, which is the
// middle 80% of the image, so the drawing is inset.
await render('icon-maskable.png', 512, 512, 56)

await browser.close()
