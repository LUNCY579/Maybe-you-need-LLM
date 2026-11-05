import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

/**
 * Run every browser suite in the collection.
 *
 * Each course has its own Playwright configuration and its own port, so the
 * suites can be run one after another or all at once without fighting over a
 * port. Before each suite the runner frees that suite's port, because a
 * server left over from an earlier run makes the suite fail for a reason that
 * has nothing to do with the code.
 *
 *   node scripts/run-e2e.mjs                 # every suite, one after another
 *   node scripts/run-e2e.mjs data-lab hub    # only these
 */

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..')

const ALL = [
  'hub',
  'llm-foundations-lab',
  'agentic-ai-academy',
  'deep-learning-theory-explorer',
  'diffusion-lab',
  'evaluation-lab',
  'rlhf-lab',
  'lm-from-scratch',
  'mech-interp-lab',
  'data-lab',
  'scaling-lab',
  'systems-lab',
  'rl-foundations',
  'retrieval-lab',
  'agent-bench-lab',
  'safety-lab',
  'multimodal-lab',
]

/** The port, or ports, each suite's Playwright configuration uses. */
const PORTS = {
  hub: 4181,
  'llm-foundations-lab': [5213, 5214],
  'agentic-ai-academy': 4318,
  'deep-learning-theory-explorer': 5179,
  'diffusion-lab': 4173,
  'evaluation-lab': 4174,
  'rlhf-lab': 4175,
  'lm-from-scratch': 4176,
  'mech-interp-lab': 4177,
  'data-lab': 4178,
  'scaling-lab': 4179,
  'systems-lab': 4180,
  'rl-foundations': 4182,
  'retrieval-lab': 4183,
  'agent-bench-lab': 4184,
  'safety-lab': 4185,
  'multimodal-lab': 4186,
}

const selected = process.argv.slice(2).length > 0 ? process.argv.slice(2) : ALL

function run(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    })
    child.on('close', (code) => resolve(code ?? 1))
  })
}

/**
 * Free a port.
 *
 * On Windows the listener is found with netstat and killed; elsewhere lsof
 * does the same job. A port that is already free is the normal case, and the
 * function says nothing.
 */
async function freePort(port) {
  if (process.platform === 'win32') {
    const listing = await new Promise((resolve) => {
      const child = spawn('netstat', ['-ano'], { shell: true })
      let output = ''
      child.stdout.on('data', (chunk) => (output += chunk))
      child.on('close', () => resolve(output))
    })
    const pids = new Set()
    for (const line of String(listing).split('\n')) {
      if (!line.includes(`:${port}`)) continue
      if (!/LISTENING/i.test(line)) continue
      const pid = line.trim().split(/\s+/).pop()
      if (pid) pids.add(pid)
    }
    for (const pid of pids) {
      await run('taskkill', ['/PID', pid, '/F', '/T'])
    }
    return pids.size
  }
  await run('bash', ['-c', `lsof -ti tcp:${port} | xargs -r kill -9`])
  return 0
}

let failures = 0
for (const directory of selected) {
  const ports = PORTS[directory] ?? []
  let freed = 0
  for (const port of Array.isArray(ports) ? ports : [ports]) {
    freed += await freePort(port)
  }
  if (freed > 0) console.log(`freed ${freed} listener(s) on ${[].concat(ports).join(', ')}`)
  console.log(`\n=== the browser suite: ${directory} ===`)
  const code = await run('npx', ['playwright', 'test'], { cwd: join(root, directory) })
  if (code !== 0) {
    failures++
    console.error(`${directory}: the browser suite failed`)
  }
}

console.log(`\n${selected.length - failures} of ${selected.length} browser suites passed`)
process.exit(failures === 0 ? 0 : 1)
