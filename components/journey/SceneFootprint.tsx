'use client';

/**
 * Scene 3 — your footprint. The planet slides aside and the original
 * Carbonexo dashboard card returns: score ring, category bars, the chips, the
 * bar strip, with the AI-insight and Carbon-Swap cards docked to it. The old
 * one was a static mock with hardcoded numbers; this one is driven by
 * useJourneyData() — the user's real day when signed in, a labelled example
 * day (real factors) when not.
 */

import Link from 'next/link';
import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { CATEGORIES } from '@/lib/carbon';
import { MagneticButton, TactileCard } from '@/components/physics';
import { useJourneyData, type FootprintView } from './useJourneyData';

const RING_C = 2 * Math.PI * 52;
/** Same scale as the dashboard ring: 12 kg ≈ a heavy day. */
const HEAVY_DAY = 12;

export const SceneFootprint = forwardRef<HTMLElement>(function SceneFootprint(_, ref) {
  const d = useJourneyData();
  const enter = (delay = 0) => ({
    initial: { opacity: 0, y: 40 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, amount: 0.3 },
    transition: { type: 'spring' as const, stiffness: 110, damping: 19, delay },
  });

  return (
    <section ref={ref} id="footprint" aria-labelledby="footprint-title" className="relative flex min-h-[100svh] items-center py-28">
      <div className="mx-auto grid w-full max-w-[1240px] items-center gap-10 px-5 sm:px-6 md:grid-cols-[minmax(0,0.8fr)_minmax(0,1.7fr)]">
        <div className="hidden md:block" aria-hidden />
        <div className="pointer-events-auto grid items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,400px)]">
          <div>
            <motion.div {...enter()}>
              <div className="mb-2.5 font-mono text-xs uppercase tracking-[0.16em] text-lime">Your footprint</div>
              <h2 id="footprint-title" className="mb-3 font-display text-[clamp(30px,3.6vw,44px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
                From global to personal.
              </h2>
              <p className="mb-6 max-w-[440px] text-[16px] leading-[1.6] text-muted">
                Log what you did — a commute, a meal, the AC. Carbonexo turns it into kilograms you can see, shows what drives them, and
                suggests the swap that matters most for you.
              </p>
            </motion.div>
            <motion.div {...enter(0.1)} className="grid max-w-[440px] gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <InsightCard d={d} />
              <SwapCard d={d} />
            </motion.div>
            <motion.div {...enter(0.16)} className="mt-7 flex flex-wrap items-center gap-3.5">
              <MagneticButton
                href={d.mode === 'real' ? '/app/track' : '/register'}
                className="rounded-[14px] bg-lime px-6 py-3.5 text-[15px] font-bold text-[#0c1d15]"
                style={{ boxShadow: '0 12px 30px -12px var(--lime)' }}
              >
                {d.mode === 'real' ? '+ Track today' : 'Track your own day →'}
              </MagneticButton>
              {d.mode === 'real' && (
                <Link href="/app" className="text-[15px] font-semibold text-muted underline-offset-4 hover:text-text hover:underline">
                  Open dashboard
                </Link>
              )}
            </motion.div>
          </div>
          <motion.div {...enter(0.06)} className="mx-auto w-full max-w-[400px]">
            <FootprintCard d={d} />
          </motion.div>
        </div>
      </div>
    </section>
  );
});

function FootprintCard({ d }: { d: FootprintView }) {
  const frac = Math.min(1, d.totalKg / HEAVY_DAY);
  const maxBar = Math.max(...d.bars.map((b) => b.kg), 0.1);
  const peak = d.bars.reduce((m, b, i) => (b.kg > d.bars[m].kg ? i : m), 0);

  return (
    <TactileCard
      className="rounded-[26px] border border-ink-border p-6"
      style={{ background: 'var(--ink)', boxShadow: '0 40px 80px -34px var(--shadow-strong),0 0 60px rgba(79,211,138,0.12)' }}
    >
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <div className="text-xs font-medium text-ink-muted">{d.mode === 'real' ? (d.name ? `${d.name}, today` : 'Today') : 'Example day'}</div>
          <div className="font-display text-[17px] font-bold text-ink-text">Today&apos;s footprint</div>
        </div>
        {d.mode === 'real' && d.deltaPct !== null ? (
          <div
            className="rounded-full px-[11px] py-1.5 text-xs font-bold"
            style={d.deltaPct <= 0 ? { background: 'var(--lime-soft)', color: 'var(--lime)' } : { background: 'var(--blue-soft)', color: 'var(--blue)' }}
          >
            {d.deltaPct <= 0 ? '↓' : '↑'} {Math.abs(Math.round(d.deltaPct))}% vs yesterday
          </div>
        ) : d.mode === 'example' ? (
          <div className="rounded-full border border-ink-border px-[11px] py-1.5 text-[11px] font-bold text-ink-muted">Illustrative</div>
        ) : null}
      </div>

      <div className="mb-5 flex items-center gap-[18px]">
        <div className="relative h-[118px] w-[118px] flex-shrink-0">
          <svg width="118" height="118" viewBox="0 0 120 120" aria-hidden>
            <circle cx="60" cy="60" r="52" fill="none" stroke="var(--ink-border)" strokeWidth="12" />
            <motion.circle
              cx="60"
              cy="60"
              r="52"
              fill="none"
              stroke="var(--lime)"
              strokeWidth="12"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              transform="rotate(-90 60 60)"
              initial={{ strokeDashoffset: RING_C }}
              whileInView={{ strokeDashoffset: RING_C * (1 - frac) }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 40, damping: 14 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="font-display text-[27px] font-extrabold leading-none text-ink-text">{d.totalKg.toFixed(1)}</div>
            <div className="text-[11px] font-semibold text-ink-muted">kg CO₂e</div>
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-[9px]">
          {d.slices.length === 0 && <p className="text-[13px] text-ink-muted">Nothing logged yet today.</p>}
          {d.slices.slice(0, 3).map((c) => (
            <div key={c.category}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="text-ink-text">{c.label}</span>
                <span className="font-bold" style={{ color: c.color }}>
                  {c.kg.toFixed(1)}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-ink-border">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: c.color }}
                  initial={{ width: 0 }}
                  whileInView={{ width: `${Math.round(c.share * 100)}%` }}
                  viewport={{ once: true }}
                  transition={{ type: 'spring', stiffness: 90, damping: 16, delay: 0.15 }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {CATEGORIES.map((c) => (
          <span key={c.id} className="rounded-full bg-ink-border px-2.5 py-[5px] text-[11px] font-semibold text-ink-text">
            <span aria-hidden>{c.emoji}</span> {c.label}
          </span>
        ))}
      </div>

      <div className="rounded-[14px] bg-white/5 p-3">
        <div className="mb-2 flex justify-between text-[10.5px] font-semibold uppercase tracking-[0.12em] text-ink-muted">
          <span>{d.barsLabel}</span>
          <span>kg</span>
        </div>
        <div className="flex h-[54px] items-end gap-1.5" role="img" aria-label={`${d.barsLabel}: ${d.bars.map((b) => `${b.label} ${b.kg.toFixed(1)} kg`).join(', ')}`}>
          {d.bars.map((b, i) => (
            <motion.div
              key={b.key}
              className="flex-1 rounded"
              style={{ background: i === peak && b.kg > 0 ? 'var(--lime)' : 'var(--ink-border)', originY: 1 }}
              initial={{ scaleY: 0 }}
              whileInView={{ scaleY: 1 }}
              viewport={{ once: true }}
              transition={{ type: 'spring', stiffness: 160, damping: 14, delay: 0.2 + i * 0.04 }}
            >
              <div style={{ height: `${Math.max(6, (b.kg / maxBar) * 54)}px` }} />
            </motion.div>
          ))}
        </div>
        <div className="mt-1.5 flex gap-1.5 text-center font-mono text-[10px] text-ink-muted">
          {d.bars.map((b) => (
            <span key={b.key} className="flex-1">
              {b.label}
            </span>
          ))}
        </div>
      </div>
      {d.mode === 'example' && (
        <p className="mt-3 text-[11px] leading-[1.45] text-ink-muted">
          A typical weekday — 13 km by car, a chicken lunch, AC overnight — priced with the tracker&apos;s own emission factors.
        </p>
      )}
    </TactileCard>
  );
}

function InsightCard({ d }: { d: FootprintView }) {
  return (
    <TactileCard className="rounded-[18px] border border-border p-3.5" style={{ background: 'var(--card)' }}>
      <div className="mb-2 flex items-center gap-[7px]">
        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-lime text-xs text-[#0c1d15]">✦</div>
        <span className="text-xs font-bold">Insight</span>
      </div>
      <p className="text-xs leading-[1.5] text-muted">
        {d.biggest ? (
          <>
            {d.biggest.label} is {d.mode === 'real' ? 'your' : 'this day’s'} biggest source —{' '}
            <strong className="text-text">{d.biggest.kg.toFixed(1)} kg</strong>
            {d.totalKg > 0 && <> of {d.totalKg.toFixed(1)}</>}.
          </>
        ) : (
          'Log an activity and Carbonexo shows what drives your day.'
        )}
      </p>
    </TactileCard>
  );
}

function SwapCard({ d }: { d: FootprintView }) {
  const a = d.suggestion;
  return (
    <TactileCard className="rounded-[18px] border border-border p-3.5" style={{ background: 'var(--card)' }}>
      <div className="mb-2 flex items-center justify-between gap-1.5">
        <span className="text-xs font-bold">Carbon Swap</span>
        {a && (
          <span className="rounded-full bg-lime-soft px-[7px] py-0.5 text-[10px] font-bold text-lime-deep" title="Estimated saving per week, from the action catalog">
            ≈ −{a.saving} kg/wk
          </span>
        )}
      </div>
      <p className="text-xs leading-[1.5] text-muted">
        {a ? (
          <>
            <span aria-hidden>{a.emoji}</span> <strong className="text-text">{a.title}.</strong> {a.desc}
          </>
        ) : (
          'Swaps appear once Carbonexo knows your biggest source.'
        )}
      </p>
    </TactileCard>
  );
}
