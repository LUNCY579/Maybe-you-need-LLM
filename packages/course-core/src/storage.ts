/**
 * Versioned localStorage persistence.
 *
 * Every course in this collection stores the learner's progress in the
 * browser. Two rules apply:
 *
 * 1. The record carries a schema version, so a future change to the shape of
 *    the data can be migrated rather than silently discarded.
 * 2. Storage may be unavailable (private browsing, disabled cookies, a
 *    full quota). The store must degrade to an in-memory record rather than
 *    throwing, because a learner's session should not die on a failed write.
 */

export interface StoredRecord<T> {
  version: number
  data: T
}

export interface StoreOptions<T> {
  /** localStorage key. Include the application name to avoid collisions. */
  key: string
  /** Current schema version. Bumping this enables a migration. */
  version: number
  /** Value used when nothing is stored yet, or when storage is unavailable. */
  initial: T
  /** Optional migration applied when the stored version is older than `version`. */
  migrate?: (data: unknown, fromVersion: number) => T
  /** Optional merge applied to an existing record, for additive changes. */
  merge?: (existing: T) => T
}

export interface Store<T> {
  load(): T
  save(value: T): boolean
  clear(): void
  /** Whether a real browser storage is backing this store. */
  readonly persistent: boolean
}

function safeStorage(): Storage | null {
  try {
    if (typeof localStorage === 'undefined') return null
    // Touch the API: some browsers expose it but throw on access.
    const probe = '__course_core_probe__'
    localStorage.setItem(probe, '1')
    localStorage.removeItem(probe)
    return localStorage
  } catch {
    return null
  }
}

/**
 * Create a versioned store.
 *
 * `load` never throws: a corrupt record is discarded and the initial value is
 * returned, because a broken cache should not prevent the app from starting.
 */
export function createStore<T>(options: StoreOptions<T>): Store<T> {
  const storage = safeStorage()
  let memory: T = options.initial

  const load = (): T => {
    if (!storage) return memory
    try {
      const raw = storage.getItem(options.key)
      if (!raw) return memory
      const parsed = JSON.parse(raw) as StoredRecord<T>
      if (parsed === null || typeof parsed !== 'object' || !('version' in parsed)) {
        return memory
      }
      if (parsed.version === options.version) {
        const data = options.merge ? options.merge(parsed.data) : parsed.data
        memory = data
        return data
      }
      if (options.migrate) {
        const migrated = options.migrate(parsed.data, parsed.version)
        memory = migrated
        storage.setItem(
          options.key,
          JSON.stringify({ version: options.version, data: migrated } satisfies StoredRecord<T>),
        )
        return migrated
      }
      return memory
    } catch {
      return memory
    }
  }

  const save = (value: T): boolean => {
    memory = value
    if (!storage) return false
    try {
      storage.setItem(
        options.key,
        JSON.stringify({ version: options.version, data: value } satisfies StoredRecord<T>),
      )
      return true
    } catch {
      return false
    }
  }

  const clear = (): void => {
    memory = options.initial
    if (!storage) return
    try {
      storage.removeItem(options.key)
    } catch {
      /* nothing useful to do */
    }
  }

  return { load, save, clear, persistent: storage !== null }
}

/** Read a plain value from storage without versioning (theme choice, UI state). */
export function readPreference(key: string): string | null {
  const storage = safeStorage()
  if (!storage) return null
  try {
    return storage.getItem(key)
  } catch {
    return null
  }
}

/** Write a plain value to storage, reporting success. */
export function writePreference(key: string, value: string): boolean {
  const storage = safeStorage()
  if (!storage) return false
  try {
    storage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
