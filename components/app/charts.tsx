'use client';

import { CATEGORY_META, round1, type Category } from '@/lib/carbon';
import { CategoryIcon } from '@/components/app/illustrations';

/** Circular score ring (matches the landing dashboard ring). */
export function ScoreRing({
  value,
  unit = 'kg CO₂',
  fraction,
  size = 150,
  color = 'var(--lime)',
  track = 'var(--border)',
  textColor,
}: {
  value: string | number;
  unit?: string;
  fraction: number; // 0..1 of the ring drawn
  size?: number;
  color?: string;
  track?: string;
  textColor?: string;
}) {
  const r = 52;
  const c = 2 * Math.PI * r; // ≈ 326.7
  const offset = c * (1 - Math.max(0, Math.min(1, fraction)));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke={track} strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-[clamp(24px,6vw,30px)] font-extrabold leading-none" style={{ color: textColor }}>{value}</div>
        <div className="mt-0.5 text-[11px] font-semibold text-muted">{unit}</div>
      </div>
    </div>
  );
}

/** Circular gauge for a single before/after reading (% change, % savings, etc). Same visual language as ScoreRing. */
export function ImpactGauge({
  value,
  unit,
  fraction,
  size = 130,
  color = 'var(--lime)',
  track = 'var(--border)',
  textColor,
}: {
  value: string | number;
  unit: string;
  fraction: number; // 0..1 of the ring drawn
  size?: number;
  color?: string;
  track?: string;
  textColor?: string;
}) {
  const r = 52;
  const c = 2 * Math.PI * r; // ≈ 326.7
  const offset = c * (1 - Math.max(0, Math.min(1, fraction)));
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} fill="none" stroke={track} strokeWidth="12" />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
          transform="rotate(-90 60 60)"
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="font-display text-[clamp(20px,5vw,26px)] font-extrabold leading-none" style={{ color: textColor }}>{value}</div>
        <div className="mt-0.5 text-[11px] font-semibold text-muted">{unit}</div>
      </div>
    </div>
  );
}

import { useState } from 'react';

const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WD_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** 7-day (or n-day) bar chart with interactive hover, target line, and peak highlighted. */
export function WeeklyChart({
  data,
  height = 140,
  targetBudget,
  onSelectDay,
}: {
  data: { key: string; total: number }[];
  height?: number;
  targetBudget?: number;
  onSelectDay?: (key: string) => void;
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const maxVal = Math.max(1, ...data.map((d) => d.total), targetBudget || 0);
  const peak = Math.max(...data.map((d) => d.total));

  return (
    <div className="relative pt-6">
      {/* Target budget benchmark line (Watershed style) */}
      {targetBudget && targetBudget > 0 && (
        <div
          className="pointer-events-none absolute inset-x-0 z-10 flex items-center"
          style={{ bottom: `${(targetBudget / maxVal) * 100 * (height / (height + 28)) + 28}px` }}
        >
          <div className="w-full border-t border-dashed border-emerald-500/40" />
          <span className="ml-2 whitespace-nowrap rounded-md bg-surface2 px-2 py-0.5 font-mono text-[10px] font-bold text-muted">
            Target: {targetBudget} kg
          </span>
        </div>
      )}

      {/* Floating tooltip on hover */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="pointer-events-none absolute -top-2 left-1/2 -translate-x-1/2 z-20 rounded-xl border border-border bg-slate-900/95 px-3 py-1.5 text-center shadow-xl backdrop-blur-md">
          <div className="text-[10px] font-semibold text-slate-400">
            {new Date(`${data[hoveredIdx].key}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </div>
          <div className="font-mono text-xs font-extrabold text-white">
            {round1(data[hoveredIdx].total)} kg CO₂
          </div>
        </div>
      )}

      <div className="flex items-end gap-2.5 sm:gap-3.5" style={{ height: `${height}px` }}>
        {data.map((d, idx) => {
          const dt = new Date(`${d.key}T00:00:00`);
          const isPeak = d.total === peak && peak > 0;
          const isHovered = hoveredIdx === idx;
          const pct = Math.max((d.total / maxVal) * 100, d.total > 0 ? 14 : 4);
          const isToday = idx === data.length - 1;

          return (
            <div
              key={d.key}
              className="group relative flex h-full flex-1 cursor-pointer flex-col items-center justify-end"
              onMouseEnter={() => setHoveredIdx(idx)}
              onMouseLeave={() => setHoveredIdx(null)}
              onClick={() => onSelectDay?.(d.key)}
            >
              {/* Bar track container with background fill */}
              <div className="relative flex h-full w-full items-end justify-center rounded-xl bg-surface2/60 p-1 transition-all group-hover:bg-surface2">
                <div
                  className="w-full rounded-lg transition-all duration-300"
                  style={{
                    height: `${pct}%`,
                    background:
                      d.total === 0
                        ? 'transparent'
                        : isPeak
                        ? 'linear-gradient(180deg, #818cf8 0%, #6366f1 100%)'
                        : isHovered
                        ? 'linear-gradient(180deg, #34d399 0%, #059669 100%)'
                        : 'linear-gradient(180deg, #10b981 0%, #0d9488 100%)',
                    boxShadow:
                      isPeak
                        ? '0 0 16px rgba(99, 102, 241, 0.45)'
                        : isHovered || isToday
                        ? '0 0 12px rgba(16, 185, 129, 0.35)'
                        : 'none',
                  }}
                />
              </div>

              {/* Day label */}
              <div className="mt-2 flex flex-col items-center gap-0.5">
                <span
                  className={`text-[11px] font-bold transition-colors ${
                    isToday ? 'text-emerald-500 font-extrabold' : isHovered ? 'text-text' : 'text-muted'
                  }`}
                >
                  <span className="sm:hidden">{WD_SHORT[dt.getDay()]}</span>
                  <span className="hidden sm:inline">{WD[dt.getDay()]}</span>
                </span>
                {isToday && (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shadow-sm" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Horizontal category breakdown bars with % share and metrics. */
export function CategoryBars({
  data,
  max,
  showPercentage = true,
}: {
  data: Record<Category, number>;
  max?: number;
  showPercentage?: boolean;
}) {
  const entries = (Object.entries(data) as [Category, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const top = max ?? Math.max(1, ...entries.map(([, v]) => v));

  if (entries.length === 0) {
    return <div className="py-2 text-sm text-muted">No activity logged yet today.</div>;
  }

  return (
    <div className="flex flex-col gap-3.5">
      {entries.map(([cat, val]) => {
        const meta = CATEGORY_META[cat];
        const pctOfTotal = total > 0 ? Math.round((val / total) * 100) : 0;
        const barWidth = Math.min(100, Math.max(6, (val / top) * 100));

        return (
          <div key={cat} className="group">
            <div className="mb-1.5 flex items-center justify-between text-xs sm:text-[13px]">
              <span className="flex items-center gap-2 font-semibold">
                <CategoryIcon category={cat} color={meta.color} size={22} />
                <span className="text-text group-hover:text-lime-deep transition-colors">{meta.label}</span>
                {showPercentage && (
                  <span className="rounded bg-surface2 px-1.5 py-0.5 text-[10px] font-bold text-muted">
                    {pctOfTotal}%
                  </span>
                )}
              </span>
              <span className="font-mono font-bold" style={{ color: meta.color }}>
                {round1(val)} <span className="text-[11px] font-normal text-muted">kg</span>
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-surface2/80 p-0.5">
              <div
                className="h-full rounded-full transition-[width] duration-700 ease-out"
                style={{
                  width: `${barWidth}%`,
                  background: `linear-gradient(90deg, ${meta.color}, ${meta.color}dd)`,
                  boxShadow: `0 0 8px ${meta.color}40`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** Linear progress bar for Carbon Budget tracking (Watershed style). */
export function BudgetProgressBar({
  used,
  budget,
  unit = 'kg CO₂',
}: {
  used: number;
  budget: number;
  unit?: string;
}) {
  const pct = Math.min(100, Math.round((used / budget) * 100));
  const remaining = Math.max(0, round1(budget - used));
  const isOver = used > budget;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between">
        <div>
          <span className="font-mono text-xl font-extrabold">{round1(used)}</span>
          <span className="text-xs text-muted font-medium"> / {budget} {unit}</span>
        </div>
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-bold ${
            isOver ? 'bg-danger-soft text-danger' : 'bg-lime-soft text-lime-deep'
          }`}
        >
          {isOver ? `+${round1(used - budget)} kg over` : `${remaining} kg headroom`}
        </span>
      </div>
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-surface2">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${pct}%`,
            background: isOver
              ? 'var(--danger)'
              : pct > 80
              ? 'var(--blue)'
              : 'linear-gradient(90deg, var(--lime) 0%, var(--lime-deep) 100%)',
          }}
        />
      </div>
      <div className="flex justify-between text-[11px] text-muted font-medium">
        <span>0 kg</span>
        <span>50%</span>
        <span>Limit: {budget} kg</span>
      </div>
    </div>
  );
}

