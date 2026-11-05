/**
 * `@llm-materials/course-ui`
 *
 * The shared interface layer for every course application in this collection:
 * the primitives, the mathematics renderer, the chart wrappers, the error
 * boundary, the shell, the progress provider and the laboratory view parameter.
 *
 * The split from `@llm-materials/course-core` is deliberate. The core is
 * framework-free and can be tested exhaustively in Node; this package is the
 * thin React layer over it, and everything here either renders what the core
 * computed or wires a control to it.
 */

export * from './primitives.js'
export * from './Math.js'
export * from './Charts.js'
export * from './ErrorBoundary.js'
export * from './AppShell.js'
export * from './ProgressContext.js'
export * from './ViewParam.js'
export * from './DeepDive.js'
export * from './Checkpoint.js'
