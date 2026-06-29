// ------------------------------------------------------------------ //
//  Theme presets, accent swatches, and font options.                  //
//  Color values are "R G B" triplets to match the CSS variables       //
//  consumed by Tailwind (rgb(var(--c-x) / <alpha>)).                  //
// ------------------------------------------------------------------ //

export type ColorVars = {
  bg: string;
  surface: string;
  panel: string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  accent2: string;
  success: string;
  danger: string;
  warn: string;
};

export interface ThemePreset {
  id: string;
  name: string;
  blurb: string;
  vars: ColorVars;
}

export const THEMES: ThemePreset[] = [
  {
    id: 'jarvis',
    name: 'Jarvis',
    blurb: 'Cyan HUD on deep navy — the default.',
    vars: {
      bg: '6 11 20', surface: '11 18 32', panel: '15 23 42', border: '28 49 74',
      text: '226 240 255', muted: '122 145 173', accent: '34 211 238', accent2: '56 189 248',
      success: '52 211 153', danger: '248 113 113', warn: '251 191 36',
    },
  },
  {
    id: 'midnight',
    name: 'Midnight',
    blurb: 'Neutral dark with an indigo glow.',
    vars: {
      bg: '9 9 17', surface: '17 17 28', panel: '24 24 40', border: '39 39 60',
      text: '228 228 240', muted: '148 148 170', accent: '129 140 248', accent2: '167 139 250',
      success: '52 211 153', danger: '248 113 113', warn: '251 191 36',
    },
  },
  {
    id: 'crimson',
    name: 'Crimson',
    blurb: 'Iron-suit red over warm black.',
    vars: {
      bg: '14 8 10', surface: '24 12 14', panel: '32 16 18', border: '64 28 32',
      text: '248 230 230', muted: '178 138 140', accent: '239 68 68', accent2: '251 146 60',
      success: '74 222 128', danger: '248 113 113', warn: '251 191 36',
    },
  },
  {
    id: 'matrix',
    name: 'Matrix',
    blurb: 'Terminal green on near-black.',
    vars: {
      bg: '4 10 6', surface: '8 18 12', panel: '10 24 16', border: '20 48 32',
      text: '210 255 220', muted: '110 170 130', accent: '34 197 94', accent2: '132 204 22',
      success: '74 222 128', danger: '248 113 113', warn: '250 204 21',
    },
  },
  {
    id: 'daylight',
    name: 'Daylight',
    blurb: 'Clean light mode with a blue accent.',
    vars: {
      bg: '241 245 249', surface: '255 255 255', panel: '255 255 255', border: '203 213 225',
      text: '15 23 42', muted: '100 116 139', accent: '37 99 235', accent2: '14 165 233',
      success: '22 163 74', danger: '220 38 38', warn: '217 119 6',
    },
  },
];

export const DEFAULT_THEME_ID = 'jarvis';

// Accent swatches that override a theme's accent color.
export interface Accent {
  name: string;
  rgb: string; // "R G B"
}

export const ACCENTS: Accent[] = [
  { name: 'Cyan', rgb: '34 211 238' },
  { name: 'Sky', rgb: '56 189 248' },
  { name: 'Indigo', rgb: '129 140 248' },
  { name: 'Violet', rgb: '167 139 250' },
  { name: 'Emerald', rgb: '52 211 153' },
  { name: 'Lime', rgb: '132 204 22' },
  { name: 'Amber', rgb: '251 191 36' },
  { name: 'Orange', rgb: '251 146 60' },
  { name: 'Rose', rgb: '244 114 182' },
  { name: 'Red', rgb: '248 113 113' },
];

export interface FontOption {
  id: string;
  name: string;
  stack: string;
}

export const FONTS: FontOption[] = [
  { id: 'inter', name: 'Inter', stack: "'Inter', system-ui, sans-serif" },
  { id: 'system', name: 'System', stack: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { id: 'rajdhani', name: 'Rajdhani', stack: "'Rajdhani', system-ui, sans-serif" },
  { id: 'grotesk', name: 'Space Grotesk', stack: "'Space Grotesk', system-ui, sans-serif" },
  { id: 'mono', name: 'JetBrains Mono', stack: "'JetBrains Mono', ui-monospace, monospace" },
];

export const DEFAULT_FONT_ID = 'inter';

/** Convert "#22d3ee" → "34 211 238". Returns null on bad input. */
export function hexToTriplet(hex: string): string | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return null;
  const int = parseInt(m[1], 16);
  return `${(int >> 16) & 255} ${(int >> 8) & 255} ${int & 255}`;
}

/** Convert "34 211 238" → "#22d3ee" for color inputs. */
export function tripletToHex(triplet: string): string {
  const [r, g, b] = triplet.trim().split(/\s+/).map(Number);
  const h = (n: number) => n.toString(16).padStart(2, '0');
  return `#${h(r)}${h(g)}${h(b)}`;
}
