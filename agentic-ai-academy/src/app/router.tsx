import { useCallback, useEffect, useMemo, useState } from 'react'

/**
 * Minimal hash router.
 *
 * A dependency-free router keeps the bundle small and makes navigation testable
 * in jsdom (window.location.hash can be manipulated directly). Hash routing also
 * means the built site works from any static host without server rewrites.
 */

export type RouteName =
  | 'home'
  | 'dashboard'
  | 'curriculum'
  | 'lesson'
  | 'labs'
  | 'lab'
  | 'builder'
  | 'assessments'
  | 'glossary'
  | 'references'
  | 'project'
  | 'not-found'

export interface Route {
  name: RouteName
  params: Record<string, string>
  query: URLSearchParams
  /** In-page anchor, without the leading `#`. */
  anchor: string
  /** The full hash, unchanged, e.g. `#/lesson/foo?x=1#section`. */
  hash: string
}

export function parseHash(hash: string): Route {
  const cleaned = hash.replace(/^#\/?/, '')
  // An in-page anchor is the fragment after the last '#'. It must be split off
  // before the path is parsed, otherwise a section anchor would be mistaken
  // for part of a route segment.
  const hashIndex = cleaned.indexOf('#')
  const pathAndQuery = hashIndex === -1 ? cleaned : cleaned.slice(0, hashIndex)
  const anchor = hashIndex === -1 ? '' : cleaned.slice(hashIndex + 1)
  const [pathPart, queryPart] = pathAndQuery.split('?')
  const query = new URLSearchParams(queryPart ?? '')
  const segments = pathPart.split('/').filter(Boolean)
  const [first, second] = segments

  const build = (name: RouteName, params: Record<string, string> = {}): Route => ({
    name,
    params,
    query,
    anchor,
    hash: `#/${segments.join('/')}${queryPart ? `?${queryPart}` : ''}${anchor ? `#${anchor}` : ''}`,
  })

  if (!first) return build('home')
  switch (first) {
    case 'dashboard':
      return build('dashboard')
    case 'curriculum':
      return build('curriculum')
    case 'lesson':
      return second ? build('lesson', { slug: second }) : build('curriculum')
    case 'labs':
      return second ? build('lab', { labId: second }) : build('labs')
    case 'builder':
      return build('builder')
    case 'assessments':
      return build('assessments')
    case 'glossary':
      return build('glossary')
    case 'references':
      return build('references')
    case 'project':
      return build('project')
    default:
      return build('not-found', { path: segments.join('/') })
  }
}

export function navigate(to: string): void {
  const target = to.startsWith('#') ? to : `#${to.startsWith('/') ? '' : '/'}${to}`
  if (typeof window !== 'undefined') {
    window.location.hash = target
  }
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '#/' : window.location.hash || '#/'))

  useEffect(() => {
    const handler = () => setHash(window.location.hash || '#/')
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])

  return useMemo(() => parseHash(hash), [hash])
}

export function useNavigate(): (to: string) => void {
  return useCallback((to: string) => navigate(to), [])
}

export const NAV_ITEMS: { label: string; path: string; description: string }[] = [
  { label: 'Overview', path: '/', description: 'Course introduction' },
  { label: 'Dashboard', path: '/dashboard', description: 'Progress and milestones' },
  { label: 'Curriculum', path: '/curriculum', description: 'Lessons mapped to the book' },
  { label: 'Workflow builder', path: '/builder', description: 'Visual agent workflow editor' },
  { label: 'Labs', path: '/labs', description: 'Planning, memory, world models, multi-agent' },
  { label: 'Assessments', path: '/assessments', description: 'Quiz centre and challenge sets' },
  { label: 'Project', path: '/project', description: 'Final practical project' },
  { label: 'Glossary', path: '/glossary', description: 'Concept reference' },
  { label: 'References', path: '/references', description: 'Sources, citations and licences' },
]
