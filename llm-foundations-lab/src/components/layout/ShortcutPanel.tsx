import { useEffect, useRef } from 'react'
import { Button } from '../ui/primitives'

/**
 * The keyboard shortcuts.
 *
 * The course is dense with controls, so the shortcuts are worth stating in one
 * place. The panel is a dialog: it takes the focus when it opens, it closes on
 * Escape or on a click outside it, and it returns the focus to whatever opened
 * it.
 */
const SHORTCUTS: { keys: string[]; description: string }[] = [
  { keys: ['/'], description: 'Open the course search' },
  { keys: ['⌘', 'K'], description: 'Open the command palette, on Control in Windows and Linux' },
  { keys: ['?'], description: 'Show or hide this panel' },
  { keys: ['Esc'], description: 'Close the search, a definition, or this panel' },
  { keys: ['Tab'], description: 'Move between the controls of the current view' },
  { keys: ['Enter'], description: 'Open the focused link, button or term' },
  { keys: ['↑', '↓'], description: 'Move through the search results' },
]

export function ShortcutPanel({ onClose }: { onClose: () => void }) {
  const panelRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  // Move the focus into the panel when it opens, and put it back when it closes.
  useEffect(() => {
    closeRef.current?.focus()
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={(event) => {
        if (!panelRef.current?.contains(event.target as Node)) onClose()
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-md rounded-2xl border border-line bg-panel p-5 shadow-2xl shadow-black/40"
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-fg">Keyboard shortcuts</h2>
          <Button ref={closeRef} size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
        <dl className="mt-4 space-y-2">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.description} className="flex items-center gap-3 text-sm">
              <dt className="flex shrink-0 gap-1">
                {shortcut.keys.map((key) => (
                  <kbd
                    key={key}
                    className="rounded border border-line bg-panel-2 px-1.5 py-0.5 font-mono text-[11px] text-fg"
                  >
                    {key}
                  </kbd>
                ))}
              </dt>
              <dd className="text-muted">{shortcut.description}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs text-faint">
          Shortcuts are ignored while you are typing in a field. Press <kbd className="font-mono">?</kbd> anywhere to
          open this panel.
        </p>
      </div>
    </div>
  )
}
