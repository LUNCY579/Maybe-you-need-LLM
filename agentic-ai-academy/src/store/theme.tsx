import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'

export type ThemeName = 'dark' | 'light'

const THEME_KEY = 'agentic-ai-academy/theme/v1'

interface ThemeApi {
  theme: ThemeName
  toggle: () => void
  setTheme: (theme: ThemeName) => void
}

const ThemeContext = createContext<ThemeApi | null>(null)

/**
 * Read the theme to start with.
 *
 * The course is designed dark-first: the visual direction of the whole site is
 * a dark graphite and navy surface with electric cyan and violet highlights,
 * and the light theme is the accessible alternative rather than the default.
 * A stored preference always wins; otherwise the site opens in dark mode
 * regardless of the operating system setting, and the header toggle switches
 * to light for anyone who prefers it.
 */
function readInitialTheme(): ThemeName {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = window.localStorage.getItem(THEME_KEY)
    if (stored === 'dark' || stored === 'light') return stored
  } catch {
    // Writing the theme is guarded below, and so is the progress read in
    // `progress.tsx`. Reading this one was not, which is the worse half: a
    // browser with storage unavailable (private mode, cookies disabled) throws
    // on the *read*, at the root of the tree, before anything can be rendered.
    // The default theme is the honest fallback, not an error page.
  }
  return 'dark'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(readInitialTheme)

  useEffect(() => {
    if (typeof document === 'undefined') return
    document.documentElement.classList.toggle('dark', theme === 'dark')
    try {
      window.localStorage.setItem(THEME_KEY, theme)
    } catch {
      // Ignore storage failures; the in-memory theme still applies.
    }
  }, [theme])

  const api = useMemo<ThemeApi>(
    () => ({
      theme,
      setTheme: setThemeState,
      toggle: () => setThemeState((current) => (current === 'dark' ? 'light' : 'dark')),
    }),
    [theme],
  )

  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeApi {
  const context = useContext(ThemeContext)
  if (!context) throw new Error('useTheme must be used inside a ThemeProvider')
  return context
}
