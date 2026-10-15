'use client';

/**
 * Explore real data on the globe. Fine pointers can drag and zoom straight
 * away; on touch, the globe is passive until "Explore" is switched on, so a
 * thumb passing over it scrolls the page instead of spinning the planet.
 */

import { useEffect, useState } from 'react';
import { LivingEarth } from '@/components/planet/LivingEarth';
import { Co2Panel } from '@/components/planet/Co2Panel';
import { COUNTRY_CO2 } from '@/lib/experience/co2';

export function PlanetData({ id = 'explore' }: { id?: string }) {
  const [selected, setSelected] = useState<string | null>(null);
  const [coarse, setCoarse] = useState(false);
  const [exploring, setExploring] = useState(false);

  useEffect(() => {
    const c = window.matchMedia('(pointer: coarse)').matches;
    setCoarse(c);
    setExploring(!c);
  }, []);

  const country = COUNTRY_CO2.find((c) => c.iso === selected);

  return (
    <section id={id} aria-labelledby={`${id}-title`} className="relative overflow-hidden px-6 py-[14vh]" style={{ background: 'radial-gradient(90% 60% at 70% 40%, #0a1a33 0%, var(--void) 70%)' }}>
      <div className="mx-auto max-w-[1240px]">
        <div className="max-w-[640px]">
          <p className="font-mono text-[11px] uppercase tracking-[0.22em]" style={{ color: 'var(--mint)' }}>
            Real data
          </p>
          <h2 id={`${id}-title`} className="mt-3 font-display text-[clamp(30px,4.6vw,54px)] font-extrabold leading-[1.02] tracking-[-0.032em] text-white">
            The same sky, very different footprints.
          </h2>
          <p className="mt-5 text-[16.5px] leading-[1.65] text-white/70">
            Average CO₂ per person varies more than fiftyfold between countries. Select one to fly there — or drag the
            planet to look around.
          </p>
        </div>

        <div className="mt-10 grid items-center gap-8 lg:grid-cols-[1.4fr_1fr]">
          <div className="relative aspect-square w-full max-w-[720px] justify-self-center">
            <LivingEarth
              className="h-full w-full"
              showCo2
              interactive={exploring}
              selectedIso={selected}
              onSelectCountry={setSelected}
              label={country ? `Globe focused on ${country.country}, showing CO₂ per person markers.` : 'Globe with CO₂ per person markers on 24 countries.'}
              credit
            />
            {coarse && (
              <button
                type="button"
                onClick={() => setExploring((v) => !v)}
                aria-pressed={exploring}
                className="absolute left-1/2 top-3 -translate-x-1/2 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-[13px] font-bold text-white backdrop-blur focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint)]"
              >
                {exploring ? 'Done exploring' : 'Explore the globe'}
              </button>
            )}
          </div>
          <Co2Panel selectedIso={selected} onSelect={setSelected} />
        </div>
      </div>
    </section>
  );
}
