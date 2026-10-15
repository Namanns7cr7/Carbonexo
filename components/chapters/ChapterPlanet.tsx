'use client';

import Link from 'next/link';
import {
  motion,
  useMotionTemplate,
  useMotionValue,
  useSpring,
  useTransform,
  type MotionValue,
} from 'framer-motion';
import { Scene } from './Scene';
import { mulberry32 } from './shared';
import { useMotionTier } from '@/lib/useMotionTier';
import { fadeUp, sceneEnter, DURATION, EASE } from '@/lib/motion';

/* ────────────────────────────────────────────────────────────────────────────
   Deterministic decoration

   Star and mote positions are generated once at module scope from a fixed
   seed, so the server and the client produce byte-identical markup. Math.random
   here would hydrate-mismatch on every load.
   ──────────────────────────────────────────────────────────────────────────── */

const rand = mulberry32(20261014);

const STARS = Array.from({ length: 110 }, () => ({
  top: +(rand() * 100).toFixed(3),
  left: +(rand() * 100).toFixed(3),
  size: +(rand() * 1.8 + 0.6).toFixed(2),
  delay: +(rand() * 6).toFixed(2),
  duration: +(rand() * 3 + 2.6).toFixed(2),
  opacity: +(rand() * 0.45 + 0.28).toFixed(2),
}));

const MOTES = Array.from({ length: 14 }, () => ({
  left: +(rand() * 100).toFixed(3),
  bottom: +(rand() * 40).toFixed(3),
  size: +(rand() * 3 + 1.6).toFixed(2),
  delay: +(rand() * 14).toFixed(2),
  duration: +(rand() * 9 + 13).toFixed(2),
}));

/* ────────────────────────────────────────────────────────────────────────────
   Chapter 1 — The Planet Is Alive
   ──────────────────────────────────────────────────────────────────────────── */

export function ChapterPlanet() {
  const tier = useMotionTier();
  const moves = tier !== 'still';

  // Pointer position, normalised to -1..1. Written straight to motion values so
  // pointer movement never triggers a React render — the perf requirement is
  // that nothing re-renders per frame.
  const px = useMotionValue(0);
  const py = useMotionValue(0);

  const sx = useSpring(px, { stiffness: 60, damping: 18, mass: 1.2 });
  const sy = useSpring(py, { stiffness: 60, damping: 18, mass: 1.2 });

  // Viewing perspective. Small angles on purpose: this is a camera settling,
  // not an object being thrown around.
  const rotateY = useTransform(sx, [-1, 1], [7, -7]);
  const rotateX = useTransform(sy, [-1, 1], [-5, 5]);

  // Light reacts to movement — the lit limb tracks the pointer across the
  // sphere, so the terminator appears to shift as the camera moves.
  const lightX = useTransform(sx, [-1, 1], [20, 48]);
  const lightY = useTransform(sy, [-1, 1], [18, 44]);
  const litLimb = useMotionTemplate`radial-gradient(circle at ${lightX}% ${lightY}%, rgba(255,255,255,0.32), rgba(255,255,255,0.07) 40%, transparent 58%)`;

  // Text planes drift against the planet for depth.
  const textX = useTransform(sx, [-1, 1], [14, -14]);
  const textY = useTransform(sy, [-1, 1], [8, -8]);

  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!moves) return;
    const r = e.currentTarget.getBoundingClientRect();
    px.set(Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (r.width / 2))));
    py.set(Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (r.height / 2))));
  };

  const onPointerLeave = () => {
    px.set(0);
    py.set(0);
  };

  return (
    <Scene id="chapter-planet" label="Chapter one — the planet is alive">
      {(progress) => (
        <Inner
          progress={progress}
          moves={moves}
          tier={tier}
          rotateX={rotateX}
          rotateY={rotateY}
          litLimb={litLimb}
          textX={textX}
          textY={textY}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
        />
      )}
    </Scene>
  );
}

function Inner({
  progress,
  moves,
  tier,
  rotateX,
  rotateY,
  litLimb,
  textX,
  textY,
  onPointerMove,
  onPointerLeave,
}: {
  progress: MotionValue<number>;
  moves: boolean;
  tier: ReturnType<typeof useMotionTier>;
  rotateX: MotionValue<number>;
  rotateY: MotionValue<number>;
  litLimb: MotionValue<string>;
  textX: MotionValue<number>;
  textY: MotionValue<number>;
  onPointerMove: (e: React.PointerEvent<HTMLElement>) => void;
  onPointerLeave: () => void;
}) {
  // The camera dolly: scrolling moves toward the planet. Reading native scroll
  // progress only — the page is never pinned and scroll is never captured.
  const planetScale = useTransform(progress, [0, 1], [1, 1.75]);
  const planetY = useTransform(progress, [0, 1], [0, 90]);
  const planetOpacity = useTransform(progress, [0, 0.85], [1, 0.25]);
  const copyY = useTransform(progress, [0, 1], [0, -70]);
  const copyOpacity = useTransform(progress, [0, 0.55], [1, 0]);
  const cueOpacity = useTransform(progress, [0, 0.18], [1, 0]);
  const starDrift = useTransform(progress, [0, 1], [0, -40]);

  return (
    <div
      className="absolute inset-0"
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      {/* ── Space ground. Flat tokens, identical in both themes: a night sky
             does not invert with the chrome around it. ── */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 112%, var(--midnight-soft) 0%, var(--midnight) 34%, var(--void) 78%)',
        }}
      />

      {/* ── Starfield ── */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0"
        style={{ y: moves ? starDrift : 0 }}
      >
        {STARS.map((s, i) => (
          <span
            key={i}
            className="absolute rounded-full bg-white"
            style={{
              top: `${s.top}%`,
              left: `${s.left}%`,
              width: `${s.size}px`,
              height: `${s.size}px`,
              opacity: s.opacity,
              animation: moves
                ? `twinkle ${s.duration}s ease-in-out ${s.delay}s infinite`
                : undefined,
            }}
          />
        ))}
      </motion.div>

      {/* ── Drifting motes ── */}
      {moves && (
        <div aria-hidden="true" className="absolute inset-0 overflow-hidden">
          {MOTES.map((m, i) => (
            <span
              key={i}
              className="absolute rounded-full"
              style={{
                left: `${m.left}%`,
                bottom: `${m.bottom}%`,
                width: `${m.size}px`,
                height: `${m.size}px`,
                background: 'var(--mint)',
                filter: 'blur(0.5px)',
                animation: `moteRise ${m.duration}s linear ${m.delay}s infinite`,
              }}
            />
          ))}
        </div>
      )}

      {/* ── The planet ── */}
      {/* Centring lives on a plain wrapper: Framer Motion writes an inline
          transform for scale/y, which would discard Tailwind's translate. */}
      <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[52%] -translate-x-1/2 -translate-y-1/2">
        <motion.div
          style={{
            scale: moves ? planetScale : 1,
            y: moves ? planetY : 0,
            opacity: moves ? planetOpacity : 1,
            perspective: 1200,
          }}
          {...sceneEnter(tier, { delay: 0.1 })}
        >
          <motion.div
            className="relative"
            style={{
              width: 'clamp(280px, 44vw, 580px)',
              aspectRatio: '1',
              rotateX: moves ? rotateX : 0,
              rotateY: moves ? rotateY : 0,
              transformStyle: 'preserve-3d',
            }}
          >
            {/* atmospheric halo */}
            <div
              className="absolute -inset-[14%] rounded-full"
              style={{
                background:
                  'radial-gradient(circle, transparent 58%, var(--light-cool) 70%, transparent 80%)',
                filter: 'blur(18px)',
                animation: moves ? 'haloPulse 11s ease-in-out infinite' : undefined,
              }}
            />

            {/* sphere */}
            <div
              className="absolute inset-0 overflow-hidden rounded-full"
              style={{
                background:
                  'radial-gradient(circle at 34% 30%, #4aa6c6 0%, var(--water) 44%, #0d3146 84%)',
                boxShadow:
                  'inset 0 0 48px 12px rgba(2,6,10,0.52), 0 0 90px 8px var(--light-cool)',
              }}
            >
              {/* landmasses — slide one tile width for a seamless rotation */}
              <div
                className="absolute inset-0"
                style={{
                  backgroundImage: [
                    'radial-gradient(ellipse 70px 92px at 62px 38%, var(--canopy-lit) 0 38%, var(--canopy) 60%, transparent 74%)',
                    'radial-gradient(ellipse 54px 64px at 152px 70%, var(--canopy) 0 46%, transparent 70%)',
                    'radial-gradient(ellipse 98px 74px at 268px 29%, var(--canopy-lit) 0 32%, var(--canopy) 58%, transparent 76%)',
                    'radial-gradient(ellipse 60px 104px at 352px 66%, var(--canopy-deep) 0 42%, transparent 72%)',
                    'radial-gradient(ellipse 46px 52px at 442px 43%, var(--canopy) 0 48%, transparent 74%)',
                  ].join(','),
                  backgroundSize: '500px 100%',
                  backgroundRepeat: 'repeat-x',
                  animation: moves ? 'planetSpin 90s linear infinite' : undefined,
                }}
              />

              {/* cloud deck — faster than the land, so the two parallax */}
              <div
                className="absolute inset-0 opacity-[0.42] mix-blend-screen"
                style={{
                  backgroundImage: [
                    'radial-gradient(ellipse 120px 34px at 80px 30%, rgba(255,255,255,0.58), transparent 70%)',
                    'radial-gradient(ellipse 92px 26px at 252px 57%, rgba(255,255,255,0.44), transparent 72%)',
                    'radial-gradient(ellipse 140px 30px at 432px 40%, rgba(255,255,255,0.5), transparent 70%)',
                    'radial-gradient(ellipse 72px 22px at 602px 69%, rgba(255,255,255,0.38), transparent 74%)',
                  ].join(','),
                  backgroundSize: '700px 100%',
                  backgroundRepeat: 'repeat-x',
                  animation: moves ? 'cloudSpin 58s linear infinite' : undefined,
                }}
              />

              {/* lit limb — follows the pointer */}
              <motion.div
                className="absolute inset-0"
                style={{ background: moves ? litLimb : undefined }}
              />

              {/* terminator */}
              <div
                className="absolute inset-0"
                style={{
                  background:
                    'radial-gradient(circle at 74% 77%, rgba(2,6,10,0.88) 0%, rgba(2,6,10,0.3) 46%, transparent 66%)',
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      </div>

      {/* ── Copy. Sits above the planet, drifts against it for depth. ── */}
      <motion.div
        className="relative z-[2] mx-auto flex min-h-[100svh] max-w-[1200px] flex-col justify-end px-6 pb-[18vh] pt-28"
        style={{ y: moves ? copyY : 0, opacity: moves ? copyOpacity : 1 }}
      >
        <motion.div style={{ x: moves ? textX : 0, y: moves ? textY : 0 }}>
          <motion.p
            className="mb-5 font-mono text-[11px] font-medium uppercase tracking-[0.22em]"
            style={{ color: 'var(--mint)' }}
            {...fadeUp(tier, { delay: 0.15, distance: 16 })}
          >
            Chapter one
          </motion.p>

          <motion.h1
            className="max-w-[17ch] font-display text-[clamp(38px,7.4vw,86px)] font-extrabold leading-[0.98] tracking-[-0.035em] text-white"
            style={{ textWrap: 'balance' }}
            {...fadeUp(tier, { delay: 0.25, distance: 34 })}
          >
            Your choices shape a living world.
          </motion.h1>

          <motion.p
            className="mt-7 max-w-[48ch] text-[clamp(16px,2vw,19px)] leading-[1.6]"
            style={{ color: 'rgba(232,242,236,0.76)' }}
            {...fadeUp(tier, { delay: 0.38, distance: 24 })}
          >
            Carbonexo turns the things you already do — how you travel, eat, power your home —
            into a footprint you can actually see, and a world that responds when you change it.
          </motion.p>

          <motion.div
            className="mt-10 flex flex-wrap items-center gap-4"
            {...fadeUp(tier, { delay: 0.5, distance: 20 })}
          >
            <Link
              href="/onboarding"
              className="rounded-[14px] px-7 py-4 text-base font-bold text-[#06231a] transition-transform duration-sm ease-out hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint"
              style={{ background: 'var(--lime)', boxShadow: '0 14px 34px -12px var(--lime)' }}
            >
              Begin Your Journey →
            </Link>
            <a
              href="#journey"
              className="rounded-[14px] border px-[26px] py-4 text-base font-semibold text-white/90 transition-colors duration-sm hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-mint"
              style={{ borderColor: 'rgba(255,255,255,0.22)', background: 'rgba(255,255,255,0.05)' }}
            >
              See how it works
            </a>
          </motion.div>
        </motion.div>
      </motion.div>

      {/* ── Scroll cue. Decorative: the link above is the real affordance. ── */}
      <motion.div
        aria-hidden="true"
        className="absolute bottom-7 left-1/2 z-[2] -translate-x-1/2"
        style={{ opacity: moves ? cueOpacity : 1 }}
      >
        <motion.div
          className="h-9 w-[22px] rounded-full border"
          style={{ borderColor: 'rgba(255,255,255,0.3)' }}
          animate={moves ? { opacity: [0.45, 1, 0.45] } : undefined}
          transition={{ duration: DURATION.scene * 1.4, ease: EASE.inOut, repeat: Infinity }}
        >
          <span
            className="mx-auto mt-[7px] block h-[6px] w-[2px] rounded-full"
            style={{ background: 'var(--mint)' }}
          />
        </motion.div>
      </motion.div>
    </div>
  );
}
