/**
 * The learning path.
 *
 * The collection is a set of courses, and the courses are not independent:
 * a reader who has met the reward model has less to learn in the alignment
 * course, and a reader who has met the scaling laws has less to learn in the
 * data course, because the data course is about what the scaling laws assume.
 *
 * The path is a directed acyclic graph over the courses, and this module
 * answers the three questions a learner actually has: what can I start now,
 * what should I do next, and what does the whole thing look like.
 *
 * The edges are a claim about *teaching order*, not about the mathematics. A
 * course may be taken on its own; the path says which order makes the
 * material cheapest to learn.
 */

export interface PathEdge {
  /** The course that should be learned first. */
  from: string
  /** The course that builds on it. */
  to: string
  /** Why the order is what it is. */
  reason: string
}

export interface LearningPath {
  /** The edges, as a list. */
  edges: PathEdge[]
  /** The courses, with a one-line description and the path position of each. */
  courses: { id: string; title: string; summary: string }[]
}

/**
 * The path through the collection.
 *
 * The three courses that were built first are the root: they are general, and
 * the specialised courses build on them.
 */
export const LEARNING_PATH: LearningPath = {
  courses: [
    {
      id: 'llm-foundations-lab',
      title: 'LLM Foundations Lab',
      summary: 'What a language model is, what it is trained on, and how it is steered.',
    },
    {
      id: 'lm-from-scratch',
      title: 'Language Model from Scratch',
      summary: 'The transformer, the tokeniser and the optimiser, each built from nothing.',
    },
    {
      id: 'scaling-lab',
      title: 'Scaling Lab',
      summary: 'How the loss falls, and what follows from it.',
    },
    {
      id: 'data-lab',
      title: 'Data Lab',
      summary: 'The data, and what it does to the model.',
    },
    {
      id: 'diffusion-lab',
      title: 'Diffusion Lab',
      summary: 'Generative modelling, where the training objective is the noise itself.',
    },
    {
      id: 'mech-interp-lab',
      title: 'Mechanistic Interpretability Lab',
      summary: 'What a model computes, and how you would know.',
    },
    {
      id: 'evaluation-lab',
      title: 'Evaluation Lab',
      summary: 'How language models are evaluated, and how the numbers are gamed.',
    },
    {
      id: 'rlhf-lab',
      title: 'RLHF Lab',
      summary: 'The alignment recipe, and what the details of the implementation do.',
    },
    {
      id: 'agentic-ai-academy',
      title: 'Agentic AI Academy',
      summary: 'The layer above the model: memory, tools, planning and action.',
    },
    {
      id: 'deep-learning-theory-explorer',
      title: 'Deep Learning Theory Explorer',
      summary: 'Why generalisation happens at all, and what the theory says about it.',
    },
    {
      id: 'systems-lab',
      title: 'Systems Lab',
      summary: 'Where the time and the memory go, and what the hardware does with them.',
    },
    {
      id: 'rl-foundations',
      title: 'Reinforcement Learning Foundations',
      summary: 'What an agent is trying to do, and how you would check the answer.',
    },
    {
      id: 'retrieval-lab',
      title: 'Retrieval Lab',
      summary: 'Finding the document that answers the question.',
    },
    {
      id: 'agent-bench-lab',
      title: 'Agent Benchmark Lab',
      summary: 'What a benchmark actually measures, and how precisely it is known.',
    },
    {
      id: 'safety-lab',
      title: 'Safety and Alignment Lab',
      summary: 'How a harmlessness claim is measured, and what the measurement is worth.',
    },
    {
      id: 'multimodal-lab',
      title: 'Multimodal Lab',
      summary: 'Two modalities, one space, and the gap between them.',
    },
  ],
  edges: [
    {
      from: 'llm-foundations-lab',
      to: 'lm-from-scratch',
      reason: 'The architecture is easier once you know what the model is for.',
    },
    {
      from: 'lm-from-scratch',
      to: 'scaling-lab',
      reason: 'The scaling laws are about training runs, and the training run is the one the architecture defines.',
    },
    {
      from: 'scaling-lab',
      to: 'data-lab',
      reason: 'The data course is about what the scaling laws take for granted.',
    },
    {
      from: 'llm-foundations-lab',
      to: 'evaluation-lab',
      reason: 'Evaluation assumes a model that was trained somehow.',
    },
    {
      from: 'evaluation-lab',
      to: 'rlhf-lab',
      reason: 'Alignment is the part of training that is judged by an evaluation.',
    },
    {
      from: 'llm-foundations-lab',
      to: 'mech-interp-lab',
      reason: 'Interpretability is a method of looking inside a model you already know.',
    },
    {
      from: 'lm-from-scratch',
      to: 'mech-interp-lab',
      reason: 'The residual stream and the attention head are the vocabulary the circuits are made of.',
    },
    {
      from: 'llm-foundations-lab',
      to: 'agentic-ai-academy',
      reason: 'The agentic layer sits on top of a model that works.',
    },
    {
      from: 'rlhf-lab',
      to: 'agentic-ai-academy',
      reason: 'An agent that is steered badly is a problem the agentic course has to know about.',
    },
    {
      from: 'deep-learning-theory-explorer',
      to: 'scaling-lab',
      reason: 'The theory explains why the loss falls in a smooth power law at all.',
    },
    {
      from: 'llm-foundations-lab',
      to: 'diffusion-lab',
      reason: 'Diffusion is a different training objective on the same idea of a model.',
    },
    {
      from: 'lm-from-scratch',
      to: 'systems-lab',
      reason: 'The systems course is about what the architecture the last one builds actually costs.',
    },
    {
      from: 'rl-foundations',
      to: 'rlhf-lab',
      reason: 'The alignment course assumes the policy gradient and the value function the first one derives.',
    },
    {
      from: 'llm-foundations-lab',
      to: 'retrieval-lab',
      reason: 'The retrieval course is about supplying the facts a model cannot hold.',
    },
    {
      from: 'evaluation-lab',
      to: 'agent-bench-lab',
      reason: 'A benchmark is an evaluation with a task set instead of a question set.',
    },
    {
      from: 'agent-bench-lab',
      to: 'safety-lab',
      reason: 'The safety claims are evaluated, and the evaluation course says how to read one.',
    },
    {
      from: 'llm-foundations-lab',
      to: 'multimodal-lab',
      reason: 'The multimodal course is the same transformer, reading a second modality.',
    },
  ],
}

/** The courses that have nothing left to learn first. */
export function startingCourses(path: LearningPath, available: string[] = []): string[] {
  const prerequisites = new Set(path.edges.map((edge) => edge.to))
  return path.courses
    .filter((course) => !prerequisites.has(course.id))
    .map((course) => course.id)
    .filter((id) => available.length === 0 || available.includes(id))
}

/**
 * The next course to take, given what has been finished.
 *
 * A course is available when every course that points at it has been
 * finished. The order among the available ones is the order of the path
 * itself, so the recommendation is stable.
 */
export function nextCourses(path: LearningPath, completed: string[], available: string[] = []): string[] {
  const done = new Set(completed)
  const blocked = new Set<string>()
  for (const edge of path.edges) {
    if (!done.has(edge.from)) blocked.add(edge.to)
  }
  return path.courses
    .filter((course) => !done.has(course.id) && !blocked.has(course.id))
    .map((course) => course.id)
    .filter((id) => available.length === 0 || available.includes(id))
}

/** The courses a course depends on, directly. */
export function prerequisitesOf(path: LearningPath, courseId: string): string[] {
  return path.edges.filter((edge) => edge.to === courseId).map((edge) => edge.from)
}

/** The courses that depend on a course, directly. */
export function successorsOf(path: LearningPath, courseId: string): string[] {
  return path.edges.filter((edge) => edge.from === courseId).map((edge) => edge.to)
}

/**
 * The longest path from a root to a course.
 *
 * It is the number of steps a learner must take before this course is
 * reachable, and it is what orders the path into layers.
 */
export function depthOf(path: LearningPath, courseId: string): number {
  const order = path.courses.map((course) => course.id)
  const depth = new Map<string, number>(order.map((id) => [id, 0]))
  let changed = true
  let guard = 0
  while (changed && guard < order.length + 1) {
    changed = false
    for (const edge of path.edges) {
      const candidate = (depth.get(edge.from) ?? 0) + 1
      if (candidate > (depth.get(edge.to) ?? 0)) {
        depth.set(edge.to, candidate)
        changed = true
      }
    }
    guard++
  }
  return depth.get(courseId) ?? 0
}

/** The courses grouped into layers, so the path can be drawn as levels. */
export function layersOf(path: LearningPath): string[][] {
  const courses = path.courses.map((course) => course.id)
  const depth = new Map(courses.map((id) => [id, depthOf(path, id)]))
  const layers: string[][] = []
  for (const id of courses) {
    const level = depth.get(id) ?? 0
    while (layers.length <= level) layers.push([])
    layers[level]!.push(id)
  }
  return layers
}

/**
 * Check that the path is acyclic.
 *
 * The test suite calls this, because a cycle in the teaching order would
 * make the "what next" question unanswerable.
 */
export function findPathCycle(path: LearningPath): string[] {
  const state = new Map<string, 'visiting' | 'done'>()
  const stack: string[] = []
  let cycle: string[] = []

  const visit = (id: string): boolean => {
    const current = state.get(id)
    if (current === 'done') return false
    if (current === 'visiting') {
      cycle = [...stack.slice(stack.indexOf(id)), id]
      return true
    }
    state.set(id, 'visiting')
    stack.push(id)
    for (const edge of path.edges) {
      if (edge.from !== id) continue
      if (visit(edge.to)) return true
    }
    stack.pop()
    state.set(id, 'done')
    return false
  }

  for (const course of path.courses) {
    if (visit(course.id)) return cycle
  }
  return []
}
