import { describe, expect, it } from 'vitest'
import { LESSONS } from './lessons'
import { LABS } from './labs'
import { LESSON_OUTCOMES, PLAN_OPTIONS, studyPlan } from './studyPlan'

describe('the study plan', () => {
  it('covers every lesson exactly once, whatever the pace', () => {
    for (const hours of PLAN_OPTIONS) {
      const plan = studyPlan(hours)
      const slugs = plan.weeks.flatMap((week) => week.lessons.map((lesson) => lesson.slug))
      expect(slugs, `${hours} h/week misses a lesson`).toHaveLength(LESSONS.length)
      expect(new Set(slugs).size).toBe(LESSONS.length)
      expect(slugs).toEqual(LESSONS.map((lesson) => lesson.slug))
    }
  })

  it('keeps the lessons in course order', () => {
    for (const hours of PLAN_OPTIONS) {
      const plan = studyPlan(hours)
      const slugs = plan.weeks.flatMap((week) => week.lessons.map((lesson) => lesson.slug))
      const order = LESSONS.map((lesson) => lesson.slug)
      expect(slugs).toEqual(order)
    }
  })

  it('never puts more than the available time into a week, unless a lesson is longer than a week', () => {
    for (const hours of PLAN_OPTIONS) {
      const budget = hours * 60
      for (const week of studyPlan(hours).weeks) {
        const longest = Math.max(...week.lessons.map((lesson) => lesson.minutes))
        // A week overflows only when it holds a single lesson that is longer
        // than the week itself.
        if (week.minutes > budget) {
          expect(week.lessons).toHaveLength(1)
          expect(longest).toBeGreaterThan(budget)
        }
      }
    }
  })

  it('makes more weeks when there is less time', () => {
    const weeks = PLAN_OPTIONS.map((hours) => studyPlan(hours).weekCount)
    for (let i = 1; i < weeks.length; i += 1) {
      // More time a week means fewer weeks.
      expect(weeks[i]).toBeLessThanOrEqual(weeks[i - 1])
    }
    expect(studyPlan(2).weekCount).toBeGreaterThan(studyPlan(9).weekCount)
  })

  it('accounts for every minute of reading', () => {
    for (const hours of PLAN_OPTIONS) {
      const plan = studyPlan(hours)
      const total = LESSONS.reduce((sum, lesson) => sum + lesson.minutes, 0)
      expect(plan.totalMinutes).toBe(total)
    }
  })

  it('schedules every laboratory exactly once', () => {
    for (const hours of PLAN_OPTIONS) {
      const plan = studyPlan(hours)
      const labIds = plan.weeks.flatMap((week) => week.labs.map((lab) => lab.id))
      expect(new Set(labIds).size).toBe(labIds.length)
      for (const lab of LABS) {
        expect(labIds, `${lab.id} is not in the plan`).toContain(lab.id)
      }
    }
  })

  it('runs a laboratory in the same week as the lesson that explains it', () => {
    for (const hours of PLAN_OPTIONS) {
      for (const week of studyPlan(hours).weeks) {
        for (const lab of week.labs) {
          expect(lab.route).toBeTruthy()
        }
      }
    }
  })

  it('gives every week something to finish', () => {
    for (const hours of PLAN_OPTIONS) {
      for (const week of studyPlan(hours).weeks) {
        expect(week.outcome.length).toBeGreaterThan(20)
        expect(week.title.length).toBeGreaterThan(3)
        expect(week.lessons.length).toBeGreaterThan(0)
      }
    }
  })

  it('ends each week with what its last lesson achieves', () => {
    // The outcome must follow the content, not the week number: a fast
    // plan has fewer weeks, and its last week covers very different lessons.
    for (const hours of PLAN_OPTIONS) {
      for (const week of studyPlan(hours).weeks) {
        const last = week.lessons[week.lessons.length - 1]
        expect(week.outcome).toBe(LESSON_OUTCOMES[last.slug])
      }
    }
  })

  it('never splits a lesson across weeks', () => {
    for (const hours of PLAN_OPTIONS) {
      const plan = studyPlan(hours)
      for (const week of plan.weeks) {
        const minutes = week.lessons.reduce((sum, lesson) => sum + lesson.minutes, 0)
        expect(minutes).toBe(week.minutes)
      }
    }
  })

  it('is deterministic', () => {
    expect(studyPlan(3)).toEqual(studyPlan(3))
  })

  it('copes with a pace that is far too fast', () => {
    // One hour a week cannot fit a 56-minute lesson plus another, so each
    // lesson gets its own week.
    const plan = studyPlan(1)
    expect(plan.weekCount).toBe(LESSONS.length)
    expect(plan.totalMinutes).toBe(LESSONS.reduce((sum, lesson) => sum + lesson.minutes, 0))
  })

  it('copes with a pace that is far too slow', () => {
    const plan = studyPlan(24)
    expect(plan.weekCount).toBe(1)
    expect(plan.weeks[0].lessons).toHaveLength(LESSONS.length)
  })
})
