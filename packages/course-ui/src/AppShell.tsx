import { useEffect, useMemo, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import type { KeyboardEvent as ReactKeyboardEvent, ReactNode } from 'react'
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
  /**
   * Where this course's compiled textbook lives, when it has one — relative to
   * the course, which is how the collection's cross-links already work. The
   * header renders a link to it when the prop is present.
   */
  textbookHref?: string
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
  textbookHref,
  storageKey,
  children,
}: AppShellProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    if (typeof document === 'undefined') return 'dark'
    return document.documentElement.classList.contains('light') ? 'light' : 'dark'
  })
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [menuOpen, setMenuOpen] = useState(false)
  const location = useLocation()
  const navigate = useNavigate()

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
    setActive(0)
  }, [query])

  /* The arrow keys move through the hits; the list keeps the active one visible. */
  useEffect(() => {
    if (!searchOpen) return
    document.getElementById(`search-hit-${active}`)?.scrollIntoView({ block: 'nearest' })
  }, [active, searchOpen])

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

  /*
   * Opening a hit. A hit inside this course is a hash route, so the router
   * takes it without a reload; a hit that lives elsewhere in the collection
   * is a real navigation and gets one.
   */
  const inputRef = useRef<HTMLInputElement>(null)
  const openHit = (hit: SearchDocument) => {
    setSearchOpen(false)
    setQuery('')
    if (hit.href.startsWith('#')) {
      navigate(hit.href.slice(1))
      return
    }
    window.location.assign(hit.href)
  }
  const onSearchKeyDown = (event: ReactKeyboardEvent) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((value) => Math.min(value + 1, hits.length - 1))
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((value) => Math.max(value - 1, 0))
      return
    }
    if (event.key === 'Enter' && hits[active]) {
      event.preventDefault()
      openHit(hits[active].document)
    }
  }

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

        {textbookHref ? (
          <a className="textbook-link" href={textbookHref}>
            Textbook
          </a>
        ) : null}

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
        <div
          className="search-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Search the course"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setSearchOpen(false)
              setQuery('')
            }
          }}
        >
          <div className="search-panel">
            <label className="sr-only" htmlFor="course-search">
              Search the course
            </label>
            <input
              id="course-search"
              className="search-input"
              type="search"
              autoFocus
              ref={inputRef}
              value={query}
              placeholder="Search lessons, terms, equations and questions"
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              aria-activedescendant={hits.length > 0 ? `search-hit-${active}` : undefined}
            />
            {query ? (
              <ul className="search-results">
                {hits.length === 0 ? (
                  <li className="search-empty">Nothing matched “{query}”.</li>
                ) : (
                  hits.map((hit, index) => (
                    <li
                      key={hit.document.id + hit.document.kind}
                      id={`search-hit-${index}`}
                      className={index === active ? 'search-hit-active' : undefined}
                      onMouseEnter={() => setActive(index)}
                    >
                      <a
                        href={hit.document.href}
                        onClick={(event) => {
                          event.preventDefault()
                          openHit(hit.document)
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
              <p className="search-hint">Type to search. ↑ ↓ to move, Enter to open, Escape to close.</p>
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
