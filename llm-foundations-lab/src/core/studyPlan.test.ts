import { describe, expect, it } from 'vitest'
import {
  buildStudyPlan,
  markWhatFits,
  planMinutes,
  plannedMinutes,
  summarisePlan,
  type StudyPlanItem,
} from './studyPlan'

const lesson = { id: 'pretraining-why', title: 'Self-supervised pre-training', minutes: 22 }

function base(overrides: Partial<Parameters<typeof buildStudyPlan>[0]> = {}) {
  return {
    dueCount: 0,
    nextLesson: lesson,
    nextLessonExplained: false,
    weakest: null,
    minutesAvailable: null,
    ...overrides,
  }
}

describe('the study plan', () => {
  it('is empty when there is nothing to do', () => {
    const plan = buildStudyPlan(
      base({ nextLesson: null, dueCount: 0, weakest: null }),
    )
    expect(plan).toEqual([])
    expect(summarisePlan(plan, null)).toMatch(/done/i)
  })

  it('puts the review first, because a forgotten question is worth more than an unseen one', () => {
    const plan = buildStudyPlan(base({ dueCount: 6 }))
    expect(plan[0].kind).toBe('review')
    expect(plan[0].title).toMatch(/6 questions/)
  })

  it('suggests reading the next lesson', () => {
    const plan = buildStudyPlan(base())
    expect(plan[0].kind).toBe('read')
    expect(plan[0].title).toContain('Self-supervised pre-training')
    expect(plan[0].href).toBe('/lessons/pretraining-why')
  })

  it('suggests explaining the lesson back when it has not been done', () => {
    const plan = buildStudyPlan(base())
    const explain = plan.find((item) => item.kind === 'explain')
    expect(explain).toBeDefined()
    expect(explain?.href).toContain('#explain-back')
  })

  it('does not suggest explaining a lesson that has been explained', () => {
    const plan = buildStudyPlan(base({ nextLessonExplained: true }))
    expect(plan.find((item) => item.kind === 'explain')).toBeUndefined()
  })

  it('suggests practising the weakest module when nothing is due', () => {
    const plan = buildStudyPlan(
      base({ weakest: { title: 'Alignment', questionCount: 9 } }),
    )
    const practice = plan.find((item) => item.kind === 'practice')
    expect(practice).toBeDefined()
    expect(practice?.title).toContain('Alignment')
  })

  it('does not suggest practising while a review is waiting', () => {
    const plan = buildStudyPlan(
      base({ dueCount: 4, weakest: { title: 'Alignment', questionCount: 9 } }),
    )
    expect(plan.find((item) => item.kind === 'practice')).toBeUndefined()
  })

  it('gives every item a reason', () => {
    const plan = buildStudyPlan(base({ dueCount: 3, weakest: { title: 'Alignment', questionCount: 9 } }))
    for (const item of plan) {
      expect(item.reason.length, `${item.kind} has no reason`).toBeGreaterThan(20)
    }
  })
})

describe('the time budget', () => {
  it('marks everything as fitting when there is no limit', () => {
    const plan = buildStudyPlan(base({ dueCount: 3, minutesAvailable: null }))
    expect(plan.every((item) => item.fits)).toBe(true)
  })

  it('marks the items that do not fit rather than hiding them', () => {
    const plan = buildStudyPlan(base({ dueCount: 3, minutesAvailable: 5 }))
    expect(plan.length).toBeGreaterThan(1)
    expect(plan[0].fits).toBe(true)
    expect(plan[plan.length - 1].fits).toBe(false)
  })

  it('marks nothing as fitting when the first item is too long', () => {
    const plan = buildStudyPlan(base({ minutesAvailable: 1 }))
    expect(plan.every((item) => !item.fits)).toBe(true)
  })

  it('counts only the items that fit', () => {
    const plan = buildStudyPlan(base({ dueCount: 3, minutesAvailable: 10 }))
    expect(plannedMinutes(plan)).toBeLessThanOrEqual(10)
    expect(plannedMinutes(plan)).toBeLessThan(planMinutes(plan))
  })

  it('sums the whole plan', () => {
    const plan = buildStudyPlan(base({ dueCount: 3 }))
    expect(planMinutes(plan)).toBe(plan.reduce((total, item) => total + item.minutes, 0))
  })

  it('leaves the sequence in order', () => {
    const items: StudyPlanItem[] = [
      { kind: 'read', title: 'a', detail: '', reason: '', minutes: 5, href: '/', fits: true },
      { kind: 'read', title: 'b', detail: '', reason: '', minutes: 20, href: '/', fits: true },
      { kind: 'read', title: 'c', detail: '', reason: '', minutes: 5, href: '/', fits: true },
    ]
    const marked = markWhatFits(items, 20)
    // The first fits. The second is too long for what is left, so it is
    // marked as being for later. The third is short enough to fit in the
    // time that is left, and the reader can still do it.
    expect(marked.map((item) => item.fits)).toEqual([true, false, true])
  })
})

describe('the summary of the plan', () => {
  it('names the first thing to do', () => {
    const plan = buildStudyPlan(base({ dueCount: 3 }))
    expect(summarisePlan(plan, null)).toMatch(/^Review 3 questions/)
  })

  it('says how long it will take', () => {
    const plan = buildStudyPlan(base({ dueCount: 3, minutesAvailable: 60 }))
    expect(summarisePlan(plan, 60)).toMatch(/\d+ minutes? in all/)
  })

  it('says what to do when nothing fits', () => {
    const plan = buildStudyPlan(base({ minutesAvailable: 1 }))
    expect(summarisePlan(plan, 1)).toMatch(/nothing fits/i)
  })
})
