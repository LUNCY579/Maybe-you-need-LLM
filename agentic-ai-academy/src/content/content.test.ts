import { describe, expect, it } from 'vitest'
import { ALL_QUESTIONS, LESSONS, LESSON_BY_SLUG, TOTAL_STUDY_MINUTES, getLesson, nextLesson, previousLesson } from './lessons'
import { CHAPTERS, PARTS, PART_BY_ID } from './book'
import { GLOSSARY } from './glossary'
import { DIAGRAM_IDS } from './diagramIds'
import { REFERENCES } from './references'
import { LABS } from './labs'

const SLUGS = new Set(LESSONS.map((lesson) => lesson.slug))

describe('curriculum integrity', () => {
  it('ships at least ten authored lessons', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(10)
  })

  it('ships at least twenty assessment questions', () => {
    expect(ALL_QUESTIONS.length).toBeGreaterThanOrEqual(20)
  })

  it('covers every part of the book', () => {
    for (const part of PARTS) {
      expect(LESSONS.some((lesson) => lesson.part === part.id), `no lesson for ${part.title}`).toBe(true)
    }
  })

  it('has unique ids, slugs and orders', () => {
    expect(new Set(LESSONS.map((lesson) => lesson.id)).size).toBe(LESSONS.length)
    expect(new Set(LESSONS.map((lesson) => lesson.slug)).size).toBe(LESSONS.length)
    expect(new Set(LESSONS.map((lesson) => lesson.order)).size).toBe(LESSONS.length)
    expect(new Set(ALL_QUESTIONS.map((question) => question.id)).size).toBe(ALL_QUESTIONS.length)
  })

  it('resolves every prerequisite to a real lesson', () => {
    for (const lesson of LESSONS) {
      for (const prerequisite of lesson.prerequisites) {
        expect(SLUGS.has(prerequisite), `${lesson.slug} requires ${prerequisite}`).toBe(true)
        expect(LESSON_BY_SLUG.get(prerequisite)!.order).toBeLessThan(lesson.order)
      }
    }
  })

  it('points every further reading at a real reference, and says why', () => {
    const referenceIds = new Set(REFERENCES.map((reference) => reference.id))
    let withFurtherReading = 0
    for (const lesson of LESSONS) {
      // Every lesson has some primary literature behind it. A lesson without
      // any would be a lesson that stops at the survey.
      expect(lesson.furtherReading?.length ?? 0, `${lesson.slug} has no further reading`).toBeGreaterThan(0)
      for (const entry of lesson.furtherReading ?? []) {
        withFurtherReading += 1
        expect(referenceIds.has(entry.referenceId), `${lesson.slug} cites "${entry.referenceId}"`).toBe(true)
        expect(entry.note.trim().length, `${lesson.slug} → ${entry.referenceId} has no note`).toBeGreaterThan(20)
      }
    }
    expect(withFurtherReading).toBeGreaterThanOrEqual(LESSONS.length)
  })

  it('gives every further-reading reference a link and a licence note', () => {
    for (const lesson of LESSONS) {
      for (const entry of lesson.furtherReading ?? []) {
        const reference = REFERENCES.find((candidate) => candidate.id === entry.referenceId)!
        expect(reference.url, `${entry.referenceId} has no link`).toMatch(/^https:\/\//)
        expect(reference.licenseNote.trim().length, `${entry.referenceId} has no licence note`).toBeGreaterThan(10)
      }
    }
  })

  it('references real chapters and keeps page numbers plausible', () => {
    const chapterNumbers = new Set(CHAPTERS.map((chapter) => chapter.number))
    for (const lesson of LESSONS) {
      expect(lesson.provenance.textbookChapters.length).toBeGreaterThan(0)
      for (const chapter of lesson.provenance.textbookChapters) {
        expect(chapterNumbers.has(chapter), `${lesson.slug} cites chapter ${chapter}`).toBe(true)
      }
      for (const source of lesson.sources) {
        expect(chapterNumbers.has(source.chapter), `${source.label} cites chapter ${source.chapter}`).toBe(true)
        if (source.page !== undefined) expect(source.page).toBeGreaterThan(10)
      }
      for (const question of lesson.quiz) {
        expect(chapterNumbers.has(question.source.chapter)).toBe(true)
      }
    }
  })

  it('keeps quiz answers in range and explanations non-empty', () => {
    for (const question of ALL_QUESTIONS) {
      expect(question.options.length).toBeGreaterThanOrEqual(3)
      expect(question.correct).toBeGreaterThanOrEqual(0)
      expect(question.correct).toBeLessThan(question.options.length)
      expect(question.explanation.length).toBeGreaterThan(30)
      expect(question.source.label).toContain('Ch.')
    }
  })

  it('gives every lesson objectives, keywords and a provenance note', () => {
    for (const lesson of LESSONS) {
      expect(lesson.objectives.length).toBeGreaterThanOrEqual(3)
      expect(lesson.keywords.length).toBeGreaterThanOrEqual(3)
      expect(lesson.provenance.supplementaryNote.length).toBeGreaterThan(40)
      expect(lesson.sections.length).toBeGreaterThanOrEqual(4)
      expect(lesson.minutes).toBeGreaterThan(10)
    }
  })

  it('registers every diagram used by a lesson', () => {
    const registered = new Set(DIAGRAM_IDS)
    for (const lesson of LESSONS) {
      for (const section of lesson.sections) {
        for (const block of section.blocks) {
          if (block.kind === 'diagram') expect(registered.has(block.diagram), `missing diagram ${block.diagram}`).toBe(true)
        }
      }
    }
  })

  it('links lab blocks to registered labs', () => {
    const labIds = new Set(LABS.map((lab) => lab.id))
    for (const lesson of LESSONS) {
      for (const section of lesson.sections) {
        for (const block of section.blocks) {
          if (block.kind === 'lab-link') expect(labIds.has(block.labId), `unknown lab ${block.labId}`).toBe(true)
        }
      }
    }
  })

  it('orders lessons consistently with navigation helpers', () => {
    expect(previousLesson(LESSONS[0].slug)).toBeUndefined()
    expect(nextLesson(LESSONS.at(-1)!.slug)).toBeUndefined()
    expect(getLesson(LESSONS[1].slug)!.order).toBe(LESSONS[1].order)
    expect(TOTAL_STUDY_MINUTES).toBeGreaterThan(300)
  })

  it('maps parts back to chapters', () => {
    for (const part of PARTS) {
      const chapters = CHAPTERS.filter((chapter) => chapter.part === part.id)
      expect(chapters.length).toBeGreaterThan(0)
      expect(PART_BY_ID.get(part.id)!.title).toBe(part.title)
    }
    expect(CHAPTERS).toHaveLength(23)
  })
})

describe('glossary integrity', () => {
  it('links terms to real lessons and marks course terms', () => {
    const courseTerms = GLOSSARY.filter((entry) => entry.source === null)
    expect(courseTerms.length).toBeGreaterThan(0)
    for (const entry of GLOSSARY) {
      expect(entry.definition.length).toBeGreaterThan(30)
      expect(entry.lessons.length).toBeGreaterThan(0)
      for (const slug of entry.lessons) {
        expect(SLUGS.has(slug), `${entry.term} links to ${slug}`).toBe(true)
      }
      if (entry.source) expect(entry.source.label.length).toBeGreaterThan(0)
    }
  })

  it('has no duplicate terms', () => {
    const terms = GLOSSARY.map((entry) => entry.term.toLowerCase())
    expect(new Set(terms).size).toBe(terms.length)
  })
})

describe('reference integrity', () => {
  it('records a licence note and a use for every reference', () => {
    for (const reference of REFERENCES) {
      expect(reference.licenseNote.length).toBeGreaterThan(20)
      expect(reference.usedFor.length).toBeGreaterThan(20)
      if (reference.url) expect(reference.url.startsWith('https://')).toBe(true)
    }
  })

  it('includes the textbook as the primary reference', () => {
    const textbook = REFERENCES.find((reference) => reference.id === 'van-duijn-2026-agentic-llm')
    expect(textbook).toBeDefined()
    expect(textbook!.url).toContain('2610.13455')
  })
})

describe('lab registry', () => {
  it('routes uniquely and states its runtime basis', () => {
    expect(new Set(LABS.map((lab) => lab.id)).size).toBe(LABS.length)
    expect(new Set(LABS.map((lab) => lab.route)).size).toBe(LABS.length)
    for (const lab of LABS) {
      expect(lab.route.startsWith('/')).toBe(true)
      expect(lab.runtime.length).toBeGreaterThan(10)
      expect(lab.sourceChapters.length).toBeGreaterThan(0)
    }
  })
})
