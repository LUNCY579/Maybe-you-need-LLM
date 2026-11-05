import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Scaffold a new course application from the completed one.
 *
 * The boilerplate — the build configuration, the test setup, the Playwright
 * configuration, the HTML shell and the favicon — is identical across the
 * courses, so it is copied rather than retyped. The content and the
 * laboratories are then written for the new source.
 *
 *   node scripts/scaffold-course.mjs evaluation-lab "Evaluation Lab" "arXiv:2306.05685"
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')
const template = join(root, 'diffusion-lab')

const [name, title, source] = process.argv.slice(2)
if (!name || !title || !source) {
  console.error('usage: node scripts/scaffold-course.mjs <directory> <title> <source>')
  process.exit(1)
}

const target = join(root, name)

const FILES = [
  ['tsconfig.json', 'tsconfig.json'],
  ['tsconfig.app.json', 'tsconfig.app.json'],
  ['tsconfig.node.json', 'tsconfig.node.json'],
  ['vite.config.ts', 'vite.config.ts'],
  ['playwright.config.ts', 'playwright.config.ts'],
  ['index.html', 'index.html'],
  ['public/favicon.svg', 'public/favicon.svg'],
  ['src/test/setup.ts', 'src/test/setup.ts'],
  ['src/main.tsx', 'src/main.tsx'],
]

await mkdir(join(target, 'src', 'test'), { recursive: true })
await mkdir(join(target, 'src', 'pages'), { recursive: true })
await mkdir(join(target, 'src', 'content'), { recursive: true })
await mkdir(join(target, 'src', 'core'), { recursive: true })
await mkdir(join(target, 'src', 'components', 'lab'), { recursive: true })
await mkdir(join(target, 'public'), { recursive: true })
await mkdir(join(target, 'e2e'), { recursive: true })
await mkdir(join(target, 'docs'), { recursive: true })

for (const [from, to] of FILES) {
  if (to === 'PLACEHOLDER') continue
  await copyFile(join(template, from), join(target, to))
}

// The package manifest, with the name and the description filled in.
const packageJson = JSON.parse(await readFile(join(template, 'package.json'), 'utf8'))
packageJson.name = name
packageJson.description = `Interactive course on ${source}`
await writeFile(join(target, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`, 'utf8')

// The HTML shell, with the course's own name and description.
let html = await readFile(join(template, 'index.html'), 'utf8')
html = html
  .replaceAll('Diffusion Lab', title)
  .replaceAll('diffusion-lab:theme', `${name}:theme`)
  .replace(
    'content="Diffusion Lab — an interactive course on diffusion probabilistic models, where every number is computed in front of you, built on Denoising Diffusion Probabilistic Models by Ho, Jain and Abbeel."',
    `content="${title} — an interactive course where every number is computed in front of you."`,
  )
  .replace(
    '<title>Diffusion Lab — an interactive course on diffusion models</title>',
    `<title>${title}</title>`,
  )
await writeFile(join(target, 'index.html'), html, 'utf8')

console.log(`scaffolded ${name} from the template`)
console.log(`next: write src/content/*, src/core/*, src/components/lab/*, src/pages/*`)
