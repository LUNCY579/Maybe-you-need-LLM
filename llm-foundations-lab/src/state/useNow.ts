import { useEffect, useState } from 'react'

/**
 * A clock that ticks once a minute.
 *
 * The spaced-repetition schedule is expressed in whole days, so a minute is
 * far more resolution than it needs, but the clock has to move: a question
 * that becomes due while the page is open should join the queue without the
 * reader having to reload.
 *
 * The time is kept in state rather than read from `Date.now()` during render,
 * because reading the clock during render is an impure operation and makes
 * the result of a render depend on when it happened.
 */
export function useNow(intervalMs = 60_000): Date {
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])

  return now
}
