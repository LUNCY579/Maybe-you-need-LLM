import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { join } from 'node:path'

/**
 * Render the compiled textbooks as a reading edition.
 *
 * The Markdown textbooks carry their mathematics as LaTeX, which most
 * viewers leave as source. This script renders every book as a styled,
 * self-contained HTML page — KaTeX renders the math, a table of contents
 * navigates the book, and one index page ties the collection together.
 *
 *   node scripts/render-textbook-html.mjs
 */

const root = process.cwd()
const booksDir = join(root, 'textbooks')
const outDir = join(booksDir, 'html')
/*
 * The hub ships the reading edition: its public directory is copied into the
 * built site, so a learner can reach every textbook from the hub. Both copies
 * are written by this one script, so they cannot drift apart.
 */
const hubPublic = join(root, 'hub', 'public', 'textbooks')

/* --------------------------------------------------------- inline formatting */

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Inline markdown → HTML, with code spans and math protected from emphasis. */
function inline(text) {
  const stash = []
  const keep = (html) => {
    stash.push(html)
    return `\u0000${stash.length - 1}\u0000`
  }
  let s = escapeHtml(text)
  // Inline code first, so its contents are never formatted.
  s = s.replace(/`([^`]+)`/g, (_, code) => keep(`<code>${code}</code>`))
  // Math keeps its delimiters for KaTeX's auto-render to pick up in the DOM.
  s = s.replace(/\$\$([^$]+)\$\$/g, (_, tex) => keep(`<span class="math-display">$${tex}$</span>`))
  s = s.replace(/(?<!\\)\$([^$\n]+?)\$(?!\d)/g, (_, tex) => keep(`<span class="math-inline">$${tex}$</span>`))
  // Links, then emphasis, on what is left.
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label, href) => keep(`<a href="${href}">${label}</a>`))
  s = s.replace(/\*\*([^*]+)\*\*/g, (_, body) => `<strong>${body}</strong>`)
  s = s.replace(/\*([^*]+)\*/g, (_, body) => `<em>${body}</em>`)
  return s.replace(/\u0000(\d+)\u0000/g, (_, index) => stash[Number(index)])
}

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/* -------------------------------------------------------------- block parsing */

function renderBlocks(markdown) {
  const lines = markdown.split('\n')
  const out = []
  let index = 0

  const isTableRow = (line) => /^\s*\|/.test(line)

  while (index < lines.length) {
    const line = lines[index]

    if (line.trim() === '') {
      index++
      continue
    }

    // Fenced code.
    if (line.startsWith('```')) {
      const language = line.slice(3).trim()
      const body = []
      index++
      while (index < lines.length && !lines[index].startsWith('```')) {
        body.push(lines[index])
        index++
      }
      index++
      out.push(
        `<pre><code${language ? ` class="language-${escapeHtml(language)}"` : ''}>${escapeHtml(body.join('\n'))}</code></pre>`,
      )
      continue
    }

    // Horizontal rule.
    if (/^-{3,}$/.test(line.trim())) {
      out.push('<hr>')
      index++
      continue
    }

    // Heading.
    const heading = line.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      const level = heading[1].length
      const text = heading[2].trim()
      out.push(`<h${level} id="${slug(text)}">${inline(text)}</h${level}>`)
      index++
      continue
    }

    // Pipe table: a header row, a delimiter row, then body rows.
    if (isTableRow(line) && index + 1 < lines.length && /^\s*\|[\s:|-]+\|?\s*$/.test(lines[index + 1])) {
      const cells = (row) => row.trim().replace(/^\||\|$/g, '').split('|').map((cell) => cell.trim())
      const headers = cells(line)
      index += 2
      const rows = []
      while (index < lines.length && isTableRow(lines[index])) {
        rows.push(cells(lines[index]))
        index++
      }
      out.push(
        `<table><thead><tr>${headers.map((cell) => `<th>${inline(cell)}</th>`).join('')}</tr></thead><tbody>${rows
          .map((row) => `<tr>${row.map((cell) => `<td>${inline(cell)}</td>`).join('')}</tr>`)
          .join('')}</tbody></table>`,
      )
      continue
    }

    // Blockquote: consecutive lines that start with `>`.
    if (line.startsWith('>')) {
      const body = []
      while (index < lines.length && (lines[index].startsWith('>') || (body.length > 0 && lines[index].trim() !== '' && !/^(?:[-#>`]|\d+\.|\|)/.test(lines[index])))) {
        body.push(lines[index].replace(/^>\s?/, ''))
        index++
      }
      out.push(`<blockquote>${renderBlocks(body.join('\n'))}</blockquote>`)
      continue
    }

    // Lists, with two-space continuation lines folded into their item.
    const bullet = line.match(/^(\s*)- (.*)$/)
    const ordered = line.match(/^(\s*)\d+\. (.*)$/)
    if (bullet || ordered) {
      const orderedList = Boolean(ordered)
      const indent = (bullet ?? ordered)[1].length
      const items = []
      while (index < lines.length) {
        const current = lines[index]
        const match = orderedList
          ? current.match(/^(\s*)\d+\. (.*)$/)
          : current.match(/^(\s*)- (.*)$/)
        if (match && match[1].length === indent) {
          items.push(match[2])
          index++
        } else if (/^\s{2,}\S/.test(current) && items.length > 0) {
          items[items.length - 1] += ` ${current.trim()}`
          index++
        } else {
          break
        }
      }
      const tag = orderedList ? 'ol' : 'ul'
      out.push(`<${tag}>${items.map((item) => `<li>${inline(item)}</li>`).join('')}</${tag}>`)
      continue
    }

    // Paragraph: everything up to a blank line.
    const paragraph = []
    while (index < lines.length && lines[index].trim() !== '' && !/^(?:#{1,6}\s|```|>|- |\d+\. \S|\||-{3,})/.test(lines[index])) {
      paragraph.push(lines[index])
      index++
    }
    if (paragraph.length > 0) {
      out.push(`<p>${inline(paragraph.join(' '))}</p>`)
    } else {
      // A line the block scanner could not classify; keep it as text.
      out.push(`<p>${inline(line)}</p>`)
      index++
    }
  }
  return out.join('\n')
}

/* ------------------------------------------------------------------ the pages */

const STYLE = `
:root {
  --bg: #fbfbfa; --surface: #ffffff; --text: #16181d; --muted: #5d636e;
  --border: rgba(22,24,29,.12); --accent: #4c5fd7; --teal: #1f8f86;
  --radius: .85rem; --measure: 72ch;
}
:root[data-theme='dark'] {
  --bg: #0e1014; --surface: #16191f; --text: #e8eaee; --muted: #9aa1ad;
  --border: rgba(232,234,238,.14); --accent: #97a4ff; --teal: #63d6c8;
}
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--text); line-height: 1.65;
  font-family: ui-sans-serif, system-ui, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
a { color: var(--accent); }
header.book { position: sticky; top: 0; z-index: 5; backdrop-filter: blur(10px);
  background: color-mix(in srgb, var(--bg) 88%, transparent); border-bottom: 1px solid var(--border); }
header.book .inner { max-width: 78rem; margin: 0 auto; padding: .7rem 1.25rem;
  display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
header.book a.home { color: var(--text); text-decoration: none; font-weight: 600; }
header.book .tools { display: flex; gap: .75rem; align-items: center; font-size: .9rem; }
header.book button { font: inherit; color: var(--text); background: var(--surface);
  border: 1px solid var(--border); border-radius: 999px; padding: .25rem .8rem; cursor: pointer; }
.layout { max-width: 78rem; margin: 0 auto; padding: 2rem 1.25rem 4rem;
  display: grid; grid-template-columns: 16rem minmax(0,1fr); gap: 2.5rem; }
nav.toc { position: sticky; top: 4rem; align-self: start; max-height: calc(100vh - 5rem);
  overflow: auto; font-size: .88rem; }
nav.toc a { display: block; color: var(--muted); text-decoration: none; padding: .18rem 0; }
nav.toc a.l2 { padding-left: .9rem; }
nav.toc a:hover { color: var(--accent); }
main.book { max-width: var(--measure); }
main.book h1 { font-size: 2rem; letter-spacing: -.02em; line-height: 1.2; }
main.book h2 { font-size: 1.4rem; margin-top: 2.4rem; border-top: 1px solid var(--border); padding-top: 1.4rem; }
main.book h3 { font-size: 1.15rem; margin-top: 1.8rem; }
main.book h4 { font-size: 1rem; margin-top: 1.4rem; }
main.book h5 { font-size: .95rem; margin-top: 1.2rem; color: var(--muted); }
blockquote { margin: 1rem 0; padding: .6rem 1rem; border-left: 3px solid var(--teal);
  background: var(--surface); border-radius: 0 var(--radius) var(--radius) 0; }
blockquote p { margin: .3rem 0; }
code { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: .88em;
  background: color-mix(in srgb, var(--text) 7%, transparent); padding: .1em .35em; border-radius: .3rem; }
pre code { display: block; padding: .8rem 1rem; overflow-x: auto; }
table { border-collapse: collapse; margin: 1rem 0; width: 100%; font-size: .92rem; }
th, td { border: 1px solid var(--border); padding: .4rem .65rem; text-align: left; vertical-align: top; }
th { background: var(--surface); }
.math-display { display: block; overflow-x: auto; padding: .4rem 0; }
footer.pager { max-width: 78rem; margin: 0 auto; padding: 1rem 1.25rem 3rem;
  display: flex; justify-content: space-between; gap: 1rem; font-size: .95rem; }
.index-grid { display: grid; gap: 1rem; grid-template-columns: repeat(auto-fill, minmax(19rem, 1fr)); }
.card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
  padding: 1.1rem 1.2rem; box-shadow: 0 1px 2px rgba(0,0,0,.05), 0 8px 24px rgba(0,0,0,.05); }
.card h3 { margin: 0 0 .3rem; font-size: 1.05rem; }
.card p { margin: .2rem 0; color: var(--muted); font-size: .85rem; }
@media (max-width: 60rem) { .layout { grid-template-columns: 1fr; } nav.toc { display: none; } }
`

const KATEX_HEAD = `
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
<script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
<script defer>
window.addEventListener('DOMContentLoaded', function () {
  if (window.renderMathInElement) {
    renderMathInElement(document.body, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '$', right: '$', display: false },
      ],
      throwOnError: false,
    })
  }
})
</script>
`

const THEME_SCRIPT = `
<script>
(function () {
  try {
    var stored = localStorage.getItem('llm-materials:theme')
    var dark = stored === 'dark' || (stored === null && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  } catch (e) { document.documentElement.dataset.theme = 'light' }
})()
</script>
`

function themeToggle() {
  return `<button type="button" onclick="var d=document.documentElement;d.dataset.theme=d.dataset.theme==='dark'?'light':'dark';try{localStorage.setItem('llm-materials:theme',d.dataset.theme)}catch(e){}">Theme</button>`
}

function page(title, body, extraHead) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
${THEME_SCRIPT}${KATEX_HEAD}${extraHead ?? ''}
<style>${STYLE}</style>
</head>
<body>
${body}
</body>
</html>
`
}

function bookPage(course, body, toc, previous, next) {
  const tocHtml = toc
    .map((entry) => `<a class="${entry.level > 2 ? 'l2' : ''}" href="#${entry.slug}">${escapeHtml(entry.text)}</a>`)
    .join('\n')
  const pager = `
<footer class="pager">
  <div>${previous ? `<a href="${previous.file}">← ${escapeHtml(previous.title)}</a>` : ''}</div>
  <div>${next ? `<a href="${next.file}">${escapeHtml(next.title)} →</a>` : ''}</div>
</footer>`
  return page(
    `${course.title} — textbook`,
    `<header class="book"><div class="inner">
  <a class="home" href="index.html">LLM Materials — textbooks</a>
  <div class="tools"><button type="button" onclick="window.print()">Print</button>${themeToggle()}</div>
</div></header>
<div class="layout">
  <nav class="toc" aria-label="Table of contents">${tocHtml}</nav>
  <main class="book">${body}</main>
</div>${pager}`,
  )
}

/* ----------------------------------------------------------------------- main */

const bookFiles = (await readdir(booksDir)).filter((name) => name.endsWith('.md') && name !== 'README.md').sort()
await mkdir(outDir, { recursive: true })
await mkdir(hubPublic, { recursive: true })

// Course order follows the reading path of the collection, which the index lists.
const indexMarkdown = await readFile(join(booksDir, 'README.md'), 'utf8')
const order = [...indexMarkdown.matchAll(/\]\(([\w-]+)\.md\)/g)].map((match) => match[1])

const courses = []
for (const file of bookFiles) {
  const id = file.replace(/\.md$/, '')
  const markdown = await readFile(join(booksDir, file), 'utf8')
  const title = markdown.match(/^# (.+)$/m)?.[1] ?? id
  courses.push({ id, title, markdown })
}
courses.sort((a, b) => {
  const ia = order.indexOf(a.id)
  const ib = order.indexOf(b.id)
  return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib)
})

for (const course of courses) {
  const position = courses.indexOf(course)
  const previous = position > 0 ? { file: `${courses[position - 1].id}.html`, title: courses[position - 1].title } : null
  const next =
    position < courses.length - 1 ? { file: `${courses[position + 1].id}.html`, title: courses[position + 1].title } : null

  const body = renderBlocks(course.markdown)
  // The table of contents follows the sections and lessons of the book.
  const toc = [...course.markdown.matchAll(/^(#{2,3})\s+(.*)$/gm)].map((match) => ({
    level: match[1].length,
    text: match[2].replace(/\*+/g, ''),
    slug: slug(match[2].replace(/\*+/g, '')),
  }))
  await writeFile(join(outDir, `${course.id}.html`), bookPage(course, body, toc, previous, next))
  await writeFile(join(hubPublic, `${course.id}.html`), bookPage(course, body, toc, previous, next))
  process.stdout.write(`${course.id}.html `)
}

// The index page.
const cards = courses
  .map((course) => {
    const words = course.markdown.split(/\s+/).length
    const lessons = (course.markdown.match(/^### /gm) ?? []).length
    const source = course.markdown.match(/\*\*Source:\*\* (.+)$/m)?.[1] ?? ''
    return `<a class="card" href="${course.id}.html" style="text-decoration:none;color:inherit">
  <h3>${escapeHtml(course.title)}</h3>
  <p>${escapeHtml(source)}</p>
  <p>${lessons} lessons · ${words.toLocaleString()} words</p>
</a>`
  })
  .join('\n')

const indexBody = `<header class="book"><div class="inner">
  <a class="home" href="../">LLM Materials</a>
  <div class="tools">${themeToggle()}</div>
</div></header>
<div style="max-width:72rem;margin:0 auto;padding:2.5rem 1.25rem 4rem">
  <h1>The collection, as textbooks</h1>
  <p style="max-width:60ch;color:var(--muted)">Every course, compiled end-to-end into one readable volume — the lesson prose, the mathematics with derivations, the practice questions with their answer key, the laboratory work, and the glossary. The math renders with KaTeX; the courses themselves remain the primary artefact, because the laboratories run in the browser.</p>
  <div class="index-grid">${cards}</div>
</div>`
await writeFile(join(outDir, 'index.html'), page('LLM Materials — textbooks', indexBody))
await writeFile(join(hubPublic, 'index.html'), page('LLM Materials — textbooks', indexBody))
process.stdout.write(`\n${courses.length} books rendered to textbooks/html/\n`)
