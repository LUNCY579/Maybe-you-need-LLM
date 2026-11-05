import { describe, expect, it } from 'vitest'
import {
  dependentsOf,
  findPrerequisiteCycle,
  lessonById,
  lessonsOfModule,
  moduleById,
  moduleLessonIds,
  prerequisiteOrder,
} from '../src/curriculum.js'
import type { LessonMeta, ModuleMeta } from '../src/curriculum.js'
import { dependentsOfTerm, findTermCycle, groupByInitial, termById } from '../src/glossary.js'
import type { GlossaryTerm } from '../src/glossary.js'

const modules: ModuleMeta[] = [
  { id: 'm1', chapter: 1, title: 'One', tagline: '', summary: '', accent: 'teal', outcomes: [] },
  { id: 'm2', chapter: 2, title: 'Two', tagline: '', summary: '', accent: 'amber', outcomes: [] },
]

function lesson(id: string, moduleId: string, prerequisites: string[] = []): LessonMeta {
  return {
    id,
    moduleId,
    number: 1,
    title: id,
    subtitle: '',
    minutes: 10,
    objectives: [],
    keyIdeas: [],
    interactive: { lab: 'lab', title: '', description: '' },
    prerequisites,
    glossaryTerms: [],
    quizIds: [],
    sourceRefs: [],
    furtherReading: [],
  }
}

const lessons: LessonMeta[] = [
  lesson('a', 'm1'),
  lesson('b', 'm1', ['a']),
  lesson('c', 'm2', ['b']),
]

describe('curriculum selectors', () => {
  it('finds modules and lessons', () => {
    expect(moduleById(modules, 'm1')?.title).toBe('One')
    expect(lessonById(lessons, 'b')?.moduleId).toBe('m1')
  })

  it('lists the lessons of a module', () => {
    expect(lessonsOfModule(lessons, 'm1').map((l) => l.id)).toEqual(['a', 'b'])
    expect(lessonsOfModule(lessons, 'm2').map((l) => l.id)).toEqual(['c'])
  })

  it('maps modules to their lesson ids', () => {
    expect(moduleLessonIds(modules, lessons)).toEqual({ m1: ['a', 'b'], m2: ['c'] })
  })

  it('finds direct dependents', () => {
    expect(dependentsOf(lessons, 'a')).toEqual(['b'])
  })
})

describe('prerequisite graph', () => {
  it('accepts a DAG', () => {
    expect(findPrerequisiteCycle(lessons)).toEqual([])
  })

  it('detects a cycle', () => {
    const cyclic = [lesson('x', 'm1', ['y']), lesson('y', 'm1', ['x'])]
    const cycle = findPrerequisiteCycle(cyclic)
    expect(cycle.length).toBeGreaterThan(0)
  })

  it('orders lessons so prerequisites come first', () => {
    const order = prerequisiteOrder(lessons)
    expect(order).not.toBeNull()
    expect(order!.indexOf('a')).toBeLessThan(order!.indexOf('b'))
    expect(order!.indexOf('b')).toBeLessThan(order!.indexOf('c'))
  })

  it('returns null when there is a cycle', () => {
    expect(prerequisiteOrder([lesson('x', 'm1', ['y']), lesson('y', 'm1', ['x'])])).toBeNull()
  })

  it('ignores a prerequisite that names no lesson', () => {
    expect(findPrerequisiteCycle([lesson('a', 'm1', ['ghost'])])).toEqual([])
  })
})

const terms: GlossaryTerm[] = [
  { id: 't1', term: 'Alpha', short: 'a', long: 'a', category: 'notation', prerequisites: [] },
  { id: 't2', term: 'Beta', short: 'b', long: 'b', category: 'notation', prerequisites: ['t1'] },
  { id: 't3', term: 'Gamma', short: 'c', long: 'c', category: 'concept', prerequisites: ['t2'] },
]

describe('glossary helpers', () => {
  it('finds a term by id', () => {
    expect(termById(terms, 't2')?.term).toBe('Beta')
  })

  it('finds terms that depend on another', () => {
    expect(dependentsOfTerm(terms, 't1').map((t) => t.id)).toEqual(['t2'])
  })

  it('detects a cycle in the term graph', () => {
    const cyclic: GlossaryTerm[] = [
      { id: 'x', term: 'X', short: '', long: '', category: 'concept', prerequisites: ['y'] },
      { id: 'y', term: 'Y', short: '', long: '', category: 'concept', prerequisites: ['x'] },
    ]
    expect(findTermCycle(cyclic).length).toBeGreaterThan(0)
    expect(findTermCycle(terms)).toEqual([])
  })

  it('groups terms by initial letter', () => {
    const groups = groupByInitial(terms)
    expect(groups.map((g) => g.letter)).toEqual(['A', 'B', 'G'])
    expect(groups[0].terms[0].term).toBe('Alpha')
  })
})
