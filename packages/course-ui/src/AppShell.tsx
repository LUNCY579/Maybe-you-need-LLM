import { useEffect, useMemo, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import { buildSearchIndex, search } from '@llm-materials/course-core'
import type { SearchDocument } from '@llm-materials/course-core'

/**
 * The shared shell.
 *
 * Every course in this collection has the same chrome: a header, a navigation, a
 * search that reaches every lesson, term, equation and question, a footer that
 * says what the course does and does not redistribute, and a theme that is
 * decided before the first paint.
 *
 * What differs between courses — the name, the navigation, the search corpus,
 * the footer — is passed in.
 */

export interface NavItem {
  to: string
  label: string
}

export interface AppShellProps {
  /** The course name, shown in the header. */
  title: string
  /** One line under the name. */
  subtitle: string
  /** The navigation entries. */
  nav: NavItem[]
  /**
   * The documents the search reaches.
   *
   * The corpus is built by the course, because only the course knows what it
   * contains; the ranking and the interaction belong here.
   */
  searchDocuments: () => SearchDocument[]
  /**
   * How each kind of document is weighted in the search results.
   *
   * The lesson that teaches a topic is a better answer to a query than the
   * exercise that tests it.
   */
  searchKindWeights?: Record<string, number>
  /** The footer's first paragraph. */
  footer: ReactNode
  /** The footer's second paragraph. */
  footerMeta?: ReactNode
  /** The localStorage key the theme is stored under. */
  storageKey: string
  children: ReactNode
}

export function AppShell({
  title,
  subtitle,
  nav,
  searchDocuments,
  searchKindWeights,
  footer,
  footerMeta,
  storageKey,
  children,
}: AppShellProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'dark'
    return document.documentElement.classList.contains('light') ? 'light' : 'dark'
  })
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    document.documentElement.classList.toggle('light', theme === 'light')
    document.documentElement.classList.toggle('dark', theme !== 'light')
    try {
      localStorage.setItem(storageKey, theme)
    } catch {
      /* storage may be unavailable; the theme still applies for this session */
    }
  }, [theme, storageKey])

  useEffect(() => {
    setMenuOpen(false)
  }, [location.pathname])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === '/' && !(event.target instanceof HTMLInputElement)) {
        event.preventDefault()
        setSearchOpen(true)
      }
      if (event.key === 'Escape') setSearchOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const documents = useMemo(() => buildSearchIndex(searchDocuments()), [searchDocuments])

  const hits = useMemo(
    () => search(documents, query, { limit: 12, kindWeights: searchKindWeights }),
    [documents, query, searchKindWeights],
  )

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to the content
      </a>

      <header className="app-header">
        <button
          type="button"
          className="menu-toggle"
          aria-expanded={menuOpen}
          aria-controls="primary-navigation"
          onClick={() => setMenuOpen((value) => !value)}
        >
          <span className="sr-only">Toggle the navigation</span>
          <span aria-hidden="true">☰</span>
        </button>

        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            ∿
          </span>
          <span className="brand-text">
            <span className="brand-title">{title}</span>
            <span className="brand-subtitle">{subtitle}</span>
          </span>
        </div>

        <button type="button" className="search-button" onClick={() => setSearchOpen(true)}>
          <span aria-hidden="true">⌕</span> Search <kbd>/</kbd>
        </button>

        <button
          type="button"
          className="theme-toggle"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={`Switch to the ${theme === 'dark' ? 'light' : 'dark'} theme`}
        >
          <span aria-hidden="true">{theme === 'dark' ? '☀' : '☾'}</span>
        </button>
      </header>

      <nav id="primary-navigation" className={menuOpen ? 'app-nav app-nav-open' : 'app-nav'} aria-label="Primary">
        {nav.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) => (isActive ? 'nav-link nav-link-active' : 'nav-link')}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>

      <main id="main" className="app-main">
        {children}
      </main>

      <footer className="app-footer">
        <p>{footer}</p>
        {footerMeta ? <p className="footer-meta">{footerMeta}</p> : null}
      </footer>

      {searchOpen ? (
        <div className="search-overlay" role="dialog" aria-modal="true" aria-label="Search the course">
          <div className="search-panel">
            <label className="sr-only" htmlFor="course-search">
              Search the course
            </label>
            <input
              id="course-search"
              className="search-input"
              type="search"
              autoFocus
              value={query}
              placeholder="Search lessons, terms, equations and questions"
              onChange={(event) => setQuery(event.target.value)}
            />
            {query ? (
              <ul className="search-results">
                {hits.length === 0 ? (
                  <li className="search-empty">Nothing matched “{query}”.</li>
                ) : (
                  hits.map((hit) => (
                    <li key={hit.document.id + hit.document.kind}>
                      <a
                        href={hit.document.href}
                        onClick={() => {
                          setSearchOpen(false)
                          setQuery('')
                        }}
                      >
                        <span className="search-kind">{hit.document.kind}</span>
                        <span className="search-title">{hit.document.title}</span>
                        <span className="search-summary">{hit.document.summary}</span>
                      </a>
                    </li>
                  ))
                )}
              </ul>
            ) : (
              <p className="search-hint">Type to search. Press Escape to close.</p>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => setSearchOpen(false)}>
              Close
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
