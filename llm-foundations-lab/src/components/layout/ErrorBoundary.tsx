import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

/**
 * The message shown when a view fails to draw.
 *
 * The course has no server, so a render failure would otherwise leave a blank
 * page with no way back. This says what happened and offers a way out.
 *
 * It is used from two places: as a React error boundary around the
 * application, and as the error element of the router. The second one
 * matters more than it looks: a data router catches an error in a route
 * before it reaches any boundary above it, so without an error element of
 * its own the reader would get the router's plain error page instead of this
 * one.
 */
export function ErrorNotice({
  error,
  onRetry,
}: {
  error: unknown
  onRetry?: () => void
}) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-rose/40 bg-rose/5 p-6">
      <p className="font-mono text-[11px] uppercase tracking-wider text-rose">Render error</p>
      <h1 className="mt-1 font-display text-xl font-semibold text-fg">
        Something failed while drawing this view
      </h1>
      <p className="mt-2 text-sm text-muted">
        The rest of the course is unaffected. Nothing was sent anywhere — this application has no server.
      </p>
      <pre className="mt-3 max-h-40 overflow-auto rounded-xl border border-line bg-panel-2 p-3 text-xs text-muted">
        {message}
      </pre>
      <div className="mt-4 flex flex-wrap gap-2">
        {onRetry ? (
          <button
            type="button"
            className="rounded-xl bg-indigo-strong px-3.5 py-2 text-sm text-white"
            onClick={onRetry}
          >
            Try again
          </button>
        ) : null}
        <Link
          to="/"
          className="rounded-xl border border-line bg-panel-2 px-3.5 py-2 text-sm text-fg no-underline"
        >
          Back to course home
        </Link>
      </div>
    </div>
  )
}

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/**
 * Last-resort error boundary.
 *
 * It sits around the whole application, so that a failure in the shell — in
 * the navigation, say — is caught as well as a failure in a page.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Keep the detail in the console for debugging; the UI stays readable.
    console.error('LLM Foundations Lab render error', error, info.componentStack)
  }

  render(): ReactNode {
    if (this.state.error) {
      return <ErrorNotice error={this.state.error} onRetry={() => this.setState({ error: null })} />
    }
    return this.props.children
  }
}

/**
 * The router's error element.
 *
 * A data router catches an error in a route itself, so this is where a
 * failed page ends up. Without it the reader would get the router's own
 * error page, which knows nothing about this course.
 */
/**
 * The router's error element.
 *
 * A data router catches an error in a route itself, so this is where a
 * failed page ends up. Without it the reader would get the router's own
 * error page, which knows nothing about this course.
 *
 * The router passes the error and a way to try again when it renders this
 * element, so the props are optional here: the element is written without
 * them and the router fills them in.
 */
export function RouteErrorElement({
  error,
  resetErrorBoundary,
}: {
  error?: unknown
  resetErrorBoundary?: () => void
}) {
  return <ErrorNotice error={error} onRetry={resetErrorBoundary} />
}
export default ErrorBoundary
