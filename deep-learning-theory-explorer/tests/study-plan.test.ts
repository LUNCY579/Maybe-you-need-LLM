import { describe, expect, it } from 'vitest';
import { buildStudyPlan, studyStepLabel } from '../src/lib/studyPlan';
import { LESSONS } from '../src/content/lessons';
import { emptyProgress, type Progress } from '../src/lib/persistence';

/**
 * The study plan.
 *
 * The plan is the difference between a list of lessons and a course, so it has
 * to be *right*: it must name the earliest unlocked lesson, it must notice
 * when a lesson has been read but its exercises have not, and it must never
 * suggest a lesson whose prerequisites are unread.
 */
function progressWith(lessons: string[], exercises: string[] = []): Progress {
  const p = emptyProgress();
  for (const id of lessons) {
    p.lessons[id] = { completed: true, bookmarked: false, lastViewedAt: '2024-01-01T00:00:00.000Z' };
  }
  for (const key of exercises) {
    const [lessonId, index] = key.split(':');
    p.exercises[key] = { lessonId, index: Number(index), solved: true };
  }
  return p;
}

describe('the study plan', () => {
  it('starts with the first lesson', () => {
    const plan = buildStudyPlan(emptyProgress());
    expect(plan.next).not.toBeNull();
    expect(plan.next!.kind).toBe('lesson');
    expect(plan.next!.to).toBe(`/lessons/${LESSONS[0].id}`);
  });

  it('moves to the next unread lesson once one is read and its exercises are worked', () => {
    const exerciseKeys = LESSONS[0].exercises.map((_, i) => `${LESSONS[0].id}:${i}`);
    const plan = buildStudyPlan(progressWith([LESSONS[0].id], exerciseKeys));
    expect(plan.next!.kind).toBe('lesson');
    expect(plan.next!.to).toBe(`/lessons/${LESSONS[1].id}`);
  });

  it('never suggests a lesson whose prerequisites are unread', () => {
    // read nothing: the plan must start at the first lesson
    const plan = buildStudyPlan(emptyProgress());
    expect(plan.next!.to).toBe(`/lessons/${LESSONS[0].id}`);
    // and the lessons that depend on an unread one are locked
    const withPrereq = LESSONS.find((l) => l.prerequisites.length > 0)!;
    const state = plan.lessons.find((l) => l.id === withPrereq.id)!;
    expect(state.unlocked).toBe(false);
    expect(state.blockedBy.length).toBe(withPrereq.prerequisites.length);
  });

  it('suggests the exercises of a read lesson before the next lesson', () => {
    const plan = buildStudyPlan(progressWith([LESSONS[0].id]));
    expect(plan.next!.kind).toBe('exercise');
    expect(plan.next!.to).toBe(`/lessons/${LESSONS[0].id}`);
    // and the next lesson is still in the plan, further down
    expect(plan.steps.some((s) => s.kind === 'lesson')).toBe(true);
  });

  it('moves on once the exercises are worked', () => {
    const exerciseKeys = LESSONS[0].exercises.map((_, i) => `${LESSONS[0].id}:${i}`);
    const plan = buildStudyPlan(progressWith([LESSONS[0].id], exerciseKeys));
    expect(plan.next!.kind).toBe('lesson');
    expect(plan.next!.to).toBe(`/lessons/${LESSONS[1].id}`);
  });

  it('suggests an experiment before the assessment', () => {
    const plan = buildStudyPlan(progressWith([LESSONS[0].id]));
    const kinds = plan.steps.map((s) => s.kind);
    expect(kinds).toContain('experiment');
    expect(kinds.indexOf('experiment')).toBeLessThan(kinds.indexOf('assessment'));
  });

  it('counts progress over four separate kinds of work', () => {
    const plan = buildStudyPlan(progressWith([LESSONS[0].id]));
    expect(plan.progress.lessonsRead).toBe(1);
    expect(plan.progress.lessonsTotal).toBe(LESSONS.length);
    expect(plan.progress.exercisesTotal).toBeGreaterThan(plan.progress.exercisesSolved);
    expect(plan.progress.fraction).toBeGreaterThan(0);
    expect(plan.progress.fraction).toBeLessThan(1);
  });

  it('is deterministic: the same state gives the same plan', () => {
    const state = progressWith([LESSONS[0].id]);
    expect(JSON.stringify(buildStudyPlan(state))).toBe(JSON.stringify(buildStudyPlan(state)));
  });

  it('reaches the end of the curriculum and then says what to review', () => {
    const all = LESSONS.map((l) => l.id);
    const exerciseKeys = LESSONS.flatMap((l) => l.exercises.map((_, i) => `${l.id}:${i}`));
    const p = progressWith(all, exerciseKeys);
    p.quiz = [];
    // with nothing recorded, the plan still asks for a measurement ...
    const plan = buildStudyPlan(p);
    expect(plan.next!.kind).toBe('experiment');
    // ... and once there is one, it moves to the assessment
    p.runs.push({ id: 'x', lab: 'physics', summary: 'a run', ranAt: '2024-01-01T00:00:00.000Z', metrics: {} });
    const after = buildStudyPlan(p);
    expect(['assessment', 'review']).toContain(after.next!.kind);
  });

  it('labels every kind of step', () => {
    expect(studyStepLabel('lesson')).toBe('Read');
    expect(studyStepLabel('exercise')).toBe('Practise');
    expect(studyStepLabel('experiment')).toBe('Measure');
    expect(studyStepLabel('assessment')).toBe('Check');
    expect(studyStepLabel('review')).toBe('Revisit');
  });

  it('knows how long the plan is, so "and N more" can be honest', () => {
    const plan = buildStudyPlan(emptyProgress());
    expect(plan.totalSteps).toBeGreaterThanOrEqual(plan.steps.length);
    // the next step is the first step of the plan
    expect(plan.steps[0].id).toBe(plan.next!.id);
  });
});
