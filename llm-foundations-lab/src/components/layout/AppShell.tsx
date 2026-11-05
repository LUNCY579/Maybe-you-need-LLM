import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { Link, NavLink } from './CourseLink'
import { useCourseNavigate } from './useCourseNavigate'
import { LESSONS, MODULES, getLesson, lessonNeighbours } from '../../content/curriculum'
import { navigationRoutes, palettePageCommands } from '../../content/routes'
import { buildIndex, KIND_LABEL } from '../../content/searchIndex'
import { buildLearningPath } from '../../core/path'
import { useProgress, useTheme } from '../../state/hooks'
import { useNow } from '../../state/useNow'
import { Badge, Button, ProgressBar } from '../ui/primitives'
import { ShortcutPanel } from './ShortcutPanel'
import { ErrorBoundary } from './ErrorBoundary'
import { RouteFallback } from './RouteFallback'
import { CommandPalette, type PaletteCommand } from './CommandPalette'
import { usePageFocus } from './usePageFocus'

/**
 * Mark the part of a line that matched the query.
 *
 * Without this the reader has to hunt through the snippet for the word they
 * typed, which is the one thing they already know.
 */
function highlight(text: string, query: string) {
  const trimmed = query.trim()
  if (trimmed.length < 2) return text
  const index = text.toLowerCase().indexOf(trimmed.toLowerCase())
  if (index === -1) return text
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-indigo/25 px-0.5 text-fg">{text.slice(index, index + trimmed.length)}</mark>
      {text.slice(index + trimmed.length)}
    </>
  )
}

export function AppShell() {
  const { summary, reviews } = useProgress()
  const { theme, toggle } = useTheme()
  const [query, setQuery] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const location = useLocation()
  const navigate = useCourseNavigate()
  const index = useMemo(() => buildIndex(), [])

  /*
   * The focus follows the page. Without this a reader who follows a link
   * with the keyboard is left with silence, because the browser does not
   * announce a page that a single-page application changed on its own.
   */
  usePageFocus()

  /*
   * How many questions the spaced-repetition scheduler says are ready. The
   * palette offers a review session only when there is something to review.
   */
  const now = useNow()
  const reviewCount = useMemo(() => {    const at = now.getTime()
    /*
      The ids come from the curriculum rather than from the question bank, so
      that the bank — a hundred kilobytes of prose — is not pulled into the
      bundle of every page just to be counted.
    */
    return LESSONS.reduce((total, lesson) => {
      for (const id of lesson.quizIds) {
        const state = reviews[id]
        if (!state) return total + 1
        if (new Date(state.dueAt).getTime() <= at) return total + 1
      }
      return total
    }, 0)
  }, [reviews, now])

  const results = useMemo(() => {    const trimmed = query.trim().toLowerCase()
    if (trimmed.length < 2) return []
    return index
      .map((hit) => {
        const title = hit.title.toLowerCase()
        const detail = hit.detail.toLowerCase()
        const body = hit.searchText ?? []
        // Prefer a match in the title, then the summary line, then the body.
        // The matching body line is kept as a snippet so the reader can see
        // why the entry matched.
        const bodyIndex = body.findIndex((line) => line.toLowerCase().includes(trimmed))
        /*
          A self-explanation question is a long piece of text, and a long
          piece of text matches almost anything. Left alone it would push the
          lesson it belongs to, and the terms it uses, out of the results —
          which is the opposite of what a reader searching for "attention"
          wants. So a question is scored as a body match and never as a
          title match: it is found by what it says, and it never wins.
        */
        const score =
          hit.kind === 'question'
            ? bodyIndex >= 0
              ? 1
              : 0
            : title.startsWith(trimmed)
              ? 4
              : title.includes(trimmed)
                ? 3
                : detail.includes(trimmed)
                  ? 2
                  : bodyIndex >= 0
                    ? 1
                    : 0
        const snippet = bodyIndex >= 0 ? body[bodyIndex] : hit.detail
        return { hit: { ...hit, detail: snippet }, score }
      })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map((entry) => entry.hit)
  }, [query, index])

  // Close the mobile drawer whenever the route changes. Adjusting the state
  // during render (rather than in an effect) keeps the drawer from showing a
  // stale frame for one paint after navigation.
  const [lastPath, setLastPath] = useState(location.pathname)
  if (lastPath !== location.pathname) {
    setLastPath(location.pathname)
    setDrawerOpen(false)
    setQuery('')
  }

  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  /** Which search result the arrow keys have selected. */
  const [activeIndex, setActiveIndex] = useState(0)

  /*
   * The commands the palette offers.
   *
   * These are the things a reader wants to *do* rather than to look at. They
   * are built from the state of the course, so the ones that do not apply are
   * not offered: there is no "start a review session" when nothing is due.
   */
  const commands = useMemo<PaletteCommand[]>(() => {
    const list: PaletteCommand[] = [
      {
        id: 'theme',
        title: theme === 'dark' ? 'Switch to the light theme' : 'Switch to the dark theme',
        detail: 'The colour scheme of the whole course',
        group: 'Command',
        keywords: ['theme', 'colour', 'color', 'dark', 'light', 'appearance'],
        run: toggle,
      },
      {
        id: 'shortcuts',
        title: 'Show the keyboard shortcuts',
        detail: 'Every shortcut in one place',
        group: 'Command',
        keywords: ['keys', 'keyboard', 'shortcut', 'help'],
        run: () => setShortcutsOpen(true),
      },
      /*
        The pages of the course, from the list that also tells the router
        what there is and the audit what to visit. The commands used to be
        written out one by one, and a page added to the course would not have
        appeared in them.
      */
      ...palettePageCommands().map((command) => ({
        id: command.id,
        title: command.title,
        detail: command.detail,
        group: 'Go to',
        keywords: command.keywords,
        run: () => navigate(command.to),
      })),
    ]

    if (reviewCount > 0) {
      list.unshift({
        id: 'review',
        title: `Start a review session (${reviewCount} due)`,
        detail: 'Spaced repetition, scheduled with SM-2',
        group: 'Command',
        keywords: ['review', 'due', 'spaced', 'repetition', 'sm2'],
        run: () => navigate('/review'),
      })
    }

    // The next lesson in the course, from wherever the reader is now.
    const currentLessonId = location.pathname.startsWith('/lessons/')
      ? location.pathname.slice('/lessons/'.length)
      : null
    const { next } = lessonNeighbours(currentLessonId ?? '')
    if (next) {
      list.push({
        id: 'next-lesson',
        title: `Go to the next lesson: ${next.title}`,
        detail: 'The next one in the order the course is taught',
        group: 'Lesson',
        keywords: ['next', 'continue', 'onwards'],
        run: () => navigate(`/lessons/${next.id}`),
      })
    }

    return list
  }, [theme, toggle, navigate, location.pathname, reviewCount])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = document.activeElement?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if (event.key === '/' && !typing) {
        event.preventDefault()
        searchRef.current?.focus()
      }
      /*
       * The command palette, on the same key on each platform. The meta key
       * is Command on a Mac and Control everywhere else.
       */
      if (event.key.toLowerCase() === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault()
        setPaletteOpen((open) => !open)
      }
      if (event.key === '?' && !typing) {
        event.preventDefault()
        setShortcutsOpen((open) => !open)
      }
      if (event.key === 'Escape') {
        setQuery('')
        setShortcutsOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  const totalLessons = LESSONS.length
  // The selection can never point past the end of the result list.
  const selectedIndex = results.length === 0 ? -1 : Math.min(activeIndex, results.length - 1)

  return (
    <div className="min-h-dvh bg-surface text-fg">
      {shortcutsOpen ? <ShortcutPanel onClose={() => setShortcutsOpen(false)} /> : null}
      {/*
        The palette is not in the document while it is closed. A closed
        dialog is invisible, but its text is still in the accessibility
        tree, so a reader who searches for a term would find the palette's
        copy of it as well as the glossary's.
      */}
      {paletteOpen ? (
        <CommandPalette open onClose={() => setPaletteOpen(false)} commands={commands} hits={index} />
      ) : null}
      <a
        href="#main"
        onClick={(event) => {
          /*
           * The application uses a hash router, so a plain `href="#main"`
           * would replace the whole fragment and navigate away from the
           * current route. The link moves the focus instead, which is what a
           * skip link is for.
           */
          event.preventDefault()
          const main = document.getElementById('main')
          main?.focus()
          main?.scrollIntoView({ block: 'start' })
        }}
        className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-indigo-strong focus:px-3 focus:py-2 focus:text-sm focus:text-white"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
        <div className="mx-auto flex max-w-[110rem] items-center gap-3 px-3 py-2.5 sm:px-5">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            aria-expanded={drawerOpen}
            aria-controls="course-navigation"
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <span aria-hidden>☰</span>
            <span className="sr-only">Toggle course navigation</span>
          </Button>

          <Link to="/" className="flex shrink-0 items-center gap-2 no-underline">
            <BrandMark />
            <span className="leading-tight">
              <span className="block font-display text-xs font-semibold tracking-tight text-fg sm:text-sm">
                <span className="hidden sm:inline">LLM Foundations Lab</span>
                <span className="sm:hidden">LLM Lab</span>
              </span>
              <span className="hidden text-[11px] text-faint lg:block">
                Interactive course on how language models work
              </span>
            </span>
          </Link>

          <div className="relative ml-auto min-w-0 flex-1 sm:max-w-md">
            <label className="sr-only" htmlFor="course-search">
              Search lessons, terms and formulas
            </label>
            <input
              id="course-search"
              ref={searchRef}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={(event) => {
                if (results.length === 0) return
                if (event.key === 'ArrowDown') {
                  event.preventDefault()
                  setActiveIndex((current) => Math.min(results.length - 1, current + 1))
                } else if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  setActiveIndex((current) => Math.max(0, current - 1))
                } else if (event.key === 'Enter' && selectedIndex >= 0) {
                  const hit = results[selectedIndex]
                  if (hit) {
                    event.preventDefault()
                    setQuery('')
                    navigate(hit.href)
                  }
                }
              }}
              placeholder="Search the course…  (press / or ⌘K)"
              className="w-full rounded-xl border border-line bg-panel-2 px-3 py-2 text-sm text-fg placeholder:text-faint focus:border-indigo focus:outline-none"
              autoComplete="off"
              role="combobox"
              aria-expanded={query.trim().length >= 2}
              aria-controls="course-search-results"
              aria-activedescendant={
                query.trim().length >= 2 && activeIndex >= 0
                  ? `course-search-option-${selectedIndex}`
                  : undefined
              }
              aria-describedby="course-search-results"
            />
            {query.trim().length >= 2 ? (
              <div
                id="course-search-results"
                role="listbox"
                aria-label="Search results"
                className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-y-auto rounded-2xl border border-line bg-panel p-2 shadow-2xl"
              >
                {results.length === 0 ? (
                  <p className="px-2 py-3 text-sm text-faint">No matches. Try “attention”, “DPO”, “KV cache”.</p>
                ) : (
                  results.map((hit, hitIndex) => (
                    <Link
                      key={`${hit.kind}-${hit.id}`}
                      id={`course-search-option-${hitIndex}`}
                      to={hit.href}
                      role="option"
                      aria-selected={hitIndex === selectedIndex}
                      onClick={() => {
                        setQuery('')
                        setActiveIndex(0)
                      }}
                      onMouseEnter={() => setActiveIndex(hitIndex)}
                      className={`flex items-start gap-2 rounded-xl px-2 py-2 no-underline ${
                        hitIndex === selectedIndex ? 'bg-panel-2' : 'hover:bg-panel-2'
                      }`}
                    >
                        <Badge
                          tone={
                            hit.kind === 'lesson'
                              ? 'indigo'
                              : hit.kind === 'module'
                                ? 'teal'
                                : hit.kind === 'formula'
                                  ? 'amber'
                                  : hit.kind === 'question'
                                    ? 'rose'
                                    : hit.kind === 'status'
                                      ? 'teal'
                                      : 'neutral'
                          }
                        >
                          {KIND_LABEL[hit.kind]}
                        </Badge>
                      <span className="min-w-0">
                        <span className="block text-sm text-fg">{highlight(hit.title, query)}</span>
                        <span className="block text-xs text-faint line-clamp-2" title={hit.detail}>
                          {highlight(hit.detail, query)}
                        </span>
                      </span>
                    </Link>
                  ))
                )}
              </div>
            ) : null}
          </div>

          <div className="hidden items-center gap-3 sm:flex">
            <div className="w-28">
              <ProgressBar
                value={summary.lessonsCompleted}
                max={totalLessons}
                label="Lessons"
                tone="teal"
              />
            </div>
            <Button variant="ghost" size="sm" onClick={toggle} title="Toggle light and dark surfaces">
              <span aria-hidden>{theme === 'dark' ? '☾' : '☀'}</span>
              <span className="sr-only">Toggle colour scheme</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[110rem] gap-6 px-3 py-6 sm:px-5">
        <aside
          id="course-navigation"
          className={`${
            drawerOpen ? 'block' : 'hidden'
          } fixed inset-x-3 top-[4.2rem] z-20 max-h-[75vh] overflow-y-auto rounded-2xl border border-line bg-panel p-3 shadow-2xl lg:static lg:z-0 lg:block lg:max-h-none lg:w-72 lg:shrink-0 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0 lg:shadow-none`}
        >
          <CourseNavigation />
        </aside>

        <main id="main" tabIndex={-1} className="min-w-0 flex-1 pb-16 focus:outline-none">
          {/*
            The page itself is a lazy route, so it is loaded on demand. The
            boundary is here rather than around the whole application so that
            the header and the navigation stay on screen while a page loads.
          */}
          <ErrorBoundary>
            <Suspense fallback={<RouteFallback />}>
              <Outlet />
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      <footer className="border-t border-line bg-surface-2/60 px-3 py-6 sm:px-5">
        <div className="mx-auto flex max-w-[110rem] flex-col gap-3 text-xs text-faint sm:flex-row sm:items-center sm:justify-between">
          <p>
            LLM Foundations Lab — original interactive course material, adapted from{' '}
            <em>Foundations of Large Language Models</em> (Xiao &amp; Zhu, arXiv:2501.09223v4, CC BY-NC 4.0).{' '}
            <Link to="/sources" className="text-indigo underline">
              Sources and licensing
            </Link>
            .
          </p>
          <p>No account. No server. Progress stays in your browser.</p>
        </div>
      </footer>
    </div>
  )
}

function BrandMark() {
  return (
    <svg viewBox="0 0 40 40" className="h-8 w-8 shrink-0" aria-hidden>
      <rect width="40" height="40" rx="10" fill="var(--panel-2)" stroke="var(--line)" />
      <path d="M9 28 C 15 12, 25 12, 31 28" fill="none" stroke="var(--indigo)" strokeWidth="2" />
      <path d="M12 12 C 18 26, 22 26, 28 12" fill="none" stroke="var(--teal)" strokeWidth="2" opacity="0.7" />
      <circle cx="9" cy="28" r="2.6" fill="var(--teal)" />
      <circle cx="31" cy="28" r="2.6" fill="var(--teal)" />
      <circle cx="12" cy="12" r="2.6" fill="var(--amber)" />
      <circle cx="28" cy="12" r="2.6" fill="var(--amber)" />
    </svg>
  )
}

function CourseNavigation() {
  const { isComplete, summary } = useProgress()
  const location = useLocation()
  // A lesson whose prerequisites are not yet met is dimmed, so the sidebar
  // shows where the reader is rather than only where they have been.
  const pathState = useMemo(
    () => new Map(buildLearningPath(LESSONS, isComplete).steps.map((step) => [step.lesson.id, step])),
    [isComplete],
  )

  return (
    <nav aria-label="Course navigation" className="space-y-4">
      <div className="rounded-2xl border border-line bg-panel-2/40 p-3">
        <p className="font-mono text-[11px] uppercase tracking-wider text-faint">Progress</p>
        <p className="mt-1 text-sm text-fg">
          {summary.lessonsCompleted} / {LESSONS.length} lessons · {summary.questionsAnswered} answers
        </p>
        <div className="mt-2">
          <ProgressBar
              value={summary.lessonsCompleted}
              max={LESSONS.length}
              tone="teal"
              ariaLabel={`Course progress: ${summary.lessonsCompleted} of ${LESSONS.length} lessons complete`}
            />
        </div>
      </div>

      <ul className="space-y-4">
        {MODULES.map((module) => (
          <li key={module.id}>
            <Link
              to={`/modules/${module.id}`}
              className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 no-underline hover:bg-panel-2"
            >
              <span className="text-sm font-medium text-fg">
                <span className="mr-1.5 font-mono text-[11px] text-faint">{module.chapter}</span>
                {module.title}
              </span>
              <Badge tone={module.accent}>{module.pages.split('–')[0]}</Badge>
            </Link>
            <ul className="mt-1 space-y-0.5 border-l border-line pl-2">
              {LESSONS.filter((lesson) => lesson.moduleId === module.id).map((lesson) => {
                const active = location.pathname === `/lessons/${lesson.id}`
                const done = isComplete(lesson.id)
                // A lesson whose prerequisites are not yet met gets a hollow
                // number badge instead of a filled one. The distinction is
                // carried by the badge rather than by dimming the text, because
                // dimmed text fails the contrast requirement.
                const step = pathState.get(lesson.id)
                const blocked = step?.status === 'blocked'
                return (
                  <li key={lesson.id}>
                    <NavLink
                      to={`/lessons/${lesson.id}`}
                      title={blocked ? `Waiting on ${step?.blockedBy.join(', ')}` : undefined}
                      className={`flex items-start gap-2 rounded-lg px-2 py-1.5 text-xs no-underline ${
                        active ? 'bg-indigo/10 text-fg' : 'text-muted hover:bg-panel-2 hover:text-fg'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] ${
                          done
                            ? 'bg-teal-strong text-white'
                            : blocked
                              ? 'border border-line bg-transparent text-faint'
                              : 'bg-line-soft text-faint'
                        }`}
                        aria-hidden
                      >
                        {done ? '✓' : lesson.number}
                      </span>
                      <span>{lesson.title}</span>
                    </NavLink>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>

      <div className="space-y-1 border-t border-line pt-3">
        {navigationRoutes().map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `block rounded-lg px-2 py-1.5 text-xs no-underline ${
                isActive ? 'bg-indigo/10 text-fg' : 'text-muted hover:bg-panel-2 hover:text-fg'
              }`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

/** Small helper used by pages that want to label a related lesson. */
export function LessonLink({ lessonId, children }: { lessonId: string; children?: ReactNode }) {
  const lesson = getLesson(lessonId)
  if (!lesson) return null
  return (
    <Link to={`/lessons/${lesson.id}`} className="text-indigo hover:underline">
      {children ?? lesson.title}
    </Link>
  )
}
