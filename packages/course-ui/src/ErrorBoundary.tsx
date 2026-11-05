import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

interface State {
  error: Error | null
}

/**
 * The error boundary.
 *
 * A laboratory that throws should not take the whole course down with it. The
 * boundary catches the error, shows what went wrong, and offers a way back.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('course-ui caught an error:', error, info.componentStack)
  }

  override render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="error-boundary" role="alert">
        <h1>Something went wrong in this laboratory</h1>
        <p className="error-message">{error.message}</p>
        <p className="error-hint">
          The rest of the course still works. Reload the page to try again, or use the navigation above to go somewhere
          else.
        </p>
        <button type="button" className="btn btn-primary" onClick={() => this.setState({ error: null })}>
          Try again
        </button>
      </div>
    )
  }
}
