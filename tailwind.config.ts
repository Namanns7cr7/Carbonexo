import type { Config } from 'tailwindcss';

/**
 * Carbonexo Tailwind config.
 * Tokens map to CSS variables defined in app/globals.css (:root + .dark),
 * so `bg-surface`, `text-muted`, `border-border`, etc. are theme-aware.
 */
const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        surface2: 'var(--surface2)',
        card: 'var(--card)',
        text: 'var(--text)',
        muted: 'var(--muted)',
        border: 'var(--border)',
        lime: 'var(--lime)',
        'lime-deep': 'var(--lime-deep)',
        'lime-soft': 'var(--lime-soft)',
        blue: 'var(--blue)',
        'blue-soft': 'var(--blue-soft)',
        ink: 'var(--ink)',
        'ink-text': 'var(--ink-text)',
        'ink-muted': 'var(--ink-muted)',
        'ink-border': 'var(--ink-border)',
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        soft: '0 16px 44px -28px var(--shadow)',
        lift: '0 28px 56px -28px var(--shadow-strong)',
        card: '0 24px 60px -32px var(--shadow-strong)',
      },
      keyframes: {
        floatA: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-14px)' } },
        ringdraw: { from: { strokeDashoffset: '327' } },
        gradientMove: {
          '0%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
          '100%': { backgroundPosition: '0% 50%' },
        },
        shineSweep: {
          '0%': { transform: 'translateX(-120%) skewX(-18deg)' },
          '55%,100%': { transform: 'translateX(320%) skewX(-18deg)' },
        },
        popIn: {
          from: { opacity: '0', transform: 'translateY(8px) scale(.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
      },
      animation: {
        floatA: 'floatA 6s ease-in-out infinite',
        ringdraw: 'ringdraw 1.6s ease-out',
        gradientMove: 'gradientMove 10s ease infinite',
        shineSweep: 'shineSweep 4.5s ease-in-out infinite',
        popIn: 'popIn .4s cubic-bezier(.2,.7,.2,1)',
      },
    },
  },
  plugins: [],
};

export default config;
