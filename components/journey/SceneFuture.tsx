'use client';

/**
 * Scene 5 — together. The camera settles on the morning terminator (where
 * the sun is rising right now) and the page closes with the original
 * Carbonexo final call to action — the lime gradient card — restored.
 *
 * No collective totals are shown: Carbonexo has no verified aggregate figure
 * to put here, so the scene points at the features that exist instead.
 */

import Link from 'next/link';
import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { MagneticButton, TactileCard } from '@/components/physics';
import { CO2_SOURCE } from '@/lib/experience/co2';
import { GRID_SOURCE } from '@/lib/experience/grid';
import s from './journey.module.css';

const PATHS = [
  {
    href: '/app/groups',
    mark: '👥',
    title: 'Group challenges',
    body: 'Start a group with friends or your team and take on the same swaps together.',
  },
  {
    href: '/app/simulate',
    mark: '🧪',
    title: 'Your carbon twin',
    body: 'Try a change before you make it — see what a different commute or diet would do to your week.',
  },
  {
    href: '/app/credits',
    mark: '🛡️',
    title: 'Points, not offsets',
    body: 'Green Points reward your actions. Certified carbon credits are a separate thing, and Carbonexo keeps them separate.',
  },
];

export const SceneFuture = forwardRef<HTMLElement>(function SceneFuture(_, ref) {
  return (
    <section ref={ref} id="future" aria-labelledby="future-title" className="relative pt-28">
      <div className="mx-auto w-full max-w-[1100px] px-5 sm:px-6">
        <div className="pointer-events-auto mx-auto mb-12 max-w-[640px] text-center">
          <div className="mb-2.5 font-mono text-xs uppercase tracking-[0.16em] text-lime">Together</div>
          <h2 id="future-title" className="mb-3 font-display text-[clamp(30px,4vw,46px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
            Somewhere, the sun is rising.
          </h2>
          <p className="text-[16px] leading-[1.6] text-muted">
            The bright edge on the planet is the real sunrise line, right now. Tomorrow is still open — and it&apos;s easier to change with other people.
          </p>
        </div>

        <div className="pointer-events-auto grid gap-4 md:grid-cols-3">
          {PATHS.map((p, i) => (
            <motion.div
              key={p.href}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ type: 'spring', stiffness: 120, damping: 18, delay: i * 0.07 }}
            >
              <Link href={p.href} className="block h-full rounded-[22px] outline-none focus-visible:ring-2 focus-visible:ring-lime">
                <TactileCard className={`h-full rounded-[22px] p-[22px] ${s.panel}`}>
                  <div className="mb-3.5 flex h-11 w-11 items-center justify-center rounded-[13px] bg-lime-soft text-[20px]" aria-hidden>
                    {p.mark}
                  </div>
                  <div className="mb-1.5 text-[16px] font-bold">{p.title}</div>
                  <p className="text-[13.5px] leading-[1.55] text-muted">{p.body}</p>
                  <div className="mt-4 text-[13px] font-bold text-lime">Open →</div>
                </TactileCard>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* The original Carbonexo closing card. */}
        <motion.div
          className="pointer-events-auto mt-[min(40vh,320px)]"
          initial={{ opacity: 0, y: 50, scale: 0.98 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ type: 'spring', stiffness: 90, damping: 18 }}
        >
          <div
            className="relative overflow-hidden rounded-[32px] px-[clamp(24px,5vw,48px)] py-[clamp(40px,7vw,72px)] text-center"
            style={{ background: 'linear-gradient(135deg,#4fd38a,#2fae67 55%,#1e7a47)', boxShadow: '0 30px 80px -30px rgba(79,211,138,0.6)' }}
          >
            <div aria-hidden className="pointer-events-none absolute -left-[30px] -top-[50px] h-[240px] w-[240px] rounded-full bg-white/15" />
            <div aria-hidden className="pointer-events-none absolute -bottom-[60px] -right-5 h-[260px] w-[260px] rounded-full" style={{ background: 'rgba(12,29,21,0.14)' }} />
            <div className="relative">
              <h2 className="mb-4 font-display text-[clamp(34px,5vw,56px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-[#0c1d15]">
                Small actions. Real impact.
              </h2>
              <p className="mx-auto mb-8 max-w-[520px] text-[clamp(16px,2vw,19px)] font-medium leading-[1.55] text-[#163224]">
                Start tracking your daily footprint and build better habits with Carbonexo.
              </p>
              <div className="flex flex-wrap justify-center gap-3.5">
                <MagneticButton href="/register" className="rounded-[14px] bg-[#0c1d15] px-[30px] py-4 text-base font-bold text-white">
                  Start Tracking Now →
                </MagneticButton>
                <MagneticButton href="/login" strength={5} className="rounded-[14px] bg-white/90 px-7 py-4 text-base font-bold text-[#0c1d15]">
                  I have an account
                </MagneticButton>
              </div>
            </div>
          </div>
        </motion.div>

        <footer className="pointer-events-auto mt-12 flex flex-col gap-4 border-t border-border py-8 sm:flex-row sm:items-start sm:justify-between">
          <Link href="/" aria-label="Carbonexo home" className="text-text">
            <Logo size={30} />
          </Link>
          <div className="max-w-[640px] text-[12px] leading-[1.6] text-muted sm:text-right">
            <p>Track your footprint. Reduce your impact. © 2026 Carbonexo</p>
            <p className="mt-1">
              Earth imagery: NASA Blue &amp; Black Marble (public domain), composite — day/night computed for the current time. Data:{' '}
              <a className="underline decoration-white/25 underline-offset-2 hover:text-text" href={CO2_SOURCE.url} target="_blank" rel="noreferrer">
                OWID / Global Carbon Project
              </a>
              ,{' '}
              <a className="underline decoration-white/25 underline-offset-2 hover:text-text" href={GRID_SOURCE.url} target="_blank" rel="noreferrer">
                Ember via OWID
              </a>{' '}
              (CC BY 4.0).
            </p>
          </div>
        </footer>
      </div>
    </section>
  );
});
