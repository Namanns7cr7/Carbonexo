'use client';

/**
 * The app's sky. A calm, CSS-only night over forest — the same world the
 * landing planet lives in, without a WebGL context behind every form and
 * table. When the shared Living World is available, the horizon glow takes
 * the planet's health: amber haze when degraded, emerald when alive.
 *
 * Star positions are seeded at module scope so server and client markup match.
 */

import { useOptionalLivingWorld } from '@/lib/living-world/LivingWorldProvider';

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20261016);
const STARS = Array.from({ length: 46 }, () => ({ x: rnd() * 100, y: rnd() * 62, s: rnd() < 0.15 ? 2 : 1, o: 0.18 + rnd() * 0.5, d: 3 + rnd() * 6 }));

export function WorldBackdrop() {
  const lw = useOptionalLivingWorld();
  const v = lw?.world.visual.vitality ?? 0.5;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden style={{ ['--vitality' as string]: String(v) }}>
      {/* Night falls toward the forest floor. Light theme keeps the existing pale --bg; these layers are dark-only. */}
      <div className="absolute inset-0 hidden dark:block" style={{ background: 'radial-gradient(120% 80% at 50% -10%, #0b1f2b 0%, #06120e 45%, #040a08 100%)' }} />
      <div className="absolute inset-0 hidden dark:block">
        {STARS.map((st, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ left: `${st.x}%`, top: `${st.y}%`, width: st.s, height: st.s, opacity: st.o, animation: `twinkle ${st.d}s ease-in-out ${i * 0.17}s infinite` }}
          />
        ))}
      </div>
      {/* Horizon glow — the planet's health, carried into every screen. */}
      <div
        className="absolute -bottom-[30vh] left-1/2 h-[70vh] w-[160vw] -translate-x-1/2 rounded-[50%] opacity-80 transition-[background] duration-[1600ms] dark:opacity-100"
        style={{
          background:
            'radial-gradient(closest-side, color-mix(in srgb, rgba(52,211,153,0.22) calc(var(--vitality) * 100%), rgba(196,140,72,0.2)), transparent 72%)',
          filter: 'blur(8px)',
        }}
      />
      {/* Canopy silhouette along the bottom edge. */}
      <svg className="absolute bottom-0 left-0 hidden h-[16vh] w-full dark:block" viewBox="0 0 1440 160" preserveAspectRatio="none">
        <path
          d="M0 160V96c40-14 70-40 110-30s60 34 104 22 58-52 104-46 52 40 96 34 66-46 112-40 54 38 100 30 70-50 118-42 48 44 94 38 72-48 120-38 56 40 102 30 64-38 110-28 60 36 106 26 40-16 64-12V160z"
          fill="#030806"
          opacity="0.9"
        />
      </svg>
      {/* Two slow light glows — the existing ambient language, retuned to forest and water. */}
      <div className="absolute -right-[8%] -top-[14%] h-[55vw] max-h-[720px] w-[55vw] max-w-[720px] rounded-full" style={{ background: 'radial-gradient(circle,var(--glow-a),transparent 66%)', animation: 'drift 26s ease-in-out infinite' }} />
      <div className="absolute -bottom-[20%] -left-[12%] h-[50vw] max-h-[640px] w-[50vw] max-w-[640px] rounded-full" style={{ background: 'radial-gradient(circle,var(--glow-b),transparent 66%)', animation: 'driftSlow 32s ease-in-out infinite' }} />
    </div>
  );
}
