import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Static check for a whole class of defect that is easy to introduce and hard
 * to spot: LaTeX written inside a *template literal*.
 *
 * A JSX string attribute keeps its backslashes — `tex="\beta"` reaches KaTeX
 * as `\beta`. A template literal does not: `tex={`\beta`}` reaches KaTeX as
 * `beta`, because `\b` is a backspace escape in JavaScript. Some escapes are
 * silent (`\t`, `\n`, `\r`, `\b`, `\f`, `\v`, `\0`) and some simply drop the
 * backslash (`\q`, `\m`, `\l`, …). KaTeX does not complain: it renders the
 * remaining letters as ordinary math, so the formula is quietly wrong and the
 * mistake is invisible in review.
 *
 * The rule this file enforces: inside a template literal, every LaTeX
 * backslash must be doubled.
 */
const SOURCE_ROOTS = ['src/content', 'src/components', 'src/pages']

function collectSourceFiles(root: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(root)) {
    const full = join(root, entry)
    if (statSync(full).isDirectory()) {
      files.push(...collectSourceFiles(full))
    } else if (/\.tsx$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
      files.push(full)
    }
  }
  return files
}

interface Finding {
  file: string
  line: number
  text: string
}

/**
 * Walk the body of a template literal (the text between the backticks) and
 * report every backslash that JavaScript would consume as an escape sequence.
 */
function scanTemplateBody(path: string, source: string, body: string, offset: number): Finding[] {
  const findings: Finding[] = []
  let i = 0
  while (i < body.length) {
    const char = body[i]
    if (char !== '\\') {
      i += 1
      continue
    }
    const next = body[i + 1]
    if (next === undefined) break
    if (next === '\\') {
      // A doubled backslash survives as one literal backslash. This is correct.
      i += 2
      continue
    }
    if (next === '`' || next === '$') {
      // Escaped backtick or escaped dollar: also intentional.
      i += 2
      continue
    }
    if (/[a-zA-Z0-9]/.test(next)) {
      const absolute = offset + i
      const line = source.slice(0, absolute).split('\n').length
      findings.push({
        file: path,
        line,
        text: source.slice(Math.max(0, absolute - 40), absolute + 40).replace(/\s+/g, ' '),
      })
    }
    i += 2
  }
  return findings
}

/**
 * Find every `tex={` attribute whose value is a template literal, and scan it.
 * JSX string attributes (`tex="..."`) are safe and are deliberately skipped.
 */
function findTemplateTexProps(path: string, source: string): Finding[] {
  const findings: Finding[] = []
  const marker = 'tex={'
  let searchFrom = 0
  for (;;) {
    const start = source.indexOf(marker, searchFrom)
    if (start === -1) break
    const bodyStart = start + marker.length
    if (source[bodyStart] !== '`') {
      searchFrom = bodyStart
      continue
    }
    // Walk the template literal, honouring escapes and `${}` interpolations.
    let i = bodyStart + 1
    while (i < source.length) {
      const char = source[i]
      if (char === '\\') {
        i += 2
        continue
      }
      if (char === '`') break
      if (char === '$' && source[i + 1] === '{') {
        // Skip a balanced interpolation.
        let depth = 1
        i += 2
        while (i < source.length && depth > 0) {
          if (source[i] === '{') depth += 1
          else if (source[i] === '}') depth -= 1
          i += 1
        }
        continue
      }
      i += 1
    }
    const body = source.slice(bodyStart + 1, i)
    findings.push(...scanTemplateBody(path, source, body, bodyStart + 1))
    searchFrom = i + 1
  }
  return findings
}

describe('LaTeX in template literals', () => {
  const findings: Finding[] = []

  for (const root of SOURCE_ROOTS) {
    for (const file of collectSourceFiles(root)) {
      findings.push(...findTemplateTexProps(file, readFileSync(file, 'utf8')))
    }
  }

  it('never lets JavaScript eat a LaTeX backslash', () => {
    const report = findings.map((f) => `${f.file}:${f.line}  ${f.text}`).join('\n')
    expect(findings, `LaTeX escapes consumed by JavaScript:\n${report}`).toEqual([])
  })
})
