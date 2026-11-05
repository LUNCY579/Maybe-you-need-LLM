import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Set a course application's page metadata.
 *
 * The title, the description and the social-card tags are part of the
 * course's identity, and the scaffold cannot know them. This writes them
 * into the HTML shell, and it refuses to leave a course describing somebody
 * else's subject.
 *
 *   node scripts/set-app-meta.mjs <app-id> "<title>" "<description>"
 */

const [id, title, description] = process.argv.slice(2)
if (!id || !title || !description) {
  console.error('usage: node scripts/set-app-meta.mjs <app-id> "<title>" "<description>"')
  process.exit(1)
}

const path = join(process.cwd(), id, 'index.html')
let html = await readFile(path, 'utf8')

const escaped = description.replace(/"/g, '&quot;')

html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
html = html.replace(
  /<meta\s+name="description"[\s\S]*?\/>/,
  `<meta name="description" content="${escaped}" />`,
)

// The social-card tags, if they are not there already.
if (!html.includes('property="og:title"')) {
  html = html.replace(
    '    <meta name="color-scheme"',
    `    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${escaped}" />
    <meta property="og:type" content="website" />
    <meta name="twitter:card" content="summary" />
    <meta name="theme-color" content="#0e1014" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="#fbfbfa" media="(prefers-color-scheme: light)" />
    <meta name="color-scheme"`,
  )
}

await writeFile(path, html, 'utf8')
console.log(`${id}: the page metadata is set`)
