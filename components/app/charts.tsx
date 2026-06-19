'use client';

import { CATEGORY_META, round1, type Category } from '@/lib/carbon';

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

const WD = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** 7-day (or n-day) bar chart with the peak highlighted. */
export function WeeklyChart({ data, height = 120 }: { data: { key: string; total: number }[]; height?: number }) {
  const max = Math.max(1, ...data.map((d) => d.total));
  const peak = Math.max(...data.map((d) => d.total));
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d) => {
        const dt = new Date(`${d.key}T00:00:00`);
        const isPeak = d.total === peak && peak > 0;
        const pct = (d.total / max) * 100;
        return (
          <div key={d.key} className="flex flex-1 flex-col items-center gap-1.5">
            <div className="flex w-full flex-1 items-end">
              <div
                className="w-full rounded-md transition-[height] duration-700"
                style={{
                  height: `${Math.max(pct, d.total > 0 ? 6 : 2)}%`,
                  background: d.total === 0 ? 'var(--border)' : isPeak ? 'var(--lime)' : 'var(--lime-soft)',
                  border: d.total > 0 && !isPeak ? '1px solid var(--lime)' : 'none',
                  opacity: d.total === 0 ? 0.5 : 1,
                }}
                title={`${round1(d.total)} kg`}
              />
            </div>
            <span className="text-[10px] font-semibold text-muted">{WD[dt.getDay()]}</span>
          </div>
        );
      })}
    </div>
  );
}

/** Horizontal category breakdown bars. */
export function CategoryBars({ data, max }: { data: Record<Category, number>; max?: number }) {
  const entries = (Object.entries(data) as [Category, number][]).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const top = max ?? Math.max(1, ...entries.map(([, v]) => v));
  if (entries.length === 0) {
    return <div className="text-sm text-muted">No activity logged yet.</div>;
  }
  return (
    <div className="flex flex-col gap-3">
      {entries.map(([cat, val]) => {
        const meta = CATEGORY_META[cat];
        return (
          <div key={cat}>
            <div className="mb-1 flex items-center justify-between text-[13px]">
              <span className="font-semibold">
                {meta.emoji} {meta.label}
              </span>
              <span className="font-bold" style={{ color: meta.color }}>{round1(val)} kg</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface2">
              <div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${(val / top) * 100}%`, background: meta.color }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
