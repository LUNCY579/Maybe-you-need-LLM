import type { ModuleMeta } from '../../content/curriculum'

/**
 * The misreadings readers commonly bring to a chapter.
 *
 * Each pair is a claim and its refutation, and both halves are specific: the
 * correction says what is actually true and, where the book is explicit about
 * it, where the claim comes from. Learning is largely a matter of replacing a
 * confident wrong model with a right one, and naming the wrong model makes
 * that possible.
 */
export function MisconceptionPanel({ module }: { module: ModuleMeta }) {
  if (module.misconceptions.length === 0) return null

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-fg">Three misreadings worth unlearning</h2>
      <p className="max-w-3xl text-sm text-muted">
        These are the claims that sound right and are not. Each one is something the chapter explicitly rules out, so
        reading the correction is not a matter of opinion.
      </p>
      <ul className="grid gap-3 md:grid-cols-3">
        {module.misconceptions.map((entry) => (
          <li
            key={entry.mistake}
            className="flex flex-col gap-2 rounded-2xl border border-line bg-panel/60 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wider text-rose">The tempting story</p>
            <p className="text-sm font-medium text-fg">“{entry.mistake}”</p>
            <p className="text-xs font-medium uppercase tracking-wider text-teal">What is actually true</p>
            <p className="text-sm leading-relaxed text-muted">{entry.correction}</p>
          </li>
        ))}
      </ul>
    </section>
  )
}
