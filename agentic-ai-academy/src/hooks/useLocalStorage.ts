import { useCallback, useLayoutEffect, useState } from 'react'

/**
 * Local-first state: mirrors to localStorage and degrades gracefully.
 *
 * The write happens in a *layout* effect rather than a passive one. A passive
 * effect is deferred until after the browser paints, which leaves a window in
 * which the student can tick a box and immediately reload the page and lose
 * the answer. A layout effect runs synchronously after the commit, so the
 * value is on disk before the interaction can be interrupted.
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === 'undefined') return initialValue
    try {
      const raw = window.localStorage.getItem(key)
      return raw ? (JSON.parse(raw) as T) : initialValue
    } catch {
      return initialValue
    }
  })

  useLayoutEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // Storage unavailable; keep the in-memory value.
    }
  }, [key, value])

  const update = useCallback((next: T) => setValue(next), [])
  return [value, update]
}
