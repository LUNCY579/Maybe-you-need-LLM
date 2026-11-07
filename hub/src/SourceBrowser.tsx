/**
 * The source browser.
 *
 * The catalogue is the collection's backbone: 84 works, each with the licence
 * it was checked under and the way its identifier was verified. A reader who
 * wants to know where a claim comes from should be able to find it in one
 * place, and filter the collection down to what they need.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { CatalogueManifest, CatalogueSource } from '@llm-materials/course-catalogue'

export interface SourceBrowserProps {
  manifest: CatalogueManifest
  /**
   * A source to open, from a search hit elsewhere on the page. The filters
   * yield so the row is visible, the row is scrolled to and highlighted, and
   * the caller is told it has been handled.
   */
  focusSourceId?: string | null
  onFocusHandled?: () => void
}

/** The distinct values of a field, for the filters. */
function distinct(sources: CatalogueSource[], field: 'app' | 'kind' | 'role'): string[] {
  const values = new Set<string>()
  for (const source of sources) values.add(source[field])
  return [...values].sort()
}

export function SourceBrowser({ manifest, focusSourceId, onFocusHandled }: SourceBrowserProps) {
  const [query, setQuery] = useState('')
  const [app, setApp] = useState('all')
  const [kind, setKind] = useState('all')
  const [role, setRole] = useState('all')
  const [highlighted, setHighlighted] = useState<string | null>(null)

  /* Opening a source from a search hit: clear the filters, find the row, point at it. */
  const handled = useRef(onFocusHandled)
  handled.current = onFocusHandled
  useEffect(() => {
    if (!focusSourceId) return
    setQuery('')
    setApp('all')
    setKind('all')
    setRole('all')
    setHighlighted(focusSourceId)
    const timer = window.setTimeout(() => {
      document
        .querySelector(`[data-source-id="${focusSourceId}"]`)
        ?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      handled.current?.()
    }, 80)
    return () => window.clearTimeout(timer)
  }, [focusSourceId])

  const sources = useMemo(() => {
    const lower = query.trim().toLowerCase()
    return manifest.sources.filter((source) => {
      if (app !== 'all' && source.app !== app) return false
      if (kind !== 'all' && source.kind !== kind) return false
      if (role !== 'all' && source.role !== role) return false
      if (lower.length === 0) return true
      return (
        source.title.toLowerCase().includes(lower) ||
        source.authors.join(' ').toLowerCase().includes(lower) ||
        source.venue.toLowerCase().includes(lower) ||
        source.gapClosed.toLowerCase().includes(lower)
      )
    })
  }, [manifest.sources, query, app, kind, role])

  const titles = useMemo(
    () => new Map(manifest.apps.map((entry) => [entry.id, entry.title])),
    [manifest.apps],
  )

  return (
    <div className="catalogue-browser">
      <div className="hub-search-row">
        <div className="field">
          <label className="field-label" htmlFor="source-search">
            Search the catalogue
          </label>
          <input
            id="source-search"
            className="hub-search"
            type="search"
            value={query}
            placeholder="a title, an author, a venue, a gap…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="source-app">
            The course
          </label>
          <select
            id="source-app"
            className="hub-search"
            value={app}
            onChange={(event) => setApp(event.target.value)}
          >
            <option value="all">every course</option>
            {distinct(manifest.sources, 'app').map((value) => (
              <option key={value} value={value}>
                {titles.get(value) ?? value}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="source-kind">
            The kind
          </label>
          <select
            id="source-kind"
            className="hub-search"
            value={kind}
            onChange={(event) => setKind(event.target.value)}
          >
            <option value="all">every kind</option>
            {distinct(manifest.sources, 'kind').map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label className="field-label" htmlFor="source-role">
            The role
          </label>
          <select
            id="source-role"
            className="hub-search"
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            <option value="all">every role</option>
            {distinct(manifest.sources, 'role').map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>
      </div>

      <p className="hub-note">
        {sources.length} of {manifest.sources.length} works.
      </p>

      <ul className="catalogue-source-browser">
        {sources.map((source) => (
          <li
            key={source.id}
            data-source-id={source.id}
            className={
              highlighted === source.id
                ? 'catalogue-source-row catalogue-source-row-focus'
                : 'catalogue-source-row'
            }
          >
            <a className="catalogue-source-row-title" href={source.url} rel="noreferrer">
              {source.title}
            </a>
            <span className="catalogue-source-row-venue">
              {source.authors.join(', ')} · {source.year} · {source.venue}
            </span>
            <span className="catalogue-source-row-course">
              {titles.get(source.app) ?? source.app} · {source.role}
            </span>
            <span className="catalogue-source-row-gap">{source.gapClosed}</span>
            <span className="catalogue-source-row-licence">{source.license}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
