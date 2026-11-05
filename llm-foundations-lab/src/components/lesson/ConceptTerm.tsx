import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { Link } from '../layout/CourseLink.tsx'
import { GLOSSARY_BY_ID } from '../../content/concepts'
import { getLesson } from '../../content/curriculum'

/**
 * Whether the browser can place the anchored panel itself.
 *
 * Anchor positioning is Baseline 2026, and where it exists the panel is
 * tethered to the term and moved by the browser when there is not enough
 * room. Where it does not, the panel is measured in JavaScript instead.
 *
 * This is a property of the browser, not of the page, so it is read once
 * when the module is loaded rather than on every render.
 */
const ANCHOR_POSITIONING_SUPPORTED =
  typeof CSS !== 'undefined' &&
  typeof CSS.supports === 'function' &&
  CSS.supports('position-area: block-end') &&
  CSS.supports('anchor-name: --x')

/**
 * An inline concept reference.
 *
 * Renders a technical term as a dotted-underlined button. Activating it opens
 * a panel with the course's own definition, the terms a reader should know
 * first, and a link to the lesson that explains it in depth. The term is
 * always a real button, so it works from the keyboard and with a screen
 * reader; the panel is wired to it with `aria-expanded` and `aria-controls`.
 */
export function ConceptTerm({ id, children }: { id: string; children?: ReactNode }) {
  const entry = GLOSSARY_BY_ID.get(id)
  const [open, setOpen] = useState(false)
  /** Whether the panel should be aligned to the right edge of the term. */
  const [alignRight, setAlignRight] = useState(false)
  const panelId = useId()
  const wrapperRef = useRef<HTMLSpanElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  // Close on Escape, and close when the reader clicks elsewhere.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        buttonRef.current?.focus()
      }
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  // Keep the panel inside the viewport: a term near the right edge gets a
  // right-aligned panel instead of one that runs off the screen. A browser
  // with anchor positioning does this by itself, so the measurement is only
  // needed where that is not available.
  useEffect(() => {
    if (!open || ANCHOR_POSITIONING_SUPPORTED) return
    const measure = () => {
      const button = buttonRef.current
      if (!button) return
      const rect = button.getBoundingClientRect()
      const panelWidth = Math.min(384, window.innerWidth * 0.8)
      setAlignRight(rect.left + panelWidth > window.innerWidth - 16)
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [open])

  if (!entry) return <>{children}</>

  const lesson = getLesson(entry.lessonId)
  const prerequisites = entry.prerequisites
    .map((id) => GLOSSARY_BY_ID.get(id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))

  return (
    <span className="relative inline-block" ref={wrapperRef}>
      <button
        ref={buttonRef}
        type="button"
        className="concept-term cursor-help rounded px-0.5 text-left font-medium text-fg underline decoration-dotted decoration-teal/70 underline-offset-2 transition-colors hover:decoration-solid hover:text-teal focus-visible:decoration-solid"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        title={entry.short}
      >
        {children ?? entry.term}
      </button>

      {open ? (
        <span
          id={panelId}
          role="dialog"
          aria-label={`${entry.term}: definition`}
          className={`absolute top-full z-30 block rounded-2xl border border-line bg-panel p-4 text-left shadow-xl shadow-black/30 ${
            ANCHOR_POSITIONING_SUPPORTED
              ? 'concept-panel--anchored'
              : `mt-2 w-[min(24rem,80vw)] ${alignRight ? 'right-0' : 'left-0'}`
          }`}
        >
          <span className="block font-display text-sm font-semibold text-fg">{entry.term}</span>
          <span className="mt-1 block text-xs text-teal">{entry.short}</span>
          <span className="mt-2 block text-[13px] leading-relaxed text-muted">{entry.definition}</span>

          {prerequisites.length > 0 ? (
            <span className="mt-3 block text-xs text-faint">
              Know first:{' '}
              {prerequisites.map((prerequisite, index) => (
                <span key={prerequisite.id}>
                  {index > 0 ? ', ' : ''}
                  <span className="text-indigo">{prerequisite.term}</span>
                </span>
              ))}
            </span>
          ) : null}

          <span className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-2">
            <span className="font-mono text-[11px] text-faint">
              §{entry.section} · p.{entry.page}
            </span>
            {lesson ? (
              <Link
                to={`/lessons/${entry.lessonId}`}
                className="text-xs text-indigo underline underline-offset-2"
                onClick={() => setOpen(false)}
              >
                Read the lesson →
              </Link>
            ) : null}
          </span>
        </span>
      ) : null}
    </span>
  )
}
