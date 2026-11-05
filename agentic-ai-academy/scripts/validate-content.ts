/**
 * Content validator.
 *
 * The curriculum is data, and the schema is designed to be extended: adding a
 * lesson should be a matter of writing the lesson, not of hunting through the
 * rendering layer. That only works if the build *tells you* when the content
 * is inconsistent, so this script runs as part of `npm run build` and fails
 * the build on a broken course.
 *
 * It checks the things that are easy to get wrong when extending:
 *
 *  - duplicate or missing ids;
 *  - questions with an out-of-range answer, no options, or no explanation;
 *  - sources that point at a chapter the book does not have;
 *  - diagrams, laboratories or demonstrations that a lesson refers to but
 *    that do not exist;
 *  - glossary relations that point at nothing;
 *  - glossary terms attached to a lesson that does not exist;
 *  - concept-to-demonstration routes that lead to a demonstration no lesson
 *    contains, which would be a dead link for the student;
 *  - laboratory diagnostic questions that do not name the control that tests
 *    them, which would make them guessable rather than checkable;
 *  - chapters of the book that no lesson covers.
 *
 * It also prints a short report, so the build output says something about the
 * course rather than just "ok".
 */

import { LESSONS, ALL_QUESTIONS, PREDICT_QUESTIONS } from '../src/content/lessons/index'
import { ALL_LAB_QUESTIONS, LAB_QUESTIONS } from '../src/content/labQuestions'
import { GLOSSARY } from '../src/content/glossary'
import { CHAPTERS, CHAPTER_BY_NUMBER } from '../src/content/book'
import { LABS } from '../src/content/labs'
import { DIAGRAM_IDS } from '../src/content/diagramIds'
import { DEMO_IDS } from '../src/content/demos'
import { DEMO_FOR_TERM } from '../src/content/demoLinks'
import { REFERENCE_BY_ID, REFERENCES } from '../src/content/references'

interface Problem {
  severity: 'error' | 'warning'
  where: string
  message: string
}

const problems: Problem[] = []
const error = (where: string, message: string) => problems.push({ severity: 'error', where, message })
const warn = (where: string, message: string) => problems.push({ severity: 'warning', where, message })

/* ------------------------------------------------------------------ */
/* Identifiers                                                         */
/* ------------------------------------------------------------------ */

const seenIds = new Map<string, string>()
for (const lesson of LESSONS) {
  if (seenIds.has(lesson.id)) error(lesson.slug, `duplicate lesson id "${lesson.id}"`)
  seenIds.set(lesson.id, lesson.slug)
  if (seenIds.has(lesson.slug)) error(lesson.slug, `duplicate lesson slug "${lesson.slug}"`)
}

const allQuestions = [...ALL_QUESTIONS]
const questionIds = new Set<string>()
for (const question of allQuestions) {
  if (questionIds.has(question.id)) error(question.id, 'duplicate question id')
  questionIds.add(question.id)
}

/* ------------------------------------------------------------------ */
/* Questions                                                           */
/* ------------------------------------------------------------------ */

for (const question of allQuestions) {
  if (question.options.length < 2) error(question.id, 'a question needs at least two options')
  if (new Set(question.options).size !== question.options.length) {
    error(question.id, 'a question repeats an option verbatim')
  }
  if (question.correct < 0 || question.correct >= question.options.length) {
    error(question.id, `the answer index ${question.correct} is outside the options`)
  }
  if (question.explanation.trim().length < 40) {
    error(question.id, 'the explanation is too short to teach anything')
  }
  if (!question.source.label.trim()) error(question.id, 'the question has no source reference')
  if (!CHAPTER_BY_NUMBER.has(question.source.chapter)) {
    error(question.id, `the source points at chapter ${question.source.chapter}, which the book does not have`)
  }
  if (question.source.page === undefined) {
    warn(question.id, 'the source has no page reference')
  }
}

/* ------------------------------------------------------------------ */
/* Lessons                                                             */
/* ------------------------------------------------------------------ */

/**
 * How many times the lesson names a chapter.
 *
 * The prose refers to chapters as "Ch. 9", "Chapter 9" or "§9.3", and the
 * bare number is far too common to count. This counts the ways a chapter is
 * actually named.
 */
function countChapterMentions(lesson: (typeof LESSONS)[number], chapter: number): number {
  const text = JSON.stringify([...lesson.sections, ...lesson.advancedSections])
  const pattern = new RegExp(`(?:Ch\\.?|Chapter)\\s*${chapter}\\b|§\\s*${chapter}\\.`, 'g')
  return (text.match(pattern) ?? []).length
}

const lessonSlugs = new Set(LESSONS.map((lesson) => lesson.slug))
const coveredChapters = new Set<number>()
/** The demonstrations that a lesson actually embeds. */
const usedDemos = new Set<string>()

for (const lesson of LESSONS) {
  if (lesson.objectives.length === 0) error(lesson.slug, 'the lesson has no learning objectives')
  if (lesson.sections.length === 0) error(lesson.slug, 'the lesson has no sections')
  if (lesson.quiz.length === 0) error(lesson.slug, 'the lesson has no assessment questions')
  if (lesson.keywords.length === 0) warn(lesson.slug, 'the lesson has no keywords')
  if (lesson.sources.length === 0) error(lesson.slug, 'the lesson cites no sources')

  for (const source of lesson.sources) {
    if (!CHAPTER_BY_NUMBER.has(source.chapter)) {
      error(lesson.slug, `the source "${source.label}" points at a chapter the book does not have`)
    }
  }

  for (const chapter of lesson.provenance.textbookChapters) {
    if (!CHAPTER_BY_NUMBER.has(chapter)) {
      error(lesson.slug, `the provenance points at chapter ${chapter}, which the book does not have`)
    }
    coveredChapters.add(chapter)

    /*
     * A claimed chapter has to be *used*.
     *
     * The provenance is a claim that the lesson teaches that chapter, and the
     * claim was checked only for consistency with the book's own table of
     * contents. A chapter could be claimed and then mentioned twice in
     * passing, which is not teaching it — Chapter 13 was claimed by a
     * conclusion lesson and covered by two parenthetical references. So the
     * chapter has to appear in the lesson's own sources, and be named in the
     * prose more than once.
     */
    const cited = lesson.sources.some((source) => source.chapter === chapter)
    if (!cited) {
      error(
        lesson.slug,
        `the provenance claims chapter ${chapter}, but no source in the lesson cites it`,
      )
    }

    const mentions = countChapterMentions(lesson, chapter)
    if (mentions === 0) {
      error(
        lesson.slug,
        `the lesson cites chapter ${chapter} but never names it in the prose`,
      )
    } else if (mentions < 3) {
      warn(
        lesson.slug,
        `chapter ${chapter} is named ${mentions} time(s); a chapter the lesson claims should be taught, not mentioned`,
      )
    }
  }

  /*
   * A source that is never referred to is a decorative source: it makes the
   * lesson look better sourced than it is.
   */
  for (const source of lesson.sources) {
    if (countChapterMentions(lesson, source.chapter) === 0) {
      error(lesson.slug, `the source "${source.label}" is never referred to in the prose`)
    }
  }

  for (const prerequisite of lesson.prerequisites) {
    if (!lessonSlugs.has(prerequisite)) {
      error(lesson.slug, `the prerequisite "${prerequisite}" is not a lesson`)
    }
  }

  for (const entry of lesson.furtherReading ?? []) {
    if (!REFERENCE_BY_ID.has(entry.referenceId)) {
      error(lesson.slug, `the further reading "${entry.referenceId}" is not in the references`)
    }
    if (entry.note.trim().length < 20) {
      error(lesson.slug, `the further reading "${entry.referenceId}" does not say why it is worth reading`)
    }
  }

  for (const section of [...lesson.sections, ...lesson.advancedSections]) {
    for (const block of section.blocks) {
      if (block.kind === 'diagram' && !(DIAGRAM_IDS as readonly string[]).includes(block.diagram)) {
        error(lesson.slug, `the diagram "${block.diagram}" is not registered`)
      }
      if (block.kind === 'lab-link' && !LABS.some((lab) => lab.id === block.labId)) {
        error(lesson.slug, `the laboratory "${block.labId}" does not exist`)
      }
      if (block.kind === 'demo') {
        if (!(DEMO_IDS as readonly string[]).includes(block.demo)) {
          error(lesson.slug, `the demonstration "${block.demo}" is not registered`)
        } else {
          usedDemos.add(block.demo)
        }
      }
      if (block.kind === 'predict') {
        if (!questionIds.has(block.question.id)) {
          error(lesson.slug, `the prediction "${block.question.id}" is not registered`)
        }
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* Demonstrations                                                      */
/* ------------------------------------------------------------------ */

for (const demo of DEMO_IDS) {
  if (!usedDemos.has(demo)) {
    warn('demos', `the demonstration "${demo}" does not appear in any lesson, so nothing links to it`)
  }
}

// A concept that routes to a demonstration no lesson contains is a dead
// link: the student is told they can go and try it, and arrives nowhere.
for (const [term, demo] of Object.entries(DEMO_FOR_TERM)) {
  if (!usedDemos.has(demo)) {
    error('glossary', `"${term}" routes to the demonstration "${demo}", which no lesson contains`)
  }
}

/* ------------------------------------------------------------------ */
/* Chapters                                                            */
/* ------------------------------------------------------------------ */

for (const chapter of CHAPTERS) {
  if (!coveredChapters.has(chapter.number)) {
    warn('curriculum', `chapter ${chapter.number} (${chapter.title}) has no lesson yet`)
  }
}

/* ------------------------------------------------------------------ */
/* Glossary                                                            */
/* ------------------------------------------------------------------ */

const glossaryNames = new Set(GLOSSARY.map((entry) => entry.term))
for (const entry of GLOSSARY) {
  if (entry.definition.trim().length < 20) error(entry.term, 'the definition is too short')
  for (const related of entry.related) {
    if (!glossaryNames.has(related)) error(entry.term, `the relation "${related}" points at a term that does not exist`)
  }
  for (const slug of entry.lessons) {
    if (!lessonSlugs.has(slug)) error(entry.term, `it is attached to the lesson "${slug}", which does not exist`)
  }
  if (entry.lessons.length === 0) warn(entry.term, 'it is not attached to any lesson')
  if (entry.demo && !usedDemos.has(entry.demo)) {
    error(entry.term, `it routes to the demonstration "${entry.demo}", which no lesson contains`)
  }
}

/* ------------------------------------------------------------------ */
/* Laboratories                                                        */
/* ------------------------------------------------------------------ */

const labIds = new Set(LABS.map((lab) => lab.id))
for (const lab of LABS) {
  if (LAB_QUESTIONS[lab.id]?.length === 0) warn(lab.id, 'the laboratory has no diagnostic questions')
  for (const concept of lab.concepts) {
    if (![...glossaryNames].some((name) => name.toLowerCase() === concept.toLowerCase())) {
      warn(lab.id, `the concept "${concept}" is not a glossary term, so its badge will not link`)
    }
  }
}
for (const id of labIds) {
  if (!LAB_QUESTIONS[id]) warn('labs', `the laboratory "${id}" has no diagnostic questions`)
}

// A diagnostic question that does not name the control to change is a
// question the student can only guess at. Each one must say what to do.
for (const question of ALL_LAB_QUESTIONS) {
  if (!question.tryIt || question.tryIt.trim().length < 20) {
    error(question.id, 'the diagnostic question does not name the control that tests it')
  }
}

/* ------------------------------------------------------------------ */
/* Report                                                              */
/* ------------------------------------------------------------------ */

const lessonQuestions = LESSONS.reduce((sum, lesson) => sum + lesson.quiz.length + lesson.advancedQuiz.length, 0)
const sections = LESSONS.reduce((sum, lesson) => sum + lesson.sections.length + lesson.advancedSections.length, 0)
const minutes = LESSONS.reduce((sum, lesson) => sum + lesson.minutes, 0)

console.log('\nCourse content')
console.log(`  lessons            ${LESSONS.length}`)
console.log(`  sections           ${sections}`)
console.log(`  study time         ${Math.round(minutes / 60)} h`)
console.log(`  lesson questions   ${lessonQuestions}`)
console.log(`  predictions        ${PREDICT_QUESTIONS.length}`)
console.log(`  lab questions      ${ALL_LAB_QUESTIONS.length}`)
console.log(`  total questions    ${allQuestions.length}`)
console.log(`  glossary terms     ${GLOSSARY.length}`)
console.log(`  laboratories       ${LABS.length}`)
console.log(`  references         ${REFERENCES.length}`)
console.log(`  chapters covered   ${coveredChapters.size} of ${CHAPTERS.length}`)

const errors = problems.filter((problem) => problem.severity === 'error')
const warnings = problems.filter((problem) => problem.severity === 'warning')

if (warnings.length > 0) {
  console.log(`\n${warnings.length} warning(s)`)
  for (const problem of warnings) console.log(`  · ${problem.where}: ${problem.message}`)
}

if (errors.length > 0) {
  console.error(`\n${errors.length} error(s) — the content is inconsistent:\n`)
  for (const problem of errors) console.error(`  ✗ ${problem.where}: ${problem.message}`)
  console.error('')
  process.exit(1)
}

console.log('\nContent is consistent.\n')
