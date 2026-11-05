/**
 * The placeholder shown while a page is being loaded.
 *
 * The pages are loaded on demand, so there is a moment between the reader
 * asking for a lesson and the lesson being there. The placeholder says so,
 * rather than leaving an empty screen.
 */
export function RouteFallback() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center" role="status" aria-live="polite">
      <span className="font-mono text-xs uppercase tracking-wider text-faint">Loading…</span>
    </div>
  )
}
