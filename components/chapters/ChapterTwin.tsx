'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { motion } from 'framer-motion';
import { Scene } from './Scene';
import { ChapterHeading, MiniPlanet, Provenance, PANEL, COPY_DIM, COPY_FAINT } from './shared';
import { useMotionTier } from '@/lib/useMotionTier';
import { revealInView } from '@/lib/motion';
import {
  simulateTwin,
  TWIN_COMMUTES,
  TWIN_LUNCHES,
  TWIN_COMMUTE_KM,
  TWIN_COOLING_MAX_KWH,
  type TwinChoice,
} from '@/lib/story';
import { TRACK_OPTIONS } from '@/lib/carbon';

/* ────────────────────────────────────────────────────────────────────────────
   Chapter 4 — Meet Your Carbon Twin

   A three-control preview of the simulator at /app/simulate. It starts on the
   example day from Chapter 2, so the first thing a reader sees is a familiar
   number — then the world clears or clouds as they change it.

   Changing a control re-renders once; nothing here runs per frame. The haze
   fade is a CSS transition, which the global reduced-motion block flattens.
   ──────────────────────────────────────────────────────────────────────────── */

const START: TwinChoice = { commute: 'Car ride', lunch: 'Chicken meal', coolingKwh: 6 };
const BASELINE = simulateTwin(START).kg;

const emoji = (cat: 'travel' | 'food', label: string) => TRACK_OPTIONS[cat].find((o) => o.label === label)?.emoji ?? '';
const short = (label: string) => label.replace(' meal', '').replace(' ride', '').replace(' / Train', '');

export function ChapterTwin() {
  const tier = useMotionTier();
  const [choice, setChoice] = useState<TwinChoice>(START);
  const result = simulateTwin(choice);
  const delta = Math.round((result.kg - BASELINE) * 10) / 10;

  return (
    <Scene id="twin" label="Chapter four — meet your carbon twin">
      {() => (
        <div className="relative">
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: 'radial-gradient(90% 70% at 28% 50%, var(--midnight-soft) 0%, var(--midnight) 40%, var(--void) 100%)' }}
          />

          <div className="relative z-[2] mx-auto grid max-w-[1200px] items-center gap-14 px-6 py-[16vh] lg:grid-cols-[1fr_1fr]">
            {/* ── The twin's world ── */}
            <motion.div className="order-2 flex flex-col items-center lg:order-1" {...revealInView(tier, { distance: 40 })}>
              <MiniPlanet
                size="clamp(220px, 34vw, 420px)"
                haze={result.load}
                bloom={1 - result.load}
                spinning={tier !== 'still'}
              />
              <div className="mt-10 text-center" aria-live="polite">
                <div className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: COPY_FAINT }}>
                  Your twin&apos;s day
                </div>
                <div className="mt-2 flex items-baseline justify-center gap-2">
                  <span className="font-display text-[clamp(48px,7vw,72px)] font-extrabold leading-none tracking-[-0.035em] text-white tabular-nums">
                    {result.kg.toFixed(1)}
                  </span>
                  <span className="text-base font-semibold" style={{ color: COPY_DIM }}>kg CO₂e</span>
                </div>
                <div
                  className="mt-3 inline-block rounded-full px-3 py-1 text-[13px] font-bold"
                  style={
                    delta < 0
                      ? { background: 'rgba(184,232,212,0.14)', color: 'var(--mint)' }
                      : delta > 0
                        ? { background: 'rgba(224,154,60,0.16)', color: 'var(--sunlight)' }
                        : { background: 'rgba(255,255,255,0.06)', color: COPY_DIM }
                  }
                >
                  {delta === 0
                    ? 'Chapter two’s drive, lunch and AC'
                    : `${delta > 0 ? '+' : '−'}${Math.abs(delta).toFixed(1)} kg vs Chapter two’s choices`}
                </div>
              </div>
            </motion.div>

            {/* ── Controls ── */}
            <div className="order-1 lg:order-2">
              <ChapterHeading tier={tier} eyebrow="Chapter four" title="Meet your carbon twin.">
                Your twin lives the day you describe. Change how it travels, eats and sleeps, and watch
                its world clear — before you change a thing in your own.
              </ChapterHeading>

              <motion.div className="mt-10 space-y-6 rounded-[24px] p-6 sm:p-7" style={PANEL} {...revealInView(tier, { delay: 0.2 })}>
                <Choice
                  legend={`Commute · ${TWIN_COMMUTE_KM} km`}
                  options={TWIN_COMMUTES.map((c) => ({ value: c, label: short(c), emoji: emoji('travel', c) }))}
                  value={choice.commute}
                  onChange={(v) => setChoice((c) => ({ ...c, commute: v as TwinChoice['commute'] }))}
                  partKg={result.parts.commute}
                />
                <Choice
                  legend="Lunch"
                  options={TWIN_LUNCHES.map((l) => ({ value: l, label: short(l), emoji: emoji('food', l) }))}
                  value={choice.lunch}
                  onChange={(v) => setChoice((c) => ({ ...c, lunch: v as TwinChoice['lunch'] }))}
                  partKg={result.parts.lunch}
                />
                <Cooling
                  value={choice.coolingKwh}
                  onChange={(v) => setChoice((c) => ({ ...c, coolingKwh: v }))}
                  partKg={result.parts.cooling}
                />
              </motion.div>

              <motion.div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-4" {...revealInView(tier, { delay: 0.28, distance: 16 })}>
                <Link
                  href="/app/simulate"
                  className="rounded-[14px] px-6 py-3.5 text-[15px] font-bold text-[#06231a] transition-transform duration-sm ease-out hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint"
                  style={{ background: 'var(--mint)' }}
                >
                  Open the full simulator →
                </Link>
                <Provenance>Same factors as the Track screen. The full twin models your own profile.</Provenance>
              </motion.div>
            </div>
          </div>
        </div>
      )}
    </Scene>
  );
}

function Choice({
  legend,
  options,
  value,
  onChange,
  partKg,
}: {
  legend: string;
  options: { value: string; label: string; emoji: string }[];
  value: string;
  onChange: (v: string) => void;
  partKg: number;
}) {
  const name = useId();
  return (
    <fieldset>
      <div className="mb-3 flex items-baseline justify-between">
        <legend className="text-[14px] font-bold text-white">{legend}</legend>
        <span className="font-mono text-[12px] tabular-nums" style={{ color: COPY_DIM }}>{partKg.toFixed(1)} kg</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {options.map((o) => {
          const on = o.value === value;
          return (
            <label
              key={o.value}
              className="relative flex min-h-[48px] cursor-pointer items-center justify-center gap-2 rounded-[12px] border px-3 py-2.5 text-[14px] font-semibold transition-colors duration-sm has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-mint"
              style={
                on
                  ? { borderColor: 'var(--mint)', background: 'rgba(184,232,212,0.14)', color: '#fff' }
                  : { borderColor: 'rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.03)', color: COPY_DIM }
              }
            >
              <input
                type="radio"
                name={name}
                value={o.value}
                checked={on}
                onChange={() => onChange(o.value)}
                className="sr-only"
              />
              <span aria-hidden="true">{o.emoji}</span>
              {o.label}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function Cooling({ value, onChange, partKg }: { value: number; onChange: (v: number) => void; partKg: number }) {
  const id = useId();
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between">
        <label htmlFor={id} className="text-[14px] font-bold text-white">
          AC overnight · <span className="tabular-nums">{value}</span> kWh
        </label>
        <span className="font-mono text-[12px] tabular-nums" style={{ color: COPY_DIM }}>{partKg.toFixed(1)} kg</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={TWIN_COOLING_MAX_KWH}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-2 w-full cursor-pointer accent-[var(--mint)]"
        aria-valuetext={`${value} kilowatt hours`}
      />
      <div className="mt-1.5 flex justify-between font-mono text-[11px]" style={{ color: COPY_FAINT }}>
        <span>off</span>
        <span>all night</span>
      </div>
    </div>
  );
}
