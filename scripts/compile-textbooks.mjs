import { mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { tmpdir } from 'node:os'
import esbuild from 'esbuild'
import { renderToStaticMarkup } from 'react-dom/server'
import { createElement } from 'react'

/**
 * Compile an end-to-end textbook for every course in the collection.
 *
 * The courses teach through interactive applications, so their material is
 * spread across TypeScript modules (curricula, quizzes, formula references,
 * glossaries) and, in three courses, React lesson bodies. This script reads
 * all of it, renders it as print-quality Markdown, and writes one textbook
 * per course into `textbooks/`, plus an index.
 *
 * The output is a reading copy, not a replacement for the applications: the
 * laboratories are interactive, and the compiled text says where each one
 * lives rather than embedding it.
 *
 *   node scripts/compile-textbooks.mjs          # compile all 16 courses
 *   node scripts/compile-textbooks.mjs rlhf-lab # compile one course
 */

const root = process.cwd()
const outputDir = join(root, 'textbooks')
// The build directory must live inside the repository: the bundles import
// react as an external, and that only resolves against the workspace's own
// node_modules. A second copy of React would break the server render.
const buildDir = join(root, 'textbooks', '.build')

/** Courses rendered from the shared workspace convention (curriculum + quiz + formulas + glossary). */
const WORKSPACE_COURSES = [
  'diffusion-lab',
  'evaluation-lab',
  'rlhf-lab',
  'lm-from-scratch',
  'mech-interp-lab',
  'data-lab',
  'scaling-lab',
  'systems-lab',
  'rl-foundations',
  'retrieval-lab',
  'agent-bench-lab',
  'safety-lab',
  'multimodal-lab',
]

const manifest = JSON.parse(await readFile(join(root, 'references', 'manifest.json'), 'utf8'))
const appById = new Map(manifest.apps.map((app) => [app.id, app]))
const sourcesByApp = new Map()
for (const source of manifest.sources) {
  const list = sourcesByApp.get(source.app) ?? []
  list.push(source)
  sourcesByApp.set(source.app, list)
}

/* ------------------------------------------------------------------ helpers */

function slug(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

function bullets(items) {
  return (items ?? []).map((item) => `- ${item}`).join('\n')
}

function numbered(items) {
  return (items ?? []).map((item, index) => `${index + 1}. ${item}`).join('\n')
}

function pipeTable(headers, rows) {
  const line = (cells) => `| ${cells.map((cell) => String(cell).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ')} |`
  return [line(headers), line(headers.map(() => '---')), ...rows.map(line)].join('\n')
}

function anchor(text) {
  return `#${slug(text)}`
}

/** The human answer to one assessment question, whatever shape it takes. */
function answerFor(question) {
  if (question.options && 'correctIndex' in question) {
    return question.options[question.correctIndex]
  }
  if (question.options && 'answerIndex' in question) {
    return question.options[question.answerIndex]
  }
  if (question.options && typeof question.correct === 'number') {
    return question.options[question.correct]
  }
  if (question.options && question.correctOptionId) {
    return question.options.find((option) => option.id === question.correctOptionId)?.label
  }
  if (question.options && question.correctOptionIds) {
    return question.options
      .filter((option) => question.correctOptionIds.includes(option.id))
      .map((option) => option.label)
      .join(' + ')
  }
  if ('truth' in question) {
    return question.truth ? 'True' : 'False'
  }
  if ('answer' in question && question.answer !== undefined) {
    const tolerance = question.tolerance ? ` ± ${question.tolerance}` : ''
    return `${question.answer}${tolerance}${question.unit ? ` ${question.unit}` : ''}`
  }
  if (question.acceptedAnswers) {
    return question.acceptedAnswers.join(' or ')
  }
  return undefined
}

function renderQuestion(question) {
  const lines = []
  const difficulty = question.difficulty ? ` *(${question.difficulty})*` : ''
  const kind = question.kind ? ` — ${question.kind}` : ''
  lines.push(`**Q. ${question.prompt}${kind}${difficulty}**`)
  if (question.tex) {
    lines.push('', `$$${question.tex}$$`)
  }
  if (question.options) {
    const labels = question.options.map((option) => (typeof option === 'string' ? option : option.label))
    const correct = answerFor(question)
    const correctSet = question.correctOptionIds
      ? new Set(
          question.options
            .filter((option) => typeof option !== 'string' && question.correctOptionIds.includes(option.id))
            .map((option) => option.label),
        )
      : null
    lines.push(
      '',
      ...labels.map((label) =>
        correctSet
          ? correctSet.has(label)
            ? `- ✓ **${label}**`
            : `- ${label}`
          : label === correct
            ? `- ✓ **${label}**`
            : `- ${label}`,
      ),
    )
    const feedback = question.options.find((option) => typeof option !== 'string' && option.label === correct)?.feedback
    if (feedback) lines.push('', `> ${feedback}`)
  } else {
    // A question without options states its answer directly: a number with its
    // tolerance, a truth value, or the accepted phrasings.
    const correct = answerFor(question)
    if (correct !== undefined) lines.push('', `> **Answer:** ${correct}`)
  }
  if (question.tryIt) {
    lines.push('', `*Try it:* ${question.tryIt}`)
  }
  if (question.explanation) {
    lines.push('', `> **Why:** ${question.explanation}`)
  }
  return lines.join('\n')
}

/* ------------------------------------------------- module loading via esbuild */

/** A KaTeX stand-in: capture the LaTeX instead of rendering HTML we would have to undo. */
const katexShim = join(buildDir, 'katex-shim.cjs')
await mkdir(buildDir, { recursive: true })
await writeFile(
  katexShim,
  `function renderToString(tex, opts = {}) {
  const encoded = encodeURIComponent(tex)
  return opts.displayMode
    ? '<span data-katex="' + encoded + '" data-display="true">' + tex + '</span>'
    : '<span data-katex="' + encoded + '">' + tex + '</span>'
}
module.exports = { renderToString, default: { renderToString } }
`,
)

/** Bundle TypeScript/TSX modules into one self-contained ESM file and import it. */
async function bundleAndImport(entryAbsPath, outName) {
  const outfile = join(buildDir, `${outName}.mjs`)
  await esbuild.build({
    entryPoints: [entryAbsPath],
    outfile,
    bundle: true,
    format: 'esm',
    platform: 'node',
    target: 'node18',
    jsx: 'automatic',
    alias: { katex: katexShim },
    // The server render in this script owns React; the bundle must use the
    // same copy or hooks fail with the invalid-hook-call error.
    external: ['react', 'react/*', 'react-dom', 'react-dom/*'],
    // CJS dependencies inside the bundle require() react at runtime, which
    // ESM output cannot do natively; hand the bundle a working require.
    banner: {
      js: `import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);`,
    },
    logLevel: 'silent',
    sourcemap: false,
    legalComments: 'none',
  })
  return import(`${pathToFileURL(outfile).href}?t=${Math.random()}`)
}

/** Bundle several files under named namespaces, importing them all in one go. */
async function bundleNamed(entries, outName) {
  const barrel = join(buildDir, `${outName}-barrel.ts`)
  await writeFile(
    barrel,
    entries.map(([name, absPath]) => `export * as ${name} from ${JSON.stringify(absPath.replace(/\\/g, '/'))}`).join('\n'),
  )
  return bundleAndImport(barrel, outName)
}

/* ------------------------------------------------ HTML → Markdown for the LFL bodies */

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&apos;': "'" }

function decodeEntities(text) {
  return text.replace(/&(?:amp|lt|gt|quot|#39|apos);/g, (entity) => ENTITIES[entity] ?? entity)
}

/**
 * Convert server-rendered lesson HTML into Markdown.
 *
 * The lesson bodies are React components, so the compiler renders them to
 * static markup and then reads the markup back as text. Block structure is
 * recovered from the tags; the KaTeX shim lets formulas pass through as
 * LaTeX instead of rendered glyphs.
 */
function htmlToMarkdown(html) {
  let s = html
  // Formulas captured by the shim, back to LaTeX.
  s = s.replace(/<span data-katex="([^"]*)" data-display="true">[\s\S]*?<\/span>/g, (_, enc) => `\n\n$$${decodeURIComponent(enc)}$$\n\n`)
  s = s.replace(/<span data-katex="([^"]*)">([\s\S]*?)<\/span>/g, (_, enc) => `$${decodeURIComponent(enc)}$`)
  // The lesson chrome separates a kicker span from its title with a margin,
  // not a space; print needs the space back.
  s = s.replace(/<\/span>(?=\S)/g, '</span> ')
  // Concept terms are disclosure buttons carrying the term itself; keep those
  // as bold terms. Every other button is pure interface, and the form labels
  // of the embedded laboratories are control captions — neither is prose.
  s = s.replace(/<button[^>]*aria-expanded[^>]*>([\s\S]*?)<\/button>/g, (_, body) => `**${body.trim()}**`)
  s = s.replace(/<button[\s\S]*?<\/button>/g, '')
  s = s.replace(/<label[\s\S]*?<\/label>/g, '')
  // Tables.
  s = s.replace(/<table[\s\S]*?<\/table>/g, (table) => {
    const rows = [...table.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)].map((row) =>
      [...row[1].matchAll(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/g)].map((cell) => cell[1].replace(/<[^>]+>/g, '').trim()),
    )
    if (rows.length === 0) return ''
    return '\n\n' + pipeTable(rows[0], rows.slice(1)) + '\n\n'
  })
  // Code.
  s = s.replace(/<pre[\s\S]*?<\/pre>/g, (pre) => {
    const body = pre.replace(/<[^>]+>/g, '')
    return `\n\n\`\`\`\n${decodeEntities(body).trim()}\n\`\`\`\n\n`
  })
  s = s.replace(/<code[^>]*>([\s\S]*?)<\/code>/g, (_, body) => `\`${decodeEntities(body.trim())}\``)
  // Emphasis. The \b keeps <button>/<blockquote>/<input> from matching as
  // <b>, and <img>/<ins> from matching as <i>.
  s = s.replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/g, (_, body) => `**${body.trim()}**`)
  s = s.replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/g, (_, body) => `*${body.trim()}*`)
  // Block structure.
  s = s.replace(/<h1[^>]*>/g, '\n\n#### ').replace(/<\/h1>/g, '\n')
  s = s.replace(/<h2[^>]*>/g, '\n\n#### ').replace(/<\/h2>/g, '\n')
  s = s.replace(/<h3[^>]*>/g, '\n\n**').replace(/<\/h3>/g, '**\n')
  s = s.replace(/<h4[^>]*>/g, '\n\n**').replace(/<\/h4>/g, '**\n')
  s = s.replace(/<blockquote[^>]*>/g, '\n\n> ').replace(/<\/blockquote>/g, '\n')
  s = s.replace(/<li[^>]*>/g, '\n- ').replace(/<\/li>/g, '')
  s = s.replace(/<(?:p|div|section|ul|ol|figure|figcaption|summary|details|dl|dt|dd|hr)[^>]*>/g, '\n')
  s = s.replace(/<\/(?:p|div|section|ul|ol|figure|figcaption|summary|details|dl|dt|dd)>/g, '\n')
  s = s.replace(/<br\s*\/?>/g, '\n')
  // Strip every remaining tag and decode.
  s = s.replace(/<[^>]+>/g, '')
  s = decodeEntities(s)
  // Collapse the whitespace the tags left behind.
  s = s.replace(/[ \t]+\n/g, '\n')
  s = s.replace(/\n{3,}/g, '\n\n')
  s = s.replace(/^- (?=[-*] )/gm, '')
  return s.trim()
}

/* --------------------------------------------------------- front matter bits */

function courseFrontMatter(appId) {
  const app = appById.get(appId)
  const sources = sourcesByApp.get(appId) ?? []
  const lines = [`# ${app?.title ?? appId}`, '']
  const note = app?.note ?? app?.description ?? app?.summary
  if (note) lines.push(`*${note}*`, '')
  for (const source of sources) {
    const authors = source.authors?.length ? source.authors.join(', ') : ''
    lines.push(
      '',
      `**Source:** ${source.title}${authors ? ` — ${authors}` : ''}${source.year ? ` (${source.year})` : ''}`,
      '',
      `**Licence:** ${source.license ?? 'see the repository'}`,
    )
    if (source.gapClosed) lines.push('', `**Why this course exists:** ${source.gapClosed}`)
  }
  lines.push('', '---', '')
  return lines.join('\n')
}

function moduleSection(module, index) {
  const lines = []
  lines.push(`## ${index + 1}. ${module.title}`, '')
  if (module.tagline) lines.push(`*${module.tagline}*`, '')
  if (module.summary) lines.push(module.summary, '')
  if (module.pages) lines.push(`*Printed pages:* ${module.pages}`, '')
  if (module.outcomes?.length) {
    lines.push('**Learning outcomes**', '', bullets(module.outcomes), '')
  }
  if (module.misconceptions?.length) {
    lines.push('**Common misconceptions**', '')
    for (const entry of module.misconceptions) {
      lines.push(`- ❌ ${entry.mistake}`, `  ✅ ${entry.correction}`)
    }
    lines.push('')
  }
  return lines
}

function renderSources(sourceRefs) {
  if (!sourceRefs?.length) return []
  const lines = ['**Where this came from**', '']
  for (const ref of sourceRefs) {
    const page = ref.page !== undefined ? ` · p. ${ref.page}` : ''
    lines.push(`- §${ref.section ?? ''} ${ref.title ?? ref.label ?? ''}${page}${ref.note ? ` — ${ref.note}` : ''}`)
  }
  lines.push('')
  return lines
}

function renderFurtherReading(entries) {
  if (!entries?.length) return []
  const lines = ['**Further reading**', '']
  for (const entry of entries) {
    const href = typeof entry === 'string' ? undefined : entry.href
    const label = typeof entry === 'string' ? entry : entry.label
    const note = typeof entry === 'string' ? '' : entry.note
    lines.push(`- ${href ? `[${label}](${href})` : label}${note ? ` — ${note}` : ''}`)
  }
  lines.push('')
  return lines
}

/* ------------------------------------------------------------ shared sections */

function renderPractice(questions) {
  if (!questions?.length) return []
  const lines = ['#### Practice', '']
  for (const question of questions) {
    lines.push(renderQuestion(question), '')
  }
  return lines
}

function renderGlossaryTerms(terms) {
  if (!terms?.length) return []
  const lines = ['**The words this lesson uses**', '']
  for (const term of terms) {
    const definition = term.short ?? term.definition ?? ''
    lines.push(`- **${term.term}** — ${definition}`)
  }
  lines.push('')
  return lines
}

/**
 * The laboratories appendix: every screen the course ships, with what it
 * delivers. The laboratories run in the application — the book says what
 * each one computes and where it lives, rather than pretending to be one.
 */
function renderLaboratories(heading, labs) {
  if (!labs?.length) return []
  const lines = [`## ${heading}`, '']
  lines.push(
    'Every laboratory the course ships. Each one runs in the application and computes everything it shows in the browser; this appendix is the catalogue of what exists and what it is for.',
    '',
  )
  for (const lab of labs) {
    lines.push(`### ${lab.name ?? lab.title}`, '')
    if (lab.blurb) lines.push(`*${lab.blurb}*`, '')
    if (lab.description) lines.push(lab.description, '')
    if (lab.runtime) lines.push(`*Runtime:* ${lab.runtime}`, '')
    if (lab.route) lines.push(`*Route:* \`${lab.route}\``, '')
    if (lab.concepts?.length) lines.push(`*Concepts:* ${lab.concepts.join(', ')}`, '')
    if (lab.sourceChapters?.length) lines.push(`*Textbook chapters:* ${lab.sourceChapters.join(', ')}`, '')
    if (lab.delivers?.length) lines.push('**Delivers:**', '', bullets(lab.delivers), '')
  }
  return lines
}

/* ------------------------------------------------- workspace-course renderer */

const FORMULA_EXPORTS = ['FORMULAS', 'EQUATIONS', 'FORMULA_BANK']
const QUIZ_EXPORTS = ['QUIZ', 'QUIZ_BANK', 'QUESTIONS']
const GLOSSARY_EXPORTS = ['GLOSSARY', 'GLOSSARY_TERMS', 'GLOSSARY_ENTRIES']

function firstExport(module, names) {
  for (const name of names) {
    if (module[name]) return module[name]
  }
  return undefined
}

async function renderWorkspaceCourse(appId) {
  const base = join(root, appId, 'src', 'content')
  const curriculum = await bundleAndImport(join(base, 'curriculum.ts'), `${appId}-curriculum`)
  const [formulasMod, quizMod, glossaryMod, labsMod] = await Promise.all([
    existsSync(join(base, 'formulas.ts'))
      ? bundleAndImport(join(base, 'formulas.ts'), `${appId}-formulas`)
      : Promise.resolve({}),
    existsSync(join(base, 'quiz.ts')) ? bundleAndImport(join(base, 'quiz.ts'), `${appId}-quiz`) : Promise.resolve({}),
    existsSync(join(base, 'glossary.ts'))
      ? bundleAndImport(join(base, 'glossary.ts'), `${appId}-glossary`)
      : Promise.resolve({}),
    existsSync(join(base, 'labs.ts')) ? bundleAndImport(join(base, 'labs.ts'), `${appId}-labs`) : Promise.resolve({}),
  ])

  const modules = curriculum.MODULES ?? []
  const lessons = curriculum.LESSONS ?? []
  const formulas = firstExport(formulasMod, FORMULA_EXPORTS) ?? []
  const questions = firstExport(quizMod, QUIZ_EXPORTS) ?? []
  const glossary = firstExport(glossaryMod, GLOSSARY_EXPORTS) ?? []
  const labs = firstExport(labsMod, ['LABS', 'LAB_REGISTRY', 'LAB_DEFINITIONS']) ?? []
  const formulaById = new Map(formulas.map((entry) => [entry.id, entry]))
  const questionById = new Map(questions.map((entry) => [entry.id, entry]))
  const termById = new Map(glossary.map((entry) => [entry.id, entry]))
  const moduleById = new Map(modules.map((module) => [module.id, module]))

  const lines = [courseFrontMatter(appId)]

  // Table of contents.
  lines.push('## Contents', '')
  modules.forEach((module, index) => {
    lines.push(`- [${index + 1}. ${module.title}](${anchor(`${index + 1}. ${module.title}`)})`)
    for (const lesson of lessons.filter((lesson) => lesson.moduleId === module.id)) {
      lines.push(`  - [Lesson ${lesson.number}. ${lesson.title}](${anchor(`lesson ${lesson.number}. ${lesson.title}`)})`)
    }
  })
  if (glossary.length) lines.push(`- [Appendix A — Glossary](${anchor('Appendix A — Glossary')})`)
  if (labs.length) lines.push(`- [Appendix B — The laboratories](${anchor('Appendix B — The laboratories')})`)
  if (sourcesByApp.get(appId)?.length) lines.push(`- [Appendix C — Sources](${anchor('Appendix C — Sources')})`)
  lines.push('')

  // Modules and lessons.
  for (const module of modules) {
    const moduleIndex = modules.indexOf(module)
    lines.push(...moduleSection(module, moduleIndex))
    for (const lesson of lessons.filter((lesson) => lesson.moduleId === module.id)) {
      lines.push(`### Lesson ${lesson.number}. ${lesson.title}`, '')
      if (lesson.subtitle) lines.push(`*${lesson.subtitle}*`, '')
      lines.push(`*Estimated study time:* ${lesson.minutes} minutes`, '')
      if (lesson.objectives?.length) lines.push('**What you will learn**', '', bullets(lesson.objectives), '')
      if (lesson.keyIdeas?.length) lines.push('**The ideas**', '', bullets(lesson.keyIdeas), '')

      if (lesson.formulaIds?.length) {
        lines.push('#### The mathematics', '')
        for (const formulaId of lesson.formulaIds) {
          const formula = formulaById.get(formulaId)
          if (!formula) continue
          lines.push(`**${formula.title}**`, '', `$$${formula.latex}$$`)
          if (formula.meaning) lines.push('', `*${formula.meaning}*`)
          if (formula.symbols?.length) {
            lines.push('', 'Symbols:', '', bullets(formula.symbols.map((symbol) => `\`${symbol.symbol}\` — ${symbol.name}${symbol.note ? ` (${symbol.note})` : ''}`)))
          }
          if (formula.assumptions?.length) lines.push('', '**Assumptions:**', '', bullets(formula.assumptions))
          if (formula.derivation?.length) lines.push('', '**Derivation:**', '', numbered(formula.derivation))
          if (formula.example) {
            lines.push('', `**Worked example.** ${formula.example.given ?? ''} → **${formula.example.result}**${formula.example.note ? ` (${formula.example.note})` : ''}`)
          }
          lines.push('')
        }
      }

      const lessonQuestions = (lesson.quizIds ?? []).map((id) => questionById.get(id)).filter(Boolean)
      lines.push(...renderPractice(lessonQuestions))

      if (lesson.interactive) {
        lines.push(
          '#### Go and do it',
          '',
          `${lesson.interactive.description} Open **${lesson.interactive.title}** in the ${appId} application.`,
          '',
        )
      }

      lines.push(...renderSources(lesson.sourceRefs))
      lines.push(...renderFurtherReading(lesson.furtherReading))
      lines.push(
        ...renderGlossaryTerms(
          (lesson.glossaryTerms ?? []).map((id) => termById.get(id)).filter(Boolean),
        ),
      )
      if (lesson.prerequisites?.length) {
        const titles = lesson.prerequisites.map((id) => lessons.find((lesson) => lesson.id === id)?.title ?? id)
        lines.push(`*Read first:* ${titles.join(', ')}`, '')
      }
    }
  }

  // Appendix A: glossary.
  if (glossary.length) {
    lines.push(`## Appendix A — Glossary`, '')
    for (const term of glossary) {
      lines.push(`**${term.term}** — ${term.short ?? ''}`, '')
      if (term.long) lines.push(term.long, '')
      if (term.example) lines.push(`*Example:* ${term.example.question} → ${term.example.answer}`, '')
      if (term.attribution) lines.push(`*${term.attribution.label}*`, '')
    }
  }

  // Appendix B: the laboratories.
  lines.push(...renderLaboratories('Appendix B — The laboratories', labs))

  // Appendix C: sources.
  const courseSources = sourcesByApp.get(appId) ?? []
  if (courseSources.length) {
    lines.push(`## Appendix C — Sources`, '')
    for (const source of courseSources) {
      lines.push(
        `- **${source.title}**${source.authors?.length ? ` — ${source.authors.join(', ')}` : ''}${source.year ? ` (${source.year})` : ''}${source.venue ? `, ${source.venue}` : ''}. Licence: ${source.license ?? 'see the repository'}.`,
      )
      if (source.gapClosed) lines.push(`  ${source.gapClosed}`)
    }
    lines.push('')
  }

  return { markdown: lines.join('\n'), stats: { modules: modules.length, lessons: lessons.length, questions: questions.length, formulas: formulas.length, glossary: glossary.length, labs: labs.length } }
}

/* ----------------------------------------------------------- LFL renderer */

const LFL_LESSON_FILE_RE = /'([\w-]+)': \(\) => import\('\.\/([\w-]+)'\)\.then\(\(m\) => \(\{ default: m\.(\w+) \}\)\)/g

async function renderLflCourse() {
  const appId = 'llm-foundations-lab'
  const base = join(root, appId, 'src', 'content')
  const [curriculum, quizMod, glossaryMod, labsMod] = await Promise.all([
    bundleAndImport(join(base, 'curriculum.ts'), `${appId}-curriculum`),
    bundleAndImport(join(base, 'quiz.ts'), `${appId}-quiz`),
    bundleAndImport(join(base, 'glossary.ts'), `${appId}-glossary`),
    bundleAndImport(join(base, 'labs.ts'), `${appId}-labs`),
  ])

  const modules = curriculum.MODULES ?? []
  const lessons = curriculum.LESSONS ?? []
  const questions = quizMod.QUIZ_BANK ?? []
  const glossary = glossaryMod.GLOSSARY ?? []
  const questionById = new Map(questions.map((entry) => [entry.id, entry]))
  const termById = new Map(glossary.map((entry) => [entry.id, entry]))
  const moduleById = new Map(modules.map((module) => [module.id, module]))

  // Parse the lesson registry to bind each lesson id to its React component.
  const registrySource = await readFile(join(base, 'lessons', 'registry.ts'), 'utf8')
  const bindings = []
  for (const match of registrySource.matchAll(LFL_LESSON_FILE_RE)) {
    bindings.push({ lessonId: match[1], file: match[2], exportName: match[3] })
  }
  const files = [...new Set(bindings.map((binding) => binding.file))]
  const lessonBodies = await bundleNamed(
    files.map((file, index) => [`m${index}`, join(base, 'lessons', `${file}.tsx`)]),
    `${appId}-lessons`,
  )
  const fileIndex = new Map(files.map((file, index) => [file, `m${index}`]))

  const lines = [courseFrontMatter(appId)]
  lines.push('## Contents', '')
  modules.forEach((module, index) => {
    lines.push(`- [${index + 1}. ${module.title}](${anchor(`${index + 1}. ${module.title}`)})`)
    for (const lesson of lessons.filter((lesson) => lesson.moduleId === module.id)) {
      lines.push(`  - [Lesson ${lesson.number}. ${lesson.title}](${anchor(`lesson ${lesson.number}. ${lesson.title}`)})`)
    }
  })
  lines.push(`- [Appendix A — Glossary](${anchor('Appendix A — Glossary')})`)
  lines.push(`- [Appendix B — The laboratories](${anchor('Appendix B — The laboratories')})`)
  lines.push('')

  let renderedBodies = 0
  const bodyFailures = []
  for (const module of modules) {
    lines.push(...moduleSection(module, modules.indexOf(module)))
    for (const lesson of lessons.filter((lesson) => lesson.moduleId === module.id)) {
      lines.push(`### Lesson ${lesson.number}. ${lesson.title}`, '')
      if (lesson.subtitle) lines.push(`*${lesson.subtitle}*`, '')
      lines.push(`*Estimated study time:* ${lesson.minutes} minutes`, '')
      if (lesson.objectives?.length) lines.push('**What you will learn**', '', bullets(lesson.objectives), '')

      const binding = bindings.find((entry) => entry.lessonId === lesson.id)
      if (binding) {
        const component = lessonBodies[fileIndex.get(binding.file)]?.[binding.exportName]
        if (component) {
          try {
            const html = renderToStaticMarkup(createElement(component, { lesson }))
            if (process.env.BOOK_DEBUG_HTML) {
              await writeFile(join(buildDir, `lesson-${lesson.id}.html`), html)
            }
            lines.push(htmlToMarkdown(html), '')
            renderedBodies++
          } catch (error) {
            bodyFailures.push(`${lesson.id}: ${error instanceof Error ? error.message.split('\n')[0] : error}`)
            lines.push(`*The interactive lesson body could not be rendered to print; open the application.*`, '')
          }
        }
      }

      if (lesson.keyIdeas?.length) lines.push('**The ideas**', '', bullets(lesson.keyIdeas), '')
      const lessonQuestions = (lesson.quizIds ?? []).map((id) => questionById.get(id)).filter(Boolean)
      lines.push(...renderPractice(lessonQuestions))
      if (lesson.interactive) {
        lines.push(
          '#### Go and do it',
          '',
          `${lesson.interactive.description} Open **${lesson.interactive.title}** in the ${appId} application.`,
          '',
        )
      }
      lines.push(...renderSources(lesson.sourceRefs))
      lines.push(...renderFurtherReading(lesson.furtherReading))
      lines.push(...renderGlossaryTerms((lesson.glossaryTerms ?? []).map((id) => termById.get(id)).filter(Boolean)))
      if (lesson.prerequisites?.length) {
        const titles = lesson.prerequisites.map((id) => lessons.find((entry) => entry.id === id)?.title ?? id)
        lines.push(`*Read first:* ${titles.join(', ')}`, '')
      }
    }
  }

  lines.push('## Appendix A — Glossary', '')
  for (const term of glossary) {
    lines.push(`**${term.term}** — ${term.short ?? ''}`, '')
    if (term.definition) lines.push(term.definition, '')
  }

  lines.push(...renderLaboratories('Appendix B — The laboratories', labsMod.LABS ?? []))

  return {
    markdown: lines.join('\n'),
    stats: {
      modules: modules.length,
      lessons: lessons.length,
      bodies: renderedBodies,
      bodyFailures: bodyFailures.length,
      questions: questions.length,
      glossary: glossary.length,
      labs: (labsMod.LABS ?? []).length,
    },
    bodyFailures,
  }
}

/* ------------------------------------------------------- agentic renderer */

function agenticBlock(block) {
  switch (block.kind) {
    case 'prose':
      return [block.markdown, '']
    case 'list':
      return [(block.ordered ? numbered(block.items) : bullets(block.items)), '']
    case 'formula':
      return [`$$${block.latex}$$`, block.caption ? `*${block.caption}*` : '', '']
    case 'diagram':
      return [`> **Diagram — ${block.diagram}**: ${block.caption}`, '']
    case 'code':
      return ['```' + block.language, block.code, '```', block.caption ? `*${block.caption}*` : '', '']
    case 'callout':
      return [`> **${block.title}** (${block.tone})`, '>', `> ${block.markdown.replace(/\n/g, '\n> ')}`, '']
    case 'table':
      return [pipeTable(block.headers, block.rows), `*${block.caption}*`, '']
    case 'example': {
      const lines = [`**${block.title}**`, '']
      for (const step of block.steps) lines.push(`- **${step.label}** — ${step.detail}`)
      lines.push('', `> ${block.takeaway}`, '')
      return lines
    }
    case 'checkpoint':
      return [`**Check yourself:** ${block.question}`, '', `> **Answer:** ${block.answer}`, '']
    case 'predict': {
      const question = block.question
      const lines = [`**Predict first:** ${question.prompt}`, '']
      if (question.options) lines.push('', bullets(question.options))
      lines.push('', `> **Answer:** ${question.options?.[question.correct]} — ${question.explanation}`, '')
      return lines
    }
    case 'lab-link':
      return [`> **Laboratory — ${block.title}**: ${block.description}`, '']
    case 'demo':
      return [`> **Demonstration — ${block.title}**: ${block.intro}`, '']
    default:
      return []
  }
}

async function renderAgenticCourse() {
  const appId = 'agentic-ai-academy'
  const base = join(root, appId, 'src', 'content')
  const [book, lessonsMod, glossaryMod, referencesMod, labsMod, labQuestionsMod] = await Promise.all([
    bundleAndImport(join(base, 'book.ts'), `${appId}-book`),
    bundleAndImport(join(base, 'lessons', 'index.ts'), `${appId}-lessons`),
    bundleAndImport(join(base, 'glossary.ts'), `${appId}-glossary`),
    existsSync(join(base, 'references.ts'))
      ? bundleAndImport(join(base, 'references.ts'), `${appId}-references`)
      : Promise.resolve({}),
    existsSync(join(base, 'labs.ts')) ? bundleAndImport(join(base, 'labs.ts'), `${appId}-labs`) : Promise.resolve({}),
    existsSync(join(base, 'labQuestions.ts'))
      ? bundleAndImport(join(base, 'labQuestions.ts'), `${appId}-lab-questions`)
      : Promise.resolve({}),
  ])

  const parts = book.PARTS ?? []
  const chapters = book.CHAPTERS ?? []
  const lessons = lessonsMod.LESSONS ?? lessonsMod.ALL_LESSONS ?? []
  const glossary = glossaryMod.GLOSSARY ?? glossaryMod.GLOSSARY_ENTRIES ?? []
  const references = referencesMod.REFERENCES ?? referencesMod.READING ?? []
  const referenceById = new Map((references ?? []).map((entry) => [entry.id, entry]))
  const chapterByNumber = new Map(chapters.map((chapter) => [chapter.number, chapter]))

  const lines = [courseFrontMatter(appId)]
  lines.push('## Contents', '')
  for (const part of parts) {
    const partLessons = lessons.filter((lesson) => lesson.part === part.id)
    lines.push(`- [${part.title}](${anchor(part.title)}) (${partLessons.length} lessons)`)
    for (const chapterNumber of part.chapters ?? []) {
      const chapter = chapterByNumber.get(chapterNumber)
      if (chapter) lines.push(`  - Chapter ${chapter.number}: ${chapter.title}`)
    }
  }
  lines.push(`- [Appendix A — Glossary](${anchor('Appendix A — Glossary')})`)
  lines.push(`- [Appendix B — The laboratories](${anchor('Appendix B — The laboratories')})`)
  lines.push(`- [Appendix C — Laboratory practice](${anchor('Appendix C — Laboratory practice')})`)
  lines.push('')

  for (const part of parts) {
    lines.push(`## ${part.title}`, '')
    const partLessons = lessons
      .filter((lesson) => lesson.part === part.id)
      .sort((a, b) => a.order - b.order)
    for (const lesson of partLessons) {
      lines.push(`### ${lesson.title}`, '')
      if (lesson.summary) lines.push(`*${lesson.summary}*`, '')
      lines.push(
        `*Estimated study time:* ${lesson.minutes} minutes · difficulty: ${lesson.difficulty} · textbook chapters: ${(lesson.provenance?.textbookChapters ?? []).join(', ') || '—'}`,
        '',
      )
      if (lesson.objectives?.length) {
        lines.push('**What you will learn**', '', bullets(lesson.objectives.map((objective) => objective.text ?? objective)), '')
      }
      if (lesson.prerequisites?.length) {
        const titles = lesson.prerequisites.map((id) => lessons.find((entry) => entry.slug === id || entry.id === id)?.title ?? id)
        lines.push(`*Read first:* ${titles.join(', ')}`, '')
      }
      if (lesson.keywords?.length) lines.push(`*Keywords:* ${lesson.keywords.join(', ')}`, '')

      for (const section of lesson.sections ?? []) {
        lines.push(`#### ${section.title}`, '')
        for (const block of section.blocks ?? []) lines.push(...agenticBlock(block))
      }

      if (lesson.quiz?.length) lines.push(...renderPractice(lesson.quiz))
      if (lesson.advancedSections?.length) {
        lines.push('#### Advanced track', '')
        for (const section of lesson.advancedSections) {
          lines.push(`##### ${section.title}`, '')
          for (const block of section.blocks ?? []) lines.push(...agenticBlock(block))
        }
      }
      if (lesson.advancedQuiz?.length) {
        lines.push('##### Advanced practice', '')
        for (const question of lesson.advancedQuiz) lines.push(renderQuestion(question), '')
      }
      if (lesson.furtherReading?.length) {
        lines.push('**Further reading**', '')
        for (const entry of lesson.furtherReading) {
          const reference = referenceById.get(entry.referenceId)
          const authors = Array.isArray(reference?.authors) ? reference.authors.join(', ') : reference?.authors
          lines.push(`- ${reference?.title ?? entry.referenceId}${authors ? ` — ${authors}` : ''} — ${entry.note}`)
        }
        lines.push('')
      }
    }
  }

  lines.push('## Appendix A — Glossary', '')
  for (const term of glossary) {
    lines.push(`**${term.term}** — ${term.definition ?? ''}`, '')
    if (term.source?.label) lines.push(`*Source:* ${term.source.label}`, '')
    if (term.related?.length) lines.push(`*Related:* ${term.related.join(', ')}`, '')
  }

  const agenticLabs = labsMod.LABS ?? []
  lines.push(...renderLaboratories('Appendix B — The laboratories', agenticLabs))

  const labQuestions = labQuestionsMod.ALL_LAB_QUESTIONS ?? []
  if (labQuestions.length) {
    lines.push('## Appendix C — Laboratory practice', '')
    lines.push(
      'The laboratories carry their own diagnostic questions. Each one names the control to change, so the reader can check the prediction against the running laboratory rather than against the text.',
      '',
    )
    for (const question of labQuestions) lines.push(renderQuestion(question), '')
  }

  return {
    markdown: lines.join('\n'),
    stats: {
      parts: parts.length,
      lessons: lessons.length,
      questions:
        lessons.reduce((sum, lesson) => sum + (lesson.quiz?.length ?? 0) + (lesson.advancedQuiz?.length ?? 0), 0) +
        labQuestions.length,
      glossary: glossary.length,
      labs: agenticLabs.length,
    },
  }
}

/* --------------------------------------------------------- DLTE renderer */

function dlteBlock(block) {
  switch (block.kind) {
    case 'p':
      return [block.text, '']
    case 'eq':
      return [`$$${block.tex}$$`, block.caption ? `*${block.caption}*` : '', '']
    case 'list':
      return [bullets(block.items), '']
    case 'callout':
      return [`> **${block.title}** (${block.tone})`, '>', `> ${block.text.replace(/\n/g, '\n> ')}`, '']
    case 'ref':
      return [`> 📖 ${block.label} — ${block.note}`, '']
    case 'figure':
      return [`> **Figure:** ${block.figure}`, '']
    default:
      return []
  }
}

async function renderDlteCourse() {
  const appId = 'deep-learning-theory-explorer'
  const base = join(root, appId, 'src', 'content')
  const [lessonsMod, equationsMod, quizzesMod, referencesMod, labsMod] = await Promise.all([
    bundleAndImport(join(base, 'lessons.ts'), `${appId}-lessons`),
    bundleAndImport(join(base, 'equations.ts'), `${appId}-equations`),
    bundleAndImport(join(base, 'quizzes.ts'), `${appId}-quizzes`),
    bundleAndImport(join(base, 'references.ts'), `${appId}-references`),
    existsSync(join(base, 'labs.ts')) ? bundleAndImport(join(base, 'labs.ts'), `${appId}-labs`) : Promise.resolve({}),
  ])

  const lessons = lessonsMod.LESSONS ?? []
  const equations = equationsMod.EQUATIONS ?? []
  const quiz = quizzesMod.QUIZ ?? []
  const notation = referencesMod.NOTATION_GLOSSARY ?? []
  const questionsByLesson = new Map()
  for (const question of quiz) {
    const list = questionsByLesson.get(question.lessonId) ?? []
    list.push(question)
    questionsByLesson.set(question.lessonId, list)
  }

  const lines = [courseFrontMatter(appId)]
  lines.push('## Contents', '')
  for (const lesson of lessons) {
    lines.push(`- [Lesson ${lesson.order}. ${lesson.title}](${anchor(`lesson ${lesson.order}. ${lesson.title}`)}) *(${lesson.tier}, ${lesson.chapter})*`)
  }
  lines.push(`- [Appendix A — Equation reference](${anchor('Appendix A — Equation reference')})`)
  lines.push(`- [Appendix B — Notation](${anchor('Appendix B — Notation')})`)
  lines.push(`- [Appendix C — The laboratories](${anchor('Appendix C — The laboratories')})`)
  lines.push('')

  for (const lesson of lessons) {
    lines.push(`### Lesson ${lesson.order}. ${lesson.title}`, '')
    lines.push(`*${lesson.summary}*`, '')
    lines.push(`*Estimated study time:* ${lesson.minutes} minutes · tier: ${lesson.tier} · built on: ${lesson.chapter}`, '')
    if (lesson.objectives?.length) lines.push('**What you will learn**', '', bullets(lesson.objectives), '')
    if (lesson.prerequisites?.length) {
      const titles = lesson.prerequisites.map((id) => lessons.find((entry) => entry.id === id)?.title ?? id)
      lines.push(`*Read first:* ${titles.join(', ')}`, '')
    }
    for (const section of lesson.sections ?? []) {
      lines.push(`#### ${section.heading}`, '')
      for (const block of section.blocks ?? []) lines.push(...dlteBlock(block))
    }
    const questions = questionsByLesson.get(lesson.id) ?? []
    lines.push(...renderPractice(questions))
    if (lesson.exercises?.length) {
      lines.push('#### Exercises', '')
      for (const exercise of lesson.exercises) {
        lines.push(`**${exercise.prompt}** *(${exercise.kind})*`, '')
        if (exercise.hint) lines.push(`*Hint:* ${exercise.hint}`, '')
        lines.push(`> **Answer:** ${exercise.answer}`, '')
      }
    }
    if (lesson.experiment) {
      lines.push(`> **Laboratory:** ${lesson.experiment.note} (route: \`${lesson.experiment.route}\`)`, '')
      for (const extra of lesson.alsoExperiments ?? []) {
        lines.push(`> Also: ${extra.note} (route: \`${extra.route}\`)`, '')
      }
    }
    if (lesson.citations?.length) {
      lines.push('**Citations**', '')
      for (const citation of lesson.citations) lines.push(`- ${citation.label} — ${citation.note}`)
      lines.push('')
    }
  }

  lines.push('## Appendix A — Equation reference', '')
  for (const equation of equations) {
    lines.push(`**${equation.title}** (${equation.id})`, '', `$$${equation.tex}$$`)
    lines.push('', `*${equation.meaning}* — from ${equation.ref}`)
    if (equation.symbols?.length) {
      lines.push('', 'Symbols:', '', bullets(equation.symbols.map((symbol) => `\`${symbol.symbol}\` — ${symbol.meaning}`)))
    }
    if (equation.assumptions?.length) lines.push('', '**Assumptions:**', '', bullets(equation.assumptions))
    if (equation.derivation?.length) lines.push('', '**Derivation:**', '', numbered(equation.derivation))
    if (equation.example) {
      const inputs = equation.example.inputs?.map((input) => `${input.name} = ${input.value}`).join(', ') ?? ''
      lines.push('', `**Worked example.** ${inputs} → **${equation.example.result}**${equation.example.note ? ` (${equation.example.note})` : ''}`)
    }
    lines.push('')
  }

  if (notation.length) {
    lines.push('## Appendix B — Notation', '')
    lines.push(pipeTable(['Symbol', 'Name', 'Meaning'], notation.map((entry) => [entry.symbol, entry.name, entry.meaning])))
    lines.push('')
  }

  lines.push(...renderLaboratories('Appendix C — The laboratories', labsMod.LABS ?? []))

  return {
    markdown: lines.join('\n'),
    stats: { lessons: lessons.length, equations: equations.length, questions: quiz.length, labs: (labsMod.LABS ?? []).length },
  }
}

/* ------------------------------------------------------------------- main */

const stats = []
const failures = []

async function compile(appId) {
  process.stdout.write(`compiling ${appId}… `)
  const started = Date.now()
  try {
    let result
    if (appId === 'llm-foundations-lab') result = await renderLflCourse()
    else if (appId === 'agentic-ai-academy') result = await renderAgenticCourse()
    else if (appId === 'deep-learning-theory-explorer') result = await renderDlteCourse()
    else result = await renderWorkspaceCourse(appId)

    const file = join(outputDir, `${appId}.md`)
    await writeFile(file, result.markdown, 'utf8')
    const words = result.markdown.split(/\s+/).length
    stats.push({ appId, words, ...result.stats, ms: Date.now() - started })
    process.stdout.write(`done — ${result.stats.lessons ?? result.stats.parts} lessons, ${words.toLocaleString()} words\n`)
  } catch (error) {
    failures.push({ appId, error: error instanceof Error ? error.stack : String(error) })
    process.stdout.write(`FAILED\n${error instanceof Error ? error.message : error}\n`)
  }
}

await mkdir(outputDir, { recursive: true })

const targets = process.argv.slice(2)
const allAppIds = [...WORKSPACE_COURSES, 'llm-foundations-lab', 'agentic-ai-academy', 'deep-learning-theory-explorer']
const courseList = targets.length ? targets : allAppIds
for (const appId of courseList) {
  await compile(appId)
}

// The index.
const indexLines = [
  '# The collection, as textbooks',
  '',
  'Every course in this repository, compiled end-to-end into a single readable document: the full lesson prose, the mathematics with derivations, the practice questions with their answer key, the laboratory work, and the glossary.',
  '',
  'The textbooks are a *reading* copy. The courses themselves remain the primary artefact — the laboratories run in the browser and are what turn each lesson into skill. Use these to read on a train, print, or search the whole collection at once.',
  '',
  'The same books are also rendered as a navigable HTML edition with the mathematics drawn — `html/` — and a single complete edition in the order of the learning path: `complete.md` and `html/complete.html`. `npm run textbooks` produces all of them.',
  '',
  '| Course | Lessons | Words | Source |',
  '| --- | --- | --- | --- |',
]
for (const entry of stats) {
  const app = appById.get(entry.appId)
  const source = (sourcesByApp.get(entry.appId) ?? [])[0]
  indexLines.push(
    `| [${app?.title ?? entry.appId}](${entry.appId}.md) | ${entry.lessons ?? entry.parts ?? '—'} | ${entry.words.toLocaleString()} | ${source ? `${source.title} (${source.year})` : '—'} |`,
  )
}
if (failures.length) {
  indexLines.push('', '## Failed to compile', '')
  for (const failure of failures) indexLines.push(`- ${failure.appId}`)
}
await writeFile(join(outputDir, 'README.md'), indexLines.join('\n') + '\n', 'utf8')

// Clean the build directory — unless debugging, which needs the dumps.
if (!process.env.BOOK_DEBUG_HTML) {
  await rm(buildDir, { recursive: true, force: true })
}

process.stdout.write(`\n${stats.length} textbook(s) written to textbooks/`)
if (failures.length) {
  process.stdout.write(`; ${failures.length} failed`)
  process.exitCode = 1
}
process.stdout.write('\n')
