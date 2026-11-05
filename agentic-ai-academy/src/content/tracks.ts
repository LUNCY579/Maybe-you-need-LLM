import type { Lesson, LessonDifficulty, LessonSection, QuizQuestion } from '../types/curriculum'

/**
 * Difficulty tracks.
 *
 * A lesson ships with a core treatment that is always shown, and an advanced
 * treatment that is only shown when the student switches the lesson to the
 * advanced track. This is a real content switch: the advanced track adds
 * sections with deeper treatment and additional questions, and the core track
 * is limited to the questions whose difficulty is `core`.
 *
 * The rules live here, in one pure module, so that both the lesson reader and
 * the assessment centre agree on what a track means.
 */

export interface TrackSummary {
  track: LessonDifficulty
  sections: LessonSection[]
  questions: QuizQuestion[]
  /** True when the lesson offers additional material on this track. */
  hasExtraMaterial: boolean
  /** Short explanation of what switching the track changes. */
  description: string
}

/**
 * Resolve the sections and questions visible on a given track.
 *
 * - `core`: the shared sections, and the questions tagged `core`.
 * - `advanced`: the shared sections **plus** the advanced sections, and every
 *   question (core ones first as revision, then the advanced ones).
 */
export function resolveTrack(lesson: Lesson, track: LessonDifficulty): TrackSummary {
  const coreQuestions = lesson.quiz.filter((question) => question.difficulty === 'core')
  const advancedQuestions = [
    ...lesson.quiz.filter((question) => question.difficulty === 'advanced'),
    ...lesson.advancedQuiz,
  ]

  if (track === 'advanced') {
    const extra = lesson.advancedSections ?? []
    return {
      track,
      sections: [...lesson.sections, ...extra],
      questions: [...coreQuestions, ...advancedQuestions],
      hasExtraMaterial: extra.length > 0 || advancedQuestions.length > 0,
      description:
        'The advanced track adds a deeper treatment of the same material — derivations, counterexamples and the open questions the textbook flags — plus the harder assessment questions.',
    }
  }

  return {
    track: 'core',
    sections: lesson.sections,
    // A lesson with no core-tagged question still needs a usable core track.
    questions: coreQuestions.length > 0 ? coreQuestions : lesson.quiz,
    hasExtraMaterial: (lesson.advancedSections?.length ?? 0) > 0 || advancedQuestions.length > 0,
    description:
      'The core track is the complete essential treatment: every concept, worked example and checkpoint, with the baseline assessment questions.',
  }
}

/** Total number of questions available across both tracks (used for coverage stats). */
export function totalQuestionCount(lesson: Lesson): number {
  return lesson.quiz.length + (lesson.advancedQuiz?.length ?? 0)
}

/** Labels for the track toggle, used in the lesson reader and curriculum. */
export const TRACK_LABELS: Record<LessonDifficulty, string> = {
  core: 'Core track',
  advanced: 'Advanced track',
}
