import { describe, expect, it } from 'vitest'
import { parseManifest, ManifestError, builtApps, orderedApps, sourcesOfApp } from './manifest'
import { findPathCycle, layersOf, nextCourses, prerequisitesOf, startingCourses, successorsOf } from './paths'
import { CONCEPTS, conceptsOfCourse, overlapBetween, sharedConcepts } from './concepts'
import { buildCatalogueIndex, buildLessonIndex, searchCatalogue } from './search'

const MANIFEST = {
  version: 1,
  lastVerified: '2026-10-19',
  verificationMethods: { 'arxiv-abs': 'the title was read from the record' },
  apps: [
    { id: 'a-lab', title: 'A Lab', status: 'built', primarySource: 's-1', modules: ['One', 'Two'] },
    { id: 'b-lab', title: 'B Lab', status: 'built', primarySource: 's-2', modules: ['Three'] },
    { id: 'c-lab', title: 'C Lab', status: 'planned', primarySource: 's-1', modules: ['Four'] },
  ],
  sources: [
    {
      id: 's-1',
      title: 'The first source',
      authors: ['A. Author'],
      year: 2020,
      kind: 'paper',
      venue: 'arXiv:0000.00000',
      url: 'https://arxiv.org/abs/0000.00000',
      license: 'arXiv perpetual licence.',
      app: 'a-lab',
      role: 'primary',
      gapClosed: 'The gap it closes.',
      labs: ['The lab it makes possible'],
      verification: { method: 'arxiv-abs', checkedAt: '2026-10-19' },
    },
    {
      id: 's-2',
      title: 'The second source',
      authors: ['B. Author'],
      year: 2021,
      kind: 'book',
      venue: 'A publisher',
      url: 'https://example.org/book',
      license: 'Cited only.',
      app: 'b-lab',
      role: 'primary',
      gapClosed: 'Another gap.',
      labs: ['Another lab'],
      verification: { method: 'manual', checkedAt: '2026-10-19' },
    },
  ],
}

describe('the manifest', () => {
  it('parses a well-formed manifest', () => {
    const manifest = parseManifest(MANIFEST)
    expect(manifest.apps.length).toBe(3)
    expect(manifest.sources.length).toBe(2)
  })

  it('rejects a manifest that is not an object', () => {
    expect(() => parseManifest(null)).toThrow(ManifestError)
    expect(() => parseManifest('nope')).toThrow(ManifestError)
  })

  it('rejects an app whose primary source does not exist', () => {
    const broken = { ...MANIFEST, apps: [{ ...MANIFEST.apps[0]!, primarySource: 'missing' }] }
    expect(() => parseManifest(broken)).toThrow(ManifestError)
  })

  it('rejects a source that belongs to no app', () => {
    const broken = { ...MANIFEST, sources: [{ ...MANIFEST.sources[0]!, app: 'nowhere' }] }
    expect(() => parseManifest(broken)).toThrow(ManifestError)
  })

  it('rejects an app with an unknown status', () => {
    const broken = { ...MANIFEST, apps: [{ ...MANIFEST.apps[0]!, status: 'maybe' }] }
    expect(() => parseManifest(broken)).toThrow(ManifestError)
  })

  it('orders the built courses first', () => {
    const manifest = parseManifest(MANIFEST)
    const ordered = orderedApps(manifest)
    expect(ordered[0]!.status).toBe('built')
    expect(ordered[ordered.length - 1]!.status).toBe('planned')
  })

  it('counts the sources of a course', () => {
    const manifest = parseManifest(MANIFEST)
    expect(sourcesOfApp(manifest, 'a-lab').length).toBe(1)
    expect(builtApps(manifest).every((app) => app.sources >= 1)).toBe(true)
  })
})

describe('the learning path', () => {
  it('is acyclic', () => {
    expect(findPathCycle(LEARNING_PATH_FOR_TEST)).toEqual([])
  })

  it('gives every course a place in the path', () => {
    const ids = new Set(LEARNING_PATH_FOR_TEST.courses.map((course) => course.id))
    for (const edge of LEARNING_PATH_FOR_TEST.edges) {
      expect(ids.has(edge.from), edge.from).toBe(true)
      expect(ids.has(edge.to), edge.to).toBe(true)
    }
  })

  it('says what to do next, given what is finished', () => {
    const first = startingCourses(LEARNING_PATH_FOR_TEST)
    expect(first.length).toBeGreaterThan(0)
    for (const id of first) {
      expect(prerequisitesOf(LEARNING_PATH_FOR_TEST, id)).toEqual([])
    }
  })

  it('unlocks a course once its prerequisite is finished', () => {
    const target = 'scaling-lab'
    const prerequisites = prerequisitesOf(LEARNING_PATH_FOR_TEST, target)
    expect(prerequisites.length).toBeGreaterThan(0)
    const before = nextCourses(LEARNING_PATH_FOR_TEST, [])
    const after = nextCourses(LEARNING_PATH_FOR_TEST, prerequisites)
    expect(after).toContain(target)
    expect(before).not.toContain(target)
  })

  it('lists the successors of a course', () => {
    expect(successorsOf(LEARNING_PATH_FOR_TEST, 'llm-foundations-lab').length).toBeGreaterThan(0)
  })

  it('groups the path into layers', () => {
    const layers = layersOf(LEARNING_PATH_FOR_TEST)
    expect(layers.length).toBeGreaterThan(1)
    const flat = layers.flat()
    expect(flat.length).toBe(LEARNING_PATH_FOR_TEST.courses.length)
    expect(new Set(flat).size).toBe(flat.length)
  })
})

describe('the concept index', () => {
  it('gives every concept at least one course', () => {
    for (const concept of CONCEPTS) {
      expect(concept.courses.length, concept.id).toBeGreaterThan(0)
      expect(concept.summary.length, concept.id).toBeGreaterThan(10)
    }
  })

  it('names only courses that are in the path', () => {
    const ids = new Set(LEARNING_PATH_FOR_TEST.courses.map((course) => course.id))
    for (const concept of CONCEPTS) {
      for (const course of concept.courses) {
        expect(ids.has(course), `${concept.id} names the unknown course ${course}`).toBe(true)
      }
    }
  })

  it('finds the overlap between two courses', () => {
    const overlap = overlapBetween('scaling-lab', 'data-lab')
    expect(overlap.length).toBeGreaterThan(0)
    expect(sharedConcepts().length).toBeGreaterThan(0)
  })

  it('lists the concepts of one course', () => {
    expect(conceptsOfCourse('scaling-lab').length).toBeGreaterThan(0)
    expect(conceptsOfCourse('nothing-at-all').length).toBe(0)
  })
})

describe('the collection search', () => {
  it('indexes the courses, the sources and the concepts', () => {
    const manifest = parseManifest(MANIFEST)
    const documents = buildCatalogueIndex(manifest)
    const kinds = new Set(documents.map((document) => document.kind))
    expect(kinds.has('Course')).toBe(true)
    expect(kinds.has('Source')).toBe(true)
    expect(kinds.has('Concept')).toBe(true)
  })

  it('finds a course by its title', () => {
    const manifest = parseManifest(MANIFEST)
    const documents = buildCatalogueIndex(manifest)
    const hits = searchCatalogue(documents, 'A Lab')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits[0]!.document.title).toBe('A Lab')
  })

  it('finds a source by its author', () => {
    const manifest = parseManifest(MANIFEST)
    const documents = buildCatalogueIndex(manifest)
    const hits = searchCatalogue(documents, 'Author')
    expect(hits.length).toBeGreaterThan(0)
    expect(hits.some((hit) => hit.document.kind === 'Source')).toBe(true)
  })

  it('indexes the lessons of every course', () => {
    const lessons = buildLessonIndex('', './')
    expect(lessons.length).toBeGreaterThan(50)
    const first = lessons[0]!
    expect(first.kind).toBe('Lesson')
    expect(first.href).toContain('#/lessons/')
  })

  it('leaves out the lessons of the course that is searching', () => {
    const everything = buildLessonIndex('', './')
    const without = buildLessonIndex('data-lab', '../')
    expect(without.length).toBeLessThan(everything.length)
    expect(without.every((document) => document.app !== 'data-lab')).toBe(true)
  })

  it('returns nothing for an empty query', () => {
    const manifest = parseManifest(MANIFEST)
    const documents = buildCatalogueIndex(manifest)
    expect(searchCatalogue(documents, '   ').length).toBe(0)
  })
})

import { LEARNING_PATH as LEARNING_PATH_FOR_TEST } from './paths'
