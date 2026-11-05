import { useCallback, useMemo } from 'react'

import { RUBRIC, RUBRIC_MAX_POINTS, type RubricCriterion } from '../content/project'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useProgress } from './progress'
import type { ProgressApi } from './progressState'

/**
 * Final-project workspace state.
 *
 * Kept separate from the progress store because it is a different kind of
 * thing: the progress store records *activity*, this records *work produced*.
 * Both are local-first and both are included in the export.
 */

export const PROJECT_STORAGE_KEY = 'agentic-ai-academy/project/v1'

export interface ProjectState {
  /** The task the student has chosen. */
  taskName: string
  /** Milestone ids that are marked complete. */
  checklist: Record<string, boolean>
  /** Free-text notes, keyed by deliverable index. */
  notes: Record<string, string>
  /** Self-assessed rubric score per criterion, 0..maxPoints. */
  rubric: Record<string, number>
}

export const initialProject: ProjectState = {
  taskName: '',
  checklist: {},
  notes: {},
  rubric: {},
}

/** Defensive parser: unknown or corrupt payloads fall back to a clean state. */
export function parseProject(raw: string | null): ProjectState {
  if (!raw) return initialProject
  try {
    const parsed = JSON.parse(raw) as Partial<ProjectState>
    const rubric: Record<string, number> = {}
    if (parsed.rubric && typeof parsed.rubric === 'object') {
      for (const criterion of RUBRIC) {
        const value = (parsed.rubric as Record<string, unknown>)[criterion.id]
        if (typeof value === 'number' && Number.isFinite(value)) {
          rubric[criterion.id] = Math.max(0, Math.min(criterion.maxPoints, Math.round(value)))
        }
      }
    }
    return {
      taskName: typeof parsed.taskName === 'string' ? parsed.taskName : '',
      checklist: filterRecord(parsed.checklist, (value) => typeof value === 'boolean') as Record<string, boolean>,
      notes: filterRecord(parsed.notes, (value) => typeof value === 'string') as Record<string, string>,
      rubric,
    }
  } catch {
    return initialProject
  }
}

/** Keep only the entries of `record` whose value satisfies `predicate`. */
function filterRecord(record: unknown, predicate: (value: unknown) => boolean): Record<string, unknown> {
  if (!record || typeof record !== 'object') return {}
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(record as Record<string, unknown>)) {
    if (predicate(value)) result[key] = value
  }
  return result
}

export function serializeProject(state: ProjectState): string {
  return JSON.stringify({ ...state, exportedAt: new Date().toISOString() }, null, 2)
}

/* ------------------------------------------------------------------ */
/* Readiness                                                           */
/* ------------------------------------------------------------------ */

export interface CriterionEvidence {
  criterion: RubricCriterion
  /** Self-assigned points. */
  awarded: number
  /** True when the course activity evidences the criterion. */
  evidenced: boolean
  /** Human-readable statement of what the course shows. */
  evidence: string
}

export interface ReadinessReport {
  criteria: CriterionEvidence[]
  /** Rubric points awarded, 0..RUBRIC_MAX_POINTS. */
  awarded: number
  max: number
  /** Milestones marked complete, 0..total. */
  milestonesDone: number
  milestonesTotal: number
  /** Percentage of rubric criteria that are evidenced by course activity. */
  evidenceRatio: number
  /** Overall verdict, derived only from recorded activity. */
  verdict: 'not-started' | 'in-progress' | 'evidence-complete' | 'submitted'
}

export interface ReadinessInput {
  project: ProjectState
  progress: ProgressApi
  milestoneIds: string[]
}

/**
 * Derive the readiness report.
 *
 * The report is a pure function of the project state and the recorded course
 * activity, so it can be tested without a browser. It deliberately does *not*
 * award points: it only reports which criteria the student's own activity
 * already evidences, and lets the student self-assess the rest.
 */
export function deriveReadiness({ project, progress, milestoneIds }: ReadinessInput): ReadinessReport {
  const labIds = new Set(progress.state.labActivity.map((entry) => entry.labId))
  const completedLessons = progress.completedCount
  const answered = progress.answeredQuestionIds.length

  const evidence: Record<string, { evidenced: boolean; statement: string }> = {
    measurement: {
      evidenced: labIds.size >= 4,
      statement: `Laboratories run: ${labIds.size} of 4.`,
    },
    harness: {
      evidenced: labIds.has('workflow-builder') || labIds.has('builder'),
      statement: labIds.has('workflow-builder') || labIds.has('builder')
        ? 'A workflow was built and executed in the builder.'
        : 'No workflow-builder run recorded yet.',
    },
    traceability: {
      evidenced: completedLessons >= 8,
      statement: `Lessons completed: ${completedLessons} of ${progress.totalLessons}.`,
    },
    honesty: {
      evidenced: answered >= 20,
      statement: `Assessment questions answered: ${answered}.`,
    },
    safety: {
      evidenced: labIds.size >= 2,
      statement: `Laboratories run: ${labIds.size} of 4.`,
    },
    reproducibility: {
      evidenced: progress.state.quizAttempts.length >= 10,
      statement: `Quiz attempts recorded: ${progress.state.quizAttempts.length}.`,
    },
  }

  const criteria: CriterionEvidence[] = RUBRIC.map((criterion) => {
    const record = evidence[criterion.id] ?? { evidenced: false, statement: 'No evidence recorded.' }
    return {
      criterion,
      awarded: project.rubric[criterion.id] ?? 0,
      evidenced: record.evidenced,
      evidence: record.statement,
    }
  })

  const awarded = criteria.reduce((sum, entry) => sum + entry.awarded, 0)
  const evidencedCount = criteria.filter((entry) => entry.evidenced).length
  const milestonesDone = milestoneIds.filter((id) => project.checklist[id]).length

  let verdict: ReadinessReport['verdict'] = 'not-started'
  if (milestonesDone === milestoneIds.length && awarded > 0) verdict = 'submitted'
  else if (evidencedCount === criteria.length) verdict = 'evidence-complete'
  else if (milestonesDone > 0 || answered > 0 || labIds.size > 0) verdict = 'in-progress'

  return {
    criteria,
    awarded,
    max: RUBRIC_MAX_POINTS,
    milestonesDone,
    milestonesTotal: milestoneIds.length,
    evidenceRatio: criteria.length === 0 ? 0 : evidencedCount / criteria.length,
    verdict,
  }
}

export const VERDICT_LABELS: Record<ReadinessReport['verdict'], string> = {
  'not-started': 'Not started',
  'in-progress': 'In progress',
  'evidence-complete': 'Evidence complete',
  submitted: 'Ready to submit',
}

/* ------------------------------------------------------------------ */
/* Hook                                                                */
/* ------------------------------------------------------------------ */

export function useProject(milestoneIds: string[]) {
  const [state, setState] = useLocalStorage<ProjectState>(PROJECT_STORAGE_KEY, initialProject)
  const progress = useProgress()

  const readiness = useMemo(
    () => deriveReadiness({ project: state, progress, milestoneIds }),
    [state, progress, milestoneIds],
  )

  const setTaskName = useCallback((taskName: string) => setState({ ...state, taskName }), [state, setState])
  const toggleMilestone = useCallback(
    (id: string, done: boolean) => setState({ ...state, checklist: { ...state.checklist, [id]: done } }),
    [state, setState],
  )
  const setNote = useCallback(
    (key: string, note: string) => setState({ ...state, notes: { ...state.notes, [key]: note } }),
    [state, setState],
  )
  const setRubricScore = useCallback(
    (id: string, points: number) => setState({ ...state, rubric: { ...state.rubric, [id]: points } }),
    [state, setState],
  )
  const reset = useCallback(() => setState(initialProject), [setState])

  return { state, readiness, setState, setTaskName, toggleMilestone, setNote, setRubricScore, reset }
}
