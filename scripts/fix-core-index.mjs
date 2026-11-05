import { readFile, writeFile } from 'node:fs/promises'

/* The core's index: the four names that collide with `math.ts` get an alias. */
const indexPath = 'packages/course-core/src/index.ts'
let index = await readFile(indexPath, 'utf8')
index = index.replace(
  /export \{[\s\S]*?\} from '\.\/autodiff\.js'/,
  `export {
  Tape,
  add,
  causalMask,
  gatherRows,
  gelu,
  rmsNorm,
  scaleBy,
  sliceRows,
  sumAll,
  crossEntropy as adCrossEntropy,
  matmul as adMatmul,
  softmaxRows as adSoftmaxRows,
  transpose as adTranspose,
} from './autodiff.js'`,
)
await writeFile(indexPath, index, 'utf8')
console.log('fixed the core index')

/* The content test: the section map has a generic name now. */
const contentTestPath = 'lm-from-scratch/src/content/content.test.ts'
let contentTest = await readFile(contentTestPath, 'utf8')
contentTest = contentTest.split('CS336_SECTIONS').join('SECTION_MAP')
await writeFile(contentTestPath, contentTest, 'utf8')
console.log('fixed the content test')
