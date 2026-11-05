import { useEffect, useState } from 'react'
import { cn } from '../primitives'

/**
 * The lesson's own table of contents.
 *
 * A lesson is five or six sections long, and until now there was no way to
 * jump between them except scrolling. This panel does three things:
 *
 *  - it lists the sections, so the shape of the lesson is visible up front;
 *  - it marks the section currently in view, so the student knows where they
 *    are (the knowing-doing gap the book keeps returning to is partly a
 *    problem of not knowing what you do not know);
 *  - it doubles as a reading-progress indicator.
 *
 * The active section is tracked with an `IntersectionObserver` rather than a
 * scroll handler, so it costs nothing per frame.
 */
export function LessonOutline({
  sections,
  onSelect,
}: {
  sections: { id: string; title: string }[]
  /** Called when a section is chosen, so the page can scroll to it. */
  onSelect: (id: string) => void
}) {
  const [activeId, setActiveId] = useState<string>(sections[0]?.id ?? '')

  useEffect(() => {
    if (sections.length === 0) return
    // Not every environment has an IntersectionObserver, and the outline is
    // still useful without the scroll spy: the links and the progress bar both
    // work.
    if (typeof IntersectionObserver === 'undefined') return
    const elements = sections
      .map((section) => document.getElementById(`section-${section.id}`))
      .filter((element): element is HTMLElement => element !== null)
    if (elements.length === 0) return

    const observer = new IntersectionObserver(
      (entries) => {
        // The section nearest the top of the viewport wins. Entries that are
        // leaving the viewport are ignored, so the heading does not flicker
        // as the student scrolls.
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) {
          const id = visible[0].target.id.replace(/^section-/, '')
          setActiveId(id)
        }
      },
      // A band near the top of the viewport: the section the reader is on.
      { rootMargin: '-96px 0px -70% 0px', threshold: 0 },
    )

    for (const element of elements) observer.observe(element)
    return () => observer.disconnect()
  }, [sections])

  const activeIndex = sections.findIndex((section) => section.id === activeId)
  const progress = sections.length === 0 ? 0 : (activeIndex + 1) / sections.length

  return (
    <nav aria-label="Sections in this lesson" className="space-y-2">
      <p className="text-muted text-[11px] font-semibold tracking-wide uppercase">In this lesson</p>
      <ol className="space-y-0.5">
        {sections.map((section, index) => {
          const active = section.id === activeId
          return (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSelect(section.id)}
                aria-current={active ? 'true' : undefined}
                className={cn(
                  'focus-ring tap-target flex w-full items-baseline gap-2 rounded-md px-2 py-1 text-left text-[11px] transition',
                  active ? 'bg-white/8 text-slate-100' : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
                )}
              >
                <span className="text-muted font-mono text-[10px]">{String(index + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1">{section.title}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <div className="pt-1">
        <div
          className="h-1 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--border-soft)' }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress * 100)}
          aria-label="Progress through this lesson"
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${progress * 100}%`, background: 'linear-gradient(90deg, var(--accent), var(--accent-2))' }}
          />
        </div>
      </div>
    </nav>
  )
}
