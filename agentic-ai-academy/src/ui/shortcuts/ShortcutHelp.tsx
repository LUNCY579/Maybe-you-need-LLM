import { useEffect, useRef } from 'react'
import { Button } from '../primitives'

/**
 * Keyboard shortcut reference.
 *
 * The site has a number of shortcuts (search, tab navigation, node deletion)
 * and none of them are discoverable without a cheat sheet. Opening this with
 * `?` is the convention users already expect from developer tools and
 * documentation sites.
 */

export interface Shortcut {
  keys: string[]
  description: string
  /** Where the shortcut applies. */
  scope?: string
}

/**
 * Every shortcut the site supports, and the scope it applies to.
 *
 * Kept module-private: the list is only ever rendered by the dialog below, and
 * exporting it alongside a component would break React Fast Refresh.
 */
const SHORTCUTS: Shortcut[] = [
  { keys: ['/'], description: 'Search the whole course', scope: 'anywhere' },
  { keys: ['Ctrl', 'K'], description: 'Search the whole course (Cmd K on macOS)', scope: 'anywhere' },
  { keys: ['Esc'], description: 'Close the search dialog or a glossary popover', scope: 'dialogs' },
  { keys: ['↑', '↓'], description: 'Move through search results', scope: 'search' },
  { keys: ['Enter'], description: 'Open the selected result', scope: 'search' },
  { keys: ['←', '→'], description: 'Move between tabs', scope: 'tab strips' },
  { keys: ['Home', 'End'], description: 'Jump to the first or last tab', scope: 'tab strips' },
  { keys: ['↑', '↓'], description: 'Choose an answer', scope: 'quiz options' },
  { keys: ['Delete'], description: 'Remove the selected node', scope: 'workflow builder' },
  { keys: ['?'], description: 'Open this shortcut list', scope: 'anywhere' },
]

export function ShortcutHelp({ open, onClose }: { open: boolean; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement as HTMLElement | null
    closeRef.current?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        onClose()
        restoreFocusRef.current?.focus?.()
      }
    }
    window.addEventListener('keydown', onKeyDown, true)
    return () => {
      window.removeEventListener('keydown', onKeyDown, true)
    }
  }, [open, onClose])

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
        aria-label="Keyboard shortcuts"
        className="surface w-full max-w-xl overflow-hidden rounded-2xl border shadow-[0_30px_80px_-30px_rgba(0,0,0,0.9)]"
      >
        <header className="flex items-center justify-between gap-3 border-b p-4" style={{ borderColor: 'var(--border-soft)' }}>
          <h2 className="text-sm font-semibold">Keyboard shortcuts</h2>
          <Button size="sm" variant="ghost" onClick={onClose} ref={closeRef}>
            Close
          </Button>
        </header>

        <ul className="max-h-[60vh] divide-y overflow-y-auto" style={{ borderColor: 'var(--border-soft)' }}>
          {SHORTCUTS.map((shortcut) => (
            <li key={`${shortcut.keys.join('-')}-${shortcut.description}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm">
              <span className="flex items-center gap-1">
                {shortcut.keys.map((key) => (
                  <kbd key={key} className="rounded border px-1.5 py-0.5 text-[11px]">
                    {key}
                  </kbd>
                ))}
              </span>
              <span className="text-muted text-xs">
                {shortcut.description}
                {shortcut.scope ? <span className="ml-1 opacity-70">({shortcut.scope})</span> : null}
              </span>
            </li>
          ))}
        </ul>

        <footer className="border-t p-3 text-[11px]" style={{ borderColor: 'var(--border-soft)' }}>
          <p className="text-muted">
            Every control is reachable by keyboard, including the workflow builder's node graph: nodes are selected and configured from a list, and two
            nodes are connected with the <strong>Connect two nodes</strong> control, which needs two clicks and no dragging.
          </p>
        </footer>
      </div>
    </div>
  )
}
