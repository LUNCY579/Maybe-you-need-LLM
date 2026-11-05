import { Suspense } from 'react'
import { createHashRouter, redirect } from 'react-router'
import { RouterProvider } from 'react-router/dom'
import { AppShell } from './components/layout/AppShell'
import { RouteFallback } from './components/layout/RouteFallback'
import { ErrorBoundary, RouteErrorElement } from './components/layout/ErrorBoundary'
import { ProgressProvider } from './state/ProgressContext'
import { LandingPage } from './pages/Landing'
import { NotFoundPage } from './pages/NotFound'
import { DiagnosticsPage } from './pages/DiagnosticsPage'
import { PAGE_ROUTES } from './content/routes'
import { PAGE_LOADERS } from './content/routeLoaders'

/*
  The routes are loaded on demand.

  The seven laboratories, the chart library and the KaTeX typesetting add up to
  most of the bundle, and a reader who lands on the course home has no use for
  them yet. Splitting the routes means the home page ships the prose and the
  shell, and the rest arrives when it is first needed.

  The router is a *data* router rather than the declarative one, and that is
  what makes the view transitions possible: React Router's data router waits
  for a lazy route to load before it swaps the page, so the transition
  animates from one real page to another rather than from one page to a
  loading spinner.
*/

const router = createHashRouter([
  {
    /*
      The shell is the layout route. It draws the header and the navigation,
      and the page itself arrives through the outlet below it.
    */
    element: <AppShell />,
    /*
      A data router catches an error in a route itself, so the route needs an
      error element of its own. Without this the reader would get the
      router's plain error page instead of the course's.
    */
    errorElement: <RouteErrorElement />,
    children: [
      /*
        The course home is the one page that is not loaded on demand. It is
        the first thing a reader sees, and a lazily loaded first page would
        show an empty frame while it arrived.
      */
      { index: true, element: <LandingPage /> },
      /*
        Every other page of the course, from the list that also tells the
        end-to-end suite which pages to audit. The pages are built from the
        declaration rather than written out here, so that adding a page to
        the course means adding it in one place — and that place is the one
        the audit reads.
      */
      ...PAGE_ROUTES.filter((route) => route.path !== '/' && route.path !== '*').map((route) => ({
        path: route.path.slice(1),
        hydrateFallbackElement: <RouteFallback />,
        lazy: PAGE_LOADERS[route.path],
      })),
      {
        path: 'lessons',
        // The old address for the course home. A loader that throws a
        // redirect is how a data router sends the reader elsewhere.
        loader: () => {
          throw redirect('/')
        },
      },
      { path: '*', element: <NotFoundPage /> },
      /*
        A route that always fails, so that the end-to-end suite can prove
        the error boundary works. It exists only in a development build: a
        published course has no reason to offer a way to break itself.
      */
      ...(import.meta.env.DEV
        ? [{ path: 'diagnostics/fail', element: <DiagnosticsPage /> }]
        : []),
    ],
  },
])

/**
 * HashRouter is used deliberately: the built site can then be served from any
 * static path (or opened from the file system) without server rewrites.
 */
export default function App() {
  return (
    <ProgressProvider>
      <ErrorBoundary>
        <Suspense fallback={null}>
          <RouterProvider router={router} />
        </Suspense>
      </ErrorBoundary>
    </ProgressProvider>
  )
}
