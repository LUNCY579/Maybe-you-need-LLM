import { afterEach, describe, expect, it } from 'vitest'
import { createStore, readPreference, writePreference } from '../src/storage.js'
import { createProgressStore, emptyProgress, exportProgress, importProgress, summariseProgress } from '../src/progress.js'

class MemoryStorage {
  private map = new Map<string, string>()
  get length() {
    return this.map.size
  }
  key(index: number): string | null {
    return [...this.map.keys()][index] ?? null
  }
  getItem(key: string): string | null {
    return this.map.get(key) ?? null
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value)
  }
  removeItem(key: string): void {
    this.map.delete(key)
  }
  clear(): void {
    this.map.clear()
  }
}

const originalStorage = (globalThis as { localStorage?: Storage }).localStorage

afterEach(() => {
  if (originalStorage === undefined) {
    delete (globalThis as { localStorage?: Storage }).localStorage
  } else {
    ;(globalThis as { localStorage?: Storage }).localStorage = originalStorage
  }
})

describe('createStore', () => {
  it('returns the initial value when nothing is stored', () => {
    const store = createStore({ key: 'test:empty', version: 1, initial: { count: 0 } })
    expect(store.load()).toEqual({ count: 0 })
  })

  it('round-trips a value through storage', () => {
    ;(globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage() as unknown as Storage
    const store = createStore({ key: 'test:roundtrip', version: 1, initial: { count: 0 } })
    expect(store.save({ count: 5 })).toBe(true)
    const reloaded = createStore({ key: 'test:roundtrip', version: 1, initial: { count: 0 } })
    expect(reloaded.load()).toEqual({ count: 5 })
  })

  it('discards a corrupt record instead of throwing', () => {
    ;(globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage() as unknown as Storage
    localStorage.setItem('test:corrupt', '{not json')
    const store = createStore({ key: 'test:corrupt', version: 1, initial: { count: 1 } })
    expect(store.load()).toEqual({ count: 1 })
  })

  it('migrates an older schema version', () => {
    ;(globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage() as unknown as Storage
    localStorage.setItem('test:migrate', JSON.stringify({ version: 1, data: { count: 3 } }))
    const store = createStore({
      key: 'test:migrate',
      version: 2,
      initial: { count: 0 },
      migrate: (data) => ({ count: (data as { count: number }).count * 10 }),
    })
    expect(store.load()).toEqual({ count: 30 })
  })

  it('degrades to memory when storage is unavailable', () => {
    delete (globalThis as { localStorage?: Storage }).localStorage
    const store = createStore({ key: 'test:unavailable', version: 1, initial: { count: 0 } })
    expect(store.persistent).toBe(false)
    expect(store.save({ count: 2 })).toBe(false)
    expect(store.load()).toEqual({ count: 2 })
  })
})

describe('preferences', () => {
  it('reads and writes a plain value', () => {
    ;(globalThis as { localStorage?: Storage }).localStorage = new MemoryStorage() as unknown as Storage
    expect(writePreference('test:theme', 'dark')).toBe(true)
    expect(readPreference('test:theme')).toBe('dark')
  })
})

describe('createProgressStore', () => {
  it('starts empty', () => {
    const store = createProgressStore({ key: 'test:progress' })
    expect(store.load()).toEqual(emptyProgress())
  })

  it('records lesson completion and study time', () => {
    const store = createProgressStore({ key: 'test:progress' })
    store.markLessonComplete('l1', 120)
    store.markLessonComplete('l1', 30)
    const record = store.load()
    expect(record.lessons.l1.complete).toBe(true)
    expect(record.lessons.l1.seconds).toBe(150)
  })

  it('keeps a question correct once it has been answered correctly', () => {
    const store = createProgressStore({ key: 'test:progress' })
    store.recordQuizAnswer('q1', false)
    store.recordQuizAnswer('q1', true)
    const record = store.load()
    expect(record.quiz.q1.correct).toBe(true)
    expect(record.quiz.q1.attempts).toBe(2)
  })

  it('toggles known glossary terms', () => {
    const store = createProgressStore({ key: 'test:progress' })
    store.toggleKnownTerm('t1')
    expect(store.load().knownTerms).toEqual(['t1'])
    store.toggleKnownTerm('t1')
    expect(store.load().knownTerms).toEqual([])
  })

  it('notifies on change', () => {
    let changes = 0
    const store = createProgressStore({ key: 'test:progress', onChange: () => changes++ })
    store.markLessonComplete('l1', 10)
    expect(changes).toBe(1)
  })
})

describe('summariseProgress', () => {
  it('computes module completion and quiz accuracy', () => {
    const store = createProgressStore({ key: 'test:progress' })
    store.markLessonComplete('a1', 60)
    store.markLessonComplete('a2', 60)
    store.markLessonComplete('b1', 30)
    store.recordQuizAnswer('q1', true)
    store.recordQuizAnswer('q2', false)

    const summary = summariseProgress(store.load(), {
      a: ['a1', 'a2'],
      b: ['b1', 'b2'],
    })
    expect(summary.lessonsComplete).toBe(3)
    expect(summary.lessonsTotal).toBe(4)
    expect(summary.quizAnswered).toBe(2)
    expect(summary.quizAccuracy).toBeCloseTo(0.5, 12)
    expect(summary.modules[0].fraction).toBeCloseTo(1, 12)
    expect(summary.modules[1].fraction).toBeCloseTo(0.5, 12)
    expect(summary.totalSeconds).toBe(150)
  })
})

describe('progress import and export', () => {
  it('round-trips a record', () => {
    const store = createProgressStore({ key: 'test:progress' })
    store.markLessonComplete('l1', 10)
    const exported = exportProgress(store.load())
    const imported = importProgress(JSON.parse(JSON.stringify(exported)))
    expect(imported?.lessons.l1.complete).toBe(true)
  })

  it('rejects a file that is not a progress export', () => {
    expect(importProgress({ kind: 'something-else' })).toBeNull()
    expect(importProgress(null)).toBeNull()
    expect(importProgress('nope')).toBeNull()
  })

  it('fills in missing sections of a partial record', () => {
    const imported = importProgress({ kind: 'llm-materials-progress', version: 1, record: {} })
    expect(imported).toEqual(emptyProgress())
  })
})
