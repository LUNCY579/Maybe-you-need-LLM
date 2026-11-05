import { describe, expect, it, vi } from 'vitest'
import {
  PROGRESS_SCHEMA_VERSION,
  createEmptyProgress,
  loadProgress,
  parseProgress,
  persistProgress,
  type ProgressStorage,
} from './progress'

/**
 * The progress file is a convenience, and the browser is allowed to refuse it.
 * Firefox throws `NS_ERROR_FAILURE` when the storage is disabled or full, and
 * a browser in private mode may refuse without a word. None of that is worth
 * losing the course over.
 */
describe('the progress file', () => {
  function storageThatFails(): ProgressStorage {
    return {
      getItem: () => {
        throw new Error('NS_ERROR_FAILURE')
      },
      setItem: () => {
        throw new Error('NS_ERROR_FAILURE')
      },
      removeItem: () => {},
    }
  }

  it('reads an empty file when the storage refuses to answer', () => {
    const state = loadProgress(storageThatFails())
    expect(state).toEqual(createEmptyProgress())
  })

  it('does not throw when the storage refuses the write', () => {
    expect(() => persistProgress(storageThatFails(), createEmptyProgress())).not.toThrow()
  })

  it('reports that the write did not happen', () => {
    expect(persistProgress(storageThatFails(), createEmptyProgress())).toBe(false)
  })

  it('reports that the write did happen', () => {
    const store = new Map<string, string>()
    const storage: ProgressStorage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    }
    expect(persistProgress(storage, createEmptyProgress())).toBe(true)
    expect(store.size).toBe(1)
  })

  it('reads back what it wrote', () => {
    const store = new Map<string, string>()
    const storage: ProgressStorage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => void store.set(key, value),
      removeItem: (key) => void store.delete(key),
    }
    const state = createEmptyProgress()
    state.notes['a-lesson'] = 'a note'
    persistProgress(storage, state)
    const loaded = loadProgress(storage)
    expect(loaded.notes['a-lesson']).toBe('a note')
  })

  it('does not throw when the document is corrupt', () => {
    const storage: ProgressStorage = {
      getItem: () => 'not json at all',
      setItem: vi.fn(),
      removeItem: () => {},
    }
    expect(() => loadProgress(storage)).not.toThrow()
  })
})

describe('a progress file from a newer version of the course', () => {
  it('is read as far as this version understands it', () => {
    const document = JSON.stringify({
      version: PROGRESS_SCHEMA_VERSION + 5,
      app: 'llm-foundations-lab',
      lessons: { 'pretraining-why': { completed: true, secondsSpent: 120 } },
      // A field this version has never heard of.
      somethingFromTheFuture: { a: 1 },
    })
    const { state, newerVersion } = parseProgress(document)
    expect(state.lessons['pretraining-why']?.completed).toBe(true)
    expect(newerVersion).toBe(PROGRESS_SCHEMA_VERSION + 5)
  })

  it('does not report a file from the same version or an older one', () => {
    const same = parseProgress(JSON.stringify({ version: PROGRESS_SCHEMA_VERSION }))
    expect(same.newerVersion).toBeUndefined()
    const older = parseProgress(JSON.stringify({ version: 1 }))
    expect(older.newerVersion).toBeUndefined()
  })

  it('does not report a document with no version at all', () => {
    expect(parseProgress(JSON.stringify({ lessons: {} })).newerVersion).toBeUndefined()
  })

  it('still reports a document that is not JSON', () => {
    const result = parseProgress('not json')
    expect(result.error).toBeTruthy()
    expect(result.newerVersion).toBeUndefined()
  })
})
