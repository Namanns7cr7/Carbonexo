'use client';

import Link from 'next/link';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { Scene } from './Scene';
import { COPY_DIM, COPY_FAINT, mulberry32 } from './shared';
import { Logo } from '@/components/Logo';
import { useMotionTier } from '@/lib/useMotionTier';
import { revealInView } from '@/lib/motion';
import { usePwaInstall } from '@/lib/usePwaInstall';

/* ────────────────────────────────────────────────────────────────────────────
   Chapter 6 — Begin

   The story closes where it opened, on the planet — but from its surface, at
   sunrise. The sun lifts over the horizon as the reader arrives, and the one
   thing left to do is start. Supersedes FinalCTA (same actions, same routes).
   ──────────────────────────────────────────────────────────────────────────── */

const rand = mulberry32(20261017);
const STARS = Array.from({ length: 60 }, () => ({
  top: +(rand() * 45).toFixed(2),
  left: +(rand() * 100).toFixed(2),
  size: +(rand() * 1.5 + 0.5).toFixed(2),
  opacity: +(rand() * 0.4 + 0.2).toFixed(2),
}));

export function ChapterDawn() {
  const tier = useMotionTier();
  return (
    <Scene id="cta" label="Chapter six — begin" span="crossing">
      {(progress) => <Inner progress={progress} tier={tier} />}
    </Scene>
  );
}

function Inner({ progress, tier }: { progress: MotionValue<number>; tier: ReturnType<typeof useMotionTier> }) {
  const moves = tier !== 'still';
  const { promptInstall, installed } = usePwaInstall();

  // Sunrise: the sun climbs and the sky warms while the chapter scrolls into place.
  const sunY = useTransform(progress, [0.1, 0.5], [140, 0], { clamp: true });
  const warmth = useTransform(progress, [0.1, 0.5], [0.25, 1], { clamp: true });
  const starsFade = useTransform(progress, [0.15, 0.5], [1, 0.15], { clamp: true });

  return (
    <div className="relative flex min-h-[100svh] flex-col">
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(180deg, var(--canopy-deep) 0%, var(--void) 12%, var(--midnight) 40%, var(--midnight-soft) 70%, #3a3a4a 100%)' }} />
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(80% 55% at 50% 82%, var(--sunlight) 0%, var(--sunlight-deep) 22%, rgba(224,154,60,0.22) 46%, transparent 70%)',
          opacity: moves ? warmth : 0.9,
        }}
      />

      <motion.div aria-hidden="true" className="absolute inset-0" style={{ opacity: moves ? starsFade : 0.3 }}>
        {STARS.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{ top: `${s.top}%`, left: `${s.left}%`, width: s.size, height: s.size, opacity: s.opacity }}
          />
        ))}
      </motion.div>

      {/* sun */}
      {/* centring on a plain wrapper — Framer's inline transform would discard -translate-x-1/2 */}
      <div aria-hidden="true" className="absolute left-1/2 top-[64%] -translate-x-1/2">
        <motion.div
          className="h-[clamp(120px,16vw,200px)] w-[clamp(120px,16vw,200px)] rounded-full"
          style={{
            y: moves ? sunY : 0,
            background: 'radial-gradient(circle, #fff6dc 0%, var(--sunlight) 45%, rgba(245,199,104,0) 72%)',
            filter: 'blur(1px)',
            boxShadow: '0 0 120px 40px rgba(245,199,104,0.35)',
          }}
        />
      </div>

      {/* the planet's horizon, seen from the surface */}
      <div
        aria-hidden="true"
        className="absolute left-1/2 top-[72%] aspect-square w-[260vw] max-w-[3200px] -translate-x-1/2 rounded-full"
        style={{
          background: 'radial-gradient(circle at 50% 0%, var(--canopy-lit) 0%, var(--canopy) 8%, var(--canopy-deep) 22%, #03120c 40%)',
          boxShadow: '0 -4px 18px 0 var(--light-rim), 0 -30px 80px -10px rgba(245,199,104,0.4)',
        }}
      />

      <div className="relative z-[2] mx-auto flex max-w-[900px] flex-1 flex-col items-center justify-center px-6 pb-[22vh] pt-[18vh] text-center">
        <motion.p
          className="mb-5 font-mono text-[11px] font-medium uppercase tracking-[0.22em]"
          style={{ color: 'var(--mint)' }}
          {...revealInView(tier, { distance: 14 })}
        >
          Chapter six
        </motion.p>
        <motion.h2
          className="font-display text-[clamp(38px,6.6vw,80px)] font-extrabold leading-[0.98] tracking-[-0.035em] text-white"
          style={{ textWrap: 'balance' }}
          {...revealInView(tier, { delay: 0.08 })}
        >
          Start with one day.
        </motion.h2>
        <motion.p
          className="mx-auto mt-6 max-w-[50ch] text-[clamp(16px,2vw,19px)] leading-[1.6]"
          style={{ color: COPY_DIM }}
          {...revealInView(tier, { delay: 0.16, distance: 20 })}
        >
          Log a single day and Carbonexo shows you your own trace — then the swaps that matter for
          you, not for an average person.
        </motion.p>

        <motion.div className="mt-10 flex flex-wrap justify-center gap-4" {...revealInView(tier, { delay: 0.24, distance: 18 })}>
          <Link
            href="/onboarding"
            className="rounded-[14px] px-7 py-4 text-base font-bold text-[#06231a] transition-transform duration-sm ease-out hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint"
            style={{ background: 'var(--lime)', boxShadow: '0 14px 34px -12px var(--lime)' }}
          >
            Begin Your Journey →
          </Link>
          <Link
            href="/login"
            className="rounded-[14px] border px-[26px] py-4 text-base font-semibold text-white/90 transition-colors duration-sm hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint"
            style={{ borderColor: 'rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.05)' }}
          >
            I have an account
          </Link>
        </motion.div>

        <motion.button
          type="button"
          onClick={promptInstall}
          className="mt-6 text-[14px] font-semibold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint"
          style={{ color: COPY_DIM }}
          {...revealInView(tier, { delay: 0.3, distance: 10 })}
        >
          {installed ? 'Installed on this device ✓' : 'Or install Carbonexo as an app'}
        </motion.button>
      </div>

      <footer className="relative z-[2] mx-auto flex w-full max-w-[1200px] flex-wrap items-center justify-between gap-4 border-t px-6 py-7 text-white" style={{ borderColor: 'rgba(184,232,212,0.16)' }}>
        <Link href="/" aria-label="Carbonexo home">
          <Logo size={30} />
        </Link>
        <div className="text-[13px]" style={{ color: COPY_FAINT }}>
          Track your footprint. Reduce your impact. © 2026 Carbonexo
        </div>
      </footer>
    </div>
  );
}
