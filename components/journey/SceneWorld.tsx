'use client';

/**
 * Scene 2 — your world. Three data layers on the planet, each sourced:
 *   CO₂ per person (OWID / Global Carbon Project), electricity grid intensity
 *   (Ember via OWID), and a journey — a real city pair drawn as a great-circle
 *   arc with the tracker's own per-km factors.
 *
 * The panel is the accessible twin of the globe: everything the planet shows
 * is selectable and readable here, so the globe is never the only way in.
 */

import { forwardRef, useId, useMemo, useRef, type KeyboardEvent } from 'react';
import { motion } from 'framer-motion';
import { COUNTRY_CO2, CO2_DATA_YEAR, CO2_SOURCE, WORLD_CO2_PER_CAPITA, co2Color, co2Intensity } from '@/lib/experience/co2';
import { GRID_INTENSITY, GRID_SOURCE, WORLD_GRID, gridColor, gridIntensity01, kgForKwh } from '@/lib/experience/grid';
import { MODE_META, TRIPS, compareModes, tripKm, type TripMode } from '@/lib/experience/trips';
import { UI_SPRING } from '@/components/physics';
import s from './journey.module.css';

export type WorldTab = 'co2' | 'grid' | 'trip';
export interface WorldSelection {
  tab: WorldTab;
  iso: string | null;
  tripId: string;
  mode: TripMode;
}

const TABS: { id: WorldTab; label: string; short?: string }[] = [
  { id: 'co2', label: 'CO₂ per person', short: 'CO₂/person' },
  { id: 'grid', label: 'Electricity' },
  { id: 'trip', label: 'A journey' },
];

/** 1.5 kW split AC × 4 h — a concrete, everyday load to make g/kWh tangible. */
const AC_KWH = 6;

export const SceneWorld = forwardRef<HTMLElement, { selection: WorldSelection; onChange: (s: WorldSelection) => void }>(function SceneWorld(
  { selection, onChange },
  ref
) {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();
  const set = (patch: Partial<WorldSelection>) => onChange({ ...selection, ...patch });

  const onTabKey = (e: KeyboardEvent, i: number) => {
    const dir = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const n = (i + dir + TABS.length) % TABS.length;
    set({ tab: TABS[n].id });
    tabRefs.current[n]?.focus();
  };

  return (
    <section ref={ref} id="world" aria-labelledby="world-title" className="relative flex min-h-[100svh] items-end py-24 md:items-center">
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-6">
        <div className={`pointer-events-auto w-full max-w-[460px] rounded-[26px] p-6 sm:p-7 ${s.panel}`}>
          <div className="mb-2.5 font-mono text-xs uppercase tracking-[0.16em] text-lime">Your world</div>
          <h2 id="world-title" className="mb-2 font-display text-[clamp(28px,3.4vw,40px)] font-extrabold leading-[1.04] tracking-[-0.03em]">
            See where carbon comes from.
          </h2>
          <p className="mb-5 text-[15px] leading-[1.55] text-muted">
            Pick a layer. The planet answers — tap a spike on the globe or choose below.
          </p>

          <div role="tablist" aria-label="Planet layers" className="mb-5 grid grid-cols-3 gap-1 rounded-[14px] border border-border bg-surface2 p-1">
            {TABS.map((t, i) => {
              const on = selection.tab === t.id;
              return (
                <button
                  key={t.id}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  role="tab"
                  id={`${baseId}-tab-${t.id}`}
                  aria-selected={on}
                  aria-controls={`${baseId}-panel`}
                  tabIndex={on ? 0 : -1}
                  onKeyDown={(e) => onTabKey(e, i)}
                  onClick={() => set({ tab: t.id })}
                  className="relative rounded-[10px] px-2 py-2.5 text-[13px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime"
                  style={{ color: on ? '#0c1d15' : 'var(--muted)' }}
                >
                  {on && <motion.span layoutId="world-tab" className="absolute inset-0 rounded-[10px] bg-lime" transition={UI_SPRING} />}
                  {t.short ? (
                    <>
                      <span className="relative sm:hidden">{t.short}</span>
                      <span className="relative hidden sm:inline">{t.label}</span>
                    </>
                  ) : (
                    <span className="relative">{t.label}</span>
                  )}
                </button>
              );
            })}
          </div>

          <div role="tabpanel" id={`${baseId}-panel`} aria-labelledby={`${baseId}-tab-${selection.tab}`} aria-live="polite">
            {selection.tab === 'co2' && <Co2Detail iso={selection.iso} onPick={(iso) => set({ iso })} />}
            {selection.tab === 'grid' && <GridDetail iso={selection.iso} onPick={(iso) => set({ iso })} />}
            {selection.tab === 'trip' && <TripDetail tripId={selection.tripId} mode={selection.mode} onChange={(p) => set(p)} />}
          </div>
        </div>
      </div>
    </section>
  );
});

// ─── Layers ──────────────────────────────────────────────────────────────────

function CountrySelect({ iso, onPick, rows }: { iso: string | null; onPick: (iso: string | null) => void; rows: { iso: string; label: string }[] }) {
  const id = useId();
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-semibold text-muted">
        Country
      </label>
      <select
        id={id}
        value={iso ?? ''}
        onChange={(e) => onPick(e.target.value || null)}
        className="w-full appearance-none rounded-[12px] border border-border bg-[#0b1712] px-3.5 py-3 text-[15px] font-semibold text-text outline-none focus-visible:border-lime"
        style={{ backgroundImage: 'linear-gradient(45deg,transparent 50%,#a4b9ac 50%),linear-gradient(135deg,#a4b9ac 50%,transparent 50%)', backgroundPosition: 'calc(100% - 18px) 55%, calc(100% - 13px) 55%', backgroundSize: '5px 5px', backgroundRepeat: 'no-repeat' }}
      >
        <option value="">Choose a country…</option>
        {rows.map((r) => (
          <option key={r.iso} value={r.iso}>
            {r.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function BigFigure({ value, unit, color, note }: { value: string; unit: string; color: string; note: string }) {
  return (
    <div className="mb-4 rounded-[16px] border border-border bg-surface2 p-4">
      <div className="flex items-baseline gap-2">
        <span className="font-display text-[40px] font-extrabold leading-none tracking-[-0.03em]" style={{ color }}>
          {value}
        </span>
        <span className="text-[13px] font-semibold text-muted">{unit}</span>
      </div>
      <p className="mt-2 text-[13.5px] leading-[1.5] text-text">{note}</p>
    </div>
  );
}

function Source({ label, url, license, extra }: { label: string; url: string; license: string; extra?: string }) {
  return (
    <p className="text-[11.5px] leading-[1.5] text-muted">
      {extra && <>{extra} </>}Source:{' '}
      <a href={url} target="_blank" rel="noreferrer" className="underline decoration-white/30 underline-offset-2 hover:text-text">
        {label}
      </a>{' '}
      · {license}
    </p>
  );
}

function Co2Detail({ iso, onPick }: { iso: string | null; onPick: (iso: string | null) => void }) {
  const rows = useMemo(() => [...COUNTRY_CO2].sort((a, b) => b.perCapita - a.perCapita), []);
  const c = rows.find((r) => r.iso === iso);
  const rank = c ? rows.indexOf(c) + 1 : 0;
  return (
    <>
      <CountrySelect iso={iso} onPick={onPick} rows={rows.map((r) => ({ iso: r.iso, label: `${r.country} — ${r.perCapita.toFixed(1)} t` }))} />
      {c ? (
        <BigFigure
          value={c.perCapita.toFixed(1)}
          unit="t CO₂ per person / yr"
          color={co2Color(co2Intensity(c.perCapita))}
          note={`${ratio(c.perCapita, WORLD_CO2_PER_CAPITA)} the world average of ${WORLD_CO2_PER_CAPITA} t. #${rank} of the ${rows.length} countries shown.`}
        />
      ) : (
        <BigFigure value={String(WORLD_CO2_PER_CAPITA)} unit="t CO₂ per person / yr" color="var(--lime)" note="The world average. Spike height on the globe is each country's figure." />
      )}
      <Source label={CO2_SOURCE.label} url={CO2_SOURCE.url} license={CO2_SOURCE.license} extra={`${CO2_DATA_YEAR}, fossil CO₂ within each country.`} />
    </>
  );
}

function GridDetail({ iso, onPick }: { iso: string | null; onPick: (iso: string | null) => void }) {
  const rows = useMemo(
    () =>
      COUNTRY_CO2.filter((c) => GRID_INTENSITY[c.iso])
        .map((c) => ({ ...c, g: GRID_INTENSITY[c.iso] }))
        .sort((a, b) => a.g.g - b.g.g),
    []
  );
  const c = rows.find((r) => r.iso === iso);
  const g = c ? c.g : WORLD_GRID;
  const ac = kgForKwh(AC_KWH, g.g);
  return (
    <>
      <CountrySelect iso={iso} onPick={onPick} rows={rows.map((r) => ({ iso: r.iso, label: `${r.country} — ${r.g.g} g/kWh` }))} />
      <BigFigure
        value={String(g.g)}
        unit={`g CO₂e per kWh · ${g.year}`}
        color={gridColor(gridIntensity01(g.g))}
        note={`${c ? `${c.country}: ${ratio(g.g, WORLD_GRID.g)} the world average (${WORLD_GRID.g} g).` : 'World average.'} Running a 1.5 kW air conditioner for 4 hours here ≈ ${ac.toFixed(1)} kg CO₂e.`}
      />
      <Source label={GRID_SOURCE.label} url={GRID_SOURCE.url} license={GRID_SOURCE.license} extra="National annual average; your hour and supplier change it." />
    </>
  );
}

function TripDetail({ tripId, mode, onChange }: { tripId: string; mode: TripMode; onChange: (p: { tripId?: string; mode?: TripMode }) => void }) {
  const trip = TRIPS.find((t) => t.id === tripId) ?? TRIPS[0];
  const modes = compareModes(trip);
  const active = trip.modes.includes(mode) ? mode : modes[0].mode;
  const max = Math.max(...modes.map((m) => m.kg), 0.1);
  const km = tripKm(trip);

  return (
    <>
      <fieldset className="mb-4">
        <legend className="mb-1.5 text-[12px] font-semibold text-muted">Route</legend>
        <div className="flex flex-wrap gap-1.5">
          {TRIPS.map((t) => {
            const on = t.id === trip.id;
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ tripId: t.id, mode: t.modes.includes(active) ? active : compareModes(t)[0].mode })}
                className="rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime"
                style={on ? { background: 'var(--lime-soft)', borderColor: 'var(--lime)', color: 'var(--lime-deep)' } : { borderColor: 'var(--border)', color: 'var(--muted)' }}
              >
                {t.from.name} → {t.to.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="mb-3 text-[12px] font-semibold text-muted">
        One way, one person · {km.toLocaleString()} km straight-line
      </div>
      <ul className="mb-4 flex flex-col gap-2">
        {modes.map((m) => {
          const on = m.mode === active;
          return (
            <li key={m.mode}>
              <button
                type="button"
                aria-pressed={on}
                onClick={() => onChange({ mode: m.mode })}
                className="w-full rounded-[12px] border p-2.5 text-left transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-lime"
                style={{ borderColor: on ? 'var(--lime)' : 'var(--border)', background: on ? 'var(--lime-soft)' : 'transparent' }}
              >
                <div className="mb-1.5 flex items-center justify-between text-[13.5px]">
                  <span className="font-bold">
                    <span aria-hidden>{MODE_META[m.mode].emoji}</span> {MODE_META[m.mode].short}
                  </span>
                  <span className="font-mono font-semibold" style={{ color: on ? 'var(--lime-deep)' : 'var(--text)' }}>
                    {m.kg.toFixed(1)} kg
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: m.mode === 'Flight' ? '#f08a5d' : m.mode === 'Car ride' ? '#f3b860' : '#4fd38a' }}
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(2, (m.kg / max) * 100)}%` }}
                    transition={{ type: 'spring', stiffness: 140, damping: 20 }}
                  />
                </div>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="text-[11.5px] leading-[1.5] text-muted">
        Same per-km factors as the Track screen. Real roads and rails run longer than the straight line, so ground figures here are a lower bound.
      </p>
    </>
  );
}

function ratio(v: number, ref: number): string {
  const r = v / ref;
  if (r >= 1.15) return `${r.toFixed(1)}×`;
  if (r <= 0.87) return `${Math.round((1 - r) * 100)}% below`;
  return 'About';
}
