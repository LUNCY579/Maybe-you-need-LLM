import { describe, expect, it } from 'vitest'
import { ALL_QUESTIONS, LESSONS } from '../../content/lessons'
import type { LessonBlock, QuizQuestion } from '../../types/curriculum'
import { TASK_FAMILIES, measureFamily } from './reasoningDepth'
import {
  COMPARISON_PROVENANCE,
  FRONTIER_LIMITATIONS,
  FRONTIER_REPORT,
  STAND_IN_DEPTH_CONFIG,
  auditExamCoverage,
  auditLimitations,
  chapterCorpus,
  examCoverage,
  questionsForFamily,
  reportedCellViolations,
  runFrontierAudit,
  standInVerdict,
  type ComparisonProvenance,
  type ReportedCell,
} from './frontierAccount'

/**
 * Flatten a block for the answer-key probe only.
 *
 * The engine has its own extractor; this one exists so the test can name the
 * words that live *solely* in an answer key and check the engine never saw them.
 */
function flattenBlock(block: LessonBlock): string {
  switch (block.kind) {
    case 'prose':
      return block.markdown
    case 'callout':
      return `${block.title} ${block.markdown}`
    case 'list':
      return block.items.join(' ')
    case 'formula':
      return `${block.caption ?? ''} ${block.latex}`
    case 'table':
      return `${block.caption} ${block.headers.join(' ')} ${block.rows.flat().join(' ')}`
    case 'diagram':
      return block.caption
    case 'code':
      return `${block.code} ${block.caption ?? ''}`
    case 'example':
      return `${block.title} ${block.takeaway} ${block.steps.map((s) => `${s.label} ${s.detail}`).join(' ')}`
    case 'lab-link':
      return `${block.title} ${block.description}`
    case 'demo':
      return `${block.title} ${block.intro}`
    default:
      return ''
  }
}

function words(text: string): string[] {
  return text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length >= 6)
}

const synthetic = (overrides: Partial<QuizQuestion>): QuizQuestion => ({
  id: 'synthetic-1',
  prompt: 'Which statement about the hedged retrieval guardrail is accurate?',
  options: [
    'the hedged retrieval guardrail thresholds every result',
    'a wholly unrelated contraption',
    'another unrelated contraption entirely',
    'yet another unrelated contraption',
  ],
  correct: 0,
  explanation: 'unused by the rule',
  source: { label: 'Chapter 6', chapter: 6, primary: true },
  difficulty: 'core',
  ...overrides,
})

describe('the frontier audit', () => {
  it('Ch. 23: the frontier the chapter measures itself against, and a rare honest account of what a large model does and does not do.', () => {
    const audit = runFrontierAudit()

    // One comparison cell per family, every one of them labelled, and none of
    // them carrying a figure: a digit in the comparison column would read as a
    // measurement of a model, which is exactly what this module refuses to do.
    expect(audit.rows).toHaveLength(TASK_FAMILIES.length)
    expect(audit.provenance.cells).toBe(audit.rows.length)
    expect(audit.provenance.violations).toEqual([])
    expect(audit.provenance.ok).toBe(true)
    for (const row of audit.rows) {
      expect(row.reported.provenance).toBe(COMPARISON_PROVENANCE)
      expect(row.reported.claim).not.toMatch(/\d/)
      // Not a model's name in the claim either: the only legal place for the
      // frontier is the citation, where it is a source and not a score.
      expect(row.reported.claim).not.toMatch(/gpt|claude|gemini|benchmark score/i)
      expect(row.reported.source).toMatch(/^Ch\.\s*23/)
      // The measured column is the one that carries numbers.
      expect(row.standIn!.accuracy).toBeGreaterThan(0)
      expect(row.standIn!.accuracy).toBeLessThanOrEqual(1)
      expect(String(row.standIn!.accuracy)).toMatch(/\d/)
    }

    // The frontier the chapter measures itself against is named, and named as a
    // report rather than as something this app ran.
    const namesTheFrontier = audit.rows.filter((row) => /Technical Report/.test(row.reported.source))
    expect(namesTheFrontier.length).toBeGreaterThan(0)
    for (const row of namesTheFrontier) {
      expect(row.reported.provenance).toBe('reported-not-measured-here')
    }

    // "Does and does not": the reported column has to record both halves — a
    // capability the chapter credits and a failure it records.
    const claims = Object.values(FRONTIER_REPORT).map((cell) => cell.claim.toLowerCase())
    expect(claims.some((claim) => /did not|no rate|hallucinat|memory-less|may not/.test(claim))).toBe(true)
    expect(claims.some((claim) => /improved/.test(claim))).toBe(true)

    // The honest account is a count over this course's own text, and the point
    // of counting is that the course comes up short somewhere.
    expect(audit.limitations.total).toBe(FRONTIER_LIMITATIONS.length)
    expect(audit.limitations.taughtCount).toBeGreaterThan(0)
    expect(audit.limitations.coverage).toBe(audit.limitations.taughtCount / audit.limitations.total)
    expect(audit.limitations.untaught.length).toBeGreaterThan(0)
    expect(audit.limitations.untaught).toEqual(
      audit.limitations.rows.filter((row) => !row.taught).map((row) => row.limitation.section)
    )
    // And the shortfall is true: nothing in the lesson text speaks of it.
    for (const section of audit.limitations.untaught) {
      const limitation = FRONTIER_LIMITATIONS.find((entry) => entry.section === section)!
      const wholeCorpus = new Set([1, 6, 9, 12, 23].flatMap((chapter) => [...chapterCorpus(chapter)]))
      for (const marker of limitation.markers) {
        expect([...wholeCorpus].some((word) => word.includes(marker.toLowerCase()))).toBe(false)
      }
    }

    // The headline sentence the screen shows is generated from those numbers,
    // and says out loud that none of them is about a model.
    expect(audit.summary).toContain(`${audit.limitations.taughtCount} of the ${audit.limitations.total}`)
    expect(audit.summary).toContain(`${audit.bank.answerable} of the ${audit.bank.questions}`)
    expect(audit.summary).toMatch(/none of these numbers describe a model/i)
  })

  it('keeps every reported cell number-free, and says so when one is not', () => {
    const violations = (cell: Partial<ReportedCell>) =>
      reportedCellViolations([
        {
          claim: 'The chapter records a limitation.',
          source: 'Ch. 23 §23.2.2',
          provenance: COMPARISON_PROVENANCE,
          ...cell,
        } as ReportedCell,
      ])

    expect(reportedCellViolations()).toEqual([])
    // A figure in the comparison column is the failure this exists to prevent.
    expect(violations({ claim: 'It scores 58.2 percent on the battery.' })).toEqual([
      expect.stringContaining('carries a digit'),
    ])
    expect(violations({ claim: 'It reaches 90% on the paper.' })).toHaveLength(2)
    // A cell that claims to have been measured here is a lie, not a typo.
    expect(violations({ provenance: 'measured-here' as ComparisonProvenance })).toEqual([
      expect.stringContaining('provenance'),
    ])
    // Uncited text cannot be checked by anyone reading the screen.
    expect(violations({ source: 'a blog post' })).toEqual([expect.stringContaining('chapter citation')])
    // And the shipped report passes all four checks at once.
    for (const cell of Object.values(FRONTIER_REPORT)) {
      expect(reportedCellViolations([cell])).toEqual([])
    }
  })

  it('takes the measured column from the depth policy, so it cannot be a stored figure', () => {
    const audit = runFrontierAudit()
    for (const row of audit.rows) {
      const direct = measureFamily(row.family, STAND_IN_DEPTH_CONFIG)!
      // Same engine, same policy, same numbers: the column is computed, not typed.
      expect(row.standIn).toEqual(direct)
      // Style A at one step is the declared stand-in: no chain, no tool.
      expect(row.standIn!.meanReasoningSteps).toBe(1)
      expect(row.standIn!.meanToolSteps).toBe(0)
    }

    // Change the policy and the measured column moves, while the reported
    // column — text, not numbers — does not.
    const chained = runFrontierAudit({ ...STAND_IN_DEPTH_CONFIG, style: 'C', chainLength: 8 })
    for (const row of chained.rows) {
      expect(row.reported).toEqual(FRONTIER_REPORT[row.family])
      expect(row.standIn!.meanReasoningSteps).toBe(8)
    }
    const writingDirect = audit.rows.find((row) => row.family === 'writing')!.standIn!.accuracy
    const writingChained = chained.rows.find((row) => row.family === 'writing')!.standIn!.accuracy
    expect(writingChained).toBeLessThan(writingDirect)

    // The exam column reads the bank and the lesson text, so a policy change
    // cannot flatter it.
    expect(chained.rows.map((row) => row.exam)).toEqual(audit.rows.map((row) => row.exam))
  })

  it("answers the course's own questions by echoing its own text, and abstains otherwise", () => {
    const chapterSix = ALL_QUESTIONS.filter((question) => question.source.chapter === 6)
    const arithmetic = auditExamCoverage('arithmetic')
    expect(arithmetic.questions).toBe(chapterSix.length)
    expect(arithmetic.questions).toBeGreaterThan(0)
    expect(arithmetic.answerable).toBeLessThanOrEqual(arithmetic.questions)
    expect(arithmetic.matchesKey).toBeLessThanOrEqual(arithmetic.answerable)
    expect(arithmetic.answerableFraction).toBeCloseTo(arithmetic.answerable / arithmetic.questions, 10)

    // The rule is a wording test, so it is exposed as one: a correct option
    // phrased in the chapter's own words is found, and the same option phrased
    // in words the chapter never uses is not.
    const corpus = chapterCorpus(6)
    const echoes = synthetic({})
    expect(standInVerdict(echoes, corpus).answerable).toBe(true)
    const foreign = synthetic({
      options: ['zxyvq wkjmpn', 'qrtpfb glkzmd', 'hgnvcs jfbmal', 'kdpoze oncrhb'],
    })
    const abstain = standInVerdict(foreign, corpus)
    expect(abstain.answerable).toBe(false)
    expect(abstain.picked).toBeNull()
    expect(abstain.reason).toContain('no content word')

    // A tie is an abstention too, so the rule cannot pad its own coverage.
    const tied = synthetic({
      options: ['the hedged retrieval guardrail thresholds', 'the hedged retrieval guardrail thresholds', 'unrelated', 'also unrelated'],
    })
    const tieVerdict = standInVerdict(tied, corpus)
    expect(tieVerdict.answerable).toBe(false)
    expect(tieVerdict.scores[0]).toBeGreaterThan(0)
    expect(tieVerdict.reason).toContain('tie')

    // The bank the audit reports on is a pool of real questions, smaller than
    // the whole bank, and the fraction is over that pool rather than the total.
    const audit = runFrontierAudit()
    const pool = TASK_FAMILIES.flatMap((family) => questionsForFamily(family.id))
    expect(audit.bank.questions).toBe(new Set(pool.map((question) => question.id)).size)
    expect(audit.bank.questions).toBeLessThan(audit.bank.wholeBank)
    expect(audit.bank.wholeBank).toBe(ALL_QUESTIONS.length)
    expect(audit.bank.answerableFraction).toBeCloseTo(audit.bank.answerable / audit.bank.questions, 10)
    expect(audit.rows.reduce((sum, row) => sum + row.exam.questions, 0)).toBe(audit.bank.questions)
    // Every question it claims to answer is a question the bank actually holds.
    for (const question of pool) {
      expect(ALL_QUESTIONS.some((entry) => entry.id === question.id)).toBe(true)
    }
  })

  it('builds its corpus from the teaching text and never from the answer key', () => {
    // `taught` is every word the engine is allowed to read, gathered
    // independently: title, summary, objectives, section titles and the
    // non-answer blocks. `key` is every word inside a checkpoint or a
    // prediction — the answer half of the lesson, which the rule must not see.
    const taught = new Set<string>()
    const key = new Set<string>()
    for (const lesson of LESSONS) {
      for (const word of words(
        `${lesson.title} ${lesson.summary} ${lesson.objectives.map((o) => o.text).join(' ')}`
      )) {
        taught.add(word)
      }
      // The graded questions are answer keys too, and none of this text is in
      // the corpus the rule reads.
      for (const question of [...lesson.quiz, ...lesson.advancedQuiz]) {
        for (const word of words(`${question.prompt} ${question.options.join(' ')} ${question.explanation}`)) {
          key.add(word)
        }
      }
      for (const section of [...lesson.sections, ...lesson.advancedSections]) {
        for (const word of words(section.title)) taught.add(word)
        for (const block of section.blocks) {
          if (block.kind === 'checkpoint') {
            for (const word of words(`${block.question} ${block.answer}`)) key.add(word)
          } else if (block.kind === 'predict') {
            const q = block.question
            for (const word of words(`${q.prompt} ${q.options.join(' ')} ${q.explanation}`)) key.add(word)
          } else {
            for (const word of words(flattenBlock(block))) taught.add(word)
          }
        }
      }
    }
    // Words that exist only inside an answer key. If this set were empty the
    // test would prove nothing, so its size is asserted as well.
    const keyOnly = [...key].filter((word) => !taught.has(word))
    expect(keyOnly.length).toBeGreaterThan(0)

    for (const chapter of [1, 6, 9, 12, 23] as const) {
      const corpus = chapterCorpus(chapter)
      expect(corpus.size).toBeGreaterThan(0)
      expect(keyOnly.filter((word) => corpus.has(word))).toEqual([])
    }

    // The corpus is the course's own mapping, not one invented here: a chapter
    // no lesson claims has no words to echo, and a family the bank holds no
    // question for reports null rather than a zero that looks like a result.
    expect(chapterCorpus(999).size).toBe(0)
    const emptyPool = examCoverage('arithmetic', [])
    expect(emptyPool.questions).toBe(0)
    expect(emptyPool.answerable).toBe(0)
    expect(emptyPool.answerableFraction).toBeNull()
    expect(emptyPool.precisionWhenAnswering).toBeNull()
    // And the same function over the real pool is what the audit publishes.
    expect(examCoverage('arithmetic', questionsForFamily('arithmetic'))).toEqual(auditExamCoverage('arithmetic'))
  })

  it('is deterministic and reports the same audit on every run', () => {
    const first = runFrontierAudit()
    const second = runFrontierAudit()
    expect(second).toEqual(first)
    expect(JSON.stringify(second.rows)).toBe(JSON.stringify(first.rows))
    expect(JSON.stringify(second.summary)).toBe(JSON.stringify(first.summary))
    expect(auditLimitations()).toEqual(auditLimitations())

    // The evidence behind a taught limitation is real text from a real lesson,
    // not a restatement of the marker that found it.
    for (const row of first.limitations.rows.filter((entry) => entry.taught)) {
      expect(row.mentions).toBeGreaterThan(0)
      expect(row.evidence.length).toBeGreaterThan(0)
      expect(row.evidence.length).toBeLessThanOrEqual(3)
      for (const evidence of row.evidence) {
        expect(LESSONS.some((lesson) => lesson.slug === evidence.lessonSlug)).toBe(true)
        expect(evidence.excerpt.toLowerCase()).toContain(evidence.marker.toLowerCase())
        expect(row.limitation.markers).toContain(evidence.marker)
      }
    }
  })
})
