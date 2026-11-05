import { useEffect, useState, type ReactNode } from 'react'
import { findGlossaryMatches, isLinkableTerm } from '../content/glossaryIndex'
import { GlossaryLink } from './glossary/GlossaryLink'

/**
 * A deliberately small markdown subset renderer.
 *
 * Supported: **bold**, *italic*, `inline code`, [text](url) links, and paragraph
 * breaks. We do not render raw HTML and we do not evaluate anything, which keeps
 * lesson content inert and safe (no arbitrary code execution from content files).
 *
 * Plain text is also scanned for glossary terms, which become links that reveal
 * the definition in place. Only the first occurrence of a term in a paragraph is
 * linked: linking every mention would make the prose unreadable.
 */

/**
 * Wrap glossary terms in `text` with links.
 *
 * `seen` carries the terms already linked in this paragraph, so each term is
 * linked at most once per paragraph.
 */
function linkGlossaryTerms(text: string, keyPrefix: string, seen: Set<string>): ReactNode[] {
  const matches = findGlossaryMatches(text).filter((match) => isLinkableTerm(match.term) && !seen.has(match.term.term))
  if (matches.length === 0) return [text]

  const nodes: ReactNode[] = []
  let cursor = 0
  matches.forEach((match, index) => {
    if (match.start > cursor) nodes.push(text.slice(cursor, match.start))
    seen.add(match.term.term)
    nodes.push(
      <GlossaryLink key={`${keyPrefix}-g${index}`} term={match.term}>
        {text.slice(match.start, match.end)}
      </GlossaryLink>,
    )
    cursor = match.end
  })
  if (cursor < text.length) nodes.push(text.slice(cursor))
  return nodes
}

function renderInline(text: string, keyPrefix: string, seen: Set<string>): ReactNode[] {
  const nodes: ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let lastIndex = 0
  let match: RegExpExecArray | null
  let index = 0

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) nodes.push(...linkGlossaryTerms(text.slice(lastIndex, match.index), `${keyPrefix}-${index++}`, seen))
    const token = match[0]
    const key = `${keyPrefix}-${index++}`
    if (token.startsWith('**')) {
      nodes.push(
        <strong key={key} className="font-semibold" style={{ color: 'var(--text-strong)' }}>
          {token.slice(2, -2)}
        </strong>,
      )
    } else if (token.startsWith('`')) {
      nodes.push(
        <code key={key} className="surface-2 rounded border px-1 py-0.5 font-mono text-[0.85em]" style={{ borderColor: 'var(--border-soft)' }}>
          {token.slice(1, -1)}
        </code>,
      )
    } else if (token.startsWith('[')) {
      const linkMatch = /\[([^\]]+)\]\(([^)]+)\)/.exec(token)
      if (linkMatch) {
        const [, label, href] = linkMatch
        const external = /^https?:\/\//.test(href)
        nodes.push(
          <a
            key={key}
            href={href}
            className="focus-ring underline decoration-dotted underline-offset-2"
            style={{ color: 'var(--accent)' }}
            {...(external ? { target: '_blank', rel: 'noreferrer noopener' } : {})}
          >
            {label}
          </a>,
        )
      }
    } else {
      nodes.push(
        <em key={key} className="italic">
          {token.slice(1, -1)}
        </em>,
      )
    }
    lastIndex = pattern.lastIndex
  }
  if (lastIndex < text.length) nodes.push(...linkGlossaryTerms(text.slice(lastIndex), `${keyPrefix}-${index++}`, seen))
  return nodes
}

export function Markdown({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/)
  return (
    <>
      {paragraphs.map((paragraph, paragraphIndex) => {
        // Terms are linked at most once per paragraph, so the prose stays
        // readable while every paragraph still offers its definitions.
        const seen = new Set<string>()
        return (
          <p key={`p-${paragraphIndex}`} className="mb-3 leading-relaxed last:mb-0">
            {paragraph.split('\n').map((line, lineIndex, all) => (
              <span key={`l-${lineIndex}`}>
                {renderInline(line, `p-${paragraphIndex}-l-${lineIndex}`, seen)}
                {lineIndex < all.length - 1 ? <br /> : null}
              </span>
            ))}
          </p>
        )
      })}
    </>
  )
}

/** Rendered KaTeX expression. Throws are caught and surfaced as readable errors. */
export function Formula({ latex, display = true }: { latex: string; display?: boolean }) {
  /**
   * The rendered result is tagged with the formula it belongs to.
   *
   * Tagging it is what lets the effect stay free of state resets: a result
   * for an earlier formula is simply not the current one, and is ignored.
   */
  const key = `${display ? 'display' : 'inline'}|${latex}`
  const [result, setResult] = useState<{ key: string; html: string } | null>(null)
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null)

  useEffect(() => {
    let cancelled = false
    /*
     * KaTeX and its stylesheet are fetched on demand.
     *
     * The stylesheet must not also be imported statically anywhere: a static
     * import would put it in the initial bundle and quietly defeat the point
     * of the dynamic one. The build warns about exactly that.
     */
    void Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(
      ([module]) => {
        if (cancelled) return
        try {
          setResult({
            key,
            html: module.default.renderToString(latex, { displayMode: display, throwOnError: true, strict: 'ignore' }),
          })
        } catch (caught) {
          setFailure({ key, message: caught instanceof Error ? caught.message : 'Formula could not be rendered.' })
        }
      },
      () => {
        if (!cancelled) setFailure({ key, message: 'The formula library could not be loaded.' })
      },
    )
    return () => {
      cancelled = true
    }
  }, [key, latex, display])

  const error = failure?.key === key ? failure.message : null
  const html = result?.key === key ? result.html : null

  if (error) {
    return (
      <pre className="surface-2 rounded-lg border p-2 text-xs" style={{ borderColor: 'rgba(251,113,133,0.4)' }}>
        Formula error: {error}
        {'\n'}
        {latex}
      </pre>
    )
  }

  if (html === null) {
    // Reserve the height of a display formula so the prose does not jump.
    return <span className="block min-h-[2.5rem] text-center" aria-hidden="true" />
  }

  return <span className="block text-center" dangerouslySetInnerHTML={{ __html: html }} />
}
