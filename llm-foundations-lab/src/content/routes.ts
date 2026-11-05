/**
 * Every page of the course, declared once.
 *
 * The list used to live in four places: the router, which had to know the
 * path of every page; the navigation, which had to know which pages to
 * offer; the search, which had to know which pages to find; and the
 * end-to-end suite's accessibility audit, which had to know the address of
 * every page it audited. The four drifted, and the way they drifted is
 * worth recording: the pages that were added last — the dashboard, the
 * review session, the status page — were never added to the audit, and a
 * contrast failure on the dashboard went unnoticed for as long as the audit
 * had existed. The status page was missing from the search for a while too.
 *
 * So the list is here, and it is the only list. The router is built from it,
 * the navigation and the search and the palette read it, and the audit
 * visits it. A page that is added to the course is audited, findable and
 * reachable, because being added to the course means being added to this
 * file.
 *
 * The file holds no components, so that a test running outside the browser
 * — the end-to-end suite — can read it.
 */

/** A page of the course. */
export interface CourseRoute {
  /**
   * The path, as it appears after the `#` in the address.
   *
   * A path with a parameter — `:lessonId` — names a family of pages rather
   * than one page, and is given a `sample` to stand for the family.
   */
  path: string
  /** A short name, used in the output of the audit and of the tests. */
  name: string
  /**
   * The address the audit visits, for a route that stands for a family of
   * pages. A route without a parameter is its own sample.
   */
  sample?: string
  /**
   * Whether the accessibility audit should visit this page.
   *
   * A page that is not audited has a reason. The address that is not part of
   * the course is audited — it is a page a reader can reach — but the
   * development-only route that fails on purpose is not, because it fails by
   * design.
   */
  audited: boolean
  /**
   * The label the navigation gives this page, if it has one.
   *
   * A page with no label is not in the navigation: the course home, the
   * module and lesson pages (which the navigation lists by name from the
   * curriculum), and the page that is not part of the course.
   */
  nav?: string
  /**
   * The title and description the search shows for this page.
   *
   * A page with no entry is not in the search. The module and lesson pages
   * are in the search, but they are indexed from the curriculum, which knows
   * more about them than a page list could.
   */
  search?: { title: string; detail: string }
  /**
   * The command the command palette offers for this page.
   *
   * A page with no command is not in the palette. The palette's commands
   * used to be written out one by one, and a page added to the course would
   * not have appeared in it.
   */
  palette?: { title: string; detail: string; keywords: string[] }
}

export const PAGE_ROUTES: CourseRoute[] = [
  {
    path: '/',
    name: 'landing',
    audited: true,
    search: { title: 'Course home', detail: 'Overview and how to use the lab' },
    palette: {
      title: 'Go to the course home',
      detail: 'What the course covers and how to use it',
      keywords: ['home', 'start', 'overview', 'introduction'],
    },
  },
  {
    path: '/dashboard',
    name: 'dashboard',
    audited: true,
    nav: 'Dashboard',
    search: { title: 'Learning dashboard', detail: 'Progress, bookmarks, exports' },
    palette: {
      title: 'Go to the learning dashboard',
      detail: 'Progress, bookmarks and the export button',
      keywords: ['progress', 'dashboard', 'export', 'import'],
    },
  },
  {
    path: '/playground',
    name: 'playground',
    sample: '/playground?lab=sampling',
    audited: true,
    nav: 'Playground',
    search: { title: 'Interactive playground', detail: 'All seven laboratories' },
    palette: {
      title: 'Open the interactive playground',
      detail: 'The seven laboratories',
      keywords: ['lab', 'labs', 'playground', 'explorer', 'sampling'],
    },
  },
  {
    path: '/practice',
    name: 'practice',
    audited: true,
    nav: 'Practice',
    search: { title: 'Practice', detail: 'Quiz runner with feedback' },
    palette: {
      title: 'Open the practice set',
      detail: 'Every question with a diagnosis for every option',
      keywords: ['quiz', 'questions', 'practice', 'test'],
    },
  },
  {
    path: '/review',
    name: 'review',
    audited: true,
    nav: 'Review',
    search: { title: 'Review', detail: 'Spaced-repetition review session' },
    /*
      The review session has no palette command of its own. The one it has
      is conditional: it is offered only when there is something to review,
      and it says how much. A command that offers a review session when
      there is nothing due is a command that lies.
    */
  },
  {
    path: '/glossary',
    name: 'glossary',
    audited: true,
    nav: 'Glossary',
    search: { title: 'Glossary', detail: 'Terms with prerequisites' },
    palette: {
      title: 'Open the glossary',
      detail: 'Terms with their prerequisites',
      keywords: ['glossary', 'terms', 'definitions'],
    },
  },
  {
    path: '/math',
    name: 'math',
    audited: true,
    nav: 'Mathematical reference',
    search: { title: 'Mathematical reference', detail: 'Formulas and notation' },
    palette: {
      title: 'Open the mathematical reference',
      detail: 'Formulas in plain language',
      keywords: ['math', 'maths', 'formula', 'formulas', 'equations'],
    },
  },
  {
    path: '/status',
    name: 'status',
    audited: true,
    nav: 'How settled is this?',
    search: { title: 'How settled is this?', detail: 'What holds, what is moving, and the primary sources' },
    palette: {
      title: 'See how settled the course is',
      detail: 'What holds, what is moving, and the primary sources',
      keywords: ['status', 'settled', 'moving', 'sources', 'confidence', 'up to date'],
    },
  },
  {
    path: '/sources',
    name: 'sources',
    audited: true,
    nav: 'Sources & attribution',
    search: { title: 'Sources and attribution', detail: 'Licensing and provenance' },
    palette: {
      title: 'Open the sources and licensing',
      detail: 'Attribution, terms and the section-by-section source map',
      keywords: ['sources', 'licence', 'license', 'attribution', 'credits', 'provenance'],
    },
  },
  { path: '/modules/:moduleId', name: 'module', sample: '/modules/alignment', audited: true },
  { path: '/lessons/:lessonId', name: 'lesson', sample: '/lessons/generative-transformer', audited: true },
  /*
    The page that says the address is not part of the course. It is a page a
    reader can reach by typing an address that does not exist, so it is
    audited like any other. A course that cannot find its own way home is
    worse than one that never went looking.
  */
  { path: '*', name: 'not-found', sample: '/no-such-page', audited: true },
]

/**
 * The pages the accessibility audit visits.
 *
 * The address it visits is the sample for a route that stands for a family,
 * and the path itself otherwise.
 */
export function auditedRoutes(): { name: string; url: string }[] {
  return PAGE_ROUTES.filter((route) => route.audited).map((route) => ({
    name: route.name,
    url: route.sample ?? route.path,
  }))
}

/**
 * The pages the navigation lists, in the order it lists them.
 *
 * The navigation used to hold its own list, which meant a page could be in
 * the navigation and not in the course, or in the course and not in the
 * navigation, and nothing would say so.
 */
export function navigationRoutes(): { to: string; label: string }[] {
  return PAGE_ROUTES.filter((route) => route.nav).map((route) => ({
    to: route.path,
    label: route.nav as string,
  }))
}

/**
 * The commands the palette offers for the pages of the course.
 *
 * The palette's page commands used to be written out one by one, which meant
 * a page added to the course would not have appeared in it. The review
 * session is deliberately absent: its command is conditional on there being
 * something due, and is built where the count is known.
 */
export function palettePageCommands(): {
  id: string
  title: string
  detail: string
  keywords: string[]
  to: string
}[] {
  return PAGE_ROUTES.filter((route) => route.palette).map((route) => {
    const palette = route.palette as { title: string; detail: string; keywords: string[] }
    return {
      id: `go-${route.name}`,
      title: palette.title,
      detail: palette.detail,
      keywords: palette.keywords,
      to: route.path,
    }
  })
}
