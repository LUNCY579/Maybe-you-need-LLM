import type { ComponentType } from 'react'

/**
 * The page each route loads.
 *
 * The pages are loaded on demand, so each one is a dynamic import. The map
 * is keyed by the path, and `content/routes.ts` declares the paths, so a
 * route cannot exist without a page behind it — and a page cannot be
 * written without a route in front of it, because the test that checks the
 * two agree would fail.
 *
 * The course home is not in here: it is the one page that is not loaded on
 * demand, because it is the first thing a reader sees and a lazily loaded
 * first page would show an empty frame while it arrived.
 *
 * The file holds no components, only the functions that load them, so that a
 * test running outside the browser can read it.
 */

export interface RouteModule {
  Component: ComponentType
}

export const PAGE_LOADERS: Record<string, () => Promise<RouteModule>> = {
  '/dashboard': async () => ({ Component: (await import('../pages/Dashboard')).DashboardPage }),
  '/modules/:moduleId': async () => ({ Component: (await import('../pages/ModulePage')).ModulePage }),
  '/lessons/:lessonId': async () => ({ Component: (await import('../pages/LessonPage')).LessonPage }),
  '/playground': async () => ({ Component: (await import('../pages/PlaygroundPage')).PlaygroundPage }),
  '/practice': async () => ({ Component: (await import('../pages/PracticePage')).PracticePage }),
  '/review': async () => ({ Component: (await import('../pages/ReviewPage')).ReviewPage }),
  '/glossary': async () => ({ Component: (await import('../pages/GlossaryPage')).GlossaryPage }),
  '/math': async () => ({ Component: (await import('../pages/MathRefPage')).MathRefPage }),
  '/sources': async () => ({ Component: (await import('../pages/SourcesPage')).SourcesPage }),
  '/status': async () => ({ Component: (await import('../pages/StatusPage')).StatusPage }),
}
