/**
 * Checks that every source cited on the "How settled is this?" page still
 * resolves.
 *
 * That page exists to say what the literature has done since the book was
 * written. A citation that has quietly stopped resolving would be the worst
 * kind of rot on the page where currency is the whole point, so the links are
 * checked rather than trusted.
 *
 * The check is a network request, so it is not part of `npm test`: a test
 * suite that fails when the network is down is a test suite that gets
 * ignored. It is a separate command, `npm run check:links`, that a person
 * runs when they touch the sources.
 *
 * It also reports a link pinned to a superseded revision of an arXiv paper,
 * because a pinned link keeps working after the paper has moved on. The
 * reader is sent to an older draft of a survey and believes it is the
 * current one.
 *
 *   node tools/checkLinks.mjs
 */

import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const statusFile = resolve(here, '..', 'src', 'content', 'status.ts')

const TIMEOUT_MS = 25_000
const CONCURRENCY = 6

const ARXIV_VERSION = /arxiv\.org\/(?:abs|pdf|html)\/([\d.]+v\d+)/g
const ARXIV_ID = /^\d{4}\.\d{4,5}$/

/** Pull the source list out of the TypeScript without importing it. */
function readSources(source) {
  const sources = []
  const block = /sources:\s*\[([\s\S]*?)\n\s{4}\],/g
  let match
  while ((match = block.exec(source)) !== null) {
    const entries = match[1]
    const entry = /label:\s*'([^']*)',\s*href:\s*'([^']*)',\s*note:\s*'([^']*)'/g
    let one
    while ((one = entry.exec(entries)) !== null) {
      sources.push({ label: one[1], href: one[2], note: one[3] })
    }
  }
  return sources
}

async function head(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; link-check)' },
    })
    return { status: response.status, finalUrl: response.url }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Ask a link whether it is there, more than once.
 *
 * A publisher that rate-limits a burst of requests will answer one of them
 * with an error, and a link that fails the first time but works the second is
 * not a broken link. A checker that reports those as broken is a checker whose
 * reports get ignored, so the answer has to be the last one rather than the
 * first.
 */
async function headWithRetries(url, attempts = 3) {
  let last
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const result = await head(url)
      if (result.status < 500) return result
      last = new Error(`HTTP ${result.status}`)
    } catch (error) {
      last = error
    }
    if (attempt < attempts) await new Promise((done) => setTimeout(done, 1500 * attempt))
  }
  throw last
}

/** The newest revision of an arXiv paper, or null if it cannot be read. */
async function latestArxivRevision(id) {
  const query = `http://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}&max_results=1`
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
  try {
    const response = await fetch(query, { signal: controller.signal })
    const xml = await response.text()
    const found = xml.match(/<id>http:\/\/arxiv\.org\/abs\/(.+?)<\/id>/)
    return found ? found[1] : null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function main() {
  const source = await readFile(statusFile, 'utf8')
  const sources = readSources(source)

  if (sources.length === 0) {
    console.error('No sources were found in src/content/status.ts.')
    process.exit(1)
  }

  console.log(`Checking ${sources.length} sources from src/content/status.ts\n`)

  const problems = []
  const queue = [...sources]

  const worker = async () => {
    for (;;) {
      const item = queue.shift()
      if (!item) return
      let result
      try {
        result = await headWithRetries(item.href)
      } catch (error) {
        const reason = error?.name === 'AbortError' ? 'timed out' : String(error?.message ?? error)
        problems.push({ item, reason })
        console.log(`  FAIL  ${item.href}\n        ${reason}`)
        continue
      }

      if (result.status >= 400) {
        problems.push({ item, reason: `HTTP ${result.status}` })
        console.log(`  FAIL  ${item.href}\n        HTTP ${result.status}`)
        continue
      }

      // A pinned arXiv link keeps working after the paper has been revised.
      // Report it rather than fail the run: the link is not broken, but the
      // reader is being sent to an old draft.
      const pinned = [...item.href.matchAll(ARXIV_VERSION)].map((m) => m[1])[0]
      if (pinned && ARXIV_ID.test(pinned.replace(/v\d+$/, ''))) {
        const latest = await latestArxivRevision(pinned.replace(/v\d+$/, ''))
        if (latest && latest !== pinned) {
          console.log(`  STALE ${item.href}\n        the current revision is ${latest}`)
          problems.push({ item, reason: `pinned to ${pinned}, current is ${latest}`, stale: true })
          continue
        }
      }

      console.log(`  ok    ${result.status}  ${item.href}`)
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, worker))

  const broken = problems.filter((p) => !p.stale)
  const stale = problems.filter((p) => p.stale)

  console.log('')
  console.log(`${sources.length - problems.length} of ${sources.length} sources are current.`)

  if (stale.length > 0) {
    console.log(`${stale.length} link(s) point to a superseded revision.`)
  }
  if (broken.length > 0) {
    console.log(`${broken.length} link(s) do not resolve.`)
    process.exit(1)
  }
  if (stale.length > 0) {
    process.exit(1)
  }

  // Every source resolved and was current, so the page may now claim to
  // have been checked on this date. The date is written here rather than
  // typed by hand, so it cannot claim a currency the check did not find.
  const today = new Date().toISOString().slice(0, 10)
  const current = await readFile(statusFile, 'utf8')
  const updated = current.replace(
    /export const STATUS_CHECKED_ON = '[\d-]+'/,
    `export const STATUS_CHECKED_ON = '${today}'`,
  )
  if (updated !== current) {
    await writeFile(statusFile, updated, 'utf8')
    console.log(`The sources were checked on ${today}, and the page now says so.`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
