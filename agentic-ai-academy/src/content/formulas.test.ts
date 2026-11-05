import { describe, expect, it } from 'vitest'
import katex from 'katex'
import { LESSONS } from './lessons'
import type { LessonBlock } from '../types/curriculum'

/**
 * The KaTeX options the lesson reader uses.
 *
 * `Formula` in `ui/Markdown.tsx` renders with `throwOnError: true` inside a
 * try/catch, so a broken expression degrades to a readable "Formula error:"
 * line instead of crashing the page. That is the right behaviour for a student
 * but the wrong one for the build: it hides the mistake. These tests take the
 * same options and let the throw happen, so an unparseable expression fails
 * here rather than quietly turning into an error box in the reader.
 */
const RENDERER_OPTIONS = { displayMode: true, throwOnError: true, strict: 'ignore' } as const

interface FormulaSite {
  /** Where the block lives, for the failure message. */
  location: string
  latex: string
}

function formulasIn(blocks: LessonBlock[]): string[] {
  return blocks.filter((block) => block.kind === 'formula').map((block) => block.latex)
}

/**
 * Every formula block in the course, core sections and advanced track alike.
 *
 * Both are read because the reader renders them through the same block
 * renderer: a formula added to the advanced track is a formula the student
 * will see.
 */
const FORMULAS: FormulaSite[] = LESSONS.flatMap((lesson) => [
  ...lesson.sections.flatMap((section) => formulasIn(section.blocks).map((latex) => ({ location: `${lesson.slug} → ${section.id}`, latex }))),
  ...(lesson.advancedSections ?? []).flatMap((section) =>
    formulasIn(section.blocks).map((latex) => ({ location: `${lesson.slug} → ${section.id} (advanced)`, latex })),
  ),
])

describe('lesson formulas', () => {
  it('has formulas to render', () => {
    // A course about planning budgets, memory scoring and RL objectives that
    // had lost all of its mathematics would be a silent regression, not a
    // passing test.
    expect(FORMULAS.length).toBeGreaterThanOrEqual(19)
  })

  it('holds a non-empty expression in every formula block', () => {
    for (const site of FORMULAS) {
      expect(site.latex.trim().length, `${site.location} is an empty formula`).toBeGreaterThan(1)
      // An expression wrapped in `$…$` or `$$…$$` renders as literal dollars:
      // the delimiters belong to the authoring format, not to KaTeX.
      expect(site.latex, `${site.location} wraps its LaTeX in dollar signs`).not.toContain('$')
    }
  })

  it('parses every formula with the options the reader uses', () => {
    const failures: string[] = []
    for (const site of FORMULAS) {
      try {
        katex.renderToString(site.latex, RENDERER_OPTIONS)
      } catch (error) {
        failures.push(`${site.location}: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    // Collected rather than asserted per case, so one run names every broken
    // formula instead of stopping at the first.
    expect(failures).toEqual([])
  })

  it('renders each formula to display markup, not to plain text', () => {
    for (const site of FORMULAS) {
      const html = katex.renderToString(site.latex, RENDERER_OPTIONS)
      expect(html, `${site.location} produced no KaTeX markup`).toContain('katex')
      expect(html, `${site.location} did not render in display mode`).toContain('katex-display')
    }
  })
})
