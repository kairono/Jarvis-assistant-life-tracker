/** @type {import('tailwindcss').Config} */
// Colors are driven by CSS variables (set at runtime by ThemeContext) so the
// whole palette can be re-skinned live. Each var holds an "R G B" triplet.
const c = (v) => `rgb(var(${v}) / <alpha-value>)`;

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: c('--c-bg'),
        surface: c('--c-surface'),
        panel: c('--c-panel'),
        border: c('--c-border'),
        text: c('--c-text'),
        muted: c('--c-muted'),
        accent: c('--c-accent'),
        accent2: c('--c-accent2'),
        success: c('--c-success'),
        danger: c('--c-danger'),
        warn: c('--c-warn'),
      },
      fontFamily: {
        ui: 'var(--font-ui)',
        display: 'var(--font-display)',
        mono: 'var(--font-mono)',
      },
      boxShadow: {
        glow: '0 0 0 1px rgb(var(--c-accent) / 0.25), 0 0 24px -4px rgb(var(--c-accent) / 0.35)',
        'glow-sm': '0 0 12px -2px rgb(var(--c-accent) / 0.45)',
        panel: '0 8px 30px -12px rgb(0 0 0 / 0.6)',
      },
      animation: {
        'pulse-ring': 'pulseRing 3s ease-in-out infinite',
        'spin-slow': 'spin 18s linear infinite',
        'spin-rev': 'spinRev 24s linear infinite',
        sweep: 'sweep 4s linear infinite',
        'fade-in': 'fadeIn 0.25s ease-out',
      },
      keyframes: {
        pulseRing: {
          '0%, 100%': { opacity: '0.35', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.04)' },
        },
        spinRev: { to: { transform: 'rotate(-360deg)' } },
        sweep: { to: { transform: 'rotate(360deg)' } },
        fadeIn: { from: { opacity: '0', transform: 'translateY(4px)' }, to: { opacity: '1', transform: 'none' } },
      },
    },
  },
  plugins: [],
};
