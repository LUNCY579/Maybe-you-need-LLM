import { LESSONS } from '../content/lessons';
import { QUIZ } from '../content/quizzes';
import { EQUATIONS } from '../content/equations';
import type { Progress } from './persistence';

/**
 * The study plan.
 *
 * A curriculum that says "here are ten lessons" and leaves the reader to
 * decide what to do is a list, not a course. This module turns the reader's
 * actual state — which lessons they have read, which exercises they have
 * worked, what they have answered, what they have run — into a single next
 * action and the sequence that follows it.
 *
 * The plan is deterministic and derived only from stored progress, so the same
 * state always gives the same plan.
 */

export type StudyStepKind = 'lesson' | 'exercise' | 'experiment' | 'assessment' | 'review';

export interface StudyStep {
  id: string;
  kind: StudyStepKind;
  title: string;
  /** why this step, and what it will teach */
  detail: string;
  /** where to go */
  to: string;
  /** lower sorts earlier */
  priority: number;
  /** the state that produced this step */
  reason: string;
}

export interface LessonState {
  id: string;
  order: number;
  title: string;
  completed: boolean;
  bookmarked: boolean;
  /** every prerequisite has been read */
  unlocked: boolean;
  /** the prerequisites that are not yet read */
  blockedBy: string[];
  exercises: { total: number; solved: number };
}

export interface StudyPlan {
  /** the one thing to do next */
  next: StudyStep | null;
  /** the ordered plan, up to eight steps */
  steps: StudyStep[];
  /** how many steps the plan holds in total, including the eight shown */
  totalSteps: number;
  /** the state of every lesson */
  lessons: LessonState[];
  /** how far through the course the reader is */
  progress: {
    lessonsRead: number;
    lessonsTotal: number;
    exercisesSolved: number;
    exercisesTotal: number;
    questionsAnswered: number;
    questionsTotal: number;
    equationsViewed: number;
    equationsTotal: number;
    runs: number;
    /** a single number between 0 and 1 */
    fraction: number;
  };
}

const KIND_LABEL: Record<StudyStepKind, string> = {
  lesson: 'Read',
  exercise: 'Practise',
  experiment: 'Measure',
  assessment: 'Check',
  review: 'Revisit',
};

export function studyStepLabel(kind: StudyStepKind): string {
  return KIND_LABEL[kind];
}

/** Compute the plan from the stored progress. */
export function buildStudyPlan(progress: Progress): StudyPlan {
  const lessons: LessonState[] = LESSONS.map((l) => {
    const state = progress.lessons[l.id];
    const completed = Boolean(state?.completed);
    const blockedBy = l.prerequisites.filter((p) => !progress.lessons[p]?.completed);
    const total = l.exercises.length;
    const solved = l.exercises.filter((_, i) => progress.exercises[`${l.id}:${i}`]?.solved).length;
    return {
      id: l.id,
      order: l.order,
      title: l.title,
      completed,
      bookmarked: Boolean(state?.bookmarked),
      unlocked: blockedBy.length === 0,
      blockedBy,
      exercises: { total, solved },
    };
  });

  const candidates: StudyStep[] = [];

  // 1. The exercises of a lesson that has just been read. Practising before
  //    moving on is the rhythm the course is built on: intuition, formal
  //    definition, experiment, verification exercise.
  for (const l of lessons) {
    if (!l.completed) continue;
    const lesson = LESSONS.find((x) => x.id === l.id)!;
    for (let i = 0; i < lesson.exercises.length; i++) {
      if (progress.exercises[`${l.id}:${i}`]?.solved) continue;
      candidates.push({
        id: `exercise:${l.id}:${i}`,
        kind: 'exercise',
        title: `Exercise ${i + 1} of lesson ${l.order}`,
        detail: lesson.exercises[i].prompt.replace(/\$[^$]*\$/g, (m) => m.slice(1, -1)),
        to: `/lessons/${l.id}`,
        priority: 5 + l.order * 0.1 + i * 0.01,
        reason: `you have read lesson ${l.order} but not worked this one yet`,
      });
    }
  }

  // 2. The next lesson to read: the earliest one that is unlocked and unread.
  for (const l of lessons) {
    if (l.completed || !l.unlocked) continue;
    const lesson = LESSONS.find((x) => x.id === l.id)!;
    candidates.push({
      id: `lesson:${l.id}`,
      kind: 'lesson',
      title: l.title,
      detail: lesson.summary,
      to: `/lessons/${l.id}`,
      // earlier lessons first, and unlocked ones before locked ones
      priority: 10 + l.order,
      reason: l.blockedBy.length
        ? `unlocked — but it follows ${l.blockedBy.length} earlier lesson${l.blockedBy.length === 1 ? '' : 's'} you have not read yet`
        : `lesson ${l.order} of ${lessons.length}, and its prerequisites are read`,
    });
  }

  // 3. An experiment that has not been run.
  if (progress.runs.length === 0) {
    candidates.push({
      id: 'experiment:physics',
      kind: 'experiment',
      title: 'Run your first measurement',
      detail:
        'The physics laboratory measures the layer kernel of a network you configure. It takes about half a second and the numbers are yours to check.',
      to: '/labs/physics',
      priority: 30,
      reason: 'no experiment has been recorded yet',
    });
  }

  // 4. The assessment, once some of the course has been read.
  const answered = new Set(progress.quiz.map((q) => q.questionId));
  const wrong = progress.quiz.filter((q) => !q.correct);
  if (wrong.length > 0) {
    // A question answered wrongly is a gap, and it is worth more than a new
    // question: the explanation is already written, waiting to be read.
    candidates.push({
      id: 'review:wrong-answers',
      kind: 'review',
      title: `Re-read the ${wrong.length} question${wrong.length === 1 ? '' : 's'} you got wrong`,
      detail:
        'Each one is listed with the explanation beside it, and a link back to the lesson it came from. The gaps are worth more than the questions you already know.',
      to: '/quiz',
      priority: 35,
      reason: `${wrong.length} of ${progress.quiz.length} answered questions were answered incorrectly`,
    });
  }
  if (answered.size < QUIZ.length && lessons.some((l) => l.completed)) {
    const missing = QUIZ.find((q) => !answered.has(q.id));
    if (missing) {
      candidates.push({
        id: `assessment:${missing.id}`,
        kind: 'assessment',
        title: `Question ${missing.id.slice(1)} of ${QUIZ.length}`,
        detail: missing.prompt.replace(/\$[^$]*\$/g, (m) => m.slice(1, -1)),
        to: '/quiz',
        priority: 40,
        reason: `${answered.size} of ${QUIZ.length} questions attempted`,
      });
    }
  }

  // 5. If everything is done, review what has been bookmarked or leave a note.
  if (candidates.length === 0) {
    const bookmarked = lessons.find((l) => l.bookmarked);
    if (bookmarked) {
      candidates.push({
        id: `review:${bookmarked.id}`,
        kind: 'review',
        title: `Revisit “${bookmarked.title}”`,
        detail: 'You marked this lesson for later. Nothing is left in the curriculum, so this is a good moment to reread it.',
        to: `/lessons/${bookmarked.id}`,
        priority: 50,
        reason: 'the curriculum is complete and this lesson is bookmarked',
      });
    } else {
      candidates.push({
        id: 'review:atlas',
        kind: 'review',
        title: 'Revisit the theory atlas',
        detail:
          'Everything in the course is done. The atlas is the place to check a claim: it says, for every idea, whether this application measures it or only cites it.',
        to: '/atlas',
        priority: 50,
        reason: 'the curriculum is complete',
      });
    }
  }

  candidates.sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id));

  const lessonsRead = lessons.filter((l) => l.completed).length;
  const exercisesTotal = LESSONS.reduce((n, l) => n + l.exercises.length, 0);
  const exercisesSolved = lessons.reduce((n, l) => n + l.exercises.solved, 0);
  const questionsAnswered = progress.quiz.length;
  const equationsViewed = progress.equationsViewed.length;

  // The fraction is a weighted average of four separate kinds of progress, so
  // that a reader who only reads is not told they are behind on the exercises.
  const parts = [
    lessonsRead / Math.max(1, lessons.length),
    exercisesSolved / Math.max(1, exercisesTotal),
    questionsAnswered / Math.max(1, QUIZ.length),
    equationsViewed / Math.max(1, EQUATIONS.length),
  ];
  const fraction = parts.reduce((a, b) => a + b, 0) / parts.length;

  return {
    next: candidates[0] ?? null,
    steps: candidates.slice(0, 8),
    totalSteps: candidates.length,
    lessons,
    progress: {
      lessonsRead,
      lessonsTotal: lessons.length,
      exercisesSolved,
      exercisesTotal,
      questionsAnswered,
      questionsTotal: QUIZ.length,
      equationsViewed,
      equationsTotal: EQUATIONS.length,
      runs: progress.runs.length,
      fraction,
    },
  };
}
