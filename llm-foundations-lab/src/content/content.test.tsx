/**
 * Content integrity tests.
 *
 * These guard the curriculum itself: cross-references, quiz answer keys, glossary
 * prerequisites, and — most importantly — that every lesson body renders without a
 * runtime error and without an invalid KaTeX expression. A broken cross-reference or
 * an undefined formula would otherwise only be found by clicking every page.
 */
import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import {
  LESSONS,
  MODULES,
  getLesson,
  lessonsForModule,
  getModule,
  prerequisiteChain,
  lessonNeighbours,
} from './curriculum'
import { QUIZ_BANK, questionsForLesson, quizStats } from './quiz'
import { FORMULAS, GLOSSARY, formulasForLesson, glossaryForLesson } from './glossary'
import { LESSON_LOADERS } from './lessons/registry'
import { EXPLANATIONS, EXPLANATION_BY_LESSON } from './explanations'
import { ProgressProvider } from '../state/ProgressContext'
import { KnowledgeCheck } from '../components/lesson/LessonChrome'

const MODULE_IDS = MODULES.map((m) => m.id)

/** Undo React's HTML escaping and tags so text assertions match the source strings. */
function visibleText(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
}

function renderInApp(node: React.ReactElement) {
  return renderToStaticMarkup(
    <ProgressProvider>
      <MemoryRouter initialEntries={['/lessons/x']}>{node}</MemoryRouter>
    </ProgressProvider>,
  )
}

describe('curriculum structure', () => {
  it('covers the six chapters of the source revision', () => {
    expect(MODULES).toHaveLength(6)
    expect(MODULES.map((m) => m.chapter)).toEqual([1, 2, 3, 4, 5, 6])
    expect(MODULES.map((m) => m.id)).toEqual([
      'pre-training',
      'generative-models',
      'prompting',
      'alignment',
      'inference',
      'reasoning',
    ])
    for (const module of MODULES) {
      expect(module.pages).toMatch(/^pp\. \d+–\d+$/)
      expect(module.outcomes.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('has at least twelve lessons, each attached to a real module', () => {
    expect(LESSONS.length).toBeGreaterThanOrEqual(12)
    for (const lesson of LESSONS) {
      expect(MODULE_IDS).toContain(lesson.moduleId)
    }
    for (const module of MODULES) {
      expect(lessonsForModule(module.id).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('numbers lessons once, in course order', () => {
    const ids = LESSONS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    // Numbers are global (1..N) so cross-module links read as "Lesson 7".
    expect(LESSONS.map((l) => l.number)).toEqual(LESSONS.map((_, index) => index + 1))
    for (const module of MODULES) {
      const numbers = lessonsForModule(module.id).map((l) => l.number)
      expect(numbers).toEqual([...numbers].sort((a, b) => a - b))
    }
  })

  it('every source reference is plausible and traceable', () => {
    for (const lesson of LESSONS) {
      expect(lesson.sourceRefs.length).toBeGreaterThan(0)
      for (const ref of lesson.sourceRefs) {
        expect(ref.chapter).toBeGreaterThanOrEqual(1)
        expect(ref.chapter).toBeLessThanOrEqual(6)
        expect(ref.section).toMatch(/^\d+(\.\d+)*$/)
        expect(ref.page).toBeGreaterThanOrEqual(1)
        expect(ref.title.length).toBeGreaterThan(3)
        expect(ref.note.length).toBeGreaterThan(10)
      }
    }
  })

  it('prerequisites exist and come earlier in the course', () => {
    const order = new Map(LESSONS.map((lesson, index) => [lesson.id, index]))
    for (const lesson of LESSONS) {
      for (const prerequisite of lesson.prerequisites) {
        expect(order.has(prerequisite)).toBe(true)
        expect(order.get(prerequisite)!).toBeLessThan(order.get(lesson.id)!)
      }
    }
  })

  it('lesson helpers stay consistent', () => {
    const lesson = LESSONS[0]
    expect(getLesson(lesson.id)?.title).toBe(lesson.title)
    expect(getLesson('does-not-exist')).toBeUndefined()
    expect(getModule('reasoning')?.chapter).toBe(6)
    expect(getModule('nope')).toBeUndefined()
    expect(prerequisiteChain(LESSONS[LESSONS.length - 1].id).length).toBeGreaterThan(0)
    const neighbours = lessonNeighbours(LESSONS[1].id)
    expect(neighbours.previous?.id).toBe(LESSONS[0].id)
    expect(neighbours.next?.id).toBe(LESSONS[2].id)
    expect(lessonNeighbours(LESSONS[0].id).previous).toBeUndefined()
  })

  it('every lesson declares a known interactive lab', () => {
    const known = ['transformer', 'tokenizer', 'sampling', 'learning', 'alignment', 'inference', 'prompt']
    for (const lesson of LESSONS) {
      expect(known).toContain(lesson.interactive.lab)
      expect(lesson.interactive.title.length).toBeGreaterThan(3)
      expect(lesson.minutes).toBeGreaterThan(0)
    }
  })
})

describe('quiz bank', () => {
  it('provides at least 24 verified questions across all modules', () => {
    const stats = quizStats()
    expect(stats.total).toBeGreaterThanOrEqual(24)
    expect(stats.modules).toBe(6)
    expect(stats.calculations).toBeGreaterThanOrEqual(6)
    expect(new Set(QUIZ_BANK.map((q) => q.id)).size).toBe(QUIZ_BANK.length)
  })

  it('has a valid answer key and per-option feedback everywhere', () => {
    for (const question of QUIZ_BANK) {
      expect(question.options.length).toBeGreaterThanOrEqual(3)
      expect(question.correctIndex).toBeGreaterThanOrEqual(0)
      expect(question.correctIndex).toBeLessThan(question.options.length)
      expect(question.feedback).toHaveLength(question.options.length)
      expect(question.explanation.length).toBeGreaterThan(40)
      expect(new Set(question.options).size).toBe(question.options.length)
      for (const text of question.feedback) expect(text.trim().length).toBeGreaterThan(4)
      // Per-option feedback must add up to a real diagnosis, not four labels.
      const feedbackLength = question.feedback.reduce((total, text) => total + text.length, 0)
      expect(feedbackLength).toBeGreaterThan(80)
      if (question.kind === 'calculation') expect(question.tex).toBeTruthy()
      expect(MODULE_IDS).toContain(question.moduleId)
      expect(getLesson(question.lessonId)?.moduleId).toBe(question.moduleId)
    }
  })

  it('attaches questions to lessons through both directions of the link', () => {
    for (const lesson of LESSONS) {
      const attached = questionsForLesson(lesson.id)
      expect(attached.length).toBeGreaterThanOrEqual(2)
      expect(attached.map((q) => q.id).sort()).toEqual([...lesson.quizIds].sort())
    }
  })

  it('gives every lesson exactly one transfer question', () => {
    /*
     * A transfer question is the one that shows whether an idea has been
     * transferred rather than remembered, and a lesson without one is a
     * lesson the reader can pass by recalling the prose.
     */
    for (const lesson of LESSONS) {
      const transfer = questionsForLesson(lesson.id).filter((q) => q.kind === 'transfer')
      expect(transfer.length, `lesson ${lesson.id} has no transfer question`).toBe(1)
    }
    expect(quizStats().transfer).toBe(LESSONS.length)
  })

  it('makes every transfer question a scenario rather than a fact', () => {
    for (const question of QUIZ_BANK.filter((q) => q.kind === 'transfer')) {
      // A transfer question describes a situation, so it is longer than the
      // one-line questions of the rest of the bank.
      expect(
        question.prompt.length,
        `the transfer question ${question.id} is too short to be a scenario`,
      ).toBeGreaterThan(80)
      // And it is a different question from the ones of its own lesson.
      const others = questionsForLesson(question.lessonId).filter((q) => q.id !== question.id)
      for (const other of others) {
        expect(question.prompt).not.toBe(other.prompt)
      }
    }
  })

  it('gives every transfer question distractors that are plausible misapplications', () => {
    /*
     * A question whose wrong options are obviously wrong teaches nothing: the
     * reader can reject them without thinking about the mechanism. The
     * feedback on a wrong option must therefore say what the reader was
     * thinking, and not merely that it is wrong.
     */
    for (const question of QUIZ_BANK.filter((q) => q.kind === 'transfer')) {
      for (const text of question.feedback) {
        expect(
          text.length,
          `the feedback on ${question.id} is too short to be a diagnosis`,
        ).toBeGreaterThan(30)
      }
    }
  })
})

describe('glossary and formula reference', () => {
  it('has unique terms with resolvable prerequisites', () => {
    const ids = new Set(GLOSSARY.map((entry) => entry.id))
    expect(ids.size).toBe(GLOSSARY.length)
    expect(GLOSSARY.length).toBeGreaterThanOrEqual(30)
    for (const entry of GLOSSARY) {
      expect(entry.definition.length).toBeGreaterThan(40)
      expect(getLesson(entry.lessonId)).toBeDefined()
      expect(MODULE_IDS).toContain(entry.moduleId)
      for (const prerequisite of entry.prerequisites) {
        expect(ids.has(prerequisite)).toBe(true)
        expect(prerequisite).not.toBe(entry.id)
      }
    }
  })

  it('every glossary term is used by at least one lesson', () => {
    const referenced = new Set(LESSONS.flatMap((lesson) => lesson.glossaryTerms))
    for (const entry of GLOSSARY) {
      const lesson = getLesson(entry.lessonId)!
      expect(
        referenced.has(entry.id) || lesson.glossaryTerms.includes(entry.id),
        `glossary term "${entry.id}" is never referenced`,
      ).toBe(true)
    }
  })

  it('formulas point at real lessons and carry symbol tables', () => {
    expect(FORMULAS.length).toBeGreaterThanOrEqual(12)
    const seen = new Set<string>()
    for (const formula of FORMULAS) {
      expect(seen.has(formula.id)).toBe(false)
      seen.add(formula.id)
      expect(formula.tex.length).toBeGreaterThan(5)
      expect(formula.symbols.length).toBeGreaterThan(0)
      expect(getLesson(formula.lessonId)).toBeDefined()
      expect(formulasForLesson(formula.lessonId)).toContain(formula)
    }
  })

  it('lesson glossary lists resolve to real entries', () => {
    for (const lesson of LESSONS) {
      for (const term of lesson.glossaryTerms) {
        expect(GLOSSARY.some((entry) => entry.id === term)).toBe(true)
      }
      expect(glossaryForLesson(lesson.id).length).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('lesson rendering', () => {
  it('registers a body for every lesson and nothing extra', () => {
    expect(Object.keys(LESSON_LOADERS).sort()).toEqual(LESSONS.map((l) => l.id).sort())
  })

  it('gives every lesson a self-explanation prompt with a model answer', () => {
    /*
     * The self-explanation exercise is only worth doing if it comes with
     * feedback: a 2025 meta-analysis found that the advantage of retrieval
     * practice over elaborative encoding was conditional on feedback being
     * given, and reversed without it. So a prompt without a model answer is
     * not a weaker exercise, it is a counterproductive one, and the course
     * must not ship one.
     */
    expect(EXPLANATIONS.length).toBe(LESSONS.length)
    for (const lesson of LESSONS) {
      const prompt = EXPLANATION_BY_LESSON.get(lesson.id)
      expect(prompt, `lesson ${lesson.id} has no self-explanation prompt`).toBeDefined()
      expect(prompt!.prompt.length, `lesson ${lesson.id} has a very short prompt`).toBeGreaterThan(40)
      expect(prompt!.answer.length, `lesson ${lesson.id} has a very short answer`).toBeGreaterThan(120)
      expect(
        prompt!.commonError.length,
        `lesson ${lesson.id} has no common error to check against`,
      ).toBeGreaterThan(40)
      // A prompt that asks for a fact is retrieval practice, which the
      // knowledge check already does. These ask for a mechanism.
      expect(prompt!.prompt, `lesson ${lesson.id} does not ask for an explanation`).toMatch(
        /why|how|explain/i,
      )
    }
  })

  it('does not repeat a prompt', () => {
    const prompts = EXPLANATIONS.map((entry) => entry.prompt)
    expect(new Set(prompts).size).toBe(prompts.length)
  })

  it(
    'renders every lesson body without an invalid formula',
    async () => {
      for (const lesson of LESSONS) {
        const { default: Body } = await LESSON_LOADERS[lesson.id]()
        const html = renderInApp(<Body lesson={lesson} />)
        expect(html.length, `lesson ${lesson.id} rendered empty`).toBeGreaterThan(600)
        expect(html, `lesson ${lesson.id} produced a KaTeX error`).not.toContain('katex-error')
        expect(html).not.toContain('Something failed while drawing')
      }
    },
    // The bodies are loaded on demand now, so this test waits for eighteen
    // dynamic imports.
    30_000,
  )

  it('gives every lesson an objective, an exercise and a worked example', async () => {
    // The course promises a consistent lesson shape: an explanation, something
    // to manipulate, and a worked example. This asserts the shape rather than
    // trusting that every lesson follows it.
    for (const lesson of LESSONS) {
      const { default: Body } = await LESSON_LOADERS[lesson.id]()
      const text = visibleText(renderInApp(<Body lesson={lesson} />))
      expect(text, `lesson ${lesson.id} has no interactive exercise`).toContain(
        'Interactive exercise',
      )
      expect(text, `lesson ${lesson.id} has no worked example`).toContain('Worked example')
      expect(text, `lesson ${lesson.id} has no concept section`).toContain('Concept')
    }
  })

  it('gives every module the misreadings readers bring to it', () => {
    for (const module of MODULES) {
      expect(module.misconceptions.length, `${module.id} has no misconceptions`).toBeGreaterThanOrEqual(3)
      for (const entry of module.misconceptions) {
        expect(entry.mistake.length, `${module.id} has an empty misreading`).toBeGreaterThan(10)
        expect(entry.correction.length, `${module.id} has an empty correction`).toBeGreaterThan(20)
      }
    }
  })

  it('links the key concepts of every lesson', async () => {
    // A reader who meets a term in the prose should be able to check what it
    // means without leaving the lesson. The floor is deliberately low — it
    // catches a lesson that has stopped naming its own vocabulary rather than
    // prescribing how many terms each one should mention.
    for (const lesson of LESSONS) {
      const { default: Body } = await LESSON_LOADERS[lesson.id]()
      const html = renderInApp(<Body lesson={lesson} />)
      const links = (html.match(/aria-controls=/g) ?? []).length
      expect(links, `lesson ${lesson.id} links no concepts`).toBeGreaterThanOrEqual(3)
    }
  })

  it('renders the knowledge check of every lesson with its first question', () => {
    for (const lesson of LESSONS) {
      const html = renderInApp(<KnowledgeCheck lessonId={lesson.id} />)
      expect(html).not.toContain('katex-error')
      // The first quiz prompt must appear in the rendered knowledge check.
      expect(visibleText(html)).toContain(questionsForLesson(lesson.id)[0].prompt.replace(/\s+/g, ' '))
      expect(visibleText(html)).toContain('Knowledge check')
    }
  })
})
