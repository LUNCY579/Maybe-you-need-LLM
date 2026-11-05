import type { QuizQuestion } from '../../types/curriculum'
import { LAB_QUESTIONS } from '../../content/labQuestions'
import { Panel } from '../primitives'
import { PredictBlock } from './PredictBlock'

/**
 * "Check your reading".
 *
 * A laboratory is where the *doing* happens, so it is the right place to ask
 * the student what they just saw. These questions are about the mechanism
 * rather than about one particular run: each one states a change and asks what
 * would follow, so the answer is a prediction the student can check by moving
 * a slider.
 *
 * They are ordinary questions with ordinary ids, so an attempt against one
 * joins the review queue exactly like a lesson question does — the loop does
 * not stop at the end of a lesson.
 */
export function LabReflection({ labId }: { labId: string }) {
  const questions = LAB_QUESTIONS[labId]
  if (!questions || questions.length === 0) return null

  return (
    <Panel
      title="Check your reading"
      subtitle="Two questions about the mechanism you just used. Commit to an answer before the explanation appears — a wrong one comes back for review."
    >
      <div className="space-y-4">
        {questions.map((question: QuizQuestion) => (
          <PredictBlock key={question.id} question={question} lessonSlug={`lab:${labId}`} />
        ))}
      </div>
    </Panel>
  )
}
