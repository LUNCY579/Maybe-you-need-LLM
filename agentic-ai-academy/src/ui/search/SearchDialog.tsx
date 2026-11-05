import { useEffect, useMemo, useRef, useState } from 'react'
import { navigate } from '../../app/router'
import { SEARCH_KIND_LABELS } from '../../content/searchLabels'
import type { SearchKind, SearchResult } from '../../content/searchIndex'
import { Badge, Button, cn } from '../primitives'

/**
 * The search index, loaded when the student first asks for it.
 *
 * The index covers every lesson, section, glossary term, question, laboratory and
 * reference, and building it means reading all of it. That is worth doing when
 * someone searches and not worth doing for a student who opens the course and
 * starts reading, so the module is fetched the first time the dialog opens.
 */
type SearchCourse = (query: string) => SearchResult[]

/**
 * Course-wide search.
 *
 * A command-palette style overlay opened with the search button in the header
 * or with Ctrl/Cmd+K. Fully keyboard operable: arrow keys move the active
 * result, Enter opens it, Escape closes.
 */
export function SearchDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const [search, setSearch] = useState<SearchCourse | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open || search) return
    let cancelled = false
    void import('../../content/searchIndex').then((module) => {
      if (!cancelled) setSearch(() => module.searchCourse)
    })
    return () => {
      cancelled = true
    }
  }, [open, search])

  const results = useMemo<SearchResult[]>(() => (search ? search(query) : []), [search, query])

  useEffect(() => {
    if (open) {
      restoreFocusRef.current = document.activeElement as HTMLElement | null
      setQuery('')
      setActiveIndex(0)
      // Focus the input on the next frame so the dialog is painted first.
      const frame = requestAnimationFrame(() => inputRef.current?.focus())
      return () => cancelAnimationFrame(frame)
    }
    // Return focus to whatever opened the dialog.
    restoreFocusRef.current?.focus?.()
    return undefined
  }, [open])

  useEffect(() => {
    setActiveIndex(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveIndex((current) => (results.length === 0 ? 0 : (current + 1) % results.length))
        return
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveIndex((current) => (results.length === 0 ? 0 : (current - 1 + results.length) % results.length))
        return
      }
      if (event.key === 'Enter') {
        const result = results[activeIndex]
        if (result) {
          event.preventDefault()
          openResult(result)
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, results, activeIndex])

  const openResult = (result: SearchResult) => {
    onClose()
    navigate(result.route.replace(/^#/, ''))
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[10vh]"
      style={{ background: 'rgba(4, 8, 20, 0.72)', backdropFilter: 'blur(4px)' }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search the course"
        className="surface w-full max-w-2xl overflow-hidden rounded-2xl border shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
      >
        <div className="border-b p-3" style={{ borderColor: 'var(--border-soft)' }}>
          <label htmlFor="course-search-input" className="sr-only">
            Search lessons, glossary terms, questions, labs and references
          </label>
          <input
            id="course-search-input"
            ref={inputRef}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search lessons, glossary, questions, labs and references…"
            className="focus-ring surface-2 w-full rounded-lg border px-3 py-2 text-sm"
            style={{ borderColor: 'var(--border-soft)', color: 'var(--text-strong)' }}
            autoComplete="off"
            spellCheck={false}
          />
          <p className="text-muted mt-2 text-[11px]">
            Use <kbd className="rounded border px-1">↑</kbd> <kbd className="rounded border px-1">↓</kbd> to move,{' '}
            <kbd className="rounded border px-1">Enter</kbd> to open, <kbd className="rounded border px-1">Esc</kbd> to close.
          </p>
        </div>

        <div tabIndex={0} aria-label="Search results" className="max-h-[52vh] overflow-y-auto focus-ring">
          {query.trim().length === 0 ? (
            <p className="text-muted p-5 text-sm">
              Type to search the whole course: lesson text, glossary definitions, assessment questions, laboratory descriptions and
              references.
            </p>
          ) : results.length === 0 ? (
            <div className="p-5">
              <p className="text-sm">
                No matches for <strong>“{query.trim()}”</strong>.
              </p>
              <p className="text-muted mt-2 text-xs">
                Try a shorter or more general term, such as “memory”, “planning”, “tool”, “reflection” or “evaluation”.
              </p>
            </div>
          ) : (
            <ul ref={listRef} role="listbox" aria-label="Search results" className="divide-y" style={{ borderColor: 'var(--border-soft)' }}>
              {results.map((result, index) => (
                <li key={result.id} role="option" aria-selected={index === activeIndex}>
                  <button
                    type="button"
                    onClick={() => openResult(result)}
                    onMouseEnter={() => setActiveIndex(index)}
                    className={cn(
                      'focus-ring flex w-full flex-col items-start gap-1 px-4 py-3 text-left transition',
                      index === activeIndex ? 'bg-white/5' : '',
                    )}
                  >
                    <span className="flex w-full items-center gap-2">
                      <Badge tone={kindTone(result.kind)}>{SEARCH_KIND_LABELS[result.kind]}</Badge>
                      <span className="truncate text-sm font-medium">{result.title}</span>
                    </span>
                    <span className="text-muted line-clamp-2 text-xs">{result.snippet}</span>
                    {result.source ? <span className="text-muted text-[10px] uppercase">{result.source}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t p-3" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-muted text-[11px]">
            {query.trim().length === 0 ? 'Search is fully local — nothing leaves this browser.' : `${results.length} result(s)`}
          </p>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  )
}

function kindTone(kind: SearchKind): 'cyan' | 'violet' | 'amber' | 'emerald' | 'rose' | 'neutral' {
  switch (kind) {
    case 'lesson':
      return 'cyan'
    case 'section':
      return 'cyan'
    case 'glossary':
      return 'violet'
    case 'question':
      return 'amber'
    case 'lab':
      return 'emerald'
    case 'reference':
      return 'neutral'
  }
}
