import { describe, expect, it } from 'vitest'
import { PAGE_ROUTES, auditedRoutes, navigationRoutes, palettePageCommands } from './routes'
import { PAGE_LOADERS } from './routeLoaders'
import { MODULES, LESSONS } from './curriculum'
import { STATIC_PAGES, buildIndex } from './searchIndex'
import { MODULE_STATUS } from './status'

/**
 * The list of the course's pages.
 *
 * The list used to be in two places, and the pages added last were not in
 * both. The accessibility audit covered eight routes for a long time, and
 * none of them was the dashboard, the review session or the status page —
 * and a contrast failure on the dashboard went unnoticed for as long as the
 * audit had existed.
 *
 * These tests are what stop that happening again. A page that is added to
 * the course is added to `routes.ts`, and the audit reads that file.
 */

/** The pages that are loaded on demand, and therefore need a loader. */
const LAZY_PATHS = PAGE_ROUTES.filter((route) => route.path !== '/' && route.path !== '*').map(
  (route) => route.path,
)

describe('the pages of the course', () => {
  it('declares each page once', () => {
    const paths = PAGE_ROUTES.map((route) => route.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('gives every page a name, and the names are distinct', () => {
    const names = PAGE_ROUTES.map((route) => route.name)
    for (const name of names) expect(name.length).toBeGreaterThan(0)
    expect(new Set(names).size).toBe(names.length)
  })

  it('writes every path as an address', () => {
    for (const route of PAGE_ROUTES) {
      // The catch-all is the one path that is not an address: it stands for
      // every address that is not one of the others.
      if (route.path === '*') continue
      expect(route.path.startsWith('/'), `${route.name} does not start with a slash`).toBe(true)
    }
  })

  it('gives a route with a parameter a sample to stand for it', () => {
    for (const route of PAGE_ROUTES) {
      if (!route.path.includes(':')) continue
      expect(route.sample, `${route.name} has a parameter and no sample`).toBeTruthy()
    }
  })

  it('has a page behind every page that is loaded on demand', () => {
    for (const path of LAZY_PATHS) {
      expect(PAGE_LOADERS[path], `${path} has no page behind it`).toBeTypeOf('function')
    }
  })

  it('has no page without a page in front of it', () => {
    // A loader with no route is a page nobody can reach, which is a page
    // that is never tested and never audited.
    for (const path of Object.keys(PAGE_LOADERS)) {
      expect(LAZY_PATHS, `${path} is loaded but nothing leads to it`).toContain(path)
    }
  })

  it('does not load the course home on demand', () => {
    // The first page a reader sees should not wait for a network request.
    expect(PAGE_LOADERS['/']).toBeUndefined()
    expect(PAGE_ROUTES.some((route) => route.path === '/')).toBe(true)
  })
})

describe('the pages the accessibility audit visits', () => {
  it('visits every page of the course', () => {
    const audited = auditedRoutes().map((route) => route.url)
    const every = PAGE_ROUTES.map((route) => route.sample ?? route.path)
    for (const url of every) {
      expect(audited, `${url} is not audited`).toContain(url)
    }
  })

  it('visits a page that is not part of the course', () => {
    // The page that says the address is wrong is a page a reader can reach,
    // so it is held to the same standard as the rest.
    expect(auditedRoutes().some((route) => route.name === 'not-found')).toBe(true)
  })

  it('visits a lesson and a module', () => {
    const names = auditedRoutes().map((route) => route.name)
    expect(names).toContain('lesson')
    expect(names).toContain('module')
  })
})

describe('the pages the course can actually reach', () => {
  it('has a route for every module', () => {
    for (const module of MODULES) {
      const url = `/modules/${module.id}`
      expect(auditedRoutes().map((route) => route.url)).toContain('/modules/alignment')
      expect(url.startsWith('/modules/')).toBe(true)
    }
  })

  it('has a route for every lesson', () => {
    // The route is a family — `/lessons/:lessonId` — so the check is that
    // the family is there and that the sample in it is a real lesson.
    const lessonRoute = PAGE_ROUTES.find((route) => route.path === '/lessons/:lessonId')
    expect(lessonRoute).toBeTruthy()
    expect(LESSONS.length).toBeGreaterThan(0)
    const sampleId = lessonRoute?.sample?.split('/').pop() ?? ''
    expect(LESSONS.some((lesson) => lesson.id === sampleId)).toBe(true)
  })
})

describe('the navigation', () => {
  it('lists only pages that exist', () => {
    const paths = PAGE_ROUTES.map((route) => route.path)
    for (const item of navigationRoutes()) {
      expect(paths, `the navigation links to ${item.to}, which is not a page`).toContain(item.to)
    }
  })

  it('gives every page it lists a label', () => {
    for (const item of navigationRoutes()) {
      expect(item.label.length, `${item.to} has no label`).toBeGreaterThan(0)
    }
  })

  it('lists the pages a reader needs to reach', () => {
    const targets = navigationRoutes().map((item) => item.to)
    for (const needed of ['/dashboard', '/practice', '/review', '/glossary', '/status', '/sources']) {
      expect(targets, `${needed} is not in the navigation`).toContain(needed)
    }
  })
})

describe('the search', () => {
  it('finds every page that is in the navigation', () => {
    // A page in the navigation that the search cannot find is a page the
    // reader has to know the name of in order to reach.
    const searchable = STATIC_PAGES.map((page) => page.href)
    for (const item of navigationRoutes()) {
      expect(searchable, `${item.to} is in the navigation but not in the search`).toContain(item.to)
    }
  })

  it('finds every page that is in the course', () => {
    const searchable = STATIC_PAGES.map((page) => page.href)
    for (const route of PAGE_ROUTES) {
      // The module and lesson pages are indexed from the curriculum, and the
      // page that is not part of the course should not be findable.
      if (route.path.includes(':') || route.path === '*') continue
      expect(searchable, `${route.path} is not in the search`).toContain(route.path)
    }
  })

  it('does not offer the page that is not part of the course', () => {
    const searchable = STATIC_PAGES.map((page) => page.href)
    expect(searchable).not.toContain('*')
  })
})

describe('the command palette', () => {
  it('offers a command for every page in the navigation', () => {
    // The review session is the exception, and deliberately: its command is
    // offered only when there is something to review.
    const offered = palettePageCommands().map((command) => command.to)
    for (const item of navigationRoutes()) {
      if (item.to === '/review') continue
      expect(offered, `${item.to} is in the navigation but not in the palette`).toContain(item.to)
    }
  })

  it('offers only commands that lead to a real page', () => {
    const paths = PAGE_ROUTES.map((route) => route.path)
    for (const command of palettePageCommands()) {
      expect(paths, `the palette offers ${command.to}, which is not a page`).toContain(command.to)
    }
  })

  it('gives every command a distinct name', () => {
    const ids = palettePageCommands().map((command) => command.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every command words to be found by', () => {
    for (const command of palettePageCommands()) {
      expect(command.keywords.length, `${command.id} has no keywords`).toBeGreaterThan(0)
      expect(command.title.length, `${command.id} has no title`).toBeGreaterThan(0)
      expect(command.detail.length, `${command.id} has no detail`).toBeGreaterThan(0)
    }
  })
})

describe('the search reaches the currency of each module', () => {
  it('indexes what has moved in every module', () => {
    const hits = buildIndex().filter((hit) => hit.kind === 'status')
    expect(hits.length).toBe(MODULE_STATUS.length)
    for (const hit of hits) {
      expect(hit.searchText?.length, `${hit.id} has nothing to search`).toBeGreaterThan(0)
      expect(hit.href).toContain('/status#')
    }
  })

  it('finds a module by a phrase that only appears in what has moved', () => {
    // "Brevity bias" is named on the status page and nowhere else in the
    // course. A reader who half-remembers it should be able to find it.
    const hits = buildIndex()
    const found = hits.filter((hit) =>
      (hit.searchText ?? []).some((line) => line.toLowerCase().includes('brevity bias')),
    )
    expect(found.length).toBeGreaterThan(0)
    expect(found[0].href).toContain('/status#')
  })
})
