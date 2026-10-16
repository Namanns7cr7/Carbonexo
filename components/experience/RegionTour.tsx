'use client';

/**
 * Scroll-driven tour. The globe is CSS-sticky (native — no pinning library,
 * no wheel capture) and each text step that reaches the middle of the
 * viewport flies the camera to its region. Keyboard and screen-reader users
 * get the same content as ordinary articles; the globe is a companion.
 */

import { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { LivingEarth } from '@/components/planet/LivingEarth';
import { ALL_STOPS, type Region } from '@/lib/experience/regions';
import { useMotionTier } from '@/lib/useMotionTier';
import { revealInView } from '@/lib/motion';
import { subsolarPoint } from '@/lib/experience/sun';
import { angularDistance } from '@/lib/experience/geo';

export function RegionTour({ stops = ALL_STOPS, id = 'tour' }: { stops?: Region[]; id?: string }) {
  const tier = useMotionTier();
  const [active, setActive] = useState(stops[0]);
  const refs = useRef<(HTMLElement | null)[]>([]);
  // Day or night at each stop, right now. Client-only: the server's clock
  // would hydrate-mismatch, so the label appears after mount.
  const [daylight, setDaylight] = useState<Record<string, boolean>>({});
  useEffect(() => {
    const sun = subsolarPoint();
    setDaylight(Object.fromEntries(stops.map((r) => [r.id, angularDistance(sun, r.at) < 90])));
  }, [stops]);

  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = Number((e.target as HTMLElement).dataset.index);
            setActive(stops[i]);
          }
        }
      },
      { rootMargin: '-45% 0px -45% 0px' }
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, [stops]);

  return (
    <section id={id} aria-label="A tour of places that hold the planet’s balance" className="relative" style={{ background: 'var(--void)' }}>
      <div className="mx-auto grid max-w-[1240px] md:grid-cols-[1.15fr_1fr]">
        {/* sticky globe */}
        <div className="sticky top-0 z-0 h-[52svh] md:order-2 md:h-[100svh]">
          <LivingEarth
            className="h-full w-full"
            region={active}
            label={`Globe turned toward ${active.name}.`}
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-24 md:hidden"
            style={{ background: 'linear-gradient(0deg, var(--void), transparent)' }}
          />
        </div>

        {/* steps */}
        <div className="relative z-[1] px-6 pb-[30svh] md:order-1 md:py-[30svh]">
          {stops.map((r, i) => (
            <article
              key={r.id}
              ref={(el) => {
                refs.current[i] = el;
              }}
              data-index={i}
              className="flex min-h-[70svh] items-end pb-[4svh] md:min-h-[80svh] md:items-center md:pb-0"
            >
              <motion.div
                className="max-w-[440px] rounded-[22px] border p-6 backdrop-blur-xl transition-colors duration-md md:p-7"
                style={{
                  background: 'rgba(4,8,12,0.66)',
                  borderColor: active.id === r.id ? 'rgba(184,232,212,0.35)' : 'rgba(255,255,255,0.08)',
                }}
                {...revealInView(tier, { distance: 28, amount: 0.5 })}
              >
                <p className="font-mono text-[11px] uppercase tracking-[0.2em]" style={{ color: 'var(--mint)' }}>
                  {String(i + 1).padStart(2, '0')} · {r.kicker}
                </p>
                <h2 className="mt-3 font-display text-[clamp(28px,4vw,44px)] font-extrabold leading-[1.02] tracking-[-0.03em] text-white">
                  {r.name}
                </h2>
                <p className="mt-4 text-[16px] leading-[1.65] text-white/72">{r.body}</p>
                <p className="mt-4 font-mono text-[11px] text-white/40">
                  {Math.abs(r.at.lat).toFixed(2)}°{r.at.lat >= 0 ? 'N' : 'S'} · {Math.abs(r.at.lon).toFixed(2)}°{r.at.lon >= 0 ? 'E' : 'W'}
                  {r.id in daylight && (
                    <span className="ml-2" style={{ color: daylight[r.id] ? 'var(--sunlight)' : 'rgba(184,232,212,0.7)' }}>
                      · {daylight[r.id] ? '☀ daylight now' : '☾ night now'}
                    </span>
                  )}
                </p>
              </motion.div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
