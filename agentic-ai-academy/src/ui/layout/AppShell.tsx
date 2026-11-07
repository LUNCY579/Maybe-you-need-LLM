import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { NAV_ITEMS, navigate, useRoute } from '../../app/router'
import { useTheme } from '../../store/theme'
import { useProgress } from '../../store/progress'
import { Badge, Button, LiveRegion, cn } from '../primitives'
import { BOOK } from '../../content/book'
import { CloseIcon, KeyboardIcon, MenuIcon, MoonIcon, SearchIcon, SunIcon } from '../Icon'
import { SearchDialog } from '../search/SearchDialog'
import { ShortcutHelp } from '../shortcuts/ShortcutHelp'

export function AppShell({ children }: { children: ReactNode }) {
  const route = useRoute()
  const { theme, toggle } = useTheme()
  const { completionRatio, completedCount, totalLessons } = useProgress()
  const [menu, setMenu] = useState<{ open: boolean; hash: string }>({ open: false, hash: '' })
  const [searchOpen, setSearchOpen] = useState(false)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [announcement, setAnnouncement] = useState('')
  const mainRef = useRef<HTMLElement>(null)
  const searchButtonRef = useRef<HTMLButtonElement>(null)

  /**
   * The mobile menu is only open for the route it was opened on.
   *
   * Deriving `menuOpen` from the current hash means navigating closes the
   * menu without an effect that pushes state during the commit phase.
   */
  const menuOpen = menu.open && menu.hash === route.hash
  const setMenuOpen = (open: boolean) => setMenu({ open, hash: route.hash })

  const isActive = (path: string) => {
    if (path === '/') return route.name === 'home'
    if (path === '/labs') return route.name === 'labs' || route.name === 'lab'
    return route.hash.startsWith(`#${path}`)
  }

  /**
   * Skip link.
   *
   * A plain `href="#main-content"` would be captured by the hash router and
   * routed to the 404 page, so the link is a button that moves focus to the
   * main landmark instead.
   */
  const skipToContent = useCallback(() => {
    const main = mainRef.current
    if (!main) return
    main.focus()
    main.scrollIntoView({ block: 'start' })
  }, [])

  // Global shortcuts for course search.
  //
  // Cmd/Ctrl+K is the convention, but browsers reserve it (Chrome focuses the
  // omnibox, Firefox focuses its search bar), so "/" is supported as well —
  // it is not a browser shortcut and it is what most command palettes fall
  // back to. The visible search button remains the primary, always-available
  // route.
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable === true

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setSearchOpen((current) => !current)
        return
      }
      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setSearchOpen(true)
        return
      }
      if (event.key === '?' && !typing && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault()
        setShortcutsOpen(true)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Navigating from a link closes the mobile menu.
  const go = (path: string) => {
    navigate(path)
    setMenu({ open: false, hash: '' })
  }

  return (
    <div className="app-backdrop min-h-screen">
      <a
        href="#main-content"
        onClick={(event) => {
          event.preventDefault()
          skipToContent()
        }}
        className="focus-ring sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded focus:bg-slate-900 focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>

      <header className="surface sticky top-0 z-40 border-b backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3">
          <button
            type="button"
            className="focus-ring flex items-center gap-2 text-left"
            onClick={() => go('/')}
            title="Agentic AI Academy home"
          >
            <span
              aria-hidden
              className="grid h-9 w-9 place-items-center rounded-xl text-slate-950"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-2))' }}
            >
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
                <circle cx="6" cy="6" r="2.6" />
                <circle cx="18" cy="8" r="2.6" />
                <circle cx="10" cy="18" r="2.6" />
                <path d="M8.2 7.4 15.6 7.8M7.4 8.4 8.9 15.5M16.6 10.2 11.8 16.1" />
              </svg>
            </span>
            <span>
              <span className="block text-sm font-semibold">Agentic AI Academy</span>
              <span className="text-muted block text-[11px]">Interactive course on {BOOK.title}</span>
            </span>
          </button>

          <nav aria-label="Primary" className="order-3 hidden w-full lg:order-2 lg:ml-6 lg:block lg:w-auto">
            <ul className="flex flex-wrap gap-1">
              {NAV_ITEMS.map((item) => (
                <li key={item.path}>
                  <button
                    type="button"
                    onClick={() => go(item.path)}
                    aria-current={isActive(item.path) ? 'page' : undefined}
                    title={item.description}
                    className={cn(
                      'focus-ring rounded-lg px-2.5 py-1.5 text-xs transition',
                      isActive(item.path) ? 'text-slate-950' : 'text-muted hover:text-white',
                    )}
                    style={isActive(item.path) ? { background: 'var(--accent)' } : undefined}
                  >
                    {item.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>

          <div className="order-2 ml-auto flex items-center gap-2 lg:order-3">
            <Badge tone="cyan" className="hidden sm:inline-flex">
              {completedCount}/{totalLessons} lessons · {Math.round(completionRatio * 100)}%
            </Badge>
            <div className="flex items-center gap-1.5">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSearchOpen(true)}
                ref={searchButtonRef}
                aria-label="Search the course"
                aria-haspopup="dialog"
              >
                <SearchIcon />
                <span className="hidden sm:inline">Search</span>
              </Button>
              <kbd
                aria-hidden
                className="hidden rounded border px-1 text-[10px] md:inline"
                style={{ borderColor: 'var(--border-soft)' }}
              >
                Ctrl K
              </kbd>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="hidden md:inline-flex"
              onClick={() => setShortcutsOpen(true)}
              aria-label="Show the keyboard shortcuts"
              title="Keyboard shortcuts (?)"
            >
              <KeyboardIcon />
              <span className="hidden lg:inline">Shortcuts</span>
            </Button>
            <a
              href="../textbooks/agentic-ai-academy.html"
              className="focus-ring inline-flex items-center rounded-lg px-3.5 py-2 text-sm no-underline"
              style={{ border: '1px solid var(--border-soft)', color: 'var(--text-strong)' }}
            >
              Textbook
            </a>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const next = theme === 'dark' ? 'light' : 'dark'
                toggle()
                setAnnouncement(`Switched to ${next} theme.`)
              }}
              aria-label={`${theme === 'dark' ? 'Dark' : 'Light'} theme — switch to ${theme === 'dark' ? 'light' : 'dark'}`}
            >
              {theme === 'dark' ? <MoonIcon /> : <SunIcon />}
              {theme === 'dark' ? 'Dark' : 'Light'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="lg:hidden"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-controls="primary-navigation"
              aria-label={menuOpen ? 'Close — close the navigation menu' : 'Menu — open the navigation menu'}
            >
              {menuOpen ? <CloseIcon /> : <MenuIcon />}
              {menuOpen ? 'Close' : 'Menu'}
            </Button>
          </div>

          {menuOpen ? (
            <nav
              id="primary-navigation"
              aria-label="Primary (mobile)"
              className="order-4 w-full lg:hidden"
            >
              <ul className="grid grid-cols-2 gap-1 sm:grid-cols-3">
                {NAV_ITEMS.map((item) => (
                  <li key={item.path}>
                    <button
                      type="button"
                      onClick={() => go(item.path)}
                      aria-current={isActive(item.path) ? 'page' : undefined}
                      className={cn(
                        'focus-ring w-full rounded-lg border px-2.5 py-2 text-left text-xs transition',
                        isActive(item.path) ? 'text-slate-950' : 'text-muted',
                      )}
                      style={
                        isActive(item.path)
                          ? { background: 'var(--accent)', borderColor: 'transparent' }
                          : { borderColor: 'var(--border-soft)' }
                      }
                    >
                      <span className="block font-medium">{item.label}</span>
                      <span className="mt-0.5 block text-[10px] opacity-80">{item.description}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </div>
      </header>

      {/*
        The main area is at least a screen tall.

        Two reasons. A short page should not have its footer floating in the
        middle of the window with a band of empty space below it. And — less
        obviously — WebKit's renderer crashes when a View Transition has to
        snapshot a page that does not scroll, which is exactly what a page
        shorter than the window is. The crash was reproducible on every
        navigation away from the assessment centre's review tab.
      */}
      <main
        id="main-content"
        ref={mainRef}
        tabIndex={-1}
        className="mx-auto min-h-[100dvh] max-w-7xl px-4 py-8 focus:outline-none"
      >
        {children}
      </main>

      <footer className="surface border-t">
        <div className="mx-auto max-w-7xl px-4 py-6 text-xs">
          <p className="text-muted">
            Course content is derived from <strong>{BOOK.title}</strong> by {BOOK.authors.join(', ')} ({BOOK.arxivId}). See{' '}
            <button type="button" className="focus-ring underline" onClick={() => go('/references')}>
              references and licences
            </button>{' '}
            for provenance, source links and third-party licence notes.
          </p>
          <p className="text-muted mt-2">
            All simulations are deterministic, scripted teaching instruments. No deployed AI model is contacted, and progress is stored only in this
            browser.
          </p>
        </div>
      </footer>

      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <ShortcutHelp open={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
      <LiveRegion message={announcement} />
    </div>
  )
}
