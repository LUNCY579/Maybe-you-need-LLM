/**
 * The collection's glossary.
 *
 * The concept index is the ideas more than one course teaches, and this page
 * is where they are read: the idea, what it is, and the courses it stands on.
 * A reader who meets a term in one course can see where else it is taught,
 * which is what turns a pile of courses into a curriculum.
 */

import { useMemo, useState } from 'react'
import { CONCEPTS, type CatalogueManifest } from '@llm-materials/course-catalogue'

export function GlossaryPage({ manifest }: { manifest: CatalogueManifest }) {
  const [query, setQuery] = useState('')
  const [sharedOnly, setSharedOnly] = useState(true)

  const titles = useMemo(
    () => new Map(manifest.apps.map((app) => [app.id, app.title])),
    [manifest.apps],
  )

  const concepts = useMemo(() => {
    const lower = query.trim().toLowerCase()
    return CONCEPTS.filter((concept) => {
      if (sharedOnly && concept.courses.length < 2) return false
      if (lower.length === 0) return true
      return (
        concept.term.toLowerCase().includes(lower) || concept.summary.toLowerCase().includes(lower)
      )
    })
  }, [query, sharedOnly])

  return (
    <div className="catalogue-browser">
      <div className="hub-search-row">
        <div className="field">
          <label className="field-label" htmlFor="glossary-search">
            Search the glossary
          </label>
          <input
            id="glossary-search"
            className="hub-search"
            type="search"
            value={query}
            placeholder="a term or a definition…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="field">
          <span className="field-label">The scope</span>
          <button
            type="button"
            className={sharedOnly ? 'btn btn-primary' : 'btn btn-default'}
            onClick={() => setSharedOnly(!sharedOnly)}
          >
            {sharedOnly ? 'The shared ideas' : 'Every idea'}
          </button>
        </div>
      </div>

      <p className="hub-note">
        {concepts.length} of {CONCEPTS.length} ideas.
      </p>

      <ul className="catalogue-glossary">
        {concepts.map((concept) => (
          <li key={concept.id} className="catalogue-glossary-entry">
            <span className="catalogue-glossary-term">{concept.term}</span>
            <span className="catalogue-glossary-summary">{concept.summary}</span>
            <span className="catalogue-glossary-courses">
              {concept.courses.map((course) => titles.get(course) ?? course).join(' · ')}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
