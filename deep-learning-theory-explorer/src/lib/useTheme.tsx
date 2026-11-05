import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { paletteFor, type Palette, type ThemeName } from './theme';

/**
 * The theme.
 *
 * One attribute on the document element (`data-theme`) drives every colour in
 * the application, because every Tailwind colour resolves to a CSS custom
 * property. The charts cannot read CSS variables, so they are given the matching
 * JavaScript palette and re-rendered when the theme changes.
 */

const STORAGE_KEY = 'dlte.theme.v1';

export interface ThemeApi {
  theme: ThemeName;
  /** the JavaScript mirror of the CSS custom properties */
  colors: Palette;
  setTheme: (t: ThemeName) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeApi | null>(null);

function initialTheme(): ThemeName {
  if (typeof window === 'undefined') return 'dark';
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch {
    /* storage unavailable: fall through to the system preference */
  }
  if (window.matchMedia?.('(prefers-color-scheme: light)').matches) return 'light';
  return 'dark';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* storage unavailable: the theme still applies for this session */
    }
  }, [theme]);

  const setTheme = useCallback((t: ThemeName) => setThemeState(t), []);
  const toggle = useCallback(() => setThemeState((t) => (t === 'dark' ? 'light' : 'dark')), []);

  const value = useMemo<ThemeApi>(
    () => ({ theme, colors: paletteFor(theme), setTheme, toggle }),
    [theme, setTheme, toggle],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside a ThemeProvider');
  return ctx;
}

/**
 * The palette, as a hook.
 *
 * Components that draw with the palette subscribe to it, so a theme switch
 * re-renders them with the new colours. It is used as
 * `const COLORS = useThemeColors();` so that existing `COLORS.blue`
 * references keep working and stay reactive.
 */
export function useThemeColors(): Palette {
  const { colors } = useTheme();
  return colors;
}
