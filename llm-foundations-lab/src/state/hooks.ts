import { useCallback, useContext, useState } from 'react'
import { ProgressContext, type ProgressContextValue } from './context'

/**
 * Access the learner's progress state and the actions that change it.
 *
 * The hooks live in their own module so that `ProgressContext.tsx` can export
 * components only, and so that a component file never has to import a
 * non-component value from a module that also renders components.
 */
export function useProgress(): ProgressContextValue {
  const context = useContext(ProgressContext)
  if (!context) throw new Error('useProgress must be used inside <ProgressProvider>')
  return context
}

/** Theme handling: class-based, persisted, defaults to dark. */
export type Theme = 'dark' | 'light'

const THEME_KEY = 'llm-foundations-lab:theme'

export function useTheme(): { theme: Theme; setTheme: (theme: Theme) => void; toggle: () => void } {
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof document === 'undefined') return 'dark'
    // The stored choice is the source of truth; the class on the document
    // element is what the pre-paint script in index.html set from it.
    try {
      const stored = window.localStorage.getItem(THEME_KEY)
      if (stored === 'light' || stored === 'dark') return stored
    } catch {
      // Storage may be unavailable; fall through to the document class.
    }
    return document.documentElement.classList.contains('light') ? 'light' : 'dark'
  })

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    document.documentElement.classList.toggle('light', next === 'light')
    document.documentElement.classList.toggle('dark', next === 'dark')
    try {
      window.localStorage.setItem(THEME_KEY, next)
    } catch {
      // Storage may be unavailable (private mode); the theme still applies for this session.
    }
  }, [])

  return { theme, setTheme, toggle: () => setTheme(theme === 'dark' ? 'light' : 'dark') }
}
