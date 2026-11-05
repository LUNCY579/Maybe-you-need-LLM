import { LESSONS } from './lessons'
import { LABS } from './labs'
import { PART_BY_ID } from './book'

/**
 * A study plan.
 *
 * The course is a stack of hours: the lessons, the laboratories and a builder.
 * "Read the course" is not a plan. A student with three hours a week and a
 * student with nine hours a week need different orders, and both need to know
 * what to do *in* an evening, not just what comes next in the list.
 *
 * The plan is derived rather than written. It uses three things the content
 * already knows:
 *
 *  - the **order** of the lessons, which already respects the prerequisites;
 *  - the **minutes** each lesson is estimated to take;
 *  - the **laboratories**, and the lesson each one belongs with.
 *
 * From those it answers the only question that matters on a Tuesday evening:
 * *if I sit down for this long, what should I do?*
 *
 * The plan is a pure function of the content and the hours available, so it
 * cannot drift away from the curriculum, and it can be asserted in tests
 * rather than trusted.
 */

/** The weeks a plan is built from, in order. */
export interface PlanWeek {
  /** Which week this is, counting from one. */
  week: number
  /** The theme of the week. */
  title: string
  /** The lessons to read, in order. */
  lessons: { slug: string; title: string; minutes: number }[]
  /** The laboratories to run, in order. */
  labs: { id: string; name: string; route: string }[]
  /** The total reading time for the week, in minutes. */
  minutes: number
  /** What the student should be able to do by the end of the week. */
  outcome: string
}

export interface StudyPlan {
  /** The hours a week the plan was built for. */
  hoursPerWeek: number
  /** The weeks, in order. */
  weeks: PlanWeek[]
  /** The total reading time across the whole plan, in minutes. */
  totalMinutes: number
  /** The number of weeks. */
  weekCount: number
}

/**
 * What the student can do once they have finished each lesson.
 *
 * These are written as things the student can *do*, because a lesson that
 * ends with "read chapters 1 to 3" has not finished anything.
 *
 * They are keyed by lesson rather than by week, because the pace changes the
 * number of weeks but not what a lesson achieves. A week ends with whatever
 * its last lesson achieves.
 */
export const LESSON_OUTCOMES: Record<string, string> = {  'what-agentic-llms-are':
    'Explain what an agentic LLM is in terms of the harness around it, and tell the difference between a model that answers and one that acts.',
  'foundations-of-language-modeling':
    'Describe how a language model is built — tokens, embeddings, attention, the transformer — and say what each part is for.',
  'training-pipeline':
    'Walk through the training pipeline end to end, and say what each stage contributes that the previous one did not.',
  'scaling-laws-and-efficiency':
    'Explain what scaling laws do and do not tell you, and judge a claim about model size on its merits.',
  'multi-step-reasoning':
    'Use chain-of-thought and self-reflection to break down a problem, and recognise the state-tracking failure that follows.',
  'vision-action-world-models':
    'Describe how a world model is learned and used, and say when a model-based agent is worse than a model-free one.',
  'interaction-styles-and-memory':
    'Name the five interaction styles, explain the memory architectures, and decide which one a system needs.',
  'tools-and-context':
    'Design tool interfaces that a model can use correctly, and explain what the context window spends its budget on.',
  'search-and-retrieval':
    'Build a retrieval pipeline, explain when it fails, and evaluate it with something better than a vibe.',
  'behavior-strategy-multi-agent':
    'Predict what a multi-agent system will do, measure it, and distinguish coordination from cooperation.',
  'advanced-architectures-and-interpretability':
    'Reason about the advanced architectures and their interpretability, and say which questions are still open.',
  'future-directions':
    'Evaluate an agent you have built, name its limitations honestly, and decide what it should be allowed to do.',
}

/**
 * The laboratories that belong with each lesson.
 *
 * A laboratory is worth running *after* the lesson that explains the
 * mechanism, so each is paired with the lesson whose subject it exercises. A
 * lesson may own more than one: the deep-dive laboratories extend the same
 * mechanism rather than introducing a new one, so they schedule beside the
 * lesson that teaches it.
 */
const LAB_FOR_LESSON: Record<string, string[]> = {
  'multi-step-reasoning': ['planning', 'reasoning'],
  'interaction-styles-and-memory': ['memory', 'memory-longevity'],
  'vision-action-world-models': ['world-model', 'policy-priors'],
  'behavior-strategy-multi-agent': ['multi-agent'],
  'tools-and-context': ['workflow-builder'],
  'search-and-retrieval': ['retrieval'],
}

/**
 * Build a plan for a student with a given number of hours a week.
 *
 * The lessons are packed into weeks in order, never splitting a lesson across
 * weeks, and never putting more than the available time into a week unless a
 * single lesson is longer than a week — which is why the arithmetic below
 * allows a week to overflow rather than splitting the lesson.
 */
export function studyPlan(hoursPerWeek: number): StudyPlan {
  const budget = Math.max(1, Math.round(hoursPerWeek * 60))

  const weeks: PlanWeek[] = []
  let current: PlanWeek | null = null
  let currentMinutes = 0

  for (const lesson of LESSONS) {
    if (!current || currentMinutes + lesson.minutes > budget) {
      current = {
        week: weeks.length + 1,
        title: '',
        lessons: [],
        labs: [],
        minutes: 0,
        outcome: '',
      }
      weeks.push(current)
      currentMinutes = 0
    }
    current.lessons.push({ slug: lesson.slug, title: lesson.title, minutes: lesson.minutes })
    currentMinutes += lesson.minutes
    current.minutes = currentMinutes
    // The week ends with whatever its last lesson achieves.
    current.outcome = LESSON_OUTCOMES[lesson.slug] ?? 'Keep going.'

    for (const labId of LAB_FOR_LESSON[lesson.slug] ?? []) {
      const lab = LABS.find((entry) => entry.id === labId)
      if (lab) current.labs.push({ id: lab.id, name: lab.name, route: lab.route })
    }
  }

  // The week titles name the parts of the book the week covers, which is
  // more use than "week 3".
  for (const week of weeks) {
    const partIds = [
      ...new Set(
        week.lessons
          .map((entry) => LESSONS.find((lesson) => lesson.slug === entry.slug)?.part)
          .filter((part): part is NonNullable<typeof part> => Boolean(part)),
      ),
    ]
    const titles = partIds
      .map((id) => PART_BY_ID.get(id))
      .filter((part): part is NonNullable<typeof part> => Boolean(part))
      .map((part) => part.title)
    week.title =
      titles.length === 1
        ? `Part ${partIds.length ? PART_BY_ID.get(partIds[0])?.order : ''} · ${titles[0]}`
        : titles.join(' · ')
  }

  return {
    hoursPerWeek,
    weeks,
    totalMinutes: weeks.reduce((sum, week) => sum + week.minutes, 0),
    weekCount: weeks.length,
  }
}

/** The plans on offer: a spread of commitments. */
export const PLAN_OPTIONS = [2, 3, 5, 9]
