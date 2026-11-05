import { Link } from '../components/layout/CourseLink.tsx'
import { Panel } from '../components/ui/primitives'

export function NotFoundPage({ message }: { message?: string }) {
  return (
    <Panel className="mx-auto max-w-xl text-center">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-amber">404</p>
      <h1 className="mt-2 font-display text-2xl font-semibold text-fg">That page is not part of the course</h1>
      <p className="mt-2 text-sm text-muted">
        {message ?? 'The link may be out of date, or the resource may have moved.'}
      </p>
      <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
        <Link to="/" className="text-indigo hover:underline">
          Course home
        </Link>
        <span className="text-faint">·</span>
        <Link to="/dashboard" className="text-indigo hover:underline">
          Dashboard
        </Link>
        <span className="text-faint">·</span>
        <Link to="/glossary" className="text-indigo hover:underline">
          Glossary
        </Link>
      </div>
    </Panel>
  )
}

export default NotFoundPage
