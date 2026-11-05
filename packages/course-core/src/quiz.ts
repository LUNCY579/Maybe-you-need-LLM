/**
 * The quiz model shared by every course.
 *
 * A question is a discriminated union on `kind`, so the grading engine can
 * enforce the right comparison for each type instead of string-matching
 * everything. Every question carries an explanation and, where it makes sense,
 * a source citation, so feedback is teaching rather than just a verdict.
 */

export type QuestionKind = 'multiple-choice' | 'multi-select' | 'numeric' | 'boolean' | 'text'

export interface Option {
  id: string
  label: string
  /** Shown after the learner answers, to explain why the option is right or wrong. */
  feedback?: string
}

export interface QuizQuestion {
  id: string
  kind: QuestionKind
  /** The question text. May contain inline `$math$` for the maths renderer. */
  prompt: string
  /** Short label used on the practice index, e.g. "Tokenisation". */
  topic: string
  difficulty: 'warmup' | 'core' | 'hard'
  options?: Option[]
  /** For `multiple-choice`: the correct option id. */
  correctOptionId?: string
  /** For `multi-select`: every correct option id. */
  correctOptionIds?: string[]
  /** For `numeric`: the target value. */
  answer?: number
  /** For `numeric`: accepted absolute error. Zero means exact. */
  tolerance?: number
  /** For `numeric`: the unit the answer is in. */
  unit?: string
  /** For `boolean`: the correct truth value. */
  truth?: boolean
  /** For `text`: accepted answers, compared case-insensitively after trimming. */
  acceptedAnswers?: string[]
  /** Shown after answering. */
  explanation: string
  /** Where this question's content comes from. */
  citation?: { label: string; href?: string }
  /** The lesson this question belongs to. */
  lessonId?: string
}

export interface GradedAnswer {
  correct: boolean
  /** The learner's answer, normalised. `null` when nothing was supplied. */
  given: string | number | boolean | string[] | null
  /** The expected answer, normalised. */
  expected: string | number | boolean | string[] | null
  /** Per-option verdicts for choice questions, when applicable. */
  optionVerdicts?: Record<string, boolean>
  /** A short human-readable reason. */
  reason: string
}

/** Normalise a numeric answer with a tolerance. */
function gradeNumeric(question: QuizQuestion, given: number | null): GradedAnswer {
  if (given === null || !Number.isFinite(given)) {
    return { correct: false, given: null, expected: question.answer ?? null, reason: 'No number was entered.' }
  }
  const target = question.answer ?? 0
  const tolerance = question.tolerance ?? 0
  const correct = Math.abs(given - target) <= tolerance
  const reason = correct
    ? tolerance === 0
      ? 'Exactly right.'
      : `Within the stated tolerance of ${tolerance}.`
    : `The expected value is ${target}${question.unit ? ` ${question.unit}` : ''} (tolerance ${tolerance}).`
  return { correct, given, expected: target, reason }
}

function gradeMultipleChoice(question: QuizQuestion, given: string | null): GradedAnswer {
  const options = question.options ?? []
  const optionVerdicts: Record<string, boolean> = {}
  for (const option of options) {
    optionVerdicts[option.id] = option.id === question.correctOptionId
  }
  const correct = given !== null && given === question.correctOptionId
  return {
    correct,
    given,
    expected: question.correctOptionId ?? null,
    optionVerdicts,
    reason: correct ? 'Correct.' : 'That is not the option the source supports.',
  }
}

function gradeMultiSelect(question: QuizQuestion, given: string[] | null): GradedAnswer {
  const expected = [...(question.correctOptionIds ?? [])].sort()
  const received = [...(given ?? [])].sort()
  const correct =
    expected.length === received.length && expected.every((id, i) => id === received[i])
  return {
    correct,
    given: received,
    expected,
    reason: correct ? 'Correct — every option, and only those options.' : 'The selected set is not the set the source supports.',
  }
}

function gradeBoolean(question: QuizQuestion, given: boolean | null): GradedAnswer {
  const expected = question.truth ?? false
  const correct = given === expected
  return { correct, given, expected, reason: correct ? 'Correct.' : 'The truth is the other way round.' }
}

function gradeText(question: QuizQuestion, given: string | null): GradedAnswer {
  const expected = question.acceptedAnswers ?? []
  const normalized = (given ?? '').trim().toLowerCase()
  const correct = expected.some((a) => a.trim().toLowerCase() === normalized)
  return { correct, given: given ?? null, expected, reason: correct ? 'Correct.' : 'That is not an accepted answer.' }
}

/** Grade one answer against one question. */
export function gradeAnswer(question: QuizQuestion, given: unknown): GradedAnswer {
  switch (question.kind) {
    case 'numeric':
      return gradeNumeric(question, typeof given === 'number' ? given : null)
    case 'multiple-choice':
      return gradeMultipleChoice(question, typeof given === 'string' ? given : null)
    case 'multi-select':
      return gradeMultiSelect(question, Array.isArray(given) ? (given as string[]) : null)
    case 'boolean':
      return gradeBoolean(question, typeof given === 'boolean' ? given : null)
    case 'text':
      return gradeText(question, typeof given === 'string' ? given : null)
    default: {
      const exhaustive: never = question.kind
      throw new Error(`gradeAnswer: unhandled question kind ${String(exhaustive)}`)
    }
  }
}

export interface QuizSummary {
  answered: number
  correct: number
  accuracy: number
  byDifficulty: Record<string, { answered: number; correct: number }>
  byTopic: Record<string, { answered: number; correct: number }>
}

export function summariseQuiz(
  questions: QuizQuestion[],
  results: Record<string, { correct: boolean }>,
): QuizSummary {
  const byDifficulty: QuizSummary['byDifficulty'] = {}
  const byTopic: QuizSummary['byTopic'] = {}
  let answered = 0
  let correct = 0

  for (const question of questions) {
    const result = results[question.id]
    if (!result) continue
    answered++
    if (result.correct) correct++

    const d = (byDifficulty[question.difficulty] ??= { answered: 0, correct: 0 })
    d.answered++
    if (result.correct) d.correct++

    const t = (byTopic[question.topic] ??= { answered: 0, correct: 0 })
    t.answered++
    if (result.correct) t.correct++
  }

  return {
    answered,
    correct,
    accuracy: answered === 0 ? 0 : correct / answered,
    byDifficulty,
    byTopic,
  }
}
