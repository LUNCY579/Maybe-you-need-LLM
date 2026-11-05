import { readFile, writeFile } from 'node:fs/promises'

/**
 * Extract the numbered section headings of an arXiv paper from its ar5iv
 * rendering, so that a course can cite them exactly.
 */

const ids = process.argv.slice(2)
if (ids.length === 0) {
  console.error('usage: node scripts/extract-sections.mjs <arXiv id> [...]')
  process.exit(1)
}

for (const id of ids) {
  const response = await fetch(`https://ar5iv.labs.arxiv.org/html/${id}`, {
    headers: { 'User-Agent': 'llm-materials/1.0 (section map builder)' },
  })
  if (!response.ok) {
    console.log(`${id}: HTTP ${response.status}`)
    continue
  }
  const html = await response.text()

  const title = /<h1[^>]*class="ltx_title[^"]*"[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? ''
  const clean = (text) => text.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()

  const headings = []
  const pattern = /<h([2-6])[^>]*class="ltx_title[^"]*"[^>]*>([\s\S]*?)<\/h\1>/g
  let match
  while ((match = pattern.exec(html)) !== null) {
    const text = clean(match[2] ?? '')
    // Keep only the numbered headings and the unnumbered "Abstract".
    if (/^\d+(\.\d+)*\s/.test(text) || text === 'Abstract') {
      headings.push(text)
    }
  }

  console.log(`\n=== ${id} ===`)
  console.log('title:', clean(title))
  for (const heading of headings) {
    console.log(' ', heading)
  }
}
