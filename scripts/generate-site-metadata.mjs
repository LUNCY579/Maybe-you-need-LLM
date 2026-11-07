import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Write the deployment metadata for every site.
 *
 * A collection of static sites is only as good as its deployment metadata:
 * the sitemaps, the robots files and the web app manifests. They are
 * generated here from the manifest, so they cannot drift, and `--check` fails
 * if the files on disk are not what the script would write.
 *
 *   node scripts/generate-site-metadata.mjs [base-url]
 *   node scripts/generate-site-metadata.mjs --check
 *
 * The base URL is the address the collection is served from. The default is a
 * placeholder, and the script says so.
 */

const root = process.cwd()
// Only the arguments after the script itself: on a POSIX host argv[1] is the
// script's absolute path, which contains slashes and would be read as the base.
const args = process.argv.slice(2)
const check = args.includes('--check')
const baseArgument = args.find((argument) => !argument.startsWith('--') && argument.includes('/'))
const base = (baseArgument ?? 'https://llm-materials.example').replace(/\/$/, '')

if (!baseArgument) {
  console.warn(`using the placeholder base URL ${base}; pass the real one to generate the sitemaps`)
}

const manifest = JSON.parse(await readFile(join(root, 'references', 'manifest.json'), 'utf8'))

/** The sites: the hub, and every course in the manifest. */
const sites = [
  {
    id: 'hub',
    title: 'LLM Materials',
    description: 'A collection of interactive, source-mapped learning applications.',
  },
  ...manifest.apps.map((app) => ({
    id: app.id,
    title: app.title,
    description: `An interactive course from the LLM Materials collection, built on ${app.primarySource}.`,
  })),
]

const THEME = '#0e1014'
const THEME_LIGHT = '#fbfbfa'

let stale = 0

/** Write a file, or check that it is already what should be there. */
async function emit(path, content) {
  if (check) {
    let existing = null
    try {
      existing = await readFile(path, 'utf8')
    } catch {
      existing = null
    }
    if (existing !== content) {
      stale++
      console.error(`stale: ${path.replace(root + '\\', '')}`)
    }
    return
  }
  await writeFile(path, content, 'utf8')
}

/** Read a file, or return null. */
async function readOrNull(path) {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return null
  }
}

for (const site of sites) {
  const directory = join(root, site.id)
  const publicDirectory = join(directory, 'public')
  await mkdir(publicDirectory, { recursive: true })

  // The robots file.
  await emit(
    join(publicDirectory, 'robots.txt'),
    `User-agent: *\nAllow: /\n\nSitemap: ${base}/${site.id}/sitemap.xml\n`,
  )

  // The sitemap: the site root, and the hub's sections.
  const urls = [{ loc: `${base}/${site.id}/`, priority: '1.0' }]
  if (site.id === 'hub') {
    for (const section of ['courses', 'path', 'sources', 'glossary', 'progress']) {
      urls.push({ loc: `${base}/hub/#${section}`, priority: '0.6' })
    }
    // The compiled textbooks ship with the hub; a search engine should find them.
    const booksDirectory = join(publicDirectory, 'textbooks')
    if (existsSync(booksDirectory)) {
      for (const entry of readdirSync(booksDirectory).filter((name) => name.endsWith('.html')).sort()) {
        urls.push({ loc: `${base}/hub/textbooks/${entry}`, priority: '0.5' })
      }
    }
  }
  await emit(
    join(publicDirectory, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (url) =>
      `  <url>\n    <loc>${url.loc}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>${url.priority}</priority>\n  </url>`,
  )
  .join('\n')}
</urlset>
`,
  )

  // The web app manifest. A site that already has one keeps it: the older
  // courses ship their own, with their own names and themes, and the point of
  // this script is to fill the gaps rather than to impose a house style.
  const manifestPath = join(publicDirectory, 'manifest.webmanifest')
  if ((await readOrNull(manifestPath)) === null) {
    let icons = [{ src: './favicon.svg', sizes: 'any', type: 'image/svg+xml' }]
    if (
      (await readOrNull(join(publicDirectory, 'icon-192.png'))) !== null &&
      (await readOrNull(join(publicDirectory, 'icon-512.png'))) !== null
    ) {
      icons = [
        { src: './icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: './icon-512.png', sizes: '512x512', type: 'image/png' },
      ]
    }
    await emit(
      manifestPath,
      `${JSON.stringify(
        {
          name: site.id === 'hub' ? site.title : `${site.title} - LLM Materials`,
          short_name: site.title,
          description: site.description,
          start_url: './',
          scope: './',
          display: 'standalone',
          background_color: THEME,
          theme_color: THEME,
          lang: 'en',
          dir: 'ltr',
          icons,
        },
        null,
        2,
      )}\n`,
    )
  }

  // The links in the HTML shell.
  const indexPath = join(directory, 'index.html')
  let html = await readOrNull(indexPath)
  if (html === null) continue
  if (!html.includes('manifest.webmanifest')) {
    const links = `    <link rel="manifest" href="./manifest.webmanifest" />
    <meta name="theme-color" content="${THEME}" media="(prefers-color-scheme: dark)" />
    <meta name="theme-color" content="${THEME_LIGHT}" media="(prefers-color-scheme: light)" />\n`
    if (html.includes('    <link rel="icon"')) {
      html = html.replace('    <link rel="icon"', `${links}    <link rel="icon"`)
    } else {
      html = html.replace('    <meta charset="UTF-8" />', `    <meta charset="UTF-8" />\n${links}`)
    }
    await emit(indexPath, html)
  }
}

if (check) {
  if (stale > 0) {
    console.error(`${stale} file(s) are stale; run: node scripts/generate-site-metadata.mjs`)
    process.exit(1)
  }
  console.log(`the deployment metadata is in sync for ${sites.length} sites`)
} else {
  console.log(`wrote the deployment metadata for ${sites.length} sites`)
}
