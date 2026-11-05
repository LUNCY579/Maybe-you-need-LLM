import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * The error boundary.
 *
 * A scientific tool must not go blank. If a computation throws somewhere deep in
 * a chart, the reader gets an explanation and a way out rather than a white
 * page — and the error is reported with the context needed to reproduce it.
 */
interface Props {
  children: ReactNode;
  /** what the boundary is protecting, for the message */
  label?: string;
  onError?: (error: Error, info: ErrorInfo) => void;
}

interface State {
  error: Error | null;
  info: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    this.setState({ info: info.componentStack ?? null });
    this.props.onError?.(error, info);
  }

  reset = (): void => {
    this.setState({ error: null, info: null });
  };

  render(): ReactNode {
    const { error, info } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="rounded-md border border-signal-red/40 bg-signal-red/10 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-wider text-signal-red">
          {this.props.label ?? 'This section'} failed to render
        </div>
        <p className="mt-1.5 text-[13px] leading-relaxed text-lab-100">
          {error.message || 'An unknown error occurred.'}
        </p>
        <p className="mt-1.5 text-[12px] leading-relaxed text-lab-300">
          This is a bug in the application, not a result. The rest of the page is unaffected; if the section is
          reproducible, the message above is what to report.
        </p>
        {info && (
          <details className="mt-2">
            <summary className="cursor-pointer text-[11.5px] text-lab-400">component stack</summary>
            <pre className="mono mt-1 max-h-40 overflow-auto whitespace-pre-wrap text-[10.5px] text-lab-500">{info}</pre>
          </details>
        )}
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={this.reset}
            className="rounded border border-signal-red/50 bg-signal-red/10 px-3 py-1.5 text-[12px] text-signal-red transition-colors hover:bg-signal-red/20"
          >
            try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded border border-lab-700 bg-lab-900/60 px-3 py-1.5 text-[12px] text-lab-300 transition-colors hover:border-lab-500"
          >
            reload the page
          </button>
        </div>
      </div>
    );
  }
}
