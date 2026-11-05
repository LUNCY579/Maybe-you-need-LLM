import { readFile, writeFile } from 'node:fs/promises'

/* The core's index: alias the four names that collide with `math.ts`. */
const indexPath = 'packages/course-core/src/index.ts'
let index = await readFile(indexPath, 'utf8')
index = index.replace(
  "export * from './autodiff.js'",
  `export {
  Tape,
  add as adAdd,
  causalMask as adCausalMask,
  crossEntropy as adCrossEntropy,
  gatherRows as adGatherRows,
  gelu as adGelu,
  matmul as adMatmul,
  rmsNorm as adRmsNorm,
  scaleBy as adScaleBy,
  sliceRows as adSliceRows,
  softmaxRows as adSoftmaxRows,
  sumAll as adSumAll,
  transpose as adTranspose,
} from './autodiff.js'
export type { Tensor } from './autodiff.js'`,
)
await writeFile(indexPath, index, 'utf8')
console.log('aliased the autodiff exports')

/* The transformer: use the aliased names. */
const transformerPath = 'lm-from-scratch/src/core/transformer.ts'
let transformer = await readFile(transformerPath, 'utf8')
transformer = transformer.replace(
  `import {
  add,
  causalMask,
  crossEntropy,
  gatherRows,
  gelu,
  matmul,
  rmsNorm,
  scaleBy,
  softmaxRows,
  transpose,
  Tape,
} from '@llm-materials/course-core'`,
  `import {
  add,
  adCrossEntropy,
  adMatmul,
  adSoftmaxRows,
  adTranspose,
  causalMask,
  gatherRows,
  gelu,
  rmsNorm,
  scaleBy,
  Tape,
} from '@llm-materials/course-core'`,
)
for (const [from, to] of [
  ['crossEntropy(', 'adCrossEntropy('],
  ['matmul(', 'adMatmul('],
  ['softmaxRows(', 'adSoftmaxRows('],
  ['transpose(', 'adTranspose('],
]) {
  const pattern = new RegExp(`(?<![A-Za-z0-9_.])${from.replace(/[()]/g, '\\$&')}`, 'g')
  transformer = transformer.replace(pattern, to)
}
await writeFile(transformerPath, transformer, 'utf8')
console.log('patched the transformer')

/* The core test: import the engine from the package. */
const testPath = 'lm-from-scratch/src/core/core.test.ts'
let test = await readFile(testPath, 'utf8')
test = test.replace(
  `import { Tape } from './autodiff.js'`,
  `import { Tape } from '@llm-materials/course-core'`,
)
await writeFile(testPath, test, 'utf8')
console.log('patched the core test')

/* The content test: the section map has a generic name now. */
const contentTestPath = 'lm-from-scratch/src/content/content.test.ts'
let contentTest = await readFile(contentTestPath, 'utf8')
contentTest = contentTest.replace('CS336_SECTIONS', 'SECTION_MAP')
await writeFile(contentTestPath, contentTest, 'utf8')
console.log('patched the content test')
