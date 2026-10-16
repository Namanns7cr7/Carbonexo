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

        // ---- living-world scene palette (Phase 1) ----
        // Flat colours in both themes, so these are safe in colour utilities
        // (unlike bg/ink, which are gradients in .dark).
        canopy: 'var(--canopy)',
        'canopy-deep': 'var(--canopy-deep)',
        'canopy-lit': 'var(--canopy-lit)',
        midnight: 'var(--midnight)',
        'midnight-soft': 'var(--midnight-soft)',
        void: 'var(--void)',
        sunlight: 'var(--sunlight)',
        'sunlight-deep': 'var(--sunlight-deep)',
        mint: 'var(--mint)',
        water: 'var(--water)',
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
        // ---- elevation scale (Phase 1) ----
        'elev-1': 'var(--elev-1)',
        'elev-2': 'var(--elev-2)',
        'elev-3': 'var(--elev-3)',
        'elev-4': 'var(--elev-4)',
      },
      transitionDuration: {
        xs: '120ms',
        sm: '220ms',
        md: '380ms',
        lg: '620ms',
        xl: '980ms',
        scene: '1600ms',
      },
      transitionTimingFunction: {
        // Mirrors lib/motion.ts EASE — keep the two in sync.
        out: 'cubic-bezier(0.2, 0.7, 0.2, 1)',
        'in': 'cubic-bezier(0.5, 0, 0.75, 0)',
        'in-out': 'cubic-bezier(0.6, 0, 0.3, 1)',
        entrance: 'cubic-bezier(0.16, 1, 0.3, 1)',
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
