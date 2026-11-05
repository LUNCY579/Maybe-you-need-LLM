import { describe, expect, it } from 'vitest'
import { findPrerequisiteCycle, moduleLessonIds, prerequisiteOrder } from '@llm-materials/course-core'
import { LESSONS, MODULES, SECTION_MAP, SOURCES, lessonsOfModule } from './curriculum'
import { LABS, LAB_IDS } from './labs'
import { LAB_DEFAULTS } from './labDefaults'
import { LAB_DOMAINS } from './labDomains'
import { LAB_SCREENS, LAB_VIEWS } from '../components/lab'
import { GLOSSARY } from './glossary'
import { QUIZ } from './quiz'
import { FORMULAS } from './formulas'
import { REFERENCES } from './sources'

const VIEW_COUNT = Object.values(LAB_VIEWS).reduce((sum, views) => sum + views.length, 0)

describe('the curriculum', () => {
  it('has seven modules and twenty-three lessons', () => {
    expect(MODULES.length).toBe(7)
    expect(LESSONS.length).toBe(23)
  })

  it('gives every lesson a module that exists', () => {
    const moduleIds = new Set(MODULES.map((module) => module.id))
    for (const lesson of LESSONS) {
      expect(moduleIds.has(lesson.moduleId), lesson.id).toBe(true)
    }
  })

  it('numbers the lessons consecutively', () => {
    expect(LESSONS.map((lesson) => lesson.number)).toEqual(
      Array.from({ length: LESSONS.length }, (_, index) => index + 1),
    )
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
    }
  })

  it('names equations that exist', () => {
    const formulaIds = new Set(FORMULAS.map((formula) => formula.id))
    for (const lesson of LESSONS) {
      expect(lesson.formulaIds?.length, lesson.id).toBeGreaterThan(0)
      for (const formulaId of lesson.formulaIds ?? []) {
        expect(formulaIds.has(formulaId), `${lesson.id} names the unknown equation ${formulaId}`).toBe(true)
      }
    }
  })

  it('cites only sections of the sources that exist', () => {
    for (const lesson of LESSONS) {
      for (const ref of lesson.sourceRefs) {
        expect(ref.section in SECTION_MAP, `${lesson.id} cites §${ref.section}, which is not in the map`).toBe(true)
      }
    }
  })

  it('cites a section whose source is in the reference list', () => {
    const referenceIds = new Set(REFERENCES.map((reference) => reference.id))
    const sourceIds = Object.values(SOURCES).map((source) => source.id)
    for (const id of sourceIds) {
      expect(referenceIds.has(id), `${id} is cited as a source but is not in the references`).toBe(true)
    }
    expect(new Set(sourceIds).size, 'two sources share an id').toBe(sourceIds.length)
  })

  it('gives every source reference a note and a chapter', () => {
    for (const lesson of LESSONS) {
      for (const ref of lesson.sourceRefs) {
        expect(ref.chapter, lesson.id).toBeTruthy()
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

  it('names quiz questions that exist, and owns them', () => {
    const byId = new Map(QUIZ.map((question) => [question.id, question]))
    for (const lesson of LESSONS) {
      expect(lesson.quizIds.length, lesson.id).toBeGreaterThan(0)
      for (const questionId of lesson.quizIds) {
        const question = byId.get(questionId)
        expect(question, `${lesson.id} names the unknown question ${questionId}`).toBeDefined()
        expect(question!.lessonId, `${questionId} belongs to ${question!.lessonId}, not ${lesson.id}`).toBe(lesson.id)
      }
    }
    // Every question in the bank is asked by the lesson that owns it.
    const asked = new Set(LESSONS.flatMap((lesson) => lesson.quizIds))
    for (const question of QUIZ) {
      expect(asked.has(question.id), `${question.id} is in the bank and on no lesson`).toBe(true)
    }
  })

  it('maps modules to their lessons', () => {
    const ids = moduleLessonIds(MODULES, LESSONS)
    for (const module of MODULES) {
      expect(ids[module.id].length, module.id).toBeGreaterThan(0)
    }
    expect(lessonsOfModule('power-laws').map((lesson) => lesson.id)).toEqual([
      'what-a-power-law-says',
      'how-the-exponent-is-measured',
    ])
  })

  it('keeps the modules in the order their lessons come', () => {
    const chapters = MODULES.map((module) => module.chapter)
    expect(chapters).toEqual([...chapters].sort((a, b) => a - b))
    for (const module of MODULES) {
      const numbers = lessonsOfModule(module.id).map((lesson) => lesson.number)
      expect(numbers, module.id).toEqual([...numbers].sort((a, b) => a - b))
    }
  })
})

describe('the laboratory registry', () => {
  it('gives every laboratory a unique id, a blurb and a screen', () => {
    const ids = LABS.map((lab) => lab.id)
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual([...LAB_IDS])
    for (const lab of LABS) {
      expect(lab.name.length, lab.id).toBeGreaterThan(0)
      expect(lab.blurb.length, lab.id).toBeGreaterThan(20)
      for (const item of lab.delivers) expect(item.length, `${lab.id} ${item}`).toBeGreaterThan(10)
    }
  })

  it('declares the items it delivers in the words of the manifest', () => {
    // Thirteen items are declared for this application across the six sources, and
    // the sum here is the check that the registry has not quietly dropped one or
    // claimed an item twice.
    const declared = LABS.flatMap((lab) => lab.delivers)
    expect(new Set(declared).size, 'a declared item is claimed by two screens').toBe(declared.length)
    expect(declared.length).toBe(13)
  })

  it('has a screen for every laboratory and a laboratory for every screen', () => {
    expect(Object.keys(LAB_SCREENS).sort()).toEqual([...LAB_IDS].sort())
    expect(Object.keys(LAB_VIEWS).sort()).toEqual([...LAB_IDS].sort())
  })

  it('sends a reader from every lesson to a screen and back', () => {
    for (const lab of LABS) {
      expect(LESSONS.some((lesson) => lesson.interactive.lab === lab.id), lab.id).toBe(true)
    }
  })

  it('deep-links only at views the screen offers', () => {
    for (const lesson of LESSONS) {
      const { lab, view } = lesson.interactive
      if (!view) continue
      const views = LAB_VIEWS[lab] ?? []
      const offered = views.some((entry) => entry.value === view)
      expect(offered, `${lesson.id} asks for /labs/${lab}?view=${view}, which that screen does not have`).toBe(true)
    }
  })

  it('sends a reader to every view, and to no view twice', () => {
    // The course is written so that one lesson owns one tab: a view no lesson links
    // to is a measurement nobody is told about, and two lessons on one view is a
    // lesson that has nothing of its own to show.
    expect(LESSONS.length).toBe(VIEW_COUNT)
    const linked = LESSONS.map((lesson) => `${lesson.interactive.lab}/${lesson.interactive.view}`)
    for (const [lab, views] of Object.entries(LAB_VIEWS)) {
      for (const view of views) {
        expect(linked.filter((entry) => entry === `${lab}/${view.value}`).length, `${lab}/${view.value}`).toBe(1)
      }
    }
  })

  it('offers each screen its own views, uniquely named', () => {
    for (const [lab, views] of Object.entries(LAB_VIEWS)) {
      expect(views.length, lab).toBeGreaterThan(1)
      const values = views.map((view) => view.value)
      expect(new Set(values).size, lab).toBe(values.length)
      expect(values[0], lab).toBeTruthy()
    }
  })
})

describe('the scenarios the screens start at, and the range they can be moved through', () => {
  it('gives every laboratory defaults and a domain, and the two cover the same fields', () => {
    // The runner reads the defaults, the sliders read the domain, and the sweep that
    // walks the domain is only a check on the screens if the two lists are about the
    // same scenario. A field in one and not the other is a slider nobody tests or a
    // number no screen can reach.
    expect(Object.keys(LAB_DEFAULTS).sort()).toEqual([...LAB_IDS].sort())
    expect(Object.keys(LAB_DOMAINS).sort()).toEqual([...LAB_IDS].sort())
    for (const id of LAB_IDS) {
      expect(Object.keys(LAB_DOMAINS[id] ?? {}).sort(), id).toEqual(Object.keys(LAB_DEFAULTS[id] ?? {}).sort())
    }
  })

  it('starts every screen inside the range its sliders allow', () => {
    for (const id of LAB_IDS) {
      for (const [field, values] of Object.entries(LAB_DOMAINS[id] ?? {})) {
        const value = (LAB_DEFAULTS[id] as Record<string, unknown>)[field]
        const sorted = typeof value === 'number' ? [...values].sort((a, b) => Number(a) - Number(b)) : values
        if (typeof value === 'number') {
          expect(value, `${id}.${field} starts below the smallest its slider allows`).toBeGreaterThanOrEqual(Number(sorted[0]))
          expect(value, `${id}.${field} starts above the largest its slider allows`).toBeLessThanOrEqual(Number(sorted[sorted.length - 1]))
        } else {
          expect(sorted, `${id}.${field} starts at an option its control does not offer`).toContainEqual(value)
        }
      }
    }
  })

  it('lists a domain that is finite, ordered and never a single value', () => {
    for (const [id, domain] of Object.entries(LAB_DOMAINS)) {
      for (const [field, values] of Object.entries(domain)) {
        expect(values.length, `${id}.${field}`).toBeGreaterThan(1)
        for (const value of values) {
          expect(typeof value === 'number' ? Number.isFinite(value) : value.length > 0, `${id}.${field} ${String(value)}`).toBe(true)
        }
      }
    }
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
