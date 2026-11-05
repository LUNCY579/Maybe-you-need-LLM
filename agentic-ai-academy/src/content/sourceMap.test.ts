import { describe, expect, it } from 'vitest'
import { buildSourceMap, uncoveredChapters } from './sourceMap'
import { CHAPTERS, PARTS } from './book'
import { LESSONS } from './lessons'

describe('source map', () => {
  it('has one row per book chapter', () => {
    expect(buildSourceMap()).toHaveLength(CHAPTERS.length)
  })

  it('shows every chapter of the book as covered', () => {
    expect(uncoveredChapters().map((chapter) => chapter.number)).toEqual([])
  })

  it('links each chapter to at least one lesson', () => {
    for (const chapter of buildSourceMap()) {
      expect(chapter.lessons.length, `chapter ${chapter.number} has no lesson`).toBeGreaterThan(0)
    }
  })

  it('records the textbook sections each chapter draws on', () => {
    for (const chapter of buildSourceMap()) {
      expect(chapter.sources.length, `chapter ${chapter.number} has no source sections`).toBeGreaterThan(0)
      for (const source of chapter.sources) {
        expect(source.label.length).toBeGreaterThan(0)
        expect(source.primary).toBe(true)
      }
    }
  })

  it('records the page number of each chapter', () => {
    for (const chapter of buildSourceMap()) {
      expect(chapter.page).toBeGreaterThan(0)
    }
  })

  it('assigns every chapter to a part that exists', () => {
    const partIds = new Set(PARTS.map((part) => part.id))
    for (const chapter of buildSourceMap()) {
      expect(partIds.has(chapter.part)).toBe(true)
    }
  })

  it('gives every lesson a secondaryParts list, and only valid part ids', () => {
    const partIds = new Set(PARTS.map((part) => part.id))
    for (const lesson of LESSONS) {
      expect(Array.isArray(lesson.secondaryParts), `${lesson.slug} has no secondaryParts`).toBe(true)
      for (const part of lesson.secondaryParts) {
        expect(partIds.has(part)).toBe(true)
        expect(part).not.toBe(lesson.part)
      }
    }
  })

  it('marks the book’s case studies and advanced chapters', () => {
    const map = buildSourceMap()
    const caseStudies = map.filter((chapter) => chapter.isCaseStudy).map((chapter) => chapter.number)
    expect(caseStudies).toEqual([5, 10, 14, 18])
    const advanced = map.filter((chapter) => chapter.isAdvanced).map((chapter) => chapter.number)
    expect(advanced).toEqual([19, 20, 21, 22])
  })
})
