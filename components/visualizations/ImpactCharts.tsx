'use client';

/**
 * Impact visualizations — props in, pixels out. None of these fetch data or
 * hold a default metric; the integrating screen supplies everything (see
 * docs/experience-integration.md). Each accepts `loading` and renders an
 * explicit empty state, so a new user never sees a fabricated chart.
 */

import { useId } from 'react';
import type { ActionItem, DailyFootprintData, GoalData, ReductionItem, WeeklyPoint } from '@/lib/experience/types';
import { formatKg, goalStatus, lineGeometry, trend, weekdayLabel, type GoalStatus } from '@/lib/experience/viz';
import { BasisChip, EmptyBody, LoadingBody, VizCard, VIZ_PALETTE } from './primitives';

// ─── Daily footprint ─────────────────────────────────────────────────────────

export function DailyFootprint({ data, loading, className }: { data?: DailyFootprintData | null; loading?: boolean; className?: string }) {
  const id = useId();
  if (loading) return <VizCard title="Today’s footprint" labelledBy={id} className={className}><LoadingBody /></VizCard>;
  if (!data || (data.kg <= 0 && !data.byCategory?.length)) {
    return (
      <VizCard title="Today’s footprint" labelledBy={id} className={className}>
        <EmptyBody>Nothing logged yet today. Your footprint appears here as you track.</EmptyBody>
      </VizCard>
    );
  }

  const r = 52;
  const C = 2 * Math.PI * r;
  const fill = data.goalKg ? Math.min(1, data.kg / data.goalKg) : 1;
  const over = data.goalKg !== undefined && data.kg > data.goalKg;
  const cats = (data.byCategory ?? []).filter((c) => c.kg > 0);
  const catTotal = cats.reduce((s, c) => s + c.kg, 0);

  return (
    <VizCard
      title="Today’s footprint"
      labelledBy={id}
      className={className}
      subtitle={data.goalKg !== undefined ? `Daily target ${formatKg(data.goalKg)}` : undefined}
    >
      <div className="flex flex-wrap items-center gap-6">
        <div className="relative h-[132px] w-[132px] shrink-0">
          <svg viewBox="0 0 128 128" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="64" cy="64" r={r} fill="none" stroke="var(--surface2)" strokeWidth="11" />
            <circle
              cx="64"
              cy="64"
              r={r}
              fill="none"
              stroke={over ? 'var(--danger)' : 'var(--lime)'}
              strokeWidth="11"
              strokeLinecap="round"
              strokeDasharray={C}
              strokeDashoffset={C * (1 - fill)}
              style={{ transition: 'stroke-dashoffset var(--dur-lg) var(--ease-out)' }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-[26px] font-extrabold leading-none tabular-nums">{data.kg.toFixed(1)}</span>
            <span className="mt-1 text-[11px] font-semibold text-muted">kg CO₂e</span>
          </div>
        </div>
        <div className="min-w-[160px] flex-1">
          {data.goalKg !== undefined && (
            <p className="mb-3 text-[13px] font-semibold" style={{ color: over ? 'var(--danger)' : 'var(--lime-deep)' }}>
              {over ? `${formatKg(data.kg - data.goalKg)} over target` : `${formatKg(data.goalKg - data.kg)} left in today’s target`}
            </p>
          )}
          {cats.length > 0 && (
            <>
              <div className="flex h-2.5 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
                {cats.map((c, i) => (
                  <span key={c.id} style={{ width: `${(c.kg / catTotal) * 100}%`, background: c.color ?? VIZ_PALETTE[i % VIZ_PALETTE.length] }} />
                ))}
              </div>
              <ul className="mt-3 space-y-1.5">
                {cats.map((c, i) => (
                  <li key={c.id} className="flex items-center gap-2 text-[12.5px]">
                    <span aria-hidden="true" className="h-2.5 w-2.5 rounded-[3px]" style={{ background: c.color ?? VIZ_PALETTE[i % VIZ_PALETTE.length] }} />
                    <span className="font-semibold">{c.label}</span>
                    <span className="ml-auto font-mono tabular-nums text-muted">{formatKg(c.kg)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </VizCard>
  );
}

// ─── Weekly progression ──────────────────────────────────────────────────────

export function WeeklyProgression({
  series,
  loading,
  className,
  title = 'Last 7 days',
}: {
  series?: WeeklyPoint[] | null;
  loading?: boolean;
  className?: string;
  title?: string;
}) {
  const id = useId();
  const gradId = `${id}-grad`;
  if (loading) return <VizCard title={title} labelledBy={id} className={className}><LoadingBody /></VizCard>;
  if (!series || series.length < 2 || series.every((p) => p.kg === 0)) {
    return (
      <VizCard title={title} labelledBy={id} className={className}>
        <EmptyBody>Log a couple of days and your weekly trend appears here.</EmptyBody>
      </VizCard>
    );
  }

  const W = 560;
  const H = 180;
  const g = lineGeometry(series, W, H, 14);
  const t = trend(series);
  const total = series.reduce((s, p) => s + p.kg, 0);

  return (
    <VizCard
      title={title}
      labelledBy={id}
      className={className}
      subtitle={`${formatKg(total)} in total`}
      action={
        t !== null && (
          <span
            className="rounded-full px-2.5 py-1 text-[12px] font-bold"
            style={t <= 0 ? { background: 'var(--lime-soft)', color: 'var(--lime-deep)' } : { background: 'var(--danger-soft)', color: 'var(--danger)' }}
          >
            {t <= 0 ? '↓' : '↑'} {Math.abs(Math.round(t * 100))}% vs earlier
          </span>
        )
      }
    >
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--lime)" stopOpacity="0.32" />
            <stop offset="100%" stopColor="var(--lime)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="14" x2={W - 14} y1={14 + (H - 28) * f} y2={14 + (H - 28) * f} stroke="var(--border)" strokeDasharray="3 5" />
        ))}
        <path d={g.area} fill={`url(#${gradId})`} />
        <path d={g.line} fill="none" stroke="var(--lime)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {g.points.map((p, i) => (
          <circle key={p.date} cx={p.x} cy={p.y} r={i === g.points.length - 1 ? 5 : 3.2} fill="var(--surface)" stroke="var(--lime)" strokeWidth="2" />
        ))}
      </svg>
      {/* Axis labels in HTML so they stay readable when the chart scales down on phones. */}
      <div className="relative mt-1 h-4" aria-hidden="true">
        {g.points.map((p) => (
          <span
            key={p.date}
            className="absolute -translate-x-1/2 text-[11px] font-semibold text-muted"
            style={{ left: `${(p.x / W) * 100}%` }}
          >
            {weekdayLabel(p.date)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>{title}, kilograms CO₂e per day</caption>
        <tbody>
          {series.map((p) => (
            <tr key={p.date}>
              <th scope="row">{p.date}</th>
              <td>{p.kg.toFixed(1)} kg</td>
            </tr>
          ))}
        </tbody>
      </table>
    </VizCard>
  );
}

// ─── Estimated reductions ────────────────────────────────────────────────────

export function ReductionEstimates({ items, loading, className }: { items?: ReductionItem[] | null; loading?: boolean; className?: string }) {
  const id = useId();
  if (loading) return <VizCard title="Reductions" labelledBy={id} className={className}><LoadingBody /></VizCard>;
  if (!items?.length) {
    return (
      <VizCard title="Reductions" labelledBy={id} className={className}>
        <EmptyBody>Add an action to your plan to see what it could save.</EmptyBody>
      </VizCard>
    );
  }
  const max = Math.max(...items.map((i) => i.kgPerWeek));
  const measured = items.filter((i) => i.basis === 'measured').reduce((s, i) => s + i.kgPerWeek, 0);
  const estimated = items.filter((i) => i.basis === 'estimate').reduce((s, i) => s + i.kgPerWeek, 0);

  return (
    <VizCard
      title="Reductions"
      labelledBy={id}
      className={className}
      subtitle={
        <>
          {measured > 0 && <>{formatKg(measured)}/week measured</>}
          {measured > 0 && estimated > 0 && ' · '}
          {estimated > 0 && <>{formatKg(estimated)}/week estimated</>}
        </>
      }
    >
      <ul className="space-y-3">
        {items.map((it) => (
          <li key={it.id}>
            <div className="mb-1.5 flex items-center gap-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate font-semibold">{it.label}</span>
              <BasisChip basis={it.basis} />
              <span className="w-[72px] text-right font-mono tabular-nums text-muted">−{formatKg(it.kgPerWeek)}</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
              <span
                className="block h-full rounded-full"
                style={{
                  width: `${(it.kgPerWeek / max) * 100}%`,
                  background: it.basis === 'measured' ? 'var(--lime)' : 'repeating-linear-gradient(135deg, var(--lime) 0 6px, var(--lime-soft) 6px 10px)',
                }}
              />
            </div>
          </li>
        ))}
      </ul>
    </VizCard>
  );
}

// ─── Goal progress ───────────────────────────────────────────────────────────

const STATUS: Record<GoalStatus, { label: string; bg: string; fg: string }> = {
  met: { label: 'Goal met', bg: 'var(--lime-soft)', fg: 'var(--lime-deep)' },
  'on-pace': { label: 'On pace', bg: 'var(--lime-soft)', fg: 'var(--lime-deep)' },
  'at-risk': { label: 'Above pace', bg: 'var(--blue-soft)', fg: 'var(--blue)' },
  over: { label: 'Over budget', bg: 'var(--danger-soft)', fg: 'var(--danger)' },
};

export function GoalProgress({ goal, loading, className }: { goal?: GoalData | null; loading?: boolean; className?: string }) {
  const id = useId();
  if (loading) return <VizCard title="Goal" labelledBy={id} className={className}><LoadingBody rows={2} /></VizCard>;
  if (!goal) {
    return (
      <VizCard title="Goal" labelledBy={id} className={className}>
        <EmptyBody>Set a weekly footprint budget to track progress against it.</EmptyBody>
      </VizCard>
    );
  }
  const s = goalStatus(goal);
  const used = Math.min(1, goal.budgetKg > 0 ? goal.usedKg / goal.budgetKg : 1);
  const pct = Math.round(used * 100);

  return (
    <VizCard
      title={goal.label}
      labelledBy={id}
      className={className}
      subtitle={`${formatKg(goal.usedKg)} of ${formatKg(goal.budgetKg)} this ${goal.period}`}
      action={
        <span className="rounded-full px-2.5 py-1 text-[12px] font-bold" style={{ background: STATUS[s].bg, color: STATUS[s].fg }}>
          {STATUS[s].label}
        </span>
      }
    >
      <div
        className="relative h-3.5 overflow-visible rounded-full bg-surface2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-label={`${pct}% of the ${goal.period}ly budget used`}
      >
        <span className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${pct}%`, background: STATUS[s].fg, transition: 'width var(--dur-lg) var(--ease-out)' }} />
        {goal.elapsed < 1 && (
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -top-1 w-[2px] rounded-full bg-text"
            style={{ left: `calc(${Math.min(1, goal.elapsed) * 100}% - 1px)` }}
            title="Where you'd be at an even pace"
          />
        )}
      </div>
      <div className="mt-2 flex justify-between text-[11.5px] text-muted">
        <span>{pct}% used</span>
        {goal.elapsed < 1 && <span>│ even pace: {Math.round(goal.elapsed * 100)}%</span>}
      </div>
    </VizCard>
  );
}

// ─── Action completion ───────────────────────────────────────────────────────

export function ActionCompletion({
  actions,
  loading,
  onToggle,
  className,
}: {
  actions?: ActionItem[] | null;
  loading?: boolean;
  /** When provided, items become checkboxes. The caller persists the change. */
  onToggle?: (id: string, done: boolean) => void;
  className?: string;
}) {
  const id = useId();
  if (loading) return <VizCard title="Actions" labelledBy={id} className={className}><LoadingBody /></VizCard>;
  if (!actions?.length) {
    return (
      <VizCard title="Actions" labelledBy={id} className={className}>
        <EmptyBody>No actions in your plan yet.</EmptyBody>
      </VizCard>
    );
  }
  const done = actions.filter((a) => a.done).length;
  const pct = Math.round((done / actions.length) * 100);

  return (
    <VizCard title="Actions" labelledBy={id} className={className} subtitle={`${done} of ${actions.length} complete`}>
      <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface2" aria-hidden="true">
        <span className="block h-full rounded-full bg-lime" style={{ width: `${pct}%`, transition: 'width var(--dur-lg) var(--ease-out)' }} />
      </div>
      <ul className="space-y-1">
        {actions.map((a) => (
          <li key={a.id}>
            <label className={`flex items-center gap-3 rounded-[12px] px-2 py-2 ${onToggle ? 'cursor-pointer hover:bg-surface2' : ''}`}>
              {onToggle ? (
                <input
                  type="checkbox"
                  checked={a.done}
                  onChange={(e) => onToggle(a.id, e.target.checked)}
                  className="h-[18px] w-[18px] shrink-0 accent-[var(--lime)]"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[6px] border text-[11px] font-black"
                  style={a.done ? { background: 'var(--lime)', borderColor: 'var(--lime)', color: '#0c1d15' } : { borderColor: 'var(--border)' }}
                >
                  {a.done ? '✓' : ''}
                </span>
              )}
              <span className={`min-w-0 flex-1 text-[13.5px] ${a.done ? 'text-muted line-through decoration-[1.5px]' : 'font-semibold'}`}>
                {a.title}
                {!onToggle && <span className="sr-only">{a.done ? ' (done)' : ' (not done)'}</span>}
              </span>
              {a.kgPerWeek !== undefined && (
                <span className="font-mono text-[12px] tabular-nums text-muted">−{formatKg(a.kgPerWeek)}/wk</span>
              )}
            </label>
          </li>
        ))}
      </ul>
    </VizCard>
  );
}
