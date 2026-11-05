import type { QuizQuestion } from '../../content/quiz'

/**
 * The option list of a multiple-choice question.
 *
 * Both the practice page and the review page show the same question bank, so
 * the rendering of the options lives here once rather than in each of them.
 * The page decides how the answer is graded and what the verdict looks like;
 * this component only decides how a choice looks.
 */
export function QuestionOptions({
  question,
  chosen,
  onChoose,
  disabled = false,
}: {
  question: QuizQuestion
  /** The index the learner picked, or undefined if the question is unanswered. */
  chosen: number | undefined
  onChoose: (index: number) => void
  disabled?: boolean
}) {
  const revealed = chosen !== undefined
  return (
    <ul className="question-options space-y-2" data-testid="question-options">
      {question.options.map((option, optionIndex) => {
        const isCorrect = optionIndex === question.correctIndex
        const isChosen = chosen === optionIndex
        const tone = !revealed
          ? 'border-line hover:border-indigo/50'
          : isCorrect
            ? 'border-teal bg-teal/5'
            : isChosen
              ? 'border-rose bg-rose/5'
              : 'border-line opacity-70'
        return (
          <li key={optionIndex}>
            <button
              type="button"
              onClick={() => onChoose(optionIndex)}
              disabled={disabled}
              aria-pressed={isChosen}
              className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed ${tone}`}
            >
              <span className="mr-2 font-mono text-xs text-faint">{String.fromCharCode(65 + optionIndex)}</span>
              <span className="text-fg">{option}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
