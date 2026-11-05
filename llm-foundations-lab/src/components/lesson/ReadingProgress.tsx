/**
 * How much of the lesson has been read.
 *
 * The bar is driven by a scroll-driven CSS animation rather than a scroll
 * listener: the browser ties the animation to the scroll position itself, so
 * there is no JavaScript on the scroll path and nothing to throttle.
 *
 * The bar is decorative. It is hidden from assistive technology, because the
 * information it carries — where the reader is in the lesson — is already
 * given by the in-page outline, which names the current section. A second
 * announcement of the same thing would be noise.
 *
 * Browsers without scroll-driven animation support show an empty track. The
 * track is still worth drawing: it says the lesson is long enough to be
 * worth a position indicator.
 */
export function ReadingProgress() {
  return (
    <div
      className="reading-progress__track h-0.5 w-full overflow-hidden rounded-full"
      aria-hidden="true"
      data-testid="reading-progress"
    >
      <div className="reading-progress__fill h-full w-full bg-indigo" />
    </div>
  )
}
