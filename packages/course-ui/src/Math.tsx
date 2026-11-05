import { useEffect, useMemo, useRef } from 'react'
import katex from 'katex'

/**
 * The maths renderer.
 *
 * Every formula in the course is a LaTeX string, rendered with KaTeX. The
 * component keeps the raw LaTeX available to assistive technology through a
 * visually hidden span, so a screen reader is offered the same information
 * the sighted reader gets from the typeset expression.
 */
export function Math({
  latex,
  display = false,
  label,
}: {
  latex: string
  display?: boolean
  /** An accessible description, used when the expression is not self-explanatory. */
  label?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)

  const html = useMemo(() => {
    try {
      return katex.renderToString(latex, {
        displayMode: display,
        throwOnError: false,
        output: 'html',
      })
    } catch {
      return `<code>${latex}</code>`
    }
  }, [latex, display])

  useEffect(() => {
    if (ref.current) ref.current.innerHTML = html
  }, [html])

  return (
    <span className="math">
      <span ref={ref} aria-hidden="true" />
      <span className="sr-only">{label ?? latex}</span>
    </span>
  )
}

/** A display-mode formula with an optional caption. */
export function MathBlock({ latex, caption, label }: { latex: string; caption?: string; label?: string }) {
  return (
    <figure className="math-block">
      <Math latex={latex} display label={label} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  )
}
