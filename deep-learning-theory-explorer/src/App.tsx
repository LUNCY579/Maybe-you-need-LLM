import { NavLink, Route, Routes } from 'react-router-dom';
import { Suspense, lazy, useEffect, useState } from 'react';
import { Overview } from './pages/Overview';
import { Prerequisites } from './pages/Prerequisites';
import { LessonsPage, LessonReader } from './pages/LessonsPage';
import { GalleryPage } from './pages/GalleryPage';
import { EquationsPage } from './pages/EquationsPage';
import { QuizPage } from './pages/QuizPage';
import { DashboardPage } from './pages/DashboardPage';
import { SourcesPage } from './pages/SourcesPage';
import { LABS } from './content/labs';
import { LAB_SCREENS } from './pages/labs';
import { SOURCE } from './content/references';
import { useSharedSetup } from './lib/sharedSetup';
import { GlobalSearch } from './components/GlobalSearch';
import { CommandPalette } from './components/CommandPalette';
import { ShortcutOverlay } from './components/ShortcutOverlay';
import { MobileSectionNav } from './components/MobileSectionNav';
import { useTheme } from './lib/useTheme';

/**
 * The heavier screens are loaded on demand.
 *
 * The curriculum is the thing a reader arrives for, and the laboratories are
 * the thing they arrive *from*; splitting them keeps the first paint small and
 * lets a reader on a slow connection start reading immediately.
 */
const AtlasPageLazy = lazy(() => import('./pages/AtlasPage').then((m) => ({ default: m.AtlasPage })));
const DiagnosticsPageLazy = lazy(() => import('./pages/DiagnosticsPage').then((m) => ({ default: m.DiagnosticsPage })));
const ReadingPageLazy = lazy(() => import('./pages/ReadingPage').then((m) => ({ default: m.ReadingPage })));

/** The application shell: fixed navigation rail plus the active screen. */

/** Shown while a lazily-loaded screen arrives. */
function ScreenLoading() {
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-16 text-[13px] text-lab-400">
      <span className="inline-block h-3 w-3 animate-pulse rounded-full bg-signal-blue" />
      loading…
    </div>
  );
}
const NAV: Array<{ group: string; items: Array<{ to: string; label: string; hint: string }> }> = [
  {
    group: 'Course',
    items: [
      { to: '/', label: 'Overview', hint: 'What this laboratory is and how to use it' },
      { to: '/prerequisites', label: 'Prerequisites', hint: 'Mathematical toolkit navigator' },
      { to: '/lessons', label: 'Lessons', hint: 'Ten lessons mapped to the source' },
      { to: '/atlas', label: 'Theory atlas', hint: 'Every concept of the monograph, one place' },
      { to: '/reading', label: 'Further reading', hint: 'The literature the course is built on' },
    ],
  },
  // The laboratories come from the registry, so a screen cannot be reachable
  // here and missing there, or the other way round.
  {
    group: 'Laboratories',
    items: LABS.map((lab) => ({ to: lab.route, label: lab.name, hint: lab.blurb })),
  },
  {
    group: 'Reference & assessment',
    items: [
      { to: '/gallery', label: 'Experiment gallery', hint: 'Predefined reproducible experiments' },
      { to: '/equations', label: 'Equation explorer', hint: 'Formulas, symbols, assumptions' },
      { to: '/quiz', label: 'Quiz', hint: 'Twenty assessment questions' },
      { to: '/dashboard', label: 'Dashboard', hint: 'Your progress and experiment log' },
      { to: '/sources', label: 'Sources & licensing', hint: 'Attribution, originality, and the scientific-integrity policy' },
      { to: '/diagnostics', label: 'Self-test', hint: 'Check this browser against the theory' },
    ],
  },
];

export function App() {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const { reset: resetSetup } = useSharedSetup();
  const { theme, toggle: toggleTheme } = useTheme();

  // ⌘K / Ctrl-K opens the command palette from anywhere; ? lists the
  // shortcuts. Neither fires while the reader is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable === true;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
        return;
      }
      if (typing) return;
      if (e.key === '?') {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      {/*
        A keyboard reader should not have to walk the whole navigation rail to
        reach the page. The link is the first thing in the document, invisible
        until it is focused. It moves the focus itself rather than using a
        fragment, because the fragment belongs to the router here.
      */}
      <a
        href="#content"
        onClick={(e) => {
          e.preventDefault();
          const main = document.getElementById('content');
          main?.focus();
          main?.scrollIntoView({ block: 'start' });
        }}
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[70] focus:rounded focus:border focus:border-signal-blue/60 focus:bg-lab-900 focus:px-3 focus:py-2 focus:text-[12.5px] focus:text-signal-blue"
      >
        Skip to the content
      </a>
      <div className="flex min-h-screen bg-lab-950">
      <nav className="hidden w-64 shrink-0 border-r border-lab-800 bg-lab-900/60 p-4 lg:block">
        <div className="mb-5">
          <div className="text-[13px] font-semibold leading-tight text-lab-100">Deep Learning Theory Explorer</div>
          <div className="mt-1 text-[11px] leading-snug text-lab-400">
            An interactive laboratory for {SOURCE.shortTitle}
          </div>
        </div>
        <div className="space-y-5">
          {NAV.map((section) => (
            <div key={section.group}>
              <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wider text-lab-500">{section.group}</div>
              <ul className="space-y-0.5">
                {section.items.map((item) => (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      title={item.hint}
                      className={({ isActive }) =>
                        `block rounded px-2 py-1 text-[12.5px] transition-colors ${
                          isActive ? 'bg-signal-blue/15 text-signal-blue' : 'text-lab-300 hover:bg-lab-800 hover:text-lab-100'
                        }`
                      }
                      end={item.to === '/'}
                    >
                      {item.label}
                    </NavLink>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-6 border-t border-lab-800 pt-3 text-[10.5px] leading-snug text-lab-500">
          Numerical results throughout this app are computed in your browser. Sources are cited per page; no text or
          figure from the book is reproduced. See <NavLink to="/sources" className="underline decoration-dotted">Sources &amp; licensing</NavLink>.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <a
            href="../hub/textbooks/deep-learning-theory-explorer.html"
            className="shrink-0 rounded border border-lab-700 bg-lab-900/70 px-2 py-1 text-[11px] text-lab-300 no-underline transition-colors hover:border-signal-blue hover:text-signal-blue"
          >
            Textbook
          </a>
          <div className="min-w-0 flex-1">
            <GlobalSearch />
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            title={`Switch to the ${theme === 'dark' ? 'light' : 'dark'} theme`}
            aria-label={`Switch to the ${theme === 'dark' ? 'light' : 'dark'} theme`}
            className="shrink-0 rounded border border-lab-700 bg-lab-900/70 px-2 py-1 text-[11px] text-lab-300 transition-colors hover:border-signal-blue hover:text-signal-blue"
          >
            {theme === 'dark' ? '☾' : '☀'}
          </button>
        </div>
      </nav>

      <main id="content" tabIndex={-1} className="min-w-0 flex-1 focus:outline-none">
        <div className="border-b border-lab-800 bg-lab-900/50 lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 pt-2">
            <div className="text-[12px] font-semibold text-lab-100">Deep Learning Theory Explorer</div>
            <GlobalSearch ariaLabel="Search the course (compact)" />
          </div>
          {/* The rail is hidden below lg, so small screens get a scrollable strip of the same links. */}
          <MobileSectionNav items={NAV.flatMap((section) => section.items)} />
        </div>
        <div className="mx-auto max-w-[1400px] p-4 lg:p-6">
          <Suspense fallback={<ScreenLoading />}>
            <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/prerequisites" element={<Prerequisites />} />
            <Route path="/lessons" element={<LessonsPage />} />
            <Route path="/lessons/:lessonId" element={<LessonReader />} />
            <Route path="/atlas" element={<AtlasPageLazy />} />
            <Route path="/reading" element={<ReadingPageLazy />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/equations" element={<EquationsPage />} />
            <Route path="/quiz" element={<QuizPage />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/sources" element={<SourcesPage />} />
            <Route path="/diagnostics" element={<DiagnosticsPageLazy />} />
            {LABS.map((lab) => {
              const Screen = LAB_SCREENS[lab.id];
              return <Route key={lab.id} path={lab.route} element={Screen ? <Screen /> : null} />;
            })}
            <Route path="*" element={<Overview />} />
            </Routes>
          </Suspense>
        </div>
      </main>
      </div>
      {paletteOpen && (
        <CommandPalette
          onResetSetup={() => {
            resetSetup();
          }}
          onClose={() => setPaletteOpen(false)}
        />
      )}
      {shortcutsOpen && <ShortcutOverlay onClose={() => setShortcutsOpen(false)} />}
    </>
  );
}
