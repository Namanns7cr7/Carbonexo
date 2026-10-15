'use client';

/**
 * Small decorative SVG illustrations for empty states. Pure inline SVG, no
 * external image/font dependency — fully theme-aware via CSS custom
 * properties (var(--lime), var(--blue), etc.), so it adapts to light/dark
 * automatically like every other visual in the app.
 */

/**
 * A potted sprout — used for the "nothing logged yet" empty states.
 * `tone="default"` uses the app's color tokens (for placement on a plain
 * surface/card); `tone="white"` uses white/translucent-white only (for
 * placement directly on a colored gradient, e.g. the Dashboard hero, where
 * the token colors wouldn't contrast against a same-hue background).
 */
export function SproutIllustration({ size = 140, tone = 'default' }: { size?: number; tone?: 'default' | 'white' }) {
  const c =
    tone === 'white'
      ? { pot: 'rgba(255,255,255,0.75)', potFill: 'rgba(255,255,255,0.18)', leaf: 'rgba(255,255,255,0.92)', leafFill: 'rgba(255,255,255,0.22)', soil: 'rgba(255,255,255,0.55)', dotA: 'rgba(255,255,255,0.5)', dotB: 'rgba(255,255,255,0.35)', shadow: 'rgba(255,255,255,0.18)' }
      : { pot: 'var(--blue)', potFill: 'var(--blue-soft)', leaf: 'var(--lime-deep)', leafFill: 'var(--lime)', soil: 'var(--lime-deep)', dotA: 'var(--blue)', dotB: 'var(--lime)', shadow: 'var(--border)' };

  return (
    <svg width={size} height={size * 0.8} viewBox="0 0 200 160" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      {/* ground shadow */}
      <ellipse cx="100" cy="146" rx="46" ry="7" fill={c.shadow} opacity="0.5" />

      {/* decorative accent dots, matching the app's existing floating-dot motif */}
      <circle cx="42" cy="48" r="3" fill={c.dotA} opacity="0.6" />
      <circle cx="162" cy="66" r="4" fill={c.dotB} opacity="0.5" />
      <circle cx="150" cy="30" r="2.5" fill={c.dotA} opacity="0.7" />

      {/* sparkle accent */}
      <g stroke={c.dotA} strokeWidth="2.5" strokeLinecap="round" opacity="0.85">
        <path d="M156 20v10M151 25h10M138 40l5 5M138 40l7-2" />
      </g>

      {/* pot */}
      <path
        d="M70 104h60l-7 38a6 6 0 0 1-6 5H83a6 6 0 0 1-6-5l-7-38Z"
        fill={c.potFill}
        stroke={c.pot}
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <rect x="66" y="98" width="68" height="12" rx="6" fill={c.pot} />

      {/* soil */}
      <ellipse cx="100" cy="100" rx="26" ry="5" fill={c.soil} />

      {/* stem */}
      <path d="M100 100C100 100 98 72 100 50" stroke={c.leaf} strokeWidth="4" strokeLinecap="round" />

      {/* leaves */}
      <path d="M100 78C100 78 76 76 72 58C72 58 98 54 100 78Z" fill={c.leafFill} stroke={c.leaf} strokeWidth="2" strokeLinejoin="round" />
      <path d="M100 62C100 62 122 58 128 42C128 42 102 40 100 62Z" fill={c.leafFill} stroke={c.leaf} strokeWidth="2" strokeLinejoin="round" />
      <path d="M100 50C100 50 92 34 98 20C98 20 112 32 100 50Z" fill={c.leafFill} stroke={c.leaf} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}
