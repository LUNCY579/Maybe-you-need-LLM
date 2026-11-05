/**
 * A page that always fails, so that the error handling can be exercised.
 *
 * The course has no server, so the only thing between a reader and a blank
 * page is the error boundary. It is worth proving that the boundary works
 * rather than assuming it does: this route throws on purpose, and the
 * end-to-end suite visits it to check that the reader gets the course's own
 * error page — with a way back — rather than a blank screen or the
 * router's plain error page.
 *
 * The route exists only in a development build. A published course has no
 * reason to offer a way to break itself.
 */
export function DiagnosticsPage(): never {
  throw new Error('The diagnostics route was asked to fail, on purpose.')
}

export default DiagnosticsPage
