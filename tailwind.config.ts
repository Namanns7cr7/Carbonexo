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
        danger: 'var(--danger)',
        'danger-soft': 'var(--danger-soft)',
        ink: 'var(--ink)',
        'ink-text': 'var(--ink-text)',
        'ink-muted': 'var(--ink-muted)',
        'ink-border': 'var(--ink-border)',
        violet: 'var(--accent-violet)',
        amber: 'var(--accent-amber)',
        teal: 'var(--accent-teal)',
        rose: 'var(--accent-rose)',
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
        glow: '0 0 30px var(--glow)',
        'glow-lime': '0 8px 30px -8px rgba(16, 185, 129, 0.35)',
        'glow-violet': '0 8px 30px -8px rgba(139, 92, 246, 0.3)',
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
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
      animation: {
        floatA: 'floatA 6s ease-in-out infinite',
        ringdraw: 'ringdraw 1.6s ease-out',
        gradientMove: 'gradientMove 10s ease infinite',
        shineSweep: 'shineSweep 4.5s ease-in-out infinite',
        popIn: 'popIn .4s cubic-bezier(.2,.7,.2,1)',
        shimmer: 'shimmer 2s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
