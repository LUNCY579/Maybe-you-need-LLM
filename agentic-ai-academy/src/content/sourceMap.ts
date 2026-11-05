import { CHAPTERS } from './book'
import { LESSONS } from './lessons'
import type { PartId } from '../types/curriculum'

/**
 * The course-to-textbook source map.
 *
 * For every chapter of the book, which lessons cover it, which sections of
 * the book those lessons draw on, and which parts of the course material are
 * original additions rather than textbook content.
 *
 * Built as a pure function so it can be asserted on in tests.
 */

export interface SourceMapSource {
  /** The lesson's own label for the source, e.g. "Ch. 1, §1.2.2 Agentic Harness". */
  label: string
  section?: string
  page?: number
  lessonSlug: string
  lessonTitle: string
  lessonOrder: number
  /** True when the source is the textbook itself, false for supplementary material. */
  primary: boolean
}

export interface SourceMapChapter {
  number: number
  title: string
  part: PartId
  page: number
  isCaseStudy: boolean
  isAdvanced: boolean
  lessons: { slug: string; order: number; title: string }[]
  sources: SourceMapSource[]
  /**
   * True when at least one lesson in the course covers this chapter.
   */
  covered: boolean
}

export function buildSourceMap(): SourceMapChapter[] {
  return CHAPTERS.map((chapter) => {
    const lessons = LESSONS.filter((lesson) => lesson.provenance.textbookChapters.includes(chapter.number))
    const sources = lessons.flatMap((lesson) =>
      lesson.sources
        .filter((source) => source.chapter === chapter.number)
        .map((source) => ({
          label: source.label,
          section: source.section,
          page: source.page,
          lessonSlug: lesson.slug,
          lessonTitle: lesson.title,
          lessonOrder: lesson.order,
          primary: source.primary,
        })),
    )
    return {
      number: chapter.number,
      title: chapter.title,
      part: chapter.part,
      page: chapter.page,
      isCaseStudy: chapter.isCaseStudy,
      isAdvanced: chapter.isAdvanced,
      lessons: lessons.map((lesson) => ({ slug: lesson.slug, order: lesson.order, title: lesson.title })),
      sources,
      covered: lessons.length > 0,
    }
  })
}

/** Chapters of the book that no lesson currently covers. */
export function uncoveredChapters(map: SourceMapChapter[] = buildSourceMap()): SourceMapChapter[] {
  return map.filter((chapter) => !chapter.covered)
}
