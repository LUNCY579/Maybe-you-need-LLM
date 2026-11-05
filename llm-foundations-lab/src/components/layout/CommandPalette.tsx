import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCourseNavigate } from './useCourseNavigate'
import { KIND_LABEL, type SearchHit } from '../../content/searchIndex'
import { matchFields } from '../../core/fuzzy'

/**
 * The command palette.
 *
 * The header search finds things: a lesson, a term, a formula. The palette
 * does that and more — it also runs *commands*, the things a reader wants to
 * do rather than look at: switch the colour scheme, jump to the next lesson,
 * start a review session, export the progress file.
 *
 * It is a modal dialog, so it is built on the platform's own `<dialog>`
 * element rather than on a hand-rolled overlay. The browser then does the
 * things a modal dialog has to do: it traps the focus, it closes on Escape,
 * it puts the panel in the top layer so nothing can overlap it, and it marks
 * the rest of the page as inert for assistive technology.
 *
 * The entrance animation uses `@starting-style`, which lets a rule describe
 * how an element looks *before* it is displayed, so the panel can fade and
 * scale in without any JavaScript. Support: Chrome 117, Edge 117, Firefox
 * 129, Safari 17.5.
 */

export interface PaletteCommand {
  id: string
  title: string
  detail: string
  /** The word that tells the reader what kind of thing this is. */
  group: string
  keywords?: string[]
  run: () => void
}

export interface PaletteEntry {
  id: string
  title: string
  detail: string
  group: string
  /** The characters in the title that matched the query. */
  indices?: number[]
  run: () => void
}

/**
 * Is this a Mac?
 *
 * The palette is opened with Command on a Mac and with Control everywhere
 * else, and the corner of the panel says which. Reading the platform from
 * the user agent is crude, but the only consequence of getting it wrong is
 * that the wrong key is named.
 */
function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const agent = navigator.userAgent ?? ''
  return /Mac|iPhone|iPad|iPod/.test(agent)
}

export function CommandPalette({
  open,
  onClose,
  commands,
  hits,
}: {
  open: boolean
  onClose: () => void
  commands: PaletteCommand[]
  hits: SearchHit[]
}) {
  const navigate = useCourseNavigate()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const isApple = useMemo(() => isApplePlatform(), [])

  /*
   * The dialog is opened and closed by the browser rather than by React, so
   * that the focus trap and the inertness of the rest of the page come for
   * free. React only has to keep the two in step.
   */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      setQuery('')
      setActiveIndex(0)
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open])

  /* Closing the dialog with Escape fires `close`, not a click on the backdrop. */
  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const handleClose = (): void => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  const entries = useMemo<PaletteEntry[]>(() => {
    const trimmed = query.trim()
    const commandEntries: PaletteEntry[] = commands.map((command) => ({
      id: `command:${command.id}`,
      title: command.title,
      detail: command.detail,
      group: command.group,
      run: command.run,
    }))

    if (trimmed.length === 0) {
      // With nothing typed, the palette offers what the reader is most likely
      // to want next, rather than an empty list.
      return commandEntries.slice(0, 8)
    }

    const scored: { entry: PaletteEntry; score: number }[] = []

    for (const command of commands) {
      const result = matchFields(
        [
          { text: command.title, weight: 10 },
          { text: command.detail, weight: 4 },
          { text: (command.keywords ?? []).join(' '), weight: 3 },
        ],
        trimmed,
      )
      if (!result) continue
      scored.push({
        entry: {
          id: `command:${command.id}`,
          title: command.title,
          detail: command.detail,
          group: command.group,
          indices: result.field === 0 ? result.indices : undefined,
          run: command.run,
        },
        score: result.score,
      })
    }

    for (const hit of hits) {
      /*
        A self-explanation question is a long piece of text, and a long piece
        of text matches almost anything: the query "colour scheme" is a
        subsequence of a great many paragraphs. So a question is weighted
        like a body rather than like a title, and it never outranks the
        lesson it belongs to or the command that really matches.
      */
      const question = hit.kind === 'question'
      const result = matchFields(
        [
          { text: hit.title, weight: question ? 2 : 10 },
          { text: hit.detail, weight: question ? 1 : 5 },
          { text: (hit.searchText ?? []).join(' '), weight: question ? 1 : 2 },
        ],
        trimmed,
      )
      if (!result) continue
      scored.push({
        entry: {
          // The kind is part of the key: a module and a glossary term can
          // share an id, and two entries with the same key would make React
          // drop one of them.
          id: `hit:${hit.kind}:${hit.id}`,
          title: hit.title,
          detail: hit.detail,
          group: KIND_LABEL[hit.kind],
          indices: result.field === 0 ? result.indices : undefined,
          run: () => navigate(hit.href),
        },
        score: result.score,
      })
    }

    return scored
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((entry) => entry.entry)
  }, [commands, hits, query, navigate])

  // The selection can never point past the end of the list.
  const selected = entries.length === 0 ? -1 : Math.min(activeIndex, entries.length - 1)

  /*
   * A new query means a new list, so the selection goes back to the top.
   * Adjusting the state during render keeps the list and the selection in
   * step without the extra frame an effect would cost.
   */
  const [lastQuery, setLastQuery] = useState(query)
  if (lastQuery !== query) {
    setLastQuery(query)
    setActiveIndex(0)
  }

  const choose = useCallback(
    (entry: PaletteEntry | undefined) => {
      if (!entry) return
      onClose()
      entry.run()
    },
    [onClose],
  )

  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex((index) => (entries.length === 0 ? 0 : (index + 1) % entries.length))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex((index) => (entries.length === 0 ? 0 : (index - 1 + entries.length) % entries.length))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setActiveIndex(0)
    } else if (event.key === 'End') {
      event.preventDefault()
      setActiveIndex(Math.max(0, entries.length - 1))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      choose(entries[selected])
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="command-palette m-0 mx-auto mt-[10vh] w-[min(42rem,calc(100vw-2rem))] bg-transparent p-0 text-fg backdrop:bg-black/60"
      aria-label="Command palette"
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself, because
        // the panel inside it does not fill it.
        if (event.target === dialogRef.current) onClose()
      }}
    >
      <div className="command-palette__panel overflow-hidden rounded-2xl border border-line bg-panel shadow-2xl">
        <div className="flex items-center gap-2 border-b border-line px-4">
          <span aria-hidden className="font-mono text-xs text-faint">
            {isApple ? '⌘' : 'Ctrl'}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Look for a lesson, a term, or a command…"
            aria-label="Look for a lesson, a term, or a command"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-results"
            aria-activedescendant={selected >= 0 ? `command-option-${selected}` : undefined}
            autoComplete="off"
            className="w-full bg-transparent py-3.5 text-sm text-fg outline-none placeholder:text-faint"
          />
        </div>

        <ul
          id="command-palette-results"
          role="listbox"
          aria-label="Results"
          className="max-h-[min(24rem,60vh)] overflow-y-auto p-2"
        >
          {entries.length === 0 ? (
            <li className="px-3 py-6 text-center text-sm text-faint">Nothing matches that.</li>
          ) : (
            entries.map((entry, index) => (
              <li
                key={entry.id}
                id={`command-option-${index}`}
                role="option"
                aria-selected={index === selected}
                className={`flex cursor-pointer items-baseline justify-between gap-3 rounded-lg px-3 py-2 ${
                  index === selected ? 'bg-indigo/15' : ''
                }`}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(entry)}
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-fg">
                    {entry.indices ? <Highlighted text={entry.title} indices={entry.indices} /> : entry.title}
                  </span>
                  <span className="block truncate text-xs text-faint">{entry.detail}</span>
                </span>
                <span className="shrink-0 font-mono text-[10px] uppercase tracking-wider text-faint">
                  {entry.group}
                </span>
              </li>
            ))
          )}
        </ul>

        <div className="flex items-center gap-3 border-t border-line px-4 py-2 text-[11px] text-faint">
          <span>
            <kbd className="rounded border border-line px-1">↑</kbd> <kbd className="rounded border border-line px-1">↓</kbd>{' '}
            to move
          </span>
          <span>
            <kbd className="rounded border border-line px-1">Enter</kbd> to open
          </span>
          <span>
            <kbd className="rounded border border-line px-1">Esc</kbd> to close
          </span>
          <span className="ml-auto">{entries.length > 0 ? `${entries.length} result${entries.length === 1 ? '' : 's'}` : ''}</span>
        </div>
      </div>
    </dialog>
  )
}

/**
 * Show the matched characters of a title in a different colour.
 *
 * The text is split into runs rather than into single characters, so a title
 * stays three elements instead of thirty. That matters for more than speed:
 * a screen reader reads the title as a title, and a test can still find it
 * by its text.
 */
function Highlighted({ text, indices }: { text: string; indices: number[] }) {
  const matched = new Set(indices)
  const runs: { text: string; matched: boolean }[] = []
  for (let index = 0; index < text.length; index++) {
    const isMatched = matched.has(index)
    const last = runs[runs.length - 1]
    if (last && last.matched === isMatched) {
      last.text += text[index]
    } else {
      runs.push({ text: text[index], matched: isMatched })
    }
  }

  return (
    <>
      {runs.map((run, index) =>
        run.matched ? (
          <mark key={index} className="rounded bg-indigo/30 text-fg">
            {run.text}
          </mark>
        ) : (
          <span key={index}>{run.text}</span>
        ),
      )}
    </>
  )
}
