'use client';

/**
 * Scene 1 — the planet. The original Carbonexo hero, rebuilt over the real
 * Earth: same pill, same two-tone Bricolage headline, same lime CTA. The
 * invented social proof the old hero carried (120k trackers, 2.4M kg, 4.9★)
 * is replaced by three things that are actually true about the page.
 */

import { forwardRef, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { MagneticButton } from '@/components/physics';
import s from './journey.module.css';

export const ScenePlanet = forwardRef<HTMLElement>(function ScenePlanet(_, ref) {
  const [clock, setClock] = useState<string | null>(null);

  useEffect(() => {
    const fmt = () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    setClock(fmt());
    const id = window.setInterval(() => setClock(fmt()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const rise = (delay: number) => ({
    initial: { opacity: 0, y: 26 },
    animate: { opacity: 1, y: 0 },
    transition: { type: 'spring' as const, stiffness: 120, damping: 20, mass: 0.9, delay },
  });

  return (
    <section ref={ref} id="planet" aria-labelledby="planet-title" className="relative flex min-h-[100svh] items-end md:items-center">
      <div className="mx-auto w-full max-w-[1240px] px-5 pb-[5svh] pt-28 sm:px-6 md:pb-0">
        <div className="pointer-events-auto max-w-[600px]">
          <motion.div
            {...rise(0.05)}
            className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-lime-soft px-3.5 py-[7px] text-[13px] font-semibold text-lime-deep"
          >
            <span className="h-[7px] w-[7px] rounded-full bg-lime" />
            Your daily carbon companion
          </motion.div>
          <motion.h1
            {...rise(0.12)}
            id="planet-title"
            className="mb-6 font-display text-[clamp(44px,7vw,84px)] font-extrabold leading-[0.98] tracking-[-0.035em] text-text"
          >
            Your choices
            <br />
            shape <span className="text-lime">tomorrow.</span>
          </motion.h1>
          <motion.p {...rise(0.2)} className="mb-9 max-w-[480px] text-[clamp(16px,2vw,18px)] leading-[1.6] text-muted">
            Carbonexo helps you track daily activities, understand your carbon footprint, and reduce emissions through simple actions
            and personalized AI insights.
          </motion.p>
          <motion.div {...rise(0.28)} className="mb-10 flex flex-wrap items-center gap-3.5">
            <MagneticButton
              href="#world"
              className="rounded-[14px] bg-lime px-7 py-4 text-base font-bold text-[#0c1d15]"
              style={{ boxShadow: '0 14px 34px -12px var(--lime)' }}
            >
              Explore Your Impact <span aria-hidden>↓</span>
            </MagneticButton>
            <MagneticButton href="/onboarding" strength={5} className="rounded-[14px] border border-border bg-surface px-[26px] py-4 text-base font-semibold text-text">
              Start Tracking →
            </MagneticButton>
          </motion.div>
          <motion.dl {...rise(0.36)} className="flex flex-wrap gap-x-7 gap-y-3 text-[13px]">
            <Fact term="Day & night" value={clock ? `as of ${clock}` : 'live'} />
            <Fact term="Data" value="OWID · Ember · GCP" />
            <Fact term="Grab the planet" value="drag to turn it" />
          </motion.dl>
        </div>
      </div>
      <a
        href="#world"
        aria-label="Scroll to Your world"
        className={`pointer-events-auto absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted md:flex ${s.scrollCue}`}
      >
        Scroll
        <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden>
          <rect x="1" y="1" width="12" height="18" rx="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="7" cy="6" r="1.6" fill="currentColor" />
        </svg>
      </a>
    </section>
  );
});

function Fact({ term, value }: { term: string; value: string }) {
  return (
    <div className="border-l-2 pl-3" style={{ borderColor: 'rgba(79,211,138,0.6)' }}>
      <dt className="font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted">{term}</dt>
      <dd className="mt-0.5 font-semibold text-text">{value}</dd>
    </div>
  );
}
