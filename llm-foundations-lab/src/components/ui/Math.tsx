import katex from 'katex'
import { useMemo, type ReactNode } from 'react'

/**
 * KaTeX rendering helpers.
 *
 * `throwOnError` is deliberately left at its strict default: a malformed formula
 * must fail loudly in development and in tests rather than render as red text.
 * The component tests render every page, so a typo in any formula is caught.
 */
export function InlineMath({ tex, className = '' }: { tex: string; className?: string }) {
  const html = useMemo(
    () => katex.renderToString(tex, { displayMode: false, throwOnError: true, strict: 'ignore' }),
    [tex],
  )
  return <span className={className} dangerouslySetInnerHTML={{ __html: html }} />
}

export function DisplayMath({
  tex,
  caption,
  className = '',
}: {
  tex: string
  caption?: ReactNode
  className?: string
}) {
  const html = useMemo(() => {
    const rendered = katex.renderToString(tex, {
      displayMode: true,
      throwOnError: true,
      strict: 'ignore',
    })
    /*
     * KaTeX emits a scrollable `<span class="katex-display">`. A scrollable
     * region has to be reachable from the keyboard (WCAG 2.1.1), so the span
     * gets a tab stop and a name. The replacement is done on the generated
     * markup rather than in the DOM afterwards, so it stays deterministic.
     */
    return rendered.replace(
      '<span class="katex-display">',
      '<span class="katex-display" tabindex="0" role="group" aria-label="Mathematical formula">',
    )
  }, [tex])
  return (
    <figure className={`my-3 overflow-x-auto rounded-xl border border-line bg-panel-2/50 px-4 py-3 ${className}`}>
      <div dangerouslySetInnerHTML={{ __html: html }} />
      {caption ? <figcaption className="mt-2 text-xs text-faint">{caption}</figcaption> : null}
    </figure>
  )
}

export function Equation({
  label,
  tex,
  source,
  children,
}: {
  label?: string
  tex: string
  source?: string
  children?: ReactNode
}) {
  return (
    <div className="my-4 rounded-2xl border border-line bg-panel-2/40 p-4">
      {label ? <p className="mb-1 font-mono text-[11px] uppercase tracking-wider text-teal">{label}</p> : null}
      <DisplayMath tex={tex} className="my-0 border-0 bg-transparent px-0 py-0" />
      {children ? <div className="mt-2 text-sm leading-relaxed text-muted">{children}</div> : null}
      {source ? (
        <p className="mt-2 font-mono text-[11px] text-faint">Source: {source}</p>
      ) : null}
    </div>
  )
}
