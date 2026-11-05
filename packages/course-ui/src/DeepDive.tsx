import type { ReactNode } from 'react'

/**
 * One entry for a laboratory's "go deeper" panel.
 *
 * The panel is the deep record behind the laboratory's numbers: the mechanism
 * in prose, where it is used in the world, and what is still open. Every item
 * names its own honesty: nothing here is a measurement of a real deployment,
 * and a laboratory whose technique has no deployment yet should say so.
 */
export interface DeepDiveItem {
  /** A short handle: a product, a paper, a technique, or an open question. */
  name: string
  /** One or two sentences: what it is, and why it matters. */
  detail: string
}

export interface DeepDiveContent {
  /**
   * Two to four paragraphs, tight: the mechanism, why it is not obvious, and
   * what breaks when the assumption that carries it fails.
   */
  elaboration: string[]
  /**
   * Where this is used in the world today. Four or more; when none exists,
   * say that, and name the nearest real thing.
   */
  applications: DeepDiveItem[]
  /**
   * Open problems and research directions the laboratory invites: honest
   * questions, not wish-list items. Four or more.
   */
  researchDirections: DeepDiveItem[]
}

function DeepDiveList({
  id,
  title,
  lede,
  items,
}: {
  id: string
  title: string
  lede: string
  items: DeepDiveItem[]
}) {
  return (
    <section className="deep-dive-col" aria-labelledby={id}>
      <h3 id={id} className="deep-dive-col-title">
        {title}
      </h3>
      <p className="deep-dive-lede">{lede}</p>
      <ul className="deep-dive-list">
        {items.map((item) => (
          <li key={item.name} className="deep-dive-item">
            <strong className="deep-dive-item-name">{item.name}</strong>
            <span className="deep-dive-item-detail">{item.detail}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/**
 * The "go deeper" panel.
 *
 * Rendered beneath a laboratory, not inside it: the laboratory computes, the
 * panel explains. Everything is prose, lists and headings, so it is readable
 * without the lab running, reachable by keyboard, and printable.
 */
export function DeepDive({ data, labId }: { data: DeepDiveContent | undefined; labId: string }): ReactNode {
  if (!data) return null

  const baseId = `deep-dive-${labId}`

  return (
    <section className="deep-dive" aria-labelledby={`${baseId}-title`}>
      <header className="deep-dive-head">
        <p className="deep-dive-kicker">Go deeper</p>
        <h2 id={`${baseId}-title`} className="deep-dive-title">
          Why it works, where it shows up, what is still open
        </h2>
      </header>

      <div className="deep-dive-elaboration">
        {data.elaboration.map((paragraph, index) => (
          <p key={index}>{paragraph}</p>
        ))}
      </div>

      <div className="deep-dive-grid">
        <DeepDiveList
          id={`${baseId}-applications`}
          title="Applications"
          lede="Where this work does real tasks today, and what is only close enough to count."
          items={data.applications}
        />
        <DeepDiveList
          id={`${baseId}-research`}
          title="Future-inspired research"
          lede="Open problems this laboratory makes concrete — starting points, not finished claims."
          items={data.researchDirections}
        />
      </div>
    </section>
  )
}
