import { describe, expect, it } from 'vitest'
import { MODULES, LESSONS } from './curriculum'
import { MODULE_STATUS, CONFIDENCE_LABEL, STATUS_CHECKED_ON, STATUS_CHECKED_LABEL, type Confidence } from './status'

/**
 * The page that says what is settled and what is moving.
 *
 * A page like this is only useful if it is complete and if its sources are
 * real, so both are checked here rather than trusted.
 */

const VALID_CONFIDENCE: Confidence[] = ['settled', 'settling', 'moving', 'open']

describe('how settled is this?', () => {
  it('describes every module of the course', () => {
    expect(MODULE_STATUS.length).toBe(MODULES.length)
    expect(MODULE_STATUS.map((entry) => entry.moduleId).sort()).toEqual(
      MODULES.map((module) => module.id).sort(),
    )
  })

  it('gives every module a confidence that is one of the four steps', () => {
    for (const entry of MODULE_STATUS) {
      expect(VALID_CONFIDENCE).toContain(entry.confidence)
      expect(CONFIDENCE_LABEL[entry.confidence]).toBeTruthy()
    }
  })

  it('says what holds and what is moving, for every module', () => {
    for (const entry of MODULE_STATUS) {
      expect(entry.settled.length, `${entry.moduleId} does not say what holds`).toBeGreaterThan(80)
      expect(entry.moving.length, `${entry.moduleId} does not say what is moving`).toBeGreaterThan(80)
      // The two must be different claims, not the same sentence twice.
      expect(entry.settled).not.toBe(entry.moving)
    }
  })

  it('cites at least two primary sources for every module', () => {
    for (const entry of MODULE_STATUS) {
      expect(entry.sources.length, `${entry.moduleId} has too few sources`).toBeGreaterThanOrEqual(2)
      for (const source of entry.sources) {
        expect(source.href).toMatch(/^https:\/\//)
        expect(source.label.length, `a source of ${entry.moduleId} has no label`).toBeGreaterThan(10)
        expect(source.note.length, `a source of ${entry.moduleId} has no note`).toBeGreaterThan(30)
      }
    }
  })

  it('cites each source once', () => {
    const hrefs = MODULE_STATUS.flatMap((entry) => entry.sources.map((source) => source.href))
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })

  it('names a venue or a year for every source', () => {
    // A label that is only the title of a paper leaves the reader with no way
    // to judge how much weight it carries, and no way to find it in a
    // bibliography without opening the link.
    const VENUES = /\b(ACL|ICLR|ICML|NeurIPS|EMNLP|NAACL|AAAI|TPAMI|arXiv|ICCV|ECCV|COLM|SIGIR|INTERSPEECH|Trans)\b/i
    const YEAR = /\b(19|20)\d{2}\b/
    for (const entry of MODULE_STATUS) {
      for (const source of entry.sources) {
        expect(
          VENUES.test(source.label) || YEAR.test(source.label),
          `"${source.label}" names neither a venue nor a year`,
        ).toBe(true)
      }
    }
  })

  it('does not repeat a module', () => {
    const ids = MODULE_STATUS.map((entry) => entry.moduleId)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('mentions every lesson somewhere, so the page is about the whole course', () => {
    // A sanity check that the course and the page have not drifted apart: the
    // page describes modules, and the course has lessons in every module.
    for (const module of MODULES) {
      expect(LESSONS.some((lesson) => lesson.moduleId === module.id)).toBe(true)
    }
  })

  it('says when the sources were checked, and the label agrees with the date', () => {
    // The date is written by `npm run check:links`, and only after every
    // source has been found to resolve. These checks make sure the page
    // shows a date that means something rather than a stale one.
    expect(STATUS_CHECKED_ON).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    expect(STATUS_CHECKED_LABEL).toMatch(/^\d{1,2} [A-Z][a-z]+ \d{4}$/)

    const [year, month, day] = STATUS_CHECKED_ON.split('-').map(Number)
    expect(month).toBeGreaterThanOrEqual(1)
    expect(month).toBeLessThanOrEqual(12)
    expect(day).toBeGreaterThanOrEqual(1)
    expect(day).toBeLessThanOrEqual(31)
    expect(year).toBeGreaterThanOrEqual(2026)
  })
})
