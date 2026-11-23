import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  DEFAULT_FONT_ID,
  DEFAULT_THEME_ID,
  FONTS,
  THEMES,
  type ColorVars,
} from './themes';

// v3: Jarvis HUD + glass merge — saved themes reset to the new default once.
const STORAGE_KEY = 'jarvis.theme.v3';

interface ThemeState {
  themeId: string;
  /** Accent override ("R G B") or null to use the theme's own accent. */
  accent: string | null;
  fontId: string;
}

interface ThemeContextValue extends ThemeState {
  setThemeId: (id: string) => void;
  setAccent: (rgb: string | null) => void;
  setFontId: (id: string) => void;
  reset: () => void;
}

const DEFAULT_STATE: ThemeState = {
  themeId: DEFAULT_THEME_ID,
  accent: null,
  fontId: DEFAULT_FONT_ID,
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

function load(): ThemeState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_STATE, ...(JSON.parse(raw) as Partial<ThemeState>) };
  } catch {
    /* ignore corrupt storage */
  }
  return DEFAULT_STATE;
}

/** Write the active theme's variables onto <html> so Tailwind + CSS pick them up. */
function apply(state: ThemeState): void {
  const theme = THEMES.find((t) => t.id === state.themeId) ?? THEMES[0];
  const font = FONTS.find((f) => f.id === state.fontId) ?? FONTS[0];
  const root = document.documentElement;

  (Object.keys(theme.vars) as (keyof ColorVars)[]).forEach((k) => {
    root.style.setProperty(`--c-${k}`, theme.vars[k]);
  });
  if (state.accent) root.style.setProperty('--c-accent', state.accent);
  root.style.setProperty('--font-ui', font.stack);
  root.dataset.light = theme.id === 'daylight' ? 'true' : 'false';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ThemeState>(load);

  useEffect(() => {
    apply(state);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore */
    }
  }, [state]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...state,
      setThemeId: (themeId) => setState((s) => ({ ...s, themeId })),
      setAccent: (accent) => setState((s) => ({ ...s, accent })),
      setFontId: (fontId) => setState((s) => ({ ...s, fontId })),
      reset: () => setState(DEFAULT_STATE),
    }),
    [state],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
