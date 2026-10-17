'use client';

/**
 * Scene 4 — your impact. The Impact Passport and its milestones as a timeline
 * you can fling (InertialRail). Stamps press in on a spring when they enter.
 *
 * Earned/unearned is computed from the user's real progress when signed in.
 * Signed out, the passport is shown as it really starts — empty — with the
 * path laid out ahead. Avoided emissions are labelled as estimates, and Green
 * Points are never presented as carbon credits.
 */

import { forwardRef } from 'react';
import { motion } from 'framer-motion';
import { InertialRail, TactileCard } from '@/components/physics';
import { useJourneyData, type FootprintView } from './useJourneyData';
import s from './journey.module.css';

interface Milestone {
  id: string;
  mark: string;
  label: string;
  detail: string;
  earned: (d: FootprintView) => boolean;
}

const MILESTONES: Milestone[] = [
  { id: 'first-log', mark: '📝', label: 'First day logged', detail: 'Any activity, any category.', earned: (d) => (d.daysTracked ?? 0) >= 1 },
  { id: 'streak-3', mark: '🔥', label: '3-day streak', detail: 'Three days in a row.', earned: (d) => (d.streak ?? 0) >= 3 },
  { id: 'first-action', mark: '✅', label: 'First swap done', detail: 'Complete one action from your plan.', earned: (d) => (d.actionsDone ?? 0) >= 1 },
  { id: 'week', mark: '🗓️', label: 'A full week', detail: 'Seven different days tracked.', earned: (d) => (d.daysTracked ?? 0) >= 7 },
  { id: 'five-actions', mark: '🌿', label: 'Five swaps', detail: 'Five actions completed.', earned: (d) => (d.actionsDone ?? 0) >= 5 },
];

export const SceneImpact = forwardRef<HTMLElement>(function SceneImpact(_, ref) {
  const d = useJourneyData();
  const real = d.mode === 'real';
  const earnedCount = real ? MILESTONES.filter((m) => m.earned(d)).length : 0;

  return (
    <section ref={ref} id="impact" aria-labelledby="impact-title" className="relative flex min-h-[100svh] items-center py-28">
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-6">
        <div className="pointer-events-auto max-w-[620px]">
          <div className="mb-2.5 font-mono text-xs uppercase tracking-[0.16em] text-lime">Your impact</div>
          <h2 id="impact-title" className="mb-3 font-display text-[clamp(30px,4vw,46px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
            Every action, stamped.
          </h2>
          <p className="mb-8 max-w-[480px] text-[16px] leading-[1.6] text-muted">
            Your Impact Passport keeps the record: days tracked, swaps completed, and how heavy a typical logged day is.
          </p>

          <TactileCard className={`mb-6 rounded-[24px] p-6 ${s.panel}`} style={{ background: 'linear-gradient(150deg,#123324 0%,#0a1f16 60%,#06130d 100%)' }}>
            <svg aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 opacity-[0.1]" viewBox="0 0 200 200">
              {Array.from({ length: 9 }).map((_, i) => (
                <circle key={i} cx="100" cy="100" r={20 + i * 9} fill="none" stroke="var(--lime)" strokeWidth="0.8" />
              ))}
            </svg>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-lime">Impact Passport</p>
                <p className="mt-1 font-display text-[22px] font-extrabold">{real ? d.name ?? 'You' : 'Yours starts here'}</p>
              </div>
              <span className="rounded-full border border-border px-2.5 py-1 font-mono text-[11px] text-muted">
                {earnedCount}/{MILESTONES.length} stamps
              </span>
            </div>
            <dl className="mt-5 grid grid-cols-3 gap-3">
              <Stat label="Days tracked" value={real ? String(d.daysTracked ?? 0) : '—'} />
              <Stat label="Swaps done" value={real ? String(d.actionsDone ?? 0) : '—'} />
              <Stat label="Avg / logged day" value={real && d.avgPerLoggedDayKg !== null ? `${d.avgPerLoggedDayKg.toFixed(1)} kg` : '—'} />
            </dl>
            <p className="mt-4 text-[11.5px] leading-[1.5] text-muted">
              Figures come from what you log; each entry is an estimate from emission factors. Carbonexo does not claim measured savings. Green Points are in-app rewards — not certified carbon credits.
            </p>
          </TactileCard>
        </div>

        <div className="pointer-events-auto">
          <div className="mb-3 flex items-center justify-between gap-4 md:max-w-[620px]">
            <h3 className="text-[13px] font-bold uppercase tracking-[0.14em] text-muted">Milestones</h3>
            <span className="text-[12px] text-muted">Drag to explore →</span>
          </div>
          <InertialRail label="Passport milestones" className="-mx-5 px-5 sm:-mx-6 sm:px-6">
            {MILESTONES.map((m, i) => {
              const on = real && m.earned(d);
              return (
                <motion.div
                  key={m.id}
                  className="relative w-[210px] shrink-0 select-none"
                  initial={{ opacity: 0, scale: 0.7, rotate: -6 }}
                  whileInView={{ opacity: 1, scale: 1, rotate: 0 }}
                  viewport={{ once: true, amount: 0.6 }}
                  transition={{ type: 'spring', stiffness: 260, damping: 16, delay: i * 0.06 }}
                >
                  {i > 0 && <span aria-hidden className="absolute -left-4 top-[34px] h-px w-4" style={{ background: on ? 'var(--lime)' : 'var(--border)' }} />}
                  <div
                    className="rounded-[20px] border p-4"
                    style={{
                      borderColor: on ? 'var(--lime)' : 'var(--border)',
                      borderStyle: on ? 'solid' : 'dashed',
                      background: on ? 'rgba(79,211,138,0.12)' : 'rgba(6,14,11,0.78)',
                    }}
                  >
                    <div
                      className="mb-3 flex h-[40px] w-[40px] items-center justify-center rounded-full text-[19px]"
                      style={{ background: on ? 'var(--lime)' : 'rgba(255,255,255,0.06)', filter: on ? undefined : 'grayscale(1)', opacity: on ? 1 : 0.7 }}
                      aria-hidden
                    >
                      {m.mark}
                    </div>
                    <div className="text-[14px] font-bold">{m.label}</div>
                    <div className="mt-0.5 text-[12px] leading-[1.45] text-muted">{m.detail}</div>
                    <div className="mt-2.5 font-mono text-[10.5px] uppercase tracking-[0.14em]" style={{ color: on ? 'var(--lime)' : 'var(--muted)' }}>
                      {on ? 'Stamped' : 'Ahead'}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </InertialRail>
        </div>
      </div>
    </section>
  );
});

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold text-muted">{label}</dt>
      <dd className="mt-0.5 font-display text-[22px] font-extrabold leading-tight">{value}</dd>
    </div>
  );
}
