import { Suspense, lazy, useEffect, useRef, useState } from 'react'
import { useRoute, type Route } from './app/router'
import { LESSONS } from './content/lessons'
import { AppShell } from './ui/layout/AppShell'
import { ProgressProvider } from './store/progress'
import { ThemeProvider } from './store/theme'
import { LandingPage } from './pages/LandingPage'
import { Card } from './ui/primitives'

/**
 * Heavy interactive surfaces (React Flow, Recharts) are code-split so the
 * reading experience loads quickly on a slow connection.
 */
const WorkflowBuilderPage = lazy(() => import('./pages/builder/WorkflowBuilderPage').then((module) => ({ default: module.WorkflowBuilderPage })))
const PlanningLabPage = lazy(() => import('./pages/labs/PlanningLabPage').then((module) => ({ default: module.PlanningLabPage })))
const MemoryLabPage = lazy(() => import('./pages/labs/MemoryLabPage').then((module) => ({ default: module.MemoryLabPage })))
const WorldModelLabPage = lazy(() => import('./pages/labs/WorldModelLabPage').then((module) => ({ default: module.WorldModelLabPage })))
const MultiAgentLabPage = lazy(() => import('./pages/labs/MultiAgentLabPage').then((module) => ({ default: module.MultiAgentLabPage })))
const PolicyPriorsLabPage = lazy(() => import('./pages/labs/PolicyPriorsLabPage').then((module) => ({ default: module.PolicyPriorsLabPage })))
const MemoryLongevityLabPage = lazy(() => import('./pages/labs/MemoryLongevityLabPage').then((module) => ({ default: module.MemoryLongevityLabPage })))
const ReasoningLabPage = lazy(() => import('./pages/labs/ReasoningLabPage').then((module) => ({ default: module.ReasoningLabPage })))
const AgenticRetrievalLabPage = lazy(() => import('./pages/labs/AgenticRetrievalLabPage').then((module) => ({ default: module.AgenticRetrievalLabPage })))

/**
 * The pages are code-split too.
 *
 * The glossary alone is a quarter of a megabyte — ninety-eight definitions,
 * their relations and the concept graph — and a student who opens the
 * landing page does not need it. Importing the pages eagerly meant every
 * visit downloaded the whole glossary.
 *
 * The landing page is the exception: it is the first thing on screen, and it
 * should not flash a loading card at the student who has just arrived. It is
 * imported eagerly, and it no longer pulls in the concept graph — it only
 * needs a count, and the graph runs a layout simulation.
 */
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((module) => ({ default: module.DashboardPage })))
const CurriculumPage = lazy(() => import('./pages/CurriculumPage').then((module) => ({ default: module.CurriculumPage })))
const LessonPage = lazy(() => import('./pages/LessonPage').then((module) => ({ default: module.LessonPage })))
const AssessmentPage = lazy(() => import('./pages/AssessmentPages').then((module) => ({ default: module.AssessmentPage })))
const GlossaryPage = lazy(() => import('./pages/AssessmentPages').then((module) => ({ default: module.GlossaryPage })))
const LabsIndexPage = lazy(() => import('./pages/AssessmentPages').then((module) => ({ default: module.LabsIndexPage })))
const NotFoundPage = lazy(() => import('./pages/AssessmentPages').then((module) => ({ default: module.NotFoundPage })))
const ProjectPage = lazy(() => import('./pages/AssessmentPages').then((module) => ({ default: module.ProjectPage })))
const ReferencesPage = lazy(() => import('./pages/AssessmentPages').then((module) => ({ default: module.ReferencesPage })))

function LoadingPanel({ label }: { label: string }) {
  return (
    <Card className="p-6" role="status" aria-live="polite">
      <p className="text-sm font-medium">Loading {label}…</p>
      <p className="text-muted mt-1 text-xs">The simulator is fetched on demand to keep the reading experience light.</p>
    </Card>
  )
}

/**
 * Routes that render a large canvas.
 *
 * The workflow builder draws a React Flow graph and the laboratories draw
 * Recharts charts. Both put a lot of SVG on the page.
 */
function isHeavyRoute(route: Route): boolean {
  return route.name === 'builder' || route.name === 'lab'
}

function RouteView() {
  const route = useRoute()
  /*
   * Animate route changes with the View Transition API.
   *
   * The router is a hash router, so a navigation replaces the contents of the
   * page in place. Without a transition the new view simply appears; with one,
   * the two views are cross-faded, which makes the navigation legible rather
   * than instantaneous.
   *
   * The route that is *displayed* is held in state and updated inside the
   * transition callback, because the DOM must not change until the browser has
   * captured the old view. Browsers without the API update immediately, so
   * the fallback is a plain render.
   *
   * The transition is skipped when the destination page is a canvas page.
   * WebKit's renderer crashes when it has to snapshot a canvas-heavy page
   * while the previous canvas-heavy page is still in the top layer, so the
   * transition is only used where it is known to be safe. `?no-vt` turns it off
   * everywhere, which is useful when debugging.
   */
  const [displayed, setDisplayed] = useState<Route>(route)
  const displayedRef = useRef(route)

  useEffect(() => {
    const same =
      displayedRef.current.name === route.name &&
      displayedRef.current.params.slug === route.params.slug &&
      displayedRef.current.params.labId === route.params.labId
    if (same) return

    const update = () => {
      displayedRef.current = route
      setDisplayed(route)
    }

    const start = (document as Document & { startViewTransition?: (cb: () => void) => unknown }).startViewTransition
    const disabled = new URLSearchParams(window.location.search).has('no-vt')
    if (typeof start === 'function' && !disabled && !isHeavyRoute(route)) {
      try {
        start.call(document, update)
        return
      } catch {
        // A transition can be refused if one is already running; fall through
        // to the immediate update.
      }
    }
    update()
  }, [route])

  return <RouteContent route={displayed} />
}

function RouteContent({ route }: { route: Route }) {
  /**
   * Every page is loaded on demand.
   *
   * The Suspense boundary is here rather than around each case, because the
   * fallback should be the same for all of them: a student who has just
   * clicked a link should see that something is arriving, not a blank page.
   */
  return <Suspense fallback={<LoadingPanel label="the page" />}>{renderRoute(route)}</Suspense>
}

function renderRoute(route: Route) {
  switch (route.name) {
    case 'home':
      return <LandingPage />
    case 'dashboard':
      return <DashboardPage />
    case 'curriculum':
      return <CurriculumPage />
    case 'lesson':
      // The key forces a remount when the lesson changes. Navigating between
      // lessons is a hash change, so React would otherwise reconcile the new
      // lesson onto the old lesson's component instances — and a prediction
      // the student had already committed to, or the answers they had already
      // selected, would follow them to the next lesson.
      return <LessonPage key={route.params.slug} slug={route.params.slug} />
    case 'builder':
      return <WorkflowBuilderPage />
    case 'labs':
      return <LabsIndexPage />
    case 'lab': {
      switch (route.params.labId) {
        case 'planning':
          return <PlanningLabPage />
        case 'memory':
          return <MemoryLabPage />
        case 'world-model':
          return <WorldModelLabPage />
        case 'multi-agent':
          return <MultiAgentLabPage />
        case 'policy-priors':
          return <PolicyPriorsLabPage />
        case 'memory-longevity':
          return <MemoryLongevityLabPage />
        case 'reasoning':
          return <ReasoningLabPage />
        case 'retrieval':
          return <AgenticRetrievalLabPage />
        default:
          return <NotFoundPage />
      }
    }
    case 'assessments':
      return <AssessmentPage />
    case 'glossary':
      return <GlossaryPage />
    case 'references':
      return <ReferencesPage />
    case 'project':
      return <ProjectPage />
    default:
      return <NotFoundPage />
  }
}

export default function App() {
  /*
   * Take scroll restoration into our own hands.
   *
   * The browser restores the scroll position on its own when the page loads,
   * and it does that *after* the application has scrolled to a deep link —
   * so a link to a section silently did nothing in Firefox while working in
   * Chromium. With a hash router the browser's idea of "the previous
   * position" is wrong anyway: every route change should go to the top, or
   * to the anchor, and the application already knows which.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || !('scrollRestoration' in window.history)) return
    window.history.scrollRestoration = 'manual'
  }, [])

  return (
    <ThemeProvider>
      <ProgressProvider totalLessons={LESSONS.length}>
        <AppShell>
          <RouteView />
        </AppShell>
      </ProgressProvider>
    </ThemeProvider>
  )
}

/** Small helper retained for tests: sanity-check the router provider boundary. */
export function AppErrorFallback() {
  return (
    <Card className="p-6">
      <h1 className="text-lg font-semibold">Something went wrong rendering this page</h1>
      <p className="text-muted mt-2 text-sm">
        Reload the page to return to the course. Your local progress is stored safely in this browser.
      </p>
    </Card>
  )
}
