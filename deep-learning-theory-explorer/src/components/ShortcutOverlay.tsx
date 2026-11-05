import { useEffect } from 'react';
import { useFocusTrap } from '../lib/useFocusTrap';

/**
 * The keyboard shortcuts.
 *
 * A laboratory is a tool, and a tool should be operable without the mouse.
 * This panel lists every shortcut the application has, and it is opened with
 * the only key a reader is likely to guess.
 */
export const SHORTCUTS: Array<{ keys: string[]; what: string }> = [
  { keys: ['⌘', 'K'], what: 'open the command palette (Ctrl-K on Windows and Linux)' },
  { keys: ['/'], what: 'focus the search box' },
  { keys: ['↑', '↓'], what: 'move through the search results' },
  { keys: ['⏎'], what: 'open the selected result' },
  { keys: ['Esc'], what: 'close the palette, or a definition popover' },
  { keys: ['?'], what: 'open this list of shortcuts' },
  { keys: ['Ctrl', 'P'], what: 'print the page you are on' },
];

export function ShortcutOverlay({ onClose }: { onClose: () => void }) {
  const ref = useFocusTrap<HTMLDivElement>(true);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-lab-950/70 px-4 pt-[16vh] backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
        className="w-full max-w-lg overflow-hidden rounded-lg border border-lab-700 bg-lab-900 shadow-2xl"
      >
        <div className="border-b border-lab-800 px-4 py-3">
          <div className="text-[13px] font-semibold text-lab-100">Keyboard shortcuts</div>
          <p className="mt-0.5 text-[11.5px] text-lab-400">
            Everything in this application can be reached from the keyboard.
          </p>
        </div>
        <ul className="divide-y divide-lab-850">
          {SHORTCUTS.map((s) => (
            <li key={s.what} className="flex items-center gap-3 px-4 py-2.5">
              <span className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <kbd
                    key={k}
                    className="mono rounded border border-lab-600 bg-lab-850 px-1.5 py-0.5 text-[11px] text-lab-200"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
              <span className="text-[12.5px] leading-snug text-lab-300">{s.what}</span>
            </li>
          ))}
        </ul>
        <div className="border-t border-lab-800 px-4 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded border border-lab-700 bg-lab-850 px-3 py-1.5 text-[12px] text-lab-300 transition-colors hover:border-signal-blue hover:text-signal-blue"
          >
            close
          </button>
        </div>
      </div>
    </div>
  );
}
