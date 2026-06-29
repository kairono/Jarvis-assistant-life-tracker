import { useMemo } from 'react';
import { useTheme } from '../theme/ThemeContext';
import { THEMES } from '../theme/themes';

const rgb = (triplet: string) => `rgb(${triplet.trim().split(/\s+/).join(', ')})`;
const rgba = (triplet: string, a: number) => `rgb(${triplet.trim().split(/\s+/).join(', ')} / ${a})`;

/**
 * Chart colors derived directly from the active theme state (not the DOM),
 * so Recharts re-renders with the right palette the instant the theme changes.
 */
export function useChartColors() {
  const { themeId, accent } = useTheme();
  return useMemo(() => {
    const theme = THEMES.find((t) => t.id === themeId) ?? THEMES[0];
    const v = theme.vars;
    const accentTriplet = accent ?? v.accent;
    return {
      accent: rgb(accentTriplet),
      accent2: rgb(v.accent2),
      text: rgb(v.text),
      muted: rgb(v.muted),
      grid: rgba(v.border, 0.5),
      success: rgb(v.success),
      danger: rgb(v.danger),
      tooltipBg: rgb(v.panel),
      tooltipBorder: rgb(v.border),
      // Categorical palette for pies/bars; accent-led, then distinct hues.
      palette: [
        rgb(accentTriplet),
        rgb(v.accent2),
        '#34d399',
        '#fbbf24',
        '#f472b6',
        '#a78bfa',
        '#60a5fa',
        '#f87171',
        '#4ade80',
        '#fb923c',
      ],
    };
  }, [themeId, accent]);
}
