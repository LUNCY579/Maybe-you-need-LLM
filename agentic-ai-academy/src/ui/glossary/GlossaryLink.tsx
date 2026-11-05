import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { navigate } from '../../app/router'
import type { GlossaryTerm } from '../../types/curriculum'
import { VisuallyHidden } from '../primitives'

/**
 * An inline glossary term.
 *
 * Clicking (or pressing Enter on) the term reveals its definition in place, so
 * a student never has to lose their position in the lesson to look a word up.
 *
 * The definition is a **native popover** rather than a hand-positioned div.
 * That fixes a real bug the previous implementation had: the definition was
 * absolutely positioned inside the paragraph, so inside a table cell — which
 * scrolls horizontally — the panel was clipped by the cell's `overflow`. The
 * native popover renders in the **top layer**, so it is never clipped by an
 * ancestor and always paints above the sticky header.
 *
 * The native popover also gives, for free:
 *
 *  - **light dismiss**: a click or Escape anywhere else closes it;
 *  - correct **focus order** for the top layer;
 *  - `position-area` and `position-try-fallbacks`, so the browser places the
 *    panel next to the term and flips it when it would overflow — with no
 *    JavaScript measuring involved.
 *
 * Browsers without the popover API, or without anchor positioning, fall back
 * to a fixed panel positioned from the term's bounding box.
 */

export function GlossaryLink({ term, children }: { term: GlossaryTerm; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popoverRef = useRef<HTMLDivElement>(null)
  const popoverId = useId()
  /*
   * The anchor name is derived from the same `useId` value that names the
   * panel, because an anchor is resolved by name across the document.
   *
   * It used to come from a module-level counter read out of a ref, which meant
   * two things: the counter was incremented during render — so every render of
   * every term burned a number — and reading the ref while rendering is a rule
   * React forbids, because a render that is thrown away still moved the
   * counter. `useId` is React's own answer to "something unique per instance,
   * stable across renders", and it is safe to read here.
   *
   * The characters that are not legal in a CSS identifier are dropped: an
   * anchor name has to be a `custom-ident`.
   */
  const anchorName = `--glossary-term-${popoverId.replace(/[^A-Za-z0-9_-]/g, '')}`

  const supportsPopover = typeof HTMLElement !== 'undefined' && 'popover' in HTMLElement.prototype
  const supportsAnchor =
    typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('position-area', 'block-start')

  const close = useCallback(() => {
    setOpen(false)
    const element = popoverRef.current
    if (element && supportsPopover && element.matches(':popover-open')) {
      try {
        element.hidePopover()
      } catch {
        // Already hidden.
      }
    }
    buttonRef.current?.focus()
  }, [supportsPopover])

  // Escape closes the panel and returns focus to the term.
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    }
    document.addEventListener('keydown', onKeyDown, true)
    return () => document.removeEventListener('keydown', onKeyDown, true)
  }, [open, close])

  /**
   * Position the panel for browsers without CSS anchor positioning.
   *
   * The panel is placed under the term and flipped above it when there is not
   * enough room below.
   */
  const positionFallback = useCallback(() => {
    const button = buttonRef.current
    const element = popoverRef.current
    if (!button || !element) return
    const anchor = button.getBoundingClientRect()
    const height = element.offsetHeight || 120
    const below = window.innerHeight - anchor.bottom
    const top = below > height + 16 ? anchor.bottom + 8 : Math.max(8, anchor.top - height - 8)
    const left = Math.min(Math.max(8, anchor.left), window.innerWidth - 320 - 8)
    element.style.left = `${left}px`
    element.style.top = `${top}px`
  }, [])

  const show = useCallback(() => {
    setOpen(true)
    const element = popoverRef.current
    if (!element) return
    if (supportsPopover) {
      try {
        element.showPopover()
      } catch {
        // The API may have been removed between the check and the call.
      }
    }
    if (!supportsAnchor) {
      // The panel is in the top layer, so it needs explicit coordinates.
      requestAnimationFrame(positionFallback)
    }
  }, [supportsPopover, supportsAnchor, positionFallback])

  const hide = useCallback(() => {
    setOpen(false)
    const element = popoverRef.current
    if (element && supportsPopover && element.matches(':popover-open')) {
      try {
        element.hidePopover()
      } catch {
        // Already hidden.
      }
    }
  }, [supportsPopover])

  const toggle = () => {
    if (open) hide()
    else show()
  }

  // The `popover` attribute is set imperatively: it is a boolean attribute
  // that React does not expose as a prop.
  useEffect(() => {
    const element = popoverRef.current
    if (!element || !supportsPopover) return
    element.setAttribute('popover', 'auto')
  }, [supportsPopover])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={popoverId}
        className="focus-ring cursor-help rounded-sm border-0 bg-transparent p-0 text-left font-medium underline decoration-dotted decoration-1 underline-offset-2"
        style={{ color: 'var(--accent)', anchorName } as React.CSSProperties}
        title={`${term.term} — click for the definition`}
      >
        {children}
      </button>

      {/*
        The panel is rendered into a portal at the end of the document.

        It has to be. The definition appears *inside a paragraph* of the
        lesson prose, and a panel that stays in that paragraph is a problem
        however it is styled:

         - it is part of the paragraph's text, so copying a passage copies
            the definition into the middle of the sentence;
         - it is part of the paragraph's text content, so anything that
            reads the text — a test, a reader, a search over the DOM —
            sees the definition spliced into the prose;
        - screen readers announce it inline with the sentence.

        In the top layer it is none of those things, and CSS anchor
        positioning still works, because an anchor is resolved by name
        across the document rather than by tree position.
      */}
      {typeof document !== 'undefined'
        ? createPortal(
            <span
              ref={popoverRef}
              id={popoverId}
              role="note"
              className="glossary-popover"
              data-open={open ? 'true' : 'false'}
              style={
                supportsAnchor
                  ? ({ positionAnchor: anchorName } as React.CSSProperties)
                  : { position: 'fixed', left: '-9999px', top: '-9999px' }
              }
            >
              <span className="block text-sm font-semibold">{term.term}</span>
              <span className="mt-1 block text-xs leading-relaxed">{term.definition}</span>
              <span className="mt-2 flex flex-wrap items-center gap-2">
                {term.source ? (
                  <span className="text-[10px] text-slate-400">{term.source.label}</span>
                ) : (
                  <span className="text-[10px] text-slate-400">course term</span>
                )}
                <button
                  type="button"
                  className="focus-ring underline"
                  onClick={() => {
                    hide()
                    navigate(`/glossary?term=${encodeURIComponent(term.term)}`)
                  }}
                >
                  Open in glossary
                </button>
                <VisuallyHidden>(press Escape to close)</VisuallyHidden>
              </span>
            </span>,
            document.body,
          )
        : null}
    </>
  )
}
