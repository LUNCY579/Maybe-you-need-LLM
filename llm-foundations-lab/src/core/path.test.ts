import { describe, expect, it } from 'vitest'
import { LESSONS, getLesson } from '../content/curriculum'
import { buildLearningPath, recommendNext, type PathStep } from './path'

/** A learner who has completed the given lesson ids. */
const completed = (...ids: string[]) => (lessonId: string) => ids.includes(lessonId)

describe('learning path', () => {
  describe('buildLearningPath', () => {
    it('marks a lesson with no prerequisites as available', () => {
      const path = buildLearningPath(LESSONS, completed())
      const first = path.steps.find((step) => step.lesson.id === 'pretraining-why')
      expect(first?.status).toBe('available')
      expect(first?.blockedBy).toEqual([])
    })

    it('marks a lesson whose prerequisites are unmet as blocked', () => {
      const path = buildLearningPath(LESSONS, completed())
      const blocked = path.steps.filter((step) => step.status === 'blocked')
      expect(blocked.length).toBeGreaterThan(0)
      for (const step of blocked) {
        expect(step.blockedBy.length).toBeGreaterThan(0)
      }
    })

    it('unblocks a lesson once its prerequisites are done', () => {
      const path = buildLearningPath(LESSONS, completed('pretraining-bert'))
      const step = path.steps.find((entry) => entry.lesson.id === 'alignment-sft')
      expect(step?.status).toBe('available')
    })

    it('marks a completed lesson as done even if a prerequisite is missing', () => {
      const path = buildLearningPath(LESSONS, completed('alignment-sft'))
      const step = path.steps.find((entry) => entry.lesson.id === 'alignment-sft')
      expect(step?.status).toBe('done')
    })

    it('counts the three states', () => {
      const path = buildLearningPath(LESSONS, completed('pretraining-why'))
      expect(path.counts.done).toBe(1)
      expect(path.counts.done + path.counts.available + path.counts.blocked).toBe(LESSONS.length)
    })

    it('covers every lesson exactly once', () => {
      const path = buildLearningPath(LESSONS, completed())
      expect(path.steps).toHaveLength(LESSONS.length)
      expect(new Set(path.steps.map((step) => step.lesson.id)).size).toBe(LESSONS.length)
    })

    it('only ever blocks a lesson on a prerequisite that exists', () => {
      const path = buildLearningPath(LESSONS, completed())
      const ids = new Set(LESSONS.map((lesson) => lesson.id))
      for (const step of path.steps) {
        for (const prerequisite of step.lesson.prerequisites) {
          expect(ids.has(prerequisite), `${step.lesson.id} names an unknown prerequisite`).toBe(true)
        }
      }
    })
  })

  describe('recommendNext', () => {
    it('recommends a lesson with no prerequisites first', () => {
      const path = buildLearningPath(LESSONS, completed())
      expect(path.recommendation?.lesson.id).toBe('pretraining-why')
      expect(path.recommendation?.reason).toMatch(/no prerequisites/i)
    })

    it('recommends the first available lesson in course order', () => {
      const path = buildLearningPath(LESSONS, completed('pretraining-why', 'pretraining-objectives'))
      expect(path.recommendation?.lesson.id).toBe('pretraining-bert')
    })

    it('recommends a lesson the reader said they did not understand', () => {
      // The reader has told us the third lesson was not clear. That is a
      // stronger signal than the order of the course, and the course is
      // expected to act on it.
      const path = buildLearningPath(
        LESSONS,
        completed('pretraining-why', 'pretraining-objectives'),
        {},
        new Date(),
        (lessonId) => lessonId === 'pretraining-bert',
      )
      expect(path.recommendation?.lesson.id).toBe('pretraining-bert')
      expect(path.recommendation?.reason).toMatch(/not clear yet/i)
    })

    it('falls back to the course order when nothing needs work', () => {
      const path = buildLearningPath(
        LESSONS,
        completed('pretraining-why', 'pretraining-objectives'),
        {},
        new Date(),
        () => false,
      )
      expect(path.recommendation?.lesson.id).toBe('pretraining-bert')
    })

    it('explains what a blocked recommendation is waiting on', () => {
      // Complete nothing that would unblock the next lessons.
      const steps: PathStep[] = LESSONS.map((lesson) => ({
        lesson,
        status: 'blocked',
        blockedBy: ['Something earlier'],
        mastery: null,
      }))
      const recommendation = recommendNext(steps)
      expect(recommendation?.blockedBy).toEqual(['Something earlier'])
      expect(recommendation?.reason).toMatch(/waiting on/i)
    })

    it('returns nothing once every lesson is done', () => {
      const path = buildLearningPath(LESSONS, completed(...LESSONS.map((lesson) => lesson.id)))
      expect(path.recommendation).toBeNull()
      expect(path.counts.done).toBe(LESSONS.length)
    })

    it('never recommends a lesson that is already complete', () => {
      const done = ['pretraining-why', 'pretraining-objectives', 'pretraining-bert']
      const path = buildLearningPath(LESSONS, completed(...done))
      expect(done).not.toContain(path.recommendation?.lesson.id)
    })

    it('recommends a lesson whose prerequisites are genuinely satisfied', () => {
      const path = buildLearningPath(LESSONS, completed('pretraining-why', 'pretraining-objectives'))
      const recommended = path.recommendation
      expect(recommended).not.toBeNull()
      const lesson = getLesson(recommended!.lesson.id)
      for (const prerequisite of lesson?.prerequisites ?? []) {
        const title = getLesson(prerequisite)?.title
        if (title) expect(recommended!.blockedBy).not.toContain(title)
      }
    })
  })
})
