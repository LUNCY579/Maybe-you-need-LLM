import { Link } from '../layout/CourseLink.tsx'
import type { QuizQuestion } from '../../content/quiz'
import { getLesson } from '../../content/curriculum'

/**
 * The verdict shown after a question has been answered.
 *
 * Every option in the bank carries its own diagnosis, so a wrong answer is
 * followed by the reason it is wrong and by the reasoning the author considered
 * correct, not only by a red cross.
 */
export function AnswerFeedback({
  question,
  chosen,
}: {
  question: QuizQuestion
  chosen: number
}) {
  const correct = chosen === question.correctIndex
  const lesson = getLesson(question.lessonId)
  return (
    <div className="space-y-2 rounded-xl border border-line bg-panel-2/40 p-3 text-sm">
      <p className={correct ? 'text-positive' : 'text-rose'}>
        {correct ? 'Correct. ' : 'Incorrect. '}
        {question.explanation}
      </p>
      <p className="text-xs text-muted">
        <span className="text-faint">Your option: </span>
        {question.feedback[chosen]}
      </p>
      {!correct ? (
        <p className="text-xs text-muted">
          <span className="text-faint">Correct option: </span>
          {question.feedback[question.correctIndex]}
        </p>
      ) : null}
      <p className="text-xs text-faint">
        Covered in{' '}
        {lesson ? (
          <Link to={`/lessons/${question.lessonId}`} className="text-indigo hover:underline">
            {lesson.title}
          </Link>
        ) : (
          'the course'
        )}
        .
      </p>
    </div>
  )
}
