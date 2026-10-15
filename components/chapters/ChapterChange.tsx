'use client';

import Link from 'next/link';
import { motion, useTransform, type MotionValue } from 'framer-motion';
import { Scene } from './Scene';
import { ChapterHeading, Provenance, PANEL, COPY_DIM, COPY_FAINT, mulberry32 } from './shared';
import { useMotionTier } from '@/lib/useMotionTier';
import { revealInView } from '@/lib/motion';
import { DIFFICULTY_COLOR } from '@/lib/carbon';
import { EXAMPLE_DAY, STORY_SWAPS, cumulativeSavings, totalKg, yearly } from '@/lib/story';

/* ────────────────────────────────────────────────────────────────────────────
   Chapter 5 — Change Compounds

   Five swaps from the Action Plan catalog, each with its catalog estimate of
   weekly savings. As the reader scrolls through them the night gives way to
   canopy and a treeline grows along the horizon — the opposite of Chapter 2's
   haze. Running totals are summed from the catalog, not typed in.
   ──────────────────────────────────────────────────────────────────────────── */

const RUNNING = cumulativeSavings(STORY_SWAPS);
const WEEKLY = RUNNING[RUNNING.length - 1];
const EXAMPLE_WEEK = totalKg(EXAMPLE_DAY) * 7;
const SHARE_OF_WEEK = Math.round((WEEKLY / EXAMPLE_WEEK) * 100);

const rand = mulberry32(20261016);
const TREES = Array.from({ length: 26 }, (_, i) => ({
  x: (i / 25) * 1200 + (rand() - 0.5) * 30,
  h: Math.round(rand() * 70 + 60),
  r: Math.round(rand() * 14 + 18),
  tone: rand() < 0.5 ? 'var(--canopy-lit)' : 'var(--canopy)',
  // order of growth — scattered, so the treeline fills in rather than wiping across
  at: rand(),
}));

export function ChapterChange() {
  const tier = useMotionTier();
  return (
    <Scene id="swap" label="Chapter five — small changes compound" span="crossing">
      {(progress) => <Inner progress={progress} tier={tier} />}
    </Scene>
  );
}

function Inner({ progress, tier }: { progress: MotionValue<number>; tier: ReturnType<typeof useMotionTier> }) {
  const moves = tier !== 'still';
  const dawn = useTransform(progress, [0.15, 0.7], [0, 1]);

  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(180deg, var(--void) 0%, var(--midnight) 55%, var(--canopy-deep) 100%)' }} />
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(90% 60% at 50% 100%, var(--canopy-lit) 0%, var(--canopy) 38%, transparent 75%)',
          opacity: moves ? dawn : 0.8,
        }}
      />

      {/* ── Treeline ── */}
      <svg aria-hidden="true" viewBox="0 0 1200 200" preserveAspectRatio="xMidYMax slice" className="absolute inset-x-0 bottom-0 h-[26vh] w-full">
        {TREES.map((t, i) => (
          <Tree key={i} t={t} progress={progress} moves={moves} />
        ))}
        <rect x="0" y="194" width="1200" height="6" fill="var(--canopy-deep)" />
      </svg>

      <div className="relative z-[2] mx-auto max-w-[1100px] px-6 pb-[34vh] pt-[18vh]">
        <ChapterHeading tier={tier} eyebrow="Chapter five" title="Change compounds.">
          You don&apos;t need to overhaul your life. Five ordinary swaps, kept up week after week, add up
          to something the world can feel.
        </ChapterHeading>

        <ol className="mt-14 grid gap-4 md:grid-cols-2">
          {STORY_SWAPS.map((s, i) => (
            <motion.li
              key={s.id}
              className={`flex gap-4 rounded-[20px] p-5 ${i === STORY_SWAPS.length - 1 ? 'md:col-span-2' : ''}`}
              style={PANEL}
              {...revealInView(tier, { delay: (i % 2) * 0.08, distance: 26, amount: 0.5 })}
            >
              <div
                aria-hidden="true"
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] text-2xl"
                style={{ background: 'rgba(184,232,212,0.1)' }}
              >
                {s.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[16px] font-bold text-white">{s.title}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold"
                    style={{ color: DIFFICULTY_COLOR[s.difficulty], background: 'rgba(255,255,255,0.06)' }}
                  >
                    {s.difficulty}
                  </span>
                </div>
                <p className="mt-1 text-[14px] leading-[1.5]" style={{ color: COPY_DIM }}>{s.desc}</p>
                <div className="mt-3 flex items-baseline justify-between gap-3 border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                  <span className="text-[14px] font-bold" style={{ color: 'var(--mint)' }}>−{s.saving.toFixed(1)} kg / week</span>
                  <span className="font-mono text-[12px] tabular-nums" style={{ color: COPY_FAINT }}>
                    running: {RUNNING[i].toFixed(1)} kg
                  </span>
                </div>
              </div>
            </motion.li>
          ))}
        </ol>

        {/* ── Progress: the sum, then the habit ── */}
        <motion.div
          id="progress"
          className="mt-8 scroll-mt-24 grid gap-6 rounded-[24px] p-7 sm:p-9 md:grid-cols-[1.2fr_1fr] md:items-center"
          style={{ ...PANEL, background: 'rgba(28,107,71,0.22)', borderColor: 'rgba(184,232,212,0.28)' }}
          {...revealInView(tier, { delay: 0.1 })}
        >
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: COPY_FAINT }}>All five, together</div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-5 gap-y-2">
              <span className="font-display text-[clamp(44px,6.4vw,64px)] font-extrabold leading-none tracking-[-0.035em] text-white">
                ≈ {WEEKLY.toFixed(1)}
              </span>
              <span className="text-[16px] font-semibold" style={{ color: COPY_DIM }}>kg CO₂e saved a week</span>
            </div>
            <p className="mt-4 text-[15px] leading-[1.6]" style={{ color: COPY_DIM }}>
              That&apos;s about <strong className="text-white">{yearly(WEEKLY).toLocaleString('en-US')} kg a year</strong> — roughly{' '}
              <strong className="text-white">{SHARE_OF_WEEK}%</strong> of the example day, lived seven times over.
            </p>
          </div>
          <div className="md:border-l md:pl-8" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
            <p className="text-[15px] leading-[1.65]" style={{ color: COPY_DIM }}>
              In the app, every swap you actually log moves your streak, your weekly trend and your Carbon
              Credit Score — measured from your days, not from estimates.
            </p>
            <Link
              href="/app/actions"
              className="mt-4 inline-block text-[15px] font-bold underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint"
              style={{ color: 'var(--mint)' }}
            >
              See the full Action Plan →
            </Link>
          </div>
        </motion.div>

        <Provenance className="mt-5">
          Savings are the Action Plan catalog&apos;s weekly estimates. Your own figures come from what you log.
        </Provenance>
      </div>
    </div>
  );
}

function Tree({
  t,
  progress,
  moves,
}: {
  t: (typeof TREES)[number];
  progress: MotionValue<number>;
  moves: boolean;
}) {
  const start = 0.15 + t.at * 0.4;
  const grow = useTransform(progress, [start, start + 0.18], [0.08, 1], { clamp: true });
  const base = 194;
  return (
    <motion.g style={{ scale: moves ? grow : 1, originX: 0.5, originY: 1 }}>
      <rect x={t.x - 2.5} y={base - t.h * 0.45} width="5" height={t.h * 0.45} fill="#0a1f16" />
      <circle cx={t.x} cy={base - t.h * 0.62} r={t.r} fill={t.tone} />
      <circle cx={t.x - t.r * 0.55} cy={base - t.h * 0.48} r={t.r * 0.7} fill="var(--canopy)" />
      <circle cx={t.x + t.r * 0.6} cy={base - t.h * 0.5} r={t.r * 0.62} fill="var(--canopy-lit)" opacity="0.85" />
    </motion.g>
  );
}
