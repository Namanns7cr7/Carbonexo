'use client';

import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { revealInView } from '@/lib/motion';
import type { MotionTier } from '@/lib/motion';

/* ────────────────────────────────────────────────────────────────────────────
   Shared pieces for the scroll-story chapters.

   Every chapter sits on a flat-token night ground that is identical in both
   themes, so copy colours here are fixed light-on-dark rather than --text.
   ──────────────────────────────────────────────────────────────────────────── */

/**
 * Seeded PRNG. Decoration generated from it at module scope is byte-identical
 * on server and client — Math.random would hydrate-mismatch.
 */
export function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Muted body copy on the night ground. */
export const COPY_DIM = 'rgba(232,242,236,0.72)';
export const COPY_FAINT = 'rgba(232,242,236,0.5)';
/** Glass panel on the night ground. */
export const PANEL = {
  background: 'rgba(255,255,255,0.045)',
  border: '1px solid rgba(255,255,255,0.1)',
  backdropFilter: 'blur(10px)',
} as const;

export function ChapterHeading({
  tier,
  eyebrow,
  title,
  children,
  align = 'left',
}: {
  tier: MotionTier;
  eyebrow: string;
  title: ReactNode;
  children?: ReactNode;
  align?: 'left' | 'center';
}) {
  const centred = align === 'center';
  return (
    <div className={centred ? 'mx-auto max-w-[760px] text-center' : 'max-w-[560px]'}>
      <motion.p
        className="mb-5 font-mono text-[11px] font-medium uppercase tracking-[0.22em]"
        style={{ color: 'var(--mint)' }}
        {...revealInView(tier, { distance: 14 })}
      >
        {eyebrow}
      </motion.p>
      <motion.h2
        className="font-display text-[clamp(32px,5.2vw,62px)] font-extrabold leading-[1.02] tracking-[-0.032em] text-white"
        style={{ textWrap: 'balance' }}
        {...revealInView(tier, { delay: 0.08 })}
      >
        {title}
      </motion.h2>
      {children && (
        <motion.p
          className={`mt-6 text-[clamp(16px,1.8vw,18px)] leading-[1.65] ${centred ? 'mx-auto max-w-[56ch]' : 'max-w-[48ch]'}`}
          style={{ color: COPY_DIM }}
          {...revealInView(tier, { delay: 0.16, distance: 20 })}
        >
          {children}
        </motion.p>
      )}
    </div>
  );
}

/** Small print that says where a number comes from. */
export function Provenance({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`font-mono text-[11px] leading-[1.6] tracking-[0.02em] ${className}`} style={{ color: COPY_FAINT }}>
      {children}
    </p>
  );
}

/**
 * A small version of the Chapter 1 planet, for scenes that need the world on
 * screen without the camera work. `haze` (0..1) veils it in emission smog;
 * `bloom` (0..1) greens the canopy and brightens the atmosphere.
 */
export function MiniPlanet({
  size,
  haze = 0,
  bloom = 0,
  spinning,
}: {
  size: string;
  haze?: number;
  bloom?: number;
  spinning: boolean;
}) {
  return (
    <div aria-hidden="true" className="relative" style={{ width: size, aspectRatio: '1' }}>
      <div
        className="absolute -inset-[16%] rounded-full transition-opacity duration-lg ease-out"
        style={{
          background: 'radial-gradient(circle, transparent 58%, var(--light-cool) 70%, transparent 80%)',
          filter: 'blur(16px)',
          opacity: 0.55 + bloom * 0.45 - haze * 0.35,
        }}
      />
      <div
        className="absolute inset-0 overflow-hidden rounded-full"
        style={{
          background: 'radial-gradient(circle at 34% 30%, #4aa6c6 0%, var(--water) 44%, #0d3146 84%)',
          boxShadow: 'inset 0 0 40px 10px rgba(2,6,10,0.52), 0 0 70px 6px var(--light-cool)',
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: [
              'radial-gradient(ellipse 70px 92px at 62px 38%, var(--canopy-lit) 0 38%, var(--canopy) 60%, transparent 74%)',
              'radial-gradient(ellipse 54px 64px at 152px 70%, var(--canopy) 0 46%, transparent 70%)',
              'radial-gradient(ellipse 98px 74px at 268px 29%, var(--canopy-lit) 0 32%, var(--canopy) 58%, transparent 76%)',
              'radial-gradient(ellipse 60px 104px at 352px 66%, var(--canopy-deep) 0 42%, transparent 72%)',
              'radial-gradient(ellipse 46px 52px at 442px 43%, var(--canopy) 0 48%, transparent 74%)',
            ].join(','),
            backgroundSize: '500px 100%',
            backgroundRepeat: 'repeat-x',
            filter: `saturate(${0.7 + bloom * 0.7}) brightness(${0.9 + bloom * 0.3})`,
            animation: spinning ? 'planetSpin 90s linear infinite' : undefined,
          }}
        />
        {/* emission smog */}
        <div
          className="absolute inset-0 transition-opacity duration-lg ease-out"
          style={{
            background: 'radial-gradient(circle at 40% 40%, var(--smog), rgba(120,110,96,0.7) 70%)',
            opacity: haze * 0.85,
          }}
        />
        <div
          className="absolute inset-0"
          style={{ background: 'radial-gradient(circle at 30% 28%, rgba(255,255,255,0.26), transparent 52%)' }}
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(circle at 74% 77%, rgba(2,6,10,0.86) 0%, rgba(2,6,10,0.3) 46%, transparent 66%)',
          }}
        />
      </div>
    </div>
  );
}
