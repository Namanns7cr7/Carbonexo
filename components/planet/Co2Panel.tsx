'use client';

/**
 * The CO₂ overlay as text: a sortable, keyboard-operable list that mirrors
 * the globe's markers. Selecting a country here flies the globe to it, and
 * the list is the full experience when WebGL is unavailable.
 */

import { useMemo, useState } from 'react';
import { COUNTRY_CO2, CO2_DATA_YEAR, CO2_SOURCE, co2Color, co2Intensity } from '@/lib/experience/co2';

type Sort = 'high' | 'low' | 'name';

export function Co2Panel({
  selectedIso,
  onSelect,
  className = '',
}: {
  selectedIso: string | null;
  onSelect: (iso: string | null) => void;
  className?: string;
}) {
  const [sort, setSort] = useState<Sort>('high');
  const rows = useMemo(() => {
    const r = [...COUNTRY_CO2];
    if (sort === 'high') r.sort((a, b) => b.perCapita - a.perCapita);
    if (sort === 'low') r.sort((a, b) => a.perCapita - b.perCapita);
    if (sort === 'name') r.sort((a, b) => a.country.localeCompare(b.country));
    return r;
  }, [sort]);
  const selected = COUNTRY_CO2.find((c) => c.iso === selectedIso) ?? null;

  return (
    <div className={`rounded-[22px] border border-white/10 bg-[rgba(4,8,12,0.62)] p-5 text-white backdrop-blur-xl ${className}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-bold">CO₂ per person, {CO2_DATA_YEAR}</h3>
          <p className="mt-0.5 text-[12.5px] text-white/55">Tonnes per year · fossil CO₂ within each country</p>
        </div>
        <label className="sr-only" htmlFor="co2-sort">
          Sort countries
        </label>
        <select
          id="co2-sort"
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          className="rounded-[10px] border border-white/15 bg-white/5 px-2.5 py-1.5 text-[12.5px] font-semibold text-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--mint)]"
        >
          <option value="high">Highest first</option>
          <option value="low">Lowest first</option>
          <option value="name">A–Z</option>
        </select>
      </div>

      {/* legend */}
      <div className="mt-4 flex items-center gap-2" aria-hidden="true">
        <span className="font-mono text-[10px] text-white/50">low</span>
        <span
          className="h-1.5 flex-1 rounded-full"
          style={{ background: `linear-gradient(90deg, ${co2Color(0)}, ${co2Color(0.5)}, ${co2Color(1)})` }}
        />
        <span className="font-mono text-[10px] text-white/50">high</span>
      </div>

      <ul className="cx-scroll mt-4 max-h-[300px] space-y-1 overflow-y-auto pr-1" aria-label="Countries">
        {rows.map((c) => {
          const on = c.iso === selectedIso;
          const t = co2Intensity(c.perCapita);
          return (
            <li key={c.iso}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onSelect(on ? null : c.iso)}
                className="group flex w-full items-center gap-3 rounded-[10px] px-2.5 py-2 text-left transition-colors duration-sm hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--mint)]"
                style={on ? { background: 'rgba(184,232,212,0.12)' } : undefined}
              >
                <span className="w-[118px] shrink-0 truncate text-[13px] font-semibold">{c.country}</span>
                <span className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]" aria-hidden="true">
                  <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${t * 100}%`, background: co2Color(t) }} />
                </span>
                <span className="w-[38px] shrink-0 text-right font-mono text-[12.5px] tabular-nums text-white/80">{c.perCapita.toFixed(1)}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <p className="mt-3 min-h-[2.6em] text-[12.5px] leading-[1.45] text-white/70" aria-live="polite">
        {selected
          ? `${selected.country}: ${selected.perCapita.toFixed(1)} t per person in ${CO2_DATA_YEAR}. Marker placed at ${selected.capital} — a national figure, not the city’s.`
          : 'Select a country to fly the globe there.'}
      </p>
      <p className="mt-2 font-mono text-[10px] leading-[1.5] text-white/40">
        Source:{' '}
        <a href={CO2_SOURCE.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-white/70">
          {CO2_SOURCE.label}
        </a>{' '}
        ({CO2_SOURCE.license}). Bar length uses a square-root scale.
      </p>
    </div>
  );
}
