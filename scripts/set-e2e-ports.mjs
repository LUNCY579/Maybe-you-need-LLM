import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Give every browser suite its own port.
 *
 * The suites all serve their production build on the same port, so two of
 * them running at once fight over it — and the loser silently tests the
 * winner's application. A distinct port per course removes the whole class
 * of problem, and lets the suites be run in parallel.
 *
 *   node scripts/set-e2e-ports.mjs
 */

const PORTS = {
  hub: 4181,
  'diffusion-lab': 4173,
  'evaluation-lab': 4174,
  'rlhf-lab': 4175,
  'lm-from-scratch': 4176,
  'mech-interp-lab': 4177,
  'data-lab': 4178,
  'scaling-lab': 4179,
  'systems-lab': 4180,
  'rl-foundations': 4182,
  'retrieval-lab': 4183,
  'agent-bench-lab': 4184,
  'safety-lab': 4185,
  'multimodal-lab': 4186,
}

for (const [directory, port] of Object.entries(PORTS)) {
  const path = join(process.cwd(), directory, 'playwright.config.ts')
  let source
  try {
    source = await readFile(path, 'utf8')
  } catch {
    console.log(`${directory}: no Playwright configuration`)
    continue
  }
  const before = source
  source = source
    .replace(/baseURL: 'http:\/\/127\.0\.0\.1:\d+'/, `baseURL: 'http://127.0.0.1:${port}'`)
    .replace(/url: 'http:\/\/127\.0\.0\.1:\d+'/, `url: 'http://127.0.0.1:${port}'`)
    .replace(/--port \d+/, `--port ${port}`)
  if (source === before) {
    console.log(`${directory}: the port is already ${port}`)
    continue
  }
  await writeFile(path, source, 'utf8')
  console.log(`${directory}: the browser suite now runs on ${port}`)
}
