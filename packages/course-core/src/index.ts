/**
 * `@llm-materials/course-core`
 *
 * The shared spine of every course application in this collection: numeric
 * primitives, small dense linear algebra, statistical estimators, preference
 * modelling, persistence, the progress model, the assessment engine, search,
 * and the curriculum and glossary schemas.
 *
 * The package is framework-free by design. A course application owns its
 * React layer; everything that can be tested without a DOM lives here.
 */

export * from './math.js'
export {
  Tape,
  add,
  causalMask,
  gatherRows,
  gelu,
  rmsNorm,
  scale,
  scaleBy,
  sliceRows,
  sumAll,
  abs,
  addBias,
  elementwise,
  relu,
  square,
  crossEntropy as adCrossEntropy,
  matmul as adMatmul,
  softmaxRows as adSoftmaxRows,
  transpose as adTranspose,
} from './autodiff.js'
export type { Tensor } from './autodiff.js'
export * from './linalg.js'
export * from './stats.js'
export * from './preference.js'
export * from './storage.js'
export * from './progress.js'
export * from './quiz.js'
export * from './search.js'
export * from './curriculum.js'
export * from './glossary.js'
