import { describe, expect, it } from 'vitest'
import { findPrerequisiteCycle, moduleLessonIds, prerequisiteOrder } from '@llm-materials/course-core'
import { LESSONS, MODULES, SECTION_MAP, lessonsOfModule } from './curriculum'
import { GLOSSARY } from './glossary'
import { QUIZ } from './quiz'
import { FORMULAS } from './formulas'
import { REFERENCES } from './sources'
import { LABS, LAB_DELIVERIES, LAB_IDS } from './labs'
import { LAB_SCREENS, LAB_VIEWS } from '../components/lab'

describe('the curriculum', () => {
  it('has six modules and twelve lessons', () => {
    expect(MODULES.length).toBe(6)
    expect(LESSONS.length).toBe(12)
  })

  it('gives every lesson a module that exists', () => {
    const moduleIds = new Set(MODULES.map((module) => module.id))
    for (const lesson of LESSONS) {
      expect(moduleIds.has(lesson.moduleId), lesson.id).toBe(true)
    }
  })

  it('numbers the lessons consecutively', () => {
    expect(LESSONS.map((lesson) => lesson.number)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12])
  })

  it('gives every lesson objectives, key ideas and a laboratory', () => {
    for (const lesson of LESSONS) {
      expect(lesson.objectives.length, lesson.id).toBeGreaterThan(0)
      expect(lesson.keyIdeas.length, lesson.id).toBeGreaterThan(0)
      expect(lesson.interactive.lab, lesson.id).toBeTruthy()
      expect(lesson.minutes, lesson.id).toBeGreaterThan(0)
    }
  })

  it('points every interactive at a laboratory that exists', () => {
    const labs = new Set(LAB_IDS)
    for (const lesson of LESSONS) {
      expect(labs.has(lesson.interactive.lab), lesson.id).toBe(true)
      const view = lesson.interactive.view
      if (view) {
        const views = LAB_VIEWS[lesson.interactive.lab] ?? []
        expect(
          views.some((entry) => entry.value === view),
          `${lesson.id} asks for /labs/${lesson.interactive.lab}?view=${view}`,
        ).toBe(true)
      }
    }
  })

  it('cites only sections of the primary source that exist', () => {
    for (const lesson of LESSONS) {
      for (const ref of lesson.sourceRefs) {
        expect(
          ref.section in SECTION_MAP,
          `${lesson.id} cites §${ref.section}, which is not in the section map`,
        ).toBe(true)
      }
    }
  })

  it('gives every source reference a note and a chapter', () => {
    for (const lesson of LESSONS) {
      for (const ref of lesson.sourceRefs) {
        expect(ref.chapter, lesson.id).toBeGreaterThan(0)
        expect(ref.note.length, lesson.id).toBeGreaterThan(10)
        expect(ref.title.length, lesson.id).toBeGreaterThan(0)
      }
    }
  })

  it('has an acyclic prerequisite graph', () => {
    expect(findPrerequisiteCycle(LESSONS)).toEqual([])
    expect(prerequisiteOrder(LESSONS)).not.toBeNull()
  })

  it('only depends on lessons that come earlier', () => {
    const byId = new Map(LESSONS.map((lesson) => [lesson.id, lesson]))
    for (const lesson of LESSONS) {
      for (const prerequisite of lesson.prerequisites) {
        const other = byId.get(prerequisite)
        expect(other, lesson.id).toBeDefined()
        expect(other!.number, `${lesson.id} depends on ${prerequisite}`).toBeLessThan(lesson.number)
      }
    }
  })

  it('names glossary terms that exist', () => {
    const termIds = new Set(GLOSSARY.map((term) => term.id))
    for (const lesson of LESSONS) {
      for (const termId of lesson.glossaryTerms) {
        expect(termIds.has(termId), `${lesson.id} names the unknown term ${termId}`).toBe(true)
      }
    }
  })

  it('names quiz questions that exist', () => {
    const questionIds = new Set(QUIZ.map((question) => question.id))
    for (const lesson of LESSONS) {
      for (const questionId of lesson.quizIds) {
        expect(questionIds.has(questionId), `${lesson.id} names the unknown question ${questionId}`).toBe(true)
      }
    }
  })

  it('maps modules to their lessons', () => {
    const ids = moduleLessonIds(MODULES, LESSONS)
    for (const module of MODULES) {
      expect(ids[module.id].length, module.id).toBeGreaterThan(0)
    }
    expect(lessonsOfModule('judging').map((lesson) => lesson.id)).toEqual([
      'what-a-judge-is',
      'agreement-and-consistency',
    ])
  })
})

describe('the glossary', () => {
  it('has unique ids', () => {
    const ids = new Set(GLOSSARY.map((term) => term.id))
    expect(ids.size).toBe(GLOSSARY.length)
  })

  it('defines every term it refers to', () => {
    const ids = new Set(GLOSSARY.map((term) => term.id))
    for (const term of GLOSSARY) {
      for (const prerequisite of term.prerequisites) {
        expect(ids.has(prerequisite), `${term.id} depends on the unknown term ${prerequisite}`).toBe(true)
      }
    }
  })

  it('has no cycles in the dependency graph', () => {
    const byId = new Map(GLOSSARY.map((term) => [term.id, term]))
    const state = new Map<string, 'visiting' | 'done'>()
    const visit = (id: string, stack: string[]): string[] => {
      if (state.get(id) === 'done') return []
      if (state.get(id) === 'visiting') return [...stack, id]
      state.set(id, 'visiting')
      for (const prerequisite of byId.get(id)?.prerequisites ?? []) {
        const cycle = visit(prerequisite, [...stack, id])
        if (cycle.length > 0) return cycle
      }
      state.set(id, 'done')
      return []
    }
    for (const term of GLOSSARY) {
      expect(visit(term.id, []), term.id).toEqual([])
    }
  })

  it('gives every term a definition and a category', () => {
    for (const term of GLOSSARY) {
      expect(term.short.length, term.id).toBeGreaterThan(10)
      expect(term.long.length, term.id).toBeGreaterThan(40)
      expect(term.category, term.id).toBeTruthy()
    }
  })
})

describe('the assessment bank', () => {
  it('has unique ids', () => {
    const ids = new Set(QUIZ.map((question) => question.id))
    expect(ids.size).toBe(QUIZ.length)
  })

  it('gives every question an explanation and a topic', () => {
    for (const question of QUIZ) {
      expect(question.explanation.length, question.id).toBeGreaterThan(20)
      expect(question.topic.length, question.id).toBeGreaterThan(0)
      expect(question.prompt.length, question.id).toBeGreaterThan(10)
    }
  })

  it('has exactly one correct option for a single-choice question', () => {
    for (const question of QUIZ.filter((entry) => entry.kind === 'multiple-choice')) {
      expect(question.correctOptionId, question.id).toBeTruthy()
      expect(question.options?.some((option) => option.id === question.correctOptionId), question.id).toBe(true)
    }
  })

  it('has a non-empty correct set for a multi-select question', () => {
    for (const question of QUIZ.filter((entry) => entry.kind === 'multi-select')) {
      expect(question.correctOptionIds?.length, question.id).toBeGreaterThan(0)
      const ids = new Set(question.options?.map((option) => option.id))
      for (const id of question.correctOptionIds ?? []) {
        expect(ids.has(id), `${question.id} lists the unknown option ${id}`).toBe(true)
      }
    }
  })

  it('gives every numeric question a number and a tolerance', () => {
    for (const question of QUIZ.filter((entry) => entry.kind === 'numeric')) {
      expect(typeof question.answer, question.id).toBe('number')
      expect(typeof question.tolerance, question.id).toBe('number')
      expect(question.tolerance!, question.id).toBeGreaterThanOrEqual(0)
    }
  })

  it('uses exact answers where the result is an integer', () => {
    for (const question of QUIZ.filter((entry) => entry.kind === 'numeric')) {
      if (Number.isInteger(question.answer!)) {
        expect(question.tolerance, question.id).toBe(0)
      }
    }
  })
})

describe('the equation reference', () => {
  it('has unique ids', () => {
    const ids = new Set(FORMULAS.map((formula) => formula.id))
    expect(ids.size).toBe(FORMULAS.length)
  })

  it('gives every formula a derivation, assumptions and a worked example', () => {
    for (const formula of FORMULAS) {
      expect(formula.derivation.length, formula.id).toBeGreaterThan(1)
      expect(formula.assumptions.length, formula.id).toBeGreaterThan(0)
      expect(formula.symbols.length, formula.id).toBeGreaterThan(0)
      expect(formula.example.result.length, formula.id).toBeGreaterThan(0)
      expect(formula.reference.url, formula.id).toMatch(/^https:\/\//)
    }
  })

  it('balances the braces in every LaTeX expression', () => {
    for (const formula of FORMULAS) {
      const opens = (formula.latex.match(/\{/g) ?? []).length
      const closes = (formula.latex.match(/\}/g) ?? []).length
      expect(opens, formula.id).toBe(closes)
    }
  })
})

describe('the references', () => {
  it('gives every reference a licence note', () => {
    for (const reference of REFERENCES) {
      expect(reference.licenseNote.length, reference.id).toBeGreaterThan(20)
      expect(reference.usedFor.length, reference.id).toBeGreaterThan(20)
      expect(reference.url, reference.id).toMatch(/^https:\/\//)
    }
  })
})

describe('the laboratory registry', () => {
  it('gives every laboratory a unique id and a screen', () => {
    expect(new Set(LAB_IDS).size).toBe(LAB_IDS.length)
    for (const lab of LABS) {
      expect(LAB_SCREENS[lab.id], lab.id).toBeDefined()
      expect(LAB_VIEWS[lab.id]?.length ?? 0, lab.id).toBeGreaterThan(0)
    }
  })

  it('claims every declared item exactly once', () => {
    expect(LAB_DELIVERIES.length).toBe(13)
    expect(new Set(LAB_DELIVERIES).size).toBe(LAB_DELIVERIES.length)
  })

  it('gives every laboratory a distinct set of views', () => {
    for (const lab of LABS) {
      const values = (LAB_VIEWS[lab.id] ?? []).map((view) => view.value)
      expect(new Set(values).size, lab.id).toBe(values.length)
    }
  })
})
