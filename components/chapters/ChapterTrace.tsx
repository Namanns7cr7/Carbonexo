'use client';

import { motion, useTransform, type MotionValue } from 'framer-motion';
import { Scene } from './Scene';
import { ChapterHeading, Provenance, PANEL, COPY_DIM, COPY_FAINT, mulberry32 } from './shared';
import { useMotionTier } from '@/lib/useMotionTier';
import { revealInView } from '@/lib/motion';
import { EXAMPLE_DAY, totalKg, type Moment } from '@/lib/story';

/* ────────────────────────────────────────────────────────────────────────────
   Chapter 2 — Every Day Leaves a Trace

   One ordinary day, moment by moment. As the reader scrolls through it the
   sunset over the city is swallowed by emission haze — the trace made visible.
   Every figure is factor × quantity from the Track catalog (lib/story.ts).
   ──────────────────────────────────────────────────────────────────────────── */

const rand = mulberry32(20261015);

/** City skyline, generated once so SSR and client markup match. */
const BUILDINGS = (() => {
  const out: { x: number; w: number; h: number; windows: { x: number; y: number }[] }[] = [];
  let x = -10;
  while (x < 1210) {
    const w = Math.round(rand() * 46 + 28);
    const h = Math.round(rand() * 150 + 50);
    const windows: { x: number; y: number }[] = [];
    for (let i = 0; i < Math.floor(h / 26); i++) {
      if (rand() < 0.32) windows.push({ x: x + 6 + Math.round(rand() * (w - 16)), y: 260 - h + 10 + i * 24 });
    }
    out.push({ x, w, h, windows });
    x += w + Math.round(rand() * 8);
  }
  return out;
})();

const DAY_TOTAL = totalKg(EXAMPLE_DAY);
const HEAVIEST = Math.max(...EXAMPLE_DAY.map((m) => m.kg));

export function ChapterTrace() {
  const tier = useMotionTier();
  const moves = tier !== 'still';

  return (
    <Scene id="journey" label="Chapter two — every day leaves a trace" span="crossing">
      {(progress) => <Inner progress={progress} moves={moves} tier={tier} />}
    </Scene>
  );
}

function Inner({
  progress,
  moves,
  tier,
}: {
  progress: MotionValue<number>;
  moves: boolean;
  tier: ReturnType<typeof useMotionTier>;
}) {
  // The haze rises as the day plays out; the sunset fades behind it.
  const smog = useTransform(progress, [0.12, 0.62], [0.12, 1]);
  const sunset = useTransform(progress, [0.12, 0.62], [1, 0.3]);
  const skylineY = useTransform(progress, [0, 1], [40, -20]);

  return (
    <div className="relative">
      {/* ── Dusk sky ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ background: 'linear-gradient(180deg, var(--void) 0%, var(--midnight) 38%, var(--midnight-soft) 74%, #2a2f3a 100%)' }}
      />
      <motion.div
        aria-hidden="true"
        className="absolute inset-x-0 bottom-0 h-[60%]"
        style={{
          background: 'radial-gradient(70% 70% at 62% 100%, var(--sunlight) 0%, var(--sunlight-deep) 26%, rgba(224,154,60,0.18) 52%, transparent 74%)',
          opacity: moves ? sunset : 0.55,
        }}
      />

      {/* ── Skyline ── */}
      <motion.svg
        aria-hidden="true"
        viewBox="0 0 1200 260"
        preserveAspectRatio="none"
        className="absolute inset-x-0 bottom-0 h-[34vh] w-full"
        style={{ y: moves ? skylineY : 0 }}
      >
        {BUILDINGS.map((b, i) => (
          <g key={i}>
            <rect x={b.x} y={260 - b.h} width={b.w} height={b.h} fill="#060b10" />
            {b.windows.map((w, j) => (
              <rect key={j} x={w.x} y={w.y} width="4" height="6" fill="var(--sunlight)" opacity="0.55" />
            ))}
          </g>
        ))}
      </motion.svg>

      {/* ── Emission haze: a body that thickens with scroll, and a drifting band over it ── */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'linear-gradient(0deg, var(--smog) 0%, rgba(120,110,96,0.32) 34%, transparent 70%)',
          opacity: moves ? smog : 0.75,
        }}
      >
        <div
          className="absolute inset-x-0 bottom-[8%] h-[40%] opacity-70"
          style={{
            backgroundImage: [
              'radial-gradient(ellipse 260px 60px at 140px 60%, var(--haze-thick), transparent 70%)',
              'radial-gradient(ellipse 320px 70px at 520px 40%, var(--smog), transparent 72%)',
              'radial-gradient(ellipse 240px 50px at 800px 70%, var(--haze-thick), transparent 70%)',
            ].join(','),
            backgroundSize: '900px 100%',
            backgroundRepeat: 'repeat-x',
            filter: 'blur(6px)',
            animation: moves ? 'hazeDrift 70s linear infinite' : undefined,
          }}
        />
      </motion.div>

      {/* ── Story ── */}
      <div className="relative z-[2] mx-auto grid max-w-[1200px] gap-12 px-6 pb-[38vh] pt-[16vh] md:grid-cols-[1fr_1.05fr] md:gap-16">
        <div className="md:sticky md:top-28 md:self-start">
          <ChapterHeading tier={tier} eyebrow="Chapter two" title="Every day leaves a trace.">
            Nothing here is unusual. A drive, a lunch, a parcel, a cool night&apos;s sleep. Each one is
            small — and each one adds to the air.
          </ChapterHeading>
          <motion.div className="mt-10" {...revealInView(tier, { delay: 0.24, distance: 16 })}>
            <Provenance>
              An illustrative day. Each figure is the Track screen&apos;s own emission factor × the amount shown.
            </Provenance>
          </motion.div>
        </div>

        <ol className="relative space-y-4" aria-label="One example day">
          {/* the day's spine */}
          <span
            aria-hidden="true"
            className="absolute bottom-6 left-[27px] top-6 w-px"
            style={{ background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.18) 12%, rgba(255,255,255,0.18) 88%, transparent)' }}
          />
          {EXAMPLE_DAY.map((m, i) => (
            <MomentCard key={m.time} m={m} index={i} tier={tier} />
          ))}

          <motion.li
            className="relative ml-[64px] mt-8 rounded-[20px] p-6"
            style={{ ...PANEL, borderColor: 'rgba(245,199,104,0.35)', background: 'rgba(120,110,96,0.16)' }}
            {...revealInView(tier, { delay: 0.1 })}
          >
            <div className="font-mono text-[11px] uppercase tracking-[0.18em]" style={{ color: COPY_FAINT }}>
              By midnight
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="font-display text-[clamp(40px,6vw,56px)] font-extrabold leading-none tracking-[-0.03em] text-white">
                {DAY_TOTAL.toFixed(2)}
              </span>
              <span className="text-base font-semibold" style={{ color: COPY_DIM }}>kg CO₂e</span>
            </div>
            <p className="mt-3 text-[15px] leading-[1.6]" style={{ color: COPY_DIM }}>
              Invisible in the moment. Measurable at the end of the day.
            </p>
          </motion.li>
        </ol>
      </div>
    </div>
  );
}

function MomentCard({ m, index, tier }: { m: Moment; index: number; tier: ReturnType<typeof useMotionTier> }) {
  const amount = m.unit === 'item' ? m.option : `${m.qty} ${m.unit} · ${m.option}`;
  return (
    <motion.li className="relative flex gap-4" {...revealInView(tier, { delay: index * 0.04, distance: 26, amount: 0.6 })}>
      <div
        className="relative z-[1] flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-2xl"
        style={{ ...PANEL, background: 'rgba(10,26,51,0.85)' }}
        aria-hidden="true"
      >
        {m.emoji}
      </div>
      <div className="min-w-0 flex-1 rounded-[18px] px-5 py-4" style={PANEL}>
        <div className="flex items-baseline justify-between gap-3">
          <div className="min-w-0">
            <div className="font-mono text-[11px] tracking-[0.12em]" style={{ color: 'var(--mint)' }}>
              {m.time}
            </div>
            <div className="mt-0.5 text-[16px] font-bold text-white">{m.title}</div>
            <div className="mt-0.5 truncate text-[13px]" style={{ color: COPY_FAINT }}>{amount}</div>
          </div>
          <div className="shrink-0 text-right">
            <span className="font-display text-[22px] font-extrabold text-white">{m.kg.toFixed(2)}</span>
            <span className="ml-1 text-xs" style={{ color: COPY_FAINT }}>kg</span>
          </div>
        </div>
        {/* how much haze this moment adds, relative to the heaviest */}
        <div className="mt-3 h-[5px] overflow-hidden rounded-full" style={{ background: 'rgba(255,255,255,0.07)' }}>
          <motion.div
            className="h-full origin-left rounded-full"
            style={{
              width: `${(m.kg / HEAVIEST) * 100}%`,
              background: 'linear-gradient(90deg, var(--sunlight-deep), rgba(168,150,128,0.9))',
            }}
            initial={{ scaleX: 0 }}
            whileInView={{ scaleX: 1 }}
            viewport={{ once: true, amount: 0.8 }}
            transition={revealInView(tier, { delay: 0.2 }).transition}
          />
        </div>
      </div>
    </motion.li>
  );
}
