'use client';

/**
 * Opening scene: the real planet, lit as it is right now, with one clear
 * call to action. The globe is passive here (idle orbit, no drag) so touch
 * scrolling over it always scrolls the page.
 */

import Link from 'next/link';
import { motion } from 'framer-motion';
import { LivingEarth } from '@/components/planet/LivingEarth';
import { useMotionTier } from '@/lib/useMotionTier';
import { fadeUp } from '@/lib/motion';

export function CinematicHero({
  ctaHref = '/onboarding',
  secondaryHref = '#tour',
}: {
  ctaHref?: string;
  secondaryHref?: string;
}) {
  const tier = useMotionTier();

  return (
    <section aria-labelledby="hero-title" className="relative isolate min-h-[100svh] overflow-hidden" style={{ background: 'var(--void)' }}>
      {/* Globe: right of centre on desktop, behind the copy on mobile. */}
      <div className="absolute inset-0 md:left-[30%]">
        <LivingEarth
          className="h-full w-full"
          label="Planet Earth as it is lit right now, slowly turning."
          credit
        />
      </div>
      {/* Legibility scrim — copy never sits on raw imagery. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{ background: 'linear-gradient(90deg, rgba(4,8,12,0.92) 0%, rgba(4,8,12,0.7) 34%, rgba(4,8,12,0) 62%), linear-gradient(0deg, rgba(4,8,12,0.85) 0%, transparent 38%)' }}
      />

      <div className="relative z-[2] mx-auto flex min-h-[100svh] max-w-[1240px] flex-col justify-end px-6 pb-[14vh] pt-28 md:justify-center md:pb-0">
        <motion.p
          className="mb-5 font-mono text-[11px] font-medium uppercase tracking-[0.24em]"
          style={{ color: 'var(--mint)' }}
          {...fadeUp(tier, { delay: 0.1, distance: 14 })}
        >
          Carbonexo
        </motion.p>
        <motion.h1
          id="hero-title"
          className="max-w-[14ch] font-display text-[clamp(40px,7vw,88px)] font-extrabold leading-[0.96] tracking-[-0.038em] text-white"
          style={{ textWrap: 'balance' }}
          {...fadeUp(tier, { delay: 0.2, distance: 30 })}
        >
          This is the planet you’re changing.
        </motion.h1>
        <motion.p
          className="mt-7 max-w-[44ch] text-[clamp(16px,1.9vw,19px)] leading-[1.6] text-white/75"
          {...fadeUp(tier, { delay: 0.32, distance: 22 })}
        >
          The day side, the night side and the city lights are where they are right now. Carbonexo shows what your
          everyday choices add to it — and what changes when you change them.
        </motion.p>
        <motion.div className="mt-10 flex flex-wrap items-center gap-4" {...fadeUp(tier, { delay: 0.44, distance: 18 })}>
          <Link
            href={ctaHref}
            className="rounded-[14px] px-7 py-4 text-base font-bold text-[#04170f] transition-transform duration-sm ease-out hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mint)]"
            style={{ background: 'var(--mint)', boxShadow: '0 16px 40px -16px rgba(184,232,212,0.7)' }}
          >
            Start with one day →
          </Link>
          <a
            href={secondaryHref}
            className="rounded-[14px] border border-white/20 bg-white/5 px-[26px] py-4 text-base font-semibold text-white/90 backdrop-blur transition-colors duration-sm hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--mint)]"
          >
            Take the tour
          </a>
        </motion.div>
      </div>
    </section>
  );
}
