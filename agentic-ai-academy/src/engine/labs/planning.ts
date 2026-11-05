/**
 * Lab A — Agent planning.
 *
 * A deterministic grid environment with a locked door, a key and a goal.
 * Four scripted planners are compared on the same world:
 *
 *  - greedy:       always step toward the goal (no model of locks)
 *  - fixed-plan:   BFS at t=0 assuming the door is passable, executed blindly
 *  - search:       BFS over the full state space (position, hasKey, doorOpen)
 *  - reflective:   greedy, but re-plans with BFS after each failure
 */

export interface PlanningWorld {
  width: number
  height: number
  start: [number, number]
  goal: [number, number]
  key: [number, number]
  door: [number, number]
  walls: [number, number][]
  /** Budget in actions before a run is declared failed. */
  budget: number
}

export type PlanningAction = 'up' | 'down' | 'left' | 'right' | 'take-key' | 'open-door'

export interface PlanningStep {
  index: number
  action: PlanningAction | 'replan'
  from: [number, number]
  to: [number, number]
  note: string
  failed: boolean
}

export type PlanningStrategy = 'greedy' | 'fixed-plan' | 'search' | 'reflective'

export interface PlanningOptions {
  /**
   * Probability that a movement action slips to a different cell.
   *
   * 0 (the default) gives a deterministic world, which is what makes the four
   * planners comparable by inspection. Above 0 the planners must cope with a
   * world that does not always do what the plan said.
   */
  slipProbability?: number
  /** Seed for the slip sequence. Same seed + same config = same run. */
  seed?: number
}

/**
 * A hash-based uniform value in [0, 1) for a (seed, stepIndex) pair.
 *
 * Hashing rather than drawing from a stream means the slip pattern is a
 * property of the *step*, not of the strategy that happened to reach it. All
 * four planners therefore meet the same slips at the same step indices, which
 * is what makes their comparison fair.
 */
function hashUnit(seed: number, stepIndex: number): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  h = Math.imul(h ^ stepIndex, 0x85ebca6b) >>> 0
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35) >>> 0
  h = (h ^ (h >>> 16)) >>> 0
  return h / 4294967296
}

function slips(seed: number, stepIndex: number, probability: number): boolean {
  return hashUnit(seed, stepIndex) < probability
}

/**
 * The cell the agent actually ends up in after a slip.
 *
 * Prefers a *different* valid neighbour so that a slip is visible rather than
 * a no-op; falls back to staying put when the agent has nowhere else to go.
 */
function slipTo(
  world: PlanningWorld,
  state: PlanningState,
  action: PlanningAction,
  seed: number,
  stepIndex: number,
): [number, number] | null {
  const intended = neighbour(state.position, action)
  const alternatives = (
    [
      neighbour(state.position, 'up'),
      neighbour(state.position, 'down'),
      neighbour(state.position, 'left'),
      neighbour(state.position, 'right'),
    ] as [number, number][]
  ).filter(
    (cell) =>
      !(cell[0] === intended[0] && cell[1] === intended[1]) &&
      inBounds(world, cell) &&
      !isWall(world, cell) &&
      !(same(cell, world.door) && !state.doorOpen),
  )
  if (alternatives.length === 0) return null
  const index = Math.floor(hashUnit(seed + 7919, stepIndex) * alternatives.length) % alternatives.length
  return alternatives[index] ?? null
}

export interface PlanningRun {
  strategy: PlanningStrategy
  steps: PlanningStep[]
  reachedGoal: boolean
  failures: number
  replans: number
  planLength: number
  actionCount: number
}

export interface PlanningState {
  position: [number, number]
  hasKey: boolean
  doorOpen: boolean
}

export const DEFAULT_WORLD: PlanningWorld = {
  width: 8,
  height: 6,
  start: [0, 5],
  goal: [7, 0],
  key: [0, 0],
  door: [3, 2],
  walls: [
    [2, 1],
    [2, 2],
    [2, 3],
    [5, 0],
    [5, 1],
    [5, 4],
    [5, 5],
    [1, 3],
    [4, 4],
    [6, 3],
  ],
  budget: 60,
}

const same = (a: [number, number], b: [number, number]) => a[0] === b[0] && a[1] === b[1]

export function inBounds(world: PlanningWorld, [x, y]: [number, number]): boolean {
  return x >= 0 && y >= 0 && x < world.width && y < world.height
}

export function isWall(world: PlanningWorld, cell: [number, number]): boolean {
  return world.walls.some((wall) => same(wall, cell))
}

export function neighbour(position: [number, number], action: PlanningAction): [number, number] {
  switch (action) {
    case 'up':
      return [position[0], position[1] - 1]
    case 'down':
      return [position[0], position[1] + 1]
    case 'left':
      return [position[0] - 1, position[1]]
    case 'right':
      return [position[0] + 1, position[1]]
    default:
      return position
  }
}

interface MoveResult {
  state: PlanningState
  failed: boolean
  note: string
}

/** Apply an action. Deterministic: same state + action always gives same result. */
export function applyAction(world: PlanningWorld, state: PlanningState, action: PlanningAction): MoveResult {
  if (action === 'take-key') {
    if (same(state.position, world.key) && !state.hasKey) {
      return { state: { ...state, hasKey: true }, failed: false, note: 'Picked up the key.' }
    }
    return { state, failed: true, note: state.hasKey ? 'Key already held.' : 'No key on this cell.' }
  }

  if (action === 'open-door') {
    if (state.hasKey && same(state.position, world.door)) {
      return { state: { ...state, doorOpen: true }, failed: false, note: 'Unlocked the door with the key.' }
    }
    return {
      state,
      failed: true,
      note: state.hasKey ? 'Not standing on the door cell.' : 'Door is locked and no key is held.',
    }
  }

  const next = neighbour(state.position, action)
  if (!inBounds(world, next)) {
    return { state, failed: true, note: `Blocked: moved off the grid (${next.join(',')}).` }
  }
  if (isWall(world, next)) {
    return { state, failed: true, note: `Blocked: wall at (${next.join(',')}).` }
  }
  if (same(next, world.door) && !state.doorOpen) {
    return { state, failed: true, note: 'Blocked: the door is locked; the key has not been used yet.' }
  }
  return { state: { ...state, position: next }, failed: false, note: `Moved to (${next.join(',')}).` }
}

/* ------------------------------------------------------------------ */
/* Search planner                                                      */
/* ------------------------------------------------------------------ */

type PlanMode = 'full-state' | 'door-as-open'

function bfsPlan(world: PlanningWorld, start: PlanningState, mode: PlanMode): PlanningAction[] {
  const key = (state: PlanningState) =>
    `${state.position[0]},${state.position[1]},${mode === 'full-state' ? `${state.hasKey ? 1 : 0}${state.doorOpen ? 1 : 0}` : 'x'}`

  const actions: PlanningAction[] = ['up', 'down', 'left', 'right', 'take-key', 'open-door']
  const queue: { state: PlanningState; path: PlanningAction[] }[] = [{ state: start, path: [] }]
  const seen = new Set<string>([key(start)])
  let guard = 0

  while (queue.length > 0 && guard < 5000) {
    guard += 1
    const current = queue.shift()!
    if (same(current.state.position, world.goal) && (mode === 'door-as-open' || current.state.hasKey || !worldNeedsKey(world))) {
      return current.path
    }
    for (const action of actions) {
      // Ignore door-locking in the naive mode so the plan is deliberately wrong.
      const simulatedState =
        mode === 'door-as-open' && (action === 'up' || action === 'down' || action === 'left' || action === 'right')
          ? { ...current.state, doorOpen: true }
          : current.state
      const result = applyAction(world, simulatedState, action)
      if (result.failed) continue
      const state = mode === 'door-as-open' ? { ...result.state, doorOpen: false, hasKey: current.state.hasKey } : result.state
      const stateKey = key(state)
      if (seen.has(stateKey)) continue
      seen.add(stateKey)
      queue.push({ state, path: [...current.path, action] })
    }
  }
  return []
}

function worldNeedsKey(world: PlanningWorld): boolean {
  return world.door[0] >= 0 && world.door[1] >= 0
}

/* ------------------------------------------------------------------ */
/* Strategies                                                          */
/* ------------------------------------------------------------------ */

function greedyAction(world: PlanningWorld, state: PlanningState, blocked: Set<string>): PlanningAction {
  const [gx, gy] = world.goal
  const [x, y] = state.position
  const preferred: PlanningAction[] = []
  if (gx !== x) preferred.push(gx > x ? 'right' : 'left')
  if (gy !== y) preferred.push(gy > y ? 'down' : 'up')
  if (preferred.length === 0) return 'up'
  const [primary, secondary] = preferred
  const primaryCell = `${neighbour(state.position, primary).join(',')}|${primary}`
  if (!blocked.has(primaryCell)) return primary
  if (secondary) return secondary
  return primary
}

export function runPlanning(
  strategy: PlanningStrategy,
  world: PlanningWorld = DEFAULT_WORLD,
  options: PlanningOptions = {},
): PlanningRun {
  const steps: PlanningStep[] = []
  let state: PlanningState = { position: world.start, hasKey: false, doorOpen: false }
  let failures = 0
  let replans = 0
  let planLength = 0
  const slipProbability = options.slipProbability ?? 0
  const seed = options.seed ?? 1

  /**
   * Apply a move, possibly slipping.
   *
   * The slip is keyed on the *step index* rather than on a per-strategy random
   * stream, so all four strategies meet the same sequence of slips. That is
   * the standard "common random numbers" trick, and it is what makes the
   * comparison between planners fair rather than noisy.
   */
  const move = (current: PlanningState, action: PlanningAction, stepIndex: number): MoveResult => {
    const result = applyAction(world, current, action)
    if (result.failed || slipProbability <= 0) return result
    if (!slips(seed, stepIndex, slipProbability)) return result
    const slipped = slipTo(world, current, action, seed, stepIndex)
    if (!slipped) return result
    return {
      state: { ...current, position: slipped },
      failed: false,
      note: `${result.note} Slipped to (${slipped.join(',')}) instead.`,
    }
  }

  if (strategy === 'fixed-plan') {
    const plan = bfsPlan(world, state, 'door-as-open')
    planLength = plan.length
    for (const action of plan) {
      if (steps.length >= world.budget) break
      const before = { ...state }
      const result = move(state, action, steps.length)
      state = result.state
      if (result.failed) failures += 1
      steps.push({
        index: steps.length,
        action,
        from: before.position,
        to: state.position,
        note: result.failed ? `${result.note} The fixed plan has no way to recover.` : result.note,
        failed: result.failed,
      })
      if (result.failed) break
    }
    return {
      strategy,
      steps,
      reachedGoal: same(state.position, world.goal),
      failures,
      replans,
      planLength,
      actionCount: steps.length,
    }
  }

  if (strategy === 'search') {
    const plan = bfsPlan(world, state, 'full-state')
    planLength = plan.length
    for (const action of plan) {
      const before = { ...state }
      const result = move(state, action, steps.length)
      state = result.state
      if (result.failed) failures += 1
      steps.push({ index: steps.length, action, from: before.position, to: state.position, note: result.note, failed: result.failed })
    }
    return { strategy, steps, reachedGoal: same(state.position, world.goal), failures, replans, planLength, actionCount: steps.length }
  }

  // greedy and reflective share the loop; reflective re-plans on failure.
  const blocked = new Set<string>()
  let counter = 0

  while (counter < world.budget && !same(state.position, world.goal)) {
    counter += 1
    const action = greedyAction(world, state, blocked)
    const before = { ...state }
    const result = move(state, action, steps.length)
    state = result.state

    if (result.failed) {
      failures += 1
      blocked.add(`${neighbour(before.position, action).join(',')}|${action}`)
      steps.push({
        index: steps.length,
        action,
        from: before.position,
        to: state.position,
        note:
          strategy === 'greedy'
            ? `${result.note} Greedy repeats the same preference order and cannot escape.`
            : `${result.note} Failures are remembered, so the next plan avoids this move.`,
        failed: true,
      })

      if (strategy === 'reflective' && replans < 4) {
        replans += 1
        const localPlan = bfsPlan(world, state, 'full-state')
        planLength = Math.max(planLength, localPlan.length)
        steps.push({
          index: steps.length,
          action: 'replan',
          from: state.position,
          to: state.position,
          note: `Re-planned from (${state.position.join(',')}): ${localPlan.length} action(s) using the full state space.`,
          failed: false,
        })
        for (const plannedAction of localPlan) {
          if (counter >= world.budget) break
          counter += 1
          const inner = move(state, plannedAction, steps.length)
          const innerBefore = { ...state }
          state = inner.state
          if (inner.failed) failures += 1
          steps.push({
            index: steps.length,
            action: plannedAction,
            from: innerBefore.position,
            to: state.position,
            note: inner.note,
            failed: inner.failed,
          })
          if (same(state.position, world.goal) || inner.failed) break
        }
      }
      continue
    }

    steps.push({ index: steps.length, action, from: before.position, to: state.position, note: result.note, failed: false })
  }

  return { strategy, steps, reachedGoal: same(state.position, world.goal), failures, replans, planLength, actionCount: steps.length }
}

export function runAllStrategies(world: PlanningWorld = DEFAULT_WORLD, options: PlanningOptions = {}): PlanningRun[] {
  return (['greedy', 'fixed-plan', 'search', 'reflective'] as PlanningStrategy[]).map((strategy) =>
    runPlanning(strategy, world, options),
  )
}

/** Cell type helper used by the renderer. */
export function cellKind(world: PlanningWorld, cell: [number, number]): 'start' | 'goal' | 'key' | 'door' | 'wall' | 'empty' {
  if (same(cell, world.start)) return 'start'
  if (same(cell, world.goal)) return 'goal'
  if (same(cell, world.key)) return 'key'
  if (same(cell, world.door)) return 'door'
  if (isWall(world, cell)) return 'wall'
  return 'empty'
}
