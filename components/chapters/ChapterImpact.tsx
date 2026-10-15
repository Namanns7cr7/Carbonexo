'use client';

import { motion, useTransform, type MotionValue } from 'framer-motion';
import { Scene } from './Scene';
import { ChapterHeading, Provenance, PANEL, COPY_DIM, COPY_FAINT } from './shared';
import { useMotionTier } from '@/lib/useMotionTier';
import { revealInView, EASE, scaleDuration, DURATION } from '@/lib/motion';
import { EXAMPLE_DAY, breakdown, equivalentKm, factorOf, totalKg } from '@/lib/story';

/* ────────────────────────────────────────────────────────────────────────────
   Chapter 3 — Some Choices Weigh More

   The same day, regrouped by category. The point the chapter makes is one the
   data actually supports: the things you barely notice (the AC, a parcel)
   outweigh the commute you think about. The yardstick converts kilograms into
   km by metro using the catalog factor, so nothing is a made-up comparison.
   ──────────────────────────────────────────────────────────────────────────── */

const SLICES = breakdown(EXAMPLE_DAY);
const TOTAL = totalKg(EXAMPLE_DAY);
const drive = EXAMPLE_DAY.find((m) => m.option === 'Car ride')!;
const ac = EXAMPLE_DAY.find((m) => m.option === 'Air conditioning')!;

const YARDSTICKS = [
  { label: 'The 13 km drive', kg: drive.kg },
  { label: 'One night of AC', kg: ac.kg },
  { label: 'The whole day', kg: TOTAL },
].map((y) => ({ ...y, km: equivalentKm(y.kg) }));

export function ChapterImpact() {
  const tier = useMotionTier();
  return (
    <Scene id="impact" label="Chapter three — some choices weigh more than others" span="crossing">
      {(progress) => <Inner progress={progress} tier={tier} />}
    </Scene>
  );
}

function Inner({ progress, tier }: { progress: MotionValue<number>; tier: ReturnType<typeof useMotionTier> }) {
  const moves = tier !== 'still';
  // The planet's hazy limb rises into view from below as the chapter plays.
  const limbY = useTransform(progress, [0, 1], [120, -40]);

  return (
    <div className="relative">
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'linear-gradient(180deg, #2a2f3a 0%, var(--void) 22%, var(--void) 100%)' }} />
      {/* centring on a plain wrapper — Framer's inline transform would discard -translate-x-1/2 */}
      <div aria-hidden="true" className="absolute left-1/2 top-[78%] w-[180vw] max-w-[2200px] -translate-x-1/2">
        <motion.div
          className="aspect-square w-full rounded-full"
          style={{
            y: moves ? limbY : 0,
            background: 'radial-gradient(circle at 50% 0%, #1b3b4a 0%, #0b1a22 30%, var(--void) 60%)',
            boxShadow: '0 -30px 90px -10px var(--smog), 0 -6px 30px -6px rgba(245,199,104,0.25)',
          }}
        />
      </div>

      <div className="relative z-[2] mx-auto max-w-[1100px] px-6 pb-[24vh] pt-[18vh]">
        <ChapterHeading tier={tier} eyebrow="Chapter three" title="Some choices weigh more than others." align="center">
          Grouped, the same day tells a different story. The commute you think about isn&apos;t the
          heaviest thing in it — the AC you slept through and a parcel you barely noticed are.
        </ChapterHeading>

        {/* ── The day as one bar ── */}
        <motion.figure className="mt-16 rounded-[24px] p-6 sm:p-8" style={PANEL} {...revealInView(tier, { delay: 0.1 })}>
          <figcaption className="mb-5 flex items-baseline justify-between gap-4">
            <span className="text-[15px] font-bold text-white">Where the day&apos;s {TOTAL.toFixed(2)} kg went</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em]" style={{ color: COPY_FAINT }}>by category</span>
          </figcaption>

          <div
            className="flex h-12 w-full overflow-hidden rounded-[14px]"
            role="img"
            aria-label={SLICES.map((s) => `${s.label} ${Math.round(s.share * 100)}%`).join(', ')}
          >
            {SLICES.map((s, i) => (
              <motion.div
                key={s.category}
                className="h-full origin-left"
                style={{ width: `${s.share * 100}%`, background: s.color, boxShadow: 'inset -2px 0 0 rgba(4,8,12,0.55)' }}
                initial={{ scaleX: 0, opacity: 0.4 }}
                whileInView={{ scaleX: 1, opacity: 1 }}
                viewport={{ once: true, amount: 0.6 }}
                transition={{
                  duration: scaleDuration(DURATION.xl, tier),
                  delay: tier === 'still' ? 0 : 0.15 + i * 0.12,
                  ease: EASE.entrance,
                }}
              />
            ))}
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {SLICES.map((s) => (
              <li key={s.category} className="flex items-center gap-2.5 whitespace-nowrap">
                <span aria-hidden="true" className="h-3 w-3 shrink-0 rounded-[4px]" style={{ background: s.color }} />
                <span className="text-[14px] font-semibold text-white">{s.label}</span>
                <span className="font-mono text-[13px]" style={{ color: COPY_DIM }}>
                  {s.kg.toFixed(2)} kg · {Math.round(s.share * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </motion.figure>

        {/* ── Yardstick ── */}
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {YARDSTICKS.map((y, i) => (
            <motion.div
              key={y.label}
              className="rounded-[20px] p-6"
              style={PANEL}
              {...revealInView(tier, { delay: 0.08 * i, distance: 22 })}
            >
              <div className="text-[14px] font-semibold" style={{ color: COPY_DIM }}>{y.label}</div>
              <div className="mt-1 font-mono text-[12px]" style={{ color: COPY_FAINT }}>{y.kg.toFixed(2)} kg CO₂e</div>
              <div className="mt-5 flex items-baseline gap-2">
                <span className="text-[13px]" style={{ color: COPY_FAINT }}>=</span>
                <span className="font-display text-[clamp(34px,4.4vw,46px)] font-extrabold leading-none tracking-[-0.03em] text-white">
                  {y.km}
                </span>
                <span className="text-[14px] font-semibold" style={{ color: 'var(--mint)' }}>km by metro</span>
              </div>
            </motion.div>
          ))}
        </div>

        <Provenance className="mt-6 text-center">
          Yardstick: kg ÷ the catalog&apos;s metro factor ({factorOf('travel', 'Metro / Train')} kg CO₂e per km).
        </Provenance>
      </div>
    </div>
  );
}
